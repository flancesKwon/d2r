<script setup>
import LogoMark from '../components/LogoMark.vue'
// 정적 콘텐츠 위주 페이지라 별도 상태 로직은 없음
</script>

<template>
  <div class="home-page">
  <header>
    <div class="header-top">
      <div class="logo"><LogoMark :size="20" />디아허브</div>
      <div class="search-pill"><span class="label">가이드 · 아이템 검색</span><span class="chev">▾</span></div>
      <div class="header-icons"><router-link to="/signup" class="signup-link">회원가입</router-link><span>⚙</span></div>
    </div>
    <nav class="subnav">
      <router-link to="/" class="active">메인</router-link>
      <div class="nav-item">
        <router-link to="/guides">빌드 가이드<span class="chev">▾</span></router-link>
        <div class="dropdown">
          <router-link to="/guides">티어리스트</router-link>
          <div class="ddiv"></div>
          <div class="dgroup-label">직업별</div>
          <router-link to="/guides?class=amazon">아마존</router-link><router-link to="/guides?class=sorc">소서리스</router-link>
          <router-link to="/guides?class=necro">네크로맨서</router-link><router-link to="/guides?class=paladin">팔라딘</router-link>
          <router-link to="/guides?class=barb">바바리안</router-link><router-link to="/guides?class=druid">드루이드</router-link>
          <router-link to="/guides?class=assassin">어쌔신</router-link><router-link to="/guides?class=warlock">악마술사</router-link>
        </div>
      </div>
      <div class="nav-item">
        <router-link to="/community">커뮤니티<span class="chev">▾</span></router-link>
        <div class="dropdown">
          <router-link to="/community?cat=잡담">자유게시판</router-link>
          <router-link to="/community?cat=질문">질문게시판</router-link>
          <router-link to="/trade">거래게시판</router-link>
          <router-link to="/community?cat=공략">공략 인증</router-link>
        </div>
      </div>
      <div class="nav-item">
        <a href="#">자료실<span class="chev">▾</span></a>
        <div class="dropdown">
          <router-link to="/items?cat=runeword">룬워드 계산기</router-link>
          <router-link to="/simulator">스킬·스탯 시뮬레이터</router-link>
          <router-link to="/market">시세 게시판</router-link><router-link to="/ladder">레더 시즌 정보</router-link>
          <router-link to="/cube">큐브 레시피</router-link>
        </div>
      </div>
      <router-link to="/items">아이템 사전</router-link>
      <router-link to="/simulator">스킬 시뮬레이터</router-link>
      <router-link to="/patch">패치노트</router-link>
    </nav>
  </header>

  <section class="hero-section">
    <div class="hero">
      <div class="hero-copy">
        <div class="eyebrow">디아블로 2 레저렉션 · 비공식</div>
        <h1>레더 시즌, <span class="accent">뭐 키울지</span> 고민될 때.</h1>
        <p>직업별 검증된 빌드부터 스킬 트리, 필요 장비까지 — 스탯 찍기 전에 한 번 훑어보세요.</p>
        <div class="hero-cta">
          <router-link class="btn-primary" to="/guides">빌드 가이드 보기</router-link>
          <router-link class="btn-ghost" to="/community">커뮤니티 가기</router-link>
        </div>
      </div>
      <div class="card-stage">
        <div class="mock-card back-a">
          <div class="mc-class">팔라딘</div><div class="mc-name">함머딘</div>
          <div class="mc-skill"><span>블레스드 해머</span><b>20</b></div>
          <div class="mc-skill"><span>컨센트레이션</span><b>20</b></div>
          <span class="mc-tier">S TIER</span>
        </div>
        <div class="mock-card back-b">
          <div class="mc-class">바바리안</div><div class="mc-name">웜바바</div>
          <div class="mc-skill"><span>워크라이</span><b>20</b></div>
          <div class="mc-skill"><span>배틀오더스</span><b>20</b></div>
          <span class="mc-tier">A TIER</span>
        </div>
        <div class="mock-card front">
          <div class="mc-class">소서리스</div><div class="mc-name">파벽 소서리스</div>
          <div class="mc-skill"><span>파이어볼</span><b>20</b></div>
          <div class="mc-skill"><span>파이어월</span><b>20</b></div>
          <div class="mc-skill"><span>워름스</span><b>1</b></div>
          <span class="mc-tier">S TIER · 초보 추천</span>
        </div>
      </div>
    </div>
    <div class="banner-strip">
      <div class="banner-strip-inner">
        <router-link to="/community"><span class="tag">오픈</span>커뮤니티 게시판 오픈</router-link>
        <router-link to="/items"><span class="tag">신규</span>아이템 사전 730종 데이터 오픈</router-link>
      </div>
    </div>
  </section>

  <div class="main-layout">
    <main>
      <div class="section-head"><h2>직업별 빌드 가이드</h2></div>
      <div class="class-grid">
        <router-link class="class-card c-amazon" to="/guides?class=amazon"><div class="class-icon"><svg viewBox="0 0 24 24"><path d="M7 4a12 12 0 000 16M7 4l10 8-10 8"/></svg></div><div class="class-name">아마존</div><div class="class-sub">1개 빌드</div></router-link>
        <router-link class="class-card c-sorc" to="/guides?class=sorc"><div class="class-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="2.6"/><path d="M12 7.6V21"/></svg></div><div class="class-name">소서리스</div><div class="class-sub">1개 빌드</div></router-link>
        <router-link class="class-card c-necro" to="/guides?class=necro"><div class="class-icon"><svg viewBox="0 0 24 24"><path d="M12 3v18M7 8l10 8M17 8L7 16"/></svg></div><div class="class-name">네크로맨서</div><div class="class-sub">1개 빌드</div></router-link>
        <router-link class="class-card c-paladin" to="/guides?class=paladin"><div class="class-icon"><svg viewBox="0 0 24 24"><path d="M12 3l7 3v6c0 5-3 8-7 9-4-1-7-4-7-9V6l7-3z"/></svg></div><div class="class-name">팔라딘</div><div class="class-sub">1개 빌드</div></router-link>
        <router-link class="class-card c-barb" to="/guides?class=barb"><div class="class-icon"><svg viewBox="0 0 24 24"><path d="M12 21V9"/><circle cx="12" cy="6.5" r="3.5"/></svg></div><div class="class-name">바바리안</div><div class="class-sub">1개 빌드</div></router-link>
        <router-link class="class-card c-druid" to="/guides?class=druid"><div class="class-icon"><svg viewBox="0 0 24 24"><path d="M12 3c4 4 7 7 7 11a7 7 0 11-14 0c0-4 3-7 7-11z"/></svg></div><div class="class-name">드루이드</div><div class="class-sub">1개 빌드</div></router-link>
        <router-link class="class-card c-assassin" to="/guides?class=assassin"><div class="class-icon"><svg viewBox="0 0 24 24"><path d="M12 3v12M9 6h6M9 17l3 4 3-4"/></svg></div><div class="class-name">어쌔신</div><div class="class-sub">1개 빌드</div></router-link>
        <router-link class="class-card c-warlock" to="/guides?class=warlock"><div class="class-icon"><svg viewBox="0 0 24 24"><path d="M6 9l6-6 6 6-6 12-6-12z"/><path d="M6 9h12"/></svg></div><div class="class-name">악마술사</div><div class="class-sub">DLC 신규</div></router-link>
      </div>

      <div class="section-head"><h2>최신 가이드</h2><router-link class="more" to="/guides">전체 보기</router-link></div>
      <div class="guide-grid">
        <router-link class="guide-card" to="/guides/g-sorc-fire">
          <div class="guide-top"><div class="guide-class-badge">소서리스</div><span class="guide-tier">S TIER</span></div>
          <div class="guide-title">파벽 소서리스 — 초보자용 완전 정복</div>
          <div class="guide-desc">스킬 트리, 필요 장비, 레벨링 순서까지 한 번에</div>
          <div class="guide-date">09.15</div>
        </router-link>
        <router-link class="guide-card" to="/guides/g-pal-hammer">
          <div class="guide-top"><div class="guide-class-badge">팔라딘</div><span class="guide-tier">S TIER</span></div>
          <div class="guide-title">함머딘 스탯/스킬 찍는 순서</div>
          <div class="guide-desc">1인 파밍부터 파티 서포트까지 — 상황별 트리 변형</div>
          <div class="guide-date">09.14</div>
        </router-link>
        <router-link class="guide-card" to="/guides/g-barb-wolf">
          <div class="guide-top"><div class="guide-class-badge">바바리안</div></div>
          <div class="guide-title">웜바바 vs 파바바, 뭐가 나한테 맞을까</div>
          <div class="guide-desc">플레이 스타일별 비교 + 초반 장비 추천</div>
          <div class="guide-date">09.12</div>
        </router-link>
        <router-link class="guide-card" to="/guides/g-necro-bone">
          <div class="guide-top"><div class="guide-class-badge">네크로맨서</div><span class="guide-tier">A TIER</span></div>
          <div class="guide-title">본넥 레벨링 루트 — 노말부터 헬까지</div>
          <div class="guide-desc">본스피어 → 본스펠 전환 타이밍 짚어드려요</div>
          <div class="guide-date">09.10</div>
        </router-link>
      </div>
    </main>

    <aside>
      <div class="side-block promo-box">
        <div class="p-tag">공략 제보</div>
        <h3>내 빌드 자랑하고<br />다른 유저 의견도 들어보세요</h3>
        <router-link to="/community?cat=공략">가이드 제보하러 가기</router-link>
      </div>
      <div class="side-block board-box">
        <h3>커뮤니티 최신글 <router-link class="more" to="/community">더보기</router-link></h3>
        <ul>
          <li><router-link to="/community/c8"><span class="tag">질문</span>함머딘 방어구 뭐부터 맞춰야 하나요</router-link><span class="meta">3</span></li>
          <li><router-link to="/community/c7"><span class="tag">거래</span>인페르노 자유 나눔합니다</router-link><span class="meta">2</span></li>
          <li><router-link to="/community/c6"><span class="tag">잡담</span>레더 시작하신 분들 계신가요</router-link><span class="meta">4</span></li>
          <li><router-link to="/community/c5"><span class="tag">공략</span>본넥으로 첫 100렙 찍었어요</router-link><span class="meta">2</span></li>
        </ul>
      </div>
      <div class="side-block board-box">
        <h3>패치노트 <router-link class="more" to="/patch">더보기</router-link></h3>
        <ul>
          <li><router-link to="/patch">3.2 밸런스 패치 요약</router-link><span class="meta">09.11</span></li>
          <li><router-link to="/patch">시즌 진행 상황 조정 안내</router-link><span class="meta">09.05</span></li>
          <li><router-link to="/patch">버그 수정 패치 3.1.1</router-link><span class="meta">08.28</span></li>
        </ul>
      </div>
      <div class="side-block tool-box">
        <h3>아이템 사전</h3>
        <p>가이드에서 언급된 아이템 옵션이 궁금하면</p>
        <router-link to="/items">아이템 검색하기</router-link>
      </div>
      <aside class="ad-slot"><span class="ad-label">광고</span><div class="ad-box">300×250</div></aside>
    </aside>
  </div>

  <footer>
    <div class="footer-inner">
      <span>비공식 팬 제작 사이트 · Blizzard Entertainment와 무관</span>
      <nav><router-link to="/community?cat=공략">가이드 제보</router-link><router-link to="/patch">패치노트</router-link><router-link to="/community?cat=질문">문의</router-link></nav>
    </div>
  </footer>
  </div>
</template>
