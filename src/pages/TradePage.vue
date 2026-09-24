<script setup>
import { ref, computed } from 'vue'
import {
  tradeState,
  TRADE_CATEGORIES,
  TRADE_STATUSES,
  TRADE_REALMS,
  TRADE_LADDERS,
  TRADE_HARDCORE,
  UNIT_PRESETS,
  addTradePost,
  searchAllItems,
  tradeCategoryForItem,
  getTradeItem,
  categoryHasUnit,
  categorySupportsEthereal,
  getItemAffixes,
  isRollRangeAffix,
  resolveAffixText,
} from '../tradeStore.js'
import iconsData from '../data/icons.json'
import MarkdownEditor from '../components/MarkdownEditor.vue'

const activeCat = ref(null)
const activeStatus = ref(null)
const activeRealm = ref(null)
const activeLadder = ref(null)
const activeHardcore = ref(null)
const etherealOnly = ref(false)
const searchQuery = ref('')
const showForm = ref(false)

const emptyForm = () => ({
  category: TRADE_CATEGORIES[0],
  itemId: null,
  itemName: '',
  amountLabel: '',
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

const unitOptions = computed(() => UNIT_PRESETS[form.value.category] || ['1개'])

const hasUnit = computed(() => categoryHasUnit(form.value.category))
const hasEthereal = computed(() => categorySupportsEthereal(form.value.category))
const showItemDropdown = ref(false)
// 카테고리를 먼저 고르지 않아도 아이템명만 치면 사전 전체(룬·보석·유니크·세트·룬워드)에서
// 검색되고, 고르면 카테고리가 자동으로 맞춰짐 - 사전에 없으면 그냥 입력한 텍스트 그대로 등록
const itemCandidates = computed(() => (form.value.itemId ? [] : searchAllItems(form.value.itemName)))
const selectedItem = computed(() => getTradeItem(form.value.itemId))
const itemAffixes = computed(() => getItemAffixes(selectedItem.value))
const rolledValues = ref({})
const customOptions = ref([])
const customOptionInput = ref('')

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
  if (!categoryHasUnit(form.value.category)) form.value.amountLabel = '1개'
}

function clearPickedItem() {
  form.value.itemId = null
  form.value.itemName = ''
  rolledValues.value = {}
}

function hideItemDropdownSoon() {
  window.setTimeout(() => (showItemDropdown.value = false), 150)
}

function onCategoryManualChange() {
  form.value.itemId = null
  form.value.itemName = ''
  rolledValues.value = {}
  customOptions.value = []
  form.value.amountLabel = categoryHasUnit(form.value.category) ? '' : '1개'
}

function addCustomOption() {
  const v = customOptionInput.value.trim()
  if (!v) return
  customOptions.value.push(v)
  customOptionInput.value = ''
}

function removeCustomOption(i) {
  customOptions.value.splice(i, 1)
}

const filteredPosts = computed(() => {
  let list = tradeState.posts
  if (activeCat.value) list = list.filter((p) => p.category === activeCat.value)
  if (activeStatus.value) list = list.filter((p) => p.status === activeStatus.value)
  if (activeRealm.value) list = list.filter((p) => p.realm === activeRealm.value)
  if (activeLadder.value) list = list.filter((p) => p.ladder === activeLadder.value)
  if (activeHardcore.value) list = list.filter((p) => p.hardcore === activeHardcore.value)
  if (etherealOnly.value) list = list.filter((p) => p.ethereal)
  const q = searchQuery.value.trim().toLowerCase()
  if (q) {
    list = list.filter(
      (p) => p.itemName.toLowerCase().includes(q) || p.content.toLowerCase().includes(q)
    )
  }
  return [...list].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
})

function submitPost() {
  if (!form.value.itemName.trim() || !form.value.amountLabel.trim() || !form.value.price.trim()) return
  const dbOptions = itemAffixes.value.map((a, i) =>
    isRollRangeAffix(a) ? resolveAffixText(a, rolledValues.value[i]) : a.text
  )
  const options = [...dbOptions, ...customOptions.value]
  addTradePost({ ...form.value, options })
  form.value = emptyForm()
  rolledValues.value = {}
  customOptions.value = []
  customOptionInput.value = ''
  showForm.value = false
}
</script>

<template>
  <div class="items-page trade-page">
  <header>
    <div class="logo">
      <router-link to="/" style="display: flex; align-items: center; gap: 8px; color: inherit">
        <span class="logo-mark"></span>디아사전
      </router-link>
    </div>
    <div class="crumb"><router-link to="/">메인</router-link> / <b>거래게시판</b></div>
  </header>

  <div class="patch-hero">
    <div class="patch-hero-inner">
      <div class="eyebrow">유저 간 아이템 거래</div>
      <h1>거래게시판</h1>
      <p>룬·보석부터 유니크·세트·룬워드·매직·레어·일반 장비, 우버보스 재료까지 등록된 모든 아이템을 올릴 수 있어요. 구매자는 구매신청을 보내면 돼요.</p>
    </div>
  </div>

  <div class="toolbar">
    <div class="toolbar-inner">
      <div class="cat-tabs">
        <button :class="{ active: activeCat === null }" @click="activeCat = null">전체</button>
        <button v-for="c in TRADE_CATEGORIES" :key="c" :class="{ active: activeCat === c }" @click="activeCat = c">
          {{ c }}
        </button>
      </div>
      <div class="search-row">
        <div class="search-input-wrap">
          <input type="text" v-model="searchQuery" placeholder="아이템명·내용 검색" aria-label="거래글 검색" />
        </div>
        <select v-model="activeStatus" class="sort-select">
          <option :value="null">전체 상태</option>
          <option v-for="s in TRADE_STATUSES" :key="s" :value="s">{{ s }}</option>
        </select>
        <span class="result-count">{{ filteredPosts.length }}개</span>
        <button class="quality-toggle" @click="showForm = !showForm">{{ showForm ? '취소' : '판매글 등록' }}</button>
      </div>
      <div class="filter-row">
        <select v-model="activeRealm" class="sort-select">
          <option :value="null">전체 서버</option>
          <option v-for="r in TRADE_REALMS" :key="r" :value="r">{{ r }}</option>
        </select>
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
      </div>
    </div>
  </div>

  <div class="quality-info" v-if="showForm">
    <div class="quality-info-inner write-form trade-write-form">
      <div class="trade-form-row">
        <select v-model="form.category" class="write-select" @change="onCategoryManualChange">
          <option v-for="c in TRADE_CATEGORIES" :key="c" :value="c">{{ c }}</option>
        </select>

        <div class="item-picker trade-item-input">
          <div v-if="selectedItem" class="item-picker-selected">
            <span class="item-picker-icon" :class="rarityClass(selectedItem)"><img v-if="iconUrlFor(selectedItem.icon_key)" :src="iconUrlFor(selectedItem.icon_key)" alt="" /></span>
            <span class="item-picker-name">{{ selectedItem.name_ko }}</span>
            <button type="button" class="item-picker-clear" @click="clearPickedItem">✕</button>
          </div>
          <div v-else class="item-picker-search-wrap">
            <input
              type="text" v-model="form.itemName" placeholder="아이템명 검색 (사전에 없으면 직접 입력한 이름 그대로 등록돼요)"
              class="write-input" @focus="showItemDropdown = true"
              @blur="hideItemDropdownSoon"
            />
            <div class="item-picker-dropdown" v-if="showItemDropdown && form.itemName.trim()">
              <button
                type="button" class="item-picker-row" v-for="it in itemCandidates" :key="it.id"
                @mousedown.prevent="pickItem(it)"
              >
                <span class="item-picker-icon" :class="rarityClass(it)"><img v-if="iconUrlFor(it.icon_key)" :src="iconUrlFor(it.icon_key)" alt="" /></span>
                <span class="item-picker-name">{{ it.name_ko }} <small>{{ it.name_en }}</small></span>
              </button>
              <p class="item-picker-empty" v-if="!itemCandidates.length">사전에 없는 아이템이에요. 이 이름 그대로 등록돼요.</p>
            </div>
          </div>
        </div>
      </div>

      <label class="ethereal-check" v-if="hasEthereal">
        <input type="checkbox" v-model="form.ethereal" />
        에테리얼(Ethereal) 아이템이에요
      </label>

      <template v-if="hasUnit">
        <div class="trade-form-row">
          <input
            type="text" v-model="form.amountLabel" placeholder="판매 수량/단위 (예: 5개, 10개입 묶음, 1스택(40개입), 3세트)"
            class="write-input trade-unit-input" list="trade-unit-presets"
          />
          <datalist id="trade-unit-presets">
            <option v-for="u in unitOptions" :key="u" :value="u" />
          </datalist>
        </div>
        <div class="unit-hint">수량과 단위를 자유롭게 정해서 적으면 돼요. 예: "{{ unitOptions.join('", "') }}"</div>
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
        <div class="option-editor-title">옵션 직접 추가</div>
        <div class="option-editor-hint">룬워드 베이스 아이템 정보(예: 3소켓 크리스 소드), 소켓 개수, 그 외 사전에 없는 옵션을 자유롭게 추가하세요.</div>
        <div class="custom-option-chip" v-for="(o, i) in customOptions" :key="i">
          <span>{{ o }}</span>
          <button type="button" @click="removeCustomOption(i)">✕</button>
        </div>
        <div class="custom-option-add-row">
          <input
            type="text" v-model="customOptionInput" placeholder="예: 베이스 3소켓 크리스 소드, 방어력 220"
            class="write-input" @keydown.enter.prevent="addCustomOption"
          />
          <button type="button" class="custom-option-add-btn" @click="addCustomOption">추가</button>
        </div>
      </div>

      <input type="text" v-model="form.price" placeholder="희망 가격 / 교환 조건 (예: 이스트 룬 2개, 퍼펙트 다이아몬드 10개)" class="write-input" />

      <div class="trade-form-row">
        <select v-model="form.realm" class="write-select trade-meta-select">
          <option v-for="r in TRADE_REALMS" :key="r" :value="r">{{ r }}</option>
        </select>
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

      <MarkdownEditor v-model="form.content" placeholder="추가 설명을 입력하세요 (옵션 정보, 거래 방식 등)" min-height="150px" />

      <button class="btn-primary write-submit" @click="submitPost">등록하기</button>
    </div>
  </div>

  <div class="grid-wrap trade-list-wrap">
    <div class="trade-list">
      <router-link class="trade-row" v-for="p in filteredPosts" :key="p.id" :to="`/trade/${p.id}`">
        <span class="trade-row-icon" :class="rarityClass(getTradeItem(p.itemId))">
          <img v-if="iconUrlFor(getTradeItem(p.itemId)?.icon_key)" :src="iconUrlFor(getTradeItem(p.itemId)?.icon_key)" alt="" />
        </span>
        <span class="trade-cat">{{ p.category }}</span>
        <div class="trade-body">
          <div class="trade-title-row">
            <span class="trade-title">{{ p.itemName }}</span>
            <span class="ethereal-badge" v-if="p.ethereal">에테리얼</span>
            <span class="trade-status-badge" :class="'status-' + p.status">{{ p.status }}</span>
          </div>
          <div class="trade-meta">
            {{ p.amountLabel }} · {{ p.price }}
          </div>
          <div class="trade-sub-meta">
            {{ p.realm }} · {{ p.ladder }} · {{ p.hardcore }} · {{ p.author }} · {{ p.date }}
          </div>
        </div>
        <span class="trade-request-count" v-if="p.requests.length">신청 {{ p.requests.length }}</span>
      </router-link>
      <div class="empty-state" v-if="filteredPosts.length === 0">등록된 판매글이 없어요</div>
    </div>
  </div>
  </div>
</template>

<style scoped>
.sort-select{
  background:var(--panel); border:1px solid var(--border); color:var(--text-muted); font-size:12.5px;
  padding:9px 10px; font-family:'Noto Sans KR', sans-serif;
}

.filter-row{display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-top:10px;}
.ethereal-filter-check{display:flex; align-items:center; gap:6px; font-size:12.5px; color:var(--teal); cursor:pointer;}
.ethereal-filter-check input{accent-color:var(--teal);}

.write-form{display:flex; flex-direction:column; gap:10px; max-width:700px;}
.write-select, .write-input{
  background:var(--panel); border:1px solid var(--border); color:var(--text); font-size:13px;
  padding:10px 12px; font-family:'Noto Sans KR', sans-serif;
}
.write-select{width:120px;}
.write-submit{align-self:flex-start; padding:10px 20px; font-size:13px;}

.trade-form-row{display:flex; gap:8px;}
.trade-item-input{flex:1;}
.trade-unit-input{flex:1;}
.trade-meta-select{flex:1; width:auto;}
.unit-hint{font-size:11px; color:var(--text-dim); margin-top:-4px;}

.item-picker{position:relative;}
.item-picker-search-wrap{position:relative;}
.item-picker-selected{
  display:flex; align-items:center; gap:8px; background:var(--panel); border:1px solid var(--gold-dim);
  padding:6px 10px; height:41px; box-sizing:border-box;
}
.item-picker-clear{margin-left:auto; color:var(--text-dim); font-size:12px; flex:none;}
.item-picker-clear:hover{color:var(--blood);}
.item-picker-dropdown{
  position:absolute; top:calc(100% + 4px); left:0; right:0; z-index:20; max-height:380px; overflow-y:auto;
  background:var(--panel-2); border:1px solid var(--border); box-shadow:0 8px 20px rgba(0,0,0,0.5);
}
.item-picker-row{
  display:flex; align-items:center; gap:8px; width:100%; padding:8px 10px; text-align:left;
  border-bottom:1px solid var(--border-soft); font-family:'Noto Sans KR', sans-serif;
}
.item-picker-row:last-child{border-bottom:none;}
.item-picker-row:hover{background:rgba(255,255,255,0.06);}
.item-picker-icon{
  width:26px; height:26px; flex:none; display:flex; align-items:center; justify-content:center;
  background:var(--panel); border:1px solid var(--border-soft);
}
.item-picker-icon img{width:100%; height:100%; object-fit:contain; image-rendering:pixelated;}
.item-picker-icon.unique{border-color:var(--gold-dim); box-shadow:0 0 8px -2px rgba(200,163,77,0.5);}
.item-picker-icon.set{border-color:var(--green); box-shadow:0 0 8px -2px rgba(92,138,91,0.5);}
.item-picker-icon.runeword{border-color:var(--blood); box-shadow:0 0 8px -2px rgba(162,81,63,0.5);}
.item-picker-icon.gem{border-color:var(--teal); box-shadow:0 0 8px -2px rgba(78,138,138,0.5);}
.item-picker-name{font-size:13px; color:var(--text); min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.item-picker-name small{color:var(--text-dim); font-size:11px; margin-left:4px;}
.item-picker-empty{padding:14px; text-align:center; color:var(--text-dim); font-size:12px; margin:0;}

.option-editor{border:1px solid var(--border-soft); background:var(--panel); padding:12px 14px; display:flex; flex-direction:column; gap:8px;}
.option-editor-title{font-size:12.5px; color:var(--gold-dim); font-weight:600;}
.option-editor-hint{font-size:11px; color:var(--text-dim); margin-top:-4px;}
.option-row{display:flex; align-items:center; gap:10px;}
.option-text{font-size:12.5px; color:var(--text-muted); flex:1;}
.option-text.fixed{color:var(--text-dim);}
.option-value-input{width:100px; padding:6px 8px !important; font-size:12.5px !important; flex:none;}

.ethereal-check{display:flex; align-items:center; gap:8px; font-size:12.5px; color:var(--teal); cursor:pointer; margin-top:-2px;}
.ethereal-check input{accent-color:var(--teal);}

.custom-option-chip{
  display:flex; align-items:center; gap:8px; background:var(--panel-2); border:1px solid var(--border-soft);
  padding:6px 10px; font-size:12.5px; color:var(--text-muted);
}
.custom-option-chip span{flex:1;}
.custom-option-chip button{color:var(--text-dim); flex:none;}
.custom-option-chip button:hover{color:var(--blood);}
.custom-option-add-row{display:flex; gap:8px;}
.custom-option-add-row .write-input{flex:1;}
.custom-option-add-btn{font-size:12px; color:var(--text-muted); border:1px solid var(--border); padding:0 14px;}
.custom-option-add-btn:hover{border-color:var(--gold-dim); color:var(--gold);}

.trade-row-icon{
  width:36px; height:36px; flex:none; display:flex; align-items:center; justify-content:center;
  background:var(--panel-2); border:1px solid var(--border-soft); margin-top:1px;
}
.trade-row-icon img{width:100%; height:100%; object-fit:contain; image-rendering:pixelated;}
.trade-row-icon.unique{border-color:var(--gold-dim); box-shadow:0 0 10px -3px rgba(200,163,77,0.5);}
.trade-row-icon.set{border-color:var(--green); box-shadow:0 0 10px -3px rgba(92,138,91,0.5);}
.trade-row-icon.runeword{border-color:var(--blood); box-shadow:0 0 10px -3px rgba(162,81,63,0.5);}
.trade-row-icon.gem{border-color:var(--teal); box-shadow:0 0 10px -3px rgba(78,138,138,0.5);}

.trade-list-wrap{max-width:1180px;}
.trade-list{display:flex; flex-direction:column;}
.trade-row{
  display:flex; align-items:flex-start; gap:14px; padding:16px 4px; border-bottom:1px solid var(--border-soft);
  transition:background .1s;
}
.trade-row:hover{background:var(--panel);}
.trade-cat{font-size:11px; color:var(--gold-dim); border:1px solid var(--border); padding:3px 9px; flex:none; margin-top:1px;}
.trade-body{flex:1; min-width:0;}
.trade-title-row{display:flex; align-items:center; gap:8px; margin-bottom:4px;}
.trade-title{font-size:14px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.ethereal-badge{font-size:10px; padding:2px 8px; border:1px solid var(--teal); color:var(--teal); flex:none;}
.trade-status-badge{font-size:10px; padding:2px 8px; border:1px solid var(--border); flex:none; color:var(--text-dim);}
.trade-status-badge.status-판매중{color:var(--gold); border-color:var(--gold-dim);}
.trade-status-badge.status-예약중{color:var(--teal); border-color:var(--teal);}
.trade-status-badge.status-거래완료{color:var(--text-dim); border-color:var(--border);}
.trade-meta{font-size:12.5px; color:var(--text-muted); margin-bottom:4px;}
.trade-sub-meta{font-size:11.5px; color:var(--text-dim);}
.trade-request-count{font-size:11.5px; color:var(--text-muted); border:1px solid var(--border); padding:2px 8px; flex:none; margin-top:1px;}
</style>
