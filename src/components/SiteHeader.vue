<script setup>
// 모든 페이지 공통 상단 메뉴
// - 사이트를 [거래 | DB] 두 모드로 나눔: 로고 옆 스위치로 전환, 메뉴는 지금 모드 것만
//   거래: 매물(첫 화면) / 시세 / 거래내역 / 내 거래 / 커뮤니티
//   DB: 빌드 가이드 / 아이템 사전 / 도구 / 정보 / 커뮤니티
//   커뮤니티·쪽지·마이페이지처럼 양쪽 공용 화면은 마지막으로 있던 모드를 유지
// - 통합 검색: 아이템 사전 + 사이트 페이지(도구 등)를 한 번에
// - 좁은 화면: 햄버거 버튼으로 전체 메뉴 펼침
import { ref, shallowRef, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
const LOGO = import.meta.env.BASE_URL + 'logo.png'
import HeaderNotifications from './HeaderNotifications.vue'
import HeaderOnlineUsers from './HeaderOnlineUsers.vue'
import { isStaff } from '../profileStore.js'
import { useNow } from '../useNow.js'
import { useSiteMode, under } from '../siteMode.js'
import { LOCALES, locale, stripLocale, itemName, t } from '../i18n.js'
import { switchLocale } from '../router.js'
import { ITEM_ICONS } from '../itemIcons.js'

const route = useRoute()
const router = useRouter()

const TRADE_MENUS = [
  {
    key: 'listings', label: '매물', to: '/', match: ['/', '/trade'],
    links: [{ label: '매물 보기', to: '/' }, { label: '판매글 등록', to: '/trade/new' }],
  },
  { key: 'wants', label: '삽니다', to: '/trade/wants', match: ['/trade/wants'], links: [] },
  { key: 'market', label: '시세', to: '/market', match: ['/market'], links: [] },
  { key: 'history', label: '거래내역', to: '/trade/history', match: ['/trade/history'], links: [] },
  { key: 'deals', label: '내 거래', to: '/deals', match: ['/deals'], links: [] },
]
const DB_MENUS = [
  {
    key: 'guides', label: '빌드 가이드', to: '/guides', match: ['/guides'],
    links: [
      { label: '전체 가이드', to: '/guides' },
      { label: '티어리스트', to: '/guides?view=tier' },
      { group: '직업별' },
      { label: '아마존', to: '/guides?class=amazon' }, { label: '소서리스', to: '/guides?class=sorc' },
      { label: '네크로맨서', to: '/guides?class=necro' }, { label: '팔라딘', to: '/guides?class=paladin' },
      { label: '바바리안', to: '/guides?class=barb' }, { label: '드루이드', to: '/guides?class=druid' },
      { label: '어쌔신', to: '/guides?class=assassin' }, { label: '악마술사', to: '/guides?class=warlock' },
    ],
  },
  {
    key: 'items', label: '아이템 사전', to: '/items', match: ['/items'],
    links: [
      { label: '전체', to: '/items' }, { label: '유니크', to: '/items?cat=unique' }, { label: '세트', to: '/items?cat=set' },
      { label: '룬워드', to: '/items?cat=runeword' }, { label: '보석·룬', to: '/items?cat=gem' },
    ],
  },
  {
    key: 'tools', label: '도구', to: '/runewords',
    match: ['/runewords', '/craft-sim', '/simulator', '/cube', '/breakpoints', '/sockets'],
    links: [
      { label: '룬워드 찾기', to: '/runewords', desc: '룬을 고르면 들어가는 룬워드' },
      { label: '스킬·스탯 시뮬레이터', to: '/simulator', desc: '스킬 트리·스탯·장비 계획' },
      { label: '공격 속도 계산기', to: '/breakpoints?tab=ias', desc: '직업·용병·무기·스킬별 공속 프레임' },
      { label: '브레이크포인트 계산기', to: '/breakpoints', desc: '시전·타격 회복·막기 속도 단계' },
      { label: '소켓 계산기', to: '/sockets', desc: '베이스별 최대 소켓 수' },
      { label: '크래프트 시뮬레이터', to: '/craft-sim', desc: '크래프트 결과 확률' },
      { label: '큐브 레시피', to: '/cube', desc: '업그레이드·수리·크래프트 조합' },
    ],
  },
  {
    key: 'info', label: '정보', to: '/patch', match: ['/patch', '/ladder'],
    links: [{ label: '패치노트', to: '/patch' }, { label: '레더 시즌 정보', to: '/ladder' }],
  },
]
// 커뮤니티는 양쪽 공용 - 거래 모드에선 거래 게시판을 맨 앞에
const COMMUNITY_LINKS = [
  { label: '전체', to: '/community' }, { label: '공지사항', to: '/community?cat=공지' }, { label: '거래 게시판', to: '/community?cat=거래' },
  { label: '자유게시판', to: '/community?cat=잡담' }, { label: '질문게시판', to: '/community?cat=질문' }, { label: '공략 인증', to: '/community?cat=공략' },
  { label: '건의게시판', to: '/community?cat=건의' }, { label: '버그 제보', to: '/community?cat=버그제보' },
]
const communityMenu = (mode) => ({
  key: 'community', label: '커뮤니티', to: mode === 'trade' ? '/community?cat=거래' : '/community', match: ['/community'],
  links: mode === 'trade' ? [COMMUNITY_LINKS[2], ...COMMUNITY_LINKS.filter((l, i) => i !== 2)] : COMMUNITY_LINKS,
})

const mode = useSiteMode()
const MENUS = computed(() => [...(mode.value === 'trade' ? TRADE_MENUS : DB_MENUS), communityMenu(mode.value)])
const ALL_MENUS = [...TRADE_MENUS, ...DB_MENUS, communityMenu('db')]
// 주소가 가장 길게 맞는 메뉴 ('/' 는 정확히 같을 때만 - /trade/history 는 거래내역)
const activeKey = computed(() => {
  const p = stripLocale(route.path)
  let best = ''
  let len = -1
  for (const m of MENUS.value) for (const pre of m.match) {
    const hit = pre === '/' ? p === '/' : under(p, pre)
    if (hit && pre.length > len) { best = m.key; len = pre.length }
  }
  return best
})

// 지금 화면에 해당하는 하위 메뉴 하나 (드롭다운·모바일 메뉴에 표시)
// 주소가 가장 길게 겹치는 링크, 같으면 ?cat= 같은 조건까지 맞는 링크 (/community?cat=공지 → 공지사항)
function linkScore(to) {
  const [lp, qs = ''] = to.split('?')
  const p = stripLocale(route.path)
  if (p !== lp && !p.startsWith(lp + '/')) return -1
  const q = [...new URLSearchParams(qs)]
  if (q.some(([k, v]) => route.query[k] !== v)) return -1
  return lp.length * 10 + q.length
}
const activeLink = computed(() => {
  let best = null
  let top = -1
  for (const m of MENUS.value) for (const l of m.links) {
    if (!l.to) continue
    const s = linkScore(l.to)
    if (s > top) { top = s; best = l.to }
  }
  return best
})

// 통합 검색
const PAGES = ALL_MENUS.flatMap((m) => [{ label: m.label, to: m.to }, ...m.links].filter((l) => l.to).map((l) => ({ ...l, section: m.label })))
  .filter((l, i, a) => a.findIndex((x) => x.to === l.to) === i)
const query = ref('')
const searchOpen = ref(false)
// 아이템 데이터(수 MB)는 검색을 처음 쓸 때 받음 - 모든 페이지 첫 로딩에 끼지 않게
const searchAllItems = shallowRef(null)
function loadItemSearch() {
  if (!searchAllItems.value) import('../tradeStore.js').then((m) => (searchAllItems.value = m.searchAllItems))
}
watch(query, (q) => q && loadItemSearch())
const itemHits = computed(() => (query.value.trim() && searchAllItems.value ? searchAllItems.value(query.value).slice(0, 6) : []))
const pageHits = computed(() => {
  const q = query.value.trim().replace(/\s/g, '')
  if (!q) return []
  return PAGES.filter((p) => [p.label, p.desc || '', p.section].flatMap((x) => [x, t(x)]).join('').replace(/\s/g, '').toLowerCase().includes(q.toLowerCase())).slice(0, 4)
})
const iconUrl = (it) => (it?.icon_key && ITEM_ICONS[it.icon_key] || null)
function goItem(it) {
  searchOpen.value = false
  query.value = ''
  router.push({ path: `/items/${it.id}`, query: { q: itemName(it) } })
}
function goPage(p) {
  searchOpen.value = false
  query.value = ''
  router.push(p.to)
}
function submitSearch() {
  if (itemHits.value[0]) return goItem(itemHits.value[0])
  if (pageHits.value[0]) return goPage(pageHits.value[0])
  if (query.value.trim()) router.push({ path: '/items', query: { q: query.value.trim() } })
  searchOpen.value = false
}
const hideSearchSoon = () => window.setTimeout(() => (searchOpen.value = false), 150)

// 모바일 메뉴
// 지금 시각 - 어느 페이지에서든 헤더에서 보이게 (구매신청·알림 시각과 비교하기 쉽게 시:분:초까지)
const now = useNow(1000)
const WEEKDAYS = { ko: ['일', '월', '화', '수', '목', '금', '토'], en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] }
const pad2 = (n) => String(n).padStart(2, '0')
const clockTime = computed(() => {
  const d = new Date(now.value)
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
})
const clockDate = computed(() => {
  const d = new Date(now.value)
  return `${d.getMonth() + 1}.${pad2(d.getDate())} (${(WEEKDAYS[locale.value] || WEEKDAYS.ko)[d.getDay()]})`
})

const mobileOpen = ref(false)
watch(() => route.fullPath, () => (mobileOpen.value = false))
</script>

<template>
  <header class="site-header">
    <div class="site-header-inner" :class="{ staff: isStaff() }">
      <router-link to="/" class="site-logo" :aria-label="$t('디아허브 홈')"><img :src="LOGO" :alt="$t('디아허브')" width="127" height="46"></router-link>
      <nav class="mode-switch" :aria-label="$t('모드')">
        <router-link to="/" class="mode-btn trade" :class="{ on: mode === 'trade' }" :aria-current="mode === 'trade' ? 'page' : null">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h11l-3-3M17 17H6l3 3" /></svg>{{ $t('거래') }}
        </router-link>
        <router-link to="/db" class="mode-btn db" :class="{ on: mode === 'db' }" :aria-current="mode === 'db' ? 'page' : null">
          <svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="6" rx="7" ry="3" /><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" /></svg>DB
        </router-link>
      </nav>

      <nav class="site-nav" :aria-label="$t('주 메뉴')">
        <div class="site-nav-item" v-for="m in MENUS" :key="m.key" :class="{ active: activeKey === m.key }">
          <router-link :to="m.to" class="site-nav-link">{{ $t(m.label) }}<span class="chev" aria-hidden="true" v-if="m.links.length">▾</span></router-link>
          <div class="site-dropdown" :class="{ wide: m.key === 'tools' }" v-if="m.links.length">
            <template v-for="(l, i) in m.links" :key="i">
              <div class="site-dropdown-group" v-if="l.group">{{ $t(l.group) }}</div>
              <router-link v-else :to="l.to" class="site-dropdown-link" :class="{ here: activeLink === l.to }" :aria-current="activeLink === l.to ? 'page' : null">
                <span>{{ $t(l.label) }}</span>
                <small v-if="l.desc">{{ $t(l.desc) }}</small>
              </router-link>
            </template>
          </div>
        </div>
      </nav>

      <div class="site-search" role="search" :class="{ hidden: stripLocale(route.path) === '/' }">
        <svg viewBox="0 0 24 24" class="site-search-icon" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>
        <input
          :value="query" type="search" :placeholder="$t('아이템·도구 검색')" :aria-label="$t('사이트 검색')"
          @focus="searchOpen = true; loadItemSearch()" @input="query = $event.target.value; searchOpen = true" @blur="hideSearchSoon" @keydown.enter.prevent="submitSearch"
        />
        <div class="site-search-results" v-if="searchOpen && (itemHits.length || pageHits.length)">
          <button type="button" class="site-search-row" v-for="p in pageHits" :key="p.to" @mousedown.prevent="goPage(p)">
            <span class="site-search-badge">{{ $t(p.section) }}</span>{{ $t(p.label) }}
          </button>
          <button type="button" class="site-search-row" v-for="it in itemHits" :key="it.id" @mousedown.prevent="goItem(it)">
            <span class="site-search-thumb"><img v-if="iconUrl(it)" :src="iconUrl(it)" alt="" /></span>
            <span class="site-search-name" :class="it.category">{{ itemName(it) }}</span>
            <small>{{ $t(it.category_label || it.type_sub || '') }}</small>
          </button>
        </div>
      </div>

      <div class="lang-switch" role="group" aria-label="Language">
        <button type="button" v-for="l in LOCALES" :key="l.code" :class="{ on: locale === l.code }" :aria-pressed="locale === l.code" :title="l.label" @click="locale !== l.code && switchLocale(l.code)">{{ l.short }}</button>
      </div>
      <div class="site-clock" :title="`${$t('현재 시각')} ${clockDate} ${clockTime}`" :aria-label="$t('현재 시각')">
        <span class="site-clock-date">{{ clockDate }}</span>
        <span class="site-clock-time">{{ clockTime }}</span>
      </div>
      <HeaderOnlineUsers />
      <HeaderNotifications />
      <button type="button" class="site-burger" :aria-expanded="mobileOpen" :aria-label="$t('메뉴 열기')" @click="mobileOpen = !mobileOpen">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
      </button>
    </div>

    <div class="site-mobile" v-if="mobileOpen">
      <div class="site-mobile-search">
        <input :value="query" @input="query = $event.target.value" type="search" :placeholder="$t('아이템·도구 검색')" :aria-label="$t('사이트 검색')" @keydown.enter.prevent="submitSearch" />
        <div class="site-mobile-hits" v-if="itemHits.length || pageHits.length">
          <button type="button" v-for="p in pageHits" :key="p.to" @click="goPage(p)">{{ $t(p.section) }} · {{ $t(p.label) }}</button>
          <button type="button" v-for="it in itemHits" :key="it.id" @click="goItem(it)">{{ itemName(it) }}</button>
        </div>
      </div>
      <HeaderOnlineUsers inline class="site-mobile-online" />
      <div class="site-mobile-group" v-for="m in MENUS" :key="m.key">
        <div class="site-mobile-title">{{ $t(m.label) }}</div>
        <div class="site-mobile-links">
          <router-link v-for="l in (m.links.length ? m.links : [{ label: m.label, to: m.to }]).filter((x) => x.to)" :key="l.to" :to="l.to" :class="{ here: activeLink === l.to }">{{ $t(l.label) }}</router-link>
        </div>
      </div>
      <div class="site-mobile-group">
        <div class="site-mobile-title">Language</div>
        <div class="site-mobile-links">
          <button type="button" v-for="l in LOCALES" :key="l.code" class="lang-pill" :class="{ here: locale === l.code }" @click="switchLocale(l.code)">{{ l.label }}</button>
        </div>
      </div>
    </div>
  </header>
</template>

<style scoped>
.site-header{position:sticky; top:0; z-index:40; background:rgba(25,21,18,0.94); backdrop-filter:blur(8px); border-bottom:1px solid var(--border-soft);}
.site-header-inner{max-width:1232px; margin:0 auto; height:56px; padding:0 24px; display:flex; align-items:center; gap:22px;}
.site-logo{display:flex; align-items:center; flex:none;}
.mode-switch{display:flex; flex:none; padding:3px; gap:2px; background:var(--panel); border:1px solid var(--border); border-radius:999px;}
.mode-btn{display:flex; align-items:center; gap:6px; padding:6px 16px; border-radius:999px; font-size:13.5px; font-weight:700; color:var(--text-muted); white-space:nowrap;}
.mode-btn svg{width:15px; height:15px; fill:none; stroke:currentColor; stroke-width:2; stroke-linecap:round; stroke-linejoin:round;}
.mode-btn:hover{color:var(--text);}
.mode-btn.trade.on{background:var(--gold); color:#1a1408;}
.mode-btn.db.on{background:#5FA8A8; color:#0b1a1a;}
.site-search.hidden{visibility:hidden;}
.lang-switch{display:flex; flex:none; border:1px solid var(--border); border-radius:8px; overflow:hidden;}
.lang-switch button{padding:4px 8px; font-size:11.5px; font-weight:700; color:var(--text-dim);}
.lang-switch button.on{background:var(--panel-2); color:var(--gold);}
.lang-switch button:hover{color:var(--text);}
.lang-pill{font-size:13px; color:var(--text-muted); border:1px solid var(--border); border-radius:999px; padding:5px 12px;}
.lang-pill.here{color:#1a1408; background:var(--gold); border-color:var(--gold); font-weight:600;}
.site-logo img{display:block; height:46px; width:auto;}
.site-nav{display:flex; align-items:stretch; height:100%; gap:2px;}
.site-nav-item{position:relative; display:flex;}
.site-nav-link{display:flex; align-items:center; gap:5px; padding:0 11px; font-size:14px; color:var(--text-muted); border-bottom:2px solid transparent; white-space:nowrap;}
.site-nav-item:hover .site-nav-link{color:var(--text);}
.site-nav-item.active .site-nav-link{color:var(--text); border-bottom-color:var(--gold); font-weight:600;}
.chev{font-size:9px; color:var(--text-dim); transition:transform .15s;}
.site-nav-item:hover .chev{transform:rotate(180deg);}
.site-dropdown{
  display:none; position:absolute; top:100%; left:0; min-width:190px; padding:6px;
  background:var(--panel-2); border:1px solid var(--border); border-radius:12px; box-shadow:0 14px 34px rgba(0,0,0,.45);
}
.site-dropdown.wide{min-width:280px;}
.site-nav-item:hover .site-dropdown, .site-nav-item:focus-within .site-dropdown{display:block;}
.site-dropdown-link{display:flex; flex-direction:column; padding:8px 12px; border-radius:8px; font-size:13px; color:var(--text-muted);}
.site-dropdown-link small{font-size:11px; color:var(--text-dim);}
.site-dropdown-link:hover{background:var(--panel); color:var(--gold);}
.site-dropdown-link.here{background:rgba(200,163,77,0.12); color:var(--gold); font-weight:600; box-shadow:inset 3px 0 0 var(--gold);}
.site-dropdown-group{padding:8px 12px 2px; font-size:10.5px; color:var(--text-dim); border-top:1px solid var(--border-soft); margin-top:4px;}

.site-search{position:relative; margin-left:auto; width:240px; flex:0 1 240px; min-width:120px;}
.site-search input{
  width:100%; background:var(--panel); border:1px solid var(--border); border-radius:10px; color:var(--text);
  padding:8px 12px 8px 34px; font-size:13px; font-family:'Noto Sans KR', sans-serif;
}
.site-search input:focus{outline:none; border-color:var(--gold-dim);}
.site-search-icon{position:absolute; left:11px; top:50%; transform:translateY(-50%); width:15px; height:15px; fill:none; stroke:var(--text-dim); stroke-width:2; stroke-linecap:round;}
.site-search-results{
  position:absolute; top:calc(100% + 6px); right:0; width:320px; padding:6px; z-index:50;
  background:var(--panel-2); border:1px solid var(--border); border-radius:12px; box-shadow:0 14px 34px rgba(0,0,0,.5);
}
.site-search-row{display:flex; align-items:center; gap:10px; width:100%; text-align:left; padding:7px 10px; border-radius:8px; font-size:13px; color:var(--text-muted);}
.site-search-row:hover{background:var(--panel); color:var(--text);}
.site-search-row small{margin-left:auto; font-size:11px; color:var(--text-dim);}
.site-search-badge{font-size:10.5px; color:var(--gold-dim); border:1px solid var(--border); border-radius:999px; padding:1px 7px; flex:none;}
.site-search-thumb{width:26px; height:26px; flex:none; display:flex; align-items:center; justify-content:center;}
.site-search-thumb img{max-width:100%; max-height:100%; image-rendering:pixelated;}
.site-search-name.unique, .site-search-name.runeword{color:var(--gold);}
.site-search-name.set{color:var(--green);}

.site-clock{flex:none; display:flex; flex-direction:column; align-items:flex-end; line-height:1.15; font-variant-numeric:tabular-nums; margin-right:-8px;}
.site-clock-date{font-size:10.5px; color:var(--text-dim);}
.site-clock-time{font-size:13px; color:var(--text-muted); font-weight:600; letter-spacing:.02em;}

.site-burger{display:none; width:36px; height:36px; border-radius:10px; align-items:center; justify-content:center; flex:none;}
.site-burger svg{width:20px; height:20px; stroke:var(--text-muted); stroke-width:2; stroke-linecap:round;}
.site-burger:hover{background:var(--panel-2);}
.site-mobile{border-top:1px solid var(--border-soft); padding:12px 16px 18px; display:flex; flex-direction:column; gap:12px; max-height:calc(100vh - 56px); overflow-y:auto;}
.site-mobile-title{font-size:12px; color:var(--gold-dim); font-weight:600; margin-bottom:6px;}
.site-mobile-links{display:flex; flex-wrap:wrap; gap:6px;}
.site-mobile-links a{font-size:13px; color:var(--text-muted); border:1px solid var(--border); border-radius:999px; padding:5px 12px;}
.site-mobile-links a.here{color:#1a1408; background:var(--gold); border-color:var(--gold); font-weight:600;}

@media (max-width:1180px){
  .site-search{width:180px;}
}
@media (max-width:1100px){
  .site-search{width:150px;}
  .site-header-inner{gap:14px;}
  .site-clock-date{display:none;}
  .site-nav-link{padding:0 8px; font-size:13.5px;}
}
/* 영어는 메뉴 글자가 길어서 같은 폭에 안 들어감 - 한 단계씩 먼저 좁히고 먼저 햄버거로 */
:root:lang(en) .site-search{width:180px; flex-basis:180px;}
@media (max-width:1460px){
  :root:lang(en) .site-search{width:150px; flex-basis:150px;}
  :root:lang(en) .site-nav-link{padding:0 8px; font-size:13.5px;}
  :root:lang(en) .site-header-inner{gap:14px;}
}
@media (max-width:1320px){
  :root:lang(en) .site-clock-date{display:none;}
}
@media (max-width:1260px){
  :root:lang(en) .site-nav{display:none;}
  :root:lang(en) .site-burger{display:flex;}
  :root:lang(en) .site-search{width:auto; flex:1 1 auto; max-width:320px;}
}

/* 헤더 시계가 들어가면서 1040px 아래에선 메뉴가 한 줄에 안 들어가서 햄버거로 바꿈 */
@media (max-width:1040px){
  .site-nav{display:none;}
  .site-burger{display:flex;}
  .site-search{width:auto; flex:1; max-width:320px;}
}
.site-mobile-search input{width:100%; background:var(--panel); border:1px solid var(--border); border-radius:10px; color:var(--text); padding:9px 12px; font-size:14px;}
.site-mobile-hits{display:flex; flex-wrap:wrap; gap:6px; margin-top:8px;}
.site-mobile-hits button{font-size:12.5px; color:var(--text-muted); border:1px solid var(--border); border-radius:999px; padding:4px 11px;}
@media (max-width:560px){
  .site-search{display:none;}
  .site-clock{margin-left:auto; margin-right:-4px;}
  .site-clock-time{font-size:12px; letter-spacing:0;}
  .site-header-inner{gap:10px; padding:0 12px;}
  .site-logo img{height:40px;}
  .mode-btn{padding:5px 11px; font-size:13px;}
  .mode-btn svg{display:none;}
  .lang-switch{display:none;}
  .site-search.hidden{display:none;}
  .site-search-results{width:calc(100vw - 24px); right:auto; left:0;}
}
/* 아주 좁은 폰: 시계까지 한 줄에 들어가게 (위 560px 규칙보다 뒤에 있어야 이김) */
@media (max-width:400px){
  .site-header-inner{gap:6px;}
  .site-logo img{height:34px;}
}
/* 운영진은 헤더에 접속자 버튼이 하나 더 있어서 더 일찍 햄버거 메뉴로 (일반 회원은 그대로) */
@media (max-width:1240px){
  .site-header-inner.staff .site-nav{display:none;}
  .site-header-inner.staff .site-burger{display:flex;}
  .site-header-inner.staff .site-search{width:auto; flex:1; max-width:320px;}
}
/* 폰에선 접속자 버튼을 펼침 메뉴 안으로 */
@media (max-width:560px){
  .site-header-inner :deep(.online-wrap){display:none;}
}
</style>
