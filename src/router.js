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
  ],
  scrollBehavior() {
    return { top: 0 }
  },
})

export default router
