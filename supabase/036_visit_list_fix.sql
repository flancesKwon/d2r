-- 036: 035 의 방문자 목록·열람 목록 고침 - 닉네임이 citext 라서 text 로 맞춤
-- 여러 번 실행해도 됨

create or replace function public.d2r_visit_list(p_day date default null)
returns table (visitor text, user_id uuid, nickname text, ip_hash text, ua text, bot boolean, ref text, first_path text, views integer, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.d2r_is_staff() then raise exception '운영진만' using errcode = '42501'; end if;
  return query
    select left(v.visitor, 8), v.user_id, p.nickname::text, v.ip_hash, v.ua, v.bot, v.ref, v.first_path, v.views, v.created_at
      from public.tb_visit_daily v
      left join public.tb_profile p on p.id = v.user_id
     where v.day = coalesce(p_day, (now() at time zone 'Asia/Seoul')::date)
     order by v.created_at desc limit 500;
end $$;
revoke all on function public.d2r_visit_list(date) from public, anon;
grant execute on function public.d2r_visit_list(date) to authenticated;

create or replace function public.d2r_post_viewers(p_post_id bigint)
returns table (visitor text, user_id uuid, nickname text, ip_hash text, ua text, bot boolean, views integer, first_at timestamptz, last_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.d2r_is_staff() then raise exception '운영진만' using errcode = '42501'; end if;
  return query
    select left(v.visitor, 8), v.user_id, p.nickname::text, v.ip_hash, v.ua, v.bot, v.views, v.first_at, v.last_at
      from public.tb_post_view v
      left join public.tb_profile p on p.id = v.user_id
     where v.post_id = p_post_id
     order by v.last_at desc limit 500;
end $$;
revoke all on function public.d2r_post_viewers(bigint) from public, anon;
grant execute on function public.d2r_post_viewers(bigint) to authenticated;
