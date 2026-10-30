<script setup>
// 방문자·열람자 목록 한 줄씩 (운영진 화면 공통) - 회원은 닉네임, 비회원은 브라우저 번호 앞 8자리
// 같은 IP(해시 앞 6자리)면 같은 사람일 가능성이 높음
defineProps({ rows: { type: Array, required: true } })
defineEmits(['pick'])
const browser = (ua) => {
  if (!ua) return '알 수 없음'
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : ''
  const b = /Edg\//.test(ua) ? 'Edge' : /OPR\/|Opera/.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : ''
  return [os, b].filter(Boolean).join(' ') || ua.slice(0, 30)
}
</script>

<template>
  <div class="vr-list">
    <div class="vr-row" v-for="r in rows" :key="r.key" :class="{ bot: r.bot, pickable: r.pick }" @click="r.pick && $emit('pick', r.pick)">
      <span class="vr-who" :class="{ member: r.member }">{{ r.who }}</span>
      <span class="vr-tag bot" v-if="r.bot" :title="r.ua || ''">봇</span>
      <span class="vr-tag" :title="r.ua || ''">{{ browser(r.ua) }}</span>
      <span class="vr-ip" title="같은 값이면 같은 IP">IP {{ r.ip ? r.ip.slice(0, 6) : '-' }}</span>
      <span class="vr-note">{{ r.note }}</span>
      <span class="vr-when">{{ r.when }}</span>
    </div>
    <div class="vr-none" v-if="!rows.length">기록 없음</div>
  </div>
</template>

<style scoped>
.vr-list{display:flex; flex-direction:column; gap:4px;}
.vr-row{display:flex; align-items:center; gap:8px; flex-wrap:wrap; padding:7px 10px; background:var(--panel-2); border:1px solid var(--border-soft); border-radius:8px; font-size:12.5px;}
.vr-row.bot{opacity:.6;}
.vr-row.pickable{cursor:pointer;}
.vr-row.pickable:hover{border-color:var(--gold);}
.vr-who{font-weight:600; color:var(--text-muted); min-width:84px;}
.vr-who.member{color:var(--gold);}
.vr-tag{font-size:11px; color:var(--text-dim); border:1px solid var(--border); border-radius:4px; padding:0 6px;}
.vr-tag.bot{color:#e0775f; border-color:#e0775f;}
.vr-ip{font-size:11px; color:var(--text-dim); font-family:monospace;}
.vr-note{flex:1; min-width:0; color:var(--text-dim); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.vr-when{font-size:11px; color:var(--text-dim); white-space:nowrap;}
.vr-none{font-size:12.5px; color:var(--text-dim);}
</style>
