-- 011 검사: 운영진 사칭 닉네임
\set ON_ERROR_STOP on
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
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

\echo '[N1] 판정 함수'
SELECT z_ok('관리자', public.d2r_nickname_reserved('관리자'));
SELECT z_ok('관 리 자', public.d2r_nickname_reserved('관 리 자'));
SELECT z_ok('[운영진]', public.d2r_nickname_reserved('[운영진]'));
SELECT z_ok('디아허브_매니저', public.d2r_nickname_reserved('디아허브_매니저'));
SELECT z_ok('Admin', public.d2r_nickname_reserved('Admin'));
SELECT z_ok('adm1n', public.d2r_nickname_reserved('adm1n'));
SELECT z_ok('ADMIN99', public.d2r_nickname_reserved('ADMIN99'));
SELECT z_ok('M0derator', public.d2r_nickname_reserved('M0derator'));
SELECT z_ok('보통 닉네임 통과', NOT public.d2r_nickname_reserved('바람살장인'));
SELECT z_ok('관리 단어 아님 통과', NOT public.d2r_nickname_reserved('관리왕'));

\echo '[N2] 가입: 이름이 관리자면 회원0000 으로'
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'a@x.com', '{"name":"관리자"}'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'b@x.com', '{"name":"보통회원"}'),
  ('cccccccc-0000-0000-0000-00000000000c', 'c@x.com', '{"name":"운영진"}');
SELECT z_ok('가입 이름 바뀜', (SELECT nickname ~ '^회원[0-9]{4}$' FROM public.tb_profile WHERE id = 'aaaaaaaa-0000-0000-0000-00000000000a'));
SELECT z_ok('보통 이름 그대로', (SELECT nickname = '보통회원' FROM public.tb_profile WHERE id = 'bbbbbbbb-0000-0000-0000-00000000000b'));

\echo '[N3] 회원이 바꾸기'
SET ROLE app_user;
SELECT test_login('bbbbbbbb-0000-0000-0000-00000000000b');
SELECT z_denied('관리자로 변경', $$UPDATE public.tb_profile SET nickname = '관리자' WHERE id = auth.uid()$$, '사용할 수 없는 닉네임');
SELECT z_denied('운 영 자 로 변경', $$UPDATE public.tb_profile SET nickname = '운 영 자' WHERE id = auth.uid()$$, '사용할 수 없는 닉네임');
SELECT z_denied('adm1n 으로 변경', $$UPDATE public.tb_profile SET nickname = 'adm1n' WHERE id = auth.uid()$$, '사용할 수 없는 닉네임');
UPDATE public.tb_profile SET nickname = '룬수집가' WHERE id = auth.uid();
UPDATE public.tb_profile SET contact = '배틀태그#1234' WHERE id = auth.uid();
RESET ROLE;
SELECT z_ok('보통 닉네임 변경·연락처 변경은 됨', (SELECT nickname = '룬수집가' AND contact = '배틀태그#1234' FROM public.tb_profile WHERE id = 'bbbbbbbb-0000-0000-0000-00000000000b'));

\echo '[N4] 운영진은 가능, 원래 그런 이름인 회원도 다른 칸은 수정 가능'
ALTER TABLE public.tb_profile DISABLE TRIGGER trg_guard_profile_role;
UPDATE public.tb_profile SET role = 'admin' WHERE id = 'cccccccc-0000-0000-0000-00000000000c';
ALTER TABLE public.tb_profile ENABLE TRIGGER trg_guard_profile_role;
SET ROLE app_user;
SELECT test_login('cccccccc-0000-0000-0000-00000000000c');
UPDATE public.tb_profile SET nickname = '관리자' WHERE id = auth.uid();
RESET ROLE;
SELECT z_ok('운영진은 관리자 닉네임 가능', (SELECT nickname = '관리자' FROM public.tb_profile WHERE id = 'cccccccc-0000-0000-0000-00000000000c'));
\echo '전부 통과'
