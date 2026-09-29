<script setup>
// 소켓 계산기 - 베이스와 아이템 레벨로 뚫을 수 있는 최대 소켓, 라르주크 퀘스트·큐브 결과를 보여줌
// 데이터: 게임 원본 itemtypes MaxSockets1~3 (아이템 레벨 1~25 / 26~40 / 41 이상) + 베이스 gemsockets 상한
//         (scripts/build-magic-affixes.js -> magicAffixes.json bases[code].sock)
// 큐브: cubemain.txt 소켓 레시피 = "sock 1~6" 무작위 후 그 장비 최대치로 잘림 -> 최대치가 나올 확률이 더 높음
import { ref, computed } from 'vue'
import magicAffixData from '../data/magicAffixes.json'
import { ITEM_ICONS } from '../itemIcons.js'
import { searchBaseItems, baseItemLabel, BASE_ITEMS } from '../tradeStore.js'

const POPULAR = ['uit', 'utp', 'xtp', 'uui', '7cr', 'crs', '7wa', '7s8', '7wc', '7vo', '7pa', 'bsd', 'fla', 'uap', 'ci3', 'paf']
const popular = POPULAR.map((c) => BASE_ITEMS.find((b) => b.code === c)).filter(Boolean)

const query = ref('')
const showList = ref(false)
const candidates = computed(() => searchBaseItems(query.value, null).filter((b) => (magicAffixData.bases[b.code]?.sock?.[2] || 0) > 0).slice(0, 12))
const base = ref(popular[0])
const hideListSoon = () => window.setTimeout(() => (showList.value = false), 150)
function pick(b) {
  base.value = b
  query.value = ''
  showList.value = false
}
const info = computed(() => magicAffixData.bases[base.value?.code] || null)
const iconUrl = (code) => {
  const key = magicAffixData.bases[code]?.icon
  return key && ITEM_ICONS[key] || null
}

const ilvl = ref(85)
const lv = computed(() => Math.max(1, Math.min(99, Math.floor(Number(ilvl.value) || 1))))
const brackets = computed(() => {
  if (!info.value) return []
  const [t1, t2] = info.value.sockLv
  return [
    { label: `1~${t1}`, from: 1, to: t1, max: info.value.sock[0] },
    { label: `${t1 + 1}~${t2}`, from: t1 + 1, to: t2, max: info.value.sock[1] },
    { label: `${t2 + 1} 이상`, from: t2 + 1, to: 99, max: info.value.sock[2] },
  ]
})
const current = computed(() => brackets.value.find((b) => lv.value >= b.from && lv.value <= b.to) || null)
const maxNow = computed(() => current.value?.max || 0)
// 큐브: 1~6 균등 -> 최대치 초과분은 최대치로 -> P(k) = 1/6 (k < max), (7 - max)/6 (k = max)
const cubeOdds = computed(() => {
  const m = maxNow.value
  return Array.from({ length: m }, (_, i) => ({ n: i + 1, p: i + 1 < m ? 1 / 6 : (7 - m) / 6 }))
})
const isWeapon = computed(() => base.value?.base_stats?.category === 'weapon')
const CUBE_BY_SLOT = {
  tors: '탈 룬 + 주울 룬 + 최상급 토파즈 + 일반 갑옷',
  shld: '탈 룬 + 앰 룬 + 최상급 루비 + 일반 방패',
  helm: '랄 룬 + 주울 룬 + 최상급 사파이어 + 일반 투구',
  weap: '랄 룬 + 앰 룬 + 최상급 자수정 + 일반 무기',
}
const cubeRecipe = computed(() => {
  const t = info.value?.types || []
  return CUBE_BY_SLOT[['tors', 'shld', 'helm', 'weap'].find((k) => t.includes(k))] || null
})
// 최대 소켓이 되는 가장 낮은 아이템 레벨
const minIlvlForMax = computed(() => {
  const top = info.value ? Math.max(...info.value.sock) : 0
  return brackets.value.find((b) => b.max === top)?.from || null
})
// 아이콘 그림이 없는 베이스(약 170종)는 종류별 윤곽선으로 대신 보여줌
const GLYPHS = {
  shield: '<path d="M12 3l7 3v6c0 5-3 8-7 9-4-1-7-4-7-9V6l7-3z"/>',
  helm: '<path d="M5 15a7 7 0 0114 0v3H5z"/><path d="M9 15v3M15 15v3"/>',
  armor: '<path d="M8 4l4 2 4-2 4 4-3 3v9H7v-9L4 8z"/>',
  weapon: '<path d="M18 3l3 3-11 11-3-3z"/><path d="M6 16l-3 5 5-3"/>',
}
const glyphOf = (b) => {
  const t = b?.type_sub || ''
  if (/방패/.test(t)) return GLYPHS.shield
  if (/투구|서클릿|머리/.test(t)) return GLYPHS.helm
  if (b?.base_stats?.category === 'armor') return GLYPHS.armor
  return GLYPHS.weapon
}
const pct = (p) => `${Math.round(p * 1000) / 10}%`
</script>

<template>
  <div class="items-page sockets-page">
  <div class="patch-hero">
    <div class="patch-hero-inner">
      <div class="eyebrow">룬워드 베이스 준비</div>
      <h1>소켓 계산기</h1>
      <p>베이스와 아이템 레벨을 고르면 최대 소켓 수와 라르주크 퀘스트·큐브로 뚫었을 때 나오는 소켓을 알려줘요.</p>
    </div>
  </div>

  <div class="grid-wrap sk-wrap">
    <section class="sk-panel">
      <div class="sk-row">
        <div class="sk-search">
          <input
            :value="query" type="text" class="sk-input" placeholder="베이스 검색 (예: 모너크, 페이즈 블레이드, 폴암)"
            aria-label="베이스 검색" @focus="showList = true" @input="query = $event.target.value; showList = true" @blur="hideListSoon"
          />
          <div class="sk-list" v-if="showList && query.trim()">
            <button type="button" class="sk-list-row" v-for="b in candidates" :key="b.id" @mousedown.prevent="pick(b)">
              <span class="sk-thumb"><img v-if="iconUrl(b.code)" :src="iconUrl(b.code)" alt="" /><svg v-else viewBox="0 0 24 24" class="sk-glyph" v-html="glyphOf(b)"></svg></span>
              {{ baseItemLabel(b) }} <small>{{ b.tier }} · {{ b.type_sub }}</small>
            </button>
            <div class="sk-empty" v-if="!candidates.length">소켓을 뚫을 수 있는 베이스 중 일치하는 게 없어요.</div>
          </div>
        </div>
        <label class="sk-lv">
          아이템 레벨
          <input v-model="ilvl" type="number" min="1" max="99" class="sk-input" />
        </label>
      </div>
      <div class="sk-chips">
        <span class="sk-chips-label">자주 쓰는 베이스</span>
        <button type="button" v-for="b in popular" :key="b.code" :class="{ active: base?.code === b.code }" @click="pick(b)">{{ b.name_ko }}</button>
      </div>
    </section>

    <section class="sk-panel sk-result" v-if="base && info">
      <div class="sk-head">
        <span class="sk-big-icon"><img v-if="iconUrl(base.code)" :src="iconUrl(base.code)" alt="" /><svg v-else viewBox="0 0 24 24" class="sk-glyph big" v-html="glyphOf(base)"></svg></span>
        <div>
          <h2>{{ base.name_ko }} <small>{{ base.subtitle }}</small></h2>
          <div class="sk-meta">{{ base.tier }} · {{ base.type_sub }} · 품질 레벨 {{ info.qlvl }}</div>
        </div>
        <div class="sk-now">
          <span>아이템 레벨 {{ lv }}</span>
          <b>최대 {{ maxNow }}소켓</b>
        </div>
      </div>

      <div class="sk-brackets">
        <div class="sk-bracket" v-for="b in brackets" :key="b.label" :class="{ on: current === b }">
          <span class="sk-bracket-lv">아이템 레벨 {{ b.label }}</span>
          <span class="sk-sockets">
            <i v-for="n in 6" :key="n" :class="{ filled: n <= b.max }"></i>
          </span>
          <b>{{ b.max }}소켓</b>
        </div>
      </div>
      <div class="sk-hint" v-if="minIlvlForMax">
        최대 {{ Math.max(...info.sock) }}소켓은 아이템 레벨 <b>{{ minIlvlForMax }} 이상</b>이면 나와요.
      </div>

      <div class="sk-methods">
        <div class="sk-method">
          <div class="sk-method-title">라르주크 퀘스트 (액트 5)</div>
          <ul>
            <li>일반·상급(흰색): <b>{{ maxNow }}소켓</b> (그 아이템 레벨의 최대치)</li>
            <li>매직: <b>1~{{ Math.min(2, maxNow) }}소켓</b> 중 무작위</li>
            <li>레어·유니크·세트: <b>1소켓</b></li>
          </ul>
        </div>
        <div class="sk-method" v-if="cubeRecipe">
          <div class="sk-method-title">큐브 소켓 레시피 (일반 등급, 소켓 없는 아이템)</div>
          <div class="sk-recipe">{{ cubeRecipe }}</div>
          <div class="sk-odds">
            <div class="sk-odd" v-for="o in cubeOdds" :key="o.n" :class="{ top: o.n === maxNow }">
              <span>{{ o.n }}소켓</span>
              <div class="sk-bar"><div :style="{ width: o.p * 100 + '%' }"></div></div>
              <span>{{ pct(o.p) }}</span>
            </div>
          </div>
        </div>
        <div class="sk-method" v-if="isWeapon">
          <div class="sk-method-title">매직 무기 + 보석 3개</div>
          <div class="sk-recipe">깨진 보석 3개 또는 흠 없는 보석 3개 + 매직 무기 → 같은 종류의 매직 무기로 새로 만들어지고 1~{{ Math.min(2, maxNow) }}소켓 (옵션도 새로 붙어요)</div>
        </div>
      </div>
    </section>
  </div>
  </div>
</template>

<style scoped>
.sk-wrap{max-width:1180px; display:flex; flex-direction:column; gap:16px;}
.sk-panel{border:1px solid var(--border-soft); background:var(--panel); border-radius:16px; padding:20px 22px; display:flex; flex-direction:column; gap:14px;}
.sk-row{display:flex; gap:12px; flex-wrap:wrap; align-items:flex-end;}
.sk-search{position:relative; flex:1; min-width:240px;}
.sk-input{width:100%; background:var(--panel-2); border:1px solid var(--border); color:var(--text); font-size:14px; padding:10px 12px; border-radius:10px; font-family:'Noto Sans KR', sans-serif;}
.sk-input:focus{outline:none; border-color:var(--gold-dim);}
.sk-lv{display:flex; flex-direction:column; gap:4px; font-size:12px; color:var(--text-dim); width:130px;}
.sk-list{position:absolute; top:calc(100% + 4px); left:0; right:0; z-index:10; background:var(--panel-2); border:1px solid var(--border); border-radius:12px; padding:6px; max-height:360px; overflow-y:auto; box-shadow:0 14px 30px rgba(0,0,0,.45);}
.sk-list-row{display:flex; align-items:center; gap:10px; width:100%; text-align:left; padding:6px 10px; border-radius:8px; font-size:13px; color:var(--text-muted);}
.sk-list-row:hover{background:var(--panel); color:var(--text);}
.sk-list-row small{margin-left:auto; color:var(--text-dim); font-size:11px;}
.sk-thumb{width:28px; height:28px; display:flex; align-items:center; justify-content:center; flex:none;}
.sk-thumb img{max-width:100%; max-height:100%; image-rendering:pixelated;}
.sk-glyph{width:20px; height:20px; fill:none; stroke:var(--text-dim); stroke-width:1.5; stroke-linejoin:round; stroke-linecap:round;}
.sk-glyph.big{width:40px; height:40px;}
.sk-empty{font-size:12px; color:var(--text-dim); padding:8px;}
.sk-chips{display:flex; flex-wrap:wrap; gap:6px; align-items:center;}
.sk-chips-label{font-size:11.5px; color:var(--text-dim); margin-right:4px;}
.sk-chips button{font-size:12px; color:var(--text-muted); border:1px solid var(--border); border-radius:999px; padding:4px 11px;}
.sk-chips button:hover, .sk-chips button.active{color:var(--gold); border-color:var(--gold-dim);}

.sk-head{display:flex; align-items:center; gap:16px; flex-wrap:wrap;}
.sk-big-icon{width:64px; height:96px; display:flex; align-items:center; justify-content:center; background:var(--panel-2); border:1px solid var(--border-soft); border-radius:12px; flex:none;}
.sk-big-icon img{max-width:56px; max-height:88px; image-rendering:pixelated;}
.sk-head h2{font-size:20px;}
.sk-head h2 small{font-family:'Noto Sans KR', sans-serif; font-size:12px; color:var(--text-dim); font-weight:400;}
.sk-meta{font-size:12.5px; color:var(--text-muted);}
.sk-now{margin-left:auto; text-align:right; display:flex; flex-direction:column;}
.sk-now span{font-size:12px; color:var(--text-dim);}
.sk-now b{font-family:'Noto Serif KR', serif; font-size:26px; color:var(--gold);}
.sk-brackets{display:grid; grid-template-columns:repeat(3, 1fr); gap:10px;}
.sk-bracket{display:flex; flex-direction:column; gap:8px; padding:14px; border:1px solid var(--border-soft); border-radius:12px; background:var(--panel-2); font-size:12.5px; color:var(--text-muted);}
.sk-bracket.on{border-color:var(--gold-dim); background:rgba(200,163,77,0.08);}
.sk-bracket b{font-size:15px; color:var(--text);}
.sk-sockets{display:flex; gap:5px;}
.sk-sockets i{width:16px; height:16px; border-radius:999px; border:1px solid var(--border); background:var(--bg);}
.sk-sockets i.filled{border-color:var(--gold-dim); background:radial-gradient(circle at 35% 35%, #3a3128, #15110e);}
.sk-hint{font-size:12.5px; color:var(--text-muted);}
.sk-hint b{color:var(--gold);}
.sk-methods{display:grid; grid-template-columns:repeat(auto-fit, minmax(300px, 1fr)); gap:12px;}
.sk-method{border:1px solid var(--border-soft); border-radius:12px; padding:14px 16px; display:flex; flex-direction:column; gap:8px;}
.sk-method-title{font-size:13px; font-weight:700; color:var(--gold-dim);}
.sk-method ul{display:flex; flex-direction:column; gap:4px; font-size:12.5px; color:var(--text-muted);}
.sk-method b{color:var(--text);}
.sk-recipe{font-size:12.5px; color:var(--text);}
.sk-odds{display:flex; flex-direction:column; gap:5px;}
.sk-odd{display:grid; grid-template-columns:52px 1fr 48px; gap:8px; align-items:center; font-size:12px; color:var(--text-muted);}
.sk-odd span:last-child{text-align:right;}
.sk-odd.top{color:var(--gold);}
.sk-bar{height:7px; background:var(--panel-2); border-radius:999px; overflow:hidden;}
.sk-bar div{height:100%; background:var(--gold-dim);}
@media (max-width:700px){ .sk-brackets{grid-template-columns:1fr;} .sk-now{margin-left:0; text-align:left;} }
</style>
