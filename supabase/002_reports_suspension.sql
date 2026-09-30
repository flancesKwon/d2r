-- 디아허브 002: 신고 · 이용 정지 · 운영진 등급
-- schema.sql(1~6단계) 뒤에 Supabase SQL Editor 에서 통째로 한 번 실행. 여러 번 돌려도 안전함.
-- 기존 테이블·정책은 건드리지 않고 덧붙이기만 함:
--   - 권한을 "넓히는" 건 permissive 정책 추가 (기존 정책과 OR)
--   - 정지된 사람을 "막는" 건 restrictive 정책 추가 (기존 정책과 AND)
-- 검사: supabase/test/run.sh

begin;

-- ─────────────────────────────────────────────
-- 1) 등급 3단계: user(일반) / moderator(운영진) / admin(최고관리자)
--    role 이 CHECK 제약이든 enum 이든 moderator 를 받을 수 있게
-- ─────────────────────────────────────────────
do $$
declare
  typ oid;
  r record;
begin
  select a.atttypid into typ from pg_attribute a
   where a.attrelid = 'public.tb_profile'::regclass and a.attname = 'role' and not a.attisdropped;
  if typ is null then
    raise exception 'tb_profile.role 컬럼이 없어요 - schema.sql 먼저 실행';
  end if;
  if (select typtype from pg_type where oid = typ) = 'e' then
    execute format('alter type %s add value if not exists %L', typ::regtype, 'moderator');
  else
    for r in select conname from pg_constraint
              where conrelid = 'public.tb_profile'::regclass and contype = 'c'
                and pg_get_constraintdef(oid) ~* '\mrole\M' loop
      execute format('alter table public.tb_profile drop constraint %I', r.conname);
    end loop;
    alter table public.tb_profile add constraint tb_profile_role_check
      check (role in ('user', 'moderator', 'admin'));
  end if;
end $$;

-- ─────────────────────────────────────────────
-- 2) 이용 정지 - suspended_until 이 지금보다 뒤면 정지 중 ('infinity' = 영구)
-- ─────────────────────────────────────────────
alter table public.tb_profile
  add column if not exists suspended_until timestamptz,
  add column if not exists suspended_reason text;

do $$ begin
  alter table public.tb_profile add constraint tb_profile_suspended_reason_len check (char_length(suspended_reason) <= 200);
exception when duplicate_object then null;
end $$;

-- 내 등급 / 운영진 여부 / 정지 여부. security definer 라서 RLS 정책 안에서 tb_profile 을 다시 읽어도 재귀 안 걸림
create or replace function public.d2r_my_role() returns text
language sql stable security definer set search_path = public as $$
  select role::text from public.tb_profile where id = auth.uid()
$$;

create or replace function public.d2r_is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.d2r_my_role() in ('moderator', 'admin'), false)
$$;

create or replace function public.d2r_is_active() returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (
    select 1 from public.tb_profile where id = auth.uid() and suspended_until > now()
  )
$$;

-- 프로필 수정 규칙 (기존 "등급은 관리자만" 트리거와 따로 돎)
--  - 정지 칸은 운영진만. 운영진·관리자를 정지하는 건 최고관리자만. 본인 정지/해제는 불가
--  - 운영진은 남의 프로필에서 정지 칸 말고는 못 바꿈
create or replace function public.d2r_guard_profile() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  actor text := public.d2r_my_role();
  other_cols_changed boolean;
begin
  if auth.uid() is null then
    return new; -- SQL Editor / service_role
  end if;

  if new.suspended_until is distinct from old.suspended_until
     or new.suspended_reason is distinct from old.suspended_reason then
    if coalesce(actor, 'user') not in ('moderator', 'admin') then
      raise exception '이용 정지는 운영진만 바꿀 수 있어요' using errcode = '42501';
    end if;
    if new.id = auth.uid() then
      raise exception '본인은 정지하거나 해제할 수 없어요' using errcode = '42501';
    end if;
    if old.role::text in ('moderator', 'admin') and actor <> 'admin' then
      raise exception '운영진·관리자는 최고관리자만 정지할 수 있어요' using errcode = '42501';
    end if;
  end if;

  if new.id <> auth.uid() and actor = 'moderator' then
    other_cols_changed :=
      (to_jsonb(new) - 'suspended_until' - 'suspended_reason' - 'updated_at')
      is distinct from
      (to_jsonb(old) - 'suspended_until' - 'suspended_reason' - 'updated_at');
    if other_cols_changed then
      raise exception '운영진은 다른 회원의 정지 여부만 바꿀 수 있어요' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists d2r_guard_profile on public.tb_profile;
create trigger d2r_guard_profile before update on public.tb_profile
  for each row execute function public.d2r_guard_profile();

-- 운영진도 남의 프로필 UPDATE 가 되게 (무엇을 바꿀 수 있는지는 위 트리거가 제한)
drop policy if exists d2r_staff_update_profile on public.tb_profile;
create policy d2r_staff_update_profile on public.tb_profile
  for update to authenticated
  using (public.d2r_is_staff()) with check (public.d2r_is_staff());

-- ─────────────────────────────────────────────
-- 3) 신고 테이블
-- ─────────────────────────────────────────────
create table if not exists public.tb_report (
  id               bigint generated always as identity primary key,
  reporter_id      uuid not null default auth.uid() references public.tb_profile(id) on delete cascade,
  target_type      text not null check (target_type in ('community_post', 'community_comment', 'trade_post', 'profile')),
  target_id        text not null check (char_length(target_id) between 1 and 64),
  -- 아래 두 칸은 트리거가 채움 (클라이언트 값 무시). 글이 지워져도 무엇을 신고했는지 남게
  target_label     text,
  target_author_id uuid references public.tb_profile(id) on delete set null,
  target_post_id   text, -- 댓글 신고일 때 그 댓글이 달린 글 (바로가기용)
  reason           text not null check (reason in ('spam', 'abuse', 'scam', 'flood', 'etc')),
  detail           text check (char_length(detail) <= 500),
  status           text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  handled_by       uuid references public.tb_profile(id) on delete set null,
  handled_at       timestamptz,
  created_at       timestamptz not null default now(),
  unique (reporter_id, target_type, target_id)
);
create index if not exists tb_report_status_created_idx on public.tb_report (status, created_at desc);

-- 신고 넣을 때: 신고자·상태를 서버가 정하고, 대상이 실제로 있는지 확인하면서 제목·작성자를 채움
create or replace function public.d2r_report_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then
    new.reporter_id := auth.uid();
  end if;
  new.status := 'open';
  new.handled_by := null;
  new.handled_at := null;
  new.target_post_id := null;

  if new.target_type = 'community_post' then
    select left(title, 200), author_id into new.target_label, new.target_author_id
      from public.tb_community_post where id::text = new.target_id;
  elsif new.target_type = 'community_comment' then
    select left(content, 200), author_id, post_id::text into new.target_label, new.target_author_id, new.target_post_id
      from public.tb_community_comment where id::text = new.target_id;
  elsif new.target_type = 'trade_post' then
    select left(item_name, 200), author_id into new.target_label, new.target_author_id
      from public.tb_trade_post where id::text = new.target_id;
  elsif new.target_type = 'profile' then
    select left(nickname, 200), id into new.target_label, new.target_author_id
      from public.tb_profile where id::text = new.target_id;
  end if;

  if new.target_author_id is null then
    raise exception '신고할 대상을 찾을 수 없어요' using errcode = 'P0002';
  end if;
  if new.target_author_id = new.reporter_id then
    raise exception '내 글은 신고할 수 없어요' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists d2r_report_before_insert on public.tb_report;
create trigger d2r_report_before_insert before insert on public.tb_report
  for each row execute function public.d2r_report_before_insert();

-- 신고 처리할 때: 상태만 바꿀 수 있고, 처리한 사람·시간은 서버가 찍음
create or replace function public.d2r_report_before_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (to_jsonb(new) - 'status' - 'handled_by' - 'handled_at')
     is distinct from (to_jsonb(old) - 'status' - 'handled_by' - 'handled_at') then
    raise exception '신고는 처리 상태만 바꿀 수 있어요' using errcode = '42501';
  end if;
  if new.status is distinct from old.status then
    new.handled_by := case when new.status = 'open' then null else auth.uid() end;
    new.handled_at := case when new.status = 'open' then null else now() end;
  else
    new.handled_by := old.handled_by;
    new.handled_at := old.handled_at;
  end if;
  return new;
end $$;

drop trigger if exists d2r_report_before_update on public.tb_report;
create trigger d2r_report_before_update before update on public.tb_report
  for each row execute function public.d2r_report_before_update();

alter table public.tb_report enable row level security;

drop policy if exists tb_report_select on public.tb_report;
create policy tb_report_select on public.tb_report
  for select to authenticated
  using (reporter_id = auth.uid() or public.d2r_is_staff());

drop policy if exists tb_report_insert on public.tb_report;
create policy tb_report_insert on public.tb_report
  for insert to authenticated
  with check (reporter_id = auth.uid());

drop policy if exists tb_report_update on public.tb_report;
create policy tb_report_update on public.tb_report
  for update to authenticated
  using (public.d2r_is_staff()) with check (public.d2r_is_staff());

drop policy if exists tb_report_delete on public.tb_report;
create policy tb_report_delete on public.tb_report
  for delete to authenticated
  using (public.d2r_my_role() = 'admin');

revoke all on public.tb_report from anon;
grant select, insert, update, delete on public.tb_report to authenticated;

-- ─────────────────────────────────────────────
-- 4) 정지된 사람은 글·댓글·거래·쪽지·신고를 새로 못 씀 (restrictive = 기존 정책과 AND)
--    추천·찜·읽기는 그대로
-- ─────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'tb_community_post', 'tb_community_comment', 'tb_trade_post', 'tb_trade_request',
    'tb_trade_deal_message', 'tb_trade_deal_review', 'tb_dm_message', 'tb_report'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists d2r_active_insert on public.%I', t);
      execute format('create policy d2r_active_insert on public.%I as restrictive for insert to authenticated with check (public.d2r_is_active())', t);
    end if;
  end loop;
  foreach t in array array['tb_community_post', 'tb_community_comment', 'tb_trade_post'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists d2r_active_update on public.%I', t);
      execute format('create policy d2r_active_update on public.%I as restrictive for update to authenticated using (public.d2r_is_active() or public.d2r_is_staff())', t);
    end if;
  end loop;
end $$;

-- ─────────────────────────────────────────────
-- 5) 운영진도 글·댓글·판매글 삭제 가능 (관리자는 기존 정책으로 이미 가능)
-- ─────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['tb_community_post', 'tb_community_comment', 'tb_trade_post'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists d2r_staff_delete on public.%I', t);
      execute format('create policy d2r_staff_delete on public.%I for delete to authenticated using (public.d2r_is_staff())', t);
    end if;
  end loop;
end $$;

revoke all on function public.d2r_guard_profile() from public, anon, authenticated;
revoke all on function public.d2r_report_before_insert() from public, anon, authenticated;
revoke all on function public.d2r_report_before_update() from public, anon, authenticated;
grant execute on function public.d2r_my_role(), public.d2r_is_staff(), public.d2r_is_active() to anon, authenticated;

commit;
