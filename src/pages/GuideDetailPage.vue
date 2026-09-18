<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import guideData from '../data/guides.json'
import { CLASS_ICONS } from '../icons.js'

const route = useRoute()
const guide = computed(() => guideData.find((g) => g.id === route.params.id))
const related = computed(() =>
  guide.value ? guideData.filter((g) => g.classKey === guide.value.classKey && g.id !== guide.value.id) : []
)
</script>

<template>
  <div class="items-page guide-detail-page" v-if="guide">
  <header>
    <div class="logo">
      <router-link to="/" style="display: flex; align-items: center; gap: 8px; color: inherit">
        <span class="logo-mark"></span>디아사전
      </router-link>
    </div>
    <div class="crumb">
      <router-link to="/">메인</router-link> / <router-link to="/guides">빌드 가이드</router-link> / <b>{{ guide.className }}</b>
    </div>
  </header>

  <div class="grid-wrap guide-detail-wrap">
    <div class="d-eyebrow">
      <span class="guide-class-icon"><svg viewBox="0 0 24 24" v-html="CLASS_ICONS[guide.classKey]"></svg></span>
      {{ guide.className }} · {{ guide.tier }}
    </div>
    <h1 class="d-name guide-detail-title">{{ guide.title }}</h1>
    <div class="guide-detail-date">{{ guide.date }}</div>
    <p class="guide-detail-summary">{{ guide.summary }}</p>

    <div class="guide-detail-grid">
      <main>
        <div class="d-section-title">스탯 우선순위</div>
        <div class="note-box">{{ guide.statPriority }}</div>

        <div class="d-section-title">스킬 트리 순서</div>
        <div class="affix-list">
          <div class="affix-line skill-order-line" v-for="(s, i) in guide.skillOrder" :key="i">
            <span class="skill-order-level">Lv {{ s.level }}</span>
            <span class="a-text">{{ s.skill }}</span>
          </div>
        </div>

        <div class="d-section-title">추천 장비</div>
        <div class="affix-list">
          <div class="affix-line" v-for="(item, i) in guide.keyItems" :key="i">
            <span class="a-text">{{ item }}</span>
          </div>
        </div>

        <div class="d-section-title">레벨링 노트</div>
        <div class="affix-list">
          <div class="affix-line" v-for="(n, i) in guide.levelingNotes" :key="i">
            <span class="a-text">{{ n }}</span>
          </div>
        </div>

        <div class="strength-grid">
          <div class="strength-box good">
            <h4>장점</h4>
            <ul><li v-for="(s, i) in guide.strengths" :key="i">{{ s }}</li></ul>
          </div>
          <div class="strength-box bad">
            <h4>단점</h4>
            <ul><li v-for="(w, i) in guide.weaknesses" :key="i">{{ w }}</li></ul>
          </div>
        </div>
      </main>

      <aside>
        <div class="side-block tool-box">
          <h3>이 빌드의 아이템이 궁금하다면</h3>
          <p>가이드에 언급된 아이템 옵션을 아이템 사전에서 찾아보세요</p>
          <router-link to="/items">아이템 검색하기</router-link>
        </div>
        <div class="side-block board-box" v-if="related.length">
          <h3>{{ guide.className }} 다른 가이드</h3>
          <ul>
            <li v-for="r in related" :key="r.id">
              <router-link :to="`/guides/${r.id}`">{{ r.title }}</router-link>
            </li>
          </ul>
        </div>
      </aside>
    </div>
  </div>
  </div>
  <div class="items-page" v-else>
    <div class="grid-wrap">
      <div class="empty-state">가이드를 찾을 수 없어요. <router-link to="/guides">가이드 목록으로</router-link></div>
    </div>
  </div>
</template>

<style scoped>
.guide-detail-wrap{max-width:960px;}
.guide-class-icon{
  display:inline-flex; width:20px; height:20px; border:1px solid var(--border); background:var(--panel-2);
  align-items:center; justify-content:center; vertical-align:-5px; margin-right:6px;
}
.guide-class-icon svg{width:11px; height:11px; stroke:var(--gold-dim); fill:none; stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round;}
.guide-detail-title{font-size:28px; margin:10px 0 8px;}
.guide-detail-date{font-size:11.5px; color:var(--text-dim); margin-bottom:16px;}
.guide-detail-summary{font-size:14px; color:var(--text-muted); margin-bottom:26px; line-height:1.65; max-width:640px;}

.guide-detail-grid{display:grid; grid-template-columns:1fr 280px; gap:28px; align-items:start;}
.skill-order-line{display:flex; gap:12px;}
.skill-order-level{color:var(--gold-dim); font-weight:700; font-size:12px; flex:none; width:70px;}

.strength-grid{display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:8px;}
.strength-box{border:1px solid var(--border-soft); padding:14px 16px;}
.strength-box h4{font-size:12.5px; margin-bottom:8px; font-family:'Noto Serif KR', serif;}
.strength-box.good h4{color:var(--green);}
.strength-box.bad h4{color:var(--blood);}
.strength-box li{font-size:12.5px; color:var(--text-muted); padding:3px 0; line-height:1.5;}

@media (max-width:800px){
  .guide-detail-grid{grid-template-columns:1fr;}
  .strength-grid{grid-template-columns:1fr;}
}
</style>
