-- ============================================================
--  038 툴팁 캡쳐로 판매글 채우기: 사용 기록 (하루 횟수 제한용)
--  - Edge Function read-tooltip 이 service_role 로만 읽고 씀 (RLS 켜고 정책 없음)
--  - 다시 실행해도 안전
--  적용: Supabase SQL Editor 에 통째로 붙여 넣고 Run
-- ============================================================
create table if not exists public.tb_tooltip_scan (
  id         bigserial primary key,
  user_id    uuid not null,
  created_at timestamptz not null default now()
);
create index if not exists tb_tooltip_scan_user_idx on public.tb_tooltip_scan (user_id, created_at);
alter table public.tb_tooltip_scan enable row level security;
revoke all on public.tb_tooltip_scan from anon, authenticated;
