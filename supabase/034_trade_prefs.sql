-- 034: 거래 설정 저장 - 서버·게임(확장팩)·레더·하드코어를 계정별로 기억해서 다음 로그인 때 자동 적용
--  tb_trade_pref: 본인 한 줄만 읽고 씀. 여러 번 실행해도 됨

create table if not exists public.tb_trade_pref (
  user_id uuid primary key default auth.uid() references public.tb_profile(id) on delete cascade,
  prefs jsonb not null default '{}'::jsonb check (jsonb_typeof(prefs) = 'object' and pg_column_size(prefs) <= 500),
  updated_at timestamptz not null default now()
);

alter table public.tb_trade_pref enable row level security;

drop policy if exists tb_trade_pref_own on public.tb_trade_pref;
create policy tb_trade_pref_own on public.tb_trade_pref
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke all on public.tb_trade_pref from anon;
grant select, insert, update on public.tb_trade_pref to authenticated;
