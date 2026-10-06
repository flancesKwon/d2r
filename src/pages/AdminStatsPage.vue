<script setup>
// 방문 통계 (/admin/stats, 운영진) - 013 SQL 의 d2r_visit_stats·d2r_visit_refs
// 방문자 = 브라우저 기준 하루 1명 (다른 기기·시크릿 창은 따로 셈), 페이지뷰 = 화면 이동 수
import { ref, computed, watch } from 'vue'
import { supabase } from '../supabase.js'
import { authState, signIn, isStaff } from '../profileStore.js'

const staff = computed(() => isStaff())
const days = ref([])
const refs = ref([])
const refDays = ref(7)
const error = ref('')
const loading = ref(false)

async function load() {
  if (!supabase || !staff.value) return
  loading.value = true
  error.value = ''
  const [s, r] = await Promise.all([
    supabase.rpc('d2r_visit_stats', { p_days: 30 }),
    supabase.rpc('d2r_visit_refs', { p_days: refDays.value }),
  ])
  loading.value = false
  if (s.error || r.error) {
    const msg = (s.error || r.error).message || ''
    error.value = /function|schema cache/i.test(msg) ? '준비 중 (013 SQL 실행 필요)' : msg || '불러오기 실패'
    return
  }
  days.value = s.data
  refs.value = r.data
}
watch(staff, load, { immediate: true })
watch(refDays, load)

const today = computed(() => days.value[days.value.length - 1] || { visitors: 0, members: 0, views: 0 })
const yesterday = computed(() => days.value[days.value.length - 2] || { visitors: 0 })
const sumLast = (n) => days.value.slice(-n).reduce((a, d) => a + d.visitors, 0)
const max = computed(() => Math.max(1, ...days.value.map((d) => d.visitors)))
const md = (s) => { const [, m, d] = String(s).split('-'); return `${Number(m)}.${Number(d)}` }
const dow = (s) => '일월화수목금토'[new Date(s + 'T00:00:00').getDay()]

// 유입 사이트 이름 (주소 -> 알아보기 쉬운 이름)
const REF_NAMES = [
  [/dcinside/, '디시인사이드'], [/inven/, '인벤'], [/arca\.live/, '아카라이브'], [/ruliweb/, '루리웹'],
  [/google\./, '구글'], [/naver\./, '네이버'], [/daum\.|kakao/, '다음·카카오'], [/discord/, '디스코드'],
  [/youtube|youtu\.be/, '유튜브'], [/chzzk/, '치지직'], [/sooplive|afreeca/, 'SOOP'], [/bing\./, '빙'],
]
const refName = (r) => (!r ? '바로 들어옴 (주소 입력·즐겨찾기)' : REF_NAMES.find(([re]) => re.test(r))?.[1] || r)
const refTotal = computed(() => refs.value.reduce((a, r) => a + r.visitors, 0) || 1)
</script>

<template>
  <div class="items-page admin-stats-page">
    <div class="patch-hero">
      <div class="patch-hero-inner">
        <div class="eyebrow">관리자</div>
        <h1>방문 통계</h1>
      </div>
    </div>

    <div class="grid-wrap st-wrap" v-if="!authState.user">
      <div class="st-empty"><p>로그인 필요</p><button type="button" class="btn-primary" @click="signIn">로그인</button></div>
    </div>
    <div class="grid-wrap st-wrap" v-else-if="!staff">
      <div class="st-empty">운영진만 볼 수 있음</div>
    </div>

    <div class="grid-wrap st-wrap" v-else>
      <router-link to="/admin" class="st-back">← 관리자</router-link>
      <div class="st-error" v-if="error">{{ error }}</div>

      <div class="st-cards">
        <div class="st-card main"><div class="label">오늘 방문자</div><div class="value">{{ today.visitors.toLocaleString() }}</div><div class="sub">회원 {{ today.members }} · 페이지뷰 {{ today.views.toLocaleString() }}</div></div>
        <div class="st-card"><div class="label">어제 방문자</div><div class="value">{{ yesterday.visitors.toLocaleString() }}</div></div>
        <div class="st-card"><div class="label">최근 7일</div><div class="value">{{ sumLast(7).toLocaleString() }}</div><div class="sub">하루 평균 {{ Math.round(sumLast(7) / 7) }}</div></div>
        <div class="st-card"><div class="label">최근 30일</div><div class="value">{{ sumLast(30).toLocaleString() }}</div></div>
      </div>

      <section class="st-panel">
        <div class="st-title">일별 방문자 <small>최근 30일</small></div>
        <div class="st-chart" v-if="days.length">
          <div class="st-bar-col" v-for="d in days" :key="d.day" :title="`${d.day} (${dow(d.day)}) 방문자 ${d.visitors} · 회원 ${d.members} · 페이지뷰 ${d.views}`">
            <span class="st-bar-num" v-if="d.visitors">{{ d.visitors }}</span>
            <div class="st-bar" :style="{ height: (d.visitors / max) * 100 + '%' }">
              <div class="st-bar-member" :style="{ height: d.visitors ? (d.members / d.visitors) * 100 + '%' : 0 }"></div>
            </div>
            <span class="st-bar-day" :class="{ sun: dow(d.day) === '일' }">{{ md(d.day) }}</span>
          </div>
        </div>
        <div class="st-legend"><span class="sw all"></span>방문자 <span class="sw mem"></span>그중 회원</div>
      </section>

      <section class="st-panel">
        <div class="st-title-row">
          <div class="st-title">유입 경로 <small>처음 들어온 곳 기준</small></div>
          <div class="cat-tabs">
            <button v-for="n in [1, 7, 30]" :key="n" :class="{ active: refDays === n }" @click="refDays = n">{{ n === 1 ? '오늘' : n + '일' }}</button>
          </div>
        </div>
        <div class="st-ref" v-for="r in refs" :key="r.ref || '-'">
          <span class="st-ref-name">{{ refName(r.ref) }}<small v-if="r.ref && refName(r.ref) !== r.ref">{{ r.ref }}</small></span>
          <span class="st-ref-bar"><span :style="{ width: (r.visitors / refTotal) * 100 + '%' }"></span></span>
          <span class="st-ref-num">{{ r.visitors }}</span>
        </div>
        <div class="st-none" v-if="!refs.length && !loading">기록 없음</div>
      </section>
      <p class="st-note">방문자는 브라우저 기준 하루 1명 (다른 기기·시크릿 창은 따로 셈). IP·개인정보는 저장 안 함.</p>
    </div>
  </div>
</template>

<style scoped>
.st-wrap{max-width:1080px; display:flex; flex-direction:column; gap:16px;}
.st-back{font-size:13px; color:var(--text-dim); align-self:flex-start;}
.st-back:hover{color:var(--gold);}
.st-empty{display:flex; flex-direction:column; align-items:center; gap:14px; padding:48px 16px; color:var(--text-muted); font-size:14px;}
.st-error{font-size:13px; color:#e0775f; border:1px solid var(--blood); border-radius:10px; padding:10px 14px;}
.st-cards{display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); gap:10px;}
.st-card{background:var(--panel); border:1px solid var(--border-soft); border-radius:14px; padding:16px 18px;}
.st-card.main{border-color:var(--gold-dim);}
.st-card .label{font-size:12px; color:var(--text-dim);}
.st-card .value{font-family:'Noto Serif KR', serif; font-size:28px; font-weight:700; color:var(--text); margin-top:4px;}
.st-card.main .value{color:var(--gold);}
.st-card .sub{font-size:11.5px; color:var(--text-dim); margin-top:2px;}
.st-panel{background:var(--panel); border:1px solid var(--border-soft); border-radius:16px; padding:18px 20px; display:flex; flex-direction:column; gap:12px;}
.st-title{font-family:'Noto Serif KR', serif; font-size:16px; font-weight:700;}
.st-title small{font-family:'Noto Sans KR', sans-serif; font-size:12px; font-weight:400; color:var(--text-dim); margin-left:6px;}
.st-title-row{display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap;}
.st-title-row .cat-tabs button{border-radius:999px;}
.st-chart{display:grid; grid-template-columns:repeat(30, minmax(0, 1fr)); gap:4px; height:200px; align-items:end;}
.st-bar-col{display:flex; flex-direction:column; align-items:center; justify-content:flex-end; height:100%; min-width:0;}
.st-bar-num{font-size:10px; color:var(--text-muted); margin-bottom:2px;}
.st-bar{width:100%; max-width:22px; background:var(--gold-dim); border-radius:4px 4px 0 0; min-height:2px; display:flex; align-items:flex-end; overflow:hidden; flex:none;}
.st-bar-member{width:100%; background:var(--gold);}
.st-bar-day{font-size:9.5px; color:var(--text-dim); margin-top:4px; white-space:nowrap;}
.st-bar-day.sun{color:#e0775f;}
.st-legend{display:flex; align-items:center; gap:6px; font-size:11.5px; color:var(--text-dim);}
.sw{width:10px; height:10px; border-radius:2px; display:inline-block; margin-left:8px;}
.sw.all{background:var(--gold-dim); margin-left:0;}
.sw.mem{background:var(--gold);}
.st-ref{display:grid; grid-template-columns:minmax(0, 220px) 1fr 48px; align-items:center; gap:10px; font-size:13px;}
.st-ref-name{display:flex; flex-direction:column; color:var(--text); min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.st-ref-name small{font-size:10.5px; color:var(--text-dim);}
.st-ref-bar{height:8px; background:var(--panel-2); border-radius:999px; overflow:hidden;}
.st-ref-bar span{display:block; height:100%; background:var(--gold-dim); border-radius:999px;}
.st-ref-num{text-align:right; color:var(--gold); font-weight:600;}
.st-none{font-size:12.5px; color:var(--text-dim);}
.st-note{font-size:11.5px; color:var(--text-dim);}
@media (max-width:760px){
  .st-cards{grid-template-columns:1fr 1fr;}
  .st-chart{gap:2px; height:160px;}
  .st-bar-num{display:none;}
  .st-bar-day{font-size:8px; writing-mode:vertical-rl;}
  .st-ref{grid-template-columns:minmax(0, 130px) 1fr 36px;}
}
</style>
