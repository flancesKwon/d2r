<script setup>
import { ref, computed, watch } from 'vue'
import { useAutoRefresh } from '../useAutoRefresh.js'
import { askConfirm } from '../dialog.js'
import { useRoute, useRouter } from 'vue-router'
import {
  getTradePost, fetchTradePost, SALE_HOURS, saleLeftMs, countTradeView, fetchTradeRequests, addTradeRequest, respondToRequest, updateTradeStatus, deleteTradePost,
  getTradeItem, TRADE_STATUSES, parsePriceTokens, searchAllItems, postIconKey, postRarity, isCurrencyItem,
} from '../tradeStore.js'
import { renderContent } from '../richText.js'
import { ITEM_ICONS } from '../itemIcons.js'
import { isFavorite, toggleFavorite } from '../tradeFavorites.js'
import { authState, signIn, isStaff } from '../profileStore.js'
import { openConversationWith } from '../messagesStore.js'
import { dealsState, loadDeals } from '../dealsStore.js'
import ItemTooltipCanvas from '../components/ItemTooltipCanvas.vue'
import ReportButton from '../components/ReportButton.vue'
import UserAvatar from '../components/UserAvatar.vue'
import { avatarSrc } from '../avatars.js'
import { buildTooltip } from '../itemTooltip.js'
import { useNow } from '../useNow.js'

const route = useRoute()
const router = useRouter()
// 판매글 (목록에서 받아둔 게 있으면 바로 보여주고 DB에서 최신으로) + 구매신청(당사자만)
const post = ref(getTradePost(route.params.id) || null)
watch(post, (p) => { if (p) document.title = `${p.itemName} — 거래게시판 — 디아허브` }, { immediate: true, flush: 'post' })
const loading = ref(!post.value)
const actionError = ref('')
async function load() {
  actionError.value = ''
  try {
    const fresh = await fetchTradePost(route.params.id)
    post.value = fresh
    if (fresh) {
      // 화면이 쓰는 건 post.value (반응형) - 원본 객체(fresh)를 고치면 화면이 안 바뀌어서 구매신청이 안 보였음
      if (await countTradeView(fresh.id)) post.value.views++
      post.value.requests = await fetchTradeRequests(fresh.id).catch(() => [])
    }
  } catch (e) {
    // 네트워크 오류면 받아둔 글을 그대로 둠
  } finally {
    loading.value = false
  }
}
watch(() => route.params.id, () => { post.value = getTradePost(route.params.id) || null; loading.value = !post.value; load() }, { immediate: true })
watch(() => authState.user?.id, () => { if (post.value) load() })
async function refreshQuiet() {
  const id = route.params.id
  const fresh = await fetchTradePost(id)
  if (!fresh || String(route.params.id) !== String(id)) return
  fresh.requests = await fetchTradeRequests(fresh.id).catch(() => post.value?.requests || [])
  fresh.views = Math.max(fresh.views || 0, post.value?.views || 0)
  post.value = fresh
}
useAutoRefresh(refreshQuiet)
// 판매자 본인만 상태 변경·수락/거절 버튼 - 실제 차단은 RLS·DB 함수
// (예전엔 관리자에게도 보여서, 관리자 계정으로 구매신청하면 내 신청에 수락/거절이 뜨고 "신청 취소"가 가려졌음)
const isOwner = computed(() => !!authState.user && post.value?.authorId === authState.user.id)
const canManage = isOwner
// 운영진은 상태 변경은 못 하고 삭제만 (DB 정책 d2r_staff_delete)
const canDelete = computed(() => isOwner.value || isStaff())
async function run(fn) {
  actionError.value = ''
  if (!authState.user) return signIn()
  try {
    await fn()
  } catch (e) {
    actionError.value = e.message || '처리 실패'
  }
}
const contentHtml = computed(() => (post.value ? renderContent(post.value.content) : ''))
const linkedItem = computed(() => (post.value ? getTradeItem(post.value.itemId) : null))

// 게임 툴팁 모양 아이템 카드 (이미지로 저장 가능)
const tooltipCanvas = ref(null)
const tooltip = computed(() =>
  buildTooltip({
    item: linkedItem.value,
    name: post.value?.itemName,
    category: post.value?.category,
    quality: post.value?.quality,
    iconKey: post.value ? postIconKey(post.value) : null,
    options: post.value?.options || [],
    ethereal: post.value?.ethereal,
    amountLabel: post.value?.amountLabel,
  })
)

function iconUrlFor(iconKey) {
  const url = iconKey && ITEM_ICONS[iconKey]
  return url || null
}

function rarityClass(item) {
  return item ? item.category : ''
}

const reqQty = ref(1)
const reqMessage = ref('')
const showRequestSent = ref(false)

function submitRequest() {
  if (!reqMessage.value.trim()) return
  return run(async () => {
    const r = await addTradeRequest(post.value.id, { qty: reqQty.value, message: reqMessage.value.trim() })
    post.value.requests.push(r)
    reqQty.value = 1
    reqMessage.value = ''
    showRequestSent.value = true
    setTimeout(() => (showRequestSent.value = false), 2500)
  })
}

// 판매 기간 카운트다운 (올린 때부터 48시간) - 끝나면 목록에서 내려가고, 판매자는 판매가만 고쳐 재등록
const now = useNow(1000)
const saleLeft = computed(() => saleLeftMs(post.value, now.value))
const saleExpired = computed(() => saleLeft.value !== null && saleLeft.value <= 0)
const saleClock = computed(() => {
  const ms = saleLeft.value
  if (ms === null || ms <= 0) return ''
  const t = Math.floor(ms / 1000)
  const p = (n) => String(n).padStart(2, '0')
  const d = Math.floor(t / 86400)
  return `${d ? d + '일 ' : ''}${p(Math.floor((t % 86400) / 3600))}:${p(Math.floor((t % 3600) / 60))}:${p(t % 60)}`
})
const salePct = computed(() => (saleLeft.value === null ? 0 : Math.max(0, Math.min(100, (saleLeft.value / (SALE_HOURS * 3600000)) * 100))))
// 거래완료된 글: 상태 변경·삭제 없음 (거래내역·후기가 이 글을 가리킴)
const isDone = computed(() => post.value?.status === '거래완료')

function setStatus(status) {
  return run(async () => {
    const p = await updateTradeStatus(post.value.id, status)
    post.value.status = p.status
  })
}
// 판매자에게 쪽지 - 대화방을 열고(없으면 만들고) 쪽지함으로
function messageSeller() {
  return run(async () => {
    const convId = await openConversationWith(post.value.authorId)
    router.push({ path: '/messages', query: { c: convId } })
  })
}
async function removePost() {
  if (!await askConfirm('판매글 삭제 - 되돌릴 수 없음')) return
  await run(async () => {
    await deleteTradePost(post.value.id)
    router.replace('/trade')
  })
}

// 희망 가격 "베르 룬 1개 + 미라의 눈물"을 항목별 칩으로 (룬·보석이면 아이콘과 함께)
const priceParts = computed(() =>
  (post.value?.price || '')
    .split(/\s*\+\s*/)
    .filter(Boolean)
    .map((part) => ({ text: part, item: parsePriceTokens(part).find((t) => t.item)?.item || null }))
)

// 판매자 연락처 복사
const copied = ref(false)
async function copyContact() {
  try {
    await navigator.clipboard.writeText(post.value.contact)
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch {
    // 클립보드 권한이 없는 환경 - 연락처는 화면에 그대로 보이니 무시
  }
}

const RESPOND_CONFIRM = {
  accepted: (r) => `${r.buyer}님 구매신청 수락 - 수락하면 거래방이 열리고 판매글은 예약중으로 바뀜`,
  declined: (r) => `${r.buyer}님 구매신청 거절 - 신청자에게 거절 알림이 감`,
  cancelled: () => '구매신청 취소',
}
async function respond(r, decision) {
  if (!await askConfirm(RESPOND_CONFIRM[decision](r), decision === 'accepted' ? { confirmText: '수락' } : undefined)) return
  return run(async () => {
    const dealId = await respondToRequest(post.value, r, decision)
    // 수락하면 거래방이 열림 - 그 거래방으로 바로
    if (dealId) { await loadDeals().catch(() => {}); router.push(`/deals/${dealId}`) }
  })
}

// 판매자: 대기 중인 구매신청 수 (제목 아래 배너) / 수락된 신청의 거래방
const pendingCount = computed(() => (post.value?.requests || []).filter((r) => (r.status || 'pending') === 'pending').length)
const requestsEl = ref(null)
const scrollToRequests = () => requestsEl.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
const dealFor = (r) => dealsState.deals.find((d) => d.postId === post.value?.id && d.buyerId === r.buyerId) || null

const REQUEST_STATUS_LABEL = { pending: '대기중', accepted: '수락됨', declined: '거절됨', cancelled: '취소됨', failed: '불발', done: '거래완료' }
// 수락했지만 거래방에서 거래불발이 된 신청은 '불발' (거래방 열기 버튼 없음)
// 거래완료된 신청은 '거래완료' (역시 거래방 열기 없음)
const DEAL_TO_REQ = { 거래불발: 'failed', 거래완료: 'done' }
const reqStatus = (r) => (r.status === 'accepted' && DEAL_TO_REQ[dealFor(r)?.status]) || r.status || 'pending'
const REQUEST_KIND_LABEL = { buy_now: '구매하기', inquiry: '문의' }

// "구매하기" 팝업 흐름: 흥정 가능한 글이면 룬/보석 제안 선택 단계(offer)를 거치고,
// 아니면 바로 확인 단계(confirm)로 감. 어느 쪽이든 마지막엔 판매 아이템 + 제안
// 내역을 보여주는 확인 팝업으로 끝남
const showBuyModal = ref(false)
const buyStep = ref('offer')
const offerItems = ref([])
const offerQuery = ref('')
const showOfferDropdown = ref(false)
const showBuySentToast = ref(false)
const offerCandidates = computed(() => {
  if (!offerQuery.value.trim()) return []
  return searchAllItems(offerQuery.value).filter(isCurrencyItem)
})

function openBuyModal() {
  if (!authState.user) return signIn()
  offerItems.value = []
  offerQuery.value = ''
  showOfferDropdown.value = false
  buyStep.value = post.value.negotiable ? 'offer' : 'confirm'
  showBuyModal.value = true
}
function closeBuyModal() {
  showBuyModal.value = false
}
function pickOfferItem(it) {
  const existing = offerItems.value.find((o) => o.item.id === it.id)
  if (existing) existing.qty += 1
  else offerItems.value.push({ item: it, qty: 1 })
  offerQuery.value = ''
  showOfferDropdown.value = false
}
function removeOfferItem(i) {
  offerItems.value.splice(i, 1)
}
function hideOfferDropdownSoon() {
  window.setTimeout(() => (showOfferDropdown.value = false), 150)
}
function goToConfirm() {
  if (post.value.negotiable && !offerItems.value.length) return
  buyStep.value = 'confirm'
}
async function confirmBuy() {
  await run(async () => {
    const r = await addTradeRequest(post.value.id, {
      qty: 1,
      // 제안 내용은 메시지 한 줄로 저장 (보여줄 때 칩으로 다시 만듦)
      message: post.value.negotiable
        ? `구매하기 - 제안: ${offerItems.value.map((o) => `${o.item.name_ko} ${o.qty}개`).join(' + ')}`
        : '구매하기 (즉시 구매 신청)',
    })
    post.value.requests.push(r)
    showBuySentToast.value = true
    setTimeout(() => (showBuySentToast.value = false), 2500)
  })
  showBuyModal.value = false
}
</script>

<template>
  <div class="items-page trade-detail-page" v-if="post">

  <div class="grid-wrap trade-detail-wrap">
    <!-- 제목 영역: 분류·서버 칩, 아이콘 + 이름 + 뱃지, 작성 정보, 찜 -->
    <div class="post-head">
      <div class="post-chips">
        <router-link class="post-chip cat" :to="{ path: '/trade' }">{{ post.category }}</router-link>
        <span class="post-chip">{{ post.realm }}</span>
        <span class="post-chip">{{ post.ladder }}</span>
        <span class="post-chip">{{ post.hardcore }}</span>
      </div>
      <div class="trade-title-line">
        <span class="trade-title-icon" v-if="postIconKey(post)" :class="postRarity(post)">
          <img :src="iconUrlFor(postIconKey(post))" alt="" />
        </span>
        <div class="title-block">
          <h1 class="d-name trade-post-title">{{ post.itemName }}</h1>
          <div class="title-badges">
            <span class="status-pill" :class="saleExpired ? 'status-만료' : 'status-' + post.status">{{ saleExpired ? '기간 만료' : post.status }}</span>
            <span class="ethereal-badge" v-if="post.ethereal">에테리얼</span>
            <span class="unid-badge" v-if="post.unidentified">미확인</span>
            <span class="negotiable-badge" v-if="post.negotiable">흥정 가능</span>
          </div>
        </div>
        <button
          type="button" class="favorite-star" :class="{ active: isFavorite(post.id) }"
          :title="isFavorite(post.id) ? '찜 해제' : '찜하기'" :aria-label="isFavorite(post.id) ? '찜 해제' : '찜하기'"
          @click="toggleFavorite(post.id)"
        >{{ isFavorite(post.id) ? '★' : '☆' }}</button>
      </div>
      <div class="trade-post-meta">
        {{ post.author }} · {{ post.date }} 등록 · 조회 {{ post.views }} ·
        <router-link class="history-link" :to="{ path: '/trade/history', query: post.itemId ? { item: post.itemId } : { name: post.itemName } }">이 아이템 거래내역</router-link>
      </div>
    </div>

    <!-- 판매 기간 (판매중일 때만) -->
    <div class="sale-timer" v-if="saleLeft !== null" :class="{ expired: saleExpired, soon: !saleExpired && saleLeft < 6 * 3600000 }">
      <template v-if="!saleExpired">
        <span class="sale-timer-label">판매 종료까지</span>
        <b class="sale-timer-clock">{{ saleClock }}</b>
        <span class="sale-timer-bar"><span :style="{ width: salePct + '%' }"></span></span>
      </template>
      <template v-else>
        <span class="sale-timer-label">판매 기간 만료 · 목록에서 내려감</span>
        <router-link v-if="isOwner" class="sale-relist-btn" :to="`/trade/${post.id}/relist`">재등록 →</router-link>
      </template>
    </div>

    <button type="button" class="pending-banner" v-if="canManage && pendingCount" @click="scrollToRequests">
      <span class="pending-dot"></span>
      <b>대기 중인 구매신청 {{ pendingCount }}건</b>
      <span class="pending-go">수락·거절하러 가기 ↓</span>
    </button>

    <div class="post-layout">
      <!-- 왼쪽: 아이템 이미지 + 판매자 설명 -->
      <div class="post-left">
        <section class="item-panel">
          <ItemTooltipCanvas ref="tooltipCanvas" :tooltip="tooltip" :file-name="post.itemName" />
          <div class="item-panel-foot">
            <button type="button" class="tooltip-save-btn" @click="tooltipCanvas?.download()">이미지로 저장</button>
          </div>
        </section>

        <section class="side-card desc-card" v-if="post.content && post.content.trim()">
          <div class="card-title">판매자 설명</div>
          <div class="trade-post-content rich-content" v-html="contentHtml"></div>
        </section>
      </div>

      <!-- 오른쪽: 가격·구매 / 판매자 / 판매자 전용 (넓은 화면에선 스크롤해도 따라옴) -->
      <aside class="post-side">
        <section class="side-card price-card">
          <div class="card-title">희망 가격</div>
          <div class="price-parts">
            <span class="price-part" v-for="(p, i) in priceParts" :key="i">
              <span class="price-part-icon" :class="{ empty: !p.item }"><img v-if="p.item && iconUrlFor(p.item.icon_key)" :src="iconUrlFor(p.item.icon_key)" alt="" /></span>
              <span class="price-part-text">{{ p.text }}</span>
              <span class="price-or" v-if="i < priceParts.length - 1">+</span>
            </span>
          </div>
          <div class="price-meta">
            <span>수량 <b>{{ post.amountLabel }}</b></span>
            <span v-if="post.negotiable" class="nego">흥정 가능</span>
          </div>
          <button
            type="button" class="btn-primary buy-now-btn" :disabled="post.status === '거래완료' || isOwner"
            @click="openBuyModal"
          >{{ isOwner ? '내 판매글' : post.status === '거래완료' ? '거래 완료된 글' : post.negotiable ? '구매하기 · 가격 제안' : '구매하기' }}</button>
          <p class="buy-now-hint">{{ post.negotiable ? '룬·보석·재료로 가격 제안 가능' : '가격 그대로 즉시 구매 신청' }}</p>
        </section>

        <section class="side-card seller-card">
          <div class="card-title">판매자</div>
          <div class="seller-row">
            <span class="seller-avatar" aria-hidden="true"><img v-if="avatarSrc(post.avatar)" :src="avatarSrc(post.avatar)" alt="" /><template v-else>{{ (post.author || '?').slice(0, 1) }}</template></span>
            <div class="seller-name-block">
              <router-link :to="'/users/' + post.authorId" class="seller-name user-link">{{ post.author }}</router-link>
              <div class="seller-sub">{{ post.realm }} · {{ post.ladder }} · {{ post.hardcore }}</div>
              <router-link :to="'/users/' + post.authorId" class="seller-profile-link">프로필·받은 리뷰 보기 →</router-link>
            </div>
          </div>
          <div class="contact-row">
            <span class="contact-label">연락처</span>
            <span class="contact-value">{{ post.contact || '구매신청으로 문의' }}</span>
            <button type="button" class="copy-btn" v-if="post.contact" @click="copyContact">{{ copied ? '복사됨' : '복사' }}</button>
          </div>
          <button type="button" class="dm-btn" v-if="!isOwner" @click="messageSeller">쪽지 보내기</button>
          <div class="seller-report" v-if="!isOwner"><ReportButton target-type="trade_post" :target-id="post.id" :owner-id="post.authorId" label="판매글 신고" /></div>
        </section>

        <section class="side-card owner-card done-card" v-if="isOwner && isDone">
          <div class="card-title">거래완료 <span class="owner-tag">판매자 전용</span></div>
          <small class="owner-bump-note">거래가 끝난 글 · 상태 변경·삭제 불가</small>
        </section>
        <section class="side-card owner-card" v-if="(canManage || canDelete) && !isDone">
          <div class="card-title">{{ canManage ? '판매 상태' : '운영' }} <span class="owner-tag">{{ isOwner ? '판매자 전용' : '운영진' }}</span></div>
          <div class="status-segment" role="radiogroup" aria-label="판매 상태" v-if="canManage">
            <button
              v-for="s in TRADE_STATUSES" :key="s" type="button" role="radio" :aria-checked="post.status === s"
              :class="['status-' + s, { active: post.status === s }]" @click="setStatus(s)"
            >{{ s }}</button>
          </div>
          <template v-if="isOwner && post.status === '판매중'">
            <router-link v-if="saleExpired" class="owner-bump" :to="`/trade/${post.id}/relist`">재등록 (판매가 수정)</router-link>
            <small class="owner-bump-note">판매 기간 {{ SALE_HOURS }}시간 · 끝나면 판매가만 고쳐 재등록</small>
          </template>
          <button type="button" class="owner-delete" @click="removePost">✕ 판매글 삭제</button>
        </section>
        <div class="action-error" v-if="actionError">{{ actionError }}</div>
      </aside>
    </div>

    <!-- 구매신청 -->
    <section class="requests-section" ref="requestsEl">
      <div class="section-head">
        <div class="section-title">{{ isOwner ? '받은 구매신청' : '내 구매신청' }} <span class="count" v-if="authState.user">{{ post.requests.length }}</span></div>
      </div>
      <div class="request-list">
        <div class="request-item" v-for="r in post.requests" :key="r.id" :class="{ pending: (r.status || 'pending') === 'pending' && canManage }">
          <div class="request-top">
            <UserAvatar :src="r.buyerAvatar" :name="r.buyer" :size="26" />
            <b>{{ r.buyer }}</b>
            <span class="request-kind" v-if="r.kind === 'buy_now'">{{ REQUEST_KIND_LABEL.buy_now }}</span>
            <span class="request-qty">{{ r.qty }}개</span>
            <span class="request-status" :class="'status-' + reqStatus(r)">{{ REQUEST_STATUS_LABEL[reqStatus(r)] }}</span>
            <span class="request-date">{{ r.date }}</span>
          </div>
          <div class="request-offer-row" v-if="r.offerItems && r.offerItems.length">
            <span class="request-offer-label">제안</span>
            <span class="request-offer-chip" v-for="o in r.offerItems" :key="o.id">
              <span class="request-offer-icon" v-if="iconUrlFor(o.icon_key)"><img :src="iconUrlFor(o.icon_key)" alt="" /></span>
              {{ o.name_ko }} {{ o.qty }}개
            </span>
          </div>
          <div class="request-message">{{ r.message }}</div>
          <div class="request-bottom">
            <span class="request-contact" v-if="r.contact">연락처 {{ r.contact }}</span>
            <div class="request-actions" v-if="(r.status || 'pending') === 'pending' && canManage">
              <button type="button" class="request-action-btn accept" @click="respond(r, 'accepted')">수락 · 거래방 열기</button>
              <button type="button" class="request-action-btn decline" @click="respond(r, 'declined')">거절</button>
            </div>
            <div class="request-actions" v-else-if="(r.status || 'pending') === 'pending' && r.buyerId === authState.user?.id">
              <button type="button" class="request-action-btn cancel" @click="respond(r, 'cancelled')">신청 취소</button>
            </div>
            <div class="request-actions" v-else-if="reqStatus(r) === 'accepted' && (canManage || r.buyerId === authState.user?.id)">
              <router-link class="request-action-btn accept" :to="dealFor(r) ? '/deals/' + dealFor(r).id : `/deals?post=${post.id}&buyer=${r.buyerId}`">거래방 열기 →</router-link>
            </div>
          </div>
        </div>
        <div class="empty-state request-empty" v-if="!authState.user">구매신청은 판매자·신청자만 볼 수 있음</div>
        <div class="empty-state request-empty" v-else-if="post.requests.length === 0">{{ isOwner ? '받은 구매신청 없음' : '보낸 구매신청 없음' }}</div>
      </div>

      <div class="side-card request-form" v-if="!authState.user">
        <div class="card-title">판매자에게 문의·구매신청</div>
        <p class="request-login">로그인 후 문의·구매신청</p>
        <button type="button" class="btn-primary write-submit" @click="signIn">로그인</button>
      </div>
      <div class="side-card request-form" v-else-if="!isOwner">
        <div class="card-title">판매자에게 문의·구매신청</div>
        <div class="request-form-row">
          <input type="number" min="1" v-model="reqQty" placeholder="수량" class="write-input request-qty-input" aria-label="신청 수량" />
        </div>
        <textarea
          v-model="reqMessage" class="request-textarea" rows="4" aria-label="메시지"
          placeholder="판매자에게 전할 메시지 (예: 2개 구매 희망, 지금 거래 가능?)"
        ></textarea>
        <div class="request-form-actions">
          <span class="request-sent-toast" v-if="showRequestSent">신청 완료</span>
          <button class="btn-primary write-submit" :disabled="!reqMessage.trim()" @click="submitRequest">보내기</button>
        </div>
      </div>
    </section>
  </div>

  <div class="modal-overlay" v-if="showBuyModal" @click.self="closeBuyModal">
    <div class="modal-panel buy-modal-panel">
      <button type="button" class="modal-close" @click="closeBuyModal">✕</button>

      <template v-if="buyStep === 'offer'">
        <div class="d-section-title">제안할 룬·보석·재료 선택</div>

        <div class="item-picker offer-picker">
          <div class="item-picker-search-wrap">
            <input
              type="text" :value="offerQuery" placeholder="이름 검색 (예: 이스트 룬, 최상급 자수정, 파괴의 열쇠)"
              class="write-input" @focus="showOfferDropdown = true"
              @input="offerQuery = $event.target.value; showOfferDropdown = true" @blur="hideOfferDropdownSoon"
            />
            <div class="item-picker-dropdown" v-if="showOfferDropdown && offerQuery.trim()">
              <button
                type="button" class="item-picker-row" v-for="it in offerCandidates" :key="it.id"
                @mousedown.prevent="pickOfferItem(it)"
              >
                <span class="item-picker-icon gem"><img v-if="iconUrlFor(it.icon_key)" :src="iconUrlFor(it.icon_key)" alt="" /></span>
                <span class="item-picker-name">{{ it.name_ko }} <small>{{ it.name_en }}</small></span>
              </button>
              <div class="item-picker-empty" v-if="!offerCandidates.length">일치하는 룬·보석·재료 없음</div>
            </div>
          </div>
        </div>

        <div class="offer-chip-row" v-if="offerItems.length">
          <div class="offer-chip" v-for="(o, i) in offerItems" :key="o.item.id">
            <span class="item-picker-icon gem"><img v-if="iconUrlFor(o.item.icon_key)" :src="iconUrlFor(o.item.icon_key)" alt="" /></span>
            <span class="offer-chip-name">{{ o.item.name_ko }}</span>
            <input type="number" min="1" v-model="o.qty" class="offer-chip-qty" />
            <span class="offer-chip-unit">개</span>
            <button type="button" @click="removeOfferItem(i)">✕</button>
          </div>
        </div>
        <div class="empty-state offer-empty" v-else>선택 없음</div>

        <div class="modal-actions">
          <button type="button" class="btn-primary" :disabled="!offerItems.length" @click="goToConfirm">다음</button>
        </div>
      </template>

      <template v-else>
        <div class="d-section-title">구매 확인</div>
        <div class="confirm-row">
          <span class="k">판매 아이템</span>
          <span class="v confirm-item">
            <span class="trade-title-icon confirm-icon" v-if="postIconKey(post)" :class="postRarity(post)">
              <img :src="iconUrlFor(postIconKey(post))" alt="" />
            </span>
            {{ post.itemName }}
          </span>
        </div>
        <div class="confirm-row">
          <span class="k">희망 가격</span>
          <span class="v">
            <template v-for="(t, i) in parsePriceTokens(post.price)" :key="i">
              <span class="price-icon" v-if="t.item"><img v-if="iconUrlFor(t.item.icon_key)" :src="iconUrlFor(t.item.icon_key)" alt="" /></span>{{ t.text }}
            </template>
          </span>
        </div>
        <div class="confirm-row" v-if="post.negotiable">
          <span class="k">제안 내용</span>
          <span class="v offer-chip-row confirm-offer-row">
            <span class="offer-chip static" v-for="o in offerItems" :key="o.item.id">
              <span class="item-picker-icon gem"><img v-if="iconUrlFor(o.item.icon_key)" :src="iconUrlFor(o.item.icon_key)" alt="" /></span>
              {{ o.item.name_ko }} {{ o.qty }}개
            </span>
          </span>
        </div>
        <div class="confirm-row" v-else>
          <span class="k">구매 방식</span>
          <span class="v">즉시 구매 (가격 협의 없이 구매 신청)</span>
        </div>

        <div class="modal-actions">
          <button type="button" class="btn-ghost" v-if="post.negotiable" @click="buyStep = 'offer'">이전</button>
          <button type="button" class="btn-primary" @click="confirmBuy">구매 확정</button>
        </div>
      </template>
    </div>
  </div>
  <span class="buy-sent-toast" v-if="showBuySentToast">구매 신청 완료 - 판매자에게 알림 전송</span>
  </div>
  <div class="items-page" v-else>
    <div class="grid-wrap">
      <div class="empty-state" v-if="loading">불러오는 중…</div>
      <div class="empty-state" v-else>판매글 없음. <router-link to="/trade">거래게시판으로</router-link></div>
    </div>
  </div>
</template>

<style scoped>
/* 판매글 상세 - 거래 사이트 상세(트레더리 등) 구조를 참고: 왼쪽 아이템 이미지·설명, 오른쪽에
   가격·구매 → 판매자 → 판매자 전용 카드. 톤(어두운 배경, 금색 포인트)은 사이트 그대로 */
.trade-detail-wrap{max-width:1120px;}

.post-head{margin-bottom:22px;}
.post-chips{display:flex; flex-wrap:wrap; gap:6px; margin-bottom:12px;}
.post-chip{font-size:11.5px; color:var(--text-muted); border:1px solid var(--border); padding:3px 11px; border-radius:999px; background:var(--panel);}
.post-chip.cat{color:var(--gold); border-color:var(--gold-dim);}
.post-chip.cat:hover{background:var(--panel-2);}

.trade-title-line{display:flex; align-items:center; gap:14px; margin-bottom:8px;}
.trade-title-icon{
  width:56px; height:56px; flex:none; display:flex; align-items:center; justify-content:center;
  background:var(--panel-2); border:1px solid var(--border-soft); border-radius:14px;
}
.trade-title-icon img{max-width:82%; max-height:82%; object-fit:contain;}
.trade-title-icon.magic{border-color:#5b5bd6;}
.trade-title-icon.rare{border-color:#b8a33a;}
.trade-title-icon.crafted{border-color:#c77a1e;}
.trade-title-icon.unique{border-color:var(--gold-dim); box-shadow:0 0 14px -3px rgba(200,163,77,0.5);}
.trade-title-icon.set{border-color:var(--green); box-shadow:0 0 14px -3px rgba(92,138,91,0.5);}
.trade-title-icon.runeword{border-color:var(--blood); box-shadow:0 0 14px -3px rgba(162,81,63,0.5);}
.trade-title-icon.gem{border-color:var(--teal); box-shadow:0 0 14px -3px rgba(78,138,138,0.5);}
.title-block{flex:1; min-width:0; display:flex; flex-direction:column; gap:7px;}
.trade-post-title{font-size:27px; margin:0; line-height:1.25; word-break:keep-all;}
.title-badges{display:flex; flex-wrap:wrap; gap:6px;}
.trade-post-meta{font-size:12px; color:var(--text-dim);}

.status-pill{font-size:11px; padding:3px 11px; border-radius:999px; border:1px solid var(--border); color:var(--text-dim);}
.status-pill.status-판매중{color:#1f1a10; background:var(--gold); border-color:var(--gold);}
.status-pill.status-예약중{color:var(--teal); border-color:var(--teal);}
.ethereal-badge{font-size:11px; padding:3px 11px; border:1px solid var(--teal); color:var(--teal); border-radius:999px;}
.unid-badge{font-size:11px; padding:3px 11px; border:1px solid var(--blood); color:#e0775f; border-radius:999px;}
.negotiable-badge{font-size:11px; padding:3px 11px; border:1px solid var(--gold-dim); color:var(--gold-dim); border-radius:999px;}

.favorite-star{
  font-size:26px; line-height:1; color:var(--text-dim); flex:none; align-self:flex-start; padding:4px 6px;
  border:1px solid var(--border); border-radius:12px; background:var(--panel); transition:color .1s, border-color .1s;
}
.favorite-star:hover{color:var(--gold-dim); border-color:var(--gold-dim);}
.favorite-star.active{color:var(--gold); border-color:var(--gold-dim);}

/* 본문 2단 */
.post-layout{display:grid; grid-template-columns:minmax(0, 1fr) 340px; gap:22px; align-items:start; margin-bottom:34px;}
.post-left{display:flex; flex-direction:column; gap:18px; min-width:0;}
.post-side{display:flex; flex-direction:column; gap:14px; position:sticky; top:16px;}

.item-panel{
  background:radial-gradient(ellipse at 50% 0%, rgba(200,163,77,0.08), transparent 60%), var(--panel);
  border:1px solid var(--border-soft); border-radius:18px; padding:30px 24px 20px;
  display:flex; flex-direction:column; align-items:center; gap:18px;
}
.item-panel-foot{display:flex; align-items:center; justify-content:space-between; gap:14px; width:100%; border-top:1px solid var(--border-soft); padding-top:14px;}
.tooltip-save-btn{
  flex:none; font-size:12px; color:var(--gold); border:1px solid var(--gold-dim); padding:7px 13px; border-radius:9px;
}
.tooltip-save-btn:hover{background:var(--panel-2);}

.side-card{background:var(--panel); border:1px solid var(--border-soft); border-radius:16px; padding:18px 20px;}
.card-title{font-size:12px; color:var(--text-dim); font-weight:600; letter-spacing:0.02em; margin-bottom:12px; display:flex; align-items:center; gap:8px;}

.price-card{border-color:var(--gold-dim); box-shadow:0 14px 30px -18px rgba(200,163,77,0.35);}
.price-parts{display:flex; flex-direction:column; gap:8px; margin-bottom:14px;}
.price-part{display:flex; align-items:center; gap:10px; flex-wrap:wrap;}
.price-part-icon{
  width:34px; height:34px; flex:none; display:flex; align-items:center; justify-content:center;
  background:var(--panel-2); border:1px solid var(--teal); border-radius:9px; box-shadow:0 0 10px -3px rgba(78,138,138,0.5);
}
.price-part-icon img{width:80%; height:80%; object-fit:contain; image-rendering:pixelated;}
.price-part-icon.empty{border-color:var(--border); box-shadow:none;}
.price-part-icon.empty::after{content:'◆'; font-size:12px; color:var(--text-dim);}
.price-part-text{font-size:17px; font-weight:700; color:var(--text);}
.price-parts{gap:0 !important;}
.price-part{padding:4px 0;}
/* 항목 사이 + 는 얇은 구분선 가운데에 */
.price-or{width:100%; display:flex; align-items:center; gap:8px; font-size:11px; color:var(--text-dim); margin:4px 0 0;}
.price-or::before, .price-or::after{content:''; flex:1; height:1px; background:var(--border-soft);}
.price-meta{display:flex; flex-wrap:wrap; gap:6px 14px; font-size:12px; color:var(--text-dim); margin-bottom:14px;}
.price-meta b{color:var(--text); font-weight:600;}
.price-meta .nego{color:var(--gold-dim);}
.buy-now-btn{width:100%; padding:13px; font-size:14.5px; border-radius:11px;}
.buy-now-btn:disabled{opacity:0.45; cursor:not-allowed;}
.buy-now-hint{font-size:11.5px; color:var(--text-dim); margin:9px 0 0; text-align:center;}

.seller-row{display:flex; align-items:center; gap:12px; margin-bottom:14px;}
.seller-avatar{
  width:40px; height:40px; flex:none; border-radius:50%; display:flex; align-items:center; justify-content:center;
  background:linear-gradient(135deg, var(--gold-dim), var(--blood)); color:#fff; font-weight:700; font-size:16px;
}
.seller-avatar.small{width:26px; height:26px; font-size:12px;}
.seller-name-block{min-width:0;}
.seller-name{font-size:15px; font-weight:700; color:var(--text); display:block;}
.seller-profile-link{display:inline-block; margin-top:4px; font-size:12px; color:var(--gold);}
.seller-profile-link:hover{text-decoration:underline;}
.seller-sub{font-size:11.5px; color:var(--text-dim);}
.contact-row{display:flex; align-items:center; gap:8px; background:var(--panel-2); border:1px solid var(--border-soft); border-radius:10px; padding:9px 10px 9px 12px;}
.contact-label{font-size:11px; color:var(--text-dim); flex:none;}
.contact-value{font-size:12.5px; color:var(--text); flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.copy-btn{flex:none; font-size:11.5px; color:var(--gold); border:1px solid var(--gold-dim); padding:4px 10px; border-radius:7px;}
.copy-btn:hover{background:var(--panel);}

.owner-card{padding:14px 16px;}
.owner-card .card-title{margin-bottom:10px;}
.owner-tag{font-size:10px; font-weight:500; color:var(--text-dim); border:1px solid var(--border); padding:1px 7px; border-radius:999px;}
.status-segment{display:grid; grid-template-columns:repeat(3, 1fr); border:1px solid var(--border); border-radius:10px; overflow:hidden;}
.status-segment button{font-size:12px; padding:8px 0; color:var(--text-dim); background:var(--panel-2);}
.status-segment button + button{border-left:1px solid var(--border);}
.status-segment button.active.status-판매중{color:#1f1a10; background:var(--gold);}
.status-segment button.active.status-예약중{color:var(--panel); background:var(--teal);}
.status-segment button.active.status-거래완료{color:var(--text); background:var(--border);}

.desc-card .card-title{margin-bottom:10px;}
.trade-post-content{font-size:14.5px; line-height:1.9; color:var(--text);}
.trade-post-content :deep(p){margin-bottom:10px;}
.trade-post-content :deep(ul){margin:8px 0 8px 20px;}

/* 구매신청 */
.requests-section{display:flex; flex-direction:column; gap:14px; max-width:calc(100% - 362px);}
.section-head{display:flex; align-items:center; justify-content:space-between;}
.section-title{font-size:16px; font-weight:700; color:var(--text); display:flex; align-items:center; gap:8px;}
.section-title .count{font-size:12px; color:var(--gold); border:1px solid var(--gold-dim); padding:1px 9px; border-radius:999px;}
/* 신청이 많으면 목록 안에서 스크롤 */
.request-list{display:flex; flex-direction:column; gap:10px; max-height:min(640px, 75vh); overflow-y:auto; padding-right:6px; overscroll-behavior:contain; scrollbar-width:thin; scrollbar-color:var(--gold-dim) transparent;}
.request-item{background:var(--panel); border:1px solid var(--border-soft); border-radius:14px; padding:14px 18px;}
.request-top{display:flex; align-items:center; gap:8px; font-size:12px; margin-bottom:8px; flex-wrap:wrap;}
.request-top b{color:var(--text); font-weight:600; font-size:13px;}
.request-kind{font-size:10.5px; color:var(--gold); border:1px solid var(--gold-dim); padding:2px 9px; border-radius:999px;}
.request-qty{color:var(--teal); font-size:11px; border:1px solid var(--teal); padding:2px 9px; border-radius:999px;}
.request-status{font-size:11px; padding:2px 9px; border-radius:999px; border:1px solid var(--border); color:var(--text-dim);}
.request-status.status-accepted{color:var(--gold); border-color:var(--gold-dim);}
.request-status.status-declined, .request-status.status-failed{color:var(--blood); border-color:var(--blood);}
.request-status.status-done{color:#1a1408; background:var(--gold); border-color:var(--gold);}
.request-date{color:var(--text-dim); margin-left:auto;}
.request-offer-row{display:flex; align-items:center; flex-wrap:wrap; gap:6px; margin-bottom:8px;}
.request-offer-label{font-size:11px; color:var(--text-dim); flex:none;}
.request-offer-chip{
  display:inline-flex; align-items:center; gap:5px; background:var(--panel-2); border:1px solid var(--border-soft);
  padding:3px 10px 3px 5px; border-radius:999px; font-size:11.5px; color:var(--text-muted);
}
.request-offer-icon{width:16px; height:16px; flex:none; display:flex; align-items:center; justify-content:center;}
.request-offer-icon img{width:100%; height:100%; object-fit:contain; image-rendering:pixelated;}
.request-message{font-size:13.5px; color:var(--text-muted); line-height:1.7;}
.request-bottom{display:flex; align-items:center; justify-content:space-between; gap:10px; margin-top:10px; flex-wrap:wrap;}
.request-contact{font-size:11.5px; color:var(--text-dim);}
.request-actions{display:flex; gap:8px; margin-left:auto;}
/* 수락·거절은 큰 버튼 (수락 = 금색으로 꽉 참, 거절 = 빨간 테두리) */
.request-action-btn{font-size:13.5px; font-weight:700; padding:10px 20px; border-radius:10px; border:1px solid var(--border); color:var(--text-muted); display:inline-flex; align-items:center;}
.request-action-btn.accept{background:var(--gold); border-color:var(--gold); color:#1a1408;}
.request-action-btn.accept:hover{filter:brightness(1.08);}
.request-action-btn.decline{border-color:var(--blood); color:#e0775f;}
.request-action-btn.decline:hover{background:rgba(162,81,63,0.15);}
.request-action-btn.cancel:hover{border-color:var(--text-dim); color:var(--text);}
.request-item.pending{border-color:var(--gold-dim); box-shadow:0 0 0 1px rgba(200,163,77,0.25);}
.pending-banner{
  display:flex; align-items:center; gap:10px; width:100%; margin:0 0 16px; padding:14px 18px; text-align:left;
  border:1px solid var(--gold-dim); background:rgba(200,163,77,0.1); border-radius:14px; color:var(--text); font-size:14px;
}
.pending-banner:hover{background:rgba(200,163,77,0.16);}
.pending-banner b{color:var(--gold);}
.pending-dot{width:9px; height:9px; border-radius:999px; background:var(--gold); flex:none; animation:pending-pulse 1.4s ease-in-out infinite;}
@keyframes pending-pulse{50%{opacity:.35;}}
.pending-go{margin-left:auto; font-size:13px; color:var(--gold);}
@media (max-width:640px){ .request-actions{width:100%;} .request-action-btn{flex:1; justify-content:center;} .pending-go{display:none;} }
.request-empty{padding:26px 0; font-size:12.5px; border:1px dashed var(--border); border-radius:14px;}

.request-form{display:flex; flex-direction:column; gap:10px;}
.request-form-row{display:flex; gap:8px;}
.request-form-row .write-input{flex:1; min-width:0;}
.request-qty-input{flex:0 0 90px !important;}
.write-input{
  background:var(--panel-2); border:1px solid var(--border); color:var(--text); font-size:13px;
  padding:11px 14px; font-family:'Noto Sans KR', sans-serif; border-radius:10px;
}
.request-textarea{
  background:var(--panel-2); border:1px solid var(--border); color:var(--text); font-size:13px;
  padding:12px 14px; font-family:'Noto Sans KR', sans-serif; resize:vertical; border-radius:12px;
}
.request-form-actions{display:flex; align-items:center; justify-content:flex-end; gap:12px;}
.write-submit{padding:10px 24px; font-size:13px; border-radius:10px;}
.write-submit:disabled{opacity:0.45; cursor:not-allowed;}
.request-sent-toast{font-size:12px; color:var(--teal);}

@media (max-width: 900px){
  .post-layout{grid-template-columns:minmax(0, 1fr);}
  .post-side{position:static;}
  .requests-section{max-width:none;}
  /* 폰: 이미지 -> 가격·구매 -> 판매자 -> 설명 순서 */
  .post-layout{display:flex; flex-direction:column;}
  .post-left, .post-side{display:contents;}
  .item-panel{order:1;}
  .price-card{order:2;}
  .seller-card{order:3;}
  .desc-card{order:4;}
  .owner-card{order:5;}
  .post-layout > * , .post-left > *, .post-side > *{margin-bottom:0;}
  .post-layout{gap:14px;}
}
@media (max-width: 560px){
  .trade-post-title{font-size:22px;}
  .trade-title-icon{width:46px; height:46px;}
  .item-panel{padding:22px 14px 16px;}
  .item-panel-foot{flex-direction:column; align-items:stretch; text-align:center;}
  .request-form-row{flex-wrap:wrap;}
  .request-form-row .write-input{flex:1 1 100%;}
  .request-qty-input{flex:1 1 100% !important;}
}

.buy-modal-panel{max-width:560px; display:flex; flex-direction:column; gap:16px;}
.buy-modal-hint{font-size:12px; color:var(--text-dim); line-height:1.6; margin:-8px 0 0;}

.item-picker{position:relative;}
.item-picker-search-wrap{position:relative;}
.item-picker-dropdown{
  position:absolute; top:calc(100% + 6px); left:0; right:0; z-index:20; max-height:300px; overflow-y:auto;
  background:var(--panel-2); border:1px solid var(--border); box-shadow:0 12px 28px -6px rgba(0,0,0,0.55);
  border-radius:12px; padding:6px;
}
.item-picker-row{
  display:flex; align-items:center; gap:8px; width:100%; padding:9px 10px; text-align:left;
  font-family:'Noto Sans KR', sans-serif; border-radius:9px;
}
.item-picker-row:hover{background:rgba(255,255,255,0.06);}
.item-picker-icon{
  width:26px; height:26px; flex:none; display:flex; align-items:center; justify-content:center;
  background:var(--panel); border:1px solid var(--border-soft); border-radius:7px;
}
.item-picker-icon img{width:100%; height:100%; object-fit:contain; image-rendering:pixelated;}
.item-picker-icon.gem{border-color:var(--teal); box-shadow:0 0 8px -2px rgba(78,138,138,0.5);}
.item-picker-name{font-size:13px; color:var(--text); min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.item-picker-name small{color:var(--text-dim); font-size:11px; margin-left:4px;}
.item-picker-empty{text-align:center; color:var(--text-dim); font-size:12px; padding:14px;}

.offer-chip-row{display:flex; flex-direction:column; gap:8px;}
.offer-chip{
  display:flex; align-items:center; gap:8px; background:var(--panel-2); border:1px solid var(--border-soft);
  padding:6px 10px; border-radius:999px;
}
.offer-chip-name{flex:1; font-size:13px; color:var(--text);}
.offer-chip-qty{
  width:60px; background:var(--panel); border:1px solid var(--border); color:var(--text); font-size:12.5px;
  padding:5px 8px; border-radius:8px; font-family:'Noto Sans KR', sans-serif;
}
.offer-chip-unit{font-size:12px; color:var(--text-dim);}
.offer-chip button{color:var(--text-dim); flex:none;}
.offer-chip button:hover{color:var(--blood);}
.offer-chip.static{flex-wrap:wrap;}
.offer-empty{padding:20px 0; font-size:12px;}

.confirm-offer-row{flex-direction:row !important; flex-wrap:wrap; gap:6px !important;}

.confirm-row{display:flex; gap:14px; font-size:13px; padding:6px 0; border-bottom:1px solid var(--border-soft);}
.confirm-row:last-of-type{border-bottom:none;}
.confirm-row .k{color:var(--text-dim); flex:none; width:110px;}
.confirm-row .v{color:var(--text); flex:1; display:flex; flex-wrap:wrap; align-items:center; gap:6px;}
.confirm-item{display:flex; align-items:center; gap:8px;}
.confirm-icon{width:32px; height:32px;}

.modal-actions{display:flex; justify-content:flex-end; gap:10px;}

.buy-sent-toast{
  position:fixed; bottom:28px; left:50%; transform:translateX(-50%); z-index:110;
  background:var(--panel-2); border:1px solid var(--gold-dim); color:var(--gold); font-size:13px;
  padding:12px 22px; border-radius:999px; box-shadow:0 12px 28px -8px rgba(0,0,0,0.6);
}
.history-link{color:var(--gold-dim); text-decoration:underline; text-underline-offset:3px;}
.history-link:hover{color:var(--gold);}
.owner-bump{display:block; width:100%; margin-top:12px; font-size:13.5px; font-weight:600; color:var(--gold); border:1px solid var(--gold-dim); padding:10px 0; border-radius:10px;}
.owner-bump:hover{background:rgba(200,163,77,0.1);}
a.owner-bump{text-align:center; background:var(--gold); color:#1a1408;}
a.owner-bump:hover{filter:brightness(1.08); background:var(--gold);}
.done-card .owner-bump-note{margin-top:0;}

/* 판매 기간 카운트다운 */
.sale-timer{display:flex; align-items:center; gap:12px; flex-wrap:wrap; margin:0 0 16px; padding:12px 18px; border:1px solid var(--gold-dim); border-radius:14px; background:rgba(200,163,77,0.07);}
.sale-timer-label{font-size:13px; color:var(--text-muted);}
.sale-timer-clock{font-family:'Noto Serif KR', serif; font-size:20px; color:var(--gold); font-variant-numeric:tabular-nums; letter-spacing:.5px;}
.sale-timer-bar{flex:1; min-width:120px; height:6px; border-radius:999px; background:var(--panel-2); overflow:hidden;}
.sale-timer-bar span{display:block; height:100%; background:var(--gold); border-radius:999px; transition:width .9s linear;}
.sale-timer.soon{border-color:#e0775f; background:rgba(162,81,63,0.08);}
.sale-timer.soon .sale-timer-clock{color:#e0775f;}
.sale-timer.soon .sale-timer-bar span{background:#e0775f;}
.sale-timer.expired{border-color:var(--border); background:var(--panel);}
.sale-relist-btn{margin-left:auto; font-size:13.5px; font-weight:700; color:#1a1408; background:var(--gold); padding:8px 18px; border-radius:10px;}
.sale-relist-btn:hover{filter:brightness(1.08);}
.owner-bump-note{display:block; margin-top:6px; font-size:11px; color:var(--text-dim);}
.owner-bump-done{display:block; margin-top:6px; font-size:11.5px; color:var(--gold);}
.status-pill.status-만료{color:var(--text-dim); border-style:dashed;}
/* 삭제는 맨 아래 따로, 빨간 테두리로 눈에 띄게 */
.owner-delete{display:block; width:100%; margin-top:14px; padding:10px 0; font-size:13.5px; font-weight:600; color:#e0775f; border:1px solid var(--blood); border-radius:10px; position:relative;}
.owner-delete::before{content:''; position:absolute; left:0; right:0; top:-8px; border-top:1px solid var(--border-soft);}
.owner-delete:hover{background:rgba(162,81,63,0.15);}
.action-error{font-size:12.5px; color:#e0775f; margin-top:10px;}
.request-login{font-size:13px; color:var(--text-muted); margin:6px 0 12px;}
.seller-avatar img{width:100%; height:100%; object-fit:cover; border-radius:inherit;}
.dm-btn{margin-top:12px; width:100%; padding:9px 12px; border-radius:10px; border:1px solid var(--border); color:var(--text-muted); font-size:13px;}
.seller-report{display:flex; justify-content:flex-end; margin-top:10px;}
.dm-btn:hover{border-color:var(--gold-dim); color:var(--gold);}
</style>
