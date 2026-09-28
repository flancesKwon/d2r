<template>
  <div class="items-page">
    <div class="grid-wrap">
      <div class="empty-state not-found">
        <div class="not-found-code">404</div>
        <p>페이지를 찾을 수 없어요. 주소가 바뀌었거나 없는 페이지예요.</p>
        <router-link to="/">홈으로</router-link>
      </div>
    </div>
  </div>
</template>

<style scoped>
.not-found{display:flex; flex-direction:column; align-items:center; gap:10px; padding:90px 20px;}
.not-found-code{font-family:'Noto Serif KR', serif; font-weight:900; font-size:48px; color:var(--gold-dim); line-height:1;}
</style>
