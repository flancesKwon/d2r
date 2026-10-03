// 실시간 알림 (Supabase Realtime, 015 SQL) - 새 알림·쪽지·거래방 메시지·거래 상태가 생기는 순간 받음
// 받는 건 DB 권한(RLS)대로 본인 것만. 연결이 끊겨도 각 store 의 주기적 확인(30초)이 뒤를 받침
// 화면은 realtimeTick 의 숫자가 바뀌면 열어 둔 대화를 새로 받음 (MessagesPage·DealsPage)
import { reactive, watch } from 'vue'
import { supabase } from './supabase.js'
import { authState } from './profileStore.js'
import { loadNotifications } from './notificationsStore.js'
import { loadConversations } from './messagesStore.js'
import { loadDeals } from './dealsStore.js'

export const realtimeTick = reactive({ dm: 0, deal: 0 })

// 같은 순간 여러 개가 와도 한 번만 새로 받기
function debounce(fn, ms = 250) {
  let t = 0
  return () => { clearTimeout(t); t = setTimeout(fn, ms) }
}
const reloadNotifications = debounce(() => loadNotifications().catch(() => {}))
const reloadConversations = debounce(() => { loadConversations().catch(() => {}); realtimeTick.dm++ })
const reloadDealMessages = debounce(() => { realtimeTick.deal++ })
const reloadDeals = debounce(() => loadDeals().catch(() => {}))

let channel = null
watch(() => authState.user?.id, (uid) => {
  if (channel) { supabase.removeChannel(channel); channel = null }
  if (!supabase || !uid) return
  const on = (event, table, filter) => ({ event, schema: 'public', table, ...(filter ? { filter } : {}) })
  channel = supabase.channel('me-' + uid)
    .on('postgres_changes', on('INSERT', 'tb_notification', `user_id=eq.${uid}`), reloadNotifications)
    .on('postgres_changes', on('*', 'tb_dm_message'), reloadConversations) // 새 쪽지, 상대가 읽음(1 사라짐)
    .on('postgres_changes', on('*', 'tb_trade_deal_message'), reloadDealMessages)
    .on('postgres_changes', on('UPDATE', 'tb_trade_deal'), reloadDeals) // 상대가 거래완료·불발 누름
    .subscribe()
}, { immediate: true })
