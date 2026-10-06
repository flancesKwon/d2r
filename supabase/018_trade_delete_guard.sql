-- 018: 거래중인 거래방이 있는 판매글은 삭제 막기
--  판매글을 지우면 거래방(대화·확인 기록)이 같이 지워짐 -> 구매자 쪽 거래방이 갑자기 사라졌음
--  거래중인 거래방이 있으면 판매자는 못 지움 (거래불발·거래완료로 끝낸 뒤 가능 - 거래완료 글은 016 이 따로 막음)
--  운영진은 그대로 지울 수 있음 (스팸·사기 글 정리)
-- 016 다음에 실행. 여러 번 실행해도 됨

create or replace function public.d2r_trade_active_deal_delete_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.d2r_is_staff()
     and exists (select 1 from public.tb_trade_deal where post_id = old.id and status = '거래중') then
    raise exception '거래중인 거래방이 있어서 삭제할 수 없음 - 거래방에서 거래완료·거래불발 처리 후 삭제' using errcode = '42501';
  end if;
  return old;
end $$;
revoke all on function public.d2r_trade_active_deal_delete_guard() from public, anon, authenticated;
drop trigger if exists trg_trade_active_deal_delete_guard on public.tb_trade_post;
create trigger trg_trade_active_deal_delete_guard before delete on public.tb_trade_post
  for each row execute function public.d2r_trade_active_deal_delete_guard();

-- 확인: 1줄 나오면 정상
select '거래중 글 삭제 막기' as 항목, tgname as 이름 from pg_trigger
 where tgrelid = 'public.tb_trade_post'::regclass and tgname = 'trg_trade_active_deal_delete_guard';
