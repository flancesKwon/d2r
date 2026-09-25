import { reactive } from 'vue'
import seedPosts from './data/communityPosts.json'

export const CATEGORIES = ['질문', '거래', '잡담', '공략']

export const communityState = reactive({
  posts: seedPosts.map((p) => ({
    ...p,
    tags: p.tags ? [...p.tags] : [],
    attachments: p.attachments ? [...p.attachments] : [],
    likes: p.likes || 0,
    dislikes: p.dislikes || 0,
    myVote: null,
    comments: p.comments.map((c) => ({ ...c, likes: c.likes || 0, dislikes: c.dislikes || 0, myVote: null })),
  })),
})

let nextPostId = seedPosts.length + 1
let nextCommentId = Math.max(0, ...seedPosts.flatMap((p) => p.comments.map((c) => c.id))) + 1

function today() {
  return new Date().toISOString().slice(0, 10)
}

export function addPost({ category, title, author, content, tags = [], attachments = [] }) {
  const post = {
    id: 'c-new-' + nextPostId++,
    category,
    title,
    author: author || '익명',
    date: today(),
    views: 0,
    content,
    tags,
    attachments,
    likes: 0,
    dislikes: 0,
    myVote: null,
    comments: [],
  }
  communityState.posts.unshift(post)
  return post
}

export function addComment(postId, { author, content }) {
  const post = communityState.posts.find((p) => p.id === postId)
  if (!post) return
  post.comments.push({
    id: nextCommentId++,
    author: author || '익명',
    date: today(),
    content,
    likes: 0,
    dislikes: 0,
    myVote: null,
  })
}

function applyVote(target, dir) {
  const field = dir === 'up' ? 'likes' : 'dislikes'
  if (target.myVote === dir) {
    target[field]--
    target.myVote = null
    return
  }
  if (target.myVote) {
    target[target.myVote === 'up' ? 'likes' : 'dislikes']--
  }
  target[field]++
  target.myVote = dir
}

export function votePost(postId, dir) {
  const post = communityState.posts.find((p) => p.id === postId)
  if (!post) return
  applyVote(post, dir)
}

export function voteComment(postId, commentId, dir) {
  const post = communityState.posts.find((p) => p.id === postId)
  const comment = post && post.comments.find((c) => c.id === commentId)
  if (!comment) return
  applyVote(comment, dir)
}

export function getPost(postId) {
  return communityState.posts.find((p) => p.id === postId)
}

export function allTags() {
  const set = new Set()
  communityState.posts.forEach((p) => p.tags.forEach((t) => set.add(t)))
  return [...set]
}

// 마이페이지 "내가 쓴 글"용 - 프로필 닉네임과 author가 일치하는 글만 찾음
export function communityPostsByAuthor(nickname) {
  if (!nickname) return []
  return communityState.posts.filter((p) => p.author === nickname)
}
