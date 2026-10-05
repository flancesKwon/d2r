-- 024 검사: 이벤트 (운영진만 만들기·고치기, 결과는 끝난 뒤 추첨 함수로 한 번만, 당첨 알림)
-- 실행 순서: test/base_stub.sql → 002 → 이 파일 (024 를 \ir 로 두 번 불러옴)
\set ON_ERROR_STOP on
create table if not exists public.tb_notification (id bigint generated always as identity primary key, user_id uuid, text text, link text, created_at timestamptz default now());
\ir ../024_events.sql
\ir ../024_events.sql
create or replace function z_ok(label text, cond boolean) returns void language plpgsql as $$
begin if cond then raise notice '  OK   %', label; else raise exception '실패: %', label; end if; end $$;
grant execute on function z_ok(text, boolean) to anon, authenticated;
-- 실패해야 하는 문장 검사
create or replace function z_fails(label text, stmt text) returns void language plpgsql as $$
begin
  begin execute stmt; exception when others then raise notice '  OK   % (막힘: %)', label, sqlerrm; return; end;
  raise exception '실패: % - 막혀야 하는데 됨', label;
end $$;
grant execute on function z_fails(text, text) to anon, authenticated;

insert into public.tb_profile (id, nickname, role) values
  ('00000000-0000-0000-0000-0000000000a1', '관리자', 'admin'),
  ('00000000-0000-0000-0000-0000000000b1', '회원1', 'user'),
  ('00000000-0000-0000-0000-0000000000b2', '회원2', 'user');

-- 일반 회원은 못 만듦
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false);
select z_fails('회원은 이벤트 못 만듦', $$insert into public.tb_event (title, starts_at, ends_at) values ('x', now(), now() + interval '2 hours')$$);

-- 운영진은 만듦 (진행 중 이벤트 + 이미 끝난 이벤트)
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
insert into public.tb_event (title, starts_at, ends_at, ticket_cap, prizes) values
  ('진행중 이벤트', now() - interval '1 hour', now() + interval '1 hour', 4, '[{"rank":1,"label":"1등","item":"자 룬 + 베르 룬"}]'),
  ('끝난 이벤트', now() - interval '3 hours', now() - interval '1 hour', 4, '[{"rank":1,"label":"1등","item":"자 룬 + 베르 룬"},{"rank":2,"label":"2등","item":"소집 룬"}]');
select z_fails('기간이 거꾸로면 막힘', $$insert into public.tb_event (title, starts_at, ends_at) values ('x', now(), now() - interval '1 hour')$$);
select z_fails('결과 칸 직접 수정 막힘', $$update public.tb_event set result = '{"winners":[],"entries":[]}' where title = '끝난 이벤트'$$);
select z_fails('진행 중 이벤트는 추첨 못 함', $$select public.d2r_event_save_result((select id from public.tb_event where title = '진행중 이벤트'), '{"winners":[],"entries":[]}')$$);
select z_fails('결과 형식 틀리면 막힘', $$select public.d2r_event_save_result((select id from public.tb_event where title = '끝난 이벤트'), '{"winners":1}')$$);

-- 회원은 추첨 못 함, 읽기는 됨
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false);
select z_ok('회원도 이벤트 읽음', (select count(*) from public.tb_event) = 2);
select z_fails('회원은 추첨 못 함', $$select public.d2r_event_save_result((select id from public.tb_event where title = '끝난 이벤트'), '{"winners":[],"entries":[]}')$$);
update public.tb_event set title = 'hack';  -- RLS: 회원 수정은 0줄
reset role;
select z_ok('회원 수정 시도 후 제목 그대로', (select count(*) from public.tb_event where title = 'hack') = 0);

-- 운영진 추첨
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
select public.d2r_event_save_result((select id from public.tb_event where title = '끝난 이벤트'),
  '{"entries":[{"user_id":"00000000-0000-0000-0000-0000000000b1","nickname":"회원1","tickets":4},{"user_id":"00000000-0000-0000-0000-0000000000b2","nickname":"회원2","tickets":1}],
    "winners":[{"rank":1,"label":"1등","item":"자 룬 + 베르 룬","user_id":"00000000-0000-0000-0000-0000000000b2","nickname":"회원2"},{"rank":2,"label":"2등","item":"소집 룬","user_id":"00000000-0000-0000-0000-0000000000b1","nickname":"회원1"}]}');
reset role;
select z_ok('결과 저장 + 추첨 시각', (select result ? 'drawn_at' and jsonb_array_length(result -> 'winners') = 2 from public.tb_event where title = '끝난 이벤트'));
select z_ok('당첨자 2명에게 알림', (select count(*) from public.tb_notification where link like '/event/%') = 2);
select z_ok('1등 알림 문구', exists (select 1 from public.tb_notification where user_id = '00000000-0000-0000-0000-0000000000b2' and text like '%1등 당첨%자 룬 + 베르 룬%'));
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
select z_fails('다시 추첨 못 함', $$select public.d2r_event_save_result((select id from public.tb_event where title = '끝난 이벤트'), '{"winners":[],"entries":[]}')$$);
select z_fails('추첨한 이벤트 기간 변경 막힘', $$update public.tb_event set ends_at = now() + interval '1 day' where title = '끝난 이벤트'$$);
update public.tb_event set title = '끝난 이벤트 (발표)' where title = '끝난 이벤트';
select z_ok('추첨 후에도 제목은 고칠 수 있음', exists (select 1 from public.tb_event where title = '끝난 이벤트 (발표)'));
delete from public.tb_event where title = '끝난 이벤트 (발표)';
select z_ok('추첨한 이벤트는 삭제 안 됨', exists (select 1 from public.tb_event where title = '끝난 이벤트 (발표)'));
delete from public.tb_event where title = '진행중 이벤트';
select z_ok('추첨 전 이벤트는 삭제됨', not exists (select 1 from public.tb_event where title = '진행중 이벤트'));
reset role;
select '0건 실패' as 결과;
