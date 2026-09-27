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
