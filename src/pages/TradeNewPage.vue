<script setup>
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
  itemBaseKind,
  runewordMaterials,
} from '../tradeStore.js'
import iconsData from '../data/icons.json'
import MarkdownEditor from '../components/MarkdownEditor.vue'

const router = useRouter()

// 카테고리는 직접 고르지 않고 아이템 검색으로 자동 결정됨. 사전에 없는
// 아이템(매직/레어/일반, 기타)만 검색 결과가 없을 때 뜨는 버튼으로 고를 수 있음
const FALLBACK_CATEGORIES = ['매직/레어/일반', '기타']

const emptyForm = () => ({
  category: FALLBACK_CATEGORIES[0],
  itemId: null,
  itemName: '',
  quantity: '',
  ethereal: false,
  price: '',
  realm: TRADE_REALMS[0],
  ladder: TRADE_LADDERS[0],
  hardcore: TRADE_HARDCORE[0],
  author: '',
  contact: '',
  content: '',
})
const form = ref(emptyForm())

const hasQuantity = computed(() => categoryHasQuantity(form.value.category))
const hasEthereal = computed(() => categorySupportsEthereal(form.value.category))
const showItemDropdown = ref(false)
// 카테고리를 먼저 고르지 않아도 아이템명만 치면 사전 전체(룬·보석·유니크·세트·룬워드) +
// 우버보스 재료 목록에서 검색되고, 고르면 카테고리가 자동으로 맞춰짐 - 그래도 없으면
// (매직/레어/일반, 기타처럼 매번 랜덤하거나 목록화가 불가능한 경우) 직접 입력한 이름 그대로 등록
const itemCandidates = computed(() => (form.value.itemId ? [] : searchAllItems(form.value.itemName)))
const selectedItem = computed(() => getTradeItem(form.value.itemId))
const itemAffixes = computed(() => getItemAffixes(selectedItem.value))
const rolledValues = ref({})
const customOptions = ref([])

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

const effectiveBaseKind = computed(() => itemBaseKind(selectedItem.value) || manualBaseKind.value)

// 룬워드·매직/레어/일반은 베이스로 쓴 실물 아이템이 매번 달라서(어떤 방어구/무기를
// 썼는지) 판매자가 직접 입력해야 함 - 유니크·세트는 이미 base_stats로 고정돼 있어서
// 입력칸 대신 위의 참고 표시만 함
const needsManualBaseStats = computed(() => {
  if (!effectiveBaseKind.value) return false
  if (selectedItem.value && (selectedItem.value.category === 'unique' || selectedItem.value.category === 'set')) return false
  return true
})

const armorStats = ref({ baseDefense: '', extraDefensePct: '', extraDurability: '' })
const weaponStats = ref({ extraDamagePct: '', extraDurability: '', extraSkill: '' })
function resetBaseStats() {
  armorStats.value = { baseDefense: '', extraDefensePct: '', extraDurability: '' }
  weaponStats.value = { extraDamagePct: '', extraDurability: '', extraSkill: '' }
}

function buildBaseStatOptions() {
  const out = []
  if (effectiveBaseKind.value === 'armor') {
    if (armorStats.value.baseDefense) out.push(`기본 방어력 ${armorStats.value.baseDefense}`)
    if (armorStats.value.extraDefensePct) out.push(`증가된 방어력 +${armorStats.value.extraDefensePct}%`)
    if (armorStats.value.extraDurability) out.push(`추가 내구도 +${armorStats.value.extraDurability}`)
  } else if (effectiveBaseKind.value === 'weapon') {
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

// 유니크(gold)·세트(green)·룬워드(blood)·룬·보석(teal) - 아이템 사전 페이지와
// 똑같은 색 코드로 테두리를 맞춰서 어디서 보든 같은 등급은 같은 색으로 보이게 함
function rarityClass(item) {
  return item ? item.category : ''
}

function pickItem(it) {
  form.value.itemId = it.id
  form.value.itemName = it.name_ko
  const cat = tradeCategoryForItem(it)
  if (cat) form.value.category = cat
  showItemDropdown.value = false
  rolledValues.value = {}
  form.value.quantity = ''
  manualBaseKind.value = null
  resetBaseStats()
}

function clearPickedItem() {
  form.value.itemId = null
  form.value.itemName = ''
  rolledValues.value = {}
  manualBaseKind.value = null
  resetBaseStats()
}

function hideItemDropdownSoon() {
  window.setTimeout(() => (showItemDropdown.value = false), 150)
}

function pickFallbackCategory(cat) {
  form.value.category = cat
  manualBaseKind.value = null
  resetBaseStats()
  showItemDropdown.value = false
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

function submitPost() {
  const amountLabel = hasQuantity.value ? buildAmountLabel(form.value.quantity) : '1개'
  if (!form.value.itemName.trim() || !amountLabel.trim() || !form.value.price.trim()) return
  const dbOptions = itemAffixes.value.map((a, i) =>
    isRollRangeAffix(a) ? resolveAffixText(a, rolledValues.value[i]) : a.text
  )
  const options = [...dbOptions, ...buildMaterialsOption(), ...buildBaseStatOptions(), ...customOptions.value]
  const post = addTradePost({ ...form.value, amountLabel, options })
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
      <div class="item-picker trade-item-input">
        <div v-if="selectedItem" class="item-picker-selected">
          <span class="item-picker-icon" :class="rarityClass(selectedItem)"><img v-if="iconUrlFor(selectedItem.icon_key)" :src="iconUrlFor(selectedItem.icon_key)" alt="" /></span>
          <span class="item-picker-name">{{ selectedItem.name_ko }}</span>
          <span class="item-picker-cat">{{ form.category }}</span>
          <button type="button" class="item-picker-clear" @click="clearPickedItem">✕</button>
        </div>
        <div v-else class="item-picker-search-wrap">
          <input
            type="text" v-model="form.itemName" placeholder="아이템명 검색 (예: 이스트 룬, 무한, 할리퀸 관모)"
            class="write-input" @focus="showItemDropdown = true"
            @blur="hideItemDropdownSoon"
          />
          <div class="item-picker-hint">룬·보석·유니크·세트·룬워드·우버보스 재료를 모두 검색할 수 있어요. 룬워드는 "룬워드"가 아니라 무한·인챈트처럼 완성된 룬워드 이름으로 검색하세요.</div>
          <div class="item-picker-dropdown" v-if="showItemDropdown && form.itemName.trim()">
            <button
              type="button" class="item-picker-row" v-for="it in itemCandidates" :key="it.id"
              @mousedown.prevent="pickItem(it)"
            >
              <span class="item-picker-icon" :class="rarityClass(it)"><img v-if="iconUrlFor(it.icon_key)" :src="iconUrlFor(it.icon_key)" alt="" /></span>
              <span class="item-picker-name">{{ it.name_ko }} <small>{{ it.name_en }}</small></span>
            </button>
            <div class="item-picker-empty-block" v-if="!itemCandidates.length">
              <p class="item-picker-empty">사전에 없는 아이템이에요. 종류를 고르면 이 이름 그대로 등록돼요.</p>
              <div class="fallback-cat-row">
                <button
                  type="button" v-for="c in FALLBACK_CATEGORIES" :key="c"
                  :class="{ active: form.category === c }" @mousedown.prevent="pickFallbackCategory(c)"
                >{{ c }}</button>
              </div>
            </div>
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
          <span>기본 데미지 {{ baseStatsRef.mindam }}~{{ baseStatsRef.maxdam }}</span>
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

      <div class="base-stats-input" v-if="needsManualBaseStats && effectiveBaseKind === 'armor'">
        <div class="option-editor-title">베이스 방어구 정보</div>
        <div class="option-editor-hint">실제 착용한 방어구의 기본 방어력·증가된 방어력·추가 내구도를 입력해주세요.</div>
        <div class="base-stats-input-row">
          <label>기본 방어력<input type="number" v-model="armorStats.baseDefense" class="write-input" placeholder="예: 80" /></label>
          <label>증가된 방어력(%)<input type="number" v-model="armorStats.extraDefensePct" class="write-input" placeholder="예: 15" /></label>
          <label>추가 내구도<input type="number" v-model="armorStats.extraDurability" class="write-input" placeholder="예: 5" /></label>
        </div>
      </div>
      <div class="base-stats-input" v-else-if="needsManualBaseStats && effectiveBaseKind === 'weapon'">
        <div class="option-editor-title">베이스 무기 정보</div>
        <div class="option-editor-hint">실제 착용한 무기의 증가된 데미지·추가 내구도·추가 스킬을 입력해주세요.</div>
        <div class="base-stats-input-row">
          <label>증가된 데미지(%)<input type="number" v-model="weaponStats.extraDamagePct" class="write-input" placeholder="예: 20" /></label>
          <label>추가 내구도<input type="number" v-model="weaponStats.extraDurability" class="write-input" placeholder="예: 5" /></label>
          <label>추가 스킬<input type="text" v-model="weaponStats.extraSkill" class="write-input" placeholder="예: +3 파이어볼" /></label>
        </div>
      </div>

      <label class="ethereal-check" v-if="hasEthereal">
        <input type="checkbox" v-model="form.ethereal" />
        에테리얼(Ethereal) 아이템이에요
      </label>

      <template v-if="hasQuantity">
        <input
          type="number" min="1" v-model="form.quantity" placeholder="개수 (예: 5)"
          class="write-input trade-quantity-input"
        />
        <div class="unit-hint">개수만 입력하면 "N개"로 등록돼요.</div>
      </template>
      <div class="unit-hint" v-else>장비·재료는 낱개(1개) 단위로 등록돼요.</div>

      <div class="option-editor" v-if="itemAffixes.length">
        <div class="option-editor-title">실제 옵션 값 입력</div>
        <div class="option-editor-hint">범위로 나오는 옵션은 이 아이템에 실제로 뜬 값을 직접 입력해주세요. 비워두면 범위 그대로 표시돼요.</div>
        <div class="option-row" v-for="(a, i) in itemAffixes" :key="i">
          <template v-if="isRollRangeAffix(a)">
            <span class="option-text">{{ a.text }}</span>
            <input
              type="number" v-model="rolledValues[i]" :placeholder="`${a.min}~${a.max}`"
              class="write-input option-value-input"
            />
          </template>
          <span class="option-text fixed" v-else>{{ a.text }}</span>
        </div>
      </div>

      <div class="option-editor">
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

      <input type="text" v-model="form.price" placeholder="희망 가격 / 교환 조건 (예: 이스트 룬 2개, 퍼펙트 다이아몬드 10개)" class="write-input" />

      <div class="trade-form-row">
        <select v-model="form.ladder" class="write-select trade-meta-select">
          <option v-for="l in TRADE_LADDERS" :key="l" :value="l">{{ l }}</option>
        </select>
        <select v-model="form.hardcore" class="write-select trade-meta-select">
          <option v-for="h in TRADE_HARDCORE" :key="h" :value="h">{{ h }}</option>
        </select>
      </div>

      <div class="trade-form-row">
        <input type="text" v-model="form.author" placeholder="닉네임 (비우면 익명)" class="write-input" />
        <input type="text" v-model="form.contact" placeholder="연락처 (배틀태그, 디스코드 등)" class="write-input" />
      </div>

      <MarkdownEditor v-model="form.content" placeholder="추가 설명을 입력하세요 (옵션 정보, 거래 방식 등)" min-height="260px" />

      <div class="trade-new-actions">
        <router-link to="/trade" class="trade-new-cancel">취소</router-link>
        <button class="btn-primary write-submit" @click="submitPost">등록하기</button>
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
.item-picker-clear{margin-left:auto; color:var(--text-dim); font-size:12px; flex:none;}
.item-picker-clear:hover{color:var(--blood);}
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

.ethereal-check{display:flex; align-items:center; gap:8px; font-size:12.5px; color:var(--teal); cursor:pointer; margin-top:-2px;}
.ethereal-check input{accent-color:var(--teal);}

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
.trade-new-cancel{font-size:13px; color:var(--text-dim); padding:11px 18px;}
.trade-new-cancel:hover{color:var(--text);}
</style>
