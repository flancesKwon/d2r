// 피드백(버그·개선 제보) - tb_feedback (supabase/032_feedback.sql)
// 보낸 사람 본인과 운영진만 읽음. 상태 변경은 운영진, 삭제는 최고관리자
import { supabase, mustReturnRows } from './supabase.js'
import { authState } from './profileStore.js'

export const FEEDBACK_KINDS = [
  { value: 'bug', label: '버그' },
  { value: 'idea', label: '개선 제안' },
  { value: 'etc', label: '기타' },
]
export const FEEDBACK_KIND_LABEL = Object.fromEntries(FEEDBACK_KINDS.map((k) => [k.value, k.label]))
export const FEEDBACK_STATUS_LABEL = { open: '확인 전', done: '확인함' }

export async function submitFeedback({ kind, content, page }) {
  if (!supabase) throw new Error('서버 연결 실패')
  if (!authState.user) throw new Error('로그인 필요')
  const { error } = await supabase.from('tb_feedback').insert({ kind, content: content.trim(), page })
  if (error) {
    if (error.hint === 'rate_limit') throw new Error('잠시 후 다시 시도')
    if (error.code === '42P01' || error.code === 'PGRST205') throw new Error('피드백 기능 준비 중')
    if (error.code === '42501') throw new Error('지금은 보낼 수 없음')
    throw new Error(error.message || '보내기 실패')
  }
}

export async function fetchFeedback(status = 'open', limit = 50) {
  let q = supabase.from('tb_feedback')
    .select('*, user:tb_profile!tb_feedback_user_id_fkey(nickname)')
    .order('created_at', { ascending: false }).limit(limit)
  if (status) q = q.eq('status', status)
  const { data, error } = await q
  if (error) throw error
  return data
}

export async function setFeedbackStatus(id, status) {
  await mustReturnRows(supabase.from('tb_feedback').update({ status }).eq('id', id).select('id'), '상태 변경 실패')
}

export async function deleteFeedback(id) {
  await mustReturnRows(supabase.from('tb_feedback').delete().eq('id', id).select('id'), '삭제 실패')
}
