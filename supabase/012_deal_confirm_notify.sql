-- 012: 거래완료는 두 사람 다 확인 + 빠진 알림
--  1) 거래완료: 판매자·구매자 둘 다 눌러야 완료. 한 명이 누르면 "확인 대기" + 상대에게 알림
--     한쪽만 누르고 3일 지나면 자동 완료 (d2r_settle_deals - 거래방 목록을 불러올 때 화면이 부름)
--     거래불발: 한 명이 눌러도 바로
--     상태는 이 함수들로만 바뀜 (거래방 직접 수정 막음)
--  2) 알림 추가: 거래방 새 메시지(안 읽은 새 메시지 알림이 이미 있으면 또 안 만듦) / 후기 받음
-- 여러 번 실행해도 됨

alter table public.tb_trade_deal add column if not exists seller_done_at timestamptz;
alter table public.tb_trade_deal add column if not exists buyer_done_at timestamptz;

-- 거래방은 함수로만 바꿈 (예전엔 당사자가 상태를 직접 바꿀 수 있었음 -> 한 명이 혼자 완료 가능)
drop policy if exists deals_update on public.tb_trade_deal;
revoke update on public.tb_trade_deal from anon, authenticated;

-- ─── 1) 거래완료 확인 ───
create or replace function public.d2r_deal_done(p_deal bigint) returns text
language plpgsql security definer set search_path = public as $$
declare
  d public.tb_trade_deal;
  me uuid := auth.uid();
  first_time boolean;
  other uuid;
begin
  select * into d from public.tb_trade_deal where id = p_deal for update;
  if not found then raise exception '거래 없음'; end if;
  if me is null or (me <> d.seller_id and me <> d.buyer_id) then raise exception '거래 당사자만 가능' using errcode = '42501'; end if;
  if not public.d2r_is_active() then raise exception '이용 정지 중' using errcode = '42501'; end if;
  if d.status <> '거래중' then return d.status; end if;

  if me = d.seller_id then
    first_time := d.seller_done_at is null;
    update public.tb_trade_deal set seller_done_at = coalesce(seller_done_at, now()) where id = p_deal returning * into d;
    other := d.buyer_id;
  else
    first_time := d.buyer_done_at is null;
    update public.tb_trade_deal set buyer_done_at = coalesce(buyer_done_at, now()) where id = p_deal returning * into d;
    other := d.seller_id;
  end if;

  if d.seller_done_at is not null and d.buyer_done_at is not null then
    update public.tb_trade_deal set status = '거래완료' where id = p_deal;   -- 알림·판매글 상태는 트리거가
    return '거래완료';
  end if;
  if first_time then
    insert into public.tb_notification (user_id, text, link)
    values (other, '"' || d.post_title || '" 상대가 거래완료 누름 - 확인 필요', '/deals/' || d.id);
  end if;
  return '확인 대기';
end $$;

create or replace function public.d2r_deal_fail(p_deal bigint) returns text
language plpgsql security definer set search_path = public as $$
declare d public.tb_trade_deal; me uuid := auth.uid();
begin
  select * into d from public.tb_trade_deal where id = p_deal for update;
  if not found then raise exception '거래 없음'; end if;
  if me is null or (me <> d.seller_id and me <> d.buyer_id) then raise exception '거래 당사자만 가능' using errcode = '42501'; end if;
  if d.status <> '거래중' then return d.status; end if;
  update public.tb_trade_deal set status = '거래불발' where id = p_deal;
  return '거래불발';
end $$;

-- 한쪽만 완료를 누르고 3일 지난 내 거래는 완료로 (거래방 목록 불러올 때 화면이 부름)
create or replace function public.d2r_settle_deals() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if auth.uid() is null then return 0; end if;
  perform set_config('d2r.auto_done', '1', true);
  update public.tb_trade_deal set status = '거래완료'
   where status = '거래중'
     and (seller_id = auth.uid() or buyer_id = auth.uid())
     and (seller_done_at < now() - interval '3 days' or buyer_done_at < now() - interval '3 days');
  get diagnostics n = row_count;
  perform set_config('d2r.auto_done', '', true);
  return n;
end $$;

revoke all on function public.d2r_deal_done(bigint), public.d2r_deal_fail(bigint), public.d2r_settle_deals() from public, anon;
grant execute on function public.d2r_deal_done(bigint), public.d2r_deal_fail(bigint), public.d2r_settle_deals() to authenticated;

-- 거래 상태 알림: 자동 완료면 두 사람 다에게
create or replace function public.notify_trade_deal_status()
returns trigger language plpgsql security definer set search_path = public as $$
declare target uuid; msg text;
begin
  if new.status is not distinct from old.status or new.status = '거래중' then return new; end if;
  msg := '"' || new.post_title || '" ' || new.status;
  if current_setting('d2r.auto_done', true) = '1' then
    insert into public.tb_notification (user_id, text, link) values
      (new.seller_id, msg || ' (3일 지나 자동) - 리뷰 작성 가능', '/deals/' || new.id),
      (new.buyer_id,  msg || ' (3일 지나 자동) - 리뷰 작성 가능', '/deals/' || new.id);
    return new;
  end if;
  if auth.uid() = new.seller_id then target := new.buyer_id;
  elsif auth.uid() = new.buyer_id then target := new.seller_id;
  end if;
  if target is null then
    insert into public.tb_notification (user_id, text, link) values
      (new.seller_id, msg, '/deals/' || new.id),
      (new.buyer_id,  msg, '/deals/' || new.id);
  else
    insert into public.tb_notification (user_id, text, link)
    values (target, msg || case when new.status = '거래완료' then ' - 리뷰 작성 가능' else '' end, '/deals/' || new.id);
  end if;
  return new;
end $$;
revoke execute on function public.notify_trade_deal_status() from public;

-- ─── 2) 알림 추가 ───
-- 거래방 새 메시지 -> 상대 (같은 거래방 안 읽은 "새 메시지" 알림이 있으면 또 안 만듦)
create or replace function public.notify_deal_message() returns trigger
language plpgsql security definer set search_path = public as $$
declare d record; target uuid; lnk text;
begin
  select id, seller_id, buyer_id, post_title into d from public.tb_trade_deal where id = new.deal_id;
  if not found then return new; end if;
  target := case when new.sender_id = d.seller_id then d.buyer_id else d.seller_id end;
  lnk := '/deals/' || d.id;
  if not exists (select 1 from public.tb_notification
                  where user_id = target and link = lnk and read = false and text like '%거래방 새 메시지') then
    insert into public.tb_notification (user_id, text, link)
    values (target, '"' || d.post_title || '" 거래방 새 메시지', lnk);
  end if;
  return new;
end $$;
drop trigger if exists trg_notify_deal_message on public.tb_trade_deal_message;
create trigger trg_notify_deal_message after insert on public.tb_trade_deal_message
  for each row execute function public.notify_deal_message();
revoke all on function public.notify_deal_message() from public, anon, authenticated;

-- 후기 받음 -> 받은 사람 (마이페이지 받은 리뷰)
create or replace function public.notify_review() returns trigger
language plpgsql security definer set search_path = public as $$
declare t text;
begin
  select post_title into t from public.tb_trade_deal where id = new.deal_id;
  insert into public.tb_notification (user_id, text, link)
  values (new.to_id, '"' || coalesce(t, '거래') || '" 후기 받음 ' || repeat('★', new.rating), '/users/' || new.to_id);
  return new;
end $$;
drop trigger if exists trg_notify_review on public.tb_trade_deal_review;
create trigger trg_notify_review after insert on public.tb_trade_deal_review
  for each row execute function public.notify_review();
revoke all on function public.notify_review() from public, anon, authenticated;
