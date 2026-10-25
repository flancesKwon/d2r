<script setup>
// 판매글 등록 - 소켓 칸마다 박힌 것 고르기 (룬·보석은 이름만, 유니크 주얼은 굴린 수치, 매직·레어 주얼은 옵션과 수치)
// modelValue: 칸 입력 목록 (src/sockets.js 의 emptySocket 모양), 칸 수만큼 부모가 맞춰 줌
import { SOCKET_KINDS, SOCKET_RUNES, SOCKET_GEMS, SOCKET_UNIQUE_JEWELS, JEWEL_FAMILIES, JEWEL_LIMITS, socketItem, uniqueJewelRolls, emptySocket } from '../sockets.js'
import AffixPicker from './AffixPicker.vue'
import RangeInput from './RangeInput.vue'
import { itemName, affixText } from '../i18n.js'

const props = defineProps({ modelValue: { type: Array, required: true } })
const emit = defineEmits(['update:modelValue'])

const patch = (i, next) => emit('update:modelValue', props.modelValue.map((e, j) => (j === i ? next : e)))
const setKind = (i, kind) => patch(i, { ...emptySocket(), kind })
const setName = (i, name) => patch(i, { ...props.modelValue[i], name, rolls: [] })
const setRoll = (i, n, v) => {
  const rolls = [...props.modelValue[i].rolls]
  rolls[n] = v
  patch(i, { ...props.modelValue[i], rolls })
}
const setPicks = (i, picks) => patch(i, { ...props.modelValue[i], picks })
const optionsOf = (kind) => (kind === 'rune' ? SOCKET_RUNES : kind === 'gem' ? SOCKET_GEMS : SOCKET_UNIQUE_JEWELS)
const rollsOf = (e) => uniqueJewelRolls(socketItem(e.name))
</script>

<template>
  <div class="socket-editor">
    <div class="socket-row" v-for="(e, i) in modelValue" :key="i">
      <span class="socket-no">{{ i + 1 }}</span>
      <div class="socket-body">
        <div class="socket-kinds">
          <button
            type="button" v-for="k in SOCKET_KINDS" :key="k.key" class="socket-kind"
            :class="{ on: e.kind === k.key }" :aria-pressed="e.kind === k.key" @click="setKind(i, k.key)"
          >{{ $t(k.label) }}</button>
        </div>
        <select
          v-if="['rune', 'gem', 'unique'].includes(e.kind)" class="socket-select" :value="e.name"
          :aria-label="$t(SOCKET_KINDS.find((k) => k.key === e.kind).label)" @change="setName(i, $event.target.value)"
        >
          <option value="">{{ $t('선택') }}</option>
          <option v-for="it in optionsOf(e.kind)" :key="it.id" :value="it.name_ko">{{ itemName(it) }}</option>
        </select>
        <template v-if="e.kind === 'unique' && e.name">
          <div class="option-row" v-for="(r, n) in rollsOf(e)" :key="n">
            <span class="option-text">{{ affixText(r.text) }}</span>
            <RangeInput :model-value="e.rolls[n] ?? ''" :min="r.lo" :max="r.hi" :label="$t('수치')" @update:modelValue="setRoll(i, n, $event)" />
          </div>
        </template>
        <AffixPicker
          v-if="e.kind === 'jewel'" :families="JEWEL_FAMILIES" :limits="JEWEL_LIMITS"
          :model-value="e.picks" @update:modelValue="setPicks(i, $event)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.socket-select{width:100%; background:var(--panel); border:1px solid var(--border); color:var(--text); font-size:13px; padding:8px 12px; font-family:'Noto Sans KR', sans-serif; border-radius:8px;}
.option-row{display:flex; align-items:center; gap:10px;}
.option-text{font-size:12.5px; color:var(--text-muted); flex:1; min-width:0;}
.socket-editor{display:flex; flex-direction:column; gap:10px;}
.socket-row{display:flex; gap:10px; align-items:flex-start; border:1px solid var(--border-soft); border-radius:12px; padding:10px; background:var(--panel);}
.socket-no{flex:none; width:26px; height:26px; border-radius:50%; border:1px solid var(--gold-dim, #8f773d); color:var(--gold, #c9a64e); display:grid; place-items:center; font-size:12px; margin-top:2px;}
.socket-body{display:flex; flex-direction:column; gap:8px; min-width:0; flex:1;}
.socket-kinds{display:flex; flex-wrap:wrap; gap:6px;}
.socket-kind{border:1px solid var(--border-soft); background:transparent; color:var(--text-dim, #9a9283); border-radius:999px; padding:5px 12px; font:inherit; font-size:13px; cursor:pointer;}
.socket-kind.on{border-color:var(--gold, #c9a64e); background:rgba(201,166,78,0.12); color:var(--text, #e8e1d3);}
</style>
