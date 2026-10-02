<script setup>
import { ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  notificationsState,
  unreadNotificationCount,
  markNotificationRead,
  markNotificationsReadFor,
  markAllNotificationsRead,
} from '../notificationsStore.js'
import { unreadMessageCount } from '../messagesStore.js'
import { activeDealCount } from '../dealsStore.js'
import { authState, signIn, signOut, isStaff } from '../profileStore.js'
import { supabase } from '../supabase.js'
import { avatarSrc, presetOf } from '../avatars.js'
import { soundState, setSound } from '../notifySound.js'

const router = useRouter()
const route = useRoute()
const showDropdown = ref(false)
// 알림이 가리키는 화면에 들어와 있으면 그 알림은 읽음 (새 알림을 받아 왔을 때도 다시 확인)
watch(() => [route.path, notificationsState.items.length], () => markNotificationsReadFor(route.path).catch(() => {}), { immediate: true })

function toggleDropdown() {
  showDropdown.value = !showDropdown.value
}
function hideDropdownSoon() {
  window.setTimeout(() => (showDropdown.value = false), 150)
}
// 프로필 메뉴 (마이페이지 · 로그아웃)
const showMenu = ref(false)
const hideMenuSoon = () => window.setTimeout(() => (showMenu.value = false), 150)
async function logout() {
  showMenu.value = false
  await signOut()
  router.push('/')
}
function openNotification(n) {
  markNotificationRead(n.id)
  showDropdown.value = false
  if (n.link) router.push(n.link)
}
</script>

<template>
  <div class="header-notif-wrap">
    <template v-if="authState.user">
    <button
      type="button" class="header-icon-btn" title="알림"
      @click="toggleDropdown" @blur="hideDropdownSoon"
    >
      <svg viewBox="0 0 24 24" class="hi" aria-hidden="true"><path d="M6 16V11a6 6 0 0112 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 004 0"/></svg>
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
        <div class="header-notif-empty" v-if="!notificationsState.items.length">알림 없음</div>
      </div>
    </div>
    <router-link to="/messages" class="header-icon-btn" title="쪽지함">
      <svg viewBox="0 0 24 24" class="hi" aria-hidden="true"><rect x="3.5" y="6" width="17" height="12" rx="2"/><path d="M4 7l8 6 8-6"/></svg>
      <span class="header-icon-badge" v-if="unreadMessageCount > 0">{{ unreadMessageCount }}</span>
    </router-link>
    <router-link to="/deals" class="header-icon-btn" title="거래중인 품목">
      <svg viewBox="0 0 24 24" class="hi" aria-hidden="true"><path d="M7 7h10l3 3-3 3M17 17H7l-3-3 3-3"/></svg>
      <span class="header-icon-badge" v-if="activeDealCount > 0">{{ activeDealCount > 9 ? '9+' : activeDealCount }}</span>
    </router-link>
    <div class="header-profile">
      <button type="button" class="header-avatar" :title="authState.profile?.nickname || '내 정보'" @click="showMenu = !showMenu" @blur="hideMenuSoon">
        <img v-if="avatarSrc(authState.profile?.avatar_url)" :src="avatarSrc(authState.profile?.avatar_url)" :class="{ item: presetOf(authState.profile?.avatar_url)?.item }" alt="" />
        <svg v-else viewBox="0 0 24 24" class="hi" aria-hidden="true"><circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c1-3.5 4-5 7-5s6 1.5 7 5"/></svg>
      </button>
      <div class="header-profile-menu" v-if="showMenu">
        <div class="header-profile-name">{{ authState.profile?.nickname }}</div>
        <router-link to="/mypage" class="header-profile-link" @mousedown.prevent="showMenu = false; router.push('/mypage')">마이페이지</router-link>
        <router-link to="/admin" class="header-profile-link" v-if="isStaff()" @mousedown.prevent="showMenu = false; router.push('/admin')">관리자</router-link>
        <button type="button" class="header-profile-link" @mousedown.prevent="setSound(!soundState.on)">알림 소리 {{ soundState.on ? '끄기' : '켜기' }}</button>
        <button type="button" class="header-profile-link" @mousedown.prevent="logout">로그아웃</button>
      </div>
    </div>
    </template>
    <button type="button" class="header-login" v-else-if="supabase" @click="signIn">
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8.5" r="3.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M5 20c1-3.5 4-5 7-5s6 1.5 7 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
      <span>로그인</span>
    </button>
  </div>
</template>

<style scoped>
.header-notif-wrap{display:flex; align-items:center; gap:6px; position:relative;}
.header-icon-btn{
  position:relative; font-size:16px; width:34px; height:34px; display:flex; align-items:center;
  justify-content:center; color:var(--text-dim); border-radius:10px;
}
.hi{width:18px; height:18px; fill:none; stroke:currentColor; stroke-width:1.7; stroke-linecap:round; stroke-linejoin:round;}
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
.header-profile{position:relative;}
.header-avatar{width:34px; height:34px; border-radius:999px; overflow:hidden; display:flex; align-items:center; justify-content:center; color:var(--text-dim); border:1px solid var(--border);}
.header-avatar img{width:100%; height:100%; object-fit:cover;}
.header-avatar img.item{width:72%; height:72%; object-fit:contain; image-rendering:pixelated;}
.header-avatar:hover{border-color:var(--gold-dim);}
.header-profile-menu{
  position:absolute; top:calc(100% + 8px); right:0; min-width:160px; z-index:30; padding:6px;
  background:var(--panel-2); border:1px solid var(--border); border-radius:12px; box-shadow:0 14px 30px -8px rgba(0,0,0,0.6);
  display:flex; flex-direction:column;
}
.header-profile-name{padding:8px 10px; font-size:12.5px; font-weight:600; color:var(--gold); border-bottom:1px solid var(--border-soft); margin-bottom:4px;}
.header-profile-link{padding:8px 10px; font-size:13px; color:var(--text-muted); border-radius:8px; text-align:left;}
.header-profile-link:hover{background:rgba(255,255,255,0.05); color:var(--text);}
.header-login{display:flex; align-items:center; gap:6px; padding:7px 12px; border-radius:10px; background:var(--gold); color:#1a1511; font-size:12.5px; font-weight:600; white-space:nowrap;}
.header-login svg{width:16px; height:16px;}
.header-login:hover{filter:brightness(1.08);}
@media (max-width:560px){ .header-login span{display:none;} .header-login{padding:8px;} }
</style>
