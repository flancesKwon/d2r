import { ref, onMounted, onUnmounted } from 'vue'

// 지금 시각 (ms) - ms 마다 바뀜. 판매 기간 카운트다운처럼 화면에서 시간이 흘러가는 표시에 씀
export function useNow(ms = 1000) {
  const now = ref(Date.now())
  let t = 0
  onMounted(() => { t = setInterval(() => (now.value = Date.now()), ms) })
  onUnmounted(() => clearInterval(t))
  return now
}
