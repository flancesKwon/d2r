<script setup>
// 공격 속도(IAS) 계산기 - 직업·무기·스킬별로 장비 공속 몇 %에서 공격이 몇 프레임인지
// 계산: src/iasCalc.js (게임 공식 + D2R 3.3 동작 프레임), 무기: src/data/iasWeapons.json (weapons.json)
import { ref, computed, watch } from 'vue'
import weapons from '../data/iasWeapons.json'
import {
  IAS_CLASSES, IAS_FORMS, skillsFor, weaponOk, canDual, offhandOk, isTwoHanded, buffsFor,
  iasTables, rowState, framesText, framesAvg,
} from '../iasCalc.js'

const cls = ref('pal')
const form = ref('human')
const skill = ref('zeal')
const w1Code = ref('7cr')
const w2Code = ref('')
const oneHand = ref(false)
const wias1 = ref(0)
const wias2 = ref(0)
const gias = ref(0)
const buffs = ref({})
const chill = ref(false)
const decrep = ref(false)

const charClasses = IAS_CLASSES.filter((c) => !c.merc)
const mercClasses = IAS_CLASSES.filter((c) => c.merc)
const byCode = new Map(weapons.map((w) => [w.code, w]))
const w1 = computed(() => byCode.get(w1Code.value) || null)
const w2 = computed(() => (dualOk.value && byCode.get(w2Code.value)) || null)

const forms = computed(() => (cls.value === 'dru' ? IAS_FORMS : IAS_FORMS.slice(0, 1)))
const skills = computed(() => skillsFor(cls.value, form.value))
const skillObj = computed(() => skills.value.find((s) => s.key === skill.value))

// 무기 목록을 종류별로 묶음
function grouped(list) {
  const g = new Map()
  for (const w of list) {
    if (!g.has(w.sub)) g.set(w.sub, [])
    g.get(w.sub).push(w)
  }
  return [...g].map(([sub, items]) => ({ sub, items }))
}
const w1List = computed(() => weapons.filter((w) => weaponOk(cls.value, form.value, skill.value, w)))
const unarmedOk = computed(() => weaponOk(cls.value, form.value, skill.value, null))
const w1Groups = computed(() => grouped(w1List.value))
const dualOk = computed(() => canDual(cls.value, form.value, skill.value, w1.value))
const dualNeed = computed(() => skillObj.value?.dual === 'need')
const w2Groups = computed(() => grouped(weapons.filter((w) => offhandOk(cls.value, skill.value, w1.value, w))))
const oneHandOk = computed(() => cls.value === 'bar' && !!w1.value?.oneOrTwo && !w2.value && form.value === 'human' && skill.value !== 'ww')
const buffList = computed(() => buffsFor(cls.value, form.value, skill.value))

// 직업·모습·스킬을 바꾸면 안 맞는 선택은 첫 번째로 돌림
watch(cls, () => { if (!forms.value.some((f) => f.key === form.value)) form.value = 'human' })
// 워울프 모습은 워울프 스킬이 최소 1레벨 - 비어 있으면 흔한 값(20)으로 채워둠
watch(form, (f) => { if (f === 'wolf' && !num(buffs.value.wolf, 99)) buffs.value.wolf = 20 })
watch([cls, form], () => { if (!skills.value.some((s) => s.key === skill.value)) skill.value = skills.value[0].key })
watch([cls, form, skill], () => {
  if (!(w1.value ? weaponOk(cls.value, form.value, skill.value, w1.value) : unarmedOk.value)) {
    w1Code.value = unarmedOk.value ? '' : w1List.value[0]?.code || ''
  }
}, { immediate: true })
watch([w1, dualOk], () => {
  if (!dualOk.value) return
  if (w2Code.value && !offhandOk(cls.value, skill.value, w1.value, byCode.get(w2Code.value))) w2Code.value = ''
  // 쌍수 필수 스킬은 보조 무기를 주무기와 같은 걸로 채워둠
  if (!w2Code.value && dualNeed.value) {
    const same = offhandOk(cls.value, skill.value, w1.value, w1.value) ? w1.value : weapons.find((w) => offhandOk(cls.value, skill.value, w1.value, w))
    w2Code.value = same?.code || ''
  }
}, { immediate: true })

const num = (v, max = 999) => Math.max(0, Math.min(max, Math.floor(Number(v) || 0)))
const input = computed(() => ({
  cls: cls.value, form: form.value, skill: skill.value, w1: w1.value, w2: w2.value,
  oneHand: oneHandOk.value && oneHand.value, wias1: num(wias1.value), wias2: w2.value ? num(wias2.value) : 0,
  gias: num(gias.value), buffs: Object.fromEntries(Object.entries(buffs.value).map(([k, v]) => [k, num(v, 99)])),
  chill: chill.value, decrep: decrep.value,
}))
const missingOffhand = computed(() => dualNeed.value && !w2.value)
const result = computed(() => (missingOffhand.value ? null : iasTables(input.value)))
const tables = computed(() => (result.value?.tables || []).map((t) => ({ ...t, state: rowState(t.rows, input.value.gias) })))
const main = computed(() => tables.value[0] || null)
const nowFrames = computed(() => main.value?.rows[main.value.state.idx]?.frames ?? null)
const perSec = (f) => (25 / framesAvg(f)).toFixed(2)
const isSeq = computed(() => !!skillObj.value?.seq)
const isRoll = computed(() => Array.isArray(nowFrames.value))

const wLabel = (w) => `${w.ko} (${w.wsm > 0 ? '+' : ''}${w.wsm})`
const totalIas = computed(() => input.value.gias + input.value.wias1)
</script>

<template>
  <div class="ias">
    <section class="ias-card ias-form">
      <div class="ias-field">
        <div class="ias-label">직업</div>
        <div class="ias-chips">
          <button v-for="c in charClasses" :key="c.key" type="button" :class="{ active: cls === c.key }" @click="cls = c.key">{{ c.name }}</button>
        </div>
      </div>
      <div class="ias-field">
        <div class="ias-label">용병</div>
        <div class="ias-chips">
          <button v-for="c in mercClasses" :key="c.key" type="button" :class="{ active: cls === c.key }" @click="cls = c.key">{{ c.name }}</button>
        </div>
      </div>
      <div class="ias-field" v-if="forms.length > 1">
        <div class="ias-label">모습</div>
        <div class="ias-chips">
          <button v-for="f in forms" :key="f.key" type="button" :class="{ active: form === f.key }" @click="form = f.key">{{ f.name }}</button>
        </div>
      </div>
      <label class="ias-field">
        <span class="ias-label">스킬</span>
        <select v-model="skill" class="ias-select" aria-label="스킬">
          <option v-for="s in skills" :key="s.key" :value="s.key">{{ s.ko }}{{ s.key === 'zeal' && cls !== 'pal' ? ' (아이템 스킬)' : '' }}</option>
        </select>
      </label>

      <div class="ias-row2">
        <label class="ias-field grow">
          <span class="ias-label">{{ w2 || dualNeed ? '주무기 (오른손)' : '무기' }}</span>
          <select v-model="w1Code" class="ias-select" aria-label="무기">
            <option v-if="unarmedOk" value="">맨손</option>
            <optgroup v-for="g in w1Groups" :key="g.sub" :label="g.sub">
              <option v-for="w in g.items" :key="w.code" :value="w.code">{{ wLabel(w) }}</option>
            </optgroup>
          </select>
        </label>
        <label class="ias-field num" v-if="w2">
          <span class="ias-label">무기 공속</span>
          <span class="ias-num"><input type="number" min="0" max="120" v-model="wias1" aria-label="주무기 공속" />%</span>
        </label>
      </div>
      <label class="ias-check" v-if="oneHandOk">
        <input type="checkbox" v-model="oneHand" /> 한손으로 들기 (바바리안 양손검)
      </label>

      <div class="ias-row2" v-if="dualOk">
        <label class="ias-field grow">
          <span class="ias-label">보조 무기 (왼손){{ dualNeed ? '' : ' (선택)' }}</span>
          <select v-model="w2Code" class="ias-select" aria-label="보조 무기">
            <option v-if="!dualNeed" value="">없음 (방패 등)</option>
            <optgroup v-for="g in w2Groups" :key="g.sub" :label="g.sub">
              <option v-for="w in g.items" :key="w.code" :value="w.code">{{ wLabel(w) }}</option>
            </optgroup>
          </select>
        </label>
        <label class="ias-field num" v-if="w2">
          <span class="ias-label">무기 공속</span>
          <span class="ias-num"><input type="number" min="0" max="120" v-model="wias2" aria-label="보조 무기 공속" />%</span>
        </label>
      </div>

      <label class="ias-field">
        <span class="ias-label">{{ w2 ? '무기 외 장비 공속' : '장비 공속 합계' }}</span>
        <span class="ias-num big"><input type="number" min="0" max="999" v-model="gias" aria-label="장비 공속" />%</span>
      </label>

      <div class="ias-field" v-if="buffList.length">
        <div class="ias-label">스킬·오라 레벨</div>
        <div class="ias-buffs">
          <label v-for="b in buffList" :key="b.key" class="ias-buff">
            <span>{{ b.ko }}</span>
            <span class="ias-buff-val">
              <input type="number" min="0" max="99" v-model="buffs[b.key]" :aria-label="b.ko" placeholder="0" />
              <small v-if="num(buffs[b.key], 99)">+{{ b.calc(num(buffs[b.key], 99)) }}%</small>
            </span>
          </label>
        </div>
      </div>
      <div class="ias-field">
        <div class="ias-label">느려짐</div>
        <label class="ias-check"><input type="checkbox" v-model="chill" /> 냉기로 느려짐 (-50)</label>
        <label class="ias-check"><input type="checkbox" v-model="decrep" /> 디크리피파이 (-50)</label>
      </div>
    </section>

    <section class="ias-card ias-result">
      <div v-if="missingOffhand" class="ias-empty">무기 두 개 필요 - 보조 무기 선택</div>
      <template v-else-if="main">
        <div class="ias-now">
          <div class="ias-now-main">
            <b>{{ isRoll ? framesText(nowFrames).split(' (')[0] : nowFrames }}</b> 프레임
            <span v-if="isRoll" class="ias-last">· 마지막 타 {{ nowFrames[nowFrames.length - 1] }}프레임</span>
            <small>(초당 {{ perSec(nowFrames) }}{{ isSeq ? '동작' : isRoll ? '타' : '번' }})</small>
          </div>
          <div class="ias-next" v-if="main.state.next">
            다음 단계 <b>{{ main.state.next.ias }}%</b> ({{ framesText(main.state.next.frames) }}프레임)까지 <b class="up">+{{ main.state.need }}%</b>
          </div>
          <div class="ias-next done" v-else>최고 단계</div>
          <div class="ias-meta">EIAS {{ result.eias }}<template v-if="!w2"> · 공속 합계 {{ totalIas }}%</template></div>
        </div>

        <div class="ias-tables" :class="{ multi: tables.length > 1 }">
          <div v-for="(t, ti) in tables" :key="ti" class="ias-table">
            <div class="ias-table-title" v-if="t.label">{{ t.label }}</div>
            <div class="ias-table-head"><span>{{ w2 ? '무기 외 공속' : '공속' }}</span><span>프레임</span></div>
            <button
              type="button" v-for="(r, i) in t.rows" :key="r.ias" class="ias-row"
              :class="{ on: i === t.state.idx, passed: i < t.state.idx }" @click="gias = r.ias"
            >
              <span>{{ r.ias }}%</span><span>{{ framesText(r.frames) }}</span>
            </button>
          </div>
        </div>
      </template>
    </section>
  </div>
</template>

<style scoped>
.ias{display:grid; grid-template-columns:minmax(0, 400px) minmax(0, 1fr); gap:16px; align-items:start;}
.ias-card{border:1px solid var(--border-soft); background:var(--panel); border-radius:16px; padding:18px; display:flex; flex-direction:column; gap:14px;}
.ias-field{display:flex; flex-direction:column; gap:6px; min-width:0;}
.ias-field.grow{flex:1;}
.ias-field.num{width:96px; flex:none;}
.ias-label{font-size:12px; color:var(--text-muted); font-weight:600;}
.ias-label small{font-weight:400; color:var(--text-dim); margin-left:4px;}
.ias-chips{display:flex; flex-wrap:wrap; gap:6px;}
.ias-chips button{padding:6px 12px; border-radius:999px; border:1px solid var(--border); background:var(--panel-2); color:var(--text-muted); font-size:12.5px;}
.ias-chips button.active{border-color:var(--gold-dim); color:var(--gold); background:rgba(200,163,77,0.1); font-weight:600;}
.ias-select{width:100%; background:var(--panel-2); border:1px solid var(--border); color:var(--text); font-size:13px; padding:8px 10px; border-radius:10px;}
.ias-row2{display:flex; gap:10px; align-items:flex-end;}
.ias-num{display:flex; align-items:center; gap:4px; color:var(--text-muted); font-size:13px;}
.ias-num input, .ias-buff input{width:100%; min-width:0; background:var(--panel-2); border:1px solid var(--border); color:var(--text); font-size:14px; padding:7px 8px; border-radius:10px; text-align:right;}
.ias-num.big input{font-size:16px; max-width:120px;}
.ias-check{display:flex; align-items:center; gap:8px; font-size:12.5px; color:var(--text-muted); cursor:pointer;}
.ias-buffs{display:flex; flex-direction:column; gap:6px;}
.ias-buff{display:flex; justify-content:space-between; align-items:center; gap:10px; font-size:12.5px; color:var(--text-muted);}
.ias-buff-val{display:flex; align-items:center; gap:6px; flex:none;}
.ias-buff-val input{width:64px;}
.ias-buff-val small{color:var(--teal); font-size:11.5px; min-width:38px;}
.ias-empty{color:var(--text-dim); font-size:13px; padding:20px 0; text-align:center;}
.ias-now{padding:14px 16px; background:var(--panel-2); border-radius:12px; font-size:13px; color:var(--text-muted); display:flex; flex-direction:column; gap:4px;}
.ias-now-main b{font-family:'Noto Serif KR', serif; font-size:26px; color:var(--gold);}
.ias-now small{font-size:11px; color:var(--text-dim);}
.ias-last{font-size:12.5px; color:var(--text); margin:0 4px;}
.ias-next b{color:var(--text);}
.ias-next b.up{color:var(--teal);}
.ias-next.done{color:var(--gold-dim);}
.ias-meta{font-size:11.5px; color:var(--text-dim);}
.ias-tables{display:grid; grid-template-columns:minmax(0, 360px); gap:14px;}
.ias-tables.multi{grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));}
.ias-table{display:flex; flex-direction:column; gap:3px;}
.ias-table-title{font-size:12.5px; font-weight:600; color:var(--text); margin-bottom:4px;}
.ias-table-head{display:flex; justify-content:space-between; padding:0 12px 4px; font-size:11px; color:var(--text-dim);}
.ias-row{display:flex; justify-content:space-between; padding:6px 12px; border-radius:8px; font-size:12.5px; color:var(--text-muted); border:1px solid transparent; font-variant-numeric:tabular-nums;}
.ias-row:hover{background:var(--panel-2);}
.ias-row.passed{color:var(--text-dim);}
.ias-row.on{border-color:var(--gold-dim); background:rgba(200,163,77,0.1); color:var(--gold); font-weight:600;}
@media (max-width:900px){ .ias{grid-template-columns:1fr;} }
</style>
