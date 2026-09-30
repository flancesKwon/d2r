<script setup>
// 이용 정지 중일 때 모든 화면 위에 띄움 - 글·댓글·거래·쪽지 쓰기는 DB(RLS)가 막음
import { computed } from 'vue'
import { authState, suspendedUntil, suspensionText } from '../profileStore.js'

const until = computed(() => suspendedUntil(authState.profile))
</script>

<template>
  <div class="suspended-banner" role="status" v-if="until">
    <b>이용 정지된 계정</b>
    <span>{{ suspensionText(until) }}<template v-if="authState.profile?.suspended_reason"> · 사유: {{ authState.profile.suspended_reason }}</template></span>
    <span class="suspended-sub">정지 중에는 글·댓글·판매글·구매신청·쪽지 작성 불가</span>
  </div>
</template>

<style scoped>
.suspended-banner{
  display:flex; flex-wrap:wrap; gap:4px 12px; align-items:baseline; justify-content:center;
  padding:10px 16px; font-size:13px; color:#f0c2b6; background:#3a1a14; border-bottom:1px solid #6b2a1f; text-align:center;
}
.suspended-banner b{color:#ffd9cf;}
.suspended-sub{color:#d59a8c; font-size:12px;}
</style>
