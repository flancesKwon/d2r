-- 027: 삽니다 글 + 매물 알림
--  1) tb_trade_want: "이 아이템(또는 종류)을 이런 조건으로 삽니다" 글. 누구나 읽고, 로그인한 사람이 씀, 본인·운영진만 고치고 지움
--     - 아이템(사전 id) 하나, 또는 종류(룬워드·매직/레어 등) + 옵션 조건 1개 이상
--     - 서버·래더·모드·게임 모드는 비우면 상관없음, 옵션 조건은 최대 5개 [{key,label,pattern,numeric,agg,min,max}]
--     - 14일 동안 보이고(bumped_at 기준), 끌어올리면 다시 14일. 한 사람이 동시에 올릴 수 있는 건 20개
--  2) 판매글이 새로 올라오거나 재등록·다시 판매중이 되면, 조건이 맞는 삽니다 글 주인에게 알림 (notify = 알림 받기)
--     - 같은 삽니다 글 × 같은 판매글 알림은 한 번만 (tb_trade_want_hit), 자기 판매글은 알림 안 함
--     - 옵션 조건 계산: 판매글 옵션 줄 중 pattern 이 맞는 줄의 첫 수치를 더함(agg='max'면 가장 큰 값) -> min~max 비교
--       (화면의 옵션 검색과 같은 규칙. pattern 은 화면 옵션 목록의 정규식 - 저장할 때 DB가 한 번 돌려 보고 받음)
--     - 알림 계산이 실패해도 판매글 등록은 막지 않음
-- 002·004 다음에 실행. 여러 번 실행해도 됨

create table if not exists public.tb_trade_want (
  id bigint generated always as identity primary key,
  author_id uuid not null default auth.uid() references public.tb_profile(id) on delete cascade,
  item_id text,                                   -- 사전 아이템 id (비우면 종류로)
  item_name text not null,                        -- 아이템 한국어 이름, 종류로 찾을 땐 종류 이름
  category text not null,                         -- 거래 종류 (룬·룬워드·유니크/세트 ...)
  realm text,                                     -- null = 상관없음
  ladder text,
  hardcore text,
  game_version text,
  ethereal boolean not null default false,        -- true = 에테리얼만
  conds jsonb not null default '[]'::jsonb,
  price text,                                     -- 생각하는 가격 (자유 글, 비워도 됨)
  memo text,
  notify boolean not null default true,
  bumped_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  constraint tb_trade_want_name_len check (char_length(item_name) between 1 and 60),
  constraint tb_trade_want_price_len check (price is null or char_length(price) <= 60),
  constraint tb_trade_want_memo_len check (memo is null or char_length(memo) <= 300),
  constraint tb_trade_want_category check (category in ('룬', '퍼펙트 보석', '우버보스 재료', '정수·징표', '유니크/세트', '룬워드', '매직/레어/일반', '기타')),
  constraint tb_trade_want_realm check (realm is null or realm in ('아시아', '미주', '유럽')),
  constraint tb_trade_want_ladder check (ladder is null or ladder in ('레더', '논레더')),
  constraint tb_trade_want_hardcore check (hardcore is null or hardcore in ('일반', '하드코어')),
  constraint tb_trade_want_game check (game_version is null or game_version in ('클래식', '파괴의 군주', '악마술사의 군림')),
  constraint tb_trade_want_conds check (jsonb_typeof(conds) = 'array' and jsonb_array_length(conds) <= 5),
  -- 종류로만 찾을 땐 옵션 조건이 꼭 있어야 함 (아무 룬워드나 올라올 때마다 알림이 가지 않게)
  constraint tb_trade_want_target check (item_id is not null or jsonb_array_length(conds) >= 1)
);
create index if not exists tb_trade_want_item on public.tb_trade_want (item_id, bumped_at desc);
create index if not exists tb_trade_want_cat on public.tb_trade_want (category, bumped_at desc) where item_id is null;
create index if not exists tb_trade_want_author on public.tb_trade_want (author_id, bumped_at desc);
create index if not exists tb_trade_want_bumped on public.tb_trade_want (bumped_at desc);

-- 알림 보낸 기록 (같은 삽니다 글 × 판매글은 한 번만)
create table if not exists public.tb_trade_want_hit (
  want_id bigint not null references public.tb_trade_want(id) on delete cascade,
  post_id bigint not null,
  created_at timestamptz not null default now(),
  primary key (want_id, post_id)
);
create index if not exists tb_trade_want_hit_post on public.tb_trade_want_hit (post_id);

alter table public.tb_trade_want enable row level security;
alter table public.tb_trade_want_hit enable row level security;
drop policy if exists want_read on public.tb_trade_want;
create policy want_read on public.tb_trade_want for select using (true);
drop policy if exists want_insert on public.tb_trade_want;
create policy want_insert on public.tb_trade_want for insert to authenticated
  with check (author_id = auth.uid() and public.d2r_is_active());
drop policy if exists want_update on public.tb_trade_want;
create policy want_update on public.tb_trade_want for update to authenticated
  using (author_id = auth.uid() or public.d2r_is_staff()) with check (author_id = auth.uid() or public.d2r_is_staff());
drop policy if exists want_delete on public.tb_trade_want;
create policy want_delete on public.tb_trade_want for delete to authenticated
  using (author_id = auth.uid() or public.d2r_is_staff());
-- 알림 기록은 사이트에서 안 보임 (정책 없음 - 트리거만 씀)
revoke all on public.tb_trade_want_hit from anon, authenticated;
grant select on public.tb_trade_want to anon, authenticated;
grant insert, update, delete on public.tb_trade_want to authenticated;

-- 옵션 조건 모양 검사 + 정규식이 실제로 도는지 한 번 돌려 봄 (틀린 정규식이 들어오면 저장 안 됨)
create or replace function public.d2r_want_conds_ok(p jsonb) returns boolean
language plpgsql stable set search_path = public as $$
declare c jsonb; pat text;
begin
  for c in select * from jsonb_array_elements(p) loop
    if jsonb_typeof(c) <> 'object' then return false; end if;
    pat := c->>'pattern';
    if pat is null or char_length(pat) > 400 or left(pat, 1) <> '^' then return false; end if;
    if char_length(coalesce(c->>'label', '')) not between 1 and 80 then return false; end if;
    if coalesce(c->>'agg', 'sum') not in ('sum', 'max') then return false; end if;
    if c ? 'min' and jsonb_typeof(c->'min') not in ('number', 'null') then return false; end if;
    if c ? 'max' and jsonb_typeof(c->'max') not in ('number', 'null') then return false; end if;
    perform '' ~ pat;
  end loop;
  return true;
exception when others then
  return false;
end $$;

-- 쓰기 규칙: 글자 수·조건 검사, 도배 방지, 동시 20개, 주인·작성 시각은 못 바꿈
create or replace function public.d2r_want_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.d2r_want_conds_ok(new.conds) then
    raise exception '옵션 조건이 올바르지 않음' using errcode = '22023';
  end if;
  new.price := nullif(btrim(new.price), '');
  new.memo := nullif(btrim(new.memo), '');
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.bumped_at := now();
    if auth.uid() is not null and not public.d2r_is_staff() then
      perform public.d2r_check_rate('tb_trade_want', interval '10 minutes', 10);
      perform public.d2r_check_rate('tb_trade_want', interval '1 day', 30);
      if (select count(*) from public.tb_trade_want
           where author_id = new.author_id and bumped_at > now() - interval '14 days') >= 20 then
        raise exception '삽니다 글은 한 번에 20개까지' using errcode = 'P0001';
      end if;
      insert into public.tb_rate_log (user_id, kind) values (auth.uid(), 'tb_trade_want');
    end if;
  elsif auth.uid() is not null then   -- SQL Editor(운영 작업)는 그대로
    new.author_id := old.author_id;
    new.created_at := old.created_at;
    new.updated_at := now();
    -- 끌어올리기는 하루에 한 번 (bumped_at 을 앞으로만, 지금 시각으로만)
    if new.bumped_at is distinct from old.bumped_at then
      if old.bumped_at > now() - interval '1 day' and not public.d2r_is_staff() then
        raise exception '끌어올리기는 하루에 한 번' using errcode = 'P0001';
      end if;
      new.bumped_at := now();
    end if;
  end if;
  return new;
end $$;
revoke all on function public.d2r_want_guard() from public, anon, authenticated;
drop trigger if exists trg_want_guard on public.tb_trade_want;
create trigger trg_want_guard before insert or update on public.tb_trade_want
  for each row execute function public.d2r_want_guard();

-- 판매글 하나가 삽니다 글 조건에 맞는지 (옵션 줄 목록 = options->'lines')
create or replace function public.d2r_want_matches(w public.tb_trade_want, lines jsonb) returns boolean
language plpgsql stable set search_path = public as $$
declare c jsonb; pat text; line text; v numeric; total numeric; num text; lo numeric; hi numeric;
begin
  for c in select * from jsonb_array_elements(w.conds) loop
    pat := c->>'pattern';
    total := null;
    for line in select jsonb_array_elements_text(coalesce(lines, '[]'::jsonb)) loop
      if line !~ pat then continue; end if;
      -- 수치 자리가 있으면 첫 수치, 없는 옵션(대상 빙결 등)은 1
      num := case when coalesce((c->>'numeric')::boolean, true) then substring(line from pat) end;
      v := case when num ~ '^[+-]?\d+(\.\d+)?$' then num::numeric else 1 end;
      total := case when total is null then v when c->>'agg' = 'max' then greatest(total, v) else total + v end;
    end loop;
    if total is null then return false; end if;
    lo := case when jsonb_typeof(c->'min') = 'number' then (c->>'min')::numeric end;
    hi := case when jsonb_typeof(c->'max') = 'number' then (c->>'max')::numeric end;
    if (lo is not null and total < lo) or (hi is not null and total > hi) then return false; end if;
  end loop;
  return true;
end $$;

-- 판매글이 올라오거나(insert) 재등록되면(bumped_at 이 바뀜) 맞는 삽니다 글 주인에게 알림
create or replace function public.d2r_want_notify_on_post() returns trigger
language plpgsql security definer set search_path = public as $$
declare w public.tb_trade_want; lines jsonb;
begin
  if new.status is distinct from '판매중' or new.deleted_at is not null then return new; end if;
  -- 수정은 재등록(bumped_at)이나 다시 판매중(거래 불발)일 때만
  if tg_op = 'UPDATE' and new.bumped_at is not distinct from old.bumped_at and old.status = '판매중' then return new; end if;
  lines := case jsonb_typeof(new.options) when 'array' then new.options when 'object' then new.options->'lines' else '[]'::jsonb end;
  for w in
    select * from public.tb_trade_want t
     where t.notify and t.bumped_at > now() - interval '14 days'
       and t.author_id <> new.author_id
       and ((t.item_id is not null and t.item_id = new.item_id) or (t.item_id is null and t.category = new.category))
       and (t.realm is null or t.realm = new.realm)
       and (t.ladder is null or t.ladder = new.ladder)
       and (t.hardcore is null or t.hardcore = new.hardcore)
       and (t.game_version is null or t.game_version = coalesce(new.game_version, '악마술사의 군림'))
       and (not t.ethereal or coalesce(new.ethereal, false))
       and not exists (select 1 from public.tb_trade_want_hit h where h.want_id = t.id and h.post_id = new.id)
     order by t.bumped_at desc
     limit 200
  loop
    begin
      if not public.d2r_want_matches(w, lines) then continue; end if;
    exception when others then
      continue;   -- 정규식 문제 등으로 계산이 안 되면 그 삽니다 글만 건너뜀
    end;
    insert into public.tb_trade_want_hit (want_id, post_id) values (w.id, new.id) on conflict do nothing;
    -- 한 사람이 하루에 받는 매물 알림은 50개까지
    if (select count(*) from public.tb_trade_want_hit h join public.tb_trade_want t2 on t2.id = h.want_id
         where t2.author_id = w.author_id and h.created_at > now() - interval '1 day') <= 50 then
      insert into public.tb_notification (user_id, text, link)
      values (w.author_id, '"' || new.item_name || '" 찾던 매물 올라옴', '/trade/' || new.id);
    end if;
  end loop;
  return new;
exception when others then
  return new;   -- 알림이 실패해도 판매글은 올라가야 함
end $$;
revoke all on function public.d2r_want_notify_on_post() from public, anon, authenticated;
drop trigger if exists trg_want_notify_on_post on public.tb_trade_post;
create trigger trg_want_notify_on_post after insert or update of bumped_at, status on public.tb_trade_post
  for each row execute function public.d2r_want_notify_on_post();

-- 확인: 삽니다 글 수 (처음엔 0)
select count(*) as 삽니다_글 from public.tb_trade_want;
