<script setup>
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { getPost, addComment, votePost, voteComment } from '../communityStore.js'
import { renderMarkdown } from '../markdown.js'
import MarkdownEditor from '../components/MarkdownEditor.vue'

const route = useRoute()
const post = computed(() => getPost(route.params.id))
const contentHtml = computed(() => (post.value ? renderMarkdown(post.value.content) : ''))

const commentDraft = ref('')
const commentAuthor = ref('')

function submitComment() {
  if (!commentDraft.value.trim()) return
  addComment(route.params.id, { author: commentAuthor.value, content: commentDraft.value })
  commentDraft.value = ''
}

function isImage(a) {
  return a.type && a.type.startsWith('image/')
}
</script>

<template>
  <div class="items-page community-post-page" v-if="post">
  <header>
    <div class="logo">
      <router-link to="/" style="display: flex; align-items: center; gap: 8px; color: inherit">
        <span class="logo-mark"></span>디아사전
      </router-link>
    </div>
    <div class="crumb">
      <router-link to="/">메인</router-link> / <router-link to="/community">커뮤니티</router-link> / <b>{{ post.category }}</b>
    </div>
  </header>

  <div class="grid-wrap community-detail-wrap">
    <div class="d-eyebrow">{{ post.category }}</div>
    <h1 class="d-name community-post-title">{{ post.title }}</h1>
    <div class="community-post-meta">{{ post.author }} · {{ post.date }} · 조회 {{ post.views }}</div>

    <div class="post-tag-row" v-if="post.tags.length">
      <router-link v-for="t in post.tags" :key="t" class="tag-chip" :to="`/community?tag=${encodeURIComponent(t)}`">#{{ t }}</router-link>
    </div>

    <div class="attach-gallery" v-if="post.attachments.length">
      <a v-for="(a, i) in post.attachments" :key="i" :href="a.url" target="_blank" rel="noopener noreferrer" class="attach-gallery-item">
        <img v-if="isImage(a)" :src="a.url" :alt="a.name" />
        <span v-else class="attach-gallery-file">📄 {{ a.name }}</span>
      </a>
    </div>

    <div class="community-post-content" v-html="contentHtml"></div>

    <div class="vote-row">
      <button class="vote-btn up" :class="{ active: post.myVote === 'up' }" @click="votePost(post.id, 'up')">
        👍 추천 {{ post.likes }}
      </button>
      <button class="vote-btn down" :class="{ active: post.myVote === 'down' }" @click="votePost(post.id, 'down')">
        👎 비추천 {{ post.dislikes }}
      </button>
    </div>

    <div class="d-section-title">댓글 {{ post.comments.length }}개</div>
    <div class="comment-list">
      <div class="comment-item" v-for="c in post.comments" :key="c.id">
        <div class="comment-top"><b>{{ c.author }}</b><span>{{ c.date }}</span></div>
        <div class="comment-body" v-html="renderMarkdown(c.content)"></div>
        <div class="comment-vote-row">
          <button class="vote-btn mini up" :class="{ active: c.myVote === 'up' }" @click="voteComment(post.id, c.id, 'up')">👍 {{ c.likes }}</button>
          <button class="vote-btn mini down" :class="{ active: c.myVote === 'down' }" @click="voteComment(post.id, c.id, 'down')">👎 {{ c.dislikes }}</button>
        </div>
      </div>
      <div class="empty-state" v-if="post.comments.length === 0">아직 댓글이 없어요</div>
    </div>

    <div class="comment-form">
      <input type="text" v-model="commentAuthor" placeholder="닉네임 (비우면 익명)" class="write-input comment-author-input" />
      <MarkdownEditor v-model="commentDraft" placeholder="댓글을 입력하세요" min-height="110px" />
      <button class="btn-primary write-submit" @click="submitComment">댓글 등록</button>
    </div>
  </div>
  </div>
  <div class="items-page" v-else>
    <div class="grid-wrap">
      <div class="empty-state">게시글을 찾을 수 없어요. <router-link to="/community">커뮤니티로</router-link></div>
    </div>
  </div>
</template>

<style scoped>
.community-detail-wrap{max-width:920px;}
.community-post-title{font-size:24px; margin:10px 0 8px;}
.community-post-meta{font-size:12px; color:var(--text-dim); margin-bottom:14px;}

.post-tag-row{display:flex; flex-wrap:wrap; gap:6px; margin-bottom:18px;}
.tag-chip{
  font-size:11.5px; color:var(--gold-dim); border:1px solid var(--border); background:var(--panel-2);
  padding:3px 9px;
}
.tag-chip:hover{border-color:var(--gold-dim); color:var(--gold);}

.attach-gallery{display:flex; flex-wrap:wrap; gap:8px; margin-bottom:18px;}
.attach-gallery-item{display:block; border:1px solid var(--border-soft); background:var(--panel); overflow:hidden;}
.attach-gallery-item img{width:140px; height:140px; object-fit:cover; display:block;}
.attach-gallery-file{display:flex; align-items:center; padding:10px 14px; font-size:12.5px; color:var(--text-muted);}

.community-post-content{
  font-size:14px; line-height:1.8; color:var(--text);
  padding-bottom:20px; margin-bottom:16px; border-bottom:1px solid var(--border-soft);
}
.community-post-content :deep(p){margin-bottom:8px;}
.community-post-content :deep(ul){margin:8px 0 8px 20px;}
.community-post-content :deep(blockquote){border-left:2px solid var(--gold-dim); padding-left:12px; color:var(--text-muted); margin:8px 0;}
.community-post-content :deep(code){background:var(--panel-2); padding:1px 6px; font-size:12.5px; color:var(--gold);}
.community-post-content :deep(a){color:var(--gold-dim); text-decoration:underline;}

.vote-row{display:flex; gap:10px; margin-bottom:28px;}
.vote-btn{
  font-size:12.5px; color:var(--text-muted); border:1px solid var(--border); padding:8px 16px;
  transition:border-color .1s, color .1s;
}
.vote-btn:hover{border-color:var(--gold-dim);}
.vote-btn.up.active{color:var(--gold); border-color:var(--gold-dim); background:var(--panel);}
.vote-btn.down.active{color:var(--blood); border-color:var(--blood); background:var(--panel);}
.vote-btn.mini{font-size:11px; padding:4px 10px;}

.comment-list{margin-bottom:20px;}
.comment-item{padding:12px 0; border-top:1px solid var(--border-soft);}
.comment-item:first-child{border-top:none;}
.comment-top{display:flex; justify-content:space-between; font-size:12px; margin-bottom:5px;}
.comment-top b{color:var(--gold-dim); font-weight:600;}
.comment-top span{color:var(--text-dim);}
.comment-body{font-size:13px; color:var(--text-muted); line-height:1.5; margin-bottom:8px;}
.comment-body :deep(p){margin-bottom:4px;}
.comment-vote-row{display:flex; gap:8px;}

.comment-form{display:flex; flex-direction:column; gap:10px; max-width:680px;}
.write-input{
  background:var(--panel); border:1px solid var(--border); color:var(--text); font-size:13px;
  padding:10px 12px; font-family:'Noto Sans KR', sans-serif;
}
.write-submit{align-self:flex-start; padding:10px 20px; font-size:13px;}
</style>
