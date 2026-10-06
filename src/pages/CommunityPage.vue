<script setup>
import { ref, watch, onMounted } from 'vue'
import { useAutoRefresh } from '../useAutoRefresh.js'
import { useRoute } from 'vue-router'
import { CATEGORIES, fetchPosts, fetchPinnedPosts } from '../communityStore.js'

const route = useRoute()
const activeCat = ref(CATEGORIES.includes(route.query.cat) ? route.query.cat : null)
// 이미 커뮤니티에 있을 때 상단 메뉴로 다른 카테고리(?cat=)를 누르면 따라감
watch(() => route.query.cat, (c) => (activeCat.value = CATEGORIES.includes(c) ? c : null))
const activeTag = ref(typeof route.query.tag === 'string' ? route.query.tag : null)
const searchQuery = ref('')
const sortBy = ref('latest')

// 목록은 DB에서 20개씩 (검색·정렬·태그도 DB에서)
const posts = ref([])
const total = ref(0)
const page = ref(0)
const loading = ref(false)
const loadError = ref('')
let seq = 0
async function load(reset = true) {
  const my = ++seq
  loading.value = true
  loadError.value = ''
  if (reset) page.value = 0
  try {
    const res = await fetchPosts({ category: activeCat.value, tag: activeTag.value, q: searchQuery.value, sort: sortBy.value, page: page.value })
    if (my !== seq) return
    posts.value = reset ? res.posts : [...posts.value, ...res.posts]
    total.value = res.total
  } catch (e) {
    if (my === seq) loadError.value = '게시글 불러오기 실패 - 잠시 뒤 다시 시도'
  } finally {
    if (my === seq) loading.value = false
  }
}
function loadMore() {
  page.value++
  load(false)
}
let searchTimer = 0
watch(searchQuery, () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => load(), 300) })
watch([activeCat, activeTag, sortBy], () => load())
onMounted(() => load())
// 보고 있는 동안 30초마다 새 글 ("더 보기"로 더 펼쳐 둔 상태면 그대로)
useAutoRefresh(() => { if (page.value === 0 && !loading.value) return load() })

// 고정 글(공지)은 전체·공지 목록 맨 위에. 아래 목록에선 중복으로 안 보이게 뺌
const pinnedPosts = ref([])
fetchPinnedPosts().then((list) => (pinnedPosts.value = list))
const showPinned = () => !searchQuery.value.trim() && !activeTag.value && (!activeCat.value || activeCat.value === '공지')
const pinnedIds = () => new Set(showPinned() ? pinnedPosts.value.map((p) => p.id) : [])

function setTagFilter(t) {
  activeTag.value = activeTag.value === t ? null : t
}
</script>

<template>
  <div class="items-page community-page">

  <div class="patch-hero">
    <div class="patch-hero-inner">
      <div class="eyebrow">유저 커뮤니티</div>
      <h1>커뮤니티</h1>
    </div>
  </div>

  <div class="toolbar">
    <div class="toolbar-inner">
      <div class="cat-tabs">
        <button :class="{ active: activeCat === null }" @click="activeCat = null">전체</button>
        <button v-for="c in CATEGORIES" :key="c" :class="{ active: activeCat === c }" @click="activeCat = c">
          {{ c }}
        </button>
      </div>
      <div class="search-row">
        <div class="search-input-wrap">
          <input type="text" :value="searchQuery" @input="searchQuery = $event.target.value" placeholder="제목·내용·태그 검색" aria-label="게시글 검색" />
        </div>
        <select v-model="sortBy" class="sort-select">
          <option value="latest">최신순</option>
          <option value="likes">추천순</option>
          <option value="views">조회순</option>
          <option value="comments">댓글순</option>
        </select>
        <span class="result-count">{{ total }}개</span>
        <router-link class="quality-toggle" :to="{ path: '/community/write', query: activeCat ? { cat: activeCat } : {} }">글쓰기</router-link>
      </div>
      <div class="active-tag-row" v-if="activeTag">
        <span class="active-tag-label">태그 필터:</span>
        <button class="tag-chip active" @click="activeTag = null">#{{ activeTag }} ✕</button>
      </div>
    </div>
  </div>

  <div class="grid-wrap community-list-wrap">
    <div class="community-list">
      <template v-if="showPinned()">
        <router-link class="community-row pinned" v-for="p in pinnedPosts" :key="'pin-' + p.id" :to="`/community/${p.id}`">
          <span class="community-cat cat-notice">{{ p.category === '공지' ? '공지' : '고정' }}</span>
          <div class="community-body">
            <div class="community-title-row"><span class="community-title">{{ p.title }}</span></div>
            <div class="community-meta">{{ p.author }} · {{ p.date }} · 조회 {{ p.views }}</div>
          </div>
          <span class="community-comment-count" v-if="p.commentCount">{{ p.commentCount }}</span>
        </router-link>
      </template>
      <router-link class="community-row" v-for="p in posts.filter((x) => !pinnedIds().has(x.id))" :key="p.id" :to="`/community/${p.id}`">
        <span class="community-cat" :class="{ 'cat-notice': p.category === '공지' }">{{ p.category }}</span>
        <div class="community-body">
          <div class="community-title-row">
            <span class="community-title">{{ p.title }}</span>
            <span class="hot-badge" v-if="p.likes - p.dislikes >= 10">인기</span>
          </div>
          <div class="community-meta">
            {{ p.author }} · {{ p.date }} · 조회 {{ p.views }} · 추천 {{ p.likes - p.dislikes }}
          </div>
          <div class="community-tag-row" v-if="p.tags.length">
            <span
              v-for="t in p.tags"
              :key="t"
              class="tag-chip small"
              @click.prevent.stop="setTagFilter(t)"
            >#{{ t }}</span>
          </div>
        </div>
        <span class="community-comment-count" v-if="p.commentCount">{{ p.commentCount }}</span>
      </router-link>
      <div class="empty-state" v-if="loadError">{{ loadError }}</div>
      <div class="empty-state" v-else-if="!loading && posts.length === 0">게시글 없음</div>
      <button type="button" class="more-btn" v-if="posts.length < total" :disabled="loading" @click="loadMore">
        {{ loading ? '불러오는 중…' : '더 보기' }}
      </button>
    </div>
  </div>
  </div>
</template>

<style scoped>
.community-row.pinned{border-color:var(--gold-dim); background:rgba(200,163,77,0.06);}
.community-cat.cat-notice{color:var(--gold); border-color:var(--gold-dim);}
/* 벨로그처럼 여백 넉넉하고 둥근 카드 느낌으로 - 사이트 기본 톤(어두운 배경, 금색
   포인트)은 유지하되 커뮤니티/거래게시판만 각진 테두리 대신 둥근 모서리 +
   카드 구분 + 은은한 그림자로 가독성 위주로 다르게 감 */
.cat-tabs button{border-radius:999px;}
.search-input-wrap{border-radius:10px; overflow:hidden;}
.quality-toggle{border-radius:10px;}
.sort-select{
  background:var(--panel); border:1px solid var(--border); color:var(--text-muted); font-size:12.5px;
  padding:9px 14px; font-family:'Noto Sans KR', sans-serif; border-radius:10px;
}
.active-tag-row{display:flex; align-items:center; gap:8px; margin-top:10px; max-width:1180px; margin-left:auto; margin-right:auto;}
.active-tag-label{font-size:12px; color:var(--text-dim);}

.tag-chip{
  font-size:11.5px; color:var(--gold-dim); border:1px solid var(--border); background:var(--panel-2);
  padding:4px 12px; cursor:pointer; border-radius:999px;
}
.tag-chip:hover{border-color:var(--gold-dim); color:var(--gold);}
.tag-chip.active{color:var(--gold); border-color:var(--gold-dim);}
.tag-chip.small{font-size:10.5px; padding:3px 10px;}


.community-list-wrap{max-width:1180px;}
.community-list{display:flex; flex-direction:column; gap:14px;}
.community-row{
  display:flex; align-items:flex-start; gap:16px; padding:22px 24px; border-radius:16px;
  background:var(--panel); border:1px solid var(--border-soft);
  transition:transform .15s, box-shadow .15s, border-color .15s;
}
.community-row:hover{transform:translateY(-2px); box-shadow:0 10px 26px -10px rgba(0,0,0,0.55); border-color:var(--gold-dim);}
.community-cat{font-size:11px; color:var(--gold-dim); border:1px solid var(--border); padding:4px 12px; flex:none; margin-top:1px; border-radius:999px;}
.community-body{flex:1; min-width:0;}
.community-title-row{display:flex; align-items:center; gap:7px; margin-bottom:6px;}
.community-title{font-size:15.5px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.hot-badge{font-size:10px; color:var(--blood); border:1px solid var(--blood); padding:1px 8px; flex:none; border-radius:999px;}
.more-btn{align-self:center; padding:10px 28px; border-radius:999px; border:1px solid var(--border); color:var(--text-muted); font-size:13px;}
.more-btn:hover{border-color:var(--gold-dim); color:var(--gold);}
.community-meta{font-size:11.5px; color:var(--text-dim); margin-bottom:8px; line-height:1.6;}
.community-tag-row{display:flex; flex-wrap:wrap; gap:6px;}
.community-comment-count{font-size:11.5px; color:var(--text-muted); border:1px solid var(--border); padding:3px 10px; flex:none; margin-top:1px; border-radius:999px;}
</style>
