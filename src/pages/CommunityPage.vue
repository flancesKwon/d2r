<script setup>
import LogoMark from '../components/LogoMark.vue'
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { communityState, CATEGORIES, addPost, allTags } from '../communityStore.js'
import MarkdownEditor from '../components/MarkdownEditor.vue'

const route = useRoute()
const activeCat = ref(CATEGORIES.includes(route.query.cat) ? route.query.cat : null)
const activeTag = ref(typeof route.query.tag === 'string' ? route.query.tag : null)
const searchQuery = ref('')
const showForm = ref(false)
const sortBy = ref('latest')

const form = ref({ category: CATEGORIES[0], title: '', author: '', content: '' })
const tagInput = ref('')
const formTags = ref([])
const attachments = ref([])
const fileInputRef = ref(null)

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

const filteredPosts = computed(() => {
  let list = communityState.posts
  if (activeCat.value) list = list.filter((p) => p.category === activeCat.value)
  if (activeTag.value) list = list.filter((p) => p.tags.includes(activeTag.value))
  const q = searchQuery.value.trim().toLowerCase()
  if (q) {
    list = list.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.content.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q))
    )
  }
  const sorted = [...list]
  if (sortBy.value === 'likes') sorted.sort((a, b) => b.likes - a.likes)
  else if (sortBy.value === 'views') sorted.sort((a, b) => b.views - a.views)
  else if (sortBy.value === 'comments') sorted.sort((a, b) => b.comments.length - a.comments.length)
  else sorted.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  return sorted
})

function setTagFilter(t) {
  activeTag.value = activeTag.value === t ? null : t
}

function submitPost() {
  if (!form.value.title.trim() || !form.value.content.trim()) return
  addPost({ ...form.value, tags: [...formTags.value], attachments: [...attachments.value] })
  form.value = { category: CATEGORIES[0], title: '', author: '', content: '' }
  formTags.value = []
  attachments.value = []
  showForm.value = false
}
</script>

<template>
  <div class="items-page community-page">
  <header>
    <div class="logo">
      <router-link to="/" style="display: flex; align-items: center; gap: 8px; color: inherit">
        <LogoMark />디아허브
      </router-link>
    </div>
    <div class="crumb"><router-link to="/">메인</router-link> / <b>커뮤니티</b></div>
  </header>

  <div class="patch-hero">
    <div class="patch-hero-inner">
      <div class="eyebrow">유저 커뮤니티</div>
      <h1>커뮤니티</h1>
      <p>질문, 거래, 잡담, 공략 인증까지 자유롭게 이야기해보세요.</p>
    </div>
  </div>

  <div class="toolbar">
    <div class="toolbar-inner">
      <div class="cat-tabs">
        <button :class="{ active: activeCat === null }" @click="activeCat = null">전체</button>
        <button v-for="c in CATEGORIES" :key="c" :class="{ active: activeCat === c }" @click="activeCat = c">
          {{ c }}
        </button>
      </div>
      <div class="search-row">
        <div class="search-input-wrap">
          <input type="text" v-model="searchQuery" placeholder="제목·내용·태그 검색" aria-label="게시글 검색" />
        </div>
        <select v-model="sortBy" class="sort-select">
          <option value="latest">최신순</option>
          <option value="likes">추천순</option>
          <option value="views">조회순</option>
          <option value="comments">댓글순</option>
        </select>
        <span class="result-count">{{ filteredPosts.length }}개</span>
        <button class="quality-toggle" @click="showForm = !showForm">{{ showForm ? '취소' : '글쓰기' }}</button>
      </div>
      <div class="active-tag-row" v-if="activeTag">
        <span class="active-tag-label">태그 필터:</span>
        <button class="tag-chip active" @click="activeTag = null">#{{ activeTag }} ✕</button>
      </div>
    </div>
  </div>

  <div class="quality-info" v-if="showForm">
    <div class="quality-info-inner write-form">
      <select v-model="form.category" class="write-select">
        <option v-for="c in CATEGORIES" :key="c" :value="c">{{ c }}</option>
      </select>
      <input type="text" v-model="form.title" placeholder="제목" class="write-input" />
      <input type="text" v-model="form.author" placeholder="닉네임 (비우면 익명)" class="write-input" />

      <MarkdownEditor v-model="form.content" placeholder="내용을 입력하세요 (**굵게**, *기울임*, - 목록, > 인용 지원)" min-height="180px" />

      <div class="tag-input-row">
        <div class="tag-input-inline">
          <input
            type="text"
            v-model="tagInput"
            placeholder="태그 입력 후 Enter (최대 5개)"
            class="write-input tag-text-input"
            @keydown.enter.prevent="addTagFromInput"
          />
          <button type="button" class="tag-add-btn" @click="addTagFromInput">추가</button>
        </div>
        <div class="tag-chip-row">
          <button v-for="(t, i) in formTags" :key="t" class="tag-chip" @click="removeFormTag(i)">#{{ t }} ✕</button>
        </div>
      </div>

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

      <button class="btn-primary write-submit" @click="submitPost">등록하기</button>
    </div>
  </div>

  <div class="grid-wrap community-list-wrap">
    <div class="community-list">
      <router-link class="community-row" v-for="p in filteredPosts" :key="p.id" :to="`/community/${p.id}`">
        <span class="community-cat">{{ p.category }}</span>
        <div class="community-body">
          <div class="community-title-row">
            <span class="community-title">{{ p.title }}</span>
            <span class="hot-badge" v-if="p.likes - p.dislikes >= 10">인기</span>
            <span class="attach-count-badge" v-if="p.attachments.length">📎{{ p.attachments.length }}</span>
          </div>
          <div class="community-meta">
            {{ p.author }} · {{ p.date }} · 조회 {{ p.views }} · 추천 {{ p.likes - p.dislikes }}
          </div>
          <div class="community-tag-row" v-if="p.tags.length">
            <span
              v-for="t in p.tags"
              :key="t"
              class="tag-chip small"
              @click.prevent.stop="setTagFilter(t)"
            >#{{ t }}</span>
          </div>
        </div>
        <span class="community-comment-count" v-if="p.comments.length">{{ p.comments.length }}</span>
      </router-link>
      <div class="empty-state" v-if="filteredPosts.length === 0">게시글이 없어요</div>
    </div>
  </div>
  </div>
</template>

<style scoped>
/* 벨로그처럼 여백 넉넉하고 둥근 카드 느낌으로 - 사이트 기본 톤(어두운 배경, 금색
   포인트)은 유지하되 커뮤니티/거래게시판만 각진 테두리 대신 둥근 모서리 +
   카드 구분 + 은은한 그림자로 가독성 위주로 다르게 감 */
.cat-tabs button{border-radius:999px;}
.search-input-wrap{border-radius:10px; overflow:hidden;}
.quality-toggle{border-radius:10px;}
.sort-select{
  background:var(--panel); border:1px solid var(--border); color:var(--text-muted); font-size:12.5px;
  padding:9px 14px; font-family:'Noto Sans KR', sans-serif; border-radius:10px;
}
.active-tag-row{display:flex; align-items:center; gap:8px; margin-top:10px; max-width:1180px; margin-left:auto; margin-right:auto;}
.active-tag-label{font-size:12px; color:var(--text-dim);}

.write-form{display:flex; flex-direction:column; gap:12px; max-width:700px;}
.write-form :deep(.md-editor){border-radius:12px; overflow:hidden;}
.write-select, .write-input{
  background:var(--panel); border:1px solid var(--border); color:var(--text); font-size:13px;
  padding:11px 14px; font-family:'Noto Sans KR', sans-serif; border-radius:10px;
}
.write-select{width:120px;}
.write-submit{align-self:flex-start; padding:11px 22px; font-size:13px; border-radius:10px;}

.tag-input-row{display:flex; flex-direction:column; gap:8px;}
.tag-input-inline{display:flex; gap:8px;}
.tag-input-inline .tag-text-input{flex:1;}
.tag-add-btn{font-size:12px; color:var(--text-muted); border:1px solid var(--border); padding:0 14px; border-radius:10px;}
.tag-add-btn:hover{border-color:var(--gold-dim); color:var(--gold);}
.tag-chip-row{display:flex; flex-wrap:wrap; gap:6px;}
.tag-chip{
  font-size:11.5px; color:var(--gold-dim); border:1px solid var(--border); background:var(--panel-2);
  padding:4px 12px; cursor:pointer; border-radius:999px;
}
.tag-chip:hover{border-color:var(--gold-dim); color:var(--gold);}
.tag-chip.active{color:var(--gold); border-color:var(--gold-dim);}
.tag-chip.small{font-size:10.5px; padding:3px 10px;}

.attach-row{display:flex; align-items:center; gap:10px;}
.attach-trigger{font-size:12.5px; color:var(--text-muted); border:1px solid var(--border); padding:8px 14px; border-radius:10px;}
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

.community-list-wrap{max-width:1180px;}
.community-list{display:flex; flex-direction:column; gap:14px;}
.community-row{
  display:flex; align-items:flex-start; gap:16px; padding:22px 24px; border-radius:16px;
  background:var(--panel); border:1px solid var(--border-soft);
  transition:transform .15s, box-shadow .15s, border-color .15s;
}
.community-row:hover{transform:translateY(-2px); box-shadow:0 10px 26px -10px rgba(0,0,0,0.55); border-color:var(--gold-dim);}
.community-cat{font-size:11px; color:var(--gold-dim); border:1px solid var(--border); padding:4px 12px; flex:none; margin-top:1px; border-radius:999px;}
.community-body{flex:1; min-width:0;}
.community-title-row{display:flex; align-items:center; gap:7px; margin-bottom:6px;}
.community-title{font-size:15.5px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.hot-badge{font-size:10px; color:var(--blood); border:1px solid var(--blood); padding:1px 8px; flex:none; border-radius:999px;}
.attach-count-badge{font-size:10.5px; color:var(--text-dim); flex:none;}
.community-meta{font-size:11.5px; color:var(--text-dim); margin-bottom:8px; line-height:1.6;}
.community-tag-row{display:flex; flex-wrap:wrap; gap:6px;}
.community-comment-count{font-size:11.5px; color:var(--text-muted); border:1px solid var(--border); padding:3px 10px; flex:none; margin-top:1px; border-radius:999px;}
</style>
