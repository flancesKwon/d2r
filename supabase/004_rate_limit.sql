-- ============================================================
--  004 도배 방지: 한 사람이 짧은 시간에 너무 많이 쓰면 막음
--  - 로그인한 사용자(auth.uid())만 셈. SQL Editor(auth.uid() 없음)·운영진은 제외
--  - 쓴 기록은 tb_rate_log 에 따로 남김 -> 쓰고 지우기를 반복해도 개수에 들어감
--  - 다시 실행해도 안전 (create or replace / if not exists / drop trigger if exists)
--  + 알림·신고 문구를 사이트 말투(단답형)로, 정지 중엔 구매신청 수락 불가
--  적용: Supabase SQL Editor 에 통째로 붙여 넣고 Run
-- ============================================================

-- 쓴 기록 (사이트에선 안 보임: RLS 켜고 정책 없음, 트리거만 씀). 하루 지난 건 쓸 때마다 정리
create table if not exists public.tb_rate_log (
  user_id    uuid not null,
  kind       text not null,
  created_at timestamptz not null default now()
);
create index if not exists tb_rate_log_user_kind_idx on public.tb_rate_log (user_id, kind, created_at);
alter table public.tb_rate_log enable row level security;
revoke all on public.tb_rate_log from anon, authenticated;

-- 최근 p_window 안에 내가 쓴 p_kind 기록이 p_max 이상이면 예외
create or replace function public.d2r_check_rate(p_kind text, p_window interval, p_max int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.tb_rate_log
       where user_id = auth.uid() and kind = p_kind and created_at > now() - p_window) >= p_max then
    raise exception '도배 방지: 잠시 후 다시 시도' using errcode = 'P0001', hint = 'rate_limit';
  end if;
end $$;

create or replace function public.d2r_rate_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare k text := tg_table_name;
begin
  if auth.uid() is null or public.d2r_is_staff() then
    return new;
  end if;
  case k
    when 'tb_community_post' then
      perform public.d2r_check_rate(k, interval '10 minutes', 5);
      perform public.d2r_check_rate(k, interval '1 day', 30);
    when 'tb_community_comment' then
      perform public.d2r_check_rate(k, interval '1 minute', 5);
      perform public.d2r_check_rate(k, interval '1 day', 300);
    when 'tb_trade_post' then
      perform public.d2r_check_rate(k, interval '10 minutes', 10);
      perform public.d2r_check_rate(k, interval '1 day', 60);
    when 'tb_trade_request' then
      perform public.d2r_check_rate(k, interval '10 minutes', 10);
      perform public.d2r_check_rate(k, interval '1 day', 100);
    when 'tb_trade_deal_message' then
      perform public.d2r_check_rate(k, interval '1 minute', 20);
    when 'tb_dm_message' then
      perform public.d2r_check_rate(k, interval '1 minute', 20);
      perform public.d2r_check_rate(k, interval '1 day', 1000);
    when 'tb_dm_conversation' then
      -- 이미 있는 방을 다시 여는 건(open_conversation 의 on conflict) 세지 않음
      if exists (select 1 from public.tb_dm_conversation where user_a = new.user_a and user_b = new.user_b) then
        return new;
      end if;
      perform public.d2r_check_rate(k, interval '1 hour', 20);
    when 'tb_report' then
      perform public.d2r_check_rate(k, interval '1 hour', 20);
  end case;
  delete from public.tb_rate_log where user_id = auth.uid() and kind = k and created_at < now() - interval '1 day';
  insert into public.tb_rate_log (user_id, kind) values (auth.uid(), k);
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['tb_community_post', 'tb_community_comment', 'tb_trade_post', 'tb_trade_request',
                           'tb_trade_deal_message', 'tb_dm_message', 'tb_dm_conversation', 'tb_report'] loop
    execute format('drop trigger if exists trg_rate_limit on public.%I', t);
    execute format('create trigger trg_rate_limit before insert on public.%I for each row execute function public.d2r_rate_limit()', t);
  end loop;
end $$;

revoke all on function public.d2r_check_rate(text, interval, int) from public, anon, authenticated;
revoke all on function public.d2r_rate_limit() from public, anon, authenticated;

-- ─────────────────────────────────────────────
-- 알림 문구 단답형 (동작은 그대로, 글자만 바꿈)
-- ─────────────────────────────────────────────
create or replace function public.accept_trade_request(p_request_id bigint)
returns bigint language plpgsql security definer set search_path = public as $$
declare r record; d_id bigint;
begin
  select tr.*, tp.author_id as seller_id, tp.item_id, tp.item_name
    into r
    from public.tb_trade_request tr
    join public.tb_trade_post tp on tp.id = tr.post_id
   where tr.id = p_request_id
   for update;

  if not found then raise exception '신청 없음'; end if;
  if r.seller_id <> auth.uid() then raise exception '판매자만 수락 가능'; end if;
  -- 함수(security definer)라 RLS 의 이용 정지 검사를 안 거침 -> 여기서 직접
  if not public.d2r_is_active() then raise exception '이용 정지 중' using errcode = '42501'; end if;
  if r.status <> 'pending' then raise exception '이미 처리된 신청'; end if;

  update public.tb_trade_request set status = 'accepted' where id = p_request_id;

  insert into public.tb_trade_deal (post_id, request_id, seller_id, buyer_id, item_id, post_title)
  values (r.post_id, r.id, r.seller_id, r.buyer_id, r.item_id, r.item_name)
  returning id into d_id;

  insert into public.tb_notification (user_id, text, link)
  values (r.buyer_id, '"' || r.item_name || '" 거래 시작', '/deals/' || d_id);

  return d_id;
end $$;

create or replace function public.notify_trade_request()
returns trigger language plpgsql security definer set search_path = public as $$
declare p record;
begin
  select id, author_id, item_name into p from public.tb_trade_post where id = new.post_id;
  if not found then return new; end if;

  if tg_op = 'INSERT' then
    insert into public.tb_notification (user_id, text, link)
    values (p.author_id, '"' || p.item_name || '" 새 구매신청', '/trade/' || p.id);
  elsif new.status is distinct from old.status then
    if new.status = 'rejected' then
      insert into public.tb_notification (user_id, text, link)
      values (new.buyer_id, '"' || p.item_name || '" 구매신청 거절됨', '/trade/' || p.id);
    elsif new.status = 'cancelled' then
      insert into public.tb_notification (user_id, text, link)
      values (p.author_id, '"' || p.item_name || '" 구매신청 취소됨', '/trade/' || p.id);
    end if;
  end if;
  return new;
end $$;

create or replace function public.notify_trade_deal_status()
returns trigger language plpgsql security definer set search_path = public as $$
declare target uuid; msg text;
begin
  if new.status is not distinct from old.status or new.status = '거래중' then return new; end if;
  msg := '"' || new.post_title || '" ' || new.status;
  if auth.uid() = new.seller_id then target := new.buyer_id;
  elsif auth.uid() = new.buyer_id then target := new.seller_id;
  end if;
  if target is null then
    insert into public.tb_notification (user_id, text, link) values
      (new.seller_id, msg, '/deals/' || new.id),
      (new.buyer_id,  msg, '/deals/' || new.id);
  else
    insert into public.tb_notification (user_id, text, link)
    values (target, msg || case when new.status = '거래완료' then ' - 리뷰 작성 가능' else '' end, '/deals/' || new.id);
  end if;
  return new;
end $$;

-- 신고 오류 문구
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
    raise exception '신고 대상 없음' using errcode = 'P0002';
  end if;
  if new.target_author_id = new.reporter_id then
    raise exception '내 글은 신고 불가' using errcode = '42501';
  end if;
  return new;
end $$;


revoke execute on function public.notify_trade_request() from public;
revoke execute on function public.notify_trade_deal_status() from public;
revoke all on function public.d2r_report_before_insert() from public, anon, authenticated;
