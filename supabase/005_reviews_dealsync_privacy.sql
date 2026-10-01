-- ============================================================
--  005 출시 전 점검에서 나온 것
--  1) 리뷰: 거래당 1개 -> 거래당 사람마다 1개 (먼저 쓴 쪽 때문에 상대가 못 쓰던 문제)
--  2) 거래방 결과를 판매글에 반영: 거래완료 -> 판매글 거래완료 + 남은 대기 신청 거절, 거래불발 -> 판매글 다시 판매중
--  3) 정지 사유(suspended_reason)는 본인·운영진만 (지금은 누구나 API 로 읽힘)
--  다시 실행해도 안전. 적용: Supabase SQL Editor 에 통째로 붙여 넣고 Run
--  주의: 사이트 새 버전(이 파일과 같은 PR)이 배포된 뒤에 실행 (3번 때문에 옛 사이트는 프로필 읽기가 막힘)
-- ============================================================

-- 1) 리뷰 기본키 (deal_id) -> (deal_id, from_id)
do $$
declare r record;
begin
  select oid, conname into r from pg_constraint
   where conrelid = 'public.tb_trade_deal_review'::regclass and contype = 'p';
  if found and pg_get_constraintdef(r.oid) not like '%from_id%' then
    execute format('alter table public.tb_trade_deal_review drop constraint %I', r.conname);
    alter table public.tb_trade_deal_review add primary key (deal_id, from_id);
  end if;
end $$;

-- 2) 거래방 상태 -> 판매글 상태
create or replace function public.d2r_deal_status_sync() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status is not distinct from old.status then return new; end if;
  if new.status = '거래완료' then
    update public.tb_trade_post set status = '거래완료', updated_at = now()
     where id = new.post_id and status <> '거래완료';
    -- 같은 글에 남은 대기 신청은 거절 (거절 알림은 기존 트리거가 보냄)
    update public.tb_trade_request set status = 'rejected'
     where post_id = new.post_id and status = 'pending';
  elsif new.status = '거래불발' then
    -- 같은 글에 진행 중이거나 끝난 다른 거래가 없을 때만 다시 판매중
    if not exists (select 1 from public.tb_trade_deal
                    where post_id = new.post_id and id <> new.id and status in ('거래중', '거래완료')) then
      update public.tb_trade_post set status = '판매중', updated_at = now()
       where id = new.post_id and status = '예약중';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_deal_status_sync on public.tb_trade_deal;
create trigger trg_deal_status_sync after update of status on public.tb_trade_deal
  for each row execute function public.d2r_deal_status_sync();
revoke all on function public.d2r_deal_status_sync() from public, anon, authenticated;

-- 3) 정지 사유 숨기기: 프로필은 칸 단위로 읽기 권한 (suspended_reason 만 빼고)
--    프로필에 칸을 새로 만들면 아래 grant 에도 넣어야 사이트에서 읽힘
revoke select on public.tb_profile from anon, authenticated;
grant select (id, nickname, contact, avatar_url, role, created_at, suspended_until) on public.tb_profile to anon, authenticated;

-- 정지 사유는 이 함수로만: 본인 것, 운영진은 요청한 사람들 것
create or replace function public.d2r_suspension_reasons(p_ids uuid[])
returns table (id uuid, suspended_reason text)
language sql stable security definer set search_path = public as $$
  select p.id, p.suspended_reason from public.tb_profile p
   where p.id = any(p_ids) and (p.id = auth.uid() or public.d2r_is_staff())
$$;
revoke all on function public.d2r_suspension_reasons(uuid[]) from public, anon;
grant execute on function public.d2r_suspension_reasons(uuid[]) to authenticated;
