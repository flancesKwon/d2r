<script setup>
// 커뮤니티 글쓰기 (/community/write, 수정은 ?edit=글번호) - 로그인한 사람만. 작성자는 로그인 프로필
// 목록에서 카테고리를 고른 상태로 들어오면(?cat=질문) 그 카테고리로 시작, 등록하면 방금 쓴 글로 이동
import { ref, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { writeCategories, createPost, updatePost, fetchPost, canEdit } from '../communityStore.js'
import { authState, signIn } from '../profileStore.js'
import RichEditor from '../components/RichEditor.vue'
import { plainText } from '../richText.js'

const route = useRoute()
const router = useRouter()
const editId = route.query.edit ? Number(route.query.edit) : null
const startCat = writeCategories().includes(route.query.cat) ? route.query.cat : '질문'
// 버그 제보는 적을 칸을 미리 채워 둠 (다른 카테고리로 바꾸면서 손대지 않았으면 비움)
const BUG_TEMPLATE = [
  '<p><strong>어느 화면</strong>: (주소나 메뉴 이름)</p>',
  '<p><strong>무슨 일</strong>: </p>',
  '<p><strong>어떻게 하면 생기는지</strong>:</p><ol><li><p></p></li><li><p></p></li></ol>',
  '<p><strong>기기·브라우저</strong>: (예: 아이폰 사파리, PC 크롬)</p>',
].join('')
const sameText = (a, b) => plainText(a).replace(/\s/g, '') === plainText(b).replace(/\s/g, '')
const form = ref({ category: startCat, title: '', content: startCat === '버그제보' && !editId ? BUG_TEMPLATE : '' })
watch(() => form.value.category, (c) => {
  if (editId) return
  if (c === '버그제보' && !plainText(form.value.content).trim()) form.value.content = BUG_TEMPLATE
  else if (c !== '버그제보' && sameText(form.value.content, BUG_TEMPLATE)) form.value.content = ''
})
const tagInput = ref('')
const formTags = ref([])
const formError = ref('')
const saving = ref(false)

// 수정: 기존 글 불러오기 (내 글이 아니면 돌려보냄)
onMounted(async () => {
  if (!editId) return
  const p = await fetchPost(editId).catch(() => null)
  if (!p || !canEdit(p)) return router.replace('/community')
  form.value = { category: p.category, title: p.title, content: p.content }
  formTags.value = [...p.tags]
})

// 카테고리 버튼 색 (질문 청록 / 거래 금색 / 잡담 초록 / 공략 적갈색 / 건의 보라 / 버그제보 주황)
const CAT_CLASS = { 공지: 'cat-notice', 질문: 'cat-question', 거래: 'cat-trade', 잡담: 'cat-chat', 공략: 'cat-guide', 건의: 'cat-suggest', 버그제보: 'cat-bug' }
const catClass = (cat) => CAT_CLASS[cat] || ''

function addTagFromInput() {
  const t = tagInput.value.trim().replace(/^#/, '')
  if (t && !formTags.value.includes(t) && formTags.value.length < 5) formTags.value.push(t)
  tagInput.value = ''
}
function removeFormTag(i) {
  formTags.value.splice(i, 1)
}

function cancel() {
  if (window.history.length > 1) router.back()
  else router.push('/community')
}
async function submitPost() {
  if (!form.value.title.trim()) { formError.value = '제목 입력'; return }
  if (form.value.title.trim().length > 120) { formError.value = '제목은 120자까지'; return }
  if (!form.value.content.trim() || (!plainText(form.value.content).trim() && !form.value.content.includes('<img'))) { formError.value = '내용 입력'; return }
  formError.value = ''
  saving.value = true
  try {
    const payload = { ...form.value, tags: [...formTags.value] }
    if (editId) {
      await updatePost(editId, payload)
      router.replace(`/community/${editId}`)
    } else {
      const id = await createPost(payload)
      router.replace(`/community/${id}`)
    }
  } catch (e) {
    formError.value = e.message || '등록 실패'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="items-page community-write-page">
  <div class="write-section" v-if="!authState.user">
    <div class="write-login">
      <p>글은 로그인 후 작성</p>
      <button type="button" class="btn-primary" @click="signIn">로그인</button>
    </div>
  </div>
  <div class="write-section" v-else>
    <div class="write-form">
      <router-link to="/community" class="write-back">← 커뮤니티</router-link>

      <div class="write-cat-pills">
        <button
          v-for="c in writeCategories()" :key="c" type="button" class="write-cat-pill"
          :class="[catClass(c), { active: form.category === c }]" @click="form.category = c"
        >{{ c }}</button>
      </div>

      <input type="text" v-model="form.title" placeholder="제목" class="write-title-input" aria-label="제목" />

      <div class="write-meta-row">
        <span class="write-meta-author">{{ authState.profile?.nickname }}</span>
        <span class="write-meta-divider">·</span>
        <input
          type="text" v-model="tagInput" placeholder="태그 입력 후 Enter (최대 5개)" class="write-meta-input"
          aria-label="태그" @keydown.enter.prevent="addTagFromInput"
        />
      </div>
      <div class="tag-chip-row" v-if="formTags.length">
        <button v-for="(t, i) in formTags" :key="t" class="tag-chip" @click="removeFormTag(i)">#{{ t }} ✕</button>
      </div>

      <RichEditor v-model="form.content" placeholder="내용 (사진은 붙여넣기·끌어다 놓기로도 첨부)" variant="plain" min-height="420px" />

      <div class="write-action-bar">
        <span class="write-error" v-if="formError">{{ formError }}</span>
        <button type="button" class="write-cancel" @click="cancel">취소</button>
        <button class="btn-primary write-submit" :disabled="saving" @click="submitPost">{{ editId ? '수정하기' : '등록하기' }}</button>
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
.write-cat-pill.active.cat-notice{color:var(--gold); border-color:var(--gold); background:rgba(200,163,77,0.12);}
.write-cat-pill.active.cat-suggest{color:#a58bd0; border-color:#a58bd0; background:rgba(165,139,208,0.1);}
.write-cat-pill.active.cat-bug{color:#e0905a; border-color:#e0905a; background:rgba(224,144,90,0.1);}

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
.write-login{display:flex; flex-direction:column; align-items:center; gap:14px; padding:60px 16px; color:var(--text-muted); font-size:14px;}
.write-meta-author{font-size:14px; color:var(--gold-dim); font-weight:600; flex:none;}
</style>
