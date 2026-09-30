import { reactive } from 'vue'
import { supabase, mustReturnRows } from './supabase.js'

// 로그인(디스코드) 상태. 글의 주인은 로그인 유저의 uuid(author_id)로 판단하고, 닉네임은 보여주기용.
// profile = tb_profile 한 줄 (가입할 때 DB 트리거가 자동으로 만들어 둠)
export const authState = reactive({ user: null, profile: null, ready: false })

// 예전 코드 호환: 닉네임·연락처를 바로 꺼내 쓰던 곳들
export const profileState = reactive({ nickname: '', contact: '' })

async function applySession(session) {
  authState.user = session?.user ?? null
  if (!authState.user) {
    authState.profile = null
  } else {
    const { data } = await supabase.from('tb_profile').select('*').eq('id', authState.user.id).single()
    authState.profile = data
  }
  profileState.nickname = authState.profile?.nickname || ''
  profileState.contact = authState.profile?.contact || ''
}

// 새로고침 직후 잠깐 로그아웃처럼 보였다가 튀지 않게, 화면을 띄우기 전에 한 번 기다림 (서버가 느리면 3초까지만)
export async function initAuth() {
  if (!supabase) {
    authState.ready = true
    return
  }
  const load = (async () => {
    const { data } = await supabase.auth.getSession()
    await applySession(data.session)
  })()
  await Promise.race([load.catch((e) => console.warn('로그인 정보를 못 불러왔어요', e)), new Promise((r) => setTimeout(r, 3000))])
  // onAuthStateChange 콜백 안에서 supabase 를 바로 await 하면 멈출 수 있어서 다음 틱으로 넘김
  supabase.auth.onAuthStateChange((_e, session) => setTimeout(() => applySession(session), 0))
  authState.ready = true
}

const RETURN_KEY = 'd2r-login-return'
export function signIn() {
  if (!supabase) return
  // 로그인 후 원래 보던 화면으로 돌아오게
  try { sessionStorage.setItem(RETURN_KEY, window.location.hash || '#/') } catch (e) {}
  return supabase.auth.signInWithOAuth({
    provider: 'discord',
    // vite base 가 './' 라서 BASE_URL 을 쓰면 주소가 깨짐 -> 지금 페이지 경로(/d2r/) 그대로. Supabase Redirect URLs 에 등록된 주소와 같아야 함
    options: { redirectTo: window.location.origin + window.location.pathname },
  })
}
export function takeLoginReturn() {
  try {
    const v = sessionStorage.getItem(RETURN_KEY)
    sessionStorage.removeItem(RETURN_KEY)
    return v
  } catch (e) {
    return null
  }
}
export const signOut = () => supabase?.auth.signOut()

// 등급: user(일반) / moderator(운영진) / admin(최고관리자). 운영진은 신고 처리·정지·글 삭제, 등급 변경은 최고관리자만
export const ROLE_LABEL = { user: '일반', moderator: '운영진', admin: '최고관리자' }
export const isAdmin = () => authState.profile?.role === 'admin'
export const isStaff = (profile = authState.profile) => profile?.role === 'moderator' || profile?.role === 'admin'

// 이용 정지 - 정지 중이면 풀리는 때(Date, 영구면 Infinity), 아니면 null
export function suspendedUntil(profile = authState.profile) {
  const v = profile?.suspended_until
  if (!v) return null
  if (v === 'infinity') return Infinity
  const d = new Date(v)
  return d > new Date() ? d : null
}
export function suspensionText(until) {
  if (!until) return ''
  if (until === Infinity) return '영구 정지'
  const p = (n) => String(n).padStart(2, '0')
  return `${until.getFullYear()}-${p(until.getMonth() + 1)}-${p(until.getDate())} ${p(until.getHours())}:${p(until.getMinutes())}까지 정지`
}

// 마이페이지: 닉네임·연락처 수정
export async function saveProfile({ nickname, contact }) {
  if (!authState.user) throw new Error('로그인이 필요해요')
  const rows = await mustReturnRows(
    supabase.from('tb_profile')
      .update({ nickname: (nickname || '').trim(), contact: (contact || '').trim() || null })
      .eq('id', authState.user.id)
      .select(),
    '프로필을 저장하지 못했어요'
  )
  authState.profile = rows[0]
  profileState.nickname = rows[0].nickname
  profileState.contact = rows[0].contact || ''
  return rows[0]
}
