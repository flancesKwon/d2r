<script setup>
// 회원 프로필 (/users/:id) - 거래 상대를 믿을 만한지 보는 화면
// 공개 정보만: 닉네임·사진·가입일·마지막 활동·받은 리뷰·판매글·커뮤니티 글 (연락처·정지 사유 등은 안 보임)
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '../supabase.js'
import { authState, signIn, ROLE_LABEL } from '../profileStore.js'
import { fetchTradePostsBy, getTradeItem, statusLabel, tradePriceOf } from '../tradeStore.js'
import { fetchPosts } from '../communityStore.js'
import { fetchReviewsFor } from '../dealsStore.js'
import { openConversationWith } from '../messagesStore.js'
import { ITEM_ICONS } from '../itemIcons.js'
import { t } from '../i18n.js'
import { postName, priceText } from '../tradeI18n.js'
import UserAvatar from '../components/UserAvatar.vue'
import { isOnline } from '../presence.js'
import ReportButton from '../components/ReportButton.vue'

const route = useRoute()
const router = useRouter()
const userId = computed(() => String(route.params.id || ''))
const isMe = computed(() => !!authState.user && authState.user.id === userId.value)

const profile = ref(null)
const notFound = ref(false)
const reviews = ref([])
const tradePosts = ref([])
const communityPosts = ref([])
const tab = ref('reviews')
const actionError = ref('')

async function load(id) {
  profile.value = null
  notFound.value = false
  reviews.value = []
  tradePosts.value = []
  communityPosts.value = []
  if (!supabase || !id) return
  const { data } = await supabase.from('tb_profile')
    .select('id, nickname, avatar_url, role, created_at, suspended_until, last_seen_at').eq('id', id).maybeSingle()
  if (!data) { notFound.value = true; return }
  profile.value = data
  document.title = `${data.nickname} — ${t('디아허브')}`
  ;[reviews.value, tradePosts.value, communityPosts.value] = await Promise.all([
    fetchReviewsFor(id).catch(() => []),
    fetchTradePostsBy(id).catch(() => []),
    fetchPosts({ authorId: id, pageSize: 50 }).then((r) => r.posts).catch(() => []),
  ])
}
watch(userId, load, { immediate: true })

const fmtDay = (ts) => { if (!ts) return '-'; const d = new Date(ts); return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}` }
function ago(ts) {
  if (!ts) return '-'
  const min = Math.floor((Date.now() - new Date(ts)) / 60000)
  if (min < 5) return t('방금')
  if (min < 60) return t('{n}분 전', { n: min })
  if (min < 1440) return t('{n}시간 전', { n: Math.floor(min / 60) })
  return t('{n}일 전', { n: Math.floor(min / 1440) })
}
const suspended = computed(() => profile.value?.suspended_until && new Date(profile.value.suspended_until) > new Date())
const summary = computed(() => {
  const n = reviews.value.length
  const avg = n ? reviews.value.reduce((a, r) => a + r.rating, 0) / n : 0
  return {
    reviews: n,
    avg: n ? avg.toFixed(1) : null,
    sold: tradePosts.value.filter((p) => p.status === '거래완료').length,
    selling: tradePosts.value.filter((p) => p.status !== '거래완료' && !p.expired),
  }
})

const iconUrl = (post) => { const it = getTradeItem(post.itemId); return it?.icon_key ? ITEM_ICONS[it.icon_key] || null : null }

async function sendMessage() {
  actionError.value = ''
  if (!authState.user) return signIn()
  try {
    const convId = await openConversationWith(userId.value)
    router.push({ path: '/messages', query: { c: convId } })
  } catch (e) {
    actionError.value = t(e.message || '대화방 열기 실패')
  }
}
</script>

<template>
  <div class="items-page user-page">
    <div class="patch-hero">
      <div class="patch-hero-inner">
        <div class="eyebrow">{{ $t('회원 정보') }}</div>
        <h1>{{ profile?.nickname || (notFound ? $t('없는 회원') : '…') }}</h1>
      </div>
    </div>

    <div class="grid-wrap user-wrap" v-if="notFound">
      <div class="empty-state">{{ $t('탈퇴했거나 없는 회원') }}</div>
    </div>

    <div class="grid-wrap user-wrap" v-else-if="profile">
      <section class="user-card">
        <UserAvatar :src="profile.avatar_url" :name="profile.nickname" :size="72" :user-id="profile.id" :clickable="false" />
        <div class="user-main">
          <div class="user-name">
            {{ profile.nickname }}
            <span class="user-role" v-if="profile.role && profile.role !== 'user'">{{ $t(ROLE_LABEL[profile.role] || profile.role) }}</span>
            <span class="user-suspended" v-if="suspended">{{ $t('이용 정지 중') }}</span>
            <span class="user-new" v-else-if="!summary.reviews && !summary.sold">{{ $t('새 판매자') }}</span>
          </div>
          <div class="user-meta">{{ $t('가입') }} {{ fmtDay(profile.created_at) }} · <span v-if="isOnline(profile.id)" class="online-now">{{ $t('● 접속 중') }}</span><template v-else>{{ $t('마지막 활동') }} {{ ago(profile.last_seen_at) }}</template></div>
          <div class="user-stats">
            <span class="user-stat"><b>{{ summary.avg ? '★ ' + summary.avg : '-' }}</b><small>{{ $t('평점') }}</small></span>
            <span class="user-stat"><b>{{ summary.reviews || '-' }}</b><small>{{ $t('받은 리뷰') }}</small></span>
            <span class="user-stat"><b>{{ summary.sold || '-' }}</b><small>{{ $t('판매 완료') }}</small></span>
            <span class="user-stat"><b>{{ summary.selling.length || '-' }}</b><small>{{ $t('판매 중') }}</small></span>
          </div>
        </div>
        <div class="user-actions">
          <router-link v-if="isMe" to="/mypage" class="user-btn primary">{{ $t('마이페이지') }}</router-link>
          <template v-else>
            <button type="button" class="user-btn primary" @click="sendMessage">{{ $t('쪽지 보내기') }}</button>
            <ReportButton target-type="profile" :target-id="profile.id" :owner-id="profile.id" :label="$t('회원 신고')" />
          </template>
        </div>
      </section>
      <div class="action-error" v-if="actionError">{{ actionError }}</div>

      <div class="user-tabs">
        <button :class="{ active: tab === 'reviews' }" @click="tab = 'reviews'">{{ $t('받은 리뷰') }} {{ reviews.length }}</button>
        <button :class="{ active: tab === 'trade' }" @click="tab = 'trade'">{{ $t('판매글') }} {{ tradePosts.length }}</button>
        <button :class="{ active: tab === 'community' }" @click="tab = 'community'">{{ $t('커뮤니티 글') }} {{ communityPosts.length }}</button>
      </div>

      <div class="user-panel" v-if="tab === 'reviews'">
        <div class="review-row" v-for="r in reviews" :key="r.dealId + r.fromId">
          <div class="review-top">
            <span class="review-stars">{{ '★'.repeat(r.rating) }}<span class="dim">{{ '★'.repeat(5 - r.rating) }}</span></span>
            <router-link :to="`/users/${r.fromId}`" class="review-from">{{ r.from }}</router-link>
            <span class="review-item" v-if="r.postTitle">{{ priceText(r.postTitle) }}</span>
            <span class="review-date">{{ r.date }}</span>
          </div>
          <div class="review-text" v-if="r.comment">{{ r.comment }}</div>
        </div>
        <div class="empty-state" v-if="!reviews.length">{{ $t('받은 리뷰 없음') }}</div>
      </div>

      <div class="user-panel" v-else-if="tab === 'trade'">
        <router-link :to="`/trade/${p.id}`" class="post-row" v-for="p in tradePosts" :key="p.id">
          <span class="post-icon"><img v-if="iconUrl(p)" :src="iconUrl(p)" alt="" /></span>
          <span class="post-title">{{ postName(p) }}</span>
          <span class="post-price">{{ priceText(tradePriceOf(p)) || $t('거래가 미기록') }}</span>
          <span class="post-status" :class="'status-' + (p.expired ? '만료' : p.status)">{{ $t(p.expired ? '기간 만료' : statusLabel(p.status)) }}</span>
          <span class="post-date">{{ p.date }}</span>
        </router-link>
        <div class="empty-state" v-if="!tradePosts.length">{{ $t('판매글 없음') }}</div>
      </div>

      <div class="user-panel" v-else>
        <router-link :to="`/community/${p.id}`" class="post-row" v-for="p in communityPosts" :key="p.id">
          <span class="post-cat">{{ $t(p.category) }}</span>
          <span class="post-title">{{ p.title }}</span>
          <span class="post-date">{{ p.date }}</span>
        </router-link>
        <div class="empty-state" v-if="!communityPosts.length">{{ $t('커뮤니티 글 없음') }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.user-wrap{max-width:980px;}
.user-card{display:flex; align-items:center; gap:20px; background:var(--panel); border:1px solid var(--border-soft); border-radius:16px; padding:22px 24px; margin-bottom:16px; flex-wrap:wrap;}
.user-main{flex:1; min-width:220px; display:flex; flex-direction:column; gap:6px;}
.user-name{font-family:'Noto Serif KR', serif; font-size:21px; font-weight:700; color:var(--text); display:flex; align-items:center; gap:8px; flex-wrap:wrap;}
.user-role{font-family:'Noto Sans KR', sans-serif; font-size:11px; color:var(--gold); border:1px solid var(--gold-dim); border-radius:999px; padding:2px 9px;}
.user-suspended{font-family:'Noto Sans KR', sans-serif; font-size:11px; color:#e0775f; border:1px solid var(--blood); border-radius:999px; padding:2px 9px;}
.user-meta{font-size:12.5px; color:var(--text-dim);}
.user-new{margin-left:6px; padding:1px 8px; border:1px solid var(--line); border-radius:999px;
  font-size:11.5px; font-weight:600; color:var(--text-muted); vertical-align:3px;}
.user-stats{display:flex; gap:10px; flex-wrap:wrap; margin-top:6px;}
.user-stat{display:flex; flex-direction:column; align-items:center; min-width:72px; padding:8px 12px; border:1px solid var(--border-soft); border-radius:12px; background:var(--panel-2);}
.user-stat b{font-size:16px; color:var(--gold);}
.user-stat small{font-size:11px; color:var(--text-dim);}
.user-actions{display:flex; flex-direction:column; align-items:stretch; gap:8px;}
.user-btn{font-size:13.5px; font-weight:700; padding:10px 20px; border-radius:10px; border:1px solid var(--border); color:var(--text-muted); text-align:center;}
.user-btn.primary{background:var(--gold); border-color:var(--gold); color:#1a1408;}
.user-btn.primary:hover{filter:brightness(1.08);}
.action-error{font-size:12.5px; color:#e0775f; margin:-6px 0 12px;}

.user-tabs{display:flex; gap:6px; margin-bottom:12px; flex-wrap:wrap;}
.user-tabs button{font-size:13px; padding:8px 16px; border-radius:999px; border:1px solid var(--border); color:var(--text-muted);}
.user-tabs button.active{color:var(--gold); border-color:var(--gold-dim); background:var(--panel);}
.user-panel{display:flex; flex-direction:column; gap:8px;}

.review-row{background:var(--panel); border:1px solid var(--border-soft); border-radius:12px; padding:12px 16px;}
.review-top{display:flex; align-items:center; gap:10px; flex-wrap:wrap; font-size:12.5px;}
.review-stars{color:var(--gold); letter-spacing:1px;}
.review-stars .dim{color:var(--border);}
.review-from{color:var(--text); font-weight:600;}
.review-from:hover{color:var(--gold);}
.review-item{color:var(--text-dim);}
.review-date{margin-left:auto; color:var(--text-dim); font-size:11.5px;}
.review-text{font-size:13.5px; color:var(--text-muted); margin-top:6px; line-height:1.6;}

.post-row{display:flex; align-items:center; gap:10px; background:var(--panel); border:1px solid var(--border-soft); border-radius:12px; padding:10px 14px; font-size:13px; color:var(--text);}
.post-row:hover{border-color:var(--gold-dim);}
.post-icon{width:30px; height:30px; flex:none; display:flex; align-items:center; justify-content:center; background:var(--panel-2); border-radius:8px;}
.post-icon img{width:100%; height:100%; object-fit:contain; image-rendering:pixelated;}
.post-title{flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:600;}
.post-price{color:var(--gold-dim); font-size:12px; max-width:30%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.post-cat{font-size:11px; color:var(--teal); border:1px solid var(--teal); border-radius:999px; padding:2px 9px; flex:none;}
.post-status{font-size:11px; padding:2px 9px; border-radius:999px; border:1px solid var(--border); color:var(--text-dim); flex:none;}
.post-status.status-판매중{color:var(--teal); border-color:var(--teal);}
.post-status.status-예약중{color:var(--gold); border-color:var(--gold-dim);}
.post-date{font-size:11.5px; color:var(--text-dim); flex:none;}

@media (max-width:640px){
  .user-card{padding:18px;}
  .user-actions{width:100%; flex-direction:row;}
  .user-actions > *{flex:1;}
  .post-price{display:none;}
  .user-stats{display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); gap:6px;}
  .user-stat{min-width:0; padding:8px 4px;}
}
.online-now{color:#3ecf5a; font-weight:600;}
</style>
