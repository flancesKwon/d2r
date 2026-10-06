<script setup>
// 빌드 가이드 쓰기·고치기 (/guides/new, /guides/:id/edit) - 운영진·최고관리자만
// 저장 권한은 DB(RLS)가 한 번 더 확인함
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { GUIDE_CLASSES, GUIDE_TIERS, loadGuides, getGuide, saveGuide, canEditGuides, guidesState } from '../guideStore.js'
import { authState, signIn } from '../profileStore.js'

const route = useRoute()
const router = useRouter()
const editSlug = route.params.id || null

function blank() {
  const cls = GUIDE_CLASSES.some((c) => c.key === route.query.class) ? route.query.class : 'sorc'
  return {
    dbId: null, classKey: cls, title: '', tier: 'B TIER', desc: '', summary: '', statPriority: '',
    skillOrder: [{ level: '1~', skill: '' }], keyItems: [''], levelingNotes: [''], strengths: [''], weaknesses: [''], published: true,
  }
}
const form = ref(blank())
const loadedEdit = ref(!editSlug)

// 고치기: 가이드를 받아서 폼에 채움 (목록은 빈 줄 하나라도 있게)
loadGuides().then(() => {
  if (!editSlug) return
  const g = getGuide(editSlug)
  if (!g || !g.dbId) return router.replace('/guides')
  const withBlank = (a) => (a.length ? [...a] : [''])
  form.value = {
    dbId: g.dbId, classKey: g.classKey, title: g.title, tier: g.tier || '', desc: g.desc, summary: g.summary, statPriority: g.statPriority,
    skillOrder: g.skillOrder.length ? g.skillOrder.map((s) => ({ ...s })) : [{ level: '', skill: '' }],
    keyItems: withBlank(g.keyItems), levelingNotes: withBlank(g.levelingNotes), strengths: withBlank(g.strengths), weaknesses: withBlank(g.weaknesses),
    published: g.published !== false,
  }
  loadedEdit.value = true
})

const LIST_FIELDS = [
  { key: 'keyItems', label: '추천 장비', placeholder: '예: 투구: 할리퀸 관모 (모든 기술·마법 아이템 발견)' },
  { key: 'levelingNotes', label: '레벨링 노트', placeholder: '예: 노멀은 화염탄만으로 충분' },
  { key: 'strengths', label: '장점', placeholder: '예: 광역 사냥이 빠름' },
  { key: 'weaknesses', label: '단점', placeholder: '예: 화염 면역 몬스터에 약함' },
]
const addLine = (key) => form.value[key].push('')
const removeLine = (key, i) => { form.value[key].splice(i, 1); if (!form.value[key].length) form.value[key].push('') }
const addSkillRow = () => form.value.skillOrder.push({ level: '', skill: '' })
const removeSkillRow = (i) => { form.value.skillOrder.splice(i, 1); if (!form.value.skillOrder.length) addSkillRow() }

const saving = ref(false)
const error = ref('')
async function submit() {
  error.value = ''
  if (!form.value.title.trim()) return (error.value = '제목 입력')
  if (form.value.title.trim().length > 120) return (error.value = '제목은 120자까지')
  saving.value = true
  try {
    const g = await saveGuide(form.value)
    router.replace(`/guides/${g.id}`)
  } catch (e) {
    error.value = e.message || '저장 실패'
  } finally {
    saving.value = false
  }
}
const pageTitle = computed(() => (editSlug ? '가이드 고치기' : '가이드 쓰기'))
watch(pageTitle, (t) => (document.title = `${t} — 디아허브`), { immediate: true })
</script>

<template>
  <div class="items-page guide-edit-page">
  <div class="patch-hero">
    <div class="patch-hero-inner">
      <div class="eyebrow">{{ $t('빌드 가이드') }}</div>
      <h1>{{ pageTitle }}</h1>
    </div>
  </div>

  <div class="grid-wrap ge-wrap ge-gate" v-if="!authState.user">
    <p>{{ $t('운영진 계정 로그인 필요') }}</p>
    <button type="button" class="btn-primary" @click="signIn">{{ $t('로그인') }}</button>
  </div>
  <div class="grid-wrap ge-wrap ge-gate" v-else-if="guidesState.loaded && !canEditGuides">
    <p>{{ $t('운영진 전용') }}</p>
    <router-link to="/guides" class="btn-primary">{{ $t('가이드 목록으로') }}</router-link>
  </div>

  <div class="grid-wrap ge-wrap" v-else-if="loadedEdit">
    <div class="ge-row">
      <label class="ge-field">
        <span>{{ $t('직업') }}</span>
        <select v-model="form.classKey" class="ge-input">
          <option v-for="c in GUIDE_CLASSES" :key="c.key" :value="c.key">{{ c.name }}</option>
        </select>
      </label>
      <label class="ge-field">
        <span>{{ $t('티어') }}</span>
        <select v-model="form.tier" class="ge-input">
          <option value="">{{ $t('없음') }}</option>
          <option v-for="t in GUIDE_TIERS" :key="t" :value="t">{{ t }}</option>
        </select>
      </label>
      <label class="ge-check">
        <input type="checkbox" v-model="form.published" /> {{ $t('공개') }}
      </label>
    </div>

    <label class="ge-field">
      <span>{{ $t('제목') }}</span>
      <input v-model="form.title" class="ge-input ge-title" maxlength="120" :placeholder="$t('예: 파벽 소서리스 — 초보자용 완전 정복')" />
    </label>
    <label class="ge-field">
      <span>{{ $t('한 줄 소개') }} <small>{{ $t('목록 카드에 표시') }}</small></span>
      <input v-model="form.desc" class="ge-input" :placeholder="$t('예: 스킬 트리, 필요 장비, 레벨링 순서까지 한 번에')" />
    </label>
    <label class="ge-field">
      <span>{{ $t('요약') }}</span>
      <textarea v-model="form.summary" class="ge-input" rows="4" :placeholder="$t('이 빌드가 어떤 빌드인지')"></textarea>
    </label>
    <label class="ge-field">
      <span>{{ $t('스탯 우선순위') }}</span>
      <textarea v-model="form.statPriority" class="ge-input" rows="3" :placeholder="$t('예: 힘은 장비 요구치만, 나머지는 활력')"></textarea>
    </label>

    <div class="ge-field">
      <span>{{ $t('스킬 트리 순서') }}</span>
      <div class="ge-skill-row" v-for="(s, i) in form.skillOrder" :key="i">
        <input v-model="s.level" class="ge-input ge-level" :placeholder="$t('레벨 (예: 1~11)')" />
        <input v-model="s.skill" class="ge-input" :placeholder="$t('찍을 스킬')" />
        <button type="button" class="ge-remove" :aria-label="$t('줄 삭제')" @click="removeSkillRow(i)">✕</button>
      </div>
      <button type="button" class="ge-add" @click="addSkillRow">{{ $t('+ 줄 추가') }}</button>
    </div>

    <div class="ge-field" v-for="f in LIST_FIELDS" :key="f.key">
      <span>{{ f.label }}</span>
      <div class="ge-line-row" v-for="(line, i) in form[f.key]" :key="i">
        <input v-model="form[f.key][i]" class="ge-input" :placeholder="f.placeholder" />
        <button type="button" class="ge-remove" :aria-label="$t('줄 삭제')" @click="removeLine(f.key, i)">✕</button>
      </div>
      <button type="button" class="ge-add" @click="addLine(f.key)">{{ $t('+ 줄 추가') }}</button>
    </div>

    <div class="ge-actions">
      <span class="ge-error" v-if="error">{{ error }}</span>
      <router-link :to="editSlug ? `/guides/${editSlug}` : '/guides'" class="ge-cancel">{{ $t('취소') }}</router-link>
      <button type="button" class="btn-primary" :disabled="saving" @click="submit">{{ saving ? '저장 중…' : '저장' }}</button>
    </div>
  </div>
  </div>
</template>

<style scoped>
.ge-wrap{max-width:860px; display:flex; flex-direction:column; gap:18px;}
.ge-gate{align-items:center; padding:48px 16px; color:var(--text-muted); font-size:14px; gap:14px;}
.ge-row{display:flex; gap:14px; align-items:flex-end; flex-wrap:wrap;}
.ge-field{display:flex; flex-direction:column; gap:7px; font-size:13px; color:var(--text-muted); font-weight:600;}
.ge-field small{font-weight:400; color:var(--text-dim); margin-left:4px;}
.ge-input{background:var(--panel); border:1px solid var(--border); color:var(--text); font-size:14px; padding:10px 12px; border-radius:10px; font-family:'Noto Sans KR', sans-serif; font-weight:400; width:100%;}
.ge-input:focus{outline:none; border-color:var(--gold-dim);}
textarea.ge-input{resize:vertical; line-height:1.6;}
.ge-title{font-size:17px;}
.ge-check{display:flex; align-items:center; gap:6px; font-size:13px; color:var(--text-muted); padding-bottom:10px;}
.ge-skill-row, .ge-line-row{display:flex; gap:8px; align-items:center;}
.ge-level{width:150px; flex:none;}
.ge-remove{color:var(--text-dim); padding:6px 8px; flex:none;}
.ge-remove:hover{color:#e0775f;}
.ge-add{align-self:flex-start; font-size:12.5px; color:var(--gold-dim); font-weight:400;}
.ge-add:hover{color:var(--gold);}
.ge-actions{display:flex; justify-content:flex-end; align-items:center; gap:12px; margin-top:8px;}
.ge-cancel{font-size:13px; color:var(--text-dim);}
.ge-error{font-size:12.5px; color:#e0775f; margin-right:auto;}
@media (max-width:560px){ .ge-level{width:96px;} }
</style>
