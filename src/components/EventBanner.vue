<script setup>
// 이벤트 배너 - 진행 중이면 남은 시간, 곧 시작이면 시작 시각, 끝났으면 추첨 대기 / 당첨자 발표 (거래게시판·메인)
import { computed, onMounted } from 'vue'
import { eventState, loadCurrentEvent, phaseOf, fmtCountdown, fmtEventTime, PHASE_KO } from '../eventStore.js'
import { useNow } from '../useNow.js'

const now = useNow(1000)
onMounted(() => loadCurrentEvent())
const ev = computed(() => eventState.current)
const phase = computed(() => phaseOf(ev.value, now.value))
// 곧 시작은 하루 전부터만
const show = computed(() => ev.value && (phase.value !== 'upcoming' || new Date(ev.value.startsAt).getTime() - now.value < 86400000))
const target = computed(() => ev.value && ({ upcoming: ev.value.startsAt, live: ev.value.endsAt, review: ev.value.drawAt })[phase.value])
const left = computed(() => (target.value ? fmtCountdown(new Date(target.value).getTime() - now.value) : ''))
const firstPrize = computed(() => ev.value?.prizes?.[0])
</script>

<template>
  <router-link v-if="show" :to="`/event/${ev.id}`" class="event-banner" :class="phase">
    <span class="eb-badge">{{ phase === 'upcoming' ? '곧 시작' : PHASE_KO[phase] }}</span>
    <span class="eb-title">🎁 {{ ev.title }}</span>
    <span class="eb-desc" v-if="phase === 'live'">판매글 올리면 자동 응모 (1인 최대 {{ ev.ticketCap }}장)<template v-if="firstPrize"> · {{ firstPrize.label }} {{ firstPrize.item }}</template></span>
    <span class="eb-desc" v-else-if="phase === 'upcoming'">{{ fmtEventTime(ev.startsAt) }} 시작</span>
    <span class="eb-desc" v-else-if="phase === 'review'">{{ fmtEventTime(ev.drawAt) }} 공개 난수로 추첨</span>
    <span class="eb-desc" v-else-if="phase === 'ready'">곧 추첨 - 이벤트 페이지에서 같이 보기</span>
    <span class="eb-desc" v-else>당첨자 확인하기</span>
    <span class="eb-time" v-if="left">{{ { live: '남은 시간', upcoming: '시작까지', review: '추첨까지' }[phase] }} <b>{{ left }}</b></span>
    <span class="eb-go">자세히 →</span>
  </router-link>
</template>

<style scoped>
.event-banner{
  display:flex; align-items:center; gap:10px 14px; flex-wrap:wrap; padding:12px 16px; margin-bottom:14px;
  border:1px solid var(--gold-dim); border-radius:12px; background:linear-gradient(90deg, rgba(199,179,119,.14), rgba(199,179,119,.03));
  color:var(--text); text-decoration:none; font-size:13px;
}
.event-banner:hover{border-color:var(--gold);}
.event-banner.review, .event-banner.ready, .event-banner.announced{border-color:var(--border); background:var(--panel);}
.eb-badge{font-size:11px; font-weight:700; padding:2px 9px; border-radius:999px; background:var(--gold); color:#1a1408;}
.event-banner.upcoming .eb-badge{background:transparent; color:var(--gold); border:1px solid var(--gold-dim);}
.event-banner.review .eb-badge, .event-banner.ready .eb-badge, .event-banner.announced .eb-badge{background:var(--panel-2); color:var(--text-muted); border:1px solid var(--border);}
.eb-title{font-weight:700; color:var(--gold);}
.eb-desc{color:var(--text-muted);}
.eb-time{margin-left:auto; color:var(--text-muted); font-variant-numeric:tabular-nums;}
.eb-time b{color:var(--gold); font-size:15px;}
.eb-go{color:var(--text-dim); font-size:12px;}
@media (max-width:640px){
  .eb-time{margin-left:0;}
}
</style>
