<script setup>
// 아이템별 거래내역 - 한 아이템(사전 아이템은 id, 사전에 없는 아이템은 판매글 제목)의 판매글을
// 판매중·예약중·거래완료까지 전부 모아서 최근 거래 가격과 함께 보여줌.
// ?item=<사전 id> 또는 ?name=<판매글 제목>, 둘 다 없으면 거래가 있는 아이템 목록
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  getTradeItem,
  parsePriceTokens,
  postIconKey,
  postRarity,
  searchAllItems,
  tradePostsForItem,
  tradedItemSummaries,
  TRADE_LADDERS,
  TRADE_HARDCORE,
} from '../tradeStore.js'
import { ITEM_ICONS } from '../itemIcons.js'

const route = useRoute()
const router = useRouter()
const iconUrl = (key) => (key && ITEM_ICONS[key]) || null

const itemId = computed(() => (typeof route.query.item === 'string' ? route.query.item : ''))
const freeName = computed(() => (typeof route.query.name === 'string' ? route.query.name : ''))
const item = computed(() => (itemId.value ? getTradeItem(itemId.value) : null))
const title = computed(() => item.value?.name_ko || freeName.value)
const hasTarget = computed(() => !!title.value)

const ladder = ref('')
const hardcore = ref('')
watch(() => route.fullPath, () => { ladder.value = ''; hardcore.value = '' })

const allPosts = computed(() => (hasTarget.value ? tradePostsForItem({ itemId: item.value?.id, name: freeName.value }) : []))
const posts = computed(() =>
  allPosts.value.filter((p) => (!ladder.value || p.ladder === ladder.value) && (!hardcore.value || p.hardcore === hardcore.value))
)
const counts = computed(() => ({
  total: posts.value.length,
  selling: posts.value.filter((p) => p.status === '판매중').length,
  reserved: posts.value.filter((p) => p.status === '예약중').length,
  done: posts.value.filter((p) => p.status === '거래완료').length,
  requests: posts.value.reduce((n, p) => n + (p.requests?.length || 0), 0),
}))
const completed = computed(() => posts.value.filter((p) => p.status === '거래완료').slice(0, 5))
const headerIcon = computed(() => iconUrl(item.value?.icon_key) || iconUrl(allPosts.value[0] && postIconKey(allPosts.value[0])))
const headerRarity = computed(() => item.value?.category || (allPosts.value[0] && postRarity(allPosts.value[0])) || '')

// ---- 아이템을 고르기 전: 검색 + 거래가 있는 아이템 목록
const query = ref('')
const summaries = computed(() => tradedItemSummaries())
const searchHits = computed(() => (query.value.trim() ? searchAllItems(query.value).slice(0, 8) : []))
function openItem(it) {
  router.push({ path: '/trade/history', query: it.itemId || it.id ? { item: it.itemId || it.id } : { name: it.name } })
  query.value = ''
}
const summaryIcon = (s) => iconUrl(s.iconKey)
</script>

<template>
  <div class="items-page trade-history-page">
    <div class="patch-hero">
      <div class="patch-hero-inner">
        <div class="eyebrow">아이템별 거래내역</div>
        <template v-if="hasTarget">
          <div class="th-head">
            <span class="th-icon" :class="headerRarity"><img v-if="headerIcon" :src="headerIcon" alt="" /></span>
            <div>
              <h1>{{ title }}</h1>
              <p v-if="item">{{ item.name_en }}<template v-if="item.category_label"> · {{ item.category_label }}</template></p>
            </div>
          </div>
          <div class="th-links">
            <router-link to="/trade/history">← 다른 아이템</router-link>
            <router-link v-if="item && item.category !== 'uber' && item.category !== 'essence'" :to="{ path: '/items', query: { q: item.name_ko, id: item.id } }">아이템 사전에서 보기</router-link>
            <router-link :to="{ path: '/trade', query: { q: title } }">거래게시판에서 찾기</router-link>
          </div>
        </template>
        <template v-else>
          <h1>아이템별 거래내역</h1>
          <p>아이템을 고르면 지금까지 올라온 판매글과 거래완료 가격을 모아서 보여줘요.</p>
        </template>
      </div>
    </div>

    <div class="grid-wrap th-wrap">
      <template v-if="hasTarget">
        <div class="th-filters">
          <select v-model="ladder" class="write-select" aria-label="레더 구분">
            <option value="">레더·논레더 전체</option>
            <option v-for="l in TRADE_LADDERS" :key="l" :value="l">{{ l }}</option>
          </select>
          <select v-model="hardcore" class="write-select" aria-label="하드코어 구분">
            <option value="">일반·하드코어 전체</option>
            <option v-for="h in TRADE_HARDCORE" :key="h" :value="h">{{ h }}</option>
          </select>
        </div>

        <div class="th-stats">
          <div class="th-stat"><b>{{ counts.total }}</b><span>전체 판매글</span></div>
          <div class="th-stat"><b>{{ counts.selling }}</b><span>판매중</span></div>
          <div class="th-stat"><b>{{ counts.reserved }}</b><span>예약중</span></div>
          <div class="th-stat"><b>{{ counts.done }}</b><span>거래완료</span></div>
          <div class="th-stat"><b>{{ counts.requests }}</b><span>구매신청</span></div>
        </div>

        <section class="th-section" v-if="completed.length">
          <div class="d-section-title">최근 거래완료 가격</div>
          <div class="th-done-list">
            <div class="th-done" v-for="p in completed" :key="p.id">
              <span class="th-price">
                <template v-for="(t, i) in parsePriceTokens(p.price)" :key="i">
                  <span class="price-icon" v-if="t.item"><img v-if="iconUrl(t.item.icon_key)" :src="iconUrl(t.item.icon_key)" alt="" /></span>{{ t.text }}
                </template>
              </span>
              <span class="th-done-meta">{{ p.amountLabel }} · {{ p.ladder }} · {{ p.hardcore }} · {{ p.completedAt || p.date }}</span>
            </div>
          </div>
        </section>

        <section class="th-section">
          <div class="d-section-title">전체 판매글</div>
          <div class="th-list">
            <router-link class="th-row" v-for="p in posts" :key="p.id" :to="`/trade/${p.id}`">
              <span class="trade-status-badge" :class="'status-' + p.status">{{ p.status }}</span>
              <div class="th-row-body">
                <div class="th-row-title">{{ p.itemName }}<span class="ethereal-badge" v-if="p.ethereal">에테리얼</span></div>
                <div class="th-row-price">
                  {{ p.amountLabel }} ·
                  <template v-for="(t, i) in parsePriceTokens(p.price)" :key="i">
                    <span class="price-icon" v-if="t.item"><img v-if="iconUrl(t.item.icon_key)" :src="iconUrl(t.item.icon_key)" alt="" /></span>{{ t.text }}
                  </template>
                </div>
                <div class="th-row-meta">{{ p.realm }} · {{ p.ladder }} · {{ p.hardcore }} · {{ p.author }} · 등록 {{ p.date }}<template v-if="p.completedAt"> · 거래완료 {{ p.completedAt }}</template></div>
              </div>
              <span class="th-req" v-if="p.requests && p.requests.length">신청 {{ p.requests.length }}</span>
            </router-link>
            <div class="empty-state" v-if="!posts.length">
              아직 이 아이템 거래내역이 없어요. <router-link to="/trade/new">판매글 등록하기</router-link>
            </div>
          </div>
        </section>
      </template>

      <template v-else>
        <div class="th-search">
          <input :value="query" @input="query = $event.target.value" type="search" class="write-input" placeholder="아이템 검색 (예: 베르 룬, 할리퀸 관모, 파괴의 열쇠)" aria-label="아이템 검색" />
          <div class="th-search-hits" v-if="searchHits.length">
            <button type="button" class="th-hit" v-for="it in searchHits" :key="it.id" @click="openItem(it)">
              <span class="th-hit-icon" :class="it.category"><img v-if="iconUrl(it.icon_key)" :src="iconUrl(it.icon_key)" alt="" /></span>
              <span>{{ it.name_ko }}</span><small>{{ it.category_label }}</small>
            </button>
          </div>
        </div>

        <div class="d-section-title">거래가 있는 아이템</div>
        <div class="th-summary-grid">
          <button type="button" class="th-summary" v-for="s in summaries" :key="(s.itemId || '') + s.name" @click="openItem(s)">
            <span class="th-hit-icon"><img v-if="summaryIcon(s)" :src="summaryIcon(s)" alt="" /></span>
            <span class="th-summary-body">
              <span class="th-summary-name">{{ s.name }}</span>
              <span class="th-summary-meta">판매글 {{ s.total }} · 거래완료 {{ s.done }} · 최근 {{ s.lastDate }}</span>
            </span>
          </button>
          <div class="empty-state" v-if="!summaries.length">아직 올라온 판매글이 없어요.</div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.th-wrap{max-width:1180px;}
.th-head{display:flex; align-items:center; gap:16px;}
.th-head p{margin:4px 0 0;}
.th-icon{width:64px; height:64px; flex:none; display:flex; align-items:center; justify-content:center; background:var(--panel-2); border:1px solid var(--border); border-radius:12px;}
.th-icon img{max-width:100%; max-height:100%; image-rendering:pixelated;}
.th-icon.unique{border-color:var(--gold-dim);} .th-icon.set{border-color:var(--green);} .th-icon.runeword{border-color:var(--blood);} .th-icon.gem,.th-icon.uber{border-color:var(--teal);}
.th-links{display:flex; flex-wrap:wrap; gap:8px 16px; margin-top:14px; font-size:12.5px;}
.th-links a{color:var(--gold-dim);}
.th-links a:hover{color:var(--gold);}

.th-filters{display:flex; gap:10px; flex-wrap:wrap; margin-bottom:16px;}
.write-select, .write-input{
  background:var(--panel-2); border:1px solid var(--border); color:var(--text); font-size:13px;
  padding:10px 14px; font-family:'Noto Sans KR', sans-serif; border-radius:10px;
}
.th-filters .write-select{min-width:180px;}
.th-stats{display:grid; grid-template-columns:repeat(5, 1fr); gap:10px; margin-bottom:28px;}
.th-stat{background:var(--panel); border:1px solid var(--border-soft); border-radius:12px; padding:14px 16px; display:flex; flex-direction:column; gap:4px;}
.th-stat b{font-size:22px; color:var(--gold); font-family:'Noto Serif KR', serif;}
.th-stat span{font-size:12px; color:var(--text-dim);}

.th-section{margin-bottom:28px;}
.th-done-list{display:flex; flex-direction:column; gap:8px;}
.th-done{display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; padding:12px 16px; background:var(--panel); border:1px solid var(--border-soft); border-radius:12px;}
.th-price{font-size:14px; color:var(--text);}
.th-done-meta{font-size:11.5px; color:var(--text-dim);}

.th-list{display:flex; flex-direction:column; gap:10px;}
.th-row{display:flex; align-items:flex-start; gap:14px; padding:16px 18px; background:var(--panel); border:1px solid var(--border-soft); border-radius:14px;}
.th-row:hover{border-color:var(--gold-dim);}
.th-row-body{flex:1; min-width:0;}
.th-row-title{font-size:14px; margin-bottom:4px; display:flex; align-items:center; gap:8px; flex-wrap:wrap;}
.th-row-price{font-size:12.5px; color:var(--text-muted); margin-bottom:4px;}
.th-row-meta{font-size:11.5px; color:var(--text-dim); line-height:1.6;}
.th-req{font-size:11.5px; color:var(--text-muted); border:1px solid var(--border); padding:3px 10px; border-radius:999px; flex:none;}

.trade-status-badge{font-size:10px; padding:2px 10px; border:1px solid var(--border); flex:none; color:var(--text-dim); border-radius:999px; margin-top:2px;}
.trade-status-badge.status-판매중{color:var(--gold); border-color:var(--gold-dim);}
.trade-status-badge.status-예약중{color:var(--teal); border-color:var(--teal);}
.ethereal-badge{font-size:10px; padding:2px 10px; border:1px solid var(--teal); color:var(--teal); border-radius:999px;}
.price-icon{display:inline-flex; width:15px; height:15px; vertical-align:-3px; margin:0 2px 0 3px;}
.price-icon img{width:100%; height:100%; object-fit:contain; image-rendering:pixelated;}

.th-search{position:relative; margin-bottom:28px;}
.th-search .write-input{width:100%;}
.th-search-hits{margin-top:8px; display:flex; flex-direction:column; gap:4px; background:var(--panel); border:1px solid var(--border-soft); border-radius:12px; padding:6px;}
.th-hit{display:flex; align-items:center; gap:10px; padding:8px 10px; border-radius:8px; text-align:left; font-size:13px; color:var(--text);}
.th-hit:hover{background:var(--panel-2);}
.th-hit small{margin-left:auto; font-size:11px; color:var(--text-dim);}
.th-hit-icon{width:30px; height:30px; flex:none; display:flex; align-items:center; justify-content:center; background:var(--panel-2); border:1px solid var(--border-soft); border-radius:8px;}
.th-hit-icon img{max-width:100%; max-height:100%; image-rendering:pixelated;}

.th-summary-grid{display:grid; grid-template-columns:repeat(auto-fill, minmax(260px, 1fr)); gap:10px;}
.th-summary{display:flex; align-items:center; gap:12px; padding:12px 14px; background:var(--panel); border:1px solid var(--border-soft); border-radius:12px; text-align:left;}
.th-summary:hover{border-color:var(--gold-dim);}
.th-summary-body{display:flex; flex-direction:column; gap:2px; min-width:0;}
.th-summary-name{font-size:13.5px; color:var(--text); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.th-summary-meta{font-size:11px; color:var(--text-dim);}

@media (max-width:760px){
  .th-stats{grid-template-columns:repeat(3, 1fr);}
  .th-stat b{font-size:18px;}
}
</style>
