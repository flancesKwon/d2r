-- 023: 실제 거래가 기록
--  거래내역·시세의 "거래가"가 판매글에 적힌 희망 가격으로 나와서, 가격 제안으로 팔린 거래는 틀린 값이었음
--  (제안만 받기 글은 "가격 제안 받음"으로 나옴)
--  1) 수락할 때 거래방에 거래가(agreed_price)를 남김: 가격 제안이면 제안 내용, 즉시 구매면 그때 판매가
--  2) 거래완료되면 판매글에 거래가(sold_price)를 남김 -> 거래내역·시세가 이 값을 씀 (판매글은 누구나 봄)
--  3) 지금까지 거래완료된 글도 거래방·신청에서 찾아서 채움
-- 020 다음에 실행. 여러 번 실행해도 됨

alter table public.tb_trade_deal add column if not exists agreed_price text;
alter table public.tb_trade_post add column if not exists sold_price text;

-- 신청 메시지 → 거래가 ("가격 제안 - 제안: 이스트 룬 1개 + ..." / "구매하기 - 제안: ..." 이면 제안 부분, 아니면 판매가)
create or replace function public.d2r_request_price(p_message text, p_post_price text) returns text
language sql immutable as $$
  select case
    when coalesce(p_message, '') ~ '제안: .+' then btrim(substring(p_message from '제안: (.+)$'))
    when p_post_price is null or p_post_price = '가격 제안 받음' then null
    else p_post_price
  end
$$;

-- ─── 1) 수락 (020 + 거래가) ───
create or replace function public.accept_trade_request(p_request_id bigint)
returns bigint language plpgsql security definer set search_path = public as $$
declare r record; d_id bigint;
begin
  select tr.*, tp.author_id as seller_id, tp.item_id, tp.item_name, tp.status as post_status, tp.price as post_price
    into r
    from public.tb_trade_request tr
    join public.tb_trade_post tp on tp.id = tr.post_id
   where tr.id = p_request_id
   for update;
  if not found then raise exception '신청 없음'; end if;
  if r.seller_id <> auth.uid() then raise exception '판매자만 수락 가능'; end if;
  if not public.d2r_is_active() then raise exception '이용 정지 중' using errcode = '42501'; end if;
  if r.status = 'held' then raise exception '보류된 신청 - 지금 거래가 불발되면 다시 수락 가능'; end if;
  if r.status <> 'pending' then raise exception '이미 처리된 신청'; end if;
  if r.post_status = '거래완료' then raise exception '거래완료된 판매글'; end if;
  if exists (select 1 from public.tb_trade_deal where post_id = r.post_id and status = '거래중') then
    raise exception '이미 거래중인 구매자가 있음 - 그 거래가 끝난 뒤 수락 가능';
  end if;
  update public.tb_trade_request set status = 'accepted' where id = p_request_id;
  insert into public.tb_trade_deal (post_id, request_id, seller_id, buyer_id, item_id, post_title, agreed_price)
  values (r.post_id, r.id, r.seller_id, r.buyer_id, r.item_id, r.item_name, public.d2r_request_price(r.message, r.post_price))
  returning id into d_id;
  insert into public.tb_notification (user_id, text, link)
  values (r.buyer_id, '"' || r.item_name || '" 거래 시작', '/deals/' || d_id);
  perform set_config('d2r.deal_sync', '1', true);
  update public.tb_trade_post set status = '예약중', updated_at = now() where id = r.post_id and status = '판매중';
  perform set_config('d2r.deal_sync', '', true);
  with h as (
    update public.tb_trade_request set status = 'held'
     where post_id = r.post_id and status = 'pending' and id <> p_request_id
    returning buyer_id
  )
  insert into public.tb_notification (user_id, text, link)
  select distinct buyer_id, '"' || r.item_name || '" 다른 구매자와 거래 진행 중 - 신청 보류 (불발되면 다시 대기)', '/trade/' || r.post_id
    from h;
  return d_id;
end $$;

-- ─── 2) 거래방 상태 -> 판매글·신청 (020 + 거래완료 때 거래가) ───
create or replace function public.d2r_deal_status_sync() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status is not distinct from old.status then return new; end if;
  if new.status = '거래완료' then
    perform set_config('d2r.deal_sync', '1', true);
    update public.tb_trade_post set status = '거래완료', sold_price = coalesce(new.agreed_price, sold_price), updated_at = now()
     where id = new.post_id and status <> '거래완료';
    perform set_config('d2r.deal_sync', '', true);
    update public.tb_trade_request set status = 'rejected'
     where post_id = new.post_id and status in ('pending', 'held');
  elsif new.status = '거래불발' then
    if not exists (select 1 from public.tb_trade_deal
                    where post_id = new.post_id and id <> new.id and status in ('거래중', '거래완료')) then
      perform set_config('d2r.deal_sync', '1', true);
      update public.tb_trade_post set status = '판매중', updated_at = now()
       where id = new.post_id and status = '예약중';
      perform set_config('d2r.deal_sync', '', true);
      with keep as (
        select distinct on (buyer_id) id from public.tb_trade_request
         where post_id = new.post_id and status = 'held'
         order by buyer_id, created_at desc
      ), back as (
        update public.tb_trade_request set status = 'pending'
         where id in (select id from keep)
           and not exists (select 1 from public.tb_trade_request p2
                            where p2.post_id = new.post_id and p2.buyer_id = tb_trade_request.buyer_id and p2.status = 'pending')
        returning buyer_id
      )
      insert into public.tb_notification (user_id, text, link)
      select buyer_id, '"' || new.post_title || '" 다시 판매중 - 신청이 수락 대기로 돌아옴', '/trade/' || new.post_id from back;
      update public.tb_trade_request set status = 'cancelled' where post_id = new.post_id and status = 'held';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_deal_status_sync on public.tb_trade_deal;
create trigger trg_deal_status_sync after update of status on public.tb_trade_deal
  for each row execute function public.d2r_deal_status_sync();
revoke all on function public.d2r_deal_status_sync() from public, anon, authenticated;

-- ─── 3) 지금까지의 거래 채우기 ───
update public.tb_trade_deal d set agreed_price = public.d2r_request_price(r.message, p.price)
  from public.tb_trade_request r, public.tb_trade_post p
 where d.agreed_price is null and r.id = d.request_id and p.id = d.post_id;
-- 거래완료 글: 완료된 거래방의 거래가, 거래방 없이 완료된 예전 글은 판매가 (제안만 받기면 비움)
-- (판매글 수정·상태 규칙 트리거는 로그인 안 한 실행(SQL Editor)에선 통과)
update public.tb_trade_post p set sold_price = coalesce(
    (select d.agreed_price from public.tb_trade_deal d where d.post_id = p.id and d.status = '거래완료' order by d.id desc limit 1),
    case when p.price = '가격 제안 받음' then null else p.price end)
 where p.status = '거래완료' and p.sold_price is null;

notify pgrst, 'reload schema';

-- 확인: 거래완료 글 수 / 그중 거래가 있는 글 수
select count(*) as 거래완료_글, count(sold_price) as 거래가_있는_글 from public.tb_trade_post where status = '거래완료';
