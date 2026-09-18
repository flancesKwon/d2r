<script setup>
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import guideData from '../data/guides.json'
import { CLASS_ICONS } from '../icons.js'

const guides = guideData
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

const activeClass = ref(['amazon', 'sorc', 'necro', 'paladin', 'barb', 'druid', 'assassin', 'warlock'].includes(route.query.class) ? route.query.class : null)

function setClass(key) {
  activeClass.value = activeClass.value === key ? null : key
}

const filteredGuides = computed(() => {
  if (!activeClass.value) return guides
  return guides.filter((g) => g.classKey === activeClass.value)
})
</script>

<template>
  <div class="items-page guides-page">
  <header>
    <div class="logo">
      <router-link to="/" style="display: flex; align-items: center; gap: 8px; color: inherit">
        <span class="logo-mark"></span>디아사전
      </router-link>
    </div>
    <div class="crumb"><router-link to="/">메인</router-link> / <b>빌드 가이드</b></div>
  </header>

  <div class="patch-hero">
    <div class="patch-hero-inner">
      <div class="eyebrow">직업별 빌드 가이드</div>
      <h1>빌드 가이드</h1>
      <p>스킬 트리, 장비, 레벨링 루트까지 — 직업별로 골라보세요.</p>
    </div>
  </div>

  <div class="toolbar">
    <div class="toolbar-inner">
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
    <div class="guide-grid guide-grid-wide">
      <router-link class="guide-card" v-for="g in filteredGuides" :key="g.id" :to="`/guides/${g.id}`">
        <div class="guide-top">
          <span class="guide-class-icon"><svg viewBox="0 0 24 24" v-html="CLASS_ICONS[g.classKey]"></svg></span>
          <div class="guide-class-badge">{{ g.className }}</div>
          <span class="guide-tier">{{ g.tier }}</span>
        </div>
        <div class="guide-title">{{ g.title }}</div>
        <div class="guide-desc">{{ g.desc }}</div>
        <div class="guide-date">{{ g.date }}</div>
      </router-link>
      <div class="empty-state" v-if="filteredGuides.length === 0">아직 등록된 가이드가 없어요</div>
    </div>
  </div>
  </div>
</template>

<style scoped>
.guide-grid-wide{display:grid; grid-template-columns:repeat(3, 1fr); gap:14px;}
.guide-class-icon{
  width:26px; height:26px; border:1px solid var(--border); background:var(--panel-2);
  display:flex; align-items:center; justify-content:center; flex:none; margin-right:2px;
}
.guide-class-icon svg{width:14px; height:14px; stroke:var(--gold-dim); fill:none; stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round;}
@media (max-width:900px){ .guide-grid-wide{grid-template-columns:1fr 1fr;} }
@media (max-width:600px){ .guide-grid-wide{grid-template-columns:1fr;} }
</style>
