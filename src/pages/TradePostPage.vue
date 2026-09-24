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
    <div class="d-eyebrow">{{ post.category }}</div>
    <div class="trade-title-line">
      <span class="trade-title-icon" v-if="linkedItem">
        <img v-if="iconUrlFor(linkedItem.icon_key)" :src="iconUrlFor(linkedItem.icon_key)" alt="" />
      </span>
      <h1 class="d-name trade-post-title">{{ post.itemName }}</h1>
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
        v-model="reqMessage" class="request-textarea" rows="3"
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
.trade-detail-wrap{max-width:720px;}
.trade-title-line{display:flex; align-items:center; gap:12px; margin:10px 0 8px;}
.trade-title-icon{
  width:44px; height:44px; flex:none; display:flex; align-items:center; justify-content:center;
  background:var(--panel-2); border:1px solid var(--border-soft);
}
.trade-title-icon img{width:100%; height:100%; object-fit:contain; image-rendering:pixelated;}
.trade-post-title{font-size:24px; margin:0;}
.trade-post-meta{font-size:12px; color:var(--text-dim); margin-bottom:18px;}

.status-select{
  font-size:12px; padding:6px 10px; border:1px solid var(--border); background:var(--panel); color:var(--text-dim);
  font-family:'Noto Sans KR', sans-serif; cursor:pointer;
}
.status-select.status-판매중{color:var(--gold); border-color:var(--gold-dim);}
.status-select.status-예약중{color:var(--teal); border-color:var(--teal);}
.status-select.status-거래완료{color:var(--text-dim); border-color:var(--border);}

.trade-info-card{border:1px solid var(--border-soft); background:var(--panel); padding:16px 18px; margin-bottom:22px; display:flex; flex-direction:column; gap:8px;}
.trade-info-row{display:flex; gap:10px; font-size:13px;}
.trade-info-row .k{color:var(--text-dim); flex:none; width:88px;}
.trade-info-row .v{color:var(--text);}

.trade-options-card{border:1px solid var(--border-soft); background:var(--panel); padding:14px 18px; margin-bottom:22px;}
.trade-options-card .d-section-title{margin-bottom:8px;}
.trade-option-line{font-size:12.5px; color:var(--text-muted); line-height:1.7;}

.trade-post-content{
  font-size:14px; line-height:1.8; color:var(--text);
  padding-bottom:20px; margin-bottom:16px; border-bottom:1px solid var(--border-soft);
}
.trade-post-content :deep(p){margin-bottom:8px;}
.trade-post-content :deep(ul){margin:8px 0 8px 20px;}

.request-list{margin-bottom:24px;}
.request-item{padding:12px 0; border-top:1px solid var(--border-soft);}
.request-item:first-child{border-top:none;}
.request-top{display:flex; align-items:center; gap:10px; font-size:12px; margin-bottom:5px;}
.request-top b{color:var(--gold-dim); font-weight:600;}
.request-qty{color:var(--teal); font-size:11px; border:1px solid var(--teal); padding:1px 7px;}
.request-date{color:var(--text-dim); margin-left:auto;}
.request-contact{font-size:11.5px; color:var(--text-dim); margin-bottom:4px;}
.request-message{font-size:13px; color:var(--text-muted); line-height:1.5;}

.request-form{display:flex; flex-direction:column; gap:10px; max-width:520px; position:relative;}
.request-form-row{display:flex; gap:8px;}
.request-qty-input{width:100px;}
.write-input{
  background:var(--panel); border:1px solid var(--border); color:var(--text); font-size:13px;
  padding:10px 12px; font-family:'Noto Sans KR', sans-serif;
}
.request-textarea{
  background:var(--panel); border:1px solid var(--border); color:var(--text); font-size:13px;
  padding:10px 12px; font-family:'Noto Sans KR', sans-serif; resize:vertical;
}
.write-submit{align-self:flex-start; padding:10px 20px; font-size:13px;}
.request-sent-toast{font-size:12px; color:var(--teal);}
</style>
