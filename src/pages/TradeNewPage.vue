<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { countWantsForItem } from '../wantsStore.js'
import { useRouter, useRoute } from 'vue-router'
import { askConfirm } from '../dialog.js'
import EventBanner from '../components/EventBanner.vue'
import {
  TRADE_REALMS,
  guessRealm,
  rememberRealm,
  TRADE_LADDERS,
  TRADE_HARDCORE,
  GAME_VERSIONS,
  DEFAULT_GAME_VERSION,
  buildAmountLabel,
  OFFER_ONLY_PRICE,
  GOLD_MAX,
  uniqueDefenseRange as uniqueDefenseRangeFor,
  optionPresetsFor,
  addTradePost,
  searchAllItems,
  tradeCategoryForItem,
  getTradeItem,
  categoryHasQuantity,
  categorySupportsEthereal,
  getItemAffixes,
  isRollRangeAffix,
  resolveAffixText,
  isRandomClassSkillAffix,
  resolveRandomClassSkillText,
  CLASS_SKILL_NAMES,
  itemBaseKind,
  runewordMaterials,
  searchBaseItems,
  baseItemLabel,
  itemsData,
  itemLevelReq,
  classSkillsForBase,
  baseForItem,
  superiorCombosFor,
  SUPERIOR_MODS,
  isAllowedValue,
  isCurrencyItem,
  CURRENCY_ITEMS,
  EXTRA_MATERIALS,
  ICON_VARIANTS,
} from '../tradeStore.js'
import { ITEM_ICONS } from '../itemIcons.js'
import { itemMatchesQuery, squashText } from '../itemSearch.js'
import RichEditor from '../components/RichEditor.vue'
import ItemTooltipCanvas from '../components/ItemTooltipCanvas.vue'
import { buildTooltip } from '../itemTooltip.js'
import { itemDamage, formatDamage } from '../itemDamage.js'
import AffixPicker from '../components/AffixPicker.vue'
import RangeInput from '../components/RangeInput.vue'
import magicAffixData from '../data/magicAffixes.json'
import {
  affixFamiliesFor, affixLimits, craftRecipesFor, familyLines, familyLineSlots, filledValues, validateAffixPicks, validateCraftValues,
} from '../magicAffixes.js'
import { authState, signIn } from '../profileStore.js'
import { openTradeGuide, openTradeGuideOnce } from '../tradeGuide.js'
import { t, locale, itemName, affixText } from '../i18n.js'
// 베이스 이름 - 영어면 영어 이름만
const baseLabel = (b) => (locale.value === 'ko' ? baseItemLabel(b) : b.subtitle || baseItemLabel(b))
const baseNameOf = (b) => (locale.value === 'ko' ? b.name_ko || b.subtitle : b.subtitle || b.name_ko)
// 처음 판매글을 쓰러 온 사람에게 거래 이용 안내를 한 번 (예전엔 거래게시판에 들어오자마자 떴는데, 그 화면이 첫 화면이 돼서 옮김)
openTradeGuideOnce()

const router = useRouter()
const route = useRoute()

// 팝업은 열릴 때 새로 그려져서 autofocus 속성이 안 먹음 - 마운트될 때 직접 포커스
const vFocus = { mounted: (el) => el.focus() }

// 카테고리는 직접 고르지 않고 아이템 검색으로 자동 결정됨. 사전에 없는
// 아이템(매직/레어/일반, 기타)만 검색 결과가 없을 때 뜨는 버튼으로 고를 수 있음
const FALLBACK_CATEGORIES = ['매직/레어/일반', '기타']

const emptyForm = () => ({
  category: null,
  itemId: null,
  itemName: '',
  quantity: '',
  ethereal: false,
  negotiable: false,
  // 제안만 받기 - 희망 가격 없이 구매자들이 룬·보석·재료로 가격을 제안함
  offerOnly: false,
  // 유니크·세트를 미확인으로 팜 - 옵션 수치 입력 없이 사전 범위로
  unidentified: false,
  // "계속 등록"으로 다시 열면 앞 글의 서버·레더·하드코어를 그대로
  realm: TRADE_REALMS.includes(route.query.realm) ? route.query.realm : guessRealm(),
  ladder: TRADE_LADDERS.includes(route.query.ladder) ? route.query.ladder : TRADE_LADDERS[0],
  hardcore: TRADE_HARDCORE.includes(route.query.hardcore) ? route.query.hardcore : TRADE_HARDCORE[0],
  gameVersion: GAME_VERSIONS.includes(route.query.game) ? route.query.game : DEFAULT_GAME_VERSION,
  content: '',
})
const form = ref(emptyForm())

// 룬·퍼펙트 보석은 "베르 룬 1개 + 퍼펙트 자수정 5개"처럼 서로 다른 룬/보석을
// 섞어서 한 번에 파는 경우가 많아서, 단일 아이템 등록과 별도로 묶음 판매 모드를 둠
const bundleMode = ref(false)
const bundleItems = ref([])
const bundleQuery = ref('')
const showBundleDropdown = ref(false)
const bundleCandidates = computed(() => {
  const q = bundleQuery.value.trim().toLowerCase()
  if (!q) return []
  return searchAllItems(bundleQuery.value).filter(isCurrencyItem)
})
function setBundleMode(on) {
  bundleMode.value = on
  clearPickedItem()
}
function pickBundleItem(it) {
  const existing = bundleItems.value.find((b) => b.item.id === it.id)
  if (existing) existing.qty += 1
  else bundleItems.value.push({ item: it, qty: 1 })
  bundleQuery.value = ''
  showBundleDropdown.value = false
}
function removeBundleItem(i) {
  bundleItems.value.splice(i, 1)
}
function hideBundleDropdownSoon() {
  window.setTimeout(() => (showBundleDropdown.value = false), 150)
}

const hasQuantity = computed(() => categoryHasQuantity(form.value.category))
// 골드 판매 - 수량칸이 골드 액수. 큰 수라 "250만 골드"처럼 읽기 쉽게도 보여줌
const isGold = computed(() => form.value.category === '골드')
function goldReadable(v) {
  const n = Math.floor(Number(v) || 0)
  const eok = Math.floor(n / 100000000), man = Math.floor((n % 100000000) / 10000), rest = n % 10000
  if (locale.value !== 'ko') return '= ' + n.toLocaleString('en-US') + ' gold'
  return '= ' + [eok && `${eok}억`, man && `${man}만`, rest && `${rest}`].filter(Boolean).join(' ') + ' 골드'
}
const showItemModal = ref(false)
// 카테고리를 먼저 고르지 않아도 아이템명만 치면 사전 전체(룬·보석·유니크·세트·룬워드) +
// 우버보스 재료 목록에서 검색되고, 고르면 카테고리가 자동으로 맞춰짐 - 그래도 없으면
// (매직/레어/일반, 기타처럼 매번 랜덤하거나 목록화가 불가능한 경우) 직접 입력한 이름 그대로 등록
const itemCandidates = computed(() => searchAllItems(form.value.itemName))
const selectedItem = computed(() => getTradeItem(form.value.itemId))
const itemAffixes = computed(() => getItemAffixes(selectedItem.value))
const rolledValues = ref({})
// 지옥불 횃불처럼 "무작위 직업 기술" 옵션은 실제로는 아이템 하나당 직업 하나로
// 고정돼 있어서, 판매자가 자기 아이템이 어떤 직업으로 나왔는지 고를 수 있게 함
const randClassChoice = ref({})
const CLASS_SKILL_OPTIONS = Object.entries(CLASS_SKILL_NAMES).map(([code, name]) => ({ code, name }))
const customOptions = ref([])

// 새로워진 파괴참처럼 제작 시 "그룹마다 하나씩" 무작위 옵션이 붙는 아이템은 판매자가
// 그룹별로 실제 붙은 옵션을 고르고 수치를 입력함 - 고른 것만 옵션 목록에 들어감
const randomGroups = computed(() => selectedItem.value?.extra?.random_groups || [])
const groupChoice = ref({})
const groupValues = ref({})
function buildRandomGroupOptions() {
  return randomGroups.value.flatMap((g, gi) => {
    const opt = g[groupChoice.value[gi]]
    return opt ? [resolveAffixText(opt, groupValues.value[gi])] : []
  })
}

// 룬워드는 박힌 룬 조합이 고정돼 있어서 필요한 재료를 자동으로 보여줌
const materials = computed(() => runewordMaterials(selectedItem.value))

// 유니크·세트는 베이스 방어력/데미지·내구도가 이미 고정값이라 참고용으로만 보여줌
const baseStatsRef = computed(() => selectedItem.value?.base_stats || null)

// 사전에 없는 매직/레어/일반 아이템은 베이스가 무기인지 방어구인지 자동으로 알 수
// 없어서 직접 고르게 함 - 고르면 룬워드와 똑같이 베이스 스탯 입력칸이 열림
const manualBaseKind = ref(null)
function pickManualBaseKind(kind) {
  manualBaseKind.value = manualBaseKind.value === kind ? null : kind
  resetBaseStats()
}
// 반지·목걸이·주얼·부적은 무기/방어구 목록에 없어서 버튼으로 바로 고름 (방어력·데미지·소켓 없음)
const MISC_BASES = magicAffixData.miscBases.map((b) => ({
  ...b, type_sub: b.name_ko, tier: '', sockets: 0, can_eth: false, base_stats: { category: 'misc' },
}))
function pickMiscBase(b) {
  selectedBaseItem.value = selectedBaseItem.value?.code === b.code ? null : b
  resetBaseMods()
}

// 매직/레어/크래프트/일반(흰색) 품질 - 사전에 없는 아이템을 베이스로 등록할 때 고름.
// 매직·레어는 그 베이스에 붙을 수 있는 접사만(src/magicAffixes.js), 크래프트는 제작법 고정 옵션 +
// 레어 접사 풀에서 최대 4개, 일반은 상급 옵션·소켓만
const itemQuality = ref('')
const QUALITY_KO = { magic: '매직', rare: '레어', crafted: '크래프트', normal: '일반(흰색)' }
const isManualEquip = computed(() => !selectedItem.value && form.value.category === '매직/레어/일반')
// 이 베이스로 만들 수 있는 크래프트 제작법 (예: 반지 = 히트 파워·블러드·캐스터·세이프티)
const craftRecipes = computed(() => (selectedBaseItem.value ? craftRecipesFor(magicAffixData, selectedBaseItem.value) : []))
const qualityChoices = computed(() => {
  const b = selectedBaseItem.value
  if (!isManualEquip.value || !b) return []
  // 일반(흰색) -> 매직 -> 레어 -> 크래프트 순 (반지·목걸이 등은 일반 없음)
  const out = b.base_stats.category !== 'misc' ? ['normal', 'magic'] : ['magic']
  if (magicAffixData.bases[b.code]?.rare) out.push('rare')
  if (craftRecipes.value.length) out.push('crafted')
  return out
})
function pickQuality(q) {
  itemQuality.value = itemQuality.value === q ? '' : q
  // 베이스로 바로 고른 경우 자동으로 붙인 제목("레어 서클릿")은 품질을 바꾸면 같이 바꿈 (직접 고친 제목은 그대로)
  if (autoTitle.value && form.value.itemName === autoTitle.value) form.value.itemName = autoTitle.value = equipTitle(itemQuality.value, selectedBaseItem.value)
  resetAffixPicks()
  superiorPick.value = { combo: '', values: {} }
  uniqueSockets.value = ''
  socketOn.value = false
  socketSource.value = ''
  socketAffixCount.value = ''
  // 제작법이 하나뿐이면 바로 고름
  craftPick.value = { id: craftRecipes.value.length === 1 ? craftRecipes.value[0].id : '', values: [] }
}
const isAffixQuality = computed(() => isManualEquip.value && ['magic', 'rare', 'crafted'].includes(itemQuality.value))
const isCrafted = computed(() => isAffixQuality.value && itemQuality.value === 'crafted')
const craftPick = ref({ id: '', values: [] })
const pickedCraft = computed(() => (isCrafted.value ? craftRecipes.value.find((r) => r.id === craftPick.value.id) || null : null))
function pickCraft(id) {
  craftPick.value = { id, values: [] }
}
// 크래프트 고정 옵션 중 수치를 골라야 하는 칸 (고정 수치는 자동)
const craftInputSlots = computed(() =>
  pickedCraft.value ? pickedCraft.value.fam.slotRanges.map(([lo, hi], i) => ({ i, lo, hi })).filter((s) => s.lo !== s.hi) : []
)
// 수치를 아직 안 넣은 칸은 범위("1~2")로 채워서 문구를 만듦 - 옵션을 고르자마자 미리보기에 보이게
// (옵션 고르는 칸의 표시 방식과 같음, 크래프트는 수치를 다 넣어야 등록되니 저장엔 영향 없음)
function familyLinesOrRange(fam, values) {
  return familyLines(fam, filledValues(fam, values).map((v, i) => v ?? fam.slotRanges[i].join('~')))
}
// 같은 옵션이 크래프트 고정 옵션과 무작위 옵션에 둘 다 붙으면 게임 툴팁처럼 한 줄로 합침
// (예: 캐스터 목걸이 고정 "시전 속도 +10%" + 접미사 "시전 속도 +10%" = "시전 속도 +20%")
// 수치가 하나인 줄끼리만 합치고, 범위("5~10")로 남은 줄은 그대로 둠
function mergeSameStatLines(lines) {
  const out = []
  const at = new Map()
  for (const line of lines) {
    const m = /^(.*?)(\+?)(\d+)(%?)$/.exec(line)
    const key = m && !/[~\d]$/.test(m[1]) ? m[1] + '|' + m[2] + '|' + m[4] : null
    if (key && at.has(key)) {
      const i = at.get(key)
      const prev = /^(.*?)(\+?)(\d+)(%?)$/.exec(out[i])
      out[i] = `${m[1]}${m[2]}${Number(prev[3]) + Number(m[3])}${m[4]}`
    } else {
      if (key) at.set(key, out.length)
      out.push(line)
    }
  }
  return out
}
function buildCraftOptions() {
  if (!pickedCraft.value) return []
  return familyLinesOrRange(pickedCraft.value.fam, craftPick.value.values)
}
const craftErrors = computed(() => {
  if (!isCrafted.value) return []
  if (!pickedCraft.value) return [t('크래프트 제작법 선택')]
  return validateCraftValues(pickedCraft.value, craftPick.value.values)
})
const allAffixFamilies = computed(() =>
  isAffixQuality.value ? affixFamiliesFor(magicAffixData, selectedBaseItem.value, itemQuality.value) : []
)
// 매직·레어·크래프트 소켓은 옵션 목록에 섞어두지 않고 "기본 정보" 칸의 소켓에서 따로 고름.
// 소켓이 붙는 길은 둘: 소켓 접두사(Mechanist's 1~2 / Artificer's 3 / Jeweler's 4 - 접두사 1칸 차지)
// 또는 라르주크 퀘스트(소켓 없는 매직 1~2개, 레어·크래프트 1개)
const socketAffixFam = computed(() => allAffixFamilies.value.find((f) => f.mods.some((m) => m.code === 'sock')) || null)
const affixFamilies = computed(() => allAffixFamilies.value.filter((f) => f !== socketAffixFam.value))
const socketSource = ref('') // '' | 'affix' | 'larzuk'
const socketAffixCount = ref('')
const larzukMax = computed(() => {
  const max = selectedBaseItem.value?.sockets || 0
  if (!isAffixQuality.value || !max) return 0
  return itemQuality.value === 'magic' ? Math.min(2, max) : 1
})
const socketAffixRange = computed(() => socketAffixFam.value?.slotRanges[0] || null)
function onSocketSource() {
  socketAffixCount.value = ''
  uniqueSockets.value = ''
  // 소켓 접두사가 접두사 한 칸을 차지하니, 넘치는 빈 접두사 줄은 치움 (매직은 접두사 1개뿐)
  const rows = affixPicks.value.p
  while (rows.length > pickerLimits.value.p && rows.some((r) => !r.key)) rows.splice(rows.findIndex((r) => !r.key), 1)
}
const affixLimitsNow = computed(() => affixLimits(selectedBaseItem.value, itemQuality.value))
// 옵션 입력칸에 보여줄 개수 제한 - 소켓 접두사를 고르면 접두사 한 칸을 그게 차지
const pickerLimits = computed(() => {
  const lim = affixLimitsNow.value
  return socketSource.value === 'affix' ? { ...lim, p: lim.p - 1, total: lim.total - 1 } : lim
})
const emptyAffixPicks = () => ({ p: [], s: [] })
const affixPicks = ref(emptyAffixPicks())
function resetAffixPicks() {
  affixPicks.value = emptyAffixPicks()
}
// 고른 옵션 (종류 + 수치) 목록 - 종류를 안 고른 빈 줄은 뺌
const pickedAffixes = computed(() => {
  const byKey = new Map(affixFamilies.value.map((f) => [f.key, f]))
  const picks = ['p', 's'].flatMap((slot) =>
    affixPicks.value[slot].filter((r) => byKey.has(r.key)).map((r) => ({ fam: byKey.get(r.key), values: r.values }))
  )
  // 소켓 접두사도 옵션 하나로 같이 검사 (접두사 개수·같은 그룹·아이템 레벨 조건)
  if (socketSource.value === 'affix' && socketAffixFam.value) picks.push({ fam: socketAffixFam.value, values: [socketAffixCount.value] })
  return picks
})
// 같은 종류(그룹) 겹침·수치 단계·아이템 레벨 조건 검사 - 입력하는 동안 바로 보여주고 등록도 막음
const affixErrors = computed(() =>
  isAffixQuality.value ? validateAffixPicks(magicAffixData, selectedBaseItem.value, itemQuality.value, pickedAffixes.value) : []
)
// 접사 줄 + 어느 칸(p 접두사 / s 접미사)에서 왔는지
function buildAffixEntries() {
  return pickedAffixes.value.flatMap(({ fam, values }) => familyLinesOrRange(fam, values).map((text) => ({ text, slot: fam.slot })))
}
// 그림에 나오는 순서: 스킬 레벨 -> 시전 속도 -> 접두사(크래프트 고정 옵션 포함) -> 접미사
// "냉기 기술 피해 +15%"는 스킬 레벨이 아님 (기술 바로 뒤가 +숫자인 줄만)
const SKILL_LINE = /(^모든 기술 \+)|(기술 (?:레벨 )?\+\d)|( \+\d+ \((?:\S+) 전용\)$)/
const lineRank = ({ text, slot }) => (SKILL_LINE.test(text) ? 0 : /^시전 속도/.test(text) ? 1 : slot === 's' ? 3 : 2)
// lead: 상급·베이스 자체 옵션 (스킬 줄이면 맨 위로, 아니면 접두사보다 앞)
function orderedCraftAffixLines(lead = []) {
  const entries = [...lead.map((text) => ({ text, slot: 'b' })), ...buildCraftOptions().map((text) => ({ text, slot: 'c' })), ...buildAffixEntries()]
  const merged = mergeSameStatLines(entries.map((e) => e.text))
  // 합쳐진 줄은 처음 나온 쪽의 칸을 따름
  const slotOf = (line) => entries.find((e) => e.text === line || e.text.replace(/\d+/g, '#') === line.replace(/\d+/g, '#'))?.slot || 'p'
  return merged.map((text, i) => ({ text, slot: slotOf(text), i }))
    .sort((a, b) => lineRank(a) - lineRank(b) || a.i - b.i)
    .map((e) => e.text)
}

// 영혼(검·방패)·인내(무기·갑옷)처럼 무기와 방어구 둘 다에 만들 수 있는 룬워드는 아이템만
// 봐선 종류를 모름 - 고른 베이스로 정해짐
const effectiveBaseKind = computed(
  () => itemBaseKind(selectedItem.value) || selectedBaseItem.value?.base_stats.category || manualBaseKind.value
)

// 룬워드·매직/레어/일반은 베이스로 쓴 실물 아이템이 매번 달라서(어떤 방어구/무기를
// 썼는지) 판매자가 직접 입력해야 함 - 유니크·세트는 이미 base_stats로 고정돼 있어서
// 입력칸 대신 위의 참고 표시만 함. 룬워드는 베이스 선택이 필수라 종류를 몰라도 항상 보여줌
const needsManualBaseStats = computed(() => {
  if (selectedItem.value?.category === 'runeword') return true
  // 베이스를 고른 매직/레어/일반 장비: 품질을 고른 뒤에, 적을 게 있을 때만 (방어구 기본 방어력, 일반이면 상급 옵션, 직업 베이스 옵션)
  if (lockedEquipBase.value) {
    if (!itemQuality.value) return false
    return effectiveBaseKind.value === 'armor' || effectiveBaseKind.value === 'weapon' || superiorCombos.value.length > 0 || uniqueMaxSockets.value > 0 ||
      !!socketAffixFam.value || larzukMax.value > 0 ||
      !!baseClassSkills.value || baseAutoMods.value.length > 0
  }
  if (!effectiveBaseKind.value || effectiveBaseKind.value === 'misc') return false
  if (selectedItem.value && (selectedItem.value.category === 'unique' || selectedItem.value.category === 'set')) return false
  return true
})

// (증가된 방어력·데미지는 매직/레어 접사로, 추가 내구도는 상급 옵션으로만 입력받음)
// 무기 데미지(dmgMin~dmgMax)는 비워두면 베이스 고정값, 입력하면 게임에 보이는 값 그대로 저장.
// 유니크·세트도 같은 칸을 씀 - 샤코처럼 방어력을 보고 사는 아이템이 있어서 실제 수치를 적게 함
const armorStats = ref({ baseDefense: '', dmgMin: '', dmgMax: '' })
// 매직·레어·크래프트 요구 레벨 (선택) - 접사마다 달라서 사전으로 못 구함, 판매자가 게임 툴팁 보고 적음
const levelReq = ref('')
const levelReqValid = computed(() => /^\d+$/.test(String(levelReq.value)) && Number(levelReq.value) >= 1 && Number(levelReq.value) <= 99)
const levelReqLines = () => (isAffixQuality.value && levelReqValid.value ? [`요구 레벨 ${Number(levelReq.value)}`] : [])
const filled = (v) => v !== '' && v !== null && v !== undefined

// 룬워드·매직/레어/일반은 베이스로 쓴 실제 방어구/무기를 검색해서 고를 수 있게 함 -
// 고르면 그 베이스가 원래 갖고 있는 방어력/데미지·내구도가 자동으로 채워짐
const selectedBaseItem = ref(null)
const baseItemQuery = ref('')
const showBaseItemDropdown = ref(false)
const isRuneword = computed(() => selectedItem.value?.category === 'runeword')
const isUniqueOrSet = computed(() => ['unique', 'set'].includes(selectedItem.value?.category))
// 미확인 판매 (유니크·세트만)
const isUnidentified = computed(() => isUniqueOrSet.value && form.value.unidentified)
// 이 아이템의 실제 베이스 - 룬워드·매직/레어는 판매자가 고른 베이스, 유니크·세트는 고정 베이스
const itemBase = computed(() => selectedBaseItem.value || baseForItem(selectedItem.value))

// 에테리얼은 베이스가 에테리얼로 나올 수 있을 때만 (활·석궁·페이즈 블레이드처럼 내구도 없는 건 불가,
// 베이스 목록에 없는 유니크·세트 = 부적·주얼·반지·목걸이·퀘스트 아이템도 불가)
const hasEthereal = computed(() => {
  if (!categorySupportsEthereal(form.value.category)) return false
  if (itemBase.value) return !!itemBase.value.can_eth
  const cat = selectedItem.value?.category
  return cat !== 'unique' && cat !== 'set'
})
watch(hasEthereal, (ok) => {
  if (!ok) form.value.ethereal = false
})

// 상급(Superior) 흰 베이스 옵션 - 룬워드 베이스와 일반(흰색) 아이템만 해당 (매직/레어는 상급이 아님).
// 게임에서 정해진 조합 중 하나만 고를 수 있고, 수치도 조합별 범위 안에서만
const superiorCombos = computed(() =>
  isRuneword.value || (isManualEquip.value && itemQuality.value === 'normal') ? superiorCombosFor(selectedBaseItem.value) : []
)
const superiorPick = ref({ combo: '', values: {} })
const pickedSuperiorCombo = computed(() => superiorCombos.value[superiorPick.value.combo] || null)
const superiorComboLabel = (combo) =>
  combo.map((k) => SUPERIOR_MODS[k].text.replace('{v}', `${SUPERIOR_MODS[k].min}~${SUPERIOR_MODS[k].max}`)).join(' + ')
function buildSuperiorOptions() {
  return (pickedSuperiorCombo.value || [])
    .filter((k) => superiorPick.value.values[k] !== undefined && superiorPick.value.values[k] !== '')
    .map((k) => SUPERIOR_MODS[k].text.replace('{v}', superiorPick.value.values[k]))
}

// 소켓 - 일반(흰색)은 0~베이스 최대. 유니크·세트는 라르주크 퀘스트로 1개만 (큐브 소켓 레시피는 일반 등급 전용),
// 원래 소켓이 붙어 나오는 유니크·세트(시대의 왕관 1~2 등)는 위 옵션 입력에서 그 수치로 넣고 여기선 안 받음
const uniqueSockets = ref('')
const socketOn = ref(false)
const hasSockets = computed({
  get: () => socketOn.value || !!uniqueSockets.value,
  set: (v) => {
    socketOn.value = v
    if (!v) uniqueSockets.value = ''
  },
})
const hasBuiltinSockets = computed(() => itemAffixes.value.some((a) => a.prop === 'sock'))
const uniqueMaxSockets = computed(() => {
  if (isUniqueOrSet.value) return !hasBuiltinSockets.value && (itemBase.value?.sockets || 0) > 0 ? 1 : 0
  return isManualEquip.value && itemQuality.value === 'normal' ? itemBase.value?.sockets || 0 : 0
})

// 자유 입력 옵션은 사전에 없는 기타 아이템에만 - 룬워드·유니크·세트는 붙을 수 있는
// 옵션이 정해져 있어서 위의 전용 칸(베이스 옵션·상급·소켓)으로만 입력받음
// (매직/레어/일반은 위의 품질·접사 입력으로만 - 게임에서 나올 수 없는 옵션이 들어가지 않게)
const allowsCustomOptions = computed(() => !selectedItem.value && form.value.category === '기타')
// 룬워드는 만들 수 있는 베이스(허용 종류 + 필요 소켓 수)만 후보로 보여줌
const baseItemCandidates = computed(() =>
  selectedBaseItem.value
    ? []
    : searchBaseItems(baseItemQuery.value, effectiveBaseKind.value, isRuneword.value ? selectedItem.value : null)
)
const basePickerPlaceholder = computed(() => {
  if (isRuneword.value) return t('베이스 검색 또는 목록에서 선택 (예: 아칸 플레이트, 엘리트)')
  return effectiveBaseKind.value === 'weapon'
    ? t('베이스 무기 검색 (예: 콜로서스 블레이드, Bardiche)')
    : t('베이스 방어구 검색 (예: 카이트 실드, Field Plate)')
})
// 고른 상급·접사·제작법에서 나오는 방어력 관련 수치 모으기
//  ac%  = 방어력 증가 % (상급·매직/레어 접사·크래프트 세이프티)
//  ac   = 방어력 +N
//  ac/lvl = 레벨당 방어력 (캐릭터 레벨에 따라 달라져 값이 하나로 안 정해짐)
// 수치를 아직 안 넣은 칸은 그 칸의 범위(lo~hi)로 셈
const acSources = computed(() => {
  let edLo = 0, edHi = 0, flatLo = 0, flatHi = 0, perLvl = 0
  const add = (fam, values) => (fam?.mods || []).forEach((md, i) => {
    if (md.code === 'ac/lvl') { perLvl += (Number(md.param) || 0) / 8; return }
    if (md.code !== 'ac%' && md.code !== 'ac') return
    const r = fam.slotRanges?.[i]
    const lo = Number(r ? r[0] : md.min) || 0
    const hi = Number(r ? r[1] : md.max) || 0
    const raw = values?.[i]
    const has = raw !== '' && raw !== undefined && raw !== null && Number.isFinite(Number(raw))
    const v = Number(raw)
    if (md.code === 'ac%') { edLo += has ? v : lo; edHi += has ? v : hi }
    else { flatLo += has ? v : lo; flatHi += has ? v : hi }
  })
  for (const { fam, values } of pickedAffixes.value) add(fam, values)
  if (pickedCraft.value) add(pickedCraft.value.fam, craftPick.value.values)
  // 상급 조합의 방어력 증가
  if ((pickedSuperiorCombo.value || []).includes('ac%')) {
    const m = SUPERIOR_MODS['ac%']
    const raw = superiorPick.value.values['ac%']
    const has = raw !== '' && raw !== undefined && raw !== null && Number.isFinite(Number(raw))
    edLo += has ? Number(raw) : m.min
    edHi += has ? Number(raw) : m.max
  }
  return { edLo, edHi, flatLo, flatHi, perLvl }
})
// 방어력 증가가 붙은 아이템의 방어력 (게임 계산 - 단계마다 버림, '방어력 +N' 은 % 다음에 더함)
function defenseWithEd(ed) {
  const base = selectedBaseItem.value?.base_stats
  if (!base || base.category !== 'armor') return null
  let d = base.maxac + (ed > 0 ? 1 : 0)
  if (form.value.ethereal) d = Math.floor(d * 1.5)
  return Math.floor((d * (100 + ed)) / 100)
}
// 고른 베이스의 기본 방어력 범위 (에테리얼이면 1.5배) - 안내·입력 예시·범위 경고에 같이 씀
const expectedDefense = computed(() => {
  const base = selectedBaseItem.value?.base_stats
  if (!base || base.category !== 'armor') return null
  const { edLo, edHi, flatLo, flatHi, perLvl } = acSources.value
  const mul = form.value.ethereal ? 1.5 : 1
  const lo = edHi > 0 ? defenseWithEd(edLo) : Math.floor(base.minac * mul)
  const hi = edHi > 0 ? defenseWithEd(edHi) : Math.floor(base.maxac * mul)
  return { min: lo + flatLo, max: hi + flatHi + Math.floor(perLvl * 99) }
})
// 값이 하나로 정해지는 경우 - 자동으로 채우고 손으로 못 고치게
// (방어력 증가가 붙어 베이스가 maxac+1 로 고정 + 고른 수치가 다 들어감 + 레벨당 방어력 없음)
const defenseFixed = computed(() => {
  const { edLo, edHi, flatLo, flatHi, perLvl } = acSources.value
  if (!(edHi > 0) || edLo !== edHi || flatLo !== flatHi || perLvl) return null
  const v = defenseWithEd(edHi)
  return v === null ? null : v + flatHi
})
watch(defenseFixed, (v, old) => {
  if (v !== null) armorStats.value.baseDefense = String(v)
  else if (old !== null && String(armorStats.value.baseDefense) === String(old)) armorStats.value.baseDefense = ''
})
const baseDefenseWarning = computed(() => {
  const exp = expectedDefense.value
  const v = armorStats.value.baseDefense
  if (!exp || v === '' || v === null) return ''
  return Number(v) < exp.min || Number(v) > exp.max
    ? t('고른 베이스의 기본 방어력 범위({r})를 벗어남 - 다시 확인', { r: `${exp.min}~${exp.max}${form.value.ethereal ? ', ' + t('에테리얼') : ''}` })
    : ''
})
// 상급 '피해 증가 +X%' 로 넣은 수치 (안 골랐거나 수치 미입력이면 0)
const superiorDmgEd = computed(() => {
  if (!(pickedSuperiorCombo.value || []).includes('dmg%')) return 0
  const v = superiorPick.value.values['dmg%']
  return v === '' || v === undefined || v === null || !Number.isFinite(Number(v)) ? 0 : Number(v)
})
// 무기 기본 데미지는 베이스마다 고정값 - 입력받지 않고 이 값을 그대로 저장
// 에테리얼 1.5배와 상급 피해 증가를 게임과 같은 순서로 (단계마다 버림)
const expectedWeaponDamage = computed(() => {
  const dmg = weaponDamageRange(selectedBaseItem.value?.base_stats)
  if (!dmg) return null
  const ed = superiorDmgEd.value
  const calc = (v) => {
    let d = form.value.ethereal ? Math.floor(v * 1.5) : v
    return Math.floor((d * (100 + ed)) / 100)
  }
  return { min: calc(dmg.min), max: calc(dmg.max) }
})
// 유니크·세트 방어구가 게임에서 가질 수 있는 방어력 범위 (tradeStore - 판매글 수정 화면도 같이 씀)
const uniqueDefenseRange = computed(() =>
  isUniqueOrSet.value ? uniqueDefenseRangeFor(selectedItem.value, form.value.ethereal) : null
)
// 입력한 방어력이 나올 수 있는 범위를 벗어났는지 - 벗어난 값은 그림·판매글에 쓰지 않음 (칸은 빨갛게, 등록도 막힘)
const defenseOutOfRange = computed(() => {
  const v = armorStats.value.baseDefense
  if (!filled(v)) return false
  const r = uniqueDefenseRange.value || expectedDefense.value
  return !!r && !isAllowedValue(v, r)
})
// 유니크·세트 무기 데미지 범위 (한손·양손 중 아무 쪽이나 맞으면 됨, 레벨당 데미지는 99레벨까지)
const uniqueDamageRange = computed(() => {
  if (!isUniqueOrSet.value || selectedItem.value?.base_stats?.category !== 'weapon') return null
  const lo = itemDamage(selectedItem.value, { level: 0, ethereal: form.value.ethereal })
  const hi = itemDamage(selectedItem.value, { level: 99, ethereal: form.value.ethereal })
  const hands = ['one', 'two'].filter((h) => lo?.[h] && hi?.[h])
  if (!hands.length) return null
  return hands.map((h) => ({ min: [lo[h].min[0], hi[h].min[1]], max: [lo[h].max[0], hi[h].max[1]] }))
})
// 범위는 formatDamage 처럼 "35~(238-547)", 한손·양손 둘 다 있으면 " / " 로 이어 붙임
const damageRangeLabel = (r) => r.map(formatDamage).join(' / ')
// 입력한 데미지가 맞는지 - 둘 다 입력, 최소 ≤ 최대, 유니크·세트는 나올 수 있는 범위 안
const damageError = computed(() => {
  const { dmgMin, dmgMax } = armorStats.value
  if (!filled(dmgMin) && !filled(dmgMax)) return ''
  if (!filled(dmgMin) || !filled(dmgMax)) return t('데미지 최소·최대 둘 다 입력')
  const lo = Number(dmgMin), hi = Number(dmgMax)
  if (!Number.isInteger(lo) || !Number.isInteger(hi) || lo < 1 || hi < lo) return t('데미지 최소~최대 확인')
  const r = uniqueDamageRange.value
  if (r && !r.some((d) => lo >= d.min[0] && lo <= d.min[1] && hi >= d.max[0] && hi <= d.max[1])) {
    return `${t('데미지')} (${damageRangeLabel(r)})`
  }
  return ''
})
// 직업 전용 베이스 자체 옵션 - 게임에서 정해진 범위 안에서만 붙음 (scripts/build-base-items.js)
// · 스킬: 오브·지팡이·클로·드루이드/바바리안 투구·네크로 머리·완드·홀 등에 그 직업 스킬 최대 3개 × +1~3
// · 자동 옵션: 팔라딘 방패 = 모든 저항 또는 명중률, 오브 = 생명력 또는 마나, 아마존 무기 = 스킬 트리 +1~3 등
// 이 베이스에 실제로 붙을 수 있는 스킬만 (아이템 레벨 단계 + 필요 무기 종류로 거름)
const baseClassSkills = computed(() => classSkillsForBase(selectedBaseItem.value))
// 레어·크래프트는 가장 높은 단계가 안 붙어서 레어 가능 단계의 범위로 바꿈 (예: 팔라딘 방패 모든 저항 5~45 -> 5~35)
const baseAutoMods = computed(() => {
  const mods = selectedBaseItem.value?.auto_mods || []
  if (!['rare', 'crafted'].includes(itemQuality.value)) return mods
  const rare = magicAffixData.bases[selectedBaseItem.value.code]?.autoRare || {}
  return mods.filter((m) => rare[m.key]).map((m) => {
    const { values, ...rest } = m
    return { ...rest, ...rare[m.key] }
  })
})
// 품질을 바꿔서 고른 자동 옵션 수치가 새 범위를 넘으면 수치를 비움
watch(baseAutoMods, (list) => {
  const m = list.find((x) => x.key === autoModPick.value.key)
  if (!m) autoModPick.value = { key: '', value: '' }
  else if (autoModPick.value.value !== '' && !isAllowedValue(autoModPick.value.value, m)) autoModPick.value.value = ''
})
// 스킬은 게임에서 0~3개가 붙어서, 한 줄로 시작해서 "스킬 추가"로 3개까지 늘림
const MAX_CLASS_SKILLS = 3
const emptyClassSkillPicks = () => [{ skill: '', level: '' }]
const classSkillPicks = ref(emptyClassSkillPicks())
function addClassSkillRow() {
  if (classSkillPicks.value.length < MAX_CLASS_SKILLS) classSkillPicks.value.push({ skill: '', level: '' })
}
function removeClassSkillRow(i) {
  classSkillPicks.value.splice(i, 1)
  if (!classSkillPicks.value.length) classSkillPicks.value.push({ skill: '', level: '' })
}
// 같은 스킬은 두 번 안 붙으니, 다른 줄에서 이미 고른 스킬은 선택지에서 뺌
function classSkillOptionsFor(i) {
  const taken = new Set(classSkillPicks.value.filter((_, j) => j !== i).map((p) => p.skill).filter(Boolean))
  return baseClassSkills.value.skills.filter((s) => !taken.has(s.en))
}
const autoModPick = ref({ key: '', value: '' })
const pickedAutoMod = computed(() => baseAutoMods.value.find((m) => m.key === autoModPick.value.key) || null)
const skillLabel = (s) => `${s.ko} (${s.enDisplay || s.en})`
// "모든 저항 +{v}%" -> "모든 저항" 처럼 수치 자리를 뺀 이름들 (자동 옵션 선택칸 안내용)
const autoModNames = computed(() => baseAutoMods.value.map((m) => m.text.replace(/ \+\{v\}%?/, '')).join(' 또는 '))
// 반지·목걸이 등 고른 모양 (빈 값이면 기본 그림) - 베이스가 바뀌면 초기화
const iconVariant = ref('')
// 사전에 없는 장비를 무기·방어구 베이스(메이지플레이트 등)로 고른 상태 - 베이스는 고정하고 품질부터 고르게 함.
// (예전엔 아래 "베이스 정보" 칸에서 베이스를 지울 수 있어서, 지우면 반지 같은 다른 종류로 바뀔 수 있었음)
const lockedEquipBase = computed(
  () => isManualEquip.value && !!selectedBaseItem.value && selectedBaseItem.value.base_stats.category !== 'misc'
)
// 다른 베이스로 바꾸기 = 아이템 검색창을 다시 열기 (검색어는 지금 이름 그대로 -> 같은 종류 베이스가 바로 보임)
function changeEquipBase() {
  showItemModal.value = true
}
// 반지·목걸이·주얼·부적도 무기·방어구와 같이 검색창을 다시 열어서 고름 (예전엔 베이스를 지우고 종류 선택으로 돌아갔음)
const changeMiscBase = changeEquipBase
function resetBaseMods() {
  iconVariant.value = ''
  itemQuality.value = ''
  resetAffixPicks()
  classSkillPicks.value = emptyClassSkillPicks()
  autoModPick.value = { key: '', value: '' }
  superiorPick.value = { combo: '', values: {} }
}
function buildBaseModOptions() {
  const out = []
  const auto = pickedAutoMod.value
  if (auto && autoModPick.value.value !== '') out.push(auto.text.replace('{v}', autoModPick.value.value))
  const cls = baseClassSkills.value
  if (cls) {
    for (const p of classSkillPicks.value) {
      const s = cls.skills.find((x) => x.en === p.skill)
      if (s && p.level) out.push(`${s.ko || s.en} +${p.level} (${cls.name} 전용)`)
    }
  }
  return out
}
function pickBaseItem(b) {
  selectedBaseItem.value = b
  showBaseItemDropdown.value = false
  resetBaseMods()
}
function clearBaseItem() {
  selectedBaseItem.value = null
  baseItemQuery.value = ''
  resetBaseMods()
}
function hideBaseItemDropdownSoon() {
  window.setTimeout(() => (showBaseItemDropdown.value = false), 150)
}

function resetBaseStats() {
  armorStats.value = { baseDefense: '', dmgMin: '', dmgMax: '' }
  levelReq.value = ''
  clearBaseItem()
}

function buildBaseStatOptions() {
  const out = []
  if (selectedBaseItem.value) out.push(`베이스: ${baseItemLabel(selectedBaseItem.value)}`)
  if (effectiveBaseKind.value === 'armor') {
    // 실제 방어력을 입력했으면 그 값, 안 했으면 고른 베이스의 방어력 범위를 그대로 씀
    const base = selectedBaseItem.value?.base_stats
    const baseDefense = (!defenseOutOfRange.value && armorStats.value.baseDefense) || (base ? `${base.minac}~${base.maxac}` : '')
    if (baseDefense) out.push(`기본 방어력 ${baseDefense}`)
  } else if (effectiveBaseKind.value === 'weapon') {
    // 직접 입력한 데미지가 있으면 그 값, 없으면 베이스 고정값(에테리얼이면 1.5배)
    const exp = expectedWeaponDamage.value
    if (!damageError.value && filled(armorStats.value.dmgMin)) out.push(...enteredStatLines())
    else if (exp) out.push(`기본 데미지 ${exp.min}~${exp.max}`)
  }
  out.push(...orderedCraftAffixLines([...buildSuperiorOptions(), ...buildBaseModOptions()]))
  if (uniqueSockets.value) out.push(`소켓 ${uniqueSockets.value}개`)
  return out
}

// 판매자가 직접 입력한 방어력·데미지 줄 (유니크·세트, 미확인 판매에도 씀 - 게임에서 미확인이어도 보이는 값)
function enteredStatLines() {
  const s = armorStats.value
  if (effectiveBaseKind.value === 'armor') return filled(s.baseDefense) && !defenseOutOfRange.value ? [`기본 방어력 ${s.baseDefense}`] : []
  if (effectiveBaseKind.value === 'weapon') return filled(s.dmgMin) && filled(s.dmgMax) && !damageError.value ? [`기본 데미지 ${s.dmgMin}~${s.dmgMax}`] : []
  return []
}

// 입력한 수치가 게임에서 나올 수 있는 값인지 전부 검사 - 틀린 게 있으면 첫 번째 것을 알려주고 등록을 막음
const invalidInputs = computed(() => {
  const bad = []
  itemAffixes.value.forEach((a, i) => {
    if (isUnidentified.value) return
    if ((isRollRangeAffix(a) || isRandomClassSkillAffix(a)) && !isAllowedValue(rolledValues.value[i], a)) {
      // 옵션 문구에 이미 범위가 들어 있으면("방어력 750~775") 그대로, 아니면 범위를 붙여서
      bad.push(a.text.includes(`${a.min}~${a.max}`) ? a.text : `${a.text} (${Math.min(a.min, a.max)}~${Math.max(a.min, a.max)})`)
    }
  })
  randomGroups.value.forEach((g, gi) => {
    if (isUnidentified.value) return
    const o = g[groupChoice.value[gi]]
    if (o && !isAllowedValue(groupValues.value[gi], o)) bad.push(`${o.text} (${o.min}~${o.max})`)
  })
  if (expectedDefense.value && !isAllowedValue(armorStats.value.baseDefense, expectedDefense.value)) {
    bad.push(`${t('기본 방어력')} (${expectedDefense.value.min}~${expectedDefense.value.max})`)
  }
  if (uniqueDefenseRange.value && !isAllowedValue(armorStats.value.baseDefense, uniqueDefenseRange.value)) {
    bad.push(`${t('방어력')} (${uniqueDefenseRange.value.min}~${uniqueDefenseRange.value.max})`)
  }
  if (damageError.value) bad.push(damageError.value)
  if (isAffixQuality.value && filled(levelReq.value) && !levelReqValid.value) bad.push(t('요구 레벨') + ' (1~99)')
  const auto = pickedAutoMod.value
  if (auto && !isAllowedValue(autoModPick.value.value, auto)) bad.push(`${auto.text.replace('{v}', '')} (${auto.min}~${auto.max})`)
  for (const { fam, values } of pickedAffixes.value) {
    if (filledValues(fam, values).some((v) => v === null)) bad.push(`${fam.label} - ${t('수치 선택')}`)
  }
  bad.push(...craftErrors.value, ...affixErrors.value)
  if (hasSockets.value && !uniqueSockets.value) bad.push(t('소켓 개수 선택'))
  if (socketSource.value === 'larzuk' && !uniqueSockets.value) bad.push(t('소켓 개수 선택'))
  for (const k of pickedSuperiorCombo.value || []) {
    if (!isAllowedValue(superiorPick.value.values[k], SUPERIOR_MODS[k])) {
      bad.push(`${SUPERIOR_MODS[k].text.replace('{v}', '')} (${SUPERIOR_MODS[k].min}~${SUPERIOR_MODS[k].max})`)
    }
  }
  return bad
})
// 칸별 빨간 표시용
const outOfRange = (v, spec) => !isAllowedValue(v, spec)

function buildMaterialsOption() {
  if (!materials.value.length) return []
  return [`베이스 룬 조합: ${materials.value.map((r) => r.name_ko).join(' + ')}`]
}

// 룬워드/유니크·세트는 베이스가 무기냐 방어구냐에 따라 실제로 붙을 수 있는 기타 옵션이
// 다르므로, 고른 아이템(또는 직접 고른 무기/방어구 베이스)에 맞는 것만 콤보박스에 노출함
const availableOptionPresets = computed(() => optionPresetsFor(effectiveBaseKind.value))
const customOptionType = ref(availableOptionPresets.value[0].key)
const customOptionValue = ref('')
const selectedOptionPreset = computed(
  () => availableOptionPresets.value.find((p) => p.key === customOptionType.value) || availableOptionPresets.value[0]
)

watch(availableOptionPresets, (list) => {
  if (!list.some((p) => p.key === customOptionType.value)) customOptionType.value = list[0].key
})

function iconUrlFor(iconKey) {
  const url = iconKey && ITEM_ICONS[iconKey]
  return url || null
}

// 양손 무기(폴암 등)는 mindam/maxdam이 비어있고 2handmindam/2handmaxdam에 데미지가
// 들어있음 - 어느 쪽이 채워져 있는지 몰라도 항상 맞는 데미지 범위를 보여주기 위함
function weaponDamageRange(base) {
  if (!base) return null
  if (base.mindam !== null && base.mindam !== undefined) return { min: base.mindam, max: base.maxdam }
  if (base['2handmindam'] !== null && base['2handmindam'] !== undefined) {
    return { min: base['2handmindam'], max: base['2handmaxdam'] }
  }
  return null
}

// 유니크(gold)·세트(green)·룬워드(blood)·룬·보석(teal) - 아이템 사전 페이지와
// 똑같은 색 코드로 테두리를 맞춰서 어디서 보든 같은 등급은 같은 색으로 보이게 함
function rarityClass(item) {
  return item ? item.category : ''
}

// 아이템을 바꾸면(변경 버튼으로 다른 아이템 재선택, 또는 클리어) 이전 아이템 기준으로
// 입력해뒀던 수치들이 새 아이템에는 안 맞을 수 있어서 화면 처음 들어왔을 때처럼
// 전부 초기화함 - 개수/에테리얼/옵션값/베이스 스탯/직접 추가한 옵션/희망 가격까지 전부
function resetItemDependentFields() {
  form.value.quantity = ''
  form.value.ethereal = false
  rolledValues.value = {}
  randClassChoice.value = {}
  groupChoice.value = {}
  groupValues.value = {}
  manualBaseKind.value = null
  resetBaseStats()
  customOptions.value = []
  uniqueSockets.value = ''
  priceItems.value = []
}

function pickItem(it) {
  form.value.itemId = it.id
  form.value.itemName = it.name_ko
  const cat = tradeCategoryForItem(it)
  if (cat) form.value.category = cat
  showItemModal.value = false
  resetItemDependentFields()
}

// 삽니다 글에서 "판매글 올리기"로 오면 (?item=) 그 아이템을 골라 둠
onMounted(() => {
  const it = typeof route.query.item === 'string' ? getTradeItem(route.query.item) : null
  if (it && !form.value.itemId) pickItem(it)
})
// 고른 아이템을 구하는 삽니다 글 수 (있으면 "구하는 사람 N명" 링크)
const wantCount = ref(0)
watch(() => form.value.itemId, async (id) => { wantCount.value = 0; if (id) wantCount.value = await countWantsForItem(id) }, { immediate: true })

function clearPickedItem() {
  form.value.itemId = null
  form.value.itemName = ''
  form.value.category = null
  resetItemDependentFields()
}

// 아이템 선택 팝업에서 사전 아이템 외에 매직·레어·일반 장비도 베이스(서클릿, 모너크, 반지 등)로 바로 고름
// - 줄의 [매직][레어][일반] 버튼을 누르면 베이스와 품질이 한 번에 잡히고 제목도 "레어 서클릿"처럼 채워짐
const QUALITY_SHORT = { magic: '매직', rare: '레어', crafted: '크래프트', normal: '일반' }
const autoTitle = ref('')
const equipTitle = (q, b) => `${q ? QUALITY_SHORT[q] + ' ' : ''}${b?.name_ko || ''}`
const baseIconKey = (b) => b.icon_key || magicAffixData.bases[b.code]?.icon || null
function baseQualities(b) {
  const out = b.base_stats.category !== 'misc' ? ['normal', 'magic'] : ['magic']
  if (magicAffixData.bases[b.code]?.rare) out.push('rare')
  if (craftRecipesFor(magicAffixData, b).length) out.push('crafted')
  return out
}
const equipBaseCandidates = computed(() => {
  // "레어 서클릿"처럼 품질을 앞에 붙여 검색해도 베이스가 나오게 품질 단어는 빼고 찾음
  const q = form.value.itemName.trim().replace(/^(매직|레어|일반|크래프트)\s*/, '')
  if (!q) return []
  const sq = squashText(q)
  const misc = MISC_BASES.filter((b) => squashText(b.name_ko).includes(sq) || squashText(b.subtitle).includes(sq))
  return [...misc, ...searchBaseItems(q, null)].slice(0, 12)
})
function pickEquipBase(b, quality = '') {
  form.value.itemId = null
  form.value.category = '매직/레어/일반'
  resetItemDependentFields()
  manualBaseKind.value = b.base_stats.category
  selectedBaseItem.value = b
  resetBaseMods()
  itemQuality.value = ''
  if (quality && qualityChoices.value.includes(quality)) pickQuality(quality)
  form.value.itemName = autoTitle.value = equipTitle(itemQuality.value, b)
  showItemModal.value = false
}

function pickFallbackCategory(cat) {
  // 사전 아이템을 골랐다가 "변경"으로 사전에 없는 이름을 등록하는 경우, 이전 아이템 id가 남아서
  // 새 이름으로 예전 아이템(아이콘·옵션)이 저장되지 않게 비움
  form.value.itemId = null
  form.value.category = cat
  resetItemDependentFields()
  showItemModal.value = false
}

function addCustomOption() {
  const preset = selectedOptionPreset.value
  const v = customOptionValue.value.toString().trim()
  if (!v) return
  customOptions.value.push(preset.freeText ? v : preset.format(v))
  customOptionValue.value = ''
}

function removeCustomOption(i) {
  customOptions.value.splice(i, 1)
}

// 희망 가격은 자유 텍스트 대신 실제 룬·보석 아이템을 검색해서 개수와 함께 고르는
// 방식으로 받음 - 여러 종류를 섞어서 받아도 되니(예: 이스트 룬 2개 + 최상급
// 다이아몬드 5개) 묶음 판매 아이템 담기와 같은 패턴을 씀. 고르는 건 아이템 선택과
// 똑같이 팝업에서 검색 -> 선택 - 검색어가 없을 땐 거래에 제일 많이 쓰는 고급 룬부터 보여줌
const priceItems = ref([])
const priceQuery = ref('')
const showPriceModal = ref(false)
const PRICE_CURRENCIES = CURRENCY_ITEMS
const RUNES_HIGH_FIRST = PRICE_CURRENCIES
  .filter((it) => it.type_sub === '룬')
  .sort((a, b) => (itemLevelReq(b) ?? 0) - (itemLevelReq(a) ?? 0))
const DEFAULT_PRICE_LIST = [...RUNES_HIGH_FIRST, ...EXTRA_MATERIALS]
const priceCandidates = computed(() => {
  if (!priceQuery.value.trim()) return DEFAULT_PRICE_LIST
  return PRICE_CURRENCIES.filter((it) => itemMatchesQuery(it, priceQuery.value))
})
function openPriceModal() {
  priceQuery.value = ''
  showPriceModal.value = true
}
function pickPriceItem(it) {
  const existing = priceItems.value.find((p) => p.item.id === it.id)
  if (existing) existing.qty += 1
  else priceItems.value.push({ item: it, qty: 1 })
  showPriceModal.value = false
}
function priceQtyOf(it) {
  return priceItems.value.find((p) => p.item.id === it.id)?.qty || 0
}
function removePriceItem(i) {
  priceItems.value.splice(i, 1)
}
function buildPriceString() {
  if (form.value.offerOnly) return OFFER_ONLY_PRICE
  return priceItems.value.map((p) => `${p.item.name_ko} ${p.qty}개`).join(' + ')
}

// 필수 입력만 막고, 옵션류(직접 추가 옵션, 베이스 스탯 세부값, 지옥불 횃불 직업
// 선택 등)는 전부 선택 사항이라 검증하지 않음. 예외는 룬워드 베이스 아이템
// 선택 - 룬워드는 베이스가 뭐였는지가 실거래가에 큰 영향을 줘서 필수로 둠
const formError = ref('')

// 등록 중 두 번 누르지 않게
const saving = ref(false)
async function savePost(payload) {
  saving.value = true
  try {
    const post = await addTradePost(payload)
    saving.value = false
    // 확인 = 등록한 글 보기 / 계속 등록 = 서버·레더·하드코어만 남기고 새 글 쓰기 (창 밖을 눌러 닫아도 계속 등록)
    const view = await askConfirm(t('판매글 등록 완료 - 거래게시판 등록됨'), { confirmText: t('등록한 글 보기'), cancelText: t('계속 등록'), icon: 'success' })
    if (view) router.push(`/trade/${post.id}`)
    else {
      const { realm, ladder, hardcore, gameVersion } = form.value
      rememberRealm(realm)
      router.replace({ path: '/trade/new', query: { again: Date.now(), realm, ladder, hardcore, game: gameVersion } })
      window.scrollTo(0, 0)
    }
  } catch (e) {
    formError.value = t(e.message || '등록 실패')
  } finally {
    saving.value = false
  }
}

function submitBundle() {
  if (!bundleItems.value.length) { formError.value = t('팔 룬·보석·재료를 하나 이상 담을 것'); return }
  if (!form.value.offerOnly && !priceItems.value.length) { formError.value = t('희망 가격(룬·보석·재료) 하나 이상 선택 (또는 제안만 받기)'); return }
  formError.value = ''
  const itemName = bundleItems.value.map((b) => `${b.item.name_ko} ${b.qty}개`).join(' + ')
  const category = tradeCategoryForItem(bundleItems.value[0].item) || '룬'
  return savePost({
    ...form.value,
    category,
    itemId: bundleItems.value[0].item.id,
    itemName,
    amountLabel: `${bundleItems.value.length}종 묶음`,
    options: [],
    price: buildPriceString(),
  })
}

// 판매글에 저장될 옵션 줄 전체 - 등록과 아래 툴팁 미리보기가 같은 걸 씀
function buildAllOptions() {
  if (isUnidentified.value) {
    // 옵션 수치는 안 받음 (사전 범위 그대로). 소켓 수는 미확인이어도 게임에서 보이니 남김
    return ['미확인', ...enteredStatLines(), ...itemAffixes.value.map((a) => a.text), ...buildMaterialsOption(), ...(uniqueSockets.value ? [`소켓 ${uniqueSockets.value}개`] : [])]
  }
  const dbOptions = itemAffixes.value.map((a, i) => {
    if (isRandomClassSkillAffix(a)) return resolveRandomClassSkillText(a, randClassChoice.value[i], rolledValues.value[i])
    return isRollRangeAffix(a) ? resolveAffixText(a, rolledValues.value[i]) : a.text
  })
  return [
    ...dbOptions, ...buildRandomGroupOptions(), ...buildMaterialsOption(), ...buildBaseStatOptions(), ...levelReqLines(), ...customOptions.value,
  ]
}

// 그림: 룬워드는 고른 베이스 모양(예전엔 사전의 대표 그림으로 고정), 사전에 없는 장비는 고른 베이스·모양, 유니크·세트는 사전 그림
// 유니크·세트 반지·목걸이·주얼은 게임에서 그림이 무작위 (사전 그림이 기본 반지·목걸이·주얼 그림인 것) - 실제 모양을 고르게
const JEWELRY_CODE = Object.fromEntries(['rin', 'amu', 'jew'].map((c) => [ICON_VARIANTS[c][0], c]))
const uniqueShapeVariants = computed(() => {
  const it = selectedItem.value
  if (!it || !['unique', 'set'].includes(it.category)) return null
  const code = JEWELRY_CODE[it.icon_key]
  return code ? ICON_VARIANTS[code] : null
})
const postIcon = computed(() => {
  if (uniqueShapeVariants.value) return iconVariant.value || null
  if (isManualEquip.value) return iconVariant.value || (selectedBaseItem.value ? baseIconKey(selectedBaseItem.value) : null)
  if (isRuneword.value && selectedBaseItem.value) return baseIconKey(selectedBaseItem.value)
  return null
})

// 입력하는 동안 게임 툴팁 모양으로 바로 보여주는 미리보기 (묶음 판매·아이템 미선택이면 숨김)
const previewTooltip = computed(() =>
  !bundleMode.value && form.value.itemName.trim()
    ? buildTooltip({
        item: selectedItem.value,
        name: form.value.itemName,
        category: form.value.category,
        quality: isManualEquip.value ? itemQuality.value : '',
        // 룬워드·사전에 없는 장비는 고른 베이스 모양 (반지·부적 등은 icon_key, 무기·방어구는 게임 invfile 기준 아이콘)
        iconKey: postIcon.value,
        options: buildAllOptions(),
        ethereal: form.value.ethereal,
        amountLabel: hasQuantity.value ? buildAmountLabel(form.value.quantity, form.value.category) : '1개',
      })
    : null
)

function submitPost() {
  if (bundleMode.value) return submitBundle()
  const amountLabel = hasQuantity.value ? buildAmountLabel(form.value.quantity, form.value.category) : '1개'
  if (!form.value.itemName.trim()) { formError.value = t('아이템 검색·선택 또는 이름 입력'); return }
  if (!amountLabel.trim()) { formError.value = t(isGold.value ? '골드 액수 입력' : '개수 입력'); return }
  if (isGold.value && Number(form.value.quantity) > GOLD_MAX) { formError.value = t('골드는 한 글에 최대 {n} (1500만) 골드까지', { n: GOLD_MAX.toLocaleString(locale.value === 'ko' ? 'ko-KR' : 'en-US') }); return }
  if (selectedItem.value?.category === 'runeword' && !selectedBaseItem.value) {
    formError.value = t('룬워드는 베이스 아이템 선택 필수')
    return
  }
  if (!form.value.offerOnly && !priceItems.value.length) { formError.value = t('희망 가격(룬·보석·재료) 하나 이상 선택 (또는 제안만 받기)'); return }
  if (invalidInputs.value.length) {
    formError.value = `${t('게임에서 나올 수 없는 수치')}: ${affixText(invalidInputs.value[0])}`
    return
  }
  formError.value = ''
  const options = buildAllOptions()
  return savePost({
    ...form.value,
    amountLabel,
    options,
    quality: isManualEquip.value ? itemQuality.value : '',
    iconKey: isManualEquip.value ? iconVariant.value : postIcon.value,
    price: buildPriceString(),
  })
}
</script>

<template>
  <div class="items-page trade-new-page">

  <div class="patch-hero">
    <div class="patch-hero-inner">
      <div class="eyebrow">{{ $t('판매글 등록 ·') }} <button type="button" class="hero-guide-link" @click="openTradeGuide('sell')">{{ $t('등록 방법 보기') }}</button></div>
      <h1>{{ $t('아이템 등록하기') }}</h1>
    </div>
  </div>

  <div class="grid-wrap trade-new-wrap trade-new-login" v-if="!authState.user">
    <p>{{ $t('로그인 필요') }}</p>
    <button type="button" class="btn-primary" @click="signIn">{{ $t('로그인') }}</button>
  </div>
  <div class="grid-wrap trade-new-wrap" v-else>
    <div class="write-form trade-write-form">
      <div class="form-mode-toggle">
        <button type="button" :class="{ active: !bundleMode }" @click="setBundleMode(false)">{{ $t('단일 아이템 등록') }}</button>
        <button type="button" :class="{ active: bundleMode }" @click="setBundleMode(true)">{{ $t('룬·보석·재료 묶음 판매') }}</button>
      </div>

      <template v-if="!bundleMode">
      <div class="item-picker trade-item-input">
        <div v-if="selectedItem" class="item-picker-selected">
          <span class="item-picker-icon" :class="rarityClass(selectedItem)"><img v-if="iconUrlFor(selectedItem.icon_key)" :src="iconUrlFor(selectedItem.icon_key)" alt="" /></span>
          <span class="item-picker-name">{{ itemName(selectedItem) }}</span>
          <span class="item-picker-cat">{{ $t(form.category) }}</span>
          <button type="button" class="item-picker-change" @click="showItemModal = true">{{ $t('변경') }}</button>
          <button type="button" class="item-picker-clear" @click="clearPickedItem">✕</button>
        </div>
        <div v-else-if="form.category" class="item-picker-selected">
          <span class="item-picker-name">{{ form.itemName }}</span>
          <span class="item-picker-cat">{{ $t(form.category) }}</span>
          <button type="button" class="item-picker-change" @click="showItemModal = true">{{ $t('변경') }}</button>
          <button type="button" class="item-picker-clear" @click="clearPickedItem">✕</button>
        </div>
        <button v-else type="button" class="item-picker-trigger" @click="showItemModal = true">
          {{ $t('아이템명 검색 (예: 이스트 룬, 무한, 할리퀸 관모, 골드)') }}
        </button>
      </div>
      <router-link v-if="selectedItem && wantCount" class="want-hint" :to="{ path: '/trade/wants', query: { q: selectedItem.name_ko } }">
        {{ $t('이 아이템을 구하는 사람 {n}명 - 삽니다 글 보기', { n: wantCount }) }} →
      </router-link>

      <div class="modal-overlay" v-if="showItemModal" @click.self="showItemModal = false">
        <div class="modal-panel item-modal-panel">
          <button type="button" class="modal-close" @click="showItemModal = false">✕</button>
          <div class="d-section-title">{{ $t('아이템 선택') }}<span class="required-mark">*</span></div>
          <input
            type="text" :value="form.itemName" @input="form.itemName = $event.target.value" :placeholder="$t('아이템명 검색 (예: 이스트 룬, 무한, 할리퀸 관모, 골드)')"
            class="write-input" v-focus
          />
          <div class="item-modal-list">
            <button
              type="button" class="item-picker-row" v-for="it in itemCandidates" :key="it.id"
              @click="pickItem(it)"
            >
              <span class="item-picker-icon" :class="rarityClass(it)"><img v-if="iconUrlFor(it.icon_key)" :src="iconUrlFor(it.icon_key)" alt="" /></span>
              <span class="item-picker-name">{{ itemName(it) }} <small v-if="locale === 'ko'">{{ it.name_en }}</small></span>
              <span class="item-picker-row-cat">{{ $t(it.category_label) }}</span>
            </button>
            <template v-if="equipBaseCandidates.length">
              <div class="item-picker-section">{{ $t('매직·레어·일반 장비 (베이스)') }}</div>
              <div class="item-picker-row equip-base-row" v-for="b in equipBaseCandidates" :key="'base-' + b.code">
                <button type="button" class="equip-base-main" @click="pickEquipBase(b)">
                  <span class="item-picker-icon"><img v-if="iconUrlFor(baseIconKey(b))" :src="iconUrlFor(baseIconKey(b))" alt="" /></span>
                  <span class="item-picker-name">{{ baseNameOf(b) }} <small><template v-if="locale === 'ko'">{{ b.subtitle }}</template><template v-if="b.tier"> · {{ $t(b.tier) }}</template></small></span>
                </button>
                <span class="equip-quality-chips">
                  <button type="button" v-for="q in baseQualities(b)" :key="q" :class="'q-' + q" @click="pickEquipBase(b, q)">{{ $t(QUALITY_SHORT[q]) }}</button>
                </span>
              </div>
            </template>
            <div class="item-picker-empty-block" v-if="form.itemName.trim() && !itemCandidates.length">
              <p class="item-picker-empty">{{ $t(equipBaseCandidates.length ? '찾는 게 없으면 종류를 골라 이 이름 그대로 등록' : '사전에 없는 아이템 - 종류를 고르면 이 이름 그대로 등록') }}</p>
              <div class="fallback-cat-row">
                <button
                  type="button" v-for="c in FALLBACK_CATEGORIES" :key="c"
                  :class="{ active: form.category === c }" @click="pickFallbackCategory(c)"
                >{{ $t(c) }}</button>
              </div>
            </div>
            <div class="item-modal-empty" v-if="!form.itemName.trim()">{{ $t('아이템명 입력') }}</div>
          </div>
        </div>
      </div>

      <div class="material-box" v-if="materials.length">
        <div class="option-editor-title">{{ $t('필요한 룬 재료') }}</div>
        <div class="material-rune-row">
          <span class="material-rune" v-for="(r, i) in materials" :key="i">
            <span class="material-rune-icon"><img v-if="iconUrlFor(r.icon_key)" :src="iconUrlFor(r.icon_key)" alt="" /></span>
            {{ itemName(r) }}
          </span>
        </div>
      </div>

      <div class="base-stats-ref" v-if="baseStatsRef && baseStatsRef.category !== 'misc'">
        <div class="option-editor-title">{{ $t('베이스 아이템 기본 정보') }}</div>
        <div class="base-stats-ref-row" v-if="baseStatsRef.category === 'armor'">
          <span>{{ $t('기본 방어력') }} {{ baseStatsRef.minac }}~{{ baseStatsRef.maxac }}</span>
          <span>{{ $t('내구도') }} {{ baseStatsRef.durability }}</span>
        </div>
        <div class="base-stats-ref-row" v-else-if="baseStatsRef.category === 'weapon'">
          <span>{{ $t('기본 데미지') }} {{ weaponDamageRange(baseStatsRef)?.min }}~{{ weaponDamageRange(baseStatsRef)?.max }}</span>
          <span v-if="baseStatsRef.speed !== null && baseStatsRef.speed !== undefined">{{ $t('공격 속도') }} {{ baseStatsRef.speed }}</span>
          <span>{{ $t('내구도') }} {{ baseStatsRef.durability }}</span>
        </div>
        <template v-if="isUniqueOrSet">
          <div class="base-stats-input-row" v-if="baseStatsRef.category === 'armor'">
            <label>
              {{ $t('방어력 (게임에 보이는 값 · 선택)') }}
              <input
                type="number" v-model="armorStats.baseDefense" class="write-input"
                :class="{ invalid: uniqueDefenseRange && outOfRange(armorStats.baseDefense, uniqueDefenseRange) }"
                :min="uniqueDefenseRange?.min" :max="uniqueDefenseRange?.max"
                :placeholder="uniqueDefenseRange ? `${uniqueDefenseRange.min}~${uniqueDefenseRange.max}` : $t('예: 141')"
              />
            </label>
          </div>
          <div class="base-stats-input-row" v-else-if="baseStatsRef.category === 'weapon'">
            <label>
              {{ $t('최소 데미지 (게임에 보이는 값 · 선택)') }}
              <input type="number" v-model="armorStats.dmgMin" class="write-input" :class="{ invalid: damageError }" min="1" :placeholder="$t('최소')" />
            </label>
            <label>
              {{ $t('최대 데미지') }}
              <input type="number" v-model="armorStats.dmgMax" class="write-input" :class="{ invalid: damageError }" min="1" :placeholder="$t('최대')" />
            </label>
          </div>
          <div class="unit-hint" v-if="baseStatsRef.category === 'weapon' && uniqueDamageRange">{{ $t('나올 수 있는 데미지') }} {{ damageRangeLabel(uniqueDamageRange) }}{{ form.ethereal ? ` (${$t('에테리얼')})` : '' }}</div>
          <div class="unit-hint affix-error" v-if="damageError">{{ damageError }}</div>
        </template>
      </div>

      <div class="manual-kind-row" v-if="!selectedItem && form.category === '매직/레어/일반' && !selectedBaseItem">
        <div class="option-editor-title">{{ $t('베이스 종류 선택') }}</div>
        <div class="fallback-cat-row">
          <button type="button" :class="{ active: manualBaseKind === 'weapon' }" @click="pickManualBaseKind('weapon')">{{ $t('무기') }}</button>
          <button type="button" :class="{ active: manualBaseKind === 'armor' }" @click="pickManualBaseKind('armor')">{{ $t('방어구') }}</button>
          <button type="button" :class="{ active: manualBaseKind === 'misc' }" @click="pickManualBaseKind('misc')">{{ $t('반지·목걸이·주얼·부적') }}</button>
        </div>
        <div class="fallback-cat-row" v-if="manualBaseKind === 'misc'">
          <button
            type="button" v-for="b in MISC_BASES" :key="b.code" :class="{ active: selectedBaseItem?.code === b.code }"
            @click="pickMiscBase(b)"
          >{{ baseNameOf(b) }}</button>
        </div>
      </div>

      <div class="manual-kind-row" v-if="uniqueShapeVariants">
        <div class="option-editor-title shape-title">{{ $t('모양') }} <span class="craft-sub-note">{{ $t('게임에서 무작위 - 실제 아이템 모양 선택') }}</span></div>
        <div class="shape-row">
          <button
            type="button" v-for="k in uniqueShapeVariants" :key="k" class="shape-btn"
            :class="{ active: (iconVariant || uniqueShapeVariants[0]) === k }" :aria-label="`${$t('모양')} ${k}`"
            @click="iconVariant = k"
          ><img v-if="iconUrlFor(k)" :src="iconUrlFor(k)" alt="" /></button>
        </div>
      </div>

      <div class="manual-kind-row" v-if="isManualEquip && selectedBaseItem && selectedBaseItem.base_stats.category === 'misc'">
        <div class="option-editor-title">
          {{ $t('베이스') }}: {{ baseNameOf(selectedBaseItem) }}
          <button type="button" class="base-change-btn" @click="changeMiscBase">{{ $t('다른 베이스') }}</button>
        </div>
        <template v-if="ICON_VARIANTS[selectedBaseItem.code]">
          <div class="option-editor-title shape-title">{{ $t('모양') }}</div>
          <div class="shape-row">
            <button
              type="button" v-for="k in ICON_VARIANTS[selectedBaseItem.code]" :key="k" class="shape-btn"
              :class="{ active: (iconVariant || ICON_VARIANTS[selectedBaseItem.code][0]) === k }" :aria-label="`${$t('모양')} ${k}`"
              @click="iconVariant = k"
            ><img v-if="iconUrlFor(k)" :src="iconUrlFor(k)" alt="" /></button>
          </div>
        </template>
      </div>

      <div class="manual-kind-row" v-if="lockedEquipBase">
        <div class="option-editor-title">
          {{ $t('베이스') }}: {{ baseNameOf(selectedBaseItem) }}
          <small class="base-sub">{{ $t(selectedBaseItem.tier) }} · {{ $t(selectedBaseItem.type_sub) }}</small>
          <button type="button" class="base-change-btn" @click="changeEquipBase">{{ $t('다른 베이스') }}</button>
        </div>
        <div class="unit-hint" v-if="!itemQuality">{{ $t('품질(일반·매직·레어·크래프트) 먼저 선택') }}</div>
      </div>

      <div class="option-editor" v-if="qualityChoices.length">
        <div class="option-editor-title">{{ $t('아이템 품질') }}</div>
        <div class="fallback-cat-row">
          <button
            type="button" v-for="q in qualityChoices" :key="q" :class="{ active: itemQuality === q }"
            @click="pickQuality(q)"
          >{{ QUALITY_KO[q] }}</button>
        </div>
        <template v-if="isCrafted">
          <div class="option-editor-title">{{ $t('크래프트 제작법') }}</div>
          <div class="fallback-cat-row">
            <button
              type="button" v-for="r in craftRecipes" :key="r.id" :class="{ active: craftPick.id === r.id }"
              @click="pickCraft(r.id)"
            >{{ r.name }}</button>
          </div>
          <template v-if="pickedCraft">
            <div class="option-editor-title craft-fixed-title">{{ $t('고정 옵션') }} <span class="craft-sub-note">{{ $t('항상 붙음') }}</span></div>
            <div class="craft-fixed-list">
              <div class="option-row craft-fixed-row" v-for="(line, li) in familyLineSlots(pickedCraft.fam, craftPick.values)" :key="li">
                <span class="option-text fixed">{{ affixText(line.text) }}</span>
                <template v-for="s in craftInputSlots.filter((c) => line.slots.includes(c.i))" :key="s.i">
                  <RangeInput v-model="craftPick.values[s.i]" :min="s.lo" :max="s.hi" :label="`${affixText(line.text)} ${s.lo}~${s.hi}`" />
                </template>
              </div>
            </div>
          </template>
          <div class="unit-hint affix-error" v-for="e in craftErrors" :key="e">{{ $t(e) }}</div>
          <div class="option-editor-title">{{ $t('무작위 옵션') }} <span class="craft-sub-note">{{ $t('레어 옵션 중 1~4개 · 접두사·접미사 한 목록') }}</span></div>
        </template>
        <template v-if="isAffixQuality">
          <AffixPicker :families="affixFamilies" :limits="pickerLimits" v-model="affixPicks" />
          <div class="unit-hint affix-error" v-for="e in affixErrors" :key="e">{{ $t(e) }}</div>
          <div class="level-req-row">
            <label>
              {{ $t('요구 레벨') }} <span class="craft-sub-note">{{ $t('선택 · 게임 툴팁의 값') }}</span>
              <input
                type="number" v-model="levelReq" class="write-input" min="1" max="99" :placeholder="$t('예: 42')"
                :class="{ invalid: filled(levelReq) && !levelReqValid }"
              />
            </label>
          </div>
        </template>
      </div>

      <div class="base-stats-input" v-if="needsManualBaseStats">
        <div class="option-editor-title">
          <template v-if="lockedEquipBase">{{ $t('기본 정보') }}</template>
          <template v-else>{{ $t(effectiveBaseKind === 'armor' ? '베이스 방어구 정보' : effectiveBaseKind === 'weapon' ? '베이스 무기 정보' : '베이스 아이템 정보') }}</template>
          <span class="required-mark" v-if="isRuneword">*</span>
        </div>

        <div class="base-item-picker" v-if="!lockedEquipBase">
          <div v-if="selectedBaseItem" class="item-picker-selected">
            <span class="item-picker-name">{{ baseLabel(selectedBaseItem) }}</span>
            <span class="item-picker-cat">{{ $t(selectedBaseItem.tier) }} · {{ $t(selectedBaseItem.type_sub) }}</span>
            <button type="button" class="item-picker-clear" @click="clearBaseItem">✕</button>
          </div>
          <div v-else class="item-picker-search-wrap">
            <input
              type="text" :value="baseItemQuery" :placeholder="basePickerPlaceholder"
              class="write-input" @focus="showBaseItemDropdown = true" @input="baseItemQuery = $event.target.value; showBaseItemDropdown = true"
              @blur="hideBaseItemDropdownSoon"
            />
            <div class="item-picker-dropdown" v-if="showBaseItemDropdown && (baseItemQuery.trim() || isRuneword)">
              <button
                type="button" class="item-picker-row" v-for="b in baseItemCandidates" :key="b.id"
                @mousedown.prevent="pickBaseItem(b)"
              >
                <span class="item-picker-name">{{ baseLabel(b) }}</span>
                <span class="item-picker-row-cat">{{ $t(b.tier) }} · {{ $t(b.type_sub) }}{{ b.sockets ? ' · ' + $t('최대 {n}소켓', { n: b.sockets }) : '' }}</span>
              </button>
              <div class="item-picker-empty" v-if="!baseItemCandidates.length">
                {{ $t(isRuneword ? '이 룬워드 베이스 중 일치 없음' : '일치하는 베이스 없음 - 아래 칸에 직접 입력') }}
              </div>
            </div>
          </div>
        </div>

        <template v-if="effectiveBaseKind === 'armor'">
          <div class="base-stats-ref-row" v-if="selectedBaseItem && !lockedEquipBase">
            <span v-if="expectedDefense">{{ expectedDefense.min === expectedDefense.max ? $t('기본 방어력') : $t('기본 방어력 범위') }} {{ expectedDefense.min === expectedDefense.max ? expectedDefense.min : `${expectedDefense.min}~${expectedDefense.max}` }}{{ form.ethereal ? ' ' + $t('(에테리얼 1.5배)') : '' }}</span>
            <span v-if="selectedBaseItem.base_stats.durability">{{ $t('내구도') }} {{ selectedBaseItem.base_stats.durability }}</span>
            <span v-if="selectedBaseItem.base_stats.reqstr">{{ $t('요구 힘') }} {{ selectedBaseItem.base_stats.reqstr }}</span>
            <span v-if="selectedBaseItem.base_stats.reqdex">{{ $t('요구 민첩') }} {{ selectedBaseItem.base_stats.reqdex }}</span>
          </div>
          <div class="base-stats-input-row">
            <label>
              {{ $t('기본 방어력') }}
              <input
                type="number" v-model="armorStats.baseDefense" class="write-input"
                :class="{ invalid: expectedDefense && outOfRange(armorStats.baseDefense, expectedDefense), fixed: defenseFixed !== null }"
                :readonly="defenseFixed !== null"
                :min="expectedDefense?.min" :max="expectedDefense?.max"
                :placeholder="expectedDefense ? (expectedDefense.min === expectedDefense.max ? String(expectedDefense.min) : `${expectedDefense.min}~${expectedDefense.max}`) : $t('예: 80')"
              />
            </label>
          </div>
          <div class="unit-hint" v-if="defenseFixed !== null">{{ $t('방어력 증가가 붙으면 베이스 방어력은 최댓값 +1 로 고정 - 값이 하나뿐이라 자동 입력') }}</div>
          <div class="unit-hint" v-else-if="baseDefenseWarning">{{ baseDefenseWarning }}</div>
        </template>

        <template v-else-if="effectiveBaseKind === 'weapon'">
          <div class="base-stats-ref-row" v-if="selectedBaseItem && !lockedEquipBase">
            <span v-if="expectedWeaponDamage">{{ $t('기본 데미지') }} {{ expectedWeaponDamage.min }}~{{ expectedWeaponDamage.max }}{{ form.ethereal ? ' ' + $t('(에테리얼 1.5배)') : '' }}{{ isRuneword ? ' · ' + $t('베이스 고정값 (자동 입력)') : '' }}</span>
            <span v-if="selectedBaseItem.base_stats.speed !== null && selectedBaseItem.base_stats.speed !== undefined">{{ $t('공격 속도') }} {{ selectedBaseItem.base_stats.speed }}</span>
            <span v-if="selectedBaseItem.base_stats.durability">{{ $t('내구도') }} {{ selectedBaseItem.base_stats.durability }}</span>
          </div>
          <div class="base-stats-input-row" v-if="!isRuneword">
            <label>
              {{ $t('최소 데미지') }}
              <input type="number" v-model="armorStats.dmgMin" class="write-input" :class="{ invalid: damageError }" min="1" :placeholder="expectedWeaponDamage ? `${expectedWeaponDamage.min}` : $t('최소')" />
            </label>
            <label>
              {{ $t('최대 데미지') }}
              <input type="number" v-model="armorStats.dmgMax" class="write-input" :class="{ invalid: damageError }" min="1" :placeholder="expectedWeaponDamage ? `${expectedWeaponDamage.max}` : $t('최대')" />
            </label>
          </div>
          <div class="unit-hint" v-if="!isRuneword">{{ $t('비워두면 베이스 기본값{r} - 피해 증가 등으로 바뀐 값은 게임에 보이는 그대로 입력', { r: expectedWeaponDamage ? ` ${expectedWeaponDamage.min}~${expectedWeaponDamage.max}` : '' }) }}</div>
          <div class="unit-hint affix-error" v-if="damageError">{{ damageError }}</div>
        </template>

        <div class="base-mods" v-if="superiorCombos.length">
          <div class="option-editor-title">{{ $t('상급(Superior) 베이스 옵션') }}</div>
          <div class="option-row">
            <select v-model="superiorPick.combo" class="write-select random-group-select" :aria-label="$t('상급 옵션 조합')">
              <option value="">{{ $t('상급 아님 (일반 베이스)') }}</option>
              <option v-for="(c, ci) in superiorCombos" :key="ci" :value="ci">{{ superiorComboLabel(c) }}</option>
            </select>
          </div>
          <div class="option-row" v-for="k in pickedSuperiorCombo || []" :key="k">
            <span class="option-text">{{ SUPERIOR_MODS[k].text.replace('{v}', `${SUPERIOR_MODS[k].min}~${SUPERIOR_MODS[k].max}`) }}</span>
            <RangeInput v-model="superiorPick.values[k]" :min="SUPERIOR_MODS[k].min" :max="SUPERIOR_MODS[k].max" :label="affixText(SUPERIOR_MODS[k].text.replace('{v}', `${SUPERIOR_MODS[k].min}~${SUPERIOR_MODS[k].max}`))" />
          </div>
        </div>

        <div class="base-mods" v-if="lockedEquipBase && uniqueMaxSockets">
          <div class="option-editor-title">{{ $t('소켓') }}</div>
          <div class="option-row">
            <select v-model="hasSockets" class="write-select random-group-select" :aria-label="$t('소켓 여부')">
              <option :value="false">{{ $t('소켓 없음') }}</option>
              <option :value="true">{{ $t('소켓 있음 (이 베이스 최대 {n}개)', { n: uniqueMaxSockets }) }}</option>
            </select>
          </div>
          <div class="option-row" v-if="hasSockets">
            <span class="option-text">{{ $t('소켓 개수') }} (1~{{ uniqueMaxSockets }})</span>
            <RangeInput v-model="uniqueSockets" :min="1" :max="uniqueMaxSockets" :label="$t('소켓 개수')" />
          </div>
        </div>

        <div class="base-mods" v-if="lockedEquipBase && isAffixQuality && (socketAffixFam || larzukMax)">
          <div class="option-editor-title">{{ $t('소켓') }}</div>
          <div class="option-row">
            <select v-model="socketSource" class="write-select random-group-select" :aria-label="$t('소켓 여부')" @change="onSocketSource">
              <option value="">{{ $t('소켓 없음') }}</option>
              <option value="affix" v-if="socketAffixFam">
                {{ $t('소켓 있음 · 옵션(접두사)으로 붙음 ({r}개)', { r: `${socketAffixRange[0]}~${socketAffixRange[1]}` }) }}
              </option>
              <option value="larzuk" v-if="larzukMax">{{ $t('소켓 있음 · 라르주크 퀘스트로 뚫음 ({r}개)', { r: larzukMax > 1 ? `1~${larzukMax}` : '1' }) }}</option>
            </select>
          </div>
          <div class="option-editor-hint" v-if="socketSource === 'affix'">{{ $t('소켓 옵션이 접두사 한 칸 차지') }}</div>
          <div class="option-row" v-if="socketSource === 'affix' && socketAffixRange">
            <span class="option-text">{{ $t('소켓 개수') }} ({{ socketAffixRange[0] }}~{{ socketAffixRange[1] }})</span>
            <RangeInput v-model="socketAffixCount" :min="socketAffixRange[0]" :max="socketAffixRange[1]" :label="$t('소켓 개수')" />
          </div>
          <div class="option-row" v-if="socketSource === 'larzuk'">
            <span class="option-text">{{ $t('소켓 개수') }} (1~{{ larzukMax }})</span>
            <RangeInput v-model="uniqueSockets" :min="1" :max="larzukMax" :label="$t('소켓 개수')" />
          </div>
        </div>

        <div class="base-mods" v-if="baseClassSkills || baseAutoMods.length">
          <div class="option-editor-title">{{ $t('베이스 자체 옵션') }}</div>
          <div class="option-row" v-if="baseAutoMods.length">
            <select v-model="autoModPick.key" class="write-select random-group-select" :aria-label="$t('자동 옵션')">
              <option value="">{{ $t('자동 옵션 선택') }} ({{ autoModNames }})</option>
              <option v-for="m in baseAutoMods" :key="m.key" :value="m.key">{{ m.text.replace('{v}', `${m.min}~${m.max}`) }}</option>
            </select>
            <select v-if="pickedAutoMod && pickedAutoMod.values" v-model="autoModPick.value" class="write-select option-value-select" :aria-label="$t('자동 옵션 수치')">
              <option value="">{{ $t('수치') }}</option>
              <option v-for="v in pickedAutoMod.values" :key="v" :value="v">{{ v }}</option>
            </select>
            <input
              v-else-if="pickedAutoMod" type="number" v-model="autoModPick.value" :min="pickedAutoMod.min" :max="pickedAutoMod.max"
              :class="{ invalid: outOfRange(autoModPick.value, pickedAutoMod) }"
              :placeholder="`${pickedAutoMod.min}~${pickedAutoMod.max}`" class="write-input option-value-input" :aria-label="$t('자동 옵션 수치')"
            />
          </div>
          <template v-if="baseClassSkills">
            <div class="option-editor-hint">{{ $t('{cls} 스킬 최대 3개, 각 +1~3', { cls: $t(baseClassSkills.name) }) }}</div>
            <div class="option-row" v-for="(p, i) in classSkillPicks" :key="i">
              <select v-model="p.skill" class="write-select random-group-select" :aria-label="`${$t(baseClassSkills.name)} ${i + 1}`">
                <option value="">{{ $t('{cls} 스킬 선택', { cls: $t(baseClassSkills.name) }) }}</option>
                <option v-for="s in classSkillOptionsFor(i)" :key="s.en" :value="s.en">{{ skillLabel(s) }}</option>
              </select>
              <RangeInput v-if="p.skill" v-model="p.level" :min="1" :max="3" prefix="+" :label="`${$t('스킬')} ${i + 1} 1~3`" />
              <button
                type="button" class="class-skill-remove" v-if="classSkillPicks.length > 1 || p.skill"
                :aria-label="`${$t('스킬')} ${i + 1} ×`" @click="removeClassSkillRow(i)"
              >✕</button>
            </div>
            <button
              type="button" class="class-skill-add" v-if="classSkillPicks.length < MAX_CLASS_SKILLS"
              @click="addClassSkillRow"
            >{{ $t('+ 스킬 추가') }} ({{ classSkillPicks.length }}/{{ MAX_CLASS_SKILLS }})</button>
          </template>
        </div>
      </div>

      <label class="unid-check" v-if="isUniqueOrSet">
        <input type="checkbox" v-model="form.unidentified" />
        {{ $t('미확인 아이템') }} <small>{{ $t('옵션 확인 전 - 수치 입력 없이 사전 범위로 표시') }}</small>
      </label>

      <label class="ethereal-check" v-if="hasEthereal">
        <input type="checkbox" v-model="form.ethereal" />
        {{ $t('에테리얼(Ethereal) 아이템') }}
      </label>

      <template v-if="selectedItem || form.category">
        <template v-if="hasQuantity">
          <input
            type="number" min="1" :max="isGold ? GOLD_MAX : null" v-model="form.quantity" :placeholder="$t(isGold ? '골드 액수 (예: 2500000, 최대 1500만)' : '개수 (예: 5)')"
            class="write-input trade-quantity-input" :class="{ invalid: isGold && Number(form.quantity) > GOLD_MAX }"
          />
          <div class="unit-hint" v-if="!isGold">{{ $t('여러 개는 한 번에 통째로 판매 - 나눠 팔려면 글을 따로 올리기') }}</div>
          <div class="unit-hint" v-if="isGold && Number(form.quantity) > 0" :class="{ 'affix-error': Number(form.quantity) > GOLD_MAX }">
            {{ goldReadable(form.quantity) }}{{ Number(form.quantity) > GOLD_MAX ? ' - ' + $t('최대 1500만 골드까지') : '' }}
          </div>
        </template>
      </template>

      <div class="option-editor" v-if="itemAffixes.length && !isUnidentified">
        <div class="option-editor-title">{{ $t('실제 옵션 값 입력') }}</div>
        <div class="option-row" v-for="(a, i) in itemAffixes" :key="i">
          <template v-if="isRandomClassSkillAffix(a)">
            <span class="option-text">{{ $t('직업 기술 레벨') }}<template v-if="a.min === a.max"> +{{ a.min }}</template></span>
            <select v-model="randClassChoice[i]" class="write-select option-value-select">
              <option :value="undefined">{{ $t('직업 선택') }}</option>
              <option v-for="c in CLASS_SKILL_OPTIONS" :key="c.code" :value="c.code">{{ $t(c.name) }}</option>
            </select>
            <input
              v-if="a.min !== a.max"
              type="number" v-model="rolledValues[i]" :placeholder="`${a.min}~${a.max}`"
              :min="Math.min(a.min, a.max)" :max="Math.max(a.min, a.max)" :class="{ invalid: outOfRange(rolledValues[i], a) }"
              class="write-input option-value-input"
            />
          </template>
          <template v-else-if="isRollRangeAffix(a)">
            <span class="option-text">{{ affixText(a.text) }}</span>
            <input
              type="number" v-model="rolledValues[i]" :placeholder="`${a.min}~${a.max}`"
              :min="Math.min(a.min, a.max)" :max="Math.max(a.min, a.max)" :class="{ invalid: outOfRange(rolledValues[i], a) }"
              class="write-input option-value-input"
            />
          </template>
          <span class="option-text fixed" v-else>{{ affixText(a.text) }}</span>
        </div>
      </div>

      <div class="option-editor" v-if="randomGroups.length && !isUnidentified">
        <div class="option-editor-title">{{ $t('제작 시 붙은 무작위 옵션') }}</div>
        <div class="option-row" v-for="(g, gi) in randomGroups" :key="gi">
          <select v-model="groupChoice[gi]" class="write-select random-group-select" :aria-label="$t('{n}그룹 옵션 선택', { n: gi + 1 })">
            <option :value="undefined">{{ $t('{n}그룹 옵션 선택', { n: gi + 1 }) }}</option>
            <option v-for="(o, oi) in g" :key="oi" :value="oi">{{ affixText(o.text) }}</option>
          </select>
          <input
            v-if="g[groupChoice[gi]]"
            type="number" v-model="groupValues[gi]" :placeholder="`${g[groupChoice[gi]].min}~${g[groupChoice[gi]].max}`"
            :min="g[groupChoice[gi]].min" :max="g[groupChoice[gi]].max" :class="{ invalid: outOfRange(groupValues[gi], g[groupChoice[gi]]) }"
            class="write-input option-value-input" :aria-label="$t('{n}그룹 옵션 선택', { n: gi + 1 })"
          />
        </div>
      </div>

      <div class="option-editor" v-if="uniqueMaxSockets && !lockedEquipBase">
        <div class="option-editor-title">{{ $t('소켓') }}</div>
        <div class="option-editor-hint">{{ $t('유니크·세트: 라르주크 퀘스트로 소켓 1개만') }}</div>
        <div class="option-row">
          <select v-model="uniqueSockets" class="write-select random-group-select" :aria-label="$t('소켓 개수')">
            <option value="">{{ $t('소켓 없음') }}</option>
            <option :value="1">{{ $t('소켓 있음 · 라르주크 퀘스트로 뚫음 (1개)') }}</option>
          </select>
        </div>
      </div>

      <div class="option-editor" v-if="allowsCustomOptions">
        <div class="option-editor-title">{{ $t('기타 옵션 직접 추가') }}</div>
        <div class="custom-option-chip" v-for="(o, i) in customOptions" :key="i">
          <span>{{ affixText(o) }}</span>
          <button type="button" @click="removeCustomOption(i)">✕</button>
        </div>
        <div class="custom-option-add-row">
          <select v-model="customOptionType" class="write-select custom-option-type-select">
            <option v-for="p in availableOptionPresets" :key="p.key" :value="p.key">{{ $t(p.label) }}</option>
          </select>
          <input
            :type="selectedOptionPreset.freeText ? 'text' : 'number'"
            v-model="customOptionValue"
            :placeholder="selectedOptionPreset.freeText ? $t(selectedOptionPreset.placeholder || '값 입력') : $t('수치 입력')"
            class="write-input custom-option-value-input"
            @keydown.enter.prevent="addCustomOption"
          />
          <button type="button" class="custom-option-add-btn" @click="addCustomOption">{{ $t('추가') }}</button>
        </div>
      </div>
      </template>

      <template v-else>
      <div class="bundle-box">
        <div class="option-editor-title">{{ $t('묶어서 팔 룬·보석·재료 추가') }}</div>
        <div class="bundle-chip-row" v-if="bundleItems.length">
          <div class="bundle-chip" v-for="(b, i) in bundleItems" :key="b.item.id">
            <span class="item-picker-icon" :class="rarityClass(b.item)"><img v-if="iconUrlFor(b.item.icon_key)" :src="iconUrlFor(b.item.icon_key)" alt="" /></span>
            <span class="bundle-chip-name">{{ itemName(b.item) }}</span>
            <input type="number" min="1" v-model="b.qty" class="bundle-chip-qty" />
            <span class="bundle-chip-unit">{{ $t('개') }}</span>
            <button type="button" @click="removeBundleItem(i)">✕</button>
          </div>
        </div>
        <div class="item-picker">
          <div class="item-picker-search-wrap">
            <input
              type="text" :value="bundleQuery" :placeholder="$t('이름 검색 (예: 이스트 룬, 최상급 자수정, 파괴의 열쇠)')"
              class="write-input" @focus="showBundleDropdown = true"
              @input="bundleQuery = $event.target.value; showBundleDropdown = true"
              @blur="hideBundleDropdownSoon"
            />
            <div class="item-picker-dropdown" v-if="showBundleDropdown && bundleQuery.trim()">
              <button
                type="button" class="item-picker-row" v-for="it in bundleCandidates" :key="it.id"
                @mousedown.prevent="pickBundleItem(it)"
              >
                <span class="item-picker-icon" :class="rarityClass(it)"><img v-if="iconUrlFor(it.icon_key)" :src="iconUrlFor(it.icon_key)" alt="" /></span>
                <span class="item-picker-name">{{ itemName(it) }} <small v-if="locale === 'ko'">{{ it.name_en }}</small></span>
              </button>
              <div class="item-picker-empty" v-if="!bundleCandidates.length">{{ $t('일치하는 룬·보석·재료 없음') }}</div>
            </div>
          </div>
        </div>
      </div>
      </template>

      <label class="negotiable-check offer-only-check">
        <input type="checkbox" v-model="form.offerOnly" />
        {{ $t('제안만 받기') }} <small>{{ $t('희망 가격 없이 구매자들의 가격 제안을 받음') }}</small>
      </label>
      <label class="negotiable-check" v-if="!form.offerOnly">
        <input type="checkbox" v-model="form.negotiable" />
        {{ $t('흥정 가능') }}
      </label>

      <div class="price-picker" v-if="!form.offerOnly">
        <div class="option-editor-title">{{ $t('희망 가격') }}<span class="required-mark" v-if="!form.offerOnly">*</span></div>
        <div class="bundle-chip-row" v-if="priceItems.length">
          <div class="bundle-chip" v-for="(p, i) in priceItems" :key="p.item.id">
            <span class="item-picker-icon gem"><img v-if="iconUrlFor(p.item.icon_key)" :src="iconUrlFor(p.item.icon_key)" alt="" /></span>
            <span class="bundle-chip-name">{{ itemName(p.item) }}</span>
            <input type="number" min="1" v-model="p.qty" class="bundle-chip-qty" />
            <span class="bundle-chip-unit">{{ $t('개') }}</span>
            <button type="button" @click="removePriceItem(i)">✕</button>
          </div>
        </div>
        <button type="button" class="item-picker-trigger" @click="openPriceModal">
          {{ $t(priceItems.length ? '+ 더 추가하기' : '받을 룬·보석·재료 검색 (예: 이스트 룬, 파괴의 열쇠)') }}
        </button>
      </div>

      <div class="modal-overlay" v-if="showPriceModal" @click.self="showPriceModal = false">
        <div class="modal-panel item-modal-panel">
          <button type="button" class="modal-close" @click="showPriceModal = false">✕</button>
          <div class="d-section-title">{{ $t('희망 가격 선택') }}</div>
          <input
            type="text" :value="priceQuery" @input="priceQuery = $event.target.value" :placeholder="$t('이름 검색 (예: 이스트 룬, 최상급 자수정, 파괴의 열쇠)')"
            class="write-input" v-focus :aria-label="$t('룬·보석·재료 검색')"
          />
          <div class="item-modal-list">
            <button
              type="button" class="item-picker-row" v-for="it in priceCandidates" :key="it.id"
              @click="pickPriceItem(it)"
            >
              <span class="item-picker-icon gem"><img v-if="iconUrlFor(it.icon_key)" :src="iconUrlFor(it.icon_key)" alt="" /></span>
              <span class="item-picker-name">{{ itemName(it) }} <small v-if="locale === 'ko'">{{ it.name_en }}</small></span>
              <span class="item-picker-row-cat price-picked" v-if="priceQtyOf(it)">{{ $t('담김 {n}개', { n: priceQtyOf(it) }) }}</span>
            </button>
            <div class="item-modal-empty" v-if="!priceCandidates.length">{{ $t('일치하는 룬·보석·재료 없음') }}</div>
          </div>
        </div>
      </div>

      <div class="trade-form-row">
        <select v-model="form.gameVersion" class="write-select trade-meta-select" :aria-label="$t('게임 모드')">
          <option v-for="g in GAME_VERSIONS" :key="g" :value="g">{{ $t(g) }}</option>
        </select>
        <select v-model="form.realm" class="write-select trade-meta-select" :aria-label="$t('서버')">
          <option v-for="r in TRADE_REALMS" :key="r" :value="r">{{ $t(r) }}</option>
        </select>
        <select v-model="form.ladder" class="write-select trade-meta-select" :aria-label="$t('레더')">
          <option v-for="l in TRADE_LADDERS" :key="l" :value="l">{{ $t(l) }}</option>
        </select>
        <select v-model="form.hardcore" class="write-select trade-meta-select" :aria-label="$t('하드코어')">
          <option v-for="h in TRADE_HARDCORE" :key="h" :value="h">{{ $t(h) }}</option>
        </select>
      </div>

      <RichEditor v-model="form.content" :placeholder="$t('추가 설명 (옵션 정보, 거래 방식 등)')" min-height="220px" />

      <div class="tooltip-preview" v-if="previewTooltip">
        <div class="option-editor-title">{{ $t('미리보기') }}</div>
        <ItemTooltipCanvas :tooltip="previewTooltip" :file-name="form.itemName" />
      </div>

      <EventBanner mode="post" />
      <div class="trade-new-actions">
        <router-link to="/trade" class="trade-new-cancel">{{ $t('취소') }}</router-link>
        <button class="btn-primary write-submit" :disabled="saving" @click="submitPost">{{ $t('등록하기') }}</button>
        <span class="form-error" v-if="formError">{{ formError }}</span>
      </div>
    </div>
  </div>
  </div>
</template>

<style scoped>
.trade-new-wrap{max-width:1180px;}
.write-form{display:flex; flex-direction:column; gap:12px;}
.write-form :deep(.md-editor){border-radius:12px; overflow:hidden;}
.write-select, .write-input{
  background:var(--panel); border:1px solid var(--border); color:var(--text); font-size:13px;
  padding:11px 14px; font-family:'Noto Sans KR', sans-serif; border-radius:10px;
}
.write-select{width:120px;}
.write-submit{padding:11px 22px; font-size:13px; border-radius:10px;}

.trade-form-row{display:flex; gap:8px;}
.trade-item-input{flex:1;}
.trade-quantity-input{width:160px;}
.trade-meta-select{flex:1; width:auto;}
.unit-hint{font-size:11px; color:var(--text-dim); margin-top:-4px;}

.item-picker{position:relative;}
.want-hint{display:inline-block; margin-top:8px; font-size:12.5px; font-weight:700; color:var(--teal); border:1px solid var(--teal); border-radius:999px; padding:4px 12px;}
.want-hint:hover{background:color-mix(in srgb, var(--teal) 12%, transparent);}
.item-picker-search-wrap{position:relative;}
.item-picker-selected{
  display:flex; align-items:center; gap:8px; background:var(--panel); border:1px solid var(--gold-dim);
  padding:6px 10px; height:41px; box-sizing:border-box; border-radius:10px;
}
.item-picker-cat{font-size:10.5px; color:var(--gold-dim); border:1px solid var(--border); padding:2px 10px; border-radius:999px; flex:none;}
.item-picker-change{margin-left:auto; color:var(--text-dim); font-size:11.5px; flex:none; border:1px solid var(--border); padding:4px 12px; border-radius:999px;}
.item-picker-change:hover{border-color:var(--gold-dim); color:var(--gold);}
.item-picker-clear{color:var(--text-dim); font-size:12px; flex:none;}
.item-picker-clear:hover{color:var(--blood);}
.item-picker-trigger{
  width:100%; text-align:left; font-size:13px; color:var(--text-dim); background:var(--panel);
  border:1px dashed var(--border); padding:13px 16px; border-radius:10px; font-family:'Noto Sans KR', sans-serif;
}
.item-picker-trigger:hover{border-color:var(--gold-dim); color:var(--gold-dim);}
.item-picker-dropdown{
  position:absolute; top:calc(100% + 6px); left:0; right:0; z-index:20; max-height:380px; overflow-y:auto;
  background:var(--panel-2); border:1px solid var(--border); box-shadow:0 12px 28px -6px rgba(0,0,0,0.55);
  border-radius:12px; padding:6px;
}
.item-picker-row{
  display:flex; align-items:center; gap:8px; width:100%; padding:9px 10px; text-align:left;
  font-family:'Noto Sans KR', sans-serif; border-radius:9px;
}
.item-picker-row:hover{background:rgba(255,255,255,0.06);}
.item-picker-icon{
  width:26px; height:26px; flex:none; display:flex; align-items:center; justify-content:center;
  background:var(--panel); border:1px solid var(--border-soft); border-radius:7px;
}
.item-picker-icon img{width:100%; height:100%; object-fit:contain; image-rendering:pixelated;}
.item-picker-icon.unique{border-color:var(--gold-dim); box-shadow:0 0 8px -2px rgba(200,163,77,0.5);}
.item-picker-icon.set{border-color:var(--green); box-shadow:0 0 8px -2px rgba(92,138,91,0.5);}
.item-picker-icon.runeword{border-color:var(--blood); box-shadow:0 0 8px -2px rgba(162,81,63,0.5);}
.item-picker-icon.gem{border-color:var(--teal); box-shadow:0 0 8px -2px rgba(78,138,138,0.5);}
.item-picker-name{font-size:13px; color:var(--text); min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.item-picker-name small{color:var(--text-dim); font-size:11px; margin-left:4px;}
.item-picker-row-cat{font-size:10px; color:var(--gold-dim); border:1px solid var(--border); padding:2px 8px; border-radius:999px; flex:none;}
.item-picker-row-cat.price-picked{color:var(--teal); border-color:var(--teal); margin-left:auto;}
.item-picker-empty-block{padding:14px;}
.item-picker-section{font-size:11px; color:var(--text-dim); padding:10px 10px 4px; border-top:1px solid var(--border-soft); margin-top:4px;}
.equip-base-row{padding:4px 6px 4px 0;}
.equip-base-row:hover{background:transparent;}
.equip-base-main{display:flex; align-items:center; gap:8px; flex:1; min-width:0; padding:5px 10px; border-radius:9px; text-align:left;}
.equip-base-main:hover{background:rgba(255,255,255,0.06);}
.equip-quality-chips{display:flex; gap:4px; flex:none;}
.equip-quality-chips button{font-size:11px; padding:3px 9px; border-radius:999px; border:1px solid var(--border); color:var(--text-muted);}
.equip-quality-chips .q-magic{color:#8c8cff; border-color:#5a5ab0;}
.equip-quality-chips .q-rare{color:#e8e86a; border-color:#9a9a45;}
.equip-quality-chips .q-normal{color:var(--text); }
.equip-quality-chips .q-crafted{color:#e0913a; border-color:#8a5a26;}
.equip-quality-chips button:hover{background:rgba(255,255,255,0.06);}
.item-picker-empty{text-align:center; color:var(--text-dim); font-size:12px; margin:0 0 10px;}
.fallback-cat-row{display:flex; justify-content:center; gap:8px; flex-wrap:wrap;}
.fallback-cat-row button{
  white-space:nowrap; font-size:12px; color:var(--text-muted); border:1px solid var(--border); padding:7px 16px; border-radius:999px;
}
.fallback-cat-row button:hover{border-color:var(--gold-dim); color:var(--gold);}
.fallback-cat-row button.active{color:var(--gold); border-color:var(--gold-dim); background:var(--panel);}

.affix-error{color:var(--blood);}
.craft-values{flex-wrap:wrap;}
.option-editor{border:1px solid var(--border-soft); background:var(--panel); padding:16px 18px; display:flex; flex-direction:column; gap:10px; border-radius:14px;}
.option-editor-title{font-size:12.5px; color:var(--gold-dim); font-weight:600;}
.option-editor-hint{font-size:11px; color:var(--text-dim); margin-top:-4px;}
.option-row{display:flex; align-items:center; gap:10px;}
.option-text{font-size:12.5px; color:var(--text-muted); flex:1;}
.option-text.fixed{color:var(--text-dim);}
.craft-fixed-list{display:flex; flex-direction:column; gap:6px; margin-bottom:10px;}
.craft-fixed-row{padding:6px 10px; background:var(--panel-2); border-radius:8px;}
.craft-fixed-row .option-text.fixed{color:#8c8cff;}
.craft-sub-note{font-size:11px; font-weight:400; color:var(--text-dim); margin-left:6px;}
.base-sub{font-size:11.5px; font-weight:400; color:var(--text-dim); margin-left:6px;}
.base-change-btn{font-size:11px; font-weight:400; color:var(--gold-dim); margin-left:10px; text-decoration:underline; text-underline-offset:3px;}
.shape-title{margin-top:10px;}
.shape-row{display:flex; flex-wrap:wrap; gap:8px;}
.shape-btn{width:52px; height:52px; display:flex; align-items:center; justify-content:center; background:var(--panel-2); border:1px solid var(--border-soft); border-radius:10px; padding:6px;}
.shape-btn img{max-width:100%; max-height:100%; image-rendering:pixelated;}
.shape-btn.active{border-color:var(--gold); box-shadow:0 0 0 1px var(--gold);}
.option-value-input{width:100px; padding:6px 8px !important; font-size:12.5px !important; flex:none; border-radius:8px !important;}
.random-group-select{flex:1; min-width:0; padding:6px 8px !important; font-size:12.5px !important; border-radius:8px !important;}
.option-value-select{width:110px; padding:6px 8px !important; font-size:12.5px !important; flex:none; border-radius:8px !important;}

.unid-check{display:flex; align-items:center; gap:8px; font-size:12.5px; color:#e0775f; cursor:pointer; flex-wrap:wrap;}
.unid-check input{accent-color:#e0775f;}
.unid-check small{color:var(--text-dim); font-size:11.5px;}
.ethereal-check{display:flex; align-items:center; gap:8px; font-size:12.5px; color:var(--teal); cursor:pointer; margin-top:-2px;}
.ethereal-check input{accent-color:var(--teal);}

.negotiable-check{display:flex; align-items:center; gap:8px; font-size:12.5px; color:var(--gold-dim); cursor:pointer;}
.negotiable-check input{accent-color:var(--gold-dim);}
.offer-only-check small{color:var(--text-dim); font-size:11.5px;}

.custom-option-chip{
  display:flex; align-items:center; gap:8px; background:var(--panel-2); border:1px solid var(--border-soft);
  padding:7px 12px; font-size:12.5px; color:var(--text-muted); border-radius:999px;
}
.custom-option-chip span{flex:1;}
.custom-option-chip button{color:var(--text-dim); flex:none;}
.custom-option-chip button:hover{color:var(--blood);}
.custom-option-add-row{display:flex; gap:8px;}
.custom-option-type-select{width:220px; flex:none;}
.custom-option-value-input{flex:1;}
.custom-option-add-btn{font-size:12px; color:var(--text-muted); border:1px solid var(--border); padding:0 14px; border-radius:10px;}
.custom-option-add-btn:hover{border-color:var(--gold-dim); color:var(--gold);}

.material-box{border:1px solid var(--blood); background:var(--panel); padding:16px 18px; border-radius:14px; display:flex; flex-direction:column; gap:10px;}
.material-rune-row{display:flex; flex-wrap:wrap; gap:8px;}
.material-rune{
  display:flex; align-items:center; gap:6px; background:var(--panel-2); border:1px solid var(--border-soft);
  padding:6px 12px 6px 6px; border-radius:999px; font-size:12.5px; color:var(--text);
}
.material-rune-icon{width:22px; height:22px; flex:none; display:flex; align-items:center; justify-content:center;}
.material-rune-icon img{width:100%; height:100%; object-fit:contain; image-rendering:pixelated;}

.base-stats-ref{border:1px solid var(--border-soft); background:var(--panel); padding:14px 18px; border-radius:14px; display:flex; flex-direction:column; gap:8px;}
.base-stats-ref-row{display:flex; gap:18px; font-size:12.5px; color:var(--text-muted); flex-wrap:wrap;}

.manual-kind-row{border:1px solid var(--border-soft); background:var(--panel); padding:14px 18px; border-radius:14px; display:flex; flex-direction:column; gap:10px;}

.base-stats-input{border:1px solid var(--gold-dim); background:var(--panel); padding:16px 18px; border-radius:14px; display:flex; flex-direction:column; gap:10px;}
.write-input.invalid{border-color:var(--blood) !important; box-shadow:0 0 0 1px var(--blood);}
.write-input.fixed{background:rgba(255,255,255,0.03); color:var(--text-muted); cursor:default;}
.tooltip-preview{border:1px solid var(--border-soft); background:var(--panel); padding:16px 18px; border-radius:14px; display:flex; flex-direction:column; gap:8px; align-items:center;}
.tooltip-preview .option-editor-title, .tooltip-preview .option-editor-hint{align-self:stretch;}
.base-mods{display:flex; flex-direction:column; gap:8px; border-top:1px dashed var(--border); padding-top:12px; margin-top:2px;}
.class-skill-remove{flex:none; color:var(--text-dim); font-size:12px; padding:4px 6px;}
.class-skill-remove:hover{color:var(--text);}
.class-skill-add{align-self:flex-start; font-size:12.5px; color:var(--gold); border:1px dashed var(--gold-dim); padding:7px 14px; border-radius:10px; background:transparent;}
.class-skill-add:hover{background:var(--panel-2);}
.base-stats-input-row{display:flex; gap:12px; flex-wrap:wrap;}
.level-req-row{margin-top:10px;}
.level-req-row label{display:flex; flex-direction:column; gap:6px; font-size:11.5px; color:var(--text-dim); max-width:200px;}
.base-stats-input-row label{
  flex:1; min-width:140px; display:flex; flex-direction:column; gap:6px; font-size:11.5px; color:var(--text-dim);
}

.trade-new-actions{display:flex; align-items:center; gap:10px;}
.form-error{font-size:12.5px; color:var(--blood);}
.required-mark{font-style:normal; color:#e0775f; font-weight:800; margin-left:3px;}
.trade-new-cancel{font-size:13px; color:var(--text-dim); padding:11px 18px;}
.trade-new-cancel:hover{color:var(--text);}

.form-mode-toggle{display:flex; border:1px solid var(--border); border-radius:10px; overflow:hidden; width:fit-content;}
.form-mode-toggle button{font-size:12.5px; padding:9px 16px; color:var(--text-dim); background:var(--panel);}
.form-mode-toggle button + button{border-left:1px solid var(--border);}
.form-mode-toggle button.active{color:var(--gold); background:var(--panel-2);}

.base-item-picker{position:relative;}
.base-item-picker .write-input{width:100%; box-sizing:border-box;}
.base-item-picker .item-picker-selected{height:auto;}

.bundle-box{border:1px solid var(--border-soft); background:var(--panel); padding:16px 18px; display:flex; flex-direction:column; gap:12px; border-radius:14px;}
.bundle-chip-row{display:flex; flex-direction:column; gap:8px;}
.bundle-chip{
  display:flex; align-items:center; gap:8px; background:var(--panel-2); border:1px solid var(--border-soft);
  padding:6px 10px; border-radius:999px;
}
.bundle-chip-name{flex:1; font-size:13px; color:var(--text);}
.bundle-chip-qty{
  width:64px; background:var(--panel); border:1px solid var(--border); color:var(--text); font-size:12.5px;
  padding:5px 8px; border-radius:8px; font-family:'Noto Sans KR', sans-serif;
}
.bundle-chip-unit{font-size:12px; color:var(--text-dim);}
.bundle-chip button{color:var(--text-dim); flex:none;}
.bundle-chip button:hover{color:var(--blood);}

.price-picker{border:1px solid var(--border-soft); background:var(--panel); padding:16px 18px; display:flex; flex-direction:column; gap:12px; border-radius:14px;}

.item-modal-panel{max-width:560px; display:flex; flex-direction:column; gap:12px;}
.item-modal-list{display:flex; flex-direction:column; gap:4px; max-height:420px; overflow-y:auto; margin-top:4px;}
.item-modal-empty{text-align:center; color:var(--text-dim); font-size:12px; padding:24px 0;}
@media (max-width:560px){
  .option-value-select{width:76px;}
  .option-row{gap:6px;}
}
.trade-new-login{display:flex; flex-direction:column; align-items:center; gap:14px; padding:48px 16px; color:var(--text-muted); font-size:14px;}
.hero-guide-link{color:var(--gold); text-decoration:underline; text-underline-offset:3px; font-size:inherit;}
</style>
