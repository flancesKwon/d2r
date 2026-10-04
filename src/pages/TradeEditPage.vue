<script setup>
// 판매글 수정 (/trade/:id/edit) - 판매중이고 대기·수락된 구매신청이 없을 때만 (019 SQL 이 다시 확인)
// 아이템·옵션 종류는 그대로 두고 수치만, 그리고 판매가·수량·제안만 받기·흥정·레더/하드코어·설명
// 판매 기간(48시간)은 그대로 - 수정해도 늘어나지 않음
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  getTradePost, fetchTradePost, fetchTradeRequests, updateTradePost, tradeEditBlockReason,
  CURRENCY_ITEMS, EXTRA_MATERIALS, itemLevelReq, postIconKey, postRarity, getTradeItem,
  TRADE_LADDERS, TRADE_HARDCORE, categoryHasQuantity, buildAmountLabel, GOLD_MAX,
} from '../tradeStore.js'
import { editableOptionLines, buildEditedLines } from '../tradeEdit.js'
import { buildTooltip } from '../itemTooltip.js'
import { itemMatchesQuery } from '../itemSearch.js'
import { ITEM_ICONS } from '../itemIcons.js'
import { authState, signIn } from '../profileStore.js'
import ItemTooltipCanvas from '../components/ItemTooltipCanvas.vue'
import RichEditor from '../components/RichEditor.vue'

const route = useRoute()
const router = useRouter()
const iconUrl = (key) => (key && ITEM_ICONS[key]) || null

const post = ref(getTradePost(route.params.id) || null)
const requests = ref([])
const loading = ref(true)
Promise.all([fetchTradePost(route.params.id), fetchTradeRequests(route.params.id).catch(() => [])])
  .then(([p, reqs]) => { if (p) post.value = p; requests.value = reqs })
  .catch(() => {})
  .finally(() => (loading.value = false))

const isOwner = computed(() => !!authState.user && post.value?.authorId === authState.user.id)
const reason = computed(() => {
  if (!post.value) return ''
  if (!isOwner.value) return '내 판매글만 수정 가능'
  return tradeEditBlockReason(post.value, requests.value)
})

// 폼 - 글을 처음 받았을 때 한 번 채움
const lines = ref([])
const form = ref({ qty: '', offerOnly: false, negotiable: false, ladder: '', hardcore: '', content: '' })
const priceItems = ref([])
const BY_NAME = new Map(CURRENCY_ITEMS.map((it) => [it.name_ko, it]))
function parsePrice(text) {
  return (text || '').split(' + ').map((part) => {
    const m = part.trim().match(/^(.+?) (\d+)개$/)
    const it = m && BY_NAME.get(m[1])
    return it ? { item: it, qty: Number(m[2]) } : null
  }).filter(Boolean)
}
let started = false
watch([post, loading], ([p, l]) => {
  if (!p || l || started) return
  started = true
  lines.value = editableOptionLines(p)
  priceItems.value = p.offerOnly ? [] : parsePrice(p.price)
  form.value = {
    qty: (p.amountLabel.match(/^([\d,]+)(?:개| 골드)$/)?.[1] || '').replace(/,/g, ''),
    offerOnly: p.offerOnly, negotiable: p.negotiable && !p.offerOnly,
    ladder: p.ladder, hardcore: p.hardcore, content: p.content || '',
  }
}, { immediate: true })

// 수량: 룬·보석·재료·골드 낱개 판매만 (묶음 판매 "3종 묶음"은 그대로)
const hasQty = computed(() => !!post.value && categoryHasQuantity(post.value.category) && /^[\d,]+(?:개| 골드)$/.test(post.value.amountLabel))
const amountLabel = computed(() => (hasQty.value ? buildAmountLabel(form.value.qty, post.value.category) : post.value?.amountLabel))

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

const edited = computed(() => buildEditedLines(lines.value))
const editableCount = computed(() => lines.value.filter((l) => l.editable).length)
const isOut = (p) => p.value === '' || !Number.isInteger(Number(p.value)) || Number(p.value) < p.min || Number(p.value) > p.max

// 바뀐 옵션 줄로 바로 보는 미리보기
const tooltip = computed(() => post.value && buildTooltip({
  item: getTradeItem(post.value.itemId), name: post.value.itemName, category: post.value.category, quality: post.value.quality,
  iconKey: postIconKey(post.value), options: edited.value.lines, ethereal: post.value.ethereal, amountLabel: amountLabel.value,
}))

const error = ref('')
const saving = ref(false)
async function submit() {
  error.value = ''
  if (edited.value.errors.length) { error.value = `게임에서 나올 수 없는 수치: ${edited.value.errors[0]}`; return }
  if (hasQty.value && !(Number(form.value.qty) > 0)) { error.value = post.value.category === '골드' ? '골드 액수 입력' : '개수 입력'; return }
  if (post.value.category === '골드' && Number(form.value.qty) > GOLD_MAX) { error.value = '골드는 한 글에 최대 1500만 골드까지'; return }
  if (!form.value.offerOnly && !newPrice.value) { error.value = '판매가(룬·보석·재료) 하나 이상 (또는 제안만 받기)'; return }
  saving.value = true
  try {
    await updateTradePost(post.value, {
      price: newPrice.value, options: edited.value.lines, amountLabel: amountLabel.value,
      offerOnly: form.value.offerOnly, negotiable: form.value.negotiable,
      ladder: form.value.ladder, hardcore: form.value.hardcore, contact: post.value.contact, content: form.value.content,
    })
    router.replace(`/trade/${post.value.id}`)
  } catch (e) {
    error.value = e.message || '수정 실패'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="items-page relist-page edit-page">
    <div class="patch-hero">
      <div class="patch-hero-inner">
        <div class="eyebrow">구매신청 들어오기 전까지 · 판매 기간은 그대로</div>
        <h1>판매글 수정</h1>
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
            <small>{{ post.category }} · {{ post.date }} 등록</small>
          </span>
          <span class="relist-lock">아이템은 그대로</span>
        </router-link>

        <div class="relist-blocked" v-if="reason">{{ reason }}</div>

        <template v-else>
          <section class="relist-card" v-if="lines.length">
            <div class="relist-title">옵션 수치 <small class="edit-sub">{{ editableCount ? '숫자 칸만 고칠 수 있음 · 범위 밖이면 저장 안 됨' : '고칠 수 있는 수치 없음' }}</small></div>
            <div class="edit-lines">
              <div class="edit-line" v-for="(l, i) in lines" :key="i" :class="{ locked: !l.editable }">
                <template v-for="(p, j) in l.parts" :key="j">
                  <span v-if="!('value' in p)">{{ p.text }}</span>
                  <input
                    v-else type="number" v-model="p.value" class="edit-num" :class="{ invalid: isOut(p), changed: Number(p.value) !== p.original }"
                    :min="p.min" :max="p.max" :title="`${p.min}~${p.max}`" :aria-label="`${l.text} 수치 ${p.min}~${p.max}`"
                  />
                </template>
                <small class="edit-range" v-if="l.editable">{{ l.parts.filter((p) => 'value' in p).map((p) => `${p.min}~${p.max}`).join(' / ') }}</small>
                <small class="edit-range" v-else>고정</small>
              </div>
            </div>
          </section>

          <section class="relist-card edit-preview" v-if="tooltip">
            <div class="relist-title">미리보기</div>
            <ItemTooltipCanvas :tooltip="tooltip" :file-name="post.itemName" />
          </section>

          <section class="relist-card">
            <div class="relist-title">판매 정보</div>
            <label class="edit-field" v-if="hasQty">
              <span>{{ post.category === '골드' ? '골드 액수' : '개수' }}</span>
              <input type="number" min="1" :max="post.category === '골드' ? GOLD_MAX : null" v-model="form.qty" class="write-input" />
            </label>
            <div class="edit-row">
              <select v-model="form.ladder" class="write-input" aria-label="레더">
                <option v-for="l in TRADE_LADDERS" :key="l" :value="l">{{ l }}</option>
              </select>
              <select v-model="form.hardcore" class="write-input" aria-label="하드코어">
                <option v-for="h in TRADE_HARDCORE" :key="h" :value="h">{{ h }}</option>
              </select>
            </div>
            <label class="edit-check"><input type="checkbox" v-model="form.offerOnly" /> 제안만 받기 <small>판매가 없이 가격 제안을 받음</small></label>
            <label class="edit-check" v-if="!form.offerOnly"><input type="checkbox" v-model="form.negotiable" /> 흥정 가능</label>

            <template v-if="!form.offerOnly">
              <div class="relist-title small-title">판매가</div>
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
              <input type="search" v-model="query" class="write-input" placeholder="룬·보석·재료 추가 (예: 이스트 룬, 파괴의 열쇠)" aria-label="룬·보석·재료 검색" />
              <div class="price-cands">
                <button type="button" class="price-cand" v-for="it in candidates" :key="it.id" @click="addItem(it)">
                  <span class="price-chip-icon"><img v-if="iconUrl(it.icon_key)" :src="iconUrl(it.icon_key)" alt="" /></span>{{ it.name_ko }}
                </button>
              </div>
            </template>

            <div class="relist-title small-title">설명</div>
            <RichEditor v-model="form.content" placeholder="추가 설명 (옵션 정보, 거래 방식 등)" min-height="160px" />

            <div class="relist-error" v-if="error">{{ error }}</div>
            <div class="relist-actions">
              <router-link :to="`/trade/${post.id}`" class="relist-cancel">취소</router-link>
              <button type="button" class="relist-submit" :disabled="saving" @click="submit">{{ saving ? '저장 중…' : '수정 저장' }}</button>
            </div>
          </section>
        </template>
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
.relist-lock{font-size:11px; color:var(--text-dim); border:1px solid var(--border); border-radius:999px; padding:3px 10px; flex:none;}
.relist-blocked{padding:18px; text-align:center; color:var(--text-muted); background:var(--panel); border:1px solid var(--border-soft); border-radius:16px; font-size:13.5px;}
.relist-card{display:flex; flex-direction:column; gap:14px; padding:20px 22px; background:var(--panel); border:1px solid var(--gold-dim); border-radius:16px;}
.relist-title{font-family:'Noto Serif KR', serif; font-weight:700; font-size:16px;}
.small-title{font-size:14px; margin-top:4px;}
.edit-sub{font-family:'Noto Sans KR', sans-serif; font-weight:400; font-size:11.5px; color:var(--text-dim); margin-left:6px;}
.edit-preview{align-items:center; border-color:var(--border-soft);}
.edit-preview .relist-title{align-self:stretch;}

.edit-lines{display:flex; flex-direction:column; gap:6px;}
.edit-line{display:flex; align-items:center; flex-wrap:wrap; gap:4px; padding:8px 12px; background:var(--panel-2); border:1px solid var(--border); border-radius:10px; font-size:13.5px; color:#8c8cff;}
.edit-line.locked{color:var(--text-dim);}
.edit-num{width:64px; text-align:center; background:var(--panel); border:1px solid var(--border); color:var(--text); border-radius:8px; padding:4px; font-size:13.5px;}
.edit-num.changed{border-color:var(--gold-dim); color:var(--gold);}
.edit-num.invalid{border-color:var(--blood); box-shadow:0 0 0 1px var(--blood);}
.edit-range{margin-left:auto; font-size:11px; color:var(--text-dim);}

.edit-field{display:flex; flex-direction:column; gap:6px; font-size:12px; color:var(--text-dim);}
.edit-row{display:flex; gap:10px;}
.edit-row > *{flex:1;}
.edit-check{display:flex; align-items:center; gap:8px; font-size:13px; color:var(--gold-dim); cursor:pointer;}
.edit-check input{accent-color:var(--gold-dim);}
.edit-check small{color:var(--text-dim); font-size:11.5px;}

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
