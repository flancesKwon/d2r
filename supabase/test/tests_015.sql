-- 015 검사: 실시간 표 4개 (015 를 두 번 실행해도 그대로)
\set ON_ERROR_STOP on
DO $$ BEGIN
  IF (SELECT count(*) FROM pg_publication_tables WHERE pubname = 'supabase_realtime'
      AND tablename IN ('tb_notification', 'tb_dm_message', 'tb_trade_deal_message', 'tb_trade_deal')) <> 4
  THEN RAISE EXCEPTION '실패: 실시간 표 4개 아님'; END IF;
  RAISE NOTICE '  OK   실시간 표 4개';
END $$;
\echo '전부 통과'
