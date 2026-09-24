<script setup>
import { ref, computed } from 'vue'
import {
  tradeState,
  TRADE_CATEGORIES,
  TRADE_STATUSES,
  TRADE_REALMS,
  TRADE_LADDERS,
  TRADE_HARDCORE,
  UNIT_PRESETS,
  addTradePost,
} from '../tradeStore.js'
import MarkdownEditor from '../components/MarkdownEditor.vue'

const activeCat = ref(null)
const activeStatus = ref(null)
const searchQuery = ref('')
const showForm = ref(false)

const emptyForm = () => ({
  category: TRADE_CATEGORIES[0],
  itemName: '',
  amountLabel: '',
  price: '',
  realm: TRADE_REALMS[0],
  ladder: TRADE_LADDERS[0],
  hardcore: TRADE_HARDCORE[0],
  author: '',
  contact: '',
  content: '',
})
const form = ref(emptyForm())

const unitOptions = computed(() => UNIT_PRESETS[form.value.category] || ['1개'])

const filteredPosts = computed(() => {
  let list = tradeState.posts
  if (activeCat.value) list = list.filter((p) => p.category === activeCat.value)
  if (activeStatus.value) list = list.filter((p) => p.status === activeStatus.value)
  const q = searchQuery.value.trim().toLowerCase()
  if (q) {
    list = list.filter(
      (p) => p.itemName.toLowerCase().includes(q) || p.content.toLowerCase().includes(q)
    )
  }
  return [...list].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
})

function submitPost() {
  if (!form.value.itemName.trim() || !form.value.amountLabel.trim() || !form.value.price.trim()) return
  addTradePost({ ...form.value })
  form.value = emptyForm()
  showForm.value = false
}
</script>

<template>
  <div class="items-page trade-page">
  <header>
    <div class="logo">
      <router-link to="/" style="display: flex; align-items: center; gap: 8px; color: inherit">
        <span class="logo-mark"></span>디아사전
      </router-link>
    </div>
    <div class="crumb"><router-link to="/">메인</router-link> / <b>거래게시판</b></div>
  </header>

  <div class="patch-hero">
    <div class="patch-hero-inner">
      <div class="eyebrow">유저 간 아이템 거래</div>
      <h1>거래게시판</h1>
      <p>룬·퍼펙트 보석·우버보스 재료 등 판매자가 직접 단위를 정해 올리고, 구매자가 구매신청을 보내는 게시판이에요.</p>
    </div>
  </div>

  <div class="toolbar">
    <div class="toolbar-inner">
      <div class="cat-tabs">
        <button :class="{ active: activeCat === null }" @click="activeCat = null">전체</button>
        <button v-for="c in TRADE_CATEGORIES" :key="c" :class="{ active: activeCat === c }" @click="activeCat = c">
          {{ c }}
        </button>
      </div>
      <div class="search-row">
        <div class="search-input-wrap">
          <input type="text" v-model="searchQuery" placeholder="아이템명·내용 검색" aria-label="거래글 검색" />
        </div>
        <select v-model="activeStatus" class="sort-select">
          <option :value="null">전체 상태</option>
          <option v-for="s in TRADE_STATUSES" :key="s" :value="s">{{ s }}</option>
        </select>
        <span class="result-count">{{ filteredPosts.length }}개</span>
        <button class="quality-toggle" @click="showForm = !showForm">{{ showForm ? '취소' : '판매글 등록' }}</button>
      </div>
    </div>
  </div>

  <div class="quality-info" v-if="showForm">
    <div class="quality-info-inner write-form trade-write-form">
      <div class="trade-form-row">
        <select v-model="form.category" class="write-select">
          <option v-for="c in TRADE_CATEGORIES" :key="c" :value="c">{{ c }}</option>
        </select>
        <input type="text" v-model="form.itemName" placeholder="아이템명 (예: 이스 룬, 쉐이코)" class="write-input trade-item-input" />
      </div>

      <div class="trade-form-row">
        <input
          type="text" v-model="form.amountLabel" placeholder="판매 수량/단위 (예: 5개, 10개입 묶음, 1스택(40개입), 3세트)"
          class="write-input trade-unit-input" list="trade-unit-presets"
        />
        <datalist id="trade-unit-presets">
          <option v-for="u in unitOptions" :key="u" :value="u" />
        </datalist>
      </div>
      <div class="unit-hint">수량과 단위를 자유롭게 정해서 적으면 돼요. 예: "{{ unitOptions.join('", "') }}"</div>

      <input type="text" v-model="form.price" placeholder="희망 가격 / 교환 조건 (예: 1개당 30만 FG, 이스 룬 교환)" class="write-input" />

      <div class="trade-form-row">
        <select v-model="form.realm" class="write-select trade-meta-select">
          <option v-for="r in TRADE_REALMS" :key="r" :value="r">{{ r }}</option>
        </select>
        <select v-model="form.ladder" class="write-select trade-meta-select">
          <option v-for="l in TRADE_LADDERS" :key="l" :value="l">{{ l }}</option>
        </select>
        <select v-model="form.hardcore" class="write-select trade-meta-select">
          <option v-for="h in TRADE_HARDCORE" :key="h" :value="h">{{ h }}</option>
        </select>
      </div>

      <div class="trade-form-row">
        <input type="text" v-model="form.author" placeholder="닉네임 (비우면 익명)" class="write-input" />
        <input type="text" v-model="form.contact" placeholder="연락처 (배틀태그, 디스코드 등)" class="write-input" />
      </div>

      <MarkdownEditor v-model="form.content" placeholder="추가 설명을 입력하세요 (옵션 정보, 거래 방식 등)" min-height="90px" />

      <button class="btn-primary write-submit" @click="submitPost">등록하기</button>
    </div>
  </div>

  <div class="grid-wrap trade-list-wrap">
    <div class="trade-list">
      <router-link class="trade-row" v-for="p in filteredPosts" :key="p.id" :to="`/trade/${p.id}`">
        <span class="trade-cat">{{ p.category }}</span>
        <div class="trade-body">
          <div class="trade-title-row">
            <span class="trade-title">{{ p.itemName }}</span>
            <span class="trade-status-badge" :class="'status-' + p.status">{{ p.status }}</span>
          </div>
          <div class="trade-meta">
            {{ p.amountLabel }} · {{ p.price }}
          </div>
          <div class="trade-sub-meta">
            {{ p.realm }} · {{ p.ladder }} · {{ p.hardcore }} · {{ p.author }} · {{ p.date }}
          </div>
        </div>
        <span class="trade-request-count" v-if="p.requests.length">신청 {{ p.requests.length }}</span>
      </router-link>
      <div class="empty-state" v-if="filteredPosts.length === 0">등록된 판매글이 없어요</div>
    </div>
  </div>
  </div>
</template>

<style scoped>
.sort-select{
  background:var(--panel); border:1px solid var(--border); color:var(--text-muted); font-size:12.5px;
  padding:9px 10px; font-family:'Noto Sans KR', sans-serif;
}

.write-form{display:flex; flex-direction:column; gap:10px; max-width:560px;}
.write-select, .write-input{
  background:var(--panel); border:1px solid var(--border); color:var(--text); font-size:13px;
  padding:10px 12px; font-family:'Noto Sans KR', sans-serif;
}
.write-select{width:120px;}
.write-submit{align-self:flex-start; padding:10px 20px; font-size:13px;}

.trade-form-row{display:flex; gap:8px;}
.trade-item-input{flex:1;}
.trade-unit-input{flex:1;}
.trade-meta-select{flex:1; width:auto;}
.unit-hint{font-size:11px; color:var(--text-dim); margin-top:-4px;}

.trade-list-wrap{max-width:900px;}
.trade-list{display:flex; flex-direction:column;}
.trade-row{
  display:flex; align-items:flex-start; gap:14px; padding:16px 4px; border-bottom:1px solid var(--border-soft);
  transition:background .1s;
}
.trade-row:hover{background:var(--panel);}
.trade-cat{font-size:11px; color:var(--gold-dim); border:1px solid var(--border); padding:3px 9px; flex:none; margin-top:1px;}
.trade-body{flex:1; min-width:0;}
.trade-title-row{display:flex; align-items:center; gap:8px; margin-bottom:4px;}
.trade-title{font-size:14px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.trade-status-badge{font-size:10px; padding:2px 8px; border:1px solid var(--border); flex:none; color:var(--text-dim);}
.trade-status-badge.status-판매중{color:var(--gold); border-color:var(--gold-dim);}
.trade-status-badge.status-예약중{color:var(--teal); border-color:var(--teal);}
.trade-status-badge.status-거래완료{color:var(--text-dim); border-color:var(--border);}
.trade-meta{font-size:12.5px; color:var(--text-muted); margin-bottom:4px;}
.trade-sub-meta{font-size:11.5px; color:var(--text-dim);}
.trade-request-count{font-size:11.5px; color:var(--text-muted); border:1px solid var(--border); padding:2px 8px; flex:none; margin-top:1px;}
</style>
