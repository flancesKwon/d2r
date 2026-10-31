<script setup>
import { patchNotes as notes, fetchDbPatchNotes } from '../patchStore.js'

fetchDbPatchNotes()
const jump = (id) => document.getElementById('patch-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
</script>

<template>
  <div class="items-page patch-page">

  <div class="patch-hero">
    <div class="patch-hero-inner">
      <div class="eyebrow">{{ $t('업데이트 기록') }}</div>
      <h1>{{ $t('패치노트') }}</h1>
    </div>
  </div>

  <div class="grid-wrap patch-list-wrap">
    <nav class="patch-index" v-if="notes.length > 1">
      <a v-for="n in notes" :key="n.id" :href="'#patch-' + n.id" @click.prevent="jump(n.id)">v{{ n.version }}</a>
    </nav>
    <div class="patch-list">
      <article class="patch-article" v-for="n in notes" :key="n.id" :id="'patch-' + n.id">
        <div class="patch-row-top">
          <span class="patch-version">v{{ n.version }}</span>
          <span class="patch-tag" v-for="t in n.tags" :key="t">{{ t }}</span>
          <span class="patch-date">{{ n.date }}</span>
        </div>
        <h2 class="patch-title">{{ n.title }}</h2>
        <p class="patch-summary">{{ n.summary }}</p>
        <section v-for="(sec, i) in n.sections" :key="i" class="patch-sec">
          <h3 class="patch-sec-title">{{ sec.heading }}</h3>
          <ul class="patch-items">
            <li v-for="(line, j) in sec.items" :key="j">{{ line }}</li>
          </ul>
        </section>
      </article>
    </div>
  </div>
  </div>
</template>

<style scoped>
/* .patch-hero 계열 기본 스타일은 여러 페이지가 공유해서 style.css(전역)로 옮김 */
.patch-list-wrap{max-width:860px;}
.patch-index{display:flex; flex-wrap:wrap; gap:6px; margin-bottom:18px;}
.patch-index a{font-size:12px; color:var(--text-muted); border:1px solid var(--border); border-radius:999px; padding:4px 12px; text-decoration:none;}
.patch-index a:hover{border-color:var(--gold-dim); color:var(--gold);}
.patch-list{display:flex; flex-direction:column; gap:22px;}
.patch-article{background:var(--panel); border:1px solid var(--border-soft); border-radius:16px; padding:26px 28px; scroll-margin-top:80px;}
.patch-row-top{display:flex; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:10px;}
.patch-version{font-family:'Noto Serif KR', serif; font-weight:700; color:var(--gold); font-size:14px;}
.patch-tag{font-size:10.5px; color:var(--text-muted); border:1px solid var(--border); padding:3px 10px; border-radius:999px;}
.patch-date{margin-left:auto; font-size:12px; color:var(--text-dim);}
.patch-title{font-family:'Noto Serif KR', serif; font-weight:700; font-size:22px; margin:0 0 10px;}
.patch-summary{font-size:14px; color:var(--text-muted); line-height:1.7; margin:0 0 6px;}
.patch-sec{margin-top:20px;}
.patch-sec-title{font-size:15px; font-weight:700; color:var(--gold); margin:0 0 8px; padding-bottom:6px; border-bottom:1px solid var(--border-soft);}
.patch-items{margin:0; padding-left:20px; font-size:14px; line-height:1.75; color:var(--text);}
.patch-items li{margin-bottom:3px;}
@media (max-width:760px){
  .patch-article{padding:20px 18px;}
  .patch-title{font-size:19px;}
}
</style>
