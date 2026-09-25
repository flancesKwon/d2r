<script setup>
import HeaderNotifications from '../components/HeaderNotifications.vue'
import LogoMark from '../components/LogoMark.vue'
import { ref, computed } from 'vue'
import { dealsState, DEAL_STATUSES, sendDealMessage, updateDealStatus, addReview } from '../dealsStore.js'
import { getTradeItem } from '../tradeStore.js'
import { profileState } from '../profileStore.js'
import iconsData from '../data/icons.json'

const activeId = ref(dealsState.deals[0]?.id || null)
const activeDeal = computed(() => dealsState.deals.find((d) => d.id === activeId.value))
const draft = ref('')

function openDeal(id) {
  activeId.value = id
}

function iconUrlFor(iconKey) {
  const b64 = iconKey && iconsData[iconKey]
  return b64 ? 'data:image/png;base64,' + b64 : null
}
function dealIconUrl(deal) {
  const item = getTradeItem(deal.itemId)
  return item ? iconUrlFor(item.icon_key) : null
}

// 로그인이 없어서 지금 브라우저의 프로필 닉네임과 seller/buyer를 비교해서 "상대방"이
// 누구인지 판단함 - 닉네임을 아직 안 정했으면 판매자를 상대방으로 간주(임시 기본값)
function counterpartOf(deal) {
  if (!deal) return ''
  if (!profileState.nickname) return deal.seller
  return deal.seller === profileState.nickname ? deal.buyer : deal.seller
}

function submitMessage() {
  if (!draft.value.trim() || !activeId.value) return
  sendDealMessage(activeId.value, draft.value)
  draft.value = ''
}

function setStatus(status) {
  if (!activeId.value) return
  updateDealStatus(activeId.value, status)
}

const reviewRating = ref(5)
const reviewComment = ref('')
function submitReview() {
  if (!activeDeal.value) return
  addReview(activeDeal.value.id, {
    rating: reviewRating.value,
    comment: reviewComment.value,
    from: profileState.nickname || '익명',
    to: counterpartOf(activeDeal.value),
  })
  reviewComment.value = ''
  reviewRating.value = 5
}
</script>

<template>
  <div class="items-page deals-page">
  <header>
    <div class="logo">
      <router-link to="/" style="display: flex; align-items: center; gap: 8px; color: inherit">
        <LogoMark />디아허브
      </router-link>
    </div>
    <div class="crumb"><router-link to="/">메인</router-link> / <b>거래중인 품목</b></div>
    <HeaderNotifications />
  </header>

  <div class="patch-hero">
    <div class="patch-hero-inner">
      <div class="eyebrow">구매신청이 수락된 거래</div>
      <h1>거래중인 품목</h1>
      <p>구매신청이 수락되면 여기서 상대방과 세부사항을 조율하고, 거래완료·불발을 선택할 수 있어요. 거래가 끝나면 리뷰도 남길 수 있어요.</p>
    </div>
  </div>

  <div class="grid-wrap deals-wrap">
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
            <div class="deal-row-sub">{{ counterpartOf(d) }} · {{ d.date }}</div>
          </div>
        </button>
        <div class="empty-state" v-if="!dealsState.deals.length">아직 진행중인 거래가 없어요. 구매신청을 수락하면 여기에 생겨요.</div>
      </div>

      <div class="deal-thread" v-if="activeDeal">
        <div class="deal-thread-header">
          <div>
            <div class="deal-thread-title">{{ activeDeal.postTitle }}</div>
            <div class="deal-thread-sub">상대방: {{ counterpartOf(activeDeal) }}</div>
          </div>
          <div class="deal-status-actions" v-if="activeDeal.status === '거래중'">
            <button type="button" class="deal-action-btn done" @click="setStatus('거래완료')">거래완료</button>
            <button type="button" class="deal-action-btn fail" @click="setStatus('거래불발')">거래불발</button>
          </div>
          <span class="deal-status-badge" :class="'status-' + activeDeal.status" v-else>{{ activeDeal.status }}</span>
        </div>

        <div class="deal-thread-body">
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
            type="text" v-model="draft" placeholder="메시지를 입력하세요"
            class="write-input" @keydown.enter.prevent="submitMessage"
          />
          <button type="button" class="btn-primary conv-send-btn" @click="submitMessage">보내기</button>
        </div>

        <div class="review-box" v-if="activeDeal.status === '거래완료' && !activeDeal.review">
          <div class="d-section-title">{{ counterpartOf(activeDeal) }}님에게 리뷰 남기기</div>
          <div class="review-stars">
            <button
              type="button" v-for="n in 5" :key="n" class="star-btn"
              :class="{ filled: n <= reviewRating }" @click="reviewRating = n"
            >★</button>
          </div>
          <textarea v-model="reviewComment" class="review-textarea" rows="3" placeholder="거래는 어떠셨나요? (예: 약속 시간 잘 지켰어요, 친절해요)"></textarea>
          <button type="button" class="btn-primary review-submit-btn" @click="submitReview">리뷰 등록</button>
        </div>
        <div class="review-box review-done" v-else-if="activeDeal.review">
          <div class="d-section-title">남긴 리뷰</div>
          <div class="review-stars readonly">
            <span v-for="n in 5" :key="n" class="star-btn" :class="{ filled: n <= activeDeal.review.rating }">★</span>
          </div>
          <div class="review-comment-text">{{ activeDeal.review.comment }}</div>
        </div>
      </div>
      <div class="deal-thread deal-thread-empty" v-else>거래를 선택해주세요</div>
    </div>
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
</style>
