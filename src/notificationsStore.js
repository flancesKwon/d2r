import { reactive, computed, watch } from 'vue'
import { supabase } from './supabase.js'
import { authState } from './profileStore.js'
import { playChime } from './notifySound.js'

// 알림 - tb_notification. 내 알림만 보임(RLS). 알림은 화면에서 만들 수 없고 DB 함수만 만듦
// (예: 판매자가 구매신청을 수락하면 accept_trade_request 가 구매자에게 알림)
export const notificationsState = reactive({ items: [] })
// 이미 본 알림 id - 새로 받은 것 중 처음 보는 안 읽은 알림이 있으면 소리 (처음 불러올 때는 소리 없음)
let seen = null

function fmtDate(ts) {
  const d = new Date(ts)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

export async function loadNotifications() {
  if (!supabase || !authState.user) {
    notificationsState.items = []
    seen = null
    return
  }
  const { data, error } = await supabase.from('tb_notification').select('*').order('created_at', { ascending: false }).limit(30)
  if (error) throw error
  notificationsState.items = data.map((n) => ({ id: n.id, text: n.text, link: n.link, read: n.read, date: fmtDate(n.created_at) }))
  if (seen && data.some((n) => !n.read && !seen.has(n.id))) playChime()
  seen = new Set(data.map((n) => n.id))
}

export async function markNotificationRead(id) {
  const n = notificationsState.items.find((x) => x.id === id)
  if (!n || n.read) return
  n.read = true
  const { data } = await supabase.from('tb_notification').update({ read: true }).eq('id', id).select('id')
  if (!data?.length) n.read = false
}

// 알림이 가리키는 화면(/deals/3, /trade/5 ...)을 직접 열었으면 그 알림은 읽음으로
// (알림 목록을 눌러 들어오지 않고 쪽지함·거래방 목록에서 열어도 알림 숫자가 남지 않게)
const samePath = (a, b) => (a || '').replace(/\/+$/, '') === (b || '').replace(/\/+$/, '')
export async function markNotificationsReadFor(path) {
  const hits = notificationsState.items.filter((n) => !n.read && n.link && samePath(n.link, path))
  if (!hits.length || !supabase) return
  hits.forEach((n) => (n.read = true))
  const { data } = await supabase.from('tb_notification').update({ read: true }).in('id', hits.map((n) => n.id)).select('id')
  const ok = new Set((data || []).map((r) => r.id))
  hits.forEach((n) => { if (!ok.has(n.id)) n.read = false })
}

export async function markAllNotificationsRead() {
  const unread = notificationsState.items.filter((n) => !n.read)
  if (!unread.length) return
  unread.forEach((n) => (n.read = true))
  // 안 읽은 게 없으면 0건이 정상이라 결과 행은 확인 안 함
  await supabase.from('tb_notification').update({ read: true }).eq('read', false)
}

export const unreadNotificationCount = computed(() => notificationsState.items.filter((n) => !n.read).length)

// 로그인하면 불러오고, 30초마다 새 알림 확인 - 다른 탭을 보고 있어도 (새 알림 소리가 나게)
// 보통은 실시간(realtime.js)으로 바로 오고, 이건 실시간 연결이 끊겼을 때 뒤를 받침
let timer = 0
watch(() => authState.user?.id, (uid) => {
  clearInterval(timer)
  seen = null
  loadNotifications().catch(() => {})
  if (uid) timer = setInterval(() => loadNotifications().catch(() => {}), 30000)
}, { immediate: true })
