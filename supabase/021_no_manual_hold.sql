-- 021: 판매자가 직접 "예약중"(홀드)으로 바꾸는 것 없앰
--  예약중 = 구매신청을 수락해서 거래방이 거래중인 상태 (수락할 때 DB가 자동으로 바꿈, 020)
--  판매자는 판매 상태를 직접 못 바꿈: 예약중·거래완료는 거래방 흐름으로만, 판매중 복귀는 거래불발로
--  이미 직접 예약중으로 해 둔 글(거래중인 거래방 없음)은 판매중으로 돌림 (판매 기간 48시간 새로 시작 - 016)
--  운영진은 그대로. 020 다음에 실행. 여러 번 실행해도 됨

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
  if new.status = '예약중' then
    raise exception '예약중은 구매신청을 수락하면 자동으로 바뀜' using errcode = '42501';
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

-- 직접 예약중으로 해 둔 글 정리
update public.tb_trade_post p set status = '판매중', updated_at = now()
 where p.status = '예약중'
   and not exists (select 1 from public.tb_trade_deal d where d.post_id = p.id and d.status = '거래중');

-- 확인: 거래방 없이 예약중인 글 0 이면 정상
select count(*) as 거래방_없는_예약중_글 from public.tb_trade_post p
 where p.status = '예약중'
   and not exists (select 1 from public.tb_trade_deal d where d.post_id = p.id and d.status = '거래중');
