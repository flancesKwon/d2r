<script setup>
// 메인 - 검색을 앞에, 자주 쓰는 도구·빌드·최신 글(거래·커뮤니티·패치)은 데이터에서 최신순으로
import { computed, shallowRef, ref } from 'vue'
import { useAutoRefresh } from '../useAutoRefresh.js'
import { useRouter } from 'vue-router'
import { guidesState, loadGuides } from '../guideStore.js'
import patchNotes from '../data/patchNotes.json'
import ladder from '../data/ladder.json'
import { ITEM_ICONS } from '../itemIcons.js'
import { fetchPosts, fetchPinnedPosts } from '../communityStore.js'
import { AVATAR_PRESETS } from '../avatars.js'

const router = useRouter()

// ── 검색: 이름 / 옵션 (아이템 사전으로)
const q = ref('')
const searchBy = ref('name')
function search() {
  const term = q.value.trim()
  if (!term) return
  router.push({ path: '/items', query: searchBy.value === 'option' ? { q: term, by: 'option' } : { q: term } })
}
const SUGGEST = [
  { label: '할리퀸 관모', to: { path: '/items', query: { q: '할리퀸 관모' } } },
  { label: '수수께끼', to: { path: '/items', query: { q: '수수께끼' } } },
  { label: '베르 룬', to: { path: '/items', query: { q: '베르 룬' } } },
  { label: '패캐 + 올스', to: { path: '/items', query: { q: '패캐, 올스', by: 'option' } } },
]

// ── 바로가기·도구
const iconUrl = (key) => (key && ITEM_ICONS[key]) || null
const SHORTCUTS = [
  { to: '/items', title: '아이템 사전', desc: '유니크·세트·룬워드 옵션', icon: 'invcap__armor' },
  { to: '/runewords', title: '룬워드 찾기', desc: '룬으로 룬워드 검색', icon: 'invrjah__rune' },
  { to: '/breakpoints', title: '속도 계산기', desc: '공속·패캐·패힛·패블', icon: 'invamu__amulet' },
  { to: '/trade', title: '거래게시판', desc: '아시아 서버 매물', icon: 'invrber' },
]
const TOOLS = [
  { to: '/simulator', title: '스킬·스탯 시뮬레이터', desc: '스킬 트리·시너지 미리 찍기', icon: 'invob2__sword' },
  { to: '/craft-sim', title: '크래프트 시뮬레이터', desc: '옵션 확률대로 굴려보기', icon: 'invgceye__charm' },
  { to: '/sockets', title: '소켓 계산기', desc: '베이스별 최대 소켓', icon: 'invjw1__jewel' },
  { to: '/cube', title: '큐브 레시피', desc: '업그레이드·수리·크래프트', icon: 'invrin__ring' },
]

// ── 직업 (게임 스킬 아이콘)
const CLASS_KEYS = { amazon: 'ama', sorc: 'sor', necro: 'nec', paladin: 'pal', barb: 'bar', druid: 'dru', assassin: 'ass', warlock: 'war' }
const CLASSES = Object.entries(CLASS_KEYS).map(([key, avatar]) => {
  const a = AVATAR_PRESETS.find((p) => p.key === avatar)
  return { key, name: a?.label || key, icon: a?.src }
})
loadGuides()
const guideCount = (key) => guidesState.list.filter((g) => g.classKey === key).length

// ── 빌드: 티어 높은 순, 같으면 최신
const TIER_RANK = { 'S TIER': 0, 'A TIER': 1, 'B TIER': 2, 'C TIER': 3 }
const tierLetter = (t) => (t || '').replace(' TIER', '')
const topGuides = computed(() =>
  [...guidesState.list]
    .sort((a, b) => (TIER_RANK[a.tier] ?? 9) - (TIER_RANK[b.tier] ?? 9) || (b.date || '').localeCompare(a.date || ''))
    .slice(0, 6)
)

// ── 오른쪽: 공지 / 거래 / 커뮤니티 / 패치
const byDate = (a, b) => (b.date || '').localeCompare(a.date || '')
const notice = ref(null)
const latestCommunity = ref([])
function loadSide() {
  fetchPinnedPosts().then((list) => (notice.value = list[0] || null)).catch(() => {})
  fetchPosts({ pageSize: 5 }).then((r) => (latestCommunity.value = r.posts)).catch(() => {})
}
loadSide()
// 보고 있는 동안 30초마다 공지·최신 글·최신 매물 새로
useAutoRefresh(() => { loadSide(); trade.value?.loadTradePosts(true) })
const latestPatches = computed(() => [...patchNotes].sort(byDate).slice(0, 3))
// 거래 데이터(아이템 사전 포함)는 첫 화면을 띄운 뒤에 받음
const trade = shallowRef(null)
import('../tradeStore.js').then((m) => { trade.value = m; m.loadTradePosts() })
const latestTrades = computed(() => (trade.value ? trade.value.tradeState.posts.filter((p) => p.status === '판매중' && !p.expired).slice(0, 5) : []))
const postIconKey = (p) => trade.value.postIconKey(p)
// 히어로 오른쪽 숫자 (사전은 거래 데이터와 같이 늦게 받음)
const stats = computed(() => [
  { n: trade.value?.itemsData?.length || 731, label: '아이템 사전', to: '/items' },
  { n: guidesState.list.length, label: '빌드 가이드', to: '/guides' },
  { n: 6, label: '계산기·시뮬레이터', to: '/breakpoints' },
])
const shortDate = (d) => (d || '').slice(5).replace('-', '.')
</script>

<template>
  <div class="home">

  <section class="hm-hero">
    <div class="hm-hero-inner">
      <div class="hm-hero-main">
      <router-link to="/ladder" class="hm-season">
        <span class="hm-dot"></span>{{ ladder.seasonName }} {{ ladder.status }} · 패치 {{ ladder.patchVersion }}
      </router-link>
      <h1>디아블로 2 레저렉션<br /><span>정보 · 계산기 · 거래</span></h1>

      <form class="hm-search" role="search" @submit.prevent="search">
        <div class="hm-search-by" role="group" aria-label="검색 기준">
          <button type="button" :class="{ on: searchBy === 'name' }" @click="searchBy = 'name'">이름</button>
          <button type="button" :class="{ on: searchBy === 'option' }" @click="searchBy = 'option'">옵션</button>
        </div>
        <input
          v-model="q" type="search" aria-label="아이템 검색"
          :placeholder="searchBy === 'option' ? '옵션으로 찾기 — 예) 패캐, 올스' : '아이템 이름 — 예) 샤코, 수수께끼, 베르'"
        />
        <button type="submit" class="hm-search-go" aria-label="검색">검색</button>
      </form>
      <div class="hm-suggest">
        <span>추천</span>
        <router-link v-for="s in SUGGEST" :key="s.label" :to="s.to">{{ s.label }}</router-link>
      </div>
      </div>
      <dl class="hm-stats">
        <router-link v-for="st in stats" :key="st.label" :to="st.to" class="hm-stat"><dt>{{ st.n }}</dt><dd>{{ st.label }}</dd></router-link>
      </dl>
    </div>
  </section>

  <div class="hm-wrap">
    <router-link v-if="notice" :to="`/community/${notice.id}`" class="hm-notice">
      <span class="hm-notice-tag">공지</span><span class="hm-notice-title">{{ notice.title }}</span><span class="hm-notice-date">{{ notice.date }}</span>
    </router-link>

    <nav class="hm-shortcuts" aria-label="바로가기">
      <router-link v-for="s in SHORTCUTS" :key="s.to" :to="s.to" class="hm-shortcut">
        <span class="hm-shortcut-icon"><img v-if="iconUrl(s.icon)" :src="iconUrl(s.icon)" alt="" /></span>
        <span class="hm-shortcut-text"><b>{{ s.title }}</b><small>{{ s.desc }}</small></span>
        <span class="hm-arrow" aria-hidden="true">→</span>
      </router-link>
    </nav>

    <div class="hm-grid">
      <main>
        <section class="hm-section">
          <div class="hm-head"><h2>빌드 가이드</h2><router-link to="/guides?view=tier">티어리스트 →</router-link></div>
          <div class="hm-classes">
            <router-link v-for="c in CLASSES" :key="c.key" :to="`/guides?class=${c.key}`" class="hm-class">
              <img v-if="c.icon" :src="c.icon" alt="" />
              <span>{{ c.name }}</span>
              <small v-if="guideCount(c.key)">{{ guideCount(c.key) }}</small>
            </router-link>
          </div>
          <div class="hm-builds">
            <router-link v-for="g in topGuides" :key="g.id" :to="`/guides/${g.id}`" class="hm-build">
              <span class="hm-tier" :class="'t-' + tierLetter(g.tier)">{{ tierLetter(g.tier) || '-' }}</span>
              <span class="hm-build-text">
                <b>{{ g.title }}</b>
                <small>{{ g.className }} · {{ g.desc }}</small>
              </span>
            </router-link>
          </div>
        </section>

        <section class="hm-section">
          <div class="hm-head"><h2>도구</h2></div>
          <div class="hm-tools">
            <router-link v-for="t in TOOLS" :key="t.to" :to="t.to" class="hm-tool">
              <span class="hm-tool-icon"><img v-if="iconUrl(t.icon)" :src="iconUrl(t.icon)" alt="" /></span>
              <span><b>{{ t.title }}</b><small>{{ t.desc }}</small></span>
            </router-link>
          </div>
        </section>
      </main>

      <aside class="hm-side">
        <section class="hm-panel">
          <div class="hm-head small"><h3>최신 매물</h3><router-link to="/trade">더보기</router-link></div>
          <router-link v-for="p in latestTrades" :key="p.id" :to="`/trade/${p.id}`" class="hm-row">
            <span class="hm-row-icon"><img v-if="iconUrl(postIconKey(p))" :src="iconUrl(postIconKey(p))" alt="" /><span v-else class="hm-row-fallback">{{ p.category.slice(0, 1) }}</span></span>
            <span class="hm-row-text"><b>{{ p.itemName }}</b><small>{{ p.price }}</small></span>
          </router-link>
          <p class="hm-empty" v-if="trade && !latestTrades.length">매물 없음</p>
        </section>
        <section class="hm-panel">
          <div class="hm-head small"><h3>커뮤니티</h3><router-link to="/community">더보기</router-link></div>
          <router-link v-for="c in latestCommunity" :key="c.id" :to="`/community/${c.id}`" class="hm-line">
            <span class="hm-cat">{{ c.category }}</span><span class="hm-line-title">{{ c.title }}</span>
            <span class="hm-count" v-if="c.commentCount">{{ c.commentCount }}</span>
          </router-link>
          <p class="hm-empty" v-if="!latestCommunity.length">글 없음</p>
        </section>
        <section class="hm-panel">
          <div class="hm-head small"><h3>패치노트</h3><router-link to="/patch">더보기</router-link></div>
          <router-link v-for="n in latestPatches" :key="n.id" to="/patch" class="hm-line">
            <span class="hm-line-title">{{ n.title }}</span><span class="hm-date">{{ shortDate(n.date) }}</span>
          </router-link>
        </section>
      </aside>
    </div>
  </div>

  </div>
</template>

<style scoped>
/* ── 히어로: 큰 제목 + 검색. 불씨처럼 은은한 빛만 깔고 장식은 줄임 */
.hm-hero{position:relative; overflow:hidden; border-bottom:1px solid var(--border-soft);
  background:
    radial-gradient(ellipse 55% 120% at 88% -10%, rgba(214,120,48,0.16), transparent 70%),
    radial-gradient(ellipse 40% 80% at 10% 120%, rgba(200,163,77,0.05), transparent 70%),
    linear-gradient(180deg, #1a1411 0%, var(--bg) 100%);}
.hm-hero-inner{position:relative; max-width:1180px; margin:0 auto; padding:72px 24px 56px; display:grid; grid-template-columns:minmax(0, 1fr) 220px; gap:40px; align-items:end;}
.hm-stats{display:flex; flex-direction:column; gap:4px; border-left:1px solid var(--border-soft); padding-left:28px;}
.hm-stat{display:block; padding:10px 0;}
.hm-stat dt{font-family:'Noto Serif KR', serif; font-size:30px; font-weight:900; color:var(--text); line-height:1.1;}
.hm-stat dd{font-size:12.5px; color:var(--text-dim);}
.hm-stat:hover dt{color:var(--gold);}
.hm-season{display:inline-flex; align-items:center; gap:8px; font-size:12.5px; color:var(--text-muted);
  border:1px solid var(--border); border-radius:999px; padding:6px 14px; margin-bottom:22px; transition:border-color .15s, color .15s;}
.hm-season:hover{border-color:var(--gold-dim); color:var(--text);}
.hm-dot{width:7px; height:7px; border-radius:999px; background:#6fbf73; box-shadow:0 0 8px #6fbf73;}
.hm-hero h1{font-size:clamp(30px, 4.4vw, 50px); line-height:1.18; letter-spacing:-0.02em; margin-bottom:30px; color:var(--text);}
.hm-hero h1 span{color:var(--gold); font-weight:700;}

.hm-search{display:flex; align-items:center; gap:6px; max-width:660px; padding:6px; border-radius:16px;
  background:rgba(28,24,21,0.85); border:1px solid var(--border); box-shadow:0 18px 50px -20px rgba(0,0,0,0.8);}
.hm-search:focus-within{border-color:var(--gold-dim);}
.hm-search-by{display:flex; background:var(--bg); border-radius:11px; padding:3px; flex:none;}
.hm-search-by button{font-size:12.5px; color:var(--text-dim); padding:7px 12px; border-radius:9px;}
.hm-search-by button.on{background:var(--panel-2); color:var(--gold);}
.hm-search input{flex:1; min-width:0; background:transparent; border:none; color:var(--text); font-size:15px; padding:10px 8px; font-family:inherit;}
.hm-search input:focus{outline:none;}
.hm-search input::placeholder{color:var(--text-dim);}
.hm-search-go{flex:none; background:var(--gold); color:#1b1714; font-weight:700; font-size:14px; padding:11px 20px; border-radius:11px;}
.hm-search-go:hover{background:var(--focus);}
.hm-suggest{display:flex; flex-wrap:wrap; align-items:center; gap:8px; margin-top:14px; font-size:12.5px;}
.hm-suggest span{color:var(--text-dim);}
.hm-suggest a{color:var(--text-muted); padding:4px 11px; border-radius:999px; background:rgba(255,255,255,0.04);}
.hm-suggest a:hover{color:var(--gold); background:rgba(200,163,77,0.08);}

/* ── 본문 */
.hm-wrap{max-width:1180px; margin:0 auto; padding:28px 24px 72px;}
.hm-notice{display:flex; align-items:center; gap:10px; padding:11px 16px; margin-bottom:20px; border-radius:12px;
  background:rgba(200,163,77,0.06); border:1px solid rgba(200,163,77,0.25); font-size:13.5px;}
.hm-notice-tag{font-size:11px; font-weight:700; color:#1b1714; background:var(--gold); border-radius:6px; padding:2px 8px; flex:none;}
.hm-notice-title{flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--text);}
.hm-notice-date{font-size:11.5px; color:var(--text-dim); flex:none;}

.hm-shortcuts{display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); gap:12px; margin-bottom:40px;}
.hm-shortcut{display:flex; align-items:center; gap:12px; padding:16px; border-radius:14px; background:var(--panel);
  border:1px solid var(--border-soft); transition:border-color .15s, transform .15s, background .15s;}
.hm-shortcut:hover{border-color:var(--gold-dim); background:var(--panel-2); transform:translateY(-2px);}
.hm-shortcut-icon{width:44px; height:44px; flex:none; display:flex; align-items:center; justify-content:center; border-radius:12px; background:var(--bg);}
.hm-shortcut-icon img{max-width:32px; max-height:32px; image-rendering:pixelated;}
.hm-shortcut-text{flex:1; min-width:0; display:flex; flex-direction:column;}
.hm-shortcut-text b{font-size:14.5px; color:var(--text);}
.hm-shortcut-text small{font-size:11.5px; color:var(--text-dim);}
.hm-arrow{color:var(--text-dim); transition:transform .15s, color .15s;}
.hm-shortcut:hover .hm-arrow{color:var(--gold); transform:translateX(3px);}

.hm-grid{display:grid; grid-template-columns:minmax(0, 1fr) 320px; gap:32px; align-items:start;}
.hm-section{margin-bottom:40px;}
.hm-head{display:flex; align-items:baseline; justify-content:space-between; gap:12px; margin-bottom:14px;}
.hm-head h2{font-size:20px;}
.hm-head a{font-size:12.5px; color:var(--text-muted);}
.hm-head a:hover{color:var(--gold);}
.hm-head.small{margin-bottom:8px;}
.hm-head.small h3{font-size:14.5px;}

.hm-classes{display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); gap:8px; margin-bottom:16px;}
.hm-class{display:inline-flex; align-items:center; gap:8px; padding:6px 13px 6px 6px; border-radius:999px; background:var(--panel);
  border:1px solid var(--border-soft); font-size:13px; color:var(--text-muted); transition:border-color .15s, color .15s;}
.hm-class:hover{border-color:var(--gold-dim); color:var(--text);}
.hm-class img{width:26px; height:26px; border-radius:999px;}
.hm-class small{font-size:11px; color:var(--text-dim); margin-left:auto;}

.hm-builds{display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:10px;}
.hm-build{min-width:0; display:flex; align-items:center; gap:14px; padding:14px 16px; border-radius:14px; background:var(--panel);
  border:1px solid var(--border-soft); transition:border-color .15s, background .15s;}
.hm-build:hover{border-color:var(--gold-dim); background:var(--panel-2);}
.hm-tier{width:34px; height:34px; flex:none; display:flex; align-items:center; justify-content:center; border-radius:10px;
  font-family:'Noto Serif KR', serif; font-weight:900; font-size:16px; color:#1b1714; background:var(--text-dim);}
.hm-tier.t-S{background:#d4553a;}
.hm-tier.t-A{background:var(--gold);}
.hm-tier.t-B{background:var(--teal);}
.hm-build-text{min-width:0; display:flex; flex-direction:column;}
.hm-build-text b{font-size:14px; color:var(--text); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.hm-build-text small{font-size:11.5px; color:var(--text-dim); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}

.hm-tools{display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:10px;}
.hm-tool{display:flex; align-items:center; gap:12px; padding:12px 14px; border-radius:12px; transition:background .15s;}
.hm-tool:hover{background:var(--panel);}
.hm-tool-icon{width:38px; height:38px; flex:none; display:flex; align-items:center; justify-content:center; border-radius:10px; background:var(--panel);}
.hm-tool-icon img{max-width:28px; max-height:28px; image-rendering:pixelated;}
.hm-tool b{display:block; font-size:13.5px; color:var(--text);}
.hm-tool small{font-size:11.5px; color:var(--text-dim);}

/* ── 오른쪽 */
.hm-side{display:flex; flex-direction:column; gap:14px;}
.hm-panel{background:var(--panel); border:1px solid var(--border-soft); border-radius:14px; padding:14px 16px 10px;}
.hm-row{display:flex; align-items:center; gap:10px; padding:7px 0; min-width:0;}
.hm-row-icon{width:32px; height:32px; flex:none; display:flex; align-items:center; justify-content:center; border-radius:8px; background:var(--bg);}
.hm-row-icon img{max-width:24px; max-height:24px; image-rendering:pixelated;}
.hm-row-fallback{font-family:'Noto Serif KR', serif; font-size:13px; font-weight:700; color:var(--text-dim);}
.hm-row-text{min-width:0; display:flex; flex-direction:column;}
.hm-row-text b{font-size:13px; font-weight:500; color:var(--text); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.hm-row-text small{font-size:11px; color:var(--text-dim); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.hm-row:hover b, .hm-line:hover .hm-line-title{color:var(--gold);}
.hm-line{display:flex; align-items:center; gap:8px; padding:7px 0; font-size:13px; border-top:1px solid var(--border-soft); min-width:0;}
.hm-line:first-of-type{border-top:none;}
.hm-cat{font-size:10.5px; color:var(--text-dim); flex:none;}
.hm-line-title{flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--text-muted);}
.hm-count{font-size:11px; color:var(--gold-dim); flex:none;}
.hm-date{font-size:11px; color:var(--text-dim); flex:none;}
.hm-empty{font-size:12.5px; color:var(--text-dim); padding:6px 0;}

@media (max-width:960px){
  .hm-grid{grid-template-columns:1fr;}
  .hm-hero-inner{grid-template-columns:1fr;}
  .hm-stats{flex-direction:row; border-left:none; padding-left:0; gap:24px;}
  .hm-stat dt{font-size:22px;}
  .hm-shortcuts{grid-template-columns:repeat(2, minmax(0, 1fr));}
}
@media (max-width:560px){
  .hm-hero-inner{padding:44px 16px 36px;}
  .hm-wrap{padding:20px 16px 56px;}
  .hm-search{flex-wrap:wrap;}
  .hm-search input{flex-basis:100%; order:-1; padding:10px 10px 6px;}
  .hm-search-go{margin-left:auto;}
  .hm-builds, .hm-tools{grid-template-columns:1fr;}
  .hm-classes{grid-template-columns:repeat(2, minmax(0, 1fr));}
  .hm-shortcut{padding:12px;}
  .hm-arrow{display:none;}
}
</style>
