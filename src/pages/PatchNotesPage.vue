<script setup>
import HeaderNotifications from '../components/HeaderNotifications.vue'
import LogoMark from '../components/LogoMark.vue'
import { ref } from 'vue'
import patchData from '../data/patchNotes.json'

const notes = patchData
const selected = ref(null)
</script>

<template>
  <div class="items-page patch-page">
  <header>
    <div class="logo">
      <router-link to="/" style="display: flex; align-items: center; gap: 8px; color: inherit">
        <LogoMark />디아허브
      </router-link>
    </div>
    <div class="crumb"><router-link to="/">메인</router-link> / <b>패치노트</b></div>
    <HeaderNotifications />
  </header>

  <div class="patch-hero">
    <div class="patch-hero-inner">
      <div class="eyebrow">업데이트 기록</div>
      <h1>패치노트</h1>
      <p>밸런스 조정, 버그 수정, 시즌 소식을 한 곳에서 확인하세요.</p>
    </div>
  </div>

  <div class="grid-wrap patch-list-wrap">
    <div class="patch-list">
      <button class="patch-row" v-for="n in notes" :key="n.id" @click="selected = n">
        <div class="patch-row-top">
          <span class="patch-version">v{{ n.version }}</span>
          <span class="patch-tag" v-for="t in n.tags" :key="t">{{ t }}</span>
        </div>
        <div class="patch-title">{{ n.title }}</div>
        <div class="patch-summary">{{ n.summary }}</div>
        <div class="patch-date">{{ n.date }}</div>
      </button>
    </div>
  </div>

  <div class="modal-overlay" v-if="selected" @click.self="selected = null">
    <div class="modal-panel patch-modal">
      <button class="modal-close" @click="selected = null">✕</button>
      <div class="d-eyebrow">v{{ selected.version }} · {{ selected.date }}</div>
      <h1 class="d-name patch-modal-title">{{ selected.title }}</h1>
      <div class="patch-tag-row">
        <span class="patch-tag" v-for="t in selected.tags" :key="t">{{ t }}</span>
      </div>
      <p class="patch-modal-summary">{{ selected.summary }}</p>
      <div v-for="(sec, i) in selected.sections" :key="i">
        <div class="d-section-title">{{ sec.heading }}</div>
        <div class="affix-list">
          <div class="affix-line" v-for="(line, j) in sec.items" :key="j">
            <span class="a-text">{{ line }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
  </div>
</template>

<style scoped>
/* 벨로그처럼 여백 넉넉한 둥근 카드 느낌 - 톤(어두운 배경, 금색 포인트)은 그대로 두고
   목록·모달을 각진 테두리 대신 둥근 카드로 바꿈 */
/* .patch-hero 계열 기본 스타일은 여러 페이지가 공유해서 style.css(전역)로 옮김 */

.patch-list-wrap{max-width:1180px;}
.patch-list{display:flex; flex-direction:column; gap:14px;}
.patch-row{
  display:block; width:100%; text-align:left; border:1px solid var(--border-soft); background:var(--panel);
  padding:22px 24px; cursor:pointer; transition:transform .15s, box-shadow .15s, border-color .15s; border-radius:16px;
}
.patch-row:hover{border-color:var(--gold-dim); transform:translateY(-2px); box-shadow:0 10px 26px -10px rgba(0,0,0,0.55);}
.patch-row-top{display:flex; align-items:center; gap:8px; margin-bottom:8px;}
.patch-version{font-family:'Noto Serif KR', serif; font-weight:700; color:var(--gold); font-size:13px;}
.patch-tag{font-size:10.5px; color:var(--text-muted); border:1px solid var(--border); padding:3px 10px; border-radius:999px;}
.patch-title{font-family:'Noto Serif KR', serif; font-weight:700; font-size:16px; margin-bottom:6px;}
.patch-summary{font-size:13px; color:var(--text-muted); margin-bottom:8px; line-height:1.6;}
.patch-date{font-size:11px; color:var(--text-dim);}

.modal-panel{border-radius:18px;}
.modal-close{border-radius:10px;}
.patch-modal{max-width:680px;}
.patch-modal-title{font-size:24px; margin:10px 0 12px;}
.patch-tag-row{display:flex; gap:6px; margin-bottom:16px;}
.patch-modal-summary{font-size:13.5px; color:var(--text-muted); margin-bottom:22px; line-height:1.6;}
.affix-list{border-radius:14px; overflow:hidden;}
</style>
