<script setup>
// 커뮤니티 글쓰기 - 예전엔 목록 위에 펼쳐지는 아코디언이었는데 따로 페이지로 뺌 (/community/write)
// 목록에서 카테고리를 고른 상태로 들어오면(?cat=질문) 그 카테고리로 시작, 등록하면 방금 쓴 글로 이동
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { CATEGORIES, addPost } from '../communityStore.js'
import { profileState } from '../profileStore.js'
import MarkdownEditor from '../components/MarkdownEditor.vue'

const route = useRoute()
const router = useRouter()
const startCat = CATEGORIES.includes(route.query.cat) ? route.query.cat : CATEGORIES[0]
const form = ref({ category: startCat, title: '', author: profileState.nickname || '', content: '' })
const tagInput = ref('')
const formTags = ref([])
const attachments = ref([])
const fileInputRef = ref(null)
const formError = ref('')

// 카테고리 버튼 색 (질문 청록 / 거래 금색 / 잡담 초록 / 공략 적갈색)
const CAT_CLASS = { 질문: 'cat-question', 거래: 'cat-trade', 잡담: 'cat-chat', 공략: 'cat-guide' }
const catClass = (cat) => CAT_CLASS[cat] || ''

function addTagFromInput() {
  const t = tagInput.value.trim().replace(/^#/, '')
  if (t && !formTags.value.includes(t) && formTags.value.length < 5) formTags.value.push(t)
  tagInput.value = ''
}
function removeFormTag(i) {
  formTags.value.splice(i, 1)
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + 'B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB'
  return (bytes / 1024 / 1024).toFixed(1) + 'MB'
}
function onFilesSelected(e) {
  const files = Array.from(e.target.files || [])
  for (const f of files) {
    if (f.size > 5 * 1024 * 1024) {
      alert(`"${f.name}"은 5MB를 초과해서 첨부할 수 없어요.`)
      continue
    }
    attachments.value.push({ name: f.name, size: f.size, type: f.type, url: URL.createObjectURL(f) })
  }
  e.target.value = ''
}
function removeAttachment(i) {
  URL.revokeObjectURL(attachments.value[i].url)
  attachments.value.splice(i, 1)
}

function cancel() {
  if (window.history.length > 1) router.back()
  else router.push('/community')
}
function submitPost() {
  if (!form.value.title.trim()) { formError.value = '제목을 입력해주세요.'; return }
  if (!form.value.content.trim()) { formError.value = '내용을 입력해주세요.'; return }
  formError.value = ''
  const post = addPost({ ...form.value, tags: [...formTags.value], attachments: [...attachments.value] })
  router.replace(`/community/${post.id}`)
}
</script>

<template>
  <div class="items-page community-write-page">
  <div class="write-section">
    <div class="write-form">
      <router-link to="/community" class="write-back">← 커뮤니티</router-link>

      <div class="write-cat-pills">
        <button
          v-for="c in CATEGORIES" :key="c" type="button" class="write-cat-pill"
          :class="[catClass(c), { active: form.category === c }]" @click="form.category = c"
        >{{ c }}</button>
      </div>

      <input type="text" v-model="form.title" placeholder="제목을 입력하세요" class="write-title-input" aria-label="제목" />

      <div class="write-meta-row">
        <input type="text" v-model="form.author" placeholder="닉네임 (비우면 익명)" class="write-meta-input" aria-label="닉네임" />
        <span class="write-meta-divider">·</span>
        <input
          type="text" v-model="tagInput" placeholder="태그 입력 후 Enter (최대 5개)" class="write-meta-input"
          aria-label="태그" @keydown.enter.prevent="addTagFromInput"
        />
      </div>
      <div class="tag-chip-row" v-if="formTags.length">
        <button v-for="(t, i) in formTags" :key="t" class="tag-chip" @click="removeFormTag(i)">#{{ t }} ✕</button>
      </div>

      <MarkdownEditor v-model="form.content" placeholder="당신의 이야기를 적어보세요..." size="lg" variant="plain" min-height="420px" />

      <div class="attach-row">
        <button type="button" class="attach-trigger" @click="fileInputRef.click()">📎 파일 첨부</button>
        <input ref="fileInputRef" type="file" multiple class="attach-input-hidden" @change="onFilesSelected" />
        <span class="attach-hint">이미지·파일 최대 5MB, 브라우저 세션에서만 유지돼요</span>
      </div>
      <div class="attach-preview-row" v-if="attachments.length">
        <div class="attach-chip" v-for="(a, i) in attachments" :key="i">
          <img v-if="a.type.startsWith('image/')" :src="a.url" class="attach-thumb" alt="" />
          <span v-else class="attach-file-icon">📄</span>
          <span class="attach-name">{{ a.name }}</span>
          <span class="attach-size">{{ formatSize(a.size) }}</span>
          <button type="button" class="attach-remove" @click="removeAttachment(i)">✕</button>
        </div>
      </div>

      <div class="write-action-bar">
        <span class="write-error" v-if="formError">{{ formError }}</span>
        <button type="button" class="write-cancel" @click="cancel">취소</button>
        <button class="btn-primary write-submit" @click="submitPost">등록하기</button>
      </div>
    </div>
  </div>
  </div>
</template>

<style scoped>
/* velog 스타일 — 박스 없이 여백/타이포로만 구분하는 미니멀 글쓰기 화면 */
.write-section{padding:40px 24px 64px;}
.write-form{display:flex; flex-direction:column; gap:26px; width:100%; max-width:960px; margin:0 auto;}
.write-back{font-size:13px; color:var(--text-dim); align-self:flex-start;}
.write-back:hover{color:var(--gold);}

.write-cat-pills{display:flex; gap:10px;}
.write-cat-pill{
  font-size:13.5px; font-weight:600; color:var(--text-dim); border:1px solid var(--border);
  padding:9px 20px; background:transparent; transition:all .12s; border-radius:999px;
}
.write-cat-pill:hover{color:var(--text-muted); border-color:var(--text-dim);}
.write-cat-pill.active.cat-question{color:var(--teal); border-color:var(--teal); background:rgba(78,138,138,0.1);}
.write-cat-pill.active.cat-trade{color:var(--gold); border-color:var(--gold-dim); background:rgba(200,163,77,0.1);}
.write-cat-pill.active.cat-chat{color:var(--green); border-color:var(--green); background:rgba(92,138,91,0.1);}
.write-cat-pill.active.cat-guide{color:var(--blood); border-color:var(--blood); background:rgba(162,81,63,0.1);}

.write-title-input{
  background:transparent; border:none; border-bottom:2px solid var(--border-soft); color:var(--text);
  font-family:'Noto Serif KR', serif; font-weight:800; font-size:38px; padding:8px 0 20px;
  transition:border-color .15s; width:100%;
}
.write-title-input::placeholder{color:var(--text-dim);}
.write-title-input:focus{outline:none; border-color:var(--gold-dim);}

.write-meta-row{display:flex; align-items:center; gap:14px;}
.write-meta-input{
  background:transparent; border:none; color:var(--text-muted); font-size:14.5px; padding:4px 0;
  font-family:'Noto Sans KR', sans-serif; flex:1;
}
.write-meta-input:focus{outline:none; color:var(--text);}
.write-meta-input::placeholder{color:var(--text-dim);}
.write-meta-divider{color:var(--border); flex:none;}

.tag-chip-row{display:flex; flex-wrap:wrap; gap:6px; margin-top:-8px;}
.tag-chip{
  font-size:11.5px; color:var(--gold-dim); border:1px solid var(--border); background:var(--panel-2);
  padding:4px 12px; cursor:pointer; border-radius:999px;
}
.tag-chip:hover{border-color:var(--gold-dim); color:var(--gold);}

.attach-row{display:flex; align-items:center; gap:12px;}
.attach-trigger{font-size:13px; color:var(--text-muted); border:1px solid var(--border); padding:10px 18px; border-radius:10px;}
.attach-trigger:hover{border-color:var(--gold-dim); color:var(--gold);}
.attach-input-hidden{display:none;}
.attach-hint{font-size:11px; color:var(--text-dim);}
.attach-preview-row{display:flex; flex-wrap:wrap; gap:8px;}
.attach-chip{
  display:flex; align-items:center; gap:6px; border:1px solid var(--border-soft); background:var(--panel-2);
  padding:5px 10px; font-size:11.5px; color:var(--text-muted); border-radius:999px;
}
.attach-thumb{width:22px; height:22px; object-fit:cover; flex:none; border-radius:6px;}
.attach-file-icon{font-size:13px;}
.attach-name{max-width:120px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.attach-size{color:var(--text-dim); flex:none;}
.attach-remove{color:var(--text-dim); flex:none;}
.attach-remove:hover{color:var(--blood);}

.write-action-bar{
  display:flex; justify-content:flex-end; align-items:center; gap:14px;
  padding-top:20px; border-top:1px solid var(--border-soft); position:sticky; bottom:0;
  background:var(--bg); padding-bottom:16px;
}
.write-error{font-size:12.5px; color:var(--blood); margin-right:auto;}
.write-cancel{font-size:13px; color:var(--text-dim);}
.write-cancel:hover{color:var(--text-muted);}
.write-submit{padding:12px 30px; font-size:14px; font-weight:700; letter-spacing:0.02em; border-radius:10px;}

@media (max-width:640px){
  .write-section{padding:24px 16px 48px;}
  .write-title-input{font-size:26px;}
  .write-cat-pills{flex-wrap:wrap;}
  .write-meta-row{flex-direction:column; align-items:stretch; gap:8px;}
  .write-meta-divider{display:none;}
}
</style>
