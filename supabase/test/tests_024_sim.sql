-- 024 대규모 모의 검사: 회원 40명이 이벤트 중 판매글을 마구 올리고·지우고, 운영진이 제외하고, 추첨
-- 실행 순서: test/base_stub.sql → 002 → 이 파일
\set ON_ERROR_STOP on
drop table public.tb_trade_post cascade;
create table public.tb_trade_post (
  id bigint generated always as identity primary key,
  author_id uuid not null references public.tb_profile(id),
  item_name text not null, category text, status text default '판매중',
  created_at timestamptz default now(), updated_at timestamptz, deleted_at timestamptz
);
create table if not exists public.tb_notification (id bigint generated always as identity primary key, user_id uuid, text text, link text, created_at timestamptz default now());
\ir ../024_events.sql
create or replace function z_ok(label text, cond boolean) returns void language plpgsql as $$
begin if cond then raise notice '  OK   %', label; else raise exception '실패: %', label; end if; end $$;

-- 잡템 판정
select z_ok('잡템: 엘 룬', d2r_event_is_junk('엘 룬'));
select z_ok('잡템: 잡룬 묶음', d2r_event_is_junk('엘 룬 3개 + 엘드 룬 2개 + 룸 룬 1개'));
select z_ok('잡템: 일반 보석 묶음', d2r_event_is_junk('자수정 3개 + 상급 루비 1개'));
select z_ok('인정: 섞인 묶음 (베르 포함)', not d2r_event_is_junk('엘 룬 3개 + 베르 룬 1개'));
select z_ok('인정: 최상급 보석', not d2r_event_is_junk('최상급 자수정 5개'));
select z_ok('인정: 코 룬', not d2r_event_is_junk('코 룬'));
select z_ok('인정: 유니크', not d2r_event_is_junk('할리퀸 관모'));
select z_ok('인정: 이름에 룬이 들어간 다른 것', not d2r_event_is_junk('룸 룬워드 베이스'));

-- 회원 40명 + 운영진 1명
insert into public.tb_profile (id, nickname, role)
select ('00000000-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid, '회원' || g, 'user' from generate_series(1, 40) g;
insert into public.tb_profile (id, nickname, role) values ('00000000-0000-0000-0000-0000000000aa', '운영자', 'admin');
insert into public.tb_event (title, starts_at, ends_at, draw_at, drand_round, ticket_cap, prizes) values
  ('대규모', now() - interval '1 hour', now() + interval '1 hour', now() + interval '2 hours', 1, 5,
   '[{"rank":3,"label":"3등","item":"c"},{"rank":1,"label":"1등","item":"a"},{"rank":2,"label":"2등","item":"b"}]');

-- 판매글 600개: 좋은 템·잡룬·골드·잡룬 묶음·같은 아이템 반복이 섞임 (재현되게 setseed)
select setseed(0.42);
create temp table items(n int, name text, cat text);
insert into items values (1,'베르 룬','룬'),(2,'자 룬','룬'),(3,'이스트 룬','룬'),(4,'엘 룬','룬'),(5,'룸 룬','룬'),(6,'골드','골드'),
  (7,'엘 룬 3개 + 탈 룬 2개','룬'),(8,'할리퀸 관모','유니크/세트'),(9,'그리폰의 눈','유니크/세트'),(10,'수수께끼','룬워드'),
  (11,'자수정','퍼펙트 보석'),(12,'최상급 자수정','퍼펙트 보석'),(13,'레어 서클릿','매직/레어/일반'),(14,'파괴의 열쇠','우버보스 재료'),
  (15,'엘 룬 1개 + 베르 룬 1개','룬'),(16,'애니','유니크/세트'),(17,'지옥불 횃불','유니크/세트'),(18,'샤코','유니크/세트');
insert into public.tb_trade_post (author_id, item_name, category)
select u, i.name, i.cat from (
  select ('00000000-0000-0000-0000-' || lpad((1 + floor(random() * 40))::int::text, 12, '0'))::uuid as u, 1 + floor(random() * 18)::int as k
    from generate_series(1, 600)) r join items i on i.n = r.k;
insert into public.tb_trade_post (author_id, item_name, category) select '00000000-0000-0000-0000-0000000000aa', '베르 룬', '룬' from generate_series(1, 5);

select z_ok('1인 최대 5장 넘는 사람 없음', not exists (select 1 from tb_event_entry where not excluded group by user_id having count(*) > 5));
select z_ok('잡템·골드 응모 없음', not exists (select 1 from tb_event_entry where d2r_event_is_junk(item_name) or category = '골드'));
select z_ok('운영진 응모 없음', not exists (select 1 from tb_event_entry where user_id = '00000000-0000-0000-0000-0000000000aa'));
select z_ok('같은 사람·같은 아이템 응모 하나뿐', not exists (select 1 from tb_event_entry where not excluded group by user_id, item_name having count(*) > 1));
select z_ok('응모 기록 = 실제 판매글', not exists (select 1 from tb_event_entry en left join tb_trade_post p on p.id = en.post_id where p.id is null or p.author_id <> en.user_id or p.item_name <> en.item_name));
-- 인정될 수 있는 글이 5종류 이상인 사람은 꼭 5장
select z_ok('좋은 템을 5종류 이상 올린 사람은 5장',
  not exists (select 1 from (select author_id, count(distinct item_name) c from tb_trade_post where author_id <> '00000000-0000-0000-0000-0000000000aa'
                and category <> '골드' and not d2r_event_is_junk(item_name) group by author_id) x
              where x.c >= 5 and (select count(*) from tb_event_entry where user_id = x.author_id and not excluded) <> 5));

-- 추첨 시각 전에 글 지우기 (삭제 표시 30개 + 완전 삭제 10개) → 제외, 빈자리는 새 글로 다시 채워짐
update tb_trade_post set deleted_at = now() where id in (select post_id from tb_event_entry order by id limit 30);
select z_ok('삭제 표시 30개 제외', (select count(*) from tb_event_entry where excluded_reason = '삭제한 글') = 30);
delete from tb_trade_post where id in (select post_id from tb_event_entry where not excluded order by id desc limit 10);
select z_ok('완전 삭제 10개 더 제외', (select count(*) from tb_event_entry where excluded_reason = '삭제한 글') = 40);
-- 지운 사람 중 한 명이 새 글 → 다시 응모 (최대 5장 안에서)
insert into tb_trade_post (author_id, item_name, category)
select user_id, '새로 올린 템', '기타' from tb_event_entry where excluded_reason = '삭제한 글' order by id limit 1;
select z_ok('지운 자리에 새 글 응모', exists (select 1 from tb_event_entry where item_name = '새로 올린 템' and not excluded));
select z_ok('그래도 5장 넘는 사람 없음', not exists (select 1 from tb_event_entry where not excluded group by user_id having count(*) > 5));

-- 운영진 제외 (검토 시간)
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000aa', false);
update tb_event_entry set excluded = true, excluded_reason = '잡템' where item_name = '레어 서클릿';
reset role;
select z_ok('운영진 제외 반영', not exists (select 1 from tb_event_entry where item_name = '레어 서클릿' and not excluded));

-- 시간 흘리기: 끝 + 추첨 시각 지남
alter table tb_event disable trigger trg_event_guard;
update tb_event set starts_at = now() - interval '3 hours', ends_at = now() - interval '2 hours', draw_at = now() - interval '1 hour';
alter table tb_event enable trigger trg_event_guard;
create temp table snap as select id, excluded from tb_event_entry;
update tb_trade_post set deleted_at = now() where deleted_at is null and id in (select post_id from tb_event_entry where not excluded limit 20);
insert into tb_trade_post (author_id, item_name, category) values ('00000000-0000-0000-0000-000000000001', '끝난 뒤', '룬');
select z_ok('추첨 시각 지난 뒤 삭제·새 글은 목록에 영향 없음',
  (select count(*) from tb_event_entry) = (select count(*) from snap)
  and not exists (select 1 from tb_event_entry e join snap s using (id) where e.excluded <> s.excluded));

-- 공정성: 무작위 난수 2만 개로 1등을 뽑아 응모권 비율과 비교 (같은 사람 1등 확률 = 그 사람 응모권 / 전체)
create temp table share as select user_id, count(*)::float / (select count(*) from tb_event_entry where not excluded) as p
  from tb_event_entry where not excluded group by user_id;
create temp table firsts as
  select (select x.user_id from d2r_event_pick((select id from tb_event), encode(sha256(('seed' || g)::bytea), 'hex')) x where x.rank = 1) as user_id
    from generate_series(1, 20000) g;
select z_ok('1등 확률이 응모권 비율과 맞음 (최대 오차 1.5%p 이하)',
  (select max(abs(coalesce(f.c, 0) / 20000.0 - s.p)) from share s left join (select user_id, count(*) c from firsts group by user_id) f using (user_id)) < 0.015);
select z_ok('응모권 없는 사람은 한 번도 1등 안 됨', not exists (select 1 from firsts f where not exists (select 1 from tb_event_entry e where e.user_id = f.user_id and not e.excluded)));

-- 추첨 (상품 순서가 3,1,2 로 섞여 있어도 1등부터)
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000aa', false);
select d2r_event_draw((select id from tb_event), encode(sha256('real'::bytea), 'hex'));
reset role;
select z_ok('당첨 3명, 등수 1·2·3 순서, 서로 다른 사람',
  (select array_agg((w ->> 'rank')::int order by ord) = array[1,2,3] and count(distinct w ->> 'user_id') = 3
     from tb_event, jsonb_array_elements(result -> 'winners') with ordinality as t(w, ord)));
select z_ok('당첨자 모두 응모권 있음', not exists (select 1 from tb_event, jsonb_array_elements(result -> 'winners') w
  where not exists (select 1 from tb_event_entry e where e.user_id = (w ->> 'user_id')::uuid and not e.excluded)));
select z_ok('당첨 응모권 = 그 사람 것', not exists (select 1 from tb_event, jsonb_array_elements(result -> 'winners') w
  join tb_event_entry e on e.id = (w ->> 'entry_id')::bigint where e.user_id <> (w ->> 'user_id')::uuid or e.excluded));
select z_ok('응모자 요약 합계 = 응모권 합계', (select sum((x ->> 'tickets')::int) from tb_event, jsonb_array_elements(result -> 'entries') x)
  = (select (result ->> 'tickets_total')::int from tb_event));
select z_ok('당첨 알림 3개', (select count(*) from tb_notification) = 3);

-- 경계: 응모자 1명인데 상품 3개 / 응모 0개
insert into tb_event (title, starts_at, ends_at, draw_at, drand_round, prizes) values
  ('한 명', now() - interval '3 hours', now() - interval '2 hours', now() - interval '1 hour', 1, '[{"rank":1,"label":"1등","item":"a"},{"rank":2,"label":"2등","item":"b"},{"rank":3,"label":"3등","item":"c"}]'),
  ('빈 이벤트', now() - interval '3 hours', now() - interval '2 hours', now() - interval '1 hour', 1, '[{"rank":1,"label":"1등","item":"a"}]');
insert into tb_event_entry (event_id, user_id, post_id, nickname, item_name)
select (select id from tb_event where title = '한 명'), '00000000-0000-0000-0000-000000000001', 900000 + g, '회원1', 'x' || g from generate_series(1, 5) g;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000aa', false);
select d2r_event_draw((select id from tb_event where title = '한 명'), repeat('ab', 32));
select d2r_event_draw((select id from tb_event where title = '빈 이벤트'), repeat('cd', 32));
reset role;
select z_ok('응모자 1명이면 1등만', (select jsonb_array_length(result -> 'winners') from tb_event where title = '한 명') = 1);
select z_ok('응모 0개면 당첨자 없음 (오류 없이)', (select jsonb_array_length(result -> 'winners') from tb_event where title = '빈 이벤트') = 0);
select '0건 실패' as 결과;
