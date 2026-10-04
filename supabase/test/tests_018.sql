-- 018 검사: 거래중 거래방이 있는 판매글 삭제 막기 (016 거래완료 삭제 막기도 같이)
-- 실행 순서: test/base_stub.sql → 002 → test/prep_017.sql → 이 파일의 준비 부분 → 016 → 018 → 018(재실행) → 검사
-- 예: psql -f test/base_stub.sql -f 002_reports_suspension.sql -f test/prep_017.sql -f test/tests_018.sql
--     (이 파일이 016·018 을 \ir 로 불러옴)
\set ON_ERROR_STOP on
-- 준비: 판매 시작 시각 칸 + 거래방 표 (판매글을 지우면 거래방도 지워짐 - 실제 스키마와 같음)
alter table public.tb_trade_post add column if not exists bumped_at timestamptz default now();
create table if not exists public.tb_trade_deal (
  id bigint generated always as identity primary key,
  post_id uuid references public.tb_trade_post(id) on delete cascade,
  seller_id uuid, buyer_id uuid, status text not null default '거래중'
);
grant select, insert, update, delete on public.tb_trade_post to authenticated;
\ir ../016_trade_relist.sql
\ir ../018_trade_delete_guard.sql
\ir ../018_trade_delete_guard.sql
create or replace function z_ok(label text, cond boolean) returns void language plpgsql as $$
begin if cond then raise notice '  OK   %', label; else raise exception '실패: %', label; end if; end $$;
grant execute on function z_ok(text, boolean) to authenticated;

insert into public.tb_trade_post (id, author_id, item_name, category, status) values
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', '거래중 글', '룬', '예약중'),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000a', '불발 글', '룬', '판매중'),
  ('20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000a', '완료 글', '룬', '거래완료'),
  ('20000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-00000000000a', '스팸 글', '룬', '예약중');
insert into public.tb_trade_deal (post_id, status) values
  ('20000000-0000-0000-0000-000000000001', '거래중'), ('20000000-0000-0000-0000-000000000002', '거래불발'),
  ('20000000-0000-0000-0000-000000000004', '거래중');
update public.tb_profile set role = 'admin' where id = '00000000-0000-0000-0000-00000000000c';

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
do $$ begin
  delete from public.tb_trade_post where item_name = '거래중 글';
  raise exception '실패: 거래중 글이 지워짐';
exception when insufficient_privilege then raise notice '  OK   거래중 거래방 있는 글 삭제 막힘 (%)', sqlerrm;
end $$;
delete from public.tb_trade_post where item_name = '불발 글';
select z_ok('거래불발로 끝난 글은 삭제됨', not exists (select 1 from public.tb_trade_post where item_name = '불발 글'));
do $$ begin
  delete from public.tb_trade_post where item_name = '완료 글';
  raise exception '실패: 거래완료 글이 지워짐';
exception when insufficient_privilege then raise notice '  OK   거래완료 글 삭제 막힘 (016)';
end $$;
-- 운영진은 거래중이어도 지울 수 있음
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
delete from public.tb_trade_post where item_name = '스팸 글';
select z_ok('운영진은 거래중 글도 삭제', not exists (select 1 from public.tb_trade_post where item_name = '스팸 글'));
reset role;
select '018 검사 0건 실패';
