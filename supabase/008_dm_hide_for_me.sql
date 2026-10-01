-- ============================================================
--  008 쪽지 삭제를 "나에게서만"으로
--  - 지운 사람 화면에서만 사라지고 상대 화면엔 그대로 (카톡 나에게서 삭제)
--  - 내가 보낸 쪽지·받은 쪽지 모두 내 화면에서 지울 수 있음
--  - 007 의 "상대 화면에서도 사라지는" 진짜 삭제는 막음
--  다시 실행해도 안전. 적용: Supabase SQL Editor 에 통째로 붙여 넣고 Run
-- ============================================================
alter table public.tb_dm_message
  add column if not exists sender_hidden_at timestamptz,
  add column if not exists receiver_hidden_at timestamptz;

-- 진짜 삭제 막기 (007 에서 열었던 것)
drop policy if exists messages_delete_own on public.tb_dm_message;
revoke delete on public.tb_dm_message from authenticated;

-- 내 화면에서 쪽지 숨기기
create or replace function public.d2r_hide_message(p_message bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.tb_dm_message m
     set sender_hidden_at   = case when m.sender_id = auth.uid() then now() else m.sender_hidden_at end,
         receiver_hidden_at = case when m.sender_id <> auth.uid() then now() else m.receiver_hidden_at end
   where m.id = p_message
     and exists (select 1 from public.tb_dm_conversation c
                  where c.id = m.conversation_id and (c.user_a = auth.uid() or c.user_b = auth.uid()));
  if not found then raise exception '쪽지 없음'; end if;
end $$;
revoke all on function public.d2r_hide_message(bigint) from public, anon;
grant execute on function public.d2r_hide_message(bigint) to authenticated;

-- 쪽지 수정 규칙에 숨김 칸 추가: 내 쪽의 숨김 칸만 바꿀 수 있음
create or replace function public.d2r_dm_message_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;  -- SQL Editor·서버 작업
  new.text := old.text;
  new.sender_id := old.sender_id;
  new.conversation_id := old.conversation_id;
  new.created_at := old.created_at;
  if old.sender_id = auth.uid() then
    new.read_at := old.read_at;                     -- 내가 보낸 걸 내가 읽음 처리 못 함
    new.receiver_hidden_at := old.receiver_hidden_at;
  else
    new.sender_hidden_at := old.sender_hidden_at;
  end if;
  return new;
end $$;
