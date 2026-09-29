<script setup>
// 관리자 - tb_profile.role = 'admin' 인 사람만. 권한은 DB(is_admin + RLS)가 확인하고 화면은 보여주기만 함
// - 회원: 닉네임 검색, 관리자 지정/해제 (본인 등급은 DB 트리거가 관리자만 바꿀 수 있게 막음)
// - 최근 글: 커뮤니티·거래 글 삭제 (관리자는 남의 글도 지울 수 있음 - RLS)
import { ref, computed, watch } from 'vue'
import { supabase, mustReturnRows } from '../supabase.js'
import { authState, signIn } from '../profileStore.js'
import { formatDate } from '../communityStore.js'

const isAdmin = computed(() => authState.profile?.role === 'admin')
const stats = ref({ members: 0, newToday: 0, communityPosts: 0, tradePosts: 0 })
const members = ref([])
const memberQuery = ref('')
const recentCommunity = ref([])
const recentTrade = ref([])
const actionError = ref('')

async function count(table, apply = (q) => q) {
  const { count: n } = await apply(supabase.from(table).select('*', { count: 'exact', head: true }))
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
  stats.value = { members: m, newToday: t, communityPosts: c, tradePosts: tr }
}
async function loadMembers() {
  let q = supabase.from('tb_profile').select('id, nickname, contact, role, created_at').order('created_at', { ascending: false }).limit(50)
  const term = memberQuery.value.trim().replace(/[%,()*\\]/g, '')
  if (term) q = q.ilike('nickname', `%${term}%`)
  const { data } = await q
  members.value = data || []
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
  if (!supabase || !isAdmin.value) return
  loadStats().catch(() => {})
  loadMembers().catch(() => {})
  loadRecent().catch(() => {})
}
watch(isAdmin, loadAll, { immediate: true })
let searchTimer = 0
watch(memberQuery, () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => loadMembers().catch(() => {}), 300) })

async function run(fn) {
  actionError.value = ''
  try {
    await fn()
  } catch (e) {
    actionError.value = e.message || '처리하지 못했어요'
  }
}
function setRole(m, role) {
  if (m.id === authState.user?.id && role !== 'admin' && !confirm('내 관리자 권한을 해제할까요? 다시 되돌리려면 다른 관리자가 필요해요.')) return
  return run(async () => {
    const rows = await mustReturnRows(supabase.from('tb_profile').update({ role }).eq('id', m.id).select('role'), '등급을 바꾸지 못했어요')
    m.role = rows[0].role
  })
}
function removeCommunityPost(p) {
  if (!confirm(`"${p.title}" 글을 삭제할까요?`)) return
  return run(async () => {
    await mustReturnRows(supabase.from('tb_community_post').delete().eq('id', p.id).select('id'), '삭제하지 못했어요')
    recentCommunity.value = recentCommunity.value.filter((x) => x.id !== p.id)
    stats.value.communityPosts--
  })
}
function removeTradePost(p) {
  if (!confirm(`"${p.item_name}" 판매글을 삭제할까요?`)) return
  return run(async () => {
    await mustReturnRows(supabase.from('tb_trade_post').delete().eq('id', p.id).select('id'), '삭제하지 못했어요')
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
      <p>회원 등급과 게시글을 관리해요.</p>
    </div>
  </div>

  <div class="grid-wrap admin-wrap admin-gate" v-if="!authState.user">
    <p>관리자 계정으로 로그인해주세요.</p>
    <button type="button" class="btn-primary" @click="signIn">디스코드로 로그인</button>
  </div>
  <div class="grid-wrap admin-wrap admin-gate" v-else-if="!isAdmin">
    <p>관리자만 볼 수 있는 페이지예요.</p>
  </div>

  <div class="grid-wrap admin-wrap" v-else>
    <div class="admin-stat-row">
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
            <th>작업</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="m in members" :key="m.id">
            <td class="admin-nick">{{ m.nickname }}</td>
            <td class="admin-dim">{{ m.contact || '-' }}</td>
            <td class="admin-dim">{{ formatDate(m.created_at) }}</td>
            <td><span class="admin-badge" :class="'role-' + m.role">{{ m.role === 'admin' ? '관리자' : '일반' }}</span></td>
            <td>
              <button class="admin-action-btn" v-if="m.role === 'admin'" @click="setRole(m, 'user')">관리자 해제</button>
              <button class="admin-action-btn" v-else @click="setRole(m, 'admin')">관리자로 지정</button>
            </td>
          </tr>
          <tr v-if="!members.length"><td colspan="5" class="admin-dim">회원이 없어요</td></tr>
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
      <div class="empty-state" v-if="!recentCommunity.length">글이 없어요</div>
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
      <div class="empty-state" v-if="!recentTrade.length">판매글이 없어요</div>
    </div>
  </div>
  </div>
</template>

<style scoped>
.admin-wrap{max-width:1000px;}
.admin-gate{display:flex; flex-direction:column; align-items:center; gap:14px; padding:48px 16px; color:var(--text-muted); font-size:14px;}

.admin-stat-row{display:grid; grid-template-columns:repeat(4, 1fr); gap:1px; background:var(--border-soft); border:1px solid var(--border-soft); margin-bottom:32px;}
.admin-stat-card{background:var(--panel); padding:18px 16px;}
.admin-stat-card .label{font-size:11.5px; color:var(--text-dim); margin-bottom:8px;}
.admin-stat-card .value{font-size:22px; font-weight:700; color:var(--text); font-family:'Noto Serif KR', serif;}
.admin-stat-card .value.accent{color:var(--green);}
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

.admin-action-btn{font-size:11.5px; color:var(--text-muted); border:1px solid var(--border); padding:6px 12px; white-space:nowrap;}
.admin-action-btn:hover{border-color:var(--gold-dim); color:var(--gold);}

.admin-report-list{margin-bottom:28px;}
.admin-report-line{display:flex; align-items:center; justify-content:space-between; gap:14px; flex-wrap:wrap;}
.admin-report-info{display:flex; flex-direction:column; gap:4px;}
.admin-report-info a:hover{color:var(--gold);}
.admin-report-meta{font-size:11.5px; color:var(--text-dim);}

@media (max-width:700px){
  .admin-stat-row{grid-template-columns:1fr 1fr;}
}
</style>
