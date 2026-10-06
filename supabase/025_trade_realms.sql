-- 025: 판매글 서버(지역) 아시아·미주·유럽
--  배틀넷 지역 서버만 맞추면 해외 유저와도 거래 가능 -> 판매글 서버를 아시아 하나에서 세 지역으로 넓힘
--  realm 칸에 걸려 있던 검사 조건(있으면)을 지우고 세 값만 받게 다시 검; 기존 글은 전부 '아시아'라 그대로 통과
-- 여러 번 실행해도 됨

do $$
declare c record;
begin
  for c in
    select con.conname
      from pg_constraint con
     where con.conrelid = 'public.tb_trade_post'::regclass
       and con.contype = 'c'
       and pg_get_constraintdef(con.oid) ilike '%realm%'
  loop
    execute format('alter table public.tb_trade_post drop constraint %I', c.conname);
  end loop;
end $$;

update public.tb_trade_post set realm = '아시아' where realm is null or realm not in ('아시아', '미주', '유럽');

alter table public.tb_trade_post
  add constraint tb_trade_post_realm_check check (realm in ('아시아', '미주', '유럽'));
