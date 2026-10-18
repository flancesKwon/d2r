-- 030: 공포의 영역 기록 - 구역이 바뀔 때마다 한 줄씩 쌓음 (d2runewizard API 에서 Edge Function 이 1분마다 확인)
--  tb_terror_zone: 지금·다음 구역 (사이트는 가장 최근 줄을 보여줌). 누구나 읽음, 쓰기는 service_role (Edge Function) 만 - 프론트에서는 못 씀
--  처음 만든 1행짜리 테이블이 있으면 먼저: drop table if exists public.tb_terror_zone;
-- 여러 번 실행해도 됨

create table if not exists public.tb_terror_zone (
  id bigint generated always as identity primary key,
  current_zone text not null,   -- 영어 그대로 (예: 'Dark Wood and Underground Passage'), 한국어는 화면에서 바꿈
  next_zone text,
  created_at timestamptz not null default now()
);

alter table public.tb_terror_zone enable row level security;
drop policy if exists terror_zone_read on public.tb_terror_zone;
create policy terror_zone_read on public.tb_terror_zone for select using (true);
grant select on public.tb_terror_zone to anon, authenticated;
