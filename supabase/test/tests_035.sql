-- 035 검사: 방문 통계 상세 + 게시글 열람 기록
\set ON_ERROR_STOP on
-- 준비: 이 검사만 따로 돌릴 때를 위한 역할·로그인 흉내 (이미 있으면 건너뜀)
do $$ begin create role app_user nologin in role authenticated; exception when duplicate_object then null; end $$;
create or replace function public.test_login(u uuid) returns void language sql as $f$ select set_config('request.jwt.claim.sub', u::text, false) $f$;
create or replace function public.test_logout() returns void language sql as $f$ select set_config('request.jwt.claim.sub', '', false) $f$;
create or replace function public.d2r_is_staff() returns boolean language sql stable security definer as $f$
  select exists (select 1 from public.tb_profile where id = auth.uid() and role = 'admin') $f$;
grant usage on schema auth to app_user;
grant execute on function auth.uid() to app_user;
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
INSERT INTO public.tb_profile (id, nickname) VALUES
  ('aaaaaaaa-0000-0000-0000-00000000000a', '회원'),
  ('eeeeeeee-0000-0000-0000-00000000000e', '운영');
ALTER TABLE public.tb_profile DISABLE TRIGGER USER;
UPDATE public.tb_profile SET role = 'admin' WHERE id = 'eeeeeeee-0000-0000-0000-00000000000e';
ALTER TABLE public.tb_profile ENABLE TRIGGER USER;
GRANT SELECT ON public.tb_profile TO app_user;
SET ROLE app_user;

\echo '[S1] 기록: 사람 둘(같은 IP), 봇 하나'
SELECT test_logout();
SELECT set_config('request.headers', '{"x-forwarded-for":"1.2.3.4, 9.9.9.9","user-agent":"Mozilla/5.0 Chrome"}', false);
SELECT public.d2r_track('visitor-aaaa-1', 'gall.dcinside.com', '/');
SELECT public.d2r_track('visitor-aaaa-1', null, '/items');
SELECT public.d2r_track('visitor-bbbb-2', null, '/trade');
SELECT test_login('aaaaaaaa-0000-0000-0000-00000000000a');
SELECT public.d2r_track('visitor-bbbb-2', null, '/trade');
SELECT set_config('request.headers', '{"x-forwarded-for":"5.6.7.8","user-agent":"Googlebot/2.1"}', false);
SELECT test_logout();
SELECT public.d2r_track('visitor-bot-3', null, '/');
SELECT set_config('request.headers', '', false);
SELECT public.d2r_track('visitor-none-4', null, '/');
SELECT z_denied('직접 읽기 막힘', $$SELECT * FROM public.tb_visit_daily$$, 'permission');
SELECT z_denied('회원은 목록 못 봄', $$SELECT * FROM public.d2r_visit_list()$$, '운영진만');

\echo '[S2] 통계 (운영진)'
SELECT test_login('eeeeeeee-0000-0000-0000-00000000000e');
SELECT z_ok('방문자 2 (봇·헤더 없음 제외)', (SELECT visitors = 2 FROM public.d2r_visit_stats(1)));
SELECT z_ok('봇 2 (Googlebot, 헤더 없음)', (SELECT bots = 2 FROM public.d2r_visit_stats(1)));
SELECT z_ok('서로 다른 IP 1', (SELECT ips = 1 FROM public.d2r_visit_stats(1)));
SELECT z_ok('회원 1', (SELECT members = 1 FROM public.d2r_visit_stats(1)));
SELECT z_ok('페이지뷰 4 (봇 제외)', (SELECT views = 4 FROM public.d2r_visit_stats(1)));
SELECT z_ok('목록 4줄', (SELECT count(*) = 4 FROM public.d2r_visit_list()));
SELECT z_ok('IP 원문 안 남음', NOT EXISTS (SELECT 1 FROM public.d2r_visit_list() WHERE ip_hash ~ '[.:]' OR ip_hash IS NULL AND NOT bot));
SELECT z_ok('회원 행에 닉네임', (SELECT count(*) = 1 FROM public.d2r_visit_list() WHERE nickname IS NOT NULL));
SELECT z_ok('봇 표시', (SELECT count(*) = 2 FROM public.d2r_visit_list() WHERE bot));
SELECT z_ok('유입은 봇 뺀 값', (SELECT count(*) = 2 FROM public.d2r_visit_refs(7)));

\echo '[S3] 게시글 열람 기록'
SELECT test_logout();
SELECT set_config('request.headers', '{"x-forwarded-for":"1.2.3.4","user-agent":"Mozilla/5.0 Chrome"}', false);
SELECT public.d2r_track_post_view(7, 'visitor-aaaa-1');
SELECT public.d2r_track_post_view(7, 'visitor-aaaa-1');
SELECT test_login('aaaaaaaa-0000-0000-0000-00000000000a');
SELECT public.d2r_track_post_view(7, 'visitor-bbbb-2');
SELECT public.d2r_track_post_view(8, 'visitor-bbbb-2');
SELECT z_denied('직접 읽기 막힘', $$SELECT * FROM public.tb_post_view$$, 'permission');
SELECT z_denied('회원은 열람 목록 못 봄', $$SELECT * FROM public.d2r_post_viewers(7)$$, '운영진만');
SELECT test_login('eeeeeeee-0000-0000-0000-00000000000e');
SELECT z_ok('7번 글 두 명', (SELECT count(*) = 2 FROM public.d2r_post_viewers(7)));
SELECT z_ok('같은 브라우저 재열람은 횟수만 늘어남', (SELECT views = 2 FROM public.d2r_post_viewers(7) WHERE user_id IS NULL));
SELECT z_ok('회원 닉네임', (SELECT count(*) = 1 FROM public.d2r_post_viewers(7) WHERE nickname IS NOT NULL));
SELECT z_ok('8번 글 한 명', (SELECT count(*) = 1 FROM public.d2r_post_viewers(8)));
\echo '전부 통과'
