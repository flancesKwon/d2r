<script setup>
</script>

<template>
  <div class="items-page market-page">
  <div class="patch-hero">
    <div class="patch-hero-inner">
      <div class="eyebrow">{{ $t('거래 참고 자료') }}</div>
      <h1>{{ $t('시세 게시판') }}</h1>
    </div>
  </div>

  <div class="grid-wrap market-wrap">
    <div class="empty-state">{{ $t('시세 게시판은 개발 예정입니다.') }}</div>
  </div>
  </div>
</template>

<style scoped>
.market-wrap{max-width:1180px;}
</style>
