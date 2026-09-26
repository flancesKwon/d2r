<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  notificationsState,
  unreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
} from '../notificationsStore.js'
import { unreadMessageCount } from '../messagesStore.js'
import { activeDealCount } from '../dealsStore.js'

const router = useRouter()
const showDropdown = ref(false)

function toggleDropdown() {
  showDropdown.value = !showDropdown.value
}
function hideDropdownSoon() {
  window.setTimeout(() => (showDropdown.value = false), 150)
}
function openNotification(n) {
  markNotificationRead(n.id)
  showDropdown.value = false
  if (n.link) router.push(n.link)
}
</script>

<template>
  <div class="header-notif-wrap">
    <button
      type="button" class="header-icon-btn" title="알림"
      @click="toggleDropdown" @blur="hideDropdownSoon"
    >
      <span>🔔</span>
      <span class="header-icon-badge" v-if="unreadNotificationCount > 0">{{ unreadNotificationCount > 9 ? '9+' : unreadNotificationCount }}</span>
    </button>
    <div class="header-notif-dropdown" v-if="showDropdown">
      <div class="header-notif-top">
        <span>알림</span>
        <button type="button" class="header-notif-readall" @mousedown.prevent="markAllNotificationsRead">모두 읽음</button>
      </div>
      <div class="header-notif-list">
        <button
          type="button" class="header-notif-item" v-for="n in notificationsState.items" :key="n.id"
          :class="{ unread: !n.read }" @mousedown.prevent="openNotification(n)"
        >
          <span class="header-notif-dot" v-if="!n.read"></span>
          <span class="header-notif-text">{{ n.text }}</span>
          <span class="header-notif-date">{{ n.date }}</span>
        </button>
        <div class="header-notif-empty" v-if="!notificationsState.items.length">알림이 없어요</div>
      </div>
    </div>
    <router-link to="/messages" class="header-icon-btn" title="쪽지함">
      <span>✉️</span>
      <span class="header-icon-badge" v-if="unreadMessageCount > 0">{{ unreadMessageCount }}</span>
    </router-link>
    <router-link to="/deals" class="header-icon-btn" title="거래중인 품목">
      <span>🤝</span>
      <span class="header-icon-badge" v-if="activeDealCount > 0">{{ activeDealCount > 9 ? '9+' : activeDealCount }}</span>
    </router-link>
    <router-link to="/mypage" class="header-icon-btn" title="마이페이지">
      <span>👤</span>
    </router-link>
  </div>
</template>

<style scoped>
.header-notif-wrap{display:flex; align-items:center; gap:6px; position:relative;}
.header-icon-btn{
  position:relative; font-size:16px; width:34px; height:34px; display:flex; align-items:center;
  justify-content:center; color:var(--text-dim); border-radius:10px;
}
.header-icon-btn:hover{background:var(--panel-2); color:var(--text);}
.header-icon-badge{
  position:absolute; top:-2px; right:-2px; min-width:15px; height:15px; padding:0 3px; border-radius:999px;
  background:var(--blood); color:#fff; font-size:9px; font-weight:700; display:flex; align-items:center;
  justify-content:center; line-height:1;
}
.header-notif-dropdown{
  position:absolute; top:calc(100% + 8px); right:0; width:320px; z-index:30; max-height:400px; overflow-y:auto;
  background:var(--panel-2); border:1px solid var(--border); border-radius:14px; box-shadow:0 14px 30px -8px rgba(0,0,0,0.6);
}
.header-notif-top{
  display:flex; align-items:center; justify-content:space-between; padding:14px 16px; font-size:13px;
  color:var(--text); border-bottom:1px solid var(--border-soft); font-weight:600;
}
.header-notif-readall{font-size:11px; color:var(--gold-dim); font-weight:400;}
.header-notif-readall:hover{color:var(--gold);}
.header-notif-list{display:flex; flex-direction:column;}
.header-notif-item{
  display:flex; align-items:center; gap:8px; width:100%; text-align:left; padding:12px 16px;
  border-bottom:1px solid var(--border-soft); font-family:'Noto Sans KR', sans-serif;
}
.header-notif-item:last-child{border-bottom:none;}
.header-notif-item:hover{background:rgba(255,255,255,0.04);}
.header-notif-dot{width:6px; height:6px; border-radius:999px; background:var(--gold); flex:none;}
.header-notif-item.unread .header-notif-text{color:var(--text); font-weight:600;}
.header-notif-text{flex:1; font-size:12.5px; color:var(--text-muted); line-height:1.5;}
.header-notif-date{font-size:10.5px; color:var(--text-dim); flex:none;}
.header-notif-empty{padding:24px 16px; text-align:center; font-size:12px; color:var(--text-dim);}
</style>
