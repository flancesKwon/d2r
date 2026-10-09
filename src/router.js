import { createRouter, createWebHistory } from 'vue-router'
import { LOCALES, DEFAULT_LOCALE, locale, setLocale, localeOfPath, withLocale, t, rememberLocale } from './i18n.js'
import { trackVisit } from './visitTracker.js'
const HomePage = () => import('./pages/HomePage.vue')
const ItemsPage = () => import('./pages/ItemsPage.vue')
const GuidesPage = () => import('./pages/GuidesPage.vue')
const GuideDetailPage = () => import('./pages/GuideDetailPage.vue')
const GuideEditPage = () => import('./pages/GuideEditPage.vue')
const PatchNotesPage = () => import('./pages/PatchNotesPage.vue')
const CommunityPage = () => import('./pages/CommunityPage.vue')
const CommunityPostPage = () => import('./pages/CommunityPostPage.vue')
const CommunityWritePage = () => import('./pages/CommunityWritePage.vue')
const SimulatorPage = () => import('./pages/SimulatorPage.vue')
const LadderPage = () => import('./pages/LadderPage.vue')
const MarketPage = () => import('./pages/MarketPage.vue')
const TradePage = () => import('./pages/TradePage.vue')
const TradeNewPage = () => import('./pages/TradeNewPage.vue')
const TradeRelistPage = () => import('./pages/TradeRelistPage.vue')
const TradeEditPage = () => import('./pages/TradeEditPage.vue')
const TradePostPage = () => import('./pages/TradePostPage.vue')
const AdminPage = () => import('./pages/AdminPage.vue')
const CubeRecipesPage = () => import('./pages/CubeRecipesPage.vue')
const RunewordFinderPage = () => import('./pages/RunewordFinderPage.vue')
const CraftSimPage = () => import('./pages/CraftSimPage.vue')
const SocketsPage = () => import('./pages/SocketsPage.vue')
const BreakpointsPage = () => import('./pages/BreakpointsPage.vue')
const MessagesPage = () => import('./pages/MessagesPage.vue')
const MyPage = () => import('./pages/MyPage.vue')
const DealsPage = () => import('./pages/DealsPage.vue')
const TradeHistoryPage = () => import('./pages/TradeHistoryPage.vue')
const TradeWantsPage = () => import('./pages/TradeWantsPage.vue')
const PrivacyPage = () => import('./pages/PrivacyPage.vue')
const TermsPage = () => import('./pages/TermsPage.vue')
const NotFoundPage = () => import('./pages/NotFoundPage.vue')
const UserProfilePage = () => import('./pages/UserProfilePage.vue')
const ProfileEditPage = () => import('./pages/ProfileEditPage.vue')
const AdminStatsPage = () => import('./pages/AdminStatsPage.vue')
const AdminEventPage = () => import('./pages/AdminEventPage.vue')
const EventPage = () => import('./pages/EventPage.vue')

const baseRoutes = [
    // 첫 화면 = 거래 (매물 검색). 정보·도구 모음은 /db
    { path: '/', name: 'trade', component: TradePage },
    { path: '/db', name: 'home', component: HomePage, meta: { title: 'DB' } },
    { path: '/items', name: 'items', component: ItemsPage, meta: { title: '아이템 사전' } },
    // 아이템 하나 (검색엔진·공유용 주소) - 사전 화면에서 그 아이템 상세를 열어 둠
    { path: '/items/:id', name: 'item', component: ItemsPage, meta: { title: '아이템 사전' } },
    { path: '/guides', name: 'guides', component: GuidesPage, meta: { title: '빌드 가이드' } },
    // /guides/:id 보다 먼저 - 안 그러면 'new'가 가이드 주소로 잡힘
    { path: '/guides/new', name: 'guide-new', component: GuideEditPage, meta: { title: '가이드 쓰기' } },
    { path: '/guides/:id', name: 'guide-detail', component: GuideDetailPage, meta: { title: '빌드 가이드' } },
    { path: '/guides/:id/edit', name: 'guide-edit', component: GuideEditPage, meta: { title: '가이드 고치기' } },
    { path: '/patch', name: 'patch', component: PatchNotesPage, meta: { title: '패치노트' } },
    { path: '/community', name: 'community', component: CommunityPage, meta: { title: '커뮤니티' } },
    // /community/:id 보다 먼저 - 안 그러면 'write'가 글 id로 잡힘
    { path: '/community/write', name: 'community-write', component: CommunityWritePage, meta: { title: '글쓰기' } },
    { path: '/community/:id', name: 'community-post', component: CommunityPostPage, meta: { title: '커뮤니티' } },
    { path: '/simulator', name: 'simulator', component: SimulatorPage, meta: { title: '스킬·스탯 시뮬레이터' } },
    { path: '/ladder', name: 'ladder', component: LadderPage, meta: { title: '레더 시즌 정보' } },
    { path: '/market', name: 'market', component: MarketPage, meta: { title: '시세 게시판' } },
    // 예전 거래게시판 주소 (?q= ?item= 그대로 넘김)
    { path: '/trade', redirect: (to) => ({ path: '/', query: to.query }) },
    { path: '/trade/history', name: 'trade-history', component: TradeHistoryPage, meta: { title: '아이템별 거래내역' } },
    { path: '/trade/wants', name: 'trade-wants', component: TradeWantsPage, meta: { title: '삽니다' } },
    { path: '/trade/search', name: 'trade-search', component: TradePage, meta: { title: '매물 검색' } },
    { path: '/trade/new', name: 'trade-new', component: TradeNewPage, meta: { title: '판매글 등록' } },
    { path: '/trade/:id/relist', name: 'trade-relist', component: TradeRelistPage, meta: { title: '재등록' } },
    { path: '/trade/:id/edit', name: 'trade-edit', component: TradeEditPage, meta: { title: '판매글 수정' } },
    { path: '/trade/:id', name: 'trade-post', component: TradePostPage, meta: { title: '거래게시판' } },
    // 회원가입은 디스코드·구글 로그인으로 대신함 (예전 주소는 마이페이지로)
    { path: '/signup', redirect: '/mypage' },
    { path: '/admin', name: 'admin', component: AdminPage, meta: { title: '관리자' } },
    { path: '/admin/stats', name: 'admin-stats', component: AdminStatsPage, meta: { title: '방문 통계' } },
    { path: '/admin/event', name: 'admin-event', component: AdminEventPage, meta: { title: '이벤트 관리' } },
    { path: '/event/:id', name: 'event', component: EventPage, meta: { title: '이벤트' } },
    { path: '/cube', name: 'cube', component: CubeRecipesPage, meta: { title: '큐브 레시피' } },
    { path: '/runewords', name: 'runewords', component: RunewordFinderPage, meta: { title: '룬워드 찾기' } },
    { path: '/craft-sim', name: 'craft-sim', component: CraftSimPage, meta: { title: '크래프트 시뮬레이터' } },
    { path: '/sockets', name: 'sockets', component: SocketsPage, meta: { title: '소켓 계산기' } },
    { path: '/breakpoints', name: 'breakpoints', component: BreakpointsPage, meta: { title: '브레이크포인트 계산기' } },
    { path: '/messages', name: 'messages', component: MessagesPage, meta: { title: '쪽지함' } },
    { path: '/mypage', name: 'mypage', component: MyPage, meta: { title: '마이페이지' } },
    { path: '/mypage/edit', name: 'profile-edit', component: ProfileEditPage, meta: { title: '프로필 수정' } },
    { path: '/deals', name: 'deals', component: DealsPage, meta: { title: '거래중인 품목' } },
    // 거래 시작 알림 링크 (DB 함수가 /deals/거래번호 로 만듦)
    { path: '/deals/:id', name: 'deal', component: DealsPage, meta: { title: '거래중인 품목' } },
    { path: '/users/:id', name: 'user', component: UserProfilePage, meta: { title: '회원 정보' } },
    { path: '/privacy', name: 'privacy', component: PrivacyPage, meta: { title: '개인정보 처리 안내' } },
    { path: '/terms', name: 'terms', component: TermsPage, meta: { title: '이용 규칙' } },
]

// 다국어: 모든 주소를 /en 아래에도 하나씩 (이름은 '이름@en', 화면은 같은 것 - 문구는 i18n.js 가 언어에 맞춰 바꿈)
const NOT_FOUND = { path: '/:pathMatch(.*)*', name: 'not-found', component: NotFoundPage, meta: { title: '페이지를 찾을 수 없음' } }
function localizedRoutes(code) {
  return baseRoutes.map((r) => {
    const copy = { ...r, path: '/' + code + (r.path === '/' ? '' : r.path) }
    if (r.name) copy.name = `${r.name}@${code}`
    if (typeof r.redirect === 'function') {
      copy.redirect = (to) => {
        const res = r.redirect(to)
        return typeof res === 'string' ? withLocale(res, code) : { ...res, path: withLocale(res.path, code) }
      }
    } else if (typeof r.redirect === 'string') copy.redirect = withLocale(r.redirect, code)
    return copy
  })
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [...baseRoutes, ...LOCALES.filter((l) => l.code !== DEFAULT_LOCALE).flatMap((l) => localizedRoutes(l.code)), NOT_FOUND],
  scrollBehavior() {
    return { top: 0 }
  },
})

// 언어: 주소의 /en 으로 정함. 영어로 보는 중에 앱 안 링크(/trade/1 처럼 언어 없는 주소)를 누르면 /en 을 붙여 줌
// (언어 바꾸기 버튼은 switchLocale 로 - 그때만 언어 없는 주소로 돌아감)
let switchingTo = null
export function switchLocale(code) {
  rememberLocale(code)
  switchingTo = code
  const cur = router.currentRoute.value.fullPath
  return router.push(localizeFullPath(cur, code))
}
function localizeFullPath(full, code) {
  const i = full.search(/[?#]/)
  const path = i < 0 ? full : full.slice(0, i)
  return withLocale(path, code) + (i < 0 ? '' : full.slice(i))
}
router.beforeEach(async (to) => {
  const urlLoc = localeOfPath(to.path)
  const want = switchingTo ?? locale.value
  switchingTo = null
  if (urlLoc === DEFAULT_LOCALE && want !== DEFAULT_LOCALE && to.name !== 'not-found') {
    return localizeFullPath(to.fullPath, want)
  }
  if (urlLoc !== locale.value) await setLocale(urlLoc)
})

router.afterEach((to) => {
  document.title = to.meta.title ? `${t(to.meta.title)} — ${t('디아허브')}` : t('디아허브 — 디아블로 2 레저렉션 거래·정보')
  // 방문 통계 (013 SQL) - 화면 옮길 때마다
  trackVisit(to.path)
})

// 새로 배포되면 페이지 조각 파일 이름이 바뀌어서, 배포 전에 열어 둔 창에선 메뉴를 눌러도 옛 파일을 못 받아 안 넘어감
// -> 그럴 땐 새 버전으로 한 번 새로고침해서 누른 메뉴로 바로 감 (1분 안에 또 나면 무한 새로고침 막으려고 멈춤)
const RELOAD_KEY = 'd2r-chunk-reload'
function reloadToNewVersion(path) {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0)
    if (Date.now() - last < 60000) return false
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
  } catch (e) {}
  if (path) window.location.assign(import.meta.env.BASE_URL.replace(/\/$/, '') + path)
  else window.location.reload()
  return true
}
const isChunkError = (err) => /dynamically imported module|Importing a module script failed|error loading dynamically imported|Failed to fetch/i.test(err?.message || '')
router.onError((err, to) => {
  if (isChunkError(err)) reloadToNewVersion(to?.fullPath)
})
window.addEventListener('vite:preloadError', (e) => {
  if (reloadToNewVersion()) e.preventDefault()
})

export default router
