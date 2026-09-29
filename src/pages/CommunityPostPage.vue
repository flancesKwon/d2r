<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fetchPost, countView, addComment, deleteComment, votePost, voteComment, deletePost, canEdit } from '../communityStore.js'
import { authState, signIn } from '../profileStore.js'
import { renderMarkdown } from '../markdown.js'
import MarkdownEditor from '../components/MarkdownEditor.vue'

const route = useRoute()
const router = useRouter()
const post = ref(null)
const loading = ref(true)
const actionError = ref('')

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

const contentHtml = computed(() => (post.value ? renderMarkdown(post.value.content) : ''))

async function run(fn) {
  actionError.value = ''
  if (!authState.user) return signIn()
  try {
    await fn()
  } catch (e) {
    actionError.value = e.message || '처리하지 못했어요'
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
  if (!confirm('댓글을 삭제할까요?')) return
  await run(async () => {
    await deleteComment(c.id)
    post.value.comments = post.value.comments.filter((x) => x.id !== c.id)
    post.value.commentCount--
  })
}
async function onDeletePost() {
  if (!confirm('글을 삭제할까요? 되돌릴 수 없어요.')) return
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
      <div class="community-post-meta">{{ post.author }} · {{ post.date }} · 조회 {{ post.views }}</div>

      <div class="post-tag-row" v-if="post.tags.length">
        <router-link v-for="t in post.tags" :key="t" class="tag-chip" :to="`/community?tag=${encodeURIComponent(t)}`">#{{ t }}</router-link>
      </div>

      <div class="community-post-content" v-html="contentHtml"></div>

      <div class="vote-row">
        <button class="vote-btn up" :class="{ active: post.myVote === 'up' }" @click="onVotePost('up')">
          👍 추천 {{ post.likes }}
        </button>
        <button class="vote-btn down" :class="{ active: post.myVote === 'down' }" @click="onVotePost('down')">
          👎 비추천 {{ post.dislikes }}
        </button>
      </div>
      <div class="post-owner-row" v-if="canEdit(post)">
        <router-link class="owner-btn" :to="{ path: '/community/write', query: { edit: post.id } }">수정</router-link>
        <button type="button" class="owner-btn danger" @click="onDeletePost">삭제</button>
      </div>
      <div class="action-error" v-if="actionError">{{ actionError }}</div>
    </div>

    <div class="d-section-title">댓글 {{ post.comments.length }}개</div>
    <div class="comment-list">
      <div class="comment-item" v-for="c in post.comments" :key="c.id">
        <div class="comment-top">
          <b>{{ c.author }}</b>
          <span>{{ c.date }}<button type="button" class="comment-del" v-if="canEdit(c)" @click="onDeleteComment(c)">삭제</button></span>
        </div>
        <div class="comment-body" v-html="renderMarkdown(c.content)"></div>
        <div class="comment-vote-row">
          <button class="vote-btn mini up" :class="{ active: c.myVote === 'up' }" @click="onVoteComment(c, 'up')">👍 {{ c.likes }}</button>
          <button class="vote-btn mini down" :class="{ active: c.myVote === 'down' }" @click="onVoteComment(c, 'down')">👎 {{ c.dislikes }}</button>
        </div>
      </div>
      <div class="empty-state" v-if="post.comments.length === 0">아직 댓글이 없어요</div>
    </div>

    <div class="comment-form" v-if="authState.user">
      <MarkdownEditor v-model="commentDraft" placeholder="댓글을 입력하세요" min-height="110px" />
      <button class="btn-primary write-submit" :disabled="posting" @click="submitComment">댓글 등록</button>
    </div>
    <div class="comment-login" v-else>
      댓글은 로그인하면 쓸 수 있어요.
      <button type="button" class="btn-primary write-submit" @click="signIn">디스코드로 로그인</button>
    </div>
  </div>
  </div>
  <div class="items-page" v-else>
    <div class="grid-wrap">
      <div class="empty-state" v-if="loading">불러오는 중…</div>
      <div class="empty-state" v-else>게시글을 찾을 수 없어요. <router-link to="/community">커뮤니티로</router-link></div>
    </div>
  </div>
</template>

<style scoped>
/* 벨로그처럼 여백 넉넉한 둥근 카드 느낌 - 톤(어두운 배경, 금색 포인트)은 그대로 두고
   본문·댓글을 각진 구분선 대신 둥근 카드로 나눠서 편하게 읽히게 함 */
.community-detail-wrap{max-width:920px;}
.post-card{background:var(--panel); border:1px solid var(--border-soft); border-radius:18px; padding:32px 36px; margin-bottom:24px;}
.community-post-title{font-size:25px; margin:10px 0 10px;}
.community-post-meta{font-size:12px; color:var(--text-dim); margin-bottom:16px;}

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

.comment-list{display:flex; flex-direction:column; gap:12px; margin-bottom:24px;}
.comment-item{background:var(--panel); border:1px solid var(--border-soft); border-radius:14px; padding:16px 20px;}
.comment-top{display:flex; justify-content:space-between; font-size:12px; margin-bottom:6px;}
.comment-top b{color:var(--gold-dim); font-weight:600;}
.comment-top span{color:var(--text-dim);}
.comment-body{font-size:13px; color:var(--text-muted); line-height:1.7; margin-bottom:10px;}
.comment-body :deep(p){margin-bottom:4px;}
.comment-vote-row{display:flex; gap:8px;}

.comment-form{display:flex; flex-direction:column; gap:12px; max-width:680px;}
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
.comment-login{display:flex; align-items:center; gap:12px; font-size:13px; color:var(--text-muted);}
.action-error{font-size:12.5px; color:#e0775f; margin-top:8px;}
</style>
