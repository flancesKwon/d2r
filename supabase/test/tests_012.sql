-- 012 검사: 거래완료 양쪽 확인, 불발, 3일 자동 완료, 새 알림
\set ON_ERROR_STOP on
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
REVOKE SELECT ON public.tb_profile FROM app_user;
REVOKE UPDATE ON public.tb_trade_deal FROM app_user;
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
-- 알림 수 세기 (RLS 없이)
CREATE OR REPLACE FUNCTION z_notes(u uuid, pat text) RETURNS int LANGUAGE sql SECURITY DEFINER AS $$
  SELECT count(*)::int FROM public.tb_notification WHERE user_id = u AND text LIKE pat
$$;
CREATE OR REPLACE FUNCTION z_deal(p_post text) RETURNS public.tb_trade_deal LANGUAGE sql SECURITY DEFINER AS $$
  SELECT * FROM public.tb_trade_deal WHERE post_title = p_post
$$;
CREATE OR REPLACE FUNCTION z_post_status(p_post text) RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT status FROM public.tb_trade_post WHERE item_name = p_post
$$;
GRANT EXECUTE ON FUNCTION z_notes(uuid, text), z_deal(text), z_post_status(text) TO app_user;

INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('aaaaaaaa-0000-0000-0000-00000000000a', 's@x.com', '{"name":"판매자"}'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'b@x.com', '{"name":"구매자"}'),
  ('cccccccc-0000-0000-0000-00000000000c', 'c@x.com', '{"name":"남"}');
SET ROLE app_user;

-- 판매글 3개 -> 구매신청 -> 수락 (거래방 3개)
SELECT test_login('aaaaaaaa-0000-0000-0000-00000000000a');
INSERT INTO public.tb_trade_post (author_id, category, item_name, price, realm, ladder, hardcore) VALUES
  (auth.uid(), '룬', '베르', '조던 2', '아시아', '레더', '일반'),
  (auth.uid(), '룬', '조드', '베르 1', '아시아', '레더', '일반'),
  (auth.uid(), '룬', '참', '이스트 1', '아시아', '레더', '일반');
SELECT test_login('bbbbbbbb-0000-0000-0000-00000000000b');
INSERT INTO public.tb_trade_request (post_id, buyer_id) SELECT id, auth.uid() FROM public.tb_trade_post;
SELECT test_login('aaaaaaaa-0000-0000-0000-00000000000a');
SELECT public.accept_trade_request(id) FROM public.tb_trade_request ORDER BY id;

\echo '[D1] 직접 상태 변경 막힘'
SELECT z_denied('판매자가 직접 거래완료', $$UPDATE public.tb_trade_deal SET status = '거래완료' WHERE post_title = '베르'$$);

\echo '[D2] 한 명만 누르면 확인 대기, 둘 다 누르면 완료'
SELECT z_ok('판매자 누름 -> 확인 대기', public.d2r_deal_done((z_deal('베르')).id) = '확인 대기');
SELECT z_ok('아직 거래중', (z_deal('베르')).status = '거래중');
SELECT z_ok('구매자에게 확인 요청 알림', z_notes('bbbbbbbb-0000-0000-0000-00000000000b', '"베르" 상대가 거래완료 누름%') = 1);
SELECT z_ok('또 눌러도 알림 안 늘어남', public.d2r_deal_done((z_deal('베르')).id) = '확인 대기' AND z_notes('bbbbbbbb-0000-0000-0000-00000000000b', '"베르" 상대가 거래완료 누름%') = 1);
SELECT test_login('cccccccc-0000-0000-0000-00000000000c');
SELECT z_denied('남이 누르기', $$SELECT public.d2r_deal_done((z_deal('베르')).id)$$, '당사자');
SELECT test_login('bbbbbbbb-0000-0000-0000-00000000000b');
SELECT z_ok('구매자도 누름 -> 거래완료', public.d2r_deal_done((z_deal('베르')).id) = '거래완료');
SELECT z_ok('판매글도 거래완료', z_post_status('베르') = '거래완료');
SELECT z_ok('판매자에게 완료 알림', z_notes('aaaaaaaa-0000-0000-0000-00000000000a', '"베르" 거래완료 - 리뷰 작성 가능') = 1);

\echo '[D3] 불발은 한 명이'
SELECT z_ok('구매자 불발', public.d2r_deal_fail((z_deal('조드')).id) = '거래불발');
SELECT z_ok('판매글 다시 판매중', z_post_status('조드') = '판매중');
SELECT z_ok('끝난 거래는 완료 안 됨', public.d2r_deal_done((z_deal('조드')).id) = '거래불발');

\echo '[D4] 한쪽만 누르고 3일 지나면 자동 완료'
SELECT public.d2r_deal_done((z_deal('참')).id);
SELECT z_ok('3일 안 지남 -> 그대로', public.d2r_settle_deals() = 0);
RESET ROLE;
UPDATE public.tb_trade_deal SET buyer_done_at = now() - interval '4 days' WHERE post_title = '참';
SET ROLE app_user;
SELECT test_login('aaaaaaaa-0000-0000-0000-00000000000a');
SELECT z_ok('판매자가 목록 열면 자동 완료', public.d2r_settle_deals() = 1);
SELECT z_ok('거래완료됨', (z_deal('참')).status = '거래완료');
SELECT z_ok('두 사람 다 자동 완료 알림', z_notes('aaaaaaaa-0000-0000-0000-00000000000a', '"참" 거래완료 (3일 지나 자동)%') = 1 AND z_notes('bbbbbbbb-0000-0000-0000-00000000000b', '"참" 거래완료 (3일 지나 자동)%') = 1);

\echo '[D5] 거래방 새 메시지 알림 (안 읽은 게 있으면 안 쌓임)'
RESET ROLE;
-- 메시지 알림 검사는 거래중인 방이 필요 -> 새 판매글 하나 더
SET ROLE app_user;
SELECT test_login('aaaaaaaa-0000-0000-0000-00000000000a');
INSERT INTO public.tb_trade_post (author_id, category, item_name, price, realm, ladder, hardcore) VALUES (auth.uid(), '룬', '로', '이스트 1', '아시아', '레더', '일반');
SELECT test_login('bbbbbbbb-0000-0000-0000-00000000000b');
INSERT INTO public.tb_trade_request (post_id, buyer_id) SELECT id, auth.uid() FROM public.tb_trade_post WHERE item_name = '로';
SELECT test_login('aaaaaaaa-0000-0000-0000-00000000000a');
SELECT public.accept_trade_request(id) FROM public.tb_trade_request WHERE status = 'pending';
INSERT INTO public.tb_trade_deal_message (deal_id, sender_id, text) VALUES ((z_deal('로')).id, auth.uid(), '안녕하세요');
INSERT INTO public.tb_trade_deal_message (deal_id, sender_id, text) VALUES ((z_deal('로')).id, auth.uid(), '접속하셨나요');
SELECT z_ok('메시지 2개에 알림 1개', z_notes('bbbbbbbb-0000-0000-0000-00000000000b', '"로" 거래방 새 메시지') = 1);

\echo '[D6] 후기 받음 알림'
SELECT test_login('bbbbbbbb-0000-0000-0000-00000000000b');
INSERT INTO public.tb_trade_deal_review (deal_id, from_id, to_id, rating, comment) VALUES ((z_deal('베르')).id, auth.uid(), 'aaaaaaaa-0000-0000-0000-00000000000a', 5, '좋아요');
SELECT z_ok('판매자에게 후기 알림', z_notes('aaaaaaaa-0000-0000-0000-00000000000a', '"베르" 후기 받음 ★★★★★') = 1);
\echo '전부 통과'
