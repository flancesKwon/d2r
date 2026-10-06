<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { authState, signIn, ROLE_LABEL } from '../profileStore.js'
import { fetchMyTradePosts, fetchMyRequests, getTradeItem, statusLabel } from '../tradeStore.js'
import { fetchPosts } from '../communityStore.js'
import { fetchReviewsFor, dealsState } from '../dealsStore.js'
import { ITEM_ICONS } from '../itemIcons.js'
import { t } from '../i18n.js'
import { postName, priceText } from '../tradeI18n.js'
import { buildsState } from '../buildStore.js'
import classStats from '../data/classStats.json'
import UserAvatar from '../components/UserAvatar.vue'

const TABS = ['내가 쓴 글', '거래내역', '받은 리뷰', '저장한 빌드']
const route = useRoute()
const router = useRouter()
const activeTab = ref(TABS[0])
// 예전 주소(?tab=edit)는 프로필 수정 페이지로
watch(() => route.query.tab, (t) => { if (t === 'edit') router.replace({ path: '/mypage/edit', query: route.query.welcome ? { welcome: '1' } : {} }) }, { immediate: true })

// 받은 리뷰 (DB)
const myReviews = ref([])
watch(() => authState.user?.id, async (uid) => { myReviews.value = uid ? await fetchReviewsFor(uid).catch(() => []) : [] }, { immediate: true })

// 내 판매글 / 내가 보낸 구매신청 / 내가 쓴 커뮤니티 글 (DB)
const myTradePosts = ref([])
const myRequests = ref([])
const myCommunityPosts = ref([])
watch(() => authState.user?.id, async (uid) => {
  myTradePosts.value = uid ? await fetchMyTradePosts().catch(() => []) : []
  myRequests.value = uid ? await fetchMyRequests().catch(() => []) : []
  myCommunityPosts.value = uid ? (await fetchPosts({ authorId: uid, pageSize: 50 }).catch(() => ({ posts: [] }))).posts : []
}, { immediate: true })

const myPostsCombined = computed(() => {
  const trade = myTradePosts.value.map((p) => ({ type: 'trade', id: p.id, title: p.itemName, category: p.category, date: p.date, link: `/trade/${p.id}` }))
  const community = myCommunityPosts.value.map((p) => ({ type: 'community', id: p.id, title: p.title, category: p.category, date: p.date, link: `/community/${p.id}` }))
  return [...trade, ...community].sort((a, b) => (a.date < b.date ? 1 : -1))
})

function iconUrlFor(iconKey) {
  const url = iconKey && ITEM_ICONS[iconKey]
  return url || null
}
function tradeIconUrl(post) {
  const item = getTradeItem(post.itemId)
  return item ? iconUrlFor(item.icon_key) : null
}

// 프로필 카드: 가입일·마지막 활동·거래·리뷰 요약
const fmtDay = (ts) => { if (!ts) return '-'; const d = new Date(ts); return d.getFullYear() + '.' + (d.getMonth() + 1) + '.' + d.getDate() }
function ago(ts) {
  if (!ts) return '-'
  const min = Math.floor((Date.now() - new Date(ts)) / 60000)
  if (min < 5) return t('방금')
  if (min < 60) return t('{n}분 전', { n: min })
  if (min < 1440) return t('{n}시간 전', { n: Math.floor(min / 60) })
  return t('{n}일 전', { n: Math.floor(min / 1440) })
}
const summary = computed(() => {
  const done = dealsState.deals.filter((d) => d.status === '거래완료').length
  const n = myReviews.value.length
  const avg = n ? (myReviews.value.reduce((a, r) => a + r.rating, 0) / n).toFixed(1) : null
  return { posts: myTradePosts.value.length + myCommunityPosts.value.length, done, reviews: n, avg }
})

const REQUEST_STATUS_LABEL = { pending: '대기중', held: '보류', accepted: '수락됨', declined: '거절됨', cancelled: '취소됨' }

</script>

<template>
  <div class="items-page mypage">

  <div class="patch-hero">
    <div class="patch-hero-inner">
      <div class="eyebrow">{{ $t('내 정보') }}</div>
      <h1>{{ $t('마이페이지') }}</h1>
    </div>
  </div>

  <div class="grid-wrap mypage-wrap" v-if="!authState.user">
    <div class="mypage-login">
      <p>{{ $t('로그인 필요') }}</p>
      <button type="button" class="btn-primary" @click="signIn">{{ $t('로그인') }}</button>
    </div>
  </div>
  <div class="grid-wrap mypage-wrap" v-else>
    <section class="my-profile-card">
      <UserAvatar :src="authState.profile?.avatar_url" :name="authState.profile?.nickname" :size="64" />
      <div class="my-profile-main">
        <div class="my-profile-name">
          {{ authState.profile?.nickname || $t('닉네임') }}
          <span class="my-role" v-if="authState.profile?.role && authState.profile.role !== 'user'">{{ $t(ROLE_LABEL[authState.profile.role] || authState.profile.role) }}</span>
        </div>
        <div class="my-profile-meta">{{ $t('가입') }} {{ fmtDay(authState.profile?.created_at) }} · {{ $t('마지막 활동') }} {{ ago(authState.profile?.last_seen_at) }}</div>
        <div class="my-profile-stats">
          <span>{{ $t('작성') }} <b>{{ summary.posts }}</b></span>
          <span>{{ $t('거래완료') }} <b>{{ summary.done }}</b></span>
          <span>{{ $t('받은 리뷰') }} <b>{{ summary.reviews }}</b><template v-if="summary.avg"> · ★{{ summary.avg }}</template></span>
        </div>
      </div>
      <router-link to="/mypage/edit" class="my-profile-edit">{{ $t('프로필 수정') }}</router-link>
    </section>

    <div class="mypage-tabs">
      <button v-for="t in TABS" :key="t" :class="{ active: activeTab === t }" @click="activeTab = t">{{ $t(t) }}</button>
    </div>

    <div v-if="activeTab === '내가 쓴 글'" class="mypage-panel">
      <div class="my-post-row" v-for="p in myPostsCombined" :key="p.type + p.id">
        <span class="my-post-type" :class="'type-' + p.type">{{ $t(p.type === 'trade' ? '거래' : '커뮤니티') }}</span>
        <span class="my-post-cat">{{ $t(p.category) }}</span>
        <router-link :to="p.link" class="my-post-title">{{ p.title }}</router-link>
        <span class="my-post-date">{{ p.date }}</span>
      </div>
      <div class="empty-state" v-if="!myPostsCombined.length">{{ $t('작성한 글 없음') }}</div>
    </div>

    <div v-else-if="activeTab === '거래내역'" class="mypage-panel">
      <div class="d-section-title">{{ $t('내가 등록한 판매글') }}</div>
      <div class="my-scroll">
        <div class="my-trade-row" v-for="p in myTradePosts" :key="p.id">
          <span class="my-trade-icon"><img v-if="tradeIconUrl(p)" :src="tradeIconUrl(p)" alt="" /></span>
          <router-link :to="`/trade/${p.id}`" class="my-trade-name">{{ postName(p) }}</router-link>
          <span class="status-badge" :class="'status-' + (p.expired ? '만료' : p.status)">{{ $t(p.expired ? '기간 만료' : statusLabel(p.status)) }}</span>
          <router-link v-if="p.expired" :to="`/trade/${p.id}/relist`" class="my-relist">{{ $t('재등록') }}</router-link>
          <span class="my-trade-date">{{ p.date }}</span>
        </div>
      </div>
      <div class="empty-state" v-if="!myTradePosts.length">{{ $t('판매글 없음') }}</div>

      <div class="d-section-title" style="margin-top:26px;">{{ $t('내가 구매신청 보낸 거래') }}</div>
      <div class="my-scroll">
        <div class="my-trade-row" v-for="r in myRequests" :key="'buy-' + r.id">
          <span class="my-trade-icon"><img v-if="tradeIconUrl(r.post)" :src="tradeIconUrl(r.post)" alt="" /></span>
          <router-link :to="`/trade/${r.post.id}`" class="my-trade-name">{{ postName(r.post) }}</router-link>
          <span class="request-status" :class="'status-' + (r.status || 'pending')">{{ $t(REQUEST_STATUS_LABEL[r.status || 'pending']) }}</span>
          <span class="my-trade-date">{{ r.date }}</span>
        </div>
      </div>
      <div class="empty-state" v-if="!myRequests.length">{{ $t('보낸 구매신청 없음') }}</div>
    </div>

    <div v-else-if="activeTab === '받은 리뷰'" class="mypage-panel">
      <div class="my-review-row" v-for="r in myReviews" :key="r.dealId">
        <div class="my-review-top">
          <span class="my-review-stars"><span v-for="n in 5" :key="n" class="star" :class="{ filled: n <= r.rating }">★</span></span>
          <span class="my-review-from">{{ r.from }}</span>
          <span class="my-review-post">{{ priceText(r.postTitle) }}</span>
          <span class="my-review-date">{{ r.date }}</span>
        </div>
        <div class="my-review-comment" v-if="r.comment">{{ r.comment }}</div>
      </div>
      <div class="empty-state" v-if="!myReviews.length">{{ $t('받은 리뷰 없음') }}</div>
    </div>

    <div v-else-if="activeTab === '저장한 빌드'" class="mypage-panel">
      <div class="empty-state" v-if="buildsState.error">{{ $t(buildsState.error) }}</div>
      <template v-else>
        <div class="my-post-row" v-for="b in buildsState.list" :key="b.id">
          <span class="my-post-type type-community">{{ $t(classStats[b.classKey]?.name || b.classKey) }}</span>
          <span class="my-post-cat">Lv {{ b.level }}</span>
          <router-link :to="{ path: '/simulator', query: { b: b.code } }" class="my-post-title">{{ b.name }}</router-link>
          <span class="my-post-date">{{ b.date }}</span>
        </div>
        <div class="empty-state" v-if="!buildsState.list.length">{{ $t('저장한 빌드 없음 (시뮬레이터 "내 빌드"에서 저장)') }}</div>
      </template>
    </div>

  </div>
  </div>
</template>

<style scoped>
.mypage-login{display:flex; flex-direction:column; align-items:center; gap:14px; padding:48px 16px; color:var(--text-muted); font-size:14px; text-align:center;}
.mypage-wrap{max-width:920px;}
/* 폰에서도 탭 이름이 세로로 꺾이지 않게 한 줄 유지, 넘치면 옆으로 밀어서 봄 */
.my-profile-card{display:flex; align-items:center; gap:18px; background:var(--panel); border:1px solid var(--border-soft); border-radius:16px; padding:20px 22px; margin-bottom:18px; flex-wrap:wrap;}
.my-profile-main{flex:1; min-width:200px; display:flex; flex-direction:column; gap:5px;}
.my-profile-name{font-family:'Noto Serif KR', serif; font-size:19px; font-weight:700; color:var(--text); display:flex; align-items:center; gap:8px;}
.my-role{font-family:'Noto Sans KR', sans-serif; font-size:11px; font-weight:600; color:var(--gold); border:1px solid var(--gold-dim); border-radius:999px; padding:2px 9px;}
.my-profile-meta{font-size:12px; color:var(--text-dim);}
.my-profile-stats{display:flex; gap:14px; flex-wrap:wrap; font-size:12.5px; color:var(--text-muted);}
.my-profile-stats b{color:var(--gold);}
.my-profile-edit{font-size:12.5px; color:var(--gold-dim); border:1px solid var(--border); border-radius:10px; padding:8px 14px;}
.my-profile-edit:hover{color:var(--gold); border-color:var(--gold-dim);}
/* 탭 줄은 위 프로필 카드와 같은 폭, 탭은 같은 너비로 나눔 (폰에서 좁으면 옆으로 밀어서 봄) */
.mypage-tabs{display:flex; border:1px solid var(--border); border-radius:12px; overflow-x:auto; width:100%; margin-bottom:20px;}
.mypage-tabs button{font-size:13px; padding:11px 16px; color:var(--text-dim); background:var(--panel); white-space:nowrap; flex:1 0 auto;}
@media (max-width:560px){ .mypage-tabs button{padding:10px 14px;} }
.mypage-tabs button + button{border-left:1px solid var(--border);}
.mypage-tabs button.active{color:var(--gold); background:var(--panel-2);}

.mypage-panel{display:flex; flex-direction:column; gap:10px;}

.my-post-row{
  display:flex; align-items:center; gap:12px; background:var(--panel); border:1px solid var(--border-soft);
  padding:14px 18px; border-radius:12px; flex-wrap:wrap;
}
.my-post-type{font-size:10.5px; padding:3px 11px; border-radius:999px; flex:none; font-weight:600; border:1px solid var(--border);}
.my-post-type.type-trade{color:var(--gold); border-color:var(--gold-dim);}
.my-post-type.type-community{color:var(--teal); border-color:var(--teal);}
.my-post-cat{font-size:11px; color:var(--text-dim); flex:none;}
.my-post-title{flex:1; font-size:13.5px; color:var(--text); min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.my-post-title:hover{color:var(--gold-dim);}
.my-post-date{font-size:11.5px; color:var(--text-dim); flex:none;}

.my-trade-row{
  display:flex; align-items:center; gap:12px; background:var(--panel); border:1px solid var(--border-soft);
  padding:12px 18px; border-radius:12px; flex-wrap:wrap;
}
.my-trade-icon{
  width:30px; height:30px; flex:none; display:flex; align-items:center; justify-content:center;
  background:var(--panel-2); border:1px solid var(--border-soft); border-radius:8px;
}
.my-trade-icon img{width:100%; height:100%; object-fit:contain; image-rendering:pixelated;}
.my-trade-name{flex:1; font-size:13.5px; color:var(--text); min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.my-trade-name:hover{color:var(--gold-dim);}
.my-trade-req-count{font-size:11.5px; color:var(--text-dim); flex:none;}
.my-trade-date{font-size:11.5px; color:var(--text-dim); flex:none;}

.status-badge{font-size:11px; padding:3px 10px; border-radius:999px; border:1px solid var(--border); color:var(--text-dim); flex:none;}
.status-badge.status-판매중{color:var(--gold); border-color:var(--gold-dim);}
.status-badge.status-예약중{color:var(--teal); border-color:var(--teal);}
.status-badge.status-거래완료{color:var(--text-dim); border-color:var(--border);}
.status-badge.status-만료{color:#e0775f; border-color:var(--blood);}
.my-relist{font-size:11.5px; font-weight:700; color:#1a1408; background:var(--gold); padding:3px 12px; border-radius:999px; flex:none;}

.request-status{font-size:11px; padding:3px 10px; border-radius:999px; border:1px solid var(--border); color:var(--text-dim); flex:none;}
.request-status.status-accepted{color:var(--gold); border-color:var(--gold-dim);}
.request-status.status-declined{color:var(--blood); border-color:var(--blood);}
.request-status.status-held{color:var(--teal); border-color:var(--teal); border-style:dashed;}

.my-review-row{background:var(--panel); border:1px solid var(--border-soft); padding:14px 18px; border-radius:12px; display:flex; flex-direction:column; gap:8px;}
.my-review-top{display:flex; align-items:center; gap:10px; flex-wrap:wrap;}
.my-review-stars .star{font-size:14px; color:var(--border);}
.my-review-stars .star.filled{color:var(--gold);}
.my-review-from{font-size:12.5px; color:var(--gold-dim); font-weight:600;}
.my-review-post{font-size:11.5px; color:var(--text-dim); flex:1;}
.my-review-date{font-size:11px; color:var(--text-dim);}
.my-review-comment{font-size:13px; color:var(--text-muted); line-height:1.7;}

/* 판매글·구매신청이 많아도 끝없이 늘어나지 않게 목록 안에서 스크롤 */
.my-scroll{max-height:min(420px, 60vh); overflow-y:auto; overscroll-behavior:contain; scrollbar-width:thin; scrollbar-color:var(--gold-dim) transparent; padding-right:4px;}
</style>
