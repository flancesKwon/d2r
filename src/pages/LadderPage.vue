<script setup>
import ladder from '../data/ladder.json'
</script>

<template>
  <div class="items-page ladder-page">

  <div class="patch-hero">
    <div class="patch-hero-inner">
      <div class="eyebrow">시즌 안내</div>
      <h1>{{ ladder.seasonName }}</h1>
    </div>
  </div>

  <div class="grid-wrap ladder-wrap">
    <div class="ladder-status-row">
      <div class="ladder-status-item">
        <div class="label">상태</div>
        <div class="value accent">{{ ladder.status }}</div>
      </div>
      <div class="ladder-status-item">
        <div class="label">패치 버전</div>
        <div class="value">v{{ ladder.patchVersion }}</div>
      </div>
      <div class="ladder-status-item">
        <div class="label">시작일</div>
        <div class="value">{{ ladder.startDate }}</div>
      </div>
      <div class="ladder-status-item">
        <div class="label">종료 예상</div>
        <div class="value">{{ ladder.endDateEstimate }}</div>
      </div>
    </div>

    <div class="d-section-title">이번 시즌 주요 내용</div>
    <div class="affix-list">
      <div class="affix-line" v-for="(h, i) in ladder.highlights" :key="i">
        <span class="a-text">{{ h }}</span>
      </div>
    </div>

    <div class="d-section-title">시즌 종료 · 초기화 안내</div>
    <div class="affix-list">
      <div class="affix-line" v-for="(r, i) in ladder.resetInfo" :key="i">
        <span class="a-text">{{ r }}</span>
      </div>
    </div>

    <div class="d-section-title">자주 묻는 질문</div>
    <div class="ladder-faq">
      <div class="ladder-faq-item" v-for="(f, i) in ladder.faq" :key="i">
        <div class="ladder-faq-q">Q. {{ f.q }}</div>
        <div class="ladder-faq-a">A. {{ f.a }}</div>
      </div>
    </div>
  </div>
  </div>
</template>

<style scoped>
/* 벨로그처럼 여백 넉넉한 둥근 카드 느낌 - 톤은 그대로 두고 각진 표/구분선 대신
   둥근 카드로 나눔 */
.ladder-wrap{max-width:1180px;}
.ladder-status-row{display:grid; grid-template-columns:repeat(4, 1fr); gap:12px; margin-bottom:28px;}
.ladder-status-item{background:var(--panel); border:1px solid var(--border-soft); padding:18px 16px; border-radius:14px;}
.ladder-status-item .label{font-size:11px; color:var(--text-dim); margin-bottom:6px;}
.ladder-status-item .value{font-size:15px; font-weight:600; color:var(--text);}
.ladder-status-item .value.accent{color:var(--gold);}

.affix-list{border-radius:14px; overflow:hidden;}

.ladder-faq{display:flex; flex-direction:column; gap:12px; margin-bottom:20px; border:none;}
.ladder-faq-item{background:var(--panel); border:1px solid var(--border-soft); padding:16px 18px; border-radius:14px;}
.ladder-faq-q{font-size:13.5px; color:var(--gold); font-weight:600; margin-bottom:6px;}
.ladder-faq-a{font-size:13px; color:var(--text-muted); line-height:1.6;}


@media (max-width:700px){
  .ladder-status-row{grid-template-columns:1fr 1fr;}
}
</style>
