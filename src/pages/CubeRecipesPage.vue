<script setup>
import HeaderNotifications from '../components/HeaderNotifications.vue'
import LogoMark from '../components/LogoMark.vue'
import { ref, computed } from 'vue'
import recipesData from '../data/cubeRecipes.json'

const CATEGORIES = ['크래프트', '수리', '업그레이드', '기타']
const activeCat = ref(null)
const searchQuery = ref('')

const filteredRecipes = computed(() => {
  let list = recipesData
  if (activeCat.value) list = list.filter((r) => r.category === activeCat.value)
  const q = searchQuery.value.trim().toLowerCase()
  if (q) {
    list = list.filter(
      (r) => r.title.toLowerCase().includes(q) || r.materials.some((m) => m.toLowerCase().includes(q))
    )
  }
  return list
})
</script>

<template>
  <div class="items-page cube-page">
  <header>
    <div class="logo">
      <router-link to="/" style="display: flex; align-items: center; gap: 8px; color: inherit">
        <LogoMark />디아허브
      </router-link>
    </div>
    <div class="crumb"><router-link to="/">메인</router-link> / <b>큐브 레시피</b></div>
    <HeaderNotifications />
  </header>

  <div class="patch-hero">
    <div class="patch-hero-inner">
      <div class="eyebrow">호라드림 큐브 활용법</div>
      <h1>큐브 레시피</h1>
      <p>크래프트, 수리, 룬·보석·아이템 업그레이드, 그 외 유용한 조합법까지 카테고리별로 정리했어요.</p>
    </div>
  </div>

  <div class="toolbar">
    <div class="toolbar-inner">
      <div class="cat-tabs">
        <button :class="{ active: activeCat === null }" @click="activeCat = null">전체</button>
        <button v-for="c in CATEGORIES" :key="c" :class="{ active: activeCat === c }" @click="activeCat = c">
          {{ c }}
        </button>
      </div>
      <div class="search-row">
        <div class="search-input-wrap">
          <input type="text" v-model="searchQuery" placeholder="레시피·재료 검색" aria-label="큐브 레시피 검색" />
        </div>
        <span class="result-count">{{ filteredRecipes.length }}개</span>
      </div>
    </div>
  </div>

  <div class="grid-wrap cube-list-wrap">
    <div class="cube-list">
      <div class="cube-card" v-for="r in filteredRecipes" :key="r.id">
        <div class="cube-card-top">
          <span class="cube-cat">{{ r.category }}</span>
          <span class="cube-title">{{ r.title }}</span>
        </div>
        <div class="cube-section">
          <div class="cube-section-label">재료</div>
          <ul class="cube-material-list">
            <li v-for="(m, i) in r.materials" :key="i">{{ m }}</li>
          </ul>
        </div>
        <div class="cube-section">
          <div class="cube-section-label">결과</div>
          <div class="cube-result">{{ r.result }}</div>
        </div>
        <div class="cube-note" v-if="r.note">{{ r.note }}</div>
      </div>
      <div class="empty-state" v-if="filteredRecipes.length === 0">일치하는 레시피가 없어요</div>
    </div>
  </div>
  </div>
</template>

<style scoped>
.cat-tabs button{border-radius:999px;}
.search-input-wrap{border-radius:10px; overflow:hidden;}

.cube-list-wrap{max-width:1180px;}
.cube-list{display:grid; grid-template-columns:repeat(auto-fill, minmax(340px, 1fr)); gap:16px;}
.cube-card{
  border:1px solid var(--border-soft); background:var(--panel); padding:22px 24px; border-radius:16px;
  display:flex; flex-direction:column; gap:14px;
  transition:transform .15s, box-shadow .15s, border-color .15s;
}
.cube-card:hover{border-color:var(--gold-dim); transform:translateY(-2px); box-shadow:0 10px 26px -10px rgba(0,0,0,0.55);}
.cube-card-top{display:flex; flex-direction:column; gap:8px;}
.cube-cat{
  font-size:10.5px; color:var(--gold-dim); border:1px solid var(--border); padding:3px 11px; border-radius:999px;
  align-self:flex-start;
}
.cube-title{font-family:'Noto Serif KR', serif; font-weight:700; font-size:16px;}
.cube-section-label{font-size:11px; color:var(--text-dim); margin-bottom:6px; font-weight:600;}
.cube-material-list{list-style:none; display:flex; flex-direction:column; gap:5px;}
.cube-material-list li{
  font-size:12.5px; color:var(--text-muted); line-height:1.6; padding-left:14px; position:relative;
}
.cube-material-list li::before{content:'·'; position:absolute; left:2px; color:var(--gold-dim);}
.cube-result{font-size:13px; color:var(--text); line-height:1.6;}
.cube-note{font-size:11.5px; color:var(--text-dim); line-height:1.6; border-top:1px solid var(--border-soft); padding-top:12px;}
</style>
