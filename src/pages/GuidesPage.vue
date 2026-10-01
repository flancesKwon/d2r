<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { CLASS_ICONS } from '../icons.js'
import { guidesState, loadGuides, canEditGuides } from '../guideStore.js'

// 가이드는 DB(운영진이 사이트에서 씀), DB에 못 붙으면 사이트에 들어 있던 것
loadGuides()
const guides = computed(() => guidesState.list)
const route = useRoute()

const classList = [
  { key: 'amazon', name: '아마존' },
  { key: 'sorc', name: '소서리스' },
  { key: 'necro', name: '네크로맨서' },
  { key: 'paladin', name: '팔라딘' },
  { key: 'barb', name: '바바리안' },
  { key: 'druid', name: '드루이드' },
  { key: 'assassin', name: '어쌔신' },
  { key: 'warlock', name: '악마술사' },
]

const CLASS_KEYS = classList.map((c) => c.key)
const activeClass = ref(CLASS_KEYS.includes(route.query.class) ? route.query.class : null)
// 보기: 목록 / 티어리스트 (?view=tier) - 상단 메뉴에서 바로 들어올 수 있게 주소로도 받음
const view = ref(route.query.view === 'tier' ? 'tier' : 'list')
watch(() => route.query, (q) => {
  view.value = q.view === 'tier' ? 'tier' : 'list'
  activeClass.value = CLASS_KEYS.includes(q.class) ? q.class : null
})
// 티어별로 묶기 (S -> A -> B ...), 티어 안에서는 최신순
const TIER_ORDER = ['S TIER', 'A TIER', 'B TIER', 'C TIER']
const tierRows = computed(() =>
  TIER_ORDER.map((t) => ({
    tier: t.replace(' TIER', ''),
    guides: filteredGuides.value.filter((g) => g.tier === t).sort((a, b) => b.date.localeCompare(a.date)),
  })).filter((r) => r.guides.length)
)

function setClass(key) {
  activeClass.value = activeClass.value === key ? null : key
}

const filteredGuides = computed(() => {
  if (!activeClass.value) return guides.value
  return guides.value.filter((g) => g.classKey === activeClass.value)
})
</script>

<template>
  <div class="items-page guides-page">

  <div class="patch-hero">
    <div class="patch-hero-inner">
      <div class="eyebrow">직업별 빌드 가이드</div>
      <h1>빌드 가이드</h1>
    </div>
  </div>

  <div class="toolbar">
    <div class="toolbar-inner">
      <div class="cat-tabs view-tabs">
        <button :class="{ active: view === 'list' }" @click="view = 'list'">목록</button>
        <button :class="{ active: view === 'tier' }" @click="view = 'tier'">티어리스트</button>
      </div>
      <router-link v-if="canEditGuides" class="guide-write-btn" :to="{ path: '/guides/new', query: activeClass ? { class: activeClass } : {} }">가이드 쓰기</router-link>
      <div class="cat-tabs">
        <button :class="{ active: activeClass === null }" @click="activeClass = null">전체</button>
        <button
          v-for="c in classList"
          :key="c.key"
          :class="{ active: activeClass === c.key }"
          @click="setClass(c.key)"
        >
          {{ c.name }}
        </button>
      </div>
    </div>
  </div>

  <div class="grid-wrap">
    <div class="tier-list" v-if="view === 'tier'">
      <div class="tier-row" v-for="r in tierRows" :key="r.tier" :class="'t-' + r.tier">
        <div class="tier-badge">{{ r.tier }}</div>
        <div class="tier-guides">
          <router-link class="tier-guide" v-for="g in r.guides" :key="g.id" :to="`/guides/${g.id}`">
            <span class="guide-class-icon"><svg viewBox="0 0 24 24" v-html="CLASS_ICONS[g.classKey]"></svg></span>
            <span class="tier-guide-text"><b>{{ g.title }}</b><small>{{ g.className }}</small></span>
          </router-link>
        </div>
      </div>
      <div class="empty-state" v-if="!tierRows.length">가이드 없음</div>
    </div>
    <div class="guide-grid guide-grid-wide" v-else>
      <router-link class="guide-card" v-for="g in filteredGuides" :key="g.id" :to="`/guides/${g.id}`">
        <div class="guide-top">
          <span class="guide-class-icon"><svg viewBox="0 0 24 24" v-html="CLASS_ICONS[g.classKey]"></svg></span>
          <div class="guide-class-badge">{{ g.className }}</div>
          <span class="guide-tier">{{ g.tier }}</span>
        </div>
        <div class="guide-title">{{ g.title }}<span class="guide-draft" v-if="g.published === false">비공개</span></div>
        <div class="guide-desc">{{ g.desc }}</div>
        <div class="guide-date">{{ g.date }}</div>
      </router-link>
      <div class="empty-state" v-if="filteredGuides.length === 0">가이드 없음</div>
    </div>
  </div>
  </div>
</template>

<style scoped>
/* 벨로그처럼 여백 넉넉한 둥근 카드 느낌 - 톤은 그대로 두고 카드만 둥글게 + 호버 시
   그림자 생기게 (커뮤니티/거래게시판과 같은 톤) */
.cat-tabs button{border-radius:999px;}
.guide-grid-wide{display:grid; grid-template-columns:repeat(3, 1fr); gap:16px;}
.guide-write-btn{margin-left:auto; padding:8px 16px; border-radius:10px; border:1px solid var(--gold-dim); color:var(--gold); font-size:13px; font-weight:600; white-space:nowrap;}
.guide-write-btn:hover{background:var(--panel-2);}
.guide-draft{font-size:10.5px; color:var(--text-dim); border:1px dashed var(--border); padding:1px 7px; border-radius:999px; margin-left:6px;}
.guide-card{border-radius:16px; padding:22px 24px;}
.guide-card:hover{box-shadow:0 10px 26px -10px rgba(0,0,0,0.55);}
.guide-class-icon{
  width:26px; height:26px; border:1px solid var(--border); background:var(--panel-2);
  display:flex; align-items:center; justify-content:center; flex:none; margin-right:2px; border-radius:8px;
}
.guide-class-icon svg{width:14px; height:14px; stroke:var(--gold-dim); fill:none; stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round;}
.guide-class-badge{border-radius:999px;}
.view-tabs{margin-bottom:10px;}
.tier-list{display:flex; flex-direction:column; gap:10px;}
.tier-row{display:grid; grid-template-columns:72px 1fr; border:1px solid var(--border-soft); background:var(--panel); border-radius:14px; overflow:hidden;}
.tier-badge{display:flex; align-items:center; justify-content:center; font-family:'Noto Serif KR', serif; font-size:28px; font-weight:900; color:#1b1714;}
.t-S .tier-badge{background:#d4553a;}
.t-A .tier-badge{background:var(--gold);}
.t-B .tier-badge{background:var(--teal);}
.t-C .tier-badge{background:var(--text-dim);}
.tier-guides{display:grid; grid-template-columns:repeat(auto-fill, minmax(min(260px, 100%), 1fr)); gap:8px; padding:12px; min-width:0;}
/* 폰: 등급 칸을 줄이고 카드가 남은 폭에 맞게 (예전엔 260px 고정이라 오른쪽이 잘림) */
@media (max-width:560px){ .tier-row{grid-template-columns:52px minmax(0, 1fr);} .tier-badge{font-size:22px;} .tier-guides{padding:8px;} }
.tier-guide{display:flex; align-items:center; gap:10px; padding:10px 12px; border:1px solid var(--border-soft); border-radius:10px; background:var(--panel-2); transition:border-color .15s;}
.tier-guide:hover{border-color:var(--gold-dim);}
.tier-guide-text{display:flex; flex-direction:column; min-width:0;}
.tier-guide-text b{font-size:13px; color:var(--text); font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;}
.tier-guide-text small{font-size:11px; color:var(--text-dim);}
@media (max-width:900px){ .guide-grid-wide{grid-template-columns:1fr 1fr;} }
@media (max-width:600px){ .guide-grid-wide{grid-template-columns:1fr;} }
</style>
