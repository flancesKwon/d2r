<script setup>
import HeaderNotifications from '../components/HeaderNotifications.vue'
import LogoMark from '../components/LogoMark.vue'
import { ref, computed, onBeforeUnmount } from 'vue'

const form = ref({ nickname: '', email: '', password: '', passwordCheck: '', agree: false })
const submitted = ref(false)
const avatarPreview = ref('')
const avatarInput = ref(null)
const avatarError = ref('')

function pickAvatar() {
  avatarInput.value?.click()
}

function onAvatarChange(e) {
  const file = e.target.files && e.target.files[0]
  if (!file) return
  if (!file.type.startsWith('image/')) {
    avatarError.value = '이미지 파일만 선택할 수 있어요'
    return
  }
  if (file.size > 3 * 1024 * 1024) {
    avatarError.value = '3MB 이하 이미지로 선택해주세요'
    return
  }
  avatarError.value = ''
  if (avatarPreview.value) URL.revokeObjectURL(avatarPreview.value)
  avatarPreview.value = URL.createObjectURL(file)
}

function removeAvatar() {
  if (avatarPreview.value) URL.revokeObjectURL(avatarPreview.value)
  avatarPreview.value = ''
  if (avatarInput.value) avatarInput.value.value = ''
}

onBeforeUnmount(() => {
  if (avatarPreview.value) URL.revokeObjectURL(avatarPreview.value)
})

const passwordMismatch = computed(() => form.value.passwordCheck.length > 0 && form.value.password !== form.value.passwordCheck)
const canSubmit = computed(() =>
  form.value.nickname.trim() && form.value.email.trim() && form.value.password.length >= 8 && !passwordMismatch.value && form.value.agree
)

function onSubmit() {
  if (!canSubmit.value) return
  submitted.value = true
}

function onGoogleClick() {
  submitted.value = true
}
</script>

<template>
  <div class="items-page signup-page">
  <header>
    <div class="logo">
      <router-link to="/" style="display: flex; align-items: center; gap: 8px; color: inherit">
        <LogoMark />디아허브
      </router-link>
    </div>
    <div class="crumb"><router-link to="/">메인</router-link> / <b>회원가입</b></div>
    <HeaderNotifications />
  </header>

  <div class="signup-wrap">
    <div class="signup-card">
      <div class="signup-head">
        <LogoMark :size="26" class="signup-mark" />
        <h1>회원가입</h1>
        <p>디아허브에 가입하고 빌드·공략을 저장해보세요</p>
      </div>

      <div class="note-box signup-preview-note" v-if="!submitted">디자인 미리보기예요 — 실제 가입 처리는 아직 준비 중이에요.</div>

      <form class="signup-form" @submit.prevent="onSubmit" v-if="!submitted">
        <div class="signup-avatar-row">
          <button type="button" class="signup-avatar" @click="pickAvatar">
            <img v-if="avatarPreview" :src="avatarPreview" alt="프로필 사진 미리보기" />
            <svg v-else viewBox="0 0 24 24" class="signup-avatar-placeholder"><circle cx="12" cy="8.5" r="3.6"/><path d="M4.5 20c1.6-3.6 4.6-5.4 7.5-5.4s5.9 1.8 7.5 5.4"/></svg>
            <span class="signup-avatar-badge">＋</span>
          </button>
          <div class="signup-avatar-info">
            <span>프로필 사진</span>
            <div class="signup-avatar-actions">
              <button type="button" class="signup-avatar-link" @click="pickAvatar">사진 선택</button>
              <button type="button" class="signup-avatar-link" v-if="avatarPreview" @click="removeAvatar">삭제</button>
            </div>
            <small class="signup-error" v-if="avatarError">{{ avatarError }}</small>
          </div>
          <input ref="avatarInput" type="file" accept="image/*" class="signup-avatar-input" @change="onAvatarChange" />
        </div>

        <label class="signup-field">
          <span>닉네임</span>
          <input type="text" v-model="form.nickname" placeholder="게시판에서 쓸 닉네임" maxlength="16" />
        </label>
        <label class="signup-field">
          <span>이메일</span>
          <input type="email" v-model="form.email" placeholder="you@example.com" />
        </label>
        <label class="signup-field">
          <span>비밀번호</span>
          <input type="password" v-model="form.password" placeholder="8자 이상" />
        </label>
        <label class="signup-field">
          <span>비밀번호 확인</span>
          <input type="password" v-model="form.passwordCheck" placeholder="비밀번호를 한 번 더 입력" :class="{ invalid: passwordMismatch }" />
          <small class="signup-error" v-if="passwordMismatch">비밀번호가 일치하지 않아요</small>
        </label>

        <label class="signup-agree">
          <input type="checkbox" v-model="form.agree" />
          <span>이용약관 및 개인정보 처리방침에 동의합니다</span>
        </label>

        <button type="submit" class="signup-submit" :disabled="!canSubmit">가입하기</button>

        <div class="signup-divider"><span>또는</span></div>

        <button type="button" class="signup-google-btn" @click="onGoogleClick">
          <svg class="signup-google-icon" viewBox="0 0 48 48" width="18" height="18">
            <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.9 2.4 30.4 0 24 0 14.6 0 6.5 5.4 2.5 13.2l7.8 6c1.9-5.7 7.2-9.7 13.7-9.7z"/>
            <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.6c-.5 3-2.2 5.5-4.7 7.2l7.3 5.7c4.3-4 6.8-9.9 6.8-17.4z"/>
            <path fill="#FBBC05" d="M10.3 19.2c-.5 1.5-.8 3.1-.8 4.8s.3 3.3.8 4.8l-7.8 6C.9 31.3 0 27.8 0 24s.9-7.3 2.5-10.8l7.8 6z"/>
            <path fill="#34A853" d="M24 48c6.4 0 11.9-2.1 15.8-5.8l-7.3-5.7c-2.1 1.4-4.9 2.3-8.5 2.3-6.5 0-11.8-4-13.7-9.7l-7.8 6C6.5 42.6 14.6 48 24 48z"/>
          </svg>
          Google로 계속하기
        </button>
      </form>

      <div class="signup-done" v-else>
        <div class="signup-done-icon">✓</div>
        <h2>회원 시스템은 아직 준비 중이에요</h2>
        <p>입력하신 내용은 저장되지 않았어요. 계정 저장 기능이 열리면 이 화면에서 바로 가입하실 수 있게 안내할게요.</p>
        <button class="signup-submit" @click="submitted = false">돌아가기</button>
      </div>

      <div class="signup-foot">
        <router-link to="/community">가입 없이 커뮤니티 둘러보기 →</router-link>
      </div>
    </div>
  </div>
  </div>
</template>

<style scoped>
.signup-wrap{max-width:1180px; margin:0 auto; padding:56px 24px 80px; display:flex; justify-content:center;}
.signup-card{width:100%; max-width:420px; border:1px solid var(--border-soft); background:var(--panel); padding:36px 32px;}

.signup-head{text-align:center; margin-bottom:22px;}
.signup-mark{display:block; margin:0 auto 14px; width:26px; height:26px;}
.signup-head h1{font-size:22px; margin-bottom:8px;}
.signup-head p{font-size:12.5px; color:var(--text-muted);}

.signup-preview-note{margin-bottom:20px; text-align:center; color:var(--gold-dim); border-color:var(--gold-dim);}

.signup-form{display:flex; flex-direction:column; gap:14px;}

.signup-avatar-row{display:flex; align-items:center; gap:14px; margin-bottom:2px;}
.signup-avatar{
  position:relative; width:64px; height:64px; border-radius:50%; flex:none; overflow:visible;
  border:1px solid var(--border); background:var(--panel-2); display:flex; align-items:center; justify-content:center;
}
.signup-avatar img{width:100%; height:100%; border-radius:50%; object-fit:cover;}
.signup-avatar-placeholder{width:34px; height:34px; stroke:var(--text-dim); fill:none; stroke-width:1.6; stroke-linecap:round; stroke-linejoin:round;}
.signup-avatar-badge{
  position:absolute; right:-2px; bottom:-2px; width:20px; height:20px; border-radius:50%;
  background:var(--gold); color:#1B1714; font-size:13px; font-weight:700; display:flex; align-items:center; justify-content:center;
  border:2px solid var(--panel);
}
.signup-avatar-info{display:flex; flex-direction:column; gap:5px; font-size:12px; color:var(--text-muted);}
.signup-avatar-actions{display:flex; gap:10px;}
.signup-avatar-link{font-size:12px; color:var(--gold-dim); text-decoration:underline; text-underline-offset:2px;}
.signup-avatar-link:hover{color:var(--gold);}
.signup-avatar-input{display:none;}
.signup-field{display:flex; flex-direction:column; gap:6px; font-size:12px; color:var(--text-muted);}
.signup-field input{
  background:var(--panel-2); border:1px solid var(--border); color:var(--text);
  padding:11px 12px; font-size:13.5px; font-family:inherit;
}
.signup-field input:focus{outline:none; border-color:var(--gold-dim);}
.signup-field input.invalid{border-color:var(--blood);}
.signup-error{color:var(--blood); font-size:11px;}

.signup-agree{display:flex; align-items:center; gap:8px; font-size:12px; color:var(--text-muted); cursor:pointer;}
.signup-agree input{accent-color:var(--gold-dim); cursor:pointer;}

.signup-submit{
  background:var(--gold); color:#1B1714; padding:12px; font-size:14px; font-weight:700; text-align:center;
}
.signup-submit:hover:not(:disabled){background:var(--focus);}
.signup-submit:disabled{opacity:0.4; cursor:default;}

.signup-divider{display:flex; align-items:center; gap:10px; color:var(--text-dim); font-size:11px; margin:2px 0;}
.signup-divider::before, .signup-divider::after{content:''; flex:1; height:1px; background:var(--border-soft);}

.signup-google-btn{
  display:flex; align-items:center; justify-content:center; gap:10px;
  background:var(--panel-2); border:1px solid var(--border); color:var(--text); padding:11px; font-size:13.5px;
}
.signup-google-btn:hover{border-color:var(--gold-dim);}
.signup-google-icon{flex:none;}

.signup-done{text-align:center; padding:12px 0;}
.signup-done-icon{
  width:44px; height:44px; margin:0 auto 16px; border:1px solid var(--gold-dim); border-radius:50%;
  color:var(--gold); font-size:20px; display:flex; align-items:center; justify-content:center;
}
.signup-done h2{font-size:16px; margin-bottom:10px;}
.signup-done p{font-size:12.5px; color:var(--text-muted); line-height:1.6; margin-bottom:22px;}

.signup-foot{text-align:center; margin-top:22px; font-size:12px;}
.signup-foot a{color:var(--text-dim);}
.signup-foot a:hover{color:var(--gold);}

@media (max-width:480px){
  .signup-card{padding:28px 20px;}
}
</style>
