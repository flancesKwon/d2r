-- 019 검사: 판매글 수정 규칙
-- 실행 순서: test/base_stub.sql → 002 → test/prep_017.sql → 이 파일 (019 를 \ir 로 두 번 불러옴)
\set ON_ERROR_STOP on
alter table public.tb_trade_post add column if not exists price text, add column if not exists options jsonb,
  add column if not exists amount_label text, add column if not exists realm text, add column if not exists ladder text,
  add column if not exists hardcore text, add column if not exists contact text, add column if not exists content text,
  add column if not exists ethereal boolean default false, add column if not exists item_id text;
grant select, insert, update, delete on public.tb_trade_post to authenticated;
grant select on public.tb_trade_request to authenticated;
\ir ../019_trade_post_edit.sql
\ir ../019_trade_post_edit.sql
create or replace function z_ok(label text, cond boolean) returns void language plpgsql as $$
begin if cond then raise notice '  OK   %', label; else raise exception '실패: %', label; end if; end $$;
grant execute on function z_ok(text, boolean) to authenticated;
create or replace function z_denied(label text, stmt text) returns void language plpgsql as $$
begin
  begin execute stmt; exception when insufficient_privilege then raise notice '  OK   % (차단: %)', label, sqlerrm; return; end;
  raise exception '실패: % — 막혀야 하는데 통과함', label;
end $$;
grant execute on function z_denied(text, text) to authenticated;

insert into public.tb_trade_post (id, author_id, item_name, category, status, price, options) values
  ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', '수정 글', '룬', '판매중', '말 룬 1개', '{"lines":["모든 저항 +20%"]}'),
  ('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000a', '신청 글', '룬', '판매중', '말 룬 1개', '{}'),
  ('30000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000a', '예약 글', '룬', '예약중', '말 룬 1개', '{}'),
  ('30000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-00000000000a', '거절만 글', '룬', '판매중', '말 룬 1개', '{}');
insert into public.tb_trade_request (post_id, buyer_id, status) values
  ('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000b', 'pending'),
  ('30000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-00000000000b', 'rejected'),
  ('30000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-00000000000b', 'cancelled');

update public.tb_profile set role = 'admin' where id = '00000000-0000-0000-0000-00000000000c';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
update public.tb_trade_post set price = '베르 룬 1개', options = '{"lines":["모든 저항 +25%"]}' where item_name = '수정 글';
select z_ok('신청 없는 판매중 글: 가격·옵션 수정됨', (select price from public.tb_trade_post where item_name = '수정 글') = '베르 룬 1개');
update public.tb_trade_post set price = '베르 룬 2개' where item_name = '거절만 글';
select z_ok('거절·취소된 신청만 있으면 수정됨', (select price from public.tb_trade_post where item_name = '거절만 글') = '베르 룬 2개');
select z_denied('대기 신청 있는 글 수정 막힘', $$update public.tb_trade_post set price = '베르 룬 1개' where item_name = '신청 글'$$);
select z_denied('예약중 글 수정 막힘', $$update public.tb_trade_post set price = '베르 룬 1개' where item_name = '예약 글'$$);
select z_denied('아이템 바꾸기 막힘', $$update public.tb_trade_post set item_name = '다른 아이템' where item_name = '수정 글'$$);
update public.tb_trade_post set status = '예약중' where item_name = '신청 글';
select z_ok('상태 변경은 신청 있어도 됨', (select status from public.tb_trade_post where item_name = '신청 글') = '예약중');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
update public.tb_trade_post set price = '운영진 수정' where item_name = '예약 글';
select z_ok('운영진은 수정 가능', (select price from public.tb_trade_post where item_name = '예약 글') = '운영진 수정');
reset role;
select '019 검사 0건 실패';
