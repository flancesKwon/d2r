// 옵션 검색 항목(src/data/statFilters.json · tradeStore TRADE_STAT_FILTERS)을 화면에 보여주는 규칙
// - 이름: "심연 X (악마술사 전용)" -> 이름 "심연 X" + 태그 [악마술사 전용], 영어 화면은 영어 옵션 문구
// - 태그: 직업 전용 옵션은 직업 색, 직업 상관없이 쓰는 스킬 옵션(게임 oskill)은 [모든 직업] 금색
//   같은 스킬이라도 두 옵션은 다른 옵션이라 검색 항목은 나눠 두고, 태그로 구분해서 보여줌
import { locale, t, affixText, itemName } from './i18n.js'
import itemsData from './data/items.json'

// 직업 색 - 태그 글자·테두리 (모든 직업 = 금색)
export const CLASS_COLORS = {
  아마존: '#E3A857', 소서리스: '#5FA8FF', 네크로맨서: '#79D17F', 팔라딘: '#E9E4D4',
  바바리안: '#E37A5F', 드루이드: '#A9C35A', 어쌔신: '#4FD1C5', 악마술사: '#B784FF',
}
export const ALL_CLASS_COLOR = '#C7B377'

const ITEM_BY_ID = new Map(itemsData.map((it) => [it.id, it]))
const CLASS_SUFFIX = / \((.+) 전용\)$/

// 수치 자리 X 가 든 한국어 이름 -> 영어 (옵션 문구 변환을 그대로 씀: 숫자 대신 7777 을 넣었다가 X 로 되돌림)
function englishName(core) {
  for (const tryText of [core.replace(/X/g, '7777'), core.replace('X', '+7777').replace(/X/g, '7777')]) {
    const en = affixText(tryText)
    if (en !== tryText) return en.replace(/\(?7777(?:-7777)?\)?/g, 'X')
  }
  return t(core)
}

// { name, tag: { text, color } | null, hint }
export function statParts(st) {
  if (!st) return { name: '', tag: null, hint: '' }
  const label = String(st.label || '').replace('(%)', '').trim()
  const cls = st.cls || CLASS_SUFFIX.exec(label)?.[1] || null
  const core = label.replace(CLASS_SUFFIX, '')
  const name = locale.value === 'ko' ? core : englishName(core)
  let tag = null
  let hint = ''
  if (cls && CLASS_COLORS[cls]) {
    tag = { text: t('{cls} 전용', { cls: t(cls) }), color: CLASS_COLORS[cls] }
  } else if (st.allClass) {
    tag = { text: t('모든 직업'), color: ALL_CLASS_COLOR }
    const ex = (st.ex || []).map((id) => ITEM_BY_ID.get(id)).filter(Boolean)
    if (ex.length) hint = t('{items} 등', { items: ex.map((it) => itemName(it)).join(', ') })
  }
  return { name, tag, hint }
}

// 검색어로 찾을 글자들 (한국어 이름·음차 별칭·영어 이름)
export function statSearchTexts(st) {
  const p = statParts(st)
  return [String(st.label || '').replace('(%)', ''), ...(st.aliases || []), p.name]
}
