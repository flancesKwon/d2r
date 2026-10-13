<template>
  <footer class="site-footer">
    <div class="site-footer-inner">
      <div class="site-footer-brand">
        <b>{{ $t('디아허브') }}</b>
        <span>{{ $t('비공식 팬 제작 사이트 · Blizzard Entertainment와 무관') }}</span>
      </div>
      <nav class="site-footer-links" :aria-label="$t('하단 메뉴')">
        <div>
          <b>{{ $t('도구') }}</b>
          <router-link to="/runewords">{{ $t('룬워드 찾기') }}</router-link>
          <router-link to="/simulator">{{ $t('스킬 시뮬레이터') }}</router-link>
          <router-link to="/breakpoints">{{ $t('브레이크포인트') }}</router-link>
          <router-link to="/craft-sim">{{ $t('크래프트 시뮬레이터') }}</router-link>
        </div>
        <div>
          <b>{{ $t('자료') }}</b>
          <router-link to="/items">{{ $t('아이템 사전') }}</router-link>
          <router-link to="/guides">{{ $t('빌드 가이드') }}</router-link>
          <router-link to="/cube">{{ $t('큐브 레시피') }}</router-link>
          <router-link to="/patch">{{ $t('패치노트') }}</router-link>
        </div>
        <div>
          <b>{{ $t('커뮤니티') }}</b>
          <router-link to="/">{{ $t('거래게시판') }}</router-link>
          <router-link to="/community">{{ $t('커뮤니티') }}</router-link>
          <router-link to="/community?cat=공지">{{ $t('공지사항') }}</router-link>
          <router-link to="/community/write?cat=공략">{{ $t('가이드 제보') }}</router-link>
          <router-link to="/community?cat=건의">{{ $t('건의') }}</router-link>
          <router-link to="/community/write?cat=버그제보">{{ $t('버그 제보') }}</router-link>
          <router-link to="/terms">{{ $t('이용 규칙') }}</router-link>
          <router-link to="/privacy">{{ $t('개인정보 처리 안내') }}</router-link>
        </div>
      </nav>
    </div>
  </footer>
</template>

<style scoped>
.site-footer{border-top:1px solid var(--border-soft); background:var(--bg-raise); margin-top:24px;}
.site-footer-inner{max-width:1232px; margin:0 auto; padding:24px 24px 26px; display:flex; justify-content:space-between; gap:24px 32px; flex-wrap:wrap;}
.site-footer-brand{display:flex; flex-direction:column; gap:6px; max-width:360px; font-size:12px; color:var(--text-dim); line-height:1.6;}
.site-footer-brand b{font-family:'Noto Serif KR', serif; font-size:16px; color:var(--text);}
.site-footer-links{display:flex; gap:48px; flex-wrap:wrap;}
.site-footer-links div{display:flex; flex-direction:column; gap:4px; font-size:12.5px; line-height:1.5;}
.site-footer-links b{font-size:12px; color:var(--gold-dim); margin-bottom:2px;}
.site-footer-links a{color:var(--text-muted);}
.site-footer-links a:hover{color:var(--gold);}
/* 폰에서는 세 칸이 두 줄로 쪼개지면서 푸터가 화면의 절반을 넘게 차지함 - 3단 격자로 한 줄에 */
@media (max-width:560px){
  .site-footer-inner{padding:20px 16px 22px; gap:16px;}
  .site-footer-brand{max-width:none;}
  .site-footer-links{display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:14px 10px; width:100%;}
  .site-footer-links div{font-size:12px;}
}
</style>
