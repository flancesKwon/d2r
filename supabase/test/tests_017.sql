-- 017 검사: 구매신청 공개 읽기 + 골드 분류
-- 실행 순서: test/base_stub.sql → test/prep_017.sql (실제 스키마 흉내) → 017 두 번 → 이 파일
-- 예: psql -f test/base_stub.sql -f test/prep_017.sql -f 017_public_requests_gold.sql -f 017_public_requests_gold.sql -f test/tests_017.sql
\set ON_ERROR_STOP on
create or replace function z_ok(label text, cond boolean) returns void language plpgsql as $$
begin if cond then raise notice '  OK   %', label; else raise exception '실패: %', label; end if; end $$;
grant execute on function z_ok(text, boolean) to anon, authenticated;

-- 1) 구경꾼(로그인) / 비로그인 모두 남의 구매신청을 읽을 수 있음
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
select z_ok('로그인한 구경꾼이 남의 신청을 봄', (select count(*) from public.tb_trade_request) = 1);
-- 읽기만 열림: 구경꾼이 남의 신청 상태를 못 바꿈
update public.tb_trade_request set status = 'accepted';
select z_ok('구경꾼은 신청 상태 변경 불가', (select status from public.tb_trade_request) = 'pending');
reset role;
set role anon;
select set_config('request.jwt.claim.sub', '', false);
select z_ok('비로그인도 신청 내역을 봄', (select count(*) from public.tb_trade_request) = 1);
reset role;

-- 2) 골드 분류 등록 가능, 엉뚱한 분류는 여전히 막힘
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
insert into public.tb_trade_post (author_id, item_name, category) values ('00000000-0000-0000-0000-00000000000a', '골드', '골드');
select z_ok('골드 판매글 등록됨', exists (select 1 from public.tb_trade_post where category = '골드'));
do $$ begin
  insert into public.tb_trade_post (author_id, item_name, category) values ('00000000-0000-0000-0000-00000000000a', 'x', '없는분류');
  raise exception '실패: 없는 분류가 통과함';
exception when check_violation then raise notice '  OK   없는 분류는 막힘';
end $$;
reset role;
select z_ok('예전 분류 제약은 지워지고 새 제약 하나만',
  (select count(*) from pg_constraint where conrelid = 'public.tb_trade_post'::regclass and contype = 'c' and pg_get_constraintdef(oid) ~ 'category') = 1);
select '017 검사 0건 실패';
