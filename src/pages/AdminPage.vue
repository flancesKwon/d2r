<script setup>
import HeaderNotifications from '../components/HeaderNotifications.vue'
import LogoMark from '../components/LogoMark.vue'
import { reactive, ref } from 'vue'
import mock from '../data/adminMock.json'

const stats = mock.stats
const members = reactive(mock.members.map((m) => ({ ...m })))
const reports = reactive(mock.reports.map((r) => ({ ...r })))
const roleMenuOpenId = ref(null)
const ROLES = ['일반', '운영진', '최고관리자']

function toggleStatus(m) {
  m.status = m.status === '정상' ? '정지' : '정상'
}

function setRole(m, role) {
  m.role = role
  roleMenuOpenId.value = null
}

function resolveReport(id) {
  const idx = reports.findIndex((r) => r.id === id)
  if (idx !== -1) reports.splice(idx, 1)
}
</script>

<template>
  <div class="items-page admin-page">
  <header>
    <div class="logo">
      <router-link to="/" style="display: flex; align-items: center; gap: 8px; color: inherit">
        <LogoMark />디아허브
      </router-link>
    </div>
    <div class="crumb"><router-link to="/">메인</router-link> / <b>관리자</b></div>
    <HeaderNotifications />
  </header>

  <div class="patch-hero">
    <div class="patch-hero-inner">
      <div class="eyebrow">운영 도구</div>
      <h1>관리자 페이지</h1>
      <p>회원·신고 현황을 한눈에 보는 화면이에요.</p>
    </div>
  </div>

  <div class="grid-wrap admin-wrap">
    <div class="note-box admin-preview-note">
      디자인 미리보기예요 — 실제 권한 검사(로그인한 사람이 진짜 관리자인지)와 서버 연동은 아직 없고, 여기서 바꾼 값도 새로고침하면 원래대로 돌아가요.
    </div>

    <div class="admin-stat-row">
      <div class="admin-stat-card">
        <div class="label">총 회원</div>
        <div class="value">{{ stats.totalMembers.toLocaleString() }}</div>
      </div>
      <div class="admin-stat-card">
        <div class="label">오늘 신규가입</div>
        <div class="value accent">+{{ stats.newToday }}</div>
      </div>
      <div class="admin-stat-card">
        <div class="label">총 게시글</div>
        <div class="value">{{ stats.totalPosts.toLocaleString() }}</div>
      </div>
      <div class="admin-stat-card">
        <div class="label">신고 대기</div>
        <div class="value" :class="{ warn: reports.length > 0 }">{{ reports.length }}</div>
      </div>
    </div>

    <div class="d-section-title">회원 관리</div>
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead>
          <tr>
            <th>닉네임</th>
            <th>이메일</th>
            <th>가입일</th>
            <th>등급</th>
            <th>상태</th>
            <th>작업</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="m in members" :key="m.id">
            <td class="admin-nick">{{ m.nickname }}</td>
            <td class="admin-dim">{{ m.email }}</td>
            <td class="admin-dim">{{ m.joined }}</td>
            <td>
              <div class="admin-role-wrap">
                <button class="admin-badge" :class="'role-' + m.role" @click="roleMenuOpenId = roleMenuOpenId === m.id ? null : m.id">
                  {{ m.role }} <span class="chev">▾</span>
                </button>
                <div class="admin-role-menu" v-if="roleMenuOpenId === m.id">
                  <button v-for="r in ROLES" :key="r" @click="setRole(m, r)">{{ r }}</button>
                </div>
              </div>
            </td>
            <td><span class="admin-badge" :class="m.status === '정상' ? 'status-ok' : 'status-banned'">{{ m.status }}</span></td>
            <td>
              <button class="admin-action-btn" @click="toggleStatus(m)">{{ m.status === '정상' ? '정지시키기' : '정지 해제' }}</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="d-section-title">신고 처리</div>
    <div class="affix-list admin-report-list" v-if="reports.length">
      <div class="affix-line admin-report-line" v-for="r in reports" :key="r.id">
        <div class="admin-report-info">
          <span class="a-text">{{ r.target }}</span>
          <span class="admin-report-meta">신고자 {{ r.reporter }} · 사유 {{ r.reason }} · {{ r.date }}</span>
        </div>
        <button class="admin-action-btn" @click="resolveReport(r.id)">처리 완료</button>
      </div>
    </div>
    <div class="empty-state" v-else>처리할 신고가 없어요</div>
  </div>
  </div>
</template>

<style scoped>
.admin-wrap{max-width:1000px;}
.admin-preview-note{margin-bottom:24px; color:var(--gold-dim); border-color:var(--gold-dim);}

.admin-stat-row{display:grid; grid-template-columns:repeat(4, 1fr); gap:1px; background:var(--border-soft); border:1px solid var(--border-soft); margin-bottom:32px;}
.admin-stat-card{background:var(--panel); padding:18px 16px;}
.admin-stat-card .label{font-size:11.5px; color:var(--text-dim); margin-bottom:8px;}
.admin-stat-card .value{font-size:22px; font-weight:700; color:var(--text); font-family:'Noto Serif KR', serif;}
.admin-stat-card .value.accent{color:var(--green);}
.admin-stat-card .value.warn{color:var(--blood);}

.admin-table-wrap{overflow-x:auto; margin-bottom:32px; border:1px solid var(--border-soft);}
.admin-table{width:100%; border-collapse:collapse; font-size:13px; min-width:640px;}
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
.admin-badge.role-최고관리자{color:var(--gold); border-color:var(--gold-dim);}
.admin-badge.role-운영진{color:var(--teal); border-color:var(--teal);}
.admin-badge.status-ok{color:var(--green); border-color:var(--green);}
.admin-badge.status-banned{color:var(--blood); border-color:var(--blood);}
.admin-badge .chev{font-size:9px; color:var(--text-dim);}

.admin-role-wrap{position:relative;}
.admin-role-menu{
  position:absolute; top:100%; left:0; margin-top:4px; z-index:10; min-width:110px;
  background:var(--panel-2); border:1px solid var(--border); padding:4px;
}
.admin-role-menu button{display:block; width:100%; text-align:left; padding:7px 10px; font-size:12px; color:var(--text-muted);}
.admin-role-menu button:hover{background:var(--panel); color:var(--gold);}

.admin-action-btn{font-size:11.5px; color:var(--text-muted); border:1px solid var(--border); padding:6px 12px; white-space:nowrap;}
.admin-action-btn:hover{border-color:var(--gold-dim); color:var(--gold);}

.admin-report-list{margin-bottom:8px;}
.admin-report-line{display:flex; align-items:center; justify-content:space-between; gap:14px; flex-wrap:wrap;}
.admin-report-info{display:flex; flex-direction:column; gap:4px;}
.admin-report-meta{font-size:11.5px; color:var(--text-dim);}

@media (max-width:700px){
  .admin-stat-row{grid-template-columns:1fr 1fr;}
}
</style>
