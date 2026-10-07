// 판매글에 한국어로 저장된 값(아이템 이름·수량·가격·남은 시간)을 지금 화면 언어로 보여주는 도우미
// (DB에는 그대로 한국어 - 보여줄 때만 바꿈)
import { locale, t, itemName } from './i18n.js'
import { getTradeItem, parsePriceTokens, fmtSaleLeft } from './tradeStore.js'
import itemsData from './data/items.json'

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

// 한글 이름만 있을 때 (알림·후기의 판매글 제목) - 사전 아이템이면 영어 이름, 묶음이면 가격처럼 조각마다
const ITEM_BY_KO = new Map(itemsData.map((it) => [it.name_ko, it]))
export function nameText(name) {
  if (!name || locale.value === 'ko') return name
  const it = ITEM_BY_KO.get(name.trim())
  return it ? itemName(it, name) : priceText(name)
}

// 알림 문구 (DB가 한국어로 만듦: '"베르 룬" 새 구매신청', '"할리퀸 관모" 거래완료 (3일 지나 자동) - 리뷰 작성 가능')
const NOTIF_PARTS = [
  '다른 구매자와 거래 진행 중 - 신청 보류 (불발되면 다시 대기)', '다시 판매중 - 신청이 수락 대기로 돌아옴',
  '상대가 거래완료 누름 - 내일 자동 거래완료 (못 받았으면 거래불발·신고)', '상대가 거래완료 누름 - 확인 필요',
  '거래방에 5일째 대화 없음 - 2일 뒤 자동 거래불발', '거래방 새 메시지', '구매신청 거절됨', '구매신청 취소됨',
  '찾던 매물 올라옴', '새 구매신청', '새 댓글', '거래 시작', '후기 받음', '(3일 지나 자동)', '(7일 동안 대화 없어 자동)',
  '- 리뷰 작성 가능', '- 쪽지로 지급 안내 예정', '당첨!', '거래완료', '거래불발', '확인 대기',
]
export function notifText(text) {
  if (!text || locale.value === 'ko') return text
  const m = /^"(.+?)" (.+)$/.exec(text)
  if (!m) return t(text)
  let rest = m[2]
  for (const part of NOTIF_PARTS) rest = rest.split(part).join(t(part))
  return `"${nameText(m[1])}" ${rest}`
}
