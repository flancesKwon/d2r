-- 014: 없어진 글·거래방을 가리키는 알림 정리
--  1) 지금 남아 있는 것: 판매글(/trade/n)·거래방(/deals/n)·게시글(/community/n)이 이미 지워진 알림을 지움
--  2) 앞으로: 판매글·거래방·게시글이 지워지면 그걸 가리키는 알림도 같이 지움
--     (예전엔 테스트 글을 지워도 "벡스 룬 거래 시작" 같은 알림이 남아 누르면 빈 화면)
-- 여러 번 실행해도 됨

-- 1) 지금 남은 알림 정리
delete from public.tb_notification n
 where (n.link ~ '^/trade/\d+$'     and not exists (select 1 from public.tb_trade_post p     where p.id = substring(n.link from '\d+$')::bigint))
    or (n.link ~ '^/deals/\d+$'     and not exists (select 1 from public.tb_trade_deal d     where d.id = substring(n.link from '\d+$')::bigint))
    or (n.link ~ '^/community/\d+$' and not exists (select 1 from public.tb_community_post c where c.id = substring(n.link from '\d+$')::bigint));

-- 2) 지울 때 같이 지우기
create or replace function public.d2r_delete_link_notifications() returns trigger
language plpgsql security definer set search_path = public as $$
declare lnk text;
begin
  lnk := case tg_table_name
    when 'tb_trade_post' then '/trade/'
    when 'tb_trade_deal' then '/deals/'
    when 'tb_community_post' then '/community/'
  end || old.id;
  delete from public.tb_notification where link = lnk;
  return old;
end $$;
revoke all on function public.d2r_delete_link_notifications() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['tb_trade_post', 'tb_trade_deal', 'tb_community_post'] loop
    execute format('drop trigger if exists trg_delete_link_notifications on public.%I', t);
    execute format('create trigger trg_delete_link_notifications after delete on public.%I for each row execute function public.d2r_delete_link_notifications()', t);
  end loop;
end $$;

-- 남은 알림 수 확인 (0 이면 정상)
select count(*) as 없는_곳을_가리키는_알림 from public.tb_notification n
 where (n.link ~ '^/trade/\d+$'     and not exists (select 1 from public.tb_trade_post p     where p.id = substring(n.link from '\d+$')::bigint))
    or (n.link ~ '^/deals/\d+$'     and not exists (select 1 from public.tb_trade_deal d     where d.id = substring(n.link from '\d+$')::bigint))
    or (n.link ~ '^/community/\d+$' and not exists (select 1 from public.tb_community_post c where c.id = substring(n.link from '\d+$')::bigint));
