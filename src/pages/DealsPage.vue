<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { dealsState, loadDeals, loadDealMessages, sendDealMessage, updateDealStatus, addReview } from '../dealsStore.js'
import { getTradeItem } from '../tradeStore.js'
import { authState, signIn } from '../profileStore.js'
import { ITEM_ICONS } from '../itemIcons.js'

// 거래방 - 판매자·구매자만 보임. 알림 링크(/deals/:id)로 들어오면 그 거래를 바로 엶
const route = useRoute()
const activeId = ref(route.params.id ? Number(route.params.id) : null)
watch(() => route.params.id, (id) => { if (id) activeId.value = Number(id) })
const activeDeal = computed(() => dealsState.deals.find((d) => d.id === activeId.value) || null)
const draft = ref('')
const actionError = ref('')

loadDeals().catch(() => {})
watch(() => dealsState.deals.length, () => {
  if (!activeDeal.value && dealsState.deals.length) activeId.value = dealsState.deals[0].id
}, { immediate: true })

// 열린 거래방 메시지 - 5초마다 새로 받음 (창이 보일 때만)
let timer = 0
async function refreshMessages() {
  if (!activeDeal.value || document.hidden) return
  await loadDealMessages(activeDeal.value).catch(() => {})
}
watch(activeDeal, (d) => {
  clearInterval(timer)
  if (!d) return
  refreshMessages()
  timer = setInterval(refreshMessages, 5000)
}, { immediate: true })
onUnmounted(() => clearInterval(timer))

function openDeal(id) {
  activeId.value = id
}

function iconUrlFor(iconKey) {
  const url = iconKey && ITEM_ICONS[iconKey]
  return url || null
}
function dealIconUrl(deal) {
  const item = getTradeItem(deal.itemId)
  return item ? iconUrlFor(item.icon_key) : null
}

async function run(fn) {
  actionError.value = ''
  try {
    await fn()
  } catch (e) {
    actionError.value = e.message || '처리 실패'
  }
}

function submitMessage() {
  const text = draft.value.trim()
  if (!text || !activeDeal.value) return
  draft.value = ''
  return run(() => sendDealMessage(activeDeal.value, text))
}

function setStatus(status) {
  if (!activeDeal.value) return
  const label = status === '거래완료' ? '거래완료로 변경' : '거래불발로 변경'
  if (!confirm(label)) return
  return run(() => updateDealStatus(activeDeal.value, status))
}

const reviewRating = ref(5)
const reviewComment = ref('')
function submitReview() {
  if (!activeDeal.value) return
  return run(async () => {
    await addReview(activeDeal.value, { rating: reviewRating.value, comment: reviewComment.value })
    reviewComment.value = ''
    reviewRating.value = 5
  })
}
</script>

<template>
  <div class="items-page deals-page">

  <div class="patch-hero">
    <div class="patch-hero-inner">
      <div class="eyebrow">구매신청이 수락된 거래</div>
      <h1>거래중인 품목</h1>
    </div>
  </div>

  <div class="grid-wrap deals-wrap deals-login" v-if="!authState.user">
    <p>로그인 필요</p>
    <button type="button" class="btn-primary" @click="signIn">로그인</button>
  </div>
  <div class="grid-wrap deals-wrap" v-else>
    <div class="deals-layout">
      <div class="deal-list">
        <button
          type="button" class="deal-row" v-for="d in dealsState.deals" :key="d.id"
          :class="{ active: d.id === activeId }" @click="openDeal(d.id)"
        >
          <span class="deal-row-icon"><img v-if="dealIconUrl(d)" :src="dealIconUrl(d)" alt="" /></span>
          <div class="deal-row-body">
            <div class="deal-row-top">
              <span class="deal-row-title">{{ d.postTitle }}</span>
              <span class="deal-status-badge" :class="'status-' + d.status">{{ d.status }}</span>
            </div>
            <div class="deal-row-sub">{{ d.iAmSeller ? '구매자' : '판매자' }} {{ d.counterpart }} · {{ d.date }}</div>
          </div>
        </button>
        <div class="empty-state" v-if="!dealsState.deals.length">진행 중인 거래 없음 (구매신청 수락 시 생성)</div>
      </div>

      <div class="deal-thread" v-if="activeDeal">
        <div class="deal-thread-header">
          <div>
            <div class="deal-thread-title">{{ activeDeal.postTitle }}</div>
            <div class="deal-thread-sub">{{ activeDeal.iAmSeller ? '구매자' : '판매자' }}: {{ activeDeal.counterpart }} · <router-link :to="`/trade/${activeDeal.postId}`">판매글 보기</router-link></div>
          </div>
          <div class="deal-status-actions" v-if="activeDeal.status === '거래중'">
            <button type="button" class="deal-action-btn done" @click="setStatus('거래완료')">거래완료</button>
            <button type="button" class="deal-action-btn fail" @click="setStatus('거래불발')">거래불발</button>
          </div>
          <span class="deal-status-badge" :class="'status-' + activeDeal.status" v-else>{{ activeDeal.status }}</span>
        </div>

        <div class="deal-thread-body">
          <div class="deal-intro">구매신청 수락됨 - 접속 시간·배틀태그 등 조율</div>
          <div
            class="conv-bubble" v-for="m in activeDeal.messages" :key="m.id"
            :class="m.from === 'me' ? 'mine' : 'theirs'"
          >
            <div class="conv-bubble-text">{{ m.text }}</div>
            <div class="conv-bubble-date">{{ m.date }}</div>
          </div>
        </div>

        <div class="deal-thread-input" v-if="activeDeal.status === '거래중'">
          <input
            type="text" v-model="draft" placeholder="메시지"
            class="write-input" @keydown.enter.prevent="submitMessage"
          />
          <button type="button" class="btn-primary conv-send-btn" @click="submitMessage">보내기</button>
        </div>

        <div class="review-box" v-if="activeDeal.status === '거래완료' && !activeDeal.review">
          <div class="d-section-title">{{ activeDeal.counterpart }}님에게 리뷰 남기기</div>
          <div class="review-stars">
            <button
              type="button" v-for="n in 5" :key="n" class="star-btn"
              :class="{ filled: n <= reviewRating }" @click="reviewRating = n"
            >★</button>
          </div>
          <textarea v-model="reviewComment" class="review-textarea" rows="3" placeholder="거래 후기 (예: 약속 시간 잘 지킴)"></textarea>
          <button type="button" class="btn-primary review-submit-btn" @click="submitReview">리뷰 등록</button>
        </div>
        <div class="review-box review-done" v-else-if="activeDeal.review">
          <div class="d-section-title">{{ activeDeal.review.fromId === authState.user?.id ? '남긴 리뷰' : '받은 리뷰' }}</div>
          <div class="review-stars readonly">
            <span v-for="n in 5" :key="n" class="star-btn" :class="{ filled: n <= activeDeal.review.rating }">★</span>
          </div>
          <div class="review-comment-text">{{ activeDeal.review.comment }}</div>
        </div>
      </div>
      <div class="deal-thread deal-thread-empty" v-else>거래 선택</div>
    </div>
    <div class="action-error" v-if="actionError">{{ actionError }}</div>
  </div>
  </div>
</template>

<style scoped>
.deals-wrap{max-width:1180px;}
.deals-layout{display:grid; grid-template-columns:340px 1fr; gap:16px; align-items:start;}

.deal-list{display:flex; flex-direction:column; gap:8px; background:var(--panel); border:1px solid var(--border-soft); border-radius:16px; padding:10px;}
.deal-row{
  display:flex; align-items:center; gap:10px; padding:12px 14px; border-radius:12px; text-align:left;
  font-family:'Noto Sans KR', sans-serif;
}
.deal-row:hover{background:rgba(255,255,255,0.04);}
.deal-row.active{background:var(--panel-2); border:1px solid var(--gold-dim);}
.deal-row-icon{
  width:36px; height:36px; flex:none; display:flex; align-items:center; justify-content:center;
  background:var(--panel-2); border:1px solid var(--border-soft); border-radius:9px;
}
.deal-row-icon img{width:100%; height:100%; object-fit:contain; image-rendering:pixelated;}
.deal-row-body{flex:1; min-width:0;}
.deal-row-top{display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:4px;}
.deal-row-title{font-size:13px; color:var(--text); font-weight:600; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.deal-row-sub{font-size:11.5px; color:var(--text-dim);}

.deal-status-badge{font-size:10px; padding:2px 9px; border-radius:999px; border:1px solid var(--border); color:var(--text-dim); flex:none;}
.deal-status-badge.status-거래중{color:var(--teal); border-color:var(--teal);}
.deal-status-badge.status-거래완료{color:var(--gold); border-color:var(--gold-dim);}
.deal-status-badge.status-거래불발{color:var(--blood); border-color:var(--blood);}

.deal-thread{
  background:var(--panel); border:1px solid var(--border-soft); border-radius:16px; padding:20px 22px;
  display:flex; flex-direction:column; gap:16px; min-height:520px;
}
.deal-thread-empty{align-items:center; justify-content:center; color:var(--text-dim); font-size:13px;}
.deal-thread-header{display:flex; align-items:center; justify-content:space-between; gap:12px; border-bottom:1px solid var(--border-soft); padding-bottom:14px; flex-wrap:wrap;}
.deal-thread-title{font-family:'Noto Serif KR', serif; font-weight:700; font-size:15px;}
.deal-thread-sub{font-size:11.5px; color:var(--text-dim); margin-top:2px;}
.deal-status-actions{display:flex; gap:8px;}
.deal-action-btn{font-size:12px; padding:8px 16px; border-radius:999px; border:1px solid var(--border); color:var(--text-muted);}
.deal-action-btn.done:hover{border-color:var(--gold-dim); color:var(--gold);}
.deal-action-btn.fail:hover{border-color:var(--blood); color:var(--blood);}

.deal-thread-body{flex:1; display:flex; flex-direction:column; gap:10px; overflow-y:auto;}
.conv-bubble{max-width:70%; display:flex; flex-direction:column; gap:4px;}
.conv-bubble.theirs{align-self:flex-start;}
.conv-bubble.mine{align-self:flex-end; align-items:flex-end;}
.conv-bubble-text{font-size:13px; padding:10px 14px; border-radius:14px; line-height:1.6; background:var(--panel-2); color:var(--text);}
.conv-bubble.mine .conv-bubble-text{background:var(--gold-dim); color:#1c1712;}
.conv-bubble-date{font-size:10px; color:var(--text-dim);}

.deal-thread-input{display:flex; gap:8px;}
.deal-thread-input .write-input{flex:1;}
.write-input{
  background:var(--panel-2); border:1px solid var(--border); color:var(--text); font-size:13px;
  padding:11px 14px; font-family:'Noto Sans KR', sans-serif; border-radius:10px;
}
.conv-send-btn{padding:11px 20px; font-size:13px; border-radius:10px;}

.review-box{border-top:1px solid var(--border-soft); padding-top:16px; display:flex; flex-direction:column; gap:10px;}
.review-stars{display:flex; gap:4px;}
.star-btn{font-size:22px; color:var(--border); line-height:1;}
.star-btn.filled{color:var(--gold);}
.review-stars.readonly .star-btn{cursor:default;}
.review-textarea{
  background:var(--panel-2); border:1px solid var(--border); color:var(--text); font-size:13px;
  padding:11px 14px; font-family:'Noto Sans KR', sans-serif; resize:vertical; border-radius:10px;
}
.review-submit-btn{align-self:flex-start; padding:10px 20px; font-size:13px; border-radius:10px;}
.review-comment-text{font-size:13px; color:var(--text-muted); line-height:1.7;}

@media (max-width:760px){
  .deals-layout{grid-template-columns:minmax(0,1fr);}
  .deal-thread{min-height:360px; padding:16px;}
  .deal-thread-empty{min-height:160px;}
  .conv-bubble{max-width:85%;}
}
.deals-login{display:flex; flex-direction:column; align-items:center; gap:14px; padding:48px 16px; color:var(--text-muted); font-size:14px;}
.deal-intro{font-size:12px; color:var(--text-dim); text-align:center; padding:8px 12px; margin-bottom:6px;}
.deal-thread-sub a{color:var(--gold-dim);}
.action-error{font-size:12.5px; color:#e0775f; margin-top:10px;}
</style>
