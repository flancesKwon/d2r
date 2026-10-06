<script setup>
// 운영진 - 이벤트 만들기, 응모 목록 검토(잡템·허위 매물 제외 - 추첨 시각 전까지), drand 난수로 추첨 (/admin/event)
// 응모는 DB가 판매글 올라올 때 자동으로 쌓음. 추첨 계산도 DB가 함 (운영진은 난수만 넘김 - 결과를 고를 수 없음)
import { ref, computed, watch } from 'vue'
import { supabase } from '../supabase.js'
import { authState, signIn, isStaff } from '../profileStore.js'
import {
  fetchEvents, createEvent, updateEvent, deleteEvent, fetchEntries, setEntryExcluded, summarizeEntries, numberTickets,
  drawEvent, fetchDrand, drandRoundAt, drandTimeOf, drandUrl, phaseOf, PHASE_KO, fmtEventTime, fmtCountdown,
} from '../eventStore.js'
import { useNow } from '../useNow.js'
import { askConfirm, askPrompt } from '../dialog.js'

const staff = computed(() => isStaff())
const now = useNow(1000)
const events = ref([])
const selectedId = ref(null)
const error = ref('')
const busy = ref(false)

// ---- 만들기 ----
const pad = (n) => String(n).padStart(2, '0')
const toLocal = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
const nextHour = () => { const d = new Date(); d.setMinutes(0, 0, 0); d.setHours(d.getHours() + 1); return d }
const DEFAULT_PRIZES = () => [
  { label: '1등', item: '자 룬 + 베르 룬' },
  { label: '2등', item: '소집 룬 세트 (앰·랄·말·이스트·옴)' },
  { label: '3등', item: '소집 룬 세트 (앰·랄·말·이스트·옴)' },
]
const form = ref({ title: '매물 등록 이벤트', start: toLocal(nextHour()), durMin: 120, reviewMin: 30, cap: 5, prizes: DEFAULT_PRIZES(), rules: '' })
// 입력값 검사 - 칸마다 무엇이 틀렸는지 (datetime-local 은 날짜·시간을 다 채워야 값이 생김)
const num = (v) => (v === '' || v === null || v === undefined ? NaN : Number(v))
const formProblem = computed(() => {
  const f = form.value
  if (!f.start || Number.isNaN(new Date(f.start).getTime())) return '시작 시각: 날짜와 시간을 끝까지 입력 (또는 아래 "바로 시작" 버튼)'
  if (!(f.durMin > 0)) return '진행 시간: 1분 이상'
  if (!(f.reviewMin >= 0)) return '검토 시간: 0분 이상 (검토 안 하면 "없음")'
  if (!(num(f.cap) >= 1 && num(f.cap) <= 100)) return '1인 최대 응모권: 1~100'
  return ''
})
const formTimes = computed(() => {
  if (formProblem.value) return null
  const s = new Date(form.value.start)
  const end = new Date(s.getTime() + form.value.durMin * 60000)
  const draw = new Date(end.getTime() + form.value.reviewMin * 60000)
  return { start: s, end, draw, round: drandRoundAt(draw) }
})
// 진행·검토 시간은 둘 다 분으로 저장 - 버튼으로 고르거나 "시간 + 분"으로 직접 입력
const DUR_CHOICES = { durMin: [30, 60, 120, 180], reviewMin: [0, 10, 30, 60] }
const fmtMin = (m) => (m === 0 ? '없음' : [Math.floor(m / 60) && `${Math.floor(m / 60)}시간`, m % 60 && `${m % 60}분`].filter(Boolean).join(' '))
const durPart = (key, unit) => (unit === 'h' ? Math.floor(form.value[key] / 60) : form.value[key] % 60)
function setDurPart(key, unit, raw) {
  const v = Math.max(0, Math.floor(Number(raw) || 0))
  const h = unit === 'h' ? v : durPart(key, 'h'), m = unit === 'm' ? Math.min(v, 59) : durPart(key, 'm')
  form.value[key] = h * 60 + m
}
// 시작 시각 빠른 선택 (지금부터 n분 뒤, 초는 버림)
function startIn(min) { const d = new Date(Date.now() + min * 60000); d.setSeconds(0, 0); form.value.start = toLocal(d) }
function addPrize() { form.value.prizes.push({ label: `${form.value.prizes.length + 1}등`, item: '' }) }
function removePrize(i) { form.value.prizes.splice(i, 1) }
async function submitCreate() {
  error.value = ''
  const t = formTimes.value
  if (!form.value.title.trim()) { error.value = '제목 입력'; return }
  if (formProblem.value) { error.value = formProblem.value; return }
  const prizes = form.value.prizes.filter((p) => p.item.trim()).map((p, k) => ({ rank: k + 1, label: p.label.trim() || `${k + 1}등`, item: p.item.trim() }))
  if (!prizes.length) { error.value = '상품 하나 이상'; return }
  busy.value = true
  try {
    const ev = await createEvent({
      title: form.value.title.trim(), startsAt: t.start.toISOString(), endsAt: t.end.toISOString(), drawAt: t.draw.toISOString(),
      ticketCap: num(form.value.cap), prizes, rules: form.value.rules.trim(),
    })
    await loadEvents()
    selectedId.value = ev.id
  } catch (e) {
    error.value = e.message || '만들기 실패 (024 SQL 실행했는지 확인)'
  } finally { busy.value = false }
}

async function loadEvents() {
  try { events.value = await fetchEvents() } catch { error.value = '이벤트 불러오기 실패 - 024 SQL 실행 필요'; events.value = [] }
  if (!selectedId.value && events.value.length) selectedId.value = events.value[0].id
}
watch(staff, (v) => v && supabase && loadEvents(), { immediate: true })
const ev = computed(() => events.value.find((e) => e.id === selectedId.value) || null)
const phase = computed(() => phaseOf(ev.value, now.value))
const started = computed(() => ev.value && now.value >= new Date(ev.value.startsAt).getTime())

// ---- 시작 전 수정·삭제 ----
const edit = ref(null)
function startEdit() {
  edit.value = { title: ev.value.title, start: toLocal(new Date(ev.value.startsAt)), end: toLocal(new Date(ev.value.endsAt)), draw: toLocal(new Date(ev.value.drawAt)) }
}
async function saveEdit() {
  error.value = ''
  try {
    const patch = { title: edit.value.title.trim() }
    if (!started.value) Object.assign(patch, { startsAt: new Date(edit.value.start).toISOString(), endsAt: new Date(edit.value.end).toISOString(), drawAt: new Date(edit.value.draw).toISOString() })
    await updateEvent(ev.value.id, patch)
    edit.value = null
    await loadEvents()
  } catch (e) { error.value = e.message || '저장 실패' }
}
async function removeEvent() {
  if (!(await askConfirm(`이벤트 삭제: ${ev.value.title}`))) return
  try { await deleteEvent(ev.value.id); selectedId.value = null; await loadEvents() } catch (e) { error.value = e.message }
}

// ---- 응모 목록 검토 ----
const entries = ref([])
const entriesLoading = ref(false)
async function loadEntries() {
  if (!ev.value) return
  entriesLoading.value = true
  try { entries.value = await fetchEntries(ev.value.id) } catch { error.value = '응모 목록 불러오기 실패' } finally { entriesLoading.value = false }
}
watch(selectedId, () => { edit.value = null; drandInput.value = ''; loadEntries() })
let lastLoad = 0
watch(now, (t) => { if (phase.value === 'live' && t - lastLoad > 20000) { lastLoad = t; loadEntries() } })
const people = computed(() => summarizeEntries(numberTickets(entries.value)))
const ticketTotal = computed(() => entries.value.filter((e) => !e.excluded).length)
const canReview = computed(() => ev.value && !ev.value.result && now.value < new Date(ev.value.drawAt).getTime())
const REVIEW_CATS = ['매직/레어/일반', '기타']
async function toggleEntry(e) {
  error.value = ''
  try {
    if (e.excluded) await setEntryExcluded(e.id, false)
    else {
      const reason = await askPrompt('제외 이유', { value: '잡템', placeholder: '잡템 / 허위 매물 …' })
      if (reason === null) return
      await setEntryExcluded(e.id, true, reason.trim() || '운영진 제외')
    }
    await loadEntries()
  } catch (err) { error.value = err.message || '수정 실패' }
}

// ---- 추첨 ----
const drandInput = ref('')
const drandReady = computed(() => ev.value && now.value >= drandTimeOf(ev.value.drandRound).getTime())
async function draw() {
  error.value = ''
  busy.value = true
  try {
    let rnd = drandInput.value.trim().toLowerCase()
    if (!rnd) {
      try { rnd = await fetchDrand(ev.value.drandRound) } catch (e) { error.value = e.message; return }
    }
    if (!/^[0-9a-f]{64}$/.test(rnd)) { error.value = 'drand randomness 는 64자리 16진수'; return }
    const ok = await askConfirm(`추첨하고 발표 - 응모권 ${ticketTotal.value}장 · drand 라운드 ${ev.value.drandRound} 난수로 추첨해요. 발표하면 되돌릴 수 없고 당첨자에게 알림이 가요`, { confirmText: '추첨하고 발표' })
    if (!ok) return
    await drawEvent(ev.value.id, rnd)
    await loadEvents()
  } catch (e) {
    error.value = e.message || '추첨 실패'
  } finally { busy.value = false }
}
</script>

<template>
  <div class="items-page admin-page">
    <div class="patch-hero">
      <div class="patch-hero-inner">
        <div class="eyebrow"><router-link to="/admin">관리자</router-link></div>
        <h1>이벤트 관리</h1>
      </div>
    </div>

    <div class="grid-wrap admin-wrap admin-gate" v-if="!authState.user">
      <p>운영진 계정 로그인 필요</p>
      <button type="button" class="btn-primary" @click="signIn">로그인</button>
    </div>
    <div class="grid-wrap admin-wrap admin-gate" v-else-if="!staff"><p>운영진 전용</p></div>

    <div class="grid-wrap ae-wrap" v-else>
      <div class="ae-error" v-if="error">{{ error }}</div>

      <section class="ae-card">
        <h2>새 이벤트</h2>
        <div class="ae-form">
          <label>제목 <input v-model="form.title" class="ae-input" /></label>
          <label>시작 <input type="datetime-local" v-model="form.start" class="ae-input" /></label>
          <label>1인 최대 응모권 <input type="number" min="1" max="100" v-model="form.cap" class="ae-input ae-num" /></label>
        </div>
        <div class="ae-quick">
          <span class="ae-dur-label">시작 빠르게</span><button type="button" class="ae-btn small" @click="startIn(1)">바로 시작 (1분 뒤)</button>
          <button type="button" class="ae-btn small" @click="startIn(10)">10분 뒤</button>
          <button type="button" class="ae-btn small" @click="startIn(60)">1시간 뒤</button>
        </div>
        <div class="ae-dur" v-for="key in ['durMin', 'reviewMin']" :key="key">
          <span class="ae-dur-label">{{ key === 'durMin' ? '진행 시간' : '검토 시간' }}</span>
          <button type="button" class="ae-btn small" v-for="m in DUR_CHOICES[key]" :key="m" :class="{ on: form[key] === m }" @click="form[key] = m">{{ fmtMin(m) }}</button>
          <span class="ae-dim">직접</span>
          <input type="number" min="0" class="ae-input ae-tiny" :value="durPart(key, 'h')" @input="setDurPart(key, 'h', $event.target.value)" :aria-label="`${key === 'durMin' ? '진행' : '검토'} 시간`" /> 시간
          <input type="number" min="0" max="59" class="ae-input ae-tiny" :value="durPart(key, 'm')" @input="setDurPart(key, 'm', $event.target.value)" :aria-label="`${key === 'durMin' ? '진행' : '검토'} 분`" /> 분
          <span class="ae-dim" v-if="key === 'reviewMin'">· 종료 후 잡템 검토하는 시간 (끝나면 추첨)</span>
        </div>
        <div class="ae-error" v-if="formProblem">{{ formProblem }}</div>
        <div class="ae-dim" v-if="formTimes">
          종료 {{ fmtEventTime(formTimes.end.toISOString()) }} → 검토 → 추첨 {{ fmtEventTime(formTimes.draw.toISOString()) }}
          (drand 라운드 {{ formTimes.round }}, {{ drandTimeOf(formTimes.round).toLocaleTimeString('ko-KR') }} 공개)
        </div>
        <div class="ae-prizes">
          <div class="ae-prize" v-for="(p, i) in form.prizes" :key="i">
            <input v-model="p.label" class="ae-input ae-label" aria-label="등수" />
            <input v-model="p.item" class="ae-input ae-item" placeholder="상품 (예: 베르 룬)" aria-label="상품" />
            <button type="button" class="ae-x" @click="removePrize(i)" aria-label="상품 삭제">✕</button>
          </div>
          <button type="button" class="ae-btn" @click="addPrize">+ 상품 추가</button>
        </div>
        <label class="ae-rules">추가 안내 (선택) <textarea v-model="form.rules" class="ae-input" rows="2" placeholder="예: 당첨 상품은 아시아 레더 소프트코어에서 지급"></textarea></label>
        <button type="button" class="ae-btn primary" :disabled="busy" @click="submitCreate">이벤트 만들기</button>
      </section>

      <section class="ae-card" v-if="events.length">
        <h2>이벤트</h2>
        <div class="ae-tabs">
          <button type="button" v-for="e in events" :key="e.id" :class="{ on: e.id === selectedId }" @click="selectedId = e.id">
            {{ e.title }} <small>{{ fmtEventTime(e.startsAt) }} · {{ PHASE_KO[phaseOf(e, now)] }}</small>
          </button>
        </div>

        <template v-if="ev">
          <div class="ae-head">
            <span class="ae-badge" :class="phase">{{ PHASE_KO[phase] }}</span>
            <span>{{ fmtEventTime(ev.startsAt) }} ~ {{ fmtEventTime(ev.endsAt) }} · 추첨 {{ fmtEventTime(ev.drawAt) }}</span>
            <span class="ae-dim" v-if="phase === 'upcoming'">시작까지 {{ fmtCountdown(new Date(ev.startsAt).getTime() - now) }}</span>
            <span class="ae-dim" v-if="phase === 'live'">종료까지 {{ fmtCountdown(new Date(ev.endsAt).getTime() - now) }}</span>
            <span class="ae-dim" v-if="phase === 'review'">검토 마감(추첨)까지 {{ fmtCountdown(new Date(ev.drawAt).getTime() - now) }}</span>
            <router-link :to="`/event/${ev.id}`" class="ae-link">이벤트 페이지 →</router-link>
            <template v-if="!ev.result">
              <button type="button" class="ae-btn" @click="startEdit">{{ started ? '제목 수정' : '수정' }}</button>
              <button type="button" class="ae-btn danger" v-if="!started" @click="removeEvent">삭제</button>
            </template>
          </div>
          <div class="ae-form" v-if="edit">
            <label>제목 <input v-model="edit.title" class="ae-input" /></label>
            <template v-if="!started">
              <label>시작 <input type="datetime-local" v-model="edit.start" class="ae-input" /></label>
              <label>종료 <input type="datetime-local" v-model="edit.end" class="ae-input" /></label>
              <label>추첨 <input type="datetime-local" v-model="edit.draw" class="ae-input" /></label>
            </template>
            <button type="button" class="ae-btn primary" @click="saveEdit">저장</button>
            <button type="button" class="ae-btn" @click="edit = null">취소</button>
          </div>
          <div class="ae-dim">상품: <span v-for="p in ev.prizes" :key="p.rank" class="ae-chip">{{ p.label }} {{ p.item }}</span> · 1인 최대 {{ ev.ticketCap }}장 · drand 라운드 {{ ev.drandRound }}</div>

          <!-- 추첨 -->
          <div class="ae-draw" v-if="!ev.result && (phase === 'ready' || phase === 'review')">
            <template v-if="phase === 'ready'">
              <p>응모 목록 고정됨 · 응모권 <b>{{ ticketTotal }}</b>장</p>
              <p class="ae-dim" v-if="!drandReady">drand 라운드 {{ ev.drandRound }} 공개까지 {{ fmtCountdown(drandTimeOf(ev.drandRound).getTime() - now) }}</p>
              <div class="ae-form">
                <button type="button" class="ae-btn primary" :disabled="busy || !drandReady || !ticketTotal" @click="draw">drand 난수 가져와서 추첨·발표</button>
              </div>
              <details class="ae-dim">
                <summary>drand 를 못 가져올 때 (직접 붙여넣기)</summary>
                <p><a :href="drandUrl(ev.drandRound)" target="_blank" rel="noopener">{{ drandUrl(ev.drandRound) }}</a> 를 열어 randomness 값을 복사해서 붙여넣고 추첨</p>
                <input v-model="drandInput" class="ae-input ae-rnd" placeholder="randomness (64자리)" />
              </details>
            </template>
            <p v-else class="ae-dim">검토 시간 - 추첨 시각 전까지 잡템·허위 매물을 제외하세요. 추첨 시각이 지나면 목록이 고정되고 추첨 버튼이 생겨요</p>
          </div>
          <div v-if="ev.result" class="ae-result">
            <h3>당첨자</h3>
            <ol><li v-for="w in ev.result.winners" :key="w.rank"><b>{{ w.label }}</b> {{ w.nickname }} <span class="ae-dim">({{ w.item }} · 응모권 #{{ numberTickets(entries).find((t) => t.id === w.entry_id)?.ticketNo ?? '?' }})</span></li></ol>
            <p class="ae-dim">응모권 {{ ev.result.tickets_total }}장 · drand 라운드 {{ ev.result.round }} · 당첨자 알림 보냄 · 상품 지급은 쪽지로 안내</p>
          </div>

          <!-- 응모 목록 -->
          <template v-if="phase !== 'upcoming'">
            <div class="ae-summary">
              <span>응모자 <b>{{ people.filter((p) => p.tickets).length }}</b>명</span>
              <span>응모권 <b>{{ ticketTotal }}</b>장</span>
              <span class="ae-review" v-if="canReview">주황색 = 검토 필요 (매직·레어·일반·기타)</span>
              <button type="button" class="ae-btn" @click="loadEntries" :disabled="entriesLoading">새로고침</button>
            </div>
            <div class="ae-entry" v-for="p in people" :key="p.userId">
              <div class="ae-entry-head"><b>{{ p.nickname }}</b> <b class="ae-tickets">응모권 {{ p.tickets }}장</b></div>
              <div class="ae-post" v-for="e in p.entries" :key="e.id" :class="{ no: e.excluded, review: !e.excluded && REVIEW_CATS.includes(e.category) }">
                <span class="ae-no">{{ e.ticketNo ? '#' + e.ticketNo : '-' }}</span>
                <router-link :to="`/trade/${e.postId}`" target="_blank">{{ e.itemName }}</router-link>
                <span class="ae-dim">{{ e.category }} · {{ new Date(e.createdAt).toLocaleTimeString('ko-KR') }}</span>
                <span class="ae-reason" v-if="e.excluded">{{ e.reason }}</span>
                <button type="button" class="ae-btn small" v-if="canReview" @click="toggleEntry(e)">{{ e.excluded ? '다시 인정' : '제외' }}</button>
              </div>
            </div>
            <p v-if="!entriesLoading && !entries.length" class="ae-dim">아직 응모 없음</p>
          </template>
        </template>
      </section>
    </div>
  </div>
</template>

<style scoped>
.ae-wrap{max-width:980px; display:flex; flex-direction:column; gap:16px;}
.ae-card{border:1px solid var(--border); background:var(--panel); border-radius:14px; padding:18px 20px; display:flex; flex-direction:column; gap:12px;}
.ae-card h2{font-size:15px; color:var(--gold); margin:0;}
.ae-card h3{font-size:14px; margin:0 0 6px;}
.ae-error{color:var(--blood); font-size:13px;}
.ae-form{display:flex; flex-wrap:wrap; gap:10px 14px; align-items:flex-end;}
.ae-form label, .ae-rules{display:flex; flex-direction:column; gap:5px; font-size:12px; color:var(--text-dim);}
.ae-input{background:var(--panel-2); border:1px solid var(--border); color:var(--text); font-size:13px; padding:8px 10px; border-radius:8px; font-family:'Noto Sans KR', sans-serif;}
.ae-num{width:90px;}
.ae-dur{display:flex; align-items:center; gap:6px; flex-wrap:wrap; font-size:12.5px; color:var(--text-muted);}
.ae-dur-label{width:64px; color:var(--text-dim); font-size:12px;}
.ae-tiny{width:64px; padding:5px 8px;}
.ae-btn.small.on{color:#1a1408; background:var(--gold); border-color:var(--gold); font-weight:700;}
.ae-quick{display:flex; align-items:center; gap:6px; flex-wrap:wrap; font-size:12px; color:var(--text-dim);}
.ae-rnd{width:100%; font-family:ui-monospace, monospace; font-size:12px; margin-top:6px;}
.ae-prizes{display:flex; flex-direction:column; gap:6px;}
.ae-prize{display:flex; gap:6px; align-items:center;}
.ae-label{width:70px;}
.ae-item{flex:1; min-width:0;}
.ae-x{color:var(--text-dim); background:transparent; border:0; cursor:pointer;}
.ae-btn{font-size:12.5px; color:var(--text-muted); border:1px solid var(--border); background:var(--panel-2); padding:7px 12px; border-radius:8px; cursor:pointer; align-self:flex-start;}
.ae-btn.small{padding:2px 9px; font-size:11.5px; align-self:center;}
.ae-btn.primary{color:#1a1408; background:var(--gold); border-color:var(--gold); font-weight:700;}
.ae-btn.danger{color:var(--blood); border-color:var(--blood);}
.ae-btn:disabled{opacity:.45; cursor:not-allowed;}
.ae-dim{font-size:12px; color:var(--text-dim);}
.ae-dim a{color:var(--gold); word-break:break-all;}
.ae-tabs{display:flex; flex-wrap:wrap; gap:6px;}
.ae-tabs button{font-size:12.5px; color:var(--text-muted); border:1px solid var(--border); background:var(--panel-2); padding:6px 12px; border-radius:999px; cursor:pointer;}
.ae-tabs button.on{color:var(--gold); border-color:var(--gold-dim);}
.ae-tabs small{color:var(--text-dim); margin-left:4px;}
.ae-head{display:flex; flex-wrap:wrap; align-items:center; gap:8px 12px; font-size:13px;}
.ae-badge{font-size:11.5px; font-weight:700; padding:2px 9px; border-radius:999px; border:1px solid var(--border); color:var(--text-muted);}
.ae-badge.live, .ae-badge.ready{background:var(--gold); color:#1a1408; border-color:var(--gold);}
.ae-link{color:var(--gold); font-size:12.5px;}
.ae-chip{display:inline-block; margin:0 4px; color:var(--text-muted);}
.ae-draw{border:1px solid var(--gold-dim); border-radius:12px; padding:12px 14px; display:flex; flex-direction:column; gap:8px; font-size:13px;}
.ae-draw p{margin:0;}
.ae-draw b{color:var(--gold);}
.ae-summary{display:flex; flex-wrap:wrap; align-items:center; gap:8px 14px; font-size:13px;}
.ae-summary b{color:var(--gold);}
.ae-review{color:#e0a040; font-size:12px;}
.ae-entry{border-top:1px solid var(--border-soft); padding-top:10px;}
.ae-entry-head{font-size:13px; margin-bottom:6px; display:flex; gap:8px; align-items:baseline;}
.ae-tickets{color:var(--gold);}
.ae-post{display:flex; align-items:center; gap:8px; flex-wrap:wrap; font-size:12.5px; padding:4px 6px; border-radius:6px;}
.ae-post a{color:var(--text);}
.ae-post.no a{color:var(--text-dim); text-decoration:line-through;}
.ae-post.review{background:rgba(224,160,64,.09);}
.ae-no{width:40px; color:var(--gold); font-variant-numeric:tabular-nums;}
.ae-reason{font-size:11px; color:var(--blood); border:1px solid currentColor; border-radius:999px; padding:0 7px;}
.ae-result ol{margin:0; padding-left:18px; display:flex; flex-direction:column; gap:4px; font-size:13.5px;}
</style>
