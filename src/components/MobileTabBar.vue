<script setup>
// 폰 화면 하단 탭 (720px 이하) - 모드마다 자주 가는 곳 5개
//   거래: 매물 / 시세 / + 등록 / 커뮤니티 / 내 거래
//   DB:   DB 홈 / 아이템 사전 / 도구 / 커뮤니티 / 가이드
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useSiteMode, under } from '../siteMode.js'
import { stripLocale, t } from '../i18n.js'

const route = useRoute()
const mode = useSiteMode()
const P = {
  list: 'M7 7h11l-3-3M17 17H6l3 3',
  chart: 'M4 19V9M10 19V5M16 19v-7M22 19H2',
  chat: 'M4 5h16v11H9l-5 4zM8 9h8M8 12h5',
  deal: 'M12 8a4 4 0 1 0 0 .01M4 21c1-4 4.5-6 8-6s7 2 8 6',
  db: 'M5 6c0-1.7 3.1-3 7-3s7 1.3 7 3-3.1 3-7 3-7-1.3-7-3M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6',
  book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM8 7h7',
  tool: 'M14 6a4 4 0 0 1-5 5L4 16l4 4 5-5a4 4 0 0 1 5-5l-3-3z',
  guide: 'M4 4h10l6 6v10H4zM14 4v6h6',
}
const TABS = {
  trade: [
    { to: '/', label: '매물', icon: P.list, match: (p) => p === '/' || (under(p, '/trade') && !under(p, '/trade/history') && p !== '/trade/new') },
    { to: '/market', label: '시세', icon: P.chart, match: (p) => under(p, '/market') || under(p, '/trade/history') },
    { to: '/trade/new', label: '판매글 등록', plus: true, match: (p) => p === '/trade/new' },
    { to: '/community?cat=거래', label: '커뮤니티', icon: P.chat, match: (p) => under(p, '/community') },
    { to: '/deals', label: '내 거래', icon: P.deal, match: (p) => under(p, '/deals') || under(p, '/mypage') },
  ],
  db: [
    { to: '/db', label: 'DB 홈', icon: P.db, match: (p) => p === '/db' },
    { to: '/items', label: '아이템', icon: P.book, match: (p) => under(p, '/items') },
    { to: '/runewords', label: '도구', icon: P.tool, match: (p) => ['/runewords', '/craft-sim', '/simulator', '/cube', '/breakpoints', '/sockets'].some((x) => under(p, x)) },
    { to: '/community', label: '커뮤니티', icon: P.chat, match: (p) => under(p, '/community') },
    { to: '/guides', label: '가이드', icon: P.guide, match: (p) => under(p, '/guides') || under(p, '/patch') || under(p, '/ladder') },
  ],
}
const tabs = computed(() => TABS[mode.value].map((tab) => ({ ...tab, label: t(tab.label), here: tab.match(stripLocale(route.path)) })))
</script>

<template>
  <nav class="mtab" :class="mode" aria-label="하단 메뉴">
    <router-link v-for="t in tabs" :key="t.to" :to="t.to" class="mtab-item" :class="{ here: t.here, plus: t.plus }" :aria-current="t.here ? 'page' : null" :aria-label="t.plus ? t.label : null">
      <span v-if="t.plus" class="mtab-plus" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg></span>
      <template v-else>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path :d="t.icon" /></svg>
        <span>{{ t.label }}</span>
      </template>
    </router-link>
  </nav>
</template>

<style scoped>
.mtab{display:none;}
@media (max-width:720px){
  .mtab{
    display:grid; grid-template-columns:repeat(5, minmax(0, 1fr)); position:fixed; left:0; right:0; bottom:0; z-index:45;
    background:rgba(18,16,14,.97); backdrop-filter:blur(8px); border-top:1px solid var(--border-soft);
    padding:4px 4px calc(6px + env(safe-area-inset-bottom));
  }
}
.mtab-item{display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px; min-height:52px; font-size:11px; color:var(--text-muted);}
.mtab-item svg{width:22px; height:22px; fill:none; stroke:currentColor; stroke-width:2; stroke-linecap:round; stroke-linejoin:round;}
.mtab-item.here{color:var(--gold); font-weight:700;}
.mtab.db .mtab-item.here{color:#7CC3C3;}
.mtab-plus{width:44px; height:44px; border-radius:999px; background:var(--gold); color:#1a1408; display:flex; align-items:center; justify-content:center;}
.mtab-plus svg{width:22px; height:22px; stroke-width:2.8;}
.mtab-item.plus.here .mtab-plus{box-shadow:0 0 0 3px rgba(200,163,77,.35);}
</style>
