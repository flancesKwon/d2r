-- 029: 거래 흐름 구멍 메우기
--  1) 거래불발이 나면 그 거래의 '수락된' 신청도 취소로 바꿈 - 예전엔 수락됨으로 남아서
--     판매자가 글을 수정할 수 없고(019) 풀 방법도 없었음. 이미 이렇게 막힌 글도 같이 정리
--  2) 판매 기간(7일)이 끝난 판매중 글엔 새 신청을 못 넣고, 수락도 못 함 (재등록하면 다시 가능)
--  3) 재등록하면 그 글의 대기·보류 신청은 정리하고 구매자에게 알림 - 신청한 가격과 다른 가격으로 거래가 잡히던 것 막음
--  시스템이 바꾼 신청 상태는 '구매신청 취소됨/거절됨' 알림을 그대로 보내지 않고 이유가 보이는 문구로 (판매자가 취소한 것처럼 보이던 것)
--  4) 제안만 받기 글을 가격을 정해 재등록하면 일반 글로 (예전엔 '흥정 가능' 표시가 남았음)
-- 028 다음에 실행. 여러 번 실행해도 됨

-- ─── 0) 신청 상태 알림 (004) - 시스템이 바꿀 땐 보내지 않음 ───
create or replace function public.notify_trade_request()
returns trigger language plpgsql security definer set search_path = public as $$
declare p record;
begin
  select id, author_id, item_name into p from public.tb_trade_post where id = new.post_id;
  if not found then return new; end if;

  if tg_op = 'INSERT' then
    insert into public.tb_notification (user_id, text, link)
    values (p.author_id, '"' || p.item_name || '" 새 구매신청', '/trade/' || p.id);
  elsif new.status is distinct from old.status and coalesce(current_setting('d2r.sys_request', true), '') <> '1' then
    if new.status = 'rejected' then
      -- 판매 기간이 끝나고 3일 넘게 재등록이 없어 자동으로 정리된 신청 (022·028)은 판매자가 거절한 게 아니라는 걸 문구로 알림
      insert into public.tb_notification (user_id, text, link)
      values (new.buyer_id,
              '"' || p.item_name || '" ' || case when exists (select 1 from public.tb_trade_post
                                                           where id = p.id and status = '판매중' and bumped_at <= now() - interval '10 days')
                                                then '구매신청 종료 - 판매 기간이 끝나 재등록되지 않음' else '구매신청 거절됨' end,
              '/trade/' || p.id);
    elsif new.status = 'cancelled' then
      insert into public.tb_notification (user_id, text, link)
      values (p.author_id, '"' || p.item_name || '" 구매신청 취소됨', '/trade/' || p.id);
    end if;
  end if;
  return new;
end $$;
revoke execute on function public.notify_trade_request() from public;

-- ─── 1) 거래방 상태 -> 판매글·신청 (023 + 거래불발 때 그 거래의 수락 신청 취소) ───
create or replace function public.d2r_deal_status_sync() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status is not distinct from old.status then return new; end if;
  if new.status = '거래완료' then
    perform set_config('d2r.deal_sync', '1', true);
    update public.tb_trade_post set status = '거래완료', sold_price = coalesce(new.agreed_price, sold_price), updated_at = now()
     where id = new.post_id and status <> '거래완료';
    perform set_config('d2r.deal_sync', '', true);
    -- 같은 글에 남은 대기·보류 신청은 종료 - 판매자가 거절한 게 아니라서 이유를 적은 알림을 따로 보냄
    perform set_config('d2r.sys_request', '1', true);
    with gone as (
      update public.tb_trade_request set status = 'rejected'
       where post_id = new.post_id and status in ('pending', 'held')
      returning buyer_id
    )
    insert into public.tb_notification (user_id, text, link)
    select distinct buyer_id, '"' || new.post_title || '" 다른 구매자와 거래가 완료되어 신청이 종료됨', '/trade/' || new.post_id from gone;
    perform set_config('d2r.sys_request', '', true);
  elsif new.status = '거래불발' then
    -- 이 거래의 수락 신청은 끝난 것 - 판매자·구매자에게는 거래불발 알림이 이미 감
    perform set_config('d2r.sys_request', '1', true);
    update public.tb_trade_request set status = 'cancelled' where id = new.request_id and status = 'accepted';
    perform set_config('d2r.sys_request', '', true);
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
      -- 남은 보류 신청 정리 (구매자가 취소한 게 아니라서 판매자에게 취소 알림은 안 보냄)
      perform set_config('d2r.sys_request', '1', true);
      update public.tb_trade_request set status = 'cancelled' where post_id = new.post_id and status = 'held';
      perform set_config('d2r.sys_request', '', true);
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_deal_status_sync on public.tb_trade_deal;
create trigger trg_deal_status_sync after update of status on public.tb_trade_deal
  for each row execute function public.d2r_deal_status_sync();
revoke all on function public.d2r_deal_status_sync() from public, anon, authenticated;

-- 이미 거래불발인데 수락됨으로 남은 신청 정리 (이것 때문에 수정이 막힌 글이 풀림)
do $$
begin
  perform set_config('d2r.sys_request', '1', true);
  update public.tb_trade_request r set status = 'cancelled'
    from public.tb_trade_deal d
   where d.request_id = r.id and d.status = '거래불발' and r.status = 'accepted';
  perform set_config('d2r.sys_request', '', true);
end $$;

-- ─── 2) 판매 기간이 끝난 글엔 새 신청·수락 불가 (022 에 더함) ───
create or replace function public.d2r_trade_request_hold_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(new.message, '') !~ '^(구매하기|가격 제안)' then
    raise exception '문의는 쪽지로 - 구매신청은 구매하기·가격 제안만' using errcode = '42501';
  end if;
  if exists (select 1 from public.tb_trade_post where id = new.post_id and status = '거래완료') then
    raise exception '거래완료된 판매글' using errcode = '42501';
  end if;
  if exists (select 1 from public.tb_trade_post
              where id = new.post_id and status = '판매중' and bumped_at <= now() - interval '7 days') then
    raise exception '판매 기간이 끝난 글 - 판매자가 재등록하면 신청 가능' using errcode = '42501';
  end if;
  if new.status = 'pending' and exists (select 1 from public.tb_trade_deal where post_id = new.post_id and status = '거래중') then
    new.status := 'held';
  end if;
  return new;
end $$;

create or replace function public.accept_trade_request(p_request_id bigint)
returns bigint language plpgsql security definer set search_path = public as $$
declare r record; d_id bigint;
begin
  select tr.*, tp.author_id as seller_id, tp.item_id, tp.item_name, tp.status as post_status, tp.price as post_price,
         tp.bumped_at as post_bumped_at
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
  if r.post_status = '판매중' and r.post_bumped_at <= now() - interval '7 days' then
    raise exception '판매 기간이 끝난 글 - 재등록한 뒤 수락 가능';
  end if;
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

-- ─── 3) 재등록 (028) - 대기·보류 신청은 정리하고 구매자에게 알림 ───
create or replace function public.d2r_relist_trade_post(p_post bigint, p_price text)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare r record; v_price text := btrim(coalesce(p_price, ''));
begin
  select author_id, status, bumped_at, item_name, price into r from public.tb_trade_post where id = p_post and deleted_at is null for update;
  if not found or r.author_id is distinct from auth.uid() then raise exception '내 판매글만 가능' using errcode = '42501'; end if;
  if r.status <> '판매중' then raise exception '판매중인 글만 재등록 가능'; end if;
  if r.bumped_at > now() - interval '7 days' then raise exception '판매 기간(7일)이 끝난 뒤 재등록 가능'; end if;
  if v_price = '' or char_length(v_price) > 100 then raise exception '판매가 1~100자'; end if;
  perform set_config('d2r.bump', '1', true);
  -- 가격 금칙어 검사 등 기존 트리거는 그대로 거침
  update public.tb_trade_post set price = v_price, bumped_at = now(), updated_at = now(),
         -- 제안만 받기 글을 가격을 정해 재등록하면 일반 글 (흥정 가능은 판매자가 수정에서 다시 켬)
         options = case when r.price = '가격 제안 받음' and v_price <> '가격 제안 받음' and jsonb_typeof(options) = 'object'
                        then options || '{"negotiable": false, "offerOnly": false}'::jsonb else options end
   where id = p_post;
  perform set_config('d2r.bump', '', true);
  -- 신청한 때와 가격·조건이 달라질 수 있어서 기존 대기·보류 신청은 정리 (구매자가 새로 신청)
  perform set_config('d2r.sys_request', '1', true);
  with gone as (
    update public.tb_trade_request set status = 'rejected'
     where post_id = p_post and status in ('pending', 'held')
    returning buyer_id
  )
  insert into public.tb_notification (user_id, text, link)
  select distinct buyer_id, '"' || r.item_name || '" 재등록으로 신청이 정리됨 - 가격을 확인하고 다시 신청해 주세요', '/trade/' || p_post
    from gone;
  perform set_config('d2r.sys_request', '', true);
  return now();
end $$;
revoke all on function public.d2r_relist_trade_post(bigint, text) from public, anon;
grant execute on function public.d2r_relist_trade_post(bigint, text) to authenticated;

notify pgrst, 'reload schema';

-- 확인: 거래불발인데 수락됨으로 남은 신청 0 이면 정상
select count(*) as 거래불발인데_수락됨_신청
  from public.tb_trade_request r join public.tb_trade_deal d on d.request_id = r.id
 where d.status = '거래불발' and r.status = 'accepted';
