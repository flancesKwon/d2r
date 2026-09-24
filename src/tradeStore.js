import { reactive } from 'vue'
import seedPosts from './data/tradePosts.json'
import itemsData from './data/items.json'

export { itemsData }

export const TRADE_CATEGORIES = ['룬', '퍼펙트 보석', '우버보스 재료', '유니크/세트', '룬워드', '기타']
export const TRADE_STATUSES = ['판매중', '예약중', '거래완료']
export const TRADE_REALMS = ['미국동', '미국서', '유럽', '아시아']
export const TRADE_LADDERS = ['레더', '논레더']
export const TRADE_HARDCORE = ['일반', '하드코어']

// 카테고리별로 아이템 사전(items.json)에서 실제 데이터를 검색해 고를 수 있는지 여부.
// 우버보스 재료·기타(잊혀진 영혼 등 소모성 재료)는 아이템 사전에 없는 퀘스트/재료성
// 아이템이라 자유 입력으로 남겨둠.
const CATEGORY_ITEM_FILTER = {
  룬: (it) => it.category === 'gem' && it.type_sub === '룬',
  '퍼펙트 보석': (it) => it.category === 'gem' && it.type_sub === '보석',
  '유니크/세트': (it) => it.category === 'unique' || it.category === 'set',
  룬워드: (it) => it.category === 'runeword',
}

export function itemDbSupportsCategory(category) {
  return !!CATEGORY_ITEM_FILTER[category]
}

export function searchTradeItems(category, query) {
  const filterFn = CATEGORY_ITEM_FILTER[category]
  if (!filterFn) return []
  const list = itemsData.filter(filterFn)
  const q = query.trim().toLowerCase()
  if (!q) return list.slice(0, 40)
  return list.filter((it) => it.name_ko.toLowerCase().includes(q) || it.name_en.toLowerCase().includes(q)).slice(0, 40)
}

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

export function getTradeItem(itemId) {
  return itemId ? itemsData.find((it) => it.id === itemId) : null
}

export function addTradePost({
  category,
  itemId,
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
    itemId: itemId || null,
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
