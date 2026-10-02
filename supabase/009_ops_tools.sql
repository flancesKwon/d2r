-- ============================================================
--  009 운영 도구
--  1) 공지사항: 커뮤니티 '공지' 카테고리(운영진만 작성) + 고정(pinned, 운영진만)
--  2) 운영 기록(tb_admin_log): 운영진의 남의 글 삭제·정지·등급 변경·신고 처리·고정·금칙어 변경, 자동 숨김
--  3) 신고 누적 자동 숨김: 서로 다른 3명이 신고(처리 대기)하면 글·댓글·판매글을 가림. 신고가 전부 기각되면 다시 보임
--  4) 금칙어(tb_banned_word): 운영진이 관리, 들어간 글·댓글·판매글·쪽지·거래방 대화는 등록 막음 (운영진 제외)
--  5) 댓글 알림: 내 글에 남이 댓글을 달면 알림
--  6) 판매글 끌어올리기(bumped_at, 하루 한 번) - 30일 만료는 화면에서 bumped_at 으로 계산
--  다시 실행해도 안전. 적용: Supabase SQL Editor 에 통째로 붙여 넣고 Run
-- ============================================================

-- ─── 2) 운영 기록 (다른 항목들이 쓰므로 먼저) ───
create table if not exists public.tb_admin_log (
  id          bigint generated always as identity primary key,
  actor_id    uuid references public.tb_profile(id) on delete set null,
  action      text not null,
  target_type text,
  target_id   text,
  detail      text,
  created_at  timestamptz not null default now()
);
create index if not exists tb_admin_log_created_idx on public.tb_admin_log (created_at desc);
alter table public.tb_admin_log enable row level security;
drop policy if exists admin_log_staff_read on public.tb_admin_log;
create policy admin_log_staff_read on public.tb_admin_log for select to authenticated using (public.d2r_is_staff());
grant select on public.tb_admin_log to authenticated;

create or replace function public.d2r_log(p_action text, p_type text, p_id text, p_detail text)
returns void language sql security definer set search_path = public as $$
  insert into public.tb_admin_log (actor_id, action, target_type, target_id, detail)
  values (auth.uid(), p_action, p_type, p_id, left(p_detail, 300))
$$;
revoke all on function public.d2r_log(text, text, text, text) from public, anon, authenticated;

-- 운영진이 남의 글·댓글·판매글을 지우면 기록
create or replace function public.d2r_log_staff_delete() returns trigger
language plpgsql security definer set search_path = public as $$
declare j jsonb := to_jsonb(old);
begin
  if auth.uid() is not null and auth.uid() is distinct from (j->>'author_id')::uuid and public.d2r_is_staff() then
    perform public.d2r_log('삭제', tg_table_name, j->>'id',
      coalesce(j->>'title', j->>'item_name', left(j->>'content', 100)));
  end if;
  return old;
end $$;
do $$
declare t text;
begin
  foreach t in array array['tb_community_post', 'tb_community_comment', 'tb_trade_post'] loop
    execute format('drop trigger if exists trg_log_staff_delete on public.%I', t);
    execute format('create trigger trg_log_staff_delete after delete on public.%I for each row execute function public.d2r_log_staff_delete()', t);
  end loop;
end $$;

-- 정지·해제·등급 변경 기록
create or replace function public.d2r_log_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if new.suspended_until is distinct from old.suspended_until then
    perform public.d2r_log(case when new.suspended_until is null then '정지 해제' else '정지' end, 'profile', new.id::text,
      new.nickname || coalesce(' · ' || to_char(new.suspended_until at time zone 'Asia/Seoul', 'YYYY-MM-DD HH24:MI') || '까지', '')
      || coalesce(' · 사유: ' || new.suspended_reason, ''));
  end if;
  if new.role is distinct from old.role then
    perform public.d2r_log('등급 변경', 'profile', new.id::text, new.nickname || ' · ' || old.role || ' → ' || new.role);
  end if;
  return new;
end $$;
drop trigger if exists trg_log_profile on public.tb_profile;
create trigger trg_log_profile after update on public.tb_profile for each row execute function public.d2r_log_profile();

-- ─── 3) 신고 누적 자동 숨김 ───
create table if not exists public.tb_auto_hidden (
  target_type text not null,
  target_id   text not null,
  hidden_at   timestamptz not null default now(),
  primary key (target_type, target_id)
);
alter table public.tb_auto_hidden enable row level security;
drop policy if exists auto_hidden_staff_read on public.tb_auto_hidden;
create policy auto_hidden_staff_read on public.tb_auto_hidden for select to authenticated using (public.d2r_is_staff());
grant select on public.tb_auto_hidden to authenticated;

create or replace function public.d2r_set_hidden(p_type text, p_id text, p_hide boolean)
returns void language plpgsql security definer set search_path = public as $$
declare tbl text := case p_type when 'community_post' then 'tb_community_post'
                                when 'community_comment' then 'tb_community_comment'
                                when 'trade_post' then 'tb_trade_post' end;
begin
  if tbl is null then return; end if;
  if p_hide then
    execute format('update public.%I set deleted_at = now() where id::text = $1 and deleted_at is null', tbl) using p_id;
  else
    execute format('update public.%I set deleted_at = null where id::text = $1', tbl) using p_id;
  end if;
end $$;
revoke all on function public.d2r_set_hidden(text, text, boolean) from public, anon, authenticated;

create or replace function public.d2r_report_auto_hide() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.target_type in ('community_post', 'community_comment', 'trade_post')
       and not exists (select 1 from public.tb_auto_hidden where target_type = new.target_type and target_id = new.target_id)
       and (select count(distinct reporter_id) from public.tb_report
             where target_type = new.target_type and target_id = new.target_id and status = 'open') >= 3 then
      perform public.d2r_set_hidden(new.target_type, new.target_id, true);
      insert into public.tb_auto_hidden (target_type, target_id) values (new.target_type, new.target_id);
      insert into public.tb_admin_log (actor_id, action, target_type, target_id, detail)
      values (null, '자동 숨김', new.target_type, new.target_id, coalesce(new.target_label, '') || ' · 신고 3건');
    end if;
  elsif new.status is distinct from old.status then
    perform public.d2r_log('신고 ' || case new.status when 'resolved' then '처리' when 'dismissed' then '기각' else '대기' end,
      new.target_type, new.target_id, coalesce(new.target_label, ''));
    -- 자동으로 가린 글은 남은 신고가 전부 기각이면 다시 보이게
    if new.status = 'dismissed'
       and exists (select 1 from public.tb_auto_hidden where target_type = new.target_type and target_id = new.target_id)
       and not exists (select 1 from public.tb_report where target_type = new.target_type and target_id = new.target_id and status <> 'dismissed') then
      perform public.d2r_set_hidden(new.target_type, new.target_id, false);
      delete from public.tb_auto_hidden where target_type = new.target_type and target_id = new.target_id;
      perform public.d2r_log('자동 숨김 해제', new.target_type, new.target_id, coalesce(new.target_label, ''));
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_report_auto_hide on public.tb_report;
create trigger trg_report_auto_hide after insert or update on public.tb_report
  for each row execute function public.d2r_report_auto_hide();

-- ─── 4) 금칙어 ───
create table if not exists public.tb_banned_word (
  word       text primary key check (char_length(word) between 1 and 40),
  created_by uuid references public.tb_profile(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
alter table public.tb_banned_word enable row level security;
drop policy if exists banned_word_staff on public.tb_banned_word;
create policy banned_word_staff on public.tb_banned_word for all to authenticated
  using (public.d2r_is_staff()) with check (public.d2r_is_staff());
grant select, insert, delete on public.tb_banned_word to authenticated;
insert into public.tb_banned_word (word, created_by) values ('현거래', null), ('현금거래', null), ('계좌번호', null), ('입금계좌', null)
  on conflict do nothing;

-- 글자 사이 띄어쓰기·대소문자 무시하고 비교 ("현 거 래"도 걸림)
create or replace function public.d2r_banned_check() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  j jsonb := to_jsonb(new);
  body text := concat_ws(' ', j->>'title', j->>'content', j->>'item_name', j->>'price', j->>'text');
  hit text;
begin
  if auth.uid() is null or public.d2r_is_staff() then return new; end if;
  if tg_op = 'UPDATE' then
    j := to_jsonb(old);
    if body is not distinct from concat_ws(' ', j->>'title', j->>'content', j->>'item_name', j->>'price', j->>'text') then return new; end if;
  end if;
  select word into hit from public.tb_banned_word
   where position(lower(regexp_replace(word, '\s', '', 'g')) in lower(regexp_replace(body, '\s', '', 'g'))) > 0
   limit 1;
  if hit is not null then
    raise exception '금칙어 포함: %', hit using errcode = 'P0001', hint = 'banned_word';
  end if;
  return new;
end $$;
do $$
declare t text;
begin
  foreach t in array array['tb_community_post', 'tb_community_comment', 'tb_trade_post', 'tb_dm_message', 'tb_trade_deal_message'] loop
    execute format('drop trigger if exists trg_banned_check on public.%I', t);
    execute format('create trigger trg_banned_check before insert or update on public.%I for each row execute function public.d2r_banned_check()', t);
  end loop;
end $$;

create or replace function public.d2r_log_banned() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then perform public.d2r_log('금칙어 추가', 'banned_word', new.word, new.word);
  else perform public.d2r_log('금칙어 삭제', 'banned_word', old.word, old.word); end if;
  return null;
end $$;
drop trigger if exists trg_log_banned on public.tb_banned_word;
create trigger trg_log_banned after insert or delete on public.tb_banned_word for each row execute function public.d2r_log_banned();

-- ─── 1) 공지사항 ───
alter table public.tb_community_post add column if not exists pinned boolean not null default false;
do $$
declare r record;
begin
  for r in select conname from pg_constraint
            where conrelid = 'public.tb_community_post'::regclass and contype = 'c'
              and pg_get_constraintdef(oid) ~* '\mcategory\M' loop
    execute format('alter table public.tb_community_post drop constraint %I', r.conname);
  end loop;
end $$;
alter table public.tb_community_post add constraint tb_community_post_category_check
  check (category in ('공지', '질문', '거래', '잡담', '공략', '건의', '버그제보'));

-- 공지 카테고리는 운영진만, 고정은 함수로만
create or replace function public.d2r_post_notice_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if not public.d2r_is_staff() and new.category = '공지' and (tg_op = 'INSERT' or old.category is distinct from '공지') then
    raise exception '공지는 운영진만 작성' using errcode = '42501';
  end if;
  if current_setting('d2r.pin', true) is distinct from '1' then
    new.pinned := case when tg_op = 'INSERT' then false else old.pinned end;
  end if;
  return new;
end $$;
drop trigger if exists trg_post_notice_guard on public.tb_community_post;
create trigger trg_post_notice_guard before insert or update on public.tb_community_post
  for each row execute function public.d2r_post_notice_guard();

create or replace function public.d2r_set_pinned(p_post bigint, p_pinned boolean)
returns void language plpgsql security definer set search_path = public as $$
declare t text;
begin
  if not public.d2r_is_staff() then raise exception '운영진만 가능' using errcode = '42501'; end if;
  perform set_config('d2r.pin', '1', true);
  update public.tb_community_post set pinned = p_pinned where id = p_post returning title into t;
  if t is null then raise exception '글 없음'; end if;
  perform public.d2r_log(case when p_pinned then '고정' else '고정 해제' end, 'community_post', p_post::text, t);
end $$;
revoke all on function public.d2r_set_pinned(bigint, boolean) from public, anon;
grant execute on function public.d2r_set_pinned(bigint, boolean) to authenticated;

-- ─── 5) 댓글 알림 ───
create or replace function public.notify_new_comment() returns trigger
language plpgsql security definer set search_path = public as $$
declare p record;
begin
  select id, author_id, title into p from public.tb_community_post where id = new.post_id;
  if found and p.author_id is distinct from new.author_id then
    insert into public.tb_notification (user_id, text, link)
    values (p.author_id, '"' || left(p.title, 40) || '" 새 댓글', '/community/' || p.id);
  end if;
  return new;
end $$;
drop trigger if exists trg_notify_new_comment on public.tb_community_comment;
create trigger trg_notify_new_comment after insert on public.tb_community_comment
  for each row execute function public.notify_new_comment();
revoke all on function public.notify_new_comment() from public, anon, authenticated;

-- ─── 6) 판매글 끌어올리기 ───
alter table public.tb_trade_post add column if not exists bumped_at timestamptz;
update public.tb_trade_post set bumped_at = created_at where bumped_at is null;
alter table public.tb_trade_post alter column bumped_at set default now();
create index if not exists tb_trade_post_bumped_idx on public.tb_trade_post (bumped_at desc);

-- 직접 고치는 건 막고(등록 때는 지금 시각) 끌어올리기 함수로만
create or replace function public.d2r_trade_bump_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then new.bumped_at := now(); return new; end if;
  if auth.uid() is not null and current_setting('d2r.bump', true) is distinct from '1' then
    new.bumped_at := old.bumped_at;
  end if;
  return new;
end $$;
drop trigger if exists trg_trade_bump_guard on public.tb_trade_post;
create trigger trg_trade_bump_guard before insert or update on public.tb_trade_post
  for each row execute function public.d2r_trade_bump_guard();

create or replace function public.d2r_bump_trade_post(p_post bigint)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare r record;
begin
  select author_id, status, bumped_at into r from public.tb_trade_post where id = p_post and deleted_at is null;
  if not found or r.author_id <> auth.uid() then raise exception '내 판매글만 가능' using errcode = '42501'; end if;
  if r.status = '거래완료' then raise exception '거래완료된 글은 끌어올릴 수 없음'; end if;
  if r.bumped_at > now() - interval '24 hours' then raise exception '끌어올리기는 하루 한 번'; end if;
  perform set_config('d2r.bump', '1', true);
  update public.tb_trade_post set bumped_at = now() where id = p_post;
  return now();
end $$;
revoke all on function public.d2r_bump_trade_post(bigint) from public, anon;
grant execute on function public.d2r_bump_trade_post(bigint) to authenticated;
