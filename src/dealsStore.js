import { reactive, computed } from 'vue'
import { pushNotification } from './notificationsStore.js'

// 판매자가 구매신청을 수락하면(respondToRequest) 여기서 거래방(채팅)이 하나 열림 -
// 실제 로그인이 없어서 상대방이 진짜로 타이핑해서 답장하진 않지만, 세부사항을
// 조율하는 채팅 UI와 거래완료/불발 처리, 리뷰 흐름을 미리 볼 수 있게 함
const STORAGE_KEY = 'd2r-deals'

function today() {
  return new Date().toISOString().slice(0, 10)
}

function loadDeals() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export const dealsState = reactive({ deals: loadDeals() })

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dealsState.deals))
  } catch {
    // 프라이빗 창 등 localStorage를 못 쓰는 환경 - 이번 세션 안에서만 유지됨
  }
}

let nextDealId = 1 + Math.max(0, ...dealsState.deals.map((d) => d.id))
let nextMsgId = 1 + Math.max(0, ...dealsState.deals.flatMap((d) => d.messages.map((m) => m.id)))

export const DEAL_STATUSES = ['거래중', '거래완료', '거래불발']

// 같은 구매신청으로 이미 거래방이 열려있으면 새로 만들지 않고 그대로 반환
export function createDeal(post, request) {
  const existing = dealsState.deals.find((d) => d.postId === post.id && d.requestId === request.id)
  if (existing) return existing
  const deal = {
    id: nextDealId++,
    postId: post.id,
    itemId: post.itemId,
    postTitle: post.itemName,
    requestId: request.id,
    seller: post.author,
    buyer: request.buyer,
    status: '거래중',
    date: today(),
    messages: [
      {
        id: nextMsgId++,
        from: 'them',
        text: '구매신청이 수락됐어요! 접속 시간, 배틀태그 등 거래 세부사항을 여기서 조율해주세요.',
        date: today(),
      },
    ],
    review: null,
  }
  dealsState.deals.unshift(deal)
  persist()
  pushNotification(`"${post.itemName}" 거래가 시작됐어요. 채팅으로 세부사항을 조율하세요.`, '/deals')
  return deal
}

export function getDeal(dealId) {
  return dealsState.deals.find((d) => String(d.id) === String(dealId))
}

export function sendDealMessage(dealId, text) {
  const deal = getDeal(dealId)
  if (!deal || !text.trim()) return
  deal.messages.push({ id: nextMsgId++, from: 'me', text: text.trim(), date: today() })
  persist()
}

export function updateDealStatus(dealId, status) {
  const deal = getDeal(dealId)
  if (!deal) return
  deal.status = status
  persist()
  if (status === '거래완료') {
    pushNotification(`"${deal.postTitle}" 거래가 완료됐어요. 상대방에게 리뷰를 남겨보세요.`, '/deals')
  }
}

// from/to는 닉네임 문자열 - 로그인이 없어서 지금 이 브라우저의 프로필 닉네임(from)이
// 거래 상대(to)에게 남기는 리뷰로 저장됨
export function addReview(dealId, { rating, comment, from, to }) {
  const deal = getDeal(dealId)
  if (!deal) return
  deal.review = { rating: Number(rating) || 0, comment: comment || '', from, to, date: today() }
  persist()
}

// 마이페이지 "받은 리뷰"에서 사용
export function reviewsForUser(nickname) {
  if (!nickname) return []
  return dealsState.deals
    .filter((d) => d.review && d.review.to === nickname)
    .map((d) => ({ ...d.review, postTitle: d.postTitle, dealId: d.id }))
}

export const activeDealCount = computed(() => dealsState.deals.filter((d) => d.status === '거래중').length)
