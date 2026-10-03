-- 013 검사: 방문 통계
\set ON_ERROR_STOP on
GRANT USAGE ON SCHEMA public TO app_user;
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
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'a@x.com', '{"name":"회원"}'),
  ('eeeeeeee-0000-0000-0000-00000000000e', 'e@x.com', '{"name":"운영"}');
ALTER TABLE public.tb_profile DISABLE TRIGGER USER;
UPDATE public.tb_profile SET role = 'moderator' WHERE id = 'eeeeeeee-0000-0000-0000-00000000000e';
ALTER TABLE public.tb_profile ENABLE TRIGGER USER;
SET ROLE app_user;

\echo '[S1] 기록'
SELECT test_logout();
SELECT public.d2r_track('visitor-aaaa-1', 'gall.dcinside.com', '/');
SELECT public.d2r_track('visitor-aaaa-1', 'www.google.com', '/items');
SELECT public.d2r_track('visitor-bbbb-2', null, '/trade');
SELECT public.d2r_track('short', null, '/');
SELECT test_login('aaaaaaaa-0000-0000-0000-00000000000a');
SELECT public.d2r_track('visitor-cccc-3', 'www.inven.co.kr', '/');
SELECT z_denied('직접 읽기 막힘', $$SELECT * FROM public.tb_visit_daily$$, 'permission');
SELECT z_denied('직접 쓰기 막힘', $$INSERT INTO public.tb_visit_daily (day, visitor) VALUES (current_date, 'xxxxxxxxxx')$$, 'permission');
SELECT z_denied('회원은 통계 못 봄', $$SELECT * FROM public.d2r_visit_stats(7)$$, '운영진만');

\echo '[S2] 통계 (운영진)'
SELECT test_login('eeeeeeee-0000-0000-0000-00000000000e');
SELECT z_ok('30일 줄', (SELECT count(*) = 30 FROM public.d2r_visit_stats(30)));
SELECT z_ok('오늘 방문자 3 (짧은 번호 제외)', (SELECT visitors = 3 FROM public.d2r_visit_stats(1)));
SELECT z_ok('오늘 회원 1', (SELECT members = 1 FROM public.d2r_visit_stats(1)));
SELECT z_ok('오늘 페이지뷰 4', (SELECT views = 4 FROM public.d2r_visit_stats(1)));
SELECT z_ok('유입은 처음 들어온 곳 (디시 1, 인벤 1, 바로 1)', (SELECT count(*) = 3 AND bool_and(visitors = 1) FROM public.d2r_visit_refs(7)));
SELECT z_ok('구글은 두번째 방문이라 안 셈', NOT EXISTS (SELECT 1 FROM public.d2r_visit_refs(7) WHERE ref LIKE '%google%'));
\echo '전부 통과'
