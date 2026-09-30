<script setup>
import { computed } from 'vue'
import marketTiers from '../data/marketTiers.json'
import itemsData from '../data/items.json'
import { ITEM_ICONS } from '../itemIcons.js'
import { tradeState, loadTradePosts } from '../tradeStore.js'

// 체감 가치 등급표 - 아이템은 사전의 영문 이름으로 참조해서 한글 이름·아이콘이 사전과 항상 같음
// (예전엔 이름을 직접 적어서 "조던 룬(Jah)"처럼 틀린 이름이 들어갔었음 - scripts/check-item-data.js 가 검사)
const BY_EN = new Map(itemsData.map((it) => [it.name_en, it]))
const iconUrl = (it) => (it?.icon_key && ITEM_ICONS[it.icon_key] || null)

// 거래게시판에서 지금 팔리고 있는 매물 수 (판매중·흥정중)
const activeCount = computed(() => {
  const m = new Map()
  for (const p of tradeState.posts) {
    if (!p.itemId || p.status !== '판매중') continue
    m.set(p.itemId, (m.get(p.itemId) || 0) + 1)
  }
  return m
})
loadTradePosts()
const tiers = computed(() =>
  marketTiers.map((t) => ({
    ...t,
    items: t.items.map((en) => BY_EN.get(en)).filter(Boolean),
  }))
)
const CAT_KO = { unique: '유니크', set: '세트', runeword: '룬워드', gem: '룬' }
</script>

<template>
  <div class="items-page market-page">
  <div class="patch-hero">
    <div class="patch-hero-inner">
      <div class="eyebrow">거래 참고 자료</div>
      <h1>시세 게시판</h1>
    </div>
  </div>

  <div class="grid-wrap market-wrap">

    <div class="market-tier-list">
      <section class="market-tier-card" v-for="(t, ti) in tiers" :key="t.tier" :class="'tier-' + ti">
        <div class="market-tier-head">
          <span class="market-tier-badge">{{ t.tier }}</span>
          <span class="market-tier-note" v-if="t.note">{{ t.note }}</span>
        </div>
        <div class="market-items">
          <router-link
            v-for="it in t.items" :key="it.id" class="market-item" :class="it.category"
            :to="{ path: '/trade', query: { q: it.name_ko } }"
          >
            <span class="market-item-icon"><img v-if="iconUrl(it)" :src="iconUrl(it)" alt="" /></span>
            <span class="market-item-text">
              <span class="market-item-name">{{ it.name_ko }}</span>
              <span class="market-item-sub">
                {{ it.type_sub === '룬' ? '룬' : CAT_KO[it.category] || '' }}
                <template v-if="activeCount.get(it.id)"> · 매물 {{ activeCount.get(it.id) }}</template>
              </span>
            </span>
          </router-link>
        </div>
      </section>
    </div>
  </div>
  </div>
</template>

<style scoped>
.market-wrap{max-width:1180px;}

.market-tier-list{display:flex; flex-direction:column; gap:14px;}
.market-tier-card{border:1px solid var(--border-soft); background:var(--panel); padding:20px 22px; border-radius:16px; border-left:3px solid var(--border);}
.market-tier-card.tier-0{border-left-color:#d4553a;}
.market-tier-card.tier-1{border-left-color:var(--gold);}
.market-tier-card.tier-2{border-left-color:var(--teal);}
.market-tier-card.tier-3{border-left-color:var(--text-dim);}
.market-tier-head{display:flex; align-items:center; gap:12px; margin-bottom:14px; flex-wrap:wrap;}
.market-tier-badge{font-family:'Noto Serif KR', serif; font-weight:700; font-size:16px; color:var(--gold);}
.market-tier-note{font-size:12px; color:var(--text-dim);}
.market-items{display:grid; grid-template-columns:repeat(auto-fill, minmax(190px, 1fr)); gap:8px;}
.market-item{
  display:flex; align-items:center; gap:10px; padding:8px 10px; border-radius:12px;
  background:var(--panel-2); border:1px solid var(--border-soft); transition:border-color .15s, transform .15s;
}
.market-item:hover{border-color:var(--gold-dim); transform:translateY(-1px);}
.market-item-icon{width:34px; height:34px; flex:none; display:flex; align-items:center; justify-content:center;}
.market-item-icon img{max-width:100%; max-height:100%; image-rendering:pixelated;}
.market-item-text{display:flex; flex-direction:column; min-width:0;}
.market-item-name{font-size:13px; font-weight:600; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;}
.market-item.unique .market-item-name{color:var(--gold);}
.market-item.set .market-item-name{color:var(--green);}
.market-item-sub{font-size:11px; color:var(--text-dim);}
</style>
