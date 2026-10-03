-- 013: 방문 통계 (관리자 /admin/stats)
--  - 브라우저마다 만든 임의 번호(visitor)로 하루 한 줄: 그날 본 페이지 수, 로그인 회원인지, 처음 들어온 곳(유입 사이트 주소만)
--  - IP·개인정보는 저장 안 함. 날짜는 한국 시간 기준
--  - 쓰기는 d2r_track 함수로만 (누구나), 읽기는 운영진만 (d2r_visit_stats·d2r_visit_refs)
--  - 400일 지난 기록은 가끔 지움
-- 여러 번 실행해도 됨

create table if not exists public.tb_visit_daily (
  day        date not null,
  visitor    text not null check (char_length(visitor) between 8 and 64),
  member     boolean not null default false,
  views      integer not null default 1,
  ref        text check (char_length(ref) <= 80),
  first_path text check (char_length(first_path) <= 120),
  created_at timestamptz not null default now(),
  primary key (day, visitor)
);
alter table public.tb_visit_daily enable row level security;
revoke all on public.tb_visit_daily from anon, authenticated;

create or replace function public.d2r_track(p_visitor text, p_ref text default null, p_path text default null)
returns void language plpgsql security definer set search_path = public as $$
declare d date := (now() at time zone 'Asia/Seoul')::date;
begin
  if p_visitor is null or char_length(p_visitor) not between 8 and 64 then return; end if;
  insert into public.tb_visit_daily (day, visitor, member, views, ref, first_path)
  values (d, p_visitor, auth.uid() is not null, 1, nullif(left(p_ref, 80), ''), left(p_path, 120))
  on conflict (day, visitor) do update
    set views = least(public.tb_visit_daily.views + 1, 5000),
        member = public.tb_visit_daily.member or excluded.member;
  if random() < 0.002 then
    delete from public.tb_visit_daily where day < d - 400;
  end if;
end $$;
revoke all on function public.d2r_track(text, text, text) from public;
grant execute on function public.d2r_track(text, text, text) to anon, authenticated;

-- 일별: 방문자·그중 회원·페이지뷰 (최근 p_days 일, 오늘 포함, 방문 없는 날도 0 으로)
create or replace function public.d2r_visit_stats(p_days integer default 30)
returns table (day date, visitors integer, members integer, views integer)
language plpgsql stable security definer set search_path = public as $$
declare d date := (now() at time zone 'Asia/Seoul')::date;
begin
  if not public.d2r_is_staff() then raise exception '운영진만' using errcode = '42501'; end if;
  return query
    select g.day::date,
           coalesce(count(v.visitor), 0)::integer,
           coalesce(count(v.visitor) filter (where v.member), 0)::integer,
           coalesce(sum(v.views), 0)::integer
      from generate_series(d - (least(greatest(p_days, 1), 400) - 1), d, interval '1 day') as g(day)
      left join public.tb_visit_daily v on v.day = g.day::date
     group by g.day order by g.day;
end $$;

-- 유입 사이트 (최근 p_days 일, 처음 들어온 곳 기준, 바로 들어온 건 null)
create or replace function public.d2r_visit_refs(p_days integer default 7)
returns table (ref text, visitors integer)
language plpgsql stable security definer set search_path = public as $$
declare d date := (now() at time zone 'Asia/Seoul')::date;
begin
  if not public.d2r_is_staff() then raise exception '운영진만' using errcode = '42501'; end if;
  return query
    select v.ref, count(*)::integer from public.tb_visit_daily v
     where v.day > d - least(greatest(p_days, 1), 400)
     group by v.ref order by count(*) desc limit 20;
end $$;

revoke all on function public.d2r_visit_stats(integer), public.d2r_visit_refs(integer) from public, anon;
grant execute on function public.d2r_visit_stats(integer), public.d2r_visit_refs(integer) to authenticated;
