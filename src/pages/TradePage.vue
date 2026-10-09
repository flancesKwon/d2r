<script setup>
import { postName, countText, priceTok } from '../tradeI18n.js'
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
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
  superiorCombosFor,
  baseForItem,
  searchBaseItems,
  classSkillsForBase,
  BASE_ITEMS,
  baseItemLabel,
  ICON_VARIANTS,
  TRADE_REALMS,
  GAME_VERSIONS,
} from '../tradeStore.js'
import itemsData from '../data/items.json'
import magicAffixData from '../data/magicAffixes.json'
import { craftRecipesFor, affixFamiliesFor } from '../magicAffixes.js'
import { familyLines } from '../magicAffixes.js'
import { useNow } from '../useNow.js'
import { isOnline } from '../presence.js'
import { openTradeGuide } from '../tradeGuide.js'
import { ITEM_ICONS } from '../itemIcons.js'
import { itemMatchesQuery, textMatchesQuery } from '../itemSearch.js'
import EventBanner from '../components/EventBanner.vue'
import SearchSelect from '../components/SearchSelect.vue'
import RangeInput from '../components/RangeInput.vue'
import { t, itemName, locale, affixText } from '../i18n.js'
import { statParts, statSearchTexts } from '../statDisplay.js'
import { countWantsForItem } from '../wantsStore.js'

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
// 부위(착용 위치) - 판매글의 베이스 줄이나 사전 아이템의 세부 종류로 정함
const SLOT_ORDER = ['머리', '몸통', '방패', '장갑', '신발', '허리', '목걸이', '반지', '무기']
// 베이스 세부 종류 -> 부위 (사전 아이템과 베이스 목록이 쓰는 이름이 조금 달라 둘 다 적음)
const SLOT_BY_SUB = {
  투구: '머리', '드루이드 투구': '머리', '바바리안 투구': '머리', 서클릿: '머리',
  갑옷: '몸통',
  방패: '방패', '네크로맨서 방패': '방패', '팔라딘 방패': '방패', 마법서: '방패',
  장갑: '장갑', 신발: '신발', 벨트: '허리', 목걸이: '목걸이', 반지: '반지',
  도끼: '무기', 지팡이: '무기', 둔기: '무기', 검: '무기', 대거: '무기', 창: '무기',
  폴암: '무기', 활: '무기', 오브: '무기', 클로: '무기',
}
// 룬워드는 베이스를 안 적은 글이 있을 수 있어 올릴 수 있는 베이스 종류로 봄 (여러 종류면 못 정함)
const RW_SLOT = { tors: '몸통', helm: '머리', shld: '방패' }
const WEAPON_SUBS = new Set(['도끼', '지팡이', '둔기', '검', '대거', '창', '폴암', '활', '오브', '클로'])
const BASE_SLOT = new Map()
for (const b of BASE_ITEMS) {
  const sl = SLOT_BY_SUB[b.type_sub] || (b.base_stats?.category === 'weapon' ? '무기' : null)
  if (!sl) continue
  if (b.name_ko) BASE_SLOT.set(b.name_ko, sl)
  if (b.subtitle) BASE_SLOT.set(b.subtitle, sl)
}
const slotCache = new Map()
function postSlot(p) {
  const base = (p.options || []).find((l) => l.startsWith('베이스: ')) || ''
  const ck = p.itemId + '|' + base + '|' + (p.itemName || '')
  if (slotCache.has(ck)) return slotCache.get(ck)
  let sl = null
  if (base) sl = BASE_SLOT.get(base.slice('베이스: '.length).replace(/ \(.+\)$/, '')) || null
  if (!sl) {
    const it = getTradeItem(p.itemId)
    if (it) {
      sl = SLOT_BY_SUB[it.type_sub] || null
      if (!sl && it.category === 'runeword') sl = RW_SLOT[it.subtitle] || null
      if (!sl && (WEAPON_SUBS.has(it.type_sub) || it.base_stats?.category === 'weapon')) sl = '무기'
    }
  }
  // 매직·레어 장신구는 베이스 줄이 없고 이름에 들어 있음 ("레어 반지")
  if (!sl) { const nm = p.itemName || ''; sl = nm.includes('반지') ? '반지' : nm.includes('목걸이') ? '목걸이' : null }
  slotCache.set(ck, sl)
  return sl
}
const activeSlot = ref(null)
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
// ↑↓ 나 마우스로 추천 줄을 고른 적이 있는지 - 고른 적 없으면 Enter 는 글자 검색
const suggestNav = ref(false)
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
  suggestNav.value = false
}
function pickItem(it) {
  pickedItem.value = it
  searchQuery.value = ''
  suggestOpen.value = false
  goSearch()
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
    suggestNav.value = true
    if (!suggestOpen.value) { suggestOpen.value = true; suggestActive.value = 0; return }
    suggestActive.value = (suggestActive.value + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length
  } else if (e.key === 'Enter') {
    e.preventDefault()
    // 추천 줄을 직접 고른 경우에만 그 줄, 아니면 친 글자로 검색
    if (suggestNav.value && suggestOpen.value && list.length) chooseSuggestion(list[suggestActive.value] || list[0])
    else runSearch()
  } else if (e.key === 'Escape') {
    suggestOpen.value = false
  } else if (e.key === 'Backspace' && !searchQuery.value) {
    removeLastApplied()
  }
}
// 폰: 추천 줄을 누르면 입력칸 포커스가 먼저 빠지면서(blur) 목록이 닫혀 터치가 씹혔음
// -> 목록 위에 손가락·마우스가 내려와 있으면 닫지 않고, 고르는 건 click 에서. 목록 밖을 누르면 닫음
let suggestPointer = false
const closeSuggestSoon = () => setTimeout(() => { if (!suggestPointer) suggestOpen.value = false }, 150)
function onDocPointerDown(e) {
  if (e.target.closest?.('.tr-suggest')) { suggestPointer = true; return }
  suggestPointer = false
  if (!e.target.closest?.('.tr-search-box')) suggestOpen.value = false
}
onMounted(() => document.addEventListener('pointerdown', onDocPointerDown, true))
onUnmounted(() => document.removeEventListener('pointerdown', onDocPointerDown, true))

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
// 룬워드로 쓸 수 있는 베이스는 사전에서 전부 (판매글 등록 화면과 같은 목록)
const runewordBases = computed(() => {
  const it = pickedItem.value
  if (it?.category !== 'runeword') return []
  return searchBaseItems('', null, it).map(baseItemLabel).sort((a, b) => a.localeCompare(b, 'ko'))
})
// 룬워드 베이스가 방어구만/무기만인지 (기본 방어력 칸과 데미지 칸 중 뭘 보여줄지)
const runewordBaseKinds = computed(() => {
  const it = pickedItem.value
  if (it?.category !== 'runeword') return []
  return [...new Set(searchBaseItems('', null, it).map((b) => b.base_stats.category))]
})
// ── 사전에 없는 아이템(매직/레어/크래프트/일반) 찾기 ──
// 판매글에는 품질(options.quality)·베이스 줄·모양(options.iconKey)이 저장돼 있어서 그걸로 거름
const QUALITY_PICKS = [
  { v: 'magic', label: '매직' }, { v: 'rare', label: '레어' },
  { v: 'crafted', label: '크래프트' }, { v: 'normal', label: '일반(흰색)' },
]
const mrQuality = ref('')
const mrBase = ref('')
// 고른 베이스 객체 - 이름으로 다시 찾지 않고 고를 때 그대로 담아둠
const mrBaseObj = ref(null)
const mrShape = ref('')
const mrCraft = ref('')
// 소켓 수 범위 (빈 칸 = 상관없음) · 상급 여부와 상급 수치 - 등록 양식에 있는 칸을 검색에도
const mrSock = ref({ min: '', max: '' })
const mrLvl = ref({ min: '', max: '' })
const mrSup = ref('')
const mrSupVals = ref({})
// 베이스를 고르면 켜짐 (유니크·세트·룬워드는 아이템 지정으로 찾음)
const mrOn = computed(() => !pickedItem.value && !!mrBase.value)
// 검색창에 뜨는 베이스 후보 - 장신구 + 무기·방어구 (등록 화면과 같은 목록)
const QUALITY_SHORT = { magic: '매직', rare: '레어', crafted: '크래프트', normal: '일반' }
const baseIconKey = (b) => b.icon_key || magicAffixData.bases[b.code]?.icon || null
const baseLabelOf = (b) => (b.base_stats.category === 'misc' ? b.name_ko : baseItemLabel(b))
// 그 베이스로 나올 수 있는 품질 (등록 화면과 같은 규칙)
function baseQualities(b) {
  const out = b.base_stats.category !== 'misc' ? ['normal', 'magic'] : ['magic']
  if (magicAffixData.bases[b.code]?.rare) out.push('rare')
  if (craftRecipesFor(magicAffixData, b).length) out.push('crafted')
  return out
}
const baseCandidates = computed(() => {
  // "레어 서클릿"처럼 품질을 앞에 붙여 쳐도 찾게 품질 단어는 빼고 검색
  const q = searchQuery.value.trim().replace(JAMO_TAIL, '').replace(/^(매직|레어|일반|크래프트)\s*/, '')
  if (!q || pickedItem.value) return []
  const sq = squash(q)
  const misc = MISC_BASES.filter((b) => squash(b.name_ko).includes(sq) || squash((b.subtitle || '').toLowerCase()).includes(sq.toLowerCase()))
  return [...misc, ...searchBaseItems(q, null)].slice(0, 6)
})
function pickBase(b, quality = '') {
  suggestPointer = false
  pickedItem.value = null
  mrBaseObj.value = b
  mrBase.value = baseLabelOf(b)
  mrQuality.value = quality
  mrShape.value = ''
  mrCraft.value = ''
  searchQuery.value = ''
  suggestOpen.value = false
  goSearch()
}
const clearMrBase = () => { mrBase.value = ''; mrBaseObj.value = null; resetMr() }
// 화면에 보여줄 베이스 이름 - 영어면 장신구는 영어 이름, 장비는 "써클릿 (Circlet)" 의 괄호 안
const mrBaseText = computed(() => {
  if (locale.value === 'ko' || !mrBase.value) return mrBase.value
  const misc = MISC_BASES.find((b) => b.name_ko === mrBase.value)
  if (misc?.subtitle) return misc.subtitle
  return /\(([^)]+)\)\s*$/.exec(mrBase.value)?.[1] || mrBase.value
})
// '다른 베이스' - 검색창으로 돌아가서 다시 고름
const searchEl = ref(null)
const focusSearch = () => nextTick(() => searchEl.value?.focus())
// 베이스 목록 - 장신구(반지·목걸이·주얼·부적) + 무기·방어구 전부, 판매글에 적히는 이름 그대로
const MISC_BASES = magicAffixData.miscBases.map((b) => ({ ...b, type_sub: b.name_ko, tier: '', sockets: 0, base_stats: { category: 'misc' } }))
// 고른 베이스 객체 (모양·크래프트 후보를 뽑는 데 씀)
const mrBaseItem = computed(() => {
  if (!mrBase.value) return null
  if (mrBaseObj.value && baseLabelOf(mrBaseObj.value) === mrBase.value) return mrBaseObj.value
  // 주소로 바로 들어온 경우 등 - 이름으로 찾되 검색어를 넣어 (빈 검색은 앞 40개만 돌려줌)
  return MISC_BASES.find((b) => b.name_ko === mrBase.value)
    || searchBaseItems(mrBase.value.replace(/ \(.+\)$/, ''), null).find((b) => baseItemLabel(b) === mrBase.value) || null
})
// 고른 베이스가 반지·목걸이·주얼·부적이면 모양도 고를 수 있음 (등록 화면과 같은 목록)
const mrShapeChoices = computed(() => {
  const code = mrBaseItem.value?.code
  return code && ICON_VARIANTS[code] ? ICON_VARIANTS[code] : []
})
// 그 베이스로 고를 수 있는 품질만
const mrQualityPicks = computed(() => {
  const b = mrBaseItem.value
  const allow = b ? baseQualities(b) : QUALITY_PICKS.map((q) => q.v)
  return QUALITY_PICKS.filter((q) => allow.includes(q.v))
})
// 이 베이스·품질에서 가능한 소켓 최대 개수 (등록 화면과 같은 규칙)
//  일반(흰색)·품질 안 고름 = 베이스 최대 / 매직·레어·크래프트 = 소켓 접두사 범위 또는 라르주크(매직 2, 나머지 1)
const mrSockMax = computed(() => {
  const b = mrBaseItem.value
  const max = b?.sockets || 0
  if (!max) return 0
  const q = mrQuality.value
  if (!q || q === 'normal') return max
  let hi = q === 'magic' ? 2 : 1
  const fam = affixFamiliesFor(magicAffixData, b, q).find((f) => f.mods.some((m) => m.code === 'sock'))
  if (fam) hi = Math.max(hi, Number(fam.slotRanges[0][1]) || 0)
  return Math.min(max, hi)
})
const mrSockOn = computed(() => mrSock.value.min !== '' || mrSock.value.max !== '')
// 요구 레벨은 접사가 붙는 품질(매직·레어·크래프트)만 - 등록에서도 그때만 받음
const mrLvlOn = computed(() => mrLvl.value.min !== '' || mrLvl.value.max !== '')
const mrLvlShow = computed(() => !mrQuality.value || ['magic', 'rare', 'crafted'].includes(mrQuality.value))
const LVL_LINE = /^요구 레벨 (\d+)$/
watch(mrLvlShow, (on) => { if (!on) mrLvl.value = { min: '', max: '' } })
// 상급은 흰 베이스만 - 매직·레어는 같은 문구(피해 증가 등)가 접사로도 붙어서 구분이 안 됨
const mrSupCombos = computed(() => (mrQuality.value === 'normal' ? superiorCombosFor(mrBaseItem.value) : []))
const mrSupMods = computed(() => {
  const ks = new Set(mrSupCombos.value.flat())
  return Object.keys(SUPERIOR_MODS).filter((k) => ks.has(k))
})
watch(mrSupMods, (ks) => {
  const old = mrSupVals.value
  mrSupVals.value = Object.fromEntries(ks.map((k) => [k, old[k] || { min: '', max: '' }]))
}, { immediate: true })
// 베이스·품질을 바꾸면 범위를 넘는 값이 남지 않게 비움
watch(mrSockMax, () => { mrSock.value = { min: '', max: '' } })
watch(mrSupCombos, (c) => { if (!c.length) mrSup.value = '' })

// 이 베이스·품질에 붙을 수 있는 옵션 (매직/레어 접사 사전 -> 옵션 검색 항목). 품질을 안 골랐으면 매직+레어
// 접사마다 최대 수치로 문구를 만들어 옵션 검색 정규식에 맞춰 봄 - 자주 찾는 옵션 먼저
const MR_OPT_FIRST = [/^모든 기술/, /시전 속도/, /모든 저항/, /^생명력 X$/, /^힘 X$|^민첩 X$/, /마법 아이템 발견/, /기술 레벨/, /전용\)$/, /저항/, /훔침/]
// 품질별 안내 (어떤 옵션이 몇 줄까지 붙는지)
const QUALITY_HINT = {
  '': '품질을 고르면 붙을 수 있는 옵션만 남음',
  magic: '매직: 접두·접미 1개씩, 옵션 최대 2줄',
  rare: '레어: 접두 3 + 접미 3, 옵션 최대 6줄',
  crafted: '크래프트: 제작법 고정 옵션 + 레어 옵션 1~4줄 - 아래에서 제작법을 고르면 그 제작법으로 만든 것만',
  normal: '일반(흰색): 접사 없음 - 상급·소켓·베이스 자체 옵션으로 찾음',
}
// 수치가 들어간 옵션 줄 -> 옵션 검색 항목 + 첫 수치 (범위 계산용)
const statOfLine = (line) => ALL_STAT_FILTERS.find((x) => x.regex.test(line)) || null
const firstNumOf = (st, line) => { const m = st.regex.exec(line); const v = m && m[1] !== undefined ? Number(m[1]) : NaN; return Number.isFinite(v) ? v : null }
function addRange(ranges, key, a, b) {
  if (a === null || b === null) return
  const r = ranges[key]
  ranges[key] = r ? [Math.min(r[0], a, b), Math.max(r[1], a, b)] : [Math.min(a, b), Math.max(a, b)]
}
// 크래프트 제작법 카드 - 이름 + 고정 옵션 줄(범위)
const mrCraftCards = computed(() => {
  const b = mrBaseItem.value
  if (!b) return []
  return craftRecipesFor(magicAffixData, b).map((c) => {
    const lo = familyLines(c.fam, c.fam.slotRanges.map(([x]) => x))
    const hi = familyLines(c.fam, c.fam.slotRanges.map(([, y]) => y))
    const lines = familyLines(c.fam, c.fam.slotRanges.map(([x, y]) => (x === y ? x : `${x}~${y}`)))
    const stats = hi.map((line, i) => { const st = statOfLine(line); return st ? { st, lo: firstNumOf(st, lo[i]), hi: firstNumOf(st, line) } : null }).filter(Boolean)
    return { name: c.name, lines, stats }
  })
})
const mrCraftCard = computed(() => mrCraftCards.value.find((c) => c.name === mrCraft.value) || null)

// 베이스 자체 옵션 - 게임이 직업 전용 베이스에 자동으로 붙이는 것 (판매글 등록의 '베이스 자체 옵션' 칸과 같음)
//  · 스킬: 오브·완드·클로·드루이드/바바리안 투구 등에 그 직업 스킬 최대 3개 × +1~3
//  · 자동 옵션: 오브 생명력·마나, 팔라딘 방패 모든 저항·명중률, 네크로 머리 독·마법·화염 피해 등
function addBaseOwnOpts(b, q, found, ranges) {
  const cls = classSkillsForBase(b)
  for (const sk of cls?.skills || []) {
    const st = statOfLine(`${sk.ko || sk.en} +3 (${cls.name} 전용)`)
    if (!st) continue
    if (!found.has(st.key)) found.set(st.key, st)
    addRange(ranges, st.key, 1, 3)
  }
  // 레어·크래프트는 가장 높은 단계가 안 붙어서 범위가 좁음 (등록 화면과 같은 규칙)
  const rare = magicAffixData.bases[b.code]?.autoRare || {}
  let mods = b.auto_mods || []
  if (['rare', 'crafted'].includes(q)) mods = mods.filter((m) => rare[m.key]).map((m) => ({ ...m, ...rare[m.key] }))
  for (const m of mods) {
    const st = statOfLine(String(m.text).replace('{v}', m.max))
    if (!st) continue
    if (!found.has(st.key)) found.set(st.key, st)
    addRange(ranges, st.key, m.min, m.max)
  }
}

// 옵션마다 이 베이스에서 나오는 수치 범위도 같이 (최소·최대 칸에 보여줌) - 접사 하나 기준 (레어는 두 접사가 겹치면 더 높을 수 있음)
const mrOptCache = new Map()
const mrOptInfo = computed(() => {
  const b = mrBaseItem.value
  if (!b) return { list: [], ranges: {}, fixed: new Set() }
  const q = mrQuality.value
  // 일반(흰색)은 접사가 안 붙음 - 베이스 자체 옵션만 모음
  const qs = q === 'normal' ? [] : q ? [q] : ['magic', 'rare']
  const craft = q === 'crafted' ? mrCraftCard.value : null
  const ck = b.code + ':' + (q || '') + ':' + (craft?.name || '')
  if (mrOptCache.has(ck)) return mrOptCache.get(ck)
  const found = new Map()
  const ranges = {}
  // 제작법 고정 옵션 먼저 (고정 표시)
  const fixed = new Set()
  for (const x of craft?.stats || []) {
    if (!found.has(x.st.key)) found.set(x.st.key, x.st)
    fixed.add(x.st.key)
    addRange(ranges, x.st.key, x.lo, x.hi)
  }
  for (const q of qs) {
    for (const f of affixFamiliesFor(magicAffixData, b, q)) {
      const loLines = familyLines(f, f.slotRanges.map(([lo]) => lo))
      const hiLines = familyLines(f, f.slotRanges.map(([, hi]) => hi))
      hiLines.forEach((line, i) => {
        const st = statOfLine(line)
        if (!st) return
        if (!found.has(st.key)) found.set(st.key, st)
        addRange(ranges, st.key, firstNumOf(st, loLines[i]), firstNumOf(st, line))
      })
    }
  }
  addBaseOwnOpts(b, q, found, ranges)
  const rank = (st) => { const i = MR_OPT_FIRST.findIndex((re) => re.test(st.label)); return i < 0 ? 99 : i }
  const list = [...found.values()].sort((a, b2) => (fixed.has(b2.key) - fixed.has(a.key)) || (/충전|확률로/.test(a.label) - /충전|확률로/.test(b2.label)) || rank(a) - rank(b2) || a.label.localeCompare(b2.label, 'ko'))
  const info = { list, ranges, fixed }
  mrOptCache.set(ck, info)
  return info
})
const mrOptStats = computed(() => mrOptInfo.value.list)
// 이 베이스에서 이 옵션이 나오는 범위 [lo, hi] (모르면 null)
const condRange = (c) => (!c.keyword && mrOn.value && mrOptInfo.value.ranges[c.key]) || null
const mrOptQuery = ref('')
const mrOptMore = ref(false)
const mrOptHits = computed(() => {
  // 한글 조합 중간('모ㄷ')에 목록이 잠깐 비지 않게 끝에 남은 자모는 떼고 찾음 (메인 검색창과 같은 방식)
  const q = squash(mrOptQuery.value.replace(JAMO_TAIL, '').toLowerCase())
  const pool = mrOptStats.value.length ? mrOptStats.value : ALL_STAT_FILTERS
  const notAdded = (st) => !statConditions.value.some((c) => !c.keyword && c.key === st.key)
  if (!q) return pool.filter(notAdded)
  return pool.filter((st) => notAdded(st) && statSearchTexts(st).some((x) => squash(String(x).toLowerCase()).includes(q))).slice(0, 30)
})
const MR_OPT_SHOW = 10
// 칩 태그 - 이름에 이미 직업이 들어 있으면("네크로맨서 기술 레벨") 태그는 생략
function chipTag(st) {
  const p = statParts(st)
  return p.tag && !(st.cls && p.name.includes(t(st.cls))) ? p.tag : null
}
// 제작법을 고르면 그 제작법에 늘 붙는 옵션(고정)은 바로 조건으로 올림 - 수치는 비워둠(= 붙어 있기만 하면 통과)
// 제작법을 바꾸거나 끄면, 자동으로 넣었고 수치를 안 건드린 것만 도로 치움 (직접 고친 건 남김)
let autoCraftKeys = []
watch(mrCraftCard, (card) => {
  if (autoCraftKeys.length) {
    const auto = new Set(autoCraftKeys)
    statConditions.value = statConditions.value.filter((c) => !(!c.keyword && auto.has(c.key) && c.min === null && c.max === null))
  }
  autoCraftKeys = []
  for (const x of card?.stats || []) {
    if (statConditions.value.some((c) => !c.keyword && c.key === x.st.key)) continue
    statConditions.value.push({ key: x.st.key, min: null, max: null })
    autoCraftKeys.push(x.st.key)
  }
})

function addMrOpt(st) {
  if (!statConditions.value.some((c) => !c.keyword && c.key === st.key)) statConditions.value.push({ key: st.key, min: null, max: null })
  mrOptQuery.value = ''
}
// 옵션 조건 수치 칸 (빈 칸 = 상관없음)
const condNum = (v) => (v === '' || v === null || !Number.isFinite(Number(v)) ? null : Number(v))
function setCondMin(c, v) { c.min = condNum(v) }
function setCondMax(c, v) { c.max = condNum(v) }
watch(mrBase, () => { mrShape.value = '' })
watch(mrQuality, (q) => { if (q !== 'crafted') mrCraft.value = '' })
const mrCount = computed(() =>
  [mrQuality.value, mrBase.value, mrShape.value, mrCraft.value, mrSockOn.value, mrSup.value, mrLvlOn.value].filter(Boolean).length
)
function resetMr() {
  mrQuality.value = ''; mrBase.value = ''; mrBaseObj.value = null; mrShape.value = ''; mrCraft.value = ''
  mrSock.value = { min: '', max: '' }; mrSup.value = ''; mrLvl.value = { min: '', max: '' }
  for (const k of Object.keys(mrSupVals.value)) mrSupVals.value[k] = { min: '', max: '' }
}
// 판매글이 조건에 맞는지
function mrMatches(p, skip) {
  const no = (k) => skip === k
  if (!mrOn.value) return true
  if (mrQuality.value && !no('mr:quality') && p.quality !== mrQuality.value) return false
  if (mrBase.value && !no('mr:base')) {
    // 판매글에는 괄호 붙은 이름("베이스: 반지 (Ring)")이 적히고 고르는 값은 장신구면 괄호가 없음("반지")
    // -> 괄호를 뗀 이름끼리 비교 (예전엔 장신구 베이스로 고르면 매물이 하나도 안 나왔음)
    const bare = (x) => x.replace(/ (.+)$/, '')
    const line = (p.options || []).find((l) => l.startsWith('베이스: '))
    const name = line ? bare(line.slice('베이스: '.length)) : ''
    const want = bare(mrBase.value)
    // 베이스 줄이 없는 옛 글은 아이템 이름으로 ("레어 반지")
    if (!(name === want || (!line && (p.itemName || '').includes(want)))) return false
  }
  if (mrShape.value && !no('mr:shape') && p.iconKey !== mrShape.value) return false
  if (mrLvlOn.value && !no('mr:lvl')) {
    const v = lineValue(LVL_LINE)(p)
    if (v === null) return false
    if (mrLvl.value.min !== '' && v < Number(mrLvl.value.min)) return false
    if (mrLvl.value.max !== '' && v > Number(mrLvl.value.max)) return false
  }
  if (mrSockOn.value && !no('mr:sock')) {
    // 소켓 줄이 없으면 0개
    const v = lineValue(SOCK_LINE)(p) ?? 0
    if (mrSock.value.min !== '' && v < Number(mrSock.value.min)) return false
    if (mrSock.value.max !== '' && v > Number(mrSock.value.max)) return false
  }
  if (mrSup.value && !no('mr:sup')) {
    // 흰 베이스라 상급 옵션 줄이 붙어 있으면 상급
    const sup = (p.options || []).some((l) => SUPERIOR_RES.some((re) => re.test(l)))
    if ((mrSup.value === '상급') !== sup) return false
    for (const [k, r] of Object.entries(mrSupVals.value)) {
      if (!r || (r.min === '' && r.max === '')) continue
      const m = SUPERIOR_MODS[k]
      const v = lineValue(new RegExp('^' + escRe(m.text).replace('\\{v\\}', '(\\d+)') + '$'))(p)
      if (v === null) return false
      if (r.min !== '' && v < Number(r.min)) return false
      if (r.max !== '' && v > Number(r.max)) return false
    }
  }
  if (mrCraft.value && !no('mr:craft')) {
    // 크래프트 제작법은 그 제작법의 고정 옵션이 전부 붙어 있는지로 봄
    const c = (magicAffixData.crafts || []).find((x) => x.name === mrCraft.value)
    if (!c) return false
    const lines = p.options || []
    if (!CRAFT_LINES(c).every((re) => lines.some((l) => re.test(l)))) return false
  }
  return true
}
// 제작법 고정 옵션의 문구 패턴 (수치는 아무 값이나)
const craftLineCache = new Map()
function CRAFT_LINES(c) {
  if (craftLineCache.has(c.name)) return craftLineCache.get(c.name)
  let res = []
  try {
    const fam = { key: 'c', slot: 'c', mods: c.mods, slotRanges: c.mods.map((m) => [m.min, m.max]), tiers: [] }
    res = familyLines(fam, fam.slotRanges.map(([lo, hi]) => (lo === hi ? lo : `${lo}~${hi}`)))
      .map((l) => new RegExp('^' + escRe(String(l)).replace(/\\d+(\\\\~\\d+)?/g, '[+-]?\\\\d+') + '$'))
  } catch { res = [] }
  craftLineCache.set(c.name, res)
  return res
}

// 유니크·세트 장신구의 모양 후보 (등록 화면과 같은 규칙 - 대표 아이콘으로 반지/목걸이/주얼 판별)
const JEWELRY_CODE = Object.fromEntries(['rin', 'amu', 'jew'].map((c) => [ICON_VARIANTS[c][0], c]))
const uniqueShapes = computed(() => {
  const it = pickedItem.value
  if (!it || !['unique', 'set'].includes(it.category)) return []
  const code = JEWELRY_CODE[it.icon_key]
  return code && ICON_VARIANTS[code] ? ICON_VARIANTS[code] : []
})
const itemShape = ref('')
watch(pickedItem, () => { itemShape.value = '' })

const itemBaseDefs = computed(() => {
  const it = pickedItem.value
  if (!it) return []
  const defs = []
  const kind = it.base_stats?.category
  const rwKinds = runewordBaseKinds.value
  if (it.category === 'runeword') {
    // 매물에 있는 베이스만 고르던 것 -> 사전의 전체 베이스 (매물이 없어도 조건을 걸 수 있게)
    // 고르는 값은 "메이지플레이트 (Mage Plate)", 판매글 줄은 "베이스: 메이지플레이트 (Mage Plate)" - 괄호 뗀 이름끼리 비교
    // (예전엔 괄호를 뗀 이름과 괄호 붙은 값을 비교해서 베이스를 고르면 매물이 하나도 안 나왔음)
    const byName = new Map(runewordBases.value.map((l) => [l.replace(/ \(.+\)$/, ''), l]))
    if (runewordBases.value.length) defs.push({ key: 'base', label: '베이스', choices: runewordBases.value, get: (p) => { const n = lineMatch(BASE_LINE)(p); return n ? byName.get(n) || n : null } })
    defs.push({ key: 'sup', label: '상급(슈페리얼) 베이스', choices: ['상급', '일반'], get: (p) => (isSuperiorPost(p, it) ? '상급' : '일반') })
    // 상급이면 붙는 수치 - 얼마나 좋은 상급인지로 거를 수 있게
    // 붙는 종류가 무기·방어구마다 달라서, 이 룬워드가 쓸 수 있는 베이스 종류에 맞는 것만
    const SUP_BY_KIND = { weapon: ['dmg%', 'att', 'dur%'], armor: ['ac%', 'dur%'] }
    const supKeys = [...new Set(rwKinds.flatMap((kk) => SUP_BY_KIND[kk] || []))]
    // 상급이면 붙는 수치 - 칸은 늘 만들어 두고, '상급만' 을 골랐을 때만 화면에 보여줌 (supOnly)
    for (const [k, m] of Object.entries(SUPERIOR_MODS).filter(([kk]) => supKeys.includes(kk))) {
      const re = new RegExp('^' + escRe(m.text).replace('\\{v\\}', '(\\d+)') + '$')
      defs.push({ key: 'sup:' + k, label: m.text.replace('{v}', `${m.min}~${m.max}`), lo: m.min, hi: m.max, supOnly: true, get: lineValue(re) })
    }
  }
  const def = uniqueDefenseRange(it, false)
  if (def) defs.push({ key: 'def', label: '기본 방어력', lo: def.min, hi: uniqueDefenseRange(it, true)?.max ?? def.max, get: lineValue(DEF_LINE) })
  else if (kind === 'armor' || rwKinds.includes('armor')) defs.push({ key: 'def', label: '기본 방어력', get: lineValue(DEF_LINE) })
  if (kind === 'weapon' || rwKinds.includes('weapon')) {
    defs.push({ key: 'dmin', label: '기본 최소 데미지', get: lineValue(DMG_LINE, 1) })
    defs.push({ key: 'dmax', label: '기본 최대 데미지', get: lineValue(DMG_LINE, 2) })
  }
  // 유니크·세트 소켓 - 원래 소켓이 붙어 나오는 아이템(시대의 왕관 등)은 그 수치를 아래 '변동 옵션'
  // 에서 받으니 여기선 빼고, 그 외에는 라르주크 퀘스트로 1개만 (큐브 소켓 레시피는 일반 등급 전용)
  if (it.category !== 'runeword' && (kind === 'armor' || kind === 'weapon')) {
    const builtin = getItemAffixes(it).some((a) => a.prop === 'sock')
    if (!builtin && (baseForItem(it)?.sockets || 0) > 0) defs.push({ key: 'sock', label: '소켓 수', lo: 0, hi: 1, get: (p) => lineValue(SOCK_LINE)(p) ?? 0 })
  }
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
// 판매글 등록과 같은 순서로 보여줌: 베이스 -> 상급 여부 -> 상급 옵션 -> 베이스 수치(방어력·데미지·소켓) -> 변동 옵션
const pickBaseDef = computed(() => itemBaseDefs.value.find((d) => d.key === 'base') || null)
const pickSupDef = computed(() => itemBaseDefs.value.find((d) => d.key === 'sup') || null)
const pickSupModDefs = computed(() => itemBaseDefs.value.filter((d) => d.supOnly))
const pickStatDefs = computed(() => itemBaseDefs.value.filter((d) => !d.supOnly && d.key !== 'base' && d.key !== 'sup'))
// 칸 이름 - 화면 사전에 있으면("기본 방어력") 그걸로, 없으면 옵션 문구 변환("방어력 +750~775")
const pkLabel = (l) => (t(l) !== l ? t(l) : affixText(l))
const SUP_CHOICES = [{ v: '', label: '전체' }, { v: '상급', label: '상급만' }, { v: '일반', label: '일반 베이스만' }]
// { [def.key]: { min, max, pick } } - 글이 새로 들어와 칸이 다시 만들어져도 입력한 값은 그대로
// (다른 아이템을 고르면 비움)
const itemRanges = ref({})
let rangesItemId = null
watch(itemVarDefs, (defs) => {
  const old = rangesItemId === pickedItem.value?.id ? itemRanges.value : {}
  rangesItemId = pickedItem.value?.id ?? null
  itemRanges.value = Object.fromEntries(defs.map((d) => [d.key, old[d.key] || { min: '', max: '', pick: '' }]))
}, { immediate: true })
const supPicked = computed(() => itemRanges.value.sup?.pick === '상급')
watch(supPicked, (on) => {
  if (on) return
  for (const k of Object.keys(itemRanges.value)) if (k.startsWith('sup:')) itemRanges.value[k] = { min: '', max: '', pick: '' }
})
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
// 범위 칸({min,max})을 칩에 적을 짧은 글 ('2~4' / '3 이상' / '40 이하')
function rangeChip(r) {
  if (!r) return ''
  if (r.min !== '' && r.max !== '') return r.min === r.max ? String(r.min) : `${r.min}~${r.max}`
  if (r.min !== '') return t('{v} 이상', { v: r.min })
  return t('{v} 이하', { v: r.max })
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

const hasActiveFilters = computed(
  () =>
    activeCats.value.length > 0 || activeLadder.value !== null || activeRegion.value !== null || activeSlot.value !== null ||
    activeHardcore.value !== null || etherealOnly.value || unidOnly.value ||
    searchQuery.value.trim() !== '' || statConditions.value.length > 0 || !!pickedItem.value
)
function resetFilters() {
  activeCats.value = []
  resetMr()
  itemShape.value = ''
  activeSlot.value = null
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

// ───────── 조건 <-> 주소 ─────────
// 조건을 전부 주소에 담아 링크 공유·새로고침·뒤로 가기가 되게 함
// (예전엔 ?item= 만 들어가서 베이스·품질·옵션 조건은 새로고침하면 날아갔음)
const SEARCH_PATH = '/trade/search'
const isSearchRoute = computed(() => /\/trade\/search\/?$/.test(route.path))
// 좁은 화면에서는 결과가 먼저 보이게 조건 칸을 접어 둠
const filtersOpen = ref(typeof window === 'undefined' || window.innerWidth >= 900)
// 범위 칸: 음수도 있어서 '~' 로 가름 ('-7~3')
const rng = (r) => (r && (r.min !== '' && r.min !== null || r.max !== '' && r.max !== null) ? `${r.min ?? ''}~${r.max ?? ''}` : '')
const unrng = (v) => { const p = String(v || '').split('~'); return p.length === 2 ? { min: p[0], max: p[1] } : { min: '', max: '' } }
const numOrNull = (v) => (v === '' || v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Number(v))

function buildQuery() {
  const q = {}
  if (pickedItem.value) q.item = pickedItem.value.id
  if (searchQuery.value.trim()) q.q = searchQuery.value.trim()
  if (activeCats.value.length) q.cat = activeCats.value.join(';')
  if (activeRegion.value) q.realm = activeRegion.value
  if (gameVersion.value) q.game = gameVersion.value
  if (activeLadder.value) q.ladder = activeLadder.value
  if (activeHardcore.value) q.hc = activeHardcore.value
  if (activeSlot.value) q.slot = activeSlot.value
  if (etherealOnly.value) q.eth = '1'
  if (unidOnly.value) q.unid = '1'
  if (mrBase.value) q.base = mrBase.value
  if (mrQuality.value) q.bq = mrQuality.value
  if (mrShape.value) q.shape = mrShape.value
  if (mrCraft.value) q.craft = mrCraft.value
  if (mrSup.value) q.sup = mrSup.value
  if (rng(mrSock.value)) q.sock = rng(mrSock.value)
  if (rng(mrLvl.value)) q.lvl = rng(mrLvl.value)
  if (itemShape.value) q.ishape = itemShape.value
  const supv = Object.entries(mrSupVals.value).filter(([, r]) => rng(r)).map(([k, r]) => `${k}|${rng(r)}`)
  if (supv.length) q.supv = supv.join(';')
  // 아이템 변동 옵션 칸은 순서(번호)로 - 문구를 그대로 넣으면 주소가 너무 길어짐
  const ir = itemVarDefs.value.map((d, i) => {
    const r = itemRanges.value[d.key]
    if (!r) return null
    if (d.choices) return r.pick ? `${i}|p:${r.pick}` : null
    return rng(r) ? `${i}|${rng(r)}` : null
  }).filter(Boolean)
  if (ir.length) q.ir = ir.join(';')
  const opt = statConditions.value.map((c) =>
    `${c.keyword ? 'k' : 's'}|${c.keyword || c.key}|${c.min ?? ''}~${c.max ?? ''}`)
  if (opt.length) q.opt = opt.join(';')
  return q
}
// 주소에 조건이 하나라도 있나 (옛 ?item= 링크로 첫 화면에 들어온 경우 검색 화면으로 넘기려고)
const QUERY_KEYS = ['item', 'q', 'cat', 'slot', 'base', 'bq', 'shape', 'craft', 'sup', 'sock', 'lvl', 'ishape', 'supv', 'ir', 'opt']
const hasQueryFilters = (q) => QUERY_KEYS.some((k) => q[k])

let syncing = false
function applyQuery(q) {
  pickedItem.value = getTradeItem(typeof q.item === 'string' ? q.item : null) || null
  searchQuery.value = typeof q.q === 'string' ? q.q : ''
  activeCats.value = q.cat ? String(q.cat).split(';').filter((c) => TRADE_CATEGORIES.includes(c)) : []
  activeRegion.value = TRADE_REALMS.includes(q.realm) ? q.realm : activeRegion.value
  gameVersion.value = GAME_VERSIONS.includes(q.game) ? q.game : gameVersion.value
  activeLadder.value = TRADE_LADDERS.includes(q.ladder) ? q.ladder : null
  activeHardcore.value = TRADE_HARDCORE.includes(q.hc) ? q.hc : null
  activeSlot.value = SLOT_ORDER.includes(q.slot) ? q.slot : null
  etherealOnly.value = q.eth === '1'
  unidOnly.value = q.unid === '1'
  mrBase.value = typeof q.base === 'string' ? q.base : ''
  mrBaseObj.value = null
  mrQuality.value = typeof q.bq === 'string' ? q.bq : ''
  mrShape.value = typeof q.shape === 'string' ? q.shape : ''
  mrCraft.value = typeof q.craft === 'string' ? q.craft : ''
  mrSup.value = typeof q.sup === 'string' ? q.sup : ''
  mrSock.value = unrng(q.sock)
  mrLvl.value = unrng(q.lvl)
  itemShape.value = typeof q.ishape === 'string' ? q.ishape : ''
  statConditions.value = String(q.opt || '').split(';').filter(Boolean).map((e) => {
    const i = e.indexOf('|'), j = e.lastIndexOf('|')
    if (i < 0 || j <= i) return null
    const kind = e.slice(0, i), id = e.slice(i + 1, j), r = unrng(e.slice(j + 1))
    const c = { min: numOrNull(r.min), max: numOrNull(r.max) }
    return kind === 'k' ? { ...c, keyword: id } : (statFilterByKey(id) ? { ...c, key: id } : null)
  }).filter(Boolean)
  // 상급 수치·아이템 변동 옵션 칸은 칸이 만들어진 다음에 (베이스·아이템에 따라 칸이 달라짐)
  nextTick(() => {
    for (const e of String(q.supv || '').split(';').filter(Boolean)) {
      const [k, r] = e.split('|')
      if (mrSupVals.value[k]) mrSupVals.value[k] = unrng(r)
    }
    for (const e of String(q.ir || '').split(';').filter(Boolean)) {
      const i = e.indexOf('|')
      const d = itemVarDefs.value[Number(e.slice(0, i))]
      if (!d || !itemRanges.value[d.key]) continue
      const v = e.slice(i + 1)
      if (v.startsWith('p:')) itemRanges.value[d.key].pick = v.slice(2)
      else itemRanges.value[d.key] = { ...itemRanges.value[d.key], ...unrng(v) }
    }
  })
}
const sameQuery = (a, b) => {
  const ka = Object.keys(a), kb = Object.keys(b).filter((k) => b[k] !== undefined && b[k] !== '')
  return ka.length === kb.length && ka.every((k) => String(a[k]) === String(b[k]))
}
// 조건이 바뀌면 주소를 맞춤 (검색 화면에서만 - 첫 화면은 주소를 깔끔하게 둠)
watch(buildQuery, (q) => {
  if (syncing || !isSearchRoute.value) return
  if (!sameQuery(q, route.query)) router.replace({ path: route.path, query: q })
}, { deep: true })
// 주소가 바뀌면(뒤로 가기·링크) 조건을 되살림
watch(() => route.fullPath, () => {
  if (syncing) return
  if (sameQuery(buildQuery(), route.query)) return
  syncing = true
  applyQuery(route.query)
  nextTick(() => { syncing = false })
})
onMounted(() => {
  if (hasQueryFilters(route.query)) {
    syncing = true
    applyQuery(route.query)
    nextTick(() => { syncing = false })
    // 옛 링크(/?item=...)로 첫 화면에 들어오면 검색 화면으로
    if (!isSearchRoute.value) router.replace({ path: SEARCH_PATH, query: route.query })
  }
})
// 칩의 × 로 아이템·베이스를 지워 조건이 하나도 안 남으면 검색 화면에 있을 이유가 없음 -> 첫 화면
function dropToHome(clear) {
  clear()
  if (!isSearchRoute.value) return
  nextTick(() => { if (!appliedCount.value) router.push('/') })
}
const dropPickedItem = () => dropToHome(clearPickedItem)
const dropMrBase = () => dropToHome(clearMrBase)

// 검색 버튼·Enter - 지금 쌓인 조건으로 결과 화면을 엶 (조건이 없으면 전체 목록)
function runSearch() {
  suggestOpen.value = false
  const q = buildQuery()
  if (isSearchRoute.value) {
    if (!sameQuery(q, route.query)) router.replace({ path: route.path, query: q })
    return
  }
  router.push({ path: SEARCH_PATH, query: q })
}
// 조건을 고르면 검색 화면으로 이동 (첫 화면에서 고른 경우)
function goSearch() {
  if (isSearchRoute.value) return
  nextTick(() => router.push({ path: SEARCH_PATH, query: buildQuery() }))
}

// 판매 기간(7일)이 끝난 글은 목록에서 내려감 - 1분마다 다시 셈
const now = useNow(60000)
// 글의 아이템 이름·가격 (영어면 사전의 영문 이름, "2개" -> "×2") - tradeI18n.js
const enCount = countText
// 한 번에 보여줄 개수 - 스크롤이 끝에 닿으면 더 불러옴 (예전엔 300개를 한 번에 다 그려서 첫 화면이 무거웠음)
const PAGE = 12
const shown = ref(PAGE)
// 조건으로 거르기. skip 에 조건 키를 주면 그 조건 하나만 빼고 셈
// (결과가 0개일 때 "무엇 때문에 0개인지" 를 알려주려고 - AND 자체는 그대로)
function filterPosts(skip) {
  const no = (k) => skip === k
  // 거래 대기(판매중)인 글만 - 예약중(거래방 진행 중)·거래완료는 아이템별 거래내역에서
  let list = tradeState.posts.filter((p) => p.status === '판매중' && saleLeftMs(p, now.value) > 0)
  if (activeCats.value.length && !no('cat')) list = list.filter((p) => activeCats.value.includes(p.category))
  if (activeRegion.value && !no('realm')) list = list.filter((p) => p.realm === activeRegion.value)
  if (gameVersion.value && !no('game')) list = list.filter((p) => p.gameVersion === gameVersion.value)
  if (activeSlot.value && !no('slot')) list = list.filter((p) => postSlot(p) === activeSlot.value)
  if (activeLadder.value && !no('ladder')) list = list.filter((p) => p.ladder === activeLadder.value)
  if (activeHardcore.value && !no('hc')) list = list.filter((p) => p.hardcore === activeHardcore.value)
  if (etherealOnly.value && !no('eth')) list = list.filter((p) => p.ethereal)
  if (unidOnly.value && !no('unid')) list = list.filter((p) => p.unidentified)
  if (pickedItem.value && !no('item')) {
    list = list.filter((p) => p.itemId === pickedItem.value.id)
    for (const d of activeItemRanges.value) if (!no('ir:' + d.key)) list = list.filter((p) => itemRangeMatches(p, d))
  }
  const q = no('q') ? '' : searchQuery.value.trim()
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
  if (mrOn.value && mrCount.value) list = list.filter((p) => mrMatches(p, skip))
  // 유니크·세트 장신구 모양 - 판매자가 안 고른 글은 그 아이템의 대표 모양으로 봄
  if (pickedItem.value && itemShape.value && !no('item') && !no('ishape')) {
    const first = uniqueShapes.value[0]
    list = list.filter((p) => (p.iconKey || first) === itemShape.value)
  }
  statConditions.value.forEach((c, i) => { if (!no('opt:' + i)) list = list.filter((p) => condMatches(p, c)) })
  return [...list].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}
const filteredPosts = computed(() => filterPosts(null))

// 결과가 0개일 때, 조건을 하나씩 빼보고 몇 개가 되는지 (많이 나오는 순서로 최대 4개)
// 어느 조건이 0개로 만들었는지 바로 보이고, 눌러서 그 조건만 뺄 수 있음
const dropHints = computed(() => {
  if (filteredPosts.value.length || !appliedCount.value) return []
  const c = []
  if (activeCats.value.length) c.push({ key: 'cat', label: t('종류') + ' ' + activeCats.value.map((x) => t(x)).join('·'), drop: () => { activeCats.value = [] } })
  if (activeRegion.value) c.push({ key: 'realm', label: t(activeRegion.value), drop: () => { activeRegion.value = null } })
  if (gameVersion.value) c.push({ key: 'game', label: t(gameVersion.value), drop: () => { gameVersion.value = null } })
  if (activeLadder.value) c.push({ key: 'ladder', label: t(activeLadder.value), drop: () => { activeLadder.value = null } })
  if (activeHardcore.value) c.push({ key: 'hc', label: t(activeHardcore.value), drop: () => { activeHardcore.value = null } })
  if (etherealOnly.value) c.push({ key: 'eth', label: t('에테리얼'), drop: () => { etherealOnly.value = false } })
  if (unidOnly.value) c.push({ key: 'unid', label: t('미확인'), drop: () => { unidOnly.value = false } })
  if (pickedItem.value) c.push({ key: 'item', label: itemName(pickedItem.value), drop: clearPickedItem })
  if (searchQuery.value.trim()) c.push({ key: 'q', label: '"' + searchQuery.value.trim() + '"', drop: () => { searchQuery.value = '' } })
  if (mrOn.value) {
    if (mrQuality.value) c.push({ key: 'mr:quality', label: t(QUALITY_PICKS.find((q) => q.v === mrQuality.value)?.label || mrQuality.value), drop: () => { mrQuality.value = '' } })
    if (mrShape.value) c.push({ key: 'mr:shape', label: t('모양'), drop: () => { mrShape.value = '' } })
    if (mrCraft.value) c.push({ key: 'mr:craft', label: t(mrCraft.value), drop: () => { mrCraft.value = '' } })
    if (mrSup.value) c.push({ key: 'mr:sup', label: t('상급 여부'), drop: () => { mrSup.value = '' } })
    if (mrSockOn.value) c.push({ key: 'mr:sock', label: t('소켓 수') + ' ' + rangeChip(mrSock.value), drop: () => { mrSock.value = { min: '', max: '' } } })
    if (mrLvlOn.value) c.push({ key: 'mr:lvl', label: t('요구 레벨') + ' ' + rangeChip(mrLvl.value), drop: () => { mrLvl.value = { min: '', max: '' } } })
  }
  for (const d of activeItemRanges.value) {
    c.push({ key: 'ir:' + d.key, label: pkLabel(d.label), drop: () => { itemRanges.value[d.key] = { min: '', max: '', pick: '' } } })
  }
  statConditions.value.forEach((x, i) => c.push({ key: 'opt:' + i, label: statLabel(x) + rangeText(x), drop: () => removeStat(i) }))
  return c.map((x) => ({ ...x, n: filterPosts(x.key).length })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n).slice(0, 4)
})

// 글자로 검색해 들어온 화면에서는 그 글자에 맞는 사전 아이템을 먼저 보여줌
// (예: '탈라샤' -> 탈 라샤 세트 전부. 고르면 그 아이템 매물만 + 왼쪽에 조건 칸)
const textItems = computed(() => {
  if (!isSearchRoute.value || pickedItem.value || mrOn.value) return []
  const q = searchQuery.value.trim().replace(JAMO_TAIL, '')
  if (!q) return []
  return PICKABLE.filter((it) => itemMatchesQuery(it, q)).slice(0, 24)
})

// ───────── 첫 화면(거래 모드) 검색 ─────────
// 큰 검색창 하나에 치면 아이템·종류·옵션 후보가 같이 뜸 -> 고르면 검색창 아래 "적용된 조건" 줄로 내려감
// (검색창 안에는 글자만 - 조건이 늘어도 입력칸이 안 밀리고, 옵션 수치는 칩의 ✎ 로 그 자리에서 고침)

// 서버·게임·래더·모드 고르기 (검색창 아래 한 줄 드롭다운) - 고른 값은 거기서 바로 보이니 '적용된 조건' 칩은 안 만듦
// 종류는 여러 개 고를 수 있지만(activeCats) 선택칸은 하나만 - 비우면 전체
const catPick = computed({
  get: () => activeCats.value[0] || null,
  set: (v) => { activeCats.value = v ? [v] : [] },
})
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
  for (const b of baseCandidates.value) out.push({ type: 'base', key: 'b' + b.code, b })
  for (const c of TRADE_CATEGORIES) if (squash(c).includes(q)) out.push({ type: 'cat', key: 'c' + c, c })
  // 한국어 이름·음차 별칭(데스 센트리)·영어 이름 어느 걸로 쳐도 찾음
  const ql = q.toLowerCase()
  const hitOf = (st) => statSearchTexts(st).map((x) => squash(x).toLowerCase()).find((x) => x.includes(ql))
  const stats = STAT_PICKS.map((st) => ({ st, hit: hitOf(st) })).filter((x) => x.hit)
  // 검색어로 시작하는 옵션을 위로 ("저항" -> "저항 ..." 이 "모든 저항"보다 먼저가 아니라, 짧은 것부터)
  // 같은 이름이면 [모든 직업] -> 직업 전용 순서로 붙어 나오게
  // 같은 스킬이라도 본체('눈보라 +X')를 충전·확률 시전 같은 곁가지보다 먼저 보여줌
  const form = (st) => (/\(충전/.test(st.label) ? 1 : /확률로 .* 시전$/.test(st.label) ? 2 : 0)
  stats.sort((a, b) =>
    (b.hit.startsWith(ql) - a.hit.startsWith(ql)) || (form(a.st) - form(b.st)) ||
    a.hit.length - b.hit.length || (!!a.st.cls - !!b.st.cls))
  for (const { st } of stats.slice(0, 12)) out.push({ type: 'stat', key: 's' + st.key, st })
  out.push({ type: 'text', key: 'text', raw })
  return out.slice(0, 20)
})
const suggestGroups = computed(() => {
  const list = unifiedSuggestions.value
  const groups = [
    { name: '아이템', cls: 'g-item', rows: [] }, { name: '매직·레어·크래프트 (베이스)', cls: 'g-base', rows: [] }, { name: '종류', cls: 'g-cat', rows: [] },
    { name: '옵션', cls: 'g-stat', rows: [] }, { name: '글자로 찾기', cls: 'g-text', rows: [] },
  ]
  const at = { item: 0, base: 1, cat: 2, stat: 3, text: 4, kw: 4 }
  list.forEach((sug, i) => groups[at[sug.type]].rows.push({ sug, i }))
  return groups.filter((g) => g.rows.length)
})
function chooseSuggestion(sug) {
  suggestPointer = false
  if (sug.type === 'item') return pickItem(sug.it)
  if (sug.type === 'base') return pickBase(sug.b)
  if (sug.type === 'text') { suggestOpen.value = false; goSearch(); return }
  if (sug.type === 'cat') { toggleCat(sug.c, true); searchQuery.value = ''; suggestOpen.value = false; goSearch(); return }
  // 옵션은 쌓아두기만 - 첫 화면에서 더 넣거나 지우고 '검색' 을 눌렀을 때 결과 화면으로 감
  if (sug.type === 'stat') addStatKey(sug.st.key, true)
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

// 지금 검색 조건 그대로 삽니다 글 쓰기 (맞는 매물이 올라오면 알림) - 아이템이나 옵션 조건이 있을 때만
const wantLink = computed(() => {
  const conds = statConditions.value.filter((c) => !c.keyword).map((c) => ({ key: c.key, min: c.min, max: c.max }))
  const cat = !pickedItem.value && activeCats.value.length === 1 && activeCats.value[0] !== '골드' ? activeCats.value[0] : null
  if (!pickedItem.value && !(cat && conds.length) && !conds.length) return null
  const query = { new: '1' }
  if (pickedItem.value) query.item = pickedItem.value.id
  else if (cat) query.cat = cat
  if (conds.length) query.conds = JSON.stringify(conds)
  if (activeRegion.value) query.realm = activeRegion.value
  if (activeLadder.value) query.ladder = activeLadder.value
  if (activeHardcore.value) query.hc = activeHardcore.value
  if (gameVersion.value) query.game = gameVersion.value
  if (etherealOnly.value) query.eth = '1'
  return { path: '/trade/wants', query }
})
const pickedWantCount = ref(0)
watch(pickedItem, async (it) => { pickedWantCount.value = 0; if (it) pickedWantCount.value = await countWantsForItem(it.id) }, { immediate: true })

const appliedCount = computed(() =>
  activeCats.value.length + (pickedItem.value ? 1 : 0) + statConditions.value.length + mrCount.value + (itemShape.value ? 1 : 0) + (searchQuery.value.trim() && !suggestOpen.value ? 1 : 0)
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
  <div class="items-page trade-page" :class="{ searching: isSearchRoute }">

  <section class="tr-hero">
    <div class="tr-hero-inner">
      <template v-if="!isSearchRoute">
        <h1>{{ $t('디아블로 2 레저렉션 거래소') }}</h1>
        <p class="tr-hero-sub">{{ $t('유니크 · 룬워드 · 룬부터 옵션 수치까지, 한 번에 검색') }}</p>
      </template>
      <div class="tr-back" v-else>
        <router-link to="/">← {{ $t('전체 매물') }}</router-link>
        <h1 class="tr-back-title">{{ $t('매물 검색') }}</h1>
      </div>

      <form class="tr-search" role="search" @submit.prevent="runSearch()">
        <div class="tr-search-box">
          <input
            ref="searchEl" type="search" :value="searchQuery" @input="onSearchInput" @keydown="onSearchKey" @focus="suggestOpen = true" @blur="closeSuggestSoon"
            :placeholder="pickedItem ? $t('옵션·내용으로 더 좁히기') : $t('아이템 이름 · 종류 · 옵션 (예: 할리퀸 관모, 룬워드, 시전 속도)')"
            :aria-label="$t('매물 검색')" autocomplete="off" role="combobox" :aria-expanded="suggestOpen && unifiedSuggestions.length > 0" aria-controls="tr-suggest"
          />
          <div class="tr-suggest" id="tr-suggest" role="listbox" v-if="suggestOpen && unifiedSuggestions.length">
            <div class="tr-suggest-group" v-for="g in suggestGroups" :key="g.name" :class="g.cls">
              <div class="tr-suggest-title">{{ $t(g.name) }}</div>
              <button
                type="button" role="option" v-for="r in g.rows" :key="r.sug.key" class="tr-suggest-row" :class="{ active: suggestNav && r.i === suggestActive }"
                :aria-selected="r.i === suggestActive" @mousedown.prevent @click="chooseSuggestion(r.sug)" @mousemove="suggestActive = r.i; suggestNav = true"
              >
                <template v-if="r.sug.type === 'item'">
                  <span class="item-suggest-icon" :class="r.sug.it.category"><img v-if="iconUrlFor(r.sug.it.icon_key)" :src="iconUrlFor(r.sug.it.icon_key)" alt="" /></span>
                  <span class="item-suggest-name" :class="r.sug.it.category">{{ $itemName(r.sug.it) }}</span>
                  <small>{{ $t(r.sug.it.category_label) }}{{ locale === 'ko' && r.sug.it.subtitle && r.sug.it.category !== 'runeword' ? ' · ' + r.sug.it.subtitle : '' }}</small>
                </template>
                <template v-else-if="r.sug.type === 'base'">
                  <span class="item-suggest-icon"><img v-if="iconUrlFor(baseIconKey(r.sug.b))" :src="iconUrlFor(baseIconKey(r.sug.b))" alt="" /></span>
                  <span class="item-suggest-name">{{ baseLabelOf(r.sug.b) }}</span>
                  <span class="base-q-chips">
                    <button
                      type="button" v-for="q in baseQualities(r.sug.b)" :key="q" :class="'q-' + q"
                      @mousedown.prevent.stop @click.stop="pickBase(r.sug.b, q)"
                    >{{ $t(QUALITY_SHORT[q]) }}</button>
                  </span>
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
        <span class="tr-chip item" v-if="mrBase"><em>{{ $t('베이스') }}</em>{{ mrBaseText }}<button type="button" :aria-label="`${mrBaseText} ×`" @click="dropMrBase">×</button></span>
        <span class="tr-chip flag" v-if="mrOn && mrQuality"><em>{{ $t('품질') }}</em>{{ $t(QUALITY_PICKS.find((q) => q.v === mrQuality)?.label || mrQuality) }}<button type="button" aria-label="×" @click="mrQuality = ''">×</button></span>
        <span class="tr-chip flag" v-if="mrOn && mrCraft"><em>{{ $t('제작법') }}</em>{{ $t(mrCraft) }}<button type="button" aria-label="×" @click="mrCraft = ''">×</button></span>
        <span class="tr-chip flag" v-if="mrOn && mrShape"><em>{{ $t('모양') }}</em><img class="chip-shape" v-if="iconUrlFor(mrShape)" :src="iconUrlFor(mrShape)" alt="" /><button type="button" aria-label="×" @click="mrShape = ''">×</button></span>
        <span class="tr-chip flag" v-if="mrOn && mrSup"><em>{{ $t('상급 여부') }}</em>{{ $t(SUP_CHOICES.find((c) => c.v === mrSup)?.label || mrSup) }}<button type="button" aria-label="×" @click="mrSup = ''">×</button></span>
        <span class="tr-chip flag" v-if="mrOn && mrSockOn"><em>{{ $t('소켓 수') }}</em>{{ rangeChip(mrSock) }}<button type="button" aria-label="×" @click="mrSock = { min: '', max: '' }">×</button></span>
        <span class="tr-chip flag" v-if="mrOn && mrLvlOn"><em>{{ $t('요구 레벨') }}</em>{{ rangeChip(mrLvl) }}<button type="button" aria-label="×" @click="mrLvl = { min: '', max: '' }">×</button></span>
        <span class="tr-chip item" v-if="pickedItem" :class="pickedItem.category"><em>{{ locale === 'ko' ? '아이템' : $t('아이템 지정') }}</em>{{ $itemName(pickedItem) }}<button type="button" :aria-label="`${$itemName(pickedItem)} ×`" @click="dropPickedItem">×</button></span>
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
        <button type="button" class="tr-go" v-if="!isSearchRoute" @click="runSearch()">{{ $t('검색') }} →</button>
        <button type="button" class="tr-clear" @click="resetFilters(); editIdx = -1">{{ $t('모두 지우기') }}</button>
      </div>

      <!-- 서버·게임·래더·모드는 한 줄 드롭다운 (고른 값은 금색), 에테리얼·미확인은 켜고 끄는 버튼 -->
      <div class="tr-quick">
        <label class="tr-pill" v-for="f in QUICK_SELECTS" :key="f.label" :class="{ on: f.ref.value }">
          <span class="tr-pill-cap">{{ $t(f.label) }}</span>
          <span class="tr-pill-val">{{ f.ref.value ? $t(f.ref.value) : $t('전체') }}</span>
          <!-- 고르는 칸은 알약 전체를 덮는 투명 select - 알약 어디를 눌러도 목록이 열림 -->
          <select :value="f.ref.value || ''" @change="f.ref.value = $event.target.value || null" :aria-label="$t(f.label)">
            <option value="">{{ $t('전체') }}</option>
            <option v-for="o in f.options" :key="o" :value="o">{{ $t(o) }}</option>
          </select>
        </label>
        <button type="button" class="tr-toggle eth" :class="{ on: etherealOnly }" :aria-pressed="etherealOnly" @click="etherealOnly = !etherealOnly">{{ $t('에테리얼') }}</button>
        <button type="button" class="tr-toggle unid" :class="{ on: unidOnly }" :aria-pressed="unidOnly" @click="unidOnly = !unidOnly">{{ $t('미확인') }}</button>
      </div>
    </div>
  </section>

  <div class="tr-body">
  <aside class="tr-filters" v-if="isSearchRoute && (mrOn || pickedItem)" :class="{ closed: !filtersOpen }">
    <button type="button" class="tr-filters-toggle" @click="filtersOpen = !filtersOpen">
      {{ filtersOpen ? $t('조건 접기') : $t('조건 펴기') }}
    </button>
    <div class="tr-filters-body">
      <!-- 사전에 없는 아이템(매직/레어/크래프트/일반): 판매글 등록에서 고르는 것과 같은 칸 -->
      <div class="item-range-panel mr-panel" v-if="mrOn">
        <div class="mr-head">
          <span class="mr-head-icon"><img v-if="mrBaseItem && iconUrlFor(baseIconKey(mrBaseItem))" :src="iconUrlFor(baseIconKey(mrBaseItem))" alt="" /></span>
          <div class="mr-head-text">
            <b>{{ mrBaseText }}</b>
            <span>{{ $t('비워두면 상관없음 · 값을 넣으면 그 값을 적은 글만') }}</span>
          </div>
          <button type="button" class="mr-change" @click="clearMrBase(); focusSearch()">{{ $t('다른 베이스') }}</button>
        </div>
        <!-- 이름 칸 너비를 맞춰서 줄마다 같은 자리에서 시작 -->
        <div class="mr-grid">
          <span class="mr-label" :class="{ on: mrQuality }">{{ $t('품질') }}</span>
          <span class="mr-seg">
            <button type="button" :class="{ on: !mrQuality }" :aria-pressed="!mrQuality" @click="mrQuality = ''">{{ $t('전체') }}</button>
            <button
              type="button" v-for="q in mrQualityPicks" :key="q.v" :class="['q-' + q.v, { on: mrQuality === q.v }]"
              :aria-pressed="mrQuality === q.v" @click="mrQuality = mrQuality === q.v ? '' : q.v"
            >{{ $t(q.label) }}</button>
          </span>
          <span></span><p class="mr-hint">{{ $t(QUALITY_HINT[mrQuality] || QUALITY_HINT['']) }}</p>


          <template v-if="mrShapeChoices.length">
            <span class="mr-label" :class="{ on: mrShape }">{{ $t('모양') }}</span>
            <span class="mr-shapes">
              <button
                type="button" class="mr-shape" :class="{ on: !mrShape }" :aria-pressed="!mrShape"
                :title="$t('전체')" @click="mrShape = ''"
              >{{ $t('전체') }}</button>
              <button
                type="button" class="mr-shape img" v-for="k in mrShapeChoices" :key="k"
                :class="{ on: mrShape === k }" :aria-pressed="mrShape === k" @click="mrShape = mrShape === k ? '' : k"
              ><img v-if="iconUrlFor(k)" :src="iconUrlFor(k)" alt="" /></button>
            </span>
          </template>

          <template v-if="mrQuality === 'crafted'">
            <span class="mr-label top" :class="{ on: mrCraft }">{{ $t('제작법') }}</span>
            <div class="mr-crafts" v-if="mrCraftCards.length">
              <button
                type="button" class="mr-craft" v-for="c in mrCraftCards" :key="c.name" :class="{ on: mrCraft === c.name }"
                :aria-pressed="mrCraft === c.name" @click="mrCraft = mrCraft === c.name ? '' : c.name"
              >
                <b>{{ $t(c.name) }}</b>
                <span v-for="(l, i) in c.lines" :key="i">{{ $affix(l) }}</span>
              </button>
            </div>
            <p class="mr-hint" v-else>{{ $t('이 베이스로 만드는 크래프트 제작법이 없음') }}</p>
          </template>

          <template v-if="mrSupCombos.length">
            <span class="mr-label" :class="{ on: mrSup }">{{ $t('상급 여부') }}</span>
            <span class="mr-seg">
              <button
                type="button" v-for="c in SUP_CHOICES" :key="c.v" :class="{ on: mrSup === c.v }"
                :aria-pressed="mrSup === c.v" @click="mrSup = c.v"
              >{{ $t(c.label) }}</button>
            </span>
          </template>

          <template v-if="mrSup === '상급' && mrSupMods.length">
            <span class="mr-label top on">{{ $t('상급 옵션') }}</span>
            <div class="pk-rows">
              <div class="pk-row" v-for="k in mrSupMods" :key="k" :class="{ on: mrSupVals[k] && (mrSupVals[k].min !== '' || mrSupVals[k].max !== '') }">
                <span class="pk-name">{{ $affix(SUPERIOR_MODS[k].text.replace('{v}', SUPERIOR_MODS[k].min + '~' + SUPERIOR_MODS[k].max)) }}</span>
                <RangeInput v-model="mrSupVals[k].min" :min="SUPERIOR_MODS[k].min" :max="SUPERIOR_MODS[k].max" :label="$t('최소')" />
                <span class="mr-sep">~</span>
                <RangeInput v-model="mrSupVals[k].max" :min="SUPERIOR_MODS[k].min" :max="SUPERIOR_MODS[k].max" :label="$t('최대')" />
              </div>
            </div>
          </template>

          <template v-if="mrSockMax">
            <span class="mr-label" :class="{ on: mrSockOn }">{{ $t('소켓 수') }}</span>
            <div class="pk-rows">
              <div class="pk-row" :class="{ on: mrSockOn }">
                <span class="pk-name">0~{{ mrSockMax }}</span>
                <RangeInput v-model="mrSock.min" :min="0" :max="mrSockMax" :label="`${$t('소켓 수')} ${$t('최소')}`" />
                <span class="mr-sep">~</span>
                <RangeInput v-model="mrSock.max" :min="0" :max="mrSockMax" :label="`${$t('소켓 수')} ${$t('최대')}`" />
              </div>
            </div>
          </template>

          <template v-if="mrLvlShow">
            <span class="mr-label" :class="{ on: mrLvlOn }">{{ $t('요구 레벨') }}</span>
            <div class="pk-rows">
              <div class="pk-row" :class="{ on: mrLvlOn }">
                <span class="pk-name">1~99</span>
                <RangeInput v-model="mrLvl.min" :min="1" :max="99" :label="`${$t('요구 레벨')} ${$t('최소')}`" />
                <span class="mr-sep">~</span>
                <RangeInput v-model="mrLvl.max" :min="1" :max="99" :label="`${$t('요구 레벨')} ${$t('최대')}`" />
              </div>
            </div>
          </template>

          <template v-if="mrQuality !== 'normal' || mrOptStats.length">
          <span class="mr-label top" :class="{ on: statConditions.length }">{{ $t('옵션') }}</span>
          <div class="mr-opts">
            <!-- 고른 옵션 - 수치 범위를 바로 적음 -->
            <div class="mr-cond" v-for="(c, i) in statConditions" :key="'mc' + condId(c)">
              <span class="mr-cond-name">{{ statLabel(c) }}<small class="mr-cond-range" v-if="condRange(c)">{{ condRange(c)[0] === condRange(c)[1] ? condRange(c)[0] : `${condRange(c)[0]}~${condRange(c)[1]}` }}</small></span>
              <span class="stat-tag" v-if="statTag(c)" :style="{ '--tag': statTag(c).color }">{{ statTag(c).text }}</span>
              <input type="number" :value="c.min ?? ''" @input="setCondMin(c, $event.target.value)" :placeholder="condRange(c) ? `${$t('최소')} ${condRange(c)[0]}` : $t('최소')" :aria-label="`${statLabel(c)} ${$t('최소')}`" />
              <span class="mr-sep">~</span>
              <input type="number" :value="c.max ?? ''" @input="setCondMax(c, $event.target.value)" :placeholder="condRange(c) ? `${$t('최대')} ${condRange(c)[1]}` : $t('최대')" :aria-label="`${statLabel(c)} ${$t('최대')}`" />
              <button type="button" class="mr-x" :aria-label="`${statLabel(c)} ×`" @click="removeStat(i)">×</button>
            </div>
            <input
              :value="mrOptQuery" @input="mrOptQuery = $event.target.value" class="mr-opt-input" type="search" autocomplete="off"
              :placeholder="$t('옵션 찾기 (예: 모든 기술, 시전 속도, 생명력)')" :aria-label="$t('옵션 찾기')"
            />
            <div class="mr-opt-chips">
              <button
                type="button" class="mr-opt" v-for="st in (mrOptQuery || mrOptMore ? mrOptHits : mrOptHits.slice(0, MR_OPT_SHOW))" :key="st.key"
                @click="addMrOpt(st)"
                :class="{ fixed: mrOptInfo.fixed.has(st.key) }"
              >+ {{ statParts(st).name }}<em class="mr-fixed" v-if="mrOptInfo.fixed.has(st.key)">{{ $t('고정') }}</em><span class="stat-tag" v-if="chipTag(st)" :style="{ '--tag': chipTag(st).color }">{{ chipTag(st).text }}</span></button>
              <button type="button" class="mr-opt more" v-if="!mrOptQuery && mrOptHits.length > MR_OPT_SHOW" @click="mrOptMore = !mrOptMore">
                {{ mrOptMore ? $t('접기') : $t('{n}개 더 보기', { n: mrOptHits.length - MR_OPT_SHOW }) }}
              </button>
              <span class="mr-opt-none" v-if="mrOptQuery && !mrOptHits.length">{{ $t('맞는 옵션 없음') }}</span>
            </div>
            <p class="mr-opt-help" v-if="mrOptStats.length">{{ $t('이 베이스에 붙을 수 있는 옵션만 보여줌 · 품질을 고르면 더 좁혀짐') }}</p>
          </div>
          </template>
        </div>
      </div>

      <div class="item-range-panel mr-panel" v-if="pickedItem">
        <div class="mr-head">
          <span class="mr-head-icon" :class="pickedItem.category"><img v-if="iconUrlFor(pickedItem.icon_key)" :src="iconUrlFor(pickedItem.icon_key)" alt="" /></span>
          <div class="mr-head-text">
            <b :class="pickedItem.category">{{ $itemName(pickedItem) }}</b>
            <span>{{ $t('비워두면 상관없음 · 값을 넣으면 그 값을 적은 글만') }}</span>
          </div>
          <button type="button" class="mr-change" @click="clearPickedItem(); focusSearch()">{{ $t('다른 아이템') }}</button>
        </div>
        <!-- 판매글 등록과 같은 순서: 베이스 -> 상급 -> 상급 옵션 -> 베이스 수치 -> 변동 옵션 -->
        <div class="mr-grid">
          <template v-if="uniqueShapes.length">
            <span class="mr-label" :class="{ on: itemShape }">{{ $t('모양') }}</span>
            <span class="mr-shapes">
              <button type="button" class="mr-shape" :class="{ on: !itemShape }" :aria-pressed="!itemShape" @click="itemShape = ''">{{ $t('전체') }}</button>
              <button
                type="button" class="mr-shape img" v-for="k in uniqueShapes" :key="k"
                :class="{ on: itemShape === k }" :aria-pressed="itemShape === k" @click="itemShape = itemShape === k ? '' : k"
              ><img v-if="iconUrlFor(k)" :src="iconUrlFor(k)" alt="" /></button>
            </span>
          </template>

          <template v-if="pickBaseDef && itemRanges.base">
            <span class="mr-label" :class="{ on: itemRanges.base.pick }">{{ $t('베이스') }}</span>
            <SearchSelect v-model="itemRanges.base.pick" :options="pickBaseDef.choices" :label="$t('베이스')" class="mr-field" />
          </template>

          <template v-if="pickSupDef && itemRanges.sup">
            <span class="mr-label" :class="{ on: itemRanges.sup.pick }">{{ $t('상급 여부') }}</span>
            <span class="mr-seg">
              <button
                type="button" v-for="c in SUP_CHOICES" :key="c.v" :class="{ on: itemRanges.sup.pick === c.v }"
                :aria-pressed="itemRanges.sup.pick === c.v" @click="itemRanges.sup.pick = c.v"
              >{{ $t(c.label) }}</button>
            </span>
          </template>

          <template v-if="supPicked && pickSupModDefs.length">
            <span class="mr-label top on">{{ $t('상급 옵션') }}</span>
            <div class="pk-rows">
              <div class="pk-row" v-for="d in pickSupModDefs" :key="d.key" :class="{ on: activeItemRanges.includes(d) }">
                <span class="pk-name">{{ pkLabel(d.label) }}</span>
                <RangeInput v-model="itemRanges[d.key].min" :min="d.lo" :max="d.hi" :label="`${d.label} ${$t('최소')}`" />
                <span class="mr-sep">~</span>
                <RangeInput v-model="itemRanges[d.key].max" :min="d.lo" :max="d.hi" :label="`${d.label} ${$t('최대')}`" />
              </div>
            </div>
          </template>

          <template v-for="g in [{ label: '베이스 수치', defs: pickStatDefs }, { label: '변동 옵션', defs: itemOptionDefs }]" :key="g.label">
            <template v-if="g.defs.length">
              <span class="mr-label top" :class="{ on: g.defs.some((d) => activeItemRanges.includes(d)) }">{{ $t(g.label) }}</span>
              <div class="pk-rows">
                <div class="pk-row" v-for="d in g.defs" :key="d.key" :class="{ on: activeItemRanges.includes(d) }">
                  <span class="pk-name">{{ pkLabel(d.label) }}</span>
                  <select v-if="d.choices" v-model="itemRanges[d.key].pick" class="sort-select" :aria-label="d.label">
                    <option value="">{{ $t('전체') }}</option>
                    <option v-for="c in d.choices" :key="c" :value="c">{{ $t(c) }}</option>
                  </select>
                  <!-- 수치는 그 옵션에서 나올 수 있는 범위 안으로 (칸을 벗어나면 범위 끝으로) -->
                  <template v-else-if="d.lo !== undefined && d.hi !== undefined">
                    <RangeInput v-model="itemRanges[d.key].min" :min="d.lo" :max="d.hi" :label="`${d.label} ${$t('최소')}`" />
                    <span class="mr-sep">~</span>
                    <RangeInput v-model="itemRanges[d.key].max" :min="d.lo" :max="d.hi" :label="`${d.label} ${$t('최대')}`" />
                  </template>
                  <template v-else>
                    <input type="number" class="pk-num" v-model="itemRanges[d.key].min" :placeholder="$t('최소')" :aria-label="`${d.label} ${$t('최소')}`" />
                    <span class="mr-sep">~</span>
                    <input type="number" class="pk-num" v-model="itemRanges[d.key].max" :placeholder="$t('최대')" :aria-label="`${d.label} ${$t('최대')}`" />
                  </template>
                </div>
              </div>
            </template>
          </template>
        </div>
        <div class="item-range-empty" v-if="!itemVarDefs.length && !uniqueShapes.length">{{ $t('변동 옵션 없음 (옵션이 고정된 아이템)') }}</div>
      </div>
    </div>
  </aside>
  <div class="tr-main">
    <!-- 이벤트 진행 중이면 큰 카드 (없으면 빈 칸이 안 생기게 :empty) -->
    <div class="trade-event-slot"><EventBanner mode="big" /></div>
    <!-- 첫 화면: 매물 목록 대신 몇 개 올라와 있는지와 전체 보기 -->
    <div class="tr-home-cta" v-if="!isSearchRoute">
      <button type="button" class="tr-all-btn" @click="runSearch()">
        <template v-if="appliedCount">
          <b>{{ $t('조건 {n}개로 검색', { n: appliedCount }) }}</b>
          <span>{{ $t('결과 {n}개', { n: filteredPosts.length }) }} →</span>
        </template>
        <template v-else>
          <b>{{ $t('현재 매물 {n}개', { n: filteredPosts.length }) }}</b>
          <span>{{ $t('전체 보기') }} →</span>
        </template>
      </button>
      <div class="tr-home-links">
        <button type="button" class="guide-btn" @click="openTradeGuide()">{{ $t('이용 안내') }}</button>
        <router-link class="quality-toggle" to="/trade/new">+ {{ $t('판매글 등록') }}</router-link>
      </div>
    </div>

    <template v-if="isSearchRoute">
    <!-- 글자로 찾아 들어온 경우: 그 글자에 맞는 아이템을 먼저, 고르면 그 아이템 매물만 -->
    <div class="tr-textitems" v-if="textItems.length">
      <div class="tr-ti-head">{{ $t('"{q}" 아이템', { q: searchQuery.trim() }) }} <b>{{ textItems.length }}</b>{{ $t('개') }}
        <span>{{ $t('고르면 그 아이템 매물만') }}</span></div>
      <div class="tr-ti-grid">
        <button type="button" class="tr-ti" v-for="it in textItems" :key="it.id" @click="pickItem(it)">
          <span class="tr-ti-icon" :class="it.category"><img v-if="iconUrlFor(it.icon_key)" :src="iconUrlFor(it.icon_key)" alt="" /></span>
          <span class="tr-ti-name" :class="it.category">{{ $itemName(it) }}</span>
          <small>{{ $t(it.category_label) }}</small>
        </button>
      </div>
    </div>
    <div class="tr-results-head">
      <h2>{{ appliedCount ? $t('검색 결과') : $t('전체 매물') }} <span>{{ filteredPosts.length }}</span>{{ $t('개') }}</h2>
      <span class="tr-results-note">{{ $t('판매중만 · 끝난 거래는') }} <router-link to="/trade/history">{{ $t('거래내역') }}</router-link></span>
      <router-link v-if="wantLink" class="want-cta" :to="wantLink">🔔 {{ $t('이 조건으로 알림 받기') }}</router-link>
      <router-link v-if="pickedItem && pickedWantCount" class="want-count" :to="{ path: '/trade/wants', query: { q: pickedItem.name_ko } }">{{ $t('구하는 사람 {n}명', { n: pickedWantCount }) }}</router-link>
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
            <span class="trade-when">{{ agoText(p) }}</span>
          </div>
          <div class="trade-meta">
            {{ enCount(p.amountLabel) }} ·
            <template v-for="(t, i) in parsePriceTokens(p.price)" :key="i">
              <span class="price-icon" v-if="t.item"><img v-if="iconUrlFor(t.item.icon_key)" :src="iconUrlFor(t.item.icon_key)" alt="" /></span>{{ priceTok(t) }}
            </template>
          </div>
          <!-- 서버·래더·모드·에테리얼·미확인 - 옵션보다 위에, 색으로 구분 -->
          <div class="trade-flags">
            <span class="tf realm">{{ $t(p.realm) }}</span>
            <span class="tf" :class="p.ladder === '레더' ? 'ladder' : 'nonladder'">{{ $t(p.ladder) }}</span>
            <span class="tf" :class="p.hardcore === '하드코어' ? 'hardcore' : 'softcore'">{{ $t(p.hardcore) }}</span>
            <span class="tf eth" v-if="p.ethereal">{{ $t('에테리얼') }}</span>
            <span class="tf unid" v-if="p.unidentified">{{ $t('미확인') }}</span>
          </div>
          <div class="trade-opts lines" v-if="variantLines(p).length">
            <span class="trade-opt" v-for="(l, i) in variantLines(p)" :key="i"><template v-for="(q, j) in optParts($affix(l))" :key="j"><b v-if="q.num">{{ q.x }}</b><template v-else>{{ q.x }}</template></template></span>
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
      <div class="empty-state" v-else-if="filteredPosts.length === 0">
        {{ appliedCount ? $t('조건에 맞는 매물 없음') : $t('판매중인 글 없음') }}
        <div class="empty-drop" v-if="dropHints.length">
          <span>{{ $t('조건 하나를 빼면') }}</span>
          <button type="button" v-for="h in dropHints" :key="h.key" @click="h.drop()">{{ h.label }} <em>{{ $t('빼면 {n}개', { n: h.n }) }}</em></button>
        </div>
        <button type="button" class="empty-clear" v-if="appliedCount" @click="resetFilters()">{{ $t('모두 지우기') }}</button>
        <router-link v-if="wantLink" class="want-cta big" :to="wantLink">🔔 {{ $t('삽니다 글 올려두고 매물 올라오면 알림 받기') }}</router-link>
      </div>
    </div>

    <div class="trade-grid" v-else>
      <router-link class="trade-card" v-for="p in pagedPosts" :key="p.id" :to="`/trade/${p.id}`">
        <span class="trade-card-icon" :class="postRarity(p)">
          <img v-if="iconUrlFor(postIconKey(p))" :src="iconUrlFor(postIconKey(p))" alt="" @load="fitIcon" />
          <span v-else class="icon-fallback" aria-hidden="true">{{ p.category.slice(0, 1) }}</span>
        </span>
        <span class="trade-card-title">{{ postName(p) }}</span>
        <span class="trade-flags">
          <span class="tf realm">{{ $t(p.realm) }}</span>
          <span class="tf" :class="p.ladder === '레더' ? 'ladder' : 'nonladder'">{{ $t(p.ladder) }}</span>
          <span class="tf" :class="p.hardcore === '하드코어' ? 'hardcore' : 'softcore'">{{ $t(p.hardcore) }}</span>
          <span class="tf eth" v-if="p.ethereal">{{ $t('에테리얼') }}</span>
          <span class="tf unid" v-if="p.unidentified">{{ $t('미확인') }}</span>
        </span>
        <span class="trade-card-price">
          {{ enCount(p.amountLabel) }} ·
          <template v-for="(t, i) in parsePriceTokens(p.price)" :key="i">
            <span class="price-icon" v-if="t.item"><img v-if="iconUrlFor(t.item.icon_key)" :src="iconUrlFor(t.item.icon_key)" alt="" /></span>{{ priceTok(t) }}
          </template>
        </span>
        <span class="trade-opts lines" v-if="variantLines(p).length">
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
      <div class="empty-state" v-else-if="filteredPosts.length === 0">
        {{ appliedCount ? $t('조건에 맞는 매물 없음') : $t('판매중인 글 없음') }}
        <button type="button" class="empty-clear" v-if="appliedCount" @click="resetFilters()">{{ $t('모두 지우기') }}</button>
        <router-link v-if="wantLink" class="want-cta big" :to="wantLink">🔔 {{ $t('삽니다 글 올려두고 매물 올라오면 알림 받기') }}</router-link>
      </div>
    </div>
    <div class="tr-more" ref="moreEl" v-if="hasMore && viewMode !== 'list'">{{ $t('더 불러오는 중…') }}</div>
    </template>
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

.trade-event-slot{margin:0 0 4px; padding:0;}
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
.item-range-grid{display:grid; grid-template-columns:repeat(auto-fill, minmax(360px, 1fr)); gap:10px 18px;}
.item-range-ss{min-width:200px; flex:1 1 200px;}
.base-q-chips{display:inline-flex; gap:4px; margin-left:auto; flex:none;}
.base-q-chips button{font-size:10.5px; padding:2px 8px; border-radius:999px; border:1px solid var(--border); color:var(--text-dim);}
.base-q-chips button:hover{background:var(--panel);}
.base-q-chips .q-normal{color:#cfc8bb; border-color:#5a554c;}
.base-q-chips .q-magic{color:#8c8cff; border-color:#4c4c99;}
.base-q-chips .q-rare{color:#e6d250; border-color:#8a7c22;}
.base-q-chips .q-crafted{color:#e0913a; border-color:#8a5a26;}
.mr-shapes{display:flex; flex-wrap:wrap; gap:5px; align-items:center;}
/* 매직·레어 검색 칸 - 이름 칸 72px 고정, 오른쪽은 왼쪽 정렬 */
.mr-grid{display:grid; grid-template-columns:72px minmax(0, 1fr); gap:10px 14px; align-items:center;}
.mr-label{font-size:12.5px; font-weight:700; color:var(--text-muted);}
.mr-label.top{align-self:start; padding-top:8px;}
.mr-label.on{color:var(--gold);}
.mr-head{display:flex; align-items:center; gap:12px; margin-bottom:12px;}
.mr-head-icon{width:40px; height:40px; flex:none; display:flex; align-items:center; justify-content:center; border:1px solid var(--border); border-radius:8px; background:var(--panel-2);}
.mr-head-icon img{max-width:34px; max-height:34px; image-rendering:pixelated;}
.mr-head-text{display:flex; flex-direction:column; gap:2px; min-width:0;}
.mr-head-text b{font-size:15px; color:var(--text);}
.mr-head-text span{font-size:11.5px; color:var(--text-dim);}
.mr-change{margin-left:auto; flex:none; font-size:12px; font-weight:700; color:var(--text-muted); border:1px solid var(--border); border-radius:999px; padding:5px 12px;}
.mr-change:hover{color:var(--gold); border-color:var(--gold-dim);}
.mr-hint{margin:-4px 0 0; font-size:11.5px; color:var(--text-dim); line-height:1.5;}
.mr-crafts{display:grid; grid-template-columns:repeat(auto-fill, minmax(210px, 1fr)); gap:8px;}
.mr-craft{display:flex; flex-direction:column; gap:3px; text-align:left; padding:9px 12px; border:1px solid var(--border); border-radius:10px; background:var(--panel-2);}
.mr-craft b{font-size:13px; color:#e0913a;}
.mr-craft span{font-size:11.5px; color:var(--text-muted); line-height:1.45;}
.mr-craft:hover{border-color:#8a5a26;}
.mr-craft.on{border-color:#e0913a; background:rgba(224,145,58,0.1);}
.mr-opt.fixed{border-color:#8a5a26; color:#f0b56a;}
.chip-shape{width:18px; height:18px; image-rendering:pixelated; vertical-align:middle;}
.pk-rows{display:flex; flex-direction:column; gap:6px; min-width:0;}
.pk-row{display:flex; flex-wrap:wrap; align-items:center; gap:6px; padding:5px 8px 5px 12px; border:1px solid var(--border-soft); border-radius:10px; background:var(--panel-2); font-size:12.5px;}
.pk-row.on{border-color:var(--gold-dim);}
.pk-name{margin-right:auto; color:var(--text-muted); line-height:1.4;}
.pk-row.on .pk-name{color:var(--gold);}
.pk-num{width:84px; padding:6px 8px; border-radius:7px; border:1px solid var(--border); background:var(--panel); color:var(--text); font-size:12.5px;}
.mr-head-icon.unique, .mr-head-icon.runeword{border-color:#6b5f3c;} .mr-head-icon.set{border-color:#1f6b1f;}
.mr-head-text b.unique, .mr-head-text b.runeword{color:#c7b377;} .mr-head-text b.set{color:#00c400;}
.mr-fixed{font-style:normal; font-size:10.5px; font-weight:700; margin-left:5px; color:#e0913a;}
.mr-seg{display:inline-flex; flex-wrap:wrap; gap:6px;}
.mr-seg button{padding:5px 12px; font-size:12.5px; font-weight:700; border-radius:999px; border:1px solid var(--border); color:var(--text-muted);}
.mr-seg button.on{border-color:var(--gold); color:var(--gold); background:rgba(200,163,77,0.12);}
.mr-seg .q-magic.on{color:#8c8cff; border-color:#8c8cff; background:rgba(140,140,255,0.1);}
.mr-seg .q-rare.on{color:#e6d250; border-color:#e6d250; background:rgba(230,210,80,0.1);}
.mr-seg .q-crafted.on{color:#e0913a; border-color:#e0913a; background:rgba(224,145,58,0.1);}
.mr-opts{display:flex; flex-direction:column; gap:8px; min-width:0;}
.mr-cond{display:flex; flex-wrap:wrap; align-items:center; gap:6px; padding:5px 8px 5px 12px; border:1px solid #4A5FA8; background:#1C2645; border-radius:10px; font-size:12.5px; color:#DDE3FF;}
.mr-cond-name{font-weight:700; margin-right:auto;}
.mr-cond-range{margin-left:8px; font-size:11px; font-weight:600; color:#9fb0ff; border:1px solid #4A5FA8; border-radius:999px; padding:0 7px;}
.mr-cond input{width:84px; padding:5px 8px; border-radius:7px; border:1px solid var(--border); background:var(--panel); color:var(--text); font-size:12.5px;}
.mr-sep{color:var(--text-dim);}
.mr-x{color:var(--text-dim); font-size:15px; padding:0 6px;}
.mr-x:hover{color:var(--text);}
.mr-opt-input{max-width:360px; width:100%; padding:7px 12px; border-radius:9px; border:1px solid var(--border); background:var(--panel-2); color:var(--text); font-size:13px; font-family:inherit;}
.mr-opt-chips{display:flex; flex-wrap:wrap; gap:6px;}
.mr-opt{display:inline-flex; align-items:center; font-size:12px; padding:4px 10px; border-radius:999px; border:1px solid var(--border); color:var(--text-muted); background:var(--panel-2);}
.mr-opt:hover{color:var(--text); border-color:#4A5FA8;}
.mr-opt.more{border-style:dashed;}
.mr-opt-none, .mr-opt-help{font-size:11.5px; color:var(--text-dim); margin:0;}
@media (max-width:640px){
  /* 폰: 이름을 위에, 칸을 아래에 (좁은 이름 칸에서 글자가 꺾이던 것) */
  .mr-grid{grid-template-columns:minmax(0, 1fr); gap:6px;}
  .mr-label{margin-top:8px;}
  .mr-label.top{padding-top:0;}
  .mr-cond-name, .pk-name{flex-basis:100%;}
  .pk-row :deep(input), .pk-num{width:auto; flex:1; min-width:0;}
  .pk-row :deep(.range-input){flex:1; min-width:0;}
}
.mr-shape{
  display:inline-flex; align-items:center; justify-content:center; border:1px solid var(--border);
  border-radius:8px; background:var(--panel); color:var(--text-dim); font-size:11.5px; padding:4px 9px;
}
.mr-shape.img{width:38px; height:38px; padding:2px;}
.mr-shape img{max-width:100%; max-height:100%; image-rendering:pixelated;}
.mr-shape:hover{border-color:var(--gold-dim);}
.mr-shape.on{border-color:var(--gold); background:rgba(200,163,77,0.12); color:var(--gold);}
.item-range-row{display:flex; align-items:center; gap:6px; font-size:12.5px;}
.item-range-label{flex:1; min-width:0; color:var(--text-muted); line-height:1.35; word-break:keep-all;}
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
/* 옵션은 한 줄에 하나씩 - 폭이 남으면 여러 칸으로 나눠 채움 (줄마다 옵션 하나인 건 그대로) */
.trade-opts.lines{display:grid; grid-template-columns:repeat(auto-fill, minmax(260px, 1fr)); justify-items:start; align-items:start; gap:3px 10px; max-width:640px;}
/* 카드형은 칸이 좁음 - 한 칸으로, 카드 폭을 넘지 않게 (안 그러면 옵션이 카드 밖으로 삐져나감) */
.trade-card .trade-opts.lines{grid-template-columns:minmax(0, 1fr); justify-items:center; max-width:100%; width:100%;}
.trade-card .trade-opt{max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.trade-opts.lines .trade-opt{max-width:100%;}
.trade-when{margin-left:auto; flex:none; font-size:11.5px; color:var(--text-dim);}
/* 서버·래더·모드·에테리얼·미확인 배지 */
.trade-flags{display:flex; flex-wrap:wrap; gap:4px; margin:6px 0 2px;}
.tf{white-space:nowrap; font-size:10.5px; font-weight:700; padding:2px 8px; border-radius:999px; border:1px solid currentColor; flex:none; line-height:1.5;}
.tf.realm{color:#9aa7b8;}
.tf.ladder{color:#e6c45a;}
.tf.nonladder{color:#8b8b8b;}
.tf.hardcore{color:#e0775f;}
.tf.softcore{color:#7fb2d8;}
.tf.eth{color:var(--teal);}
.tf.unid{color:#c98ae0;}
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
.tr-chip{white-space:nowrap;}
.tr-chip em{font-style:normal; font-size:10.5px; font-weight:800; opacity:.75;}
.tr-chip > button{width:22px; height:22px; border-radius:7px; background:rgba(255,255,255,.07); color:inherit; font-size:13px; line-height:22px; display:inline-flex; align-items:center; justify-content:center;}
.tr-chip > button:hover{background:rgba(255,255,255,.16);}
.tr-chip.kind, .tr-chip.realm{background:#2A2216; border-color:#8F773D; color:#F0D9A6;}
.tr-chip.opt{background:#1C2645; border-color:#4A5FA8; color:#DDE3FF;}
.tr-chip.item{background:#2A2216; border-color:var(--gold-dim); color:var(--gold);}
.tr-chip.item.set{color:var(--green);}
.tr-chip-edit{
  /* 칩 안에 자리잡다 보니 칩 폭에 맞춰 접혀서 '적용' 이 아래로 내려갔음 */
  width:max-content; flex-wrap:nowrap; white-space:nowrap;
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
.tr-pill-val{font-size:13.5px; font-weight:700; color:var(--text-muted); white-space:nowrap;}
.tr-pill select{position:absolute; inset:0; width:100%; height:100%; opacity:0; appearance:none; -webkit-appearance:none; border:none; cursor:pointer; font-size:16px;}
.tr-pill select option{background:var(--panel); color:var(--text);}
.tr-pill.on{border-color:var(--gold); background:#2A2216;}
.tr-pill.on .tr-pill-cap{color:#BFA46A;}
.tr-pill.on .tr-pill-val{color:var(--gold);}
.tr-pill.on::after{border-color:var(--gold);}
.tr-toggle{height:36px; padding:0 15px; border-radius:999px; font-size:13px; font-weight:700; border:1px dashed var(--border); background:transparent; color:var(--text-dim);}
.tr-toggle:hover{color:var(--text);}
.tr-toggle.eth.on{border:1px solid var(--teal); color:var(--teal); background:color-mix(in srgb, var(--teal) 12%, transparent);}
.tr-toggle.unid.on{border:1px solid #e0775f; color:#e0775f; background:color-mix(in srgb, #e0775f 12%, transparent);}

.tr-body{max-width:1100px; margin:0 auto; padding:24px 24px 64px; display:flex; flex-wrap:wrap; gap:24px; align-items:flex-start;}
/* 검색 화면: 왼쪽 조건 칸 + 오른쪽 결과 (결과가 위에서 바로 보이게) */
/* 검색 화면은 넓게 - 검색창(hero)과 아래 조건·결과의 좌우 기준선을 같게 맞춤 */
.trade-page.searching .tr-hero-inner{max-width:1560px; padding:28px 20px 20px;}
.trade-page.searching .tr-body{max-width:1560px; margin:0 auto; padding:20px 20px 64px; gap:20px; flex-wrap:nowrap;}
.tr-filters{flex:0 0 330px; min-width:0; position:sticky; top:12px;}
.tr-filters-toggle{display:none;}
.tr-filters .item-range-panel{margin-top:0;}
.tr-filters .item-range-panel + .item-range-panel{margin-top:10px;}
/* 조건 칸이 좁아지니 이름 칸도 줄이고 옵션 줄은 한 줄씩 */
.tr-filters .mr-grid{grid-template-columns:62px minmax(0, 1fr); gap:9px 10px;}
.tr-filters .item-range-grid{grid-template-columns:1fr;}
/* 조건 칸이 좁아서 한 줄에 '이름 최소 ~ 최대' 가 다 안 들어감 - 이름은 윗줄, 수치는 아랫줄 */
.tr-filters .pk-row{display:grid; grid-template-columns:1fr auto 1fr; gap:4px 6px; align-items:center;}
.tr-filters .pk-row .pk-name{grid-column:1 / -1; margin:0;}
.tr-filters .pk-row .sort-select{grid-column:1 / -1; width:100%;}
.tr-filters .pk-row input{width:100%; min-width:0;}
@media (max-width:1100px){
  .trade-page.searching .tr-body{flex-wrap:wrap;}
  .tr-filters{flex:1 1 100%; position:static;}
  .tr-filters-toggle{display:block; width:100%; margin-bottom:8px; padding:9px 12px; border:1px solid var(--border-soft);
    border-radius:10px; background:var(--panel); color:var(--text-muted); font-size:13px; font-weight:600; cursor:pointer;}
  .tr-filters.closed .tr-filters-body{display:none;}
}
.tr-go{font-size:12.5px; font-weight:700; color:var(--gold); border:1px solid var(--gold-dim);
  border-radius:999px; padding:4px 12px; cursor:pointer;}
.tr-go:hover{background:#2A2216;}
/* 첫 화면: 매물 수 + 전체 보기 */
.tr-home-cta{display:flex; flex-direction:column; align-items:center; gap:14px; padding:8px 0 4px;}
.tr-all-btn{cursor:pointer; display:inline-flex; align-items:center; gap:12px; padding:16px 30px; border:1px solid var(--gold);
  border-radius:999px; background:linear-gradient(180deg, #2b2316, #1d1810); color:var(--gold);
  box-shadow:0 0 0 1px rgba(199,179,119,.18), 0 10px 28px -14px rgba(199,179,119,.6);}
.tr-all-btn:hover{background:linear-gradient(180deg, #342a1a, #241d12);}
.tr-all-btn b{font-size:18px; font-weight:800; letter-spacing:-.01em;}
.tr-all-btn span{font-size:14px; font-weight:700; color:var(--gold-dim);}
.tr-home-links{display:flex; align-items:center; gap:10px;}
/* 판매글 등록은 가장 눈에 띄게 - 금색 채움 */
.tr-home-links .quality-toggle{background:var(--gold); border-color:var(--gold); color:#1a1408; font-weight:800;
  font-size:14px; padding:10px 20px; border-radius:999px;}
.tr-home-links .quality-toggle:hover{background:#e3cd92;}
.tr-home-links .guide-btn{font-size:13.5px; padding:10px 16px;}
/* 검색 화면 머리글 - 전체 매물로 돌아가는 링크 */
.tr-back{display:flex; align-items:center; gap:12px; flex-wrap:wrap; margin-bottom:10px;}
.tr-back a{font-size:13px; color:var(--gold-dim);}
.tr-back a:hover{color:var(--gold);}
.tr-back-title{font-size:20px; margin:0; font-family:'Noto Sans KR', sans-serif; font-weight:800;}
.tr-main{flex:999 1 620px; min-width:0;}
.tr-main .trade-list, .tr-main .trade-grid{margin-top:12px;}
.tr-results-head{display:flex; flex-wrap:wrap; align-items:center; gap:10px;}
.tr-results-head h2{font-size:18px; margin:0; font-family:'Noto Sans KR', sans-serif; font-weight:800;}
.tr-results-head h2 span{color:var(--gold);}
.tr-results-note{font-size:12px; color:var(--text-dim);}
.tr-results-note a{color:var(--gold-dim); text-decoration:underline;}
.tr-gap{flex:1;}
.tr-results-head .quality-toggle{background:var(--gold); border-color:var(--gold); color:#1a1408; font-weight:800;}
.tr-results-head .quality-toggle:hover{background:#e3cd92;}
.want-cta{font-size:12.5px; font-weight:700; color:var(--gold); border:1px solid var(--gold-dim); border-radius:999px; padding:5px 12px;}
.want-cta:hover{background:#2A2216;}
.empty-drop{display:flex; flex-wrap:wrap; justify-content:center; align-items:center; gap:8px; margin-top:12px; font-size:13px; color:var(--text-dim);}
.empty-drop button{white-space:nowrap; padding:6px 12px; border-radius:999px; border:1px solid var(--gold-dim);
  background:#211b11; color:var(--gold); font-size:12.5px; font-weight:600; cursor:pointer;}
.empty-drop button:hover{background:#2A2216;}
.empty-drop button em{font-style:normal; color:var(--text-muted); font-weight:500;}
/* 글자 검색 결과의 아이템 고르기 */
.tr-textitems{margin-bottom:14px; padding:12px 14px; border:1px solid var(--border-soft); border-radius:12px; background:var(--panel);}
.tr-ti-head{font-size:13px; font-weight:700; margin-bottom:10px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;}
.tr-ti-head b{color:var(--gold);}
.tr-ti-head span{margin-left:8px; font-size:12px; font-weight:400; color:var(--text-dim);}
.tr-ti-grid{display:grid; grid-template-columns:repeat(auto-fill, minmax(190px, 1fr)); gap:6px;}
.tr-ti{display:flex; align-items:center; gap:8px; padding:6px 8px; border:1px solid var(--border); border-radius:10px;
  background:var(--panel-2); cursor:pointer; text-align:left; min-width:0;}
.tr-ti:hover{border-color:var(--gold-dim);}
.tr-ti-icon{width:28px; height:28px; flex:none; display:inline-flex; align-items:center; justify-content:center;}
.tr-ti-icon img{max-width:100%; max-height:100%;}
.tr-ti-name{font-size:12.5px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; min-width:0;}
.tr-ti small{margin-left:auto; flex:none; font-size:10.5px; color:var(--text-dim);}
.empty-clear{display:inline-block; margin-top:10px; padding:7px 14px; border:1px solid var(--line); border-radius:999px;
  background:transparent; color:var(--text-muted); font-size:13px; cursor:pointer;}
.empty-clear:hover{color:var(--text); border-color:var(--gold-dim);}
.want-cta.big{display:inline-block; margin-top:12px; font-size:13.5px; padding:9px 18px;}
.empty-state .want-cta.big{display:table; margin:12px auto 0;}
.want-count{font-size:12px; font-weight:700; color:var(--teal); border:1px solid var(--teal); border-radius:999px; padding:4px 10px;}

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
