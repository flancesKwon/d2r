// 사이트 모드 [거래 | DB] - 주소로 정함. 공용 화면(커뮤니티·쪽지·마이페이지 등)은 마지막에 있던 모드 그대로
// 헤더 스위치·메뉴와 모바일 하단 탭이 같이 씀
import { ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { stripLocale } from './i18n.js'

const TRADE_PATHS = ['/trade', '/deals', '/market', '/event']
const DB_PATHS = ['/db', '/items', '/guides', '/runewords', '/craft-sim', '/simulator', '/cube', '/breakpoints', '/sockets', '/patch', '/ladder']
export const under = (p, pre) => p === pre || p.startsWith(pre + '/')
const MODE_KEY = 'd2r-mode'
const lastMode = ref((() => { try { return sessionStorage.getItem(MODE_KEY) || 'trade' } catch { return 'trade' } })())

export function modeOf(path) {
  if (path === '/' || TRADE_PATHS.some((pre) => under(path, pre))) return 'trade'
  if (DB_PATHS.some((pre) => under(path, pre))) return 'db'
  return null
}

export function useSiteMode() {
  const route = useRoute()
  const mode = computed(() => modeOf(stripLocale(route.path)) || lastMode.value)
  watch(mode, (m) => {
    lastMode.value = m
    try { sessionStorage.setItem(MODE_KEY, m) } catch { /* 프라이빗 창 */ }
  }, { immediate: true })
  return mode
}
