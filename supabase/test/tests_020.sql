-- 020·021 검사: 수락 시 다른 신청 보류 → 불발되면 다시 대기 → 다시 수락, 직접 거래완료 막기, 골드 한도
-- 실행 순서: test/base_stub.sql → 002 → test/prep_017.sql → 이 파일 (016·020 을 \ir 로 불러옴)
\set ON_ERROR_STOP on
-- 준비: 실제 스키마 흉내 (판매글 칸, 거래방, 알림, 대기 신청 한 사람당 하나)
alter table public.tb_trade_post add column if not exists bumped_at timestamptz default now(),
  add column if not exists item_id text, add column if not exists amount_label text, add column if not exists deleted_at timestamptz,
  add column if not exists price text;
create table public.tb_trade_deal (
  id bigint generated always as identity primary key,
  post_id uuid references public.tb_trade_post(id) on delete cascade, request_id bigint,
  seller_id uuid, buyer_id uuid, item_id text, post_title text, status text not null default '거래중'
);
create table public.tb_notification (id bigint generated always as identity primary key, user_id uuid, text text, link text, created_at timestamptz default now());
create unique index trade_requests_one_pending on public.tb_trade_request (post_id, buyer_id) where status = 'pending';
alter table public.tb_trade_request add constraint tb_trade_request_status_check check (status in ('pending', 'accepted', 'rejected', 'cancelled'));
insert into public.tb_profile (id, nickname) values ('00000000-0000-0000-0000-00000000000d', '구매자2');
grant select, insert, update on public.tb_trade_post, public.tb_trade_request to authenticated;
\ir ../016_trade_relist.sql
\ir ../017_public_requests_gold.sql
\ir ../020_trade_flow.sql
\ir ../020_trade_flow.sql
\ir ../021_no_manual_hold.sql
\ir ../021_no_manual_hold.sql

create or replace function z_ok(label text, cond boolean) returns void language plpgsql as $$
begin if cond then raise notice '  OK   %', label; else raise exception '실패: %', label; end if; end $$;
create or replace function z_err(label text, stmt text) returns void language plpgsql as $$
begin
  begin execute stmt; exception when others then raise notice '  OK   % (차단: %)', label, sqlerrm; return; end;
  raise exception '실패: % — 막혀야 하는데 통과함', label;
end $$;
grant execute on function z_ok(text, boolean), z_err(text, text) to authenticated;
create or replace function z_as(uid text) returns void language sql as $$ select set_config('request.jwt.claim.sub', uid, false) $$;
grant execute on function z_as(text) to authenticated;
create or replace function z_req(buyer text) returns text language sql security definer as $$
  select status from public.tb_trade_request where post_id = '40000000-0000-0000-0000-000000000001' and buyer_id = buyer::uuid order by id desc limit 1 $$;
create or replace function z_post() returns text language sql security definer as $$ select status from public.tb_trade_post where item_name = '흐름 글' $$;
create or replace function z_notes(uid text, pat text) returns int language sql security definer as $$
  select count(*)::int from public.tb_notification where user_id = uid::uuid and text ~ pat $$;
grant execute on function z_req(text), z_post(), z_notes(text, text) to authenticated;

insert into public.tb_trade_post (id, author_id, item_name, category, status) values
  ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', '흐름 글', '룬', '판매중');
set role authenticated;
-- 구매자 둘이 신청
select z_as('00000000-0000-0000-0000-00000000000b');
insert into public.tb_trade_request (post_id, buyer_id) values ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b');
select z_as('00000000-0000-0000-0000-00000000000d');
insert into public.tb_trade_request (post_id, buyer_id) values ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000d');
-- 판매자: 구매자1 수락
select z_as('00000000-0000-0000-0000-00000000000a');
select public.accept_trade_request((select id from public.tb_trade_request where post_id = '40000000-0000-0000-0000-000000000001' and buyer_id = '00000000-0000-0000-0000-00000000000b'));
select z_ok('수락하면 판매글 예약중 (DB가 직접)', z_post() = '예약중');
select z_ok('다른 대기 신청은 보류', z_req('00000000-0000-0000-0000-00000000000d') = 'held');
select z_ok('보류 알림', z_notes('00000000-0000-0000-0000-00000000000d', '보류') = 1);
select z_err('보류 신청은 수락 못 함', $$select public.accept_trade_request((select id from public.tb_trade_request where post_id = '40000000-0000-0000-0000-000000000001' and buyer_id = '00000000-0000-0000-0000-00000000000d'))$$);
select z_err('판매자가 직접 거래완료 막힘', $$update public.tb_trade_post set status = '거래완료' where item_name = '흐름 글'$$);
select z_err('거래중인데 직접 판매중 막힘', $$update public.tb_trade_post set status = '판매중' where item_name = '흐름 글'$$);
-- 거래중에 새로 들어온 신청은 바로 보류
select z_as('00000000-0000-0000-0000-00000000000d');
insert into public.tb_trade_request (post_id, buyer_id) values ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000d');
select z_ok('거래중 글에 새 신청 = 보류', z_req('00000000-0000-0000-0000-00000000000d') = 'held');
reset role;

-- 거래불발 (거래방 상태는 DB 함수가 바꿈 - 여기선 직접)
update public.tb_trade_deal set status = '거래불발';
select z_ok('불발되면 판매중으로', z_post() = '판매중');
select z_ok('보류 신청 다시 대기 (한 사람당 하나)',
  (select count(*) from public.tb_trade_request where buyer_id = '00000000-0000-0000-0000-00000000000d' and status = 'pending') = 1
  and not exists (select 1 from public.tb_trade_request where status = 'held'));
select z_ok('다시 대기 알림', z_notes('00000000-0000-0000-0000-00000000000d', '다시 판매중') = 1);

-- 판매자: 이번엔 구매자2 수락 → 거래완료
set role authenticated;
select z_as('00000000-0000-0000-0000-00000000000a');
select public.accept_trade_request((select id from public.tb_trade_request where buyer_id = '00000000-0000-0000-0000-00000000000d' and status = 'pending'));
select z_ok('다시 수락 → 예약중', z_post() = '예약중');
select z_as('00000000-0000-0000-0000-00000000000b');
insert into public.tb_trade_request (post_id, buyer_id) values ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b');
reset role;
update public.tb_trade_deal set status = '거래완료' where status = '거래중';
select z_ok('거래완료 → 판매글 거래완료', z_post() = '거래완료');
select z_ok('남은 보류 신청은 거절', z_req('00000000-0000-0000-0000-00000000000b') = 'rejected');
set role authenticated;
select z_as('00000000-0000-0000-0000-00000000000a');
select z_err('거래완료 글 상태 변경 막힘', $$update public.tb_trade_post set status = '판매중' where item_name = '흐름 글'$$);
select z_as('00000000-0000-0000-0000-00000000000b');
select z_err('거래완료 글에 신청 막힘', $$insert into public.tb_trade_request (post_id, buyer_id) values ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b')$$);
-- 021: 판매자가 직접 예약중(홀드)으로 바꾸는 건 막힘
select z_as('00000000-0000-0000-0000-00000000000a');
insert into public.tb_trade_post (author_id, item_name, category, status) values ('00000000-0000-0000-0000-00000000000a', '수동 글', '룬', '판매중');
select z_err('직접 예약중(홀드) 막힘 (021)', $$update public.tb_trade_post set status = '예약중' where item_name = '수동 글'$$);
-- 골드 한도
insert into public.tb_trade_post (author_id, item_name, category, amount_label) values ('00000000-0000-0000-0000-00000000000a', '골드 OK', '골드', '15,000,000 골드');
select z_ok('골드 1500만 등록됨', exists (select 1 from public.tb_trade_post where item_name = '골드 OK'));
select z_err('골드 1500만 초과 막힘', $$insert into public.tb_trade_post (author_id, item_name, category, amount_label) values ('00000000-0000-0000-0000-00000000000a', '골드 X', '골드', '15,000,001 골드')$$);
reset role;
select '020 검사 0건 실패';
