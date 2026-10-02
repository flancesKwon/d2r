import { createClient } from '@supabase/supabase-js'

// anon(publishable) 키는 공개돼도 되는 키 - 보안은 DB의 RLS가 맡음. service_role 키는 절대 여기 넣지 말 것.
// 값은 .env.local(로컬) / GitHub Actions secrets(배포)에서 빌드 때 들어옴.
// flowType 'pkce': 해시 라우터(#/...)라서 토큰을 # 뒤에 싣는 implicit 방식은 라우터와 부딪힘 -> ?code= 로 받음
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = url && key
  ? createClient(url, key, { auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true } })
  : null

if (!supabase) console.warn('Supabase 설정(VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)없음 - 로그인·게시판 꺼짐')

// RLS에 걸린 UPDATE/DELETE는 에러 없이 0건으로 조용히 끝남 -> 쓰기는 항상 .select() 로 돌아온 행을 확인
// 이용 정지 중이면 막힌 이유를 그걸로 보여줌 (profileStore 가 정지 여부 확인 함수를 넣어 둠)
let blockedReason = () => null
export function setBlockedReason(fn) { blockedReason = fn }

export async function mustReturnRows(query, message = '권한 없음') {
  const { data, error } = await query
  // RLS 에 걸린 INSERT 는 영어 에러로 옴 (예: 이용 정지 중) -> 화면에 보여줄 말로
  if (error?.code === '42501' && /row-level security/i.test(error.message)) throw new Error(blockedReason() || message)
  if (error) throw error
  if (!data?.length) throw new Error(blockedReason() || message)
  return data
}
