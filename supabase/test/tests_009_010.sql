-- 009(신고 알림·로그인 기록) · 010(이미지 첨부) 검사
-- run.sh 가 base_stub → 002 → 009 ×2 → 010 ×2 → 이 파일 순서로 돌림
\set QUIET on
\pset format unaligned
\pset tuples_only on

create table public._t (n serial, name text, pass boolean, detail text);
grant all on public._t to anon, authenticated;
grant usage on sequence public._t_n_seq to anon, authenticated;
create function public._run(name text, sql text, want_ok boolean) returns void language plpgsql as $$
declare n bigint;
begin
  begin
    execute sql;
    get diagnostics n = row_count;
    if want_ok then
      insert into public._t(name, pass, detail) values (name, n > 0, n || '건');
    else
      insert into public._t(name, pass, detail) values (name, n = 0, '막혀야 하는데 ' || n || '건 됨');
    end if;
  exception when others then
    insert into public._t(name, pass, detail) values (name, not want_ok, sqlerrm);
  end;
end $$;
create function public._check(name text, cond boolean, detail text default '') returns void language sql as $$
  insert into public._t(name, pass, detail) values (name, coalesce(cond, false), detail)
$$;
grant execute on function public._run(text, text, boolean), public._check(text, boolean, text) to anon, authenticated;

\set A '''00000000-0000-0000-0000-00000000000a'''
\set M '''00000000-0000-0000-0000-0000000000c1'''
\set U1 '''00000000-0000-0000-0000-0000000000b1'''
\set U2 '''00000000-0000-0000-0000-0000000000b2'''

insert into public.tb_profile(id, nickname, role) values
  ('00000000-0000-0000-0000-00000000000a', '관리자', 'admin'),
  ('00000000-0000-0000-0000-0000000000b1', '유저1', 'user'),
  ('00000000-0000-0000-0000-0000000000b2', '유저2', 'user');
insert into public.tb_profile(id, nickname) values ('00000000-0000-0000-0000-0000000000c1', '운영1');
update public.tb_profile set role = 'moderator' where nickname = '운영1';
insert into auth.users(id, raw_app_meta_data) select id, '{"provider":"discord"}' from public.tb_profile;
insert into public.tb_community_post(author_id, title) values (:U2, '유저2 글');

-- ── 009-1 신고 → 운영진 알림
set role authenticated;
select set_config('request.jwt.claim.sub', :U1, false);
select public._run('U1: 신고', $$insert into public.tb_report(target_type, target_id, reason) values ('community_post', '1', 'spam')$$, true);
reset role;
select public._check('알림: 운영진·관리자 2명에게', (select count(*) = 2 from public.tb_notification where link = '/admin'));
select public._check('알림: 신고자·일반회원은 안 받음', (select count(*) = 0 from public.tb_notification where user_id in (:U1, :U2)));
select public._check('알림: 문구에 대상', (select bool_and(text = '새 신고: 커뮤니티 글 "유저2 글"') from public.tb_notification));
set role authenticated;
select set_config('request.jwt.claim.sub', :U1, false);
select public._run('U1: 알림 직접 못 만듦', $$insert into public.tb_notification(user_id, text) values ('00000000-0000-0000-0000-0000000000b1', '가짜')$$, false);

-- ── 009-2 로그인 기록
reset role;
select set_config('request.jwt.claim.sub', '', false);
update auth.users set last_sign_in_at = now() where id = :U1;
update auth.users set raw_app_meta_data = '{"provider":"google"}' where id = :U1; -- 로그인 시각 안 바뀜
update auth.users set last_sign_in_at = now() + interval '1 second', raw_app_meta_data = '{"provider":"google"}' where id = :U2;
select public._check('로그인: 한 번에 한 줄', (select count(*) = 1 from public.tb_login_log where user_id = :U1));
select public._check('로그인: 로그인 시각이 안 바뀌면 안 남음', (select count(*) = 2 from public.tb_login_log));
select public._check('로그인: 방식(provider) 기록', (select provider = 'google' from public.tb_login_log where user_id = :U2));
do $$ begin
  for i in 1..105 loop
    update auth.users set last_sign_in_at = now() + make_interval(mins => i) where id = '00000000-0000-0000-0000-0000000000b1';
  end loop;
end $$;
select public._check('로그인: 사람마다 100건만', (select count(*) = 100 from public.tb_login_log where user_id = :U1));
insert into auth.users(id) values ('00000000-0000-0000-0000-0000000000ff');
select public._run('로그인: 프로필 없는 계정도 로그인은 됨', $$update auth.users set last_sign_in_at = now() where id = '00000000-0000-0000-0000-0000000000ff'$$, true);

set role anon;
select public._run('anon: 로그인 기록 못 봄', 'select * from public.tb_login_log', false);
set role authenticated;
select set_config('request.jwt.claim.sub', :U2, false);
select public._check('U2: 내 기록만 보임', (select count(*) = 1 from public.tb_login_log));
select public._run('U2: 기록 못 넣음', $$insert into public.tb_login_log(user_id) values ('00000000-0000-0000-0000-0000000000b2')$$, false);
select public._run('U2: 기록 못 지움', 'delete from public.tb_login_log', false);
select set_config('request.jwt.claim.sub', :M, false);
select public._check('운영진: 전부 보임', (select count(*) = 101 from public.tb_login_log));

-- ── 010 이미지
reset role;
select public._check('버킷: 공개, 2MB, 이미지만', (select public and file_size_limit = 2097152 and 'image/png' = any(allowed_mime_types) and not ('text/html' = any(allowed_mime_types)) from storage.buckets where id = 'community-images'));
set role authenticated;
select set_config('request.jwt.claim.sub', :U1, false);
select public._run('U1: 내 폴더에 올림', $$insert into storage.objects(bucket_id, name) values ('community-images', '00000000-0000-0000-0000-0000000000b1/a.png')$$, true);
select public._run('U1: 남의 폴더 불가', $$insert into storage.objects(bucket_id, name) values ('community-images', '00000000-0000-0000-0000-0000000000b2/a.png')$$, false);
select public._run('U1: 폴더 없이 불가', $$insert into storage.objects(bucket_id, name) values ('community-images', 'a.png')$$, false);
select public._run('U1: 다른 버킷 불가', $$insert into storage.objects(bucket_id, name) values ('other', '00000000-0000-0000-0000-0000000000b1/a.png')$$, false);
select set_config('request.jwt.claim.sub', :U2, false);
select public._run('U2: 남의 이미지 못 지움', $$delete from storage.objects where name like '00000000-0000-0000-0000-0000000000b1/%'$$, false);
set role anon;
select set_config('request.jwt.claim.sub', '', false);
select public._run('anon: 이미지 보기는 됨', $$select * from storage.objects where bucket_id = 'community-images'$$, true);
select public._run('anon: 올리기 불가', $$insert into storage.objects(bucket_id, name) values ('community-images', 'x/a.png')$$, false);
set role authenticated;
select set_config('request.jwt.claim.sub', :U1, false);
do $$ begin
  for i in 2..29 loop
    insert into storage.objects(bucket_id, name) values ('community-images', '00000000-0000-0000-0000-0000000000b1/' || i || '.png');
  end loop;
end $$;
select public._run('U1: 1시간 30장째까지 됨', $$insert into storage.objects(bucket_id, name) values ('community-images', '00000000-0000-0000-0000-0000000000b1/30.png')$$, true);
select public._run('U1: 31장째 막힘', $$insert into storage.objects(bucket_id, name) values ('community-images', '00000000-0000-0000-0000-0000000000b1/31.png')$$, false);
select public._run('U1: 내 이미지 지움', $$delete from storage.objects where name = '00000000-0000-0000-0000-0000000000b1/30.png'$$, true);
select set_config('request.jwt.claim.sub', :M, false);
select public._run('운영진: 남의 이미지 지움', $$delete from storage.objects where name = '00000000-0000-0000-0000-0000000000b1/29.png'$$, true);
select public._run('운영진: 유저2 정지', $$update public.tb_profile set suspended_until = 'infinity' where nickname = '유저2'$$, true);
select set_config('request.jwt.claim.sub', :U2, false);
select public._run('정지: 이미지 못 올림', $$insert into storage.objects(bucket_id, name) values ('community-images', '00000000-0000-0000-0000-0000000000b2/a.png')$$, false);

reset role;
select case when pass then 'ok   ' else 'FAIL ' end || name || case when pass then '' else ' — ' || coalesce(detail, '') end from public._t order by n;
select format('%s건 중 %s건 실패', count(*), count(*) filter (where not pass)) from public._t;
