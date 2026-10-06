// 판매글에 한국어로 저장된 값(아이템 이름·수량·가격·남은 시간)을 지금 화면 언어로 보여주는 도우미
// (DB에는 그대로 한국어 - 보여줄 때만 바꿈)
import { locale, t, itemName } from './i18n.js'
import { getTradeItem, parsePriceTokens, fmtSaleLeft } from './tradeStore.js'

// 아이템 이름 (사전에 있는 아이템이면 영어 이름)
export const postName = (p) => itemName(getTradeItem(p.itemId), p.itemName)

// 수량 "3개" -> "×3", "2종 묶음" -> "Bundle of 2"
export function countText(txt) {
  if (!txt || locale.value === 'ko') return txt
  return t(txt)
    .replace(/(\d+)\s*종 묶음/g, (m, n) => t('{n}종 묶음', { n }))
    .replace(/(\d+)\s*개/g, '×$1')
    .replace(/개/g, '')
}

// 가격 문자열 조각 (parsePriceTokens 결과 하나)
export const priceTok = (tok) => (tok.item ? itemName(tok.item, tok.text) : countText(tok.text))
// 가격 문자열 통째로
export function priceText(text) {
  if (!text || locale.value === 'ko') return text
  return parsePriceTokens(text).map(priceTok).join('')
}

// 판매 종료까지 남은 시간
export function saleLeftText(ms) {
  if (locale.value === 'ko') return fmtSaleLeft(ms)
  if (ms === null || ms <= 0) return ''
  const m = Math.ceil(ms / 60000)
  const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60
  return d ? `${d}d ${h}h` : h ? `${h}h ${mm}m` : `${mm}m`
}
