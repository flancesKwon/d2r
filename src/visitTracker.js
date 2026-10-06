// 방문 통계 기록 (013 SQL d2r_track) - 화면을 옮길 때마다 한 번
// 브라우저마다 임의 번호 하나(IP·개인정보 아님), 처음 들어온 곳은 다른 사이트 주소(호스트)만
// 자동 점검 브라우저(navigator.webdriver)는 안 셈
import { supabase } from './supabase.js'

const KEY = 'd2r-vid'
function visitorId() {
  try {
    let v = localStorage.getItem(KEY)
    if (!v) {
      v = (crypto.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now().toString(36)).slice(0, 40)
      localStorage.setItem(KEY, v)
    }
    return v
  } catch (e) {
    return null // 저장 안 되는 환경(시크릿 등)은 안 셈
  }
}

// 이번 접속에서 처음 한 번만 유입 사이트를 보냄
let ref = null
try {
  const host = document.referrer ? new URL(document.referrer).hostname : ''
  ref = host && host !== location.hostname ? host : null
} catch (e) {}

export function trackVisit(path) {
  if (!supabase || navigator.webdriver) return
  const v = visitorId()
  if (!v) return
  const r = ref
  ref = null
  supabase.rpc('d2r_track', { p_visitor: v, p_ref: r, p_path: path }).then(() => {}, () => {})
}
