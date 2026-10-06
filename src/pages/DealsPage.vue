<script setup>
import { openTradeGuide } from '../tradeGuide.js'
import { ref, computed, watch, onUnmounted, nextTick } from 'vue'
import { askConfirm } from '../dialog.js'
import { useRoute, useRouter } from 'vue-router'
import { dealsState, loadDeals, loadDealMessages, sendDealMessage, updateDealStatus, addReview } from '../dealsStore.js'
import { getTradeItem } from '../tradeStore.js'
import { authState, signIn } from '../profileStore.js'
import { markNotificationsReadFor, notificationsState } from '../notificationsStore.js'
import { ITEM_ICONS } from '../itemIcons.js'
import { useAutoRefresh } from '../useAutoRefresh.js'
import { realtimeTick } from '../realtime.js'
import UserAvatar from '../components/UserAvatar.vue'

// 거래방 (/deals/:id) - 판매자·구매자만 보임
// 왼쪽 거래 목록 / 가운데 채팅 / 오른쪽 거래 정보(단계·거래완료·불발·후기). 모바일은 목록 -> 거래 정보 -> 채팅
// 어느 방인지는 주소(/deals/번호)가 정함 - 판매글의 "거래방 열기"·알림 링크로 들어오면 그 방이 열림
const route = useRoute()
const router = useRouter()
const routeId = computed(() => (route.params.id ? Number(route.params.id) : null))
// 판매글에서 거래방 번호를 모를 때는 ?post=판매글번호&buyer=구매자 로 옴
const activeId = computed(() => {
  if (routeId.value) return routeId.value
  const post = Number(route.query.post)
  if (post) return dealsState.deals.find((d) => d.postId === post && (!route.query.buyer || d.buyerId === route.query.buyer))?.id || null
  return dealsState.deals[0]?.id || null
})
const activeDeal = computed(() => dealsState.deals.find((d) => d.id === activeId.value) || null)
const draft = ref('')
const actionError = ref('')

loadDeals().catch(() => {})

// 열린 거래방 메시지 (다른 탭을 보는 중이면 새 메시지 소리만, 읽음 처리는 안 함)
let timer = 0
// force: 거래방을 처음 열 때는 창이 안 보여도 불러옴
async function refreshMessages(force = false) {
  if (!activeDeal.value) return
  await loadDealMessages(activeDeal.value, { markRead: !document.hidden || force }).catch(() => {})
}
watch(() => activeDeal.value?.id, (id) => {
  clearInterval(timer)
  if (!id) return
  refreshMessages(true)
  timer = setInterval(() => refreshMessages(), 10000)
}, { immediate: true })
onUnmounted(() => clearInterval(timer))
// 거래방 새 메시지·읽음(1 사라짐)이 실시간으로 오면 바로 (주기 확인 10초는 실시간이 끊겼을 때용)
watch(() => realtimeTick.deal, () => refreshMessages())
// 목록에서 거래방을 열어도 이 거래방 알림(/deals/번호)은 읽음 (알림을 늦게 받아 와도)
watch(() => [activeId.value, notificationsState.items.length], ([id]) => { if (id) markNotificationsReadFor(`/deals/${id}`).catch(() => {}) }, { immediate: true })

// 대화창은 화면 높이에 고정, 새 메시지가 오면 맨 아래로 (위로 올려 읽는 중이면 그대로)
const bodyEl = ref(null)
let stick = true
const onScroll = (e) => { const el = e.target; stick = el.scrollHeight - el.scrollTop - el.clientHeight < 60 }
watch(() => [activeId.value, activeDeal.value?.messages.length], ([id], [prevId] = []) => {
  if (id !== prevId) stick = true
  if (!stick) return
  nextTick(() => { if (bodyEl.value) bodyEl.value.scrollTop = bodyEl.value.scrollHeight })
})

// 방 고르기 = 주소 바꾸기 (뒤로 가기·새로고침해도 그 방). 모바일은 거래 정보로 내려감
const infoEl = ref(null)
function openDeal(id) {
  router.replace(`/deals/${id}`)
  if (window.innerWidth <= 1000) nextTick(() => infoEl.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
}

const iconUrlFor = (iconKey) => (iconKey && ITEM_ICONS[iconKey]) || null
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

// 상대가 완료를 눌렀는지 등 거래 상태 (보통은 실시간, 이건 끊겼을 때용)
useAutoRefresh(() => loadDeals(), 15000)

// 거래완료는 두 사람 다 눌러야 완료 (한쪽만 누르고 3일 지나면 자동), 불발은 한 명이 눌러도 바로
async function setStatus(status) {
  const d = activeDeal.value
  if (!d) return
  const label = status === '거래불발'
    ? '거래불발 처리 - 판매글은 다시 판매중'
    : d.theirDoneAt
      ? '거래완료 - 상대도 완료를 눌러서 바로 끝남. 판매글도 거래완료, 후기 작성 가능'
      : `거래완료 - ${d.counterpart}님도 완료를 누르면 끝남 (안 누르면 3일 뒤 자동 완료)`
  if (!await askConfirm(label, status === '거래완료' ? { confirmText: '거래완료' } : undefined)) return
  return run(() => updateDealStatus(d, status))
}
// 남은 자동 완료 시간 (먼저 누른 쪽 기준 3일)
function autoLeft(d) {
  const first = [d.myDoneAt, d.theirDoneAt].filter(Boolean).sort()[0]
  if (!first) return ''
  const h = Math.max(0, Math.ceil((new Date(first).getTime() + 3 * 86400000 - Date.now()) / 3600000))
  return h >= 24 ? `${Math.floor(h / 24)}일 ${h % 24}시간` : `${h}시간`
}
const waitLabel = (d) => (d.status === '거래중' && (d.myDoneAt || d.theirDoneAt) ? '확인 대기' : d.status)

// 거래 단계 (수락 -> 거래중 -> 완료 확인 -> 거래완료/불발)
const steps = computed(() => {
  const d = activeDeal.value
  if (!d) return []
  const done = d.status === '거래완료'
  const failed = d.status === '거래불발'
  const confirming = d.status === '거래중' && (d.myDoneAt || d.theirDoneAt)
  return [
    { label: '구매신청 수락', state: 'done' },
    { label: '거래방에서 조율', state: done || failed || confirming ? 'done' : 'now' },
    { label: '두 사람 거래완료 확인', state: done ? 'done' : confirming ? 'now' : failed ? 'skip' : 'todo' },
    { label: failed ? '거래불발' : '거래완료 · 후기', state: done ? (d.myReview ? 'done' : 'now') : failed ? 'fail' : 'todo' },
  ]
})

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
      <!-- 1) 거래 목록 -->
      <div class="deal-list">
        <div class="deal-list-title">거래방 <span>{{ dealsState.deals.length }}</span></div>
        <button
          type="button" class="deal-row" v-for="d in dealsState.deals" :key="d.id"
          :class="{ active: d.id === activeId }" :aria-current="d.id === activeId ? 'page' : null" @click="openDeal(d.id)"
        >
          <span class="deal-row-icon"><img v-if="dealIconUrl(d)" :src="dealIconUrl(d)" alt="" /></span>
          <div class="deal-row-body">
            <div class="deal-row-top">
              <span class="deal-row-title">{{ d.postTitle }}</span>
              <span class="deal-status-badge" :class="'status-' + waitLabel(d)">{{ waitLabel(d) }}</span>
            </div>
            <div class="deal-row-sub">{{ d.iAmSeller ? '구매자' : '판매자' }} {{ d.counterpart }} · {{ d.date }}</div>
          </div>
        </button>
        <div class="empty-state" v-if="!dealsState.deals.length">진행 중인 거래 없음 (구매신청 수락 시 생성)</div>
      </div>

      <!-- 2) 채팅 -->
      <div class="deal-thread" v-if="activeDeal">
        <div class="deal-thread-header">
          <UserAvatar :src="activeDeal.counterpartAvatar" :name="activeDeal.counterpart" :size="36" :user-id="activeDeal.counterpartId" />
          <div class="deal-thread-who">
            <div class="deal-thread-title"><router-link :to="'/users/' + activeDeal.counterpartId">{{ activeDeal.counterpart }}</router-link>님과의 거래방</div>
            <div class="deal-thread-sub">{{ activeDeal.postTitle }} · 상대는 {{ activeDeal.iAmSeller ? '구매자' : '판매자' }}</div>
          </div>
          <span class="deal-status-badge big" :class="'status-' + waitLabel(activeDeal)">{{ waitLabel(activeDeal) }}</span>
        </div>

        <div class="deal-thread-body" ref="bodyEl" @scroll="onScroll">
          <div class="deal-intro">구매신청 수락됨 - 접속 시간·배틀태그 등 조율<br><small>7일 동안 대화가 없으면 자동 거래불발 · 한쪽만 거래완료를 누르면 3일 뒤 자동 완료 · <button type="button" class="guide-link" @click="openTradeGuide('flow')">거래 진행 안내</button></small></div>
          <div
            class="conv-bubble" v-for="m in activeDeal.messages" :key="m.id"
            :class="m.from === 'me' ? 'mine' : 'theirs'"
          >
            <div class="conv-bubble-text">{{ m.text }}</div>
            <div class="conv-bubble-date"><span class="conv-unread" v-if="m.from === 'me' && !m.readAt" title="상대가 아직 안 읽음">1</span>{{ m.date }}</div>
          </div>
        </div>

        <div class="deal-thread-input" v-if="activeDeal.status === '거래중'">
          <input
            type="text" v-model="draft" placeholder="메시지"
            class="write-input" @keydown.enter.prevent="submitMessage"
          />
          <button type="button" class="btn-primary conv-send-btn" @click="submitMessage">보내기</button>
        </div>
        <div class="deal-closed" v-else>{{ activeDeal.status }} - 대화 종료</div>
      </div>
      <div class="deal-thread deal-thread-empty" v-else>거래 선택</div>

      <!-- 3) 거래 정보 (단계·거래 결과·후기) -->
      <aside class="deal-info" v-if="activeDeal" ref="infoEl">
        <section class="info-card">
          <div class="info-title">거래 정보</div>
          <router-link :to="`/trade/${activeDeal.postId}`" class="info-item">
            <span class="info-item-icon"><img v-if="dealIconUrl(activeDeal)" :src="dealIconUrl(activeDeal)" alt="" /></span>
            <span class="info-item-name">{{ activeDeal.postTitle }}<small>판매글 보기 →</small></span>
          </router-link>
          <div class="info-line"><span>{{ activeDeal.iAmSeller ? '구매자' : '판매자' }}</span><router-link :to="'/users/' + activeDeal.counterpartId">{{ activeDeal.counterpart }} · 프로필</router-link></div>
          <div class="info-line" v-if="activeDeal.agreedPrice"><span>거래가</span><b>{{ activeDeal.agreedPrice }}</b></div>
          <div class="info-line"><span>시작</span><b>{{ activeDeal.date }}</b></div>
        </section>

        <section class="info-card steps-card">
          <div class="info-title">진행 단계</div>
          <ol class="steps">
            <li v-for="(s, i) in steps" :key="i" :class="s.state"><span class="dot">{{ s.state === 'done' ? '✓' : s.state === 'fail' ? '✕' : i + 1 }}</span>{{ s.label }}</li>
          </ol>
        </section>

        <!-- 거래 결과: 거래완료 = 금색, 거래불발 = 빨간 테두리 -->
        <section class="info-card result" v-if="activeDeal.status === '거래중'" :class="{ waiting: activeDeal.myDoneAt, asked: !activeDeal.myDoneAt && activeDeal.theirDoneAt }">
          <div class="info-title">거래 결과</div>
          <p class="result-msg" v-if="activeDeal.myDoneAt"><b>✓ 거래완료 누름</b><br>{{ activeDeal.counterpart }}님 확인 대기 · {{ autoLeft(activeDeal) }} 뒤 자동 완료</p>
          <p class="result-msg" v-else-if="activeDeal.theirDoneAt"><b>{{ activeDeal.counterpart }}님이 거래완료 누름</b><br>받았으면 거래완료 · {{ autoLeft(activeDeal) }} 뒤 자동 완료</p>
          <p class="result-msg" v-else>거래가 끝나면 두 사람 모두 거래완료</p>
          <button type="button" class="deal-action-btn done" v-if="!activeDeal.myDoneAt" @click="setStatus('거래완료')">✓ 거래완료</button>
          <button type="button" class="deal-action-btn fail" @click="setStatus('거래불발')">✕ 거래불발</button>
        </section>

        <!-- 후기: 두 사람이 각자 하나씩 -->
        <section class="info-card review" v-if="activeDeal.status === '거래완료' && !activeDeal.myReview">
          <div class="info-title">{{ activeDeal.counterpart }}님 후기 남기기</div>
          <div class="review-stars">
            <button
              type="button" v-for="n in 5" :key="n" class="star-btn"
              :class="{ filled: n <= reviewRating }" @click="reviewRating = n"
            >★</button>
          </div>
          <textarea v-model="reviewComment" class="review-textarea" rows="3" placeholder="거래 후기 (예: 약속 시간 잘 지킴)"></textarea>
          <button type="button" class="btn-primary review-submit-btn" @click="submitReview">후기 등록</button>
        </section>
        <template v-for="(rv, ri) in [activeDeal.myReview, activeDeal.theirReview]" :key="ri">
          <section class="info-card" v-if="rv">
            <div class="info-title">{{ rv === activeDeal.myReview ? '남긴 후기' : '받은 후기' }}</div>
            <div class="review-stars readonly">
              <span v-for="n in 5" :key="n" class="star-btn" :class="{ filled: n <= rv.rating }">★</span>
            </div>
            <div class="review-comment-text" v-if="rv.comment">{{ rv.comment }}</div>
          </section>
        </template>
        <div class="action-error" v-if="actionError">{{ actionError }}</div>
      </aside>
    </div>
  </div>
  </div>
</template>

<style scoped>
.deals-wrap{max-width:1440px;}
.deals-layout{display:grid; grid-template-columns:300px minmax(0, 1fr) 300px; gap:16px; align-items:start;}

.deal-list{display:flex; flex-direction:column; gap:6px; background:var(--panel); border:1px solid var(--border-soft); border-radius:16px; padding:10px; max-height:min(620px, 75vh); overflow-y:auto; overscroll-behavior:contain; scrollbar-width:thin; scrollbar-color:var(--gold-dim) transparent;}
.deal-list-title{font-size:12.5px; color:var(--text-dim); padding:4px 6px 6px;}
.deal-list-title span{color:var(--gold); margin-left:4px;}
.deal-row{
  display:flex; align-items:center; gap:10px; padding:12px 14px; border-radius:12px; text-align:left;
  font-family:'Noto Sans KR', sans-serif; border:1px solid transparent; position:relative;
}
.deal-row:hover{background:rgba(255,255,255,0.04);}
/* 지금 열린 방: 금색 테두리 + 왼쪽 막대 */
.deal-row.active{background:rgba(200,163,77,0.1); border-color:var(--gold-dim);}
.deal-row.active::before{content:''; position:absolute; left:-1px; top:10px; bottom:10px; width:3px; border-radius:3px; background:var(--gold);}
.deal-row.active .deal-row-title{color:var(--gold);}
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
.deal-status-badge[class*="확인"]{color:var(--gold); border-color:var(--gold-dim);}
.deal-status-badge.big{font-size:12px; padding:4px 12px;}

.deal-thread{
  background:var(--panel); border:1px solid var(--border-soft); border-radius:16px; padding:18px 20px;
  display:flex; flex-direction:column; gap:14px; height:clamp(460px, calc(100dvh - 240px), 860px);
}
.deal-thread-empty{align-items:center; justify-content:center; color:var(--text-dim); font-size:13px;}
.deal-thread-header{display:flex; align-items:center; gap:12px; border-bottom:1px solid var(--border-soft); padding-bottom:14px;}
.deal-thread-who{flex:1; min-width:0;}
.deal-thread-title{font-family:'Noto Serif KR', serif; font-weight:700; font-size:16px;}
.deal-thread-title a{color:var(--gold);}
.deal-thread-sub{font-size:12px; color:var(--text-dim); margin-top:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}

.deal-thread-body{flex:1; min-height:0; display:flex; flex-direction:column; gap:10px; overflow-y:auto; padding-right:4px;}
.conv-bubble{max-width:70%; display:flex; flex-direction:column; gap:4px;}
.conv-bubble.theirs{align-self:flex-start;}
.conv-bubble.mine{align-self:flex-end; align-items:flex-end;}
.conv-bubble-text{font-size:13px; padding:10px 14px; border-radius:14px; line-height:1.6; background:var(--panel-2); color:var(--text);}
.conv-bubble.mine .conv-bubble-text{background:var(--gold-dim); color:#1c1712;}
.conv-bubble-date{font-size:10px; color:var(--text-dim); display:flex; align-items:center; gap:6px;}
.conv-unread{color:var(--gold); font-weight:700; font-size:11px;}
.deal-intro{font-size:12px; color:var(--text-dim); text-align:center; padding:8px 12px; margin-bottom:6px;}
.deal-closed{font-size:12.5px; color:var(--text-dim); text-align:center; padding:10px; border-top:1px solid var(--border-soft);}

.deal-thread-input{display:flex; gap:8px;}
.deal-thread-input .write-input{flex:1;}
.write-input{
  background:var(--panel-2); border:1px solid var(--border); color:var(--text); font-size:13px;
  padding:11px 14px; font-family:'Noto Sans KR', sans-serif; border-radius:10px;
}
.conv-send-btn{padding:11px 20px; font-size:13px; border-radius:10px;}

/* 거래 정보 칸 */
.deal-info{display:flex; flex-direction:column; gap:12px; position:sticky; top:72px;}
.info-card{background:var(--panel); border:1px solid var(--border-soft); border-radius:16px; padding:16px 18px; display:flex; flex-direction:column; gap:10px;}
.info-title{font-family:'Noto Serif KR', serif; font-weight:700; font-size:14.5px;}
.info-item{display:flex; align-items:center; gap:10px; padding:10px; border:1px solid var(--border-soft); border-radius:12px; background:var(--panel-2);}
.info-item:hover{border-color:var(--gold-dim);}
.info-item-icon{width:40px; height:40px; flex:none; display:flex; align-items:center; justify-content:center;}
.info-item-icon img{max-width:100%; max-height:100%; image-rendering:pixelated;}
.info-item-name{display:flex; flex-direction:column; font-size:13.5px; font-weight:600; color:var(--text); min-width:0;}
.info-item-name small{font-size:11.5px; font-weight:400; color:var(--gold-dim);}
.info-line{display:flex; justify-content:space-between; gap:10px; font-size:12.5px; color:var(--text-dim);}
.info-line a{color:var(--gold-dim);}
.info-line b{color:var(--text-muted); font-weight:500;}

.steps{list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:8px;}
.steps li{display:flex; align-items:center; gap:10px; font-size:13px; color:var(--text-dim);}
.steps .dot{width:22px; height:22px; flex:none; border-radius:999px; border:1px solid var(--border); display:flex; align-items:center; justify-content:center; font-size:11px;}
.steps li.done{color:var(--text-muted);}
.steps li.done .dot{background:var(--gold-dim); border-color:var(--gold-dim); color:#1a1408;}
.steps li.now{color:var(--gold); font-weight:700;}
.steps li.now .dot{border-color:var(--gold); color:var(--gold); box-shadow:0 0 0 3px rgba(200,163,77,0.18);}
.steps li.fail{color:#e0775f;}
.steps li.fail .dot{border-color:var(--blood); color:#e0775f;}
.steps li.skip{opacity:.4; text-decoration:line-through;}

.info-card.result{border-color:var(--border);}
.info-card.result.waiting{border-color:var(--teal);}
.info-card.result.waiting b{color:var(--teal);}
.info-card.result.asked{border-color:var(--gold); background:rgba(200,163,77,0.1);}
.info-card.result.asked b{color:var(--gold);}
.result-msg{margin:0; font-size:12.5px; color:var(--text-muted); line-height:1.6;}
.result-msg b{color:var(--text);}
.deal-action-btn{width:100%; font-size:14px; font-weight:700; padding:12px 0; border-radius:10px; border:1px solid var(--border); color:var(--text-muted);}
.deal-action-btn.done{background:var(--gold); border-color:var(--gold); color:#1a1408;}
.deal-action-btn.done:hover{filter:brightness(1.08);}
.deal-action-btn.fail{border-color:var(--blood); color:#e0775f;}
.deal-action-btn.fail:hover{background:rgba(162,81,63,0.15);}

.info-card.review{border-color:var(--gold-dim);}
.review-stars{display:flex; gap:4px;}
.star-btn{font-size:22px; color:var(--border); line-height:1;}
.star-btn.filled{color:var(--gold);}
.review-stars.readonly .star-btn{cursor:default;}
.review-textarea{
  background:var(--panel-2); border:1px solid var(--border); color:var(--text); font-size:13px;
  padding:11px 14px; font-family:'Noto Sans KR', sans-serif; resize:vertical; border-radius:10px;
}
.review-submit-btn{padding:10px 20px; font-size:13px; border-radius:10px;}
.review-comment-text{font-size:13px; color:var(--text-muted); line-height:1.7;}

/* 중간 화면: 목록 | (거래 정보 카드 가로로 -> 채팅) */
@media (max-width:1180px){
  .deals-layout{grid-template-columns:260px minmax(0, 1fr);}
  .deal-list{grid-row:1 / span 2;}
  .deal-info{grid-column:2; grid-row:1; position:static; display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); align-items:stretch;}
  .deal-info .action-error{grid-column:1 / -1;}
  .deal-thread, .deal-thread-empty{grid-column:2; grid-row:2;}
}
/* 모바일: 목록 -> 거래 정보(단계 빼고) -> 채팅 */
@media (max-width:760px){
  .deals-layout{grid-template-columns:minmax(0, 1fr);}
  .deal-list, .deal-info, .deal-thread, .deal-thread-empty{grid-column:auto; grid-row:auto;}
  .deal-list{order:1;}
  .deal-info{order:2; grid-template-columns:minmax(0, 1fr); scroll-margin-top:64px;}
  .deal-thread, .deal-thread-empty{order:3;}
  .info-card.steps-card{display:none;}
  .deal-thread{height:calc(100dvh - 150px); min-height:400px; padding:16px;}
  .deal-thread-empty{height:auto; min-height:160px;}
  .conv-bubble{max-width:85%;}
}
.deals-login{display:flex; flex-direction:column; align-items:center; gap:14px; padding:48px 16px; color:var(--text-muted); font-size:14px;}
.action-error{font-size:12.5px; color:#e0775f;}
.guide-link{font-size:inherit; color:var(--gold-dim); text-decoration:underline; text-underline-offset:3px;}
</style>
