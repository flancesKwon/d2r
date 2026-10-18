-- 030: 공포의 영역 - 지금·다음 구역 (d2runewizard API 에서 Edge Function 이 1분마다 받아 저장)
--  tb_terror_zone: 항상 1행(id = 1). 누구나 읽음, 쓰기는 service_role (Edge Function) 만 - 프론트에서는 못 씀
-- 여러 번 실행해도 됨

create table if not exists public.tb_terror_zone (
  id int primary key default 1 check (id = 1),
  current_zone text not null,   -- 영어 그대로 (예: 'Dark Wood and Underground Passage'), 한국어는 화면에서 바꿈
  next_zone text,
  fetched_at timestamptz not null default now()
);

alter table public.tb_terror_zone enable row level security;
drop policy if exists terror_zone_read on public.tb_terror_zone;
create policy terror_zone_read on public.tb_terror_zone for select using (true);
grant select on public.tb_terror_zone to anon, authenticated;
