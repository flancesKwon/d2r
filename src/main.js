import { createApp } from 'vue'
import App from './App.vue'
import router from './router.js'
import { initAuth, takeLoginReturn } from './profileStore.js'
import './style.css'

// 디스코드·구글 로그인에서 돌아온 경우 주소에 ?code= (실패면 ?error=) 가 붙어 옴 - Supabase 가 읽고 지우기 전에 확인
const params = new URLSearchParams(window.location.search)
const fromLogin = params.has('code') || params.has('error')

// 로그인 상태를 먼저 확인한 뒤 화면을 띄움 (새로고침 때 로그아웃처럼 깜빡이지 않게)
initAuth().then(() => {
  if (fromLogin) {
    // 주소창의 ?code= 를 지우고 로그인 전에 보던 화면으로
    const back = takeLoginReturn() || '#/'
    window.history.replaceState(null, '', window.location.pathname + back)
  }
  createApp(App).use(router).mount('#app')
})
