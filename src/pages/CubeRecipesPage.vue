<script setup>
import LogoMark from '../components/LogoMark.vue'
import HeaderNotifications from '../components/HeaderNotifications.vue'
import { ref, computed } from 'vue'
import recipesData from '../data/cubeRecipes.json'
import runeChain from '../data/runeUpgradeChain.json'
import itemsData from '../data/items.json'
import iconsData from '../data/icons.json'

const CATEGORIES = ['크래프트', '수리', '업그레이드', '기타']
const activeCat = ref(null)
const searchQuery = ref('')

// 재료·결과 텍스트 안에 룬/보석 이름이 있으면 아이콘을 붙여서 보여주기 위한 조회표.
// 긴 이름부터 매칭해야 "최상급 다이아몬드"가 "다이아몬드"보다 먼저 잡힘
const ICON_ITEMS = itemsData.filter((it) => it.category === 'gem')
const ICON_BY_NAME = new Map(ICON_ITEMS.map((it) => [it.name_ko, it]))
const SORTED_NAMES = [...ICON_BY_NAME.keys()].sort((a, b) => b.length - a.length)

function findIconItem(text) {
  return SORTED_NAMES.find((n) => text.includes(n)) ? ICON_BY_NAME.get(SORTED_NAMES.find((n) => text.includes(n))) : null
}

function iconUrlFor(iconKey) {
  const b64 = iconKey && iconsData[iconKey]
  return b64 ? 'data:image/png;base64,' + b64 : null
}

const filteredRecipes = computed(() => {
  let list = recipesData
  if (activeCat.value) list = list.filter((r) => r.category === activeCat.value)
  const q = searchQuery.value.trim().toLowerCase()
  if (q) {
    list = list.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.formula.some((f) => f.in.some((m) => m.toLowerCase().includes(q)) || f.out.toLowerCase().includes(q))
    )
  }
  return list
})

const showRuneTable = computed(() => {
  if (activeCat.value && activeCat.value !== '업그레이드') return false
  const q = searchQuery.value.trim()
  if (!q) return true
  return runeChain.some((s) => s.from.includes(q) || s.to.includes(q) || (s.gem && s.gem.includes(q)))
})
const filteredRuneChain = computed(() => {
  const q = searchQuery.value.trim()
  if (!q) return runeChain
  return runeChain.filter((s) => s.from.includes(q) || s.to.includes(q) || (s.gem && s.gem.includes(q)))
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
          <input type="text" v-model="searchQuery" placeholder="레시피·재료 검색 (예: 조드, 소켓, 크래프트)" aria-label="큐브 레시피 검색" />
        </div>
      </div>
    </div>
  </div>

  <div class="grid-wrap cube-list-wrap">
    <div class="cube-list">
      <div class="cube-card" v-for="r in filteredRecipes" :key="r.id">
        <div class="cube-card-top">
          <span class="cube-cat" :class="'cat-' + r.category">{{ r.category }}</span>
          <span class="cube-title">{{ r.title }}</span>
        </div>
        <div class="cube-formula-row" v-for="(f, i) in r.formula" :key="i">
          <div class="cube-chip-group">
            <span class="cube-chip" v-for="(m, j) in f.in" :key="j">
              <span class="cube-chip-icon" v-if="findIconItem(m)"><img :src="iconUrlFor(findIconItem(m).icon_key)" alt="" /></span>
              {{ m }}
            </span>
          </div>
          <span class="cube-arrow">→</span>
          <div class="cube-result-chip">
            <span class="cube-chip-icon" v-if="findIconItem(f.out)"><img :src="iconUrlFor(findIconItem(f.out).icon_key)" alt="" /></span>
            {{ f.out }}
          </div>
        </div>
        <div class="cube-note" v-if="r.note">{{ r.note }}</div>
      </div>

      <div class="cube-card cube-rune-card" v-if="showRuneTable">
        <div class="cube-card-top">
          <span class="cube-cat cat-업그레이드">업그레이드</span>
          <span class="cube-title">룬 업그레이드 전체표 (엘 → 조드)</span>
        </div>
        <div class="cube-rune-table">
          <div class="cube-rune-row" v-for="(s, i) in filteredRuneChain" :key="i">
            <span class="cube-rune-qty">{{ s.qty }}×</span>
            <span class="cube-chip rune-chip">
              <span class="cube-chip-icon" v-if="findIconItem(s.from)"><img :src="iconUrlFor(findIconItem(s.from).icon_key)" alt="" /></span>
              {{ s.from }}
            </span>
            <template v-if="s.gem">
              <span class="cube-plus">+</span>
              <span class="cube-chip gem-chip">
                <span class="cube-chip-icon" v-if="findIconItem(s.gem)"><img :src="iconUrlFor(findIconItem(s.gem).icon_key)" alt="" /></span>
                {{ s.gem }}
              </span>
            </template>
            <span class="cube-arrow">→</span>
            <span class="cube-chip rune-chip result">
              <span class="cube-chip-icon" v-if="findIconItem(s.to)"><img :src="iconUrlFor(findIconItem(s.to).icon_key)" alt="" /></span>
              {{ s.to }}
            </span>
          </div>
        </div>
        <div class="cube-note">엘~오르트 구간은 룬 3개만 있으면 되고, 보석은 주울 룬부터 필요해요. 구간이 올라갈수록(최하급→하급→일반→상급) 필요한 보석 등급도 같이 올라가요.</div>
      </div>

      <div class="empty-state" v-if="filteredRecipes.length === 0 && !showRuneTable">일치하는 레시피가 없어요</div>
    </div>
  </div>
  </div>
</template>

<style scoped>
.cat-tabs button{border-radius:999px;}
.search-input-wrap{border-radius:10px; overflow:hidden;}
.search-row{width:100%;}
.search-input-wrap input{width:100%;}

.cube-list-wrap{max-width:1180px;}
.cube-list{display:flex; flex-direction:column; gap:16px;}
.cube-card{
  border:1px solid var(--border-soft); background:var(--panel); padding:24px 26px; border-radius:16px;
  display:flex; flex-direction:column; gap:16px;
}
.cube-card-top{display:flex; align-items:center; gap:12px; flex-wrap:wrap;}
.cube-cat{
  font-size:11px; padding:4px 13px; border-radius:999px; flex:none; font-weight:600;
  border:1px solid var(--border);
}
.cube-cat.cat-크래프트{color:var(--blood); border-color:var(--blood);}
.cube-cat.cat-수리{color:var(--teal); border-color:var(--teal);}
.cube-cat.cat-업그레이드{color:var(--gold); border-color:var(--gold-dim);}
.cube-cat.cat-기타{color:var(--text-muted); border-color:var(--border);}
.cube-title{font-family:'Noto Serif KR', serif; font-weight:700; font-size:17px;}

.cube-formula-row{display:flex; align-items:center; gap:12px; flex-wrap:wrap; padding:14px 16px; background:var(--panel-2); border-radius:12px;}
.cube-chip-group{display:flex; flex-wrap:wrap; gap:8px; flex:1; min-width:0;}
.cube-chip{
  display:inline-flex; align-items:center; gap:6px; background:var(--panel); border:1px solid var(--border-soft);
  padding:6px 12px 6px 6px; border-radius:999px; font-size:12.5px; color:var(--text-muted); white-space:nowrap;
}
.cube-chip-icon{width:20px; height:20px; flex:none; display:flex; align-items:center; justify-content:center;}
.cube-chip-icon img{width:100%; height:100%; object-fit:contain; image-rendering:pixelated;}
.cube-arrow{font-size:16px; color:var(--gold-dim); flex:none; font-weight:700;}
.cube-result-chip{
  display:inline-flex; align-items:center; gap:8px; background:rgba(200,163,77,0.12); border:1px solid var(--gold-dim);
  padding:8px 16px 8px 8px; border-radius:999px; font-size:13px; color:var(--gold); font-weight:600; flex:none;
}
.cube-result-chip .cube-chip-icon{width:22px; height:22px;}

.cube-note{font-size:11.5px; color:var(--text-dim); line-height:1.6; border-top:1px solid var(--border-soft); padding-top:14px;}

.cube-rune-table{display:flex; flex-direction:column; gap:6px; max-height:640px; overflow-y:auto; padding-right:4px;}
.cube-rune-row{
  display:flex; align-items:center; gap:10px; padding:8px 14px; background:var(--panel-2); border-radius:10px;
  flex-wrap:wrap;
}
.cube-rune-qty{font-size:12px; color:var(--text-dim); font-weight:700; flex:none; width:24px;}
.rune-chip{border-color:var(--blood);}
.gem-chip{border-color:var(--teal);}
.rune-chip.result{border-color:var(--gold-dim); color:var(--gold); font-weight:600;}
.cube-plus{color:var(--text-dim); font-size:13px; flex:none;}
</style>
