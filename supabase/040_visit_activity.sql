-- 040: 방문자·회원별 활동 보기 (운영진 전용으로만 읽음)
--  - 방문 기록에 그날 본 페이지 목록(paths, 처음 40개)과 마지막 접속 시각(last_at)을 같이 남김
--  - d2r_visitor_history: 한 회원 또는 한 비회원 브라우저의 날짜별 방문 기록 (본 페이지 포함)
--  - d2r_member_activity: 회원별 마지막 로그인(auth)·마지막 접속·접속일수·페이지뷰
--  - 이 SQL 을 실행한 뒤의 방문부터 본 페이지가 쌓임 (이전 기록은 처음 들어온 페이지만 있음)
-- 여러 번 실행해도 됨

alter table public.tb_visit_daily
  add column if not exists paths   text[] not null default '{}',
  add column if not exists last_at timestamptz;

create or replace function public.d2r_track(p_visitor text, p_ref text default null, p_path text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  d  date := (now() at time zone 'Asia/Seoul')::date;
  ua text := left(public.d2r_req_header('user-agent'), 160);
begin
  if p_visitor is null or char_length(p_visitor) not between 8 and 64 then return; end if;
  insert into public.tb_visit_daily (day, visitor, member, views, ref, first_path, user_id, ip_hash, ua, bot, paths, last_at)
  values (d, p_visitor, auth.uid() is not null, 1, nullif(left(p_ref, 80), ''), left(p_path, 120),
          auth.uid(), public.d2r_req_ip_hash(), ua, public.d2r_is_bot(ua),
          case when p_path is null then '{}' else array[left(p_path, 120)] end, now())
  on conflict (day, visitor) do update
    set views = least(public.tb_visit_daily.views + 1, 5000),
        member = public.tb_visit_daily.member or excluded.member,
        user_id = coalesce(excluded.user_id, public.tb_visit_daily.user_id),
        paths = case when p_path is null or cardinality(public.tb_visit_daily.paths) >= 40
                     then public.tb_visit_daily.paths
                     else array_append(public.tb_visit_daily.paths, left(p_path, 120)) end,
        last_at = now();
  if random() < 0.002 then
    delete from public.tb_visit_daily where day < d - 400;
  end if;
end $$;
revoke all on function public.d2r_track(text, text, text) from public;
grant execute on function public.d2r_track(text, text, text) to anon, authenticated;

-- 하루치 방문자 목록 (봇 포함, 최대 500줄) - 본 페이지·마지막 접속 추가
drop function if exists public.d2r_visit_list(date);
create function public.d2r_visit_list(p_day date default null)
returns table (visitor text, user_id uuid, nickname text, ip_hash text, ua text, bot boolean, ref text, first_path text, views integer, created_at timestamptz, paths text[], last_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.d2r_is_staff() then raise exception '운영진만' using errcode = '42501'; end if;
  return query
    select left(v.visitor, 8), v.user_id, p.nickname::text, v.ip_hash, v.ua, v.bot, v.ref, v.first_path, v.views, v.created_at, v.paths, v.last_at
      from public.tb_visit_daily v
      left join public.tb_profile p on p.id = v.user_id
     where v.day = coalesce(p_day, (now() at time zone 'Asia/Seoul')::date)
     order by coalesce(v.last_at, v.created_at) desc limit 500;
end $$;
revoke all on function public.d2r_visit_list(date) from public, anon;
grant execute on function public.d2r_visit_list(date) to authenticated;

-- 한 회원(p_user) 또는 한 비회원 브라우저(p_visitor = 번호 앞 8자리)의 날짜별 방문 기록 (최근 200일)
create or replace function public.d2r_visitor_history(p_user uuid default null, p_visitor text default null)
returns table (day date, views integer, ref text, first_path text, paths text[], ua text, ip_hash text, bot boolean, created_at timestamptz, last_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.d2r_is_staff() then raise exception '운영진만' using errcode = '42501'; end if;
  return query
    select v.day, v.views, v.ref, v.first_path, v.paths, v.ua, v.ip_hash, v.bot, v.created_at, v.last_at
      from public.tb_visit_daily v
     where (p_user is not null and v.user_id = p_user)
        or (p_user is null and p_visitor is not null and left(v.visitor, 8) = p_visitor)
     order by v.day desc, v.created_at desc limit 200;
end $$;
revoke all on function public.d2r_visitor_history(uuid, text) from public, anon;
grant execute on function public.d2r_visitor_history(uuid, text) to authenticated;

-- 회원별 활동 요약: 마지막 로그인(로그인 화면으로 들어온 시각, 자동 로그인 유지는 안 바뀜)·마지막 접속·접속일수·페이지뷰
create or replace function public.d2r_member_activity(p_ids uuid[])
returns table (user_id uuid, last_login timestamptz, last_seen timestamptz, visit_days integer, total_views integer)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.d2r_is_staff() then raise exception '운영진만' using errcode = '42501'; end if;
  return query
    select i.id, u.last_sign_in_at,
           max(coalesce(v.last_at, v.created_at)),
           count(v.day)::integer,
           coalesce(sum(v.views), 0)::integer
      from unnest(p_ids) as i(id)
      left join auth.users u on u.id = i.id
      left join public.tb_visit_daily v on v.user_id = i.id
     group by i.id, u.last_sign_in_at;
end $$;
revoke all on function public.d2r_member_activity(uuid[]) from public, anon;
grant execute on function public.d2r_member_activity(uuid[]) to authenticated;
