-- 035: 방문 통계 상세 + 게시글 열람 기록 (운영진 전용으로만 읽음)
--  - 방문 기록에 로그인 회원 번호, IP 해시, 브라우저 종류(UA), 봇 여부를 같이 남김
--    IP 원문은 저장하지 않고 해시 앞 16자리만 저장 (같은 IP인지 비교용)
--  - 일별 방문자·회원·페이지뷰는 봇을 뺀 값, 봇은 따로 셈
--  - 게시글 열람 기록: 글마다 브라우저(회원이면 계정) 한 줄
--  - 400일 지난 기록은 가끔 지움
-- 여러 번 실행해도 됨

alter table public.tb_visit_daily
  add column if not exists user_id uuid,
  add column if not exists ip_hash text,
  add column if not exists ua      text,
  add column if not exists bot     boolean not null default false;

-- 요청 헤더에서 값 꺼내기
create or replace function public.d2r_req_header(p_name text)
returns text language plpgsql stable as $$
begin
  return nullif(coalesce(nullif(current_setting('request.headers', true), '')::json ->> p_name, ''), '');
exception when others then
  return null;
end $$;

create or replace function public.d2r_req_ip_hash()
returns text language plpgsql stable as $$
declare ip text := nullif(btrim(split_part(coalesce(public.d2r_req_header('x-forwarded-for'), ''), ',', 1)), '');
begin
  if ip is null then return null; end if;
  return left(encode(sha256(convert_to('d2r-visit:' || ip, 'utf8')), 'hex'), 16);
end $$;

create or replace function public.d2r_is_bot(p_ua text)
returns boolean language sql immutable as $$
  select p_ua is null or p_ua = '' or p_ua ~* '(bot|crawl|spider|slurp|preview|facebookexternalhit|headless|monitor|uptime|lighthouse|curl/|wget|python|node-fetch|axios|go-http|java/)'
$$;

create or replace function public.d2r_track(p_visitor text, p_ref text default null, p_path text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  d  date := (now() at time zone 'Asia/Seoul')::date;
  ua text := left(public.d2r_req_header('user-agent'), 160);
begin
  if p_visitor is null or char_length(p_visitor) not between 8 and 64 then return; end if;
  insert into public.tb_visit_daily (day, visitor, member, views, ref, first_path, user_id, ip_hash, ua, bot)
  values (d, p_visitor, auth.uid() is not null, 1, nullif(left(p_ref, 80), ''), left(p_path, 120),
          auth.uid(), public.d2r_req_ip_hash(), ua, public.d2r_is_bot(ua))
  on conflict (day, visitor) do update
    set views = least(public.tb_visit_daily.views + 1, 5000),
        member = public.tb_visit_daily.member or excluded.member,
        user_id = coalesce(excluded.user_id, public.tb_visit_daily.user_id);
  if random() < 0.002 then
    delete from public.tb_visit_daily where day < d - 400;
  end if;
end $$;
revoke all on function public.d2r_track(text, text, text) from public;
grant execute on function public.d2r_track(text, text, text) to anon, authenticated;

-- 일별: 방문자·그중 회원·페이지뷰·서로 다른 IP (봇 제외) + 봇 수
drop function if exists public.d2r_visit_stats(integer);
create function public.d2r_visit_stats(p_days integer default 30)
returns table (day date, visitors integer, members integer, views integer, ips integer, bots integer)
language plpgsql stable security definer set search_path = public as $$
declare d date := (now() at time zone 'Asia/Seoul')::date;
begin
  if not public.d2r_is_staff() then raise exception '운영진만' using errcode = '42501'; end if;
  return query
    select g.day::date,
           coalesce(count(v.visitor) filter (where not v.bot), 0)::integer,
           coalesce(count(v.visitor) filter (where not v.bot and v.member), 0)::integer,
           coalesce(sum(v.views) filter (where not v.bot), 0)::integer,
           coalesce(count(distinct v.ip_hash) filter (where not v.bot), 0)::integer,
           coalesce(count(v.visitor) filter (where v.bot), 0)::integer
      from generate_series(d - (least(greatest(p_days, 1), 400) - 1), d, interval '1 day') as g(day)
      left join public.tb_visit_daily v on v.day = g.day::date
     group by g.day order by g.day;
end $$;
revoke all on function public.d2r_visit_stats(integer) from public, anon;
grant execute on function public.d2r_visit_stats(integer) to authenticated;

-- 유입 사이트는 봇을 뺌
create or replace function public.d2r_visit_refs(p_days integer default 7)
returns table (ref text, visitors integer)
language plpgsql stable security definer set search_path = public as $$
declare d date := (now() at time zone 'Asia/Seoul')::date;
begin
  if not public.d2r_is_staff() then raise exception '운영진만' using errcode = '42501'; end if;
  return query
    select v.ref, count(*)::integer from public.tb_visit_daily v
     where v.day > d - least(greatest(p_days, 1), 400) and not v.bot
     group by v.ref order by count(*) desc limit 20;
end $$;
revoke all on function public.d2r_visit_refs(integer) from public, anon;
grant execute on function public.d2r_visit_refs(integer) to authenticated;

-- 하루치 방문자 목록 (봇 포함, 최대 500줄)
create or replace function public.d2r_visit_list(p_day date default null)
returns table (visitor text, user_id uuid, nickname text, ip_hash text, ua text, bot boolean, ref text, first_path text, views integer, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.d2r_is_staff() then raise exception '운영진만' using errcode = '42501'; end if;
  return query
    select left(v.visitor, 8), v.user_id, p.nickname, v.ip_hash, v.ua, v.bot, v.ref, v.first_path, v.views, v.created_at
      from public.tb_visit_daily v
      left join public.tb_profile p on p.id = v.user_id
     where v.day = coalesce(p_day, (now() at time zone 'Asia/Seoul')::date)
     order by v.created_at desc limit 500;
end $$;
revoke all on function public.d2r_visit_list(date) from public, anon;
grant execute on function public.d2r_visit_list(date) to authenticated;

-- 게시글 열람 기록 (글마다 브라우저 한 줄, 회원이면 계정도)
create table if not exists public.tb_post_view (
  post_id  bigint not null,
  visitor  text   not null check (char_length(visitor) between 8 and 64),
  user_id  uuid,
  ip_hash  text,
  ua       text,
  bot      boolean not null default false,
  views    integer not null default 1,
  first_at timestamptz not null default now(),
  last_at  timestamptz not null default now(),
  primary key (post_id, visitor)
);
alter table public.tb_post_view enable row level security;
revoke all on public.tb_post_view from anon, authenticated;

create or replace function public.d2r_track_post_view(p_post_id bigint, p_visitor text)
returns void language plpgsql security definer set search_path = public as $$
declare ua text := left(public.d2r_req_header('user-agent'), 160);
begin
  if p_post_id is null or p_visitor is null or char_length(p_visitor) not between 8 and 64 then return; end if;
  insert into public.tb_post_view (post_id, visitor, user_id, ip_hash, ua, bot)
  values (p_post_id, p_visitor, auth.uid(), public.d2r_req_ip_hash(), ua, public.d2r_is_bot(ua))
  on conflict (post_id, visitor) do update
    set views = least(public.tb_post_view.views + 1, 5000),
        last_at = now(),
        user_id = coalesce(excluded.user_id, public.tb_post_view.user_id);
  if random() < 0.002 then
    delete from public.tb_post_view where last_at < now() - interval '400 days';
  end if;
end $$;
revoke all on function public.d2r_track_post_view(bigint, text) from public;
grant execute on function public.d2r_track_post_view(bigint, text) to anon, authenticated;

-- 글 하나의 열람 목록 (운영진만, 최대 500줄)
create or replace function public.d2r_post_viewers(p_post_id bigint)
returns table (visitor text, user_id uuid, nickname text, ip_hash text, ua text, bot boolean, views integer, first_at timestamptz, last_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.d2r_is_staff() then raise exception '운영진만' using errcode = '42501'; end if;
  return query
    select left(v.visitor, 8), v.user_id, p.nickname, v.ip_hash, v.ua, v.bot, v.views, v.first_at, v.last_at
      from public.tb_post_view v
      left join public.tb_profile p on p.id = v.user_id
     where v.post_id = p_post_id
     order by v.last_at desc limit 500;
end $$;
revoke all on function public.d2r_post_viewers(bigint) from public, anon;
grant execute on function public.d2r_post_viewers(bigint) to authenticated;
