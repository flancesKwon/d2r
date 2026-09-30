<script setup>
// 관리자 - 운영진(moderator)·최고관리자(admin)만. 권한은 DB(RLS + 트리거)가 확인하고 화면은 보여주기만 함
// - 신고: 처리 대기 목록, 처리/기각, 신고된 글 삭제, 작성자 정지
// - 회원: 닉네임 검색, 이용 정지/해제 (운영진·관리자 정지는 최고관리자만), 등급 변경(최고관리자만)
// - 최근 글: 커뮤니티·거래 글 삭제
// 신고·정지는 supabase/002_reports_suspension.sql 을 실행해야 켜짐 - 안 돌렸으면 안내만 띄우고 나머지는 그대로 동작
import { ref, computed, watch } from 'vue'
import { supabase, mustReturnRows } from '../supabase.js'
import { authState, signIn, isStaff, isAdmin, ROLE_LABEL, suspendedUntil, suspensionText } from '../profileStore.js'
import { formatDate } from '../communityStore.js'
import {
  REPORT_REASON_LABEL, REPORT_TARGET_LABEL, REPORT_STATUS_LABEL, isMissingSchema,
  fetchReports, countOpenReports, setReportStatus, deleteReport, reportTargetLink, canDeleteTarget, deleteReportTarget,
} from '../reportStore.js'

const staff = computed(() => isStaff())
const admin = computed(() => isAdmin())
const stats = ref({ members: 0, newToday: 0, communityPosts: 0, tradePosts: 0, openReports: 0 })
const members = ref([])
const memberQuery = ref('')
const recentCommunity = ref([])
const recentTrade = ref([])
const reports = ref([])
const reportFilter = ref('open')
const actionError = ref('')
// 002 SQL 적용 여부 (신고 테이블·정지 컬럼)
const schemaReady = ref(true)

const ROLES = ['user', 'moderator', 'admin']
const SUSPEND_OPTIONS = [
  { value: '1', label: '1일' },
  { value: '7', label: '7일' },
  { value: '30', label: '30일' },
  { value: 'forever', label: '영구' },
]

async function count(table, apply = (q) => q) {
  const { count: n, error } = await apply(supabase.from(table).select('*', { count: 'exact', head: true }))
  if (error) throw error
  return n || 0
}
async function loadStats() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const [m, t, c, tr] = await Promise.all([
    count('tb_profile'),
    count('tb_profile', (q) => q.gte('created_at', today.toISOString())),
    count('tb_community_post', (q) => q.is('deleted_at', null)),
    count('tb_trade_post', (q) => q.is('deleted_at', null)),
  ])
  const openReports = await countOpenReports().catch(() => 0)
  stats.value = { members: m, newToday: t, communityPosts: c, tradePosts: tr, openReports }
}
async function loadMembers() {
  const build = (cols) => {
    let q = supabase.from('tb_profile').select(cols).order('created_at', { ascending: false }).limit(50)
    const term = memberQuery.value.trim().replace(/[%,()*\\]/g, '')
    if (term) q = q.ilike('nickname', `%${term}%`)
    return q
  }
  let { data, error } = await build('id, nickname, contact, role, created_at, suspended_until, suspended_reason')
  if (isMissingSchema(error)) {
    schemaReady.value = false
    ;({ data, error } = await build('id, nickname, contact, role, created_at'))
  }
  if (error) throw error
  members.value = data || []
}
async function loadReports() {
  try {
    reports.value = await fetchReports(reportFilter.value || null)
  } catch (e) {
    if (isMissingSchema(e)) schemaReady.value = false
    reports.value = []
  }
}
async function loadRecent() {
  const [{ data: c }, { data: t }] = await Promise.all([
    supabase.from('tb_community_post').select('id, title, category, created_at, author:tb_profile!tb_community_post_author_id_fkey(nickname)')
      .is('deleted_at', null).order('created_at', { ascending: false }).limit(20),
    supabase.from('tb_trade_post').select('id, item_name, category, created_at, author:tb_profile!tb_trade_post_author_id_fkey(nickname)')
      .is('deleted_at', null).order('created_at', { ascending: false }).limit(20),
  ])
  recentCommunity.value = c || []
  recentTrade.value = t || []
}
function loadAll() {
  if (!supabase || !staff.value) return
  loadStats().catch(() => {})
  loadMembers().catch(() => {})
  loadReports()
  loadRecent().catch(() => {})
}
watch(staff, loadAll, { immediate: true })
watch(reportFilter, loadReports)
let searchTimer = 0
watch(memberQuery, () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => loadMembers().catch(() => {}), 300) })

async function run(fn) {
  actionError.value = ''
  try {
    await fn()
  } catch (e) {
    actionError.value = e.message || '처리 실패'
  }
}

// ── 회원
const memberSuspended = (m) => suspendedUntil(m)
// 운영진·관리자는 최고관리자만 정지 가능, 본인은 불가 (DB 트리거와 같은 규칙)
const canSuspend = (m) => schemaReady.value && m.id !== authState.user?.id && (admin.value || m.role === 'user' || !m.role)

async function setRole(m, role, event) {
  // 취소·실패하면 셀렉트를 원래 등급으로 되돌림
  const revert = () => { if (event) event.target.value = m.role }
  if (role === m.role) return
  if (m.id === authState.user?.id && role !== 'admin' && !confirm('내 최고관리자 권한 해제 - 되돌리려면 다른 최고관리자 필요')) return revert()
  await run(async () => {
    const rows = await mustReturnRows(supabase.from('tb_profile').update({ role }).eq('id', m.id).select('role'), '등급 변경 실패')
    m.role = rows[0].role
  })
  revert()
}
function suspend(m, option, event) {
  if (event) event.target.value = ''
  if (!option) return
  const label = SUSPEND_OPTIONS.find((o) => o.value === option)?.label
  const reason = prompt(`${m.nickname} 님을 ${label} 정지 - 사유 입력 (본인에게 보임)`, '')
  if (reason === null) return
  const until = option === 'forever' ? 'infinity' : new Date(Date.now() + Number(option) * 86400000).toISOString()
  return run(async () => {
    const rows = await mustReturnRows(
      supabase.from('tb_profile').update({ suspended_until: until, suspended_reason: reason.trim().slice(0, 200) || null })
        .eq('id', m.id).select('suspended_until, suspended_reason'),
      '정지 실패'
    )
    Object.assign(m, rows[0])
    syncReportAuthors(m)
  })
}
function unsuspend(m) {
  if (!confirm(`${m.nickname} 님 정지 해제`)) return
  return run(async () => {
    const rows = await mustReturnRows(
      supabase.from('tb_profile').update({ suspended_until: null, suspended_reason: null }).eq('id', m.id).select('suspended_until, suspended_reason'),
      '정지 해제 실패'
    )
    Object.assign(m, rows[0])
    syncReportAuthors(m)
  })
}
function syncReportAuthors(m) {
  for (const r of reports.value) if (r.target_author?.id === m.id) r.target_author.suspended_until = m.suspended_until
}

// ── 신고
function changeReport(r, status) {
  return run(async () => {
    const row = await setReportStatus(r.id, status)
    const wasOpen = r.status === 'open'
    Object.assign(r, row)
    if (wasOpen !== (status === 'open')) stats.value.openReports = Math.max(0, stats.value.openReports + (status === 'open' ? 1 : -1))
    if (reportFilter.value && reportFilter.value !== status) reports.value = reports.value.filter((x) => x.id !== r.id)
  })
}
function removeReportTarget(r) {
  if (!confirm(`신고된 ${REPORT_TARGET_LABEL[r.target_type]}삭제 후 신고 처리함으로 변경`)) return
  return run(async () => {
    await deleteReportTarget(r)
    await changeReport(r, 'resolved')
  })
}
function suspendReportAuthor(r, option, event) {
  const a = r.target_author
  if (!a) return
  const m = members.value.find((x) => x.id === a.id) || { ...a }
  return suspend(m, option, event)?.then(() => { a.suspended_until = m.suspended_until })
}
function removeReport(r) {
  if (!confirm('신고 기록 삭제')) return
  return run(async () => {
    await deleteReport(r.id)
    reports.value = reports.value.filter((x) => x.id !== r.id)
    if (r.status === 'open') stats.value.openReports = Math.max(0, stats.value.openReports - 1)
  })
}
const reportFilters = [
  { value: 'open', label: '처리 대기' },
  { value: 'resolved', label: '처리함' },
  { value: 'dismissed', label: '기각' },
  { value: '', label: '전체' },
]
const canSuspendAuthor = (r) => r.target_author && canSuspend(r.target_author)

// ── 최근 글
function removeCommunityPost(p) {
  if (!confirm(`"${p.title}" 글 삭제`)) return
  return run(async () => {
    await mustReturnRows(supabase.from('tb_community_post').delete().eq('id', p.id).select('id'), '삭제 실패')
    recentCommunity.value = recentCommunity.value.filter((x) => x.id !== p.id)
    stats.value.communityPosts--
  })
}
function removeTradePost(p) {
  if (!confirm(`"${p.item_name}" 판매글 삭제`)) return
  return run(async () => {
    await mustReturnRows(supabase.from('tb_trade_post').delete().eq('id', p.id).select('id'), '삭제 실패')
    recentTrade.value = recentTrade.value.filter((x) => x.id !== p.id)
    stats.value.tradePosts--
  })
}
</script>

<template>
  <div class="items-page admin-page">

  <div class="patch-hero">
    <div class="patch-hero-inner">
      <div class="eyebrow">운영 도구</div>
      <h1>관리자 페이지</h1>
    </div>
  </div>

  <div class="grid-wrap admin-wrap admin-gate" v-if="!authState.user">
    <p>운영진 계정 로그인 필요</p>
    <button type="button" class="btn-primary" @click="signIn">로그인</button>
  </div>
  <div class="grid-wrap admin-wrap admin-gate" v-else-if="!staff">
    <p>운영진 전용</p>
  </div>

  <div class="grid-wrap admin-wrap" v-else>
    <div class="admin-notice" v-if="!schemaReady">
      신고·이용 정지 꺼짐 - Supabase SQL Editor 에서 <code>supabase/002_reports_suspension.sql</code> 실행 필요
    </div>

    <div class="admin-stat-row">
      <div class="admin-stat-card">
        <div class="label">처리 대기 신고</div>
        <div class="value" :class="{ warn: stats.openReports > 0 }">{{ stats.openReports }}</div>
      </div>
      <div class="admin-stat-card">
        <div class="label">총 회원</div>
        <div class="value">{{ stats.members.toLocaleString() }}</div>
      </div>
      <div class="admin-stat-card">
        <div class="label">오늘 신규가입</div>
        <div class="value accent">+{{ stats.newToday }}</div>
      </div>
      <div class="admin-stat-card">
        <div class="label">커뮤니티 글</div>
        <div class="value">{{ stats.communityPosts.toLocaleString() }}</div>
      </div>
      <div class="admin-stat-card">
        <div class="label">판매글</div>
        <div class="value">{{ stats.tradePosts.toLocaleString() }}</div>
      </div>
    </div>
    <div class="admin-error" v-if="actionError">{{ actionError }}</div>

    <template v-if="schemaReady">
      <div class="d-section-title">신고</div>
      <div class="admin-filter-row" role="radiogroup" aria-label="신고 상태">
        <button
          v-for="f in reportFilters" :key="f.value" type="button" role="radio"
          :aria-checked="reportFilter === f.value" :class="{ active: reportFilter === f.value }" @click="reportFilter = f.value"
        >{{ f.label }}</button>
      </div>
      <div class="affix-list admin-report-list">
        <div class="affix-line admin-report-line" v-for="r in reports" :key="'r' + r.id">
          <div class="admin-report-info">
            <div class="admin-report-head">
              <span class="admin-badge">{{ REPORT_TARGET_LABEL[r.target_type] }}</span>
              <span class="admin-badge reason">{{ REPORT_REASON_LABEL[r.reason] }}</span>
              <span class="admin-badge" :class="'st-' + r.status">{{ REPORT_STATUS_LABEL[r.status] }}</span>
              <router-link v-if="reportTargetLink(r)" :to="reportTargetLink(r)" class="a-text admin-report-target">{{ r.target_label || '(내용 없음)' }}</router-link>
              <span v-else class="admin-report-target">{{ r.target_label }}</span>
            </div>
            <div class="admin-report-detail" v-if="r.detail">{{ r.detail }}</div>
            <span class="admin-report-meta">
              작성자 {{ r.target_author?.nickname || '탈퇴한 회원' }}<template v-if="r.target_author && suspendedUntil(r.target_author)"> ({{ suspensionText(suspendedUntil(r.target_author)) }})</template>
              · 신고 {{ r.reporter?.nickname || '탈퇴한 회원' }} · {{ formatDate(r.created_at) }}
              <template v-if="r.handler"> · 처리 {{ r.handler.nickname }}</template>
            </span>
          </div>
          <div class="admin-report-actions">
            <template v-if="r.status === 'open'">
              <button class="admin-action-btn danger" v-if="canDeleteTarget(r)" @click="removeReportTarget(r)">글 삭제</button>
              <select class="admin-action-select" v-if="canSuspendAuthor(r)" aria-label="작성자 정지" @change="suspendReportAuthor(r, $event.target.value, $event)">
                <option value="">작성자 정지…</option>
                <option v-for="o in SUSPEND_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
              </select>
              <button class="admin-action-btn" @click="changeReport(r, 'resolved')">처리함</button>
              <button class="admin-action-btn" @click="changeReport(r, 'dismissed')">기각</button>
            </template>
            <template v-else>
              <button class="admin-action-btn" @click="changeReport(r, 'open')">다시 열기</button>
              <button class="admin-action-btn" v-if="admin" @click="removeReport(r)">기록 삭제</button>
            </template>
          </div>
        </div>
        <div class="empty-state" v-if="!reports.length">{{ reportFilter === 'open' ? '처리할 신고 없음' : '신고 없음' }}</div>
      </div>
    </template>

    <div class="d-section-title">회원 관리</div>
    <input type="search" v-model="memberQuery" class="admin-search" placeholder="닉네임 검색" aria-label="회원 닉네임 검색" />
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead>
          <tr>
            <th>닉네임</th>
            <th>연락처</th>
            <th>가입일</th>
            <th>등급</th>
            <th>상태</th>
            <th>작업</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="m in members" :key="m.id">
            <td class="admin-nick">{{ m.nickname }}</td>
            <td class="admin-dim">{{ m.contact || '-' }}</td>
            <td class="admin-dim">{{ formatDate(m.created_at) }}</td>
            <td>
              <select v-if="admin" class="admin-action-select" :value="m.role" :aria-label="`${m.nickname} 등급`" @change="setRole(m, $event.target.value, $event)">
                <option v-for="r in ROLES" :key="r" :value="r">{{ ROLE_LABEL[r] }}</option>
              </select>
              <span v-else class="admin-badge" :class="'role-' + m.role">{{ ROLE_LABEL[m.role] || m.role }}</span>
            </td>
            <td>
              <span class="admin-badge st-suspended" v-if="memberSuspended(m)" :title="m.suspended_reason || ''">{{ suspensionText(memberSuspended(m)) }}</span>
              <span class="admin-dim" v-else>정상</span>
            </td>
            <td>
              <template v-if="canSuspend(m)">
                <button class="admin-action-btn" v-if="memberSuspended(m)" @click="unsuspend(m)">정지 해제</button>
                <select v-else class="admin-action-select" :aria-label="`${m.nickname} 정지`" @change="suspend(m, $event.target.value, $event)">
                  <option value="">정지…</option>
                  <option v-for="o in SUSPEND_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
                </select>
              </template>
              <span class="admin-dim" v-else>-</span>
            </td>
          </tr>
          <tr v-if="!members.length"><td colspan="6" class="admin-dim">회원 없음</td></tr>
        </tbody>
      </table>
    </div>

    <div class="d-section-title">최근 커뮤니티 글</div>
    <div class="affix-list admin-report-list">
      <div class="affix-line admin-report-line" v-for="p in recentCommunity" :key="'c' + p.id">
        <div class="admin-report-info">
          <router-link :to="`/community/${p.id}`" class="a-text">{{ p.title }}</router-link>
          <span class="admin-report-meta">{{ p.category }} · {{ p.author?.nickname }} · {{ formatDate(p.created_at) }}</span>
        </div>
        <button class="admin-action-btn" @click="removeCommunityPost(p)">삭제</button>
      </div>
      <div class="empty-state" v-if="!recentCommunity.length">글 없음</div>
    </div>

    <div class="d-section-title">최근 판매글</div>
    <div class="affix-list admin-report-list">
      <div class="affix-line admin-report-line" v-for="p in recentTrade" :key="'t' + p.id">
        <div class="admin-report-info">
          <router-link :to="`/trade/${p.id}`" class="a-text">{{ p.item_name }}</router-link>
          <span class="admin-report-meta">{{ p.category }} · {{ p.author?.nickname }} · {{ formatDate(p.created_at) }}</span>
        </div>
        <button class="admin-action-btn" @click="removeTradePost(p)">삭제</button>
      </div>
      <div class="empty-state" v-if="!recentTrade.length">판매글 없음</div>
    </div>
  </div>
  </div>
</template>

<style scoped>
.admin-wrap{max-width:1000px;}
.admin-gate{display:flex; flex-direction:column; align-items:center; gap:14px; padding:48px 16px; color:var(--text-muted); font-size:14px;}

.admin-stat-row{display:grid; grid-template-columns:repeat(5, 1fr); gap:1px; background:var(--border-soft); border:1px solid var(--border-soft); margin-bottom:32px;}
.admin-stat-card{background:var(--panel); padding:18px 16px;}
.admin-stat-card .label{font-size:11.5px; color:var(--text-dim); margin-bottom:8px;}
.admin-stat-card .value{font-size:22px; font-weight:700; color:var(--text); font-family:'Noto Serif KR', serif;}
.admin-stat-card .value.accent{color:var(--green);}
.admin-stat-card .value.warn{color:#e0775f;}
.admin-error{font-size:12.5px; color:#e0775f; margin:-20px 0 20px;}

.admin-search{width:100%; max-width:280px; margin-bottom:10px; background:var(--panel); border:1px solid var(--border); color:var(--text); font-size:13px; padding:8px 12px; border-radius:10px;}
.admin-table-wrap{overflow-x:auto; margin-bottom:32px; border:1px solid var(--border-soft);}
.admin-table{width:100%; border-collapse:collapse; font-size:13px; min-width:560px;}
.admin-table th{
  text-align:left; padding:11px 14px; font-size:11.5px; color:var(--text-dim); font-weight:600;
  background:var(--panel-2); border-bottom:1px solid var(--border-soft); white-space:nowrap;
}
.admin-table td{padding:12px 14px; border-bottom:1px solid var(--border-soft); vertical-align:middle;}
.admin-table tr:last-child td{border-bottom:none;}
.admin-nick{color:var(--text); font-weight:600;}
.admin-dim{color:var(--text-muted); font-size:12.5px; white-space:nowrap;}

.admin-badge{
  display:inline-flex; align-items:center; gap:4px; font-size:11.5px; padding:4px 10px;
  border:1px solid var(--border); color:var(--text-muted); background:var(--panel-2); white-space:nowrap;
}
.admin-badge.role-admin{color:var(--gold); border-color:var(--gold-dim);}
.admin-badge.role-moderator{color:var(--gold-dim);}
.admin-badge.reason{color:var(--text);}
.admin-badge.st-open{color:#e0775f; border-color:#6b2a1f;}
.admin-badge.st-suspended{color:#e0775f; border-color:#6b2a1f;}
.admin-notice{font-size:13px; color:var(--text-muted); border:1px solid var(--gold-dim); background:var(--panel); padding:12px 16px; margin-bottom:24px; line-height:1.6;}
.admin-notice code{color:var(--gold); font-size:12.5px;}
.admin-filter-row{display:flex; flex-wrap:wrap; gap:6px; margin-bottom:10px;}
.admin-filter-row button{font-size:12px; color:var(--text-muted); border:1px solid var(--border); padding:6px 12px;}
.admin-filter-row button.active{color:var(--gold); border-color:var(--gold-dim); background:var(--panel-2);}
.admin-action-select{font-size:11.5px; color:var(--text-muted); background:var(--panel); border:1px solid var(--border); padding:5px 8px;}
.admin-action-btn.danger:hover{color:#e0775f; border-color:#e0775f;}

.admin-action-btn{font-size:11.5px; color:var(--text-muted); border:1px solid var(--border); padding:6px 12px; white-space:nowrap;}
.admin-action-btn:hover{border-color:var(--gold-dim); color:var(--gold);}

.admin-report-list{margin-bottom:28px;}
.admin-report-line{display:flex; align-items:center; justify-content:space-between; gap:14px; flex-wrap:wrap;}
.admin-report-info{display:flex; flex-direction:column; gap:4px; min-width:0; flex:1 1 320px;}
.admin-report-head{display:flex; flex-wrap:wrap; align-items:center; gap:6px;}
.admin-report-target{color:var(--text); overflow-wrap:anywhere;}
.admin-report-detail{font-size:12.5px; color:var(--text-muted); white-space:pre-wrap; overflow-wrap:anywhere;}
.admin-report-actions{display:flex; flex-wrap:wrap; gap:6px; align-items:center;}
.admin-report-info a:hover{color:var(--gold);}
.admin-report-meta{font-size:11.5px; color:var(--text-dim);}

@media (max-width:900px){
  .admin-stat-row{grid-template-columns:repeat(3, 1fr);}
}
@media (max-width:700px){
  .admin-stat-row{grid-template-columns:1fr 1fr;}
  .admin-stat-card:first-child{grid-column:1 / -1;}
}
</style>
