<script setup>
import { ref, computed, watch, defineAsyncComponent } from 'vue'
import { useAutoRefresh } from '../useAutoRefresh.js'
import { askConfirm } from '../dialog.js'
import { useRoute, useRouter } from 'vue-router'
import { fetchPost, countView, addComment, deleteComment, votePost, voteComment, deletePost, canEdit, canDelete, setPinned } from '../communityStore.js'
import { authState, signIn, isStaff } from '../profileStore.js'
import { renderContent } from '../richText.js'
import ReportButton from '../components/ReportButton.vue'
import UserAvatar from '../components/UserAvatar.vue'
const RichEditor = defineAsyncComponent(() => import('../components/RichEditor.vue')) // 댓글 에디터는 나중에 받아도 됨

const route = useRoute()
const router = useRouter()
const post = ref(null)
watch(post, (p) => { if (p) document.title = `${p.title} — 커뮤니티 — 디아허브` }, { flush: 'post' })
const loading = ref(true)
const actionError = ref('')

// 운영진: 목록 맨 위 고정
async function togglePin() {
  actionError.value = ''
  try { await setPinned(post.value, !post.value.pinned) } catch (e) { actionError.value = e.message || '처리 실패' }
}

async function load() {
  loading.value = true
  actionError.value = ''
  try {
    post.value = await fetchPost(route.params.id)
    if (post.value && (await countView(post.value.id))) post.value.views++
  } catch (e) {
    post.value = null
  } finally {
    loading.value = false
  }
}
watch(() => route.params.id, load, { immediate: true })
// 로그인/로그아웃하면 내 추천 표시·버튼을 다시 맞춤
watch(() => authState.user?.id, () => { if (post.value) load() })
async function refreshQuiet() {
  const id = route.params.id
  const fresh = await fetchPost(id)
  if (!fresh || String(route.params.id) !== String(id)) return
  fresh.views = Math.max(fresh.views || 0, post.value?.views || 0)
  post.value = fresh
}
useAutoRefresh(refreshQuiet)

const contentHtml = computed(() => (post.value ? renderContent(post.value.content) : ''))

async function run(fn) {
  actionError.value = ''
  if (!authState.user) return signIn()
  try {
    await fn()
  } catch (e) {
    actionError.value = e.message || '처리 실패'
  }
}

const commentDraft = ref('')
const posting = ref(false)
async function submitComment() {
  const text = commentDraft.value.trim()
  if (!text || posting.value) return
  posting.value = true
  await run(async () => {
    const c = await addComment(post.value.id, text)
    post.value.comments.push(c)
    post.value.commentCount++
    commentDraft.value = ''
  })
  posting.value = false
}
const onVotePost = (dir) => run(() => votePost(post.value, dir))
const onVoteComment = (c, dir) => run(() => voteComment(c, dir))
async function onDeleteComment(c) {
  if (!await askConfirm('댓글 삭제')) return
  await run(async () => {
    await deleteComment(c.id)
    post.value.comments = post.value.comments.filter((x) => x.id !== c.id)
    post.value.commentCount--
  })
}
async function onDeletePost() {
  if (!await askConfirm('글 삭제 - 되돌릴 수 없음')) return
  await run(async () => {
    await deletePost(post.value.id)
    router.replace('/community')
  })
}
</script>

<template>
  <div class="items-page community-post-page" v-if="post">

  <div class="grid-wrap community-detail-wrap">
    <div class="post-card">
      <div class="d-eyebrow">{{ post.category }}</div>
      <h1 class="d-name community-post-title">{{ post.title }}</h1>
      <div class="community-post-meta"><router-link :to="'/users/' + post.authorId" class="user-link"><UserAvatar :src="post.avatar" :name="post.author" :size="22" /> {{ post.author }}</router-link> · {{ post.date }} · 조회 {{ post.views }}</div>

      <div class="post-tag-row" v-if="post.tags.length">
        <router-link v-for="t in post.tags" :key="t" class="tag-chip" :to="`/community?tag=${encodeURIComponent(t)}`">#{{ t }}</router-link>
      </div>

      <div class="community-post-content rich-content" v-html="contentHtml"></div>

      <div class="vote-row">
        <button class="vote-btn up" :class="{ active: post.myVote === 'up' }" @click="onVotePost('up')">
          👍 추천 {{ post.likes }}
        </button>
        <button class="vote-btn down" :class="{ active: post.myVote === 'down' }" @click="onVotePost('down')">
          👎 비추천 {{ post.dislikes }}
        </button>
      </div>
      <div class="post-owner-row">
        <router-link class="owner-btn" v-if="canEdit(post)" :to="{ path: '/community/write', query: { edit: post.id } }">수정</router-link>
        <button type="button" class="owner-btn danger" v-if="canDelete(post)" @click="onDeletePost">삭제</button>
        <button type="button" class="owner-btn" v-if="isStaff()" @click="togglePin">{{ post.pinned ? '고정 해제' : '맨 위 고정' }}</button>
        <ReportButton class="post-report" target-type="community_post" :target-id="post.id" :owner-id="post.authorId" label="글 신고" />
      </div>
      <div class="action-error" v-if="actionError">{{ actionError }}</div>
    </div>

    <!-- 댓글 목록과 쓰기를 카드 하나에 (댓글마다 카드를 나누지 않고 구분선으로) -->
    <div class="comment-card">
    <div class="d-section-title comment-card-title">댓글 {{ post.comments.length }}개</div>
    <div class="comment-list">
      <div class="comment-item" v-for="c in post.comments" :key="c.id">
        <div class="comment-top">
          <router-link :to="'/users/' + c.authorId" class="comment-author user-link"><UserAvatar :src="c.avatar" :name="c.author" :size="22" />{{ c.author }}</router-link>
          <span>{{ c.date }}<button type="button" class="comment-del" v-if="canDelete(c)" @click="onDeleteComment(c)">삭제</button></span>
        </div>
        <div class="comment-body rich-content" v-html="renderContent(c.content)"></div>
        <div class="comment-vote-row">
          <button class="vote-btn mini up" :class="{ active: c.myVote === 'up' }" @click="onVoteComment(c, 'up')">👍 {{ c.likes }}</button>
          <button class="vote-btn mini down" :class="{ active: c.myVote === 'down' }" @click="onVoteComment(c, 'down')">👎 {{ c.dislikes }}</button>
          <ReportButton class="comment-report" target-type="community_comment" :target-id="c.id" :owner-id="c.authorId" />
        </div>
      </div>
      <div class="empty-state" v-if="post.comments.length === 0">댓글 없음</div>
    </div>

    <div class="comment-form" v-if="authState.user">
      <RichEditor v-model="commentDraft" placeholder="댓글" min-height="90px" compact />
      <button class="btn-primary write-submit" :disabled="posting" @click="submitComment">댓글 등록</button>
    </div>
    <div class="comment-login" v-else>
      댓글은 로그인 후 작성
      <button type="button" class="btn-primary write-submit" @click="signIn">로그인</button>
    </div>
    </div>
  </div>
  </div>
  <div class="items-page" v-else>
    <div class="grid-wrap">
      <div class="empty-state" v-if="loading">불러오는 중…</div>
      <div class="empty-state" v-else>게시글 없음. <router-link to="/community">커뮤니티로</router-link></div>
    </div>
  </div>
</template>

<style scoped>
/* 벨로그처럼 여백 넉넉한 둥근 카드 느낌 - 톤(어두운 배경, 금색 포인트)은 그대로 두고
   본문·댓글을 각진 구분선 대신 둥근 카드로 나눠서 편하게 읽히게 함 */
.community-detail-wrap{max-width:920px;}
.post-card{background:var(--panel); border:1px solid var(--border-soft); border-radius:18px; padding:32px 36px; margin-bottom:24px;}
.community-post-title{font-size:25px; margin:10px 0 10px;}
.community-post-meta{font-size:12px; color:var(--text-dim); margin-bottom:16px; display:flex; align-items:center; gap:6px; flex-wrap:wrap;}

.post-tag-row{display:flex; flex-wrap:wrap; gap:6px; margin-bottom:20px;}
.tag-chip{
  font-size:11.5px; color:var(--gold-dim); border:1px solid var(--border); background:var(--panel-2);
  padding:4px 12px; border-radius:999px;
}
.tag-chip:hover{border-color:var(--gold-dim); color:var(--gold);}

.community-post-content{
  font-size:14.5px; line-height:1.9; color:var(--text);
}
.community-post-content :deep(p){margin-bottom:10px;}
.community-post-content :deep(ul){margin:8px 0 8px 20px;}
.community-post-content :deep(blockquote){border-left:2px solid var(--gold-dim); padding-left:12px; color:var(--text-muted); margin:8px 0;}
.community-post-content :deep(code){background:var(--panel-2); padding:1px 6px; font-size:12.5px; color:var(--gold); border-radius:5px;}
.community-post-content :deep(a){color:var(--gold-dim); text-decoration:underline;}

.vote-row{display:flex; gap:10px; margin-top:24px;}
.vote-btn{
  font-size:12.5px; color:var(--text-muted); border:1px solid var(--border); padding:9px 18px; border-radius:999px;
  transition:border-color .1s, color .1s;
}
.vote-btn:hover{border-color:var(--gold-dim);}
.vote-btn.up.active{color:var(--gold); border-color:var(--gold-dim); background:var(--panel-2);}
.vote-btn.down.active{color:var(--blood); border-color:var(--blood); background:var(--panel-2);}
.vote-btn.mini{font-size:11px; padding:4px 12px;}

.comment-card{background:var(--panel); border:1px solid var(--border-soft); border-radius:18px; padding:24px 28px;}
.comment-card-title{margin-top:0;}
.comment-list{display:flex; flex-direction:column; margin-bottom:18px;}
.comment-item{padding:14px 0; border-top:1px solid var(--border-soft);}
.comment-item:first-child{border-top:none; padding-top:4px;}
.comment-list .empty-state{padding:18px 0;}
.comment-top{display:flex; justify-content:space-between; align-items:center; font-size:12px; margin-bottom:6px;}
.comment-top b{color:var(--gold-dim); font-weight:600;}
.comment-author{display:inline-flex; align-items:center; gap:7px;}
.comment-top span{color:var(--text-dim);}
.comment-body{font-size:13px; color:var(--text-muted); line-height:1.7; margin-bottom:10px;}
.comment-body :deep(p){margin-bottom:4px;}
.comment-vote-row{display:flex; gap:8px; align-items:center;}
.comment-report{margin-left:auto; font-size:11px; padding:3px 10px;}
.post-report{margin-left:auto;}

.comment-form{display:flex; flex-direction:column; gap:12px; border-top:1px solid var(--border-soft); padding-top:18px;}
.comment-form :deep(.md-editor){border-radius:12px; overflow:hidden;}
.write-input{
  background:var(--panel); border:1px solid var(--border); color:var(--text); font-size:13px;
  padding:11px 14px; font-family:'Noto Sans KR', sans-serif; border-radius:10px;
}
.write-submit{align-self:flex-start; padding:11px 22px; font-size:13px; border-radius:10px;}
.post-owner-row{display:flex; gap:8px; margin-top:18px;}
.owner-btn{font-size:12px; color:var(--text-dim); border:1px solid var(--border-soft); padding:5px 12px; border-radius:999px;}
.owner-btn:hover{color:var(--text); border-color:var(--border);}
.owner-btn.danger:hover{color:#e0775f; border-color:#e0775f;}
.comment-del{font-size:11px; color:var(--text-dim); margin-left:8px;}
.comment-del:hover{color:#e0775f;}
@media (max-width:560px){ .comment-card{padding:18px 16px;} }
.comment-login{display:flex; align-items:center; gap:12px; font-size:13px; color:var(--text-muted);}
.action-error{font-size:12.5px; color:#e0775f; margin-top:8px;}
</style>
