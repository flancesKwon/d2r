// 새 알림·쪽지·거래방 메시지 소리 - 상황마다 다른 mp3 (public/sounds)
// 브라우저는 사용자가 한 번이라도 누르거나 입력해야 소리를 허락함 -> 그 전에 오는 알림은 소리 없이 넘어감
// 켜기/끄기는 이 브라우저에 저장 (프로필 메뉴)
import { reactive } from 'vue'

const KEY = 'd2r-sound-off'
const readOff = () => { try { return localStorage.getItem(KEY) === '1' } catch (e) { return false } }
export const soundState = reactive({ on: !readOff() })

export function setSound(on) {
  soundState.on = on
  try { on ? localStorage.removeItem(KEY) : localStorage.setItem(KEY, '1') } catch (e) {}
  if (on) setTimeout(() => playChime('notification', true), 80) // 켜기 버튼을 누르면 미리 듣기
}

const FILES = { notification: 'doorbell', message: 'notify', deal: 'ping' }

let last = 0
// force: 켜기 버튼을 눌렀을 때 미리 듣기 (2초 간격 제한 무시)
export function playChime(kind, force = false) {
  if (!soundState.on) return
  const now = Date.now()
  if (!force && now - last < 2000) return // 알림·쪽지가 한꺼번에 와도 한 번만
  last = now
  new Audio(`${import.meta.env.BASE_URL}sounds/${FILES[kind]}.mp3`).play().catch(() => {}) // 사용자가 아직 아무것도 안 눌렀으면 브라우저가 막음
}
