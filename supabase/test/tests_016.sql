-- 016 검사: 48시간 판매 기간·재등록·거래불발 복귀·거래완료 글 삭제 막기
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
CREATE OR REPLACE FUNCTION z_post(p text) RETURNS public.tb_trade_post LANGUAGE sql SECURITY DEFINER AS $$
  SELECT * FROM public.tb_trade_post WHERE item_name = p
$$;
-- 시간 흐름 흉내: 판매 시작을 n 시간 전으로 (관리 쪽에서, 로그인 없이)
CREATE OR REPLACE FUNCTION z_age(p text, h int) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('d2r.bump', '1', true);
  UPDATE public.tb_trade_post SET bumped_at = now() - make_interval(hours => h) WHERE item_name = p;
  PERFORM set_config('d2r.bump', '', true);
END $$;
GRANT EXECUTE ON FUNCTION z_post(text), z_age(text, int) TO app_user;

INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('aaaaaaaa-0000-0000-0000-00000000000a', 's@x.com', '{"name":"판매자"}'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'b@x.com', '{"name":"구매자"}');
SET ROLE app_user;

SELECT test_login('aaaaaaaa-0000-0000-0000-00000000000a');
INSERT INTO public.tb_trade_post (author_id, category, item_name, price, realm, ladder, hardcore) VALUES
  (auth.uid(), '룬', '베르', '조던 2', '아시아', '레더', '일반'),
  (auth.uid(), '룬', '조드', '베르 1', '아시아', '레더', '일반');

\echo '[R1] 48시간 전에는 재등록 막힘'
SELECT z_denied('막 올린 글 재등록', $$SELECT public.d2r_relist_trade_post((z_post('베르')).id, '조던 1')$$, '48시간');

\echo '[R2] 기간 지나면 판매가만 바꿔 재등록'
SELECT z_age('베르', 49);
SELECT test_login('aaaaaaaa-0000-0000-0000-00000000000a');
SELECT z_ok('재등록 됨', public.d2r_relist_trade_post((z_post('베르')).id, '  조던 1  ') IS NOT NULL);
SELECT z_ok('가격 바뀜', (z_post('베르')).price = '조던 1');
SELECT z_ok('판매 기간 새로', (z_post('베르')).bumped_at > now() - interval '1 minute');
SELECT z_denied('바로 또 재등록', $$SELECT public.d2r_relist_trade_post((z_post('베르')).id, '조던 3')$$, '48시간');
SELECT z_age('베르', 49);
SELECT test_login('aaaaaaaa-0000-0000-0000-00000000000a');
SELECT z_denied('빈 가격', $$SELECT public.d2r_relist_trade_post((z_post('베르')).id, '   ')$$, '판매가');
SELECT z_denied('금칙어 가격', $$SELECT public.d2r_relist_trade_post((z_post('베르')).id, '현금거래 가능')$$, '금칙어');

\echo '[R3] 남의 글·직접 수정 막힘'
SELECT test_login('bbbbbbbb-0000-0000-0000-00000000000b');
SELECT z_denied('남이 재등록', $$SELECT public.d2r_relist_trade_post((z_post('베르')).id, '조던 1')$$, '내 판매글');
SELECT test_login('aaaaaaaa-0000-0000-0000-00000000000a');
UPDATE public.tb_trade_post SET bumped_at = now() WHERE item_name = '베르';
SELECT z_ok('직접 바꾼 판매 시작 시각은 무시', (z_post('베르')).bumped_at < now() - interval '48 hours');

\echo '[R4] 예약중 -> 판매중 이면 판매 기간 새로'
SELECT z_age('조드', 60);
SELECT test_login('aaaaaaaa-0000-0000-0000-00000000000a');
UPDATE public.tb_trade_post SET status = '예약중' WHERE item_name = '조드';
SELECT z_ok('예약중일 땐 그대로', (z_post('조드')).bumped_at < now() - interval '48 hours');
UPDATE public.tb_trade_post SET status = '판매중' WHERE item_name = '조드';
SELECT z_ok('판매중 복귀 -> 새 48시간', (z_post('조드')).bumped_at > now() - interval '1 minute');

\echo '[R5] 거래완료 글'
UPDATE public.tb_trade_post SET status = '거래완료' WHERE item_name = '조드';
SELECT z_denied('거래완료 글 재등록', $$SELECT public.d2r_relist_trade_post((z_post('조드')).id, '베르 2')$$, '판매중');
SELECT z_denied('거래완료 글 삭제', $$DELETE FROM public.tb_trade_post WHERE item_name = '조드'$$, '삭제할 수 없음');
DELETE FROM public.tb_trade_post WHERE item_name = '베르';
SELECT z_ok('판매중 글 삭제는 됨', (z_post('베르')).id IS NULL);
\echo '전부 통과'
