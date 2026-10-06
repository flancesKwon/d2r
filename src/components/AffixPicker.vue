<script setup>
// 매직/레어/크래프트 옵션 입력 - 접두사·접미사를 한 목록에서 검색해 고르고(종류는 옆에 표시만),
// 수치는 직접 입력 (게임 범위 밖이면 범위 끝으로 맞춤). 규칙은 src/magicAffixes.js
// modelValue: { p: [{ key, values }], s: [{ key, values }] } - 고른 옵션만 들어감
import { computed, ref, watch, nextTick, toRaw } from 'vue'
import { familyText, filledValues } from '../magicAffixes.js'
import { squashText } from '../itemSearch.js'
import { affixText } from '../i18n.js'

const props = defineProps({
  families: { type: Array, required: true },
  limits: { type: Object, required: true },
  modelValue: { type: Object, required: true },
})
const emit = defineEmits(['update:modelValue'])

const SLOT_KO = { p: '접두사', s: '접미사' }
// 옵션 이름 (영어 화면이면 영어 문구 - 검색·강조도 이 이름으로)
const labelOf = (f) => affixText(f.label)
const famByKey = computed(() => new Map(props.families.map((f) => [f.key, f])))

// 화면 목록 (고른 순서 그대로, 아직 안 고른 빈 줄 포함)
const blank = () => ({ slot: '', key: '', values: [], q: '', open: false, active: 0 })
const list = ref([])
let emitted = null
watch(() => props.modelValue, (m) => {
  if (toRaw(m) === emitted) return
  list.value = [...(m.p || []).map((r) => ({ ...blank(), ...r, slot: 'p' })), ...(m.s || []).map((r) => ({ ...blank(), ...r, slot: 's' }))].filter((r) => r.key)
  if (!list.value.length) list.value.push(blank())
}, { immediate: true })
function sync() {
  const picked = list.value.filter((r) => r.key)
  const of = (slot) => picked.filter((r) => r.slot === slot).map((r) => ({ key: r.key, values: [...r.values] }))
  emitted = { p: of('p'), s: of('s') }
  emit('update:modelValue', emitted)
}

const count = (slot, except) => list.value.filter((r) => r !== except && r.key && r.slot === slot).length
const pickedTotal = computed(() => list.value.filter((r) => r.key).length)
const canAdd = computed(() => list.value.length < props.limits.total && list.value.every((r) => r.key))
// 접두사·접미사 칸이 다 찼으면 그 종류는 못 고름 (같은 옵션은 한 번만)
const slotFull = (slot, row) => count(slot, row) >= props.limits[slot]
// 한글 조합 중인 끝 글자(자음·모음만 친 상태 "저ㅎ")는 빼고 찾음 - 치는 동안 목록이 비지 않게
const JAMO_TAIL = /[ㄱ-ㅎㅏ-ㅣ]+$/
const queryOf = (row) => squashText(row.q).replace(JAMO_TAIL, '')
function optionsFor(row) {
  const taken = new Set(list.value.filter((r) => r !== row).map((r) => r.key))
  const q = queryOf(row)
  const hits = props.families.filter((f) => !taken.has(f.key) && (!q || squashText(labelOf(f)).includes(q)))
  // 검색어로 시작하는 옵션 먼저 ("시전" -> 시전 속도가 "…번개 시전"보다 위)
  if (q) hits.sort((a, b) => squashText(labelOf(b)).startsWith(q) - squashText(labelOf(a)).startsWith(q))
  return hits.slice(0, 60)
}
function pick(row, f) {
  if (slotFull(f.slot, row)) return
  Object.assign(row, { slot: f.slot, key: f.key, values: [], q: '', open: false })
  sync()
}
function change(row) {
  Object.assign(row, { key: '', slot: '', values: [], open: true })
  sync()
}
const rootEl = ref(null)
function addRow() {
  if (!canAdd.value) return
  list.value.push({ ...blank(), open: true })
  nextTick(() => [...(rootEl.value?.querySelectorAll('.affix-search') || [])].pop()?.focus())
}
function removeRow(i) {
  list.value.splice(i, 1)
  if (!list.value.length) list.value.push(blank())
  sync()
}
const closeSoon = (row) => setTimeout(() => (row.open = false), 150)

// 자동완성: v-model 은 한글 조합이 끝나야 값이 바뀌어서 input 이벤트 값을 바로 씀
function onType(row, e) {
  row.q = e.target.value
  row.open = true
  row.active = 0
}
// ↑↓ 로 옮기고 Enter 로 고름 (Enter 가 판매글 등록 폼을 보내지 않게 막음), Esc 닫기
function onKey(row, e, i) {
  if (e.isComposing) return
  const opts = optionsFor(row)
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault()
    // 닫혀 있으면 열기만 (첫 줄부터)
    if (!row.open) { row.open = true; row.active = 0; return }
    if (!opts.length) return
    row.active = (row.active + (e.key === 'ArrowDown' ? 1 : -1) + opts.length) % opts.length
    nextTick(() => rootEl.value?.querySelectorAll('.affix-row')[i]?.querySelector('.affix-opt.active')?.scrollIntoView({ block: 'nearest' }))
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const f = opts[row.active] || opts[0]
    if (row.open && f) pick(row, f)
  } else if (e.key === 'Escape') {
    row.open = false
  }
}
// 옵션 이름에서 검색어 부분 강조 (띄어쓰기 무시하고 맞춘 위치)
function highlight(label, row) {
  const q = queryOf(row)
  if (!q) return [{ t: label }]
  const idx = []
  let squashed = ''
  for (let i = 0; i < label.length; i++) if (!/\s/.test(label[i])) { idx.push(i); squashed += label[i].toLowerCase() }
  const at = squashed.indexOf(q)
  if (at < 0) return [{ t: label }]
  const from = idx[at], to = idx[at + q.length - 1] + 1
  return [{ t: label.slice(0, from) }, { t: label.slice(from, to), hit: true }, { t: label.slice(to) }].filter((p) => p.t)
}

// 수치 칸 (고정 수치는 자동) - 직접 입력, 칸을 벗어나면 범위 안으로 맞춤
const inputSlots = (fam) => fam.slotRanges.map((r, i) => ({ i, lo: r[0], hi: r[1] })).filter((s) => s.lo !== s.hi)
const bad = (row, s) => {
  const v = row.values[s.i]
  return v !== undefined && v !== '' && v !== null && (!Number.isInteger(Number(v)) || Number(v) < s.lo || Number(v) > s.hi)
}
function setValue(row, s, raw) {
  row.values[s.i] = raw === '' ? undefined : Number(raw)
  sync()
}
function clampValue(row, s, e) {
  const v = row.values[s.i]
  if (v === undefined || v === null || Number.isNaN(v)) return
  const fixed = Math.min(s.hi, Math.max(s.lo, Math.round(v)))
  if (fixed !== v) { row.values[s.i] = fixed; e.target.value = fixed; sync() }
}
function previewOf(row) {
  const fam = famByKey.value.get(row.key)
  if (!fam) return ''
  return familyText(fam, filledValues(fam, row.values).map((v, i) => v ?? fam.slotRanges[i].join('~')))
}
</script>

<template>
  <div class="affix-picker" ref="rootEl">
    <div class="affix-count">
      {{ $t('옵션') }} <b>{{ pickedTotal }}/{{ limits.total }}</b>
      <span>{{ $t('접두사') }} {{ count('p') }}/{{ limits.p }}</span>
      <span>{{ $t('접미사') }} {{ count('s') }}/{{ limits.s }}</span>
    </div>

    <div class="affix-row" v-for="(row, i) in list" :key="i">
      <div class="option-row">
        <span class="affix-no">{{ i + 1 }}</span>
        <template v-if="row.key && famByKey.get(row.key)">
          <span class="affix-picked">{{ labelOf(famByKey.get(row.key)) }}</span>
          <span class="affix-tag" :class="row.slot">{{ $t(SLOT_KO[row.slot]) }}</span>
          <button type="button" class="affix-change" @click="change(row)">{{ $t('변경') }}</button>
        </template>
        <div class="affix-search-wrap" v-else>
          <input
            class="write-input affix-search" type="search" :value="row.q" @focus="row.open = true" @input="onType(row, $event)" @blur="closeSoon(row)"
            @keydown="onKey(row, $event, i)" autocomplete="off" role="combobox" :aria-expanded="row.open"
            :placeholder="$t('옵션 검색 (예: 시전, 저항, 생명력, 소서리스)')" :aria-label="`${$t('옵션')} ${i + 1}`"
          />
          <div class="affix-drop" v-if="row.open">
            <button
              type="button" class="affix-opt" v-for="(f, fi) in optionsFor(row)" :key="f.key" :class="{ active: fi === row.active }"
              :disabled="slotFull(f.slot, row)" @mousedown.prevent="pick(row, f)" @mousemove="row.active = fi"
            >
              <span class="affix-opt-label"><template v-for="(part, pi) in highlight(labelOf(f), row)" :key="pi"><mark v-if="part.hit">{{ part.t }}</mark><template v-else>{{ part.t }}</template></template></span>
              <span class="affix-tag" :class="f.slot">{{ $t(SLOT_KO[f.slot]) }}{{ slotFull(f.slot, row) ? ' ' + $t('가득') : '' }}</span>
            </button>
            <div class="affix-empty" v-if="!optionsFor(row).length">{{ $t('일치하는 옵션 없음') }}</div>
          </div>
        </div>
        <button type="button" class="class-skill-remove" :aria-label="`${$t('옵션')} ${i + 1} ×`" @click="removeRow(i)">✕</button>
      </div>
      <div class="option-row affix-values" v-if="famByKey.get(row.key) && inputSlots(famByKey.get(row.key)).length">
        <label v-for="s in inputSlots(famByKey.get(row.key))" :key="s.i" class="affix-value">
          <input
            type="number" inputmode="numeric" :value="row.values[s.i] ?? ''" :min="s.lo" :max="s.hi" step="1" :placeholder="`${s.lo}~${s.hi}`"
            class="write-input option-value-input" :class="{ invalid: bad(row, s) }" :aria-label="`${s.lo}~${s.hi}`"
            @input="setValue(row, s, $event.target.value)" @change="clampValue(row, s, $event)"
          />
          <small>{{ s.lo }}~{{ s.hi }}</small>
        </label>
      </div>
      <div class="affix-preview" v-if="row.key">{{ affixText(previewOf(row)) }}</div>
    </div>
    <button type="button" class="class-skill-add" v-if="canAdd" @click="addRow">{{ $t('+ 옵션 추가') }} ({{ pickedTotal }}/{{ limits.total }})</button>
  </div>
</template>

<style scoped>
.affix-picker{display:flex; flex-direction:column; gap:10px;}
.affix-count{display:flex; gap:12px; align-items:baseline; font-size:12px; color:var(--text-dim);}
.affix-count b{color:var(--gold); font-size:13px;}
.affix-row{display:flex; flex-direction:column; gap:6px; padding:10px 12px; border:1px solid var(--border-soft); border-radius:10px; background:var(--panel-2);}
.affix-no{width:20px; height:20px; flex:none; border-radius:999px; border:1px solid var(--border); font-size:11px; color:var(--text-dim); display:flex; align-items:center; justify-content:center;}
.affix-picked{flex:1; min-width:0; font-size:13px; color:var(--text);}
.affix-tag{flex:none; font-size:10.5px; padding:1px 8px; border-radius:999px; border:1px solid var(--border); color:var(--text-dim);}
.affix-tag.p{color:#8c8cff; border-color:#4c4c99;}
.affix-tag.s{color:var(--teal); border-color:var(--teal);}
.affix-change{flex:none; font-size:11.5px; color:var(--text-dim); border:1px solid var(--border); border-radius:999px; padding:3px 10px; background:transparent; cursor:pointer;}
.affix-change:hover{color:var(--gold); border-color:var(--gold-dim);}
.affix-search-wrap{position:relative; flex:1; min-width:0;}
.affix-drop{position:absolute; z-index:20; left:0; right:0; top:calc(100% + 4px); max-height:300px; overflow-y:auto; background:var(--panel-2); border:1px solid var(--border); border-radius:10px; padding:4px; box-shadow:0 12px 30px rgba(0,0,0,.45);}
.affix-opt{display:flex; align-items:center; gap:8px; width:100%; padding:7px 10px; border-radius:8px; text-align:left; background:transparent; border:0; color:var(--text); font-size:12.5px; cursor:pointer;}
.affix-opt.active:not(:disabled){background:var(--panel);}
.affix-opt mark{background:transparent; color:var(--gold); font-weight:700;}
.affix-opt:disabled{opacity:.4; cursor:not-allowed;}
.affix-opt-label{flex:1; min-width:0;}
.affix-empty{padding:10px; font-size:12px; color:var(--text-dim); text-align:center;}
.affix-values{flex-wrap:wrap; padding-left:30px;}
.affix-value{display:inline-flex; align-items:center; gap:6px;}
.affix-value small{font-size:11px; color:var(--text-dim);}
.affix-preview{font-size:12.5px; color:#8c8cff; padding-left:30px;}
/* 판매글 등록 페이지 입력칸과 같은 모양 (그 페이지 스타일은 scoped라 여기엔 안 들어옴) */
.option-row{display:flex; align-items:center; gap:10px;}
.write-input{
  background:var(--panel); border:1px solid var(--border); color:var(--text);
  font-family:'Noto Sans KR', sans-serif; padding:7px 10px; font-size:12.5px; border-radius:8px;
}
.affix-search{width:100%; box-sizing:border-box;}
.option-value-input{width:96px; flex:none;}
.write-input.invalid{border-color:var(--blood); box-shadow:0 0 0 1px var(--blood);}
.class-skill-remove{flex:none; color:var(--text-dim); font-size:12px; padding:4px 6px; background:transparent; border:0; cursor:pointer;}
.class-skill-remove:hover{color:var(--text);}
.class-skill-add{align-self:flex-start; font-size:12.5px; color:var(--gold); border:1px dashed var(--gold-dim); padding:7px 14px; border-radius:10px; background:transparent; cursor:pointer;}
.class-skill-add:hover{background:var(--panel-2);}
</style>
