import { reactive } from 'vue'
import seedPosts from './data/tradePosts.json'
import itemsData from './data/items.json'
import { buildRuneLookup, runewordRuneAffixes, runewordSlots } from './itemStats.js'

export { itemsData }

// 아이템 사전엔 룬·보석·유니크·세트·룬워드(730종)만 있고 우버보스 열쇠 재료(다이아블로
// 뿔 등 퀘스트용 소환 재료)는 장비가 아니라서 원래 사전에 없음 - 그래도 검색으로
// 팔 수 있어야 해서 자주 거래되는 재료를 별도 목록으로 만들어 검색 대상에 포함시킴
export const UBER_MATERIALS = [
  { id: 'uber-diablo-horn', category: 'uber', name_ko: '다이아블로의 뿔', name_en: "Diablo's Horn" },
  { id: 'uber-baal-eye', category: 'uber', name_ko: '바알의 눈', name_en: "Baal's Eye" },
  { id: 'uber-meph-brain', category: 'uber', name_ko: '메피스토의 뇌', name_en: 'Mephisto Brain' },
  { id: 'uber-essence-suffering', category: 'uber', name_ko: '고통의 뒤틀린 정수', name_en: 'Twisted Essence of Suffering' },
  { id: 'uber-essence-hatred', category: 'uber', name_ko: '증오의 충전된 정수', name_en: 'Charged Essence of Hatred' },
  { id: 'uber-essence-terror', category: 'uber', name_ko: '공포의 불타는 정수', name_en: 'Burning Essence of Terror' },
  { id: 'uber-token', category: 'uber', name_ko: '용서의 증표', name_en: 'Token of Absolution' },
]
const ALL_TRADE_ITEMS = [...itemsData, ...UBER_MATERIALS]

const runeLookup = buildRuneLookup(itemsData)

// 룬워드는 고유 옵션(affixes) + 박힌 룬들 자체 효과가 합쳐져서 최종 옵션이 됨(아이템
// 사전 페이지와 동일한 로직). 유니크·세트는 affixes 그대로.
export function getItemAffixes(item) {
  if (!item) return []
  if (item.category === 'runeword') return [...item.affixes, ...runewordRuneAffixes(item, runeLookup)]
  return item.affixes || []
}

// min~max 범위로 굴러가는 옵션인지 - 판매자가 실제 아이템에 뜬 값을 직접 입력하게
// 하려고 구분함. 충전형 스킬(레벨/충전 횟수처럼 min!==max지만 실제로는 두 값 다 고정인
// 경우)은 text에 "min~max" 패턴이 그대로 없으므로 자연히 제외됨
export function isRollRangeAffix(a) {
  if (!a || a.min === undefined || a.max === undefined || a.min === '' || a.max === '') return false
  if (String(a.min) === String(a.max)) return false
  return typeof a.text === 'string' && a.text.includes(`${a.min}~${a.max}`)
}

export function resolveAffixText(a, rolledValue) {
  if (rolledValue === undefined || rolledValue === null || rolledValue === '') return a.text
  return a.text.replace(`${a.min}~${a.max}`, String(rolledValue))
}

// 룬·퍼펙트 보석·우버보스 재료(소환 재료)는 여러 개를 묶어 파는 경우가 많아서 개수를
// 입력받고, 장비(유니크·세트·룬워드·매직/레어/일반)나 기타는 낱개(1개)로 고정
export const QUANTITY_CATEGORIES = ['룬', '퍼펙트 보석', '우버보스 재료']
export function categoryHasQuantity(category) {
  return QUANTITY_CATEGORIES.includes(category)
}

export const TRADE_CATEGORIES = ['룬', '퍼펙트 보석', '우버보스 재료', '유니크/세트', '룬워드', '매직/레어/일반', '기타']
export const TRADE_STATUSES = ['판매중', '예약중', '거래완료']
// 아시아 서버 유저 대상 게시판이라 서버 선택 자체를 없앰 - 항상 아시아로 고정
export const TRADE_REALMS = ['아시아']
export const TRADE_LADDERS = ['레더', '논레더']
export const TRADE_HARDCORE = ['일반', '하드코어']

// 카테고리를 미리 고르지 않아도 아이템명만 검색해서 바로 선택할 수 있게 하는
// 통합 검색 - 사전 730종(룬·보석·유니크·세트·룬워드) + 우버보스 재료 목록을 대상으로
// 찾고, 고르면 트레이드 카테고리가 자동으로 맞춰짐
export function searchAllItems(query) {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return ALL_TRADE_ITEMS
    .filter((it) => it.name_ko.toLowerCase().includes(q) || it.name_en.toLowerCase().includes(q))
    .slice(0, 40)
}

export function tradeCategoryForItem(item) {
  if (!item) return null
  if (item.category === 'gem' && item.type_sub === '룬') return '룬'
  if (item.category === 'gem' && item.type_sub === '보석') return '퍼펙트 보석'
  if (item.category === 'unique' || item.category === 'set') return '유니크/세트'
  if (item.category === 'runeword') return '룬워드'
  if (item.category === 'uber') return '우버보스 재료'
  return null
}

// 룬워드·유니크·세트는 베이스가 무기인지 방어구인지에 따라 실제로 붙을 수 있는 옵션이
// 갈려서(방어력은 방어구에만, 인핸스드 데미지는 무기에만 등), "옵션 직접 추가" 목록을
// 그 아이템에 맞는 것만 보여주려고 구분함. 판단 불가능하면(우버 재료·자유입력 등) null
const ARMOR_TYPE_SUBS = ['방패', '투구', '갑옷', '장갑', '신발', '벨트']
export function itemBaseKind(item) {
  if (!item) return null
  if (item.category === 'runeword') {
    const slots = runewordSlots(item.subtitle)
    const hasWeapon = slots.includes('weapon')
    const hasArmor = slots.some((s) => s !== 'weapon')
    if (hasWeapon && !hasArmor) return 'weapon'
    if (hasArmor && !hasWeapon) return 'armor'
    return null
  }
  if (item.category === 'unique' || item.category === 'set') {
    if (item.type_group === '무기') return 'weapon'
    if (ARMOR_TYPE_SUBS.includes(item.type_sub)) return 'armor'
  }
  return null
}

// 에테리얼(내구도 없이 무형화되지만 스탯이 강화되는 등급)은 장신구엔 없고 무기·방어구
// 계열에만 적용되는 실제 아이템 속성이라, 장비 계열 카테고리에서만 체크박스를 보여줌
export const ETHEREAL_CATEGORIES = ['유니크/세트', '룬워드', '매직/레어/일반']
export function categorySupportsEthereal(category) {
  return ETHEREAL_CATEGORIES.includes(category)
}

// "옵션 직접 추가" 콤보박스 목록 - 룬워드는 박힌 룬 자체 효과 말고도 베이스로 쓴
// 재료(무기·방어구)가 원래 갖고 있는 방어력·인핸스드 데미지 같은 옵션이 실거래가에
// 큰 영향을 주는데 아이템 사전엔 그 데이터가 없어서, 자주 쓰는 옵션 종류를 정해두고
// 값만 입력하면 되게 함. "기타"는 목록에 없는 옵션을 위한 자유 입력 폴백
export const CUSTOM_OPTION_PRESETS = [
  { key: 'defense', label: '방어력', restrict: 'armor', format: (v) => `방어력 +${v}` },
  { key: 'edef', label: '추가방어력(%)', restrict: 'armor', format: (v) => `추가방어력 +${v}%` },
  { key: 'edmg', label: '증가된 데미지(%)', restrict: 'weapon', format: (v) => `인핸스드 데미지 +${v}%` },
  { key: 'ias', label: '공격 속도 증가(%)', restrict: 'weapon', format: (v) => `공격 속도 증가 +${v}%` },
  { key: 'frw', label: '이동/공격 속도 증가(%)', restrict: 'armor', format: (v) => `이동/공격 속도 증가 +${v}%` },
  { key: 'sockets', label: '소켓 개수', format: (v) => `소켓 ${v}개` },
  { key: 'life', label: '생명력', format: (v) => `생명력 +${v}` },
  { key: 'mana', label: '마나', format: (v) => `마나 +${v}` },
  { key: 'str', label: '힘', format: (v) => `힘 +${v}` },
  { key: 'dex', label: '민첩', format: (v) => `민첩 +${v}` },
  { key: 'vit', label: '활력', format: (v) => `활력 +${v}` },
  { key: 'enr', label: '마력', format: (v) => `마력 +${v}` },
  { key: 'allstats', label: '모든 속성', format: (v) => `모든 속성 +${v}` },
  { key: 'allres', label: '모든 저항(%)', format: (v) => `모든 저항 +${v}%` },
  { key: 'fireres', label: '화염 저항(%)', format: (v) => `화염 저항 +${v}%` },
  { key: 'coldres', label: '냉기 저항(%)', format: (v) => `냉기 저항 +${v}%` },
  { key: 'ltngres', label: '번개 저항(%)', format: (v) => `번개 저항 +${v}%` },
  { key: 'poisres', label: '독 저항(%)', format: (v) => `독 저항 +${v}%` },
  { key: 'allskills', label: '모든 기술', format: (v) => `모든 기술 +${v}` },
  { key: 'skill', label: '특정 스킬', freeText: true, placeholder: '예: +3 파이어볼' },
  { key: 'mf', label: '마법 아이템 발견 확률(%)', format: (v) => `마법 아이템 발견 확률 +${v}%` },
  { key: 'gf', label: '골드 발견 확률(%)', format: (v) => `골드 발견 확률 +${v}%` },
  { key: 'lifesteal', label: '공격 시 생명력 흡수(%)', format: (v) => `공격 시 생명력 흡수 +${v}%` },
  { key: 'manasteal', label: '공격 시 마나 흡수(%)', format: (v) => `공격 시 마나 흡수 +${v}%` },
  { key: 'fhr', label: '재빠른 히트 회복(%)', format: (v) => `재빠른 히트 회복 +${v}%` },
  { key: 'custom', label: '기타 (직접 입력)', freeText: true, placeholder: '예: 베이스 3소켓 크리스 소드' },
]

// 무기 베이스로 확정되면 방어구 전용 옵션(방어력 등)을 숨기고, 방어구 베이스면 무기
// 전용 옵션(인핸스드 데미지 등)을 숨김 - 베이스를 알 수 없으면(우버 재료 등) 전부 노출
export function optionPresetsFor(item) {
  const kind = itemBaseKind(item)
  if (!kind) return CUSTOM_OPTION_PRESETS
  return CUSTOM_OPTION_PRESETS.filter((p) => !p.restrict || p.restrict === kind)
}

// 콤보박스 없이 숫자만 입력받아서 "N개"로 만듦
export function buildAmountLabel(count) {
  const n = Number(count) || 0
  return n > 0 ? `${n}개` : ''
}

export const tradeState = reactive({
  posts: seedPosts.map((p) => ({
    ...p,
    requests: p.requests ? p.requests.map((r) => ({ ...r })) : [],
  })),
})

let nextPostId = seedPosts.length + 1
let nextRequestId =
  Math.max(0, ...seedPosts.flatMap((p) => (p.requests || []).map((r) => r.id))) + 1

function today() {
  return new Date().toISOString().slice(0, 10)
}

export function getTradeItem(itemId) {
  return itemId ? ALL_TRADE_ITEMS.find((it) => it.id === itemId) : null
}

export function addTradePost({
  category,
  itemId,
  itemName,
  amountLabel,
  price,
  realm,
  ladder,
  hardcore,
  author,
  contact,
  content,
  options,
  ethereal,
}) {
  const post = {
    id: 't-new-' + nextPostId++,
    category,
    itemId: itemId || null,
    itemName,
    amountLabel,
    options: options || [],
    ethereal: !!ethereal,
    price,
    realm,
    ladder,
    hardcore,
    author: author || '익명',
    contact: contact || '',
    date: today(),
    views: 0,
    status: '판매중',
    content: content || '',
    requests: [],
  }
  tradeState.posts.unshift(post)
  return post
}

export function addTradeRequest(postId, { buyer, contact, qty, message }) {
  const post = tradeState.posts.find((p) => p.id === postId)
  if (!post) return
  post.requests.push({
    id: nextRequestId++,
    buyer: buyer || '익명',
    contact: contact || '',
    qty: Number(qty) || 1,
    message: message || '',
    date: today(),
  })
}

export function updateTradeStatus(postId, status) {
  const post = tradeState.posts.find((p) => p.id === postId)
  if (!post) return
  post.status = status
}

export function getTradePost(postId) {
  return tradeState.posts.find((p) => p.id === postId)
}
