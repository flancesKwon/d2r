-- 015: 실시간 알림 (Supabase Realtime)
--  알림·쪽지·거래방 메시지·거래방 상태가 바뀌면 화면으로 바로 보냄 (src/realtime.js)
--  받는 쪽은 DB 권한(RLS)대로 본인 것만 받음 - 새 권한을 여는 게 아님
-- 여러 번 실행해도 됨

do $$
declare t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  foreach t in array array['tb_notification', 'tb_dm_message', 'tb_trade_deal_message', 'tb_trade_deal'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- 확인: 4줄 나오면 정상
select tablename as 실시간_표 from pg_publication_tables
 where pubname = 'supabase_realtime' and schemaname = 'public'
   and tablename in ('tb_notification', 'tb_dm_message', 'tb_trade_deal_message', 'tb_trade_deal')
 order by tablename;
