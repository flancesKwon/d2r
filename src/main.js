import './legacyHash.js'
import { createApp } from 'vue'
import App from './App.vue'
import router from './router.js'
import { initAuth, takeLoginReturn } from './profileStore.js'
import './style.css'

// 디스코드·구글 로그인에서 돌아온 경우 주소에 ?code= (실패면 ?error=) 가 붙어 옴 - Supabase 가 읽고 지우기 전에 확인
const BASE = import.meta.env.BASE_URL

const params = new URLSearchParams(window.location.search)
const fromLogin = params.has('code') || params.has('error')

// 로그인 상태를 먼저 확인한 뒤 화면을 띄움 (새로고침 때 로그아웃처럼 깜빡이지 않게)
initAuth().then(() => {
  createApp(App).use(router).mount('#app')
  if (fromLogin) {
    // 주소창의 ?code= 를 지우고 로그인 전에 보던 화면으로 - 라우터가 이미 주소를 읽었으니 라우터로 이동
    // (저장된 값은 /d2r/mypage 같은 전체 경로 -> 라우터 경로 /mypage 로)
    const back = takeLoginReturn() || BASE
    router.replace(back.startsWith(BASE) ? '/' + back.slice(BASE.length) : '/')
  }
  // 이미 열린 화면에서 예전 #/ 주소로 바뀌어도 새 주소로
  window.addEventListener('hashchange', () => {
    if (window.location.hash.startsWith('#/')) router.replace(window.location.hash.slice(1))
  })
})
