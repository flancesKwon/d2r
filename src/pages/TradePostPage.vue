<script setup>
import HeaderNotifications from '../components/HeaderNotifications.vue'
import LogoMark from '../components/LogoMark.vue'
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { getTradePost, addTradeRequest, respondToRequest, updateTradeStatus, getTradeItem, TRADE_STATUSES, parsePriceTokens, searchAllItems } from '../tradeStore.js'
import { renderMarkdown } from '../markdown.js'
import iconsData from '../data/icons.json'
import { isFavorite, toggleFavorite } from '../tradeFavorites.js'
import { profileState } from '../profileStore.js'

const route = useRoute()
const post = computed(() => getTradePost(route.params.id))
const contentHtml = computed(() => (post.value ? renderMarkdown(post.value.content) : ''))
const linkedItem = computed(() => (post.value ? getTradeItem(post.value.itemId) : null))

function iconUrlFor(iconKey) {
  const b64 = iconKey && iconsData[iconKey]
  return b64 ? 'data:image/png;base64,' + b64 : null
}

function rarityClass(item) {
  return item ? item.category : ''
}

const reqBuyer = ref('')
const reqContact = ref('')
const reqQty = ref(1)
const reqMessage = ref('')
const showRequestSent = ref(false)

function submitRequest() {
  if (!reqMessage.value.trim()) return
  addTradeRequest(route.params.id, {
    buyer: reqBuyer.value,
    contact: reqContact.value,
    qty: reqQty.value,
    message: reqMessage.value,
  })
  reqBuyer.value = ''
  reqContact.value = ''
  reqQty.value = 1
  reqMessage.value = ''
  showRequestSent.value = true
  setTimeout(() => (showRequestSent.value = false), 2500)
}

function changeStatus(e) {
  updateTradeStatus(route.params.id, e.target.value)
}

function respond(requestId, decision) {
  respondToRequest(route.params.id, requestId, decision)
}

const REQUEST_STATUS_LABEL = { pending: '대기중', accepted: '수락됨', declined: '거절됨' }
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
  return searchAllItems(offerQuery.value).filter((it) => it.category === 'gem')
})

function openBuyModal() {
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
function confirmBuy() {
  addTradeRequest(route.params.id, {
    buyer: profileState.nickname,
    contact: profileState.contact,
    qty: 1,
    message: post.value.negotiable
      ? `구매하기 - 제안: ${offerItems.value.map((o) => `${o.item.name_ko} ${o.qty}개`).join(' + ')}`
      : '구매하기 (즉시 구매 신청)',
    offerItems: post.value.negotiable
      ? offerItems.value.map((o) => ({ id: o.item.id, name_ko: o.item.name_ko, icon_key: o.item.icon_key, qty: o.qty }))
      : [],
    kind: 'buy_now',
  })
  showBuyModal.value = false
  showBuySentToast.value = true
  setTimeout(() => (showBuySentToast.value = false), 2500)
}
</script>

<template>
  <div class="items-page trade-detail-page" v-if="post">
  <header>
    <div class="logo">
      <router-link to="/" style="display: flex; align-items: center; gap: 8px; color: inherit">
        <LogoMark />디아허브
      </router-link>
    </div>
    <div class="crumb">
      <router-link to="/">메인</router-link> / <router-link to="/trade">거래게시판</router-link> / <b>{{ post.category }}</b>
    </div>
    <HeaderNotifications />
  </header>

  <div class="grid-wrap trade-detail-wrap">
    <div class="post-card">
      <div class="d-eyebrow">{{ post.category }}</div>
      <div class="trade-title-line">
        <span class="trade-title-icon" v-if="linkedItem" :class="rarityClass(linkedItem)">
          <img v-if="iconUrlFor(linkedItem.icon_key)" :src="iconUrlFor(linkedItem.icon_key)" alt="" />
        </span>
        <h1 class="d-name trade-post-title">{{ post.itemName }}</h1>
        <span class="ethereal-badge" v-if="post.ethereal">에테리얼</span>
        <span class="negotiable-badge" v-if="post.negotiable">흥정 가능</span>
        <select class="status-select" :class="'status-' + post.status" :value="post.status" @change="changeStatus">
          <option v-for="s in TRADE_STATUSES" :key="s" :value="s">{{ s }}</option>
        </select>
        <button
          type="button" class="favorite-star" :class="{ active: isFavorite(post.id) }"
          :title="isFavorite(post.id) ? '찜 해제' : '찜하기'"
          @click="toggleFavorite(post.id)"
        >{{ isFavorite(post.id) ? '★' : '☆' }}</button>
      </div>
      <div class="trade-post-meta">{{ post.author }} · {{ post.date }} · 조회 {{ post.views }}</div>

      <div class="trade-info-card">
        <div class="trade-info-row"><span class="k">수량 / 단위</span><span class="v">{{ post.amountLabel }}</span></div>
        <div class="trade-info-row">
          <span class="k">희망 가격</span>
          <span class="v">
            <template v-for="(t, i) in parsePriceTokens(post.price)" :key="i">
              <span class="price-icon" v-if="t.item"><img v-if="iconUrlFor(t.item.icon_key)" :src="iconUrlFor(t.item.icon_key)" alt="" /></span>{{ t.text }}
            </template>
          </span>
        </div>
        <div class="trade-info-row"><span class="k">서버</span><span class="v">{{ post.realm }} · {{ post.ladder }} · {{ post.hardcore }}</span></div>
        <div class="trade-info-row"><span class="k">연락처</span><span class="v">{{ post.contact || '게시글로 문의' }}</span></div>
      </div>

      <div class="buy-now-row">
        <button type="button" class="btn-primary buy-now-btn" @click="openBuyModal">구매하기</button>
        <span class="buy-now-hint">{{ post.negotiable ? '흥정 가능한 판매글이에요 - 룬·보석으로 교환을 제안할 수 있어요.' : '가격 그대로 즉시 구매를 신청해요.' }}</span>
      </div>

      <div class="trade-options-card" v-if="post.options && post.options.length">
        <div class="d-section-title">아이템 옵션</div>
        <div class="trade-option-line" v-for="(o, i) in post.options" :key="i">{{ o }}</div>
      </div>

      <div class="trade-post-content" v-html="contentHtml"></div>
    </div>

    <div class="d-section-title">구매신청 {{ post.requests.length }}건</div>
    <div class="request-list">
      <div class="request-item" v-for="r in post.requests" :key="r.id">
        <div class="request-top">
          <span class="request-kind" v-if="r.kind === 'buy_now'">{{ REQUEST_KIND_LABEL.buy_now }}</span>
          <b>{{ r.buyer }}</b><span class="request-qty">{{ r.qty }}개 신청</span>
          <span class="request-status" :class="'status-' + (r.status || 'pending')">{{ REQUEST_STATUS_LABEL[r.status || 'pending'] }}</span>
          <span class="request-date">{{ r.date }}</span>
        </div>
        <div class="request-contact" v-if="r.contact">연락처: {{ r.contact }}</div>
        <div class="request-offer-row" v-if="r.offerItems && r.offerItems.length">
          <span class="request-offer-label">제안:</span>
          <span class="request-offer-chip" v-for="o in r.offerItems" :key="o.id">
            <span class="request-offer-icon" v-if="iconUrlFor(o.icon_key)"><img :src="iconUrlFor(o.icon_key)" alt="" /></span>
            {{ o.name_ko }} {{ o.qty }}개
          </span>
        </div>
        <div class="request-message">{{ r.message }}</div>
        <div class="request-actions" v-if="(r.status || 'pending') === 'pending'">
          <button type="button" class="request-action-btn accept" @click="respond(r.id, 'accepted')">수락</button>
          <button type="button" class="request-action-btn decline" @click="respond(r.id, 'declined')">거절</button>
        </div>
      </div>
      <div class="empty-state" v-if="post.requests.length === 0">아직 구매신청이 없어요</div>
    </div>

    <div class="request-form">
      <div class="d-section-title">구매신청 보내기</div>
      <div class="request-form-row">
        <input type="text" v-model="reqBuyer" placeholder="닉네임 (비우면 익명)" class="write-input" />
        <input type="text" v-model="reqContact" placeholder="연락처 (배틀태그, 디스코드 등)" class="write-input" />
        <input type="number" min="1" v-model="reqQty" placeholder="신청 수량" class="write-input request-qty-input" />
      </div>
      <textarea
        v-model="reqMessage" class="request-textarea" rows="6"
        placeholder="판매자에게 전할 메시지를 입력하세요 (예: 2개 구매하고 싶어요, 지금 거래 가능하신가요?)"
      ></textarea>
      <button class="btn-primary write-submit" @click="submitRequest">구매신청 보내기</button>
      <span class="request-sent-toast" v-if="showRequestSent">신청을 보냈어요!</span>
    </div>
  </div>

  <div class="modal-overlay" v-if="showBuyModal" @click.self="closeBuyModal">
    <div class="modal-panel buy-modal-panel">
      <button type="button" class="modal-close" @click="closeBuyModal">✕</button>

      <template v-if="buyStep === 'offer'">
        <div class="d-section-title">제안할 룬·보석 선택</div>
        <p class="buy-modal-hint">이 판매글은 흥정 가능이에요. 판매자에게 제안할 룬·보석을 검색해서 고르고 개수를 입력하세요 (여러 개 선택 가능).</p>

        <div class="item-picker offer-picker">
          <div class="item-picker-search-wrap">
            <input
              type="text" v-model="offerQuery" placeholder="룬·보석 이름 검색 (예: 이스트 룬, 최상급 자수정)"
              class="write-input" @focus="showOfferDropdown = true"
              @input="showOfferDropdown = true" @blur="hideOfferDropdownSoon"
            />
            <div class="item-picker-dropdown" v-if="showOfferDropdown && offerQuery.trim()">
              <button
                type="button" class="item-picker-row" v-for="it in offerCandidates" :key="it.id"
                @mousedown.prevent="pickOfferItem(it)"
              >
                <span class="item-picker-icon gem"><img v-if="iconUrlFor(it.icon_key)" :src="iconUrlFor(it.icon_key)" alt="" /></span>
                <span class="item-picker-name">{{ it.name_ko }} <small>{{ it.name_en }}</small></span>
              </button>
              <div class="item-picker-empty" v-if="!offerCandidates.length">일치하는 룬·보석이 없어요.</div>
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
        <div class="empty-state offer-empty" v-else>아직 고른 룬·보석이 없어요</div>

        <div class="modal-actions">
          <button type="button" class="btn-primary" :disabled="!offerItems.length" @click="goToConfirm">다음</button>
        </div>
      </template>

      <template v-else>
        <div class="d-section-title">구매 확인</div>
        <div class="confirm-row">
          <span class="k">판매 아이템</span>
          <span class="v confirm-item">
            <span class="trade-title-icon confirm-icon" v-if="linkedItem" :class="rarityClass(linkedItem)">
              <img v-if="iconUrlFor(linkedItem.icon_key)" :src="iconUrlFor(linkedItem.icon_key)" alt="" />
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
          <span class="k">제안하는 룬·보석</span>
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
  <span class="buy-sent-toast" v-if="showBuySentToast">구매 신청을 보냈어요! 판매자에게 알림이 갔어요.</span>
  </div>
  <div class="items-page" v-else>
    <div class="grid-wrap">
      <div class="empty-state">판매글을 찾을 수 없어요. <router-link to="/trade">거래게시판으로</router-link></div>
    </div>
  </div>
</template>

<style scoped>
/* 벨로그처럼 여백 넉넉한 둥근 카드 느낌 - 톤(어두운 배경, 금색 포인트)은 그대로 두고
   본문·구매신청 목록을 각진 구분선 대신 카드로 나눠서 편하게 읽히게 함 */
.trade-detail-wrap{max-width:920px;}
.post-card{background:var(--panel); border:1px solid var(--border-soft); border-radius:18px; padding:32px 36px; margin-bottom:24px;}
.trade-title-line{display:flex; align-items:center; gap:12px; margin:10px 0 8px;}
.trade-title-icon{
  width:48px; height:48px; flex:none; display:flex; align-items:center; justify-content:center;
  background:var(--panel-2); border:1px solid var(--border-soft); border-radius:12px;
}
.trade-title-icon img{width:100%; height:100%; object-fit:contain; image-rendering:pixelated;}
.trade-title-icon.unique{border-color:var(--gold-dim); box-shadow:0 0 12px -3px rgba(200,163,77,0.5);}
.trade-title-icon.set{border-color:var(--green); box-shadow:0 0 12px -3px rgba(92,138,91,0.5);}
.trade-title-icon.runeword{border-color:var(--blood); box-shadow:0 0 12px -3px rgba(162,81,63,0.5);}
.trade-title-icon.gem{border-color:var(--teal); box-shadow:0 0 12px -3px rgba(78,138,138,0.5);}
.trade-post-title{font-size:25px; margin:0;}
.trade-post-meta{font-size:12px; color:var(--text-dim); margin-bottom:20px;}

.ethereal-badge{font-size:10.5px; padding:3px 11px; border:1px solid var(--teal); color:var(--teal); flex:none; border-radius:999px;}
.negotiable-badge{font-size:10.5px; padding:3px 11px; border:1px solid var(--gold-dim); color:var(--gold-dim); flex:none; border-radius:999px;}

.favorite-star{
  font-size:24px; line-height:1; color:var(--text-dim); flex:none; margin-left:auto; padding:2px;
  transition:color .1s, transform .1s;
}
.favorite-star:hover{color:var(--gold-dim); transform:scale(1.15);}
.favorite-star.active{color:var(--gold);}

.status-select{
  font-size:12px; padding:7px 12px; border:1px solid var(--border); background:var(--panel-2); color:var(--text-dim);
  font-family:'Noto Sans KR', sans-serif; cursor:pointer; border-radius:999px;
}
.status-select.status-판매중{color:var(--gold); border-color:var(--gold-dim);}
.status-select.status-예약중{color:var(--teal); border-color:var(--teal);}
.status-select.status-거래완료{color:var(--text-dim); border-color:var(--border);}

.trade-info-card{border:1px solid var(--border-soft); background:var(--panel-2); padding:20px 22px; margin-bottom:22px; display:flex; flex-direction:column; gap:10px; border-radius:14px;}
.trade-info-row{display:flex; gap:10px; font-size:13px;}
.trade-info-row .k{color:var(--text-dim); flex:none; width:88px;}
.trade-info-row .v{color:var(--text);}
.price-icon{display:inline-flex; width:16px; height:16px; vertical-align:-3px; margin:0 2px 0 3px;}
.price-icon img{width:100%; height:100%; object-fit:contain; image-rendering:pixelated;}

.buy-now-row{display:flex; align-items:center; gap:14px; margin-bottom:22px; flex-wrap:wrap;}
.buy-now-btn{padding:12px 28px; font-size:14px; border-radius:10px; flex:none;}
.buy-now-hint{font-size:12px; color:var(--text-dim);}

.trade-options-card{border:1px solid var(--border-soft); background:var(--panel-2); padding:18px 22px; margin-bottom:22px; border-radius:14px;}
.trade-options-card .d-section-title{margin-bottom:10px;}
.trade-option-line{font-size:12.5px; color:var(--text-muted); line-height:1.8;}

.trade-post-content{
  font-size:14.5px; line-height:1.9; color:var(--text);
}
.trade-post-content :deep(p){margin-bottom:10px;}
.trade-post-content :deep(ul){margin:8px 0 8px 20px;}

.request-list{display:flex; flex-direction:column; gap:12px; margin-bottom:24px;}
.request-item{background:var(--panel); border:1px solid var(--border-soft); border-radius:14px; padding:16px 20px;}
.request-top{display:flex; align-items:center; gap:10px; font-size:12px; margin-bottom:6px;}
.request-top b{color:var(--gold-dim); font-weight:600;}
.request-kind{font-size:10.5px; color:var(--gold); border:1px solid var(--gold-dim); padding:2px 9px; border-radius:999px; flex:none;}
.request-qty{color:var(--teal); font-size:11px; border:1px solid var(--teal); padding:2px 9px; border-radius:999px;}
.request-status{font-size:11px; padding:2px 9px; border-radius:999px; border:1px solid var(--border); color:var(--text-dim);}
.request-status.status-accepted{color:var(--gold); border-color:var(--gold-dim);}
.request-status.status-declined{color:var(--blood); border-color:var(--blood);}
.request-date{color:var(--text-dim); margin-left:auto;}
.request-contact{font-size:11.5px; color:var(--text-dim); margin-bottom:6px;}
.request-offer-row{display:flex; align-items:center; flex-wrap:wrap; gap:6px; margin-bottom:8px;}
.request-offer-label{font-size:11px; color:var(--text-dim); flex:none;}
.request-offer-chip{
  display:inline-flex; align-items:center; gap:5px; background:var(--panel-2); border:1px solid var(--border-soft);
  padding:3px 10px 3px 5px; border-radius:999px; font-size:11.5px; color:var(--text-muted);
}
.request-offer-icon{width:16px; height:16px; flex:none; display:flex; align-items:center; justify-content:center;}
.request-offer-icon img{width:100%; height:100%; object-fit:contain; image-rendering:pixelated;}
.request-message{font-size:13px; color:var(--text-muted); line-height:1.7;}
.request-actions{display:flex; gap:8px; margin-top:10px;}
.request-action-btn{font-size:12px; padding:6px 16px; border-radius:999px; border:1px solid var(--border); color:var(--text-muted);}
.request-action-btn.accept:hover{border-color:var(--gold-dim); color:var(--gold);}
.request-action-btn.decline:hover{border-color:var(--blood); color:var(--blood);}

.request-form{display:flex; flex-direction:column; gap:12px; max-width:680px; position:relative;}
.request-form-row{display:flex; gap:8px;}
.request-qty-input{width:100px;}
.write-input{
  background:var(--panel); border:1px solid var(--border); color:var(--text); font-size:13px;
  padding:11px 14px; font-family:'Noto Sans KR', sans-serif; border-radius:10px;
}
.request-textarea{
  background:var(--panel); border:1px solid var(--border); color:var(--text); font-size:13px;
  padding:12px 14px; font-family:'Noto Sans KR', sans-serif; resize:vertical; border-radius:12px;
}
.write-submit{align-self:flex-start; padding:11px 22px; font-size:13px; border-radius:10px;}
.request-sent-toast{font-size:12px; color:var(--teal);}

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
</style>
