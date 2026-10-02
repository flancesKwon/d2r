-- 디아허브 010: 커뮤니티 글·댓글 이미지 첨부 (Supabase Storage)
-- 002 다음 아무 때나 Supabase SQL Editor 에서 한 번 실행. 여러 번 돌려도 안전함.
-- - 버킷 community-images: 누구나 볼 수 있음(공개 주소), 2MB 이하 png/jpeg/webp/gif 만
-- - 올리기: 로그인 + 정지 아님 + 내 폴더(<내 uuid>/...)에만 + 1시간 30장까지
-- - 지우기: 올린 사람 또는 운영진
-- 검사: supabase/test/run.sh

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('community-images', 'community-images', true, 2097152, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 최근 1시간에 내가 올린 장수 (정책 안에서 storage.objects 를 다시 읽으면 재귀라 함수로)
create or replace function public.d2r_recent_upload_count() returns int
language sql stable security definer set search_path = public, storage as $$
  select count(*)::int from storage.objects
   where bucket_id = 'community-images' and owner = auth.uid() and created_at > now() - interval '1 hour'
$$;
revoke all on function public.d2r_recent_upload_count() from public, anon;
grant execute on function public.d2r_recent_upload_count() to authenticated;

drop policy if exists d2r_community_images_read on storage.objects;
create policy d2r_community_images_read on storage.objects
  for select using (bucket_id = 'community-images');

drop policy if exists d2r_community_images_insert on storage.objects;
create policy d2r_community_images_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'community-images'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.d2r_is_active()
    and public.d2r_recent_upload_count() < 30
  );

drop policy if exists d2r_community_images_delete on storage.objects;
create policy d2r_community_images_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'community-images'
    and (owner = auth.uid() or public.d2r_is_staff())
  );

commit;
