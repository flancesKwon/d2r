<script setup>
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  TRADE_REALMS,
  TRADE_LADDERS,
  TRADE_HARDCORE,
  buildAmountLabel,
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
import AffixPicker from '../components/AffixPicker.vue'
import RangeInput from '../components/RangeInput.vue'
import BaseStatsInput from '../components/BaseStatsInput.vue'
import magicAffixData from '../data/magicAffixes.json'
import {
  affixFamiliesFor, affixLimits, craftRecipesFor, familyLines, familyLineSlots, filledValues, validateAffixPicks, validateCraftValues,
} from '../magicAffixes.js'
import { authState, signIn } from '../profileStore.js'

const router = useRouter()

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
  // 유니크·세트를 미확인으로 팜 - 옵션 수치 입력 없이 사전 범위로
  unidentified: false,
  realm: TRADE_REALMS[0],
  ladder: TRADE_LADDERS[0],
  hardcore: TRADE_HARDCORE[0],
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
  if (!pickedCraft.value) return ['크래프트 제작법 선택']
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
    return effectiveBaseKind.value === 'armor' || superiorCombos.value.length > 0 || uniqueMaxSockets.value > 0 ||
      !!socketAffixFam.value || larzukMax.value > 0 ||
      !!baseClassSkills.value || baseAutoMods.value.length > 0
  }
  if (!effectiveBaseKind.value || effectiveBaseKind.value === 'misc') return false
  if (selectedItem.value && (selectedItem.value.category === 'unique' || selectedItem.value.category === 'set')) return false
  return true
})

// (증가된 방어력·데미지는 매직/레어 접사로, 추가 내구도는 상급 옵션으로만 입력받음)
const armorStats = ref({ baseDefense: '', minDamage: '', maxDamage: '' })

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
  if (isRuneword.value) return '베이스 검색 또는 목록에서 선택 (예: 아칸 플레이트, 엘리트)'
  return effectiveBaseKind.value === 'weapon'
    ? '베이스 무기 검색 (예: 콜로서스 블레이드, Bardiche)'
    : '베이스 방어구 검색 (예: 카이트 실드, Field Plate)'
})
// 방어력·피해를 계산할 베이스 - 룬워드·매직/레어/일반은 고른 베이스, 유니크·세트는 사전 값
const statBase = computed(() => selectedBaseItem.value?.base_stats || selectedItem.value?.base_stats || null)
const ethMul = () => (form.value.ethereal ? 1.5 : 1)

// 옵션 줄에서 "+N" 또는 "+N~M" 을 모아 [낮게, 높게] 로 (피해 증가%·방어력 증가%·방어력 등)
function sumFromLines(lines, re) {
  let lo = 0
  let hi = 0
  for (const line of lines) {
    const m = re.exec(line)
    if (!m) continue
    lo += Number(m[1])
    hi += Number(m[2] ?? m[1])
  }
  return [lo, hi]
}
// 베이스 스탯을 뺀 옵션 줄 (피해 증가% 등을 여기서 읽음 - 서로 참조하지 않게 따로 모음)
const statModLines = computed(() => [
  ...dictionaryOptionLines(), ...buildRandomGroupOptions(), ...buildSuperiorOptions(), ...buildBaseModOptions(),
  ...buildCraftOptions(), ...buildAffixEntries().map((e) => e.text), ...customOptions.value,
])
// 실제 방어력 범위 = 내림(베이스 × 에테리얼 × (1 + 방어력 증가%)) + 방어력 +N
const expectedDefense = computed(() => {
  const base = statBase.value
  if (!base || base.category !== 'armor' || base.minac == null) return null
  const lines = statModLines.value
  const [pLo, pHi] = sumFromLines(lines, /^방어력 증가 \+(\d+)(?:~(\d+))?%/)
  const [fLo, fHi] = sumFromLines(lines, /^방어력 \+(\d+)(?:~(\d+))?$/)
  const mul = ethMul()
  return {
    min: Math.floor(Math.floor(base.minac * mul) * (1 + pLo / 100)) + fLo,
    max: Math.floor(Math.floor(base.maxac * mul) * (1 + pHi / 100)) + fHi,
  }
})
// 실제 피해 범위 = 내림(베이스 × 에테리얼 × (1 + 피해 증가%)) + 최소/최대 피해 +N
const expectedDamage = computed(() => {
  const dmg = weaponDamageRange(statBase.value)
  if (!dmg) return null
  const lines = statModLines.value
  const [eLo, eHi] = sumFromLines(lines, /^피해 증가 \+(\d+)(?:~(\d+))?%/)
  const [minLo, minHi] = sumFromLines(lines, /^최소 피해 \+(\d+)(?:~(\d+))?$/)
  const [maxLo, maxHi] = sumFromLines(lines, /^최대 (?:피해|공격력) \+(\d+)(?:~(\d+))?$/)
  const mul = ethMul()
  const lo = (v, add) => Math.floor(Math.floor(v * mul) * (1 + eLo / 100)) + add
  const hi = (v, add) => Math.floor(Math.floor(v * mul) * (1 + eHi / 100)) + add
  return {
    min: { min: lo(dmg.min, minLo), max: hi(dmg.min, minHi) },
    max: { min: lo(dmg.max, maxLo), max: hi(dmg.max, maxHi) },
  }
})
const baseDefenseWarning = computed(() => {
  const exp = expectedDefense.value
  const v = armorStats.value.baseDefense
  if (!exp || v === '' || v === null) return ''
  return Number(v) < exp.min || Number(v) > exp.max
    ? `이 아이템의 방어력 범위(${exp.min}~${exp.max}${form.value.ethereal ? ', 에테리얼' : ''})를 벗어남 - 다시 확인`
    : ''
})
// 실제로 글에 들어갈 피해 값 - 입력한 게 있으면 그걸, 없으면 범위의 낮은 쪽~높은 쪽
const damageLineValue = computed(() => {
  const exp = expectedDamage.value
  if (!exp) return ''
  const side = (v, r) => (v === '' || v === null || v === undefined ? (r.min === r.max ? `${r.min}` : `(${r.min}-${r.max})`) : `${v}`)
  return `${side(armorStats.value.minDamage, exp.min)}~${side(armorStats.value.maxDamage, exp.max)}`
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
  armorStats.value = { baseDefense: '', minDamage: '', maxDamage: '' }
  clearBaseItem()
}

function buildBaseStatOptions() {
  const out = []
  if (selectedBaseItem.value) out.push(`베이스: ${baseItemLabel(selectedBaseItem.value)}`)
  // 실제 값을 입력했으면 그 값, 안 했으면 이 아이템의 방어력·피해 범위
  const def = expectedDefense.value
  if (def) {
    const v = armorStats.value.baseDefense
    out.push(`기본 방어력 ${v === '' || v === null ? (def.min === def.max ? def.min : `${def.min}~${def.max}`) : v}`)
  }
  if (damageLineValue.value) out.push(`기본 데미지 ${damageLineValue.value}`)
  out.push(...orderedCraftAffixLines([...buildSuperiorOptions(), ...buildBaseModOptions()]))
  if (uniqueSockets.value) out.push(`소켓 ${uniqueSockets.value}개`)
  return out
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
    bad.push(`방어력 (${expectedDefense.value.min}~${expectedDefense.value.max})`)
  }
  const dmgExp = expectedDamage.value
  if (dmgExp) {
    if (!isAllowedValue(armorStats.value.minDamage, dmgExp.min)) bad.push(`최소 피해 (${dmgExp.min.min}~${dmgExp.min.max})`)
    if (!isAllowedValue(armorStats.value.maxDamage, dmgExp.max)) bad.push(`최대 피해 (${dmgExp.max.min}~${dmgExp.max.max})`)
  }
  const auto = pickedAutoMod.value
  if (auto && !isAllowedValue(autoModPick.value.value, auto)) bad.push(`${auto.text.replace('{v}', '')} (${auto.min}~${auto.max})`)
  for (const { fam, values } of pickedAffixes.value) {
    if (filledValues(fam, values).some((v) => v === null)) bad.push(`${fam.label} - 수치 선택`)
  }
  bad.push(...craftErrors.value, ...affixErrors.value)
  if (hasSockets.value && !uniqueSockets.value) bad.push('소켓 개수 선택')
  if (socketSource.value === 'larzuk' && !uniqueSockets.value) bad.push('소켓 개수 선택')
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
    router.push(`/trade/${post.id}`)
  } catch (e) {
    formError.value = e.message || '등록 실패'
  } finally {
    saving.value = false
  }
}

function submitBundle() {
  if (!bundleItems.value.length) { formError.value = '팔 룬·보석·재료를 하나 이상 담을 것'; return }
  if (!priceItems.value.length) { formError.value = '희망 가격(룬·보석·재료) 하나 이상 선택'; return }
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

// 사전 아이템(유니크·세트·룬워드)의 옵션 줄 - 판매자가 넣은 수치 반영
function dictionaryOptionLines() {
  if (isUnidentified.value) return itemAffixes.value.map((a) => a.text)
  return itemAffixes.value.map((a, i) => {
    if (isRandomClassSkillAffix(a)) return resolveRandomClassSkillText(a, randClassChoice.value[i], rolledValues.value[i])
    return isRollRangeAffix(a) ? resolveAffixText(a, rolledValues.value[i]) : a.text
  })
}

// 판매글에 저장될 옵션 줄 전체 - 등록과 아래 툴팁 미리보기가 같은 걸 씀
function buildAllOptions() {
  if (isUnidentified.value) {
    // 옵션 수치는 안 받음 (사전 범위 그대로). 소켓 수는 미확인이어도 게임에서 보이니 남김
    return ['미확인', ...itemAffixes.value.map((a) => a.text), ...buildMaterialsOption(), ...(uniqueSockets.value ? [`소켓 ${uniqueSockets.value}개`] : [])]
  }
  return [
    ...dictionaryOptionLines(), ...buildRandomGroupOptions(), ...buildMaterialsOption(), ...buildBaseStatOptions(), ...customOptions.value,
  ]
}

// 그림: 룬워드는 고른 베이스 모양(예전엔 사전의 대표 그림으로 고정), 사전에 없는 장비는 고른 베이스·모양, 유니크·세트는 사전 그림
const postIcon = computed(() => {
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
        amountLabel: hasQuantity.value ? buildAmountLabel(form.value.quantity) : '1개',
      })
    : null
)

function submitPost() {
  if (bundleMode.value) return submitBundle()
  const amountLabel = hasQuantity.value ? buildAmountLabel(form.value.quantity) : '1개'
  if (!form.value.itemName.trim()) { formError.value = '아이템 검색·선택 또는 이름 입력'; return }
  if (!amountLabel.trim()) { formError.value = '개수 입력'; return }
  if (selectedItem.value?.category === 'runeword' && !selectedBaseItem.value) {
    formError.value = '룬워드는 베이스 아이템 선택 필수'
    return
  }
  if (!priceItems.value.length) { formError.value = '희망 가격(룬·보석·재료) 하나 이상 선택'; return }
  if (invalidInputs.value.length) {
    formError.value = `게임에서 나올 수 없는 수치: ${invalidInputs.value[0]}`
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
      <div class="eyebrow">판매글 등록</div>
      <h1>아이템 등록하기</h1>
    </div>
  </div>

  <div class="grid-wrap trade-new-wrap trade-new-login" v-if="!authState.user">
    <p>로그인 필요</p>
    <button type="button" class="btn-primary" @click="signIn">로그인</button>
  </div>
  <div class="grid-wrap trade-new-wrap" v-else>
    <div class="write-form trade-write-form">
      <div class="form-mode-toggle">
        <button type="button" :class="{ active: !bundleMode }" @click="setBundleMode(false)">단일 아이템 등록</button>
        <button type="button" :class="{ active: bundleMode }" @click="setBundleMode(true)">룬·보석·재료 묶음 판매</button>
      </div>

      <template v-if="!bundleMode">
      <div class="item-picker trade-item-input">
        <div v-if="selectedItem" class="item-picker-selected">
          <span class="item-picker-icon" :class="rarityClass(selectedItem)"><img v-if="iconUrlFor(selectedItem.icon_key)" :src="iconUrlFor(selectedItem.icon_key)" alt="" /></span>
          <span class="item-picker-name">{{ selectedItem.name_ko }}</span>
          <span class="item-picker-cat">{{ form.category }}</span>
          <button type="button" class="item-picker-change" @click="showItemModal = true">변경</button>
          <button type="button" class="item-picker-clear" @click="clearPickedItem">✕</button>
        </div>
        <div v-else-if="form.category" class="item-picker-selected">
          <span class="item-picker-name">{{ form.itemName }}</span>
          <span class="item-picker-cat">{{ form.category }}</span>
          <button type="button" class="item-picker-change" @click="showItemModal = true">변경</button>
          <button type="button" class="item-picker-clear" @click="clearPickedItem">✕</button>
        </div>
        <button v-else type="button" class="item-picker-trigger" @click="showItemModal = true">
          아이템명 검색 (예: 이스트 룬, 무한, 할리퀸 관모)
        </button>
      </div>

      <div class="modal-overlay" v-if="showItemModal" @click.self="showItemModal = false">
        <div class="modal-panel item-modal-panel">
          <button type="button" class="modal-close" @click="showItemModal = false">✕</button>
          <div class="d-section-title">아이템 선택</div>
          <input
            type="text" :value="form.itemName" @input="form.itemName = $event.target.value" placeholder="아이템명 검색 (예: 이스트 룬, 무한, 할리퀸 관모)"
            class="write-input" v-focus
          />
          <div class="item-modal-list">
            <button
              type="button" class="item-picker-row" v-for="it in itemCandidates" :key="it.id"
              @click="pickItem(it)"
            >
              <span class="item-picker-icon" :class="rarityClass(it)"><img v-if="iconUrlFor(it.icon_key)" :src="iconUrlFor(it.icon_key)" alt="" /></span>
              <span class="item-picker-name">{{ it.name_ko }} <small>{{ it.name_en }}</small></span>
              <span class="item-picker-row-cat">{{ it.category_label }}</span>
            </button>
            <template v-if="equipBaseCandidates.length">
              <div class="item-picker-section">매직·레어·일반 장비 (베이스)</div>
              <div class="item-picker-row equip-base-row" v-for="b in equipBaseCandidates" :key="'base-' + b.code">
                <button type="button" class="equip-base-main" @click="pickEquipBase(b)">
                  <span class="item-picker-icon"><img v-if="iconUrlFor(baseIconKey(b))" :src="iconUrlFor(baseIconKey(b))" alt="" /></span>
                  <span class="item-picker-name">{{ b.name_ko }} <small>{{ b.subtitle }}<template v-if="b.tier"> · {{ b.tier }}</template></small></span>
                </button>
                <span class="equip-quality-chips">
                  <button type="button" v-for="q in baseQualities(b)" :key="q" :class="'q-' + q" @click="pickEquipBase(b, q)">{{ QUALITY_SHORT[q] }}</button>
                </span>
              </div>
            </template>
            <div class="item-picker-empty-block" v-if="form.itemName.trim() && !itemCandidates.length">
              <p class="item-picker-empty">{{ equipBaseCandidates.length ? '찾는 게 없으면 종류를 골라 이 이름 그대로 등록' : '사전에 없는 아이템 - 종류를 고르면 이 이름 그대로 등록' }}</p>
              <div class="fallback-cat-row">
                <button
                  type="button" v-for="c in FALLBACK_CATEGORIES" :key="c"
                  :class="{ active: form.category === c }" @click="pickFallbackCategory(c)"
                >{{ c }}</button>
              </div>
            </div>
            <div class="item-modal-empty" v-if="!form.itemName.trim()">아이템명 입력</div>
          </div>
        </div>
      </div>

      <div class="material-box" v-if="materials.length">
        <div class="option-editor-title">필요한 룬 재료</div>
        <div class="material-rune-row">
          <span class="material-rune" v-for="(r, i) in materials" :key="i">
            <span class="material-rune-icon"><img v-if="iconUrlFor(r.icon_key)" :src="iconUrlFor(r.icon_key)" alt="" /></span>
            {{ r.name_ko }}
          </span>
        </div>
      </div>

      <div class="base-stats-ref" v-if="baseStatsRef && baseStatsRef.category !== 'misc' && !isUnidentified">
        <div class="option-editor-title">아이템 기본 정보 <span class="craft-sub-note">실제 아이템 값 입력</span></div>
        <div class="base-stats-ref-row">
          <span v-if="baseStatsRef.speed !== null && baseStatsRef.speed !== undefined">공격 속도 {{ baseStatsRef.speed }}</span>
          <span v-if="baseStatsRef.durability">내구도 {{ baseStatsRef.durability }}</span>
        </div>
        <BaseStatsInput v-model="armorStats" :defense="expectedDefense" :damage="expectedDamage" :ethereal="form.ethereal" />
        <div class="unit-hint" v-if="baseDefenseWarning">{{ baseDefenseWarning }}</div>
      </div>

      <div class="manual-kind-row" v-if="!selectedItem && form.category === '매직/레어/일반' && !selectedBaseItem">
        <div class="option-editor-title">베이스 종류 선택</div>
        <div class="fallback-cat-row">
          <button type="button" :class="{ active: manualBaseKind === 'weapon' }" @click="pickManualBaseKind('weapon')">무기</button>
          <button type="button" :class="{ active: manualBaseKind === 'armor' }" @click="pickManualBaseKind('armor')">방어구</button>
          <button type="button" :class="{ active: manualBaseKind === 'misc' }" @click="pickManualBaseKind('misc')">반지·목걸이·주얼·부적</button>
        </div>
        <div class="fallback-cat-row" v-if="manualBaseKind === 'misc'">
          <button
            type="button" v-for="b in MISC_BASES" :key="b.code" :class="{ active: selectedBaseItem?.code === b.code }"
            @click="pickMiscBase(b)"
          >{{ b.name_ko }}</button>
        </div>
      </div>

      <div class="manual-kind-row" v-if="isManualEquip && selectedBaseItem && selectedBaseItem.base_stats.category === 'misc'">
        <div class="option-editor-title">
          베이스: {{ selectedBaseItem.name_ko }}
          <button type="button" class="base-change-btn" @click="changeMiscBase">다른 베이스</button>
        </div>
        <template v-if="ICON_VARIANTS[selectedBaseItem.code]">
          <div class="option-editor-title shape-title">모양</div>
          <div class="shape-row">
            <button
              type="button" v-for="k in ICON_VARIANTS[selectedBaseItem.code]" :key="k" class="shape-btn"
              :class="{ active: (iconVariant || ICON_VARIANTS[selectedBaseItem.code][0]) === k }" :aria-label="`모양 ${k}`"
              @click="iconVariant = k"
            ><img v-if="iconUrlFor(k)" :src="iconUrlFor(k)" alt="" /></button>
          </div>
        </template>
      </div>

      <div class="manual-kind-row" v-if="lockedEquipBase">
        <div class="option-editor-title">
          베이스: {{ selectedBaseItem.name_ko }}
          <small class="base-sub">{{ selectedBaseItem.tier }} · {{ selectedBaseItem.type_sub }}</small>
          <button type="button" class="base-change-btn" @click="changeEquipBase">다른 베이스</button>
        </div>
        <div class="unit-hint" v-if="!itemQuality">품질(일반·매직·레어·크래프트) 먼저 선택</div>
      </div>

      <div class="option-editor" v-if="qualityChoices.length">
        <div class="option-editor-title">아이템 품질</div>
        <div class="fallback-cat-row">
          <button
            type="button" v-for="q in qualityChoices" :key="q" :class="{ active: itemQuality === q }"
            @click="pickQuality(q)"
          >{{ QUALITY_KO[q] }}</button>
        </div>
        <template v-if="isCrafted">
          <div class="option-editor-title">크래프트 제작법</div>
          <div class="fallback-cat-row">
            <button
              type="button" v-for="r in craftRecipes" :key="r.id" :class="{ active: craftPick.id === r.id }"
              @click="pickCraft(r.id)"
            >{{ r.name }}</button>
          </div>
          <template v-if="pickedCraft">
            <div class="option-editor-title craft-fixed-title">고정 옵션 <span class="craft-sub-note">항상 붙음</span></div>
            <div class="craft-fixed-list">
              <div class="option-row craft-fixed-row" v-for="(line, li) in familyLineSlots(pickedCraft.fam, craftPick.values)" :key="li">
                <span class="option-text fixed">{{ line.text }}</span>
                <template v-for="s in craftInputSlots.filter((c) => line.slots.includes(c.i))" :key="s.i">
                  <RangeInput v-model="craftPick.values[s.i]" :min="s.lo" :max="s.hi" :label="`${line.text} 수치 ${s.lo}~${s.hi}`" />
                </template>
              </div>
            </div>
          </template>
          <div class="unit-hint affix-error" v-for="e in craftErrors" :key="e">{{ e }}</div>
          <div class="option-editor-title">무작위 옵션 <span class="craft-sub-note">레어 옵션 중 1~4개 · 접두사·접미사 한 목록</span></div>
        </template>
        <template v-if="isAffixQuality">
          <AffixPicker :families="affixFamilies" :limits="pickerLimits" v-model="affixPicks" />
          <div class="unit-hint affix-error" v-for="e in affixErrors" :key="e">{{ e }}</div>
        </template>
      </div>

      <div class="base-stats-input" v-if="needsManualBaseStats">
        <div class="option-editor-title">
          <template v-if="lockedEquipBase">기본 정보</template>
          <template v-else>베이스 {{ effectiveBaseKind === 'armor' ? '방어구' : effectiveBaseKind === 'weapon' ? '무기' : '아이템' }} 정보</template>
          <span class="required-mark" v-if="isRuneword">필수</span>
        </div>

        <div class="base-item-picker" v-if="!lockedEquipBase">
          <div v-if="selectedBaseItem" class="item-picker-selected">
            <span class="item-picker-name">{{ baseItemLabel(selectedBaseItem) }}</span>
            <span class="item-picker-cat">{{ selectedBaseItem.tier }} · {{ selectedBaseItem.type_sub }}</span>
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
                <span class="item-picker-name">{{ baseItemLabel(b) }}</span>
                <span class="item-picker-row-cat">{{ b.tier }} · {{ b.type_sub }}{{ b.sockets ? ` · 최대 ${b.sockets}소켓` : '' }}</span>
              </button>
              <div class="item-picker-empty" v-if="!baseItemCandidates.length">
                {{ isRuneword ? '이 룬워드 베이스 중 일치 없음' : '일치하는 베이스 없음 - 아래 칸에 직접 입력' }}
              </div>
            </div>
          </div>
        </div>

        <div class="base-stats-ref-row" v-if="selectedBaseItem && !lockedEquipBase">
          <span v-if="selectedBaseItem.base_stats.speed !== null && selectedBaseItem.base_stats.speed !== undefined">공격 속도 {{ selectedBaseItem.base_stats.speed }}</span>
          <span v-if="selectedBaseItem.base_stats.durability">내구도 {{ selectedBaseItem.base_stats.durability }}</span>
          <span v-if="selectedBaseItem.base_stats.reqstr">요구 힘 {{ selectedBaseItem.base_stats.reqstr }}</span>
        </div>
        <BaseStatsInput v-model="armorStats" :defense="expectedDefense" :damage="expectedDamage" :ethereal="form.ethereal" />
        <div class="unit-hint" v-if="baseDefenseWarning">{{ baseDefenseWarning }}</div>

        <div class="base-mods" v-if="superiorCombos.length">
          <div class="option-editor-title">상급(Superior) 베이스 옵션</div>
          <div class="option-row">
            <select v-model="superiorPick.combo" class="write-select random-group-select" aria-label="상급 옵션 조합">
              <option value="">상급 아님 (일반 베이스)</option>
              <option v-for="(c, ci) in superiorCombos" :key="ci" :value="ci">{{ superiorComboLabel(c) }}</option>
            </select>
          </div>
          <div class="option-row" v-for="k in pickedSuperiorCombo || []" :key="k">
            <span class="option-text">{{ SUPERIOR_MODS[k].text.replace('{v}', `${SUPERIOR_MODS[k].min}~${SUPERIOR_MODS[k].max}`) }}</span>
            <RangeInput v-model="superiorPick.values[k]" :min="SUPERIOR_MODS[k].min" :max="SUPERIOR_MODS[k].max" :label="`${SUPERIOR_MODS[k].text} 수치`" />
          </div>
        </div>

        <div class="base-mods" v-if="lockedEquipBase && uniqueMaxSockets">
          <div class="option-editor-title">소켓</div>
          <div class="option-row">
            <select v-model="hasSockets" class="write-select random-group-select" aria-label="소켓 여부">
              <option :value="false">소켓 없음</option>
              <option :value="true">소켓 있음 (이 베이스 최대 {{ uniqueMaxSockets }}개)</option>
            </select>
          </div>
          <div class="option-row" v-if="hasSockets">
            <span class="option-text">소켓 개수 (1~{{ uniqueMaxSockets }})</span>
            <RangeInput v-model="uniqueSockets" :min="1" :max="uniqueMaxSockets" label="소켓 개수" />
          </div>
        </div>

        <div class="base-mods" v-if="lockedEquipBase && isAffixQuality && (socketAffixFam || larzukMax)">
          <div class="option-editor-title">소켓</div>
          <div class="option-row">
            <select v-model="socketSource" class="write-select random-group-select" aria-label="소켓 여부" @change="onSocketSource">
              <option value="">소켓 없음</option>
              <option value="affix" v-if="socketAffixFam">
                소켓 있음 · 옵션(접두사)으로 붙음 ({{ socketAffixRange[0] }}~{{ socketAffixRange[1] }}개)
              </option>
              <option value="larzuk" v-if="larzukMax">소켓 있음 · 라르주크 퀘스트로 뚫음 ({{ larzukMax > 1 ? `1~${larzukMax}` : '1' }}개)</option>
            </select>
          </div>
          <div class="option-editor-hint" v-if="socketSource === 'affix'">소켓 옵션이 접두사 한 칸 차지</div>
          <div class="option-row" v-if="socketSource === 'affix' && socketAffixRange">
            <span class="option-text">소켓 개수 ({{ socketAffixRange[0] }}~{{ socketAffixRange[1] }})</span>
            <RangeInput v-model="socketAffixCount" :min="socketAffixRange[0]" :max="socketAffixRange[1]" label="소켓 개수" />
          </div>
          <div class="option-row" v-if="socketSource === 'larzuk'">
            <span class="option-text">소켓 개수 (1~{{ larzukMax }})</span>
            <RangeInput v-model="uniqueSockets" :min="1" :max="larzukMax" label="소켓 개수" />
          </div>
        </div>

        <div class="base-mods" v-if="baseClassSkills || baseAutoMods.length">
          <div class="option-editor-title">베이스 자체 옵션</div>
          <div class="option-row" v-if="baseAutoMods.length">
            <select v-model="autoModPick.key" class="write-select random-group-select" aria-label="자동 옵션">
              <option value="">자동 옵션 선택 ({{ autoModNames }})</option>
              <option v-for="m in baseAutoMods" :key="m.key" :value="m.key">{{ m.text.replace('{v}', `${m.min}~${m.max}`) }}</option>
            </select>
            <select v-if="pickedAutoMod && pickedAutoMod.values" v-model="autoModPick.value" class="write-select option-value-select" aria-label="자동 옵션 수치">
              <option value="">수치</option>
              <option v-for="v in pickedAutoMod.values" :key="v" :value="v">{{ v }}</option>
            </select>
            <input
              v-else-if="pickedAutoMod" type="number" v-model="autoModPick.value" :min="pickedAutoMod.min" :max="pickedAutoMod.max"
              :class="{ invalid: outOfRange(autoModPick.value, pickedAutoMod) }"
              :placeholder="`${pickedAutoMod.min}~${pickedAutoMod.max}`" class="write-input option-value-input" aria-label="자동 옵션 수치"
            />
          </div>
          <template v-if="baseClassSkills">
            <div class="option-editor-hint">{{ baseClassSkills.name }} 스킬 최대 3개, 각 +1~3</div>
            <div class="option-row" v-for="(p, i) in classSkillPicks" :key="i">
              <select v-model="p.skill" class="write-select random-group-select" :aria-label="`${baseClassSkills.name} 스킬 ${i + 1}`">
                <option value="">{{ baseClassSkills.name }} 스킬 선택</option>
                <option v-for="s in classSkillOptionsFor(i)" :key="s.en" :value="s.en">{{ skillLabel(s) }}</option>
              </select>
              <RangeInput v-if="p.skill" v-model="p.level" :min="1" :max="3" prefix="+" :label="`스킬 ${i + 1} 레벨 1~3`" />
              <button
                type="button" class="class-skill-remove" v-if="classSkillPicks.length > 1 || p.skill"
                :aria-label="`스킬 ${i + 1} 삭제`" @click="removeClassSkillRow(i)"
              >✕</button>
            </div>
            <button
              type="button" class="class-skill-add" v-if="classSkillPicks.length < MAX_CLASS_SKILLS"
              @click="addClassSkillRow"
            >+ 스킬 추가 ({{ classSkillPicks.length }}/{{ MAX_CLASS_SKILLS }})</button>
          </template>
        </div>
      </div>

      <label class="unid-check" v-if="isUniqueOrSet">
        <input type="checkbox" v-model="form.unidentified" />
        미확인 아이템 <small>옵션 확인 전 - 수치 입력 없이 사전 범위로 표시</small>
      </label>

      <label class="ethereal-check" v-if="hasEthereal">
        <input type="checkbox" v-model="form.ethereal" />
        에테리얼(Ethereal) 아이템
      </label>

      <template v-if="selectedItem || form.category">
        <template v-if="hasQuantity">
          <input
            type="number" min="1" v-model="form.quantity" placeholder="개수 (예: 5)"
            class="write-input trade-quantity-input"
          />
        </template>
      </template>

      <div class="option-editor" v-if="itemAffixes.length && !isUnidentified">
        <div class="option-editor-title">실제 옵션 값 입력</div>
        <div class="option-row" v-for="(a, i) in itemAffixes" :key="i">
          <template v-if="isRandomClassSkillAffix(a)">
            <span class="option-text">직업 기술 레벨<template v-if="a.min === a.max"> +{{ a.min }}</template></span>
            <select v-model="randClassChoice[i]" class="write-select option-value-select">
              <option :value="undefined">직업 선택</option>
              <option v-for="c in CLASS_SKILL_OPTIONS" :key="c.code" :value="c.code">{{ c.name }}</option>
            </select>
            <input
              v-if="a.min !== a.max"
              type="number" v-model="rolledValues[i]" :placeholder="`${a.min}~${a.max}`"
              :min="Math.min(a.min, a.max)" :max="Math.max(a.min, a.max)" :class="{ invalid: outOfRange(rolledValues[i], a) }"
              class="write-input option-value-input"
            />
          </template>
          <template v-else-if="isRollRangeAffix(a)">
            <span class="option-text">{{ a.text }}</span>
            <input
              type="number" v-model="rolledValues[i]" :placeholder="`${a.min}~${a.max}`"
              :min="Math.min(a.min, a.max)" :max="Math.max(a.min, a.max)" :class="{ invalid: outOfRange(rolledValues[i], a) }"
              class="write-input option-value-input"
            />
          </template>
          <span class="option-text fixed" v-else>{{ a.text }}</span>
        </div>
      </div>

      <div class="option-editor" v-if="randomGroups.length && !isUnidentified">
        <div class="option-editor-title">제작 시 붙은 무작위 옵션</div>
        <div class="option-row" v-for="(g, gi) in randomGroups" :key="gi">
          <select v-model="groupChoice[gi]" class="write-select random-group-select" :aria-label="`${gi + 1}그룹 옵션`">
            <option :value="undefined">{{ gi + 1 }}그룹 옵션 선택</option>
            <option v-for="(o, oi) in g" :key="oi" :value="oi">{{ o.text }}</option>
          </select>
          <input
            v-if="g[groupChoice[gi]]"
            type="number" v-model="groupValues[gi]" :placeholder="`${g[groupChoice[gi]].min}~${g[groupChoice[gi]].max}`"
            :min="g[groupChoice[gi]].min" :max="g[groupChoice[gi]].max" :class="{ invalid: outOfRange(groupValues[gi], g[groupChoice[gi]]) }"
            class="write-input option-value-input" :aria-label="`${gi + 1}그룹 수치`"
          />
        </div>
      </div>

      <div class="option-editor" v-if="uniqueMaxSockets && !lockedEquipBase">
        <div class="option-editor-title">소켓</div>
        <div class="option-editor-hint">유니크·세트: 라르주크 퀘스트로 소켓 1개만</div>
        <div class="option-row">
          <select v-model="uniqueSockets" class="write-select random-group-select" aria-label="소켓 개수">
            <option value="">소켓 없음</option>
            <option :value="1">소켓 있음 · 라르주크 퀘스트로 뚫음 (1개)</option>
          </select>
        </div>
      </div>

      <div class="option-editor" v-if="allowsCustomOptions">
        <div class="option-editor-title">기타 옵션 직접 추가</div>
        <div class="custom-option-chip" v-for="(o, i) in customOptions" :key="i">
          <span>{{ o }}</span>
          <button type="button" @click="removeCustomOption(i)">✕</button>
        </div>
        <div class="custom-option-add-row">
          <select v-model="customOptionType" class="write-select custom-option-type-select">
            <option v-for="p in availableOptionPresets" :key="p.key" :value="p.key">{{ p.label }}</option>
          </select>
          <input
            :type="selectedOptionPreset.freeText ? 'text' : 'number'"
            v-model="customOptionValue"
            :placeholder="selectedOptionPreset.freeText ? (selectedOptionPreset.placeholder || '값 입력') : '수치 입력'"
            class="write-input custom-option-value-input"
            @keydown.enter.prevent="addCustomOption"
          />
          <button type="button" class="custom-option-add-btn" @click="addCustomOption">추가</button>
        </div>
      </div>
      </template>

      <template v-else>
      <div class="bundle-box">
        <div class="option-editor-title">묶어서 팔 룬·보석·재료 추가</div>
        <div class="bundle-chip-row" v-if="bundleItems.length">
          <div class="bundle-chip" v-for="(b, i) in bundleItems" :key="b.item.id">
            <span class="item-picker-icon" :class="rarityClass(b.item)"><img v-if="iconUrlFor(b.item.icon_key)" :src="iconUrlFor(b.item.icon_key)" alt="" /></span>
            <span class="bundle-chip-name">{{ b.item.name_ko }}</span>
            <input type="number" min="1" v-model="b.qty" class="bundle-chip-qty" />
            <span class="bundle-chip-unit">개</span>
            <button type="button" @click="removeBundleItem(i)">✕</button>
          </div>
        </div>
        <div class="item-picker">
          <div class="item-picker-search-wrap">
            <input
              type="text" :value="bundleQuery" placeholder="이름 검색 (예: 이스트 룬, 최상급 자수정, 파괴의 열쇠)"
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
                <span class="item-picker-name">{{ it.name_ko }} <small>{{ it.name_en }}</small></span>
              </button>
              <div class="item-picker-empty" v-if="!bundleCandidates.length">일치하는 룬·보석·재료 없음</div>
            </div>
          </div>
        </div>
      </div>
      </template>

      <label class="negotiable-check">
        <input type="checkbox" v-model="form.negotiable" />
        흥정 가능
      </label>

      <div class="price-picker">
        <div class="option-editor-title">희망 가격</div>
        <div class="bundle-chip-row" v-if="priceItems.length">
          <div class="bundle-chip" v-for="(p, i) in priceItems" :key="p.item.id">
            <span class="item-picker-icon gem"><img v-if="iconUrlFor(p.item.icon_key)" :src="iconUrlFor(p.item.icon_key)" alt="" /></span>
            <span class="bundle-chip-name">{{ p.item.name_ko }}</span>
            <input type="number" min="1" v-model="p.qty" class="bundle-chip-qty" />
            <span class="bundle-chip-unit">개</span>
            <button type="button" @click="removePriceItem(i)">✕</button>
          </div>
        </div>
        <button type="button" class="item-picker-trigger" @click="openPriceModal">
          {{ priceItems.length ? '+ 더 추가하기' : '받을 룬·보석·재료 검색 (예: 이스트 룬, 파괴의 열쇠)' }}
        </button>
      </div>

      <div class="modal-overlay" v-if="showPriceModal" @click.self="showPriceModal = false">
        <div class="modal-panel item-modal-panel">
          <button type="button" class="modal-close" @click="showPriceModal = false">✕</button>
          <div class="d-section-title">희망 가격 선택</div>
          <input
            type="text" :value="priceQuery" @input="priceQuery = $event.target.value" placeholder="이름 검색 (예: 이스트 룬, 최상급 자수정, 파괴의 열쇠)"
            class="write-input" v-focus aria-label="룬·보석·재료 검색"
          />
          <div class="item-modal-list">
            <button
              type="button" class="item-picker-row" v-for="it in priceCandidates" :key="it.id"
              @click="pickPriceItem(it)"
            >
              <span class="item-picker-icon gem"><img v-if="iconUrlFor(it.icon_key)" :src="iconUrlFor(it.icon_key)" alt="" /></span>
              <span class="item-picker-name">{{ it.name_ko }} <small>{{ it.name_en }}</small></span>
              <span class="item-picker-row-cat price-picked" v-if="priceQtyOf(it)">담김 {{ priceQtyOf(it) }}개</span>
            </button>
            <div class="item-modal-empty" v-if="!priceCandidates.length">일치하는 룬·보석·재료 없음</div>
          </div>
        </div>
      </div>

      <div class="trade-form-row">
        <select v-model="form.ladder" class="write-select trade-meta-select">
          <option v-for="l in TRADE_LADDERS" :key="l" :value="l">{{ l }}</option>
        </select>
        <select v-model="form.hardcore" class="write-select trade-meta-select">
          <option v-for="h in TRADE_HARDCORE" :key="h" :value="h">{{ h }}</option>
        </select>
      </div>

      <RichEditor v-model="form.content" placeholder="추가 설명 (옵션 정보, 거래 방식 등)" min-height="220px" />

      <div class="tooltip-preview" v-if="previewTooltip">
        <div class="option-editor-title">미리보기</div>
        <ItemTooltipCanvas :tooltip="previewTooltip" :file-name="form.itemName" />
      </div>

      <div class="trade-new-actions">
        <router-link to="/trade" class="trade-new-cancel">취소</router-link>
        <button class="btn-primary write-submit" :disabled="saving" @click="submitPost">등록하기</button>
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
.tooltip-preview{border:1px solid var(--border-soft); background:var(--panel); padding:16px 18px; border-radius:14px; display:flex; flex-direction:column; gap:8px; align-items:center;}
.tooltip-preview .option-editor-title, .tooltip-preview .option-editor-hint{align-self:stretch;}
.base-mods{display:flex; flex-direction:column; gap:8px; border-top:1px dashed var(--border); padding-top:12px; margin-top:2px;}
.class-skill-remove{flex:none; color:var(--text-dim); font-size:12px; padding:4px 6px;}
.class-skill-remove:hover{color:var(--text);}
.class-skill-add{align-self:flex-start; font-size:12.5px; color:var(--gold); border:1px dashed var(--gold-dim); padding:7px 14px; border-radius:10px; background:transparent;}
.class-skill-add:hover{background:var(--panel-2);}
.base-stats-input-row{display:flex; gap:12px; flex-wrap:wrap;}
.base-stats-input-row label{
  flex:1; min-width:140px; display:flex; flex-direction:column; gap:6px; font-size:11.5px; color:var(--text-dim);
}

.trade-new-actions{display:flex; align-items:center; gap:10px;}
.form-error{font-size:12.5px; color:var(--blood);}
.required-mark{font-size:10px; color:var(--blood); border:1px solid var(--blood); padding:1px 7px; border-radius:999px; font-weight:600; vertical-align:middle;}
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
</style>
