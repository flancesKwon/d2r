<script setup>
import marketTiers from '../data/marketTiers.json'
</script>

<template>
  <div class="items-page market-page">
  <header>
    <div class="logo">
      <router-link to="/" style="display: flex; align-items: center; gap: 8px; color: inherit">
        <span class="logo-mark"></span>디아사전
      </router-link>
    </div>
    <div class="crumb"><router-link to="/">메인</router-link> / <b>시세 게시판</b></div>
  </header>

  <div class="patch-hero">
    <div class="patch-hero-inner">
      <div class="eyebrow">거래 참고 자료</div>
      <h1>시세 게시판</h1>
      <p>룬·유니크 아이템의 대략적인 체감 가치 등급을 정리했어요. 실시간 거래가는 아니에요.</p>
    </div>
  </div>

  <div class="grid-wrap market-wrap">
    <div class="note-box market-warn">
      서버·난이도·시즌(레더/논레더)에 따라 실제 거래가는 크게 달라질 수 있어요. 정확한 현재 시세는
      <router-link to="/trade">거래게시판</router-link>에서 실제 판매글을 참고해주세요.
    </div>

    <div class="market-tier-list">
      <div class="market-tier-card" v-for="t in marketTiers" :key="t.tier">
        <div class="market-tier-head">
          <span class="market-tier-name">{{ t.tier }}</span>
          <span class="market-tier-note">{{ t.note }}</span>
        </div>
        <div class="market-item-chips">
          <span class="market-chip" v-for="(item, i) in t.items" :key="i">{{ item }}</span>
        </div>
      </div>
    </div>
  </div>
  </div>
</template>

<style scoped>
.market-wrap{max-width:860px;}
.market-warn{margin-bottom:26px; line-height:1.6;}
.market-warn a{color:var(--gold-dim); border-bottom:1px solid var(--gold-dim);}
.market-warn a:hover{color:var(--gold);}

.market-tier-list{display:flex; flex-direction:column; gap:14px;}
.market-tier-card{border:1px solid var(--border-soft); background:var(--panel); padding:18px 20px;}
.market-tier-head{display:flex; align-items:baseline; gap:12px; margin-bottom:14px; flex-wrap:wrap;}
.market-tier-name{font-family:'Noto Serif KR', serif; font-weight:700; font-size:16px; color:var(--gold);}
.market-tier-note{font-size:12px; color:var(--text-dim);}
.market-item-chips{display:flex; flex-wrap:wrap; gap:8px;}
.market-chip{font-size:12.5px; color:var(--text-muted); border:1px solid var(--border); padding:6px 12px;}
</style>
