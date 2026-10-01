import { reactive, computed, watch } from 'vue'
import { supabase, mustReturnRows } from './supabase.js'
import { authState } from './profileStore.js'

// 쪽지 - tb_dm_conversation / tb_dm_message. 두 사람 사이 대화방은 하나 (open_conversation RPC 가 만들거나 찾아 줌)
// 대화 당사자만 보고 쓸 수 있음(RLS). 읽음 표시는 read_at
const PERSON = (fk) => `tb_profile!${fk}(id, nickname, avatar_url)`
const CONV_SELECT = `*, a:${PERSON('tb_dm_conversation_user_a_fkey')}, b:${PERSON('tb_dm_conversation_user_b_fkey')}`

// keepId: 나간 방이라도 지금 열려 있는 방(쪽지 보내기로 다시 연 방)은 목록에 남김
export const messagesState = reactive({ conversations: [], loaded: false, keepId: null })

function fmtTime(ts) {
  const d = new Date(ts)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
// 내가 내 화면에서 지운 쪽지인지 (보낸 쪽지는 sender_hidden_at, 받은 쪽지는 receiver_hidden_at)
const hiddenForMe = (m, uid) => (m.sender_id === uid ? m.sender_hidden_at : m.receiver_hidden_at)

function mapMessage(m) {
  return { id: m.id, from: m.sender_id === authState.user?.id ? 'me' : 'them', text: m.text, date: fmtTime(m.created_at), readAt: m.read_at, createdAt: m.created_at }
}

// 대화 목록 + 대화마다 마지막 메시지·안 읽은 수
export async function loadConversations() {
  const uid = authState.user?.id
  if (!supabase || !uid) {
    messagesState.conversations = []
    messagesState.loaded = false
    return
  }
  const { data: convs, error } = await supabase.from('tb_dm_conversation').select(CONV_SELECT)
  if (error) throw error
  const ids = convs.map((c) => c.id)
  const { data: msgs } = ids.length
    ? await supabase.from('tb_dm_message').select('*').in('conversation_id', ids).order('created_at', { ascending: false }).limit(500)
    : { data: [] }
  const old = new Map(messagesState.conversations.map((c) => [c.id, c.messages]))
  const list = convs.map((c) => {
    const other = c.user_a === uid ? c.b : c.a
    // 내가 나간 방은 나간 뒤에 온 쪽지만 (카톡 나가기처럼)
    const leftAt = (c.user_a === uid ? c.a_left_at : c.b_left_at) || null
    const mine = (msgs || []).filter((m) => m.conversation_id === c.id && (!leftAt || m.created_at > leftAt) && !hiddenForMe(m, uid))
    return {
      leftAt,
      id: c.id,
      otherId: other?.id || null,
      withName: other?.nickname || '알 수 없음',
      avatar: other?.avatar_url || null,
      last: mine[0] ? mapMessage(mine[0]) : null,
      unread: mine.filter((m) => m.sender_id !== uid && !m.read_at).length,
      messages: old.get(c.id) || [],
    }
  })
  messagesState.conversations = list
    .filter((c) => !c.leftAt || c.last || c.id === messagesState.keepId)
    .sort((x, y) => (y.last?.createdAt || '').localeCompare(x.last?.createdAt || ''))
  messagesState.loaded = true
}

export function getConversation(id) {
  return messagesState.conversations.find((c) => String(c.id) === String(id))
}

export async function loadMessages(conv) {
  if (!supabase || !conv) return
  let q = supabase.from('tb_dm_message').select('*').eq('conversation_id', conv.id)
  if (conv.leftAt) q = q.gt('created_at', conv.leftAt)
  const { data, error } = await q.order('created_at', { ascending: true })
  if (error) throw error
  const uid = authState.user?.id
  const visible = data.filter((m) => !hiddenForMe(m, uid))
  conv.messages = visible.map(mapMessage)
  if (visible.length) conv.last = mapMessage(visible[visible.length - 1])
}

// 상대가 보낸 안 읽은 쪽지를 읽음으로 (0건이어도 정상이라 결과 행 확인 안 함)
export async function markConversationRead(conv) {
  const uid = authState.user?.id
  if (!supabase || !uid || !conv?.unread) return
  await supabase.from('tb_dm_message').update({ read_at: new Date().toISOString() })
    .eq('conversation_id', conv.id).neq('sender_id', uid).is('read_at', null)
  conv.unread = 0
}

export async function sendMessage(conv, text) {
  const uid = authState.user?.id
  if (!uid) throw new Error('로그인 필요')
  const body = (text || '').trim()
  if (!body) return
  const rows = await mustReturnRows(
    supabase.from('tb_dm_message').insert({ conversation_id: conv.id, sender_id: uid, text: body }).select('*'),
    '쪽지 전송 실패'
  )
  const m = mapMessage(rows[0])
  conv.messages.push(m)
  conv.last = m
}

// 쪽지 삭제 - 내 화면에서만 사라짐 (상대 화면엔 그대로). 보낸 쪽지·받은 쪽지 모두
export async function deleteMessage(conv, m) {
  const { error } = await supabase.rpc('d2r_hide_message', { p_message: m.id })
  if (error) throw new Error(/function|schema cache/i.test(error.message) ? '삭제 준비 중 (DB 업데이트 필요)' : error.message || '쪽지 삭제 실패')
  conv.messages = conv.messages.filter((x) => x.id !== m.id)
  conv.last = conv.messages[conv.messages.length - 1] || null
}

// 대화방 나가기 - 나에게서만 숨김. 상대가 새 쪽지를 보내면 그 쪽지부터 다시 보임
export async function leaveConversation(conv) {
  const { error } = await supabase.rpc('d2r_leave_conversation', { p_conversation: conv.id })
  if (error) throw new Error(/function|schema cache/i.test(error.message) ? '나가기 준비 중 (DB 업데이트 필요)' : error.message || '나가기 실패')
  if (messagesState.keepId === conv.id) messagesState.keepId = null
  messagesState.conversations = messagesState.conversations.filter((c) => c.id !== conv.id)
}

// 판매자 등에게 쪽지 보내기 - 대화방 번호를 돌려줌
export async function openConversationWith(otherUserId) {
  if (!authState.user) throw new Error('로그인 필요')
  const { data, error } = await supabase.rpc('open_conversation', { p_other: otherUserId })
  if (error) throw new Error(error.message || '대화방 열기 실패')
  messagesState.keepId = data
  return data
}

export const lastMessageOf = (conv) => conv.last
export const isConversationRead = (conv) => !conv.unread
export const unreadMessageCount = computed(() => messagesState.conversations.filter((c) => c.unread > 0).length)

// 로그인하면 불러오고, 30초마다 새 쪽지 확인 (창이 보일 때만)
let timer = 0
watch(() => authState.user?.id, (uid) => {
  clearInterval(timer)
  loadConversations().catch(() => {})
  if (uid) timer = setInterval(() => { if (!document.hidden) loadConversations().catch(() => {}) }, 30000)
}, { immediate: true })
