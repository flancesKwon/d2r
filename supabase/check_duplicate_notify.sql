-- ============================================================
--  알림이 두 번 오는 원인 찾기 (조회만 함 - 아무것도 안 바꿈)
--  구매신청·거래완료 때 알림이 2개씩 옴: 우리 트리거(notify_trade_request / notify_trade_deal_status) 말고
--  "도착했어요", "완료됐어요" 문구를 만드는 함수가 DB 에 하나 더 있음
--  적용: SQL Editor 에서 Run -> 나온 표를 그대로 알려주세요
-- ============================================================
select c.relname as 테이블, t.tgname as 트리거, p.proname as 함수,
       case when pg_get_functiondef(p.oid) ~ '도착했어요|완료됐어요' then '중복 의심' else '' end as 비고
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_proc p on p.oid = t.tgfoid
where not t.tgisinternal
  and c.relname in ('tb_trade_request', 'tb_trade_deal', 'tb_trade_deal_message', 'tb_trade_deal_review', 'tb_dm_message', 'tb_community_comment')
order by c.relname, t.tgname;
