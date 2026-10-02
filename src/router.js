import { createRouter, createWebHistory } from 'vue-router'
import { PAGE_META, SITE_URL, DEFAULT_DESCRIPTION, pageTitle } from './seoMeta.js'
import HomePage from './pages/HomePage.vue'
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
const PrivacyPage = () => import('./pages/PrivacyPage.vue')
const TermsPage = () => import('./pages/TermsPage.vue')
const NotFoundPage = () => import('./pages/NotFoundPage.vue')

const router = createRouter({
  // 주소가 /d2r/trade/1 처럼 일반 주소 (예전 #/ 주소는 index.html 이 바꿔 줌). 배포는 base /d2r/, 개발은 /
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: HomePage },
    { path: '/items', name: 'items', component: ItemsPage, meta: { title: '아이템 사전' } },
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
    { path: '/trade', name: 'trade', component: TradePage, meta: { title: '거래게시판' } },
    { path: '/trade/history', name: 'trade-history', component: TradeHistoryPage, meta: { title: '아이템별 거래내역' } },
    { path: '/trade/new', name: 'trade-new', component: TradeNewPage, meta: { title: '판매글 등록' } },
    { path: '/trade/:id', name: 'trade-post', component: TradePostPage, meta: { title: '거래게시판' } },
    // 회원가입은 디스코드·구글 로그인으로 대신함 (예전 주소는 마이페이지로)
    { path: '/signup', redirect: '/mypage' },
    { path: '/admin', name: 'admin', component: AdminPage, meta: { title: '관리자' } },
    { path: '/cube', name: 'cube', component: CubeRecipesPage, meta: { title: '큐브 레시피' } },
    { path: '/runewords', name: 'runewords', component: RunewordFinderPage, meta: { title: '룬워드 찾기' } },
    { path: '/craft-sim', name: 'craft-sim', component: CraftSimPage, meta: { title: '크래프트 시뮬레이터' } },
    { path: '/sockets', name: 'sockets', component: SocketsPage, meta: { title: '소켓 계산기' } },
    { path: '/breakpoints', name: 'breakpoints', component: BreakpointsPage, meta: { title: '브레이크포인트 계산기' } },
    { path: '/messages', name: 'messages', component: MessagesPage, meta: { title: '쪽지함' } },
    { path: '/mypage', name: 'mypage', component: MyPage, meta: { title: '마이페이지' } },
    { path: '/deals', name: 'deals', component: DealsPage, meta: { title: '거래중인 품목' } },
    // 거래 시작 알림 링크 (DB 함수가 /deals/거래번호 로 만듦)
    { path: '/deals/:id', name: 'deal', component: DealsPage, meta: { title: '거래중인 품목' } },
    { path: '/privacy', name: 'privacy', component: PrivacyPage, meta: { title: '개인정보 처리 안내' } },
    { path: '/terms', name: 'terms', component: TermsPage, meta: { title: '이용 규칙' } },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: NotFoundPage, meta: { title: '페이지를 찾을 수 없음' } },
  ],
  scrollBehavior() {
    return { top: 0 }
  },
})

// 제목·설명·주소를 화면마다 맞춤 (자바스크립트를 읽는 검색엔진·브라우저용. 정적 HTML 은 빌드 때 따로 만듦)
function setMeta(selector, attr, value) {
  const el = document.head.querySelector(selector)
  if (el) el.setAttribute(attr, value)
}
router.afterEach((to) => {
  const path = to.path.length > 1 ? to.path.replace(/\/$/, '') : to.path // Pages 가 /items/ 로 열 때도
  const meta = PAGE_META[path] || {}
  const title = pageTitle(meta.title || to.meta.title)
  const description = meta.description || DEFAULT_DESCRIPTION
  const url = SITE_URL + (path === '/' ? '/' : path)
  document.title = title
  setMeta('meta[name="description"]', 'content', description)
  setMeta('link[rel="canonical"]', 'href', url)
  setMeta('meta[property="og:title"]', 'content', title)
  setMeta('meta[property="og:description"]', 'content', description)
  setMeta('meta[property="og:url"]', 'content', url)
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
