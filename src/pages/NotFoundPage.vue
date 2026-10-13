<template>
  <div class="items-page">
    <div class="grid-wrap">
      <div class="empty-state not-found">
        <div class="not-found-code">404</div>
        <h1 class="not-found-msg">{{ $t('없는 페이지') }}</h1>
        <router-link to="/">{{ $t('홈으로') }}</router-link>
      </div>
    </div>
  </div>
</template>

<style scoped>
.not-found{display:flex; flex-direction:column; align-items:center; gap:10px; padding:90px 20px;}
.not-found-code{font-family:'Noto Serif KR', serif; font-weight:900; font-size:48px; color:var(--gold-dim); line-height:1;}
/* 제목 태그지만 첫 화면의 큰 제목처럼 보이지 않게 - 본문 글꼴·굵기로 */
.not-found-msg{font-family:'Noto Sans KR', sans-serif; font-weight:400; font-size:inherit;}
</style>
