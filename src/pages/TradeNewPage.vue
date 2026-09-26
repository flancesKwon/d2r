<script setup>
import HeaderNotifications from '../components/HeaderNotifications.vue'
import LogoMark from '../components/LogoMark.vue'
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
} from '../tradeStore.js'
import iconsData from '../data/icons.json'
import MarkdownEditor from '../components/MarkdownEditor.vue'
import { profileState } from '../profileStore.js'

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
  return searchAllItems(bundleQuery.value).filter((it) => it.category === 'gem')
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
const hasEthereal = computed(() => categorySupportsEthereal(form.value.category))
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
  if (!effectiveBaseKind.value) return false
  if (selectedItem.value && (selectedItem.value.category === 'unique' || selectedItem.value.category === 'set')) return false
  return true
})

const armorStats = ref({ baseDefense: '', extraDefensePct: '', extraDurability: '' })
const weaponStats = ref({ extraDamagePct: '', extraDurability: '', extraSkill: '' })

// 룬워드·매직/레어/일반은 베이스로 쓴 실제 방어구/무기를 검색해서 고를 수 있게 함 -
// 고르면 그 베이스가 원래 갖고 있는 방어력/데미지·내구도가 자동으로 채워짐
const selectedBaseItem = ref(null)
const baseItemQuery = ref('')
const showBaseItemDropdown = ref(false)
const isRuneword = computed(() => selectedItem.value?.category === 'runeword')
// 룬워드는 만들 수 있는 베이스(허용 종류 + 필요 소켓 수)만 후보로 보여줌
const baseItemCandidates = computed(() =>
  selectedBaseItem.value
    ? []
    : searchBaseItems(baseItemQuery.value, effectiveBaseKind.value, isRuneword.value ? selectedItem.value : null)
)
const RUNEWORD_TYPE_KO = {
  tors: '갑옷', shld: '방패', helm: '투구', weap: '모든 무기', mele: '근접 무기', miss: '활·석궁', swor: '검',
  axe: '도끼', hamm: '망치', mace: '철퇴', club: '곤봉', pole: '폴암', spea: '창', staf: '지팡이', scep: '홀',
  knif: '단검', wand: '완드', h2h: '어쌔신 클로', grim: '마법서', head: '네크로맨서 방패', ashd: '팔라딘 방패',
}
const runewordBaseRule = computed(() => {
  const it = selectedItem.value
  if (!isRuneword.value) return ''
  const kinds = (it.subtitle || '').split('+').map((c) => RUNEWORD_TYPE_KO[c.trim()] || c.trim())
  const sockets = it.extra?.socket_count
  return `${kinds.join('·')}${sockets ? ` · ${sockets}소켓` : ''}`
})
const basePickerPlaceholder = computed(() => {
  if (isRuneword.value) return '베이스 검색 또는 목록에서 선택 (예: 아칸 플레이트, 엘리트)'
  return effectiveBaseKind.value === 'weapon'
    ? '베이스 무기 검색 (예: 콜로서스 블레이드, Bardiche)'
    : '베이스 방어구 검색 (예: 카이트 실드, Field Plate)'
})
// 입력한 기본 방어력이 고른 베이스의 범위를 벗어나면 알려줌 (에테리얼은 1.5배까지)
const baseDefenseWarning = computed(() => {
  const base = selectedBaseItem.value?.base_stats
  const v = armorStats.value.baseDefense
  if (!base || base.category !== 'armor' || v === '' || v === null) return ''
  const mul = form.value.ethereal ? 1.5 : 1
  const lo = Math.floor(base.minac * mul), hi = Math.floor(base.maxac * mul)
  return Number(v) < lo || Number(v) > hi
    ? `고른 베이스의 기본 방어력 범위(${lo}~${hi}${form.value.ethereal ? ', 에테리얼' : ''})를 벗어나요. 다시 확인해 주세요.`
    : ''
})
function pickBaseItem(b) {
  selectedBaseItem.value = b
  showBaseItemDropdown.value = false
}
function clearBaseItem() {
  selectedBaseItem.value = null
  baseItemQuery.value = ''
}
function hideBaseItemDropdownSoon() {
  window.setTimeout(() => (showBaseItemDropdown.value = false), 150)
}

function resetBaseStats() {
  armorStats.value = { baseDefense: '', extraDefensePct: '', extraDurability: '' }
  weaponStats.value = { extraDamagePct: '', extraDurability: '', extraSkill: '' }
  clearBaseItem()
}

function buildBaseStatOptions() {
  const out = []
  if (selectedBaseItem.value) out.push(`베이스: ${baseItemLabel(selectedBaseItem.value)}`)
  if (effectiveBaseKind.value === 'armor') {
    // 실제 방어력을 입력했으면 그 값, 안 했으면 고른 베이스의 방어력 범위를 그대로 씀
    const base = selectedBaseItem.value?.base_stats
    const baseDefense = armorStats.value.baseDefense || (base ? `${base.minac}~${base.maxac}` : '')
    if (baseDefense) out.push(`기본 방어력 ${baseDefense}`)
    if (armorStats.value.extraDefensePct) out.push(`증가된 방어력 +${armorStats.value.extraDefensePct}%`)
    if (armorStats.value.extraDurability) out.push(`추가 내구도 +${armorStats.value.extraDurability}`)
  } else if (effectiveBaseKind.value === 'weapon') {
    const base = selectedBaseItem.value?.base_stats
    const dmg = weaponDamageRange(base)
    if (dmg) out.push(`기본 데미지 ${dmg.min}~${dmg.max}`)
    if (weaponStats.value.extraDamagePct) out.push(`증가된 데미지 +${weaponStats.value.extraDamagePct}%`)
    if (weaponStats.value.extraDurability) out.push(`추가 내구도 +${weaponStats.value.extraDurability}`)
    if (weaponStats.value.extraSkill.trim()) out.push(weaponStats.value.extraSkill.trim())
  }
  return out
}

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
  const b64 = iconKey && iconsData[iconKey]
  return b64 ? 'data:image/png;base64,' + b64 : null
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

function pickFallbackCategory(cat) {
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
const PRICE_CURRENCIES = itemsData.filter((it) => it.category === 'gem')
const RUNES_HIGH_FIRST = PRICE_CURRENCIES
  .filter((it) => it.type_sub === '룬')
  .sort((a, b) => (itemLevelReq(b) ?? 0) - (itemLevelReq(a) ?? 0))
const priceCandidates = computed(() => {
  const q = priceQuery.value.trim().toLowerCase()
  if (!q) return RUNES_HIGH_FIRST
  return PRICE_CURRENCIES.filter(
    (it) =>
      it.name_ko.toLowerCase().includes(q) ||
      it.name_en.toLowerCase().includes(q) ||
      (it.aliases || []).some((a) => a.toLowerCase().includes(q))
  )
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

function submitBundle() {
  if (!bundleItems.value.length) { formError.value = '팔 룬·보석을 하나 이상 담아주세요.'; return }
  if (!priceItems.value.length) { formError.value = '희망 가격으로 받을 룬·보석을 하나 이상 골라주세요.'; return }
  formError.value = ''
  const itemName = bundleItems.value.map((b) => `${b.item.name_ko} ${b.qty}개`).join(' + ')
  const category = tradeCategoryForItem(bundleItems.value[0].item) || '룬'
  const post = addTradePost({
    ...form.value,
    category,
    itemId: bundleItems.value[0].item.id,
    itemName,
    amountLabel: `${bundleItems.value.length}종 묶음`,
    options: [],
    price: buildPriceString(),
    author: profileState.nickname,
    contact: profileState.contact,
  })
  router.push(`/trade/${post.id}`)
}

function submitPost() {
  if (bundleMode.value) return submitBundle()
  const amountLabel = hasQuantity.value ? buildAmountLabel(form.value.quantity) : '1개'
  if (!form.value.itemName.trim()) { formError.value = '아이템을 검색해서 선택하거나 이름을 입력해주세요.'; return }
  if (!amountLabel.trim()) { formError.value = '개수를 입력해주세요.'; return }
  if (selectedItem.value?.category === 'runeword' && !selectedBaseItem.value) {
    formError.value = '룬워드는 베이스 아이템을 검색해서 선택해야 등록할 수 있어요.'
    return
  }
  if (!priceItems.value.length) { formError.value = '희망 가격으로 받을 룬·보석을 하나 이상 골라주세요.'; return }
  formError.value = ''
  const dbOptions = itemAffixes.value.map((a, i) => {
    if (isRandomClassSkillAffix(a)) return resolveRandomClassSkillText(a, randClassChoice.value[i], rolledValues.value[i])
    return isRollRangeAffix(a) ? resolveAffixText(a, rolledValues.value[i]) : a.text
  })
  const options = [
    ...dbOptions, ...buildRandomGroupOptions(), ...buildMaterialsOption(), ...buildBaseStatOptions(), ...customOptions.value,
  ]
  const post = addTradePost({
    ...form.value,
    amountLabel,
    options,
    price: buildPriceString(),
    author: profileState.nickname,
    contact: profileState.contact,
  })
  router.push(`/trade/${post.id}`)
}
</script>

<template>
  <div class="items-page trade-new-page">
  <header>
    <div class="logo">
      <router-link to="/" style="display: flex; align-items: center; gap: 8px; color: inherit">
        <LogoMark />디아허브
      </router-link>
    </div>
    <div class="crumb">
      <router-link to="/">메인</router-link> / <router-link to="/trade">거래게시판</router-link> / <b>판매글 등록</b>
    </div>
    <HeaderNotifications />
  </header>

  <div class="patch-hero">
    <div class="patch-hero-inner">
      <div class="eyebrow">판매글 등록</div>
      <h1>아이템 등록하기</h1>
      <p>아이템을 검색해서 고르면 카테고리와 옵션이 자동으로 맞춰져요. 룬워드·매직/레어/일반은 베이스 아이템 정보도 같이 입력할 수 있어요.</p>
    </div>
  </div>

  <div class="grid-wrap trade-new-wrap">
    <div class="write-form trade-write-form">
      <div class="form-mode-toggle">
        <button type="button" :class="{ active: !bundleMode }" @click="setBundleMode(false)">단일 아이템 등록</button>
        <button type="button" :class="{ active: bundleMode }" @click="setBundleMode(true)">룬·보석 묶음 판매</button>
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
          아이템명을 검색해서 선택하세요 (예: 이스트 룬, 무한, 할리퀸 관모)
        </button>
      </div>

      <div class="modal-overlay" v-if="showItemModal" @click.self="showItemModal = false">
        <div class="modal-panel item-modal-panel">
          <button type="button" class="modal-close" @click="showItemModal = false">✕</button>
          <div class="d-section-title">아이템 선택</div>
          <input
            type="text" v-model="form.itemName" placeholder="아이템명 검색 (예: 이스트 룬, 무한, 할리퀸 관모)"
            class="write-input" v-focus
          />
          <div class="item-picker-hint">룬·보석·유니크·세트·룬워드·우버보스 재료를 모두 검색할 수 있어요. 룬워드는 "룬워드"가 아니라 무한·인챈트처럼 완성된 룬워드 이름으로 검색하세요.</div>
          <div class="item-modal-list">
            <button
              type="button" class="item-picker-row" v-for="it in itemCandidates" :key="it.id"
              @click="pickItem(it)"
            >
              <span class="item-picker-icon" :class="rarityClass(it)"><img v-if="iconUrlFor(it.icon_key)" :src="iconUrlFor(it.icon_key)" alt="" /></span>
              <span class="item-picker-name">{{ it.name_ko }} <small>{{ it.name_en }}</small></span>
              <span class="item-picker-row-cat">{{ it.category_label }}</span>
            </button>
            <div class="item-picker-empty-block" v-if="form.itemName.trim() && !itemCandidates.length">
              <p class="item-picker-empty">사전에 없는 아이템이에요. 종류를 고르면 이 이름 그대로 등록돼요.</p>
              <div class="fallback-cat-row">
                <button
                  type="button" v-for="c in FALLBACK_CATEGORIES" :key="c"
                  :class="{ active: form.category === c }" @click="pickFallbackCategory(c)"
                >{{ c }}</button>
              </div>
            </div>
            <div class="item-modal-empty" v-if="!form.itemName.trim()">아이템명을 입력해서 검색하세요.</div>
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

      <div class="base-stats-ref" v-if="baseStatsRef">
        <div class="option-editor-title">베이스 아이템 기본 정보</div>
        <div class="base-stats-ref-row" v-if="baseStatsRef.category === 'armor'">
          <span>기본 방어력 {{ baseStatsRef.minac }}~{{ baseStatsRef.maxac }}</span>
          <span>내구도 {{ baseStatsRef.durability }}</span>
        </div>
        <div class="base-stats-ref-row" v-else-if="baseStatsRef.category === 'weapon'">
          <span>기본 데미지 {{ weaponDamageRange(baseStatsRef)?.min }}~{{ weaponDamageRange(baseStatsRef)?.max }}</span>
          <span v-if="baseStatsRef.speed !== null && baseStatsRef.speed !== undefined">공격 속도 {{ baseStatsRef.speed }}</span>
          <span>내구도 {{ baseStatsRef.durability }}</span>
        </div>
      </div>

      <div class="manual-kind-row" v-if="!selectedItem && form.category === '매직/레어/일반'">
        <div class="option-editor-title">베이스 종류를 골라주세요</div>
        <div class="fallback-cat-row">
          <button type="button" :class="{ active: manualBaseKind === 'weapon' }" @click="pickManualBaseKind('weapon')">무기</button>
          <button type="button" :class="{ active: manualBaseKind === 'armor' }" @click="pickManualBaseKind('armor')">방어구</button>
        </div>
      </div>

      <div class="base-stats-input" v-if="needsManualBaseStats">
        <div class="option-editor-title">
          베이스 {{ effectiveBaseKind === 'armor' ? '방어구' : effectiveBaseKind === 'weapon' ? '무기' : '아이템' }} 정보
          <span class="required-mark" v-if="isRuneword">필수</span>
        </div>
        <div class="option-editor-hint" v-if="isRuneword">
          이 룬워드를 만들 수 있는 베이스만 보여줘요 ({{ runewordBaseRule }}). 실제로 쓴 베이스를 고르세요.
        </div>
        <div class="option-editor-hint" v-else>
          실제 아이템의 베이스를 검색해서 고르면 기본 {{ effectiveBaseKind === 'weapon' ? '데미지' : '방어력' }} 범위가 표시돼요. 못 찾으면 아래 칸만 입력해도 돼요.
        </div>

        <div class="base-item-picker">
          <div v-if="selectedBaseItem" class="item-picker-selected">
            <span class="item-picker-name">{{ baseItemLabel(selectedBaseItem) }}</span>
            <span class="item-picker-cat">{{ selectedBaseItem.tier }} · {{ selectedBaseItem.type_sub }}</span>
            <button type="button" class="item-picker-clear" @click="clearBaseItem">✕</button>
          </div>
          <div v-else class="item-picker-search-wrap">
            <input
              type="text" v-model="baseItemQuery" :placeholder="basePickerPlaceholder"
              class="write-input" @focus="showBaseItemDropdown = true" @input="showBaseItemDropdown = true"
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
                {{ isRuneword ? '이 룬워드를 만들 수 있는 베이스 중 일치하는 게 없어요.' : '일치하는 베이스가 없어요. 아래 칸에 직접 입력하세요.' }}
              </div>
            </div>
          </div>
        </div>

        <template v-if="effectiveBaseKind === 'armor'">
          <div class="base-stats-ref-row" v-if="selectedBaseItem">
            <span>기본 방어력 범위 {{ selectedBaseItem.base_stats.minac }}~{{ selectedBaseItem.base_stats.maxac }}</span>
            <span v-if="selectedBaseItem.base_stats.durability">내구도 {{ selectedBaseItem.base_stats.durability }}</span>
            <span v-if="selectedBaseItem.base_stats.reqstr">요구 힘 {{ selectedBaseItem.base_stats.reqstr }}</span>
          </div>
          <div class="base-stats-input-row">
            <label>
              기본 방어력
              <input
                type="number" v-model="armorStats.baseDefense" class="write-input"
                :placeholder="selectedBaseItem ? `${selectedBaseItem.base_stats.minac}~${selectedBaseItem.base_stats.maxac}` : '예: 80'"
              />
            </label>
            <label>증가된 방어력(%)<input type="number" v-model="armorStats.extraDefensePct" class="write-input" placeholder="예: 15" /></label>
            <label>추가 내구도<input type="number" v-model="armorStats.extraDurability" class="write-input" placeholder="예: 5" /></label>
          </div>
          <div class="unit-hint" v-if="baseDefenseWarning">{{ baseDefenseWarning }}</div>
        </template>

        <template v-else-if="effectiveBaseKind === 'weapon'">
          <div class="base-stats-ref-row" v-if="selectedBaseItem">
            <span>기본 데미지 {{ weaponDamageRange(selectedBaseItem.base_stats)?.min }}~{{ weaponDamageRange(selectedBaseItem.base_stats)?.max }}</span>
            <span v-if="selectedBaseItem.base_stats.speed !== null && selectedBaseItem.base_stats.speed !== undefined">공격 속도 {{ selectedBaseItem.base_stats.speed }}</span>
            <span v-if="selectedBaseItem.base_stats.durability">내구도 {{ selectedBaseItem.base_stats.durability }}</span>
          </div>
          <div class="base-stats-input-row">
            <label>증가된 데미지(%)<input type="number" v-model="weaponStats.extraDamagePct" class="write-input" placeholder="예: 20" /></label>
            <label>추가 내구도<input type="number" v-model="weaponStats.extraDurability" class="write-input" placeholder="예: 5" /></label>
            <label>추가 스킬<input type="text" v-model="weaponStats.extraSkill" class="write-input" placeholder="예: +3 파이어볼" /></label>
          </div>
        </template>
      </div>

      <label class="ethereal-check" v-if="hasEthereal">
        <input type="checkbox" v-model="form.ethereal" />
        에테리얼(Ethereal) 아이템이에요
      </label>

      <template v-if="selectedItem || form.category">
        <template v-if="hasQuantity">
          <input
            type="number" min="1" v-model="form.quantity" placeholder="개수 (예: 5)"
            class="write-input trade-quantity-input"
          />
          <div class="unit-hint">개수만 입력하면 "N개"로 등록돼요.</div>
        </template>
        <div class="unit-hint" v-else>장비·재료는 낱개(1개) 단위로 등록돼요.</div>
      </template>

      <div class="option-editor" v-if="itemAffixes.length">
        <div class="option-editor-title">실제 옵션 값 입력</div>
        <div class="option-editor-hint">범위로 나오는 옵션은 이 아이템에 실제로 뜬 값을 직접 입력해주세요. 비워두면 범위 그대로 표시돼요.</div>
        <div class="option-row" v-for="(a, i) in itemAffixes" :key="i">
          <template v-if="isRandomClassSkillAffix(a)">
            <span class="option-text">직업 기술 레벨 (아이템마다 직업 하나로 고정돼서 나와요)</span>
            <select v-model="randClassChoice[i]" class="write-select option-value-select">
              <option value="">직업 선택</option>
              <option v-for="c in CLASS_SKILL_OPTIONS" :key="c.code" :value="c.code">{{ c.name }}</option>
            </select>
            <input
              type="number" v-model="rolledValues[i]" :placeholder="`${a.min}~${a.max}`"
              class="write-input option-value-input"
            />
          </template>
          <template v-else-if="isRollRangeAffix(a)">
            <span class="option-text">{{ a.text }}</span>
            <input
              type="number" v-model="rolledValues[i]" :placeholder="`${a.min}~${a.max}`"
              class="write-input option-value-input"
            />
          </template>
          <span class="option-text fixed" v-else>{{ a.text }}</span>
        </div>
      </div>

      <div class="option-editor" v-if="randomGroups.length">
        <div class="option-editor-title">제작 시 붙은 무작위 옵션</div>
        <div class="option-editor-hint">그룹마다 하나씩 붙어 있어요. 실제로 붙은 옵션을 고르고 수치를 입력하세요. 모르는 그룹은 비워둬도 돼요.</div>
        <div class="option-row" v-for="(g, gi) in randomGroups" :key="gi">
          <select v-model="groupChoice[gi]" class="write-select random-group-select" :aria-label="`${gi + 1}그룹 옵션`">
            <option :value="undefined">{{ gi + 1 }}그룹 옵션 선택</option>
            <option v-for="(o, oi) in g" :key="oi" :value="oi">{{ o.text }}</option>
          </select>
          <input
            v-if="g[groupChoice[gi]]"
            type="number" v-model="groupValues[gi]" :placeholder="`${g[groupChoice[gi]].min}~${g[groupChoice[gi]].max}`"
            class="write-input option-value-input" :aria-label="`${gi + 1}그룹 수치`"
          />
        </div>
      </div>

      <div class="option-editor" v-if="selectedItem || form.category">
        <div class="option-editor-title">기타 옵션 직접 추가</div>
        <div class="option-editor-hint">위에 없는 스탯(생명력, 저항, 소켓 개수 등)은 종류를 고르고 값을 입력해서 추가하세요.</div>
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
        <div class="option-editor-title">묶어서 팔 룬·보석 추가</div>
        <div class="option-editor-hint">서로 다른 룬·보석을 여러 개 골라서 한 번에 팔 수 있어요 (예: 베르 룬 1개 + 퍼펙트 자수정 5개).</div>
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
              type="text" v-model="bundleQuery" placeholder="룬·보석 이름 검색 (예: 이스트 룬, 최상급 자수정)"
              class="write-input" @focus="showBundleDropdown = true"
              @input="showBundleDropdown = true"
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
              <div class="item-picker-empty" v-if="!bundleCandidates.length">일치하는 룬·보석이 없어요.</div>
            </div>
          </div>
        </div>
      </div>
      </template>

      <label class="negotiable-check">
        <input type="checkbox" v-model="form.negotiable" />
        흥정 가능 (체크하면 구매자가 "구매하기"를 누를 때 룬·보석으로 교환 제안을 할 수 있어요)
      </label>

      <div class="price-picker">
        <div class="option-editor-title">희망 가격 (룬·보석으로 받을 개수)</div>
        <div class="option-editor-hint">받고 싶은 룬·보석을 검색해서 고르고 개수를 입력하세요. 여러 종류를 섞어서 받을 수도 있어요 (예: 이스트 룬 2개 + 최상급 다이아몬드 5개).</div>
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
          {{ priceItems.length ? '+ 룬·보석 더 추가하기' : '받고 싶은 룬·보석을 검색해서 선택하세요 (예: 이스트 룬, 최상급 자수정)' }}
        </button>
      </div>

      <div class="modal-overlay" v-if="showPriceModal" @click.self="showPriceModal = false">
        <div class="modal-panel item-modal-panel">
          <button type="button" class="modal-close" @click="showPriceModal = false">✕</button>
          <div class="d-section-title">희망 가격 룬·보석 선택</div>
          <input
            type="text" v-model="priceQuery" placeholder="룬·보석 이름 검색 (예: 이스트 룬, 최상급 자수정)"
            class="write-input" v-focus aria-label="룬·보석 검색"
          />
          <div class="item-picker-hint">
            {{ priceQuery.trim() ? '고르면 1개가 담기고, 개수는 담은 뒤에 바꿀 수 있어요. 같은 걸 또 고르면 1개씩 늘어나요.' : '검색어가 없을 땐 룬을 높은 등급부터 보여줘요. 보석은 이름으로 검색하세요.' }}
          </div>
          <div class="item-modal-list">
            <button
              type="button" class="item-picker-row" v-for="it in priceCandidates" :key="it.id"
              @click="pickPriceItem(it)"
            >
              <span class="item-picker-icon gem"><img v-if="iconUrlFor(it.icon_key)" :src="iconUrlFor(it.icon_key)" alt="" /></span>
              <span class="item-picker-name">{{ it.name_ko }} <small>{{ it.name_en }}</small></span>
              <span class="item-picker-row-cat price-picked" v-if="priceQtyOf(it)">담김 {{ priceQtyOf(it) }}개</span>
            </button>
            <div class="item-modal-empty" v-if="!priceCandidates.length">일치하는 룬·보석이 없어요.</div>
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

      <MarkdownEditor v-model="form.content" placeholder="추가 설명을 입력하세요 (옵션 정보, 거래 방식 등)" min-height="260px" />

      <div class="trade-new-actions">
        <router-link to="/trade" class="trade-new-cancel">취소</router-link>
        <button class="btn-primary write-submit" @click="submitPost">등록하기</button>
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
.item-picker-hint{font-size:11px; color:var(--text-dim); margin-top:6px; line-height:1.5;}
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
.item-picker-empty{text-align:center; color:var(--text-dim); font-size:12px; margin:0 0 10px;}
.fallback-cat-row{display:flex; justify-content:center; gap:8px;}
.fallback-cat-row button{
  font-size:12px; color:var(--text-muted); border:1px solid var(--border); padding:7px 16px; border-radius:999px;
}
.fallback-cat-row button:hover{border-color:var(--gold-dim); color:var(--gold);}
.fallback-cat-row button.active{color:var(--gold); border-color:var(--gold-dim); background:var(--panel);}

.option-editor{border:1px solid var(--border-soft); background:var(--panel); padding:16px 18px; display:flex; flex-direction:column; gap:10px; border-radius:14px;}
.option-editor-title{font-size:12.5px; color:var(--gold-dim); font-weight:600;}
.option-editor-hint{font-size:11px; color:var(--text-dim); margin-top:-4px;}
.option-row{display:flex; align-items:center; gap:10px;}
.option-text{font-size:12.5px; color:var(--text-muted); flex:1;}
.option-text.fixed{color:var(--text-dim);}
.option-value-input{width:100px; padding:6px 8px !important; font-size:12.5px !important; flex:none; border-radius:8px !important;}
.random-group-select{flex:1; min-width:0; padding:6px 8px !important; font-size:12.5px !important; border-radius:8px !important;}
.option-value-select{width:110px; padding:6px 8px !important; font-size:12.5px !important; flex:none; border-radius:8px !important;}

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
</style>
