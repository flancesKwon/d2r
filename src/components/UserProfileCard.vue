<script setup>
// 프로필 카드 - 프로필 사진을 누르면 어느 화면에서든 뜸
// 닉네임·사진·평점(리뷰 평균)·접속 중/마지막 접속·판매중/판매완료/작성글 수·최근 판매글·최근 글
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '../supabase.js'
import { authState, signIn, ROLE_LABEL } from '../profileStore.js'
import { fetchTradePostsBy, postIconKey, postRarity, parsePriceTokens } from '../tradeStore.js'
import { fetchPosts } from '../communityStore.js'
import { fetchReviewsFor } from '../dealsStore.js'
import { openConversationWith } from '../messagesStore.js'
import { ITEM_ICONS } from '../itemIcons.js'
import { isOnline } from '../presence.js'
import { profileCardState, closeProfileCard } from '../profileCard.js'
import UserAvatar from './UserAvatar.vue'

const route = useRoute()
const router = useRouter()
const profile = ref(null)
const reviews = ref([])
const tradePosts = ref([])
const communityPosts = ref([])
const loading = ref(false)
const error = ref('')
let seq = 0

async function load(id) {
  const my = ++seq
  profile.value = null
  reviews.value = []
  tradePosts.value = []
  communityPosts.value = []
  error.value = ''
  if (!id || !supabase) return
  loading.value = true
  try {
    const { data } = await supabase.from('tb_profile')
      .select('id, nickname, avatar_url, role, created_at, last_seen_at').eq('id', id).maybeSingle()
    if (my !== seq) return
    if (!data) { error.value = '탈퇴했거나 없는 회원'; return }
    profile.value = data
    const [r, t, c] = await Promise.all([
      fetchReviewsFor(id).catch(() => []),
      fetchTradePostsBy(id).catch(() => []),
      fetchPosts({ authorId: id, pageSize: 50 }).then((x) => x.posts).catch(() => []),
    ])
    if (my !== seq) return
    reviews.value = r
    tradePosts.value = t
    communityPosts.value = c
  } finally {
    if (my === seq) loading.value = false
  }
}
watch(() => profileCardState.userId, load)
// 다른 화면으로 가면 닫음
watch(() => route.fullPath, closeProfileCard)
const onKey = (e) => { if (e.key === 'Escape') closeProfileCard() }
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))

function ago(ts) {
  if (!ts) return '기록 없음'
  const min = Math.floor((Date.now() - new Date(ts)) / 60000)
  if (min < 5) return '방금 전'
  if (min < 60) return min + '분 전'
  if (min < 1440) return Math.floor(min / 60) + '시간 전'
  return Math.floor(min / 1440) + '일 전'
}
const fmtDay = (ts) => { if (!ts) return '-'; const d = new Date(ts); return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}` }
const online = computed(() => isOnline(profile.value?.id))
const avg = computed(() => (reviews.value.length ? (reviews.value.reduce((a, r) => a + r.rating, 0) / reviews.value.length).toFixed(1) : null))
const selling = computed(() => tradePosts.value.filter((p) => p.status === '판매중' && !p.expired))
const sold = computed(() => tradePosts.value.filter((p) => p.status === '거래완료').length)
const isMe = computed(() => !!authState.user && authState.user.id === profile.value?.id)
const iconUrl = (key) => (key && ITEM_ICONS[key]) || null
const priceText = (p) => parsePriceTokens(p.price).map((t) => t.text).join('')

async function sendMessage() {
  error.value = ''
  if (!authState.user) return signIn()
  try {
    const convId = await openConversationWith(profile.value.id)
    closeProfileCard()
    router.push({ path: '/messages', query: { c: convId } })
  } catch (e) {
    error.value = e.message || '대화방 열기 실패'
  }
}
</script>

<template>
  <div class="modal-overlay pcard-overlay" v-if="profileCardState.userId" @click.self="closeProfileCard">
    <div class="pcard" role="dialog" aria-label="회원 프로필">
      <button type="button" class="pcard-close" aria-label="닫기" @click="closeProfileCard">✕</button>
      <div class="pcard-empty" v-if="loading && !profile">불러오는 중…</div>
      <div class="pcard-empty" v-else-if="!profile">{{ error || '불러오는 중…' }}</div>
      <template v-else>
        <div class="pcard-head">
          <UserAvatar :src="profile.avatar_url" :name="profile.nickname" :size="64" :user-id="profile.id" :clickable="false" />
          <div class="pcard-who">
            <div class="pcard-name">
              {{ profile.nickname }}
              <span class="pcard-role" v-if="profile.role && profile.role !== 'user'">{{ ROLE_LABEL[profile.role] || profile.role }}</span>
            </div>
            <div class="pcard-seen" :class="{ on: online }">{{ online ? '● 접속 중' : '마지막 접속 ' + ago(profile.last_seen_at) }}</div>
            <div class="pcard-joined">가입 {{ fmtDay(profile.created_at) }}</div>
          </div>
        </div>

        <div class="pcard-stats">
          <span><b>{{ avg ? '★ ' + avg : '-' }}</b><small>평점 · 리뷰 {{ reviews.length }}</small></span>
          <span><b>{{ selling.length }}</b><small>판매중</small></span>
          <span><b>{{ sold }}</b><small>판매완료</small></span>
          <span><b>{{ communityPosts.length }}</b><small>작성글</small></span>
        </div>

        <div class="pcard-section" v-if="selling.length">
          <div class="pcard-title">판매중인 글</div>
          <router-link v-for="p in selling.slice(0, 3)" :key="p.id" :to="`/trade/${p.id}`" class="pcard-row">
            <span class="pcard-icon" :class="postRarity(p)"><img v-if="iconUrl(postIconKey(p))" :src="iconUrl(postIconKey(p))" alt="" /></span>
            <span class="pcard-row-name">{{ p.itemName }}</span>
            <small>{{ priceText(p) }}</small>
          </router-link>
        </div>
        <div class="pcard-section" v-if="communityPosts.length">
          <div class="pcard-title">최근 작성글</div>
          <router-link v-for="c in communityPosts.slice(0, 3)" :key="c.id" :to="`/community/${c.id}`" class="pcard-row">
            <span class="pcard-row-name">{{ c.title }}</span>
            <small>{{ c.date }}</small>
          </router-link>
        </div>
        <div class="pcard-section" v-if="reviews.length">
          <div class="pcard-title">최근 받은 리뷰</div>
          <div class="pcard-review" v-for="(r, i) in reviews.slice(0, 2)" :key="i">
            <span class="pcard-stars">{{ '★'.repeat(r.rating) }}{{ '☆'.repeat(5 - r.rating) }}</span>
            <span class="pcard-row-name">{{ r.comment || '(내용 없음)' }}</span>
            <small>{{ r.from }}</small>
          </div>
        </div>

        <div class="pcard-error" v-if="error">{{ error }}</div>
        <div class="pcard-actions">
          <router-link :to="`/users/${profile.id}`" class="pcard-btn">프로필 전체 보기</router-link>
          <button type="button" class="pcard-btn primary" v-if="!isMe" @click="sendMessage">쪽지 보내기</button>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.pcard-overlay{align-items:center;}
.pcard{position:relative; width:100%; max-width:380px; background:var(--bg-raise); border:1px solid var(--border); border-radius:18px; padding:22px; display:flex; flex-direction:column; gap:16px; box-shadow:0 20px 50px rgba(0,0,0,.5);}
.pcard-close{position:absolute; top:12px; right:12px; width:30px; height:30px; border-radius:8px; color:var(--text-dim); font-size:15px;}
.pcard-close:hover{color:var(--text); background:var(--panel-2);}
.pcard-empty{padding:30px 0; text-align:center; color:var(--text-dim); font-size:13px;}
.pcard-head{display:flex; align-items:center; gap:14px;}
.pcard-who{display:flex; flex-direction:column; gap:3px; min-width:0;}
.pcard-name{font-size:17px; font-weight:700; color:var(--text); display:flex; align-items:center; gap:6px; flex-wrap:wrap;}
.pcard-role{font-size:10.5px; color:var(--gold); border:1px solid var(--gold-dim); border-radius:999px; padding:1px 8px; font-weight:600;}
.pcard-seen{font-size:12.5px; color:var(--text-muted);}
.pcard-seen.on{color:#3ecf5a; font-weight:600;}
.pcard-joined{font-size:11.5px; color:var(--text-dim);}
.pcard-stats{display:grid; grid-template-columns:repeat(4, 1fr); gap:6px;}
.pcard-stats span{display:flex; flex-direction:column; align-items:center; gap:2px; padding:9px 4px; background:var(--panel); border:1px solid var(--border-soft); border-radius:12px;}
.pcard-stats b{font-size:15px; color:var(--gold);}
.pcard-stats small{font-size:10.5px; color:var(--text-dim); text-align:center;}
.pcard-section{display:flex; flex-direction:column; gap:6px;}
.pcard-title{font-size:12px; color:var(--gold-dim); font-weight:600;}
.pcard-row, .pcard-review{display:flex; align-items:center; gap:8px; padding:7px 10px; background:var(--panel); border:1px solid var(--border-soft); border-radius:10px; font-size:12.5px; color:var(--text-muted); min-width:0;}
a.pcard-row:hover{border-color:var(--gold-dim); color:var(--text);}
.pcard-row small, .pcard-review small{margin-left:auto; flex:none; font-size:11px; color:var(--text-dim); max-width:45%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.pcard-row-name{overflow:hidden; text-overflow:ellipsis; white-space:nowrap; min-width:0;}
.pcard-icon{width:22px; height:22px; flex:none; display:inline-flex; align-items:center; justify-content:center;}
.pcard-icon img{max-width:100%; max-height:100%; image-rendering:pixelated;}
.pcard-stars{color:var(--gold); flex:none; font-size:11px;}
.pcard-error{font-size:12px; color:#e0775f;}
.pcard-actions{display:flex; gap:8px;}
.pcard-btn{flex:1; text-align:center; padding:10px 12px; font-size:13px; border:1px solid var(--border); border-radius:10px; color:var(--text-muted);}
.pcard-btn:hover{border-color:var(--gold-dim); color:var(--gold);}
.pcard-btn.primary{background:var(--gold); border-color:var(--gold); color:#1a1408; font-weight:700;}
</style>
