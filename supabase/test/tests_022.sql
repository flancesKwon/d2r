-- 022 검사: 문의는 신청 불가, 멈춘 거래방 경고·자동 불발, 자동 완료 전 알림, 기간 끝난 글 신청 정리
-- 실행 순서: test/base_stub.sql → 002 → test/prep_017.sql → 이 파일 (016·017·020·021·022 를 \ir 로 불러옴)
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
insert into public.tb_profile (id, nickname) values ('00000000-0000-0000-0000-00000000000d', '구매자2');
grant select, insert, update on public.tb_trade_post, public.tb_trade_request to authenticated;
\ir ../016_trade_relist.sql
\ir ../017_public_requests_gold.sql
\ir ../020_trade_flow.sql
\ir ../021_no_manual_hold.sql
\ir ../022_stale_deals_inquiry.sql
\ir ../022_stale_deals_inquiry.sql
-- 004 의 거래방 알림 트리거 (실제 스키마엔 있음)
create trigger trg_notify_deal_status after update of status on public.tb_trade_deal for each row execute function public.notify_trade_deal_status();

create or replace function z_ok(label text, cond boolean) returns void language plpgsql as $$
begin if cond then raise notice '  OK   %', label; else raise exception '실패: %', label; end if; end $$;
grant execute on function z_ok(text, boolean) to authenticated, anon;
create or replace function z_notes(pat text) returns int language sql security definer as $$ select count(*)::int from public.tb_notification where text ~ pat $$;
grant execute on function z_notes(text) to authenticated, anon;

insert into public.tb_trade_post (id, author_id, item_name, category, status) values
  ('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', '조용한 글', '룬', '예약중'),
  ('50000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000a', '완료 대기 글', '룬', '예약중'),
  ('50000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000a', '기간 끝난 글', '룬', '판매중');

-- 1) 문의는 신청 불가
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
do $$ begin
  insert into public.tb_trade_request (post_id, buyer_id, message) values ('50000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000b', '지금 거래 가능?');
  raise exception '실패: 문의가 신청으로 들어감';
exception when insufficient_privilege then raise notice '  OK   문의 글은 구매신청 막힘 (%)', sqlerrm;
end $$;
insert into public.tb_trade_request (post_id, buyer_id, message) values ('50000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000b', '구매하기 (즉시 구매 신청)');
select z_ok('구매하기 신청은 됨', true);
reset role;
select set_config('request.jwt.claim.sub', '', false);

-- 2) 거래방: 6일 조용 → 경고만, 8일 → 자동 불발
insert into public.tb_trade_deal (post_id, seller_id, buyer_id, post_title, created_at) values
  ('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000d', '조용한 글', now() - interval '6 days');
set role anon;
select public.d2r_settle_stale();
reset role;
select z_ok('5일 넘게 조용 → 두 사람에게 경고 (비로그인도 정리 함수 부름)', z_notes('5일째 대화 없음') = 2);
select z_ok('아직 거래중', (select status from public.tb_trade_deal where post_title = '조용한 글') = '거래중');
select public.d2r_settle_stale();
select z_ok('경고는 한 번만', z_notes('5일째 대화 없음') = 2);
update public.tb_trade_deal set created_at = now() - interval '8 days' where post_title = '조용한 글';
select public.d2r_settle_stale();
select z_ok('7일 조용 → 자동 거래불발', (select status from public.tb_trade_deal where post_title = '조용한 글') = '거래불발');
select z_ok('자동 불발 알림 (이유 포함)', z_notes('7일 동안 대화 없어 자동') = 2);
select z_ok('판매글 판매중으로', (select status from public.tb_trade_post where item_name = '조용한 글') = '판매중');

-- 메시지가 있으면 그 시각부터 셈
insert into public.tb_trade_deal (post_id, seller_id, buyer_id, post_title, created_at) values
  ('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000d', '대화 있는 거래', now() - interval '10 days');
insert into public.tb_trade_deal_message (deal_id, text, created_at) select id, '어제 메시지', now() - interval '1 day' from public.tb_trade_deal where post_title = '대화 있는 거래';
select public.d2r_settle_stale();
select z_ok('최근 메시지 있으면 그대로 거래중', (select status from public.tb_trade_deal where post_title = '대화 있는 거래') = '거래중');

-- 3) 한쪽만 완료 2.5일 → 안 누른 쪽에 알림, 3.5일 → 자동 완료
insert into public.tb_trade_deal (post_id, seller_id, buyer_id, post_title, seller_done_at) values
  ('50000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000d', '완료 대기 글', now() - interval '60 hours');
select public.d2r_settle_stale();
select z_ok('자동 완료 하루 전 알림 (구매자에게만)',
  (select count(*) from public.tb_notification where text ~ '내일 자동 거래완료' and user_id = '00000000-0000-0000-0000-00000000000d') = 1
  and z_notes('내일 자동 거래완료') = 1);
update public.tb_trade_deal set seller_done_at = now() - interval '84 hours' where post_title = '완료 대기 글';
select public.d2r_settle_stale();
select z_ok('3일 지나 자동 거래완료', (select status from public.tb_trade_deal where post_title = '완료 대기 글') = '거래완료');
select z_ok('판매글 거래완료', (select status from public.tb_trade_post where item_name = '완료 대기 글') = '거래완료');

-- 4) 판매 기간 끝나고 3일 넘은 글의 대기 신청 거절
select z_ok('기간 남은 글 신청은 그대로', (select status from public.tb_trade_request where post_id = '50000000-0000-0000-0000-000000000003') = 'pending');
select set_config('request.jwt.claim.sub', '', false);
update public.tb_trade_post set bumped_at = now() - interval '6 days' where item_name = '기간 끝난 글';
select public.d2r_settle_stale();
select z_ok('기간 끝나고 3일 넘은 글 신청 거절', (select status from public.tb_trade_request where post_id = '50000000-0000-0000-0000-000000000003') = 'rejected');
select '022 검사 0건 실패';
