// 아이템 검색 공통 규칙 - 아이템 사전·시뮬레이터·판매글 등록·거래게시판이 같은 기준으로 찾게 함
// · 공식 한글 이름, 영문 이름, 별칭(조던, 에니그마, 호토, CTA 등 - scripts/item-aliases.js) 모두 검색
// · 대소문자 무시 ("cta" = "CTA")
// · 한글이 들어간 검색어는 띄어쓰기도 무시 ("콜 투 암즈" = "콜투암즈"). 영어는 띄어쓰기를 지워 붙이면
//   "Perfect Amethyst"가 "cta"에 걸리는 식으로 단어 경계를 넘는 오탐이 생겨서 띄어쓰기를 그대로 둠

export const squashText = (s) => (s || '').toLowerCase().replace(/\s+/g, '')
const normalizeText = (s) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim()
const HANGUL = /[가-힣]/

export function textMatchesQuery(text, query) {
  return HANGUL.test(query) ? squashText(text).includes(squashText(query)) : normalizeText(text).includes(normalizeText(query))
}

// 영어 3글자 이하 검색어(ik, cta, ber)는 아무 데나 포함되면 너무 많이 걸려서(ik -> Spike, Strike)
// 별칭과 정확히 같거나, 이름의 어떤 단어가 그걸로 시작할 때만 (tal -> Tal Rasha's, ber -> Ber Rune)
function shortEnglishMatch(texts, q) {
  return texts.some((s) => {
    const t = normalizeText(s)
    return t === q || t.split(/[\s\-']+/).some((w) => w.startsWith(q))
  })
}

export function itemMatchesQuery(item, query, extraFields = []) {
  const q = normalizeText(query)
  if (!q) return true
  if (!item) return false
  const texts = [item.name_ko, item.name_en, ...(item.aliases || []), ...extraFields]
  if (!HANGUL.test(q) && q.length <= 3) return shortEnglishMatch(texts, q)
  return texts.some((s) => textMatchesQuery(s, query))
}

// ---- 옵션 검색 (아이템 사전 "옵션" 모드) ----
// 쉼표로 여러 옵션을 넣으면 전부 가진 아이템만 ("시전 속도, 모든 기술")
// 흔히 쓰는 줄임말은 게임 옵션 이름으로 바꿔서 찾음. 숫자도 쓸 수 있음 ("시전 속도 40" -> "+40%" 줄)
const OPTION_ALIASES = {
  패캐: '시전 속도', 패스트캐스트: '시전 속도', fcr: '시전 속도',
  패힛: '타격 회복 속도', 패히트: '타격 회복 속도', fhr: '타격 회복 속도',
  패블: '막기 속도', fbr: '막기 속도',
  공속: '공격 속도', ias: '공격 속도',
  이속: '달리기/걷기 속도', frw: '달리기/걷기 속도',
  올스: '모든 기술', 올스킬: '모든 기술',
  맵찾: '마법 아이템 발견', 매찾: '마법 아이템 발견', mf: '마법 아이템 발견',
  골찾: '금화', gf: '금화',
  올저: '모든 저항', 올레: '모든 저항', 올레지: '모든 저항',
  생훔: '생명력*훔침', 흡혈: '생명력*훔침', ll: '생명력*훔침',
  마훔: '마나*훔침', ml: '마나*훔침',
  크블: '강타', cb: '강타',
  데스: '치명적 공격', 데들리: '치명적 공격', ds: '치명적 공격',
  오픈운즈: '상처 악화', ow: '상처 악화',
  방무: '대상의 방어력 무시',
  피감: '받는 물리 피해', dr: '받는 물리 피해',
  빙결안됨: '빙결되지 않음', cbf: '빙결되지 않음',
  텔포: '순간이동', 텔레포트: '순간이동',
}
// 비교용: 소문자, 띄어쓰기·+·% 무시. 줄임말의 * 는 사이에 뭐가 와도 됨 (적중당 생명력 5% 훔침)
const squashOption = (s) => squashText(s).replace(/[+%]/g, '')

export function optionTerms(query) {
  return (query || '').split(/[,，]/).map((t) => t.trim()).filter(Boolean)
    // 띄어 쓴 단어는 순서대로만 있으면 됨 (생명력 훔침 -> 적중당 생명력 5% 훔침)
    .map((t) => (OPTION_ALIASES[t.toLowerCase().replace(/\s+/g, '')] || t).trim().split(/\s+/).map(squashOption).join('*'))
}

// 아이템이 가진 옵션 줄 전부 (툴팁에 안 나오는 줄 빼고)
// 세트 아이템은 그 아이템 전용 초록 옵션(set_item_bonus)까지만 - 세트 전체 보너스는 모든 부위에 똑같이 붙어서 뺌
// 보석·룬은 무기·투구·방패에 박았을 때 효과(in_weapon 등)
const SET_WIDE = new Set(['set_full_bonus', 'set_partial_bonus'])
export function itemOptionLines(item, extraLines = []) {
  const lines = []
  const add = (a) => { if (a && !a.hidden && a.text) lines.push(a.text) }
  for (const a of [...(item.affixes || []), ...extraLines]) add(a)
  for (const [key, v] of Object.entries(item.extra || {})) {
    if (!Array.isArray(v) || SET_WIDE.has(key)) continue
    for (const a of v) {
      if (Array.isArray(a?.affixes)) a.affixes.forEach(add)
      else add(a)
    }
  }
  return lines
}

// 검색어마다 맞는 줄을 하나씩 찾음. 하나라도 없으면 null, 다 있으면 맞은 줄 목록
export function matchOptionLines(lines, terms) {
  if (!terms.length) return []
  const squashed = lines.map(squashOption)
  const hits = []
  for (const t of terms) {
    const parts = t.split('*')
    const i = squashed.findIndex((s) => { let at = 0; return parts.every((p) => (at = s.indexOf(p, at)) >= 0 && (at += p.length)) })
    if (i < 0) return null
    if (!hits.includes(lines[i])) hits.push(lines[i])
  }
  return hits
}
