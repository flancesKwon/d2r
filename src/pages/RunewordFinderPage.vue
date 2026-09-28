<script setup>
import { ref, computed, watch } from 'vue'
import itemsData from '../data/items.json'
import runeChain from '../data/runeUpgradeChain.json'
import { ITEM_ICONS } from '../itemIcons.js'
import { runewordBaseTypesKo, runewordSlots } from '../itemStats.js'
import { itemLevelReq } from '../tradeStore.js'
import { buildRuneTable, buildRunewordList, evaluateRuneword } from '../runewordFinder.js'

// 가진 룬을 담으면 바로 만들 수 있는 룬워드 / 큐브 업그레이드로 만들 수 있는 룬워드 /
// 룬 1~2개만 더 있으면 되는 룬워드를 보여줌 (계산은 src/runewordFinder.js)
const table = buildRuneTable(itemsData, runeChain)
const runewords = buildRunewordList(itemsData, table)
const R = table.runes

function iconUrlFor(iconKey) {
  const url = iconKey && ITEM_ICONS[iconKey]
  return url || null
}

// 가진 룬 개수 (룬 index -> 개수). 이 브라우저에만 저장 - 다음에 와도 그대로
const STORAGE_KEY = 'd2r-rune-inventory'
function loadHave() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}
const have = ref(loadHave())
watch(
  have,
  (v) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(v))
    } catch {
      // 프라이빗 창 등 저장이 안 되는 환경 - 이번 방문 동안만 유지
    }
  },
  { deep: true }
)
const countOf = (i) => have.value[i] || 0
function addRune(i, d = 1) {
  const n = Math.max(0, Math.min(99, countOf(i) + d))
  if (n) have.value[i] = n
  else delete have.value[i]
}
function clearRunes() {
  have.value = {}
}
const totalRunes = computed(() => Object.values(have.value).reduce((s, n) => s + n, 0))

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

const evaluated = computed(() =>
  runewords.filter(passesFilter).map((rw) => ({ rw, e: evaluateRuneword(rw, have.value, table) }))
)
// 좋은 룬이 들어가는 룬워드(= 보통 더 비싼 것)가 먼저
const byValue = (a, b) => b.rw.top - a.rw.top || a.rw.item.name_ko.localeCompare(b.rw.item.name_ko, 'ko')
const ready = computed(() => evaluated.value.filter((x) => x.e.status === 'ready').sort(byValue))
const upgradable = computed(() => evaluated.value.filter((x) => x.e.status === 'upgrade').sort(byValue))
const MAX_MISSING = 2
const almost = computed(() =>
  evaluated.value
    .filter((x) => x.e.status === 'missing' && x.e.missingTotal <= MAX_MISSING)
    .sort((a, b) => a.e.missingTotal - b.e.missingTotal || byValue(a, b))
)

const runeName = (i) => R[i].short
const levelOf = (rw) => itemLevelReq(rw.item)
const tradeLink = (q) => ({ path: '/trade', query: { q } })
const itemLink = (rw) => ({ path: '/items', query: { cat: 'runeword', q: rw.item.name_ko } })
// 룬워드 룬 칸: 가진 룬(업그레이드 없이 바로 쓸 수 있는 것)은 밝게
function runeSlots(rw) {
  const left = { ...have.value }
  return rw.runes.map((i) => {
    const owned = (left[i] || 0) > 0
    if (owned) left[i]--
    return { i, owned }
  })
}
</script>

<template>
  <div class="items-page rw-finder-page">

  <div class="patch-hero">
    <div class="patch-hero-inner">
      <div class="eyebrow">룬워드 계산기</div>
      <h1>가진 룬으로 룬워드 찾기</h1>
      <p>가진 룬을 담으면 바로 만들 수 있는 룬워드, 큐브 업그레이드로 만들 수 있는 룬워드, 룬 1~2개만 더 있으면 되는 룬워드를 찾아줘요.</p>
    </div>
  </div>

  <div class="grid-wrap rw-wrap">
    <section class="rw-panel">
      <div class="rw-panel-head">
        <div>
          <div class="rw-panel-title">내 룬 <span class="rw-count" v-if="totalRunes">{{ totalRunes }}개</span></div>
          <div class="rw-hint">룬을 누르면 1개씩 담기고, − 로 뺄 수 있어요. 이 브라우저에 저장돼요.</div>
        </div>
        <button type="button" class="rw-clear" v-if="totalRunes" @click="clearRunes">전부 비우기</button>
      </div>
      <div class="rw-rune-grid">
        <div class="rw-rune" v-for="r in R" :key="r.code" :class="{ has: countOf(r.index) }">
          <button type="button" class="rw-rune-add" :aria-label="`${r.ko} 1개 담기`" @click="addRune(r.index)">
            <span class="rw-rune-icon"><img v-if="iconUrlFor(r.item.icon_key)" :src="iconUrlFor(r.item.icon_key)" alt="" /></span>
            <span class="rw-rune-name">{{ r.short }}</span>
            <span class="rw-rune-num" v-if="countOf(r.index)">{{ countOf(r.index) }}</span>
          </button>
          <button
            type="button" class="rw-rune-sub" v-if="countOf(r.index)" :aria-label="`${r.ko} 1개 빼기`"
            @click="addRune(r.index, -1)"
          >−</button>
        </div>
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

    <div class="empty-state" v-if="!totalRunes">위에서 가진 룬을 눌러서 담아보세요.</div>

    <template v-else>
      <section class="rw-section">
        <h2>바로 만들 수 있어요 <span>{{ ready.length }}</span></h2>
        <div class="rw-none" v-if="!ready.length">가진 룬만으로 바로 만들 수 있는 룬워드가 없어요.</div>
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
        <h2>큐브 업그레이드로 만들 수 있어요 <span>{{ upgradable.length }}</span></h2>
        <div class="rw-hint">아래 룬을 큐브로 올려서 모자란 룬을 만들 수 있어요 (위 룬은 아래로 못 내려요).</div>
        <div class="rw-none" v-if="!upgradable.length">업그레이드로 채울 수 있는 룬워드가 없어요.</div>
        <div class="rw-list">
          <article class="rw-card upgrade" v-for="{ rw, e } in upgradable" :key="rw.item.id">
            <div class="rw-card-top">
              <router-link class="rw-name" :to="itemLink(rw)">{{ rw.item.name_ko }}</router-link>
              <span class="rw-meta">{{ runewordBaseTypesKo(rw.item.subtitle) }} · {{ rw.runes.length }}소켓<template v-if="levelOf(rw)"> · 요구 레벨 {{ levelOf(rw) }}</template></span>
            </div>
            <div class="rw-seq">
              <span class="rw-seq-rune" :class="{ owned: s.owned }" v-for="(s, k) in runeSlots(rw)" :key="k">
                <img v-if="iconUrlFor(R[s.i].item.icon_key)" :src="iconUrlFor(R[s.i].item.icon_key)" alt="" />{{ runeName(s.i) }}
              </span>
            </div>
            <ol class="rw-steps">
              <li v-for="u in e.upgrades" :key="u.to">
                {{ runeName(u.from) }} {{ u.qty }}개<template v-if="u.gem"> + {{ u.gem }}</template> → {{ runeName(u.to) }}
                <b v-if="u.times > 1">× {{ u.times }}번</b>
              </li>
            </ol>
            <div class="rw-gems" v-if="e.gems.size">
              필요한 보석: <span v-for="[g, c] in e.gems" :key="g">{{ g }} {{ c }}개</span>
            </div>
          </article>
        </div>
      </section>

      <section class="rw-section">
        <h2>룬 1~2개만 더 있으면 돼요 <span>{{ almost.length }}</span></h2>
        <div class="rw-none" v-if="!almost.length">1~2개 차이로 만들 수 있는 룬워드가 없어요.</div>
        <div class="rw-list">
          <article class="rw-card almost" v-for="{ rw, e } in almost" :key="rw.item.id">
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
              부족한 룬:
              <router-link v-for="m in e.missing" :key="m.index" class="rw-missing-rune" :to="tradeLink(R[m.index].ko)">
                {{ R[m.index].ko }}{{ m.count > 1 ? ` ${m.count}개` : '' }} 사러 가기
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
.rw-panel-head{display:flex; justify-content:space-between; align-items:flex-start; gap:12px;}
.rw-panel-title{font-family:'Noto Serif KR', serif; font-weight:700; font-size:17px;}
.rw-count{font-family:'Noto Sans KR', sans-serif; font-size:12px; color:var(--gold); margin-left:6px; font-weight:600;}
.rw-hint{font-size:11.5px; color:var(--text-dim); margin-top:4px;}
.rw-clear{font-size:12px; color:var(--text-dim); border:1px solid var(--border); padding:6px 12px; border-radius:999px; background:transparent; flex:none;}
.rw-clear:hover{color:var(--text);}

.rw-rune-grid{display:grid; grid-template-columns:repeat(auto-fill, minmax(78px, 1fr)); gap:8px;}
.rw-rune{position:relative;}
.rw-rune-add{
  width:100%; display:flex; flex-direction:column; align-items:center; gap:4px; padding:10px 4px 8px;
  background:var(--panel-2); border:1px solid var(--border-soft); border-radius:12px; color:var(--text-dim); cursor:pointer;
}
.rw-rune-add:hover{border-color:var(--gold-dim); color:var(--text);}
.rw-rune.has .rw-rune-add{border-color:var(--gold-dim); color:var(--gold); background:rgba(200,163,77,0.1);}
.rw-rune-icon{width:28px; height:28px; display:flex; align-items:center; justify-content:center; opacity:.55;}
.rw-rune.has .rw-rune-icon{opacity:1;}
.rw-rune-icon img{width:100%; height:100%; object-fit:contain; image-rendering:pixelated;}
.rw-rune-name{font-size:12px; font-weight:600;}
.rw-rune-num{
  position:absolute; top:4px; right:6px; font-size:11px; font-weight:700; color:#1a1410; background:var(--gold);
  border-radius:999px; min-width:18px; height:18px; line-height:18px; text-align:center; padding:0 4px;
}
.rw-rune-sub{
  position:absolute; top:4px; left:4px; width:20px; height:20px; border-radius:999px; font-size:13px; line-height:18px;
  color:var(--text-dim); background:var(--panel); border:1px solid var(--border); padding:0; cursor:pointer;
}
.rw-rune-sub:hover{color:var(--text);}

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
.rw-steps{margin:0; padding-left:18px; font-size:12.5px; color:var(--text-muted); display:flex; flex-direction:column; gap:3px;}
.rw-steps b{color:var(--gold); font-weight:600;}
.rw-gems{font-size:12px; color:var(--teal);}
.rw-gems span + span::before{content:', ';}
.rw-missing{display:flex; flex-wrap:wrap; align-items:center; gap:6px; font-size:12px; color:var(--text-dim);}
.rw-missing-rune{color:var(--blood); border:1px solid var(--blood); border-radius:999px; padding:3px 10px; font-size:12px;}
.rw-missing-rune:hover{background:rgba(180,50,40,0.12);}
.rw-link{font-size:12px; color:var(--text-dim); align-self:flex-start;}
.rw-link:hover{color:var(--gold);}
@media (max-width:640px){
  .rw-list{grid-template-columns:1fr;}
  .rw-rune-grid{grid-template-columns:repeat(auto-fill, minmax(64px, 1fr));}
}
</style>
