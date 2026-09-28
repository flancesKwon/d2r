<script setup>
// 매직/레어 옵션(접두사·접미사) 입력 - 이 베이스·품질에 붙을 수 있는 옵션 종류만 고르고,
// 수치도 게임 범위 안에서만 넣게 함. 규칙은 src/magicAffixes.js
// modelValue: { p: [{ key, values }], s: [{ key, values }] }
import { computed, reactive } from 'vue'
import { familyText, filledValues } from '../magicAffixes.js'
import { squashText } from '../itemSearch.js'

const props = defineProps({
  families: { type: Array, required: true },
  limits: { type: Object, required: true },
  modelValue: { type: Object, required: true },
})

const SLOT_KO = { p: '접두사', s: '접미사' }
const famByKey = computed(() => new Map(props.families.map((f) => [f.key, f])))
const famsOf = (slot) => props.families.filter((f) => f.slot === slot)
const rows = (slot) => props.modelValue[slot]
const total = computed(() => rows('p').length + rows('s').length)
const canAdd = (slot) => rows(slot).length < props.limits[slot] && total.value < props.limits.total

// 줄마다 옵션 검색어 ("시전", "저항", "소서리스" 등) - 목록이 50종 가까이라 골라내기 쉽게
const searches = reactive({})
const searchOf = (slot, i) => searches[slot + i] || ''
// 다른 줄에서 이미 고른 옵션 종류는 빼고, 검색어가 있으면 그게 들어간 것만 보여줌 (지금 고른 건 항상 남김)
function optionsFor(slot, i) {
  const taken = new Set(rows(slot).filter((_, j) => j !== i).map((r) => r.key))
  const q = squashText(searchOf(slot, i))
  const current = rows(slot)[i]?.key
  return famsOf(slot).filter((f) => !taken.has(f.key) && (!q || f.key === current || squashText(f.label).includes(q)))
}
function addRow(slot) {
  if (canAdd(slot)) rows(slot).push({ key: '', values: [] })
}
function removeRow(slot, i) {
  rows(slot).splice(i, 1)
  Object.keys(searches).forEach((k) => delete searches[k])
}
function onPick(row) {
  row.values = []
}
// 수치를 직접 넣어야 하는 칸 (고정 수치는 자동)
const inputSlots = (fam) => fam.slotRanges.map((r, i) => ({ i, lo: r[0], hi: r[1] })).filter((s) => s.lo !== s.hi)
const bad = (row, s) => {
  const v = row.values[s.i]
  return v !== undefined && v !== '' && (!Number.isInteger(Number(v)) || Number(v) < s.lo || Number(v) > s.hi)
}
function previewOf(row) {
  const fam = famByKey.value.get(row.key)
  if (!fam) return ''
  return familyText(fam, filledValues(fam, row.values).map((v, i) => v ?? fam.slotRanges[i].join('~')))
}
</script>

<template>
  <div class="affix-picker">
    <div class="affix-slot" v-for="slot in ['p', 's']" :key="slot">
      <div class="affix-slot-head">
        {{ SLOT_KO[slot] }} <span class="affix-slot-count">{{ rows(slot).length }}/{{ limits[slot] }}</span>
      </div>
      <div class="affix-row" v-for="(row, i) in rows(slot)" :key="i">
        <input
          class="write-input affix-search" type="search" :value="searchOf(slot, i)"
          @input="searches[slot + i] = $event.target.value"
          :placeholder="`${SLOT_KO[slot]} 검색 (예: 시전, 저항, 소서리스)`" :aria-label="`${SLOT_KO[slot]} ${i + 1} 검색`"
        />
        <div class="option-row">
          <select
            v-model="row.key" class="write-select random-group-select" :aria-label="`${SLOT_KO[slot]} ${i + 1}`"
            @change="onPick(row)"
          >
            <option value="">{{ SLOT_KO[slot] }} 옵션 선택 ({{ optionsFor(slot, i).length }}종{{ searchOf(slot, i) ? ' 검색됨' : '' }})</option>
            <option v-for="f in optionsFor(slot, i)" :key="f.key" :value="f.key">{{ f.label }}</option>
          </select>
          <button type="button" class="class-skill-remove" :aria-label="`${SLOT_KO[slot]} ${i + 1} 삭제`" @click="removeRow(slot, i)">✕</button>
        </div>
        <div class="option-row affix-values" v-if="famByKey.get(row.key) && inputSlots(famByKey.get(row.key)).length">
          <label v-for="s in inputSlots(famByKey.get(row.key))" :key="s.i" class="affix-value">
            <select
              v-if="s.hi - s.lo <= 40" v-model.number="row.values[s.i]" class="write-select option-value-select"
              :class="{ invalid: bad(row, s) }" :aria-label="`수치 ${s.lo}~${s.hi}`"
            >
              <option :value="undefined">{{ s.lo }}~{{ s.hi }}</option>
              <option v-for="n in s.hi - s.lo + 1" :key="n" :value="s.lo + n - 1">{{ s.lo + n - 1 }}</option>
            </select>
            <input
              v-else type="number" v-model.number="row.values[s.i]" :min="s.lo" :max="s.hi" :placeholder="`${s.lo}~${s.hi}`"
              class="write-input option-value-input" :class="{ invalid: bad(row, s) }" :aria-label="`수치 ${s.lo}~${s.hi}`"
            />
          </label>
        </div>
        <div class="affix-preview" v-if="row.key">{{ previewOf(row) }}</div>
      </div>
      <button type="button" class="class-skill-add" v-if="canAdd(slot)" @click="addRow(slot)">
        + {{ SLOT_KO[slot] }} 추가 ({{ rows(slot).length }}/{{ limits[slot] }})
      </button>
    </div>
  </div>
</template>

<style scoped>
.affix-picker{display:flex; flex-direction:column; gap:14px;}
.affix-slot{display:flex; flex-direction:column; gap:8px;}
.affix-slot-head{font-size:12px; font-weight:600; color:var(--text-muted);}
.affix-slot-count{font-weight:400; margin-left:4px; color:var(--text-dim);}
.affix-row{display:flex; flex-direction:column; gap:6px; padding-bottom:8px; border-bottom:1px dashed var(--border-soft);}
.affix-values{flex-wrap:wrap;}
.affix-value{display:contents;}
.affix-preview{font-size:12.5px; color:#8c8cff;}
/* 판매글 등록 페이지 입력칸과 같은 모양 (그 페이지 스타일은 scoped라 여기엔 안 들어옴) */
.option-row{display:flex; align-items:center; gap:10px;}
.write-select, .write-input{
  background:var(--panel); border:1px solid var(--border); color:var(--text);
  font-family:'Noto Sans KR', sans-serif; padding:6px 8px; font-size:12.5px; border-radius:8px;
}
.random-group-select{flex:1; min-width:0;}
.affix-search{width:100%; box-sizing:border-box;}
.option-value-select{width:110px; flex:none;}
.option-value-input{width:100px; flex:none;}
.write-select.invalid, .write-input.invalid{border-color:var(--blood); box-shadow:0 0 0 1px var(--blood);}
.class-skill-remove{flex:none; color:var(--text-dim); font-size:12px; padding:4px 6px; background:transparent; border:0; cursor:pointer;}
.class-skill-remove:hover{color:var(--text);}
.class-skill-add{align-self:flex-start; font-size:12.5px; color:var(--gold); border:1px dashed var(--gold-dim); padding:7px 14px; border-radius:10px; background:transparent; cursor:pointer;}
.class-skill-add:hover{background:var(--panel-2);}
</style>
