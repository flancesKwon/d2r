-- ============================================================
--  003 검사: 빌드 가이드(운영진만 쓰기) · 저장한 빌드(본인만)
--  순서: local_prelude(auth 흉내) -> schema.sql -> 002 -> 003 -> 003(재실행) -> 이 파일
--  하나라도 틀리면 예외로 멈춤
-- ============================================================
\set ON_ERROR_STOP on
\o /dev/null

GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO app_user;

CREATE OR REPLACE FUNCTION g_ok(label text, cond boolean) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF cond THEN RAISE NOTICE '  OK   %', label; ELSE RAISE EXCEPTION '실패: %', label; END IF; END $$;
CREATE OR REPLACE FUNCTION g_denied(label text, stmt text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE stmt; EXCEPTION WHEN others THEN RAISE NOTICE '  OK   % (차단됨)', label; RETURN; END;
  RAISE EXCEPTION '실패: % — 막혀야 하는데 통과함', label;
END $$;
CREATE OR REPLACE FUNCTION g_noop(label text, stmt text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE n bigint;
BEGIN
  EXECUTE stmt; GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN RAISE NOTICE '  OK   % (0건)', label; ELSE RAISE EXCEPTION '실패: % — %건이 바뀜', label, n; END IF;
END $$;
GRANT EXECUTE ON FUNCTION g_ok(text, boolean), g_denied(text, text), g_noop(text, text) TO app_user;

INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('11111111-1111-1111-1111-111111111111', 'a@x.com', '{"name":"운영진"}'),
  ('22222222-2222-2222-2222-222222222222', 'b@x.com', '{"name":"일반A"}'),
  ('33333333-3333-3333-3333-333333333333', 'c@x.com', '{"name":"일반B"}');
-- SQL Editor 에서 하듯 운영진 지정 - "등급은 관리자만" 트리거가 SQL Editor 도 막아서 잠깐 끄고 바꿈
ALTER TABLE public.tb_profile DISABLE TRIGGER trg_guard_profile_role;
UPDATE public.tb_profile SET role = 'moderator' WHERE id = '11111111-1111-1111-1111-111111111111';
ALTER TABLE public.tb_profile ENABLE TRIGGER trg_guard_profile_role;

SET ROLE app_user;

\echo '[G1] 가이드 - 누구나 읽음, 사이트에 있던 8개'
SELECT test_logout();
SELECT g_ok('비로그인도 가이드 8개 보임', (SELECT count(*) = 8 FROM public.tb_guide));
SELECT g_ok('예전 주소(slug) 그대로', (SELECT count(*) = 1 FROM public.tb_guide WHERE slug = 'g-sorc-fire'));

\echo '[G2] 가이드 - 일반 회원은 못 씀'
SELECT test_login('22222222-2222-2222-2222-222222222222');
SELECT g_denied('일반 회원이 가이드 작성',
  $$INSERT INTO public.tb_guide (slug, class_key, class_name, title, author_id)
    VALUES ('g-test-x', 'sorc', '소서리스', '낙서', auth.uid())$$);
SELECT g_noop('일반 회원이 가이드 수정', $$UPDATE public.tb_guide SET title = '탈취' WHERE slug = 'g-sorc-fire'$$);
SELECT g_noop('일반 회원이 가이드 삭제', $$DELETE FROM public.tb_guide WHERE slug = 'g-sorc-fire'$$);

\echo '[G3] 가이드 - 운영진은 쓰고 고치고 지움'
SELECT test_login('11111111-1111-1111-1111-111111111111');
INSERT INTO public.tb_guide (slug, class_key, class_name, title, published, author_id)
  VALUES ('g-new-one', 'barb', '바바리안', '새 가이드', false, auth.uid());
SELECT g_ok('운영진 작성됨', (SELECT count(*) = 1 FROM public.tb_guide WHERE slug = 'g-new-one'));
SELECT g_denied('운영진이 남의 이름으로 작성',
  $$INSERT INTO public.tb_guide (slug, class_key, class_name, title, author_id)
    VALUES ('g-fake', 'barb', '바바리안', '사칭', '22222222-2222-2222-2222-222222222222')$$);
UPDATE public.tb_guide SET title = '고친 제목', author_id = '22222222-2222-2222-2222-222222222222' WHERE slug = 'g-new-one';
SELECT g_ok('운영진 수정됨', (SELECT title = '고친 제목' FROM public.tb_guide WHERE slug = 'g-new-one'));
SELECT g_ok('수정해도 작성자는 안 바뀜', (SELECT author_id = '11111111-1111-1111-1111-111111111111' FROM public.tb_guide WHERE slug = 'g-new-one'));

SELECT test_login('22222222-2222-2222-2222-222222222222');
SELECT g_ok('비공개 가이드는 일반 회원에게 안 보임', (SELECT count(*) = 0 FROM public.tb_guide WHERE slug = 'g-new-one'));
SELECT test_login('11111111-1111-1111-1111-111111111111');
SELECT g_ok('비공개 가이드도 운영진에겐 보임', (SELECT count(*) = 1 FROM public.tb_guide WHERE slug = 'g-new-one'));
DELETE FROM public.tb_guide WHERE slug = 'g-new-one';
SELECT g_ok('운영진 삭제됨', (SELECT count(*) = 0 FROM public.tb_guide WHERE slug = 'g-new-one'));

\echo '[B1] 저장한 빌드 - 본인만'
SELECT test_login('22222222-2222-2222-2222-222222222222');
INSERT INTO public.tb_saved_build (user_id, name, class_key, level, code) VALUES (auth.uid(), '내 파벽', 'sorc', 90, 'abc');
SELECT g_ok('내 빌드 저장됨', (SELECT count(*) = 1 FROM public.tb_saved_build));
SELECT test_login('33333333-3333-3333-3333-333333333333');
SELECT g_ok('남의 빌드는 안 보임', (SELECT count(*) = 0 FROM public.tb_saved_build));
SELECT g_denied('남의 이름으로 빌드 저장',
  $$INSERT INTO public.tb_saved_build (user_id, name, class_key, code) VALUES ('22222222-2222-2222-2222-222222222222', 'x', 'sorc', 'x')$$);
SELECT g_noop('남의 빌드 수정', $$UPDATE public.tb_saved_build SET name = '탈취'$$);
SELECT g_noop('남의 빌드 삭제', $$DELETE FROM public.tb_saved_build$$);
SELECT test_login('11111111-1111-1111-1111-111111111111');
SELECT g_ok('운영진도 남의 빌드는 안 보임', (SELECT count(*) = 0 FROM public.tb_saved_build));
SELECT test_logout();
SELECT g_ok('비로그인은 빌드 안 보임', (SELECT count(*) = 0 FROM public.tb_saved_build));

\echo '[B2] 저장한 빌드 - 1인 100개까지'
SELECT test_login('22222222-2222-2222-2222-222222222222');
INSERT INTO public.tb_saved_build (user_id, name, class_key, code)
  SELECT auth.uid(), '빌드' || g, 'sorc', 'x' FROM generate_series(2, 100) g;
SELECT g_ok('100개 저장됨', (SELECT count(*) = 100 FROM public.tb_saved_build));
SELECT g_denied('101번째 저장',
  $$INSERT INTO public.tb_saved_build (user_id, name, class_key, code) VALUES (auth.uid(), '넘침', 'sorc', 'x')$$);

RESET ROLE;
\echo '================ 003 통과 ================'
