-- 042: 게시판 언어 분리 (한국어 글 / 영어 글) - 공지 포함
--  - lang 컬럼: 글 쓸 때 보고 있던 언어('ko' | 'en'). 기존 글은 전부 'ko'
-- 여러 번 실행해도 됨

alter table public.tb_community_post add column if not exists lang text not null default 'ko';
alter table public.tb_community_post drop constraint if exists tb_community_post_lang_check;
alter table public.tb_community_post add constraint tb_community_post_lang_check check (lang in ('ko', 'en'));
create index if not exists tb_community_post_lang_idx on public.tb_community_post (lang, created_at desc);
