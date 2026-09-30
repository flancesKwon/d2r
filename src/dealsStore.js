import { reactive, computed, watch } from 'vue'
import { supabase, mustReturnRows } from './supabase.js'
import { authState } from './profileStore.js'

// 거래방 - tb_trade_deal / _message / _review
// 판매자가 구매신청을 수락하면 DB 함수(accept_trade_request)가 거래방을 만듦 (직접 만들 수 없음)
// 거래 당사자(판매자·구매자)만 보고 쓸 수 있음(RLS). 리뷰는 거래완료 뒤 한 번 (거래당 1개)
const PERSON = (fk) => `tb_profile!${fk}(nickname, avatar_url)`
const DEAL_SELECT = `*, seller:${PERSON('tb_trade_deal_seller_id_fkey')}, buyer:${PERSON('tb_trade_deal_buyer_id_fkey')}, review:tb_trade_deal_review(*)`

export const DEAL_STATUSES = ['거래중', '거래완료', '거래불발']
export const dealsState = reactive({ deals: [], loaded: false, loading: false })

function fmtDate(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
function fmtTime(ts) {
  const d = new Date(ts)
  const p = (n) => String(n).padStart(2, '0')
  return `${fmtDate(ts)} ${p(d.getHours())}:${p(d.getMinutes())}`
}

function mapReview(r) {
  if (!r) return null
  return { rating: r.rating, comment: r.comment || '', fromId: r.from_id, toId: r.to_id, date: fmtDate(r.created_at) }
}
function mapDeal(r) {
  const uid = authState.user?.id
  const iAmSeller = r.seller_id === uid
  const review = Array.isArray(r.review) ? r.review[0] : r.review
  return {
    id: r.id,
    postId: r.post_id,
    itemId: r.item_id,
    postTitle: r.post_title,
    status: r.status,
    date: fmtDate(r.created_at),
    sellerId: r.seller_id,
    buyerId: r.buyer_id,
    seller: r.seller?.nickname || '알 수 없음',
    buyer: r.buyer?.nickname || '알 수 없음',
    // 나 말고 상대방
    counterpartId: iAmSeller ? r.buyer_id : r.seller_id,
    counterpart: (iAmSeller ? r.buyer?.nickname : r.seller?.nickname) || '알 수 없음',
    iAmSeller,
    review: mapReview(review),
    messages: [],
  }
}

function needUser() {
  if (!supabase) throw new Error('서버 연결 실패')
  if (!authState.user) throw new Error('로그인 필요')
  return authState.user.id
}

export async function loadDeals() {
  if (!supabase || !authState.user) {
    dealsState.deals = []
    dealsState.loaded = false
    return
  }
  dealsState.loading = true
  try {
    const { data, error } = await supabase.from('tb_trade_deal').select(DEAL_SELECT).order('created_at', { ascending: false })
    if (error) throw error
    const old = new Map(dealsState.deals.map((d) => [d.id, d.messages]))
    dealsState.deals = data.map((r) => ({ ...mapDeal(r), messages: old.get(r.id) || [] }))
    dealsState.loaded = true
  } finally {
    dealsState.loading = false
  }
}
// 로그인이 바뀌면 다시 (헤더의 "거래중" 숫자도 이걸 씀)
watch(() => authState.user?.id, () => loadDeals().catch(() => {}), { immediate: true })

export function getDeal(dealId) {
  return dealsState.deals.find((d) => String(d.id) === String(dealId))
}

export async function loadDealMessages(deal) {
  if (!supabase || !deal) return
  const { data, error } = await supabase
    .from('tb_trade_deal_message').select('*').eq('deal_id', deal.id).order('created_at', { ascending: true })
  if (error) throw error
  const uid = authState.user?.id
  deal.messages = data.map((m) => ({ id: m.id, from: m.sender_id === uid ? 'me' : 'them', text: m.text, date: fmtTime(m.created_at) }))
}

export async function sendDealMessage(deal, text) {
  const uid = needUser()
  const body = (text || '').trim()
  if (!body) return
  const rows = await mustReturnRows(
    supabase.from('tb_trade_deal_message').insert({ deal_id: deal.id, sender_id: uid, text: body }).select('*'),
    '메시지 전송 실패'
  )
  deal.messages.push({ id: rows[0].id, from: 'me', text: rows[0].text, date: fmtTime(rows[0].created_at) })
}

export async function updateDealStatus(deal, status) {
  needUser()
  const rows = await mustReturnRows(
    supabase.from('tb_trade_deal').update({ status }).eq('id', deal.id).select('status'),
    '거래 상태 변경 권한 없음'
  )
  deal.status = rows[0].status
}

// 리뷰 - 거래완료 상태에서 상대방에게 (DB가 조건을 다시 확인함)
export async function addReview(deal, { rating, comment }) {
  const uid = needUser()
  const rows = await mustReturnRows(
    supabase.from('tb_trade_deal_review')
      .insert({ deal_id: deal.id, from_id: uid, to_id: deal.counterpartId, rating: Number(rating) || 5, comment: (comment || '').trim() || null })
      .select('*'),
    '리뷰 등록 실패'
  )
  deal.review = mapReview(rows[0])
}

// 마이페이지 "받은 리뷰" (리뷰는 공개)
export async function fetchReviewsFor(userId) {
  if (!supabase || !userId) return []
  const { data, error } = await supabase
    .from('tb_trade_deal_review')
    .select(`*, from:${PERSON('tb_trade_deal_review_from_id_fkey')}, deal:tb_trade_deal(post_title)`)
    .eq('to_id', userId).order('created_at', { ascending: false }).limit(100)
  if (error) throw error
  return data.map((r) => ({ ...mapReview(r), dealId: r.deal_id, from: r.from?.nickname || '알 수 없음', postTitle: r.deal?.post_title || '' }))
}

export const activeDealCount = computed(() => dealsState.deals.filter((d) => d.status === '거래중').length)
