<script setup>
import { ref, computed, nextTick } from 'vue'
import { renderMarkdown } from '../markdown.js'
import { authState } from '../profileStore.js'

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  minHeight: { type: String, default: '120px' },
  size: { type: String, default: 'md' }, // 'md' | 'lg'
  variant: { type: String, default: 'boxed' }, // 'boxed' | 'plain'
  images: { type: Boolean, default: false }, // 이미지 올리기 버튼·붙여넣기 (Supabase Storage)
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

// ── 이미지: 버튼으로 고르거나, 붙여넣기·끌어다 놓기. 올리는 동안 자리표시를 넣었다가 주소로 바꿈
const fileRef = ref(null)
const uploading = ref(0)
const uploadError = ref('')
const canUpload = computed(() => props.images && !!authState.user)

async function insertImages(files) {
  const list = [...files].filter((f) => f.type.startsWith('image/'))
  if (!list.length || !canUpload.value) return false
  uploadError.value = ''
  const { uploadImage } = await import('../imageUpload.js')
  for (const file of list) {
    const el = textareaRef.value
    const pos = el ? el.selectionEnd : props.modelValue.length
    const token = `![올리는 중…](${Date.now()}${Math.random().toString(36).slice(2, 6)})`
    const before = props.modelValue.slice(0, pos)
    const lead = before && !before.endsWith('\n') ? '\n' : ''
    setValue(before + lead + token + '\n' + props.modelValue.slice(pos), pos + lead.length + token.length + 1, pos + lead.length + token.length + 1)
    await nextTick()
    uploading.value++
    try {
      const url = await uploadImage(file)
      emit('update:modelValue', props.modelValue.replace(token, `![이미지](${url})`))
    } catch (e) {
      uploadError.value = e.message
      emit('update:modelValue', props.modelValue.replace(token + '\n', '').replace(token, ''))
    } finally {
      uploading.value--
    }
    await nextTick()
  }
  return true
}
function pickImage() {
  fileRef.value?.click()
}
function onFileChange(e) {
  insertImages(e.target.files)
  e.target.value = ''
}
function onPaste(e) {
  const files = e.clipboardData?.files
  if (canUpload.value && files?.length && [...files].some((f) => f.type.startsWith('image/'))) {
    e.preventDefault()
    insertImages(files)
  }
}
function onDrop(e) {
  const files = e.dataTransfer?.files
  if (canUpload.value && files?.length) {
    e.preventDefault()
    insertImages(files)
  }
}
</script>

<template>
  <div class="md-editor" :class="[`md-editor--${size}`, `md-editor--${variant}`]">
    <div class="md-toolbar">
      <button type="button" title="굵게" @click="wrap('**')"><b>B</b></button>
      <button type="button" title="기울임" @click="wrap('*')"><i>I</i></button>
      <button type="button" title="취소선" @click="wrap('~~')"><s>S</s></button>
      <button type="button" title="인라인 코드" @click="wrap('`')">&lt;/&gt;</button>
      <button type="button" title="인용" @click="insertLinePrefix('&gt; ')">"</button>
      <button type="button" title="목록" @click="insertLinePrefix('- ')">•</button>
      <button type="button" title="링크" @click="insertLink">🔗</button>
      <button type="button" title="이미지 (붙여넣기·끌어다 놓기도 됨)" v-if="canUpload" :disabled="uploading > 0" @click="pickImage">🖼</button>
      <input ref="fileRef" type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple hidden v-if="canUpload" @change="onFileChange" />
      <span class="md-upload-state" v-if="uploading">올리는 중…</span>
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
      @paste="onPaste"
      @dragover.prevent
      @drop="onDrop"
    ></textarea>
    <div class="md-upload-error" v-if="uploadError" role="alert">{{ uploadError }}</div>
    <div v-else class="md-preview" :style="{ minHeight }">
      <div v-if="modelValue" v-html="previewHtml"></div>
      <div v-else class="md-empty">미리보기 내용 없음</div>
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
.md-upload-state{font-size:11.5px; color:var(--text-dim); margin-left:6px;}
.md-upload-error{font-size:12px; color:#e0775f; padding:6px 12px 0;}
.md-toolbar button:disabled{opacity:.4; cursor:default;}
.md-empty{color:var(--text-dim); font-size:12.5px; font-style:italic;}

.md-editor--lg .md-toolbar{padding:10px 12px; gap:4px;}
.md-editor--lg .md-toolbar button{min-width:34px; height:34px; font-size:14px;}
.md-editor--lg .md-preview-toggle{font-size:13px !important; padding:0 16px !important; height:34px;}
.md-editor--lg .md-textarea{font-size:15px; padding:16px 18px; line-height:1.7;}
.md-editor--lg .md-preview{font-size:15px; padding:16px 18px; line-height:1.8;}

/* plain: velog 스타일 — 박스/배경 없이 여백만으로 구분 */
.md-editor--plain{border:none; background:transparent;}
.md-editor--plain .md-toolbar{
  padding:0 0 14px; border-bottom:1px solid var(--border-soft); margin-bottom:18px; gap:14px;
}
.md-editor--plain .md-toolbar button{
  min-width:auto; height:auto; padding:0; color:var(--text-dim); border:none; font-size:15px;
}
.md-editor--plain .md-toolbar button:hover{color:var(--gold);}
.md-editor--plain .md-preview-toggle{
  border:1px solid var(--border) !important; color:var(--text-muted) !important; padding:5px 14px !important; font-size:12px !important;
}
.md-editor--plain .md-preview-toggle:hover{color:var(--gold) !important; border-color:var(--gold-dim) !important;}
.md-editor--plain .md-textarea{padding:0; font-size:17px; line-height:1.9;}
.md-editor--plain .md-preview{padding:0; font-size:17px; line-height:1.95;}
.md-editor--plain.md-editor--lg .md-toolbar button{font-size:16px;}
</style>
