<script setup>
import { ref, computed, watch } from 'vue'
import itemsData from '../data/items.json'
import runeChain from '../data/runeUpgradeChain.json'
import { ITEM_ICONS } from '../itemIcons.js'
import { runewordBaseTypesKo, runewordSlots } from '../itemStats.js'
import { itemLevelReq } from '../tradeStore.js'
import { buildRuneTable, buildRunewordList } from '../runewordFinder.js'

// 룬워드 찾기 - 룬을 눌러 고르면 그 룬이 하나라도 들어가는 룬워드를 전부 보여줌
//   바로 제작 가능(고른 룬으로 다 채워짐) / 룬 더 필요(부족한 룬이 적은 순)
// 개수는 안 받음 - 고른 룬은 1개씩 있다고 보고, 같은 룬이 두 번 들어가는 룬워드(인피니티 베르 2개 등)는 1개 더 필요로 표시
const table = buildRuneTable(itemsData, runeChain)
const runewords = buildRunewordList(itemsData, table)
const R = table.runes

function iconUrlFor(iconKey) {
  const url = iconKey && ITEM_ICONS[iconKey]
  return url || null
}

// 고른 룬 (룬 index 목록). 이 브라우저에만 저장 - 다음에 와도 그대로 (예전 개수 저장도 읽음)
const STORAGE_KEY = 'd2r-rune-inventory'
function loadPicked() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    return Array.isArray(raw) ? raw : Object.keys(raw).map(Number)
  } catch {
    return []
  }
}
const picked = ref(new Set(loadPicked()))
watch(picked, (v) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...v])) } catch { /* 저장 안 되는 환경 */ }
}, { deep: true })
const isPicked = (i) => picked.value.has(i)
function toggleRune(i) {
  const next = new Set(picked.value)
  next.has(i) ? next.delete(i) : next.add(i)
  picked.value = next
}
const clearRunes = () => { picked.value = new Set() }

// 장비 종류·소켓 수 필터
const SLOT_FILTERS = [
  { key: '', label: '전체' },
  { key: 'weapon', label: '무기' },
  { key: 'armor', label: '갑옷' },
  { key: 'shield', label: '방패' },
  { key: 'helm', label: '투구' },
]
const slotFilter = ref('')
const socketFilter = ref(0)
const passesFilter = (rw) =>
  (!slotFilter.value || runewordSlots(rw.item.subtitle).includes(slotFilter.value)) &&
  (!socketFilter.value || rw.runes.length === socketFilter.value)

// 고른 룬이 하나라도 들어가는 룬워드 + 부족한 룬
const matched = computed(() =>
  runewords
    .filter((rw) => passesFilter(rw) && rw.runes.some((i) => picked.value.has(i)))
    .map((rw) => {
      const left = new Set(picked.value)
      const missing = []
      for (const i of rw.runes) {
        if (left.has(i)) left.delete(i)
        else missing.push(i)
      }
      return { rw, missing }
    })
)
// 좋은 룬이 들어가는 룬워드(= 보통 더 비싼 것)가 먼저
const byValue = (a, b) => b.rw.top - a.rw.top || a.rw.item.name_ko.localeCompare(b.rw.item.name_ko, 'ko')
const ready = computed(() => matched.value.filter((x) => !x.missing.length).sort(byValue))
const needMore = computed(() =>
  matched.value.filter((x) => x.missing.length).sort((a, b) => a.missing.length - b.missing.length || byValue(a, b))
)

const runeName = (i) => R[i].short
const levelOf = (rw) => itemLevelReq(rw.item)
const tradeLink = (q) => ({ path: '/trade', query: { q } })
const itemLink = (rw) => ({ path: '/items', query: { cat: 'runeword', q: rw.item.name_ko } })
// 룬워드 룬 칸: 고른 룬은 밝게 (같은 룬이 두 번이면 첫 칸만)
function runeSlots(rw) {
  const left = new Set(picked.value)
  return rw.runes.map((i) => {
    const owned = left.has(i)
    if (owned) left.delete(i)
    return { i, owned }
  })
}
// 부족한 룬 묶기 (베르 2개 -> 베르 ×2)
function missingGroups(missing) {
  const m = new Map()
  for (const i of missing) m.set(i, (m.get(i) || 0) + 1)
  return [...m].map(([i, n]) => ({ i, n }))
}
</script>

<template>
  <div class="items-page rw-finder-page">

  <div class="patch-hero">
    <div class="patch-hero-inner">
      <div class="eyebrow">룬 조합</div>
      <h1>룬워드 찾기</h1>
    </div>
  </div>

  <div class="grid-wrap rw-wrap">
    <section class="rw-panel">
      <div class="rw-panel-head">
        <div class="rw-panel-title">룬 선택 <span class="rw-count" v-if="picked.size">{{ picked.size }}개</span></div>
        <button type="button" class="rw-clear" v-if="picked.size" @click="clearRunes">선택 해제</button>
      </div>
      <div class="rw-rune-grid">
        <button
          type="button" class="rw-rune" v-for="r in R" :key="r.code" :class="{ has: isPicked(r.index) }"
          :aria-pressed="isPicked(r.index)" :aria-label="r.ko" @click="toggleRune(r.index)"
        >
          <span class="rw-rune-icon"><img v-if="iconUrlFor(r.item.icon_key)" :src="iconUrlFor(r.item.icon_key)" alt="" /></span>
          <span class="rw-rune-name">{{ r.short }}</span>
        </button>
      </div>
    </section>

    <div class="rw-filters">
      <div class="cat-tabs">
        <button v-for="f in SLOT_FILTERS" :key="f.key" :class="{ active: slotFilter === f.key }" @click="slotFilter = f.key">{{ f.label }}</button>
      </div>
      <div class="cat-tabs">
        <button :class="{ active: !socketFilter }" @click="socketFilter = 0">소켓 전체</button>
        <button v-for="n in [2, 3, 4, 5, 6]" :key="n" :class="{ active: socketFilter === n }" @click="socketFilter = n">{{ n }}소켓</button>
      </div>
    </div>

    <div class="empty-state" v-if="!picked.size">룬을 누르면 그 룬이 들어가는 룬워드 표시</div>

    <template v-else>
      <section class="rw-section">
        <h2>바로 제작 가능 <span>{{ ready.length }}</span></h2>
        <div class="rw-none" v-if="!ready.length">고른 룬만으로 만들 수 있는 룬워드 없음</div>
        <div class="rw-list">
          <article class="rw-card ready" v-for="{ rw } in ready" :key="rw.item.id">
            <div class="rw-card-top">
              <router-link class="rw-name" :to="itemLink(rw)">{{ rw.item.name_ko }}</router-link>
              <span class="rw-meta">{{ runewordBaseTypesKo(rw.item.subtitle) }} · {{ rw.runes.length }}소켓<template v-if="levelOf(rw)"> · 요구 레벨 {{ levelOf(rw) }}</template></span>
            </div>
            <div class="rw-seq">
              <span class="rw-seq-rune owned" v-for="(s, k) in runeSlots(rw)" :key="k">
                <img v-if="iconUrlFor(R[s.i].item.icon_key)" :src="iconUrlFor(R[s.i].item.icon_key)" alt="" />{{ runeName(s.i) }}
              </span>
            </div>
            <router-link class="rw-link" :to="tradeLink(rw.item.name_ko)">거래 게시판 매물 보기 →</router-link>
          </article>
        </div>
      </section>

      <section class="rw-section">
        <h2>룬 더 필요 <span>{{ needMore.length }}</span></h2>
        <div class="rw-none" v-if="!needMore.length">없음</div>
        <div class="rw-list">
          <article class="rw-card" v-for="{ rw, missing } in needMore" :key="rw.item.id">
            <div class="rw-card-top">
              <router-link class="rw-name" :to="itemLink(rw)">{{ rw.item.name_ko }}</router-link>
              <span class="rw-meta">{{ runewordBaseTypesKo(rw.item.subtitle) }} · {{ rw.runes.length }}소켓<template v-if="levelOf(rw)"> · 요구 레벨 {{ levelOf(rw) }}</template></span>
            </div>
            <div class="rw-seq">
              <span class="rw-seq-rune" :class="{ owned: s.owned }" v-for="(s, k) in runeSlots(rw)" :key="k">
                <img v-if="iconUrlFor(R[s.i].item.icon_key)" :src="iconUrlFor(R[s.i].item.icon_key)" alt="" />{{ runeName(s.i) }}
              </span>
            </div>
            <div class="rw-missing">
              <span class="rw-missing-label">{{ missing.length }}개 더 필요</span>
              <router-link v-for="g in missingGroups(missing)" :key="g.i" class="rw-missing-rune" :to="tradeLink(R[g.i].ko)" :title="`${R[g.i].ko} 매물 보기`">
                {{ R[g.i].short }}{{ g.n > 1 ? ` ×${g.n}` : '' }}
              </router-link>
            </div>
          </article>
        </div>
      </section>
    </template>
  </div>
  </div>
</template>

<style scoped>
.rw-wrap{max-width:1180px; display:flex; flex-direction:column; gap:20px;}
.rw-panel{border:1px solid var(--border-soft); background:var(--panel); border-radius:16px; padding:20px 22px; display:flex; flex-direction:column; gap:14px;}
.rw-panel-head{display:flex; justify-content:space-between; align-items:center; gap:12px;}
.rw-panel-title{font-family:'Noto Serif KR', serif; font-weight:700; font-size:17px;}
.rw-count{font-family:'Noto Sans KR', sans-serif; font-size:12px; color:var(--gold); margin-left:6px; font-weight:600;}
.rw-clear{font-size:12px; color:var(--text-dim); border:1px solid var(--border); padding:6px 12px; border-radius:999px; background:transparent; flex:none;}
.rw-clear:hover{color:var(--text);}

.rw-rune-grid{display:grid; grid-template-columns:repeat(auto-fill, minmax(72px, 1fr)); gap:8px;}
.rw-rune{
  display:flex; flex-direction:column; align-items:center; gap:4px; padding:10px 4px 8px;
  background:var(--panel-2); border:1px solid var(--border-soft); border-radius:12px; color:var(--text-dim); cursor:pointer;
  transition:border-color .12s, background .12s;
}
.rw-rune:hover{border-color:var(--gold-dim); color:var(--text);}
.rw-rune.has{border-color:var(--gold); color:var(--gold); background:rgba(200,163,77,0.14); box-shadow:0 0 0 1px rgba(200,163,77,0.3) inset;}
.rw-rune-icon{width:28px; height:28px; display:flex; align-items:center; justify-content:center; opacity:.5;}
.rw-rune.has .rw-rune-icon{opacity:1;}
.rw-rune-icon img{width:100%; height:100%; object-fit:contain; image-rendering:pixelated;}
.rw-rune-name{font-size:12px; font-weight:600;}

.rw-filters{display:flex; flex-wrap:wrap; gap:10px 20px;}
.rw-filters .cat-tabs button{border-radius:999px;}

.rw-section{display:flex; flex-direction:column; gap:10px;}
.rw-section h2{font-family:'Noto Serif KR', serif; font-size:18px; margin:0;}
.rw-section h2 span{font-family:'Noto Sans KR', sans-serif; font-size:13px; color:var(--gold); margin-left:6px;}
.rw-none{font-size:12.5px; color:var(--text-dim); padding:6px 2px;}
.rw-list{display:grid; grid-template-columns:repeat(auto-fill, minmax(320px, 1fr)); gap:12px;}
.rw-card{border:1px solid var(--border-soft); background:var(--panel); border-radius:14px; padding:16px 18px; display:flex; flex-direction:column; gap:10px;}
.rw-card.ready{border-color:var(--gold-dim);}
.rw-card-top{display:flex; flex-direction:column; gap:3px;}
.rw-name{font-family:'Noto Serif KR', serif; font-weight:700; font-size:16px; color:var(--gold);}
.rw-meta{font-size:11.5px; color:var(--text-dim);}
.rw-seq{display:flex; flex-wrap:wrap; gap:6px;}
.rw-seq-rune{
  display:inline-flex; align-items:center; gap:4px; font-size:12px; padding:3px 9px 3px 4px; border-radius:999px;
  border:1px dashed var(--border); color:var(--text-dim);
}
.rw-seq-rune img{width:18px; height:18px; image-rendering:pixelated; opacity:.5;}
.rw-seq-rune.owned{border-style:solid; border-color:var(--gold-dim); color:var(--text);}
.rw-seq-rune.owned img{opacity:1;}
.rw-missing{display:flex; flex-wrap:wrap; align-items:center; gap:6px; font-size:12px; color:var(--text-dim);}
.rw-missing-label{color:var(--text-muted); font-weight:600; margin-right:2px;}
.rw-missing-rune{color:#e0775f; border:1px solid var(--blood); border-radius:999px; padding:3px 10px; font-size:12px;}
.rw-missing-rune:hover{background:rgba(180,50,40,0.12);}
.rw-link{font-size:12px; color:var(--text-dim); align-self:flex-start;}
.rw-link:hover{color:var(--gold);}
@media (max-width:640px){
  .rw-list{grid-template-columns:1fr;}
  .rw-rune-grid{grid-template-columns:repeat(auto-fill, minmax(60px, 1fr));}
}
</style>
