-- 037: 판매글 전체 삭제 (기간 지난 글 + 테스트 글, 2026-10-26)
--  딸린 거래방·대화·후기·찜은 외래키로 같이 지워지고, 알림은 014 트리거가 지움
--  신고는 외래키가 없어 따로 지움
-- 여러 번 실행해도 됨

delete from public.tb_report where target_type = 'trade_post';
delete from public.tb_trade_post;

-- 결과 확인 (0 이면 정상)
select count(*) as 남은_판매글 from public.tb_trade_post;
