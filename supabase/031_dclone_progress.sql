-- 031: 우버 디아(디아블로 클론) 진행 단계 기록 - 단계나 제보 시각이 바뀔 때마다 서버별로 한 줄씩 쌓음
-- (d2runewizard 의 유저 제보 데이터를 Edge Function 이 1분마다 확인해서 저장. 게임 서버가 직접 주는 값이 아님)
--  tb_dclone_progress: 서버별 기록. 누구나 읽음, 쓰기는 service_role (Edge Function) 만
--  v_dclone_latest: 서버별 가장 최근 한 줄 (사이트·오버레이는 이걸 읽음)
-- 여러 번 실행해도 됨

create table if not exists public.tb_dclone_progress (
  id bigint generated always as identity primary key,
  server text not null,            -- d2runewizard 서버 이름 그대로 (예: 'ladderSoftcoreAsiaRotw')
  progress smallint not null check (progress between 1 and 6),
  reported_at timestamptz not null, -- 마지막 제보 시각 (d2runewizard lastUpdate)
  created_at timestamptz not null default now()
);
create index if not exists tb_dclone_progress_server_id on public.tb_dclone_progress (server, id desc);

alter table public.tb_dclone_progress enable row level security;
drop policy if exists dclone_progress_read on public.tb_dclone_progress;
create policy dclone_progress_read on public.tb_dclone_progress for select using (true);
grant select on public.tb_dclone_progress to anon, authenticated;

create or replace view public.v_dclone_latest as
  select distinct on (server) server, progress, reported_at
  from public.tb_dclone_progress
  order by server, id desc;
grant select on public.v_dclone_latest to anon, authenticated;
