-- 016: 판매 기간 48시간 + 재등록
--  1) 판매글은 올린(재등록한) 때부터 48시간 동안 목록에 보임 - 지나면 기간 만료 (화면이 bumped_at 으로 계산)
--  2) 재등록: 기간이 끝난 내 판매중 글을 판매가만 고쳐서 다시 48시간 (d2r_relist_trade_post)
--  3) 거래불발로 판매중으로 돌아온 글은 그때부터 다시 48시간
--  4) 거래완료된 글은 판매자가 지울 수 없음 (운영진은 가능)
-- 여러 번 실행해도 됨

-- 1·3) bumped_at = 판매 시작 시각. 직접 고치는 건 막고, 재등록 함수·거래불발 복귀 때만 바뀜
create or replace function public.d2r_trade_bump_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then new.bumped_at := now(); return new; end if;
  if auth.uid() is not null and current_setting('d2r.bump', true) is distinct from '1' then
    new.bumped_at := old.bumped_at;
  end if;
  -- 예약중 -> 판매중 (거래불발·구매신청 정리) 이면 판매 기간 새로
  if old.status = '예약중' and new.status = '판매중' then new.bumped_at := now(); end if;
  return new;
end $$;

-- 2) 재등록 - 판매가만 바꿀 수 있음
create or replace function public.d2r_relist_trade_post(p_post bigint, p_price text)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare r record; v_price text := btrim(coalesce(p_price, ''));
begin
  select author_id, status, bumped_at into r from public.tb_trade_post where id = p_post and deleted_at is null for update;
  if not found or r.author_id is distinct from auth.uid() then raise exception '내 판매글만 가능' using errcode = '42501'; end if;
  if r.status <> '판매중' then raise exception '판매중인 글만 재등록 가능'; end if;
  if r.bumped_at > now() - interval '48 hours' then raise exception '판매 기간(48시간)이 끝난 뒤 재등록 가능'; end if;
  if v_price = '' or char_length(v_price) > 100 then raise exception '판매가 1~100자'; end if;
  perform set_config('d2r.bump', '1', true);
  -- 가격 금칙어 검사 등 기존 트리거는 그대로 거침
  update public.tb_trade_post set price = v_price, bumped_at = now(), updated_at = now() where id = p_post;
  perform set_config('d2r.bump', '', true);
  return now();
end $$;
revoke all on function public.d2r_relist_trade_post(bigint, text) from public, anon;
grant execute on function public.d2r_relist_trade_post(bigint, text) to authenticated;

-- 4) 거래완료 글 삭제 막기 (판매자 본인) - 거래내역·후기가 이 글을 가리킴
create or replace function public.d2r_trade_done_delete_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.status = '거래완료' and auth.uid() is not null and not public.d2r_is_staff() then
    raise exception '거래완료된 판매글은 삭제할 수 없음' using errcode = '42501';
  end if;
  return old;
end $$;
drop trigger if exists trg_trade_done_delete_guard on public.tb_trade_post;
create trigger trg_trade_done_delete_guard before delete on public.tb_trade_post
  for each row execute function public.d2r_trade_done_delete_guard();
