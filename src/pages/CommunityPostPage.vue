<script setup>
import HeaderNotifications from '../components/HeaderNotifications.vue'
import LogoMark from '../components/LogoMark.vue'
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
        <LogoMark />디아허브
      </router-link>
    </div>
    <div class="crumb">
      <router-link to="/">메인</router-link> / <router-link to="/community">커뮤니티</router-link> / <b>{{ post.category }}</b>
    </div>
    <HeaderNotifications />
  </header>

  <div class="grid-wrap community-detail-wrap">
    <div class="post-card">
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

.attach-gallery{display:flex; flex-wrap:wrap; gap:10px; margin-bottom:20px;}
.attach-gallery-item{display:block; border:1px solid var(--border-soft); background:var(--panel-2); overflow:hidden; border-radius:12px;}
.attach-gallery-item img{width:140px; height:140px; object-fit:cover; display:block;}
.attach-gallery-file{display:flex; align-items:center; padding:10px 14px; font-size:12.5px; color:var(--text-muted);}

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
</style>
