<script setup>
// 글·댓글·판매글 에디터 - 쓰는 그대로 보이는 방식 (Tiptap), 저장은 HTML (보여줄 때 richText.js 가 걸러냄)
// 사진: 사진 버튼·붙여넣기·끌어다 놓기 -> 줄여서 저장소에 올리고 본문에 넣음
import { ref, watch, onBeforeUnmount } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import { Placeholder } from '@tiptap/extensions'
import { toEditorHtml } from '../richText.js'
import { t } from '../i18n.js'
import { uploadImage } from '../imageUpload.js'

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  minHeight: { type: String, default: '160px' },
  compact: { type: Boolean, default: false }, // 댓글: 버튼 줄임
  variant: { type: String, default: 'boxed' }, // 'boxed' | 'plain'
})
const emit = defineEmits(['update:modelValue'])

const MAX_IMAGES = 20
const uploading = ref(0)
const uploadError = ref('')
const fileInput = ref(null)
const linkOpen = ref(false)
const linkUrl = ref('')
let lastEmitted = props.modelValue

const editor = useEditor({
  content: toEditorHtml(props.modelValue),
  extensions: [
    StarterKit.configure({
      heading: { levels: [2, 3] },
      code: false,
      codeBlock: false,
      link: { openOnClick: false, autolink: true, defaultProtocol: 'https', HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' } },
    }),
    Image.configure({ allowBase64: false }),
    Placeholder.configure({ placeholder: () => props.placeholder }),
  ],
  editorProps: {
    // 다른 사이트에서 복사한 이미지 태그는 빼고 (저장소 밖 사진은 보여줄 때 어차피 지워짐)
    transformPastedHTML: (html) => html.replace(/<img[^>]*>/gi, ''),
    handlePaste: (_view, e) => takeFiles(e.clipboardData?.files),
    handleDrop: (_view, e) => takeFiles(e.dataTransfer?.files),
  },
  onUpdate: ({ editor: ed }) => {
    lastEmitted = ed.isEmpty ? '' : ed.getHTML()
    emit('update:modelValue', lastEmitted)
  },
})

// 밖에서 값이 바뀌면 (수정할 글 불러오기, 등록 후 비우기) 에디터에 반영
watch(() => props.modelValue, (v) => {
  if (!editor.value || v === lastEmitted) return
  lastEmitted = v
  editor.value.commands.setContent(toEditorHtml(v), { emitUpdate: false })
})

onBeforeUnmount(() => editor.value?.destroy())

function imageCount() {
  let n = 0
  editor.value?.state.doc.descendants((node) => { if (node.type.name === 'image') n++ })
  return n
}

function takeFiles(list) {
  const files = [...(list || [])].filter((f) => f.type.startsWith('image/'))
  if (!files.length) return false
  addImages(files)
  return true
}

async function addImages(files) {
  uploadError.value = ''
  const room = MAX_IMAGES - imageCount() - uploading.value
  if (room <= 0) { uploadError.value = t('사진은 글 하나에 {n}장까지', { n: MAX_IMAGES }); return }
  if (files.length > room) uploadError.value = t('사진은 글 하나에 {n}장까지 - {m}장만 올림', { n: MAX_IMAGES, m: room })
  for (const f of files.slice(0, room)) {
    uploading.value++
    try {
      const src = await uploadImage(f)
      editor.value?.chain().focus().setImage({ src, alt: '' }).createParagraphNear().run()
    } catch (e) {
      uploadError.value = t(e.message || '사진 올리기 실패')
    } finally {
      uploading.value--
    }
  }
}

function pickImages() { fileInput.value?.click() }
function onFileChange(e) {
  takeFiles(e.target.files)
  e.target.value = ''
}

function toggleLink() {
  if (linkOpen.value) { linkOpen.value = false; return }
  linkUrl.value = editor.value?.getAttributes('link').href || ''
  linkOpen.value = true
}
function applyLink() {
  const url = linkUrl.value.trim()
  const chain = editor.value.chain().focus().extendMarkRange('link')
  if (!url) chain.unsetLink().run()
  else {
    const href = /^https?:\/\//i.test(url) ? url : `https://${url}`
    if (editor.value.state.selection.empty && !editor.value.isActive('link')) {
      editor.value.chain().focus().insertContent({ type: 'text', text: href, marks: [{ type: 'link', attrs: { href } }] }).run()
    } else chain.setLink({ href }).run()
  }
  linkOpen.value = false
}

const is = (name, attrs) => !!editor.value?.isActive(name, attrs)
const run = (fn) => fn(editor.value.chain().focus()).run()

// 아이콘 (stroke 선 그림)
const ICON = {
  bold: 'M7 5h6a3.5 3.5 0 0 1 0 7H7z M7 12h7a3.5 3.5 0 0 1 0 7H7z',
  italic: 'M19 4h-9 M14 20H5 M15 4 9 20',
  underline: 'M6 4v6a6 6 0 0 0 12 0V4 M4 20h16',
  strike: 'M16 4H9a3 3 0 0 0-2.83 4 M14 12a4 4 0 0 1 0 8H6 M4 12h16',
  bullet: 'M9 6h12 M9 12h12 M9 18h12 M4.5 6h.01 M4.5 12h.01 M4.5 18h.01',
  ordered: 'M10 6h11 M10 12h11 M10 18h11 M4 4.5h1v4 M3.6 8.5h2.6 M6.2 19.5H3.6c0-1.3 2.6-2 2.6-3.3 0-.8-.7-1.2-1.3-1.2s-1.2.3-1.3.9',
  quote: 'M5 17h3l2-4V7H4v6h3z M14 17h3l2-4V7h-6v6h3z',
  hr: 'M3 12h18 M7 7h.01 M17 17h.01',
  link: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71 M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
  image: 'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z M21 15l-5-5L5 19 M8.5 10.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
  undo: 'M9 14 4 9l5-5 M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
  redo: 'M15 14l5-5-5-5 M20 9H9.5a5.5 5.5 0 0 0 0 11H13',
}
</script>

<template>
  <div class="rich-editor" :class="[`rich-editor--${variant}`, { 'rich-editor--compact': compact }]">
    <div class="re-toolbar" v-if="editor" @mousedown.prevent>
      <template v-if="!compact">
        <button type="button" class="re-text-btn" :class="{ on: is('heading', { level: 2 }) }" :title="$t('제목')" @click="run((c) => c.toggleHeading({ level: 2 }))">{{ $t('제목') }}</button>
        <button type="button" class="re-text-btn" :class="{ on: is('heading', { level: 3 }) }" :title="$t('소제목')" @click="run((c) => c.toggleHeading({ level: 3 }))">{{ $t('소제목') }}</button>
        <span class="re-sep"></span>
      </template>
      <button type="button" :class="{ on: is('bold') }" :title="$t('굵게 (Ctrl+B)')" @click="run((c) => c.toggleBold())"><svg viewBox="0 0 24 24"><path :d="ICON.bold" /></svg></button>
      <button type="button" :class="{ on: is('italic') }" :title="$t('기울임 (Ctrl+I)')" @click="run((c) => c.toggleItalic())"><svg viewBox="0 0 24 24"><path :d="ICON.italic" /></svg></button>
      <button type="button" v-if="!compact" :class="{ on: is('underline') }" :title="$t('밑줄 (Ctrl+U)')" @click="run((c) => c.toggleUnderline())"><svg viewBox="0 0 24 24"><path :d="ICON.underline" /></svg></button>
      <button type="button" :class="{ on: is('strike') }" :title="$t('취소선')" @click="run((c) => c.toggleStrike())"><svg viewBox="0 0 24 24"><path :d="ICON.strike" /></svg></button>
      <template v-if="!compact">
        <span class="re-sep"></span>
        <button type="button" :class="{ on: is('bulletList') }" :title="$t('목록')" @click="run((c) => c.toggleBulletList())"><svg viewBox="0 0 24 24"><path :d="ICON.bullet" /></svg></button>
        <button type="button" :class="{ on: is('orderedList') }" :title="$t('번호 목록')" @click="run((c) => c.toggleOrderedList())"><svg viewBox="0 0 24 24"><path :d="ICON.ordered" /></svg></button>
        <button type="button" :class="{ on: is('blockquote') }" :title="$t('인용')" @click="run((c) => c.toggleBlockquote())"><svg viewBox="0 0 24 24"><path :d="ICON.quote" /></svg></button>
        <button type="button" :title="$t('구분선')" @click="run((c) => c.setHorizontalRule())"><svg viewBox="0 0 24 24"><path :d="ICON.hr" /></svg></button>
      </template>
      <span class="re-sep"></span>
      <button type="button" :class="{ on: is('link') || linkOpen }" :title="$t('링크')" @click="toggleLink"><svg viewBox="0 0 24 24"><path :d="ICON.link" /></svg></button>
      <button type="button" class="re-photo" :title="$t('사진 첨부 (붙여넣기·끌어다 놓기도 가능)')" @click="pickImages">
        <svg viewBox="0 0 24 24"><path :d="ICON.image" /></svg><span>{{ $t('사진') }}</span>
      </button>
      <template v-if="!compact">
        <span class="re-spacer"></span>
        <button type="button" :title="$t('실행 취소 (Ctrl+Z)')" :disabled="!editor.can().undo()" @click="run((c) => c.undo())"><svg viewBox="0 0 24 24"><path :d="ICON.undo" /></svg></button>
        <button type="button" :title="$t('다시 실행 (Ctrl+Y)')" :disabled="!editor.can().redo()" @click="run((c) => c.redo())"><svg viewBox="0 0 24 24"><path :d="ICON.redo" /></svg></button>
      </template>
      <input ref="fileInput" type="file" accept="image/*" multiple hidden @change="onFileChange" />
    </div>

    <div class="re-link-bar" v-if="linkOpen">
      <input v-model="linkUrl" type="url" :placeholder="$t('링크 주소 (https://...)')" :aria-label="$t('링크 주소')" @keydown.enter.prevent="applyLink" @keydown.esc="linkOpen = false" />
      <button type="button" class="re-link-apply" @click="applyLink">{{ $t('적용') }}</button>
      <button type="button" class="re-link-cancel" @click="linkOpen = false">{{ $t('취소') }}</button>
    </div>

    <EditorContent :editor="editor" class="re-body rich-content" :style="{ '--re-min': minHeight }" />

    <div class="re-status" v-if="uploading || uploadError">
      <span v-if="uploading" class="re-uploading">{{ $t('사진 올리는 중 · {n}장', { n: uploading }) }}</span>
      <span v-if="uploadError" class="re-error">{{ uploadError }}</span>
    </div>
  </div>
</template>

<style scoped>
.rich-editor{border:1px solid var(--border); background:var(--panel); border-radius:10px;}
.rich-editor:focus-within{border-color:var(--gold-dim);}
.re-toolbar{
  display:flex; align-items:center; gap:2px; padding:6px 8px; overflow-x:auto; scrollbar-width:none;
  border-bottom:1px solid var(--border-soft); position:sticky; top:57px; z-index:5;
  background:var(--panel); border-radius:10px 10px 0 0;
}
.re-toolbar::-webkit-scrollbar{display:none;}
.re-toolbar button{
  height:32px; min-width:32px; padding:0 7px; display:flex; align-items:center; justify-content:center; gap:5px;
  color:var(--text-muted); border-radius:6px; font-size:13px; font-weight:600; flex:none; white-space:nowrap;
}
.re-toolbar button:hover:not(:disabled){color:var(--text); background:var(--panel-2);}
.re-toolbar button.on{color:var(--gold); background:rgba(200,163,77,0.12);}
.re-toolbar button:disabled{opacity:.35; cursor:default;}
.re-toolbar svg{width:18px; height:18px; fill:none; stroke:currentColor; stroke-width:2; stroke-linecap:round; stroke-linejoin:round;}
.re-text-btn{padding:0 9px !important;}
.re-photo{color:var(--gold-dim) !important; padding:0 10px !important;}
.re-photo:hover{color:var(--gold) !important;}
.re-sep{width:1px; height:18px; background:var(--border); margin:0 5px;}
.re-spacer{flex:1;}

.re-link-bar{display:flex; gap:6px; padding:8px; border-bottom:1px solid var(--border-soft); background:var(--panel-2);}
.re-link-bar input{flex:1; min-width:0; background:var(--bg); border:1px solid var(--border); color:var(--text); padding:7px 10px; border-radius:6px; font-size:13px;}
.re-link-bar input:focus{outline:none; border-color:var(--gold-dim);}
.re-link-apply{padding:0 14px; border-radius:6px; background:var(--gold); color:#1a1408; font-weight:700; font-size:12.5px;}
.re-link-cancel{padding:0 10px; color:var(--text-dim); font-size:12.5px;}

.re-body :deep(.tiptap){min-height:var(--re-min); padding:14px 16px; outline:none; font-size:14.5px; line-height:1.75; color:var(--text);}
.re-body :deep(.tiptap p.is-editor-empty:first-child::before){content:attr(data-placeholder); color:var(--text-dim); float:left; height:0; pointer-events:none;}
.re-body :deep(.tiptap img.ProseMirror-selectednode){outline:2px solid var(--gold);}

.re-status{display:flex; gap:12px; flex-wrap:wrap; padding:7px 12px; border-top:1px solid var(--border-soft); font-size:12.5px;}
.re-uploading{color:var(--gold-dim);}
.re-error{color:var(--blood);}

.rich-editor--compact .re-toolbar{position:static;}
.rich-editor--compact .re-body :deep(.tiptap){padding:10px 12px; font-size:14px;}

/* plain: 글쓰기 화면 - 상자 없이 */
.rich-editor--plain{border:none; background:transparent; border-radius:0;}
.rich-editor--plain .re-toolbar{background:var(--bg); padding:8px 0; border-radius:0;}
.rich-editor--plain .re-body :deep(.tiptap){padding:18px 0; font-size:16.5px; line-height:1.85;}
.rich-editor--plain .re-status{padding:7px 0;}

@media (max-width:640px){
  .re-toolbar{top:52px;}
  .re-toolbar button{height:34px; min-width:34px;}
}
</style>
