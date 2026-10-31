<script setup>
// 운영진 - 패치노트 올리기·고치기·지우기 (/admin/patch). 올리면 코드 배포 없이 /patch 와 메인에 바로 나옴
// 영어 칸은 비워도 됨 (비우면 영어 화면에도 한국어로 보임). 항목은 한 줄에 하나, 영어는 한국어와 같은 줄 수
import { ref, computed } from 'vue'
import { supabase } from '../supabase.js'
import { authState, signIn, isStaff } from '../profileStore.js'
import { dbNotes, reloadDbPatchNotes, fetchDbPatchNotes } from '../patchStore.js'
import { askConfirm } from '../dialog.js'

const staff = computed(() => isStaff())
const error = ref('')
const busy = ref(false)
fetchDbPatchNotes()

const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
const emptySection = () => ({ heading: '', heading_en: '', items: '', items_en: '' })
const emptyForm = () => ({ id: null, version: '', note_date: today(), title: '', title_en: '', tags: '', summary: '', summary_en: '', sections: [emptySection()] })
const form = ref(emptyForm())

const lines = (s) => s.split('\n').map((x) => x.trim()).filter(Boolean)

function edit(n) {
  form.value = {
    id: n.id, version: n.version, note_date: n.note_date, title: n.title, title_en: n.title_en || '', tags: n.tags.join(', '),
    summary: n.summary, summary_en: n.summary_en || '',
    sections: n.sections.map((s) => ({
      heading: s.heading, heading_en: s.heading_en || '',
      items: s.items.map((i) => i.ko).join('\n'), items_en: s.items.map((i) => i.en || '').join('\n'),
    })),
  }
  window.scrollTo(0, 0)
}

const problem = computed(() => {
  const f = form.value
  if (!f.version.trim()) return '버전 입력'
  if (!f.note_date) return '날짜 입력'
  if (!f.title.trim()) return '제목 입력'
  for (const [i, s] of f.sections.entries()) {
    if (!s.heading.trim()) return `섹션 ${i + 1}: 제목 입력`
    const ko = lines(s.items)
    if (!ko.length) return `섹션 ${i + 1}: 항목 입력`
    const en = lines(s.items_en)
    if (en.length && en.length !== ko.length) return `섹션 ${i + 1}: 영어 항목은 한국어와 같은 줄 수 (한국어 ${ko.length}줄, 영어 ${en.length}줄)`
  }
  return ''
})

function toRow() {
  const f = form.value
  return {
    version: f.version.trim(),
    note_date: f.note_date,
    title: f.title.trim(),
    title_en: f.title_en.trim() || null,
    tags: f.tags.split(',').map((x) => x.trim()).filter(Boolean),
    summary: f.summary.trim(),
    summary_en: f.summary_en.trim() || null,
    sections: f.sections.map((s) => {
      const ko = lines(s.items)
      const en = lines(s.items_en)
      return { heading: s.heading.trim(), heading_en: s.heading_en.trim() || null, items: ko.map((k, i) => ({ ko: k, en: en[i] || null })) }
    }),
  }
}

async function save() {
  if (problem.value || busy.value) return
  busy.value = true
  error.value = ''
  try {
    const row = toRow()
    const q = form.value.id ? supabase.from('tb_patch_note').update(row).eq('id', form.value.id) : supabase.from('tb_patch_note').insert(row)
    const { error: e } = await q
    if (e) throw e
    await reloadDbPatchNotes()
    form.value = emptyForm()
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}

async function remove(n) {
  if (!(await askConfirm(`패치노트 삭제 - v${n.version} ${n.title}`))) return
  const { error: e } = await supabase.from('tb_patch_note').delete().eq('id', n.id)
  if (e) { error.value = e.message; return }
  await reloadDbPatchNotes()
  if (form.value.id === n.id) form.value = emptyForm()
}
</script>

<template>
  <div class="items-page admin-page">
    <div class="patch-hero">
      <div class="patch-hero-inner">
        <div class="eyebrow"><router-link to="/admin">관리자</router-link></div>
        <h1>패치노트 관리</h1>
      </div>
    </div>

    <div class="grid-wrap admin-wrap admin-gate" v-if="!authState.user">
      <p>운영진 계정 로그인 필요</p>
      <button type="button" class="btn-primary" @click="signIn">로그인</button>
    </div>
    <div class="grid-wrap admin-wrap admin-gate" v-else-if="!staff"><p>운영진 전용</p></div>

    <div class="grid-wrap ap-wrap" v-else>
      <div class="ap-error" v-if="error">{{ error }}</div>

      <section class="ap-card">
        <h2>{{ form.id ? '패치노트 고치기' : '새 패치노트' }}</h2>
        <div class="ap-row">
          <label>버전 <input v-model="form.version" class="ap-input ap-short" placeholder="3.4" /></label>
          <label>날짜 <input type="date" v-model="form.note_date" class="ap-input" /></label>
          <label class="ap-grow">태그 (쉼표로 구분) <input v-model="form.tags" class="ap-input" placeholder="시즌, 밸런스" /></label>
        </div>
        <label>제목 <input v-model="form.title" class="ap-input" /></label>
        <label>제목 영어 (선택) <input v-model="form.title_en" class="ap-input" /></label>
        <label>요약 <textarea v-model="form.summary" class="ap-input" rows="2"></textarea></label>
        <label>요약 영어 (선택) <textarea v-model="form.summary_en" class="ap-input" rows="2"></textarea></label>

        <div class="ap-section" v-for="(s, i) in form.sections" :key="i">
          <div class="ap-row">
            <label class="ap-grow">섹션 {{ i + 1 }} 제목 <input v-model="s.heading" class="ap-input" /></label>
            <label class="ap-grow">제목 영어 (선택) <input v-model="s.heading_en" class="ap-input" /></label>
            <button type="button" class="ap-btn danger small" v-if="form.sections.length > 1" @click="form.sections.splice(i, 1)">섹션 삭제</button>
          </div>
          <div class="ap-row">
            <label class="ap-grow">항목 (한 줄에 하나) <textarea v-model="s.items" class="ap-input" rows="6"></textarea></label>
            <label class="ap-grow">항목 영어 (선택, 같은 줄 수) <textarea v-model="s.items_en" class="ap-input" rows="6"></textarea></label>
          </div>
        </div>
        <button type="button" class="ap-btn" @click="form.sections.push(emptySection())">+ 섹션 추가</button>

        <div class="ap-error" v-if="problem">{{ problem }}</div>
        <div class="ap-row">
          <button type="button" class="ap-btn primary" :disabled="!!problem || busy" @click="save">{{ form.id ? '저장' : '올리기' }}</button>
          <button type="button" class="ap-btn" v-if="form.id" @click="form = emptyForm()">고치기 취소</button>
        </div>
      </section>

      <section class="ap-card">
        <h2>올린 패치노트</h2>
        <p class="ap-dim" v-if="!dbNotes.length">아직 없음 (코드에 들어 있는 예전 패치노트는 여기서 안 보임)</p>
        <div class="ap-list-row" v-for="n in dbNotes" :key="n.id">
          <span>v{{ n.version }} · {{ n.note_date }} · {{ n.title }}</span>
          <span class="ap-actions">
            <button type="button" class="ap-btn small" @click="edit(n)">고치기</button>
            <button type="button" class="ap-btn danger small" @click="remove(n)">삭제</button>
          </span>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.ap-wrap{max-width:980px; display:flex; flex-direction:column; gap:16px;}
.ap-card{border:1px solid var(--border); background:var(--panel); border-radius:14px; padding:18px 20px; display:flex; flex-direction:column; gap:12px;}
.ap-card h2{font-size:15px; color:var(--gold); margin:0;}
.ap-card label{display:flex; flex-direction:column; gap:5px; font-size:12px; color:var(--text-dim);}
.ap-row{display:flex; flex-wrap:wrap; gap:10px 14px; align-items:flex-end;}
.ap-grow{flex:1; min-width:220px;}
.ap-short{width:90px;}
.ap-input{background:var(--panel-2); border:1px solid var(--border); color:var(--text); font-size:13px; padding:8px 10px; border-radius:8px; font-family:'Noto Sans KR', sans-serif;}
.ap-section{border:1px solid var(--border); border-radius:10px; padding:12px; display:flex; flex-direction:column; gap:10px;}
.ap-error{color:var(--blood); font-size:13px;}
.ap-dim{font-size:12px; color:var(--text-dim);}
.ap-btn{font-size:12.5px; color:var(--text-muted); border:1px solid var(--border); background:var(--panel-2); padding:7px 12px; border-radius:8px; cursor:pointer; align-self:flex-start;}
.ap-btn.small{padding:2px 9px; font-size:11.5px;}
.ap-btn.primary{color:#1a1408; background:var(--gold); border-color:var(--gold); font-weight:700;}
.ap-btn.danger{color:var(--blood); border-color:var(--blood);}
.ap-btn:disabled{opacity:.45; cursor:not-allowed;}
.ap-list-row{display:flex; justify-content:space-between; gap:10px; font-size:13px; padding:6px 0; border-top:1px solid var(--border);}
.ap-actions{display:flex; gap:6px;}
</style>
