<script setup>
import { ref, computed } from 'vue'
import { renderMarkdown } from '../markdown.js'

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  minHeight: { type: String, default: '120px' },
})
const emit = defineEmits(['update:modelValue'])

const textareaRef = ref(null)
const showPreview = ref(false)

const previewHtml = computed(() => renderMarkdown(props.modelValue))

function setValue(next, selStart, selEnd) {
  emit('update:modelValue', next)
  requestAnimationFrame(() => {
    const el = textareaRef.value
    if (!el) return
    el.focus()
    el.selectionStart = selStart
    el.selectionEnd = selEnd
  })
}

function wrap(mark) {
  const el = textareaRef.value
  if (!el) return
  const start = el.selectionStart
  const end = el.selectionEnd
  const value = props.modelValue
  const selected = value.slice(start, end)
  const next = value.slice(0, start) + mark + selected + mark + value.slice(end)
  setValue(next, start + mark.length, start + mark.length + selected.length)
}

function insertLinePrefix(prefix) {
  const el = textareaRef.value
  if (!el) return
  const start = el.selectionStart
  const value = props.modelValue
  const lineStart = value.lastIndexOf('\n', start - 1) + 1
  const next = value.slice(0, lineStart) + prefix + value.slice(lineStart)
  setValue(next, start + prefix.length, start + prefix.length)
}

function insertLink() {
  const el = textareaRef.value
  if (!el) return
  const start = el.selectionStart
  const end = el.selectionEnd
  const value = props.modelValue
  const label = value.slice(start, end) || '링크 텍스트'
  const inserted = `[${label}](https://)`
  const next = value.slice(0, start) + inserted + value.slice(end)
  const urlStart = start + label.length + 3
  setValue(next, urlStart, urlStart + 'https://'.length)
}
</script>

<template>
  <div class="md-editor">
    <div class="md-toolbar">
      <button type="button" title="굵게" @click="wrap('**')"><b>B</b></button>
      <button type="button" title="기울임" @click="wrap('*')"><i>I</i></button>
      <button type="button" title="취소선" @click="wrap('~~')"><s>S</s></button>
      <button type="button" title="인라인 코드" @click="wrap('`')">&lt;/&gt;</button>
      <button type="button" title="인용" @click="insertLinePrefix('&gt; ')">"</button>
      <button type="button" title="목록" @click="insertLinePrefix('- ')">•</button>
      <button type="button" title="링크" @click="insertLink">🔗</button>
      <span class="md-toolbar-spacer"></span>
      <button type="button" class="md-preview-toggle" @click="showPreview = !showPreview">
        {{ showPreview ? '편집' : '미리보기' }}
      </button>
    </div>
    <textarea
      v-if="!showPreview"
      ref="textareaRef"
      :value="modelValue"
      @input="emit('update:modelValue', $event.target.value)"
      :placeholder="placeholder"
      class="md-textarea"
      :style="{ minHeight }"
    ></textarea>
    <div v-else class="md-preview" :style="{ minHeight }">
      <div v-if="modelValue" v-html="previewHtml"></div>
      <div v-else class="md-empty">미리보기할 내용이 없어요</div>
    </div>
  </div>
</template>

<style scoped>
.md-editor{border:1px solid var(--border); background:var(--panel);}
.md-toolbar{display:flex; align-items:center; gap:2px; padding:6px 8px; border-bottom:1px solid var(--border-soft);}
.md-toolbar button{
  min-width:26px; height:26px; padding:0 6px; font-size:12px; color:var(--text-muted);
  border:1px solid transparent; display:flex; align-items:center; justify-content:center;
}
.md-toolbar button:hover{color:var(--gold); border-color:var(--border);}
.md-toolbar-spacer{flex:1;}
.md-preview-toggle{min-width:auto !important; padding:0 10px !important; font-size:11.5px !important; color:var(--gold-dim) !important; border:1px solid var(--border) !important;}
.md-textarea{
  display:block; width:100%; background:transparent; border:none; color:var(--text); font-size:13px;
  padding:10px 12px; font-family:'Noto Sans KR', sans-serif; resize:vertical;
}
.md-textarea:focus{outline:none;}
.md-preview{padding:10px 12px; font-size:13px; color:var(--text); line-height:1.7;}
.md-preview :deep(p){margin-bottom:6px;}
.md-preview :deep(ul){margin:6px 0 6px 18px;}
.md-preview :deep(li){margin-bottom:3px;}
.md-preview :deep(blockquote){border-left:2px solid var(--gold-dim); padding-left:10px; color:var(--text-muted); margin:6px 0;}
.md-preview :deep(code){background:var(--panel-2); padding:1px 5px; font-size:12px; color:var(--gold);}
.md-preview :deep(a){color:var(--gold-dim); text-decoration:underline;}
.md-empty{color:var(--text-dim); font-size:12.5px; font-style:italic;}
</style>
