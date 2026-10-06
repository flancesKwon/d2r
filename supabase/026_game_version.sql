-- 026: 판매글에 게임 모드(확장팩) 칸
--  클래식 / 파괴의 군주 / 악마술사의 군림 - 같은 아이템이라도 모드가 다르면 거래가 안 돼서 구분이 필요
--  기존 글은 전부 '악마술사의 군림' (지금 레더가 도는 모드)
-- 여러 번 실행해도 됨

alter table public.tb_trade_post
  add column if not exists game_version text not null default '악마술사의 군림';

-- 예전에 다른 값이 들어간 게 있으면 기본값으로 맞춘 뒤 검사 조건을 검
update public.tb_trade_post
   set game_version = '악마술사의 군림'
 where game_version is null or game_version not in ('클래식', '파괴의 군주', '악마술사의 군림');

alter table public.tb_trade_post drop constraint if exists tb_trade_post_game_version_check;
alter table public.tb_trade_post
  add constraint tb_trade_post_game_version_check
  check (game_version in ('클래식', '파괴의 군주', '악마술사의 군림'));

-- 목록이 모드로 거를 때 쓰는 색인
create index if not exists tb_trade_post_game_version_idx on public.tb_trade_post (game_version);

-- PostgREST(사이트가 쓰는 API)가 새 칸을 바로 알아보게
notify pgrst, 'reload schema';

-- 확인: 모드별 판매글 수가 나오면 정상
select game_version as 게임모드, count(*) as 판매글
  from public.tb_trade_post
 where deleted_at is null
 group by game_version
 order by 2 desc;
