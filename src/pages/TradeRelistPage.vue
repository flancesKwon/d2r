<script setup>
// 재등록 (/trade/:id/relist) - 판매 기간(7일)이 끝난 내 판매중 글을 판매가만 고쳐서 다시 7일
// 아이템·옵션은 그대로 (바꾸려면 새 글). 실제 확인(주인·기간·가격)은 DB 함수 d2r_relist_trade_post
import { showAlert } from '../dialog.js'
import { t, itemName, affixText } from '../i18n.js'
import { postName, countText, priceTok, priceText, saleLeftText } from '../tradeI18n.js'
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  getTradePost, fetchTradePost, relistTradePost, isSaleExpired, saleLeftMs, statusLabel, SALE_DAYS,
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
  if (!isOwner.value) return t('내 판매글만 재등록 가능')
  if (p.status !== '판매중') return t('{s} 글은 재등록 불가', { s: t(statusLabel(p.status)) })
  if (!isSaleExpired(p)) return t('판매 기간 남음 ({left}) - 끝난 뒤 재등록', { left: saleLeftText(saleLeftMs(p)) })
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
  if (!price) { error.value = t('판매가(룬·보석·재료) 하나 이상'); return }
  saving.value = true
  try {
    await relistTradePost(post.value, price)
    router.replace(`/trade/${post.value.id}`)
    showAlert(t('재등록 완료 - 판매 기간 7일 다시 시작'), { icon: 'success' })
  } catch (e) {
    error.value = t(e.message || '재등록 실패')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="items-page relist-page">
    <div class="patch-hero">
      <div class="patch-hero-inner">
        <div class="eyebrow">{{ $t('판매 기간 {n}일 다시 시작', { n: SALE_DAYS }) }}</div>
        <h1>{{ $t('재등록') }}</h1>
      </div>
    </div>

    <div class="grid-wrap relist-wrap">
      <div class="relist-login" v-if="!authState.user">
        <p>{{ $t('로그인 필요') }}</p>
        <button type="button" class="btn-primary" @click="signIn">{{ $t('로그인') }}</button>
      </div>
      <div class="empty-state" v-else-if="loading">{{ $t('불러오는 중…') }}</div>
      <div class="empty-state" v-else-if="!post">{{ $t('판매글 없음.') }} <router-link to="/trade">{{ $t('거래게시판으로') }}</router-link></div>
      <template v-else>
        <router-link class="relist-item" :to="`/trade/${post.id}`">
          <span class="relist-icon" :class="postRarity(post)"><img v-if="iconUrl(postIconKey(post))" :src="iconUrl(postIconKey(post))" alt="" /></span>
          <span class="relist-item-body">
            <b>{{ postName(post) }}</b>
            <small>{{ countText(post.amountLabel) }} · {{ $t(post.ladder) }} · {{ $t(post.hardcore) }} · {{ $t('{date} 등록', { date: post.date }) }}</small>
            <small class="relist-opts" v-if="post.options.length">{{ post.options.slice(0, 4).map(affixText).join(' · ') }}{{ post.options.length > 4 ? ' …' : '' }}</small>
          </span>
          <span class="relist-lock">{{ $t('아이템·옵션 그대로') }}</span>
        </router-link>

        <div class="relist-blocked" v-if="reason">{{ reason }}</div>

        <section class="relist-card" v-else>
          <div class="relist-title">{{ $t('판매가') }}</div>
          <div class="relist-old">
            <span>{{ $t('이전') }}</span>
            <span class="relist-old-price">
              <template v-for="(tk, i) in parsePriceTokens(post.price)" :key="i">
                <span class="price-icon" v-if="tk.item"><img v-if="iconUrl(tk.item.icon_key)" :src="iconUrl(tk.item.icon_key)" alt="" /></span>{{ priceTok(tk) }}
              </template>
            </span>
          </div>

          <div class="price-chips">
            <div class="price-chip" v-for="(p, i) in priceItems" :key="p.item.id">
              <span class="price-chip-icon"><img v-if="iconUrl(p.item.icon_key)" :src="iconUrl(p.item.icon_key)" alt="" /></span>
              <span class="price-chip-name">{{ itemName(p.item) }}</span>
              <button type="button" class="qty-btn" @click="p.qty = Math.max(1, Number(p.qty) - 1)" :aria-label="$t('하나 빼기')">−</button>
              <input type="number" min="1" v-model="p.qty" class="qty-input" :aria-label="itemName(p.item) + ' ' + $t('수량')" />
              <button type="button" class="qty-btn" @click="p.qty = Number(p.qty) + 1" :aria-label="$t('하나 더')">+</button>
              <button type="button" class="chip-del" @click="priceItems.splice(i, 1)" :aria-label="$t('빼기')">✕</button>
            </div>
            <div class="empty-state small" v-if="!priceItems.length">{{ $t('받을 룬·보석·재료 추가') }}</div>
          </div>

          <input type="search" :value="query" @input="query = $event.target.value" class="write-input" :placeholder="$t('룬·보석·재료 추가 (예: 이스트 룬, 파괴의 열쇠)')" :aria-label="$t('룬·보석·재료 검색')" />
          <div class="price-cands">
            <button type="button" class="price-cand" v-for="it in candidates" :key="it.id" @click="addItem(it)">
              <span class="price-chip-icon"><img v-if="iconUrl(it.icon_key)" :src="iconUrl(it.icon_key)" alt="" /></span>{{ itemName(it) }}
            </button>
          </div>

          <div class="relist-new" v-if="newPrice"><span>{{ $t('새 판매가') }}</span><b>{{ priceText(newPrice) }}</b></div>
          <div class="relist-new" v-else-if="post.offerOnly"><span>{{ $t('판매가') }}</span><b>{{ $t('비워 두면 계속 제안만 받기') }}</b></div>
          <div class="relist-error" v-if="error">{{ error }}</div>
          <div class="relist-actions">
            <router-link :to="`/trade/${post.id}`" class="relist-cancel">{{ $t('취소') }}</router-link>
            <button type="button" class="relist-submit" :disabled="saving" @click="submit">{{ saving ? $t('재등록 중…') : $t('재등록 · {n}일 판매', { n: SALE_DAYS }) }}</button>
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
