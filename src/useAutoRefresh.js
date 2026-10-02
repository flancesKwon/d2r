// 화면에 머무는 동안 ms 마다 fn 을 다시 부름 (기본 30초)
// - 창이 안 보일 때(다른 탭)는 쉬고, 돌아왔을 때 마지막 갱신에서 ms 가 지났으면 바로 한 번
// - fn 은 화면을 깜빡이지 않게 "조용히" 새로 받는 함수여야 함 (불러오는 중 표시·조회수 올리기 없이)
import { onMounted, onUnmounted } from 'vue'

export function useAutoRefresh(fn, ms = 30000) {
  let timer = 0
  let last = Date.now()
  const tick = () => {
    if (document.hidden) return
    last = Date.now()
    Promise.resolve().then(fn).catch(() => {})
  }
  const onVisible = () => { if (!document.hidden && Date.now() - last >= ms) tick() }
  onMounted(() => {
    last = Date.now()
    timer = setInterval(tick, ms)
    document.addEventListener('visibilitychange', onVisible)
  })
  onUnmounted(() => {
    clearInterval(timer)
    document.removeEventListener('visibilitychange', onVisible)
  })
}
