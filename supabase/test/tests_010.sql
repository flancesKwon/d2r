-- 010 검사: 사진 저장소 정책, 태그 섞인 금칙어
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
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'a@x.com', '{"name":"회원1"}'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'b@x.com', '{"name":"회원2"}');
SET ROLE app_user;

\echo '[P1] 사진 올리기'
SELECT test_login('aaaaaaaa-0000-0000-0000-00000000000a');
INSERT INTO storage.objects (bucket_id, name) VALUES ('post-images', 'aaaaaaaa-0000-0000-0000-00000000000a/1.webp');
SELECT z_ok('내 폴더에 올림', (SELECT count(*) = 1 FROM storage.objects WHERE name LIKE 'aaaaaaaa%'));
SELECT z_denied('남의 폴더', $$INSERT INTO storage.objects (bucket_id, name) VALUES ('post-images', 'bbbbbbbb-0000-0000-0000-00000000000b/x.webp')$$, 'row-level security');
SELECT z_denied('폴더 없이', $$INSERT INTO storage.objects (bucket_id, name) VALUES ('post-images', 'x.webp')$$, 'row-level security');
SELECT z_denied('다른 저장소', $$INSERT INTO storage.objects (bucket_id, name) VALUES ('avatars', 'aaaaaaaa-0000-0000-0000-00000000000a/x.webp')$$, 'row-level security');
INSERT INTO storage.objects (bucket_id, name) SELECT 'post-images', 'aaaaaaaa-0000-0000-0000-00000000000a/b' || g || '.webp' FROM generate_series(2, 60) g;
SELECT z_denied('1시간 61장째', $$INSERT INTO storage.objects (bucket_id, name) VALUES ('post-images', 'aaaaaaaa-0000-0000-0000-00000000000a/61.webp')$$, 'row-level security');
RESET ROLE;
ALTER TABLE public.tb_profile DISABLE TRIGGER USER;
UPDATE public.tb_profile SET suspended_until = now() + interval '1 day' WHERE id = 'bbbbbbbb-0000-0000-0000-00000000000b';
ALTER TABLE public.tb_profile ENABLE TRIGGER USER;
SET ROLE app_user;
SELECT test_login('bbbbbbbb-0000-0000-0000-00000000000b');
SELECT z_denied('정지 회원', $$INSERT INTO storage.objects (bucket_id, name) VALUES ('post-images', 'bbbbbbbb-0000-0000-0000-00000000000b/1.webp')$$, 'row-level security');
SELECT z_ok('남의 사진은 안 보임', (SELECT count(*) = 0 FROM storage.objects));
DELETE FROM storage.objects WHERE name LIKE 'aaaaaaaa%';
RESET ROLE;
SELECT z_ok('남의 사진은 안 지워짐', (SELECT count(*) = 60 FROM storage.objects));
SET ROLE app_user;
SELECT test_login('aaaaaaaa-0000-0000-0000-00000000000a');
DELETE FROM storage.objects WHERE name = 'aaaaaaaa-0000-0000-0000-00000000000a/1.webp';
SELECT z_ok('내 사진은 지워짐', (SELECT count(*) = 59 FROM storage.objects));

\echo '[P2] 태그 섞인 금칙어'
SELECT z_denied('현<b>거</b>래', $$INSERT INTO public.tb_community_post (author_id, category, title, content) VALUES (auth.uid(), '잡담', '제목', '<p>현<strong>거</strong>래 해요</p>')$$, '금칙어');
INSERT INTO public.tb_community_post (author_id, category, title, content) VALUES (auth.uid(), '잡담', '정상 글', '<p><strong>굵게</strong> 보통 글</p><img src="x">');
SELECT z_ok('태그 있는 보통 글은 됨', (SELECT count(*) = 1 FROM public.tb_community_post WHERE title = '정상 글'));
\echo '전부 통과'
