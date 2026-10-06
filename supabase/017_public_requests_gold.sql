-- 017: 구매신청·가격 제안 내역 공개 + 골드 판매
--  1) 구매신청(가격 제안 포함)을 누구나 볼 수 있게 - 판매자·신청자 말고도 (로그인 안 해도)
--     읽기만 여는 것: 신청·수락·거절·취소 권한은 그대로. 화면은 연락처를 판매자·본인에게만 보여줌
--  2) 판매글 분류에 '골드' 추가 - 분류(category)를 검사하는 제약이 있으면 '골드'를 넣어 다시 만듦
--     (없으면 아무것도 안 함. 예전 글은 다시 검사하지 않음 - not valid)
--  ※ '제안만 받기'는 DB 변경 없음 (판매가 칸에 '가격 제안 받음' 을 넣어 구분)
-- 여러 번 실행해도 됨

-- ─── 1) 구매신청 공개 읽기 ───
alter table public.tb_trade_request enable row level security;
drop policy if exists d2r_request_public_read on public.tb_trade_request;
create policy d2r_request_public_read on public.tb_trade_request
  for select to anon, authenticated using (true);
grant select on public.tb_trade_request to anon, authenticated;

-- ─── 2) 골드 분류 ───
do $$
declare c record; found_any boolean := false;
begin
  for c in
    select conname from pg_constraint
     where conrelid = 'public.tb_trade_post'::regclass and contype = 'c'
       and pg_get_constraintdef(oid) ~ '\mcategory\M'
       and conname <> 'd2r_trade_post_category'
  loop
    execute format('alter table public.tb_trade_post drop constraint %I', c.conname);
    found_any := true;
  end loop;
  if found_any or exists (select 1 from pg_constraint where conrelid = 'public.tb_trade_post'::regclass and conname = 'd2r_trade_post_category') then
    alter table public.tb_trade_post drop constraint if exists d2r_trade_post_category;
    alter table public.tb_trade_post add constraint d2r_trade_post_category check (category in (
      '룬', '퍼펙트 보석', '우버보스 재료', '정수·징표', '골드', '유니크/세트', '룬워드', '매직/레어/일반', '기타'
    )) not valid;
  end if;
end $$;

-- 확인: 정책 1줄 + (분류 제약이 있었으면) 제약 1줄
select '구매신청 공개 읽기' as 항목, policyname as 이름 from pg_policies
 where schemaname = 'public' and tablename = 'tb_trade_request' and policyname = 'd2r_request_public_read'
union all
select '판매글 분류 제약', conname from pg_constraint
 where conrelid = 'public.tb_trade_post'::regclass and conname = 'd2r_trade_post_category';
