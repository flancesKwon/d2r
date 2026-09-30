-- 002 검사. run.sh 가 (schema.sql 또는 base_stub.sql) → 002 → 002 (재실행) → 이 파일 순서로 돌림
-- 각 줄: 누구로(as_*) 무엇을 하고, 되거나(expect_ok) 막혀야(expect_fail) 하는지
\set QUIET on
\pset format unaligned
\pset tuples_only on

create table public._t (n serial, name text, pass boolean, detail text);
grant all on public._t to anon, authenticated;
grant usage on sequence public._t_n_seq to anon, authenticated;

-- sql 을 실행해서 성공/실패를 기록. 실패해야 하는 건 에러가 나거나 0건이어야 통과
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

-- 회원: A=최고관리자, M=운영진, U1·U2=일반, M2=운영진
insert into public.tb_profile(id, nickname, role) values
  ('00000000-0000-0000-0000-00000000000a', '관리자', 'admin'),
  ('00000000-0000-0000-0000-0000000000b1', '유저1', 'user'),
  ('00000000-0000-0000-0000-0000000000b2', '유저2', 'user');
insert into public.tb_profile(id, nickname) values ('00000000-0000-0000-0000-0000000000c1', '운영1'), ('00000000-0000-0000-0000-0000000000c2', '운영2');
update public.tb_profile set role = 'moderator' where id in ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c2');

select public._run('role: 없는 등급은 거부', $$update public.tb_profile set role = 'boss' where nickname = '유저2'$$, false);

insert into public.tb_community_post(author_id, title) values ('00000000-0000-0000-0000-0000000000b2', '유저2 글');
insert into public.tb_community_comment(post_id, author_id, content) values (1, '00000000-0000-0000-0000-0000000000b2', '유저2 댓글');
insert into public.tb_trade_post(id, author_id, item_name) values ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-0000000000b2', '샤코');

\set U1 '''00000000-0000-0000-0000-0000000000b1'''
\set U2 '''00000000-0000-0000-0000-0000000000b2'''
\set M '''00000000-0000-0000-0000-0000000000c1'''
\set A '''00000000-0000-0000-0000-00000000000a'''

-- ── 비로그인
set role anon;
select set_config('request.jwt.claim.sub', '', false);
select public._run('anon: 신고 목록 못 봄', 'select * from public.tb_report', false);
select public._run('anon: 신고 못 넣음', $$insert into public.tb_report(target_type, target_id, reason) values ('community_post', '1', 'spam')$$, false);
select public._run('anon: 글 목록은 보임', 'select * from public.tb_community_post', true);

-- ── 유저1: 신고
reset role; set role authenticated;
select set_config('request.jwt.claim.sub', :U1, false);
select public._run('U1: 남의 글 신고', $$insert into public.tb_report(target_type, target_id, reason, detail) values ('community_post', '1', 'spam', '광고')$$, true);
select public._run('U1: 같은 글 두 번 신고 불가', $$insert into public.tb_report(target_type, target_id, reason) values ('community_post', '1', 'abuse')$$, false);
select public._run('U1: 댓글 신고', $$insert into public.tb_report(target_type, target_id, reason) values ('community_comment', '1', 'abuse')$$, true);
select public._run('U1: 판매글 신고', $$insert into public.tb_report(target_type, target_id, reason) values ('trade_post', '11111111-1111-1111-1111-111111111111', 'scam')$$, true);
select public._run('U1: 없는 글 신고 불가', $$insert into public.tb_report(target_type, target_id, reason) values ('community_post', '999', 'spam')$$, false);
select public._run('U1: 없는 사유 불가', $$insert into public.tb_report(target_type, target_id, reason) values ('profile', '00000000-0000-0000-0000-0000000000b2', 'hate')$$, false);
select public._run('U1: 신고자·상태를 속여서 넣어도', $$insert into public.tb_report(reporter_id, target_type, target_id, reason, status, handled_by) values ('00000000-0000-0000-0000-00000000000a', 'profile', '00000000-0000-0000-0000-0000000000b2', 'etc', 'resolved', '00000000-0000-0000-0000-00000000000a')$$, true);
select public._check('U1: 신고자는 본인으로 찍힘', (select count(*) = 4 from public.tb_report where reporter_id = :U1));
select public._check('U1: 상태는 open, 처리자는 비어서 들어감', (select bool_and(status = 'open' and handled_by is null) from public.tb_report));
select public._check('U1: 제목·작성자 서버가 채움', (select target_label = '유저2 글' and target_author_id = :U2 from public.tb_report where target_type = 'community_post'));
select public._check('U1: 댓글 신고에 글 번호 채움', (select target_post_id = '1' from public.tb_report where target_type = 'community_comment'));
select public._run('U1: 신고 상태 못 바꿈', $$update public.tb_report set status = 'dismissed'$$, false);
select public._run('U1: 신고 지우기 불가', 'delete from public.tb_report', false);
select public._run('U1: 정지 못 함', $$update public.tb_profile set suspended_until = 'infinity' where nickname = '유저2'$$, false);
select public._run('U1: 운영진 못 됨', $$update public.tb_profile set role = 'moderator' where id = auth.uid()$$, false);
select public._run('U1: 내 닉네임 수정은 됨', $$update public.tb_profile set nickname = '유저1a' where id = auth.uid()$$, true);

-- ── 유저2: 내 글 신고 불가, 남의 신고 안 보임
select set_config('request.jwt.claim.sub', :U2, false);
select public._run('U2: 내 글 신고 불가', $$insert into public.tb_report(target_type, target_id, reason) values ('community_post', '1', 'spam')$$, false);
select public._run('U2: 남의 신고 안 보임', 'select * from public.tb_report', false);

-- ── 운영진
select set_config('request.jwt.claim.sub', :M, false);
select public._check('M: 신고 전부 보임', (select count(*) = 4 from public.tb_report));
select public._run('M: 신고 처리', $$update public.tb_report set status = 'resolved' where target_type = 'community_post'$$, true);
select public._check('M: 처리자·시간 자동', (select handled_by = :M and handled_at is not null from public.tb_report where target_type = 'community_post'));
select public._run('M: 신고 내용 수정 불가', $$update public.tb_report set reason = 'etc' where target_type = 'trade_post'$$, false);
select public._run('M: 신고 지우기 불가(최고관리자만)', 'delete from public.tb_report', false);
select public._run('M: 유저2 7일 정지', $$update public.tb_profile set suspended_until = now() + interval '7 days', suspended_reason = '광고' where nickname = '유저2'$$, true);
select public._run('M: 남 닉네임 수정 불가', $$update public.tb_profile set nickname = '바보' where nickname = '유저1a'$$, false);
select public._run('M: 정지하면서 닉네임 몰래 수정 불가', $$update public.tb_profile set suspended_until = null, nickname = 'x' where nickname = '유저1a'$$, false);
select public._run('M: 다른 운영진 정지 불가', $$update public.tb_profile set suspended_until = 'infinity' where nickname = '운영2'$$, false);
select public._run('M: 관리자 정지 불가', $$update public.tb_profile set suspended_until = 'infinity' where nickname = '관리자'$$, false);
select public._run('M: 본인 정지 불가', $$update public.tb_profile set suspended_until = 'infinity' where id = auth.uid()$$, false);
select public._run('M: 등급 변경 불가', $$update public.tb_profile set role = 'admin' where nickname = '유저1a'$$, false);
select public._run('M: 남의 글 수정 불가', $$update public.tb_community_post set title = 'x'$$, false);

-- ── 정지된 유저2
select set_config('request.jwt.claim.sub', :U2, false);
select public._run('정지: 글 못 씀', $$insert into public.tb_community_post(title) values ('도배')$$, false);
select public._run('정지: 댓글 못 씀', $$insert into public.tb_community_comment(post_id, content) values (1, '도배')$$, false);
select public._run('정지: 판매글 못 씀', $$insert into public.tb_trade_post(item_name) values ('도배')$$, false);
select public._run('정지: 쪽지 못 보냄', $$insert into public.tb_dm_message(body) values ('도배')$$, false);
select public._run('정지: 신고 못 넣음', $$insert into public.tb_report(target_type, target_id, reason) values ('profile', '00000000-0000-0000-0000-0000000000b1', 'etc')$$, false);
select public._run('정지: 기존 글 수정 못 함', $$update public.tb_community_post set title = '수정'$$, false);
select public._run('정지: 스스로 해제 못 함', $$update public.tb_profile set suspended_until = null where id = auth.uid()$$, false);
select public._run('정지: 닉네임 수정은 됨', $$update public.tb_profile set nickname = '유저2a' where id = auth.uid()$$, true);
select public._run('정지: 글 읽기는 됨', 'select * from public.tb_community_post', true);

-- ── 운영진: 삭제
select set_config('request.jwt.claim.sub', :M, false);
select public._run('M: 남의 댓글 삭제', 'delete from public.tb_community_comment', true);
select public._run('M: 남의 판매글 삭제', 'delete from public.tb_trade_post', true);

-- ── 최고관리자
select set_config('request.jwt.claim.sub', :A, false);
select public._run('A: 운영진 정지 가능', $$update public.tb_profile set suspended_until = now() + interval '1 day' where nickname = '운영2'$$, true);
select public._run('A: 운영진 지정', $$update public.tb_profile set role = 'moderator' where nickname = '유저1a'$$, true);
select public._run('A: 유저2 정지 해제', $$update public.tb_profile set suspended_until = null, suspended_reason = null where nickname = '유저2a'$$, true);
select public._run('A: 신고 지우기', $$delete from public.tb_report where target_type = 'profile'$$, true);

-- ── 해제된 유저2 / 기간 지난 정지
select set_config('request.jwt.claim.sub', :U2, false);
select public._run('해제 후: 다시 글 씀', $$insert into public.tb_community_post(title) values ('복귀')$$, true);
reset role;
select set_config('request.jwt.claim.sub', '', false);
update public.tb_profile set suspended_until = now() - interval '1 minute' where nickname = '유저2a';
set role authenticated;
select set_config('request.jwt.claim.sub', :U2, false);
select public._run('정지 기간 지남: 글 씀', $$insert into public.tb_community_post(title) values ('기간 지남')$$, true);

reset role;
select case when pass then 'ok   ' else 'FAIL ' end || name || case when pass then '' else ' — ' || coalesce(detail, '') end from public._t order by n;
select format('%s건 중 %s건 실패', count(*), count(*) filter (where not pass)) from public._t;
