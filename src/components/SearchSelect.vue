<script setup>
// 보기 많은 선택칸 (룬워드 베이스처럼 수십 개) - 치면 걸러지고 ↑↓·Enter 로 고름
// 값은 그냥 문자열. 비우면 '' (= 전체)
import { ref, computed, nextTick } from 'vue'
import { squashText } from '../itemSearch.js'
import { t } from '../i18n.js'

const props = defineProps({
  modelValue: { type: String, default: '' },
  options: { type: Array, required: true },
  allLabel: { type: String, default: '전체' },
  label: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue'])

const open = ref(false)
const q = ref('')
const active = ref(0)
const boxEl = ref(null)
// 자모만 남은 중간 입력("ㅅ")은 무시 - 한글 치는 동안 목록이 비는 걸 막음
const JAMO_TAIL = /[ㄱ-ㅎㅏ-ㅣ]+$/
const hits = computed(() => {
  const s = squashText(q.value.trim().replace(JAMO_TAIL, ''))
  const list = s ? props.options.filter((o) => squashText(o).includes(s)) : props.options
  return list.slice(0, 60)
})
function pick(v) {
  emit('update:modelValue', v)
  open.value = false
  q.value = ''
}
function onFocus() {
  open.value = true
  active.value = 0
  nextTick(() => boxEl.value?.select())
}
function onKey(e) {
  if (e.isComposing) return
  const n = hits.value.length + 1 // 0 = 전체
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault()
    if (!open.value) { open.value = true; return }
    active.value = (active.value + (e.key === 'ArrowDown' ? 1 : -1) + n) % n
  } else if (e.key === 'Enter') {
    e.preventDefault()
    pick(active.value === 0 ? '' : hits.value[active.value - 1] || '')
  } else if (e.key === 'Escape') {
    open.value = false
  }
}
const closeSoon = () => setTimeout(() => (open.value = false), 150)
const shown = computed(() => props.modelValue || t(props.allLabel))
</script>

<template>
  <span class="ss">
    <input
      ref="boxEl" type="text" class="ss-box" :value="open ? q : shown" :aria-label="label"
      :placeholder="t(allLabel)" autocomplete="off" role="combobox" :aria-expanded="open"
      @focus="onFocus" @blur="closeSoon" @keydown="onKey"
      @input="q = $event.target.value; open = true; active = 0"
    />
    <span class="ss-chev" aria-hidden="true">▾</span>
    <span class="ss-list" v-if="open" role="listbox">
      <button
        type="button" role="option" class="ss-opt" :class="{ active: active === 0, on: !modelValue }"
        :aria-selected="active === 0" @mousedown.prevent="pick('')" @mousemove="active = 0"
      >{{ t(allLabel) }}</button>
      <button
        type="button" role="option" class="ss-opt" v-for="(o, i) in hits" :key="o"
        :class="{ active: active === i + 1, on: modelValue === o }" :aria-selected="active === i + 1"
        @mousedown.prevent="pick(o)" @mousemove="active = i + 1"
      >{{ o }}</button>
      <span class="ss-empty" v-if="!hits.length">{{ t('일치하는 것 없음') }}</span>
    </span>
  </span>
</template>

<style scoped>
.ss{position:relative; display:inline-flex; align-items:center; min-width:0;}
.ss-box{
  width:100%; min-width:0; background:var(--panel); border:1px solid var(--border); color:var(--text);
  font-family:'Noto Sans KR', sans-serif; font-size:12.5px; padding:6px 22px 6px 10px; border-radius:8px;
  text-overflow:ellipsis;
}
.ss-box:focus{outline:none; border-color:var(--gold-dim);}
.ss-chev{position:absolute; right:8px; font-size:9px; color:var(--text-dim); pointer-events:none;}
.ss-list{
  position:absolute; z-index:30; left:0; top:calc(100% + 4px); min-width:100%; max-width:min(340px, 70vw);
  max-height:260px; overflow-y:auto; display:flex; flex-direction:column;
  background:var(--panel-2); border:1px solid var(--border); border-radius:10px; padding:4px;
  box-shadow:0 12px 30px rgba(0,0,0,.45);
}
.ss-opt{
  text-align:left; padding:6px 9px; border-radius:7px; font-size:12.5px; color:var(--text-muted);
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
}
.ss-opt.active{background:var(--panel); color:var(--text);}
.ss-opt.on{color:var(--gold); font-weight:700;}
.ss-empty{padding:8px 9px; font-size:12px; color:var(--text-dim);}
</style>
