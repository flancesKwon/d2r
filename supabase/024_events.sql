-- 024: 이벤트 (매물 등록 이벤트 등)
--  1) tb_event: 제목·기간·1인 최대 응모권·상품·규칙·추첨 결과. 누구나 읽음(배너·이벤트 페이지), 운영진만 만들고 고침
--  2) 추첨 결과는 d2r_event_save_result() 로만 저장 - 이벤트가 끝난 뒤 한 번만 (다시 추첨 못 함), 당첨자에게 알림
--     결과에는 응모자별 응모권 수와 당첨자를 같이 남겨서 이벤트 페이지에 공개
-- 002 다음에 실행. 여러 번 실행해도 됨

create table if not exists public.tb_event (
  id bigint generated always as identity primary key,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  ticket_cap int not null default 4 check (ticket_cap between 1 and 100),
  prizes jsonb not null default '[]'::jsonb,   -- [{ "rank": 1, "label": "1등", "item": "자 룬 + 베르 룬" }, ...]
  rules text,
  result jsonb,                                -- { drawn_at, entries: [{ user_id, nickname, tickets }], winners: [{ rank, label, item, user_id, nickname }] }
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  constraint d2r_event_period check (ends_at > starts_at)
);

alter table public.tb_event enable row level security;
drop policy if exists event_read on public.tb_event;
create policy event_read on public.tb_event for select using (true);
drop policy if exists event_staff_insert on public.tb_event;
create policy event_staff_insert on public.tb_event for insert to authenticated with check (public.d2r_is_staff());
drop policy if exists event_staff_update on public.tb_event;
create policy event_staff_update on public.tb_event for update to authenticated using (public.d2r_is_staff()) with check (public.d2r_is_staff());
drop policy if exists event_staff_delete on public.tb_event;
create policy event_staff_delete on public.tb_event for delete to authenticated using (public.d2r_is_staff() and result is null);
grant select on public.tb_event to anon, authenticated;
grant insert, update, delete on public.tb_event to authenticated;

-- 결과 칸은 추첨 함수로만, 추첨한 이벤트는 기간·응모권 수를 못 바꿈
create or replace function public.d2r_event_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if current_setting('d2r.event_draw', true) = '1' then return new; end if;
  if new.result is distinct from old.result then
    raise exception '추첨 결과는 추첨으로만 저장' using errcode = '42501';
  end if;
  if old.result is not null and (new.starts_at is distinct from old.starts_at or new.ends_at is distinct from old.ends_at
      or new.ticket_cap is distinct from old.ticket_cap) then
    raise exception '추첨한 이벤트는 기간·응모권 수를 바꿀 수 없음' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function public.d2r_event_guard() from public, anon, authenticated;
drop trigger if exists trg_event_guard on public.tb_event;
create trigger trg_event_guard before update on public.tb_event
  for each row execute function public.d2r_event_guard();

-- 추첨 결과 저장 (운영진, 이벤트 끝난 뒤, 한 번만) + 당첨자 알림
create or replace function public.d2r_event_save_result(p_event_id bigint, p_result jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare e record; w jsonb;
begin
  if not public.d2r_is_staff() then raise exception '운영진만' using errcode = '42501'; end if;
  select * into e from public.tb_event where id = p_event_id for update;
  if not found then raise exception '이벤트 없음'; end if;
  if now() < e.ends_at then raise exception '이벤트가 끝난 뒤에 추첨'; end if;
  if e.result is not null then raise exception '이미 추첨한 이벤트'; end if;
  if jsonb_typeof(p_result -> 'winners') is distinct from 'array' or jsonb_typeof(p_result -> 'entries') is distinct from 'array' then
    raise exception '결과 형식 오류';
  end if;
  perform set_config('d2r.event_draw', '1', true);
  update public.tb_event set result = p_result || jsonb_build_object('drawn_at', now(), 'drawn_by', auth.uid()) where id = p_event_id;
  perform set_config('d2r.event_draw', '', true);
  for w in select * from jsonb_array_elements(p_result -> 'winners') loop
    if (w ->> 'user_id') is not null then
      insert into public.tb_notification (user_id, text, link)
      values ((w ->> 'user_id')::uuid, '"' || e.title || '" ' || coalesce(w ->> 'label', '') || ' 당첨! (' || coalesce(w ->> 'item', '') || ') - 쪽지로 지급 안내 예정', '/event/' || e.id);
    end if;
  end loop;
end $$;
revoke all on function public.d2r_event_save_result(bigint, jsonb) from public, anon;
grant execute on function public.d2r_event_save_result(bigint, jsonb) to authenticated;

notify pgrst, 'reload schema';

-- 확인: 3줄 나오면 정상
select '이벤트 테이블' as 항목, 'tb_event' as 이름 where to_regclass('public.tb_event') is not null
union all
select '결과 보호', tgname from pg_trigger where tgrelid = 'public.tb_event'::regclass and tgname = 'trg_event_guard'
union all
select '추첨 저장', proname from pg_proc where pronamespace = 'public'::regnamespace and proname = 'd2r_event_save_result';
