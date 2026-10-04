// 실시간 접속 표시 (Supabase Realtime Presence) - DB에 쓰지 않고 지금 사이트를 열어 둔 사람만 셈
// 로그인한 사람은 { uid } 로 "접속 중" 을 알리고, 로그인 안 한 사람도 목록은 받아서 볼 수 있음
// 탭을 닫거나 연결이 끊기면 Realtime 서버가 몇 초 안에 알아서 빼줌
import { reactive, watch } from 'vue'
import { supabase } from './supabase.js'
import { authState } from './profileStore.js'

export const presenceState = reactive({ online: new Set() })
export const isOnline = (uid) => !!uid && presenceState.online.has(uid)

let channel = null
let joined = false
let trackedUid = null

function syncOnline() {
  const next = new Set()
  for (const metas of Object.values(channel.presenceState())) {
    for (const m of metas) if (m.uid) next.add(m.uid)
  }
  presenceState.online = next
}

async function updateTrack() {
  if (!channel || !joined) return
  const uid = authState.user?.id || null
  if (uid === trackedUid) return
  trackedUid = uid
  if (uid) await channel.track({ uid }).catch(() => {})
  else await channel.untrack().catch(() => {})
}

if (supabase && typeof window !== 'undefined') {
  channel = supabase.channel('online-users')
    .on('presence', { event: 'sync' }, syncOnline)
    .subscribe((status) => {
      joined = status === 'SUBSCRIBED'
      if (joined) { trackedUid = null; updateTrack() }
    })
  watch(() => authState.user?.id, updateTrack)
}
