<script setup>
// 프로필 수정 (/mypage/edit) - 닉네임·프로필 사진·연락처
// 처음 가입하면 ?welcome=1 로 들어옴 (main.js) - 저장하거나 "나중에"를 누르면 첫 화면으로, 아니면 마이페이지로
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { profileState, saveProfile, authState, signIn } from '../profileStore.js'
import UserAvatar from '../components/UserAvatar.vue'
import { AVATAR_PRESETS, presetValue } from '../avatars.js'

const route = useRoute()
const router = useRouter()
const welcome = computed(() => route.query.welcome === '1')

const nicknameInput = ref(profileState.nickname)
const contactInput = ref(profileState.contact)
// 프로필 사진: 로그인한 디스코드·구글 사진 / 준비된 그림 / 없음(닉네임 첫 글자)
const avatarInput = ref(authState.profile?.avatar_url || '')
watch(() => authState.profile?.avatar_url, (v) => (avatarInput.value = v || ''))
watch(() => [profileState.nickname, profileState.contact], ([n, c]) => { nicknameInput.value = n; contactInput.value = c })
const loginPhoto = computed(() => { const m = authState.user?.user_metadata || {}; return m.avatar_url || m.picture || '' })

const saveError = ref('')
const saving = ref(false)
const done = () => router.replace(welcome.value ? '/' : '/mypage')
async function save() {
  saveError.value = ''
  const nick = nicknameInput.value.trim()
  if (nick.length < 2 || nick.length > 20) return (saveError.value = '닉네임은 2~20자')
  saving.value = true
  try {
    await saveProfile({ nickname: nick, contact: contactInput.value, avatarUrl: avatarInput.value })
    done()
  } catch (e) {
    // 닉네임 중복(unique 제약)·사칭 닉네임(011 SQL) 등
    saveError.value = /duplicate|unique/i.test(e.message || '') ? '이미 사용 중인 닉네임' : e.message || '저장 실패'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="items-page profile-edit-page">
    <div class="patch-hero">
      <div class="patch-hero-inner">
        <div class="eyebrow">{{ welcome ? '가입 완료' : '마이페이지' }}</div>
        <h1>프로필 수정</h1>
      </div>
    </div>

    <div class="grid-wrap pe-wrap" v-if="!authState.user">
      <div class="pe-login">
        <p>로그인 필요</p>
        <button type="button" class="btn-primary" @click="signIn">로그인</button>
      </div>
    </div>

    <div class="grid-wrap pe-wrap" v-else>
      <router-link v-if="!welcome" to="/mypage" class="pe-back">← 마이페이지</router-link>
      <div class="welcome-box" v-if="welcome">
        <b>가입 완료</b>
        <span>닉네임·프로필 사진 설정</span>
      </div>

      <section class="pe-card">
        <div class="pe-field">
          <span class="pe-label">프로필 사진</span>
          <div class="avatar-now">
            <UserAvatar :src="avatarInput" :name="nicknameInput" :size="64" />
            <span class="avatar-now-name">{{ nicknameInput || '닉네임' }}</span>
          </div>
          <div class="avatar-grid" role="radiogroup" aria-label="프로필 사진 고르기">
            <button type="button" v-if="loginPhoto" class="avatar-pick" :class="{ active: avatarInput === loginPhoto }" @click="avatarInput = loginPhoto" title="로그인 계정 사진">
              <UserAvatar :src="loginPhoto" :size="44" /><small>계정 사진</small>
            </button>
            <button type="button" v-for="a in AVATAR_PRESETS" :key="a.key" class="avatar-pick" :class="{ active: avatarInput === presetValue(a.key) }" @click="avatarInput = presetValue(a.key)" :title="a.label">
              <UserAvatar :src="presetValue(a.key)" :size="44" /><small>{{ a.label }}</small>
            </button>
            <button type="button" class="avatar-pick" :class="{ active: !avatarInput }" @click="avatarInput = ''" title="사진 없음">
              <UserAvatar :name="nicknameInput" :size="44" /><small>없음</small>
            </button>
          </div>
        </div>
        <label class="pe-field">
          <span class="pe-label">닉네임</span>
          <input type="text" v-model="nicknameInput" placeholder="판매글·게시글에 보일 닉네임 (2~20자)" maxlength="20" class="write-input" @keydown.enter="save" />
        </label>
        <label class="pe-field">
          <span class="pe-label">연락처 <small>공개 (거래 상대가 봄)</small></span>
          <input type="text" v-model="contactInput" placeholder="배틀태그, 디스코드 등" class="write-input" @keydown.enter="save" />
        </label>
        <div class="pe-actions">
          <span class="pe-error" v-if="saveError">{{ saveError }}</span>
          <button type="button" class="pe-cancel" @click="done">{{ welcome ? '나중에' : '취소' }}</button>
          <button type="button" class="btn-primary pe-save" :disabled="saving" @click="save">저장</button>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.pe-wrap{max-width:620px; display:flex; flex-direction:column; gap:14px;}
.pe-back{font-size:13px; color:var(--text-dim); align-self:flex-start;}
.pe-back:hover{color:var(--gold);}
.pe-login{display:flex; flex-direction:column; align-items:center; gap:14px; padding:48px 16px; color:var(--text-muted); font-size:14px;}
.welcome-box{display:flex; align-items:center; gap:10px; flex-wrap:wrap; padding:12px 16px; border:1px solid var(--gold-dim); background:rgba(200,163,77,0.08); border-radius:12px; font-size:13.5px; color:var(--text-muted);}
.welcome-box b{color:var(--gold); font-size:14.5px;}
.pe-card{background:var(--panel); border:1px solid var(--border-soft); border-radius:16px; padding:22px 24px; display:flex; flex-direction:column; gap:20px;}
.pe-field{display:flex; flex-direction:column; gap:8px;}
.pe-label{font-size:13px; font-weight:600; color:var(--text-muted);}
.pe-label small{font-size:11.5px; font-weight:400; color:var(--text-dim); margin-left:6px;}
.avatar-now{display:flex; align-items:center; gap:14px; margin:4px 0 6px;}
.avatar-now-name{font-size:15px; color:var(--text); font-weight:600;}
.avatar-grid{display:grid; grid-template-columns:repeat(auto-fill, minmax(76px, 1fr)); gap:8px;}
.avatar-pick{display:flex; flex-direction:column; align-items:center; gap:5px; padding:10px 4px 8px; border:1px solid var(--border-soft); border-radius:10px; background:var(--panel-2);}
.avatar-pick small{font-size:11px; color:var(--text-dim); font-weight:400; white-space:nowrap;}
.avatar-pick:hover{border-color:var(--gold-dim);}
.avatar-pick.active{border-color:var(--gold); background:rgba(200,163,77,0.1);}
.avatar-pick.active small{color:var(--gold);}
.write-input{background:var(--panel-2); border:1px solid var(--border); color:var(--text); font-size:14px; padding:12px 14px; border-radius:10px;}
.write-input:focus{outline:none; border-color:var(--gold-dim);}
.pe-actions{display:flex; align-items:center; gap:10px; border-top:1px solid var(--border-soft); padding-top:18px;}
.pe-error{font-size:12.5px; color:#e0775f; margin-right:auto;}
.pe-cancel{margin-left:auto; font-size:13.5px; color:var(--text-dim); padding:10px 14px;}
.pe-cancel:hover{color:var(--text);}
.pe-error + .pe-cancel{margin-left:0;}
.pe-save{padding:11px 28px; border-radius:10px; font-size:14px;}
@media (max-width:640px){ .pe-card{padding:18px;} }
</style>
