import { createRouter, createWebHashHistory } from 'vue-router'
import HomePage from './pages/HomePage.vue'
import ItemsPage from './pages/ItemsPage.vue'
import GuidesPage from './pages/GuidesPage.vue'
import GuideDetailPage from './pages/GuideDetailPage.vue'
import PatchNotesPage from './pages/PatchNotesPage.vue'
import CommunityPage from './pages/CommunityPage.vue'
import CommunityPostPage from './pages/CommunityPostPage.vue'
import SimulatorPage from './pages/SimulatorPage.vue'
import LadderPage from './pages/LadderPage.vue'
import MarketPage from './pages/MarketPage.vue'
import TradePage from './pages/TradePage.vue'
import TradeNewPage from './pages/TradeNewPage.vue'
import TradePostPage from './pages/TradePostPage.vue'
import SignupPage from './pages/SignupPage.vue'
import AdminPage from './pages/AdminPage.vue'
import CubeRecipesPage from './pages/CubeRecipesPage.vue'
import MessagesPage from './pages/MessagesPage.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'home', component: HomePage },
    { path: '/items', name: 'items', component: ItemsPage },
    { path: '/guides', name: 'guides', component: GuidesPage },
    { path: '/guides/:id', name: 'guide-detail', component: GuideDetailPage },
    { path: '/patch', name: 'patch', component: PatchNotesPage },
    { path: '/community', name: 'community', component: CommunityPage },
    { path: '/community/:id', name: 'community-post', component: CommunityPostPage },
    { path: '/simulator', name: 'simulator', component: SimulatorPage },
    { path: '/ladder', name: 'ladder', component: LadderPage },
    { path: '/market', name: 'market', component: MarketPage },
    { path: '/trade', name: 'trade', component: TradePage },
    { path: '/trade/new', name: 'trade-new', component: TradeNewPage },
    { path: '/trade/:id', name: 'trade-post', component: TradePostPage },
    { path: '/signup', name: 'signup', component: SignupPage },
    { path: '/admin', name: 'admin', component: AdminPage },
    { path: '/cube', name: 'cube', component: CubeRecipesPage },
    { path: '/messages', name: 'messages', component: MessagesPage },
  ],
  scrollBehavior() {
    return { top: 0 }
  },
})

export default router
