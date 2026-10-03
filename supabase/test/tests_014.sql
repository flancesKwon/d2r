-- 014 검사: 없어진 글을 가리키는 알림 정리
\set ON_ERROR_STOP on
CREATE OR REPLACE FUNCTION z_ok(label text, cond boolean) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF cond THEN RAISE NOTICE '  OK   %', label; ELSE RAISE EXCEPTION '실패: %', label; END IF; END $$;
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('aaaaaaaa-0000-0000-0000-00000000000a', 's@x.com', '{"name":"판매자"}'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'b@x.com', '{"name":"구매자"}');
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
REVOKE SELECT ON public.tb_profile FROM app_user;
REVOKE UPDATE ON public.tb_trade_deal FROM app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO app_user;

\echo '[O1] 지금 남은 알림 정리'
SET ROLE app_user;
SELECT test_login('aaaaaaaa-0000-0000-0000-00000000000a');
INSERT INTO public.tb_trade_post (author_id, category, item_name, price, realm, ladder, hardcore) VALUES (auth.uid(), '룬', '벡스 룬', '1', '아시아', '레더', '일반');
SELECT test_login('bbbbbbbb-0000-0000-0000-00000000000b');
INSERT INTO public.tb_trade_request (post_id, buyer_id) SELECT id, auth.uid() FROM public.tb_trade_post;
SELECT test_login('aaaaaaaa-0000-0000-0000-00000000000a');
SELECT public.accept_trade_request((SELECT id FROM public.tb_trade_request));
RESET ROLE;
SELECT z_ok('알림 생김 (거래 시작·새 구매신청)', (SELECT count(*) >= 2 FROM public.tb_notification));
-- 예전처럼 알림만 남은 상태 만들기: 트리거 없이 글만 지움
ALTER TABLE public.tb_trade_post DISABLE TRIGGER trg_delete_link_notifications;
ALTER TABLE public.tb_trade_deal DISABLE TRIGGER trg_delete_link_notifications;
DELETE FROM public.tb_trade_post;
ALTER TABLE public.tb_trade_post ENABLE TRIGGER trg_delete_link_notifications;
ALTER TABLE public.tb_trade_deal ENABLE TRIGGER trg_delete_link_notifications;
INSERT INTO public.tb_notification (user_id, text, link) VALUES ('aaaaaaaa-0000-0000-0000-00000000000a', '남아야 하는 알림', '/mypage');
SELECT z_ok('남은 알림 있음', (SELECT count(*) >= 3 FROM public.tb_notification));
-- 014 의 1) 정리 문장과 같음
delete from public.tb_notification n
 where (n.link ~ '^/trade/\d+$'     and not exists (select 1 from public.tb_trade_post p     where p.id = substring(n.link from '\d+$')::bigint))
    or (n.link ~ '^/deals/\d+$'     and not exists (select 1 from public.tb_trade_deal d     where d.id = substring(n.link from '\d+$')::bigint))
    or (n.link ~ '^/community/\d+$' and not exists (select 1 from public.tb_community_post c where c.id = substring(n.link from '\d+$')::bigint));
SELECT z_ok('없는 곳 가리키는 알림만 지워짐', (SELECT count(*) = 1 AND bool_and(link = '/mypage') FROM public.tb_notification));

\echo '[O2] 앞으로: 판매글 지우면 알림도'
SET ROLE app_user;
SELECT test_login('aaaaaaaa-0000-0000-0000-00000000000a');
INSERT INTO public.tb_trade_post (author_id, category, item_name, price, realm, ladder, hardcore) VALUES (auth.uid(), '룬', '자 룬', '1', '아시아', '레더', '일반');
SELECT test_login('bbbbbbbb-0000-0000-0000-00000000000b');
INSERT INTO public.tb_trade_request (post_id, buyer_id) SELECT id, auth.uid() FROM public.tb_trade_post;
SELECT test_login('aaaaaaaa-0000-0000-0000-00000000000a');
SELECT public.accept_trade_request((SELECT id FROM public.tb_trade_request));
DELETE FROM public.tb_trade_post WHERE item_name = '자 룬';
RESET ROLE;
SELECT z_ok('판매글·거래방 알림 같이 지워짐', (SELECT count(*) = 1 FROM public.tb_notification));
\echo '전부 통과'
