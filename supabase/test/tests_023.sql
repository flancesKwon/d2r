-- 023 검사: 실제 거래가 기록 (수락 때 거래방, 완료 때 판매글, 예전 거래 채우기)
-- 실행 순서: test/base_stub.sql → 002 → test/prep_017.sql → 이 파일 (016·017·020·021·022·023 을 \ir 로 불러옴)
\set ON_ERROR_STOP on
alter table public.tb_trade_post add column if not exists bumped_at timestamptz default now(),
  add column if not exists item_id text, add column if not exists amount_label text, add column if not exists deleted_at timestamptz,
  add column if not exists price text;
create table public.tb_trade_deal (
  id bigint generated always as identity primary key,
  post_id uuid references public.tb_trade_post(id) on delete cascade, request_id bigint,
  seller_id uuid, buyer_id uuid, item_id text, post_title text, status text not null default '거래중',
  seller_done_at timestamptz, buyer_done_at timestamptz, created_at timestamptz not null default now()
);
create table public.tb_trade_deal_message (id bigint generated always as identity primary key, deal_id bigint, sender_id uuid, text text, created_at timestamptz default now());
create table public.tb_notification (id bigint generated always as identity primary key, user_id uuid, text text, link text, created_at timestamptz default now());
create unique index trade_requests_one_pending on public.tb_trade_request (post_id, buyer_id) where status = 'pending';
grant select, insert, update on public.tb_trade_post, public.tb_trade_request to authenticated;
-- 023 전에 이미 거래완료된 예전 글 (거래방 없이 / 제안만 받기)
insert into public.tb_trade_post (id, author_id, item_name, category, status, price) values
  ('60000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-00000000000a', '예전 완료 글', '룬', '거래완료', '베르 룬 1개'),
  ('60000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-00000000000a', '예전 제안만 받기', '룬', '거래완료', '가격 제안 받음');
\ir ../016_trade_relist.sql
\ir ../017_public_requests_gold.sql
\ir ../020_trade_flow.sql
\ir ../021_no_manual_hold.sql
\ir ../022_stale_deals_inquiry.sql
\ir ../023_sold_price.sql
\ir ../023_sold_price.sql
create or replace function z_ok(label text, cond boolean) returns void language plpgsql as $$
begin if cond then raise notice '  OK   %', label; else raise exception '실패: %', label; end if; end $$;
grant execute on function z_ok(text, boolean) to authenticated;

select z_ok('예전 완료 글 거래가 = 판매가', (select sold_price from public.tb_trade_post where item_name = '예전 완료 글') = '베르 룬 1개');
select z_ok('예전 제안만 받기 글 거래가는 비움', (select sold_price from public.tb_trade_post where item_name = '예전 제안만 받기') is null);

insert into public.tb_trade_post (id, author_id, item_name, category, status, price) values
  ('60000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', '제안 글', '룬', '판매중', '가격 제안 받음'),
  ('60000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000a', '즉시 글', '룬', '판매중', '말 룬 1개');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
insert into public.tb_trade_request (post_id, buyer_id, message) values
  ('60000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', '가격 제안 - 제안: 이스트 룬 2개 + 최상급 자수정 1개'),
  ('60000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000b', '구매하기 (즉시 구매 신청)');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select public.accept_trade_request((select id from public.tb_trade_request where post_id = '60000000-0000-0000-0000-000000000001'));
select public.accept_trade_request((select id from public.tb_trade_request where post_id = '60000000-0000-0000-0000-000000000002'));
reset role;
select set_config('request.jwt.claim.sub', '', false);
select z_ok('가격 제안 수락 → 거래가 = 제안 내용', (select agreed_price from public.tb_trade_deal where post_title = '제안 글') = '이스트 룬 2개 + 최상급 자수정 1개');
select z_ok('즉시 구매 수락 → 거래가 = 판매가', (select agreed_price from public.tb_trade_deal where post_title = '즉시 글') = '말 룬 1개');
select z_ok('거래중엔 판매글 거래가 아직 없음', (select sold_price from public.tb_trade_post where item_name = '제안 글') is null);
update public.tb_trade_deal set status = '거래완료' where post_title in ('제안 글', '즉시 글');
select z_ok('거래완료 → 판매글 거래가 = 제안 내용', (select sold_price from public.tb_trade_post where item_name = '제안 글') = '이스트 룬 2개 + 최상급 자수정 1개');
select z_ok('거래완료 → 판매글 거래가 = 판매가 (즉시 구매)', (select sold_price from public.tb_trade_post where item_name = '즉시 글') = '말 룬 1개');
select z_ok('판매가 칸은 그대로', (select price from public.tb_trade_post where item_name = '제안 글') = '가격 제안 받음');
select '023 검사 0건 실패';
