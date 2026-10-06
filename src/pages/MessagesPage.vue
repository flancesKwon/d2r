<script setup>
import { ref, computed, watch, onUnmounted, nextTick } from 'vue'
import { askConfirm } from '../dialog.js'
import { t } from '../i18n.js'
import { postName, countText, nameText, priceText as tradePriceText } from '../tradeI18n.js'
import { useRoute, useRouter } from 'vue-router'
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
import { realtimeTick } from '../realtime.js'
import { getTradePost, fetchTradePost, postIconKey, postRarity } from '../tradeStore.js'
import { ITEM_ICONS } from '../itemIcons.js'

// 쪽지함 - ?c=대화방번호 로 들어오면 그 대화를 바로 엶 (판매글의 "쪽지 보내기")
const route = useRoute()
const router = useRouter()
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
  timer = setInterval(() => refresh(), 10000)
}, { immediate: true })
onUnmounted(() => clearInterval(timer))
// 새 쪽지·상대가 읽음이 실시간으로 오면 바로 (주기 확인 10초는 실시간이 끊겼을 때용)
watch(() => realtimeTick.dm, () => refresh())

// 대화창은 화면 높이에 고정, 새 메시지가 오면 맨 아래로 (위로 올려 읽는 중이면 그대로)
const bodyEl = ref(null)
let stick = true
const onScroll = (e) => { const el = e.target; stick = el.scrollHeight - el.scrollTop - el.clientHeight < 60 }
watch(() => [activeId.value, activeConversation.value?.messages.length], ([id], [prevId] = []) => {
  if (id !== prevId) stick = true
  if (!stick) return
  nextTick(() => { if (bodyEl.value) bodyEl.value.scrollTop = bodyEl.value.scrollHeight })
})

// 대화 고르기 = 주소(?c=번호)도 바꿈 - 새로고침·뒤로 가기해도 그 대화
function openConversation(id) {
  activeId.value = id
  router.replace({ query: { ...route.query, c: id } })
}

// 내 쪽지 삭제 / 대화방 나가기
async function removeMessage(m) {
  if (!await askConfirm(t('쪽지 삭제 - 내 화면에서만 사라짐 (상대 화면엔 남음)'))) return
  sendError.value = ''
  try { await deleteMessage(activeConversation.value, m) } catch (e) { sendError.value = t(e.message || '삭제 실패') }
}
async function leave() {
  if (!await askConfirm(t('대화방 나가기 - 내 목록에서만 사라지고, 상대가 새 쪽지를 보내면 다시 보임'))) return
  sendError.value = ''
  try {
    await leaveConversation(activeConversation.value)
    activeId.value = messagesState.conversations[0]?.id || null
  } catch (e) { sendError.value = t(e.message || '나가기 실패') }
}

// 판매글의 "문의하기"로 들어오면(?post=번호) 그 판매글을 입력창 위에 붙여 두고, 보내는 첫 메시지 앞에
// "[판매글 #번호 아이템명]" 을 넣음 -> 대화창에선 그 부분이 판매글 링크 카드로 보임
const attachedPost = ref(null)
async function loadAttached(id) {
  attachedPost.value = null
  if (!id) return
  attachedPost.value = getTradePost(id) || (await fetchTradePost(id).catch(() => null))
}
watch(() => route.query.post, loadAttached, { immediate: true })
function detachPost() {
  attachedPost.value = null
  const { post, ...rest } = route.query
  router.replace({ query: rest })
}
const iconUrl = (key) => (key && ITEM_ICONS[key]) || null
const priceText = (p) => tradePriceText(p.price)

// 메시지 앞의 "[판매글 #12 이스트 룬]" -> { postId, name, rest }
const POST_TAG = /^\[판매글 #(\d+) ([^\]]{1,80})\]\s*/
function splitPostTag(text) {
  const m = POST_TAG.exec(text || '')
  return m ? { postId: m[1], name: m[2], rest: text.slice(m[0].length) } : { postId: null, name: '', rest: text }
}
const previewText = (text) => { const t = splitPostTag(text); return t.postId ? `[${t.name}] ${t.rest}` : text }

async function submitMessage() {
  const text = draft.value.trim()
  if (!text || !activeConversation.value) return
  const p = attachedPost.value
  const body = p ? `[판매글 #${p.id} ${p.itemName.replace(/[\[\]]/g, '').slice(0, 60)}] ${text}` : text
  sendError.value = ''
  draft.value = ''
  try {
    await sendMessage(activeConversation.value, body)
    if (p) detachPost()
  } catch (e) {
    draft.value = text
    sendError.value = t(e.message || '전송 실패')
  }
}
</script>

<template>
  <div class="items-page messages-page">

  <div class="patch-hero">
    <div class="patch-hero-inner">
      <div class="eyebrow">{{ $t('1:1 대화') }}</div>
      <h1>{{ $t('쪽지함') }}</h1>
    </div>
  </div>

  <div class="grid-wrap messages-wrap messages-login" v-if="!authState.user">
    <p>{{ $t('로그인 필요') }}</p>
    <button type="button" class="btn-primary" @click="signIn">{{ $t('로그인') }}</button>
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
          <UserAvatar :src="c.avatar" :name="c.withName" :size="34" :user-id="c.otherId" />
          <div class="conv-row-body">
            <div class="conv-row-top">
              <span class="conv-name">{{ c.withName }}</span>
              <span class="conv-date">{{ lastMessageOf(c)?.date }}</span>
            </div>
            <div class="conv-preview">{{ previewText(lastMessageOf(c)?.text) }}</div>
          </div>
        </button>
        <div class="empty-state" v-if="!messagesState.conversations.length">{{ $t('쪽지 없음 (판매글의 "쪽지 보내기"로 시작)') }}</div>
      </div>

      <div class="conv-thread" v-if="activeConversation">
        <div class="conv-thread-header">
          <div class="conv-thread-who">
            <UserAvatar :src="activeConversation.avatar" :name="activeConversation.withName" :size="34" :user-id="activeConversation.otherId" />
            <span><router-link v-if="activeConversation.otherId" :to="'/users/' + activeConversation.otherId" class="user-link conv-profile-link">{{ activeConversation.withName }}</router-link><template v-else>{{ activeConversation.withName }}</template>{{ $t('님과의 대화') }}</span>
          </div>
          <button type="button" class="conv-leave" @click="leave">{{ $t('나가기') }}</button>
        </div>
        <div class="conv-thread-body" ref="bodyEl" @scroll="onScroll">
          <div
            class="conv-bubble" v-for="m in activeConversation.messages" :key="m.id"
            :class="m.from === 'me' ? 'mine' : 'theirs'"
          >
            <router-link v-if="splitPostTag(m.text).postId" :to="`/trade/${splitPostTag(m.text).postId}`" class="conv-post-chip">
              <span class="conv-post-label">{{ $t('판매글 문의') }}</span>{{ nameText(splitPostTag(m.text).name) }} →
            </router-link>
            <div class="conv-bubble-text" v-if="splitPostTag(m.text).rest">{{ splitPostTag(m.text).rest }}</div>
            <div class="conv-bubble-date">
              <span class="conv-unread" v-if="m.from === 'me' && !m.readAt" :title="$t('상대가 아직 안 읽음')">1</span>
              {{ m.date }}
              <button type="button" class="conv-del" @click="removeMessage(m)" :aria-label="$t('내 화면에서 쪽지 삭제')">{{ $t('삭제') }}</button>
            </div>
          </div>
        </div>
        <div class="conv-attached" v-if="attachedPost">
          <span class="conv-attached-icon" :class="postRarity(attachedPost)"><img v-if="iconUrl(postIconKey(attachedPost))" :src="iconUrl(postIconKey(attachedPost))" alt="" /></span>
          <span class="conv-attached-body">
            <small>{{ $t('이 판매글 문의 - 보내는 메시지에 링크로 붙음') }}</small>
            <router-link :to="`/trade/${attachedPost.id}`">{{ postName(attachedPost) }}</router-link>
            <small>{{ countText(attachedPost.amountLabel) }} · {{ priceText(attachedPost) }}</small>
          </span>
          <button type="button" class="conv-attached-x" :aria-label="$t('판매글 떼기')" @click="detachPost">✕</button>
        </div>
        <div class="conv-thread-input">
          <input
            type="text" v-model="draft" :placeholder="$t('메시지')"
            class="write-input" @keydown.enter.prevent="submitMessage"
          />
          <button type="button" class="btn-primary conv-send-btn" @click="submitMessage">{{ $t('보내기') }}</button>
        </div>
        <div class="send-error" v-if="sendError">{{ sendError }}</div>
      </div>
      <div class="conv-thread conv-thread-empty" v-else>{{ $t('대화 선택') }}</div>
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
.conv-row{border:1px solid transparent; position:relative;}
.conv-row.active{background:rgba(200,163,77,0.1); border-color:var(--gold-dim);}
.conv-row.active::before{content:''; position:absolute; left:-1px; top:10px; bottom:10px; width:3px; border-radius:3px; background:var(--gold);}
.conv-row.active .conv-name{color:var(--gold); font-weight:700;}
.conv-thread-who{display:flex; align-items:center; gap:10px; min-width:0;}
.conv-thread-who .user-link{color:var(--gold);}
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
.conv-attached{display:flex; align-items:center; gap:10px; margin:0 0 8px; padding:9px 12px; background:var(--panel-2); border:1px solid var(--gold-dim); border-radius:12px;}
.conv-attached-icon{width:34px; height:34px; flex:none; display:flex; align-items:center; justify-content:center; background:var(--panel); border:1px solid var(--border); border-radius:8px;}
.conv-attached-icon img{max-width:100%; max-height:100%; image-rendering:pixelated;}
.conv-attached-body{display:flex; flex-direction:column; gap:1px; min-width:0; flex:1;}
.conv-attached-body a{color:var(--gold); font-size:13.5px; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.conv-attached-body small{font-size:11px; color:var(--text-dim); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.conv-attached-x{color:var(--text-dim); padding:4px 8px; flex:none;}
.conv-attached-x:hover{color:var(--text);}
.conv-post-chip{display:inline-flex; align-items:center; gap:6px; margin-bottom:4px; padding:5px 10px; border-radius:10px; background:rgba(200,163,77,0.12); border:1px solid var(--gold-dim); color:var(--gold); font-size:12.5px; font-weight:600;}
.conv-post-chip:hover{background:rgba(200,163,77,0.2);}
.conv-post-label{font-size:10.5px; color:var(--text-dim); font-weight:400;}
</style>
