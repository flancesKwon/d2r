-- 032: 피드백(버그·개선 제보) - 로그인한 회원이 보내고, 운영진이 관리자 화면에서 봄
--  tb_feedback: 보낸 사람 본인 + 운영진만 읽음, 상태 변경은 운영진, 삭제는 최고관리자
-- 도배 방지: 1시간에 10건. 여러 번 실행해도 됨

create table if not exists public.tb_feedback (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.tb_profile(id) on delete cascade,
  kind text not null check (kind in ('bug', 'idea', 'etc')),
  content text not null check (char_length(content) between 5 and 1000),
  page text check (char_length(page) <= 300),
  status text not null default 'open' check (status in ('open', 'done')),
  created_at timestamptz not null default now()
);
create index if not exists tb_feedback_status_created_idx on public.tb_feedback (status, created_at desc);

alter table public.tb_feedback enable row level security;

drop policy if exists tb_feedback_select on public.tb_feedback;
create policy tb_feedback_select on public.tb_feedback
  for select to authenticated using (user_id = auth.uid() or public.d2r_is_staff());

drop policy if exists tb_feedback_insert on public.tb_feedback;
create policy tb_feedback_insert on public.tb_feedback
  for insert to authenticated with check (user_id = auth.uid() and public.d2r_is_active());

drop policy if exists tb_feedback_update on public.tb_feedback;
create policy tb_feedback_update on public.tb_feedback
  for update to authenticated using (public.d2r_is_staff()) with check (public.d2r_is_staff());

drop policy if exists tb_feedback_delete on public.tb_feedback;
create policy tb_feedback_delete on public.tb_feedback
  for delete to authenticated using (public.d2r_my_role() = 'admin');

revoke all on public.tb_feedback from anon;
grant select, insert, update, delete on public.tb_feedback to authenticated;

create or replace function public.d2r_feedback_rate() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.d2r_is_staff() then
    return new;
  end if;
  perform public.d2r_check_rate('tb_feedback', interval '1 hour', 10);
  insert into public.tb_rate_log (user_id, kind) values (auth.uid(), 'tb_feedback');
  return new;
end $$;
revoke all on function public.d2r_feedback_rate() from public, anon, authenticated;

drop trigger if exists trg_feedback_rate on public.tb_feedback;
create trigger trg_feedback_rate before insert on public.tb_feedback
  for each row execute function public.d2r_feedback_rate();
