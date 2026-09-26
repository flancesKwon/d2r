<script setup>
import HeaderNotifications from '../components/HeaderNotifications.vue'
import LogoMark from '../components/LogoMark.vue'
import { ref, computed } from 'vue'
import {
  tradeState,
  TRADE_CATEGORIES,
  TRADE_STATUSES,
  TRADE_LADDERS,
  TRADE_HARDCORE,
  getTradeItem,
  parsePriceTokens,
  TRADE_STAT_FILTERS,
  postStatValue,
  postLevelReq,
} from '../tradeStore.js'
import iconsData from '../data/icons.json'
import { isFavorite, toggleFavorite } from '../tradeFavorites.js'

const activeCat = ref(null)
const activeStatus = ref(null)
const activeLadder = ref(null)
const activeHardcore = ref(null)
const etherealOnly = ref(false)
const favoritesOnly = ref(false)
const searchQuery = ref('')

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
  const b64 = iconKey && iconsData[iconKey]
  return b64 ? 'data:image/png;base64,' + b64 : null
}

// 유니크(gold)·세트(green)·룬워드(blood)·룬·보석(teal) - 아이템 사전 페이지와
// 똑같은 색 코드로 테두리를 맞춰서 어디서 보든 같은 등급은 같은 색으로 보이게 함
function rarityClass(item) {
  return item ? item.category : ''
}

// 옵션 조건: "모든 저항 20 이상"처럼 옵션 종류 + 최솟값을 여러 개 걸 수 있고 전부
// 만족하는 글만 남김(AND). 최솟값을 비우면 그 옵션이 붙어 있기만 하면 통과
const statConditions = ref([])
const statPickKey = ref(TRADE_STAT_FILTERS[0].key)
const statPickMin = ref('')
// 드롭다운 라벨의 "(%)"는 칩·배지에선 떼고 수치 뒤에 %로 붙임 ("모든 저항 20% 이상")
const statLabel = (key) => (TRADE_STAT_FILTERS.find((s) => s.key === key)?.label || key).replace('(%)', '')
const statUnit = (key) => (TRADE_STAT_FILTERS.find((s) => s.key === key)?.label.includes('(%)') ? '%' : '')
function addStatCondition() {
  const min = statPickMin.value === '' ? null : Number(statPickMin.value)
  const existing = statConditions.value.find((c) => c.key === statPickKey.value)
  if (existing) existing.min = min
  else statConditions.value.push({ key: statPickKey.value, min })
  statPickMin.value = ''
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
    activeCat.value !== null || activeStatus.value !== null || activeLadder.value !== null ||
    activeHardcore.value !== null || etherealOnly.value || favoritesOnly.value ||
    searchQuery.value.trim() !== '' || statConditions.value.length > 0 ||
    levelMin.value !== '' || levelMax.value !== ''
)
function resetFilters() {
  activeCat.value = null
  activeStatus.value = null
  activeLadder.value = null
  activeHardcore.value = null
  etherealOnly.value = false
  favoritesOnly.value = false
  searchQuery.value = ''
  statConditions.value = []
  statPickMin.value = ''
  levelMin.value = ''
  levelMax.value = ''
}

const filteredPosts = computed(() => {
  let list = tradeState.posts
  if (activeCat.value) list = list.filter((p) => p.category === activeCat.value)
  if (activeStatus.value) list = list.filter((p) => p.status === activeStatus.value)
  if (activeLadder.value) list = list.filter((p) => p.ladder === activeLadder.value)
  if (activeHardcore.value) list = list.filter((p) => p.hardcore === activeHardcore.value)
  if (etherealOnly.value) list = list.filter((p) => p.ethereal)
  if (favoritesOnly.value) list = list.filter((p) => isFavorite(p.id))
  const q = searchQuery.value.trim().toLowerCase()
  if (q) {
    list = list.filter(
      (p) => p.itemName.toLowerCase().includes(q) || p.content.toLowerCase().includes(q)
    )
  }
  for (const c of statConditions.value) {
    list = list.filter((p) => {
      const v = postStatValue(p, c.key)
      return v !== null && (c.min === null || v >= c.min)
    })
  }
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
  <header>
    <div class="logo">
      <router-link to="/" style="display: flex; align-items: center; gap: 8px; color: inherit">
        <LogoMark />디아허브
      </router-link>
    </div>
    <div class="crumb"><router-link to="/">메인</router-link> / <b>거래게시판</b></div>
    <HeaderNotifications />
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
        <div class="view-mode-toggle">
          <button type="button" :class="{ active: viewMode === 'list' }" title="목록형" @click="setViewMode('list')">☰</button>
          <button type="button" :class="{ active: viewMode === 'grid' }" title="그리드형" @click="setViewMode('grid')">▦</button>
        </div>
        <router-link class="quality-toggle" to="/trade/new">판매글 등록</router-link>
      </div>
      <div class="filter-row">
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
        <button type="button" class="reset-filters" v-if="hasActiveFilters" @click="resetFilters">필터 초기화</button>
      </div>
      <div class="filter-row stat-filter-row">
        <span class="stat-filter-label">옵션 조건</span>
        <select v-model="statPickKey" class="sort-select" aria-label="옵션 종류">
          <option v-for="s in TRADE_STAT_FILTERS" :key="s.key" :value="s.key">{{ s.label }}</option>
        </select>
        <input
          type="number" v-model="statPickMin" class="stat-min-input" placeholder="최솟값 (비우면 옵션 있기만 하면)"
          aria-label="최솟값" @keydown.enter.prevent="addStatCondition"
        />
        <button type="button" class="stat-add-btn" @click="addStatCondition">조건 추가</button>
        <span class="stat-chip" v-for="(c, i) in statConditions" :key="c.key">
          {{ statLabel(c.key) }}{{ c.min === null ? ' 있음' : ` ${c.min}${statUnit(c.key)} 이상` }}
          <button type="button" :aria-label="`${statLabel(c.key)} 조건 삭제`" @click="removeStatCondition(i)">✕</button>
        </span>
      </div>
    </div>
  </div>

  <div class="grid-wrap trade-list-wrap">
    <div class="trade-list" v-if="viewMode === 'list'">
      <router-link class="trade-row" v-for="p in filteredPosts" :key="p.id" :to="`/trade/${p.id}`">
        <button
          type="button" class="favorite-star" :class="{ active: isFavorite(p.id) }"
          :title="isFavorite(p.id) ? '찜 해제' : '찜하기'"
          @click.prevent.stop="toggleFavorite(p.id)"
        >{{ isFavorite(p.id) ? '★' : '☆' }}</button>
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
            {{ p.amountLabel }} ·
            <template v-for="(t, i) in parsePriceTokens(p.price)" :key="i">
              <span class="price-icon" v-if="t.item"><img v-if="iconUrlFor(t.item.icon_key)" :src="iconUrlFor(t.item.icon_key)" alt="" /></span>{{ t.text }}
            </template>
          </div>
          <div class="trade-sub-meta">
            {{ p.realm }} · {{ p.ladder }} · {{ p.hardcore }} · {{ p.author }} · {{ p.date }}
          </div>
          <div class="stat-match-row" v-if="statConditions.length">
            <span class="stat-match" v-for="c in statConditions" :key="c.key">
              {{ statLabel(c.key) }} {{ postStatValue(p, c.key) }}{{ statUnit(c.key) }}
            </span>
          </div>
        </div>
        <span class="trade-request-count" v-if="p.requests.length">신청 {{ p.requests.length }}</span>
      </router-link>
      <div class="empty-state" v-if="filteredPosts.length === 0">등록된 판매글이 없어요</div>
    </div>

    <div class="trade-grid" v-else>
      <router-link class="trade-card" v-for="p in filteredPosts" :key="p.id" :to="`/trade/${p.id}`">
        <button
          type="button" class="favorite-star trade-card-star" :class="{ active: isFavorite(p.id) }"
          :title="isFavorite(p.id) ? '찜 해제' : '찜하기'"
          @click.prevent.stop="toggleFavorite(p.id)"
        >{{ isFavorite(p.id) ? '★' : '☆' }}</button>
        <span class="trade-status-badge trade-card-status" :class="'status-' + p.status">{{ p.status }}</span>
        <span class="trade-card-icon" :class="rarityClass(getTradeItem(p.itemId))">
          <img v-if="iconUrlFor(getTradeItem(p.itemId)?.icon_key)" :src="iconUrlFor(getTradeItem(p.itemId)?.icon_key)" alt="" />
        </span>
        <span class="trade-cat trade-card-cat">{{ p.category }}</span>
        <span class="trade-card-title">{{ p.itemName }}</span>
        <span class="ethereal-badge" v-if="p.ethereal">에테리얼</span>
        <span class="trade-card-price">
          {{ p.amountLabel }} ·
          <template v-for="(t, i) in parsePriceTokens(p.price)" :key="i">
            <span class="price-icon" v-if="t.item"><img v-if="iconUrlFor(t.item.icon_key)" :src="iconUrlFor(t.item.icon_key)" alt="" /></span>{{ t.text }}
          </template>
        </span>
        <span class="stat-match-row" v-if="statConditions.length">
          <span class="stat-match" v-for="c in statConditions" :key="c.key">
            {{ statLabel(c.key) }} {{ postStatValue(p, c.key) }}{{ statUnit(c.key) }}
          </span>
        </span>
        <span class="trade-card-footer">
          {{ p.author }} · {{ p.date }}
          <span class="trade-request-count" v-if="p.requests.length">신청 {{ p.requests.length }}</span>
        </span>
      </router-link>
      <div class="empty-state" v-if="filteredPosts.length === 0">등록된 판매글이 없어요</div>
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
  .reset-filters{margin-left:0;}
  .stat-min-input{width:100%;}
}

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
.ethereal-badge{font-size:10px; padding:2px 10px; border:1px solid var(--teal); color:var(--teal); flex:none; border-radius:999px;}
.trade-status-badge{font-size:10px; padding:2px 10px; border:1px solid var(--border); flex:none; color:var(--text-dim); border-radius:999px;}
.trade-status-badge.status-판매중{color:var(--gold); border-color:var(--gold-dim);}
.trade-status-badge.status-예약중{color:var(--teal); border-color:var(--teal);}
.trade-status-badge.status-거래완료{color:var(--text-dim); border-color:var(--border);}
.trade-meta{font-size:12.5px; color:var(--text-muted); margin-bottom:6px;}
.price-icon{display:inline-flex; width:15px; height:15px; vertical-align:-3px; margin:0 2px 0 3px;}
.price-icon img{width:100%; height:100%; object-fit:contain; image-rendering:pixelated;}
.trade-sub-meta{font-size:11.5px; color:var(--text-dim); line-height:1.6;}
.trade-request-count{font-size:11.5px; color:var(--text-muted); border:1px solid var(--border); padding:3px 10px; flex:none; margin-top:1px; border-radius:999px;}

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
</style>
