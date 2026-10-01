-- ============================================================
--  004 검사: 두 사람이 실제로 쓰는 흐름 전체 + 도배 방지
--  순서: local_prelude(auth 흉내) -> schema.sql -> notify_triggers -> 002 -> 003 -> 004 -> 004(재실행) -> 이 파일
--  하나라도 틀리면 예외로 멈춤
-- ============================================================
\set ON_ERROR_STOP on

GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO app_user;

CREATE OR REPLACE FUNCTION f_ok(label text, cond boolean) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF cond THEN RAISE NOTICE '  OK   %', label; ELSE RAISE EXCEPTION '실패: %', label; END IF; END $$;
CREATE OR REPLACE FUNCTION f_denied(label text, stmt text, pat text DEFAULT NULL) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE stmt;
  EXCEPTION WHEN others THEN
    IF pat IS NOT NULL AND SQLERRM !~ pat THEN RAISE EXCEPTION '실패: % — 다른 이유로 막힘: %', label, SQLERRM; END IF;
    RAISE NOTICE '  OK   % (차단: %)', label, SQLERRM; RETURN;
  END;
  RAISE EXCEPTION '실패: % — 막혀야 하는데 통과함', label;
END $$;
GRANT EXECUTE ON FUNCTION f_ok(text, boolean), f_denied(text, text, text) TO app_user;

-- 판매자 S, 구매자 B, 운영진 M
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('aaaaaaaa-0000-0000-0000-00000000000a', 's@x.com', '{"name":"판매자"}'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'b@x.com', '{"name":"구매자"}'),
  ('cccccccc-0000-0000-0000-00000000000c', 'm@x.com', '{"name":"운영진"}');
ALTER TABLE public.tb_profile DISABLE TRIGGER trg_guard_profile_role;
UPDATE public.tb_profile SET role = 'moderator' WHERE id = 'cccccccc-0000-0000-0000-00000000000c';
ALTER TABLE public.tb_profile ENABLE TRIGGER trg_guard_profile_role;

SET ROLE app_user;

\echo '[F1] 판매자: 판매글 등록'
SELECT test_login('aaaaaaaa-0000-0000-0000-00000000000a');
INSERT INTO public.tb_trade_post (author_id, category, item_name, price, realm, ladder, hardcore)
  VALUES (auth.uid(), '룬', '조르단의 반지', '이스트 3', '아시아', '레더', '일반');
SELECT f_ok('판매글 보임', (SELECT count(*) = 1 FROM public.tb_trade_post));

\echo '[F2] 구매자: 구매신청 -> 판매자에게 알림'
SELECT test_login('bbbbbbbb-0000-0000-0000-00000000000b');
INSERT INTO public.tb_trade_request (post_id, buyer_id, message)
  SELECT id, auth.uid(), '삽니다' FROM public.tb_trade_post;
SELECT f_denied('같은 글에 대기 신청 두 번', $$INSERT INTO public.tb_trade_request (post_id, buyer_id) SELECT id, auth.uid() FROM public.tb_trade_post$$);
SELECT test_login('aaaaaaaa-0000-0000-0000-00000000000a');
SELECT f_ok('판매자 알림: 새 구매신청', (SELECT count(*) = 1 FROM public.tb_notification WHERE text LIKE '%새 구매신청'));
SELECT f_ok('판매자에게 신청 보임', (SELECT count(*) = 1 FROM public.tb_trade_request));

\echo '[F3] 판매자: 수락 -> 거래방 + 구매자 알림'
SELECT test_login('bbbbbbbb-0000-0000-0000-00000000000b');
SELECT f_denied('구매자가 수락', $$SELECT public.accept_trade_request((SELECT id FROM public.tb_trade_request LIMIT 1))$$, '판매자만');
SELECT test_login('aaaaaaaa-0000-0000-0000-00000000000a');
SELECT public.accept_trade_request((SELECT id FROM public.tb_trade_request LIMIT 1));
SELECT f_ok('거래방 생김', (SELECT count(*) = 1 FROM public.tb_trade_deal WHERE status = '거래중'));
SELECT f_denied('두 번 수락', $$SELECT public.accept_trade_request((SELECT id FROM public.tb_trade_request LIMIT 1))$$, '이미 처리');
SELECT test_login('bbbbbbbb-0000-0000-0000-00000000000b');
SELECT f_ok('구매자 알림: 거래 시작', (SELECT count(*) = 1 FROM public.tb_notification WHERE text LIKE '%거래 시작'));

\echo '[F4] 거래방 대화 - 당사자만'
INSERT INTO public.tb_trade_deal_message (deal_id, sender_id, text) SELECT id, auth.uid(), '접속했어요' FROM public.tb_trade_deal;
SELECT test_login('aaaaaaaa-0000-0000-0000-00000000000a');
INSERT INTO public.tb_trade_deal_message (deal_id, sender_id, text) SELECT id, auth.uid(), '방 만들게요' FROM public.tb_trade_deal;
SELECT f_ok('대화 2개', (SELECT count(*) = 2 FROM public.tb_trade_deal_message));
SELECT test_login('cccccccc-0000-0000-0000-00000000000c');
SELECT f_ok('제3자는 거래 대화 안 보임', (SELECT count(*) = 0 FROM public.tb_trade_deal_message));

\echo '[F5] 거래완료 전엔 리뷰 불가 -> 완료 -> 리뷰'
SELECT test_login('bbbbbbbb-0000-0000-0000-00000000000b');
SELECT f_denied('완료 전 리뷰', $$INSERT INTO public.tb_trade_deal_review (deal_id, from_id, to_id, rating) SELECT id, auth.uid(), seller_id, 5 FROM public.tb_trade_deal$$);
SELECT test_login('aaaaaaaa-0000-0000-0000-00000000000a');
UPDATE public.tb_trade_deal SET status = '거래완료';
SELECT test_login('bbbbbbbb-0000-0000-0000-00000000000b');
SELECT f_ok('구매자 알림: 거래완료 - 리뷰 작성 가능', (SELECT count(*) = 1 FROM public.tb_notification WHERE text LIKE '%거래완료 - 리뷰 작성 가능'));
INSERT INTO public.tb_trade_deal_review (deal_id, from_id, to_id, rating, comment) SELECT id, auth.uid(), seller_id, 5, '빠른 거래' FROM public.tb_trade_deal;
SELECT f_denied('리뷰 두 번', $$INSERT INTO public.tb_trade_deal_review (deal_id, from_id, to_id, rating) SELECT id, auth.uid(), seller_id, 1 FROM public.tb_trade_deal$$);
SELECT test_logout();
SELECT f_ok('받은 리뷰는 누구나 봄', (SELECT count(*) = 1 FROM public.tb_trade_deal_review WHERE rating = 5));

\echo '[F6] 쪽지'
SELECT test_login('bbbbbbbb-0000-0000-0000-00000000000b');
SELECT public.open_conversation('aaaaaaaa-0000-0000-0000-00000000000a') AS conv_id \gset
SELECT f_ok('같은 상대면 같은 방', (SELECT public.open_conversation('aaaaaaaa-0000-0000-0000-00000000000a') = :conv_id));
INSERT INTO public.tb_dm_message (conversation_id, sender_id, text) VALUES (:conv_id, auth.uid(), '감사합니다');
SELECT test_login('aaaaaaaa-0000-0000-0000-00000000000a');
SELECT f_ok('상대에게 쪽지 보임', (SELECT count(*) = 1 FROM public.tb_dm_message));
UPDATE public.tb_dm_message SET read_at = now();
SELECT f_ok('읽음 처리', (SELECT read_at IS NOT NULL FROM public.tb_dm_message));
SELECT test_login('cccccccc-0000-0000-0000-00000000000c');
SELECT f_ok('제3자는 쪽지 안 보임', (SELECT count(*) = 0 FROM public.tb_dm_message));

\echo '[F7] 신고 -> 운영진 처리 -> 정지 -> 정지 중엔 쓰기·수락 불가'
SELECT test_login('bbbbbbbb-0000-0000-0000-00000000000b');
INSERT INTO public.tb_report (target_type, target_id, reason) SELECT 'trade_post', id::text, 'scam' FROM public.tb_trade_post;
SELECT f_denied('없는 대상 신고', $$INSERT INTO public.tb_report (target_type, target_id, reason) VALUES ('trade_post', '999999', 'spam')$$, '신고 대상 없음');
SELECT test_login('cccccccc-0000-0000-0000-00000000000c');
SELECT f_ok('운영진에게 신고 보임', (SELECT count(*) = 1 FROM public.tb_report WHERE status = 'open'));
UPDATE public.tb_report SET status = 'resolved';
UPDATE public.tb_profile SET suspended_until = now() + interval '1 day', suspended_reason = '사기' WHERE id = 'aaaaaaaa-0000-0000-0000-00000000000a';
SELECT test_login('aaaaaaaa-0000-0000-0000-00000000000a');
SELECT f_denied('정지 중 판매글 등록', $$INSERT INTO public.tb_trade_post (author_id, category, item_name, price, realm, ladder, hardcore) VALUES (auth.uid(), '룬', '벡스', '1', '아시아', '레더', '일반')$$);
SELECT test_login('bbbbbbbb-0000-0000-0000-00000000000b');
RESET ROLE;
-- 정지 전 글에 새 신청 (구매자는 정지 아님)
UPDATE public.tb_trade_post SET status = '판매중';
SET ROLE app_user;
INSERT INTO public.tb_trade_request (post_id, buyer_id) SELECT id, auth.uid() FROM public.tb_trade_post;
SELECT test_login('aaaaaaaa-0000-0000-0000-00000000000a');
SELECT f_denied('정지 중 구매신청 수락', $$SELECT public.accept_trade_request((SELECT id FROM public.tb_trade_request WHERE status = 'pending'))$$, '이용 정지');
SELECT test_login('cccccccc-0000-0000-0000-00000000000c');
UPDATE public.tb_profile SET suspended_until = NULL WHERE id = 'aaaaaaaa-0000-0000-0000-00000000000a';

\echo '[R1] 도배 방지 - 커뮤니티 글 10분에 5개'
SELECT test_login('bbbbbbbb-0000-0000-0000-00000000000b');
INSERT INTO public.tb_community_post (author_id, category, title, content)
  SELECT auth.uid(), '잡담', '글 ' || g, '내용' FROM generate_series(1, 5) g;
SELECT f_denied('6번째 글', $$INSERT INTO public.tb_community_post (author_id, category, title, content) VALUES (auth.uid(), '잡담', '6', 'x')$$, '도배 방지');
-- 지워도 개수에 들어감 (사이트는 글을 완전히 지움)
DELETE FROM public.tb_community_post WHERE title LIKE '글 %';
SELECT f_denied('지우고 다시 써도 막힘', $$INSERT INTO public.tb_community_post (author_id, category, title, content) VALUES (auth.uid(), '잡담', '7', 'x')$$, '도배 방지');
RESET ROLE;
UPDATE public.tb_rate_log SET created_at = now() - interval '11 minutes' WHERE kind = 'tb_community_post';
SET ROLE app_user;
INSERT INTO public.tb_community_post (author_id, category, title, content) VALUES (auth.uid(), '잡담', '10분 뒤', 'x');
SELECT f_ok('10분 지나면 다시 됨', (SELECT count(*) = 1 FROM public.tb_community_post WHERE title = '10분 뒤'));

\echo '[R2] 도배 방지 - 다른 사람은 영향 없음, 운영진은 제외'
SELECT test_login('aaaaaaaa-0000-0000-0000-00000000000a');
INSERT INTO public.tb_community_post (author_id, category, title, content) VALUES (auth.uid(), '잡담', '판매자 글', 'x');
SELECT test_login('cccccccc-0000-0000-0000-00000000000c');
INSERT INTO public.tb_community_post (author_id, category, title, content)
  SELECT auth.uid(), '공략', '공지 ' || g, 'x' FROM generate_series(1, 8) g;
SELECT f_ok('운영진은 8개도 됨', (SELECT count(*) = 8 FROM public.tb_community_post WHERE title LIKE '공지 %'));

\echo '[R3] 도배 방지 - 댓글 1분 5개, 쪽지 1분 20개'
SELECT test_login('bbbbbbbb-0000-0000-0000-00000000000b');
INSERT INTO public.tb_community_comment (post_id, author_id, content)
  SELECT (SELECT max(id) FROM public.tb_community_post), auth.uid(), '댓글' FROM generate_series(1, 5);
SELECT f_denied('6번째 댓글', $$INSERT INTO public.tb_community_comment (post_id, author_id, content) SELECT max(id), auth.uid(), 'x' FROM public.tb_community_post$$, '도배 방지');
INSERT INTO public.tb_dm_message (conversation_id, sender_id, text) SELECT :conv_id, auth.uid(), '쪽지' FROM generate_series(1, 19);
SELECT f_denied('21번째 쪽지', $$INSERT INTO public.tb_dm_message (conversation_id, sender_id, text) VALUES (:conv_id, auth.uid(), 'x')$$, '도배 방지');
SELECT f_ok('도배로 막혀도 같은 방 다시 열기는 됨', (SELECT public.open_conversation('aaaaaaaa-0000-0000-0000-00000000000a') = :conv_id));

\echo '[R4] SQL Editor(로그인 없음)는 제한 없음'
RESET ROLE;
SELECT test_logout();
INSERT INTO public.tb_community_post (author_id, category, title, content)
  SELECT 'bbbbbbbb-0000-0000-0000-00000000000b', '잡담', '관리 작업 ' || g, 'x' FROM generate_series(1, 10) g;
SELECT f_ok('SQL Editor 는 10개도 됨', (SELECT count(*) = 10 FROM public.tb_community_post WHERE title LIKE '관리 작업 %'));

\echo '004 검사 전부 통과'
