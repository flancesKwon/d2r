<script setup>
// 운영진 전용: 지금 접속 중인 회원 목록 (헤더 시계 옆) - 실시간 접속 표시(src/presence.js)의 회원들
// 사진을 누르면 프로필 카드. 일반 회원에겐 버튼 자체가 안 보임
import { ref, computed, watch } from 'vue'
import { supabase } from '../supabase.js'
import { isStaff, ROLE_LABEL } from '../profileStore.js'
import { presenceState } from '../presence.js'
import { openProfileCard } from '../profileCard.js'
import UserAvatar from './UserAvatar.vue'

// inline: 좁은 화면의 펼침 메뉴 안에 버튼 없이 목록으로
const props = defineProps({ inline: { type: Boolean, default: false } })

const open = ref(false)
const profiles = ref(new Map())
const ids = computed(() => [...presenceState.online])

// 접속자 프로필(닉네임·사진)은 처음 보는 사람만 받아 둠
async function loadMissing() {
  const missing = ids.value.filter((id) => !profiles.value.has(id))
  if (!missing.length || !supabase) return
  const { data } = await supabase.from('tb_profile').select('id, nickname, avatar_url, role').in('id', missing)
  const next = new Map(profiles.value)
  for (const p of data || []) next.set(p.id, p)
  profiles.value = next
}
watch([ids, open], () => { if ((open.value || props.inline) && isStaff()) loadMissing() }, { immediate: true })

const list = computed(() =>
  ids.value
    .map((id) => profiles.value.get(id) || { id, nickname: '…', avatar_url: null, role: 'user' })
    .sort((a, b) => a.nickname.localeCompare(b.nickname, 'ko'))
)
function pick(u) {
  open.value = false
  openProfileCard(u.id)
}
const hideSoon = () => window.setTimeout(() => (open.value = false), 150)
</script>

<template>
  <div class="online-inline" v-if="inline && isStaff()">
    <div class="online-top">{{ $t('접속 중 {n}명', { n: ids.length }) }} <small>{{ $t('운영진 전용 · 로그인한 회원만') }}</small></div>
    <div class="online-list inline-list">
      <button type="button" class="online-row" v-for="u in list" :key="u.id" @click="pick(u)">
        <UserAvatar :src="u.avatar_url" :name="u.nickname" :size="22" :user-id="u.id" :clickable="false" />
        <span class="online-name">{{ u.nickname }}</span>
      </button>
      <div class="online-empty" v-if="!list.length">{{ $t('접속 중인 회원 없음') }}</div>
    </div>
  </div>
  <div class="online-wrap" v-else-if="!inline && isStaff()">
    <button type="button" class="online-btn" :aria-expanded="open" :title="$t('지금 접속 중인 회원 (운영진 전용)')" @click="open = !open" @blur="hideSoon">
      <span class="online-dot"></span>{{ ids.length }}
    </button>
    <div class="online-dropdown" v-if="open">
      <div class="online-top">{{ $t('접속 중 {n}명', { n: ids.length }) }} <small>{{ $t('운영진 전용 · 로그인한 회원만') }}</small></div>
      <div class="online-list">
        <button type="button" class="online-row" v-for="u in list" :key="u.id" @mousedown.prevent="pick(u)">
          <UserAvatar :src="u.avatar_url" :name="u.nickname" :size="26" :user-id="u.id" :clickable="false" />
          <span class="online-name">{{ u.nickname }}</span>
          <small v-if="u.role && u.role !== 'user'">{{ ROLE_LABEL[u.role] || u.role }}</small>
        </button>
        <div class="online-empty" v-if="!list.length">{{ $t('접속 중인 회원 없음') }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.online-wrap{position:relative; flex:none;}
.online-btn{display:flex; align-items:center; gap:6px; height:32px; padding:0 10px; border:1px solid var(--border); border-radius:999px; font-size:12.5px; color:var(--text-muted); font-variant-numeric:tabular-nums;}
.online-btn:hover{border-color:var(--gold-dim); color:var(--text);}
.online-dot{width:8px; height:8px; border-radius:999px; background:#3ecf5a; box-shadow:0 0 0 3px rgba(62,207,90,.18);}
.online-dropdown{position:absolute; top:calc(100% + 8px); right:0; width:260px; z-index:30; background:var(--panel-2); border:1px solid var(--border); border-radius:12px; box-shadow:0 14px 34px rgba(0,0,0,.5); padding:6px;}
.online-top{display:flex; flex-direction:column; gap:2px; padding:6px 8px 8px; font-size:13px; color:var(--text); font-weight:600;}
.online-top small{font-size:10.5px; color:var(--text-dim); font-weight:400;}
.online-list{max-height:360px; overflow-y:auto; display:flex; flex-direction:column; gap:2px;}
.online-row{display:flex; align-items:center; gap:8px; padding:6px 8px; border-radius:8px; text-align:left; font-size:13px; color:var(--text-muted);}
.online-row:hover{background:var(--panel); color:var(--text);}
.online-name{flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.online-row small{font-size:10.5px; color:var(--gold-dim); flex:none;}
.online-inline{display:flex; flex-direction:column; gap:4px;}
.online-inline .online-top{padding:0 0 4px; color:var(--gold-dim); font-size:12px;}
.inline-list{flex-direction:row; flex-wrap:wrap; gap:6px; max-height:none;}
.inline-list .online-row{border:1px solid var(--border); border-radius:999px; padding:3px 10px 3px 4px; font-size:12.5px;}
.online-empty{padding:14px 8px; font-size:12px; color:var(--text-dim); text-align:center;}
</style>
