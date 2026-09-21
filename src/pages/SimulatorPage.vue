<script setup>
import { ref, reactive, computed, watch, onMounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import classStats from '../data/classStats.json'
import itemsData from '../data/items.json'
import { CLASS_ICONS } from '../icons.js'
import { SLOT_DEFS, buildItemsBySlot, aggregateItemStats } from '../itemStats.js'

// 캐릭터 인형(paperdoll) 배치 - 실제 인게임 장비창의 정확한 5열 배치를 그대로 재현
// (무기·방패는 세로로 긴 슬롯, 목걸이는 갑옷 옆, 반지는 벨트 양옆)
const DOLL_AREA = {
  helm: 'helm',
  weapon: 'weapon', armor: 'armor', shield: 'shield', amulet: 'amulet',
  gloves: 'gloves', belt: 'belt', boots: 'boots',
  ring1: 'ring1', ring2: 'ring2',
}
const SMALL_DOLL_SLOTS = new Set(['amulet', 'ring1', 'ring2', 'belt'])

// 실제 게임 DC6 스프라이트에서 뽑은 슬롯 실루엣 아이콘 (기존 자체제작 SVG 대체)
const equipIconModules = import.meta.glob('../assets/equipicons/*.png', { eager: true, import: 'default' })
const equipIconUrl = Object.fromEntries(Object.entries(equipIconModules).map(([p, url]) => [p.split('/').pop().replace('.png', ''), url]))
const DOLL_ICON_FILE = { weapon: 'weapon', shield: 'weapon', helm: 'helm', armor: 'armor', gloves: 'gloves', boots: 'boots', belt: 'belt', amulet: 'amulet', ring1: 'ring', ring2: 'ring' }
function equipSilhouetteUrl(slotKey) {
  return equipIconUrl[DOLL_ICON_FILE[slotKey]]
}

const route = useRoute()
const router = useRouter()

const classKeys = Object.keys(classStats)
const STAT_KEYS = ['str', 'dex', 'vit', 'nrg']
const STAT_LABELS = { str: '힘', dex: '민첩', vit: '활력', nrg: '에너지' }

// 람 에센의 책(+5) 스탯 포인트가 난이도마다 반복 지급 — 전부 깬 상태를 기본값으로 고정
const MAX_QUEST_STAT_BONUS = 5 * 3

const selectedClass = ref('amazon')
const level = ref(90)

const allocatedStats = reactive({ str: 0, dex: 0, vit: 0, nrg: 0 })
const equippedItems = reactive(Object.fromEntries(SLOT_DEFS.map((s) => [s.key, ''])))

const itemsBySlot = buildItemsBySlot(itemsData)
const itemById = Object.fromEntries(itemsData.map((i) => [i.id, i]))

const itemAgg = computed(() => {
  const full = Object.fromEntries(SLOT_DEFS.map((s) => [s.key, equippedItems[s.key] ? itemById[equippedItems[s.key]] : null]))
  return aggregateItemStats(full, selectedClass.value)
})

function resetAll() {
  STAT_KEYS.forEach((k) => (allocatedStats[k] = 0))
}

function resetEquip() {
  SLOT_DEFS.forEach((s) => (equippedItems[s.key] = ''))
}

let skipClassReset = false
watch(selectedClass, () => {
  if (skipClassReset) return
  resetAll()
})

const classInfo = computed(() => classStats[selectedClass.value])

const clampedLevel = computed({
  get: () => level.value,
  set: (v) => {
    const n = Math.round(Number(v) || 1)
    level.value = Math.min(99, Math.max(1, n))
  },
})

const totalStatPoints = computed(() => MAX_QUEST_STAT_BONUS + 5 * (level.value - 1))
const spentStatPoints = computed(() => STAT_KEYS.reduce((sum, k) => sum + allocatedStats[k], 0))
const remainingStatPoints = computed(() => totalStatPoints.value - spentStatPoints.value)

// ---- 빌드 공유 링크 ----
const shareUrl = ref('')
const shareCopied = ref(false)

function encodeShareCode(payload) {
  const json = JSON.stringify(payload)
  return btoa(unescape(encodeURIComponent(json)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function decodeShareCode(code) {
  try {
    let b64 = code.replace(/-/g, '+').replace(/_/g, '/')
    while (b64.length % 4) b64 += '='
    return JSON.parse(decodeURIComponent(escape(atob(b64))))
  } catch (e) {
    return null
  }
}

function buildSharePayload() {
  return {
    c: selectedClass.value,
    l: level.value,
    st: { ...allocatedStats },
    eq: { ...equippedItems },
  }
}

async function applyShareState(data) {
  if (!data || !classStats[data.c]) return
  skipClassReset = true
  selectedClass.value = data.c
  await nextTick()
  skipClassReset = false

  level.value = Math.min(99, Math.max(1, Number(data.l) || 90))
  STAT_KEYS.forEach((k) => (allocatedStats[k] = Number(data.st?.[k]) || 0))
  SLOT_DEFS.forEach((s) => (equippedItems[s.key] = (data.eq && data.eq[s.key]) || ''))
}

async function shareLink() {
  const code = encodeShareCode(buildSharePayload())
  router.replace({ path: '/simulator', query: { b: code } }).catch(() => {})
  shareUrl.value = `${window.location.origin}${window.location.pathname}#/simulator?b=${code}`
  shareCopied.value = false
  try {
    await navigator.clipboard.writeText(shareUrl.value)
    shareCopied.value = true
  } catch (e) {
    // 클립보드 권한이 없으면 링크를 화면에 그대로 보여줘서 수동 복사하게 함
  }
}

onMounted(() => {
  if (typeof route.query.b === 'string') {
    applyShareState(decodeShareCode(route.query.b))
  }
})

function increaseStat(key) {
  if (remainingStatPoints.value <= 0) return
  allocatedStats[key]++
}

function decreaseStat(key) {
  if (allocatedStats[key] <= 0) return
  allocatedStats[key]--
}

const displayStats = computed(() => {
  const b = classInfo.value.base
  const g = itemAgg.value
  return STAT_KEYS.map((k) => ({
    key: k,
    label: STAT_LABELS[k],
    base: b[k],
    added: allocatedStats[k],
    gear: g[k],
    total: b[k] + allocatedStats[k] + g[k],
  }))
})

const derivedStats = computed(() => {
  const c = classInfo.value
  const g = itemAgg.value
  const lvl = level.value
  const ac = Math.round((g.acFlat || 0) * (1 + (g.acPercent || 0) / 100))
  return {
    life: Math.round(c.life + c.lifePerLevel * (lvl - 1) + c.lifePerVit * allocatedStats.vit + g.life),
    mana: Math.round(c.mana + c.manaPerLevel * (lvl - 1) + c.manaPerNrg * allocatedStats.nrg + g.mana),
    stamina: Math.round(c.stamina + c.staminaPerLevel * (lvl - 1) + c.staminaPerVit * allocatedStats.vit),
    armor: ac,
    resist: {
      fire: Math.min(75, Math.round(g.resist.fire)),
      cold: Math.min(75, Math.round(g.resist.cold)),
      ltng: Math.min(75, Math.round(g.resist.ltng)),
      pois: Math.min(75, Math.round(g.resist.pois)),
    },
    weaponDamage: g.weaponDamage ? { min: Math.round(g.weaponDamage.min), max: Math.round(g.weaponDamage.max) } : null,
  }
})
</script>

<template>
  <div class="items-page simulator-page">
  <header>
    <div class="logo">
      <router-link to="/" style="display: flex; align-items: center; gap: 8px; color: inherit">
        <span class="logo-mark"></span>디아사전
      </router-link>
    </div>
    <div class="crumb"><router-link to="/">메인</router-link> / <b>스킬·스탯 시뮬레이터</b></div>
  </header>

  <div class="patch-hero">
    <div class="patch-hero-inner">
      <div class="eyebrow">빌드 계획 도구</div>
      <h1>스킬·스탯 시뮬레이터</h1>
      <p>레벨·스탯에 장비까지 껴서 생명력·저항 같은 캐릭터 상세 정보를 미리 확인해보세요.</p>
    </div>
  </div>

  <div class="toolbar">
    <div class="toolbar-inner">
      <div class="cat-tabs sim-class-tabs">
        <button v-for="c in classKeys" :key="c" :class="{ active: selectedClass === c }" @click="selectedClass = c">
          <span class="sim-class-icon"><svg viewBox="0 0 24 24" v-html="CLASS_ICONS[c]"></svg></span>
          {{ classStats[c].name }}
        </button>
      </div>
    </div>
  </div>

  <div class="grid-wrap sim-wrap">
    <div class="sim-controls">
      <label class="sim-field">
        <span>캐릭터 레벨</span>
        <input type="number" min="1" max="99" v-model="clampedLevel" />
      </label>
      <button class="sim-reset-btn" @click="resetAll">빌드 초기화</button>
      <button class="sim-reset-btn sim-share-btn" @click="shareLink">빌드 공유 링크 만들기</button>
    </div>

    <div class="sim-share-box" v-if="shareUrl">
      <input class="sim-share-input" type="text" :value="shareUrl" readonly @focus="$event.target.select()" />
      <span class="sim-share-status">{{ shareCopied ? '링크가 복사됐어요' : '복사가 안 되면 위 링크를 직접 선택해서 복사해주세요' }}</span>
    </div>

    <div class="note-box sim-quest-note">퀘스트 보상은 전부 클리어한 상태를 기본값으로 계산해요 (스탯 포인트 +{{ MAX_QUEST_STAT_BONUS }} 포함).</div>

    <div class="sim-sheet">
      <section class="sim-zone sim-zone-equip">
        <header class="sim-zone-head">
          <h2>장비</h2>
          <button class="sim-link-btn" @click="resetEquip">초기화</button>
        </header>

        <div class="sim-doll">
          <label
            class="sim-slot" v-for="s in SLOT_DEFS" :key="s.key"
            :style="{ gridArea: DOLL_AREA[s.key] }" :title="s.label"
            :class="{ small: SMALL_DOLL_SLOTS.has(s.key) }"
          >
            <div class="sim-slot-tile" :class="{ filled: equippedItems[s.key] }">
              <img
                class="sim-slot-art" :class="{ mirror: s.key === 'shield' }"
                :src="equipSilhouetteUrl(s.key)" :alt="s.label" draggable="false"
              />
            </div>
            <select class="sim-slot-select" v-model="equippedItems[s.key]">
              <option value="">비어있음</option>
              <option v-for="it in itemsBySlot[s.key]" :key="it.id" :value="it.id">
                {{ it.name_ko }}{{ it.category === 'runeword' ? ' (룬워드)' : '' }}
              </option>
            </select>
          </label>
        </div>

        <div class="sim-inv-grid" aria-hidden="true">
          <div class="sim-inv-cell" v-for="i in 40" :key="i"></div>
        </div>

        <p class="sim-zone-note">유니크·세트·룬워드 데이터 기준으로 스탯·저항·방어력을 합산해요. 소켓·인벤토리 참은 아직 없어요.</p>
      </section>

      <div class="sim-zone-divider"></div>

      <section class="sim-zone sim-zone-stats">
        <header class="sim-zone-head">
          <h2>스탯</h2>
          <span class="sim-zone-meta" :class="{ warn: remainingStatPoints < 0 }">{{ remainingStatPoints }} / {{ totalStatPoints }} 남음</span>
        </header>
        <div class="sim-stat-row" v-for="s in displayStats" :key="s.key">
          <span class="sim-stat-label">{{ s.label }}</span>
          <div class="sim-stepper">
            <button class="sim-step-btn" @click="decreaseStat(s.key)" :disabled="allocatedStats[s.key] <= 0">‹</button>
            <span class="sim-step-value">{{ s.total }}</span>
            <button class="sim-step-btn" @click="increaseStat(s.key)" :disabled="remainingStatPoints <= 0">›</button>
          </div>
          <span class="sim-stat-detail">기본 {{ s.base }}+투자 {{ s.added }}<template v-if="s.gear">+장비 {{ s.gear }}</template></span>
        </div>

        <header class="sim-zone-head sim-zone-head-sub">
          <h2>예상 능력치</h2>
        </header>
        <div class="sim-derived-row"><span>생명력</span><b>{{ derivedStats.life }}</b></div>
        <div class="sim-derived-row"><span>마나</span><b>{{ derivedStats.mana }}</b></div>
        <div class="sim-derived-row"><span>스태미나</span><b>{{ derivedStats.stamina }}</b></div>
        <div class="sim-derived-row"><span>방어력</span><b>{{ derivedStats.armor }}</b></div>
        <div class="sim-derived-row" v-if="derivedStats.weaponDamage"><span>무기 데미지</span><b>{{ derivedStats.weaponDamage.min }}~{{ derivedStats.weaponDamage.max }}</b></div>
        <div class="sim-derived-row">
          <span>저항 화/냉/전/독</span>
          <b>{{ derivedStats.resist.fire }}/{{ derivedStats.resist.cold }}/{{ derivedStats.resist.ltng }}/{{ derivedStats.resist.pois }}%</b>
        </div>
        <p class="sim-zone-note">스탯 성장은 커뮤니티 자료 기준 근사치, 저항 75% 상한 적용.</p>
      </section>
    </div>
  </div>
  </div>
</template>

<style scoped>
.sim-wrap{max-width:1680px;}

.sim-class-tabs button{display:flex; align-items:center; gap:7px;}
.sim-class-icon{width:16px; height:16px; display:inline-flex; flex:none;}
.sim-class-icon svg{width:100%; height:100%; stroke:currentColor; fill:none; stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round;}

.sim-controls{display:flex; flex-wrap:wrap; align-items:end; gap:16px; margin-bottom:24px; padding-bottom:20px; border-bottom:1px solid var(--border-soft);}
.sim-field{display:flex; flex-direction:column; gap:6px; font-size:12px; color:var(--text-muted);}
.sim-field input{
  width:120px; background:var(--panel); border:1px solid var(--border); border-radius:4px; color:var(--text);
  padding:9px 12px; font-size:14px; font-family:inherit;
}
.sim-field input:focus{outline:none; border-color:var(--gold-dim);}
.sim-reset-btn{border:1px solid var(--border); border-radius:4px; color:var(--text-muted); padding:9px 16px; font-size:12.5px; height:38px;}
.sim-reset-btn:hover{border-color:var(--gold-dim); color:var(--gold);}
.sim-share-btn{border-color:var(--gold-dim); color:var(--gold);}
.sim-share-btn:hover{background:var(--panel);}

.sim-share-box{display:flex; flex-wrap:wrap; align-items:center; gap:10px; margin:-8px 0 24px;}
.sim-share-input{
  flex:1; min-width:220px; background:var(--panel); border:1px solid var(--border); border-radius:4px; color:var(--text);
  padding:9px 12px; font-size:12.5px; font-family:inherit;
}
.sim-share-input:focus{outline:none; border-color:var(--gold-dim);}
.sim-share-status{font-size:11.5px; color:var(--text-dim);}

.sim-quest-note{margin-bottom:20px;}

/* ---- 하나의 시트 위에 장비·스탯을 함께 배치 (실제 게임 돌기둥 텍스처가 전체를 지나감) ---- */
.sim-sheet{
  position:relative; isolation:isolate; max-width:900px; margin:0 auto;
  display:grid; grid-template-columns:1fr 1px 320px; gap:24px;
  border:1px solid var(--gold-dim); padding:24px;
}
.sim-sheet::before{
  /* 원본 menupanel.png은 위아래에 금색 가로줄 장식이 있어서 세로로 반복 타일링하면
     띠처럼 도드라져 보임 → 그 부분을 잘라낸 순수 돌 질감만 반복 사용 */
  content:''; position:absolute; inset:0; z-index:-1;
  background-image:url('../assets/uitextures/menupanel_tile.png');
  background-size:240px 120px; background-repeat:repeat;
  filter:grayscale(0.5) brightness(0.5) contrast(1.05);
}
.sim-zone{min-width:0;}
.sim-zone-equip{display:flex; flex-direction:column;}
.sim-zone-divider{background:linear-gradient(180deg, transparent, var(--gold-dim) 15%, var(--gold-dim) 85%, transparent); opacity:0.35;}

.sim-zone-head{
  display:flex; align-items:baseline; justify-content:space-between; gap:10px;
  padding-bottom:10px; margin-bottom:16px; border-bottom:2px solid var(--gold-dim);
}
.sim-zone-head h2{font-size:15px; font-family:'Noto Serif KR', serif; font-weight:700; color:var(--gold); margin:0;}
.sim-zone-head-sub{margin-top:24px;}
.sim-zone-meta{font-size:11.5px; color:var(--text-dim); white-space:nowrap;}
.sim-zone-meta.warn{color:var(--blood);}
.sim-link-btn{font-size:11.5px; color:var(--text-muted); border:none; background:none; text-decoration:underline; cursor:pointer; padding:0;}
.sim-link-btn:hover{color:var(--gold);}
.sim-zone-note{margin-top:14px; font-size:11px; color:var(--text-dim); line-height:1.5;}

@media (max-width:1150px){
  .sim-sheet{grid-template-columns:1fr;}
  .sim-zone-divider{display:none;}
}

/* ---- 장비 인형 ---- */
.sim-doll{
  display:grid; gap:10px; grid-template-columns:1.05fr 0.6fr 1.05fr 0.6fr 1.05fr; grid-template-rows:repeat(3, 1fr);
  max-width:340px; margin:0 auto; aspect-ratio:5/3.3;
  grid-template-areas:
    "weapon .      helm   amulet shield"
    "weapon .      armor  .      shield"
    "gloves ring1  belt   ring2  boots";
}
.sim-slot{position:relative; display:block;}
.sim-slot.small{padding:16% 8%;}
.sim-slot-tile{
  /* 실제 장비창은 청동 테두리/리벳이 없고, 돌 패널에 그대로 깎아넣은 듯한
     무채색 인셋 프레임임 */
  position:relative; width:100%; height:100%; border-radius:2px; border:1px solid #5a5751;
  background:linear-gradient(160deg, #2a2823, #100f0d 60%, #060605);
  box-shadow:inset 0 2px 5px rgba(0,0,0,0.85), inset 0 -1px 0 rgba(255,255,255,0.06);
  display:flex; align-items:center; justify-content:center;
  transition:border-color .15s, box-shadow .15s;
}
.sim-slot-tile.filled{border-color:var(--gold); box-shadow:inset 0 2px 5px rgba(0,0,0,0.85), inset 0 -1px 0 rgba(255,255,255,0.06), 0 0 10px -2px var(--gold-dim);}
.sim-slot-art{width:74%; height:74%; object-fit:contain; pointer-events:none; filter:brightness(1.7); opacity:0.5; transition:filter .15s, opacity .15s;}
.sim-slot-art.mirror{transform:scaleX(-1);}
.sim-slot-tile.filled .sim-slot-art{filter:brightness(2.3) sepia(0.3) saturate(1.4); opacity:1;}
.sim-slot-select{position:absolute; inset:0; width:100%; height:100%; opacity:0; cursor:pointer; border:none; padding:0; margin:0;}

.sim-inv-grid{
  flex:1; min-height:120px; max-width:340px; width:100%; margin:16px auto 0;
  display:grid; grid-template-columns:repeat(10, 1fr); grid-auto-rows:1fr; gap:3px;
  border:1px solid var(--border-soft); padding:8px; background:rgba(0,0,0,0.3);
}
.sim-inv-cell{border:1px solid rgba(255,255,255,0.06); background:rgba(0,0,0,0.3);}

/* ---- 스탯 ---- */
.sim-stat-row{display:flex; align-items:center; flex-wrap:wrap; gap:10px 12px; padding:8px 0; border-top:1px solid var(--border-soft);}
.sim-stat-row:first-of-type{border-top:none;}
.sim-stat-label{width:40px; font-size:13px; color:var(--text-muted); flex:none;}
.sim-stat-detail{font-size:10.5px; color:var(--text-dim); flex:1 1 100%; margin-left:52px;}

.sim-stepper{
  display:flex; align-items:center; flex:none; border-radius:999px; overflow:hidden;
  border:1px solid var(--border); background:#0c0b09;
}
.sim-step-btn{
  width:24px; height:24px; border:none; background:transparent; color:var(--text-dim);
  font-size:15px; line-height:1; display:flex; align-items:center; justify-content:center; cursor:pointer;
}
.sim-step-btn:hover:not(:disabled){color:var(--gold);}
.sim-step-btn:disabled{opacity:0.3; cursor:default;}
.sim-step-value{min-width:26px; text-align:center; font-size:13.5px; font-weight:700; color:var(--text);}

.sim-derived-row{display:flex; justify-content:space-between; padding:7px 0; border-top:1px solid var(--border-soft); font-size:13px; color:var(--text-muted);}
.sim-derived-row:first-of-type{border-top:none;}
.sim-derived-row b{color:var(--gold); font-size:14px;}

@media (max-width:560px){
  .sim-controls{flex-direction:column; align-items:stretch;}
  .sim-field input{width:100%;}
}
</style>
