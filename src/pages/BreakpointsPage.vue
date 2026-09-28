<script setup>
// 브레이크포인트 계산기 - 시전 속도(FCR)·타격 회복 속도(FHR)·막기 속도(FBR)는 25프레임/초 단위라
// 정해진 % 를 넘을 때만 실제로 빨라짐. 지금 수치로 몇 프레임인지, 다음 단계까지 몇 % 더 필요한지 보여줌
// 표: src/data/breakpoints.json (Maxroll·Arreat Summit, 악마술사는 네크로맨서와 같은 프레임)
import { ref, computed, watch } from 'vue'
import bp from '../data/breakpoints.json'

const STATS = [
  { key: 'fcr', label: '시전 속도', short: 'FCR' },
  { key: 'fhr', label: '타격 회복 속도', short: 'FHR' },
  { key: 'fbr', label: '막기 속도', short: 'FBR' },
]
const clsKey = ref('sorc')
const cls = computed(() => bp.classes.find((c) => c.key === clsKey.value))
const values = ref({ fcr: 0, fhr: 0, fbr: 0 })
const variant = ref({ fcr: 0, fhr: 0, fbr: 0 })
watch(clsKey, () => (variant.value = { fcr: 0, fhr: 0, fbr: 0 }))

const num = (v) => Math.max(0, Math.floor(Number(v) || 0))
function stateOf(statKey) {
  const list = cls.value[statKey]
  if (!list?.length) return null
  const t = list[variant.value[statKey]] || list[0]
  const v = num(values.value[statKey])
  let idx = 0
  t.table.forEach(([p], i) => { if (v >= p) idx = i })
  const next = t.table[idx + 1] || null
  return { variants: list, table: t.table, idx, frames: t.table[idx][1], next, need: next ? next[0] - v : 0 }
}
const states = computed(() => Object.fromEntries(STATS.map((s) => [s.key, stateOf(s.key)])))
// 초당 동작 횟수 (25프레임 기준) - 체감용
const perSec = (frames) => (25 / frames).toFixed(2)
</script>

<template>
  <div class="items-page bp-page">
  <div class="patch-hero">
    <div class="patch-hero-inner">
      <div class="eyebrow">장비 맞추기</div>
      <h1>브레이크포인트 계산기</h1>
      <p>시전·타격 회복·막기 속도는 정해진 %를 넘어야만 실제로 빨라져요. 지금 수치로 몇 프레임인지, 다음 단계까지 얼마나 더 필요한지 알려드려요.</p>
    </div>
  </div>

  <div class="grid-wrap bp-wrap">
    <div class="cat-tabs bp-classes">
      <button v-for="c in bp.classes" :key="c.key" :class="{ active: clsKey === c.key }" @click="clsKey = c.key">{{ c.name }}</button>
    </div>

    <div class="bp-grid">
      <section class="bp-card" v-for="s in STATS" :key="s.key" v-show="states[s.key]">
        <template v-if="states[s.key]">
          <div class="bp-card-head">
            <div>
              <div class="bp-title">{{ s.label }} <small>{{ s.short }}</small></div>
              <select
                v-if="states[s.key].variants.length > 1" v-model.number="variant[s.key]" class="bp-select"
                :aria-label="`${s.label} 종류`"
              >
                <option v-for="(v, i) in states[s.key].variants" :key="v.label" :value="i">{{ v.label }}</option>
              </select>
              <div class="bp-variant" v-else>{{ states[s.key].variants[0].label }}</div>
            </div>
            <label class="bp-input">
              지금 수치
              <span><input type="number" min="0" max="999" v-model="values[s.key]" :aria-label="`현재 ${s.label}`" />%</span>
            </label>
          </div>

          <div class="bp-now">
            <div><b>{{ states[s.key].frames }}</b> 프레임 <small>(초당 {{ perSec(states[s.key].frames) }}번)</small></div>
            <div class="bp-next" v-if="states[s.key].next">
              다음 단계 <b>{{ states[s.key].next[0] }}%</b> ({{ states[s.key].next[1] }}프레임)까지 <b class="up">+{{ states[s.key].need }}%</b>
            </div>
            <div class="bp-next done" v-else>최고 단계예요</div>
          </div>

          <div class="bp-table">
            <button
              type="button" v-for="([p, f], i) in states[s.key].table" :key="p" class="bp-row"
              :class="{ on: i === states[s.key].idx, passed: i < states[s.key].idx }" @click="values[s.key] = p"
            >
              <span>{{ p }}%</span><span>{{ f }}프레임</span>
            </button>
          </div>
        </template>
      </section>
    </div>
    <div class="bp-foot">
      줄을 누르면 그 수치로 맞춰져요. 표: Maxroll·Arreat Summit 기준, 악마술사는 네크로맨서와 같은 프레임이에요.
    </div>
  </div>
  </div>
</template>

<style scoped>
.bp-wrap{max-width:1180px; display:flex; flex-direction:column; gap:16px;}
.bp-classes button{border-radius:999px;}
.bp-grid{display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:14px; align-items:start;}
.bp-card{border:1px solid var(--border-soft); background:var(--panel); border-radius:16px; padding:18px; display:flex; flex-direction:column; gap:12px;}
.bp-card-head{display:flex; justify-content:space-between; gap:10px; align-items:flex-start;}
.bp-title{font-family:'Noto Serif KR', serif; font-weight:700; font-size:16px;}
.bp-title small{font-family:'Noto Sans KR', sans-serif; font-size:11px; color:var(--text-dim); font-weight:400; margin-left:4px;}
.bp-variant{font-size:11.5px; color:var(--text-dim); margin-top:2px;}
.bp-select{margin-top:4px; background:var(--panel-2); border:1px solid var(--border); color:var(--text); font-size:12px; padding:4px 8px; border-radius:8px; max-width:190px;}
.bp-input{display:flex; flex-direction:column; align-items:flex-end; gap:3px; font-size:11px; color:var(--text-dim);}
.bp-input span{display:flex; align-items:center; gap:4px; font-size:13px; color:var(--text-muted);}
.bp-input input{width:72px; background:var(--panel-2); border:1px solid var(--border); color:var(--text); font-size:15px; padding:6px 8px; border-radius:8px; text-align:right;}
.bp-now{padding:12px 14px; background:var(--panel-2); border-radius:12px; font-size:13px; color:var(--text-muted); display:flex; flex-direction:column; gap:4px;}
.bp-now b{font-family:'Noto Serif KR', serif; font-size:22px; color:var(--gold);}
.bp-now small{font-size:11px; color:var(--text-dim);}
.bp-next b{font-family:'Noto Sans KR', sans-serif; font-size:13px; color:var(--text);}
.bp-next b.up{color:var(--teal);}
.bp-next.done{color:var(--gold-dim);}
.bp-table{display:flex; flex-direction:column; gap:3px;}
.bp-row{display:flex; justify-content:space-between; padding:6px 12px; border-radius:8px; font-size:12.5px; color:var(--text-muted); border:1px solid transparent; font-variant-numeric:tabular-nums;}
.bp-row:hover{background:var(--panel-2);}
.bp-row.passed{color:var(--text-dim);}
.bp-row.on{border-color:var(--gold-dim); background:rgba(200,163,77,0.1); color:var(--gold); font-weight:600;}
.bp-foot{font-size:11.5px; color:var(--text-dim); text-align:center; line-height:1.6;}
@media (max-width:900px){ .bp-grid{grid-template-columns:1fr;} }
</style>
