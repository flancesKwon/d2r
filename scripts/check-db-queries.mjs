// 사이트가 쓰는 조회문을 실제 DB에 공개 키로 보내 컬럼·조인·정렬 이름이 맞는지 확인
// 로그인 없이 보내므로 대부분 0건이 나오지만, 이름이 틀리면 오류가 남
// 사용: node --env-file=.env.local scripts/check-db-queries.mjs
import { createClient } from '@supabase/supabase-js'

const db = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)
const P = (fk, cols = 'nickname, avatar_url') => `tb_profile!${fk}(${cols})`
const TRADE_AUTHOR = `author:${P('tb_trade_post_author_id_fkey')}`
const BUYER = `buyer:${P('tb_trade_request_buyer_id_fkey', 'nickname, contact, avatar_url')}`

const Q = {
  '커뮤니티 목록': () => db.from('tb_community_post').select(`*, author:${P('tb_community_post_author_id_fkey')}`, { count: 'exact' })
    .is('deleted_at', null).contains('tags', ['x']).or('title.ilike.%a%,content.ilike.%a%').order('like_count', { ascending: false }).order('created_at', { ascending: false }).range(0, 19),
  '커뮤니티 댓글': () => db.from('tb_community_comment').select(`*, author:${P('tb_community_comment_author_id_fkey')}`).eq('post_id', 1).is('deleted_at', null).order('created_at'),
  '글 추천': () => db.from('tb_community_post_vote').select('value').eq('post_id', 1).maybeSingle(),
  '댓글 추천': () => db.from('tb_community_comment_vote').select('comment_id, value').in('comment_id', [1]),
  '추천 수': () => db.from('tb_community_post').select('like_count, dislike_count, comment_count, views').limit(1),
  '판매글 목록': () => db.from('tb_trade_post').select(`*, ${TRADE_AUTHOR}`).is('deleted_at', null).order('created_at', { ascending: false }).limit(300),
  '구매신청': () => db.from('tb_trade_request').select(`*, ${BUYER}`).eq('post_id', 1).order('created_at'),
  '내 구매신청': () => db.from('tb_trade_request').select(`*, ${BUYER}, post:tb_trade_post!tb_trade_request_post_id_fkey(*, ${TRADE_AUTHOR})`).eq('buyer_id', '00000000-0000-0000-0000-000000000000').order('created_at', { ascending: false }).limit(100),
  '찜': () => db.from('tb_trade_favorite').select('post_id'),
  '거래방': () => db.from('tb_trade_deal').select(`*, seller:${P('tb_trade_deal_seller_id_fkey')}, buyer:${P('tb_trade_deal_buyer_id_fkey')}, review:tb_trade_deal_review(*)`).order('created_at', { ascending: false }),
  '거래방 대화': () => db.from('tb_trade_deal_message').select('*').eq('deal_id', 1).order('created_at'),
  '받은 리뷰': () => db.from('tb_trade_deal_review').select(`*, from:${P('tb_trade_deal_review_from_id_fkey')}, deal:tb_trade_deal(post_title)`).eq('to_id', '00000000-0000-0000-0000-000000000000').order('created_at', { ascending: false }).limit(100),
  '쪽지방': () => db.from('tb_dm_conversation').select(`*, a:${P('tb_dm_conversation_user_a_fkey', 'id, nickname, avatar_url')}, b:${P('tb_dm_conversation_user_b_fkey', 'id, nickname, avatar_url')}`),
  '쪽지': () => db.from('tb_dm_message').select('*').in('conversation_id', [1]).order('created_at', { ascending: false }).limit(500),
  '알림': () => db.from('tb_notification').select('*').order('created_at', { ascending: false }).limit(30),
  '프로필': () => db.from('tb_profile').select('id, nickname, contact, avatar_url, role, created_at, suspended_until').limit(1),
  '관리자 회원 목록': () => db.from('tb_profile').select('id, nickname, contact, role, created_at, suspended_until').ilike('nickname', '%a%').order('created_at', { ascending: false }).limit(50),
  '관리자 최근 글': () => db.from('tb_community_post').select('id, title, category, created_at, author:tb_profile!tb_community_post_author_id_fkey(nickname)').limit(5),
  '관리자 최근 판매글': () => db.from('tb_trade_post').select('id, item_name, category, created_at, author:tb_profile!tb_trade_post_author_id_fkey(nickname)').limit(5),
  '신고 목록': () => db.from('tb_report').select('*, reporter:tb_profile!tb_report_reporter_id_fkey(nickname), target_author:tb_profile!tb_report_target_author_id_fkey(id, nickname, role, suspended_until), handler:tb_profile!tb_report_handled_by_fkey(nickname)').eq('status', 'open').order('created_at', { ascending: false }).limit(50),
  '가이드': () => db.from('tb_guide').select('*').order('created_at', { ascending: false }),
  '저장한 빌드': () => db.from('tb_saved_build').select('*').order('updated_at', { ascending: false }),
  '조회수 올리기(글)': () => db.rpc('increment_post_view', { p_post_id: -1 }),
  '조회수 올리기(판매글)': () => db.rpc('increment_trade_view', { p_post_id: -1 }),
}

// 막혀야 하는 것 (005 적용 뒤): 정지 사유는 남이 못 읽음
const MUST_DENY = {
  '정지 사유 숨김': () => db.from('tb_profile').select('suspended_reason').limit(1),
  '회원 프로필 전체(*) 막힘': () => db.from('tb_profile').select('*').limit(1),
}

let fail = 0
for (const [name, q] of Object.entries(Q)) {
  const { data, error, count } = await q()
  // 비로그인이라 권한 없음(42501)은 정상 - 이름 오류(PGRST/42703/42P01)만 실패로
  const nameErr = error && !(error.code === '42501')
  if (nameErr) fail++
  console.log(nameErr ? '실패' : '  ok', name, error ? `(${error.code} ${error.message})` : `${Array.isArray(data) ? data.length : data === null ? 0 : 1}건${count != null ? ' / 전체 ' + count : ''}`)
}
for (const [name, q] of Object.entries(MUST_DENY)) {
  const { error } = await q()
  if (!error) fail++
  console.log(error ? '  ok' : '실패', name, error ? '(막힘)' : '- 읽힘')
}
console.log(fail ? `실패 ${fail}개` : '전부 통과')
process.exit(fail ? 1 : 0)
