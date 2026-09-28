import { createRouter, createWebHashHistory } from 'vue-router'
import HomePage from './pages/HomePage.vue'
const ItemsPage = () => import('./pages/ItemsPage.vue')
const GuidesPage = () => import('./pages/GuidesPage.vue')
const GuideDetailPage = () => import('./pages/GuideDetailPage.vue')
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
const SignupPage = () => import('./pages/SignupPage.vue')
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
const NotFoundPage = () => import('./pages/NotFoundPage.vue')

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'home', component: HomePage },
    { path: '/items', name: 'items', component: ItemsPage, meta: { title: '아이템 사전' } },
    { path: '/guides', name: 'guides', component: GuidesPage, meta: { title: '빌드 가이드' } },
    { path: '/guides/:id', name: 'guide-detail', component: GuideDetailPage, meta: { title: '빌드 가이드' } },
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
    { path: '/signup', name: 'signup', component: SignupPage, meta: { title: '회원가입' } },
    { path: '/admin', name: 'admin', component: AdminPage, meta: { title: '관리자' } },
    { path: '/cube', name: 'cube', component: CubeRecipesPage, meta: { title: '큐브 레시피' } },
    { path: '/runewords', name: 'runewords', component: RunewordFinderPage, meta: { title: '룬워드 찾기' } },
    { path: '/craft-sim', name: 'craft-sim', component: CraftSimPage, meta: { title: '크래프트 시뮬레이터' } },
    { path: '/sockets', name: 'sockets', component: SocketsPage, meta: { title: '소켓 계산기' } },
    { path: '/breakpoints', name: 'breakpoints', component: BreakpointsPage, meta: { title: '브레이크포인트 계산기' } },
    { path: '/messages', name: 'messages', component: MessagesPage, meta: { title: '쪽지함' } },
    { path: '/mypage', name: 'mypage', component: MyPage, meta: { title: '마이페이지' } },
    { path: '/deals', name: 'deals', component: DealsPage, meta: { title: '거래중인 품목' } },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: NotFoundPage, meta: { title: '페이지를 찾을 수 없음' } },
  ],
  scrollBehavior() {
    return { top: 0 }
  },
})

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} — 디아허브` : '디아허브 — 디아블로 2 레저렉션 정보'
})

export default router
