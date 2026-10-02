<script setup>
import { ref, computed, watch, onUnmounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import {
  messagesState,
  loadConversations,
  loadMessages,
  lastMessageOf,
  isConversationRead,
  markConversationRead,
  sendMessage,
  deleteMessage,
  leaveConversation,
} from '../messagesStore.js'
import { authState, signIn } from '../profileStore.js'
import UserAvatar from '../components/UserAvatar.vue'

// 쪽지함 - ?c=대화방번호 로 들어오면 그 대화를 바로 엶 (판매글의 "쪽지 보내기")
const route = useRoute()
const activeId = ref(route.query.c ? Number(route.query.c) : null)
if (activeId.value) messagesState.keepId = activeId.value
const activeConversation = computed(() => messagesState.conversations.find((c) => c.id === activeId.value) || null)
const draft = ref('')
const sendError = ref('')

loadConversations().then(() => {
  if (!activeConversation.value && messagesState.conversations.length) activeId.value = messagesState.conversations[0].id
}).catch(() => {})
watch(() => route.query.c, (c) => { if (c) { activeId.value = Number(c); messagesState.keepId = Number(c) } })

// 열린 대화는 5초마다 새로 받고 읽음 처리 (창이 보일 때만)
let timer = 0
// force: 대화를 처음 열 때는 창이 안 보여도 불러옴 (안 그러면 백그라운드 탭에서 연 대화가 비어 보임)
async function refresh(force = false) {
  const conv = activeConversation.value
  if (!conv || (document.hidden && !force)) return
  await loadMessages(conv).catch(() => {})
  await markConversationRead(conv).catch(() => {})
}
watch(activeConversation, (c) => {
  clearInterval(timer)
  if (!c) return
  refresh(true)
  timer = setInterval(() => refresh(), 5000)
}, { immediate: true })
onUnmounted(() => clearInterval(timer))

// 대화창은 화면 높이에 고정, 새 메시지가 오면 맨 아래로 (위로 올려 읽는 중이면 그대로)
const bodyEl = ref(null)
let stick = true
const onScroll = (e) => { const el = e.target; stick = el.scrollHeight - el.scrollTop - el.clientHeight < 60 }
watch(() => [activeId.value, activeConversation.value?.messages.length], ([id], [prevId] = []) => {
  if (id !== prevId) stick = true
  if (!stick) return
  nextTick(() => { if (bodyEl.value) bodyEl.value.scrollTop = bodyEl.value.scrollHeight })
})

function openConversation(id) {
  activeId.value = id
}

// 내 쪽지 삭제 / 대화방 나가기
async function removeMessage(m) {
  if (!confirm('쪽지 삭제 - 내 화면에서만 사라짐 (상대 화면엔 남음)')) return
  sendError.value = ''
  try { await deleteMessage(activeConversation.value, m) } catch (e) { sendError.value = e.message || '삭제 실패' }
}
async function leave() {
  if (!confirm('대화방 나가기 - 내 목록에서만 사라지고, 상대가 새 쪽지를 보내면 다시 보임')) return
  sendError.value = ''
  try {
    await leaveConversation(activeConversation.value)
    activeId.value = messagesState.conversations[0]?.id || null
  } catch (e) { sendError.value = e.message || '나가기 실패' }
}

async function submitMessage() {
  const text = draft.value.trim()
  if (!text || !activeConversation.value) return
  sendError.value = ''
  draft.value = ''
  try {
    await sendMessage(activeConversation.value, text)
  } catch (e) {
    draft.value = text
    sendError.value = e.message || '전송 실패'
  }
}
</script>

<template>
  <div class="items-page messages-page">

  <div class="patch-hero">
    <div class="patch-hero-inner">
      <div class="eyebrow">1:1 대화</div>
      <h1>쪽지함</h1>
    </div>
  </div>

  <div class="grid-wrap messages-wrap messages-login" v-if="!authState.user">
    <p>로그인 필요</p>
    <button type="button" class="btn-primary" @click="signIn">로그인</button>
  </div>
  <div class="grid-wrap messages-wrap" v-else>
    <div class="messages-layout">
      <div class="conv-list">
        <button
          type="button" class="conv-row" v-for="c in messagesState.conversations" :key="c.id"
          :class="{ active: c.id === activeId, unread: !isConversationRead(c) }"
          @click="openConversation(c.id)"
        >
          <span class="conv-dot" v-if="!isConversationRead(c)"></span>
          <UserAvatar :src="c.avatar" :name="c.withName" :size="34" />
          <div class="conv-row-body">
            <div class="conv-row-top">
              <span class="conv-name">{{ c.withName }}</span>
              <span class="conv-date">{{ lastMessageOf(c)?.date }}</span>
            </div>
            <div class="conv-preview">{{ lastMessageOf(c)?.text }}</div>
          </div>
        </button>
        <div class="empty-state" v-if="!messagesState.conversations.length">쪽지 없음 (판매글의 "쪽지 보내기"로 시작)</div>
      </div>

      <div class="conv-thread" v-if="activeConversation">
        <div class="conv-thread-header">
          <router-link v-if="activeConversation.otherId" :to="'/users/' + activeConversation.otherId" class="user-link conv-profile-link">{{ activeConversation.withName }} <small>프로필 →</small></router-link>
          <span v-else>{{ activeConversation.withName }}</span>
          <button type="button" class="conv-leave" @click="leave">나가기</button>
        </div>
        <div class="conv-thread-body" ref="bodyEl" @scroll="onScroll">
          <div
            class="conv-bubble" v-for="m in activeConversation.messages" :key="m.id"
            :class="m.from === 'me' ? 'mine' : 'theirs'"
          >
            <div class="conv-bubble-text">{{ m.text }}</div>
            <div class="conv-bubble-date">
              <span class="conv-unread" v-if="m.from === 'me' && !m.readAt" title="상대가 아직 안 읽음">1</span>
              {{ m.date }}
              <button type="button" class="conv-del" @click="removeMessage(m)" aria-label="내 화면에서 쪽지 삭제">삭제</button>
            </div>
          </div>
        </div>
        <div class="conv-thread-input">
          <input
            type="text" v-model="draft" placeholder="메시지"
            class="write-input" @keydown.enter.prevent="submitMessage"
          />
          <button type="button" class="btn-primary conv-send-btn" @click="submitMessage">보내기</button>
        </div>
        <div class="send-error" v-if="sendError">{{ sendError }}</div>
      </div>
      <div class="conv-thread conv-thread-empty" v-else>대화 선택</div>
    </div>
  </div>
  </div>
</template>

<style scoped>
.messages-wrap{max-width:1180px;}
.messages-layout{display:grid; grid-template-columns:320px 1fr; gap:16px; align-items:start;}

.conv-list{display:flex; flex-direction:column; gap:8px; background:var(--panel); border:1px solid var(--border-soft); border-radius:16px; padding:10px;}
.conv-row{
  display:flex; align-items:flex-start; gap:8px; padding:12px 14px; border-radius:12px; text-align:left;
  font-family:'Noto Sans KR', sans-serif;
}
.conv-row:hover{background:rgba(255,255,255,0.04);}
.conv-row.active{background:var(--panel-2); border:1px solid var(--gold-dim);}
.conv-dot{width:7px; height:7px; border-radius:999px; background:var(--gold); flex:none; margin-top:6px;}
.conv-row-body{flex:1; min-width:0;}
.conv-row-top{display:flex; align-items:center; justify-content:space-between; margin-bottom:4px;}
.conv-name{font-size:13px; color:var(--text); font-weight:600;}
.conv-row.unread .conv-name{color:var(--gold);}
.conv-date{font-size:10.5px; color:var(--text-dim); flex:none;}
.conv-preview{font-size:12px; color:var(--text-muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}

.conv-thread{
  background:var(--panel); border:1px solid var(--border-soft); border-radius:16px; padding:20px 22px;
  display:flex; flex-direction:column; gap:16px; height:clamp(420px, calc(100dvh - 240px), 820px);
}
.conv-thread-empty{align-items:center; justify-content:center; color:var(--text-dim); font-size:13px;}
.conv-thread-header{font-family:'Noto Serif KR', serif; font-weight:700; font-size:15px; border-bottom:1px solid var(--border-soft); padding-bottom:14px; display:flex; align-items:center; justify-content:space-between;}
.conv-profile-link small{font-family:'Noto Sans KR', sans-serif; font-weight:400; font-size:11.5px; color:var(--gold-dim); margin-left:4px;}
.conv-leave{font-family:'Noto Sans KR', sans-serif; font-weight:400; font-size:12px; color:var(--text-dim); border:1px solid var(--border); border-radius:8px; padding:5px 10px;}
.conv-leave:hover{color:#e0775f; border-color:#e0775f;}
.conv-thread-body{flex:1; min-height:0; display:flex; flex-direction:column; gap:10px; overflow-y:auto; padding-right:4px;}
.conv-bubble{max-width:70%; display:flex; flex-direction:column; gap:4px;}
.conv-bubble.theirs{align-self:flex-start;}
.conv-bubble.mine{align-self:flex-end; align-items:flex-end;}
.conv-bubble-text{
  font-size:13px; padding:10px 14px; border-radius:14px; line-height:1.6; background:var(--panel-2); color:var(--text);
}
.conv-bubble.mine .conv-bubble-text{background:var(--gold-dim); color:#1c1712;}
.conv-bubble-date{font-size:10px; color:var(--text-dim); display:flex; align-items:center; gap:6px;}
/* 카톡처럼 상대가 안 읽은 내 쪽지에 1 */
.conv-unread{color:var(--gold); font-weight:700; font-size:11px;}
.conv-del{font-size:10px; color:var(--text-dim); opacity:0.7;}
.conv-del:hover{color:#e0775f; opacity:1;}
.conv-thread-input{display:flex; gap:8px;}
.conv-thread-input .write-input{flex:1;}
.write-input{
  background:var(--panel-2); border:1px solid var(--border); color:var(--text); font-size:13px;
  padding:11px 14px; font-family:'Noto Sans KR', sans-serif; border-radius:10px;
}
.conv-send-btn{padding:11px 20px; font-size:13px; border-radius:10px;}

@media (max-width:760px){
  .messages-layout{grid-template-columns:minmax(0,1fr);}
  .conv-thread{height:calc(100dvh - 150px); min-height:360px; padding:16px;}
  .conv-thread-empty{height:auto; min-height:160px;}
  .conv-bubble{max-width:85%;}
}
.messages-login{display:flex; flex-direction:column; align-items:center; gap:14px; padding:48px 16px; color:var(--text-muted); font-size:14px;}
.send-error{font-size:12.5px; color:#e0775f; padding:0 16px 12px;}
</style>
