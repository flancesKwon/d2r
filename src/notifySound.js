// 새 알림·쪽지·거래방 메시지 소리 - 파일 없이 브라우저에서 짧은 두 음("띵동")을 만듦
// 브라우저는 사용자가 한 번이라도 누르거나 입력해야 소리를 허락함 -> 첫 클릭·키 입력 때 준비
// 켜기/끄기는 이 브라우저에 저장 (프로필 메뉴)
import { reactive } from 'vue'

const KEY = 'd2r-sound-off'
const readOff = () => { try { return localStorage.getItem(KEY) === '1' } catch (e) { return false } }
export const soundState = reactive({ on: !readOff() })

export function setSound(on) {
  soundState.on = on
  try { on ? localStorage.removeItem(KEY) : localStorage.setItem(KEY, '1') } catch (e) {}
  if (on) setTimeout(() => playChime(true), 80) // 방금 누른 클릭으로 소리가 허락된 직후라 살짝 뒤에 미리 듣기
}

let ctx = null
function unlock() {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)()
    if (ctx.state === 'suspended') ctx.resume()
  } catch (e) {}
}
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', unlock, { passive: true })
  window.addEventListener('keydown', unlock)
}

let last = 0
// force: 켜기 버튼을 눌렀을 때 미리 듣기 (2초 간격 제한 무시)
export function playChime(force = false) {
  if (!soundState.on || !ctx || ctx.state !== 'running') return
  const now = Date.now()
  if (!force && now - last < 2000) return // 알림·쪽지가 한꺼번에 와도 한 번만
  last = now
  const t = ctx.currentTime
  ;[[880, 0], [1318.5, 0.12]].forEach(([freq, at]) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.0001, t + at)
    gain.gain.exponentialRampToValueAtTime(0.18, t + at + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + at + 0.32)
    osc.connect(gain).connect(ctx.destination)
    osc.start(t + at)
    osc.stop(t + at + 0.35)
  })
}
