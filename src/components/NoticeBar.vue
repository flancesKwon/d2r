<script setup>
// 메인 화면 공지 한 줄 - 올린 지 7일 안의 공지 글 (거래 메인·DB 메인 공통)
import { ref, onMounted } from 'vue'
import { useAutoRefresh } from '../useAutoRefresh.js'
import { fetchRecentNotice } from '../communityStore.js'

const notice = ref(null)
const load = () => fetchRecentNotice().then((p) => (notice.value = p)).catch(() => {})
onMounted(load)
useAutoRefresh(load)
</script>

<template>
  <router-link v-if="notice" :to="`/community/${notice.id}`" class="hm-notice">
    <span class="hm-notice-tag">{{ $t('공지') }}</span><span class="hm-notice-title">{{ notice.title }}</span><span class="hm-notice-date">{{ notice.date }}</span>
  </router-link>
</template>

<style scoped>
.hm-notice{display:flex; align-items:center; gap:10px; padding:11px 16px; margin:10px 0 20px; border-radius:12px;
  background:rgba(200,163,77,0.06); border:1px solid rgba(200,163,77,0.25); font-size:13.5px;}
.hm-notice-tag{font-size:11px; font-weight:700; color:#1b1714; background:var(--gold); border-radius:6px; padding:2px 8px; flex:none;}
.hm-notice-title{flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--text);}
.hm-notice-date{font-size:11.5px; color:var(--text-dim); flex:none;}
</style>
