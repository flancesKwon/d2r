<script setup>
import { postName, countText, priceTok } from '../tradeI18n.js'
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useAutoRefresh } from '../useAutoRefresh.js'
import { useRoute, useRouter } from 'vue-router'
import {
  tradeState,
  loadTradePosts,
  TRADE_CATEGORIES,
  TRADE_LADDERS,
  TRADE_HARDCORE,
  getTradeItem,
  parsePriceTokens,
  TRADE_STAT_FILTERS,
  ALL_STAT_FILTERS,
  statFilterByKey,
  postStatValue,
  postKeywordValue,
  postIconKey,
  postRarity,
  saleLeftMs,
  getItemAffixes,
  isRollRangeAffix,
  isRandomClassSkillAffix,
  CLASS_SKILL_NAMES,
  uniqueDefenseRange,
  SUPERIOR_MODS,
  TRADE_REALMS,
  GAME_VERSIONS,
} from '../tradeStore.js'
import itemsData from '../data/items.json'
import { isFavorite } from '../tradeFavorites.js'
import { useNow } from '../useNow.js'
import { isOnline } from '../presence.js'
import { openTradeGuide } from '../tradeGuide.js'
import { ITEM_ICONS } from '../itemIcons.js'
import { itemMatchesQuery, textMatchesQuery } from '../itemSearch.js'
import EventBanner from '../components/EventBanner.vue'
import { t, itemName, locale } from '../i18n.js'
import { statParts, statSearchTexts } from '../statDisplay.js'

// 판매글은 DB에서 (최근 글부터) - 들어올 때, 보고 있는 동안 30초마다 새로 받음
// 첫 화면이라 이용 안내를 자동으로 띄우지 않음 (처음 판매글 등록할 때 한 번 뜸, 여기선 '이용 안내' 버튼)
onMounted(() => { loadTradePosts() })
useAutoRefresh(() => loadTradePosts(true))
// 종류는 여러 개 고를 수 있음 (하나라도 맞으면)
const activeCats = ref([])
// 배틀넷 지역 서버 (아시아·미주·유럽) - 고른 서버는 다음 방문에도 유지
const REGION_KEY = 'd2r-trade-region'
const activeRegion = ref((() => { try { const v = localStorage.getItem(REGION_KEY); return TRADE_REALMS.includes(v) ? v : null } catch { return null } })())
watch(activeRegion, (v) => { try { if (v) localStorage.setItem(REGION_KEY, v); else localStorage.removeItem(REGION_KEY) } catch { /* 프라이빗 창 등 */ } })
// 게임 모드(확장팩) - 고른 모드는 다음 방문에도 유지 (서버 고르는 것과 같은 방식)
const GAME_KEY = 'd2r-trade-game'
const gameVersion = ref((() => { try { const v = localStorage.getItem(GAME_KEY); return GAME_VERSIONS.includes(v) ? v : null } catch { return null } })())
watch(gameVersion, (v) => { try { if (v) localStorage.setItem(GAME_KEY, v); else localStorage.removeItem(GAME_KEY) } catch { /* 프라이빗 창 등 */ } })
const activeLadder = ref(null)
const activeHardcore = ref(null)
const etherealOnly = ref(false)
const unidOnly = ref(false)
// 다른 화면(룬워드 찾기의 "사러 가기" 등)에서 ?q=검색어 로 들어오면 그걸로 바로 검색
const route = useRoute()
const router = useRouter()
const searchQuery = ref(typeof route.query.q === 'string' ? route.query.q : '')

// ---- 아이템 지정: 검색창에 치면 유니크·세트·룬워드 자동완성 -> 고르면 그 아이템 글만 + 변동 옵션 범위 필터
// (?item=아이템id 로 들어와도 됨). 고르지 않고 치면 예전처럼 글자 검색
const PICKABLE = itemsData.filter((it) => ['unique', 'set', 'runeword'].includes(it.category))
const pickedItem = ref(getTradeItem(typeof route.query.item === 'string' ? route.query.item : null) || null)
const suggestOpen = ref(false)
const suggestActive = ref(0)
const JAMO_TAIL = /[ㄱ-ㅎㅏ-ㅣ]+$/
const suggestions = computed(() => {
  const q = searchQuery.value.trim().replace(JAMO_TAIL, '')
  if (!q || pickedItem.value) return []
  // 이름이 검색어로 시작하는 것 먼저 (별칭으로만 걸린 건 뒤로)
  const starts = (it) => it.name_ko.replace(/\s+/g, '').startsWith(q.replace(/\s+/g, ''))
  return PICKABLE.filter((it) => itemMatchesQuery(it, q)).sort((x, y) => starts(y) - starts(x)).slice(0, 8)
})
function onSearchInput(e) {
  searchQuery.value = e.target.value
  suggestOpen.value = true
  suggestActive.value = 0
}
function pickItem(it) {
  pickedItem.value = it
  searchQuery.value = ''
  suggestOpen.value = false
}
function clearPickedItem() {
  pickedItem.value = null
}
function onSearchKey(e) {
  if (e.isComposing) return
  const list = unifiedSuggestions.value
  if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && list.length) {
    e.preventDefault()
    // 닫혀 있으면 열기만 (첫 줄부터)
    if (!suggestOpen.value) { suggestOpen.value = true; suggestActive.value = 0; return }
    suggestActive.value = (suggestActive.value + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length
  } else if (e.key === 'Enter' && suggestOpen.value && list.length) {
    e.preventDefault()
    chooseSuggestion(list[suggestActive.value] || list[0])
  } else if (e.key === 'Escape') {
    suggestOpen.value = false
  } else if (e.key === 'Backspace' && !searchQuery.value) {
    removeLastApplied()
  }
}
const closeSuggestSoon = () => setTimeout(() => (suggestOpen.value = false), 150)

// 고른 아이템의 검색 칸 - 베이스(룬워드 베이스·기본 방어력·데미지·소켓·상급) + 변동 옵션(범위 옵션·무작위 직업 기술)
// 범위 칸(kind 없음): { lo, hi, get(post) -> 숫자 } / 고르기 칸(choices): get(post) -> 값
const escRe = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const lineMatch = (re, i = 1) => (p) => { for (const l of p.options || []) { const m = re.exec(l); if (m) return m[i] } return null }
const lineValue = (re, i = 1) => (p) => { const v = lineMatch(re, i)(p); return v === null ? null : Number(v) }
const CLASS_LINE = new RegExp(`^(${Object.values(CLASS_SKILL_NAMES).join('|')}) 기술 레벨 \\+\\d+`)
const DEF_LINE = /^기본 방어력 (\d+)$/
const DMG_LINE = /^기본 데미지 (\d+)~(\d+)$/
const SOCK_LINE = /^소켓 (\d+)개$/
const BASE_LINE = /^베이스: (.+?)(?: \(.+\))?$/
const normLine = (t) => t.replace(/\d+/g, '#')
const SUPERIOR_RES = Object.values(SUPERIOR_MODS).map((m) => new RegExp('^' + escRe(m.text).replace('\\{v\\}', '\\d+') + '$'))
// 상급 베이스인지 - 상급 옵션 줄(피해 증가·방어력 증가·명중률·최대 내구도)이 아이템 자기 옵션 말고 따로 붙어 있으면 상급
function isSuperiorPost(p, item) {
  const own = new Map()
  for (const a of getItemAffixes(item)) if (a.text) own.set(normLine(a.text), (own.get(normLine(a.text)) || 0) + 1)
  const seen = new Map()
  for (const l of p.options || []) {
    if (!SUPERIOR_RES.some((re) => re.test(l))) continue
    const k = normLine(l)
    seen.set(k, (seen.get(k) || 0) + 1)
    if (seen.get(k) > (own.get(k) || 0)) return true
  }
  return false
}
// 이 아이템 글 (베이스 종류 고르기·방어력/데미지 칸을 보여줄지 정할 때 씀)
const pickedItemPosts = computed(() => (pickedItem.value ? tradeState.posts.filter((p) => p.itemId === pickedItem.value.id) : []))
const anyLine = (re) => pickedItemPosts.value.some((p) => (p.options || []).some((l) => re.test(l)))
const itemBaseDefs = computed(() => {
  const it = pickedItem.value
  if (!it) return []
  const defs = []
  const kind = it.base_stats?.category
  if (it.category === 'runeword') {
    const names = [...new Set(pickedItemPosts.value.map(lineMatch(BASE_LINE)).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko'))
    if (names.length) defs.push({ key: 'base', label: '베이스', choices: names, get: lineMatch(BASE_LINE) })
    defs.push({ key: 'sup', label: '상급(슈페리얼) 베이스', choices: ['상급', '일반'], get: (p) => (isSuperiorPost(p, it) ? '상급' : '일반') })
  }
  const def = uniqueDefenseRange(it, false)
  if (def) defs.push({ key: 'def', label: '기본 방어력', lo: def.min, hi: uniqueDefenseRange(it, true)?.max ?? def.max, get: lineValue(DEF_LINE) })
  else if (kind === 'armor' || (it.category === 'runeword' && anyLine(DEF_LINE))) defs.push({ key: 'def', label: '기본 방어력', get: lineValue(DEF_LINE) })
  if (kind === 'weapon' || (it.category === 'runeword' && anyLine(DMG_LINE))) {
    defs.push({ key: 'dmin', label: '기본 최소 데미지', get: lineValue(DMG_LINE, 1) })
    defs.push({ key: 'dmax', label: '기본 최대 데미지', get: lineValue(DMG_LINE, 2) })
  }
  // 유니크·세트 장비는 라르주크 소켓(1개)이나 원래 소켓 붙는 것
  if (it.category !== 'runeword' && (kind === 'armor' || kind === 'weapon')) defs.push({ key: 'sock', label: '소켓 수', lo: 0, hi: 6, get: (p) => lineValue(SOCK_LINE)(p) ?? 0 })
  return defs
})
const itemOptionDefs = computed(() => {
  const it = pickedItem.value
  if (!it) return []
  const defs = []
  for (const a of getItemAffixes(it)) {
    if (isRandomClassSkillAffix(a)) {
      defs.push({ key: 'class', label: '직업 기술', choices: Object.values(CLASS_SKILL_NAMES), get: lineMatch(CLASS_LINE) })
    } else if (isRollRangeAffix(a)) {
      const [pre, post] = a.text.split(`${a.min}~${a.max}`)
      const lo = Math.min(Number(a.min), Number(a.max)), hi = Math.max(Number(a.min), Number(a.max))
      defs.push({ key: 'a:' + a.text, label: a.text, lo, hi, get: lineValue(new RegExp('^' + escRe(pre) + '(-?\\d+)' + escRe(post) + '$')) })
    }
  }
  return defs
})
const itemVarDefs = computed(() => [...itemBaseDefs.value, ...itemOptionDefs.value])
// { [def.key]: { min, max, pick } } - 글이 새로 들어와 칸이 다시 만들어져도 입력한 값은 그대로
// (다른 아이템을 고르면 비움)
const itemRanges = ref({})
let rangesItemId = null
watch(itemVarDefs, (defs) => {
  const old = rangesItemId === pickedItem.value?.id ? itemRanges.value : {}
  rangesItemId = pickedItem.value?.id ?? null
  itemRanges.value = Object.fromEntries(defs.map((d) => [d.key, old[d.key] || { min: '', max: '', pick: '' }]))
}, { immediate: true })
const activeItemRanges = computed(() =>
  itemVarDefs.value.filter((d) => { const r = itemRanges.value[d.key]; return r && (d.choices ? r.pick : r.min !== '' || r.max !== '') })
)
function itemRangeMatches(p, d) {
  const r = itemRanges.value[d.key]
  const v = d.get(p)
  if (v === null || v === undefined) return false
  if (d.choices) return v === r.pick
  return (r.min === '' || v >= Number(r.min)) && (r.max === '' || v <= Number(r.max))
}
// 아이템을 바꾸면 주소도 맞춤 (공유·뒤로 가기용)
watch(pickedItem, (it) => {
  const q = { ...route.query }
  if (it) q.item = it.id
  else delete q.item
  router.replace({ query: q })
})

// 트레더리처럼 아이콘 위주로 훑어보고 싶을 때는 그리드로, 옵션·메모까지 자세히
// 보고 싶을 때는 리스트로 - 마지막으로 고른 보기 방식을 기억해둠
const VIEW_MODE_KEY = 'd2r-trade-view-mode'
function loadViewMode() {
  try {
    const saved = localStorage.getItem(VIEW_MODE_KEY)
    return saved === 'grid' ? 'grid' : 'list'
  } catch {
    return 'list'
  }
}
const viewMode = ref(loadViewMode())
function setViewMode(mode) {
  viewMode.value = mode
  try {
    localStorage.setItem(VIEW_MODE_KEY, mode)
  } catch {
    // 프라이빗 창 등 localStorage를 못 쓰는 환경 - 이번 세션 안에서만 유지됨
  }
}

function iconUrlFor(iconKey) {
  const url = iconKey && ITEM_ICONS[iconKey]
  return url || null
}

// 유니크(gold)·세트(green)·룬워드(blood)·룬·보석(teal) - 아이템 사전 페이지와
// 똑같은 색 코드로 테두리를 맞춰서 어디서 보든 같은 등급은 같은 색으로 보이게 함
function rarityClass(item) {
  return item ? item.category : ''
}

// 옵션 조건: "모든 저항 20~40"처럼 옵션 종류 + 수치 범위를 여러 개 걸 수 있고 전부
// 만족하는 글만 남김(AND). 범위를 비우면 그 옵션이 붙어 있기만 하면 통과.
// 종류 목록에 없는 옵션은 "키워드"로 옵션 문구 일부를 직접 적음 (예: 블리자드, 시전 속도) - 그 줄의 숫자로 범위 비교
const KEYWORD_KEY = '__keyword'
const statConditions = ref([])
// 드롭다운 라벨의 "(%)"는 칩·배지에선 떼고 수치 뒤에 %로 붙임 ("모든 저항 20% 이상")
const statLabel = (c) => (c.keyword ? `"${c.keyword}"` : statParts(statFilterByKey(c.key) || { label: c.key }).name)
// 직업 전용 / 모든 직업 태그 (src/statDisplay.js)
const statTag = (c) => (c.keyword ? null : statParts(statFilterByKey(c.key)).tag)
const statUnit = (c) => (!c.keyword && statFilterByKey(c.key)?.label.includes('(%)') ? '%' : '')
function rangeText(c) {
  const u = statUnit(c)
  if (c.min === null && c.max === null) return ' ' + t('있음')
  if (c.max === null) return ' ' + t('{v} 이상', { v: c.min + u })
  if (c.min === null) return ' ' + t('{v} 이하', { v: c.max + u })
  return c.min === c.max ? ` ${c.min}${u}` : ` ${c.min}~${c.max}${u}`
}
const condId = (c) => (c.keyword ? 'kw:' + c.keyword : c.key)
// 글이 조건을 만족하는지 + 배지에 보여줄 값
function condValue(p, c) {
  if (c.keyword) {
    const r = postKeywordValue(p, c.keyword, textMatchesQuery)
    return r.hit ? r.value : undefined
  }
  const v = postStatValue(p, c.key)
  return v === null ? undefined : v
}
function condMatches(p, c) {
  const v = condValue(p, c)
  if (v === undefined) return false
  if (c.min === null && c.max === null) return true
  if (v === null) return false
  return (c.min === null || v >= c.min) && (c.max === null || v <= c.max)
}

const hasActiveFilters = computed(
  () =>
    activeCats.value.length > 0 || activeLadder.value !== null || activeRegion.value !== null ||
    activeHardcore.value !== null || etherealOnly.value || unidOnly.value ||
    searchQuery.value.trim() !== '' || statConditions.value.length > 0 || !!pickedItem.value
)
function resetFilters() {
  activeCats.value = []
  activeRegion.value = null
  gameVersion.value = null
  activeLadder.value = null
  activeHardcore.value = null
  etherealOnly.value = false
  unidOnly.value = false
  searchQuery.value = ''
  statConditions.value = []
  pickedItem.value = null
}

// 판매 기간(48시간)이 끝난 글은 목록에서 내려감 - 1분마다 다시 셈
const now = useNow(60000)
// 글의 아이템 이름·가격 (영어면 사전의 영문 이름, "2개" -> "×2") - tradeI18n.js
const enCount = countText
// 한 번에 보여줄 개수 - 스크롤이 끝에 닿으면 더 불러옴 (예전엔 300개를 한 번에 다 그려서 첫 화면이 무거웠음)
const PAGE = 12
const shown = ref(PAGE)
const filteredPosts = computed(() => {
  // 거래 대기(판매중)인 글만 - 예약중(거래방 진행 중)·거래완료는 아이템별 거래내역에서
  // 단, 찜한 글은 예약중이 돼도 계속 보여줌 ("거래중" 표시)
  let list = tradeState.posts.filter((p) => (p.status === '판매중' && saleLeftMs(p, now.value) > 0) || (p.status === '예약중' && isFavorite(p.id)))
  if (activeCats.value.length) list = list.filter((p) => activeCats.value.includes(p.category))
  if (activeRegion.value) list = list.filter((p) => p.realm === activeRegion.value)
  if (gameVersion.value) list = list.filter((p) => p.gameVersion === gameVersion.value)
  if (activeLadder.value) list = list.filter((p) => p.ladder === activeLadder.value)
  if (activeHardcore.value) list = list.filter((p) => p.hardcore === activeHardcore.value)
  if (etherealOnly.value) list = list.filter((p) => p.ethereal)
  if (unidOnly.value) list = list.filter((p) => p.unidentified)
  if (pickedItem.value) {
    list = list.filter((p) => p.itemId === pickedItem.value.id)
    for (const d of activeItemRanges.value) list = list.filter((p) => itemRangeMatches(p, d))
  }
  const q = searchQuery.value.trim()
  if (q) {
    list = list.filter(
      (p) =>
        textMatchesQuery(p.itemName, q) ||
        textMatchesQuery(p.content, q) ||
        // 옵션 문구도 검색 (예: "블리자드"로 +블리자드 붙은 오브·지팡이 찾기)
        (p.options || []).some((o) => textMatchesQuery(o, q)) ||
        // 아이템 별칭으로도 (예: "조던"으로 요르단의 반지, "에니그마"로 수수께끼 판매글)
        (!!getTradeItem(p.itemId) && itemMatchesQuery(getTradeItem(p.itemId), searchQuery.value))
    )
  }
  for (const c of statConditions.value) list = list.filter((p) => condMatches(p, c))
  return [...list].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
})

// ───────── 첫 화면(거래 모드) 검색 ─────────
// 큰 검색창 하나에 치면 아이템·종류·옵션 후보가 같이 뜸 -> 고르면 검색창 아래 "적용된 조건" 줄로 내려감
// (검색창 안에는 글자만 - 조건이 늘어도 입력칸이 안 밀리고, 옵션 수치는 칩의 ✎ 로 그 자리에서 고침)

// 서버·게임·래더·모드 고르기 (검색창 아래 한 줄 드롭다운) - 고른 값은 거기서 바로 보이니 '적용된 조건' 칩은 안 만듦
const QUICK_SELECTS = [
  { label: '서버', ref: activeRegion, options: TRADE_REALMS },
  { label: '게임', ref: gameVersion, options: GAME_VERSIONS },
  { label: '래더', ref: activeLadder, options: TRADE_LADDERS },
  { label: '모드', ref: activeHardcore, options: TRADE_HARDCORE },
]

// 옵션 후보 - 직접 숫자를 넣는 칸(입력값)·"가장 높은 수치" 같은 특수 항목은 빼고
// 검색창에서 고를 수 있는 옵션 - '자주 쓰는' 묶음(여러 줄 합산 같은 특별 규칙이 있는 것) 먼저,
// 그 뒤에 아이템 사전·매직/레어 접사·개별 스킬에서 뽑은 전체 목록 (같은 문구는 앞의 것만)
const plainLabel = (l) => l.replace('(%)', '')
const STAT_PICKS = (() => {
  // 같은 옵션인지 비교할 때 수치 자리(X)·%·공백은 떼고 봄 ('시전 속도(%)' 와 '시전 속도 X%' 는 같은 것)
  const norm = (l) => plainLabel(l).replace(/[X%\s]/g, '')
  const out = TRADE_STAT_FILTERS.filter((st) => !/입력값|가장 높은/.test(st.label))
  const seen = new Set(out.map((st) => norm(st.label)))
  for (const st of ALL_STAT_FILTERS) {
    const k = norm(st.label)
    if (seen.has(k)) continue
    seen.add(k)
    out.push(st)
  }
  return out
})()
const squash = (t) => t.replace(/[\s·/]+/g, '')
const unifiedSuggestions = computed(() => {
  const raw = searchQuery.value.trim().replace(JAMO_TAIL, '')
  if (!raw) return []
  const q = squash(raw)
  const out = []
  for (const it of suggestions.value.slice(0, 5)) out.push({ type: 'item', key: 'i' + it.id, it })
  for (const c of TRADE_CATEGORIES) if (squash(c).includes(q)) out.push({ type: 'cat', key: 'c' + c, c })
  // 한국어 이름·음차 별칭(데스 센트리)·영어 이름 어느 걸로 쳐도 찾음
  const ql = q.toLowerCase()
  const hitOf = (st) => statSearchTexts(st).map((x) => squash(x).toLowerCase()).find((x) => x.includes(ql))
  const stats = STAT_PICKS.map((st) => ({ st, hit: hitOf(st) })).filter((x) => x.hit)
  // 검색어로 시작하는 옵션을 위로 ("저항" -> "저항 ..." 이 "모든 저항"보다 먼저가 아니라, 짧은 것부터)
  // 같은 이름이면 [모든 직업] -> 직업 전용 순서로 붙어 나오게
  stats.sort((a, b) => (b.hit.startsWith(ql) - a.hit.startsWith(ql)) || a.hit.length - b.hit.length || (!!a.st.cls - !!b.st.cls))
  for (const { st } of stats.slice(0, 12)) out.push({ type: 'stat', key: 's' + st.key, st })
  out.push({ type: 'text', key: 'text', raw })
  out.push({ type: 'kw', key: 'kw', raw })
  return out.slice(0, 20)
})
const suggestGroups = computed(() => {
  const list = unifiedSuggestions.value
  const groups = [
    { name: '아이템', cls: 'g-item', rows: [] }, { name: '종류', cls: 'g-cat', rows: [] },
    { name: '옵션', cls: 'g-stat', rows: [] }, { name: '글자로 찾기', cls: 'g-text', rows: [] },
  ]
  const at = { item: 0, cat: 1, stat: 2, text: 3, kw: 3 }
  list.forEach((sug, i) => groups[at[sug.type]].rows.push({ sug, i }))
  return groups.filter((g) => g.rows.length)
})
function chooseSuggestion(sug) {
  if (sug.type === 'item') return pickItem(sug.it)
  if (sug.type === 'text') { suggestOpen.value = false; return }
  if (sug.type === 'cat') toggleCat(sug.c, true)
  else if (sug.type === 'stat') addStatKey(sug.st.key, true)
  else if (sug.type === 'kw') {
    const cond = { key: KEYWORD_KEY, keyword: sug.raw, min: null, max: null }
    if (!statConditions.value.some((c) => condId(c) === condId(cond))) statConditions.value.push(cond)
  }
  searchQuery.value = ''
  suggestOpen.value = false
}
function toggleCat(c, onlyAdd = false) {
  const i = activeCats.value.indexOf(c)
  if (i >= 0) { if (!onlyAdd) activeCats.value.splice(i, 1) } else activeCats.value.push(c)
}
function addStatKey(key, edit = false) {
  let i = statConditions.value.findIndex((c) => !c.keyword && c.key === key)
  if (i < 0) { statConditions.value.push({ key, min: null, max: null }); i = statConditions.value.length - 1 }
  if (edit) openEdit(i)
}

// 옵션 칩 수치 고치기 (✎)
const editIdx = ref(-1)
const editMin = ref('')
const editMax = ref('')
function openEdit(i) {
  const c = statConditions.value[i]
  if (!c) return
  if (editIdx.value === i) { editIdx.value = -1; return }
  editIdx.value = i
  editMin.value = c.min ?? ''
  editMax.value = c.max ?? ''
}
function applyEdit() {
  const c = statConditions.value[editIdx.value]
  if (c) {
    const num = (v) => (v === '' || v === null ? null : Number(v))
    let mn = num(editMin.value), mx = num(editMax.value)
    if (mn !== null && mx !== null && mn > mx) [mn, mx] = [mx, mn]
    c.min = mn
    c.max = mx
  }
  editIdx.value = -1
}
function removeStat(i) {
  if (editIdx.value === i) editIdx.value = -1
  else if (editIdx.value > i) editIdx.value--
  statConditions.value.splice(i, 1)
}
// 검색창이 비었을 때 Backspace - 마지막에 걸린 조건부터 하나씩 뺌
function removeLastApplied() {
  if (statConditions.value.length) return removeStat(statConditions.value.length - 1)
  if (pickedItem.value) return clearPickedItem()
  if (activeCats.value.length) activeCats.value.pop()
}
// 걸린 조건이나 정렬이 바뀌면 처음 12개부터 다시
watch(filteredPosts, () => { shown.value = PAGE })
const pagedPosts = computed(() => filteredPosts.value.slice(0, shown.value))
const hasMore = computed(() => shown.value < filteredPosts.value.length)
const moreEl = ref(null)
let io = null
onMounted(() => {
  io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting) && hasMore.value) shown.value += PAGE }, { rootMargin: '400px' })
  watch(moreEl, (el, old) => { if (old) io.unobserve(old); if (el) io.observe(el) }, { immediate: true, flush: 'post' })
})
onUnmounted(() => io?.disconnect())

const appliedCount = computed(() =>
  activeCats.value.length + (pickedItem.value ? 1 : 0) + statConditions.value.length + (searchQuery.value.trim() && !suggestOpen.value ? 1 : 0)
)

// ───────── 목록에 보여줄 것 ─────────
// 올린 시각: 하루 안쪽이면 "3시간 전"(1시간 미만은 "방금"), 그 뒤로는 날짜 그대로
function agoText(p) {
  const ms = p.createdAt ? now.value - new Date(p.createdAt).getTime() : NaN
  if (!Number.isFinite(ms) || ms < 0 || ms >= 86400000) return p.date
  const h = Math.floor(ms / 3600000)
  return h < 1 ? t('방금') : t('{n}시간 전', { n: h })
}

// 옵션 줄에서 수치만 색을 달리 주려고 조각으로 쪼갬 ("시전 속도 +24%" -> ['시전 속도 ', '+24', '%'])
// 범위(70~115)·소수(1.5)·음수(-81)도 한 덩어리로
const NUM_PART = /([+-]?\d+(?:\.\d+)?(?:~[+-]?\d+(?:\.\d+)?)?)/g
// 반지·목걸이·보석 그림은 원본이 28×28 이라 칸에 꽉 채우면(3.1배) 픽셀이 뭉개짐
// 칸의 절반보다 작으면 딱 2배로만 키움 (정수 배라 선명), 큰 그림은 CSS 가 칸에 맞춰 줄임
function fitIcon(e) {
  const img = e.target
  const n = Math.max(img.naturalWidth, img.naturalHeight)
  const box = img.parentElement?.clientWidth || 0
  if (n && box && n * 2 <= box) { img.style.width = img.naturalWidth * 2 + `px`; img.style.height = img.naturalHeight * 2 + `px` }
}

function optParts(line) {
  return String(line).split(NUM_PART).filter((x) => x !== '').map((x) => ({ x, num: /^[+-]?\d/.test(x) }))
}

// 같은 아이템이라도 개체마다 달라지는 줄만 보여줌
// · 유니크·세트·룬워드: 사전에서 범위로 굴러가는 옵션 + 방어력·데미지·소켓 (고정 옵션은 다 같으니 뺌)
// · 매직·레어·크래프트·일반(베이스): 사전에 없어서 판매자가 넣은 옵션 그대로
const META_LINE = /^(베이스: |베이스 룬 조합: |미확인$)/
const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const PER_ITEM_LINE = /^(기본 방어력|기본 데미지|소켓) /
const CLASS_SKILL_LINE = new RegExp(`^(?:${Object.values(CLASS_SKILL_NAMES).join('|')}) 기술 레벨 \\+`)
function variantLines(p) {
  const opts = (p.options || []).filter((l) => l && !META_LINE.test(l))
  const item = getTradeItem(p.itemId)
  // 사전에 없는 아이템(매직·레어·일반)과 룬·보석류는 넣은 옵션 그대로
  if (!item || !getItemAffixes(item).length) return opts
  const out = []
  for (const a of getItemAffixes(item)) {
    if (isRandomClassSkillAffix(a)) {
      const hit = opts.find((l) => CLASS_SKILL_LINE.test(l))
      if (hit) out.push(hit)
      continue
    }
    if (!isRollRangeAffix(a)) continue
    const [pre, post] = a.text.split(`${a.min}~${a.max}`)
    const re = new RegExp('^' + esc(pre) + '-?\\d+' + esc(post) + '$')
    // 미확인 판매는 사전 범위 그대로 올라와서 원문도 그대로 받아 줌
    const hit = opts.find((l) => re.test(l) || l === a.text)
    if (hit) out.push(hit)
  }
  for (const l of opts) if (PER_ITEM_LINE.test(l)) out.push(l)
  return out
}
</script>

<template>
  <div class="items-page trade-page">

  <section class="tr-hero">
    <div class="tr-hero-inner">
      <h1>{{ $t('어떤 아이템을 찾아?') }}</h1>
      <p class="tr-hero-sub">{{ $t('아이템 이름 · 종류 · 옵션을 여러 개 골라서 한 번에 검색') }}</p>

      <form class="tr-search" role="search" @submit.prevent="unifiedSuggestions.length ? chooseSuggestion(unifiedSuggestions[suggestActive] || unifiedSuggestions[0]) : null">
        <div class="tr-search-box">
          <input
            type="search" :value="searchQuery" @input="onSearchInput" @keydown="onSearchKey" @focus="suggestOpen = true" @blur="closeSuggestSoon"
            :placeholder="pickedItem ? $t('옵션·내용으로 더 좁히기') : $t('아이템 이름 · 종류 · 옵션 (예: 할리퀸 관모, 룬워드, 시전 속도)')"
            :aria-label="$t('매물 검색')" autocomplete="off" role="combobox" :aria-expanded="suggestOpen && unifiedSuggestions.length > 0" aria-controls="tr-suggest"
          />
          <div class="tr-suggest" id="tr-suggest" role="listbox" v-if="suggestOpen && unifiedSuggestions.length">
            <div class="tr-suggest-group" v-for="g in suggestGroups" :key="g.name" :class="g.cls">
              <div class="tr-suggest-title">{{ $t(g.name) }}</div>
              <button
                type="button" role="option" v-for="r in g.rows" :key="r.sug.key" class="tr-suggest-row" :class="{ active: r.i === suggestActive }"
                :aria-selected="r.i === suggestActive" @mousedown.prevent="chooseSuggestion(r.sug)" @mousemove="suggestActive = r.i"
              >
                <template v-if="r.sug.type === 'item'">
                  <span class="item-suggest-icon" :class="r.sug.it.category"><img v-if="iconUrlFor(r.sug.it.icon_key)" :src="iconUrlFor(r.sug.it.icon_key)" alt="" /></span>
                  <span class="item-suggest-name" :class="r.sug.it.category">{{ $itemName(r.sug.it) }}</span>
                  <small>{{ $t(r.sug.it.category_label) }}{{ locale === 'ko' && r.sug.it.subtitle && r.sug.it.category !== 'runeword' ? ' · ' + r.sug.it.subtitle : '' }}</small>
                </template>
                <template v-else-if="r.sug.type === 'cat'">
                  <span>{{ $t(r.sug.c) }}</span><small>{{ activeCats.includes(r.sug.c) ? $t('이미 고름') : $t('종류 추가') }}</small>
                </template>
                <template v-else-if="r.sug.type === 'stat'">
                  <span>{{ statParts(r.sug.st).name }}</span>
                  <span class="stat-tag" v-if="statParts(r.sug.st).tag" :style="{ '--tag': statParts(r.sug.st).tag.color }">{{ statParts(r.sug.st).tag.text }}</span>
                  <small>{{ statParts(r.sug.st).hint || $t('옵션 추가 · 수치는 다음에') }}</small>
                </template>
                <template v-else-if="r.sug.type === 'text'">
                  <span>"{{ r.sug.raw }}"</span><small>{{ $t('이름·내용에서 찾기') }}</small>
                </template>
                <template v-else>
                  <span>"{{ r.sug.raw }}"</span><small>{{ $t('옵션 문구에 들어간 글만') }}</small>
                </template>
              </button>
            </div>
            <div class="tr-suggest-hint">{{ $t('↑↓ 이동 · Enter 추가 · 빈 칸에서 Backspace 로 마지막 조건 빼기') }}</div>
          </div>
        </div>
        <button type="submit" class="tr-search-go">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>{{ $t('검색') }}
        </button>
      </form>

      <div class="tr-applied" v-if="appliedCount" :aria-label="$t('적용된 조건')">
        <span class="tr-applied-label">{{ $t('적용된 조건') }} {{ appliedCount }}</span>
        <span class="tr-chip kind" v-for="c in activeCats" :key="'k' + c"><em>{{ $t('종류') }}</em>{{ $t(c) }}<button type="button" :aria-label="`${$t(c)} ×`" @click="toggleCat(c)">×</button></span>
        <span class="tr-chip item" v-if="pickedItem" :class="pickedItem.category"><em>{{ locale === 'ko' ? '아이템' : $t('아이템 지정') }}</em>{{ $itemName(pickedItem) }}<button type="button" :aria-label="`${$itemName(pickedItem)} ×`" @click="clearPickedItem">×</button></span>
        <span class="tr-chip text" v-if="searchQuery.trim() && !suggestOpen"><em>{{ $t('검색어') }}</em>{{ searchQuery.trim() }}<button type="button" :aria-label="$t('검색어 지우기')" @click="searchQuery = ''">×</button></span>
        <span class="tr-chip opt" v-for="(c, i) in statConditions" :key="'s' + condId(c)">
          <em>{{ $t('옵션') }}</em>{{ statLabel(c) }}<span class="stat-tag" v-if="statTag(c)" :style="{ '--tag': statTag(c).color }">{{ statTag(c).text }}</span>{{ rangeText(c) }}
          <button type="button" :aria-label="`${statLabel(c)} ✎`" :aria-expanded="editIdx === i" @click="openEdit(i)">✎</button>
          <button type="button" :aria-label="`${statLabel(c)} ×`" @click="removeStat(i)">×</button>
          <span class="tr-chip-edit" v-if="editIdx === i" @keydown.enter.prevent="applyEdit" @keydown.esc="editIdx = -1">
            <input type="number" v-model="editMin" :placeholder="$t('최소')" :aria-label="`${statLabel(c)} ${$t('최소')}`" />
            <span>~</span>
            <input type="number" v-model="editMax" :placeholder="$t('최대')" :aria-label="`${statLabel(c)} ${$t('최대')}`" />
            <button type="button" class="apply" @click="applyEdit">{{ $t('적용') }}</button>
          </span>
        </span>
        <span class="tr-applied-gap"></span>
        <button type="button" class="tr-clear" @click="resetFilters(); editIdx = -1">{{ $t('모두 지우기') }}</button>
      </div>

      <!-- 서버·게임·래더·모드는 한 줄 드롭다운 (고른 값은 금색), 에테리얼·미확인은 켜고 끄는 버튼 -->
      <div class="tr-quick">
        <label class="tr-pill" v-for="f in QUICK_SELECTS" :key="f.label" :class="{ on: f.ref.value }">
          <span class="tr-pill-cap">{{ $t(f.label) }}</span>
          <select :value="f.ref.value || ''" @change="f.ref.value = $event.target.value || null" :aria-label="$t(f.label)">
            <option value="">{{ $t('전체') }}</option>
            <option v-for="o in f.options" :key="o" :value="o">{{ $t(o) }}</option>
          </select>
        </label>
        <button type="button" class="tr-toggle eth" :class="{ on: etherealOnly }" :aria-pressed="etherealOnly" @click="etherealOnly = !etherealOnly">{{ $t('에테리얼') }}</button>
        <button type="button" class="tr-toggle unid" :class="{ on: unidOnly }" :aria-pressed="unidOnly" @click="unidOnly = !unidOnly">{{ $t('미확인') }}</button>
      </div>
      <div class="item-range-panel" v-if="pickedItem">
        <div class="item-range-title">
          <b :class="pickedItem.category">{{ $itemName(pickedItem) }}</b> {{ $t('검색 옵션') }}
          <span>- {{ $t('비워두면 상관없음 · 값을 넣으면 그 값을 적은 글만') }}</span>
        </div>
        <template v-for="sec in [{ name: '베이스', defs: itemBaseDefs }, { name: '옵션', defs: itemOptionDefs }]" :key="sec.name">
          <div class="item-range-sec" v-if="sec.defs.length">{{ $t(sec.name) }}</div>
          <div class="item-range-grid" v-if="sec.defs.length">
            <div class="item-range-row" v-for="d in sec.defs" :key="d.key" :class="{ on: activeItemRanges.includes(d) }">
              <span class="item-range-label">{{ $t(d.label) }}</span>
              <select v-if="d.choices" v-model="itemRanges[d.key].pick" class="sort-select" :aria-label="d.label">
                <option value="">{{ $t('전체') }}</option>
                <option v-for="c in d.choices" :key="c" :value="c">{{ d.key === 'sup' ? (c === '상급' ? $t('상급만') : $t('일반 베이스만')) : $t(c) }}</option>
              </select>
              <template v-else>
                <input type="number" v-model="itemRanges[d.key].min" :min="d.lo" :max="d.hi" :placeholder="d.lo ?? $t('최소')" :aria-label="`${d.label} 최소`" />
                <span class="level-range-sep">~</span>
                <input type="number" v-model="itemRanges[d.key].max" :min="d.lo" :max="d.hi" :placeholder="d.hi ?? $t('최대')" :aria-label="`${d.label} 최대`" />
              </template>
            </div>
          </div>
        </template>
        <div class="item-range-empty" v-if="!itemVarDefs.length">{{ $t('변동 옵션 없음 (옵션이 고정된 아이템)') }}</div>
      </div>
    </div>
  </section>

  <div class="tr-body">
  <div class="tr-main">
    <!-- 이벤트 진행 중이면 큰 카드 (없으면 빈 칸이 안 생기게 :empty) -->
    <div class="trade-event-slot"><EventBanner mode="big" /></div>
    <div class="tr-results-head">
      <h2>{{ appliedCount ? $t('검색 결과') : $t('방금 올라온 매물') }} <span>{{ filteredPosts.length }}</span>{{ $t('개') }}</h2>
      <span class="tr-results-note">{{ $t('판매중만 · 찜한 글은 거래중이어도 표시 · 끝난 거래는') }} <router-link to="/trade/history">{{ $t('거래내역') }}</router-link></span>
      <span class="tr-gap"></span>
      <div class="view-mode-toggle">
        <button type="button" :class="{ active: viewMode === 'list' }" :title="$t('목록형')" :aria-label="$t('목록형')" @click="setViewMode('list')">☰</button>
        <button type="button" :class="{ active: viewMode === 'grid' }" :title="$t('그리드형')" :aria-label="$t('그리드형')" @click="setViewMode('grid')">▦</button>
      </div>
      <button type="button" class="guide-btn" @click="openTradeGuide()">{{ $t('이용 안내') }}</button>
      <router-link class="quality-toggle" to="/trade/new">+ {{ $t('판매글 등록') }}</router-link>
    </div>
    <div class="trade-list" v-if="viewMode === 'list'">
      <router-link class="trade-row" v-for="p in pagedPosts" :key="p.id" :to="`/trade/${p.id}`">
        <span class="trade-row-icon" :class="postRarity(p)">
          <img v-if="iconUrlFor(postIconKey(p))" :src="iconUrlFor(postIconKey(p))" alt="" @load="fitIcon" />
          <span v-else class="icon-fallback" aria-hidden="true">{{ p.category.slice(0, 1) }}</span>
        </span>
        <div class="trade-body">
          <div class="trade-title-row">
            <span class="trade-title">{{ postName(p) }}</span>
            <span class="ethereal-badge" v-if="p.ethereal">{{ $t('에테리얼') }}</span><span class="unid-badge" v-if="p.unidentified">{{ $t('미확인') }}</span>
            <span class="dealing-badge" v-if="p.status === '예약중'">{{ $t('거래중') }}</span>
          </div>
          <div class="trade-meta">
            {{ enCount(p.amountLabel) }} ·
            <template v-for="(t, i) in parsePriceTokens(p.price)" :key="i">
              <span class="price-icon" v-if="t.item"><img v-if="iconUrlFor(t.item.icon_key)" :src="iconUrlFor(t.item.icon_key)" alt="" /></span>{{ priceTok(t) }}
            </template>
          </div>
          <div class="trade-opts" v-if="variantLines(p).length">
            <span class="trade-opt" v-for="(l, i) in variantLines(p)" :key="i"><template v-for="(q, j) in optParts($affix(l))" :key="j"><b v-if="q.num">{{ q.x }}</b><template v-else>{{ q.x }}</template></template></span>
          </div>
          <div class="trade-sub-meta">
            {{ $t(p.realm) }} · {{ $t(p.ladder) }} · {{ $t(p.hardcore) }} · {{ agoText(p) }}
          </div>
          <div class="stat-match-row" v-if="statConditions.length">
            <span class="stat-match" v-for="c in statConditions" :key="condId(c)">
              {{ statLabel(c) }}{{ condValue(p, c) !== null ? ` ${condValue(p, c)}${statUnit(c)}` : '' }}
            </span>
          </div>
        </div>
      </router-link>
      <div class="tr-more" ref="moreEl" v-if="hasMore">{{ $t('더 불러오는 중…') }}</div>
      <div class="empty-state" v-if="tradeState.error">{{ tradeState.error }}</div>
      <div class="empty-state" v-else-if="!tradeState.loaded && tradeState.loading">{{ $t('불러오는 중…') }}</div>
      <div class="empty-state" v-else-if="filteredPosts.length === 0">{{ $t('판매중인 글 없음') }}</div>
    </div>

    <div class="trade-grid" v-else>
      <router-link class="trade-card" v-for="p in pagedPosts" :key="p.id" :to="`/trade/${p.id}`">
        <span class="trade-card-icon" :class="postRarity(p)">
          <img v-if="iconUrlFor(postIconKey(p))" :src="iconUrlFor(postIconKey(p))" alt="" @load="fitIcon" />
          <span v-else class="icon-fallback" aria-hidden="true">{{ p.category.slice(0, 1) }}</span>
        </span>
        <span class="dealing-badge trade-card-dealing" v-if="p.status === '예약중'">{{ $t('거래중') }}</span>
        <span class="trade-card-title">{{ postName(p) }}</span>
        <span class="ethereal-badge" v-if="p.ethereal">{{ $t('에테리얼') }}</span><span class="unid-badge" v-if="p.unidentified">{{ $t('미확인') }}</span>
        <span class="trade-card-price">
          {{ enCount(p.amountLabel) }} ·
          <template v-for="(t, i) in parsePriceTokens(p.price)" :key="i">
            <span class="price-icon" v-if="t.item"><img v-if="iconUrlFor(t.item.icon_key)" :src="iconUrlFor(t.item.icon_key)" alt="" /></span>{{ priceTok(t) }}
          </template>
        </span>
        <span class="trade-opts" v-if="variantLines(p).length">
          <span class="trade-opt" v-for="(l, i) in variantLines(p)" :key="i"><template v-for="(q, j) in optParts($affix(l))" :key="j"><b v-if="q.num">{{ q.x }}</b><template v-else>{{ q.x }}</template></template></span>
        </span>
        <span class="stat-match-row" v-if="statConditions.length">
          <span class="stat-match" v-for="c in statConditions" :key="condId(c)">
            {{ statLabel(c) }}{{ condValue(p, c) !== null ? ` ${condValue(p, c)}${statUnit(c)}` : '' }}
          </span>
        </span>
        <span class="trade-card-footer">{{ agoText(p) }}</span>
      </router-link>
      <div class="empty-state" v-if="tradeState.error">{{ tradeState.error }}</div>
      <div class="empty-state" v-else-if="!tradeState.loaded && tradeState.loading">{{ $t('불러오는 중…') }}</div>
      <div class="empty-state" v-else-if="filteredPosts.length === 0">{{ $t('판매중인 글 없음') }}</div>
    </div>
    <div class="tr-more" ref="moreEl" v-if="hasMore && viewMode !== 'list'">{{ $t('더 불러오는 중…') }}</div>
  </div>

  </div>
  </div>
</template>

<style scoped>
/* 벨로그처럼 여백 넉넉한 둥근 카드 느낌 - 톤(어두운 배경, 금색 포인트)은 그대로 두고
   목록 행을 각진 구분선 대신 카드로, 입력창·태그류는 둥글게 다듬음 */
.cat-tabs button{border-radius:999px;}
.search-input-wrap{border-radius:10px; overflow:hidden;}
.quality-toggle{border-radius:10px;}
.sort-select{
  background:var(--panel); border:1px solid var(--border); color:var(--text-muted); font-size:12.5px;
  padding:9px 14px; font-family:'Noto Sans KR', sans-serif; border-radius:10px;
}

.level-range-sep{color:var(--text-dim);}
.reset-filters{
  font-size:12px; color:var(--text-muted); border:1px solid var(--border); padding:7px 12px;
  border-radius:999px; background:transparent; margin-left:auto;
}
.reset-filters:hover{color:var(--gold); border-color:var(--gold-dim);}

.stat-match-row{display:flex; flex-wrap:wrap; justify-content:inherit; gap:6px; margin-top:8px;}
.stat-match{font-size:11px; color:var(--teal); border:1px solid var(--teal); padding:2px 10px; border-radius:999px;}

@media (max-width:640px){
  /* 폰: 카테고리 칩을 빼고 제목이 줄바꿈되게 - 예전엔 제목이 "이…"로 잘리고 본문이 한 글자씩 세로로 꺾였음 */
  .trade-row{gap:10px; padding:14px; flex-wrap:wrap;}
  .trade-cat{display:none;}
  .trade-row-icon{width:40px; height:40px;}
  .trade-title-row{flex-wrap:wrap;}
  .trade-title{white-space:normal; flex-basis:100%;}
}

.trade-event-slot{max-width:1180px; margin:0 auto; padding:18px 24px 0;}
.trade-event-slot:empty{display:none;}
@media (max-width:640px){ .trade-event-slot{padding:14px 16px 0;} }
/* 아이템 자동완성 */
.trade-search{position:relative; flex:1; min-width:0; display:flex;}
.trade-search .search-input-wrap{flex:1; min-width:0; align-items:center;}
.item-suggest{
  position:absolute; z-index:30; left:0; right:0; top:calc(100% + 4px); background:var(--panel-2); border:1px solid var(--border);
  border-radius:10px; padding:4px; box-shadow:0 12px 30px rgba(0,0,0,.45);
}
.item-suggest-row{display:flex; align-items:center; gap:10px; width:100%; padding:7px 10px; border-radius:8px; text-align:left; background:transparent; border:0; cursor:pointer;}
.item-suggest-row.active{background:var(--panel);}
.item-suggest-row small{margin-left:auto; font-size:11px; color:var(--text-dim);}
.item-suggest-icon{width:28px; height:28px; flex:none; display:flex; align-items:center; justify-content:center; border:1px solid var(--border); border-radius:6px; background:var(--panel);}
.item-suggest-icon img{max-width:24px; max-height:24px; image-rendering:pixelated;}
.item-suggest-name{font-size:13px; color:var(--text);}
.item-suggest-name.unique, .item-suggest-name.runeword, .picked-item-chip.unique, .picked-item-chip.runeword, .item-range-title b.unique, .item-range-title b.runeword{color:#c7b377;}
.item-suggest-name.set, .picked-item-chip.set, .item-range-title b.set{color:#00c400;}
.item-suggest-icon.unique, .item-suggest-icon.runeword{border-color:#6b5f3c;} .item-suggest-icon.set{border-color:#1f6b1f;}
.item-suggest-hint{font-size:11px; color:var(--text-dim); padding:6px 10px 4px;}
.picked-item-chip{
  display:inline-flex; align-items:center; gap:6px; flex:none; margin-left:8px; font-size:12.5px; font-weight:600;
  border:1px solid currentColor; padding:4px 6px 4px 10px; border-radius:999px; background:var(--panel-2);
}
.picked-item-chip button{color:var(--text-dim); font-size:11px; padding:2px;}
.picked-item-chip button:hover{color:var(--text);}

/* 고른 아이템의 변동 옵션 범위 */
.item-range-panel{margin-top:10px; padding:12px 14px; border:1px solid var(--border-soft); border-radius:12px; background:var(--panel);}
.item-range-title{font-size:12.5px; color:var(--text-muted); margin-bottom:8px;}
.item-range-title{display:flex; align-items:center; gap:6px 12px; flex-wrap:wrap;}
.item-range-title span{color:var(--text-dim); font-size:12px;}
.item-range-sec{font-size:11.5px; color:var(--gold-dim); margin:10px 0 6px; letter-spacing:.02em;}
.item-range-empty{font-size:12px; color:var(--text-dim);}
.item-range-row .sort-select{padding:6px 10px; min-width:150px;}
.item-range-grid{display:grid; grid-template-columns:repeat(auto-fill, minmax(300px, 1fr)); gap:8px 16px;}
.item-range-row{display:flex; align-items:center; gap:6px; font-size:12.5px;}
.item-range-label{flex:1; min-width:0; color:var(--text-muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.item-range-row.on .item-range-label{color:var(--gold);}
.item-range-row input{
  width:68px; background:var(--panel-2); border:1px solid var(--border); color:var(--text); font-size:12.5px;
  padding:6px 8px; border-radius:8px; font-family:'Noto Sans KR', sans-serif;
}

@media (max-width:640px){
  .trade-search{flex-basis:100%;}
  .item-range-grid{grid-template-columns:1fr;}
  .item-range-label{white-space:normal;}
}

/* 상세 필터 접기 */
.filter-toggle-row{display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-top:10px;}
.filter-toggle{
  font-size:12.5px; color:var(--text-muted); border:1px solid var(--border); padding:7px 14px; border-radius:999px; background:var(--panel);
  display:inline-flex; align-items:center; gap:6px;
}
.filter-toggle:hover, .filter-toggle.open{color:var(--gold); border-color:var(--gold-dim);}
.filter-count{font-size:11px; color:#1a1408; background:var(--gold); border-radius:999px; padding:0 7px; font-weight:700;}


.trade-row-icon{
  width:68px; height:68px; flex:none; display:flex; align-items:center; justify-content:center;
  background:var(--panel-2); border:1px solid var(--border-soft); border-radius:10px;
}
.trade-row-icon img{width:auto; height:auto; max-width:100%; max-height:100%; image-rendering:pixelated;}
.trade-row-icon.unique{border-color:var(--gold-dim); box-shadow:0 0 10px -3px rgba(200,163,77,0.5);}
.trade-row-icon.set{border-color:var(--green); box-shadow:0 0 10px -3px rgba(92,138,91,0.5);}
.trade-row-icon.runeword{border-color:var(--blood); box-shadow:0 0 10px -3px rgba(162,81,63,0.5);}
.trade-row-icon.magic, .trade-card-icon.magic{border-color:#5b5bd6; box-shadow:0 0 10px -3px rgba(110,110,255,0.5);}
.trade-row-icon.rare, .trade-card-icon.rare{border-color:#b8a33a; box-shadow:0 0 10px -3px rgba(230,210,80,0.5);}
.trade-row-icon.crafted, .trade-card-icon.crafted{border-color:#c77a1e; box-shadow:0 0 10px -3px rgba(255,168,0,0.45);}
.icon-fallback{font-family:'Noto Serif KR', serif; font-size:15px; font-weight:700; color:var(--text-dim);}
.trade-row-icon.gem{border-color:var(--teal); box-shadow:0 0 10px -3px rgba(78,138,138,0.5);}

.trade-list-wrap{max-width:1180px;}
.trade-list{display:flex; flex-direction:column; gap:14px;}
.trade-row{
  display:flex; align-items:flex-start; gap:16px; padding:20px 22px; border-radius:16px;
  background:var(--panel); border:1px solid var(--border-soft);
  transition:transform .15s, box-shadow .15s, border-color .15s;
}
.trade-row:hover{transform:translateY(-2px); box-shadow:0 10px 26px -10px rgba(0,0,0,0.55); border-color:var(--gold-dim);}
.trade-body{flex:1; min-width:0;}
.trade-title-row{display:flex; align-items:center; gap:8px; margin-bottom:6px;}
.trade-title{font-size:16.5px; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.unid-badge{font-size:10px; padding:2px 10px; border:1px solid var(--blood); color:#e0775f; flex:none; border-radius:999px;}
.ethereal-badge{font-size:10px; padding:2px 10px; border:1px solid var(--teal); color:var(--teal); flex:none; border-radius:999px;}
.trade-status-badge{font-size:10px; padding:2px 10px; border:1px solid var(--border); flex:none; color:var(--text-dim); border-radius:999px;}
.trade-status-badge.status-판매중{color:var(--gold); border-color:var(--gold-dim);}
.trade-status-badge.status-예약중{color:var(--teal); border-color:var(--teal);}
.trade-status-badge.status-거래완료{color:var(--text-dim); border-color:var(--border);}
.trade-status-badge.status-만료{color:var(--text-dim); border-color:var(--border); border-style:dashed;}
.trade-meta{font-size:12.5px; color:var(--text-muted); margin-bottom:6px;}
.price-icon{display:inline-flex; width:15px; height:15px; vertical-align:-3px; margin:0 2px 0 3px;}
.price-icon img{width:100%; height:100%; object-fit:contain; image-rendering:pixelated;}
.trade-sub-meta{font-size:11.5px; color:var(--text-dim); line-height:1.6;}
/* 그 아이템에서만 달라지는 옵션 줄 */
.trade-opts{display:flex; flex-wrap:wrap; justify-content:inherit; gap:5px 6px; margin-top:7px;}
.trade-opt{font-size:11.5px; color:var(--text-muted); border:1px solid rgba(110,110,255,0.3); background:rgba(110,110,255,0.07); padding:2px 8px; border-radius:7px;}
.trade-opt b{color:#FF6B6B; font-weight:700;}

.view-mode-toggle{display:flex; border:1px solid var(--border); border-radius:10px; overflow:hidden; flex:none;}
.view-mode-toggle button{
  font-size:14px; padding:8px 12px; color:var(--text-dim); background:var(--panel); line-height:1;
}
.view-mode-toggle button + button{border-left:1px solid var(--border);}
.view-mode-toggle button.active{color:var(--gold); background:var(--panel-2);}

.trade-grid{
  display:grid; grid-template-columns:repeat(auto-fill, minmax(330px, 1fr)); gap:16px;
}
.trade-card{
  position:relative; display:flex; flex-direction:column; align-items:center; text-align:center; gap:6px;
  padding:22px 16px 16px; border-radius:16px; background:var(--panel); border:1px solid var(--border-soft);
  transition:transform .15s, box-shadow .15s, border-color .15s;
}
.trade-card:hover{transform:translateY(-3px); box-shadow:0 10px 26px -10px rgba(0,0,0,0.55); border-color:var(--gold-dim);}
.trade-card-star{position:absolute; top:10px; right:12px; margin:0;}
.trade-card-status{position:absolute; top:12px; left:12px; margin:0;}
.trade-card-icon{
  width:88px; height:88px; flex:none; display:flex; align-items:center; justify-content:center;
  background:var(--panel-2); border:1px solid var(--border-soft); border-radius:12px; margin-top:8px;
}
.trade-card-icon img{width:auto; height:auto; max-width:100%; max-height:100%; image-rendering:pixelated;}
.trade-card-icon.unique{border-color:var(--gold-dim); box-shadow:0 0 12px -3px rgba(200,163,77,0.5);}
.trade-card-icon.set{border-color:var(--green); box-shadow:0 0 12px -3px rgba(92,138,91,0.5);}
.trade-card-icon.runeword{border-color:var(--blood); box-shadow:0 0 12px -3px rgba(162,81,63,0.5);}
.trade-card-icon.gem{border-color:var(--teal); box-shadow:0 0 12px -3px rgba(78,138,138,0.5);}
.trade-card-title{
  font-size:14.5px; font-weight:600; color:var(--text); width:100%; overflow:hidden; text-overflow:ellipsis;
  white-space:nowrap; margin-top:2px;
}
.trade-card-price{font-size:12px; color:var(--text-muted); line-height:1.6;}
.trade-card-footer{
  font-size:10.5px; color:var(--text-dim); display:flex; align-items:center; gap:6px; margin-top:4px;
 margin-top:auto; padding-top:6px;}
.online-dot{color:#3ecf5a; margin-right:3px; font-size:10px;}
.board-note{font-size:12px; color:var(--text-dim); margin:0 0 12px;}
.board-note a{color:var(--gold-dim);}
.board-note a:hover{color:var(--gold);}
.dealing-badge{font-size:10px; padding:2px 10px; border:1px solid var(--teal); color:var(--teal); border-radius:999px; flex:none;}
.trade-card-dealing{align-self:center;}
.trade-row:has(.dealing-badge), .trade-card:has(.dealing-badge){opacity:.75;}
.guide-btn{font-size:12.5px; color:var(--text-muted); border:1px solid var(--border); border-radius:10px; padding:9px 12px; background:var(--panel);}
.guide-btn:hover{color:var(--gold); border-color:var(--gold-dim);}

/* ───── 거래 모드 첫 화면 (시안: 큰 검색 + 적용된 조건 줄 + 오른쪽 사이드) ───── */
.sr-only{position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap;}
.tr-hero{background:var(--bg-raise); border-bottom:1px solid var(--border-soft);}
.tr-hero-inner{max-width:1040px; margin:0 auto; padding:48px 24px 28px; display:flex; flex-direction:column; gap:14px;}
.tr-hero h1{text-align:center; font-size:32px; margin:0;}
.tr-hero-sub{text-align:center; color:var(--text-muted); font-size:14.5px; margin:-4px 0 6px;}

.tr-search{display:flex; align-items:stretch; min-height:60px; background:#F3EEE4; border-radius:16px; box-shadow:0 10px 30px rgba(0,0,0,.35); position:relative;}
.tr-search > .tr-search-box{border-radius:16px 0 0 16px;}
.tr-search-box{flex:1 1 auto; min-width:0; position:relative; display:flex;}
.tr-search-box input{flex:1; min-width:0; width:100%; border:none; outline:none; background:transparent; color:#1A1510; font-size:17px; padding:0 18px; font-family:'Noto Sans KR', sans-serif;}
.tr-search-box input::placeholder{color:#6E655A;}
.tr-search-go{display:flex; align-items:center; gap:8px; padding:0 26px; background:var(--gold); color:#1a1408; font-weight:800; font-size:16px; border-radius:0 16px 16px 0;}
.tr-search-go svg{width:19px; height:19px; fill:none; stroke:currentColor; stroke-width:2.6; stroke-linecap:round;}
.tr-search-go:hover{background:var(--focus);}

.tr-suggest{
  position:absolute; top:calc(100% + 8px); left:-1px; right:-1px; z-index:30; padding:8px; max-height:460px; overflow-y:auto;
  background:var(--panel-2); border:1px solid var(--border); border-radius:14px; box-shadow:0 20px 50px rgba(0,0,0,.55);
}
.tr-suggest-title{font-size:11px; font-weight:800; padding:6px 10px 4px; color:var(--text-dim);}
.g-item .tr-suggest-title{color:var(--gold-dim);}
.g-cat .tr-suggest-title{color:#C9A56B;}
.g-stat .tr-suggest-title{color:#9FB0FF;}
.tr-suggest-row{display:flex; align-items:center; gap:10px; width:100%; padding:8px 10px; border-radius:9px; text-align:left; font-size:14px; color:var(--text);}
.tr-suggest-row small{margin-left:auto; font-size:11.5px; color:var(--text-dim);}
/* 옵션 태그 - 직업 전용(직업 색) / 모든 직업(금색), 색은 src/statDisplay.js */
.stat-tag{flex:none; display:inline-flex; align-items:center; margin:0 4px; padding:1px 8px; border-radius:999px; font-size:11px; font-weight:700; line-height:1.5; color:var(--tag); border:1px solid var(--tag); background:color-mix(in srgb, var(--tag) 14%, transparent); white-space:nowrap;}
.tr-suggest-row.active{background:rgba(200,163,77,.14);}
.tr-suggest-hint{font-size:11px; color:var(--text-dim); padding:6px 10px 2px; border-top:1px solid var(--border-soft); margin-top:4px;}

.tr-applied{display:flex; flex-wrap:wrap; align-items:center; gap:8px; padding:10px 12px; border-radius:12px; background:var(--panel); border:1px solid var(--border);}
.tr-applied-label{font-size:12px; font-weight:800; color:var(--text-dim); margin-right:2px;}
.tr-applied-gap{flex:1;}
.tr-clear{font-size:12.5px; color:var(--text-muted); text-decoration:underline; text-underline-offset:3px;}
.tr-clear:hover{color:var(--gold);}
.tr-chip{
  position:relative; display:inline-flex; align-items:center; gap:6px; padding:4px 5px 4px 11px; border-radius:999px;
  font-size:13px; font-weight:600; border:1px solid var(--border); background:var(--panel-2); color:var(--text);
}
.tr-chip em{font-style:normal; font-size:10.5px; font-weight:800; opacity:.75;}
.tr-chip > button{width:22px; height:22px; border-radius:7px; background:rgba(255,255,255,.07); color:inherit; font-size:13px; line-height:22px; display:inline-flex; align-items:center; justify-content:center;}
.tr-chip > button:hover{background:rgba(255,255,255,.16);}
.tr-chip.kind, .tr-chip.realm{background:#2A2216; border-color:#8F773D; color:#F0D9A6;}
.tr-chip.opt{background:#1C2645; border-color:#4A5FA8; color:#DDE3FF;}
.tr-chip.item{background:#2A2216; border-color:var(--gold-dim); color:var(--gold);}
.tr-chip.item.set{color:var(--green);}
.tr-chip-edit{
  position:absolute; top:calc(100% + 6px); left:0; z-index:20; display:flex; align-items:center; gap:6px; padding:8px;
  background:var(--panel-2); border:1px solid #4A5FA8; border-radius:10px; box-shadow:0 12px 30px rgba(0,0,0,.5);
}
.tr-chip-edit input{width:70px; padding:6px 8px; border-radius:7px; border:1px solid var(--border); background:var(--panel); color:var(--text); font-size:13px;}
.tr-chip-edit .apply{padding:6px 12px; border-radius:7px; background:#6E83E0; color:#0E1430; font-weight:800; font-size:12.5px;}


.tr-more{padding:18px; text-align:center; font-size:12.5px; color:var(--text-dim);}
/* 서버·게임·래더·모드 - 한 줄 드롭다운 알약 (고르면 금색) + 에테리얼·미확인 켜고 끄기 */
.tr-quick{display:flex; flex-wrap:wrap; align-items:center; gap:8px; margin-top:2px;}
.tr-pill{position:relative; display:inline-flex; align-items:center; gap:6px; height:36px; padding:0 30px 0 14px; border:1px solid var(--border); border-radius:999px; background:var(--panel); cursor:pointer;}
.tr-pill::after{content:''; position:absolute; right:13px; top:50%; width:6px; height:6px; margin-top:-5px; border-right:1.5px solid var(--text-dim); border-bottom:1.5px solid var(--text-dim); transform:rotate(45deg); pointer-events:none;}
.tr-pill:hover{border-color:var(--gold-dim);}
.tr-pill:focus-within{outline:2px solid var(--gold); outline-offset:1px;}
.tr-pill-cap{font-size:12px; font-weight:700; color:var(--text-dim); white-space:nowrap;}
.tr-pill select{field-sizing:content; appearance:none; -webkit-appearance:none; border:none; outline:none; background:transparent; color:var(--text-muted); font-size:13.5px; font-weight:700; font-family:inherit; cursor:pointer; padding:0;}
.tr-pill select option{background:var(--panel); color:var(--text);}
.tr-pill.on{border-color:var(--gold); background:#2A2216;}
.tr-pill.on .tr-pill-cap{color:#BFA46A;}
.tr-pill.on select{color:var(--gold);}
.tr-pill.on::after{border-color:var(--gold);}
.tr-toggle{height:36px; padding:0 15px; border-radius:999px; font-size:13px; font-weight:700; border:1px dashed var(--border); background:transparent; color:var(--text-dim);}
.tr-toggle:hover{color:var(--text);}
.tr-toggle.eth.on{border:1px solid var(--teal); color:var(--teal); background:color-mix(in srgb, var(--teal) 12%, transparent);}
.tr-toggle.unid.on{border:1px solid #e0775f; color:#e0775f; background:color-mix(in srgb, #e0775f 12%, transparent);}

.tr-body{max-width:1100px; margin:0 auto; padding:24px 24px 64px; display:flex; flex-wrap:wrap; gap:24px; align-items:flex-start;}
.tr-main{flex:999 1 620px; min-width:0;}
.tr-main .trade-list, .tr-main .trade-grid{margin-top:12px;}
.tr-results-head{display:flex; flex-wrap:wrap; align-items:center; gap:10px;}
.tr-results-head h2{font-size:18px; margin:0; font-family:'Noto Sans KR', sans-serif; font-weight:800;}
.tr-results-head h2 span{color:var(--gold);}
.tr-results-note{font-size:12px; color:var(--text-dim);}
.tr-results-note a{color:var(--gold-dim); text-decoration:underline;}
.tr-gap{flex:1;}

@media (max-width:640px){
  .tr-hero-inner{padding:24px 14px 18px; gap:12px;}
  .tr-hero h1{font-size:22px;}
  .tr-hero-sub{display:none;}
  .tr-search{display:grid; grid-template-columns:minmax(0, 1fr) auto; min-height:0; border-radius:12px;}
  .tr-search-box{min-height:48px;}
  .tr-search-box input{font-size:16px; padding:12px 14px;}
  .tr-search-go{padding:0 16px; border-radius:0 0 12px 0; font-size:0; gap:0;}
  .tr-search-go svg{width:20px; height:20px;}
  .tr-quick{gap:6px;}
  .tr-pill{height:34px; padding:0 26px 0 12px;}
  .tr-pill::after{right:11px;}
  .tr-toggle{height:34px; padding:0 12px;}
  .tr-body{padding:16px 14px 48px;}
  .tr-results-note{display:none;}
}
</style>
