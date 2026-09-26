<script setup>
import HeaderNotifications from '../components/HeaderNotifications.vue'
import LogoMark from '../components/LogoMark.vue'
import { ref, computed } from 'vue'
import {
  messagesState,
  lastMessageOf,
  isConversationRead,
  markConversationOpened,
  sendMessage,
} from '../messagesStore.js'

const activeId = ref(messagesState.conversations[0]?.id || null)
const activeConversation = computed(() => messagesState.conversations.find((c) => c.id === activeId.value))
const draft = ref('')

function openConversation(id) {
  activeId.value = id
  markConversationOpened(id)
}
if (activeId.value) markConversationOpened(activeId.value)

function submitMessage() {
  if (!draft.value.trim() || !activeId.value) return
  sendMessage(activeId.value, draft.value)
  draft.value = ''
}
</script>

<template>
  <div class="items-page messages-page">
  <header>
    <div class="logo">
      <router-link to="/" style="display: flex; align-items: center; gap: 8px; color: inherit">
        <LogoMark />디아허브
      </router-link>
    </div>
    <div class="crumb"><router-link to="/">메인</router-link> / <b>쪽지함</b></div>
    <HeaderNotifications />
  </header>

  <div class="patch-hero">
    <div class="patch-hero-inner">
      <div class="eyebrow">1:1 대화</div>
      <h1>쪽지함</h1>
      <p>거래·문의 상대와 주고받은 쪽지를 한 곳에서 확인하세요. (미리보기 - 이 브라우저에서만 저장돼요)</p>
    </div>
  </div>

  <div class="grid-wrap messages-wrap">
    <div class="messages-layout">
      <div class="conv-list">
        <button
          type="button" class="conv-row" v-for="c in messagesState.conversations" :key="c.id"
          :class="{ active: c.id === activeId, unread: !isConversationRead(c) }"
          @click="openConversation(c.id)"
        >
          <span class="conv-dot" v-if="!isConversationRead(c)"></span>
          <div class="conv-row-body">
            <div class="conv-row-top">
              <span class="conv-name">{{ c.withName }}</span>
              <span class="conv-date">{{ lastMessageOf(c)?.date }}</span>
            </div>
            <div class="conv-preview">{{ lastMessageOf(c)?.text }}</div>
          </div>
        </button>
        <div class="empty-state" v-if="!messagesState.conversations.length">쪽지함이 비어있어요</div>
      </div>

      <div class="conv-thread" v-if="activeConversation">
        <div class="conv-thread-header">{{ activeConversation.withName }}</div>
        <div class="conv-thread-body">
          <div
            class="conv-bubble" v-for="(m, i) in activeConversation.messages" :key="i"
            :class="m.from === 'me' ? 'mine' : 'theirs'"
          >
            <div class="conv-bubble-text">{{ m.text }}</div>
            <div class="conv-bubble-date">{{ m.date }}</div>
          </div>
        </div>
        <div class="conv-thread-input">
          <input
            type="text" v-model="draft" placeholder="메시지를 입력하세요"
            class="write-input" @keydown.enter.prevent="submitMessage"
          />
          <button type="button" class="btn-primary conv-send-btn" @click="submitMessage">보내기</button>
        </div>
      </div>
      <div class="conv-thread conv-thread-empty" v-else>대화를 선택해주세요</div>
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
  display:flex; flex-direction:column; gap:16px; min-height:480px;
}
.conv-thread-empty{align-items:center; justify-content:center; color:var(--text-dim); font-size:13px;}
.conv-thread-header{font-family:'Noto Serif KR', serif; font-weight:700; font-size:15px; border-bottom:1px solid var(--border-soft); padding-bottom:14px;}
.conv-thread-body{flex:1; display:flex; flex-direction:column; gap:10px; overflow-y:auto;}
.conv-bubble{max-width:70%; display:flex; flex-direction:column; gap:4px;}
.conv-bubble.theirs{align-self:flex-start;}
.conv-bubble.mine{align-self:flex-end; align-items:flex-end;}
.conv-bubble-text{
  font-size:13px; padding:10px 14px; border-radius:14px; line-height:1.6; background:var(--panel-2); color:var(--text);
}
.conv-bubble.mine .conv-bubble-text{background:var(--gold-dim); color:#1c1712;}
.conv-bubble-date{font-size:10px; color:var(--text-dim);}
.conv-thread-input{display:flex; gap:8px;}
.conv-thread-input .write-input{flex:1;}
.write-input{
  background:var(--panel-2); border:1px solid var(--border); color:var(--text); font-size:13px;
  padding:11px 14px; font-family:'Noto Sans KR', sans-serif; border-radius:10px;
}
.conv-send-btn{padding:11px 20px; font-size:13px; border-radius:10px;}
</style>
