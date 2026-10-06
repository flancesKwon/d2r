<script setup>
// 이벤트 안내 · 공개 응모 목록 · 추첨 연출 · 검증 (/event/:id)
// 응모 목록은 DB가 자동으로 쌓은 것 (판매글 올리면 1장, 1인 최대 N장). 추첨 시각이 지나면 목록 고정 →
// 그 시각의 drand 공개 난수로 DB가 뽑음. 이 화면은 결과를 슬롯처럼 3등→1등 순서로 보여주고, 같은 계산으로 누구나 검증 가능
import { ref, computed, watch, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { t, locale } from '../i18n.js'
import { nameText } from '../tradeI18n.js'
import {
  fetchEvent, fetchEntries, numberTickets, summarizeEntries, pickWinners, phaseOf, PHASE_KO,
  fmtCountdown, fmtEventTime, drandUrl, drandTimeOf,
} from '../eventStore.js'
import { authState, signIn } from '../profileStore.js'
import { useNow } from '../useNow.js'

const route = useRoute()
const now = useNow(1000)
const ev = ref(null)
const entries = ref([])
const error = ref('')
const loading = ref(true)

async function load(first = false) {
  if (first) loading.value = true
  try {
    const prevResult = !!ev.value?.result
    const [e, list] = await Promise.all([fetchEvent(route.params.id), fetchEntries(route.params.id)])
    ev.value = e
    entries.value = list
    if (!e) error.value = t('없는 이벤트')
    // 보고 있는 중에 추첨되면 바로 연출 시작
    if (!first && !prevResult && e?.result) playShow()
  } catch {
    if (first) error.value = t('이벤트 불러오기 실패')
  } finally {
    loading.value = false
  }
}
watch(() => route.params.id, () => { ev.value = null; load(true) }, { immediate: true })
const phase = computed(() => phaseOf(ev.value, now.value))
// 진행 중·추첨 대기 중엔 자주 새로 받음 (응모 목록·결과)
let lastLoad = 0
watch(now, (t) => {
  const every = { live: 20000, review: 30000, ready: 5000 }[phase.value]
  if (every && t - lastLoad > every) { lastLoad = t; load() }
})

const tickets = computed(() => numberTickets(entries.value))
const people = computed(() => summarizeEntries(entries.value))
const ticketTotal = computed(() => tickets.value.filter((t) => t.ticketNo).length)
const mine = computed(() => people.value.find((p) => p.userId === authState.user?.id))
const target = computed(() => ev.value && ({ upcoming: ev.value.startsAt, live: ev.value.endsAt, review: ev.value.drawAt })[phase.value])
const left = computed(() => (target.value ? new Date(target.value).getTime() - now.value : 0))

// 공개 목록 보기
const onlyMine = ref(false)
const q = ref('')
const shownTickets = computed(() => {
  let list = tickets.value
  if (onlyMine.value && authState.user) list = list.filter((t) => t.userId === authState.user.id)
  const s = q.value.trim()
  if (s) list = list.filter((t) => t.nickname.includes(s) || (t.itemName || '').includes(s))
  return list
})
const fmtTime = (iso) => new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

// ---- 추첨 연출: 3등 → 2등 → 1등, 응모권 번호가 돌다가 당첨 번호에 멈춤 ----
const winners = computed(() => ev.value?.result?.winners || [])
const show = ref({ playing: false, rank: null, label: '', display: null, revealed: [] })
let timer = 0
onUnmounted(() => clearTimeout(timer))
const sleep = (ms) => new Promise((r) => { timer = setTimeout(r, ms) })
async function playShow() {
  if (show.value.playing || !winners.value.length) return
  const pool = tickets.value.filter((t) => t.ticketNo)
  show.value = { playing: true, rank: null, label: '', display: null, revealed: [] }
  for (const w of [...winners.value].sort((a, b) => b.rank - a.rank)) {
    show.value.rank = w.rank
    show.value.label = w.label
    // 점점 느려지게 (약 4초)
    let delay = 40
    while (delay < 360) {
      show.value.display = pool[Math.floor(Math.random() * pool.length)]
      await sleep(delay)
      delay *= 1.12
    }
    show.value.display = pool.find((t) => t.id === w.entry_id) || { ticketNo: w.ticket_no, nickname: w.nickname, itemName: '' }
    await sleep(900)
    show.value.revealed = [w, ...show.value.revealed]
    await sleep(700)
  }
  show.value.playing = false
  show.value.rank = null
}
const revealedRanks = computed(() => new Set(show.value.revealed.map((w) => w.rank)))
const showDone = computed(() => !show.value.playing && show.value.revealed.length === winners.value.length && winners.value.length > 0)
const myWin = computed(() => winners.value.find((w) => w.user_id === authState.user?.id))
// 당첨 응모권의 공개 목록 번호 (ticket_no 는 앞 등수 당첨자를 뺀 나머지 중 순번 - 검증용)
const listNo = (w) => tickets.value.find((t) => t.id === w.entry_id)?.ticketNo ?? '?'

// ---- 검증: 공개 목록 + drand 난수로 같은 계산 ----
const verify = ref(null)
async function runVerify() {
  const r = ev.value.result
  const mineCalc = await pickWinners(entries.value, ev.value.prizes, r.randomness)
  const same = mineCalc.length === r.winners.length && mineCalc.every((w, i) => w.user_id === r.winners[i].user_id && w.entry_id === r.winners[i].entry_id)
  verify.value = { same, calc: mineCalc }
}
</script>

<template>
  <div class="items-page event-page">
    <div class="patch-hero">
      <div class="patch-hero-inner">
        <div class="eyebrow">{{ $t('디아허브 이벤트') }}</div>
        <h1>{{ ev?.title || $t('이벤트') }}</h1>
      </div>
    </div>

    <div class="grid-wrap event-wrap">
      <p v-if="loading" class="ev-dim">{{ $t('불러오는 중…') }}</p>
      <p v-else-if="error" class="ev-dim">{{ error }}</p>
      <template v-else-if="ev">
        <section class="ev-card ev-status" :class="phase">
          <span class="ev-badge">{{ $t(PHASE_KO[phase]) }}</span>
          <div class="ev-period">{{ fmtEventTime(ev.startsAt) }} ~ {{ fmtEventTime(ev.endsAt) }} · {{ $t('추첨') }} {{ fmtEventTime(ev.drawAt) }}</div>
          <div class="ev-count" v-if="target">
            {{ $t({ upcoming: '시작까지', live: '종료까지', review: '추첨까지' }[phase]) }} <b>{{ fmtCountdown(left) }}</b>
          </div>
          <div class="ev-count" v-else-if="phase === 'ready'">{{ $t('운영진이 곧 추첨해요 - 이 화면을 열어두면 바로 추첨 장면이 나와요') }}</div>
          <router-link v-if="phase === 'live'" to="/trade/new" class="ev-cta">{{ $t('판매글 올리고 응모하기') }}</router-link>
        </section>

        <!-- 추첨 무대 -->
        <section class="ev-card ev-stage" v-if="ev.result">
          <div class="ev-stage-head">
            <h2>{{ $t('추첨 결과') }}</h2>
            <button type="button" class="ev-btn" :disabled="show.playing" @click="playShow">{{ $t(show.revealed.length ? '추첨 다시 보기' : '▶ 추첨 장면 보기') }}</button>
          </div>
          <div class="ev-reel" v-if="show.playing || show.revealed.length" :class="{ spinning: show.playing && show.rank }">
            <template v-if="show.playing && show.rank">
              <div class="ev-reel-rank">{{ $t('{x} 추첨 중…', { x: show.label }) }}</div>
              <div class="ev-reel-no" v-if="show.display">#{{ show.display.ticketNo }}</div>
              <div class="ev-reel-name" v-if="show.display">{{ show.display.nickname }} <small>{{ show.display.itemName }}</small></div>
            </template>
            <template v-else-if="showDone">
              <div class="ev-reel-rank">{{ $t('🎉 추첨 완료') }}</div>
            </template>
          </div>
          <ol class="ev-winners">
            <li v-for="w in winners" :key="w.rank">
              <span class="ev-rank">{{ w.label }}</span>
              <template v-if="showDone || revealedRanks.has(w.rank) || (!show.playing && !show.revealed.length)">
                <b>{{ w.nickname }}</b> <span class="ev-dim">{{ w.item }} · {{ $t('응모권') }} #{{ listNo(w) }}</span>
              </template>
              <span v-else class="ev-dim">???</span>
            </li>
          </ol>
          <p class="ev-mywin" v-if="myWin && (showDone || (!show.playing && !show.revealed.length))">🎉 {{ $t('{rank} 당첨! ({item}) - 지급 안내는 쪽지로 드려요', { rank: myWin.label, item: myWin.item }) }}</p>
          <details class="ev-verify">
            <summary>{{ $t('공정성 검증 (누구나 직접 확인 가능)') }}</summary>
            <ul>
              <li>{{ $t('추첨 난수: drand 라운드') }} <b>{{ ev.result.round }}</b> ({{ $t('{time}에 공개', { time: drandTimeOf(ev.result.round).toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-US') }) }}) - <a :href="drandUrl(ev.result.round)" target="_blank" rel="noopener">{{ $t('drand에서 직접 보기') }}</a></li>
              <li class="ev-mono">randomness = {{ ev.result.randomness }}</li>
              <li>{{ $t('응모권 {n}장 (아래 목록 번호 순). 등수마다 SHA-256("난수:등수") 앞 6바이트 ÷ 남은 응모권 수의 나머지 + 1 = 당첨 번호, 당첨자의 나머지 응모권은 빼고 다음 등수', { n: ev.result.tickets_total }) }}</li>
            </ul>
            <button type="button" class="ev-btn" @click="runVerify">{{ $t('이 브라우저에서 직접 계산해보기') }}</button>
            <p v-if="verify" :class="verify.same ? 'ev-ok' : 'ev-bad'">
              {{ $t(verify.same ? '✓ 발표된 결과와 똑같아요' : '✗ 결과가 달라요 - 운영진에게 알려주세요') }}
              <span class="ev-dim">({{ verify.calc.map((w) => `${w.label}: ${$t('남은 {n}장 중 {k}번째', { n: w.tickets_left, k: w.ticket_no })} = #${listNo(w)} ${w.nickname}`).join(' · ') }})</span>
            </p>
          </details>
        </section>

        <section class="ev-card ev-two">
          <div>
            <h2>{{ $t('상품') }}</h2>
            <ul class="ev-prizes">
              <li v-for="p in ev.prizes" :key="p.rank"><span class="ev-rank">{{ p.label }}</span> {{ p.item }}</li>
            </ul>
          </div>
          <div v-if="phase !== 'upcoming'">
            <h2>{{ $t('내 응모권') }}</h2>
            <p v-if="!authState.user" class="ev-dim">{{ $t('로그인하면 내 응모권이 보여요') }} <button type="button" class="ev-btn" @click="signIn()">{{ $t('로그인') }}</button></p>
            <p v-else class="ev-mine"><b>{{ mine?.tickets || 0 }}</b> / {{ ev.ticketCap }}
              <span class="ev-dim" v-if="mine && mine.entries.some((e) => e.excluded)">({{ $t('제외') }} {{ mine.entries.filter((e) => e.excluded).length }})</span>
            </p>
          </div>
        </section>

        <section class="ev-card">
          <h2>{{ $t('참여 방법') }}</h2>
          <ul class="ev-rules">
            <li>{{ $t('이벤트 시간 안에') }} <b>{{ $t('거래게시판에 판매글을 올리면 자동으로 응모') }}</b> {{ $t('- 판매글 1개당 응모권 1장,') }} <b>{{ $t('1인 최대 {n}장', { n: ev.ticketCap }) }}</b></li>
            <li>{{ $t('응모 안 되는 글: 골드, 코 룬 미만 룬, 최상급이 아닌 보석, 같은 아이템 중복 등록 · 추첨 전에 글을 지우면 그 응모권은 빠져요') }}</li>
            <li>{{ $t('거래가 거의 없는 잡템·허위 매물은 운영진이 추첨 전까지 제외할 수 있어요 (아래 목록에 이유 표시)') }}</li>
            <li><b>{{ $t('추첨은 {time}', { time: fmtEventTime(ev.drawAt) }) }}</b>{{ $t('에 공개되는') }} <a href="https://drand.love" target="_blank" rel="noopener">drand</a> {{ $t('공개 난수로 해요. 그 시각에 응모 목록이 고정되고, 난수는 그 뒤에 나와서 운영진도 결과를 미리 알거나 바꿀 수 없어요') }}</li>
            <li>{{ $t('한 사람은 상품 하나만 당첨, 응모권이 많을수록 확률이 올라가요') }}</li>
          </ul>
          <p class="ev-extra" v-if="ev.rules">{{ ev.rules }}</p>
        </section>

        <section class="ev-card" v-if="phase !== 'upcoming'">
          <div class="ev-list-head">
            <h2>{{ $t('응모 목록') }} <span class="ev-dim">{{ $t('응모자 {n}명 · 응모권 {m}장', { n: people.filter((p) => p.tickets).length, m: ticketTotal }) }}</span></h2>
            <div class="ev-list-tools">
              <input v-model="q" class="ev-input" :placeholder="$t('닉네임·아이템 찾기')" :aria-label="$t('응모 목록 검색')" />
              <label v-if="authState.user"><input type="checkbox" v-model="onlyMine" /> {{ $t('내 것만') }}</label>
            </div>
          </div>
          <table class="ev-table" v-if="shownTickets.length">
            <thead><tr><th>{{ $t('번호') }}</th><th>{{ $t('닉네임') }}</th><th>{{ $t('판매글') }}</th><th>{{ $t('시각') }}</th></tr></thead>
            <tbody>
              <tr v-for="t in shownTickets" :key="t.id" :class="{ no: t.excluded, me: t.userId === authState.user?.id, win: winners.some((w) => w.entry_id === t.id) }">
                <td class="ev-no">{{ t.ticketNo ? '#' + t.ticketNo : '-' }}</td>
                <td>{{ t.nickname }}</td>
                <td><router-link :to="`/trade/${t.postId}`">{{ nameText(t.itemName) }}</router-link> <span class="ev-reason" v-if="t.excluded">{{ t.reason || $t('제외') }}</span></td>
                <td class="ev-dim">{{ fmtTime(t.createdAt) }}</td>
              </tr>
            </tbody>
          </table>
          <p v-else class="ev-dim">{{ $t(entries.length ? '찾는 응모권 없음' : '아직 응모가 없어요') }}</p>
        </section>
      </template>
    </div>
  </div>
</template>

<style scoped>
.event-wrap{max-width:860px; display:flex; flex-direction:column; gap:14px;}
.ev-card{border:1px solid var(--border); background:var(--panel); border-radius:14px; padding:18px 20px;}
.ev-card h2{font-size:15px; color:var(--gold); margin:0 0 10px;}
.ev-status{display:flex; align-items:center; gap:10px 18px; flex-wrap:wrap;}
.ev-status.live{border-color:var(--gold-dim); background:linear-gradient(90deg, rgba(199,179,119,.12), rgba(199,179,119,.02));}
.ev-badge{font-size:12px; font-weight:700; padding:3px 10px; border-radius:999px; background:var(--gold); color:#1a1408;}
.ev-status:not(.live) .ev-badge{background:var(--panel-2); color:var(--text-muted); border:1px solid var(--border);}
.ev-period{color:var(--text-muted); font-size:13px;}
.ev-count{font-size:13px; color:var(--text-muted); font-variant-numeric:tabular-nums;}
.ev-count b{font-size:20px; color:var(--gold); margin-left:4px;}
.ev-cta{margin-left:auto; font-size:13px; font-weight:700; color:#1a1408; background:var(--gold); padding:9px 16px; border-radius:10px; text-decoration:none;}
.ev-dim{color:var(--text-dim); font-size:12.5px; font-weight:400;}
.ev-btn{font-size:12.5px; color:var(--gold); border:1px solid var(--gold-dim); background:var(--panel-2); padding:6px 12px; border-radius:8px; cursor:pointer;}
.ev-btn:disabled{opacity:.5; cursor:default;}
.ev-two{display:grid; grid-template-columns:1fr 1fr; gap:16px;}
.ev-prizes, .ev-rules, .ev-winners{margin:0; padding-left:0; list-style:none; display:flex; flex-direction:column; gap:8px; font-size:13.5px;}
.ev-rules li{padding-left:14px; position:relative; color:var(--text-muted); line-height:1.6;}
.ev-rules li::before{content:'·'; position:absolute; left:2px; color:var(--gold);}
.ev-rules b{color:var(--text);}
.ev-rules a{color:var(--gold);}
.ev-rank{display:inline-block; min-width:44px; font-size:12px; color:var(--gold); border:1px solid var(--gold-dim); border-radius:999px; text-align:center; padding:1px 8px; margin-right:6px;}
.ev-mine{font-size:14px; margin:0;}
.ev-mine b{font-size:24px; color:var(--gold);}
.ev-extra{margin:10px 0 0; font-size:13px; color:var(--text-muted); white-space:pre-line;}
/* 무대 */
.ev-stage{border-color:var(--gold-dim);}
.ev-stage-head{display:flex; align-items:center; justify-content:space-between; gap:10px;}
.ev-reel{margin:6px 0 14px; padding:22px 14px; border-radius:14px; background:#0d0b09; border:1px solid var(--gold-dim); text-align:center; min-height:120px; display:flex; flex-direction:column; justify-content:center; gap:6px;}
.ev-reel.spinning{box-shadow:0 0 30px rgba(199,179,119,.25) inset;}
.ev-reel-rank{font-size:13px; color:var(--gold); letter-spacing:.05em;}
.ev-reel-no{font-size:40px; font-weight:800; color:var(--gold); font-variant-numeric:tabular-nums; line-height:1.1;}
.ev-reel-name{font-size:18px; color:var(--text);}
.ev-reel-name small{font-size:12px; color:var(--text-dim); margin-left:6px;}
.ev-winners li{display:flex; align-items:center; gap:8px; flex-wrap:wrap;}
.ev-mywin{color:var(--gold); font-weight:700; margin:12px 0 0;}
.ev-verify{margin-top:14px; font-size:12.5px; color:var(--text-muted);}
.ev-verify summary{cursor:pointer; color:var(--text-muted);}
.ev-verify ul{padding-left:18px; display:flex; flex-direction:column; gap:4px; margin:8px 0;}
.ev-verify a{color:var(--gold);}
.ev-mono{font-family:ui-monospace, monospace; font-size:11.5px; word-break:break-all;}
.ev-ok{color:#3ecf5a; margin:8px 0 0;}
.ev-bad{color:var(--blood); margin:8px 0 0;}
/* 목록 */
.ev-list-head{display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap; margin-bottom:8px;}
.ev-list-head h2{margin:0;}
.ev-list-tools{display:flex; align-items:center; gap:10px; font-size:12.5px; color:var(--text-muted);}
.ev-input{background:var(--panel-2); border:1px solid var(--border); color:var(--text); font-size:12.5px; padding:6px 10px; border-radius:8px; width:170px;}
.ev-table{width:100%; border-collapse:collapse; font-size:13px;}
.ev-table th{text-align:left; font-size:11.5px; color:var(--text-dim); font-weight:500; padding:6px 8px; border-bottom:1px solid var(--border);}
.ev-table td{padding:7px 8px; border-bottom:1px solid var(--border-soft);}
.ev-table a{color:var(--text);}
.ev-table tr.no td{color:var(--text-dim);}
.ev-table tr.no a{color:var(--text-dim); text-decoration:line-through;}
.ev-table tr.me td:first-child{box-shadow:inset 3px 0 0 var(--teal);}
.ev-table tr.win td{background:rgba(199,179,119,.12);}
.ev-no{font-variant-numeric:tabular-nums; color:var(--gold); width:56px;}
.ev-reason{font-size:11px; color:var(--blood); border:1px solid currentColor; border-radius:999px; padding:0 7px; margin-left:4px;}
@media (max-width:640px){
  .ev-cta{margin-left:0;}
  .ev-two{grid-template-columns:1fr;}
  .ev-input{width:130px;}
  .ev-table td:last-child, .ev-table th:last-child{display:none;}
}
</style>
