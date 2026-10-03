-- 007 검사: 쪽지방 나가기·쪽지 삭제·수정 막기·거래방 읽음·마지막 활동
\set ON_ERROR_STOP on
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
REVOKE SELECT ON public.tb_profile FROM app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO app_user;
CREATE OR REPLACE FUNCTION k_ok(label text, cond boolean) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF cond THEN RAISE NOTICE '  OK   %', label; ELSE RAISE EXCEPTION '실패: %', label; END IF; END $$;
GRANT EXECUTE ON FUNCTION k_ok(text, boolean) TO app_user;

INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('aaaaaaaa-0000-0000-0000-00000000000a', 's@x.com', '{"name":"판매자"}'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'b@x.com', '{"name":"구매자"}');
SET ROLE app_user;

\echo '[K1] 쪽지 수정은 읽음 표시만, 받은 사람만'
SELECT test_login('aaaaaaaa-0000-0000-0000-00000000000a');
SELECT public.open_conversation('bbbbbbbb-0000-0000-0000-00000000000b') AS cid \gset
INSERT INTO public.tb_dm_message (conversation_id, sender_id, text) VALUES (:cid, auth.uid(), '원래 글');
UPDATE public.tb_dm_message SET read_at = now();
SELECT k_ok('보낸 사람은 자기 쪽지를 읽음으로 못 바꿈', (SELECT read_at IS NULL FROM public.tb_dm_message));
SELECT test_login('bbbbbbbb-0000-0000-0000-00000000000b');
UPDATE public.tb_dm_message SET text = '바꾼 글', read_at = now();
SELECT k_ok('받은 사람이 글은 못 바꿈', (SELECT text = '원래 글' FROM public.tb_dm_message));
SELECT k_ok('받은 사람은 읽음 표시 가능', (SELECT read_at IS NOT NULL FROM public.tb_dm_message));

\echo '[K2] 쪽지 삭제는 내 것만'
DELETE FROM public.tb_dm_message;
SELECT k_ok('남의 쪽지는 안 지워짐', (SELECT count(*) = 1 FROM public.tb_dm_message));
INSERT INTO public.tb_dm_message (conversation_id, sender_id, text) VALUES (:cid, auth.uid(), '내 쪽지');
-- 008 부터 쪽지는 지우지 않고 내 화면에서만 숨김 (d2r_hide_message) - 직접 삭제는 막힘, 숨김은 tests_008 에서
DELETE FROM public.tb_dm_message WHERE text = '내 쪽지';
SELECT k_ok('직접 삭제는 막힘 (008)', (SELECT count(*) = 2 FROM public.tb_dm_message));
SELECT public.d2r_hide_message((SELECT id FROM public.tb_dm_message WHERE text = '내 쪽지'));

\echo '[K3] 나가기는 나에게만'
SELECT public.d2r_leave_conversation(:cid);
SELECT k_ok('내 나간 시각 기록', (SELECT b_left_at IS NOT NULL AND a_left_at IS NULL FROM public.tb_dm_conversation));
SELECT test_login('aaaaaaaa-0000-0000-0000-00000000000a');
SELECT k_ok('상대 방은 그대로 보임 (내가 숨긴 쪽지도 상대에겐 남음)', (SELECT count(*) = 2 FROM public.tb_dm_message));

\echo '[K4] 거래방 읽음'
INSERT INTO public.tb_trade_post (author_id, category, item_name, price, realm, ladder, hardcore)
  VALUES (auth.uid(), '룬', '벡스', '1', '아시아', '레더', '일반');
SELECT test_login('bbbbbbbb-0000-0000-0000-00000000000b');
INSERT INTO public.tb_trade_request (post_id, buyer_id) SELECT id, auth.uid() FROM public.tb_trade_post;
SELECT test_login('aaaaaaaa-0000-0000-0000-00000000000a');
SELECT public.accept_trade_request((SELECT id FROM public.tb_trade_request)) AS did \gset
INSERT INTO public.tb_trade_deal_message (deal_id, sender_id, text) VALUES (:did, auth.uid(), '판매자 메시지');
SELECT public.d2r_mark_deal_read(:did);
SELECT k_ok('내 메시지는 내가 읽어도 그대로 안 읽음', (SELECT read_at IS NULL FROM public.tb_trade_deal_message));
SELECT test_login('bbbbbbbb-0000-0000-0000-00000000000b');
SELECT public.d2r_mark_deal_read(:did);
SELECT k_ok('상대가 읽으면 읽음', (SELECT read_at IS NOT NULL FROM public.tb_trade_deal_message));

\echo '[K5] 마지막 활동'
SELECT public.d2r_touch_last_seen();
SELECT k_ok('기록됨', (SELECT last_seen_at IS NOT NULL FROM public.tb_profile WHERE id = auth.uid()));
SELECT k_ok('5분 안엔 다시 안 씀', (SELECT public.d2r_touch_last_seen() IS NULL));

\echo '007 검사 전부 통과'
