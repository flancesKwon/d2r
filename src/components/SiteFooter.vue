<template>
  <footer class="site-footer">
    <div class="site-footer-inner">
      <div class="site-footer-brand">
        <b>디아허브</b>
        <span>비공식 팬 제작 사이트 · Blizzard Entertainment와 무관</span>
      </div>
      <nav class="site-footer-links" aria-label="하단 메뉴">
        <div>
          <b>도구</b>
          <router-link to="/runewords">룬워드 찾기</router-link>
          <router-link to="/simulator">스킬 시뮬레이터</router-link>
          <router-link to="/breakpoints">브레이크포인트</router-link>
          <router-link to="/craft-sim">크래프트 시뮬레이터</router-link>
        </div>
        <div>
          <b>자료</b>
          <router-link to="/items">아이템 사전</router-link>
          <router-link to="/guides">빌드 가이드</router-link>
          <router-link to="/cube">큐브 레시피</router-link>
          <router-link to="/patch">패치노트</router-link>
        </div>
        <div>
          <b>커뮤니티</b>
          <router-link to="/trade">거래게시판</router-link>
          <router-link to="/community">커뮤니티</router-link>
          <router-link to="/community/write?cat=공략">가이드 제보</router-link>
          <router-link to="/community/write?cat=질문">문의</router-link>
          <router-link to="/terms">이용 규칙</router-link>
          <router-link to="/privacy">개인정보 처리 안내</router-link>
        </div>
      </nav>
    </div>
  </footer>
</template>

<style scoped>
.site-footer{border-top:1px solid var(--border-soft); background:var(--bg-raise); margin-top:24px;}
.site-footer-inner{max-width:1232px; margin:0 auto; padding:32px 24px 40px; display:flex; justify-content:space-between; gap:32px; flex-wrap:wrap;}
.site-footer-brand{display:flex; flex-direction:column; gap:6px; max-width:360px; font-size:12px; color:var(--text-dim); line-height:1.6;}
.site-footer-brand b{font-family:'Noto Serif KR', serif; font-size:16px; color:var(--text);}
.site-footer-links{display:flex; gap:48px; flex-wrap:wrap;}
.site-footer-links div{display:flex; flex-direction:column; gap:6px; font-size:12.5px;}
.site-footer-links b{font-size:12px; color:var(--gold-dim); margin-bottom:2px;}
.site-footer-links a{color:var(--text-muted);}
.site-footer-links a:hover{color:var(--gold);}
</style>
