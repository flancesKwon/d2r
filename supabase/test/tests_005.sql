-- ============================================================
--  005 검사: 리뷰 양쪽, 거래방 결과 -> 판매글, 정지 사유 숨김
--  순서: local_prelude -> schema -> notify_triggers -> 002 -> 003 -> 004 -> 005 -> 005(재실행) -> 이 파일
-- ============================================================
\set ON_ERROR_STOP on

GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
-- 프로필은 Supabase 처럼 authenticated 의 칸 단위 권한만 받게
REVOKE SELECT ON public.tb_profile FROM app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO app_user;

CREATE OR REPLACE FUNCTION h_ok(label text, cond boolean) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF cond THEN RAISE NOTICE '  OK   %', label; ELSE RAISE EXCEPTION '실패: %', label; END IF; END $$;
CREATE OR REPLACE FUNCTION h_denied(label text, stmt text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE stmt; EXCEPTION WHEN others THEN RAISE NOTICE '  OK   % (차단: %)', label, SQLERRM; RETURN; END;
  RAISE EXCEPTION '실패: % — 막혀야 하는데 통과함', label;
END $$;
GRANT EXECUTE ON FUNCTION h_ok(text, boolean), h_denied(text, text) TO app_user;

INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('aaaaaaaa-0000-0000-0000-00000000000a', 's@x.com', '{"name":"판매자"}'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'b@x.com', '{"name":"구매자"}'),
  ('dddddddd-0000-0000-0000-00000000000d', 'd@x.com', '{"name":"구매자둘"}'),
  ('cccccccc-0000-0000-0000-00000000000c', 'm@x.com', '{"name":"운영진"}');
ALTER TABLE public.tb_profile DISABLE TRIGGER trg_guard_profile_role;
UPDATE public.tb_profile SET role = 'moderator' WHERE id = 'cccccccc-0000-0000-0000-00000000000c';
ALTER TABLE public.tb_profile ENABLE TRIGGER trg_guard_profile_role;

SET ROLE app_user;

\echo '[V1] 거래완료 -> 판매글 거래완료 + 다른 대기 신청 거절, 리뷰는 양쪽 다'
SELECT test_login('aaaaaaaa-0000-0000-0000-00000000000a');
INSERT INTO public.tb_trade_post (author_id, category, item_name, price, realm, ladder, hardcore)
  VALUES (auth.uid(), '룬', '베르', '조던 2', '아시아', '레더', '일반');
SELECT test_login('bbbbbbbb-0000-0000-0000-00000000000b');
INSERT INTO public.tb_trade_request (post_id, buyer_id) SELECT id, auth.uid() FROM public.tb_trade_post;
SELECT test_login('dddddddd-0000-0000-0000-00000000000d');
INSERT INTO public.tb_trade_request (post_id, buyer_id) SELECT id, auth.uid() FROM public.tb_trade_post;
SELECT test_login('aaaaaaaa-0000-0000-0000-00000000000a');
SELECT public.accept_trade_request((SELECT id FROM public.tb_trade_request WHERE buyer_id = 'bbbbbbbb-0000-0000-0000-00000000000b'));
UPDATE public.tb_trade_post SET status = '예약중';
UPDATE public.tb_trade_deal SET status = '거래완료';
SELECT h_ok('판매글 거래완료로', (SELECT status = '거래완료' FROM public.tb_trade_post));
SELECT h_ok('다른 대기 신청은 거절', (SELECT status = 'rejected' FROM public.tb_trade_request WHERE buyer_id = 'dddddddd-0000-0000-0000-00000000000d'));
SELECT test_login('dddddddd-0000-0000-0000-00000000000d');
SELECT h_ok('거절된 사람에게 알림', (SELECT count(*) = 1 FROM public.tb_notification WHERE text LIKE '%구매신청 거절됨'));
SELECT test_login('aaaaaaaa-0000-0000-0000-00000000000a');
INSERT INTO public.tb_trade_deal_review (deal_id, from_id, to_id, rating) SELECT id, auth.uid(), buyer_id, 5 FROM public.tb_trade_deal;
SELECT test_login('bbbbbbbb-0000-0000-0000-00000000000b');
INSERT INTO public.tb_trade_deal_review (deal_id, from_id, to_id, rating) SELECT id, auth.uid(), seller_id, 4 FROM public.tb_trade_deal;
SELECT h_ok('리뷰 2개 (양쪽)', (SELECT count(*) = 2 FROM public.tb_trade_deal_review));
SELECT h_denied('같은 사람이 두 번', $$INSERT INTO public.tb_trade_deal_review (deal_id, from_id, to_id, rating) SELECT id, auth.uid(), seller_id, 1 FROM public.tb_trade_deal$$);

\echo '[V2] 거래불발 -> 판매글 다시 판매중'
SELECT test_login('aaaaaaaa-0000-0000-0000-00000000000a');
INSERT INTO public.tb_trade_post (author_id, category, item_name, price, realm, ladder, hardcore)
  VALUES (auth.uid(), '룬', '조드', '베르 1', '아시아', '레더', '일반');
SELECT test_login('bbbbbbbb-0000-0000-0000-00000000000b');
INSERT INTO public.tb_trade_request (post_id, buyer_id) SELECT id, auth.uid() FROM public.tb_trade_post WHERE item_name = '조드';
SELECT test_login('aaaaaaaa-0000-0000-0000-00000000000a');
SELECT public.accept_trade_request((SELECT r.id FROM public.tb_trade_request r JOIN public.tb_trade_post p ON p.id = r.post_id WHERE p.item_name = '조드'));
UPDATE public.tb_trade_post SET status = '예약중' WHERE item_name = '조드';
SELECT test_login('bbbbbbbb-0000-0000-0000-00000000000b');
UPDATE public.tb_trade_deal SET status = '거래불발' WHERE post_title = '조드';
SELECT h_ok('불발이면 다시 판매중', (SELECT status = '판매중' FROM public.tb_trade_post WHERE item_name = '조드'));

\echo '[V3] 정지 사유는 본인·운영진만'
SELECT test_login('cccccccc-0000-0000-0000-00000000000c');
UPDATE public.tb_profile SET suspended_until = now() + interval '1 day', suspended_reason = '사기 신고' WHERE id = 'bbbbbbbb-0000-0000-0000-00000000000b';
SELECT test_logout();
SELECT h_ok('비로그인도 닉네임·정지 기간은 보임', (SELECT count(*) = 4 FROM (SELECT id, nickname, suspended_until FROM public.tb_profile) x));
SELECT h_denied('비로그인이 정지 사유 읽기', $$SELECT suspended_reason FROM public.tb_profile$$);
SELECT h_denied('select * 도 막힘', $$SELECT * FROM public.tb_profile$$);
SELECT test_login('dddddddd-0000-0000-0000-00000000000d');
SELECT h_ok('남의 정지 사유는 함수로도 안 나옴', (SELECT count(*) = 0 FROM public.d2r_suspension_reasons(array['bbbbbbbb-0000-0000-0000-00000000000b']::uuid[])));
SELECT test_login('bbbbbbbb-0000-0000-0000-00000000000b');
SELECT h_ok('본인은 자기 정지 사유 봄', (SELECT suspended_reason = '사기 신고' FROM public.d2r_suspension_reasons(array[auth.uid()])));
SELECT test_login('cccccccc-0000-0000-0000-00000000000c');
SELECT h_ok('운영진은 남의 정지 사유 봄', (SELECT count(*) = 1 FROM public.d2r_suspension_reasons(array['bbbbbbbb-0000-0000-0000-00000000000b']::uuid[])));
SELECT test_login('aaaaaaaa-0000-0000-0000-00000000000a');
UPDATE public.tb_profile SET contact = '배틀태그#123' WHERE id = auth.uid();
SELECT h_ok('본인 프로필 수정은 그대로 됨', (SELECT contact = '배틀태그#123' FROM public.tb_profile WHERE id = auth.uid()));

\echo '005 검사 전부 통과'
