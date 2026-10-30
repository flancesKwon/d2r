-- ============================================================
--  039 툴팁 캡쳐 읽기: 모델이 읽은 결과를 저장 (안 맞는 캡쳐를 운영진이 보고 고치려고)
--  - 이미지는 저장 안 함. 읽은 글자(JSON)만
--  - 운영진만 읽음. 다시 실행해도 안전
--  적용: Supabase SQL Editor 에 통째로 붙여 넣고 Run
-- ============================================================
alter table public.tb_tooltip_scan add column if not exists result jsonb;

drop policy if exists tb_tooltip_scan_select on public.tb_tooltip_scan;
create policy tb_tooltip_scan_select on public.tb_tooltip_scan
  for select to authenticated using (public.d2r_is_staff());

grant select on public.tb_tooltip_scan to authenticated;
