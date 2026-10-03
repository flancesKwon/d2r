import './legacyHash.js'
import { createApp } from 'vue'
import App from './App.vue'
import router from './router.js'
import { initAuth, takeLoginReturn, authState } from './profileStore.js'
import './style.css'

// 디스코드·구글 로그인에서 돌아온 경우 주소에 ?code= (실패면 ?error=) 가 붙어 옴 - Supabase 가 읽고 지우기 전에 확인
const BASE = import.meta.env.BASE_URL

const params = new URLSearchParams(window.location.search)
const fromLogin = params.has('code') || params.has('error')

// 방금 가입한 계정(프로필이 10분 안에 생김)의 첫 로그인이면 프로필 설정 화면으로 - 한 번만 (이 브라우저 기준)
function isFirstLogin() {
  const p = authState.profile
  if (!p?.created_at || Date.now() - new Date(p.created_at) > 10 * 60 * 1000) return false
  const key = 'd2r-welcomed-' + p.id
  try {
    if (localStorage.getItem(key)) return false
    localStorage.setItem(key, '1')
  } catch (e) {}
  return true
}

// 로그인 상태를 먼저 확인한 뒤 화면을 띄움 (새로고침 때 로그아웃처럼 깜빡이지 않게)
initAuth().then(() => {
  createApp(App).use(router).mount('#app')
  if (fromLogin) {
    // 주소창의 ?code= 를 지우고 로그인 전에 보던 화면으로 - 라우터가 이미 주소를 읽었으니 라우터로 이동
    // (저장된 값은 /mypage?tab=x 같은 전체 경로)
    const back = takeLoginReturn() || BASE
    if (isFirstLogin()) router.replace({ path: '/mypage/edit', query: { welcome: '1' } })
    else router.replace(back.startsWith(BASE) ? '/' + back.slice(BASE.length) : '/')
  }
  // 이미 열린 화면에서 예전 #/ 주소로 바뀌어도 새 주소로
  window.addEventListener('hashchange', () => {
    if (window.location.hash.startsWith('#/')) router.replace(window.location.hash.slice(1))
  })
})
