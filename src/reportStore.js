// 신고 - tb_report (supabase/002_reports_suspension.sql)
// - 신고자·상태·대상 제목/작성자는 DB 트리거가 채움. 화면은 대상 종류·id·사유만 보냄
// - 신고 목록은 본인 것 + 운영진만 보임(RLS). 처리 상태 변경은 운영진, 삭제는 최고관리자만
import { supabase, mustReturnRows } from './supabase.js'
import { authState } from './profileStore.js'

export const REPORT_REASONS = [
  { value: 'spam', label: '광고·스팸' },
  { value: 'abuse', label: '욕설·비방' },
  { value: 'scam', label: '사기 의심' },
  { value: 'flood', label: '도배' },
  { value: 'etc', label: '기타' },
]
export const REPORT_REASON_LABEL = Object.fromEntries(REPORT_REASONS.map((r) => [r.value, r.label]))
export const REPORT_TARGET_LABEL = { community_post: '커뮤니티 글', community_comment: '댓글', trade_post: '판매글', profile: '회원' }
export const REPORT_STATUS_LABEL = { open: '처리 대기', resolved: '처리함', dismissed: '기각' }

// 002 SQL 을 아직 안 돌렸을 때 (테이블/컬럼 없음)
export const isMissingSchema = (error) => ['42P01', '42703', 'PGRST205', 'PGRST204'].includes(error?.code)

export async function submitReport({ targetType, targetId, reason, detail = '' }) {
  if (!supabase) throw new Error('서버에 연결할 수 없어요')
  if (!authState.user) throw new Error('로그인이 필요해요')
  const { data, error } = await supabase
    .from('tb_report')
    .insert({ target_type: targetType, target_id: String(targetId), reason, detail: detail.trim() || null })
    .select('id')
  if (error) {
    if (error.code === '23505') throw new Error('이미 신고한 대상이에요')
    if (isMissingSchema(error)) throw new Error('신고 기능이 아직 준비 중이에요')
    if (error.code === '42501' && /row-level security/i.test(error.message)) throw new Error('지금은 신고할 수 없어요')
    throw new Error(error.message || '신고하지 못했어요')
  }
  if (!data?.length) throw new Error('신고하지 못했어요')
  return data[0]
}

// 관리자 화면용
const REPORT_SELECT = [
  '*',
  'reporter:tb_profile!tb_report_reporter_id_fkey(nickname)',
  'target_author:tb_profile!tb_report_target_author_id_fkey(id, nickname, role, suspended_until)',
  'handler:tb_profile!tb_report_handled_by_fkey(nickname)',
].join(', ')

export async function fetchReports(status = 'open', limit = 50) {
  let q = supabase.from('tb_report').select(REPORT_SELECT).order('created_at', { ascending: false }).limit(limit)
  if (status) q = q.eq('status', status)
  const { data, error } = await q
  if (error) throw error
  return data
}

export async function countOpenReports() {
  const { count, error } = await supabase.from('tb_report').select('id', { count: 'exact', head: true }).eq('status', 'open')
  if (error) throw error
  return count || 0
}

export async function setReportStatus(id, status) {
  const rows = await mustReturnRows(
    supabase.from('tb_report').update({ status }).eq('id', id).select('status, handled_at'),
    '신고 상태를 바꾸지 못했어요'
  )
  return rows[0]
}

export async function deleteReport(id) {
  await mustReturnRows(supabase.from('tb_report').delete().eq('id', id).select('id'), '신고를 지우지 못했어요')
}

// 신고된 대상으로 가는 주소 (회원 신고는 없음)
export function reportTargetLink(r) {
  if (r.target_type === 'community_post') return `/community/${r.target_id}`
  if (r.target_type === 'community_comment' && r.target_post_id) return `/community/${r.target_post_id}`
  if (r.target_type === 'trade_post') return `/trade/${r.target_id}`
  return null
}

const TARGET_TABLE = { community_post: 'tb_community_post', community_comment: 'tb_community_comment', trade_post: 'tb_trade_post' }
export const canDeleteTarget = (r) => !!TARGET_TABLE[r.target_type]
export async function deleteReportTarget(r) {
  const table = TARGET_TABLE[r.target_type]
  if (!table) throw new Error('지울 수 없는 대상이에요')
  const { data, error } = await supabase.from(table).delete().eq('id', r.target_id).select('id')
  if (error) throw error
  return data?.length > 0 // 0건이면 이미 지워진 것
}
