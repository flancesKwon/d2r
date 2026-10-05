<script setup>
// 운영진 - 이벤트 만들기·고치기, 기간 안 판매글 검토(인정/제외), 추첨·발표 (/admin/event)
// 추첨은 "추첨하고 발표" 한 번 - 뽑자마자 저장돼서 다시 뽑을 수 없음 (결과·응모자 목록은 이벤트 페이지에 공개)
import { ref, computed, watch } from 'vue'
import { supabase } from '../supabase.js'
import { authState, signIn, isStaff } from '../profileStore.js'
import {
  fetchEvents, createEvent, updateEvent, deleteEvent, saveEventResult, fetchEventPosts,
  computeEntries, drawWinners, phaseOf, fmtEventTime, fmtCountdown,
} from '../eventStore.js'
import { useNow } from '../useNow.js'
import { askConfirm as confirmDialog } from '../dialog.js'

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
  { rank: 1, label: '1등', item: '자 룬 + 베르 룬' },
  { rank: 2, label: '2등', item: '소집 룬 세트 (앰·랄·말·이스트·옴)' },
  { rank: 3, label: '3등', item: '소집 룬 세트 (앰·랄·말·이스트·옴)' },
]
const form = ref({ title: '매물 등록 이벤트', start: toLocal(nextHour()), hours: 2, cap: 4, prizes: DEFAULT_PRIZES(), rules: '' })
const formEnd = computed(() => {
  const s = new Date(form.value.start)
  return Number.isNaN(s.getTime()) ? null : new Date(s.getTime() + Number(form.value.hours || 0) * 3600000)
})
function addPrize() { form.value.prizes.push({ rank: form.value.prizes.length + 1, label: `${form.value.prizes.length + 1}등`, item: '' }) }
function removePrize(i) { form.value.prizes.splice(i, 1); form.value.prizes.forEach((p, k) => (p.rank = k + 1)) }
async function submitCreate() {
  error.value = ''
  const s = new Date(form.value.start)
  if (!form.value.title.trim()) { error.value = '제목 입력'; return }
  if (Number.isNaN(s.getTime()) || !(Number(form.value.hours) > 0)) { error.value = '시작 시각·진행 시간 확인'; return }
  const prizes = form.value.prizes.filter((p) => p.item.trim()).map((p, k) => ({ rank: k + 1, label: p.label.trim() || `${k + 1}등`, item: p.item.trim() }))
  if (!prizes.length) { error.value = '상품 하나 이상'; return }
  busy.value = true
  try {
    const ev = await createEvent({ title: form.value.title.trim(), startsAt: s.toISOString(), endsAt: formEnd.value.toISOString(), ticketCap: Number(form.value.cap) || 4, prizes, rules: form.value.rules.trim() })
    await loadEvents()
    selectedId.value = ev.id
  } catch (e) {
    error.value = e.message || '만들기 실패 (024 SQL 실행했는지 확인)'
  } finally { busy.value = false }
}

async function loadEvents() {
  try { events.value = await fetchEvents() } catch (e) { error.value = '이벤트 불러오기 실패 - 024 SQL 실행 필요'; events.value = [] }
  if (!selectedId.value && events.value.length) selectedId.value = events.value[0].id
}
watch(staff, (v) => v && supabase && loadEvents(), { immediate: true })
const ev = computed(() => events.value.find((e) => e.id === selectedId.value) || null)
const phase = computed(() => phaseOf(ev.value, now.value))
const PHASE_KO = { live: '진행 중', upcoming: '시작 전', ended: '종료 · 추첨 대기', announced: '발표 완료' }

// ---- 시간 고치기 (추첨 전) ----
const edit = ref(null)
function startEdit() { edit.value = { title: ev.value.title, start: toLocal(new Date(ev.value.startsAt)), end: toLocal(new Date(ev.value.endsAt)) } }
async function saveEdit() {
  error.value = ''
  try {
    await updateEvent(ev.value.id, { title: edit.value.title.trim(), startsAt: new Date(edit.value.start).toISOString(), endsAt: new Date(edit.value.end).toISOString() })
    edit.value = null
    await loadEvents()
  } catch (e) { error.value = e.message || '저장 실패' }
}
async function removeEvent() {
  if (!(await confirmDialog(`이벤트 삭제: ${ev.value.title}`))) return
  try { await deleteEvent(ev.value.id); selectedId.value = null; await loadEvents() } catch (e) { error.value = e.message }
}

// ---- 검토 ----
const posts = ref([])
const staffIds = ref(new Set())
const postsLoading = ref(false)
const OV_KEY = (id) => `d2r-event-ov-${id}`
const overrides = ref({})
function loadOverrides(id) {
  try { overrides.value = JSON.parse(localStorage.getItem(OV_KEY(id)) || '{}') } catch { overrides.value = {} }
}
function setOverride(post, auto, value) {
  const o = { ...overrides.value }
  // 자동 판단과 같아지면 기록 지움
  if (value === auto) delete o[post.id]
  else o[post.id] = value
  overrides.value = o
  try { localStorage.setItem(OV_KEY(ev.value.id), JSON.stringify(o)) } catch { /* 프라이빗 창 */ }
}
async function loadPosts() {
  if (!ev.value || phase.value === 'upcoming') { posts.value = []; return }
  postsLoading.value = true
  try {
    posts.value = await fetchEventPosts(ev.value)
    const ids = [...new Set(posts.value.map((p) => p.authorId))]
    const { data } = ids.length ? await supabase.from('tb_profile').select('id, role').in('id', ids) : { data: [] }
    staffIds.value = new Set((data || []).filter((r) => r.role === 'moderator' || r.role === 'admin').map((r) => r.id))
  } catch (e) { error.value = '판매글 불러오기 실패' } finally { postsLoading.value = false }
}
watch(selectedId, (id) => { if (id) loadOverrides(id); edit.value = null; loadPosts() })
const entries = computed(() => (ev.value ? computeEntries(posts.value, ev.value, { overrides: overrides.value, staffIds: staffIds.value }) : []))
const ticketTotal = computed(() => entries.value.reduce((s, e) => s + e.tickets, 0))
const autoOk = (x) => (x.manual ? !x.ok : x.ok) // 관리자가 바꾸기 전 자동 판단
const reviewCount = computed(() => entries.value.reduce((s, e) => s + e.posts.filter((x) => x.review && !x.manual).length, 0))

// ---- 추첨 ----
async function drawAndPublish() {
  const pool = entries.value.filter((e) => e.tickets > 0)
  if (!pool.length) { error.value = '응모권 있는 참여자가 없음'; return }
  const ok = await confirmDialog(`추첨하고 발표 - 응모자 ${pool.length}명 · 응모권 ${ticketTotal.value}장. 발표하면 다시 뽑을 수 없고 당첨자에게 알림이 가요`, { confirmText: '추첨하고 발표' })
  if (!ok) return
  busy.value = true
  error.value = ''
  try {
    const winners = drawWinners(entries.value, ev.value.prizes)
    const excluded = Object.entries(overrides.value).filter(([, v]) => v === false).map(([k]) => k)
    await saveEventResult(ev.value.id, {
      entries: pool.map((e) => ({ user_id: e.userId, nickname: e.nickname, tickets: e.tickets })),
      winners,
      excluded_posts: excluded,
    })
    await loadEvents()
  } catch (e) {
    error.value = e.message || '추첨 저장 실패'
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
          <label>진행 시간(시간) <input type="number" min="0.5" step="0.5" v-model="form.hours" class="ae-input ae-num" /></label>
          <label>1인 최대 응모권 <input type="number" min="1" max="100" v-model="form.cap" class="ae-input ae-num" /></label>
        </div>
        <div class="ae-dim" v-if="formEnd">종료: {{ fmtEventTime(formEnd.toISOString()) }}</div>
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
            <span>{{ fmtEventTime(ev.startsAt) }} ~ {{ fmtEventTime(ev.endsAt) }}</span>
            <span v-if="phase === 'live'" class="ae-dim">종료까지 {{ fmtCountdown(new Date(ev.endsAt).getTime() - now) }}</span>
            <span v-if="phase === 'upcoming'" class="ae-dim">시작까지 {{ fmtCountdown(new Date(ev.startsAt).getTime() - now) }}</span>
            <router-link :to="`/event/${ev.id}`" class="ae-link">이벤트 페이지 →</router-link>
            <template v-if="!ev.result">
              <button type="button" class="ae-btn" @click="startEdit">시간·제목 수정</button>
              <button type="button" class="ae-btn danger" @click="removeEvent">삭제</button>
            </template>
          </div>
          <div class="ae-form" v-if="edit">
            <label>제목 <input v-model="edit.title" class="ae-input" /></label>
            <label>시작 <input type="datetime-local" v-model="edit.start" class="ae-input" /></label>
            <label>종료 <input type="datetime-local" v-model="edit.end" class="ae-input" /></label>
            <button type="button" class="ae-btn primary" @click="saveEdit">저장</button>
            <button type="button" class="ae-btn" @click="edit = null">취소</button>
          </div>
          <div class="ae-dim">상품: <span v-for="p in ev.prizes" :key="p.rank" class="ae-chip">{{ p.label }} {{ p.item }}</span> · 1인 최대 {{ ev.ticketCap }}장</div>

          <!-- 발표 완료 -->
          <div v-if="ev.result" class="ae-result">
            <h3>당첨자</h3>
            <ol><li v-for="w in ev.result.winners" :key="w.rank"><b>{{ w.label }}</b> {{ w.nickname }} <span class="ae-dim">({{ w.item }} · 응모권 {{ w.tickets }}장)</span></li></ol>
            <p class="ae-dim">응모자 {{ ev.result.entries.length }}명 · 추첨 {{ new Date(ev.result.drawn_at).toLocaleString('ko-KR') }} · 당첨자에게 알림 보냄. 상품 지급은 쪽지로 안내</p>
          </div>

          <!-- 검토·추첨 -->
          <template v-else-if="phase !== 'upcoming'">
            <div class="ae-summary">
              <span>참여 <b>{{ entries.length }}</b>명</span>
              <span>응모권 <b>{{ ticketTotal }}</b>장</span>
              <span v-if="reviewCount" class="ae-review">검토 필요 {{ reviewCount }}개 (매직·레어·일반·기타)</span>
              <button type="button" class="ae-btn" @click="loadPosts" :disabled="postsLoading">새로고침</button>
              <button type="button" class="ae-btn primary" :disabled="phase !== 'ended' || busy || !ticketTotal" @click="drawAndPublish">
                {{ phase === 'ended' ? '추첨하고 발표' : '이벤트 끝나면 추첨 가능' }}
              </button>
            </div>
            <p class="ae-dim">체크를 풀면 응모권에서 제외 (잡템·허위 매물). 바꾼 내용은 이 브라우저에 저장돼서 새로고침해도 유지</p>
            <p v-if="postsLoading" class="ae-dim">불러오는 중…</p>
            <div class="ae-entry" v-for="e in entries" :key="e.userId">
              <div class="ae-entry-head"><b>{{ e.nickname }}</b> <span class="ae-dim">인정 {{ e.count }}개 →</span> <b class="ae-tickets">응모권 {{ e.tickets }}장</b></div>
              <label class="ae-post" v-for="x in e.posts" :key="x.post.id" :class="{ no: !x.ok, review: x.review && !x.manual }">
                <input type="checkbox" :checked="x.ok" @change="setOverride(x.post, autoOk(x), $event.target.checked)" />
                <router-link :to="`/trade/${x.post.id}`" target="_blank">{{ x.post.itemName }}</router-link>
                <span class="ae-dim">{{ x.post.category }} · {{ x.post.price }} · {{ new Date(x.post.createdAt).toLocaleTimeString('ko-KR') }}</span>
                <span class="ae-reason" v-if="x.reason">{{ x.reason }}</span>
                <span class="ae-reason review" v-else-if="x.review">검토</span>
              </label>
            </div>
            <p v-if="!postsLoading && !entries.length" class="ae-dim">이벤트 시간에 올라온 판매글 없음</p>
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
.ae-prizes{display:flex; flex-direction:column; gap:6px;}
.ae-prize{display:flex; gap:6px; align-items:center;}
.ae-label{width:70px;}
.ae-item{flex:1; min-width:0;}
.ae-x{color:var(--text-dim); background:transparent; border:0; cursor:pointer;}
.ae-btn{font-size:12.5px; color:var(--text-muted); border:1px solid var(--border); background:var(--panel-2); padding:7px 12px; border-radius:8px; cursor:pointer; align-self:flex-start;}
.ae-btn.primary{color:#1a1408; background:var(--gold); border-color:var(--gold); font-weight:700;}
.ae-btn.danger{color:var(--blood); border-color:var(--blood);}
.ae-btn:disabled{opacity:.45; cursor:not-allowed;}
.ae-dim{font-size:12px; color:var(--text-dim);}
.ae-tabs{display:flex; flex-wrap:wrap; gap:6px;}
.ae-tabs button{font-size:12.5px; color:var(--text-muted); border:1px solid var(--border); background:var(--panel-2); padding:6px 12px; border-radius:999px; cursor:pointer;}
.ae-tabs button.on{color:var(--gold); border-color:var(--gold-dim);}
.ae-tabs small{color:var(--text-dim); margin-left:4px;}
.ae-head{display:flex; flex-wrap:wrap; align-items:center; gap:8px 12px; font-size:13px;}
.ae-badge{font-size:11.5px; font-weight:700; padding:2px 9px; border-radius:999px; border:1px solid var(--border); color:var(--text-muted);}
.ae-badge.live{background:var(--gold); color:#1a1408; border-color:var(--gold);}
.ae-link{color:var(--gold); font-size:12.5px;}
.ae-chip{display:inline-block; margin:0 4px; color:var(--text-muted);}
.ae-summary{display:flex; flex-wrap:wrap; align-items:center; gap:8px 14px; font-size:13px;}
.ae-summary b{color:var(--gold);}
.ae-review{color:#e0a040; font-size:12px;}
.ae-entry{border-top:1px solid var(--border-soft); padding-top:10px;}
.ae-entry-head{font-size:13px; margin-bottom:6px; display:flex; gap:8px; align-items:baseline;}
.ae-tickets{color:var(--gold);}
.ae-post{display:flex; align-items:center; gap:8px; flex-wrap:wrap; font-size:12.5px; padding:4px 0 4px 6px; cursor:pointer;}
.ae-post.no a{color:var(--text-dim); text-decoration:line-through;}
.ae-post.review{background:rgba(224,160,64,.07); border-radius:6px;}
.ae-reason{font-size:11px; color:var(--blood); border:1px solid currentColor; border-radius:999px; padding:0 7px;}
.ae-reason.review{color:#e0a040;}
.ae-result ol{margin:0; padding-left:18px; display:flex; flex-direction:column; gap:4px; font-size:13.5px;}
</style>
