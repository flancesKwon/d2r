import { reactive, computed, watch } from 'vue'
import { supabase, mustReturnRows, settleStaleSoon } from './supabase.js'
import { authState } from './profileStore.js'
import { playChime } from './notifySound.js'

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
  // 리뷰는 거래당 사람마다 하나 (내가 쓴 것 / 상대가 쓴 것)
  const reviews = (Array.isArray(r.review) ? r.review : r.review ? [r.review] : []).map(mapReview)
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
    counterpartAvatar: (iAmSeller ? r.buyer?.avatar_url : r.seller?.avatar_url) || null,
    iAmSeller,
    // 거래완료는 두 사람 다 눌러야 (012 SQL) - 누른 시각
    myDoneAt: (iAmSeller ? r.seller_done_at : r.buyer_done_at) || null,
    theirDoneAt: (iAmSeller ? r.buyer_done_at : r.seller_done_at) || null,
    myReview: reviews.find((v) => v.fromId === uid) || null,
    theirReview: reviews.find((v) => v.fromId !== uid) || null,
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
    // 한쪽만 완료를 누르고 3일 지난 내 거래는 먼저 완료로 (012 SQL 전이면 조용히 넘어감)
    settleStaleSoon()
    await supabase.rpc('d2r_settle_deals').then(() => {}, () => {})
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

// 거래방마다 이미 본 상대 메시지 id 중 가장 큰 것 - 더 새 메시지가 오면 소리 (처음 열 때는 소리 없음)
const dealSeen = new Map()
// markRead: 창이 보일 때만 읽음 처리 (다른 탭을 보는 중이면 소리만)
export async function loadDealMessages(deal, { markRead = true } = {}) {
  if (!supabase || !deal) return
  const { data, error } = await supabase
    .from('tb_trade_deal_message').select('*').eq('deal_id', deal.id).order('created_at', { ascending: true })
  if (error) throw error
  const uid = authState.user?.id
  const top = Math.max(0, ...data.filter((m) => m.sender_id !== uid).map((m) => m.id))
  if (dealSeen.has(deal.id) && top > dealSeen.get(deal.id)) playChime()
  if (!dealSeen.has(deal.id) || top > dealSeen.get(deal.id)) dealSeen.set(deal.id, top)
  deal.messages = data.map((m) => ({ id: m.id, from: m.sender_id === uid ? 'me' : 'them', text: m.text, date: fmtTime(m.created_at), readAt: m.read_at || null }))
  // 상대가 보낸 안 읽은 메시지를 읽음으로 (DB 함수가 아직 없으면 조용히 넘어감)
  if (markRead && data.some((m) => m.sender_id !== uid && !m.read_at)) await supabase.rpc('d2r_mark_deal_read', { p_deal: deal.id }).then(() => {}, () => {})
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

// 거래완료: 내가 누름 -> 상대도 눌렀으면 거래완료, 아니면 확인 대기 (상대에게 알림) / 거래불발: 한 명이 눌러도 바로
// 돌려주는 값: '거래완료' | '확인 대기' | '거래불발'
export async function updateDealStatus(deal, status) {
  needUser()
  const fn = status === '거래완료' ? 'd2r_deal_done' : 'd2r_deal_fail'
  const { data, error } = await supabase.rpc(fn, { p_deal: deal.id })
  if (error && /function|schema cache/i.test(error.message)) {
    // 012 SQL 전: 예전처럼 바로 변경
    const rows = await mustReturnRows(
      supabase.from('tb_trade_deal').update({ status }).eq('id', deal.id).select('status'),
      '거래 상태 변경 권한 없음'
    )
    deal.status = rows[0].status
    return deal.status
  }
  if (error) throw new Error(error.message || '처리 실패')
  if (data === '확인 대기') deal.myDoneAt = deal.myDoneAt || new Date().toISOString()
  else deal.status = data
  return data
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
  deal.myReview = mapReview(rows[0])
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
