-- ============================================================
--  007 쪽지·거래방·프로필
--  1) 쪽지방 나가기: 나에게서만 숨김 (상대는 그대로). 나간 뒤 새 쪽지가 오면 그 뒤 쪽지만 다시 보임
--  2) 쪽지 삭제: 내가 보낸 쪽지만 (상대 화면에서도 사라짐)
--  3) 쪽지 수정 막기: 대화 상대가 남의 쪽지 글을 고칠 수 있던 것 -> 받은 사람이 읽음 표시만 바꿀 수 있게
--  4) 거래방 메시지 읽음 표시 (read_at) + 읽음 처리 함수
--  5) 프로필 마지막 활동 시각 (last_seen_at) - 5분에 한 번만 기록
--  다시 실행해도 안전. 적용: Supabase SQL Editor 에 통째로 붙여 넣고 Run
--  사이트 새 버전(같은 PR)과 순서 상관없음 - 옛 사이트는 새 칸을 안 씀
-- ============================================================

-- 1) 쪽지방 나가기
alter table public.tb_dm_conversation
  add column if not exists a_left_at timestamptz,
  add column if not exists b_left_at timestamptz;

create or replace function public.d2r_leave_conversation(p_conversation bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.tb_dm_conversation
     set a_left_at = case when user_a = auth.uid() then now() else a_left_at end,
         b_left_at = case when user_b = auth.uid() then now() else b_left_at end
   where id = p_conversation and (user_a = auth.uid() or user_b = auth.uid());
  if not found then raise exception '대화방 없음'; end if;
end $$;
revoke all on function public.d2r_leave_conversation(bigint) from public, anon;
grant execute on function public.d2r_leave_conversation(bigint) to authenticated;

-- 2) 내가 보낸 쪽지 삭제
drop policy if exists messages_delete_own on public.tb_dm_message;
create policy messages_delete_own on public.tb_dm_message
  for delete to authenticated using (sender_id = auth.uid());
grant delete on public.tb_dm_message to authenticated;

-- 3) 쪽지 수정은 읽음 표시만, 받은 사람만
create or replace function public.d2r_dm_message_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;  -- SQL Editor·서버 작업
  new.text := old.text;
  new.sender_id := old.sender_id;
  new.conversation_id := old.conversation_id;
  new.created_at := old.created_at;
  if old.sender_id = auth.uid() then new.read_at := old.read_at; end if;
  return new;
end $$;
drop trigger if exists trg_dm_message_guard on public.tb_dm_message;
create trigger trg_dm_message_guard before update on public.tb_dm_message
  for each row execute function public.d2r_dm_message_guard();
revoke all on function public.d2r_dm_message_guard() from public, anon, authenticated;

-- 4) 거래방 메시지 읽음
alter table public.tb_trade_deal_message add column if not exists read_at timestamptz;

create or replace function public.d2r_mark_deal_read(p_deal bigint)
returns void language sql security definer set search_path = public as $$
  update public.tb_trade_deal_message m
     set read_at = now()
   where m.deal_id = p_deal and m.sender_id <> auth.uid() and m.read_at is null
     and exists (select 1 from public.tb_trade_deal d
                  where d.id = p_deal and (d.seller_id = auth.uid() or d.buyer_id = auth.uid()))
$$;
revoke all on function public.d2r_mark_deal_read(bigint) from public, anon;
grant execute on function public.d2r_mark_deal_read(bigint) to authenticated;

-- 5) 마지막 활동 시각 (공개: 거래 상대가 최근 접속을 볼 수 있게)
alter table public.tb_profile add column if not exists last_seen_at timestamptz;
grant select (last_seen_at) on public.tb_profile to anon, authenticated;

create or replace function public.d2r_touch_last_seen()
returns timestamptz language sql security definer set search_path = public as $$
  update public.tb_profile set last_seen_at = now()
   where id = auth.uid() and (last_seen_at is null or last_seen_at < now() - interval '5 minutes')
  returning last_seen_at
$$;
revoke all on function public.d2r_touch_last_seen() from public, anon;
grant execute on function public.d2r_touch_last_seen() to authenticated;
