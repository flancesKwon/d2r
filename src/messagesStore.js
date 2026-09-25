import { reactive, computed } from 'vue'

// 실제 로그인 계정이 없어서 상대방에게 진짜로 쪽지가 전달되진 않지만, UI/흐름을
// 미리 볼 수 있게 예시 대화를 몇 개 넣어두고 이 브라우저에서 보낸 메시지는
// 대화창에 쌓이게 함(로컬 저장)
const STORAGE_KEY = 'd2r-messages'

function today() {
  return new Date().toISOString().slice(0, 10)
}

const seedConversations = [
  {
    id: 'm1',
    withName: '룬장수',
    messages: [
      { from: 'them', text: '이스트 룬 5개 아직 판매중이신가요?', date: '2026-09-20' },
      { from: 'me', text: '네 아직 있어요! 몇 개 필요하세요?', date: '2026-09-20' },
      { from: 'them', text: '2개만 살게요, 배틀태그 알려주시면 바로 접속할게요', date: '2026-09-20' },
    ],
  },
  {
    id: 'm2',
    withName: '보석상',
    messages: [
      { from: 'them', text: '최상급 다이아몬드 스택 통째로 구매 가능할까요?', date: '2026-09-21' },
    ],
  },
  {
    id: 'm3',
    withName: '룬워드공방',
    messages: [
      { from: 'me', text: '무한 창 옵션 좋아보이는데 실제 옵션 값 알 수 있을까요?', date: '2026-09-19' },
      { from: 'them', text: '판매글에 실제 옵션 다 적어놨어요, 확인해보세요!', date: '2026-09-19' },
    ],
  },
]

function loadConversations() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : seedConversations
  } catch {
    return seedConversations
  }
}

export const messagesState = reactive({ conversations: loadConversations() })

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messagesState.conversations))
  } catch {
    // 프라이빗 창 등 localStorage를 못 쓰는 환경 - 이번 세션 안에서만 유지됨
  }
}

export function getConversation(id) {
  return messagesState.conversations.find((c) => c.id === id)
}

export function sendMessage(conversationId, text) {
  const conv = getConversation(conversationId)
  if (!conv || !text.trim()) return
  conv.messages.push({ from: 'me', text: text.trim(), date: today() })
  persist()
}

// 대화 목록에서 마지막 메시지를 미리보기로 보여주기 위함
export function lastMessageOf(conv) {
  return conv.messages[conv.messages.length - 1] || null
}

// 상대방이 마지막으로 보낸 메시지가 있으면 안 읽은 걸로 간주(데모용 - 실제
// 읽음 처리는 대화를 열면 그 즉시 반영됨)
const openedConversations = reactive({ ids: new Set() })
export function isConversationRead(conv) {
  if (openedConversations.ids.has(conv.id)) return true
  const last = lastMessageOf(conv)
  return !last || last.from === 'me'
}
export function markConversationOpened(id) {
  openedConversations.ids.add(id)
}

export const unreadMessageCount = computed(
  () => messagesState.conversations.filter((c) => !isConversationRead(c)).length
)
