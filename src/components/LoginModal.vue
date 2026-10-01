<script setup>
// 로그인 방법 고르기 (디스코드 / 구글) - signIn() 을 제공자 없이 부르면 열림
import { watch, onUnmounted } from 'vue'
import { authState, signIn } from '../profileStore.js'

const close = () => (authState.loginOpen = false)
const onKey = (e) => { if (e.key === 'Escape') close() }
watch(() => authState.loginOpen, (open) => {
  if (open) window.addEventListener('keydown', onKey)
  else window.removeEventListener('keydown', onKey)
})
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="login-overlay" v-if="authState.loginOpen" @click.self="close">
    <div class="login-panel" role="dialog" aria-modal="true" aria-labelledby="login-title">
      <button type="button" class="login-close" aria-label="닫기" @click="close">✕</button>
      <h2 id="login-title">로그인</h2>
      <p class="login-sub">비밀번호 저장 안 함</p>

      <button type="button" class="login-btn discord" @click="signIn('discord')">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M19.3 5.3A16.6 16.6 0 0015.2 4l-.5 1a15.3 15.3 0 00-5.4 0l-.5-1a16.6 16.6 0 00-4.1 1.3C2.1 9.2 1.4 13 1.7 16.7a16.7 16.7 0 005.1 2.6l1.1-1.7a10.7 10.7 0 01-1.7-.8l.4-.3a11.9 11.9 0 0010.8 0l.4.3a10.7 10.7 0 01-1.7.8l1.1 1.7a16.6 16.6 0 005.1-2.6c.4-4.3-.7-8-2.9-11.4zM8.7 14.5c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2zm6.6 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2z"/></svg>
        디스코드로 계속하기
      </button>
      <button type="button" class="login-btn google" @click="signIn('google')">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#4285F4" d="M22.5 12.3c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 01-2.2 3.3v2.7h3.5c2.1-1.9 3.3-4.7 3.3-8z"/>
          <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.5-2.7c-1 .7-2.3 1.1-3.8 1.1-2.9 0-5.4-2-6.3-4.6H2.1v2.8A11 11 0 0012 23z"/>
          <path fill="#FBBC05" d="M5.7 14.1a6.6 6.6 0 010-4.2V7.1H2.1a11 11 0 000 9.8z"/>
          <path fill="#EA4335" d="M12 5.3c1.6 0 3.1.6 4.2 1.7l3.1-3.1A11 11 0 002.1 7.1l3.6 2.8C6.6 7.3 9.1 5.3 12 5.3z"/>
        </svg>
        구글로 계속하기
      </button>

      <p class="login-note">
        처음 로그인 시 계정 이름이 닉네임 - 마이페이지에서 변경 가능<br />
        로그인 = <router-link to="/terms" @click="close">이용 규칙</router-link> · <router-link to="/privacy" @click="close">개인정보 처리 안내</router-link> 동의
      </p>
    </div>
  </div>
</template>

<style scoped>
.login-overlay{position:fixed; inset:0; z-index:100; background:rgba(0,0,0,0.6); display:flex; align-items:center; justify-content:center; padding:16px;}
.login-panel{position:relative; width:100%; max-width:360px; background:var(--panel); border:1px solid var(--border); border-radius:18px; padding:28px 24px 22px; display:flex; flex-direction:column; gap:10px; box-shadow:0 20px 50px -12px rgba(0,0,0,0.7);}
.login-close{position:absolute; top:12px; right:14px; color:var(--text-dim); font-size:14px;}
.login-close:hover{color:var(--text);}
.login-panel h2{font-family:'Noto Serif KR', serif; font-size:20px; color:var(--gold); text-align:center;}
.login-sub{font-size:12.5px; color:var(--text-muted); text-align:center; margin-bottom:8px;}
.login-btn{display:flex; align-items:center; justify-content:center; gap:10px; width:100%; padding:12px; border-radius:12px; font-size:14px; font-weight:600;}
.login-btn svg{width:20px; height:20px;}
.login-btn.discord{background:#5865f2; color:#fff;}
.login-btn.discord:hover{background:#4752c4;}
.login-btn.google{background:#fff; color:#1f1f1f; border:1px solid #dadce0;}
.login-btn.google:hover{background:#f3f3f3;}
.login-note{font-size:11.5px; color:var(--text-dim); line-height:1.6; margin-top:8px; text-align:center;}
.login-note a{color:var(--gold-dim); text-decoration:underline; margin-left:2px;}
</style>
