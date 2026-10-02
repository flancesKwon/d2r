-- 009 검사: 공지·고정, 운영 기록, 신고 누적 자동 숨김, 금칙어, 댓글 알림, 끌어올리기
\set ON_ERROR_STOP on
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
REVOKE SELECT ON public.tb_profile FROM app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO app_user;
CREATE OR REPLACE FUNCTION z_ok(label text, cond boolean) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF cond THEN RAISE NOTICE '  OK   %', label; ELSE RAISE EXCEPTION '실패: %', label; END IF; END $$;
CREATE OR REPLACE FUNCTION z_denied(label text, stmt text, pat text DEFAULT NULL) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE stmt;
  EXCEPTION WHEN others THEN
    IF pat IS NOT NULL AND SQLERRM !~ pat THEN RAISE EXCEPTION '실패: % — 다른 이유: %', label, SQLERRM; END IF;
    RAISE NOTICE '  OK   % (차단: %)', label, SQLERRM; RETURN;
  END;
  RAISE EXCEPTION '실패: % — 막혀야 하는데 통과함', label;
END $$;
GRANT EXECUTE ON FUNCTION z_ok(text, boolean), z_denied(text, text, text) TO app_user;

INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'a@x.com', '{"name":"작성자"}'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'b@x.com', '{"name":"신고1"}'),
  ('cccccccc-0000-0000-0000-00000000000c', 'c@x.com', '{"name":"신고2"}'),
  ('dddddddd-0000-0000-0000-00000000000d', 'd@x.com', '{"name":"신고3"}'),
  ('eeeeeeee-0000-0000-0000-00000000000e', 'e@x.com', '{"name":"운영진"}');
ALTER TABLE public.tb_profile DISABLE TRIGGER trg_guard_profile_role;
UPDATE public.tb_profile SET role = 'moderator' WHERE id = 'eeeeeeee-0000-0000-0000-00000000000e';
ALTER TABLE public.tb_profile ENABLE TRIGGER trg_guard_profile_role;
SET ROLE app_user;

\echo '[Z1] 공지는 운영진만, 고정은 운영진 함수로만'
SELECT test_login('aaaaaaaa-0000-0000-0000-00000000000a');
SELECT z_denied('일반 회원이 공지 작성', $$INSERT INTO public.tb_community_post (author_id, category, title, content) VALUES (auth.uid(), '공지', '가짜 공지', 'x')$$, '운영진만');
INSERT INTO public.tb_community_post (author_id, category, title, content, pinned) VALUES (auth.uid(), '잡담', '내 글', '본문', true);
SELECT z_ok('일반 회원은 고정 못 함', (SELECT NOT pinned FROM public.tb_community_post WHERE title = '내 글'));
SELECT z_denied('일반 회원 고정 함수', $$SELECT public.d2r_set_pinned((SELECT id FROM public.tb_community_post WHERE title = '내 글'), true)$$, '운영진만');
SELECT test_login('eeeeeeee-0000-0000-0000-00000000000e');
INSERT INTO public.tb_community_post (author_id, category, title, content) VALUES (auth.uid(), '공지', '오픈 안내', '공지 본문');
SELECT public.d2r_set_pinned((SELECT id FROM public.tb_community_post WHERE title = '오픈 안내'), true);
SELECT z_ok('운영진 공지 고정됨', (SELECT pinned FROM public.tb_community_post WHERE title = '오픈 안내'));
SELECT z_ok('고정 기록 남음', (SELECT count(*) = 1 FROM public.tb_admin_log WHERE action = '고정'));

\echo '[Z2] 댓글 알림'
SELECT test_login('bbbbbbbb-0000-0000-0000-00000000000b');
INSERT INTO public.tb_community_comment (post_id, author_id, content) SELECT id, auth.uid(), '댓글' FROM public.tb_community_post WHERE title = '내 글';
SELECT test_login('aaaaaaaa-0000-0000-0000-00000000000a');
SELECT z_ok('글쓴이에게 새 댓글 알림', (SELECT count(*) = 1 FROM public.tb_notification WHERE text LIKE '%새 댓글'));
INSERT INTO public.tb_community_comment (post_id, author_id, content) SELECT id, auth.uid(), '내 댓글' FROM public.tb_community_post WHERE title = '내 글';
SELECT z_ok('내 글에 내가 단 댓글은 알림 없음', (SELECT count(*) = 1 FROM public.tb_notification WHERE text LIKE '%새 댓글'));

\echo '[Z3] 금칙어'
SELECT z_denied('금칙어 글', $$INSERT INTO public.tb_community_post (author_id, category, title, content) VALUES (auth.uid(), '잡담', '팝니다', '현 거 래 합니다')$$, '금칙어');
SELECT z_denied('금칙어 판매글 가격', $$INSERT INTO public.tb_trade_post (author_id, category, item_name, price, realm, ladder, hardcore) VALUES (auth.uid(), '룬', '베르', '현금거래 가능', '아시아', '레더', '일반')$$, '금칙어');
SELECT z_denied('일반 회원이 금칙어 추가', $$INSERT INTO public.tb_banned_word (word) VALUES ('테스트')$$);
SELECT test_login('eeeeeeee-0000-0000-0000-00000000000e');
INSERT INTO public.tb_banned_word (word) VALUES ('사기꾼');
SELECT z_ok('운영진 금칙어 추가 + 기록', (SELECT count(*) = 1 FROM public.tb_admin_log WHERE action = '금칙어 추가'));
INSERT INTO public.tb_community_post (author_id, category, title, content) VALUES (auth.uid(), '공지', '현거래 금지 안내', '현거래 하지 마세요');
SELECT z_ok('운영진은 금칙어 안내글 작성 가능', (SELECT count(*) = 1 FROM public.tb_community_post WHERE title = '현거래 금지 안내'));

\echo '[Z4] 신고 3명이면 자동 숨김, 전부 기각되면 다시 보임'
SELECT test_login('bbbbbbbb-0000-0000-0000-00000000000b');
INSERT INTO public.tb_report (target_type, target_id, reason) SELECT 'community_post', id::text, 'spam' FROM public.tb_community_post WHERE title = '내 글';
SELECT test_login('cccccccc-0000-0000-0000-00000000000c');
INSERT INTO public.tb_report (target_type, target_id, reason) SELECT 'community_post', id::text, 'spam' FROM public.tb_community_post WHERE title = '내 글';
SELECT z_ok('2명까진 그대로 보임', (SELECT count(*) = 1 FROM public.tb_community_post WHERE title = '내 글'));
SELECT test_login('dddddddd-0000-0000-0000-00000000000d');
INSERT INTO public.tb_report (target_type, target_id, reason) SELECT 'community_post', id::text, 'abuse' FROM public.tb_community_post WHERE title = '내 글';
SELECT z_ok('3명째에 가려짐', (SELECT count(*) = 0 FROM public.tb_community_post WHERE title = '내 글'));
SELECT test_login('eeeeeeee-0000-0000-0000-00000000000e');
SELECT z_ok('운영진에게 자동 숨김 목록 보임', (SELECT count(*) = 1 FROM public.tb_auto_hidden));
SELECT z_ok('자동 숨김 기록', (SELECT count(*) = 1 FROM public.tb_admin_log WHERE action = '자동 숨김'));
UPDATE public.tb_report SET status = 'dismissed';
SELECT test_login('aaaaaaaa-0000-0000-0000-00000000000a');
SELECT z_ok('전부 기각되면 다시 보임', (SELECT count(*) = 1 FROM public.tb_community_post WHERE title = '내 글'));

\echo '[Z5] 운영 기록: 남의 글 삭제·정지'
SELECT test_login('eeeeeeee-0000-0000-0000-00000000000e');
DELETE FROM public.tb_community_comment WHERE content = '댓글';
SELECT z_ok('남의 댓글 삭제 기록', (SELECT count(*) = 1 FROM public.tb_admin_log WHERE action = '삭제'));
UPDATE public.tb_profile SET suspended_until = now() + interval '1 day', suspended_reason = '도배' WHERE id = 'bbbbbbbb-0000-0000-0000-00000000000b';
SELECT z_ok('정지 기록', (SELECT count(*) = 1 FROM public.tb_admin_log WHERE action = '정지' AND detail LIKE '%도배%'));
SELECT test_login('aaaaaaaa-0000-0000-0000-00000000000a');
SELECT z_ok('일반 회원은 운영 기록 못 봄', (SELECT count(*) = 0 FROM public.tb_admin_log));

\echo '[Z6] 끌어올리기'
INSERT INTO public.tb_trade_post (author_id, category, item_name, price, realm, ladder, hardcore) VALUES (auth.uid(), '룬', '벡스', '이스트 1', '아시아', '레더', '일반');
SELECT z_denied('올린 지 하루 안 됐으면 막힘', $$SELECT public.d2r_bump_trade_post((SELECT id FROM public.tb_trade_post WHERE item_name = '벡스'))$$, '하루 한 번');
UPDATE public.tb_trade_post SET bumped_at = now() - interval '3 days' WHERE item_name = '벡스';
SELECT z_ok('직접 고치기는 무시됨', (SELECT bumped_at > now() - interval '1 hour' FROM public.tb_trade_post WHERE item_name = '벡스'));
RESET ROLE;
SELECT test_logout();
UPDATE public.tb_trade_post SET bumped_at = now() - interval '2 days' WHERE item_name = '벡스';
SET ROLE app_user;
SELECT test_login('aaaaaaaa-0000-0000-0000-00000000000a');
SELECT public.d2r_bump_trade_post((SELECT id FROM public.tb_trade_post WHERE item_name = '벡스'));
SELECT z_ok('하루 지나면 끌어올려짐', (SELECT bumped_at > now() - interval '1 minute' FROM public.tb_trade_post WHERE item_name = '벡스'));
SELECT test_login('bbbbbbbb-0000-0000-0000-00000000000b');
SELECT z_denied('남의 글 끌어올리기', $$SELECT public.d2r_bump_trade_post((SELECT id FROM public.tb_trade_post WHERE item_name = '벡스'))$$, '내 판매글만');

\echo '009 검사 전부 통과'
