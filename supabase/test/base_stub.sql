-- 검사용 가짜 기본 스키마 - supabase/schema.sql 이 없을 때만 씀.
-- 실제 스키마에서 002 가 기대는 부분만 흉내냄: Supabase 역할(anon/authenticated), auth.uid(),
-- 테이블·컬럼 이름, "본인만 / 관리자는 남의 것도" 정책, "등급은 관리자만" 트리거
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
create schema auth;
grant usage on schema auth to anon, authenticated;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create table public.tb_profile (
  id uuid primary key,
  nickname text not null,
  contact text,
  avatar_url text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.tb_profile where id = auth.uid() and role = 'admin')
$$;
create function public.protect_role() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null and not public.is_admin() then
    raise exception 'role change denied' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger protect_role before update on public.tb_profile for each row execute function public.protect_role();
alter table public.tb_profile enable row level security;
create policy p_sel on public.tb_profile for select using (true);
create policy p_upd on public.tb_profile for update to authenticated using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());

create table public.tb_community_post (
  id bigint generated always as identity primary key,
  author_id uuid not null default auth.uid() references public.tb_profile(id),
  category text, title text not null, content text, views int default 0,
  created_at timestamptz default now(), updated_at timestamptz, deleted_at timestamptz
);
create table public.tb_community_comment (
  id bigint generated always as identity primary key,
  post_id bigint not null references public.tb_community_post(id) on delete cascade,
  author_id uuid not null default auth.uid() references public.tb_profile(id),
  content text not null, created_at timestamptz default now(), deleted_at timestamptz
);
create table public.tb_trade_post (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references public.tb_profile(id),
  item_name text not null, status text default '판매중',
  created_at timestamptz default now(), updated_at timestamptz, deleted_at timestamptz
);
create table public.tb_dm_message (
  id bigint generated always as identity primary key,
  sender_id uuid not null default auth.uid() references public.tb_profile(id),
  body text not null
);

do $$
declare t text;
begin
  foreach t in array array['tb_community_post', 'tb_community_comment', 'tb_trade_post'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy s on public.%I for select using (true)', t);
    execute format('create policy i on public.%I for insert to authenticated with check (author_id = auth.uid())', t);
    execute format('create policy u on public.%I for update to authenticated using (author_id = auth.uid() or public.is_admin())', t);
    execute format('create policy d on public.%I for delete to authenticated using (author_id = auth.uid() or public.is_admin())', t);
  end loop;
end $$;
alter table public.tb_dm_message enable row level security;
create policy i on public.tb_dm_message for insert to authenticated with check (sender_id = auth.uid());
create policy s on public.tb_dm_message for select to authenticated using (sender_id = auth.uid());

grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant usage on all sequences in schema public to anon, authenticated;
-- Supabase 는 새 테이블에도 anon/authenticated 권한이 자동으로 붙음 (002 가 tb_report 에서 anon 을 빼는지 확인용)
alter default privileges in schema public grant all on tables to anon, authenticated;
