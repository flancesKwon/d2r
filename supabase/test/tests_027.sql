-- 027 검사: 삽니다 글 쓰기 규칙(조건·정규식·주인·끌어올리기·20개), 새 판매글 → 조건 맞는 사람에게 알림 (한 번만)
-- 실행 순서: test/base_stub.sql → 002 → 이 파일 (027 을 \ir 로 두 번 불러옴)
\set ON_ERROR_STOP on
-- 실서버처럼 판매글 번호는 숫자 + 027 이 쓰는 칸들 (base_stub 은 uuid 라 이 검사에서만 바꿈)
drop table public.tb_trade_post cascade;
create table public.tb_trade_post (
  id bigint generated always as identity primary key,
  author_id uuid not null default auth.uid() references public.tb_profile(id),
  item_id text, item_name text not null, category text, status text default '판매중',
  realm text default '아시아', ladder text default '레더', hardcore text default '일반', game_version text default '악마술사의 군림',
  ethereal boolean default false, options jsonb default '{}'::jsonb, price text default '1',
  bumped_at timestamptz default now(), created_at timestamptz default now(), updated_at timestamptz, deleted_at timestamptz
);
alter table public.tb_trade_post enable row level security;
create policy tp_all on public.tb_trade_post for all using (true) with check (true);
grant insert, update, delete on public.tb_trade_post to authenticated;
create table if not exists public.tb_notification (id bigint generated always as identity primary key, user_id uuid, text text, link text, created_at timestamptz default now());
-- 004 의 도배 방지 함수 (이 검사에 필요한 부분만)
create table if not exists public.tb_rate_log (user_id uuid not null, kind text not null, created_at timestamptz not null default now());
create or replace function public.d2r_check_rate(p_kind text, p_window interval, p_max int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.tb_rate_log where user_id = auth.uid() and kind = p_kind and created_at > now() - p_window) >= p_max then
    raise exception '도배 방지: 잠시 후 다시 시도' using errcode = 'P0001';
  end if;
end $$;
\ir ../027_trade_wants.sql
\ir ../027_trade_wants.sql
create or replace function z_ok(label text, cond boolean) returns void language plpgsql as $$
begin if cond then raise notice '  OK   %', label; else raise exception '실패: %', label; end if; end $$;
grant execute on function z_ok(text, boolean) to anon, authenticated;
create or replace function z_fails(label text, stmt text) returns void language plpgsql as $$
begin
  begin execute stmt; exception when others then raise notice '  OK   % (막힘: %)', label, sqlerrm; return; end;
  raise exception '실패: % - 막혀야 하는데 됨', label;
end $$;
grant execute on function z_fails(text, text) to anon, authenticated;
create or replace function z_notes(uid uuid) returns int language sql security definer as $$
  select count(*)::int from public.tb_notification where user_id = uid
$$;
grant execute on function z_notes(uuid) to anon, authenticated;

insert into public.tb_profile (id, nickname, role) values
  ('00000000-0000-0000-0000-0000000000a1', '관리자', 'admin'),
  ('00000000-0000-0000-0000-0000000000b1', '구매자1', 'user'),
  ('00000000-0000-0000-0000-0000000000b2', '구매자2', 'user'),
  ('00000000-0000-0000-0000-0000000000b3', '판매자', 'user');

set role authenticated;
-- 쓰기 규칙
select set_config('request.jwt.claim.sub', '', false);
select z_fails('로그인 안 하면 못 씀', $$insert into public.tb_trade_want (item_id, item_name, category) values ('r1', '수수께끼', '룬워드')$$);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false);
select z_fails('남 이름으로 못 씀', $$insert into public.tb_trade_want (author_id, item_id, item_name, category) values ('00000000-0000-0000-0000-0000000000b2', 'r1', '수수께끼', '룬워드')$$);
select z_fails('종류만 고르고 조건 없으면 안 됨', $$insert into public.tb_trade_want (item_name, category) values ('룬워드', '룬워드')$$);
select z_fails('틀린 정규식은 안 됨', $$insert into public.tb_trade_want (item_id, item_name, category, conds) values ('r1', '수수께끼', '룬워드', '[{"label":"x","pattern":"^(abc"}]')$$);
select z_fails('^ 로 시작 안 하는 정규식은 안 됨', $$insert into public.tb_trade_want (item_id, item_name, category, conds) values ('r1', '수수께끼', '룬워드', '[{"label":"x","pattern":"abc"}]')$$);
select z_fails('조건 6개는 안 됨', $$insert into public.tb_trade_want (item_id, item_name, category, conds) values ('r1', '수수께끼', '룬워드', '[{"label":"a","pattern":"^a"},{"label":"a","pattern":"^a"},{"label":"a","pattern":"^a"},{"label":"a","pattern":"^a"},{"label":"a","pattern":"^a"},{"label":"a","pattern":"^a"}]')$$);
select z_fails('없는 서버는 안 됨', $$insert into public.tb_trade_want (item_id, item_name, category, realm) values ('r1', '수수께끼', '룬워드', '한국')$$);

-- 구매자1: 수수께끼, 아시아, 힘 15 이상 (아무 래더)
insert into public.tb_trade_want (item_id, item_name, category, realm, conds, price, memo) values
  ('r1', '수수께끼', '룬워드', '아시아', '[{"key":"x:힘 X","label":"힘 X","pattern":"^힘 ([+-]?\\d+(?:\\.\\d+)?)(?:~[+-]?\\d+(?:\\.\\d+)?)?$","numeric":true,"min":15,"max":null}]', '  베르 2  ', '   ');
select z_ok('가격 앞뒤 공백 정리, 빈 메모는 null', (select price = '베르 2' and memo is null from public.tb_trade_want where item_id = 'r1'));
-- 구매자2: 종류(매직/레어/일반) + 시전 속도 20 이상 + 대상 빙결, 논레더만
insert into public.tb_trade_want (item_name, category, ladder, conds) values
  ('매직/레어/일반', '매직/레어/일반', '논레더', '[{"label":"시전 속도 X%","pattern":"^시전 속도 ([+-]?\\d+(?:\\.\\d+)?)(?:~[+-]?\\d+(?:\\.\\d+)?)?%$","numeric":true,"min":20},{"label":"대상 빙결","pattern":"^대상 빙결$","numeric":false}]')
  returning 'ok';
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b2', false);
insert into public.tb_trade_want (item_name, category, ladder, conds) values
  ('매직/레어/일반', '매직/레어/일반', '논레더', '[{"label":"시전 속도 X%","pattern":"^시전 속도 ([+-]?\\d+(?:\\.\\d+)?)(?:~[+-]?\\d+(?:\\.\\d+)?)?%$","numeric":true,"min":20},{"label":"대상 빙결","pattern":"^대상 빙결$","numeric":false}]');
-- 구매자2: 공격 오라 합계 4 이상 (두 줄 합산), 에테리얼만
insert into public.tb_trade_want (item_id, item_name, category, ethereal, conds) values
  ('u9', '그리폰의 눈', '유니크/세트', true, '[{"label":"공격 오라 X","pattern":"^공격 오라 ([+-]?\\d+(?:\\.\\d+)?)(?:~[+-]?\\d+(?:\\.\\d+)?)?(?: \\(팔라딘 전용\\))?$","numeric":true,"min":4}]');

do $$ declare n int; begin
  delete from public.tb_trade_want where author_id = '00000000-0000-0000-0000-0000000000b1'; get diagnostics n = row_count;
  perform z_ok('남의 삽니다 글은 못 지움(0줄)', n = 0);
  update public.tb_trade_want set memo = 'x' where author_id = '00000000-0000-0000-0000-0000000000b1'; get diagnostics n = row_count;
  perform z_ok('남의 삽니다 글은 못 고침(0줄)', n = 0);
end $$;
select z_fails('끌어올리기는 하루에 한 번', $$update public.tb_trade_want set bumped_at = now() where item_id = 'u9'$$);
update public.tb_trade_want set author_id = '00000000-0000-0000-0000-0000000000b1', created_at = '2000-01-01' where item_id = 'u9';
select z_ok('주인·작성 시각은 못 바꿈', (select author_id = '00000000-0000-0000-0000-0000000000b2' and created_at > '2001-01-01' from public.tb_trade_want where item_id = 'u9'));

-- 새 판매글 → 알림
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b3', false);
-- 1) 수수께끼 힘 16, 아시아 레더 -> 구매자1 알림
insert into public.tb_trade_post (item_id, item_name, category, options) values ('r1', '수수께끼', '룬워드', '{"lines":["모든 기술 +2","힘 16"]}');
select z_ok('조건 맞는 판매글 -> 구매자1 알림 1', z_notes('00000000-0000-0000-0000-0000000000b1') = 1);
select z_ok('알림 문구·주소', (select text = '"수수께끼" 찾던 매물 올라옴' and link like '/trade/%' from public.tb_notification order by id desc limit 1));
-- 2) 수수께끼 힘 10 -> 알림 없음 / 미주 서버 -> 알림 없음
insert into public.tb_trade_post (item_id, item_name, category, options) values ('r1', '수수께끼', '룬워드', '{"lines":["힘 10"]}');
insert into public.tb_trade_post (item_id, item_name, category, realm, options) values ('r1', '수수께끼', '룬워드', '미주', '{"lines":["힘 20"]}');
select z_ok('수치 모자라거나 서버 다르면 알림 없음', z_notes('00000000-0000-0000-0000-0000000000b1') = 1);
-- 3) 매직 서클릿: 시전 속도 20 + 대상 빙결, 논레더 -> 구매자1·구매자2 둘 다 / 레더면 없음 / 빙결 없으면 없음
insert into public.tb_trade_post (item_name, category, ladder, options) values ('서클릿', '매직/레어/일반', '논레더', '{"lines":["시전 속도 20%","대상 빙결"]}');
insert into public.tb_trade_post (item_name, category, ladder, options) values ('서클릿', '매직/레어/일반', '레더', '{"lines":["시전 속도 20%","대상 빙결"]}');
insert into public.tb_trade_post (item_name, category, ladder, options) values ('서클릿', '매직/레어/일반', '논레더', '{"lines":["시전 속도 30%"]}');
select z_ok('종류+옵션 조건 -> 두 사람 다 알림, 래더 다르거나 옵션 없으면 없음',
  z_notes('00000000-0000-0000-0000-0000000000b1') = 2 and z_notes('00000000-0000-0000-0000-0000000000b2') = 1);
-- 4) 공격 오라 2 + 2 (두 줄 합산 4), 에테리얼 아님 -> 없음 / 에테리얼 -> 알림
insert into public.tb_trade_post (item_id, item_name, category, options) values ('u9', '그리폰의 눈', '유니크/세트', '{"lines":["공격 오라 +2","공격 오라 +2 (팔라딘 전용)"]}');
select z_ok('에테리얼만 원하면 일반 글은 알림 없음', z_notes('00000000-0000-0000-0000-0000000000b2') = 1);
insert into public.tb_trade_post (item_id, item_name, category, ethereal, options) values ('u9', '그리폰의 눈', '유니크/세트', true, '{"lines":["공격 오라 +2","공격 오라 +2 (팔라딘 전용)"]}');
select z_ok('두 줄 합산 4 이상 + 에테리얼 -> 알림', z_notes('00000000-0000-0000-0000-0000000000b2') = 2);
-- 5) 자기 판매글은 알림 없음
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false);
insert into public.tb_trade_post (item_id, item_name, category, options) values ('r1', '수수께끼', '룬워드', '{"lines":["힘 30"]}');
select z_ok('내 판매글은 내게 알림 없음', z_notes('00000000-0000-0000-0000-0000000000b1') = 2);
-- 6) 재등록(bumped_at) 해도 같은 판매글 알림은 한 번만 / 거래 불발로 다시 판매중이어도 한 번만
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b3', false);
update public.tb_trade_post set bumped_at = now() + interval '1 second' where item_id = 'r1' and options->'lines' ? '힘 16';
update public.tb_trade_post set status = '예약중' where item_id = 'r1' and options->'lines' ? '힘 16';
update public.tb_trade_post set status = '판매중' where item_id = 'r1' and options->'lines' ? '힘 16';
select z_ok('같은 판매글 알림은 한 번만', z_notes('00000000-0000-0000-0000-0000000000b1') = 2);
-- 7) 수정으로 조건이 맞게 되면(가격 낮춰 재등록) 그때 알림
update public.tb_trade_post set options = '{"lines":["힘 18"]}', bumped_at = now() + interval '2 seconds' where item_id = 'r1' and options->'lines' ? '힘 10';
select z_ok('재등록 때 조건 맞으면 알림', z_notes('00000000-0000-0000-0000-0000000000b1') = 3);
-- 8) 알림 꺼 두면 없음 / 14일 지난 글은 없음
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false);
update public.tb_trade_want set notify = false where item_id = 'r1';
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b3', false);
insert into public.tb_trade_post (item_id, item_name, category, options) values ('r1', '수수께끼', '룬워드', '{"lines":["힘 20"]}');
select z_ok('알림 끄면 안 옴', z_notes('00000000-0000-0000-0000-0000000000b1') = 3);
reset role;
select set_config('request.jwt.claim.sub', '', false);
update public.tb_trade_want set notify = true, bumped_at = now() - interval '15 days' where item_id = 'r1';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b3', false);
insert into public.tb_trade_post (item_id, item_name, category, options) values ('r1', '수수께끼', '룬워드', '{"lines":["힘 20"]}');
select z_ok('14일 지난 삽니다 글은 알림 없음', z_notes('00000000-0000-0000-0000-0000000000b1') = 3);
-- 9) 알림 계산이 깨진 삽니다 글이 있어도 판매글은 올라감
reset role;
alter table public.tb_trade_want disable trigger trg_want_guard;
update public.tb_trade_want set bumped_at = now(), conds = '[{"label":"x","pattern":"^(broken"}]' where item_id = 'r1';
alter table public.tb_trade_want enable trigger trg_want_guard;
set role authenticated;
insert into public.tb_trade_post (item_id, item_name, category, options) values ('r1', '수수께끼', '룬워드', '{"lines":["힘 20"]}') returning 'ok';
select z_ok('깨진 조건이 있어도 판매글 등록됨', (select count(*) from public.tb_trade_post where item_id = 'r1') = 7);
-- 10) 동시 20개 제한
reset role;
delete from public.tb_trade_want;
delete from public.tb_rate_log;
select set_config('request.jwt.claim.sub', '', false);
insert into public.tb_trade_want (author_id, item_id, item_name, category)
  select '00000000-0000-0000-0000-0000000000b2', 'x' || g, '아이템', '룬' from generate_series(1, 20) g;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b2', false);
select z_fails('동시에 21개는 안 됨', $$insert into public.tb_trade_want (item_id, item_name, category) values ('y', '아이템', '룬')$$);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
do $$ declare n int; begin
  delete from public.tb_trade_want where item_id = 'x1'; get diagnostics n = row_count;
  perform z_ok('운영진은 남의 삽니다 글 지울 수 있음', n = 1);
end $$;
reset role;
select '027 검사 끝 - 0건 실패' as 결과;
