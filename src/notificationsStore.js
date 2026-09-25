import { reactive, computed } from 'vue'

// 백엔드가 없어서 실제 다른 유저에게 알림이 가는 건 아니지만, 거래게시판에서
// 구매신청을 보내거나 판매자가 수락/거절할 때 이 브라우저 세션 안에서 알림이
// 쌓이게 해서 실제 알림 기능처럼 동작을 확인해볼 수 있게 함
const STORAGE_KEY = 'd2r-notifications'

function loadNotifications() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export const notificationsState = reactive({ items: loadNotifications() })

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notificationsState.items))
  } catch {
    // 프라이빗 창 등 localStorage를 못 쓰는 환경 - 이번 세션 안에서만 유지됨
  }
}

let nextId = Math.max(0, ...notificationsState.items.map((n) => n.id)) + 1

function today() {
  return new Date().toISOString().slice(0, 10)
}

export function pushNotification(text, link) {
  notificationsState.items.unshift({ id: nextId++, text, link: link || null, date: today(), read: false })
  if (notificationsState.items.length > 30) notificationsState.items.length = 30
  persist()
}

export function markNotificationRead(id) {
  const n = notificationsState.items.find((n) => n.id === id)
  if (n) n.read = true
  persist()
}

export function markAllNotificationsRead() {
  notificationsState.items.forEach((n) => (n.read = true))
  persist()
}

export const unreadNotificationCount = computed(
  () => notificationsState.items.filter((n) => !n.read).length
)
