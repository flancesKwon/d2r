// 실시간 접속 표시 (Supabase Realtime Presence) - DB에 쓰지 않고 지금 사이트를 열어 둔 사람만 셈
// 로그인한 사람은 { uid }, 로그인 안 한 사람은 { guest: 임시id } 로 "접속 중" 을 알림
// (비회원 수는 운영진 화면에서만 보여줌)
// 탭을 닫거나 연결이 끊기면 Realtime 서버가 몇 초 안에 알아서 빼줌
import { reactive, watch } from 'vue'
import { supabase } from './supabase.js'
import { authState } from './profileStore.js'
import { countPresence } from './presenceCount.js'

export const presenceState = reactive({ online: new Set(), guests: 0 })
export const isOnline = (uid) => !!uid && presenceState.online.has(uid)

// 비회원을 세려고 브라우저마다 한 번 만들어 두는 임시 id - 무작위 문자열이라 사람을 가리키는 정보가 아니고,
// 이 채널 밖으로 나가지 않음. 탭을 여러 개 열어도 한 명으로 세려고 localStorage 에 둠
const GUEST_KEY = 'd2r-guest-id'
const newId = () => Math.random().toString(36).slice(2) + Date.now().toString(36)
function guestId() {
  try {
    let v = localStorage.getItem(GUEST_KEY)
    if (!v) { v = newId(); localStorage.setItem(GUEST_KEY, v) }
    return v
  } catch {
    return newId() // 프라이빗 창 등 - 탭마다 따로 세짐
  }
}


let channel = null
let joined = false
let trackedUid // 아직 한 번도 안 정함 (null 은 '비회원으로 정해짐')

function syncOnline() {
  const { online, guests } = countPresence(channel.presenceState())
  presenceState.online = online
  presenceState.guests = guests
}

async function updateTrack() {
  if (!channel || !joined) return
  const uid = authState.user?.id || null
  if (uid === trackedUid) return
  trackedUid = uid
  // 비회원도 알려야 셀 수 있음 (예전엔 untrack 이라 아예 안 세였음)
  if (uid) await channel.track({ uid }).catch(() => {})
  else await channel.track({ guest: guestId() }).catch(() => {})
}

if (supabase && typeof window !== 'undefined') {
  channel = supabase.channel('online-users')
    .on('presence', { event: 'sync' }, syncOnline)
    .subscribe((status) => {
      joined = status === 'SUBSCRIBED'
      if (joined) { trackedUid = undefined; updateTrack() }
    })
  watch(() => authState.user?.id, updateTrack)
}
