<script setup>
// 범위 안 정수만 받는 수치 입력칸 - 입력은 자유, 칸을 벗어나면(change) 범위 끝으로 맞춤. 비우면 ''
const props = defineProps({
  modelValue: { type: [Number, String], default: '' },
  min: { type: Number, required: true },
  max: { type: Number, required: true },
  label: { type: String, default: '' },
  prefix: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue'])
const bad = () => {
  const v = props.modelValue
  return v !== '' && v !== undefined && v !== null && (!Number.isInteger(Number(v)) || v < props.min || v > props.max)
}
function onInput(e) {
  const raw = e.target.value
  emit('update:modelValue', raw === '' ? '' : Number(raw))
}
function onChange(e) {
  const raw = e.target.value
  if (raw === '') return
  const fixed = Math.min(props.max, Math.max(props.min, Math.round(Number(raw))))
  if (Number.isNaN(fixed)) { e.target.value = ''; emit('update:modelValue', ''); return }
  if (String(fixed) !== raw) e.target.value = fixed
  emit('update:modelValue', fixed)
}
</script>

<template>
  <span class="range-input">
    <span class="range-prefix" v-if="prefix">{{ prefix }}</span>
    <input
      type="number" inputmode="numeric" step="1" :min="min" :max="max" :value="modelValue ?? ''"
      :placeholder="min === max ? String(min) : `${min}~${max}`" :aria-label="label || `${min}~${max}`"
      :class="{ invalid: bad() }" @input="onInput" @change="onChange"
    />
  </span>
</template>

<style scoped>
.range-input{display:inline-flex; align-items:center; gap:4px; flex:none;}
.range-prefix{font-size:12.5px; color:var(--text-muted);}
input{
  width:96px; background:var(--panel); border:1px solid var(--border); color:var(--text);
  font-family:'Noto Sans KR', sans-serif; padding:7px 10px; font-size:12.5px; border-radius:8px;
}
input.invalid{border-color:var(--blood); box-shadow:0 0 0 1px var(--blood);}
</style>
