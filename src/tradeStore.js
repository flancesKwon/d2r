import { reactive } from 'vue'
import seedPosts from './data/tradePosts.json'

export const TRADE_CATEGORIES = ['룬', '퍼펙트 보석', '우버보스 재료', '유니크/세트', '룬워드', '기타']
export const TRADE_STATUSES = ['판매중', '예약중', '거래완료']
export const TRADE_REALMS = ['미국동', '미국서', '유럽', '아시아']
export const TRADE_LADDERS = ['레더', '논레더']
export const TRADE_HARDCORE = ['일반', '하드코어']

export const UNIT_PRESETS = {
  룬: ['1개', '5개', '10개입 묶음', '스택 전체'],
  '퍼펙트 보석': ['1개', '10개입 묶음', '1스택(40개입)'],
  '우버보스 재료': ['1세트', '3세트', '1개'],
  '유니크/세트': ['1개'],
  룬워드: ['1개'],
  기타: ['1개', '10개입 묶음'],
}

export const tradeState = reactive({
  posts: seedPosts.map((p) => ({
    ...p,
    requests: p.requests ? p.requests.map((r) => ({ ...r })) : [],
  })),
})

let nextPostId = seedPosts.length + 1
let nextRequestId =
  Math.max(0, ...seedPosts.flatMap((p) => (p.requests || []).map((r) => r.id))) + 1

function today() {
  return new Date().toISOString().slice(0, 10)
}

export function addTradePost({
  category,
  itemName,
  amountLabel,
  price,
  realm,
  ladder,
  hardcore,
  author,
  contact,
  content,
}) {
  const post = {
    id: 't-new-' + nextPostId++,
    category,
    itemName,
    amountLabel,
    price,
    realm,
    ladder,
    hardcore,
    author: author || '익명',
    contact: contact || '',
    date: today(),
    views: 0,
    status: '판매중',
    content: content || '',
    requests: [],
  }
  tradeState.posts.unshift(post)
  return post
}

export function addTradeRequest(postId, { buyer, contact, qty, message }) {
  const post = tradeState.posts.find((p) => p.id === postId)
  if (!post) return
  post.requests.push({
    id: nextRequestId++,
    buyer: buyer || '익명',
    contact: contact || '',
    qty: Number(qty) || 1,
    message: message || '',
    date: today(),
  })
}

export function updateTradeStatus(postId, status) {
  const post = tradeState.posts.find((p) => p.id === postId)
  if (!post) return
  post.status = status
}

export function getTradePost(postId) {
  return tradeState.posts.find((p) => p.id === postId)
}
