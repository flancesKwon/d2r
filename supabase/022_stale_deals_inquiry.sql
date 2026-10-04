-- 022: 멈춘 거래·오래된 신청 정리 + 문의는 쪽지로
--  1) 구매신청은 "구매하기"·"가격 제안"만 - 문의(자유 글)는 쪽지로 (화면도 문의하기 = 쪽지)
--  2) 거래방 대화·확인이 5일 없으면 두 사람에게 "2일 뒤 자동 거래불발" 알림, 7일이면 자동 거래불발
--     (거래불발이면 판매글은 판매중으로, 보류 신청은 다시 대기 - 020)
--  3) 한쪽만 거래완료를 누르고 2일 지나면 안 누른 쪽에 "내일 자동 거래완료" 알림 (3일이면 자동 완료 - 012)
--  4) 판매 기간이 끝나고 3일 넘게 재등록 안 한 글의 대기·보류 신청은 거절
--  d2r_settle_stale(): 누구나 부를 수 있는 정리 함수 - 거래게시판·거래방 목록을 불러올 때 화면이 가끔 부름
-- 020 다음에 실행. 여러 번 실행해도 됨

-- ─── 1) 구매신청 = 구매하기·가격 제안만 (020 의 새 신청 규칙에 더함) ───
create or replace function public.d2r_trade_request_hold_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(new.message, '') !~ '^(구매하기|가격 제안)' then
    raise exception '문의는 쪽지로 - 구매신청은 구매하기·가격 제안만' using errcode = '42501';
  end if;
  if exists (select 1 from public.tb_trade_post where id = new.post_id and status = '거래완료') then
    raise exception '거래완료된 판매글' using errcode = '42501';
  end if;
  if new.status = 'pending' and exists (select 1 from public.tb_trade_deal where post_id = new.post_id and status = '거래중') then
    new.status := 'held';
  end if;
  return new;
end $$;

-- ─── 2·3) 알림을 한 번만 보내려고 보낸 시각을 남김 ───
alter table public.tb_trade_deal add column if not exists stale_warned_at timestamptz;
alter table public.tb_trade_deal add column if not exists done_warned_at timestamptz;

-- 거래방 상태 알림 (012 를 바꿈) - 자동 거래불발이면 이유를 붙여 두 사람에게
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
  if current_setting('d2r.auto_fail', true) = '1' then
    insert into public.tb_notification (user_id, text, link) values
      (new.seller_id, msg || ' (7일 동안 대화 없어 자동)', '/deals/' || new.id),
      (new.buyer_id,  msg || ' (7일 동안 대화 없어 자동)', '/deals/' || new.id);
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

create or replace function public.d2r_settle_stale() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer := 0; k integer;
begin
  -- 거래방마다 마지막 활동 (만든 때·거래완료 누른 때·마지막 메시지)
  create temporary table if not exists d2r_tmp_deal_act (id bigint primary key, last_at timestamptz) on commit drop;
  -- Supabase 는 API 로 들어온 요청에서 WHERE 없는 DELETE 를 막음(safeupdate) -> where true
  delete from d2r_tmp_deal_act where true;
  insert into d2r_tmp_deal_act
  select d.id, greatest(d.created_at, coalesce(d.seller_done_at, d.created_at), coalesce(d.buyer_done_at, d.created_at),
                        coalesce((select max(m.created_at) from public.tb_trade_deal_message m where m.deal_id = d.id), d.created_at))
    from public.tb_trade_deal d where d.status = '거래중';

  -- 2) 5일 조용하면 알림, 7일이면 자동 거래불발
  with w as (
    update public.tb_trade_deal d set stale_warned_at = now()
      from d2r_tmp_deal_act a
     where d.id = a.id and d.status = '거래중' and a.last_at < now() - interval '5 days'
       and (d.stale_warned_at is null or d.stale_warned_at < a.last_at)
    returning d.id, d.seller_id, d.buyer_id, d.post_title
  )
  insert into public.tb_notification (user_id, text, link)
  select u, '"' || w.post_title || '" 거래방에 5일째 대화 없음 - 2일 뒤 자동 거래불발', '/deals/' || w.id
    from w, unnest(array[w.seller_id, w.buyer_id]) as u;

  perform set_config('d2r.auto_fail', '1', true);
  update public.tb_trade_deal d set status = '거래불발'
    from d2r_tmp_deal_act a
   where d.id = a.id and d.status = '거래중' and a.last_at < now() - interval '7 days';
  get diagnostics k = row_count; n := n + k;
  perform set_config('d2r.auto_fail', '', true);

  -- 3) 한쪽만 거래완료 누르고 2일 - 안 누른 쪽에 "내일 자동 완료" 알림
  with w as (
    update public.tb_trade_deal d set done_warned_at = now()
     where d.status = '거래중' and d.done_warned_at is null
       and ((d.seller_done_at < now() - interval '2 days' and d.buyer_done_at is null)
         or (d.buyer_done_at < now() - interval '2 days' and d.seller_done_at is null))
    returning d.id, d.post_title, case when d.seller_done_at is null then d.seller_id else d.buyer_id end as target
  )
  insert into public.tb_notification (user_id, text, link)
  select target, '"' || post_title || '" 상대가 거래완료 누름 - 내일 자동 거래완료 (못 받았으면 거래불발·신고)', '/deals/' || id from w;

  -- 012 의 3일 자동 완료를 모든 거래방에 (원래는 거래방 목록을 연 당사자 것만)
  perform set_config('d2r.auto_done', '1', true);
  update public.tb_trade_deal set status = '거래완료'
   where status = '거래중'
     and (seller_done_at < now() - interval '3 days' or buyer_done_at < now() - interval '3 days');
  get diagnostics k = row_count; n := n + k;
  perform set_config('d2r.auto_done', '', true);

  -- 4) 판매 기간 끝나고 3일 넘게 재등록 안 한 글의 대기·보류 신청은 거절 (거절 알림은 기존 트리거)
  update public.tb_trade_request r set status = 'rejected'
    from public.tb_trade_post p
   where p.id = r.post_id and r.status in ('pending', 'held')
     and p.status = '판매중' and p.bumped_at < now() - interval '48 hours' - interval '3 days';
  get diagnostics k = row_count; n := n + k;
  return n;
end $$;
revoke all on function public.d2r_settle_stale() from public;
grant execute on function public.d2r_settle_stale() to anon, authenticated;

notify pgrst, 'reload schema';

-- 확인: 2줄 + 정리된 건수 (처음엔 0 이어도 정상)
select '정리 함수' as 항목, proname as 이름 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'd2r_settle_stale'
union all
select '신청 규칙', tgname from pg_trigger where tgrelid = 'public.tb_trade_request'::regclass and tgname = 'trg_trade_request_hold_guard';
select public.d2r_settle_stale() as 지금_정리된_건수;
