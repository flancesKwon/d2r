<script setup>
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { getTradePost, addTradeRequest, updateTradeStatus, getTradeItem, TRADE_STATUSES } from '../tradeStore.js'
import { renderMarkdown } from '../markdown.js'
import iconsData from '../data/icons.json'

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
</script>

<template>
  <div class="items-page trade-detail-page" v-if="post">
  <header>
    <div class="logo">
      <router-link to="/" style="display: flex; align-items: center; gap: 8px; color: inherit">
        <span class="logo-mark"></span>디아사전
      </router-link>
    </div>
    <div class="crumb">
      <router-link to="/">메인</router-link> / <router-link to="/trade">거래게시판</router-link> / <b>{{ post.category }}</b>
    </div>
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
        <select class="status-select" :class="'status-' + post.status" :value="post.status" @change="changeStatus">
          <option v-for="s in TRADE_STATUSES" :key="s" :value="s">{{ s }}</option>
        </select>
      </div>
      <div class="trade-post-meta">{{ post.author }} · {{ post.date }} · 조회 {{ post.views }}</div>

      <div class="trade-info-card">
        <div class="trade-info-row"><span class="k">수량 / 단위</span><span class="v">{{ post.amountLabel }}</span></div>
        <div class="trade-info-row"><span class="k">희망 가격</span><span class="v">{{ post.price }}</span></div>
        <div class="trade-info-row"><span class="k">서버</span><span class="v">{{ post.realm }} · {{ post.ladder }} · {{ post.hardcore }}</span></div>
        <div class="trade-info-row"><span class="k">연락처</span><span class="v">{{ post.contact || '게시글로 문의' }}</span></div>
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
          <b>{{ r.buyer }}</b><span class="request-qty">{{ r.qty }}개 신청</span><span class="request-date">{{ r.date }}</span>
        </div>
        <div class="request-contact" v-if="r.contact">연락처: {{ r.contact }}</div>
        <div class="request-message">{{ r.message }}</div>
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
.request-qty{color:var(--teal); font-size:11px; border:1px solid var(--teal); padding:2px 9px; border-radius:999px;}
.request-date{color:var(--text-dim); margin-left:auto;}
.request-contact{font-size:11.5px; color:var(--text-dim); margin-bottom:6px;}
.request-message{font-size:13px; color:var(--text-muted); line-height:1.7;}

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
</style>
