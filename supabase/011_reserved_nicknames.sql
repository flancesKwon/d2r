-- 011: 운영진 사칭 닉네임 막기
--  - 관리자·운영자·운영진·디아허브·admin 같은 말이 들어간 닉네임은 일반 회원이 못 씀 (운영진은 가능)
--  - 띄어쓰기·특수문자·대소문자를 빼고, 숫자로 바꿔 쓴 글자(adm1n, 0 -> o 등)도 되돌려서 검사
--  - 가입할 때 디스코드·구글 이름이 이런 말이면 가입은 막지 않고 "회원1234" 같은 이름으로 바꿈
-- 여러 번 실행해도 됨

create or replace function public.d2r_nickname_reserved(p_nick text)
returns boolean language sql immutable set search_path = public as $$
  with n as (
    select regexp_replace(lower(coalesce(p_nick, '')), '[^a-z0-9가-힣]', '', 'g') as a
  ), m as (
    -- 숫자·기호로 바꿔 쓴 글자 되돌리기 (1 -> i, 0 -> o, 3 -> e, 4 -> a, 5 -> s, 7 -> t)
    select a, translate(a, '103457', 'ioeast') as b from n
  )
  select exists (
    select 1 from m, unnest(array[
      '관리자', '관리인', '관리팀', '운영자', '운영진', '운영팀', '운영위원',
      '디아허브', '공식계정', '고객센터', '블리자드', '시스템관리',
      'admin', 'administrator', 'moderator', 'staff', 'diahub', 'blizzard', 'official', 'sysop'
    ]) as w
    where position(w in m.a) > 0 or position(w in m.b) > 0
  )
$$;
grant execute on function public.d2r_nickname_reserved(text) to anon, authenticated;

create or replace function public.d2r_guard_nickname() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  alt text;
begin
  if tg_op = 'UPDATE' and new.nickname is not distinct from old.nickname then return new; end if;
  if not public.d2r_nickname_reserved(new.nickname) then return new; end if;
  -- 운영진은 써도 됨 (가입 직후엔 아직 운영진일 수 없음)
  if tg_op = 'UPDATE' and old.role in ('moderator', 'admin') then return new; end if;
  -- 회원이 직접 바꾸는 경우는 막음
  if auth.uid() is not null then
    raise exception '사용할 수 없는 닉네임 (운영진 사칭 방지)' using errcode = 'P0001', hint = 'reserved_nickname';
  end if;
  -- 가입(로그인 트리거)·SQL Editor 에서 들어온 이름은 바꿔서 통과
  loop
    alt := '회원' || (1000 + floor(random() * 9000))::int;
    exit when not exists (select 1 from public.tb_profile where nickname = alt);
  end loop;
  new.nickname := alt;
  return new;
end $$;

drop trigger if exists trg_guard_nickname on public.tb_profile;
create trigger trg_guard_nickname before insert or update of nickname on public.tb_profile
for each row execute function public.d2r_guard_nickname();
