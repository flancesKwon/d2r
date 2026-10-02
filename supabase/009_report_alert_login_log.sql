-- 디아허브 009: 새 신고 → 운영진 알림 · 로그인 기록
-- 002 다음 아무 때나 Supabase SQL Editor 에서 한 번 실행. 여러 번 돌려도 안전함.
-- 검사: supabase/test/run.sh

begin;

-- ─────────────────────────────────────────────
-- 1) 새 신고가 들어오면 운영진(moderator)·최고관리자(admin) 전원에게 알림
--    (신고 넣는 트리거 d2r_report_before_insert 는 그대로 두고 AFTER 트리거를 따로 붙임)
-- ─────────────────────────────────────────────
create or replace function public.d2r_report_notify_staff() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  kind text := case new.target_type
    when 'community_post' then '커뮤니티 글'
    when 'community_comment' then '댓글'
    when 'trade_post' then '판매글'
    when 'profile' then '회원'
    else new.target_type end;
begin
  insert into public.tb_notification (user_id, text, link)
  select p.id, '새 신고: ' || kind || ' "' || left(coalesce(new.target_label, ''), 40) || '"', '/admin'
    from public.tb_profile p
   where p.role::text in ('moderator', 'admin')
     and p.id is distinct from new.reporter_id;
  return new;
end $$;

drop trigger if exists d2r_report_notify_staff on public.tb_report;
create trigger d2r_report_notify_staff after insert on public.tb_report
  for each row execute function public.d2r_report_notify_staff();

revoke all on function public.d2r_report_notify_staff() from public, anon, authenticated;

-- ─────────────────────────────────────────────
-- 2) 로그인 기록 - Supabase 가 로그인할 때마다 auth.users.last_sign_in_at 을 바꾸는 걸 받아서 한 줄씩
--    (토큰 자동 갱신은 안 남음, 실제 로그인만). 브라우저가 직접 못 넣으니 조작 불가
--    사람마다 최근 100건만 남김
-- ─────────────────────────────────────────────
create table if not exists public.tb_login_log (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.tb_profile(id) on delete cascade,
  provider   text,
  created_at timestamptz not null default now()
);
create index if not exists tb_login_log_created_idx on public.tb_login_log (created_at desc);
create index if not exists tb_login_log_user_idx on public.tb_login_log (user_id, created_at desc);

create or replace function public.d2r_log_login() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.last_sign_in_at is not distinct from old.last_sign_in_at then
    return new;
  end if;
  -- 프로필이 아직 없으면(첫 가입 직후 순서 차이) 건너뜀
  if not exists (select 1 from public.tb_profile where id = new.id) then
    return new;
  end if;
  insert into public.tb_login_log (user_id, provider, created_at)
  values (new.id, new.raw_app_meta_data ->> 'provider', coalesce(new.last_sign_in_at, now()));
  delete from public.tb_login_log
   where user_id = new.id
     and id not in (select id from public.tb_login_log where user_id = new.id order by created_at desc limit 100);
  return new;
exception when others then
  return new; -- 기록 실패가 로그인을 막으면 안 됨
end $$;

drop trigger if exists d2r_log_login on auth.users;
create trigger d2r_log_login after update of last_sign_in_at on auth.users
  for each row execute function public.d2r_log_login();

revoke all on function public.d2r_log_login() from public, anon, authenticated;

alter table public.tb_login_log enable row level security;

-- 내 기록은 내가, 전체는 운영진이. 쓰기 정책은 없음 (트리거만 씀)
drop policy if exists tb_login_log_select on public.tb_login_log;
create policy tb_login_log_select on public.tb_login_log
  for select to authenticated
  using (user_id = auth.uid() or public.d2r_is_staff());

revoke all on public.tb_login_log from anon;
revoke insert, update, delete on public.tb_login_log from authenticated;
grant select on public.tb_login_log to authenticated;

commit;
