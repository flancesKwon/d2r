<script setup>
// 아이템의 실제 방어력·피해 입력 - 샤코(98~141)처럼 같은 아이템도 개체마다 값이 달라서 판매자가 직접 넣음
// defense: { min, max } / damage: { min: {min,max}, max: {min,max} } - 그 아이템에서 나올 수 있는 범위 (없으면 칸을 안 보여줌)
import RangeInput from './RangeInput.vue'

const props = defineProps({
  modelValue: { type: Object, required: true },
  defense: { type: Object, default: null },
  damage: { type: Object, default: null },
  ethereal: { type: Boolean, default: false },
})
// 한 번에 두 칸이 바뀔 때 먼저 넣은 값이 지워지지 않게, 새 객체를 만들지 않고 그대로 고침
const set = (key, v) => { props.modelValue[key] = v }
const span = (r) => (r.min === r.max ? `${r.min}` : `${r.min}~${r.max}`)
</script>

<template>
  <div class="base-stats-input-row" v-if="defense || damage">
    <label v-if="defense">
      <span class="bs-label">방어력 <small>{{ span(defense) }}{{ ethereal ? ' · 에테리얼' : '' }}</small></span>
      <RangeInput :model-value="modelValue.baseDefense" :min="defense.min" :max="defense.max" label="방어력" @update:model-value="set('baseDefense', $event)" />
    </label>
    <template v-if="damage">
      <label>
        <span class="bs-label">최소 피해 <small>{{ span(damage.min) }}{{ ethereal ? ' · 에테리얼' : '' }}</small></span>
        <RangeInput :model-value="modelValue.minDamage" :min="damage.min.min" :max="damage.min.max" label="최소 피해" @update:model-value="set('minDamage', $event)" />
      </label>
      <label>
        <span class="bs-label">최대 피해 <small>{{ span(damage.max) }}</small></span>
        <RangeInput :model-value="modelValue.maxDamage" :min="damage.max.min" :max="damage.max.max" label="최대 피해" @update:model-value="set('maxDamage', $event)" />
      </label>
    </template>
  </div>
</template>

<style scoped>
.base-stats-input-row{display:flex; flex-wrap:wrap; gap:14px; margin-top:8px;}
label{display:flex; flex-direction:column; gap:4px; font-size:12.5px; color:var(--text-muted);}
.bs-label small{font-size:11px; color:var(--text-dim); margin-left:4px;}
</style>
