-- 실제 스키마 흉내: 판매글 분류 제약(골드 없음) + 구매신청 표 (판매자·신청자만 읽기)
alter table public.tb_trade_post add column category text not null default '기타';
alter table public.tb_trade_post add constraint tb_trade_post_category_check
  check (category in ('룬', '퍼펙트 보석', '우버보스 재료', '정수·징표', '유니크/세트', '룬워드', '매직/레어/일반', '기타'));
create table public.tb_trade_request (
  id bigint generated always as identity primary key,
  post_id uuid not null references public.tb_trade_post(id) on delete cascade,
  buyer_id uuid not null default auth.uid() references public.tb_profile(id),
  qty int not null default 1, message text, status text not null default 'pending',
  created_at timestamptz default now()
);
alter table public.tb_trade_request enable row level security;
create policy r_sel on public.tb_trade_request for select to authenticated
  using (buyer_id = auth.uid() or exists (select 1 from public.tb_trade_post p where p.id = post_id and p.author_id = auth.uid()));
create policy r_ins on public.tb_trade_request for insert to authenticated with check (buyer_id = auth.uid());
create policy r_upd on public.tb_trade_request for update to authenticated
  using (buyer_id = auth.uid() or exists (select 1 from public.tb_trade_post p where p.id = post_id and p.author_id = auth.uid()));
grant select, insert, update on public.tb_trade_post, public.tb_trade_request to authenticated;
grant select on public.tb_trade_post to anon;

insert into public.tb_profile (id, nickname) values
  ('00000000-0000-0000-0000-00000000000a', '판매자'), ('00000000-0000-0000-0000-00000000000b', '구매자'), ('00000000-0000-0000-0000-00000000000c', '구경꾼');
insert into public.tb_trade_post (id, author_id, item_name, category) values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', '샤코', '유니크/세트');
insert into public.tb_trade_post (author_id, item_name, category) values ('00000000-0000-0000-0000-00000000000a', '옛날 분류 글', '기타');
insert into public.tb_trade_request (post_id, buyer_id, message) values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', '가격 제안 - 제안: 이스트 룬 1개');
