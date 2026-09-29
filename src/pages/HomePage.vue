<script setup>
// 메인 - 목록(가이드·커뮤니티·패치노트·거래)은 데이터에서 최신순으로 뽑음 (예전엔 HTML에 직접 적혀 있어서 새 글이 안 보였음)
import { computed, shallowRef, ref } from 'vue'
import guidesData from '../data/guides.json'
import patchNotes from '../data/patchNotes.json'
import { ITEM_ICONS } from '../itemIcons.js'
import { fetchPosts } from '../communityStore.js'

const CLASSES = [
  { key: 'amazon', name: '아마존', icon: '<path d="M7 4a12 12 0 000 16M7 4l10 8-10 8"/>' },
  { key: 'sorc', name: '소서리스', icon: '<circle cx="12" cy="5" r="2.6"/><path d="M12 7.6V21"/>' },
  { key: 'necro', name: '네크로맨서', icon: '<path d="M12 3v18M7 8l10 8M17 8L7 16"/>' },
  { key: 'paladin', name: '팔라딘', icon: '<path d="M12 3l7 3v6c0 5-3 8-7 9-4-1-7-4-7-9V6l7-3z"/>' },
  { key: 'barb', name: '바바리안', icon: '<path d="M12 21V9"/><circle cx="12" cy="6.5" r="3.5"/>' },
  { key: 'druid', name: '드루이드', icon: '<path d="M12 3c4 4 7 7 7 11a7 7 0 11-14 0c0-4 3-7 7-11z"/>' },
  { key: 'assassin', name: '어쌔신', icon: '<path d="M12 3v12M9 6h6M9 17l3 4 3-4"/>' },
  { key: 'warlock', name: '악마술사', icon: '<path d="M6 9l6-6 6 6-6 12-6-12z"/><path d="M6 9h12"/>' },
]
const guideCount = (key) => guidesData.filter((g) => g.classKey === key).length
const CLASS_CSS = { sorc: 'c-sorc', necro: 'c-necro', paladin: 'c-paladin', barb: 'c-barb', druid: 'c-druid', assassin: 'c-assassin', warlock: 'c-warlock', amazon: 'c-amazon' }

const byDate = (a, b) => (b.date || '').localeCompare(a.date || '')
const latestGuides = computed(() => [...guidesData].sort(byDate).slice(0, 4))
// 커뮤니티 최신 글 5개 (DB)
const latestCommunity = ref([])
fetchPosts({ pageSize: 5 }).then((r) => (latestCommunity.value = r.posts)).catch(() => {})
const latestPatches = computed(() => [...patchNotes].sort(byDate).slice(0, 3))
// 거래 데이터(아이템 사전 포함)는 첫 화면을 띄운 뒤에 받음
const trade = shallowRef(null)
import('../tradeStore.js').then((m) => { trade.value = m; m.loadTradePosts() })
const latestTrades = computed(() => (trade.value ? [...trade.value.tradeState.posts].sort(byDate).slice(0, 4) : []))
const postIconKey = (p) => trade.value.postIconKey(p)
const postRarity = (p) => trade.value.postRarity(p)
const shortDate = (d) => (d || '').slice(5).replace('-', '.')
const iconUrl = (key) => (key && ITEM_ICONS[key] || null)

// 도구 모음 (Maxroll 처럼 메인에서 바로 들어가게)
const TOOLS = [
  { to: '/runewords', title: '룬워드 찾기', desc: '가진 룬으로 만들 수 있는 룬워드와 큐브 업그레이드 경로', icon: 'invrjah__rune' },
  { to: '/simulator', title: '스킬·스탯 시뮬레이터', desc: '스킬 트리·시너지·장비까지 미리 찍어보기', icon: 'invob2__sword' },
  { to: '/breakpoints', title: '브레이크포인트 계산기', desc: '공격·시전·타격 회복·막기 속도 다음 단계까지 필요한 수치', icon: 'invamu__amulet' },
  { to: '/sockets', title: '소켓 계산기', desc: '베이스·아이템 레벨별 최대 소켓, 라르주크·큐브 소켓', icon: 'invjw1__jewel' },
  { to: '/craft-sim', title: '크래프트 시뮬레이터', desc: '크래프트 결과를 게임 확률대로 굴려보기', icon: 'invgceye__charm' },
  { to: '/cube', title: '큐브 레시피', desc: '룬·보석 업그레이드, 수리, 크래프트 조합', icon: 'invrin__ring' },
]
const toolIcon = (t) => iconUrl(t.icon)
const itemCount = computed(() => trade.value?.itemsData.length)
</script>

<template>
  <div class="home-page">

  <section class="hero-section">
    <div class="hero">
      <div class="hero-copy">
        <div class="eyebrow">디아블로 2 레저렉션 · 비공식</div>
        <h1>레더 시즌, <span class="accent">뭐 키울지</span> 고민될 때.</h1>
        <p>직업별 검증된 빌드부터 스킬 트리, 필요 장비까지 — 스탯 찍기 전에 한 번 훑어보세요.</p>
        <div class="hero-cta">
          <router-link class="btn-primary" to="/guides">빌드 가이드 보기</router-link>
          <router-link class="btn-ghost" to="/runewords">룬워드 찾기</router-link>
        </div>
      </div>
      <div class="card-stage">
        <div class="mock-card back-a">
          <div class="mc-class">팔라딘</div><div class="mc-name">함머딘</div>
          <div class="mc-skill"><span>축복받은 망치</span><b>20</b></div>
          <div class="mc-skill"><span>집중</span><b>20</b></div>
          <span class="mc-tier">S TIER</span>
        </div>
        <div class="mock-card back-b">
          <div class="mc-class">바바리안</div><div class="mc-name">웜바바</div>
          <div class="mc-skill"><span>전투 지시</span><b>20</b></div>
          <div class="mc-skill"><span>소용돌이</span><b>20</b></div>
          <span class="mc-tier">A TIER</span>
        </div>
        <div class="mock-card front">
          <div class="mc-class">소서리스</div><div class="mc-name">파벽 소서리스</div>
          <div class="mc-skill"><span>화염구</span><b>20</b></div>
          <div class="mc-skill"><span>화염벽</span><b>20</b></div>
          <div class="mc-skill"><span>온기</span><b>1</b></div>
          <span class="mc-tier">S TIER · 초보 추천</span>
        </div>
      </div>
    </div>
    <div class="banner-strip">
      <div class="banner-strip-inner">
        <router-link to="/craft-sim"><span class="tag">신규</span>크래프트 시뮬레이터 · 옵션별 확률표</router-link>
        <router-link to="/items"><span class="tag">사전</span>아이템 사전{{ itemCount ? ` ${itemCount}종` : '' }}</router-link>
      </div>
    </div>
  </section>

  <div class="main-layout">
    <main>
      <div class="section-head"><h2>도구</h2></div>
      <div class="tool-grid">
        <router-link v-for="t in TOOLS" :key="t.to" :to="t.to" class="tool-card">
          <span class="tool-icon"><img v-if="toolIcon(t)" :src="toolIcon(t)" alt="" /></span>
          <span class="tool-text">
            <span class="tool-title">{{ t.title }}</span>
            <span class="tool-desc">{{ t.desc }}</span>
          </span>
        </router-link>
      </div>

      <div class="section-head"><h2>직업별 빌드 가이드</h2><router-link class="more" to="/guides?view=tier">티어리스트</router-link></div>
      <div class="class-grid">
        <router-link v-for="c in CLASSES" :key="c.key" class="class-card" :class="CLASS_CSS[c.key]" :to="`/guides?class=${c.key}`">
          <div class="class-icon"><svg viewBox="0 0 24 24" v-html="c.icon"></svg></div>
          <div class="class-name">{{ c.name }}</div>
          <div class="class-sub">{{ guideCount(c.key) ? `${guideCount(c.key)}개 빌드` : '준비 중' }}</div>
        </router-link>
      </div>

      <div class="section-head"><h2>최신 가이드</h2><router-link class="more" to="/guides">전체 보기</router-link></div>
      <div class="guide-grid">
        <router-link class="guide-card" v-for="g in latestGuides" :key="g.id" :to="`/guides/${g.id}`">
          <div class="guide-top"><div class="guide-class-badge">{{ g.className }}</div><span class="guide-tier">{{ g.tier }}</span></div>
          <div class="guide-title">{{ g.title }}</div>
          <div class="guide-desc">{{ g.desc }}</div>
          <div class="guide-date">{{ shortDate(g.date) }}</div>
        </router-link>
      </div>
    </main>

    <aside>
      <div class="side-block board-box">
        <h3>거래게시판 최신 매물 <router-link class="more" to="/trade">더보기</router-link></h3>
        <ul class="home-trades">
          <li v-for="p in latestTrades" :key="p.id">
            <router-link :to="`/trade/${p.id}`">
              <span class="home-trade-icon" :class="postRarity(p)"><img v-if="iconUrl(postIconKey(p))" :src="iconUrl(postIconKey(p))" alt="" /><span v-else class="home-trade-fallback">{{ p.category.slice(0, 1) }}</span></span>
              <span class="home-trade-text">
                <span class="home-trade-name">{{ p.itemName }}</span>
                <span class="home-trade-price">{{ p.price }}</span>
              </span>
            </router-link>
          </li>
        </ul>
      </div>
      <div class="side-block board-box">
        <h3>커뮤니티 최신글 <router-link class="more" to="/community">더보기</router-link></h3>
        <ul>
          <li v-for="c in latestCommunity" :key="c.id">
            <router-link :to="`/community/${c.id}`"><span class="tag">{{ c.category }}</span>{{ c.title }}</router-link>
            <span class="meta">{{ c.commentCount || 0 }}</span>
          </li>
          <li v-if="!latestCommunity.length" class="board-empty">아직 글이 없어요</li>
        </ul>
      </div>
      <div class="side-block board-box">
        <h3>패치노트 <router-link class="more" to="/patch">더보기</router-link></h3>
        <ul>
          <li v-for="n in latestPatches" :key="n.id"><router-link to="/patch">{{ n.title }}</router-link><span class="meta">{{ shortDate(n.date) }}</span></li>
        </ul>
      </div>
      <div class="side-block promo-box">
        <div class="p-tag">공략 제보</div>
        <h3>내 빌드 자랑하고<br />다른 유저 의견도 들어보세요</h3>
        <router-link to="/community/write?cat=공략">가이드 제보하러 가기</router-link>
      </div>
    </aside>
  </div>

  </div>
</template>

<style scoped>
.tool-grid{display:grid; grid-template-columns:repeat(3, 1fr); gap:10px; margin-bottom:36px;}
.tool-card{
  display:flex; align-items:center; gap:12px; padding:14px 16px; border:1px solid var(--border-soft); background:var(--panel);
  border-radius:12px; transition:border-color .15s, transform .15s;
}
.tool-card:hover{border-color:var(--gold-dim); transform:translateY(-2px);}
.tool-icon{width:40px; height:40px; flex:none; display:flex; align-items:center; justify-content:center; background:var(--panel-2); border:1px solid var(--border-soft); border-radius:10px;}
.tool-icon img{max-width:30px; max-height:30px; image-rendering:pixelated;}
.tool-text{display:flex; flex-direction:column; gap:2px; min-width:0;}
.tool-title{font-size:14px; font-weight:700; color:var(--text);}
.tool-desc{font-size:11.5px; color:var(--text-dim); line-height:1.45;}
.home-trades li{padding:6px 0 !important;}
.home-trades a{display:flex !important; align-items:center; gap:10px; min-width:0;}
.home-trade-icon{width:32px; height:32px; flex:none; display:flex; align-items:center; justify-content:center; border:1px solid var(--border-soft); border-radius:8px; background:var(--panel-2);}
.home-trade-icon img{max-width:26px; max-height:26px; image-rendering:pixelated;}
.home-trade-icon.unique, .home-trade-icon.runeword{border-color:var(--gold-dim);}
.home-trade-icon.rare{border-color:#b8a33a;}
.home-trade-fallback{font-family:'Noto Serif KR', serif; font-size:13px; font-weight:700; color:var(--text-dim);}
.home-trade-text{display:flex; flex-direction:column; min-width:0;}
.home-trade-name{font-size:12.5px; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;}
.home-trade-price{font-size:11px; color:var(--text-dim); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;}
@media (max-width:900px){ .tool-grid{grid-template-columns:repeat(2, 1fr);} }
@media (max-width:560px){ .tool-grid{grid-template-columns:1fr;} }
.board-empty{color:var(--text-dim);}
</style>
