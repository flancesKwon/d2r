<script setup>
import { ref, computed, onMounted, watch } from 'vue'
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
  postStatValue,
  postKeywordValue,
  postLevelReq,
  postIconKey,
  postRarity,
  saleLeftMs,
  fmtSaleLeft,
  getItemAffixes,
  isRollRangeAffix,
  isRandomClassSkillAffix,
  CLASS_SKILL_NAMES,
  uniqueDefenseRange,
  SUPERIOR_MODS,
} from '../tradeStore.js'
import itemsData from '../data/items.json'
import { useNow } from '../useNow.js'
import { isOnline } from '../presence.js'
import { openTradeGuide, openTradeGuideOnce } from '../tradeGuide.js'
import { ITEM_ICONS } from '../itemIcons.js'
import { itemMatchesQuery, textMatchesQuery } from '../itemSearch.js'
import { isFavorite, toggleFavorite } from '../tradeFavorites.js'
import EventBanner from '../components/EventBanner.vue'

// 판매글은 DB에서 (최근 글부터) - 들어올 때, 보고 있는 동안 30초마다 새로 받음
onMounted(() => { loadTradePosts(); openTradeGuideOnce() })
useAutoRefresh(() => loadTradePosts(true))
const activeCat = ref(null)
const activeLadder = ref(null)
const activeHardcore = ref(null)
const etherealOnly = ref(false)
const unidOnly = ref(false)
const favoritesOnly = ref(false)
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
  const list = suggestions.value
  if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && list.length) {
    e.preventDefault()
    // 닫혀 있으면 열기만 (첫 줄부터)
    if (!suggestOpen.value) { suggestOpen.value = true; suggestActive.value = 0; return }
    suggestActive.value = (suggestActive.value + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length
  } else if (e.key === 'Enter' && suggestOpen.value && list.length) {
    e.preventDefault()
    pickItem(list[suggestActive.value] || list[0])
  } else if (e.key === 'Escape') {
    suggestOpen.value = false
  } else if (e.key === 'Backspace' && !searchQuery.value && pickedItem.value) {
    clearPickedItem()
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
const statPickKey = ref(TRADE_STAT_FILTERS[0].key)
const statPickMin = ref('')
const statPickMax = ref('')
const statPickKeyword = ref('')
// 드롭다운 라벨의 "(%)"는 칩·배지에선 떼고 수치 뒤에 %로 붙임 ("모든 저항 20% 이상")
const statLabel = (c) => (c.keyword ? `"${c.keyword}"` : (TRADE_STAT_FILTERS.find((s) => s.key === c.key)?.label || c.key).replace('(%)', ''))
const statUnit = (c) => (!c.keyword && TRADE_STAT_FILTERS.find((s) => s.key === c.key)?.label.includes('(%)') ? '%' : '')
function rangeText(c) {
  const u = statUnit(c)
  if (c.min === null && c.max === null) return ' 있음'
  if (c.max === null) return ` ${c.min}${u} 이상`
  if (c.min === null) return ` ${c.max}${u} 이하`
  return c.min === c.max ? ` ${c.min}${u}` : ` ${c.min}~${c.max}${u}`
}
const condId = (c) => (c.keyword ? 'kw:' + c.keyword : c.key)
function addStatCondition() {
  const num = (v) => (v === '' || v === null ? null : Number(v))
  let min = num(statPickMin.value), max = num(statPickMax.value)
  if (min !== null && max !== null && min > max) [min, max] = [max, min]
  const keyword = statPickKey.value === KEYWORD_KEY ? statPickKeyword.value.trim() : ''
  if (statPickKey.value === KEYWORD_KEY && !keyword) return
  const cond = keyword ? { key: KEYWORD_KEY, keyword, min, max } : { key: statPickKey.value, min, max }
  const existing = statConditions.value.find((c) => condId(c) === condId(cond))
  if (existing) Object.assign(existing, cond)
  else statConditions.value.push(cond)
  statPickMin.value = ''
  statPickMax.value = ''
  statPickKeyword.value = ''
}
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
function removeStatCondition(i) {
  statConditions.value.splice(i, 1)
}

// 요구 레벨 범위 - 아이템 사전에 레벨 정보가 있는 글만 걸러지고, 범위를 하나라도
// 입력하면 레벨을 알 수 없는 글(매직/레어·기타 등)은 제외됨
const levelMin = ref('')
const levelMax = ref('')

const hasActiveFilters = computed(
  () =>
    activeCat.value !== null || activeLadder.value !== null ||
    activeHardcore.value !== null || etherealOnly.value || unidOnly.value || favoritesOnly.value ||
    searchQuery.value.trim() !== '' || statConditions.value.length > 0 ||
    levelMin.value !== '' || levelMax.value !== '' || !!pickedItem.value
)
// 상세 필터(레더·하드코어·체크·요구 레벨·옵션 조건)는 접어 둠 - 걸려 있는 개수만 버튼에 표시
const advancedCount = computed(() =>
  [activeLadder.value !== null, activeHardcore.value !== null, etherealOnly.value, unidOnly.value, favoritesOnly.value,
    levelMin.value !== '' || levelMax.value !== ''].filter(Boolean).length + statConditions.value.length
)
const FILTER_OPEN_KEY = 'd2r-trade-filter-open'
function loadFilterOpen() {
  try { return localStorage.getItem(FILTER_OPEN_KEY) === '1' } catch { return false }
}
const filtersOpen = ref(loadFilterOpen())
function toggleFilters() {
  filtersOpen.value = !filtersOpen.value
  try { localStorage.setItem(FILTER_OPEN_KEY, filtersOpen.value ? '1' : '0') } catch { /* 프라이빗 창 등 */ }
}
function resetFilters() {
  activeCat.value = null
  activeLadder.value = null
  activeHardcore.value = null
  etherealOnly.value = false
  unidOnly.value = false
  favoritesOnly.value = false
  searchQuery.value = ''
  statConditions.value = []
  statPickMin.value = ''
  statPickMax.value = ''
  statPickKeyword.value = ''
  levelMin.value = ''
  levelMax.value = ''
  pickedItem.value = null
}

// 판매 기간(48시간)이 끝난 글은 목록에서 내려감 - 1분마다 다시 셈
const now = useNow(60000)
const leftLabel = (p) => fmtSaleLeft(saleLeftMs(p, now.value))
const soon = (p) => { const ms = saleLeftMs(p, now.value); return ms !== null && ms < 6 * 3600000 }
const filteredPosts = computed(() => {
  // 거래 대기(판매중)인 글만 - 예약중(거래방 진행 중)·거래완료는 아이템별 거래내역에서
  // 단, 찜한 글은 예약중이 돼도 계속 보여줌 ("거래중" 표시)
  let list = tradeState.posts.filter((p) => (p.status === '판매중' && saleLeftMs(p, now.value) > 0) || (p.status === '예약중' && isFavorite(p.id)))
  if (activeCat.value) list = list.filter((p) => p.category === activeCat.value)
  if (activeLadder.value) list = list.filter((p) => p.ladder === activeLadder.value)
  if (activeHardcore.value) list = list.filter((p) => p.hardcore === activeHardcore.value)
  if (etherealOnly.value) list = list.filter((p) => p.ethereal)
  if (unidOnly.value) list = list.filter((p) => p.unidentified)
  if (favoritesOnly.value) list = list.filter((p) => isFavorite(p.id))
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
  if (levelMin.value !== '' || levelMax.value !== '') {
    const lo = levelMin.value === '' ? -Infinity : Number(levelMin.value)
    const hi = levelMax.value === '' ? Infinity : Number(levelMax.value)
    list = list.filter((p) => {
      const lv = postLevelReq(p)
      return lv !== null && lv >= lo && lv <= hi
    })
  }
  return [...list].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
})
</script>

<template>
  <div class="items-page trade-page">

  <div class="patch-hero">
    <div class="patch-hero-inner">
      <div class="eyebrow">유저 간 아이템 거래</div>
      <h1>거래게시판</h1>
    </div>
  </div>

  <!-- 이벤트 진행 중이면 큰 카드 (없으면 빈 칸이 안 생기게 :empty) -->
  <div class="trade-event-slot"><EventBanner mode="big" /></div>

  <div class="toolbar">
    <div class="toolbar-inner">
      <div class="cat-tabs">
        <button :class="{ active: activeCat === null }" @click="activeCat = null">전체</button>
        <button v-for="c in TRADE_CATEGORIES" :key="c" :class="{ active: activeCat === c }" @click="activeCat = c">
          {{ c }}
        </button>
      </div>
      <div class="search-row">
        <div class="trade-search">
          <div class="search-input-wrap">
            <span class="picked-item-chip" v-if="pickedItem" :class="pickedItem.category">
              {{ pickedItem.name_ko }}
              <button type="button" :aria-label="`${pickedItem.name_ko} 지정 해제`" @click="clearPickedItem">✕</button>
            </span>
            <input
              type="text" :value="searchQuery" @input="onSearchInput" @keydown="onSearchKey" @focus="suggestOpen = true" @blur="closeSuggestSoon"
              :placeholder="pickedItem ? '옵션·내용으로 더 좁히기' : '아이템명·옵션·내용 검색 (유니크·룬워드는 골라서 옵션 범위 검색)'"
              aria-label="거래글 검색" autocomplete="off" role="combobox" :aria-expanded="suggestOpen && suggestions.length > 0"
            />
          </div>
          <div class="item-suggest" v-if="suggestOpen && suggestions.length">
            <button
              type="button" v-for="(it, i) in suggestions" :key="it.id" class="item-suggest-row" :class="{ active: i === suggestActive }"
              @mousedown.prevent="pickItem(it)" @mousemove="suggestActive = i"
            >
              <span class="item-suggest-icon" :class="it.category"><img v-if="iconUrlFor(it.icon_key)" :src="iconUrlFor(it.icon_key)" alt="" /></span>
              <span class="item-suggest-name" :class="it.category">{{ it.name_ko }}</span>
              <small>{{ it.category_label }}{{ it.subtitle && it.category !== 'runeword' ? ' · ' + it.subtitle : '' }}</small>
            </button>
            <div class="item-suggest-hint">↑↓·Enter로 고르면 이 아이템 글만 + 옵션 범위 검색 · 안 고르면 글자로 검색</div>
          </div>
        </div>
        <span class="result-count">{{ filteredPosts.length }}개</span>
        <div class="view-mode-toggle">
          <button type="button" :class="{ active: viewMode === 'list' }" title="목록형" @click="setViewMode('list')">☰</button>
          <button type="button" :class="{ active: viewMode === 'grid' }" title="그리드형" @click="setViewMode('grid')">▦</button>
        </div>
        <button type="button" class="guide-btn" @click="openTradeGuide()">? 이용 안내</button>
        <router-link class="quality-toggle" to="/trade/new">판매글 등록</router-link>
      </div>
      <div class="item-range-panel" v-if="pickedItem">
        <div class="item-range-title">
          <b :class="pickedItem.category">{{ pickedItem.name_ko }}</b> 검색 옵션
          <span>- 비워두면 상관없음 · 값을 넣으면 그 값을 적은 글만</span>
          <label class="ethereal-filter-check"><input type="checkbox" v-model="etherealOnly" /> 에테리얼만</label>
          <label class="ethereal-filter-check unid-filter-check"><input type="checkbox" v-model="unidOnly" /> 미확인만</label>
        </div>
        <template v-for="sec in [{ name: '베이스', defs: itemBaseDefs }, { name: '옵션', defs: itemOptionDefs }]" :key="sec.name">
          <div class="item-range-sec" v-if="sec.defs.length">{{ sec.name }}</div>
          <div class="item-range-grid" v-if="sec.defs.length">
            <div class="item-range-row" v-for="d in sec.defs" :key="d.key" :class="{ on: activeItemRanges.includes(d) }">
              <span class="item-range-label">{{ d.label }}</span>
              <select v-if="d.choices" v-model="itemRanges[d.key].pick" class="sort-select" :aria-label="d.label">
                <option value="">전체</option>
                <option v-for="c in d.choices" :key="c" :value="c">{{ d.key === 'sup' ? (c === '상급' ? '상급만' : '일반 베이스만') : c }}</option>
              </select>
              <template v-else>
                <input type="number" v-model="itemRanges[d.key].min" :min="d.lo" :max="d.hi" :placeholder="d.lo ?? '최소'" :aria-label="`${d.label} 최소`" />
                <span class="level-range-sep">~</span>
                <input type="number" v-model="itemRanges[d.key].max" :min="d.lo" :max="d.hi" :placeholder="d.hi ?? '최대'" :aria-label="`${d.label} 최대`" />
              </template>
            </div>
          </div>
        </template>
        <div class="item-range-empty" v-if="!itemVarDefs.length">변동 옵션 없음 (옵션이 고정된 아이템)</div>
      </div>
      <div class="filter-toggle-row">
        <button type="button" class="filter-toggle" :class="{ open: filtersOpen, on: advancedCount }" @click="toggleFilters" :aria-expanded="filtersOpen">
          상세 필터<span class="filter-count" v-if="advancedCount">{{ advancedCount }}</span> {{ filtersOpen ? '▴' : '▾' }}
        </button>
        <span class="stat-chip" v-for="(c, i) in (filtersOpen ? [] : statConditions)" :key="'c' + condId(c)">
          {{ statLabel(c) }}{{ rangeText(c) }}
          <button type="button" :aria-label="`${statLabel(c)} 조건 삭제`" @click="removeStatCondition(i)">✕</button>
        </span>
        <button type="button" class="reset-filters" v-if="hasActiveFilters" @click="resetFilters">필터 초기화</button>
      </div>
      <div class="filter-row" v-show="filtersOpen">
        <select v-model="activeLadder" class="sort-select">
          <option :value="null">레더·논레더 전체</option>
          <option v-for="l in TRADE_LADDERS" :key="l" :value="l">{{ l }}</option>
        </select>
        <select v-model="activeHardcore" class="sort-select">
          <option :value="null">일반·하드코어 전체</option>
          <option v-for="h in TRADE_HARDCORE" :key="h" :value="h">{{ h }}</option>
        </select>
        <label class="ethereal-filter-check">
          <input type="checkbox" v-model="etherealOnly" />
          에테리얼만
        </label>
        <label class="ethereal-filter-check unid-filter-check">
          <input type="checkbox" v-model="unidOnly" />
          미확인만
        </label>
        <label class="ethereal-filter-check favorite-filter-check">
          <input type="checkbox" v-model="favoritesOnly" />
          찜한 글만
        </label>
        <div class="level-range">
          <span class="level-range-label">요구 레벨</span>
          <input type="number" min="1" max="99" v-model="levelMin" placeholder="최소" aria-label="요구 레벨 최소" />
          <span class="level-range-sep">~</span>
          <input type="number" min="1" max="99" v-model="levelMax" placeholder="최대" aria-label="요구 레벨 최대" />
        </div>
      </div>
      <div class="filter-row stat-filter-row" v-show="filtersOpen">
        <span class="stat-filter-label">옵션 조건</span>
        <select v-model="statPickKey" class="sort-select" aria-label="옵션 종류">
          <option :value="KEYWORD_KEY">키워드 직접 입력</option>
          <option v-for="s in TRADE_STAT_FILTERS" :key="s.key" :value="s.key">{{ s.label }}</option>
        </select>
        <input
          v-if="statPickKey === KEYWORD_KEY" type="text" v-model="statPickKeyword" class="stat-min-input stat-keyword-input"
          placeholder="키워드 (예: 블리자드)" aria-label="옵션 키워드" @keydown.enter.prevent="addStatCondition"
        />
        <input
          type="number" v-model="statPickMin" class="stat-min-input stat-num-input" placeholder="최소"
          aria-label="최솟값" @keydown.enter.prevent="addStatCondition"
        />
        <span class="level-range-sep">~</span>
        <input
          type="number" v-model="statPickMax" class="stat-min-input stat-num-input" placeholder="최대"
          aria-label="최댓값" @keydown.enter.prevent="addStatCondition"
        />
        <button type="button" class="stat-add-btn" :disabled="statPickKey === KEYWORD_KEY && !statPickKeyword.trim()" @click="addStatCondition">조건 추가</button>
        <span class="stat-hint" v-if="!statConditions.length">범위를 비우면 옵션이 붙어 있기만 하면 됨 · 조건 여러 개 = 모두 만족</span>
        <span class="stat-chip" v-for="(c, i) in statConditions" :key="condId(c)">
          {{ statLabel(c) }}{{ rangeText(c) }}
          <button type="button" :aria-label="`${statLabel(c)} 조건 삭제`" @click="removeStatCondition(i)">✕</button>
        </span>
      </div>
    </div>
  </div>

  <div class="grid-wrap trade-list-wrap">
    <p class="board-note">거래 대기(판매중)인 글만 보여줌 · 찜한 글은 거래중이어도 보임 · 거래완료된 글은 <router-link to="/trade/history">아이템별 거래내역</router-link>에서</p>
    <div class="trade-list" v-if="viewMode === 'list'">
      <router-link class="trade-row" v-for="p in filteredPosts" :key="p.id" :to="`/trade/${p.id}`">
        <button
          type="button" class="favorite-star" :class="{ active: isFavorite(p.id) }"
          :title="isFavorite(p.id) ? '찜 해제' : '찜하기'"
          @click.prevent.stop="toggleFavorite(p.id)"
        >{{ isFavorite(p.id) ? '★' : '☆' }}</button>
        <span class="trade-row-icon" :class="postRarity(p)">
          <img v-if="iconUrlFor(postIconKey(p))" :src="iconUrlFor(postIconKey(p))" alt="" />
          <span v-else class="icon-fallback" aria-hidden="true">{{ p.category.slice(0, 1) }}</span>
        </span>
        <span class="trade-cat">{{ p.category }}</span>
        <div class="trade-body">
          <div class="trade-title-row">
            <span class="trade-title">{{ p.itemName }}</span>
            <span class="ethereal-badge" v-if="p.ethereal">에테리얼</span><span class="unid-badge" v-if="p.unidentified">미확인</span>
            <span class="dealing-badge" v-if="p.status === '예약중'">거래중</span><span class="sale-left" :class="{ soon: soon(p) }" v-if="leftLabel(p)" title="판매 종료까지">⏱ {{ leftLabel(p) }}</span>
          </div>
          <div class="trade-meta">
            {{ p.amountLabel }} ·
            <template v-for="(t, i) in parsePriceTokens(p.price)" :key="i">
              <span class="price-icon" v-if="t.item"><img v-if="iconUrlFor(t.item.icon_key)" :src="iconUrlFor(t.item.icon_key)" alt="" /></span>{{ t.text }}
            </template>
          </div>
          <div class="trade-sub-meta">
            {{ p.realm }} · {{ p.ladder }} · {{ p.hardcore }} · <span v-if="isOnline(p.authorId)" class="online-dot" title="판매자 접속 중">●</span>{{ p.author }} · {{ p.date }}
          </div>
          <div class="stat-match-row" v-if="statConditions.length">
            <span class="stat-match" v-for="c in statConditions" :key="condId(c)">
              {{ statLabel(c) }}{{ condValue(p, c) !== null ? ` ${condValue(p, c)}${statUnit(c)}` : '' }}
            </span>
          </div>
        </div>
      </router-link>
      <div class="empty-state" v-if="tradeState.error">{{ tradeState.error }}</div>
      <div class="empty-state" v-else-if="!tradeState.loaded && tradeState.loading">불러오는 중…</div>
      <div class="empty-state" v-else-if="filteredPosts.length === 0">판매중인 글 없음</div>
    </div>

    <div class="trade-grid" v-else>
      <router-link class="trade-card" v-for="p in filteredPosts" :key="p.id" :to="`/trade/${p.id}`">
        <button
          type="button" class="favorite-star trade-card-star" :class="{ active: isFavorite(p.id) }"
          :title="isFavorite(p.id) ? '찜 해제' : '찜하기'"
          @click.prevent.stop="toggleFavorite(p.id)"
        >{{ isFavorite(p.id) ? '★' : '☆' }}</button>
        <span class="trade-card-icon" :class="postRarity(p)">
          <img v-if="iconUrlFor(postIconKey(p))" :src="iconUrlFor(postIconKey(p))" alt="" />
          <span v-else class="icon-fallback" aria-hidden="true">{{ p.category.slice(0, 1) }}</span>
        </span>
        <span class="trade-cat trade-card-cat">{{ p.category }}</span>
        <span class="dealing-badge trade-card-dealing" v-if="p.status === '예약중'">거래중</span>
        <span class="trade-card-title">{{ p.itemName }}</span>
        <span class="ethereal-badge" v-if="p.ethereal">에테리얼</span><span class="unid-badge" v-if="p.unidentified">미확인</span>
        <span class="trade-card-price">
          {{ p.amountLabel }} ·
          <template v-for="(t, i) in parsePriceTokens(p.price)" :key="i">
            <span class="price-icon" v-if="t.item"><img v-if="iconUrlFor(t.item.icon_key)" :src="iconUrlFor(t.item.icon_key)" alt="" /></span>{{ t.text }}
          </template>
        </span>
        <span class="sale-left card-left" :class="{ soon: soon(p) }" v-if="leftLabel(p)" title="판매 종료까지">⏱ {{ leftLabel(p) }}</span>
        <span class="stat-match-row" v-if="statConditions.length">
          <span class="stat-match" v-for="c in statConditions" :key="condId(c)">
            {{ statLabel(c) }}{{ condValue(p, c) !== null ? ` ${condValue(p, c)}${statUnit(c)}` : '' }}
          </span>
        </span>
        <span class="trade-card-footer">
          <span v-if="isOnline(p.authorId)" class="online-dot" title="판매자 접속 중">●</span>{{ p.author }} · {{ p.date }}
        </span>
      </router-link>
      <div class="empty-state" v-if="tradeState.error">{{ tradeState.error }}</div>
      <div class="empty-state" v-else-if="!tradeState.loaded && tradeState.loading">불러오는 중…</div>
      <div class="empty-state" v-else-if="filteredPosts.length === 0">판매중인 글 없음</div>
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

.filter-row{display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-top:10px;}
.ethereal-filter-check{display:flex; align-items:center; gap:6px; font-size:12.5px; color:var(--teal); cursor:pointer;}
.ethereal-filter-check input{accent-color:var(--teal);}
.favorite-filter-check{color:var(--gold);}
.favorite-filter-check input{accent-color:var(--gold);}

.level-range{display:flex; align-items:center; gap:6px; font-size:12.5px; color:var(--text-muted);}
.level-range-label{color:var(--text-dim);}
.level-range input, .stat-min-input{
  background:var(--panel); border:1px solid var(--border); color:var(--text); font-size:12.5px;
  padding:8px 10px; border-radius:10px; font-family:'Noto Sans KR', sans-serif;
}
.level-range input{width:64px;}
.level-range-sep{color:var(--text-dim);}
.reset-filters{
  font-size:12px; color:var(--text-muted); border:1px solid var(--border); padding:7px 12px;
  border-radius:999px; background:transparent; margin-left:auto;
}
.reset-filters:hover{color:var(--gold); border-color:var(--gold-dim);}

.stat-filter-label{font-size:12.5px; color:var(--text-dim);}
.stat-min-input{width:220px; max-width:100%;}
.stat-add-btn{
  font-size:12.5px; color:var(--gold); border:1px solid var(--gold-dim); padding:8px 14px;
  border-radius:10px; background:var(--panel);
}
.stat-add-btn:hover{background:var(--panel-2);}
.stat-chip{
  display:inline-flex; align-items:center; gap:6px; font-size:12px; color:var(--gold);
  border:1px solid var(--gold-dim); padding:5px 8px 5px 12px; border-radius:999px; background:var(--panel-2);
}
.stat-chip button{color:var(--text-dim); font-size:11px; line-height:1; padding:2px;}
.stat-chip button:hover{color:var(--text);}

.stat-match-row{display:flex; flex-wrap:wrap; justify-content:inherit; gap:6px; margin-top:8px;}
.stat-match{font-size:11px; color:var(--teal); border:1px solid var(--teal); padding:2px 10px; border-radius:999px;}

@media (max-width:640px){
  .stat-min-input{width:100%;}
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

.favorite-star{
  font-size:20px; line-height:1; color:var(--text-dim); flex:none; padding:2px; margin-top:2px;
  transition:color .1s, transform .1s;
}
.favorite-star:hover{color:var(--gold-dim); transform:scale(1.15);}
.favorite-star.active{color:var(--gold);}

.trade-row-icon{
  width:44px; height:44px; flex:none; display:flex; align-items:center; justify-content:center;
  background:var(--panel-2); border:1px solid var(--border-soft); border-radius:10px;
}
.trade-row-icon img{width:100%; height:100%; object-fit:contain; image-rendering:pixelated;}
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
.trade-cat{font-size:11px; color:var(--gold-dim); border:1px solid var(--border); padding:4px 12px; flex:none; margin-top:1px; border-radius:999px;}
.trade-body{flex:1; min-width:0;}
.trade-title-row{display:flex; align-items:center; gap:8px; margin-bottom:6px;}
.trade-title{font-size:15px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.unid-badge{font-size:10px; padding:2px 10px; border:1px solid var(--blood); color:#e0775f; flex:none; border-radius:999px;}
.unid-filter-check{color:#e0775f !important;}
.unid-filter-check input{accent-color:#e0775f;}
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
.sale-left{font-size:10.5px; color:var(--text-dim); flex:none; white-space:nowrap; font-variant-numeric:tabular-nums;}
.sale-left.soon{color:#e0775f;}

.view-mode-toggle{display:flex; border:1px solid var(--border); border-radius:10px; overflow:hidden; flex:none;}
.view-mode-toggle button{
  font-size:14px; padding:8px 12px; color:var(--text-dim); background:var(--panel); line-height:1;
}
.view-mode-toggle button + button{border-left:1px solid var(--border);}
.view-mode-toggle button.active{color:var(--gold); background:var(--panel-2);}

.trade-grid{
  display:grid; grid-template-columns:repeat(auto-fill, minmax(210px, 1fr)); gap:16px;
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
  width:64px; height:64px; flex:none; display:flex; align-items:center; justify-content:center;
  background:var(--panel-2); border:1px solid var(--border-soft); border-radius:12px; margin-top:8px;
}
.trade-card-icon img{width:100%; height:100%; object-fit:contain; image-rendering:pixelated;}
.trade-card-icon.unique{border-color:var(--gold-dim); box-shadow:0 0 12px -3px rgba(200,163,77,0.5);}
.trade-card-icon.set{border-color:var(--green); box-shadow:0 0 12px -3px rgba(92,138,91,0.5);}
.trade-card-icon.runeword{border-color:var(--blood); box-shadow:0 0 12px -3px rgba(162,81,63,0.5);}
.trade-card-icon.gem{border-color:var(--teal); box-shadow:0 0 12px -3px rgba(78,138,138,0.5);}
.trade-card-cat{margin-top:4px;}
.trade-card-title{
  font-size:13.5px; color:var(--text); width:100%; overflow:hidden; text-overflow:ellipsis;
  white-space:nowrap; margin-top:2px;
}
.trade-card-price{font-size:12px; color:var(--text-muted); line-height:1.6;}
.trade-card-footer{
  font-size:10.5px; color:var(--text-dim); display:flex; align-items:center; gap:6px; margin-top:4px;
}
.online-dot{color:#3ecf5a; margin-right:3px; font-size:10px;}
.stat-num-input{width:76px;}
.stat-keyword-input{width:210px; max-width:100%;}
.stat-hint{font-size:11.5px; color:var(--text-dim);}
.stat-add-btn:disabled{opacity:.5; cursor:default;}
.board-note{font-size:12px; color:var(--text-dim); margin:0 0 12px;}
.board-note a{color:var(--gold-dim);}
.board-note a:hover{color:var(--gold);}
.dealing-badge{font-size:10px; padding:2px 10px; border:1px solid var(--teal); color:var(--teal); border-radius:999px; flex:none;}
.trade-card-dealing{align-self:center;}
.trade-row:has(.dealing-badge), .trade-card:has(.dealing-badge){opacity:.75;}
.guide-btn{font-size:12.5px; color:var(--text-muted); border:1px solid var(--border); border-radius:10px; padding:9px 12px; background:var(--panel);}
.guide-btn:hover{color:var(--gold); border-color:var(--gold-dim);}
</style>
