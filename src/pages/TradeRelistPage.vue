<script setup>
// 재등록 (/trade/:id/relist) - 판매 기간(48시간)이 끝난 내 판매중 글을 판매가만 고쳐서 다시 48시간
// 아이템·옵션은 그대로 (바꾸려면 새 글). 실제 확인(주인·기간·가격)은 DB 함수 d2r_relist_trade_post
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  getTradePost, fetchTradePost, relistTradePost, isSaleExpired, saleLeftMs, fmtSaleLeft, SALE_HOURS,
  CURRENCY_ITEMS, EXTRA_MATERIALS, itemLevelReq, postIconKey, postRarity, parsePriceTokens, OFFER_ONLY_PRICE,
} from '../tradeStore.js'
import { itemMatchesQuery } from '../itemSearch.js'
import { ITEM_ICONS } from '../itemIcons.js'
import { authState, signIn } from '../profileStore.js'

const route = useRoute()
const router = useRouter()
const iconUrl = (key) => (key && ITEM_ICONS[key]) || null

const post = ref(getTradePost(route.params.id) || null)
const loading = ref(!post.value)
fetchTradePost(route.params.id).then((p) => { if (p) post.value = p }).catch(() => {}).finally(() => (loading.value = false))

const isOwner = computed(() => !!authState.user && post.value?.authorId === authState.user.id)
const canRelist = computed(() => isOwner.value && post.value?.status === '판매중' && isSaleExpired(post.value))
const reason = computed(() => {
  const p = post.value
  if (!p) return ''
  if (!isOwner.value) return '내 판매글만 재등록 가능'
  if (p.status !== '판매중') return `${p.status} 글은 재등록 불가`
  if (!isSaleExpired(p)) return `판매 기간 남음 (${fmtSaleLeft(saleLeftMs(p))}) - 끝난 뒤 재등록`
  return ''
})

// 판매가: 기존 "베르 룬 2개 + 이스트 룬 1개" 를 칩으로 풀어서 개수만 고치거나 더하고 빼기
const BY_NAME = new Map(CURRENCY_ITEMS.map((it) => [it.name_ko, it]))
function parsePrice(text) {
  return (text || '').split(' + ').map((part) => {
    const m = part.trim().match(/^(.+?) (\d+)개$/)
    const it = m && BY_NAME.get(m[1])
    return it ? { item: it, qty: Number(m[2]) } : null
  }).filter(Boolean)
}
const priceItems = ref([])
let started = false
watch(post, (p) => { if (p && !started) { priceItems.value = parsePrice(p.price); started = true } }, { immediate: true })
const query = ref('')
const RUNES_HIGH_FIRST = CURRENCY_ITEMS.filter((it) => it.type_sub === '룬').sort((a, b) => (itemLevelReq(b) ?? 0) - (itemLevelReq(a) ?? 0))
const candidates = computed(() => (query.value.trim() ? CURRENCY_ITEMS.filter((it) => itemMatchesQuery(it, query.value)) : [...RUNES_HIGH_FIRST.slice(0, 12), ...EXTRA_MATERIALS]).slice(0, 24))
function addItem(it) {
  const ex = priceItems.value.find((p) => p.item.id === it.id)
  if (ex) ex.qty += 1
  else priceItems.value.push({ item: it, qty: 1 })
  query.value = ''
}
const newPrice = computed(() => priceItems.value.filter((p) => Number(p.qty) > 0).map((p) => `${p.item.name_ko} ${Number(p.qty)}개`).join(' + '))

const error = ref('')
const saving = ref(false)
async function submit() {
  error.value = ''
  // 제안만 받기 글은 판매가를 비워 두면 그대로 제안만 받음
  const price = newPrice.value || (post.value.offerOnly ? OFFER_ONLY_PRICE : '')
  if (!price) { error.value = '판매가(룬·보석·재료) 하나 이상'; return }
  saving.value = true
  try {
    await relistTradePost(post.value, price)
    router.replace(`/trade/${post.value.id}`)
  } catch (e) {
    error.value = e.message || '재등록 실패'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="items-page relist-page">
    <div class="patch-hero">
      <div class="patch-hero-inner">
        <div class="eyebrow">판매 기간 {{ SALE_HOURS }}시간 다시 시작</div>
        <h1>재등록</h1>
      </div>
    </div>

    <div class="grid-wrap relist-wrap">
      <div class="relist-login" v-if="!authState.user">
        <p>로그인 필요</p>
        <button type="button" class="btn-primary" @click="signIn">로그인</button>
      </div>
      <div class="empty-state" v-else-if="loading">불러오는 중…</div>
      <div class="empty-state" v-else-if="!post">판매글 없음. <router-link to="/trade">거래게시판으로</router-link></div>
      <template v-else>
        <router-link class="relist-item" :to="`/trade/${post.id}`">
          <span class="relist-icon" :class="postRarity(post)"><img v-if="iconUrl(postIconKey(post))" :src="iconUrl(postIconKey(post))" alt="" /></span>
          <span class="relist-item-body">
            <b>{{ post.itemName }}</b>
            <small>{{ post.amountLabel }} · {{ post.ladder }} · {{ post.hardcore }} · {{ post.date }} 등록</small>
            <small class="relist-opts" v-if="post.options.length">{{ post.options.slice(0, 4).join(' · ') }}{{ post.options.length > 4 ? ' …' : '' }}</small>
          </span>
          <span class="relist-lock">아이템·옵션 그대로</span>
        </router-link>

        <div class="relist-blocked" v-if="reason">{{ reason }}</div>

        <section class="relist-card" v-else>
          <div class="relist-title">판매가</div>
          <div class="relist-old">
            <span>이전</span>
            <span class="relist-old-price">
              <template v-for="(t, i) in parsePriceTokens(post.price)" :key="i">
                <span class="price-icon" v-if="t.item"><img v-if="iconUrl(t.item.icon_key)" :src="iconUrl(t.item.icon_key)" alt="" /></span>{{ t.text }}
              </template>
            </span>
          </div>

          <div class="price-chips">
            <div class="price-chip" v-for="(p, i) in priceItems" :key="p.item.id">
              <span class="price-chip-icon"><img v-if="iconUrl(p.item.icon_key)" :src="iconUrl(p.item.icon_key)" alt="" /></span>
              <span class="price-chip-name">{{ p.item.name_ko }}</span>
              <button type="button" class="qty-btn" @click="p.qty = Math.max(1, Number(p.qty) - 1)" aria-label="하나 빼기">−</button>
              <input type="number" min="1" v-model="p.qty" class="qty-input" :aria-label="p.item.name_ko + ' 개수'" />
              <button type="button" class="qty-btn" @click="p.qty = Number(p.qty) + 1" aria-label="하나 더">+</button>
              <button type="button" class="chip-del" @click="priceItems.splice(i, 1)" aria-label="빼기">✕</button>
            </div>
            <div class="empty-state small" v-if="!priceItems.length">받을 룬·보석·재료 추가</div>
          </div>

          <input type="search" :value="query" @input="query = $event.target.value" class="write-input" placeholder="룬·보석·재료 추가 (예: 이스트 룬, 파괴의 열쇠)" aria-label="룬·보석·재료 검색" />
          <div class="price-cands">
            <button type="button" class="price-cand" v-for="it in candidates" :key="it.id" @click="addItem(it)">
              <span class="price-chip-icon"><img v-if="iconUrl(it.icon_key)" :src="iconUrl(it.icon_key)" alt="" /></span>{{ it.name_ko }}
            </button>
          </div>

          <div class="relist-new" v-if="newPrice"><span>새 판매가</span><b>{{ newPrice }}</b></div>
          <div class="relist-new" v-else-if="post.offerOnly"><span>판매가</span><b>비워 두면 계속 제안만 받기</b></div>
          <div class="relist-error" v-if="error">{{ error }}</div>
          <div class="relist-actions">
            <router-link :to="`/trade/${post.id}`" class="relist-cancel">취소</router-link>
            <button type="button" class="relist-submit" :disabled="saving" @click="submit">{{ saving ? '재등록 중…' : `재등록 · ${SALE_HOURS}시간 판매` }}</button>
          </div>
        </section>
      </template>
    </div>
  </div>
</template>

<style scoped>
.relist-wrap{max-width:760px; display:flex; flex-direction:column; gap:16px;}
.relist-login{display:flex; flex-direction:column; align-items:center; gap:14px; padding:48px 16px; color:var(--text-muted);}
.relist-item{display:flex; align-items:center; gap:14px; padding:16px 18px; background:var(--panel); border:1px solid var(--border-soft); border-radius:16px;}
.relist-item:hover{border-color:var(--gold-dim);}
.relist-icon{width:52px; height:52px; flex:none; display:flex; align-items:center; justify-content:center; background:var(--panel-2); border:1px solid var(--border); border-radius:12px;}
.relist-icon img{max-width:100%; max-height:100%; image-rendering:pixelated;}
.relist-icon.unique{border-color:var(--gold-dim);} .relist-icon.set{border-color:var(--green);} .relist-icon.runeword{border-color:var(--blood);}
.relist-item-body{display:flex; flex-direction:column; gap:3px; min-width:0; flex:1;}
.relist-item-body b{font-size:15px; color:var(--text);}
.relist-item-body small{font-size:12px; color:var(--text-dim);}
.relist-opts{overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.relist-lock{font-size:11px; color:var(--text-dim); border:1px solid var(--border); border-radius:999px; padding:3px 10px; flex:none;}
.relist-blocked{padding:18px; text-align:center; color:var(--text-muted); background:var(--panel); border:1px solid var(--border-soft); border-radius:16px; font-size:13.5px;}

.relist-card{display:flex; flex-direction:column; gap:14px; padding:20px 22px; background:var(--panel); border:1px solid var(--gold-dim); border-radius:16px;}
.relist-title{font-family:'Noto Serif KR', serif; font-weight:700; font-size:16px;}
.relist-old{display:flex; gap:12px; font-size:13px; color:var(--text-dim);}
.relist-old-price{color:var(--text-muted); text-decoration:line-through;}
.price-icon{display:inline-flex; width:15px; height:15px; vertical-align:-3px; margin:0 2px 0 3px;}
.price-icon img{width:100%; height:100%; object-fit:contain; image-rendering:pixelated;}

.price-chips{display:flex; flex-direction:column; gap:8px;}
.price-chip{display:flex; align-items:center; gap:8px; padding:8px 10px; background:var(--panel-2); border:1px solid var(--border); border-radius:12px;}
.price-chip-icon{width:24px; height:24px; flex:none; display:inline-flex; align-items:center; justify-content:center;}
.price-chip-icon img{max-width:100%; max-height:100%; image-rendering:pixelated;}
.price-chip-name{flex:1; font-size:13.5px; color:var(--text);}
.qty-btn{width:30px; height:30px; border:1px solid var(--border); border-radius:8px; color:var(--text-muted); font-size:16px;}
.qty-btn:hover{border-color:var(--gold-dim); color:var(--gold);}
.qty-input{width:56px; text-align:center; background:var(--panel); border:1px solid var(--border); color:var(--text); border-radius:8px; padding:6px 4px; font-size:14px;}
.chip-del{color:var(--text-dim); padding:4px 8px;}
.chip-del:hover{color:#e0775f;}
.empty-state.small{padding:10px; font-size:12.5px;}

.write-input{background:var(--panel-2); border:1px solid var(--border); color:var(--text); font-size:13px; padding:11px 14px; border-radius:10px; font-family:'Noto Sans KR', sans-serif;}
.price-cands{display:flex; flex-wrap:wrap; gap:6px;}
.price-cand{display:inline-flex; align-items:center; gap:4px; font-size:12.5px; color:var(--text-muted); border:1px solid var(--border); border-radius:999px; padding:3px 12px 3px 6px;}
.price-cand:hover{border-color:var(--gold-dim); color:var(--gold);}
.price-cand .price-chip-icon{width:20px; height:20px;}

.relist-new{display:flex; gap:12px; align-items:baseline; padding:12px 14px; border-radius:12px; background:rgba(200,163,77,0.08); font-size:13px; color:var(--text-dim);}
.relist-new b{color:var(--gold); font-size:14.5px;}
.relist-error{font-size:12.5px; color:#e0775f;}
.relist-actions{display:flex; gap:10px; justify-content:flex-end;}
.relist-cancel{padding:12px 20px; font-size:13.5px; color:var(--text-muted); border:1px solid var(--border); border-radius:10px;}
.relist-submit{padding:12px 24px; font-size:14px; font-weight:700; color:#1a1408; background:var(--gold); border-radius:10px;}
.relist-submit:disabled{opacity:.6;}
@media (max-width:760px){
  .relist-lock{display:none;}
  .relist-actions{flex-direction:column-reverse;}
  .relist-actions > *{text-align:center;}
}
</style>
