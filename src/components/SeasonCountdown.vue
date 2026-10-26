<script setup>
// 메인 시즌 일정 - 종료까지 카운트다운 + 종료·패치·다음 시즌 오픈 (src/data/ladder.json 의 schedule, 한국 시간)
import { computed, onMounted, onUnmounted, ref } from 'vue'
import ladder from '../data/ladder.json'
import { t, locale } from '../i18n.js'

const sc = ladder.schedule
const now = ref(Date.now())
let timer
onMounted(() => { timer = setInterval(() => { now.value = Date.now() }, 1000) })
onUnmounted(() => clearInterval(timer))

const left = computed(() => Math.max(0, Date.parse(sc.endAt) - now.value))
const units = computed(() => {
  const s = Math.floor(left.value / 1000)
  const p = (n) => String(n).padStart(2, '0')
  return [
    { n: Math.floor(s / 86400), u: '일' },
    { n: p(Math.floor(s / 3600) % 24), u: '시간' },
    { n: p(Math.floor(s / 60) % 60), u: '분' },
    { n: p(s % 60), u: '초' },
  ]
})

const fmt = (iso, withTime) => new Date(iso).toLocaleString(locale.value === 'ko' ? 'ko-KR' : 'en-US', {
  timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', weekday: 'short', ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}),
})
const rows = computed(() => [
  { key: 'end', label: t('시즌 {n} 종료', { n: ladder.seasonNumber }), date: fmt(sc.endAt), on: true },
  { key: 'patch', label: t('{v} 패치 배포', { v: sc.nextPatch }), date: fmt(sc.patchAt) },
  { key: 'open', label: t('시즌 {n} 오픈', { n: sc.nextSeason }), date: fmt(sc.openAt, true) },
])
</script>

<template>
  <section class="sc-card" :aria-label="$t('시즌 일정')">
    <div class="sc-left">
      <div class="sc-title">{{ $t('시즌 {n} 종료까지', { n: ladder.seasonNumber }) }} <span v-if="sc.estimate" class="sc-est">({{ $t('예상') }})</span></div>
      <div class="sc-units">
        <div class="sc-unit" v-for="x in units" :key="x.u"><b>{{ x.n }}</b><span>{{ $t(x.u) }}</span></div>
      </div>
      <div class="sc-note" v-if="sc.estimate">{{ $t('블리자드 공식 발표 전 예상 일정 · 한국 시간 기준') }}</div>
    </div>
    <ul class="sc-rows">
      <li v-for="r in rows" :key="r.key">
        <span class="sc-dot" :class="{ on: r.on }"></span>
        <span class="sc-label">{{ r.label }}</span>
        <span class="sc-date">{{ r.date }}</span>
        <span class="sc-tag" v-if="sc.estimate">{{ $t('예상') }}</span>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.sc-card{display:flex; flex-wrap:wrap; gap:20px 32px; align-items:stretch; max-width:760px; margin:0 0 22px; padding:18px 22px; background:var(--panel); border:1px solid var(--border-soft); border-radius:12px;}
.sc-left{display:flex; flex-direction:column; gap:10px;}
.sc-title{font-size:13px; color:var(--text-muted);}
.sc-est{color:var(--gold);}
.sc-units{display:flex; gap:8px;}
.sc-unit{display:flex; flex-direction:column; align-items:center; min-width:58px; padding:8px 4px; background:var(--panel-2); border:1px solid var(--border-soft); border-radius:8px;}
.sc-unit b{font-size:28px; line-height:1; color:var(--text); font-variant-numeric:tabular-nums;}
.sc-unit span{margin-top:4px; font-size:11.5px; color:var(--text-dim);}
.sc-note{font-size:12px; color:var(--text-dim);}
.sc-rows{flex:1; min-width:260px; list-style:none; margin:0; padding:0; display:flex; flex-direction:column; justify-content:center;}
.sc-rows li{display:flex; align-items:center; gap:10px; padding:9px 0; border-bottom:1px solid var(--border-soft); font-size:14px;}
.sc-rows li:last-child{border-bottom:0;}
.sc-dot{width:10px; height:10px; border-radius:50%; border:2px solid var(--text-dim); box-sizing:border-box; flex:none;}
.sc-dot.on{background:var(--gold); border-color:var(--gold);}
.sc-label{font-weight:600; color:var(--text);}
.sc-date{color:var(--text-muted);}
.sc-tag{margin-left:auto; font-size:11.5px; color:var(--gold); border:1px solid var(--gold-dim); border-radius:4px; padding:1px 7px; white-space:nowrap;}
@media (max-width:640px){.sc-card{padding:16px 14px;} .sc-unit{min-width:0; flex:1;} .sc-units{display:grid; grid-template-columns:repeat(4, minmax(0, 1fr));} .sc-left{width:100%;}}
</style>
