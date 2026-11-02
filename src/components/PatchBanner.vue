<script setup>
// 최신 패치노트 한 줄 배너 (메인·거래게시판 맨 위) - 날짜가 30일 안인 것만
import { computed } from 'vue'
import { patchNotes, fetchDbPatchNotes } from '../patchStore.js'

fetchDbPatchNotes()
const latest = computed(() => {
  const n = patchNotes.value[0]
  return n && new Date(n.date).getTime() > Date.now() - 30 * 86400000 ? n : null
})
const shortDate = (d) => (d || '').slice(5).replace('-', '.')
</script>

<template>
  <router-link v-if="latest" to="/patch" class="pb">
    <span class="pb-badge">{{ $t('패치노트') }}</span>
    <span class="pb-title"><b>v{{ latest.version }}</b> {{ latest.title }}</span>
    <span class="pb-date">{{ shortDate(latest.date) }}</span>
    <span class="pb-go" aria-hidden="true">→</span>
  </router-link>
</template>

<style scoped>
.pb{display:flex; align-items:center; gap:10px; padding:10px 16px; background:var(--panel); border:1px solid var(--gold-dim); border-radius:12px; font-size:13.5px; color:var(--text);}
.pb:hover{border-color:var(--gold);}
.pb-badge{flex:none; font-size:11px; font-weight:700; color:var(--bg, #14110d); background:var(--gold); border-radius:999px; padding:2px 10px;}
.pb-title{flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.pb-title b{color:var(--gold); margin-right:4px;}
.pb-date{flex:none; font-size:12px; color:var(--text-dim);}
.pb-go{flex:none; color:var(--gold);}
</style>
