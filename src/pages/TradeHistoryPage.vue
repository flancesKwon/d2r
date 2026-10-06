<script setup>
// 아이템별 거래내역 - 한 아이템(사전 아이템은 id, 사전에 없는 아이템은 판매글 제목)의 판매글을
// 판매중·예약중·거래완료까지 전부 모아서 최근 거래 가격과 함께 보여줌.
// ?item=<사전 id> 또는 ?name=<판매글 제목>, 둘 다 없으면 거래가 있는 아이템 목록
import { ref, computed, watch, reactive } from 'vue'
import { useAutoRefresh } from '../useAutoRefresh.js'
import { useRoute, useRouter } from 'vue-router'
import {
  getTradeItem,
  statusLabel,
  tradePriceOf,
  parsePriceTokens,
  postIconKey,
  postRarity,
  searchAllItems,
  tradePostsForItem,
  tradedItemSummaries,
  loadTradePosts,
  TRADE_REALMS,
  TRADE_LADDERS,
  TRADE_HARDCORE,
  TRADE_STAT_FILTERS,
  postStatValue,
  getItemAffixes,
  isRollRangeAffix,
  isRandomClassSkillAffix,
  CLASS_SKILL_NAMES,
  isSaleExpired,
} from '../tradeStore.js'
import { ITEM_ICONS } from '../itemIcons.js'
import { t, locale, itemName, affixText } from '../i18n.js'
import { postName, countText, priceTok, priceText } from '../tradeI18n.js'

const route = useRoute()
loadTradePosts()
useAutoRefresh(() => loadTradePosts(true))
const router = useRouter()
const iconUrl = (key) => (key && ITEM_ICONS[key]) || null

const itemId = computed(() => (typeof route.query.item === 'string' ? route.query.item : ''))
const freeName = computed(() => (typeof route.query.name === 'string' ? route.query.name : ''))
const item = computed(() => (itemId.value ? getTradeItem(itemId.value) : null))
const title = computed(() => (item.value ? itemName(item.value) : freeName.value))
const hasTarget = computed(() => !!title.value)

const region = ref('')
const ladder = ref('')
const hardcore = ref('')
const status = ref('')
// 고른 변동 옵션 {옵션 key: 값}
const picks = reactive({})
const clearPicks = () => Object.keys(picks).forEach((k) => delete picks[k])
watch(() => route.fullPath, () => { region.value = ''; ladder.value = ''; hardcore.value = ''; status.value = ''; clearPicks() })

const allPosts = computed(() => (hasTarget.value ? tradePostsForItem({ itemId: item.value?.id, name: freeName.value }) : []))
// 판매 기간이 끝난 판매중 글은 '기간 만료'
// 변동 옵션 값·조합 이름 (한국어로 만든 문구) -> 지금 언어
const tv = (x) => {
  if (typeof x !== 'string' || locale.value === 'ko') return x
  const a = affixText(x)
  if (a !== x) return a
  const m = /^(\S+) \+(\d+)$/.exec(x)
  return m ? `${t(m[1])} +${m[2]}` : t(x)
}
const statusOf = (p) => (isSaleExpired(p) ? '기간 만료' : p.status)
const STATUS_TABS = ['판매중', '예약중', '거래완료', '기간 만료']

// ---- 변동 옵션: 같은 아이템이라도 옵션 수치(굴림)·직업·베이스·소켓·에테리얼에 따라 값이 다름
// 사전 아이템은 범위 옵션(모든 저항 +10~20% 등)마다, 사전에 없는 아이템(매직·레어)은 주요 옵션 수치마다
const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const CLASS_RE = new RegExp(`^(${Object.values(CLASS_SKILL_NAMES).join('|')}) 기술 레벨 \\+(\\d+)`)
const valueIn = (re) => (p) => { for (const l of p.options) { const m = re.exec(l); if (m) return Number(m[1]) } return null }
const varDefs = computed(() => {
  const defs = []
  const it = item.value
  if (it) {
    for (const a of getItemAffixes(it)) {
      if (isRandomClassSkillAffix(a)) {
        defs.push({ key: 'class', label: '직업 기술', get: (p) => { for (const l of p.options) { const m = CLASS_RE.exec(l); if (m) return `${m[1]} +${m[2]}` } return null }, show: (v) => v })
      } else if (isRollRangeAffix(a)) {
        const [pre, post] = a.text.split(`${a.min}~${a.max}`)
        defs.push({ key: 'a:' + a.text, label: a.text, num: true, get: valueIn(new RegExp('^' + esc(pre) + '(-?\\d+)' + esc(post) + '$')), show: (v) => pre + v + post })
      }
    }
  } else {
    for (const st of TRADE_STAT_FILTERS) {
      const pct = /\(%\)$/.test(st.label)
      defs.push({ key: 's:' + st.key, label: st.label, num: true, get: (p) => postStatValue(p, st.key), show: (v) => `${st.label.replace(/\s*\(.*\)$/, '')} ${v}${pct ? '%' : ''}` })
    }
  }
  defs.push({ key: 'base', label: '베이스', get: (p) => p.options.map((l) => l.match(/^베이스: (.+?)(?: \(|$)/)?.[1]).find(Boolean) || null, show: (v) => v })
  if (it) defs.push({ key: 'sockets', label: '소켓', num: true, get: (p) => postStatValue(p, 'sockets'), show: (v) => `소켓 ${v}개` })
  defs.push({ key: 'eth', label: '에테리얼', get: (p) => (p.ethereal ? '에테리얼' : '일반'), show: (v) => v })
  defs.push({ key: 'unid', label: '미확인', get: (p) => (p.unidentified ? '미확인' : '확인'), show: (v) => v })
  // 글들 사이에 실제로 값이 있는 것만 (굴림 옵션·직업은 하나라도, 나머지는 2가지 이상일 때)
  return defs.map((d) => {
    const counts = new Map()
    for (const p of allPosts.value) { const v = d.get(p); if (v !== null && v !== undefined) counts.set(v, (counts.get(v) || 0) + 1) }
    const values = [...counts.entries()].sort((x, y) => (d.num ? y[0] - x[0] : y[1] - x[1])).map(([v, n]) => ({ v, n }))
    return { ...d, values }
  }).filter((d) => d.values.length >= (d.key.startsWith('a:') || d.key === 'class' ? 1 : 2))
})
function togglePick(d, v) { if (picks[d.key] === v) delete picks[d.key]; else picks[d.key] = v }
const pickedCount = computed(() => Object.keys(picks).length)
const matchPicks = (p) => varDefs.value.every((d) => !(d.key in picks) || d.get(p) === picks[d.key])

const posts = computed(() =>
  allPosts.value.filter((p) => (!region.value || p.realm === region.value) && (!ladder.value || p.ladder === ladder.value) && (!hardcore.value || p.hardcore === hardcore.value) && matchPicks(p))
)
const shownPosts = computed(() => posts.value.filter((p) => !status.value || statusOf(p) === status.value))
const statusCount = (t) => posts.value.filter((p) => statusOf(p) === t).length
// 글마다 변동 옵션 값 칩 (고른 값은 금색)
const varChips = (p) => varDefs.value.map((d) => {
  const v = d.get(p)
  return v === null || v === undefined || (d.key === 'eth' && v === '일반') || (d.key === 'unid' && v === '확인') ? null : { key: d.key, text: tv(d.show(v)), on: picks[d.key] === v }
}).filter(Boolean)

// ---- 옵션 조합별 시세: 변동 옵션 값이 같은 글끼리 묶어서 판매중·거래완료 수와 최근 거래가
const groups = computed(() => {
  if (!varDefs.value.length) return []
  const byKey = new Map()
  for (const p of posts.value) {
    const vals = varDefs.value.map((d) => d.get(p) ?? null)
    const key = JSON.stringify(vals)
    const g = byKey.get(key) || {
      key, vals, selling: 0, done: 0, lastDone: null, lastSelling: null,
      label: varDefs.value.map((d, i) => (vals[i] === null ? null : tv(d.show(vals[i])))).filter(Boolean).join(' · ') || t('옵션 정보 없음'),
    }
    const st = statusOf(p)
    if (st === '판매중') { g.selling++; if (!g.lastSelling) g.lastSelling = p }
    if (st === '거래완료') { g.done++; if (!g.lastDone) g.lastDone = p }
    byKey.set(key, g)
  }
  return [...byKey.values()].sort((a, b) => b.done - a.done || b.selling - a.selling).slice(0, 15)
})
function applyGroup(g) {
  clearPicks()
  varDefs.value.forEach((d, i) => { if (g.vals[i] !== null) picks[d.key] = g.vals[i] })
}
const counts = computed(() => ({
  total: posts.value.length,
  selling: posts.value.filter((p) => statusOf(p) === '판매중').length,
  reserved: posts.value.filter((p) => p.status === '예약중').length,
  done: posts.value.filter((p) => p.status === '거래완료').length,
  requests: posts.value.reduce((n, p) => n + (p.requests?.length || 0), 0),
}))
const completed = computed(() => posts.value.filter((p) => p.status === '거래완료').slice(0, 5))
const headerIcon = computed(() => iconUrl(item.value?.icon_key) || iconUrl(allPosts.value[0] && postIconKey(allPosts.value[0])))
const headerRarity = computed(() => item.value?.category || (allPosts.value[0] && postRarity(allPosts.value[0])) || '')

// ---- 아이템을 고르기 전: 검색 + 거래가 있는 아이템 목록
const query = ref('')
const summaries = computed(() => tradedItemSummaries())
const searchHits = computed(() => (query.value.trim() ? searchAllItems(query.value).slice(0, 8) : []))
function openItem(it) {
  router.push({ path: '/trade/history', query: it.itemId || it.id ? { item: it.itemId || it.id } : { name: it.name } })
  query.value = ''
}
const summaryIcon = (s) => iconUrl(s.iconKey)
// 묶음 판매(베르 1개 + 이스트 2개)는 가격이 묶음 전체 값이라 표시해 둠. 빈 칸은 빼고 이어 붙임
const doneMeta = (p) => [(p.itemName || '').includes(' + ') ? t('묶음') + ': ' + priceText(p.itemName) : '', countText(p.amountLabel), t(p.ladder), t(p.hardcore), p.completedAt || p.date].filter(Boolean).join(' · ')
// 요약 목록의 아이템 이름
const summaryName = (s) => (s.itemId ? itemName(getTradeItem(s.itemId), s.name) : s.name)
</script>

<template>
  <div class="items-page trade-history-page">
    <div class="patch-hero">
      <div class="patch-hero-inner">
        <div class="eyebrow">{{ $t('아이템별 거래내역') }}</div>
        <template v-if="hasTarget">
          <div class="th-head">
            <span class="th-icon" :class="headerRarity"><img v-if="headerIcon" :src="headerIcon" alt="" /></span>
            <div>
              <h1>{{ title }}</h1>
              <p v-if="item"><template v-if="locale === 'ko'">{{ item.name_en }} · </template><template v-if="item.category_label">{{ $t(item.category_label) }}</template></p>
            </div>
          </div>
          <div class="th-links">
            <router-link to="/trade/history">{{ $t('← 다른 아이템') }}</router-link>
            <router-link v-if="item && item.category !== 'uber' && item.category !== 'essence'" :to="`/items/${item.id}`">{{ $t('아이템 사전에서 보기') }}</router-link>
            <router-link :to="item ? { path: '/trade', query: { item: item.id } } : { path: '/trade', query: { q: title } }">{{ $t('거래게시판에서 찾기') }}</router-link>
          </div>
        </template>
        <template v-else>
          <h1>{{ $t('아이템별 거래내역') }}</h1>
          
        </template>
      </div>
    </div>

    <div class="grid-wrap th-wrap">
      <template v-if="hasTarget">
        <div class="th-filters">
          <select v-model="region" class="write-select" :aria-label="$t('지역 서버')">
            <option value="">{{ $t('모든 지역') }}</option>
            <option v-for="r in TRADE_REALMS" :key="r" :value="r">{{ $t(r) }}</option>
          </select>
          <select v-model="ladder" class="write-select" :aria-label="$t('레더 구분')">
            <option value="">{{ $t('레더·논레더 전체') }}</option>
            <option v-for="l in TRADE_LADDERS" :key="l" :value="l">{{ $t(l) }}</option>
          </select>
          <select v-model="hardcore" class="write-select" :aria-label="$t('하드코어 구분')">
            <option value="">{{ $t('일반·하드코어 전체') }}</option>
            <option v-for="h in TRADE_HARDCORE" :key="h" :value="h">{{ $t(h) }}</option>
          </select>
        </div>

        <section class="th-vars" v-if="varDefs.length">
          <div class="th-vars-head">
            <div class="d-section-title">{{ $t('변동 옵션') }}</div>
            <button type="button" class="th-reset" v-if="pickedCount" @click="clearPicks">{{ $t('선택 해제') }} ({{ pickedCount }})</button>
          </div>
          <div class="th-var" v-for="d in varDefs" :key="d.key">
            <span class="th-var-label">{{ tv(d.label) }}</span>
            <span class="th-var-chips">
              <button
                type="button" class="th-chip" v-for="o in d.values" :key="String(o.v)"
                :class="{ on: picks[d.key] === o.v }" :aria-pressed="picks[d.key] === o.v" @click="togglePick(d, o.v)"
              >{{ tv(o.v) }}<small>{{ o.n }}</small></button>
            </span>
          </div>
        </section>

        <div class="th-stats">
          <div class="th-stat"><b>{{ counts.total }}</b><span>{{ $t('전체 판매글') }}</span></div>
          <div class="th-stat"><b>{{ counts.selling }}</b><span>{{ $t('판매중') }}</span></div>
          <div class="th-stat"><b>{{ counts.reserved }}</b><span>{{ $t('거래중') }}</span></div>
          <div class="th-stat"><b>{{ counts.done }}</b><span>{{ $t('거래완료') }}</span></div>
          <div class="th-stat"><b>{{ counts.requests }}</b><span>{{ $t('구매신청') }}</span></div>
        </div>

        <section class="th-section" v-if="groups.length > 1 || (groups.length === 1 && !pickedCount)">
          <div class="d-section-title">{{ $t('옵션 조합별 시세') }}</div>
          <div class="th-groups">
            <div class="th-group th-group-head"><span>{{ $t('옵션') }}</span><span class="th-group-n">{{ $t('판매중') }}</span><span class="th-group-n">{{ $t('거래완료') }}</span><span class="th-group-price">{{ $t('최근 거래가') }}</span></div>
            <button type="button" class="th-group" v-for="g in groups" :key="g.key" @click="applyGroup(g)" :title="$t('이 조합만 보기')">
              <span class="th-group-label">{{ g.label }}</span>
              <span class="th-group-n">{{ g.selling }}</span>
              <span class="th-group-n done">{{ g.done }}</span>
              <span class="th-group-price">
                <template v-if="g.lastDone">
                  <template v-for="(tk, i) in parsePriceTokens(tradePriceOf(g.lastDone) || $t('거래가 미기록'))" :key="i">
                    <span class="price-icon" v-if="tk.item"><img v-if="iconUrl(tk.item.icon_key)" :src="iconUrl(tk.item.icon_key)" alt="" /></span>{{ priceTok(tk) }}
                  </template>
                </template>
                <span class="th-dim" v-else-if="g.lastSelling">{{ $t('희망') }} {{ priceText(g.lastSelling.price) }}</span>
                <span class="th-dim" v-else>-</span>
              </span>
            </button>
          </div>
        </section>

        <section class="th-section" v-if="completed.length">
          <div class="d-section-title">{{ $t('최근 거래완료 가격') }}</div>
          <div class="th-done-list">
            <div class="th-done" v-for="p in completed" :key="p.id">
              <span class="th-price">
                <template v-for="(tk, i) in parsePriceTokens(tradePriceOf(p) || $t('거래가 미기록'))" :key="i">
                  <span class="price-icon" v-if="tk.item"><img v-if="iconUrl(tk.item.icon_key)" :src="iconUrl(tk.item.icon_key)" alt="" /></span>{{ priceTok(tk) }}
                </template>
              </span>
              <span class="th-chips" v-if="varChips(p).length"><span class="th-mini" v-for="c in varChips(p)" :key="c.key" :class="{ on: c.on }">{{ c.text }}</span></span>
              <span class="th-done-meta">{{ doneMeta(p) }}</span>
            </div>
          </div>
        </section>

        <section class="th-section">
          <div class="th-list-head">
            <div class="d-section-title">{{ $t('판매글') }}</div>
            <div class="th-tabs" role="tablist" :aria-label="$t('판매 상태')">
              <button type="button" role="tab" :aria-selected="!status" :class="{ on: !status }" @click="status = ''">{{ $t('전체') }} {{ posts.length }}</button>
              <button type="button" role="tab" v-for="t in STATUS_TABS" :key="t" :aria-selected="status === t" :class="{ on: status === t }" @click="status = t">{{ $t(statusLabel(t)) }} {{ statusCount(t) }}</button>
            </div>
          </div>
          <div class="th-list">
            <router-link class="th-row" v-for="p in shownPosts" :key="p.id" :to="`/trade/${p.id}`">
              <span class="trade-status-badge" :class="'status-' + statusOf(p)">{{ $t(statusLabel(statusOf(p))) }}</span>
              <div class="th-row-body">
                <div class="th-row-title">{{ postName(p) }}<span class="ethereal-badge" v-if="p.ethereal">{{ $t('에테리얼') }}</span></div>
                <div class="th-row-price">
                  {{ countText(p.amountLabel) }} ·<template v-if="p.status === '거래완료'"> {{ $t('거래가') }}</template>
                  <template v-for="(tk, i) in parsePriceTokens(tradePriceOf(p) || $t('거래가 미기록'))" :key="i">
                    <span class="price-icon" v-if="tk.item"><img v-if="iconUrl(tk.item.icon_key)" :src="iconUrl(tk.item.icon_key)" alt="" /></span>{{ priceTok(tk) }}
                  </template>
                </div>
                <div class="th-chips" v-if="varChips(p).length"><span class="th-mini" v-for="c in varChips(p)" :key="c.key" :class="{ on: c.on }">{{ c.text }}</span></div>
                <div class="th-row-meta">{{ $t(p.realm) }} · {{ $t(p.ladder) }} · {{ $t(p.hardcore) }} · {{ p.author }} · {{ $t('{date} 등록', { date: p.date }) }}<template v-if="p.completedAt"> · {{ $t('거래완료') }} {{ p.completedAt }}</template></div>
              </div>
              <span class="th-req" v-if="p.requests && p.requests.length">{{ $t('신청') }} {{ p.requests.length }}</span>
            </router-link>
            <div class="empty-state" v-if="!shownPosts.length">
              {{ $t('거래내역 없음.') }} <router-link to="/trade/new">{{ $t('판매글 등록하기') }}</router-link>
            </div>
          </div>
        </section>
      </template>

      <template v-else>
        <div class="th-search">
          <input :value="query" @input="query = $event.target.value" type="search" class="write-input" :placeholder="$t('아이템 검색 (예: 베르 룬, 할리퀸 관모, 파괴의 열쇠)')" :aria-label="$t('아이템 검색')" />
          <div class="th-search-hits" v-if="searchHits.length">
            <button type="button" class="th-hit" v-for="it in searchHits" :key="it.id" @click="openItem(it)">
              <span class="th-hit-icon" :class="it.category"><img v-if="iconUrl(it.icon_key)" :src="iconUrl(it.icon_key)" alt="" /></span>
              <span>{{ itemName(it) }}</span><small>{{ $t(it.category_label) }}</small>
            </button>
          </div>
        </div>

        <div class="d-section-title">{{ $t('거래가 있는 아이템') }}</div>
        <div class="th-summary-grid">
          <button type="button" class="th-summary" v-for="s in summaries" :key="(s.itemId || '') + s.name" @click="openItem(s)">
            <span class="th-hit-icon"><img v-if="summaryIcon(s)" :src="summaryIcon(s)" alt="" /></span>
            <span class="th-summary-body">
              <span class="th-summary-name">{{ summaryName(s) }}</span>
              <span class="th-summary-meta">{{ $t('판매글') }} {{ s.total }} · {{ $t('거래완료') }} {{ s.done }} · {{ $t('최근') }} {{ s.lastDate }}</span>
            </span>
          </button>
          <div class="empty-state" v-if="!summaries.length">{{ $t('판매글 없음') }}</div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.th-wrap{max-width:1180px;}
.th-head{display:flex; align-items:center; gap:16px;}
.th-head p{margin:4px 0 0;}
.th-icon{width:64px; height:64px; flex:none; display:flex; align-items:center; justify-content:center; background:var(--panel-2); border:1px solid var(--border); border-radius:12px;}
.th-icon img{max-width:100%; max-height:100%; image-rendering:pixelated;}
.th-icon.unique{border-color:var(--gold-dim);} .th-icon.set{border-color:var(--green);} .th-icon.runeword{border-color:var(--blood);} .th-icon.gem,.th-icon.uber{border-color:var(--teal);}
.th-links{display:flex; flex-wrap:wrap; gap:8px 16px; margin-top:14px; font-size:12.5px;}
.th-links a{color:var(--gold-dim);}
.th-links a:hover{color:var(--gold);}

.th-filters{display:flex; gap:10px; flex-wrap:wrap; margin-bottom:16px;}
.write-select, .write-input{
  background:var(--panel-2); border:1px solid var(--border); color:var(--text); font-size:13px;
  padding:10px 14px; font-family:'Noto Sans KR', sans-serif; border-radius:10px;
}
.th-filters .write-select{min-width:180px;}
.th-stats{display:grid; grid-template-columns:repeat(5, 1fr); gap:10px; margin-bottom:28px;}
.th-stat{background:var(--panel); border:1px solid var(--border-soft); border-radius:12px; padding:14px 16px; display:flex; flex-direction:column; gap:4px;}
.th-stat b{font-size:22px; color:var(--gold); font-family:'Noto Serif KR', serif;}
.th-stat span{font-size:12px; color:var(--text-dim);}

.th-section{margin-bottom:28px;}

/* 변동 옵션 */
.th-vars{background:var(--panel); border:1px solid var(--border-soft); border-radius:16px; padding:16px 18px; margin-bottom:20px; display:flex; flex-direction:column; gap:10px;}
.th-vars-head{display:flex; align-items:center; justify-content:space-between;}
.th-vars-head .d-section-title{margin:0;}
.th-reset{font-size:12px; color:var(--gold); border:1px solid var(--gold-dim); border-radius:999px; padding:4px 12px;}
.th-var{display:grid; grid-template-columns:minmax(140px, 260px) 1fr; gap:12px; align-items:start; padding-top:10px; border-top:1px solid var(--border-soft);}
.th-var-label{font-size:12.5px; color:var(--text-muted); line-height:1.5; padding-top:4px;}
.th-var-chips{display:flex; flex-wrap:wrap; gap:6px;}
.th-chip{display:inline-flex; align-items:center; gap:6px; font-size:12.5px; color:var(--text-muted); border:1px solid var(--border); border-radius:999px; padding:4px 12px;}
.th-chip small{font-size:10.5px; color:var(--text-dim);}
.th-chip:hover{border-color:var(--gold-dim); color:var(--gold);}
.th-chip.on{background:var(--gold); border-color:var(--gold); color:#1a1408; font-weight:700;}
.th-chip.on small{color:#1a1408;}

/* 옵션 조합별 시세 */
.th-groups{display:flex; flex-direction:column; border:1px solid var(--border-soft); border-radius:14px; overflow:hidden;}
.th-group{display:grid; grid-template-columns:minmax(0, 1.4fr) 64px 64px minmax(0, 1fr); gap:12px; align-items:center; padding:11px 16px; text-align:left; background:var(--panel); border-top:1px solid var(--border-soft); font-size:13px; color:var(--text);}
.th-group:first-child{border-top:0;}
button.th-group:hover{background:var(--panel-2);}
.th-group-head{font-size:11.5px; color:var(--text-dim); background:var(--panel-2);}
.th-group-n{text-align:center; color:var(--text-muted);}
.th-group-n.done{color:var(--gold); font-weight:700;}
.th-group-price{font-size:12.5px;}
.th-dim{color:var(--text-dim);}
.th-chips{display:flex; flex-wrap:wrap; gap:4px; margin:2px 0 6px;}
.th-done .th-chips{margin:0; flex:1;}
.th-mini{font-size:11px; color:var(--text-muted); border:1px solid var(--border); border-radius:6px; padding:1px 7px;}
.th-mini.on{color:var(--gold); border-color:var(--gold-dim);}

.th-list-head{display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; margin-bottom:12px;}
.th-list-head .d-section-title{margin:0;}
.th-tabs{display:flex; flex-wrap:wrap; gap:6px;}
.th-tabs button{font-size:12px; color:var(--text-muted); border:1px solid var(--border); border-radius:999px; padding:4px 12px;}
.th-tabs button.on{color:#1a1408; background:var(--gold); border-color:var(--gold); font-weight:700;}
.th-done-list{display:flex; flex-direction:column; gap:8px;}
.th-done{display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; padding:12px 16px; background:var(--panel); border:1px solid var(--border-soft); border-radius:12px;}
.th-price{font-size:14px; color:var(--text);}
.th-done-meta{font-size:11.5px; color:var(--text-dim);}

.th-list{display:flex; flex-direction:column; gap:10px;}
.th-row{display:flex; align-items:flex-start; gap:14px; padding:16px 18px; background:var(--panel); border:1px solid var(--border-soft); border-radius:14px;}
.th-row:hover{border-color:var(--gold-dim);}
.th-row-body{flex:1; min-width:0;}
.th-row-title{font-size:14px; margin-bottom:4px; display:flex; align-items:center; gap:8px; flex-wrap:wrap;}
.th-row-price{font-size:12.5px; color:var(--text-muted); margin-bottom:4px;}
.th-row-meta{font-size:11.5px; color:var(--text-dim); line-height:1.6;}
.th-req{font-size:11.5px; color:var(--text-muted); border:1px solid var(--border); padding:3px 10px; border-radius:999px; flex:none;}

.trade-status-badge{font-size:10px; padding:2px 10px; border:1px solid var(--border); flex:none; color:var(--text-dim); border-radius:999px; margin-top:2px;}
.trade-status-badge.status-판매중{color:var(--gold); border-color:var(--gold-dim);}
.trade-status-badge.status-예약중{color:var(--teal); border-color:var(--teal);}
.trade-status-badge.status-거래완료{color:#1a1408; background:var(--gold-dim); border-color:var(--gold-dim);}
.trade-status-badge[class*="만료"]{color:#e0775f; border-color:var(--blood);}
.ethereal-badge{font-size:10px; padding:2px 10px; border:1px solid var(--teal); color:var(--teal); border-radius:999px;}
.price-icon{display:inline-flex; width:15px; height:15px; vertical-align:-3px; margin:0 2px 0 3px;}
.price-icon img{width:100%; height:100%; object-fit:contain; image-rendering:pixelated;}

.th-search{position:relative; margin-bottom:28px;}
.th-search .write-input{width:100%;}
.th-search-hits{margin-top:8px; display:flex; flex-direction:column; gap:4px; background:var(--panel); border:1px solid var(--border-soft); border-radius:12px; padding:6px;}
.th-hit{display:flex; align-items:center; gap:10px; padding:8px 10px; border-radius:8px; text-align:left; font-size:13px; color:var(--text);}
.th-hit:hover{background:var(--panel-2);}
.th-hit small{margin-left:auto; font-size:11px; color:var(--text-dim);}
.th-hit-icon{width:30px; height:30px; flex:none; display:flex; align-items:center; justify-content:center; background:var(--panel-2); border:1px solid var(--border-soft); border-radius:8px;}
.th-hit-icon img{max-width:100%; max-height:100%; image-rendering:pixelated;}

.th-summary-grid{display:grid; grid-template-columns:repeat(auto-fill, minmax(260px, 1fr)); gap:10px;}
.th-summary{display:flex; align-items:center; gap:12px; padding:12px 14px; background:var(--panel); border:1px solid var(--border-soft); border-radius:12px; text-align:left;}
.th-summary:hover{border-color:var(--gold-dim);}
.th-summary-body{display:flex; flex-direction:column; gap:2px; min-width:0;}
.th-summary-name{font-size:13.5px; color:var(--text); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.th-summary-meta{font-size:11px; color:var(--text-dim);}

@media (max-width:760px){
  .th-var{grid-template-columns:1fr; gap:6px;}
  .th-done .th-chips{flex:1 1 100%; order:2;}
  .th-done .th-done-meta{order:3;}
  .th-group{grid-template-columns:minmax(0, 1fr) 48px 56px; gap:8px; padding:10px 12px;}
  .th-group-price{grid-column:1 / -1;}
  .th-group-head .th-group-price{display:none;}
  .th-stats{grid-template-columns:repeat(3, 1fr);}
  .th-stat b{font-size:18px;}
}
</style>
