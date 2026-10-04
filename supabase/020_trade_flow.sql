-- 020: 거래 흐름 정리 + 골드 한도
--  1) 수락: 대기 신청만 수락 가능, 이미 거래중인 구매자가 있으면 못 함. 수락하면 판매글은 예약중(DB가 직접),
--     같은 글의 다른 대기 신청은 "보류"(held) + 보류 알림
--  2) 거래중인 글에 새로 들어온 신청은 바로 보류. 거래완료된 글엔 신청 못 함
--  3) 거래불발: 판매글이 판매중으로 돌아가면 보류된 신청이 다시 대기 (구매자에게 알림) -> 판매자가 그중에서 다시 수락
--     거래완료: 대기·보류 신청은 모두 거절
--  4) 판매자가 판매글을 직접 "거래완료"로 바꾸는 것 막음 (거래방에서 둘 다 확인해야 완료),
--     거래중인 거래방이 있으면 직접 "판매중"으로 돌리는 것도 막음 (거래방에서 거래불발 처리), 거래완료 글은 상태 고정
--  5) 골드 판매글 한 건 최대 15,000,000 골드
-- 016 다음에 실행. 여러 번 실행해도 됨

-- ─── 0) 구매신청 상태에 보류(held) 추가 - 상태를 검사하는 제약이 있으면 held 를 넣어 다시 만듦 ───
do $$
declare c record; found_any boolean := false;
begin
  for c in
    select conname from pg_constraint
     where conrelid = 'public.tb_trade_request'::regclass and contype = 'c'
       and pg_get_constraintdef(oid) ~ '\mstatus\M' and conname <> 'd2r_trade_request_status'
  loop
    execute format('alter table public.tb_trade_request drop constraint %I', c.conname);
    found_any := true;
  end loop;
  if found_any or exists (select 1 from pg_constraint where conrelid = 'public.tb_trade_request'::regclass and conname = 'd2r_trade_request_status') then
    alter table public.tb_trade_request drop constraint if exists d2r_trade_request_status;
    alter table public.tb_trade_request add constraint d2r_trade_request_status
      check (status in ('pending', 'accepted', 'rejected', 'cancelled', 'held')) not valid;
  end if;
end $$;

-- ─── 1) 수락 ───
create or replace function public.accept_trade_request(p_request_id bigint)
returns bigint language plpgsql security definer set search_path = public as $$
declare r record; d_id bigint;
begin
  select tr.*, tp.author_id as seller_id, tp.item_id, tp.item_name, tp.status as post_status
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

  insert into public.tb_trade_deal (post_id, request_id, seller_id, buyer_id, item_id, post_title)
  values (r.post_id, r.id, r.seller_id, r.buyer_id, r.item_id, r.item_name)
  returning id into d_id;

  insert into public.tb_notification (user_id, text, link)
  values (r.buyer_id, '"' || r.item_name || '" 거래 시작', '/deals/' || d_id);

  -- 판매글은 예약중 (예전엔 화면이 따로 바꿔서, 중간에 끊기면 판매중으로 남았음)
  perform set_config('d2r.deal_sync', '1', true);
  update public.tb_trade_post set status = '예약중', updated_at = now() where id = r.post_id and status = '판매중';
  perform set_config('d2r.deal_sync', '', true);

  -- 같은 글의 다른 대기 신청은 보류
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

-- ─── 2) 새 신청: 거래중인 글이면 보류로, 거래완료된 글이면 막음 ───
create or replace function public.d2r_trade_request_hold_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.tb_trade_post where id = new.post_id and status = '거래완료') then
    raise exception '거래완료된 판매글' using errcode = '42501';
  end if;
  if new.status = 'pending' and exists (select 1 from public.tb_trade_deal where post_id = new.post_id and status = '거래중') then
    new.status := 'held';
  end if;
  return new;
end $$;
revoke all on function public.d2r_trade_request_hold_guard() from public, anon, authenticated;
drop trigger if exists trg_trade_request_hold_guard on public.tb_trade_request;
create trigger trg_trade_request_hold_guard before insert on public.tb_trade_request
  for each row execute function public.d2r_trade_request_hold_guard();

-- ─── 3) 거래방 상태 -> 판매글·신청 (005 를 바꿈) ───
create or replace function public.d2r_deal_status_sync() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status is not distinct from old.status then return new; end if;
  if new.status = '거래완료' then
    perform set_config('d2r.deal_sync', '1', true);
    update public.tb_trade_post set status = '거래완료', updated_at = now()
     where id = new.post_id and status <> '거래완료';
    perform set_config('d2r.deal_sync', '', true);
    -- 같은 글에 남은 대기·보류 신청은 거절 (거절 알림은 기존 트리거가 보냄)
    update public.tb_trade_request set status = 'rejected'
     where post_id = new.post_id and status in ('pending', 'held');
  elsif new.status = '거래불발' then
    -- 같은 글에 진행 중이거나 끝난 다른 거래가 없을 때만 다시 판매중 + 보류 신청 다시 대기
    if not exists (select 1 from public.tb_trade_deal
                    where post_id = new.post_id and id <> new.id and status in ('거래중', '거래완료')) then
      perform set_config('d2r.deal_sync', '1', true);
      update public.tb_trade_post set status = '판매중', updated_at = now()
       where id = new.post_id and status = '예약중';
      perform set_config('d2r.deal_sync', '', true);
      -- 한 사람이 보류 신청을 여러 개 갖고 있으면 가장 최근 것만 대기로 (같은 글 대기 신청은 한 사람당 하나)
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

-- ─── 4) 판매글 상태 직접 변경 규칙 ───
create or replace function public.d2r_trade_status_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status is not distinct from old.status then return new; end if;
  if auth.uid() is null or public.d2r_is_staff() or current_setting('d2r.deal_sync', true) = '1' then return new; end if;
  if old.status = '거래완료' then
    raise exception '거래완료된 판매글은 상태를 바꿀 수 없음' using errcode = '42501';
  end if;
  if new.status = '거래완료' then
    raise exception '거래완료는 거래방에서 판매자·구매자가 둘 다 확인하면 자동으로 바뀜' using errcode = '42501';
  end if;
  if new.status = '판매중' and exists (select 1 from public.tb_trade_deal where post_id = old.id and status = '거래중') then
    raise exception '거래중인 거래방이 있음 - 거래방에서 거래불발 처리하면 판매중으로 돌아감' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function public.d2r_trade_status_guard() from public, anon, authenticated;
drop trigger if exists trg_trade_status_guard on public.tb_trade_post;
create trigger trg_trade_status_guard before update on public.tb_trade_post
  for each row execute function public.d2r_trade_status_guard();

-- ─── 5) 골드 한도 (예전 글은 다시 검사하지 않음) ───
alter table public.tb_trade_post drop constraint if exists d2r_trade_gold_max;
alter table public.tb_trade_post add constraint d2r_trade_gold_max check (
  category is distinct from '골드'
  or coalesce(nullif(regexp_replace(coalesce(amount_label, ''), '[^0-9]', '', 'g'), '')::numeric, 0) between 1 and 15000000
) not valid;

-- ─── 지금 거래중인 글의 대기 신청은 보류로 맞춤 ───
update public.tb_trade_request tr set status = 'held'
 where tr.status = 'pending'
   and exists (select 1 from public.tb_trade_deal d where d.post_id = tr.post_id and d.status = '거래중');

notify pgrst, 'reload schema';

-- 확인: 4줄 나오면 정상
select '새 신청 보류' as 항목, tgname as 이름 from pg_trigger
 where tgrelid = 'public.tb_trade_request'::regclass and tgname = 'trg_trade_request_hold_guard'
union all
select '거래방 -> 판매글·신청', tgname from pg_trigger
 where tgrelid = 'public.tb_trade_deal'::regclass and tgname = 'trg_deal_status_sync'
union all
select '판매글 상태 규칙', tgname from pg_trigger
 where tgrelid = 'public.tb_trade_post'::regclass and tgname = 'trg_trade_status_guard'
union all
select '골드 한도', conname from pg_constraint
 where conrelid = 'public.tb_trade_post'::regclass and conname = 'd2r_trade_gold_max';
