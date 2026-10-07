<script setup>
// 삽니다 - "이 아이템을 이런 조건으로 삽니다" 글 목록 + 쓰기 (027 SQL tb_trade_want)
// 조건이 맞는 판매글이 올라오면 글쓴이에게 알림 (DB가 판매글 등록 때 계산)
// 파는 사람은 여기서 살 사람을 찾아 쪽지를 보내거나, 판매글을 올리면 알아서 알림이 감
// ?new=1 쓰기 열기 (매물 검색 화면의 "이 조건으로 알림 받기"에서 item·cat·conds·realm·ladder·hc·game·eth 를 넘겨줌), ?mine=1 내 글
import { ref, computed, reactive, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  wantsState, loadWants, addWant, deleteWant, bumpWant, setWantNotify,
  wantLeftMs, canBumpWant, WANT_DAYS, WANT_MAX_CONDS,
} from '../wantsStore.js'
import {
  tradeState, loadTradePosts, searchAllItems, tradeCategoryForItem, getTradeItem, statFilterByKey,
  ALL_STAT_FILTERS, TRADE_STAT_FILTERS, TRADE_CATEGORIES, TRADE_REALMS, TRADE_LADDERS, TRADE_HARDCORE, GAME_VERSIONS,
  postStatValue, saleLeftMs,
} from '../tradeStore.js'
import { authState, signIn } from '../profileStore.js'
import { openConversationWith } from '../messagesStore.js'
import { openProfileCard } from '../profileCard.js'
import { askConfirm } from '../dialog.js'
import { ITEM_ICONS } from '../itemIcons.js'
import { t, itemName, locale } from '../i18n.js'
import { priceText } from '../tradeI18n.js'
import { statParts, statSearchTexts } from '../statDisplay.js'
import { useNow } from '../useNow.js'

const route = useRoute()
const router = useRouter()
const now = useNow(60000)
onMounted(() => { loadWants(); loadTradePosts() })

const iconUrl = (key) => (key && ITEM_ICONS[key]) || null
const wantItem = (w) => (w.itemId ? getTradeItem(w.itemId) : null)
const wantName = (w) => (w.itemId ? itemName(wantItem(w), w.itemName) : t(w.category))
const wantIcon = (w) => iconUrl(wantItem(w)?.icon_key)
const wantRarity = (w) => wantItem(w)?.category || ''
const isMine = (w) => !!authState.user && w.authorId === authState.user.id

// ───────── 목록 ─────────
const tab = ref(route.query.mine === '1' ? 'mine' : 'all')
watch(tab, (v) => router.replace({ query: { ...route.query, mine: v === 'mine' ? '1' : undefined } }))
const REGION_KEY = 'd2r-trade-region'
const region = ref((() => { try { const v = localStorage.getItem(REGION_KEY); return TRADE_REALMS.includes(v) ? v : '' } catch { return '' } })())
const query = ref(typeof route.query.q === 'string' ? route.query.q : '')
const squash = (s) => String(s || '').toLowerCase().replace(/\s+/g, '')

const list = computed(() => {
  const q = squash(query.value)
  return wantsState.list.filter((w) => {
    if (wantLeftMs(w, now.value) <= 0) return false
    if (tab.value === 'mine') return isMine(w)
    if (region.value && w.realm && w.realm !== region.value) return false
    if (q && !squash(wantName(w)).includes(q) && !squash(w.itemName).includes(q)) return false
    return true
  })
})
const myCount = computed(() => wantsState.list.filter((w) => isMine(w) && wantLeftMs(w, now.value) > 0).length)

// 지금 올라와 있는 매물 중 이 글 조건에 맞는 것 (DB 알림과 같은 규칙)
function condOk(p, c) {
  const st = statFilterByKey(c.key)
  if (!st) return true
  const v = postStatValue(p, c.key)
  if (v === null) return false
  return (c.min == null || v >= c.min) && (c.max == null || v <= c.max)
}
function matchingPosts(w) {
  return tradeState.posts.filter((p) =>
    p.status === '판매중' && saleLeftMs(p, now.value) > 0 && p.authorId !== w.authorId &&
    (w.itemId ? p.itemId === w.itemId : p.category === w.category) &&
    (!w.realm || p.realm === w.realm) && (!w.ladder || p.ladder === w.ladder) && (!w.hardcore || p.hardcore === w.hardcore) &&
    (!w.gameVersion || p.gameVersion === w.gameVersion) && (!w.ethereal || p.ethereal) &&
    w.conds.every((c) => condOk(p, c)))
}

const leftText = (w) => {
  const d = Math.ceil(wantLeftMs(w, now.value) / 86400000)
  return d > 1 ? t('{n}일 남음', { n: d }) : t('오늘까지')
}
function agoText(w) {
  const ms = now.value - new Date(w.bumpedAt).getTime()
  if (ms < 3600000) return t('방금')
  if (ms < 86400000) return t('{n}시간 전', { n: Math.floor(ms / 3600000) })
  return t('{n}일 전', { n: Math.floor(ms / 86400000) })
}
// "힘 X" + 15 이상 -> "힘 15 이상" (한국어는 X 자리를 빼고 수치를 뒤에, 영어는 "+X to Strength 15+")
const condText = (c) => {
  const st = statFilterByKey(c.key) || { label: c.label }
  let name = statParts(st).name
  let u = String(st.label || '').includes('(%)') ? '%' : ''
  if (c.min == null && c.max == null) return name
  if (locale.value === 'ko') name = name.replace(/ ?X(%?)/, (m, pct) => { if (pct) u = '%'; return '' }).trim()
  if (c.max == null) return `${name} ${t('{v} 이상', { v: c.min + u })}`
  if (c.min == null) return `${name} ${t('{v} 이하', { v: c.max + u })}`
  return `${name} ${c.min === c.max ? c.min + u : `${c.min}~${c.max}${u}`}`
}
const condTag = (c) => statParts(statFilterByKey(c.key)).tag
const serverText = (w) => [w.realm ? t(w.realm) : t('모든 지역'), w.gameVersion ? t(w.gameVersion) : '', w.ladder ? t(w.ladder) : '', w.hardcore ? t(w.hardcore) : ''].filter(Boolean).join(' · ')

const busy = ref(0)
const actionError = ref('')
async function run(w, fn) {
  actionError.value = ''
  busy.value = w.id
  try { await fn() } catch (e) { actionError.value = t(e.message || '실패') } finally { busy.value = 0 }
}
const toggleNotify = (w) => run(w, () => setWantNotify(w, !w.notify))
const bump = (w) => run(w, () => bumpWant(w))
async function remove(w) {
  if (!(await askConfirm(t('이 삽니다 글을 지울까? (구했으면 지우면 돼)')))) return
  run(w, () => deleteWant(w))
}
async function contact(w) {
  if (!authState.user) return signIn()
  run(w, async () => {
    const convId = await openConversationWith(w.authorId)
    router.push({ path: '/messages', query: { c: convId } })
  })
}

// ───────── 쓰기 ─────────
const formOpen = ref(route.query.new === '1')
const form = reactive({
  item: null, category: '', itemQuery: '', conds: [], statQuery: '',
  realm: '', ladder: '', hardcore: '', gameVersion: '', ethereal: false, price: '', memo: '', notify: true,
})
const formError = ref('')
const saving = ref(false)
const WANT_CATEGORIES = TRADE_CATEGORIES.filter((c) => c !== '골드')

// 매물 검색 화면에서 넘어온 조건으로 채움
function prefillFromQuery() {
  const q = route.query
  const it = typeof q.item === 'string' ? getTradeItem(q.item) : null
  if (it && tradeCategoryForItem(it) !== '골드') form.item = it
  if (!form.item && WANT_CATEGORIES.includes(q.cat)) form.category = q.cat
  try {
    const conds = typeof q.conds === 'string' ? JSON.parse(q.conds) : []
    form.conds = (Array.isArray(conds) ? conds : [])
      .filter((c) => c && statFilterByKey(c.key))
      .map((c) => ({ key: c.key, min: Number.isFinite(c.min) ? c.min : null, max: Number.isFinite(c.max) ? c.max : null }))
      .slice(0, WANT_MAX_CONDS)
  } catch { form.conds = [] }
  if (TRADE_REALMS.includes(q.realm)) form.realm = q.realm
  else form.realm = region.value
  if (TRADE_LADDERS.includes(q.ladder)) form.ladder = q.ladder
  if (TRADE_HARDCORE.includes(q.hc)) form.hardcore = q.hc
  if (GAME_VERSIONS.includes(q.game)) form.gameVersion = q.game
  form.ethereal = q.eth === '1'
}
prefillFromQuery()
function openForm() {
  if (!authState.user) return signIn()
  formOpen.value = true
}

const itemHits = computed(() => (form.itemQuery.trim() ? searchAllItems(form.itemQuery).filter((it) => tradeCategoryForItem(it) !== '골드').slice(0, 8) : []))
function pickItem(it) {
  form.item = it
  form.itemQuery = ''
}
// 옵션 후보 - 매물 검색 화면과 같은 목록 (자주 쓰는 묶음 먼저)
const STAT_CHOICES = (() => {
  const seen = new Set()
  const out = []
  for (const st of [...TRADE_STAT_FILTERS.filter((s) => !/입력값|가장 높은/.test(s.label)), ...ALL_STAT_FILTERS]) {
    const k = st.label.replace('(%)', '').replace(/[X%\s]/g, '')
    if (seen.has(k)) continue
    seen.add(k)
    out.push(st)
  }
  return out
})()
const statHits = computed(() => {
  const q = squash(form.statQuery)
  if (!q) return []
  return STAT_CHOICES.filter((st) => !form.conds.some((c) => c.key === st.key) && statSearchTexts(st).some((x) => squash(x).includes(q))).slice(0, 8)
})
function addCond(st) {
  if (form.conds.length >= WANT_MAX_CONDS) return
  form.conds.push({ key: st.key, min: null, max: null })
  form.statQuery = ''
}
const condName = (c) => statParts(statFilterByKey(c.key)).name
const num = (v) => (v === '' || v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Number(v))

async function save() {
  formError.value = ''
  if (!authState.user) return signIn()
  if (!form.item && !form.category) { formError.value = t('아이템이나 종류를 골라줘'); return }
  const conds = form.conds.map((c) => {
    let min = num(c.min), max = num(c.max)
    if (min !== null && max !== null && min > max) [min, max] = [max, min]
    return { key: c.key, min, max }
  })
  if (!form.item && !conds.length) { formError.value = t('종류로 찾을 땐 옵션 조건을 하나 이상 넣어줘'); return }
  saving.value = true
  try {
    await addWant({
      itemId: form.item?.id || null,
      itemName: form.item ? form.item.name_ko : form.category,
      category: form.item ? tradeCategoryForItem(form.item) : form.category,
      realm: form.realm, ladder: form.ladder, hardcore: form.hardcore, gameVersion: form.gameVersion,
      ethereal: form.ethereal, conds, price: form.price.trim(), memo: form.memo.trim(), notify: form.notify,
    })
    formOpen.value = false
    Object.assign(form, { item: null, category: '', itemQuery: '', conds: [], statQuery: '', ethereal: false, price: '', memo: '', notify: true })
    tab.value = 'mine'
    router.replace({ query: { mine: '1' } })
  } catch (e) {
    formError.value = t(e.message || '삽니다 글 등록 실패')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="items-page wants-page">
    <div class="patch-hero">
      <div class="patch-hero-inner">
        <div class="eyebrow">{{ $t('삽니다') }}</div>
        <h1>{{ $t('찾는 아이템을 올려두면, 매물이 올라올 때 알려줌') }}</h1>
        <p class="wt-sub">{{ $t('아이템·옵션 수치·서버를 정해두면 맞는 판매글이 올라오는 순간 알림 · 파는 사람은 여기서 살 사람을 찾음') }}</p>
        <div class="wt-hero-actions">
          <button type="button" class="wt-primary" @click="formOpen ? (formOpen = false) : openForm()">{{ formOpen ? $t('닫기') : '+ ' + $t('삽니다 글 쓰기') }}</button>
          <router-link class="wt-ghost" to="/">{{ $t('매물 검색으로') }}</router-link>
        </div>
      </div>
    </div>

    <div class="grid-wrap wt-wrap">
      <!-- 쓰기 -->
      <form class="wt-form" v-if="formOpen" @submit.prevent="save">
        <div class="wt-row">
          <span class="wt-label">{{ $t('아이템') }}</span>
          <div class="wt-field">
            <div class="wt-picked" v-if="form.item">
              <span class="wt-icon sm" :class="form.item.category"><img v-if="iconUrl(form.item.icon_key)" :src="iconUrl(form.item.icon_key)" alt="" /></span>
              <b :class="form.item.category">{{ $itemName(form.item) }}</b>
              <button type="button" class="wt-x" :aria-label="$t('아이템 빼기')" @click="form.item = null">×</button>
            </div>
            <template v-else>
              <div class="wt-search">
                <input v-model="form.itemQuery" class="write-input" :placeholder="$t('아이템 이름 (예: 수수께끼, 베르 룬, 샤코)')" :aria-label="$t('아이템 이름')" autocomplete="off" />
                <div class="wt-hits" v-if="itemHits.length">
                  <button type="button" v-for="it in itemHits" :key="it.id" @click="pickItem(it)">
                    <span class="wt-icon sm" :class="it.category"><img v-if="iconUrl(it.icon_key)" :src="iconUrl(it.icon_key)" alt="" /></span>
                    <span :class="it.category">{{ $itemName(it) }}</span><small>{{ $t(tradeCategoryForItem(it)) }}</small>
                  </button>
                </div>
              </div>
              <div class="wt-or">
                <span>{{ $t('또는 종류로 (옵션 조건 필요)') }}</span>
                <select v-model="form.category" class="write-select" :aria-label="$t('종류')">
                  <option value="">{{ $t('종류 고르기') }}</option>
                  <option v-for="c in WANT_CATEGORIES" :key="c" :value="c">{{ $t(c) }}</option>
                </select>
              </div>
            </template>
          </div>
        </div>

        <div class="wt-row">
          <span class="wt-label">{{ $t('옵션 조건') }}</span>
          <div class="wt-field">
            <div class="wt-cond" v-for="(c, i) in form.conds" :key="c.key">
              <span class="wt-cond-name">{{ condName(c) }}</span>
              <span class="stat-tag" v-if="condTag(c)" :style="{ '--tag': condTag(c).color }">{{ condTag(c).text }}</span>
              <input type="number" v-model="c.min" class="write-input wt-num" :placeholder="$t('최소')" :aria-label="`${condName(c)} ${$t('최소')}`" />
              <span class="wt-sep">~</span>
              <input type="number" v-model="c.max" class="write-input wt-num" :placeholder="$t('최대')" :aria-label="`${condName(c)} ${$t('최대')}`" />
              <button type="button" class="wt-x" :aria-label="`${condName(c)} ×`" @click="form.conds.splice(i, 1)">×</button>
            </div>
            <div class="wt-search" v-if="form.conds.length < WANT_MAX_CONDS">
              <input v-model="form.statQuery" class="write-input" :placeholder="$t('옵션 추가 (예: 시전 속도, 모든 저항, 힘)')" :aria-label="$t('옵션 추가')" autocomplete="off" />
              <div class="wt-hits" v-if="statHits.length">
                <button type="button" v-for="st in statHits" :key="st.key" @click="addCond(st)">
                  <span>{{ statParts(st).name }}</span>
                  <span class="stat-tag" v-if="statParts(st).tag" :style="{ '--tag': statParts(st).tag.color }">{{ statParts(st).tag.text }}</span>
                  <small>{{ statParts(st).hint }}</small>
                </button>
              </div>
            </div>
            <p class="wt-help">{{ $t('범위를 비우면 옵션이 붙어 있기만 하면 됨 · 최대 {n}개 · 전부 맞아야 알림', { n: WANT_MAX_CONDS }) }}</p>
          </div>
        </div>

        <div class="wt-row">
          <span class="wt-label">{{ $t('서버') }}</span>
          <div class="wt-field wt-selects">
            <select v-model="form.realm" class="write-select" :aria-label="$t('지역 서버')">
              <option value="">{{ $t('모든 지역') }}</option>
              <option v-for="r in TRADE_REALMS" :key="r" :value="r">{{ $t(r) }}</option>
            </select>
            <select v-model="form.gameVersion" class="write-select" :aria-label="$t('게임')">
              <option value="">{{ $t('모든 게임 모드') }}</option>
              <option v-for="g in GAME_VERSIONS" :key="g" :value="g">{{ $t(g) }}</option>
            </select>
            <select v-model="form.ladder" class="write-select" :aria-label="$t('래더')">
              <option value="">{{ $t('레더·논레더 전체') }}</option>
              <option v-for="l in TRADE_LADDERS" :key="l" :value="l">{{ $t(l) }}</option>
            </select>
            <select v-model="form.hardcore" class="write-select" :aria-label="$t('모드')">
              <option value="">{{ $t('일반·하드코어 전체') }}</option>
              <option v-for="h in TRADE_HARDCORE" :key="h" :value="h">{{ $t(h) }}</option>
            </select>
            <label class="wt-check"><input type="checkbox" v-model="form.ethereal" /> {{ $t('에테리얼만') }}</label>
          </div>
        </div>

        <div class="wt-row">
          <span class="wt-label">{{ $t('생각하는 가격') }}</span>
          <div class="wt-field">
            <input v-model="form.price" class="write-input" maxlength="60" :placeholder="$t('예: 베르 2개, 이스트 3개 (비워도 됨)')" :aria-label="$t('생각하는 가격')" />
          </div>
        </div>
        <div class="wt-row">
          <span class="wt-label">{{ $t('메모') }}</span>
          <div class="wt-field">
            <textarea v-model="form.memo" class="write-input" rows="2" maxlength="300" :placeholder="$t('예: 거래 가능 시간, 함께 사고 싶은 것 (비워도 됨)')" :aria-label="$t('메모')"></textarea>
          </div>
        </div>
        <div class="wt-row">
          <span class="wt-label"></span>
          <div class="wt-field">
            <label class="wt-check"><input type="checkbox" v-model="form.notify" /> {{ $t('맞는 매물이 올라오면 알림 받기') }}</label>
            <p class="wt-help">{{ $t('{n}일 동안 보이고, 하루에 한 번 끌어올릴 수 있음', { n: WANT_DAYS }) }}</p>
          </div>
        </div>
        <div class="wt-actions">
          <span class="wt-error" v-if="formError">{{ formError }}</span>
          <button type="submit" class="wt-primary" :disabled="saving">{{ saving ? $t('올리는 중…') : $t('삽니다 글 올리기') }}</button>
        </div>
      </form>

      <!-- 목록 -->
      <div class="wt-bar">
        <div class="wt-tabs" role="tablist">
          <button type="button" role="tab" :aria-selected="tab === 'all'" :class="{ on: tab === 'all' }" @click="tab = 'all'">{{ $t('전체') }}</button>
          <button type="button" role="tab" :aria-selected="tab === 'mine'" :class="{ on: tab === 'mine' }" @click="authState.user ? (tab = 'mine') : signIn()">{{ $t('내 글') }}<span v-if="myCount"> {{ myCount }}</span></button>
        </div>
        <template v-if="tab === 'all'">
          <select v-model="region" class="write-select" :aria-label="$t('지역 서버')">
            <option value="">{{ $t('모든 지역') }}</option>
            <option v-for="r in TRADE_REALMS" :key="r" :value="r">{{ $t(r) }}</option>
          </select>
          <input v-model="query" class="write-input wt-filter" type="search" :placeholder="$t('아이템 이름으로 찾기')" :aria-label="$t('아이템 이름으로 찾기')" />
        </template>
      </div>
      <p class="wt-error" v-if="actionError">{{ actionError }}</p>
      <div class="wt-empty" v-if="wantsState.loading && !wantsState.loaded">{{ $t('불러오는 중…') }}</div>
      <div class="wt-empty" v-else-if="wantsState.error">{{ $t(wantsState.error) }}</div>
      <div class="wt-empty" v-else-if="!list.length">
        {{ tab === 'mine' ? $t('올린 삽니다 글이 없음') : $t('아직 삽니다 글이 없음 - 첫 글을 올려봐') }}
      </div>

      <div class="wt-list">
        <article class="wt-card" v-for="w in list" :key="w.id">
          <span class="wt-icon" :class="wantRarity(w)">
            <img v-if="wantIcon(w)" :src="wantIcon(w)" alt="" />
            <span v-else class="wt-icon-fallback" aria-hidden="true">{{ $t(w.category).slice(0, 1) }}</span>
          </span>
          <div class="wt-body">
            <div class="wt-title">
              <b :class="wantRarity(w)">{{ wantName(w) }}</b>
              <span class="ethereal-badge" v-if="w.ethereal">{{ $t('에테리얼') }}</span>
              <small v-if="w.itemId">{{ $t(w.category) }}</small>
            </div>
            <div class="wt-conds" v-if="w.conds.length">
              <span class="wt-chip" v-for="(c, i) in w.conds" :key="i">
                {{ condText(c) }}<span class="stat-tag" v-if="condTag(c)" :style="{ '--tag': condTag(c).color }">{{ condTag(c).text }}</span>
              </span>
            </div>
            <div class="wt-price" v-if="w.price"><span>{{ $t('생각하는 가격') }}</span> {{ priceText(w.price) }}</div>
            <p class="wt-memo" v-if="w.memo">{{ w.memo }}</p>
            <div class="wt-meta">
              {{ serverText(w) }} ·
              <button type="button" class="wt-author" @click="openProfileCard(w.authorId)">{{ w.author }}</button> ·
              {{ agoText(w) }} · {{ leftText(w) }}
              <router-link v-if="matchingPosts(w).length" class="wt-match" :to="w.itemId ? { path: '/', query: { item: w.itemId } } : `/trade/${matchingPosts(w)[0].id}`">
                {{ $t('지금 맞는 매물 {n}개', { n: matchingPosts(w).length }) }}
              </router-link>
            </div>
          </div>
          <div class="wt-side">
            <template v-if="isMine(w)">
              <button type="button" class="wt-btn" :class="{ on: w.notify }" :disabled="busy === w.id" :aria-pressed="w.notify" @click="toggleNotify(w)">{{ w.notify ? $t('알림 켜짐') : $t('알림 꺼짐') }}</button>
              <button type="button" class="wt-btn" :disabled="busy === w.id || !canBumpWant(w, now)" :title="canBumpWant(w, now) ? '' : $t('하루에 한 번')" @click="bump(w)">{{ $t('끌어올리기') }}</button>
              <button type="button" class="wt-btn danger" :disabled="busy === w.id" @click="remove(w)">{{ $t('삭제') }}</button>
            </template>
            <template v-else>
              <button type="button" class="wt-btn sell" :disabled="busy === w.id" @click="contact(w)">{{ $t('팔게요 (쪽지)') }}</button>
              <router-link class="wt-btn" :to="w.itemId ? { path: '/trade/new', query: { item: w.itemId } } : '/trade/new'">{{ $t('판매글 올리기') }}</router-link>
            </template>
          </div>
        </article>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wt-wrap{max-width:1040px;}
.wants-page h1{word-break:keep-all;}
.wt-sub{color:var(--text-muted); font-size:14px; margin:6px 0 0;}
.wt-hero-actions{display:flex; flex-wrap:wrap; gap:10px; margin-top:16px;}
.wt-primary{background:var(--gold); color:#1a1408; font-weight:800; font-size:13.5px; padding:10px 18px; border-radius:10px;}
.wt-primary:disabled{opacity:.6;}
.wt-ghost{border:1px solid var(--border); color:var(--text-muted); font-size:13px; padding:10px 16px; border-radius:10px;}
.wt-ghost:hover{color:var(--gold); border-color:var(--gold-dim);}

.write-select, .write-input{
  background:var(--panel-2); border:1px solid var(--border); color:var(--text); font-size:13px;
  padding:9px 12px; font-family:'Noto Sans KR', sans-serif; border-radius:10px; width:100%;
}
.write-select{width:auto;}
textarea.write-input{resize:vertical;}

/* 쓰기 */
.wt-form{background:var(--panel); border:1px solid var(--border-soft); border-radius:16px; padding:18px 20px; margin-bottom:24px; display:flex; flex-direction:column; gap:14px;}
.wt-row{display:grid; grid-template-columns:110px 1fr; gap:12px; align-items:start;}
.wt-label{font-size:12.5px; font-weight:700; color:var(--text-dim); padding-top:9px;}
.wt-field{display:flex; flex-direction:column; gap:8px; min-width:0;}
.wt-selects{flex-direction:row; flex-wrap:wrap; align-items:center;}
.wt-search{position:relative;}
.wt-hits{position:absolute; z-index:20; left:0; right:0; top:calc(100% + 4px); background:var(--panel); border:1px solid var(--border); border-radius:12px; padding:6px; box-shadow:0 12px 30px rgba(0,0,0,.4); max-height:320px; overflow:auto;}
.wt-hits button{display:flex; align-items:center; gap:8px; width:100%; text-align:left; padding:7px 10px; border-radius:8px; font-size:13px; color:var(--text);}
.wt-hits button:hover{background:var(--panel-2);}
.wt-hits small{margin-left:auto; font-size:11px; color:var(--text-dim);}
.wt-or{display:flex; flex-wrap:wrap; align-items:center; gap:8px; font-size:12px; color:var(--text-dim);}
.wt-picked{display:flex; align-items:center; gap:10px; font-size:14px;}
.wt-x{color:var(--text-dim); font-size:16px; padding:2px 8px; border-radius:6px;}
.wt-x:hover{color:var(--text); background:var(--panel-2);}
.wt-cond{display:flex; flex-wrap:wrap; align-items:center; gap:8px; padding:6px 10px; border:1px solid var(--border-soft); border-radius:10px; background:var(--panel-2);}
.wt-cond-name{font-size:13px; font-weight:600;}
.wt-num{width:84px; padding:6px 8px;}
.wt-cond .wt-num:first-of-type{margin-left:auto;}
.wt-sep{color:var(--text-dim);}
.wt-help{font-size:11.5px; color:var(--text-dim); margin:0;}
.wt-check{display:inline-flex; align-items:center; gap:6px; font-size:13px; color:var(--text-muted); cursor:pointer;}
.wt-check input{accent-color:var(--gold);}
.wt-actions{display:flex; align-items:center; justify-content:flex-end; gap:12px;}
.wt-error{color:#e0775f; font-size:12.5px;}

/* 목록 */
.wt-bar{display:flex; flex-wrap:wrap; align-items:center; gap:10px; margin-bottom:14px;}
.wt-tabs{display:inline-flex; border:1px solid var(--border); border-radius:999px; overflow:hidden; margin-right:auto;}
.wt-tabs button{padding:8px 16px; font-size:13px; font-weight:700; color:var(--text-muted);}
.wt-tabs button.on{background:var(--gold); color:#1a1408;}
.wt-filter{width:220px;}
.wt-empty{padding:40px 0; text-align:center; color:var(--text-dim); font-size:13px;}
.wt-list{display:flex; flex-direction:column; gap:10px;}
.wt-card{display:flex; gap:14px; align-items:flex-start; background:var(--panel); border:1px solid var(--border-soft); border-radius:14px; padding:14px 16px;}
.wt-icon{width:52px; height:52px; flex:none; display:flex; align-items:center; justify-content:center; background:var(--panel-2); border:1px solid var(--border); border-radius:10px;}
.wt-icon.sm{width:28px; height:28px; border-radius:6px;}
.wt-icon img{max-width:100%; max-height:100%; image-rendering:pixelated;}
.wt-icon.unique{border-color:var(--gold-dim);} .wt-icon.set{border-color:var(--green);} .wt-icon.runeword{border-color:var(--blood);} .wt-icon.gem,.wt-icon.uber,.wt-icon.worldstone{border-color:var(--teal);}
.wt-icon-fallback{color:var(--text-dim); font-weight:800;}
b.unique, span.unique{color:var(--gold);} b.set, span.set{color:var(--green);} b.runeword, span.runeword{color:#e0775f;} b.gem, span.gem{color:var(--teal);}
.wt-body{flex:1; min-width:0; display:flex; flex-direction:column; gap:6px;}
.wt-title{display:flex; flex-wrap:wrap; align-items:center; gap:8px; font-size:15px;}
.wt-title small{font-size:11.5px; color:var(--text-dim);}
.wt-conds{display:flex; flex-wrap:wrap; gap:6px;}
.wt-chip{display:inline-flex; align-items:center; font-size:12px; color:#DDE3FF; background:#1C2645; border:1px solid #4A5FA8; border-radius:999px; padding:3px 10px;}
.wt-price{font-size:13px; color:var(--text);}
.wt-price span{font-size:11.5px; color:var(--text-dim); margin-right:4px;}
.wt-memo{font-size:12.5px; color:var(--text-muted); margin:0; white-space:pre-wrap; word-break:break-word;}
.wt-meta{font-size:11.5px; color:var(--text-dim); display:flex; flex-wrap:wrap; align-items:center; gap:4px;}
.wt-author{color:var(--text-muted); font-size:11.5px; padding:0;}
.wt-author:hover{color:var(--gold); text-decoration:underline;}
.wt-match{margin-left:6px; color:var(--teal); border:1px solid var(--teal); border-radius:999px; padding:1px 9px; font-weight:700;}
.wt-side{display:flex; flex-direction:column; gap:6px; flex:none;}
.wt-btn{font-size:12px; font-weight:700; color:var(--text-muted); border:1px solid var(--border); border-radius:8px; padding:6px 12px; text-align:center; white-space:nowrap; background:transparent;}
.wt-btn:hover:not(:disabled){color:var(--text); border-color:var(--gold-dim);}
.wt-btn:disabled{opacity:.45; cursor:default;}
.wt-btn.on{color:var(--gold); border-color:var(--gold-dim);}
.wt-btn.sell{color:#1a1408; background:var(--gold); border-color:var(--gold);}
.wt-btn.danger:hover:not(:disabled){color:#e0775f; border-color:#e0775f;}
.ethereal-badge{font-size:10px; padding:2px 10px; border:1px solid var(--teal); color:var(--teal); border-radius:999px;}
.stat-tag{display:inline-flex; align-items:center; margin-left:6px; padding:1px 8px; font-size:11px; font-weight:700; border-radius:999px; color:var(--tag); border:1px solid var(--tag); background:color-mix(in srgb, var(--tag) 14%, transparent); white-space:nowrap;}

@media (max-width:640px){
  .wt-row{grid-template-columns:1fr; gap:6px;}
  .wt-label{padding-top:0;}
  .wt-card{flex-wrap:wrap; padding:12px;}
  .wt-icon{width:42px; height:42px;}
  .wt-side{flex-direction:row; flex-wrap:wrap; width:100%;}
  .wt-filter{width:100%;}
  .wt-cond .wt-num:first-of-type{margin-left:0;}
}
</style>
