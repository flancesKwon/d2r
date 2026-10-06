-- 홍보 전 테스트 데이터 정리 (2026-10-03)
--  커뮤니티 10 "ㅈㄱㄴ" / 판매글 16 "바람살" / 판매글 17 "수수께끼"
--  번호와 제목이 둘 다 맞을 때만 지움. 딸린 구매신청·거래방·대화·후기·찜·댓글은 외래키로 같이 지워짐
--  그 글들을 가리키는 알림·신고도 같이 정리
--  (SQL Editor 가 문장을 따로 실행해도 되게 임시 표 없이)

-- 1) 알림 (글·판매글·그 판매글의 거래방을 가리키는 것) - 판매글을 지우기 전에
delete from public.tb_notification
 where link in ('/community/10', '/trade/16', '/trade/17')
    or link in (
      select '/deals/' || d.id from public.tb_trade_deal d
      join public.tb_trade_post p on p.id = d.post_id
      where (p.id = 16 and p.item_name = '바람살') or (p.id = 17 and p.item_name = '수수께끼')
    );

-- 2) 신고
delete from public.tb_report
 where (target_type = 'community_post' and target_id = '10')
    or (target_type = 'trade_post' and target_id in ('16', '17'));

-- 3) 글
delete from public.tb_community_post where id = 10 and title = 'ㅈㄱㄴ';
delete from public.tb_trade_post where (id = 16 and item_name = '바람살') or (id = 17 and item_name = '수수께끼');

-- 결과 확인 (0, 0 이면 정상)
select
  (select count(*) from public.tb_community_post where id = 10) as 남은_커뮤니티글,
  (select count(*) from public.tb_trade_post where id in (16, 17)) as 남은_판매글;
