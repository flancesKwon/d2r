-- 010: 글 사진 첨부 + 에디터 HTML 대응
--  1) 사진 저장소(post-images): 누구나 보기, 로그인 회원이 자기 폴더(<내 id>/)에만 올림
--     - 파일 하나 5MB, 사진 형식만 (webp·jpeg·png·gif) / 이용 정지 중이면 못 올림 / 1시간에 60장까지
--     - 자기 사진은 보고 지울 수 있음
--  2) 금칙어 검사: 본문이 HTML 이 되므로 태그를 빼고 검사 (현<b>거</b>래 같은 우회 막기)
--  3) 운영진 삭제 기록: 본문 요약에서 태그 빼기
-- 여러 번 실행해도 됨

-- ─── 1) 사진 저장소 ───
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-images', 'post-images', true, 5242880, array['image/webp', 'image/jpeg', 'image/png', 'image/gif'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- 최근 1시간에 올린 사진 수 확인 (정책 안에서 storage.objects 를 다시 읽으므로 security definer)
create or replace function public.d2r_image_quota_ok() returns boolean
language sql stable security definer set search_path = public, storage as $$
  select count(*) < 60 from storage.objects
   where bucket_id = 'post-images' and owner_id = auth.uid()::text and created_at > now() - interval '1 hour'
$$;
revoke all on function public.d2r_image_quota_ok() from public, anon;
grant execute on function public.d2r_image_quota_ok() to authenticated;

drop policy if exists post_images_insert on storage.objects;
create policy post_images_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'post-images'
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.d2r_is_active()
  and public.d2r_image_quota_ok()
);

-- 자기 파일 조회 (지우기에 필요, 공개 주소로 보는 건 정책 없이 됨)
drop policy if exists post_images_select_own on storage.objects;
create policy post_images_select_own on storage.objects for select to authenticated
using (bucket_id = 'post-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists post_images_delete on storage.objects;
create policy post_images_delete on storage.objects for delete to authenticated
using (bucket_id = 'post-images' and (storage.foldername(name))[1] = auth.uid()::text);

-- ─── 2) 금칙어 검사: 태그 빼고 ───
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
  body := replace(regexp_replace(body, '<[^>]*>', '', 'g'), '&nbsp;', ' ');
  select word into hit from public.tb_banned_word
   where position(lower(regexp_replace(word, '\s', '', 'g')) in lower(regexp_replace(body, '\s', '', 'g'))) > 0
   limit 1;
  if hit is not null then
    raise exception '금칙어 포함: %', hit using errcode = 'P0001', hint = 'banned_word';
  end if;
  return new;
end $$;

-- ─── 3) 운영진 삭제 기록: 요약에서 태그 빼기 ───
create or replace function public.d2r_log_staff_delete() returns trigger
language plpgsql security definer set search_path = public as $$
declare j jsonb := to_jsonb(old);
begin
  if auth.uid() is not null and auth.uid() is distinct from (j->>'author_id')::uuid and public.d2r_is_staff() then
    perform public.d2r_log('삭제', tg_table_name, j->>'id',
      coalesce(j->>'title', j->>'item_name', left(regexp_replace(j->>'content', '<[^>]*>', ' ', 'g'), 100)));
  end if;
  return old;
end $$;
