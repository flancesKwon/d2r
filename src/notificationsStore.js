import { reactive, computed, watch } from 'vue'
import { supabase } from './supabase.js'
import { authState } from './profileStore.js'

// 알림 - tb_notification. 내 알림만 보임(RLS). 알림은 화면에서 만들 수 없고 DB 함수만 만듦
// (예: 판매자가 구매신청을 수락하면 accept_trade_request 가 구매자에게 알림)
export const notificationsState = reactive({ items: [] })

function fmtDate(ts) {
  const d = new Date(ts)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}.${p(d.getDate())}`
}

export async function loadNotifications() {
  if (!supabase || !authState.user) {
    notificationsState.items = []
    return
  }
  const { data, error } = await supabase.from('tb_notification').select('*').order('created_at', { ascending: false }).limit(30)
  if (error) throw error
  notificationsState.items = data.map((n) => ({ id: n.id, text: n.text, link: n.link, read: n.read, date: fmtDate(n.created_at) }))
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

// 로그인하면 불러오고, 30초마다 새 알림 확인 (창이 보일 때만)
let timer = 0
watch(() => authState.user?.id, (uid) => {
  clearInterval(timer)
  loadNotifications().catch(() => {})
  if (uid) timer = setInterval(() => { if (!document.hidden) loadNotifications().catch(() => {}) }, 30000)
}, { immediate: true })
