-- 008 검사: 쪽지 삭제는 지운 사람 화면에서만
\set ON_ERROR_STOP on
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO app_user;
REVOKE SELECT ON public.tb_profile FROM app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO app_user;
CREATE OR REPLACE FUNCTION h8_ok(label text, cond boolean) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF cond THEN RAISE NOTICE '  OK   %', label; ELSE RAISE EXCEPTION '실패: %', label; END IF; END $$;
CREATE OR REPLACE FUNCTION h8_denied(label text, stmt text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE stmt; EXCEPTION WHEN others THEN RAISE NOTICE '  OK   % (차단)', label; RETURN; END;
  RAISE EXCEPTION '실패: % — 막혀야 하는데 통과함', label;
END $$;
GRANT EXECUTE ON FUNCTION h8_ok(text, boolean), h8_denied(text, text) TO app_user;

INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('aaaaaaaa-0000-0000-0000-00000000000a', 's@x.com', '{"name":"가"}'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'b@x.com', '{"name":"나"}'),
  ('cccccccc-0000-0000-0000-00000000000c', 'c@x.com', '{"name":"다"}');
SET ROLE app_user;

SELECT test_login('aaaaaaaa-0000-0000-0000-00000000000a');
SELECT public.open_conversation('bbbbbbbb-0000-0000-0000-00000000000b') AS cid \gset
INSERT INTO public.tb_dm_message (conversation_id, sender_id, text) VALUES (:cid, auth.uid(), '가가 보낸 쪽지');

\echo '[H1] 진짜 삭제는 막힘'
SELECT h8_denied('DELETE 직접 실행', $$DELETE FROM public.tb_dm_message$$);

\echo '[H2] 보낸 사람이 지우면 보낸 사람 화면에서만'
SELECT public.d2r_hide_message((SELECT id FROM public.tb_dm_message));
SELECT h8_ok('보낸 쪽 숨김 표시', (SELECT sender_hidden_at IS NOT NULL AND receiver_hidden_at IS NULL FROM public.tb_dm_message));

\echo '[H3] 받은 사람도 자기 화면에서 지울 수 있음'
SELECT test_login('bbbbbbbb-0000-0000-0000-00000000000b');
SELECT public.d2r_hide_message((SELECT id FROM public.tb_dm_message));
SELECT h8_ok('받은 쪽 숨김 표시', (SELECT receiver_hidden_at IS NOT NULL FROM public.tb_dm_message));
SELECT h8_ok('쪽지 자체는 남아 있음', (SELECT count(*) = 1 FROM public.tb_dm_message));

\echo '[H4] 상대의 숨김 칸은 못 건드림'
UPDATE public.tb_dm_message SET sender_hidden_at = NULL;
SELECT h8_ok('보낸 사람 숨김 그대로', (SELECT sender_hidden_at IS NOT NULL FROM public.tb_dm_message));

\echo '[H5] 대화 상대가 아니면 숨김 불가'
SELECT test_login('cccccccc-0000-0000-0000-00000000000c');
SELECT h8_denied('남의 대화 쪽지 숨김', $$SELECT public.d2r_hide_message((SELECT max(id) FROM public.tb_dm_message))$$);

\echo '008 검사 전부 통과'
