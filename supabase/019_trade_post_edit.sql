-- 019: 판매글 수정 규칙
--  판매중이고, 대기 중이거나 수락된 구매신청이 없을 때만 판매자가 판매가·옵션 수치·수량·레더/하드코어·연락처·설명을 고칠 수 있음
--  (거절·취소된 신청만 있으면 수정 가능). 아이템 자체(분류·아이템·이름·에테리얼)는 언제나 못 바꿈 - 다른 아이템이면 새 글
--  상태 변경(판매중/예약중/거래완료)·재등록(d2r_relist_trade_post)·운영진은 그대로
-- 016 다음에 실행. 여러 번 실행해도 됨

create or replace function public.d2r_trade_post_edit_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.d2r_is_staff() or current_setting('d2r.bump', true) = '1' then
    return new;
  end if;
  if (new.category, new.item_id, new.item_name, new.ethereal, new.author_id)
     is distinct from (old.category, old.item_id, old.item_name, old.ethereal, old.author_id) then
    raise exception '판매 아이템은 바꿀 수 없음 - 다른 아이템이면 새 판매글로' using errcode = '42501';
  end if;
  if (new.price, new.options, new.amount_label, new.realm, new.ladder, new.hardcore, new.contact, new.content)
     is distinct from (old.price, old.options, old.amount_label, old.realm, old.ladder, old.hardcore, old.contact, old.content) then
    if old.status <> '판매중' then
      raise exception '판매중인 글만 수정 가능' using errcode = '42501';
    end if;
    if exists (select 1 from public.tb_trade_request where post_id = old.id and status in ('pending', 'accepted')) then
      raise exception '구매신청이 들어온 글은 수정 불가 - 신청을 거절하거나 취소되면 가능' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.d2r_trade_post_edit_guard() from public, anon, authenticated;
drop trigger if exists trg_trade_post_edit_guard on public.tb_trade_post;
create trigger trg_trade_post_edit_guard before update on public.tb_trade_post
  for each row execute function public.d2r_trade_post_edit_guard();

notify pgrst, 'reload schema';

-- 확인: 1줄 나오면 정상
select '판매글 수정 규칙' as 항목, tgname as 이름 from pg_trigger
 where tgrelid = 'public.tb_trade_post'::regclass and tgname = 'trg_trade_post_edit_guard';
