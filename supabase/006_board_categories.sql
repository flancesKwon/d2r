-- ============================================================
--  006 커뮤니티 카테고리 추가: 건의, 버그제보
--  프론트 목록(src/communityStore.js CATEGORIES)과 같아야 함
--  다시 실행해도 안전. 적용: Supabase SQL Editor 에 통째로 붙여 넣고 Run
-- ============================================================
do $$
declare r record;
begin
  -- 이름 없이 만든 category 체크 제약을 찾아서 지움
  for r in select conname from pg_constraint
            where conrelid = 'public.tb_community_post'::regclass and contype = 'c'
              and pg_get_constraintdef(oid) ~* '\mcategory\M' loop
    execute format('alter table public.tb_community_post drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.tb_community_post add constraint tb_community_post_category_check
  check (category in ('질문', '거래', '잡담', '공략', '건의', '버그제보'));
