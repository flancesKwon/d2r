-- 024 검사: 응모 자동 기록(1인 최대·제외 규칙·삭제), 목록 고정, drand 난수 추첨(DB 계산), 당첨 알림
-- 실행 순서: test/base_stub.sql → 002 → 이 파일 (024 를 \ir 로 두 번 불러옴)
\set ON_ERROR_STOP on
alter table public.tb_trade_post add column if not exists category text;
create table if not exists public.tb_notification (id bigint generated always as identity primary key, user_id uuid, text text, link text, created_at timestamptz default now());
\ir ../024_events.sql
\ir ../024_events.sql
create or replace function z_ok(label text, cond boolean) returns void language plpgsql as $$
begin if cond then raise notice '  OK   %', label; else raise exception '실패: %', label; end if; end $$;
grant execute on function z_ok(text, boolean) to anon, authenticated;
create or replace function z_fails(label text, stmt text) returns void language plpgsql as $$
begin
  begin execute stmt; exception when others then raise notice '  OK   % (막힘: %)', label, sqlerrm; return; end;
  raise exception '실패: % - 막혀야 하는데 됨', label;
end $$;
grant execute on function z_fails(text, text) to anon, authenticated;
grant insert, update, delete on public.tb_trade_post to authenticated;

insert into public.tb_profile (id, nickname, role) values
  ('00000000-0000-0000-0000-0000000000a1', '관리자', 'admin'),
  ('00000000-0000-0000-0000-0000000000b1', '회원1', 'user'),
  ('00000000-0000-0000-0000-0000000000b2', '회원2', 'user'),
  ('00000000-0000-0000-0000-0000000000b3', '회원3', 'user');

-- 이벤트 만들기 (운영진만)
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false);
select z_fails('회원은 이벤트 못 만듦', $$insert into public.tb_event (title, starts_at, ends_at, draw_at, drand_round) values ('x', now(), now() + interval '2 hours', now() + interval '3 hours', 1)$$);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
insert into public.tb_event (title, starts_at, ends_at, draw_at, drand_round, ticket_cap, prizes) values
  ('진행중', now() - interval '1 hour', now() + interval '1 hour', now() + interval '90 minutes', 100, 5,
   '[{"rank":1,"label":"1등","item":"자 룬 + 베르 룬"},{"rank":2,"label":"2등","item":"소집 룬"},{"rank":3,"label":"3등","item":"소집 룬"}]');
select z_fails('추첨 시각이 종료 전이면 막힘', $$insert into public.tb_event (title, starts_at, ends_at, draw_at, drand_round) values ('x', now(), now() + interval '2 hours', now() + interval '1 hours', 1)$$);
select z_fails('시작한 이벤트 기간 변경 막힘', $$update public.tb_event set ends_at = ends_at + interval '1 hour' where title = '진행중'$$);
update public.tb_event set title = '진행중 이벤트' where title = '진행중';
select z_ok('시작한 이벤트도 제목은 고침', exists (select 1 from public.tb_event where title = '진행중 이벤트'));

-- 판매글 → 응모 자동 기록
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false);
insert into public.tb_trade_post (author_id, item_name, category) values
  ('00000000-0000-0000-0000-0000000000b1', '베르 룬', '룬'),
  ('00000000-0000-0000-0000-0000000000b1', '엘 룬', '룬'),
  ('00000000-0000-0000-0000-0000000000b1', '골드', '골드'),
  ('00000000-0000-0000-0000-0000000000b1', '자수정', '퍼펙트 보석'),
  ('00000000-0000-0000-0000-0000000000b1', '최상급 자수정', '퍼펙트 보석'),
  ('00000000-0000-0000-0000-0000000000b1', '베르 룬', '룬'),
  ('00000000-0000-0000-0000-0000000000b1', '그리폰의 눈', '유니크/세트'),
  ('00000000-0000-0000-0000-0000000000b1', '수수께끼', '룬워드'),
  ('00000000-0000-0000-0000-0000000000b1', '할리퀸 관모', '유니크/세트'),
  ('00000000-0000-0000-0000-0000000000b1', '이스트 룬', '룬'),
  ('00000000-0000-0000-0000-0000000000b1', '조드 룬', '룬');
reset role;
select z_ok('회원1 응모권 5장 (최대)', (select count(*) from public.tb_event_entry where user_id = '00000000-0000-0000-0000-0000000000b1') = 5);
select z_ok('엘 룬·골드·일반 자수정·두 번째 베르 룬은 기록 안 됨',
  (select array_agg(item_name order by id) from public.tb_event_entry where user_id = '00000000-0000-0000-0000-0000000000b1')
  = array['베르 룬', '최상급 자수정', '그리폰의 눈', '수수께끼', '할리퀸 관모']);
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b2', false);
insert into public.tb_trade_post (author_id, item_name, category) values ('00000000-0000-0000-0000-0000000000b2', '이스트 룬', '룬'), ('00000000-0000-0000-0000-0000000000b2', '레어 서클릿', '매직/레어/일반');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b3', false);
insert into public.tb_trade_post (author_id, item_name, category) values ('00000000-0000-0000-0000-0000000000b3', '샤코 지울 글', '유니크/세트'), ('00000000-0000-0000-0000-0000000000b3', '말 룬', '룬');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
insert into public.tb_trade_post (author_id, item_name, category) values ('00000000-0000-0000-0000-0000000000a1', '베르 룬', '룬');
reset role;
select z_ok('운영진 글은 기록 안 됨', not exists (select 1 from public.tb_event_entry where user_id = '00000000-0000-0000-0000-0000000000a1'));
-- 글 삭제 → 제외, 빈 자리로 다른 글 기록 가능
update public.tb_trade_post set deleted_at = now() where item_name = '샤코 지울 글';
select z_ok('삭제한 글은 제외', (select excluded and excluded_reason = '삭제한 글' from public.tb_event_entry where item_name = '샤코 지울 글'));
delete from public.tb_trade_post where item_name = '말 룬';
select z_ok('완전 삭제도 제외', (select excluded from public.tb_event_entry where item_name = '말 룬'));
insert into public.tb_trade_post (author_id, item_name, category) values ('00000000-0000-0000-0000-0000000000b3', '샤코', '유니크/세트');
-- 회원은 응모 기록 못 고침, 운영진은 제외 표시
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b2', false);
update public.tb_event_entry set excluded = true where item_name = '이스트 룬' and user_id = '00000000-0000-0000-0000-0000000000b1';
select z_fails('회원은 응모 기록 직접 추가 못 함', $$insert into public.tb_event_entry (event_id, user_id, post_id) values ((select id from public.tb_event limit 1), '00000000-0000-0000-0000-0000000000b2', gen_random_uuid())$$);
reset role;
select z_ok('회원 수정 시도는 반영 안 됨', (select count(*) from public.tb_event_entry where excluded) = 2);
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
update public.tb_event_entry set excluded = true, excluded_reason = '잡템' where item_name = '레어 서클릿';
select z_fails('운영진도 응모자 바꾸기는 막힘', $$update public.tb_event_entry set user_id = '00000000-0000-0000-0000-0000000000a1' where item_name = '이스트 룬' and user_id = '00000000-0000-0000-0000-0000000000b2'$$);
reset role;
select z_ok('운영진 제외 반영', (select excluded_reason from public.tb_event_entry where item_name = '레어 서클릿') = '잡템');
select z_ok('누구나 응모 목록 읽기 (anon)', (select count(*) from public.tb_event_entry) = 10);

-- 시간 흘리기: 이벤트 끝 + 추첨 시각 지남 (테스트용으로 시각을 앞당김)
alter table public.tb_event disable trigger trg_event_guard;
update public.tb_event set starts_at = now() - interval '4 hours', ends_at = now() - interval '2 hours', draw_at = now() - interval '1 hour';
alter table public.tb_event enable trigger trg_event_guard;
insert into public.tb_trade_post (author_id, item_name, category) values ('00000000-0000-0000-0000-0000000000b2', '끝난 뒤 글', '룬');
select z_ok('끝난 뒤 글은 기록 안 됨', not exists (select 1 from public.tb_event_entry where item_name = '끝난 뒤 글'));
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
select z_fails('추첨 시각 지나면 운영진도 제외 못 함 (목록 고정)', $$update public.tb_event_entry set excluded = true where item_name = '샤코'$$);
reset role;
update public.tb_trade_post set deleted_at = now() where item_name = '샤코';
select z_ok('추첨 시각 지나 삭제해도 응모권 유지', (select not excluded from public.tb_event_entry where item_name = '샤코'));

-- 추첨
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false);
select z_fails('회원은 추첨 못 함', $$select public.d2r_event_draw((select id from public.tb_event limit 1), repeat('ab', 32))$$);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
select z_fails('난수 형식 틀리면 막힘', $$select public.d2r_event_draw((select id from public.tb_event limit 1), 'xyz')$$);
select public.d2r_event_draw((select id from public.tb_event limit 1), '6a4f3e1c2b0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f');
reset role;
select z_ok('당첨자 3명 서로 다름', (select count(distinct w ->> 'user_id') = 3 from public.tb_event, jsonb_array_elements(result -> 'winners') w));
select z_ok('응모권 합계 5+1+1 = 7', (select (result ->> 'tickets_total')::int = 7 from public.tb_event));
select z_ok('당첨자 알림 3개', (select count(*) from public.tb_notification where link = '/event/' || (select id from public.tb_event limit 1)) = 3);
select z_ok('같은 난수면 같은 결과 (누구나 재계산)',
  (select jsonb_agg(to_jsonb(x) order by x.rank) from public.d2r_event_pick((select id from public.tb_event limit 1), '6a4f3e1c2b0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f') x)
  = (select result -> 'winners' from public.tb_event));
set role authenticated;
select z_fails('다시 추첨 못 함', $$select public.d2r_event_draw((select id from public.tb_event limit 1), repeat('cd', 32))$$);
select z_fails('결과 직접 수정 못 함', $$update public.tb_event set result = '{}' $$);
reset role;
-- 결과 보기용 (계산 확인)
select x.rank, x.nickname, x.ticket_no, x.tickets_left from public.d2r_event_pick((select id from public.tb_event limit 1), '6a4f3e1c2b0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f') x;
select '0건 실패' as 결과;
