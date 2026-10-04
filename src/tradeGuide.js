// 거래 이용 안내 모달 (components/TradeGuideModal.vue) - 어느 거래 화면에서든 열 수 있게
import { reactive } from 'vue'

export const tradeGuideState = reactive({ open: false, tab: 'why' })
export function openTradeGuide(tab = 'why') {
  tradeGuideState.tab = tab
  tradeGuideState.open = true
}
export function closeTradeGuide() {
  tradeGuideState.open = false
}

// 거래게시판에 처음 들어온 사람에게 한 번만 자동으로 보여줌
const SEEN_KEY = 'd2r-trade-guide-seen'
export function openTradeGuideOnce() {
  try {
    if (localStorage.getItem(SEEN_KEY)) return
    localStorage.setItem(SEEN_KEY, '1')
  } catch {
    return
  }
  openTradeGuide('why')
}
