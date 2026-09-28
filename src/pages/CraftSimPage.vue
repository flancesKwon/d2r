<script setup>
import ItemTooltipCanvas from '../components/ItemTooltipCanvas.vue'
import { ref, computed, watch } from 'vue'
import magicAffixData from '../data/magicAffixes.json'
import baseItemsData from '../data/baseItems.json'
import itemsData from '../data/items.json'
import { ITEM_ICONS } from '../itemIcons.js'
import { buildTooltip } from '../itemTooltip.js'
import {
  craftRecipesFor, craftItemLevel, craftAffixCountOdds, craftPools, craftPoolFamilies, rollCraft, simulateCraft, familyLines, familyText,
} from '../magicAffixes.js'

// 크래프트 시뮬레이터 - 제작법·베이스·캐릭터 레벨·재료 아이템 레벨을 정하면 게임 방식대로 결과를 굴려봄
// (옵션 개수 확률, 접두사/접미사 50:50, frequency 가중치, 같은 그룹 제외 - src/magicAffixes.js)
const KINDS = ['히트 파워', '블러드', '캐스터', '세이프티']
const SLOTS = ['투구', '갑옷', '방패', '장갑', '신발', '벨트', '목걸이', '반지', '무기']
const kind = ref('캐스터')
const slot = ref('목걸이')
const craft = computed(() => magicAffixData.crafts.find((c) => c.name === `${kind.value} ${slot.value}`))

// 이 제작법 재료로 쓸 수 있는 베이스 (반지·목걸이는 하나, 무기는 종류 전체)
const MISC = magicAffixData.miscBases.map((b) => ({ ...b, sockets: 0 }))
const ALL_BASES = [...baseItemsData, ...MISC]
const baseLabel = (b) => (b.name_ko ? `${b.name_ko}${b.tier ? ` (${b.tier})` : ''}` : b.subtitle)
const bases = computed(() =>
  ALL_BASES.filter((b) => magicAffixData.bases[b.code] && craftRecipesFor(magicAffixData, b).some((r) => r.id === craft.value?.id))
    .sort((a, b) => magicAffixData.bases[a.code].qlvl - magicAffixData.bases[b.code].qlvl)
)
const baseCode = ref('')
watch(bases, (list) => {
  if (!list.some((b) => b.code === baseCode.value)) baseCode.value = list[list.length - 1]?.code || ''
}, { immediate: true })
const base = computed(() => bases.value.find((b) => b.code === baseCode.value) || null)
const recipe = computed(() => (base.value ? craftRecipesFor(magicAffixData, base.value).find((r) => r.id === craft.value?.id) : null))

// 크래프트 아이템 레벨 = 캐릭터 레벨/2 + 재료 매직 아이템 레벨/2 (베이스 qlvl 보다 낮으면 qlvl)
const clvl = ref(99)
const inputIlvl = ref(85)
const clamp = (v) => Math.max(1, Math.min(99, Math.floor(Number(v) || 1)))
const ilvl = computed(() => (base.value ? craftItemLevel(magicAffixData.bases[base.value.code], clamp(clvl.value), clamp(inputIlvl.value)) : 0))
const odds = computed(() => craftAffixCountOdds(ilvl.value))
const pools = computed(() => (base.value ? craftPools(magicAffixData, base.value, ilvl.value) : null))
const families = computed(() => (pools.value ? craftPoolFamilies(pools.value) : []))
const famByKey = computed(() => new Map(families.value.map((f) => [f.key, f])))

// 재료 (한글 이름·아이콘은 아이템 사전에서)
const byEn = new Map(itemsData.filter((it) => it.name_en).map((it) => [it.name_en, it]))
const iconUrl = (it) => (it?.icon_key && ITEM_ICONS[it.icon_key] || null)
const materials = computed(() => {
  if (!craft.value || !base.value) return []
  return [
    { name: `매직 ${base.value.name_ko || base.value.subtitle}` },
    { name: '주얼' },
    { name: byEn.get(craft.value.rune)?.name_ko || craft.value.rune, item: byEn.get(craft.value.rune) },
    { name: byEn.get(craft.value.gem)?.name_ko || craft.value.gem, item: byEn.get(craft.value.gem) },
  ]
})

// 한 번 제작
const lastRoll = ref(null)
function craftOnce() {
  if (!pools.value || !recipe.value) return
  lastRoll.value = rollCraft(pools.value, recipe.value, ilvl.value)
}
const rollTooltip = computed(() => {
  const r = lastRoll.value
  if (!r || !recipe.value) return null
  const options = [
    `베이스: ${base.value.name_ko || base.value.subtitle}`,
    ...familyLines(recipe.value.fam, r.fixed),
    ...r.affixes.flatMap((a) => familyLines(a, a.values)),
  ]
  const iconKey = base.value.icon_key || magicAffixData.bases[base.value.code]?.icon || null
  return buildTooltip({ name: recipe.value.name, category: '매직/레어/일반', quality: 'crafted', options, iconKey })
})

// 목표 옵션 (최대 3개, 전부 붙어야 성공) + 여러 번 시뮬레이션
const MAX_TARGETS = 3
const targets = ref([{ key: '', min: '' }])
const targetOptionsFor = (i) => {
  const taken = new Set(targets.value.filter((_, j) => j !== i).map((t) => t.key))
  return families.value.filter((f) => !taken.has(f.key))
}
const firstRange = (t) => famByKey.value.get(t.key)?.slotRanges[0] || null
const RUNS = 10000
const result = ref(null)
function runSim() {
  if (!pools.value || !recipe.value) return
  const ts = targets.value.filter((t) => famByKey.value.has(t.key)).map((t) => ({ key: t.key, min: Number(t.min) || 0 }))
  const res = simulateCraft(pools.value, recipe.value, ilvl.value, RUNS, ts)
  result.value = { ...res, targets: ts }
}
// 조건이 바뀌면 이전 결과는 지움 (다른 조건 결과를 보고 헷갈리지 않게)
watch([craft, baseCode, ilvl], () => {
  result.value = null
  lastRoll.value = null
  targets.value = [{ key: '', min: '' }]
})
watch(targets, () => (result.value = null), { deep: true })

const pct = (n, d) => (d ? (n / d) * 100 : 0)
const fmtPct = (p) => (p >= 10 ? p.toFixed(1) : p >= 1 ? p.toFixed(2) : p.toFixed(3)) + '%'
const topAffixes = computed(() =>
  result.value
    ? [...result.value.keyHits].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, c]) => ({ label: famByKey.value.get(k)?.label || k, p: pct(c, result.value.runs) }))
    : []
)
const successP = computed(() => (result.value?.targets.length ? pct(result.value.targetHits, result.value.runs) : null))
const expectedTries = computed(() => (successP.value ? Math.ceil(100 / successP.value) : null))

// ---------- 가중치 표: 게임 데이터(frequency) 그대로 + 아이템에 붙을 확률 ----------
const tab = ref('sim')
const tableSlot = ref('')
const tableQuery = ref('')
const openKey = ref('')
// 한 번 뽑을 때 확률 = 옵션 가중치 ÷ 같은 쪽(접두사/접미사) 가중치 합 - 데이터만으로 정확히 나옴
const slotTotals = computed(() => {
  const t = { p: 0, s: 0 }
  for (const slot of ['p', 's']) for (const a of pools.value?.[slot] || []) t[slot] += a.freq
  return t
})
// 아이템에 붙을 확률은 뽑는 순서·그룹 제외 때문에 공식 한 줄로 안 나와서 많이 굴려서 계산 (입력이 바뀌면 다시)
const TABLE_RUNS = 50000
const tableHits = ref(null)
let tableTimer = null
watch([tab, pools, recipe], () => {
  clearTimeout(tableTimer)
  tableHits.value = null
  if (tab.value !== 'table' || !pools.value || !recipe.value) return
  tableTimer = setTimeout(() => {
    tableHits.value = simulateCraft(pools.value, recipe.value, ilvl.value, TABLE_RUNS).keyHits
  }, 150)
}, { immediate: true })
const tierText = (f, t) => familyText(f, t.slots.map(([lo, hi]) => (lo === hi ? lo : `${lo}~${hi}`)))
const tableRows = computed(() => {
  const q = tableQuery.value.trim()
  return families.value
    .filter((f) => (!tableSlot.value || f.slot === tableSlot.value) && (!q || f.label.includes(q)))
    .map((f) => {
      const weight = f.tiers.reduce((s, t) => s + t.freq, 0)
      return {
        f, weight,
        pick: weight / slotTotals.value[f.slot],
        onItem: tableHits.value ? (tableHits.value.get(f.key) || 0) / TABLE_RUNS : null,
        levels: `${Math.min(...f.tiers.map((t) => t.level))}~${Math.max(...f.tiers.map((t) => t.maxlevel || 99))}`,
      }
    })
    .sort((a, b) => b.weight - a.weight || a.f.label.localeCompare(b.f.label, 'ko'))
})
</script>

<template>
  <div class="items-page craft-sim-page">

  <div class="patch-hero">
    <div class="patch-hero-inner">
      <div class="eyebrow">큐브 크래프트</div>
      <h1>크래프트 시뮬레이터</h1>
      <p>제작법과 레벨을 정하면 게임 확률대로 크래프트를 굴려보고, 원하는 옵션이 나올 확률과 평균 몇 번 만에 나오는지 계산해요.</p>
    </div>
  </div>

  <div class="grid-wrap cs-wrap">
    <section class="cs-panel">
      <div class="cs-title">제작법</div>
      <div class="cat-tabs">
        <button v-for="k in KINDS" :key="k" :class="{ active: kind === k }" @click="kind = k">{{ k }}</button>
      </div>
      <div class="cat-tabs">
        <button v-for="s in SLOTS" :key="s" :class="{ active: slot === s }" @click="slot = s">{{ s }}</button>
      </div>
      <div class="cs-recipe" v-if="recipe">
        <div class="cs-fixed">고정 옵션: {{ recipe.fam.label }}</div>
        <div class="cs-mats">
          재료:
          <span class="cs-mat" v-for="m in materials" :key="m.name">
            <img v-if="iconUrl(m.item)" :src="iconUrl(m.item)" alt="" />{{ m.name }}
          </span>
        </div>
      </div>

      <div class="cs-row">
        <label class="cs-field cs-base">
          베이스
          <select v-model="baseCode" class="cs-input">
            <option v-for="b in bases" :key="b.code" :value="b.code">{{ baseLabel(b) }}</option>
          </select>
        </label>
        <label class="cs-field">
          캐릭터 레벨
          <input type="number" min="1" max="99" v-model="clvl" class="cs-input" />
        </label>
        <label class="cs-field">
          재료 아이템 레벨
          <input type="number" min="1" max="99" v-model="inputIlvl" class="cs-input" />
        </label>
      </div>
      <div class="cs-levels" v-if="pools">
        <span>크래프트 아이템 레벨 <b>{{ ilvl }}</b></span>
        <span>옵션 레벨 <b>{{ pools.alvl }}</b></span>
        <span>
          무작위 옵션 개수:
          <template v-for="(p, i) in odds" :key="i"><b v-if="p">{{ i + 1 }}개 {{ Math.round(p * 100) }}%</b> </template>
        </span>
      </div>
      <div class="cs-hint">
        아이템 레벨 = 캐릭터 레벨/2 + 재료 아이템 레벨/2. 71 이상이면 무작위 옵션이 항상 4개예요.
        옵션은 레어 옵션 중에서 뽑히고(접두사·접미사 각각 최대 3개), 같은 종류는 겹치지 않아요.
      </div>
    </section>

    <div class="cat-tabs cs-tabs">
      <button :class="{ active: tab === 'sim' }" @click="tab = 'sim'">시뮬레이션</button>
      <button :class="{ active: tab === 'table' }" @click="tab = 'table'">가중치 표</button>
    </div>

    <section class="cs-panel" v-if="tab === 'table'">
      <div class="cs-title">옵션별 가중치 표</div>
      <div class="cs-hint">
        옵션 레벨 {{ pools?.alvl }}에서 붙을 수 있는 레어 옵션이에요.
        <b>한 번 뽑을 때</b> = 가중치 ÷ 같은 쪽 가중치 합(접두사 {{ slotTotals.p }}, 접미사 {{ slotTotals.s }})이고,
        <b>아이템에 붙을 확률</b>은 옵션 개수·접두/접미 50:50·같은 종류 제외를 반영해 {{ TABLE_RUNS.toLocaleString() }}번 굴린 값이에요.
        제작법 고정 옵션은 항상 붙어서 빠져 있어요. 줄을 누르면 단계별 가중치가 보여요.
      </div>
      <div class="cs-table-tools">
        <div class="cat-tabs">
          <button :class="{ active: !tableSlot }" @click="tableSlot = ''">전체 {{ families.length }}</button>
          <button :class="{ active: tableSlot === 'p' }" @click="tableSlot = 'p'">접두사</button>
          <button :class="{ active: tableSlot === 's' }" @click="tableSlot = 's'">접미사</button>
        </div>
        <input type="text" :value="tableQuery" @input="tableQuery = $event.target.value" class="cs-input cs-table-search" placeholder="옵션 검색 (예: 저항, 소서리스)" aria-label="옵션 검색" />
      </div>
      <div class="cs-table-wrap">
        <table class="cs-table">
          <thead>
            <tr><th>구분</th><th>옵션 (수치 범위)</th><th>가중치</th><th>한 번 뽑을 때</th><th>아이템에 붙을 확률</th><th>옵션 레벨</th></tr>
          </thead>
          <tbody>
            <template v-for="r in tableRows" :key="r.f.key">
              <tr class="cs-trow" :class="{ open: openKey === r.f.key }" @click="openKey = openKey === r.f.key ? '' : r.f.key">
                <td><span class="cs-slot" :class="r.f.slot">{{ r.f.slot === 'p' ? '접두' : '접미' }}</span></td>
                <td class="cs-tlabel">{{ r.f.label }}</td>
                <td class="num">{{ r.weight }}</td>
                <td class="num">{{ fmtPct(r.pick * 100) }}</td>
                <td class="num">
                  <template v-if="r.onItem !== null">
                    <span class="cs-tbar"><span :style="{ width: Math.min(100, r.onItem * 400) + '%' }"></span></span>{{ fmtPct(r.onItem * 100) }}
                  </template>
                  <span v-else class="cs-dim">계산 중…</span>
                </td>
                <td class="num">{{ r.levels }}</td>
              </tr>
              <tr class="cs-tiers" v-if="openKey === r.f.key">
                <td></td>
                <td colspan="5">
                  <div class="cs-tier" v-for="t in r.f.tiers" :key="t.name + t.level">
                    <span class="cs-tier-name">{{ t.name }}</span>
                    <span>{{ tierText(r.f, t) }}</span>
                    <span class="cs-dim">가중치 {{ t.freq }} · 레벨 {{ t.level }}~{{ t.maxlevel || 99 }}</span>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </section>

    <div class="cs-cols" v-else>
      <section class="cs-panel">
        <div class="cs-title">한 번 제작해보기</div>
        <button type="button" class="btn-primary cs-btn" :disabled="!recipe" @click="craftOnce">제작하기</button>
        <div class="cs-tooltip" v-if="rollTooltip">
          <ItemTooltipCanvas :tooltip="rollTooltip" />
        </div>
        <div class="cs-hint" v-else>누를 때마다 새로 굴려요.</div>
      </section>

      <section class="cs-panel">
        <div class="cs-title">원하는 옵션이 나올 확률</div>
        <div class="cs-hint">원하는 옵션을 최대 {{ MAX_TARGETS }}개 고르면, 전부 붙을 확률을 {{ RUNS.toLocaleString() }}번 굴려서 계산해요.</div>
        <div class="cs-target" v-for="(t, i) in targets" :key="i">
          <select v-model="t.key" class="cs-input cs-target-key" @change="t.min = ''" :aria-label="`목표 옵션 ${i + 1}`">
            <option value="">옵션 선택 ({{ families.length }}종)</option>
            <option v-for="f in targetOptionsFor(i)" :key="f.key" :value="f.key">{{ f.slot === 'p' ? '[접두]' : '[접미]' }} {{ f.label }}</option>
          </select>
          <select
            v-if="firstRange(t) && firstRange(t)[0] !== firstRange(t)[1]" v-model="t.min" class="cs-input cs-target-min"
            :aria-label="`목표 옵션 ${i + 1} 최소 수치`"
          >
            <option value="">수치 무관</option>
            <option v-for="n in firstRange(t)[1] - firstRange(t)[0] + 1" :key="n" :value="firstRange(t)[0] + n - 1">
              {{ firstRange(t)[0] + n - 1 }} 이상
            </option>
          </select>
          <button type="button" class="cs-x" v-if="targets.length > 1" @click="targets.splice(i, 1)" aria-label="목표 옵션 삭제">✕</button>
        </div>
        <button type="button" class="cs-add" v-if="targets.length < MAX_TARGETS" @click="targets.push({ key: '', min: '' })">+ 옵션 추가</button>
        <button type="button" class="btn-primary cs-btn" :disabled="!recipe" @click="runSim">{{ RUNS.toLocaleString() }}번 시뮬레이션</button>

        <template v-if="result">
          <div class="cs-success" v-if="successP !== null">
            <div class="cs-success-p">{{ fmtPct(successP) }}</div>
            <div v-if="expectedTries">
              평균 <b>{{ expectedTries.toLocaleString() }}번</b>에 1번 나와요.
              재료로 치면 {{ materials.slice(2).map((m) => `${m.name} ${expectedTries.toLocaleString()}개`).join(', ') }}와 주얼·매직 {{ base.name_ko || base.subtitle }} 각각 {{ expectedTries.toLocaleString() }}개쯤이에요.
            </div>
            <div v-else>{{ RUNS.toLocaleString() }}번 중에 한 번도 안 나왔어요. 조건을 낮춰보세요.</div>
          </div>
          <div class="cs-sub">무작위 옵션 개수</div>
          <div class="cs-bars">
            <div class="cs-bar" v-for="(c, i) in result.countDist" :key="i">
              <span>{{ i + 1 }}개</span>
              <div class="cs-bar-track"><div class="cs-bar-fill" :style="{ width: pct(c, result.runs) + '%' }"></div></div>
              <span>{{ fmtPct(pct(c, result.runs)) }}</span>
            </div>
          </div>
          <div class="cs-sub">자주 붙는 옵션 (아이템 {{ result.runs.toLocaleString() }}개 중)</div>
          <div class="cs-bars">
            <div class="cs-bar" v-for="a in topAffixes" :key="a.label">
              <span class="cs-bar-label">{{ a.label }}</span>
              <div class="cs-bar-track"><div class="cs-bar-fill" :style="{ width: a.p + '%' }"></div></div>
              <span>{{ fmtPct(a.p) }}</span>
            </div>
          </div>
        </template>
      </section>
    </div>
  </div>
  </div>
</template>

<style scoped>
.cs-wrap{max-width:1180px; display:flex; flex-direction:column; gap:16px;}
.cs-panel{border:1px solid var(--border-soft); background:var(--panel); border-radius:16px; padding:20px 22px; display:flex; flex-direction:column; gap:12px; min-width:0;}
.cs-title{font-family:'Noto Serif KR', serif; font-weight:700; font-size:17px;}
.cs-panel .cat-tabs{flex-wrap:wrap;}
.cs-panel .cat-tabs button{border-radius:999px;}
.cs-recipe{display:flex; flex-direction:column; gap:6px; padding:12px 14px; background:var(--panel-2); border-radius:12px;}
.cs-fixed{font-size:13px; color:#8c8cff;}
.cs-mats{display:flex; flex-wrap:wrap; align-items:center; gap:6px; font-size:12px; color:var(--text-dim);}
.cs-mat{display:inline-flex; align-items:center; gap:4px; border:1px solid var(--border-soft); border-radius:999px; padding:3px 10px 3px 6px; color:var(--text-muted);}
.cs-mat img{width:18px; height:18px; image-rendering:pixelated;}
.cs-row{display:flex; flex-wrap:wrap; gap:12px;}
.cs-field{display:flex; flex-direction:column; gap:4px; font-size:12px; color:var(--text-dim);}
.cs-base{flex:1; min-width:220px;}
.cs-input{
  background:var(--panel-2); border:1px solid var(--border); color:var(--text); font-size:13px;
  padding:8px 10px; border-radius:8px; font-family:'Noto Sans KR', sans-serif;
}
.cs-field input.cs-input{width:120px;}
.cs-levels{display:flex; flex-wrap:wrap; gap:8px 18px; font-size:12.5px; color:var(--text-muted);}
.cs-levels b{color:var(--gold); font-weight:600;}
.cs-hint{font-size:11.5px; color:var(--text-dim); line-height:1.6;}
.cs-cols{display:grid; grid-template-columns:minmax(0, 360px) minmax(0, 1fr); gap:16px; align-items:start;}
.cs-btn{align-self:flex-start; padding:9px 18px; font-size:13px; border-radius:10px;}
.cs-btn:disabled{opacity:.5; cursor:not-allowed;}
.cs-tooltip{display:flex; justify-content:center;}
.cs-target{display:flex; gap:8px; align-items:center;}
.cs-target-key{flex:1; min-width:0;}
.cs-target-min{width:110px; flex:none;}
.cs-x{color:var(--text-dim); background:transparent; border:0; cursor:pointer; font-size:12px;}
.cs-add{align-self:flex-start; font-size:12.5px; color:var(--gold); border:1px dashed var(--gold-dim); padding:6px 14px; border-radius:10px; background:transparent; cursor:pointer;}
.cs-success{border:1px solid var(--gold-dim); background:rgba(200,163,77,0.08); border-radius:12px; padding:14px 16px; font-size:13px; color:var(--text-muted); line-height:1.6;}
.cs-success-p{font-family:'Noto Serif KR', serif; font-size:28px; font-weight:700; color:var(--gold);}
.cs-success b{color:var(--gold);}
.cs-sub{font-size:12.5px; color:var(--gold-dim); font-weight:600; margin-top:4px;}
.cs-bars{display:flex; flex-direction:column; gap:6px;}
.cs-bar{display:grid; grid-template-columns:minmax(0, 220px) 1fr 64px; gap:10px; align-items:center; font-size:12px; color:var(--text-muted);}
.cs-bar span:last-child{text-align:right;}
.cs-bar-label{overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.cs-bar-track{height:8px; background:var(--panel-2); border-radius:999px; overflow:hidden;}
.cs-bar-fill{height:100%; background:var(--gold-dim); border-radius:999px;}
.cs-tabs button{border-radius:999px;}
.cs-table-tools{display:flex; flex-wrap:wrap; gap:10px 16px; align-items:center; justify-content:space-between;}
.cs-table-search{width:260px; max-width:100%;}
.cs-table-wrap{overflow-x:auto;}
.cs-table{width:100%; border-collapse:collapse; font-size:12.5px;}
.cs-table th{text-align:left; font-weight:600; color:var(--gold-dim); padding:8px 10px; border-bottom:1px solid var(--border); white-space:nowrap;}
.cs-table td{padding:8px 10px; border-bottom:1px solid var(--border-soft); color:var(--text-muted); vertical-align:middle;}
.cs-table .num{text-align:right; white-space:nowrap; font-variant-numeric:tabular-nums;}
.cs-table th:nth-child(n+3){text-align:right;}
.cs-trow{cursor:pointer;}
.cs-trow:hover td, .cs-trow.open td{background:var(--panel-2);}
.cs-tlabel{color:#8c8cff; min-width:220px;}
.cs-slot{font-size:11px; padding:2px 8px; border-radius:999px; border:1px solid var(--border);}
.cs-slot.p{color:var(--gold); border-color:var(--gold-dim);}
.cs-slot.s{color:var(--teal); border-color:var(--teal);}
.cs-tbar{display:inline-block; width:56px; height:6px; background:var(--panel-2); border-radius:999px; margin-right:8px; vertical-align:middle; overflow:hidden;}
.cs-tbar span{display:block; height:100%; background:var(--gold-dim);}
.cs-dim{color:var(--text-dim);}
.cs-tiers td{background:var(--panel-2);}
.cs-tier{display:flex; flex-wrap:wrap; gap:4px 14px; padding:3px 0; font-size:12px;}
.cs-tier-name{color:var(--text); min-width:120px;}
@media (max-width:860px){
  .cs-cols{grid-template-columns:1fr;}
  .cs-bar{grid-template-columns:minmax(0, 140px) 1fr 56px;}
}
</style>
