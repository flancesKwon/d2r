<script setup>
// 이벤트 배너 (거래게시판·메인·판매글 등록)
//  mode="compact": 한 줄 (메인)
//  mode="big": 진행 중이면 큰 카드 - 남은 시간·상품·내 응모권·등록 버튼 (거래게시판), 다른 단계는 한 줄
//  mode="post": 진행 중일 때만 "이 글을 올리면 응모권 +1 (지금 N/5장)" (판매글 등록)
import { computed, onMounted, ref, watch } from 'vue'
import { supabase } from '../supabase.js'
import { authState } from '../profileStore.js'
import { eventState, loadCurrentEvent, phaseOf, fmtCountdown, fmtEventTime, PHASE_KO } from '../eventStore.js'
import { useNow } from '../useNow.js'

const props = defineProps({ mode: { type: String, default: 'compact' } })
const now = useNow(1000)
onMounted(() => loadCurrentEvent())
const ev = computed(() => eventState.current)
const phase = computed(() => phaseOf(ev.value, now.value))
// 곧 시작은 하루 전부터만
const show = computed(() => ev.value && (phase.value !== 'upcoming' || new Date(ev.value.startsAt).getTime() - now.value < 86400000))
const target = computed(() => ev.value && ({ upcoming: ev.value.startsAt, live: ev.value.endsAt, review: ev.value.drawAt })[phase.value])
const left = computed(() => (target.value ? fmtCountdown(new Date(target.value).getTime() - now.value) : ''))
const firstPrize = computed(() => ev.value?.prizes?.[0])

// 내 응모권 수 (진행 중, 로그인했을 때) - 30초마다
const myTickets = ref(null)
let lastAt = 0
async function loadMine() {
  if (!supabase || !ev.value || !authState.user || phase.value !== 'live') { myTickets.value = null; return }
  const { count, error } = await supabase.from('tb_event_entry').select('id', { count: 'exact', head: true })
    .eq('event_id', ev.value.id).eq('user_id', authState.user.id).eq('excluded', false)
  myTickets.value = error ? null : count
}
watch([ev, () => authState.user?.id, phase], loadMine, { immediate: true })
watch(now, (t) => { if (phase.value === 'live' && props.mode !== 'compact' && t - lastAt > 30000) { lastAt = t; loadMine() } })
const full = computed(() => myTickets.value !== null && ev.value && myTickets.value >= ev.value.ticketCap)
</script>

<template>
  <!-- 판매글 등록 화면 -->
  <router-link v-if="mode === 'post' && show && phase === 'live'" :to="`/event/${ev.id}`" class="eb-post">
    <span class="eb-gift" aria-hidden="true">🎁</span>
    <span v-if="full"><b>{{ ev.title }}</b> {{ $t('응모권 최대 {n}장 다 채움', { n: ev.ticketCap }) }}</span>
    <span v-else><b>{{ ev.title }}</b> {{ $t('진행 중 · 이 판매글을 올리면') }} <b class="eb-plus">{{ $t('응모권 +1') }}</b>
      <template v-if="myTickets !== null"> ({{ $t('지금') }} {{ myTickets }}/{{ ev.ticketCap }})</template></span>
    <span class="eb-time">{{ $t('남은 시간') }} <b>{{ left }}</b></span>
  </router-link>

  <!-- 거래게시판 진행 중: 큰 카드 -->
  <div v-else-if="mode === 'big' && show && phase === 'live'" class="eb-big">
    <div class="eb-big-main">
      <div class="eb-big-badge"><span class="eb-dot"></span>{{ $t('이벤트 진행 중') }}</div>
      <h2 class="eb-big-title">🎁 {{ ev.title }}</h2>
      <p class="eb-big-desc">{{ $t('지금') }} <b>{{ $t('판매글을 올리면 자동 응모') }}</b> · {{ $t('판매글 1개당 응모권 1장, 1인 최대 {n}장', { n: ev.ticketCap }) }} · {{ $t('{time} 공개 추첨', { time: fmtEventTime(ev.drawAt) }) }}</p>
      <div class="eb-prizes">
        <span class="eb-prize" v-for="p in ev.prizes" :key="p.rank"><em>{{ p.label }}</em> {{ p.item }}</span>
      </div>
    </div>
    <div class="eb-big-side">
      <div class="eb-clock">
        <span>{{ $t('종료까지') }}</span>
        <b>{{ left }}</b>
      </div>
      <div class="eb-mine" v-if="myTickets !== null">{{ $t('내 응모권') }} <b>{{ myTickets }}</b> / {{ ev.ticketCap }}</div>
      <div class="eb-actions">
        <router-link to="/trade/new" class="eb-cta" v-if="!full">{{ $t('판매글 올리고 응모하기') }}</router-link>
        <router-link :to="`/event/${ev.id}`" class="eb-more">{{ $t('응모 목록·자세히 →') }}</router-link>
      </div>
    </div>
  </div>

  <!-- 한 줄 -->
  <router-link v-else-if="mode !== 'post' && show" :to="`/event/${ev.id}`" class="event-banner" :class="phase">
    <span class="eb-badge">{{ $t(phase === 'upcoming' ? '곧 시작' : PHASE_KO[phase]) }}</span>
    <span class="eb-title">🎁 {{ ev.title }}</span>
    <span class="eb-desc" v-if="phase === 'live'">{{ $t('판매글 올리면 자동 응모 (1인 최대 {n}장)', { n: ev.ticketCap }) }}<template v-if="firstPrize"> · {{ firstPrize.label }} {{ firstPrize.item }}</template></span>
    <span class="eb-desc" v-else-if="phase === 'upcoming'">{{ $t('{time} 시작', { time: fmtEventTime(ev.startsAt) }) }}<template v-if="firstPrize"> · {{ firstPrize.label }} {{ firstPrize.item }}</template></span>
    <span class="eb-desc" v-else-if="phase === 'review'">{{ $t('{time} 공개 난수로 추첨', { time: fmtEventTime(ev.drawAt) }) }}</span>
    <span class="eb-desc" v-else-if="phase === 'ready'">{{ $t('곧 추첨 - 이벤트 페이지에서 같이 보기') }}</span>
    <span class="eb-desc" v-else>{{ $t('당첨자 확인하기') }}</span>
    <span class="eb-time" v-if="left">{{ $t({ live: '남은 시간', upcoming: '시작까지', review: '추첨까지' }[phase]) }} <b>{{ left }}</b></span>
    <span class="eb-go">{{ $t('자세히 →') }}</span>
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

/* 큰 카드 */
.eb-big{
  position:relative; overflow:hidden; display:flex; gap:20px 28px; flex-wrap:wrap; align-items:stretch;
  padding:22px 24px; margin-bottom:18px; border-radius:16px; border:1px solid var(--gold);
  background:radial-gradient(120% 140% at 0% 0%, rgba(199,179,119,.24), rgba(199,179,119,.04) 55%, transparent), var(--panel);
  box-shadow:0 0 0 1px rgba(199,179,119,.15), 0 10px 40px -12px rgba(199,179,119,.35);
  animation:eb-glow 2.6s ease-in-out infinite;
}
@keyframes eb-glow{50%{box-shadow:0 0 0 1px rgba(199,179,119,.3), 0 10px 46px -8px rgba(199,179,119,.55);}}
.eb-big-main{flex:1 1 380px; min-width:0; display:flex; flex-direction:column; gap:8px;}
.eb-big-badge{align-self:flex-start; display:inline-flex; align-items:center; gap:7px; font-size:12px; font-weight:700; color:#1a1408; background:var(--gold); padding:3px 11px; border-radius:999px;}
.eb-dot{width:7px; height:7px; border-radius:999px; background:#c0392b; animation:eb-blink 1.2s infinite;}
@keyframes eb-blink{50%{opacity:.25;}}
.eb-big-title{margin:2px 0 0; font-size:22px; color:var(--gold); font-family:'Noto Serif KR', serif;}
.eb-big-desc{margin:0; font-size:13.5px; color:var(--text-muted); line-height:1.6;}
.eb-big-desc b{color:var(--text);}
.eb-prizes{display:flex; flex-wrap:wrap; gap:6px; margin-top:4px;}
.eb-prize{font-size:12.5px; color:var(--text); border:1px solid var(--gold-dim); background:rgba(0,0,0,.25); border-radius:999px; padding:4px 12px;}
.eb-prize em{font-style:normal; color:var(--gold); font-weight:700; margin-right:4px;}
.eb-big-side{flex:0 1 260px; display:flex; flex-direction:column; justify-content:center; gap:10px; align-items:stretch;}
.eb-clock{display:flex; flex-direction:column; align-items:center; padding:10px; border-radius:12px; background:#0d0b09; border:1px solid var(--gold-dim);}
.eb-clock span{font-size:11.5px; color:var(--text-dim);}
.eb-clock b{font-size:30px; color:var(--gold); font-variant-numeric:tabular-nums; letter-spacing:.02em;}
.eb-mine{text-align:center; font-size:13px; color:var(--text-muted);}
.eb-mine b{font-size:18px; color:var(--gold);}
.eb-actions{display:flex; flex-direction:column; gap:6px;}
.eb-cta{text-align:center; font-size:14px; font-weight:700; color:#1a1408; background:var(--gold); padding:10px 14px; border-radius:10px; text-decoration:none;}
.eb-cta:hover{filter:brightness(1.08);}
.eb-more{text-align:center; font-size:12.5px; color:var(--text-muted); text-decoration:none;}
.eb-more:hover{color:var(--gold);}

/* 판매글 등록 */
.eb-post{
  display:flex; align-items:center; gap:8px 12px; flex-wrap:wrap; padding:11px 14px; margin-bottom:14px; border-radius:12px;
  border:1px solid var(--gold); background:linear-gradient(90deg, rgba(199,179,119,.18), rgba(199,179,119,.04)); color:var(--text-muted); font-size:13px; text-decoration:none;
}
.eb-post b{color:var(--gold);}
.eb-plus{font-size:14px;}
.eb-gift{font-size:18px;}
@media (max-width:640px){
  .eb-time{margin-left:0;}
  .eb-big{padding:18px 16px;}
  .eb-big-title{font-size:19px;}
  .eb-big-side{flex-basis:100%;}
}
@media (prefers-reduced-motion: reduce){ .eb-big, .eb-dot{animation:none;} }
</style>
