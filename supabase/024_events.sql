-- 024: 매물 등록 이벤트 - 응모 자동 기록 + 공개 난수(drand)로 추첨
--  1) tb_event: 제목·기간·1인 최대 응모권·상품·추첨 시각(draw_at)·drand 라운드·결과. 누구나 읽음, 운영진만 만들고 고침
--  2) tb_event_entry: 이벤트 시간에 판매글을 올리면 DB가 자동으로 응모권 1장 기록 (1인 최대 ticket_cap 장)
--     자동으로 안 쌓는 글: 운영진 글, 골드, 코 룬 미만 룬, 최상급이 아닌 보석, 같은 사람이 같은 아이템을 또 올린 글
--     추첨 시각 전에 글을 지우면 그 응모권은 제외. 운영진은 추첨 시각 전까지만 잡템·허위 매물을 제외할 수 있음
--     추첨 시각이 지나면 목록은 고정 (누구도 못 바꿈) - 그 다음에 나오는 공개 난수로 뽑으니 미리 손댈 수 없음
--  3) 추첨: d2r_event_draw(event_id, randomness) - drand 라운드 값(누구도 미리 모르는 공개 난수)으로 DB가 직접 뽑음
--     응모권 목록(번호 순) × SHA-256(난수:등수) → 당첨 번호. 한 사람은 상품 하나. 같은 계산을 누구나 다시 해볼 수 있음
-- 002 다음에 실행. 여러 번 실행해도 됨

create table if not exists public.tb_event (
  id bigint generated always as identity primary key,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  draw_at timestamptz not null,                -- 이 시각 이후의 drand 라운드로 추첨 (그 전까지 운영진 검토)
  drand_round bigint not null,                 -- draw_at 에 나오는 drand 라운드 번호 (만들 때 정해서 공개)
  ticket_cap int not null default 5 check (ticket_cap between 1 and 100),
  prizes jsonb not null default '[]'::jsonb,   -- [{ "rank": 1, "label": "1등", "item": "자 룬 + 베르 룬" }, ...]
  rules text,
  result jsonb,                                -- { randomness, round, tickets_total, winners: [...], entries: [...], drawn_at }
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  constraint d2r_event_period check (ends_at > starts_at and draw_at >= ends_at)
);

create table if not exists public.tb_event_entry (
  id bigint generated always as identity primary key,
  event_id bigint not null references public.tb_event(id) on delete cascade,
  user_id uuid not null,
  post_id uuid not null,
  nickname text not null default '',
  item_name text not null default '',
  category text,
  excluded boolean not null default false,
  excluded_reason text,
  created_at timestamptz not null default now(),
  unique (event_id, post_id)
);
create index if not exists event_entry_event on public.tb_event_entry (event_id, id);

alter table public.tb_event enable row level security;
alter table public.tb_event_entry enable row level security;
drop policy if exists event_read on public.tb_event;
create policy event_read on public.tb_event for select using (true);
drop policy if exists event_staff_insert on public.tb_event;
create policy event_staff_insert on public.tb_event for insert to authenticated with check (public.d2r_is_staff());
drop policy if exists event_staff_update on public.tb_event;
create policy event_staff_update on public.tb_event for update to authenticated using (public.d2r_is_staff()) with check (public.d2r_is_staff());
drop policy if exists event_staff_delete on public.tb_event;
create policy event_staff_delete on public.tb_event for delete to authenticated using (public.d2r_is_staff() and result is null);
drop policy if exists event_entry_read on public.tb_event_entry;
create policy event_entry_read on public.tb_event_entry for select using (true);
drop policy if exists event_entry_staff_update on public.tb_event_entry;
create policy event_entry_staff_update on public.tb_event_entry for update to authenticated using (public.d2r_is_staff()) with check (public.d2r_is_staff());
grant select on public.tb_event, public.tb_event_entry to anon, authenticated;
grant insert, update, delete on public.tb_event to authenticated;
grant update (excluded, excluded_reason) on public.tb_event_entry to authenticated;

-- 이벤트 보호: 결과는 추첨 함수로만, 시작한 이벤트는 기간·응모권 수·추첨 시각을 못 바꿈 (진행 중 규칙 변경 방지)
create or replace function public.d2r_event_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if current_setting('d2r.event_draw', true) = '1' then return new; end if;
  if new.result is distinct from old.result then
    raise exception '추첨 결과는 추첨으로만 저장' using errcode = '42501';
  end if;
  if old.starts_at <= now() and (new.starts_at is distinct from old.starts_at or new.ends_at is distinct from old.ends_at
      or new.draw_at is distinct from old.draw_at or new.drand_round is distinct from old.drand_round or new.ticket_cap is distinct from old.ticket_cap) then
    raise exception '시작한 이벤트는 기간·응모권 수·추첨 시각을 바꿀 수 없음' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function public.d2r_event_guard() from public, anon, authenticated;
drop trigger if exists trg_event_guard on public.tb_event;
create trigger trg_event_guard before update on public.tb_event
  for each row execute function public.d2r_event_guard();

-- 응모권 보호: 운영진 제외 표시는 추첨 시각 전까지만 (그 뒤엔 목록 고정)
create or replace function public.d2r_event_entry_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if current_setting('d2r.event_sync', true) = '1' then return new; end if;
  if now() >= (select draw_at from public.tb_event where id = old.event_id) then
    raise exception '추첨 시각이 지나 응모 목록이 고정됨' using errcode = '42501';
  end if;
  if new.event_id <> old.event_id or new.user_id <> old.user_id or new.post_id <> old.post_id then
    raise exception '응모 기록은 제외 표시만 바꿀 수 있음' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function public.d2r_event_entry_guard() from public, anon, authenticated;
drop trigger if exists trg_event_entry_guard on public.tb_event_entry;
create trigger trg_event_entry_guard before update on public.tb_event_entry
  for each row execute function public.d2r_event_entry_guard();

-- 판매글을 올리면 진행 중인 이벤트에 응모권 기록
create or replace function public.d2r_event_entry_on_post() returns trigger
language plpgsql security definer set search_path = public as $$
declare e record; nick text; role_ text; n int;
begin
  for e in select * from public.tb_event where starts_at <= now() and ends_at > now() and result is null loop
    select nickname, role::text into nick, role_ from public.tb_profile where id = new.author_id;
    if role_ in ('moderator', 'admin') then continue; end if;                       -- 운영진
    if new.category = '골드' then continue; end if;                                  -- 골드
    if new.item_name in ('엘 룬', '엘드 룬', '티르 룬', '네프 룬', '에드 룬', '아이드 룬', '탈 룬', '랄 룬', '오르트 룬',
        '주울 룬', '앰 룬', '솔 룬', '샤엘 룬', '돌 룬', '헬 룬', '이오 룬', '룸 룬') then continue; end if;   -- 코 룬 미만
    if new.category = '퍼펙트 보석' and new.item_name not like '최상급 %' then continue; end if;          -- 최상급 아닌 보석
    if exists (select 1 from public.tb_event_entry where event_id = e.id and user_id = new.author_id
                and item_name = new.item_name and not excluded) then continue; end if;                  -- 같은 아이템 중복
    select count(*) into n from public.tb_event_entry where event_id = e.id and user_id = new.author_id and not excluded;
    if n >= e.ticket_cap then continue; end if;                                      -- 1인 최대
    insert into public.tb_event_entry (event_id, user_id, post_id, nickname, item_name, category)
    values (e.id, new.author_id, new.id, coalesce(nick, ''), coalesce(new.item_name, ''), new.category)
    on conflict (event_id, post_id) do nothing;
  end loop;
  return new;
end $$;
revoke all on function public.d2r_event_entry_on_post() from public, anon, authenticated;
drop trigger if exists trg_event_entry_on_post on public.tb_trade_post;
create trigger trg_event_entry_on_post after insert on public.tb_trade_post
  for each row execute function public.d2r_event_entry_on_post();

-- 추첨 시각 전에 글을 지우면(삭제 표시·완전 삭제) 그 응모권 제외
create or replace function public.d2r_event_entry_on_delete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and (old.deleted_at is not null or new.deleted_at is null) then return new; end if;
  perform set_config('d2r.event_sync', '1', true);
  update public.tb_event_entry en set excluded = true, excluded_reason = '삭제한 글'
    from public.tb_event e
   where en.post_id = old.id and e.id = en.event_id and now() < e.draw_at and not en.excluded;
  perform set_config('d2r.event_sync', '', true);
  return coalesce(new, old);
end $$;
revoke all on function public.d2r_event_entry_on_delete() from public, anon, authenticated;
drop trigger if exists trg_event_entry_on_delete on public.tb_trade_post;
create trigger trg_event_entry_on_delete after update of deleted_at or delete on public.tb_trade_post
  for each row execute function public.d2r_event_entry_on_delete();

-- 추첨: 응모권(제외 안 된 것, 번호 순)에서 SHA-256(난수 || ':' || 등수) 앞 6바이트 mod 남은 장수 → 당첨 번호
-- 당첨된 사람의 나머지 응모권은 빼고 다음 등수. 화면(src/eventStore.js)도 같은 계산으로 검증함
create or replace function public.d2r_event_pick(p_event_id bigint, p_randomness text)
returns table (rank int, label text, item text, user_id uuid, nickname text, entry_id bigint, ticket_no int, tickets_left int)
language plpgsql stable security definer set search_path = public as $$
declare e record; p jsonb; k int := 0; ids bigint[]; users uuid[]; nicks text[]; idx int; h bytea; win uuid;
begin
  select * into e from public.tb_event where id = p_event_id;
  select array_agg(en.id order by en.id), array_agg(en.user_id order by en.id), array_agg(en.nickname order by en.id)
    into ids, users, nicks
    from public.tb_event_entry en where en.event_id = p_event_id and not en.excluded;
  for p in select * from jsonb_array_elements(e.prizes) order by (value ->> 'rank')::int loop
    k := k + 1;
    exit when ids is null or cardinality(ids) = 0;
    h := sha256(convert_to(p_randomness || ':' || k, 'UTF8'));
    idx := (('x' || encode(substring(h from 1 for 6), 'hex'))::bit(48)::bigint % cardinality(ids))::int + 1;
    win := users[idx];
    rank := k; label := p ->> 'label'; item := p ->> 'item'; user_id := win; nickname := nicks[idx];
    entry_id := ids[idx]; ticket_no := idx; tickets_left := cardinality(ids);
    return next;
    -- 당첨자 응모권 모두 빼기
    select array_agg(ids[i] order by i), array_agg(users[i] order by i), array_agg(nicks[i] order by i)
      into ids, users, nicks
      from generate_subscripts(users, 1) i where users[i] <> win;
  end loop;
end $$;
revoke all on function public.d2r_event_pick(bigint, text) from public;
grant execute on function public.d2r_event_pick(bigint, text) to anon, authenticated;

create or replace function public.d2r_event_draw(p_event_id bigint, p_randomness text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e record; res jsonb; w record;
begin
  if not public.d2r_is_staff() then raise exception '운영진만' using errcode = '42501'; end if;
  select * into e from public.tb_event where id = p_event_id for update;
  if not found then raise exception '이벤트 없음'; end if;
  if now() < e.draw_at then raise exception '추첨 시각 전'; end if;
  if e.result is not null then raise exception '이미 추첨한 이벤트'; end if;
  if p_randomness !~ '^[0-9a-f]{64}$' then raise exception 'drand 난수 형식 오류 (64자리 16진수)'; end if;
  res := jsonb_build_object(
    'round', e.drand_round, 'randomness', p_randomness, 'drawn_at', now(), 'drawn_by', auth.uid(),
    'tickets_total', (select count(*) from public.tb_event_entry where event_id = e.id and not excluded),
    'entries', coalesce((select jsonb_agg(jsonb_build_object('user_id', user_id, 'nickname', nickname, 'tickets', c) order by c desc, nickname)
                  from (select user_id, max(nickname) as nickname, count(*) as c from public.tb_event_entry
                         where event_id = e.id and not excluded group by user_id) s), '[]'::jsonb),
    'winners', coalesce((select jsonb_agg(to_jsonb(x) order by x.rank) from public.d2r_event_pick(e.id, p_randomness) x), '[]'::jsonb));
  perform set_config('d2r.event_draw', '1', true);
  update public.tb_event set result = res where id = e.id;
  perform set_config('d2r.event_draw', '', true);
  for w in select * from jsonb_to_recordset(res -> 'winners') as t(label text, item text, user_id uuid) loop
    insert into public.tb_notification (user_id, text, link)
    values (w.user_id, '"' || e.title || '" ' || coalesce(w.label, '') || ' 당첨! (' || coalesce(w.item, '') || ') - 쪽지로 지급 안내 예정', '/event/' || e.id);
  end loop;
  return res;
end $$;
revoke all on function public.d2r_event_draw(bigint, text) from public, anon;
grant execute on function public.d2r_event_draw(bigint, text) to authenticated;

notify pgrst, 'reload schema';

-- 확인: 5줄 나오면 정상
select '이벤트 테이블' as 항목, 'tb_event' as 이름 where to_regclass('public.tb_event') is not null
union all
select '응모 테이블', 'tb_event_entry' where to_regclass('public.tb_event_entry') is not null
union all
select '응모 자동 기록', tgname from pg_trigger where tgrelid = 'public.tb_trade_post'::regclass and tgname = 'trg_event_entry_on_post'
union all
select '글 삭제 시 제외', tgname from pg_trigger where tgrelid = 'public.tb_trade_post'::regclass and tgname = 'trg_event_entry_on_delete'
union all
select '추첨', proname from pg_proc where pronamespace = 'public'::regnamespace and proname = 'd2r_event_draw';
