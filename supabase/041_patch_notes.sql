-- 041: 패치노트 등록 (운영진이 /admin/patch 에서 올리면 코드 배포 없이 /patch·메인에 바로 나옴)
--  - tb_patch_note: 누구나 읽음, 운영진만 올리고 고치고 지움
--  - sections 모양: [{ "heading": "...", "heading_en": "...", "items": [{ "ko": "...", "en": "..." }] }] (영어는 비워도 됨)
-- 여러 번 실행해도 됨

create table if not exists public.tb_patch_note (
  id         bigint generated always as identity primary key,
  version    text not null,
  note_date  date not null,
  title      text not null,
  title_en   text,
  tags       text[] not null default '{}',
  summary    text not null default '',
  summary_en text,
  sections   jsonb not null default '[]',
  created_at timestamptz not null default now()
);

alter table public.tb_patch_note enable row level security;
drop policy if exists patch_note_read on public.tb_patch_note;
create policy patch_note_read on public.tb_patch_note for select using (true);
drop policy if exists patch_note_staff_insert on public.tb_patch_note;
create policy patch_note_staff_insert on public.tb_patch_note for insert to authenticated with check (public.d2r_is_staff());
drop policy if exists patch_note_staff_update on public.tb_patch_note;
create policy patch_note_staff_update on public.tb_patch_note for update to authenticated using (public.d2r_is_staff()) with check (public.d2r_is_staff());
drop policy if exists patch_note_staff_delete on public.tb_patch_note;
create policy patch_note_staff_delete on public.tb_patch_note for delete to authenticated using (public.d2r_is_staff());
grant select on public.tb_patch_note to anon, authenticated;
grant insert, update, delete on public.tb_patch_note to authenticated;
