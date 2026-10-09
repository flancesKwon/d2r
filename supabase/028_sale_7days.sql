-- 028: 판매 기간 48시간 -> 7일
--  48시간은 매물이 꾸준히 들어오는 큰 장터 기준이었음. 지금 규모에선 한 번에 올라온 글이
--  한 번에 만료돼서 목록이 통째로 비어 버림 (실제로 매물 50개가 같은 시각에 내려갔음)
--  화면 쪽 기준(src/tradeStore.js 의 SALE_HOURS)도 168 로 같이 바꿈
-- 여러 번 실행해도 됨

-- 1) 재등록은 판매 기간이 끝난 뒤부터 (016 의 같은 함수에서 48 hours -> 7 days 만 바꿈)
create or replace function public.d2r_relist_trade_post(p_post bigint, p_price text)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare r record; v_price text := btrim(coalesce(p_price, ''));
begin
  select author_id, status, bumped_at into r from public.tb_trade_post where id = p_post and deleted_at is null for update;
  if not found or r.author_id is distinct from auth.uid() then raise exception '내 판매글만 가능' using errcode = '42501'; end if;
  if r.status <> '판매중' then raise exception '판매중인 글만 재등록 가능'; end if;
  if r.bumped_at > now() - interval '7 days' then raise exception '판매 기간(7일)이 끝난 뒤 재등록 가능'; end if;
  if v_price = '' or char_length(v_price) > 100 then raise exception '판매가 1~100자'; end if;
  perform set_config('d2r.bump', '1', true);
  -- 가격 금칙어 검사 등 기존 트리거는 그대로 거침
  update public.tb_trade_post set price = v_price, bumped_at = now(), updated_at = now() where id = p_post;
  perform set_config('d2r.bump', '', true);
  return now();
end $$;
revoke all on function public.d2r_relist_trade_post(bigint, text) from public, anon;
grant execute on function public.d2r_relist_trade_post(bigint, text) to authenticated;

-- 2) 자동 정리(022)의 4번 항목도 7일 기준으로 - 나머지 내용은 022 와 똑같음
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

  -- 4) 판매 기간(7일) 끝나고 3일 넘게 재등록 안 한 글의 대기·보류 신청은 거절 (거절 알림은 기존 트리거)
  update public.tb_trade_request r set status = 'rejected'
    from public.tb_trade_post p
   where p.id = r.post_id and r.status in ('pending', 'held')
     and p.status = '판매중' and p.bumped_at < now() - interval '7 days' - interval '3 days';
  get diagnostics k = row_count; n := n + k;
  return n;
end $$;
revoke all on function public.d2r_settle_stale() from public;
grant execute on function public.d2r_settle_stale() to anon, authenticated;

-- PostgREST(사이트가 쓰는 API)가 바뀐 함수를 바로 알아보게
notify pgrst, 'reload schema';

-- 확인: '7일 안쪽 판매중' 이 늘어나면 정상 (48시간~7일 사이 글이 다시 보임)
select
  count(*) filter (where status = '판매중' and bumped_at > now() - interval '7 days')  as "7일_안쪽_판매중",
  count(*) filter (where status = '판매중' and bumped_at <= now() - interval '7 days') as "기간_만료",
  count(*) filter (where status = '판매중')                                            as "판매중_전체"
  from public.tb_trade_post
 where deleted_at is null;
