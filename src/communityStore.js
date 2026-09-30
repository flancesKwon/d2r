// 커뮤니티 게시판 - Supabase (tb_community_post / _comment / _post_vote / _comment_vote)
// - 글의 주인은 author_id(로그인 uuid). 권한은 DB의 RLS가 막고, 화면은 버튼을 숨기기만 함
// - 추천/비추천 수는 직접 안 올림: 표(행)를 넣고 빼면 DB 트리거가 like_count 를 맞춤
// - 조회수는 increment_post_view RPC 로만 (views 직접 수정은 RLS가 막음)
import { supabase, mustReturnRows } from './supabase.js'
import { authState, isStaff } from './profileStore.js'

export const CATEGORIES = ['질문', '거래', '잡담', '공략']
export const PAGE_SIZE = 20

// tb_profile 로 가는 길이 둘(작성자 / 추천 표)이라 외래키 이름을 꼭 적어야 함 (안 적으면 PGRST201)
const POST_AUTHOR = 'author:tb_profile!tb_community_post_author_id_fkey(nickname, avatar_url)'
const COMMENT_AUTHOR = 'author:tb_profile!tb_community_comment_author_id_fkey(nickname, avatar_url)'

export function formatDate(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function mapPost(r) {
  return {
    id: r.id,
    category: r.category,
    title: r.title,
    content: r.content,
    tags: r.tags || [],
    views: r.views,
    likes: r.like_count,
    dislikes: r.dislike_count,
    commentCount: r.comment_count,
    authorId: r.author_id,
    author: r.author?.nickname || '알 수 없음',
    avatar: r.author?.avatar_url || null,
    date: formatDate(r.created_at),
    createdAt: r.created_at,
    myVote: null,
  }
}
function mapComment(r) {
  return {
    id: r.id,
    content: r.content,
    likes: r.like_count,
    dislikes: r.dislike_count,
    authorId: r.author_id,
    author: r.author?.nickname || '알 수 없음',
    avatar: r.author?.avatar_url || null,
    date: formatDate(r.created_at),
    myVote: null,
  }
}
const voteDir = (v) => (v === 1 ? 'up' : v === -1 ? 'down' : null)

function needLogin() {
  if (!authState.user) throw new Error('로그인이 필요해요')
  return authState.user.id
}
function needDb() {
  if (!supabase) throw new Error('게시판 서버에 연결할 수 없어요')
}

const SORT_COLUMN = { latest: 'created_at', likes: 'like_count', views: 'views', comments: 'comment_count' }

// 목록 - 페이지 단위로만 (전체 로드 금지)
export async function fetchPosts({ category = null, tag = null, q = '', sort = 'latest', page = 0, pageSize = PAGE_SIZE, authorId = null } = {}) {
  needDb()
  let query = supabase
    .from('tb_community_post')
    .select(`*, ${POST_AUTHOR}`, { count: 'exact' })
    .is('deleted_at', null)
  if (category) query = query.eq('category', category)
  if (tag) query = query.contains('tags', [tag])
  if (authorId) query = query.eq('author_id', authorId)
  // 검색어의 , ( ) 는 PostgREST or() 문법과 부딪혀서 뺌
  const term = q.trim().replace(/[,()%*\\]/g, ' ').trim()
  if (term) query = query.or(`title.ilike.%${term}%,content.ilike.%${term}%`)
  query = query.order(SORT_COLUMN[sort] || 'created_at', { ascending: false })
  if (sort !== 'latest') query = query.order('created_at', { ascending: false })
  const { data, error, count } = await query.range(page * pageSize, page * pageSize + pageSize - 1)
  if (error) throw error
  return { posts: data.map(mapPost), total: count ?? 0 }
}

// 글 하나 + 댓글 + (로그인 시) 내가 누른 추천
export async function fetchPost(id) {
  needDb()
  const { data, error } = await supabase.from('tb_community_post').select(`*, ${POST_AUTHOR}`).eq('id', id).maybeSingle()
  if (error) throw error
  if (!data) return null
  const post = mapPost(data)
  const { data: comments, error: cErr } = await supabase
    .from('tb_community_comment').select(`*, ${COMMENT_AUTHOR}`)
    .eq('post_id', id).is('deleted_at', null).order('created_at', { ascending: true })
  if (cErr) throw cErr
  post.comments = comments.map(mapComment)
  await restoreMyVotes(post)
  return post
}

async function restoreMyVotes(post) {
  if (!authState.user) return
  const [{ data: pv }, { data: cv }] = await Promise.all([
    supabase.from('tb_community_post_vote').select('value').eq('post_id', post.id).maybeSingle(),
    post.comments.length
      ? supabase.from('tb_community_comment_vote').select('comment_id, value').in('comment_id', post.comments.map((c) => c.id))
      : Promise.resolve({ data: [] }),
  ])
  post.myVote = voteDir(pv?.value)
  const byId = new Map((cv || []).map((v) => [v.comment_id, v.value]))
  for (const c of post.comments) c.myVote = voteDir(byId.get(c.id))
}

// 조회수 - 같은 창에서 같은 글은 한 번만
export async function countView(id) {
  if (!supabase) return false
  const key = 'd2r-viewed-post-' + id
  try {
    if (sessionStorage.getItem(key)) return false
    sessionStorage.setItem(key, '1')
  } catch (e) {}
  const { error } = await supabase.rpc('increment_post_view', { p_post_id: Number(id) })
  return !error
}

export async function createPost({ category, title, content, tags = [] }) {
  needDb()
  const uid = needLogin()
  const rows = await mustReturnRows(
    supabase.from('tb_community_post')
      .insert({ author_id: uid, category, title: title.trim(), content, tags })
      .select('id'),
    '글을 등록하지 못했어요'
  )
  return rows[0].id
}

export async function updatePost(id, { category, title, content, tags }) {
  needDb()
  needLogin()
  await mustReturnRows(
    supabase.from('tb_community_post')
      .update({ category, title: title.trim(), content, tags, updated_at: new Date().toISOString() })
      .eq('id', id).select('id'),
    '글을 수정할 권한이 없어요'
  )
}

export async function deletePost(id) {
  needDb()
  needLogin()
  await mustReturnRows(supabase.from('tb_community_post').delete().eq('id', id).select('id'), '글을 삭제할 권한이 없어요')
}

export async function addComment(postId, content) {
  needDb()
  const uid = needLogin()
  const rows = await mustReturnRows(
    supabase.from('tb_community_comment')
      .insert({ post_id: Number(postId), author_id: uid, content })
      .select(`*, ${COMMENT_AUTHOR}`),
    '댓글을 등록하지 못했어요'
  )
  return mapComment(rows[0])
}

export async function deleteComment(id) {
  needDb()
  needLogin()
  await mustReturnRows(supabase.from('tb_community_comment').delete().eq('id', id).select('id'), '댓글을 삭제할 권한이 없어요')
}

// 추천/비추천: 같은 걸 다시 누르면 취소, 반대를 누르면 바꿈. 숫자는 트리거가 맞춘 값을 다시 읽음
async function vote(table, key, id, target, dir) {
  needDb()
  const uid = needLogin()
  const value = dir === 'up' ? 1 : -1
  if (target.myVote === dir) {
    await mustReturnRows(supabase.from(table).delete().eq(key, id).eq('user_id', uid).select(key), '추천을 취소하지 못했어요')
    target.myVote = null
  } else {
    await mustReturnRows(
      supabase.from(table).upsert({ [key]: id, user_id: uid, value }, { onConflict: `${key},user_id` }).select(key),
      '추천하지 못했어요'
    )
    target.myVote = dir
  }
}

export async function votePost(post, dir) {
  await vote('tb_community_post_vote', 'post_id', post.id, post, dir)
  const { data } = await supabase.from('tb_community_post').select('like_count, dislike_count').eq('id', post.id).single()
  if (data) { post.likes = data.like_count; post.dislikes = data.dislike_count }
}

export async function voteComment(comment, dir) {
  await vote('tb_community_comment_vote', 'comment_id', comment.id, comment, dir)
  const { data } = await supabase.from('tb_community_comment').select('like_count, dislike_count').eq('id', comment.id).single()
  if (data) { comment.likes = data.like_count; comment.dislikes = data.dislike_count }
}

// 권한 확인 (화면에서 버튼 보일지만 - 실제 차단은 RLS)
export const canEdit = (row) => !!authState.user && (row.authorId === authState.user.id || authState.profile?.role === 'admin')
// 삭제는 운영진(moderator)도 가능 (DB 정책 d2r_staff_delete)
export const canDelete = (row) => !!authState.user && (row.authorId === authState.user.id || isStaff())
