-- ============================================================
--  003: 빌드 가이드 · 저장한 빌드  (schema.sql, 002_reports_suspension.sql 다음에 실행)
--  여러 번 실행해도 안전함 (있으면 건너뜀). 기존 테이블은 안 건드림.
--
--  TB_GUIDE        빌드 가이드 - 누구나 읽고, 운영진(moderator)·최고관리자(admin)만 쓰고 고치고 지움
--                  사이트에 있던 가이드 8개를 그대로 넣어 둠 (slug = 예전 주소 g-sorc-fire 등)
--  TB_SAVED_BUILD  스킬·스탯 시뮬레이터에서 저장한 빌드 - 본인만 보고 씀, 1인 100개까지
-- ============================================================
begin;

-- ── 1) 빌드 가이드 ──────────────────────────────────────────
create table if not exists public.tb_guide (
  id              bigint generated always as identity primary key,
  slug            text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  class_key       text not null check (class_key in ('amazon','sorc','necro','paladin','barb','druid','assassin','warlock')),
  class_name      text not null,
  title           text not null check (char_length(title) between 1 and 120),
  tier            text,
  description     text,
  summary         text,
  stat_priority   text,
  skill_order     jsonb not null default '[]'::jsonb,
  key_items       jsonb not null default '[]'::jsonb,
  leveling_notes  jsonb not null default '[]'::jsonb,
  strengths       jsonb not null default '[]'::jsonb,
  weaknesses      jsonb not null default '[]'::jsonb,
  published       boolean not null default true,
  author_id       uuid references public.tb_profile(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists tb_guide_class_idx on public.tb_guide (class_key, updated_at desc);

alter table public.tb_guide enable row level security;

drop policy if exists guides_read on public.tb_guide;
create policy guides_read on public.tb_guide
  for select using (published or public.d2r_is_staff());
drop policy if exists guides_staff_insert on public.tb_guide;
create policy guides_staff_insert on public.tb_guide
  for insert to authenticated with check (public.d2r_is_staff() and author_id = auth.uid());
drop policy if exists guides_staff_update on public.tb_guide;
create policy guides_staff_update on public.tb_guide
  for update to authenticated using (public.d2r_is_staff()) with check (public.d2r_is_staff());
drop policy if exists guides_staff_delete on public.tb_guide;
create policy guides_staff_delete on public.tb_guide
  for delete to authenticated using (public.d2r_is_staff());

-- 수정 시각은 서버가 넣음, 작성자·만든 시각은 못 바꿈
create or replace function public.d2r_guide_touch() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' then
    new.author_id := old.author_id;
    new.created_at := old.created_at;
  end if;
  return new;
end $$;
drop trigger if exists trg_guide_touch on public.tb_guide;
create trigger trg_guide_touch before insert or update on public.tb_guide
  for each row execute function public.d2r_guide_touch();

grant select on public.tb_guide to anon, authenticated;
grant insert, update, delete on public.tb_guide to authenticated;

-- 사이트에 있던 가이드 (이미 있으면 건너뜀)
insert into public.tb_guide
  (slug, class_key, class_name, title, tier, description, summary, stat_priority,
   skill_order, key_items, leveling_notes, strengths, weaknesses, created_at)
values
  ('g-sorc-fire', 'sorc', '소서리스', '파벽 소서리스 — 초보자용 완전 정복', 'S TIER', '스킬 트리, 필요 장비, 레벨링 순서까지 한 번에', '화염벽을 주력으로 쓰고 화염구로 보조하는 화염 소서리스예요. 화염벽은 바닥에 불길을 깔아 지나가는 몬스터에게 지속 피해를 주고, 온기·지옥불에 포인트를 넣으면 화염벽 피해가 올라가요.', '힘은 장비 요구치만, 민첩은 방패로 최대 막기 확률을 맞출 만큼만(막기를 안 쓰면 0), 나머지는 전부 활력에 투자하세요. 마력은 찍지 않아도 돼요 — 마나는 장비와 온기로 채워요.',
   '[{"level":"1~11","skill":"화염탄으로 사냥, 온기 1, 얼어붙은 갑옷 1"},{"level":"12~17","skill":"화염구 올리기 (선행: 화염탄) + 지옥불 1, 불길 1 (화염벽 선행)"},{"level":"18~29","skill":"화염벽 우선 투자, 염력 1 → 순간이동 1"},{"level":"30~","skill":"화염벽 20 → 화염 숙련 20"},{"level":"이후","skill":"온기·지옥불(화염벽 시너지) → 남는 포인트는 화염구"}]'::jsonb, '["무기·방패: 영혼(룬워드) 검과 방패 — 시전 속도·마나·모든 기술","투구: 할리퀸 관모 또는 +화염 기술 서클릿","갑옷: 독사마술사의 가죽 (시전 속도·마법 저항)","장갑·벨트: 마수 (시전 속도·화염 기술), 거미 그물띠","부적: +1 화염 기술 거대 부적, 생명력·저항 작은 부적"]'::jsonb, '["노멀은 화염탄 → 화염구만으로도 충분히 빨라요.","화염벽은 몬스터가 오는 길목에 가로로 깔아야 여러 번 맞아요. 순간이동으로 거리를 벌리고 벽 위로 끌어들이세요.","지옥 난이도엔 화염 면역 몬스터가 있어요. 면역 몬스터는 건너뛰거나 용병·두 번째 원소 스킬로 처리하세요.","시전 속도 63%·105%를 맞추면 체감이 커요 — 브레이크포인트 계산기로 확인해 보세요."]'::jsonb, '["광역 지속 피해로 무리 사냥이 빠름","장비 요구가 낮아 초반 진입이 쉬움"]'::jsonb, '["화염 면역 몬스터에 약함","근접 몬스터에 둘러싸이면 위험 — 순간이동이 필수"]'::jsonb, '2026-09-15'::timestamptz),
  ('g-pal-hammer', 'paladin', '팔라딘', '함머딘 스탯/스킬 찍는 순서', 'S TIER', '1인 파밍부터 파티 서포트까지 — 상황별 트리 변형', '축복받은 망치를 집중 오라와 함께 쓰는 팔라딘이에요. 망치는 마법 피해라 저항 있는 몬스터가 적고, 원기·축복받은 조준에 포인트를 넣으면 망치 피해가 올라가요.', '힘은 장비 요구치만, 민첩은 방패로 최대 막기 확률을 맞출 만큼, 나머지는 활력. 마나는 장비(마나·마나 흡수)로 채워요.',
   '[{"level":"1~17","skill":"위세 오라와 열의로 근접 사냥, 신성한 빛줄기 1 (망치 선행)"},{"level":"18","skill":"축복받은 망치 1, 축복받은 조준 1 → 집중 1"},{"level":"18~","skill":"축복받은 망치 20 우선, 다음 집중 20"},{"level":"24","skill":"신성한 방패 1 (선행: 돌진·축복받은 망치)"},{"level":"이후","skill":"원기 20 → 축복받은 조준 20 (망치 시너지)"}]'::jsonb, '["무기: 참나무의 심장 또는 영혼 검","방패: 영혼 팔라딘 방패 또는 폭풍막이","갑옷: 수수께끼(순간이동) — 없으면 독사마술사의 가죽","투구: 할리퀸 관모","반지·목걸이: 요르단의 반지, 마라의 만화경"]'::jsonb, '["축복받은 망치는 캐릭터 주위를 나선형으로 돌아서, 몬스터 사이로 파고들어 쓰는 게 좋아요.","마법 피해라 마법 면역 몬스터만 조심하면 돼요.","신성한 방패를 켜면 막기 확률과 방어력이 크게 올라가요.","시전 속도 75%·125%를 맞추면 망치 간격이 줄어요 — 브레이크포인트 계산기로 확인해 보세요."]'::jsonb, '["마법 피해라 면역 몬스터가 적음","신성한 방패로 막기·방어력이 높아 튼튼함"]'::jsonb, '["망치 궤도 때문에 멀리 있는 적 처리는 느림","마나 소모가 커서 마나 장비가 필요"]'::jsonb, '2026-09-14'::timestamptz),
  ('g-barb-wolf', 'barb', '바바리안', '웜바바 vs 파바바, 뭐가 나한테 맞을까', 'A TIER', '소용돌이 바바리안과 광분 바바리안 비교 + 장비 추천', '웜바바(소용돌이로 적 사이를 돌며 베기)와 파바바(광분으로 양손 무기를 휘두르기)를 비교해요. 둘 다 전투 지시로 파티 생명력·마나를 올릴 수 있어요.', '힘·민첩은 무기 요구치까지(민첩은 명중률에도 도움), 나머지는 활력.',
   '[{"level":"웜바바","skill":"강격 → 도약·집중 공격·도약 공격 1 → 소용돌이 20 (레벨 30부터)"},{"level":"파바바","skill":"이중 타격 → 광분 20 (레벨 24부터)"},{"level":"공통","skill":"외침 1 → 전투 지시·전투 명령, 무기 숙련 하나에 집중, 속도 증가·타고난 저항"}]'::jsonb, '["웜바바 무기: 슬픔(페이즈 블레이드 등)","파바바 무기: 양손에 한손 무기 두 개 (예: 슬픔 두 자루)","갑옷: 인내 또는 수수께끼","투구: 아리앗의 얼굴","교체 무기: 소집 — 전투 지시·전투 명령 레벨 보조"]'::jsonb, '["소용돌이는 레벨 30부터라 그 전엔 강격·이중 타격으로 레벨링하세요.","광분은 적을 때릴수록 이동·공격 속도가 올라가요.","교체 무기에 소집을 들고 전투 지시를 쓰면 생명력·마나가 크게 늘어요."]'::jsonb, '["근접 처치 속도가 빠름","전투 지시로 파티 버프 가능"]'::jsonb, '["원거리 대응 수단이 부족","무기 의존도가 높음"]'::jsonb, '2026-09-12'::timestamptz),
  ('g-necro-bone', 'necro', '네크로맨서', '본넥 레벨링 루트 — 노말부터 헬까지', 'A TIER', '뼈 창 → 뼈 영혼 전환 타이밍 짚어드려요', '뼈 창과 뼈 영혼으로 싸우는 네크로맨서예요. 이빨·뼈의 벽·뼈 감옥이 뼈 창·뼈 영혼의 시너지이고, 뼈 계열은 마법 피해라 면역 걱정이 적어요.', '힘은 장비 요구치만, 민첩은 방패 막기용(선택), 나머지는 활력.',
   '[{"level":"1~17","skill":"이빨로 사냥, 피해 증폭 1, 뼈 갑옷 1, 시체 폭발 1"},{"level":"18~29","skill":"뼈 창 올리기 (선행: 시체 폭발)"},{"level":"30~","skill":"뼈 영혼 (선행: 뼈 창)"},{"level":"이후","skill":"뼈 창·뼈 영혼 20 → 이빨·뼈의 벽·뼈 감옥 (시너지)"}]'::jsonb, '["무기: 뼈 기술이 붙은 완드 또는 마법사의 쐐기검","방패: 호문쿨루스 또는 +뼈 기술 네크로맨서 방패","투구: 할리퀸 관모","갑옷: 수수께끼 또는 독사마술사의 가죽"]'::jsonb, '["노멀 초반엔 해골 되살리기로 앞을 막게 해도 좋아요.","뼈 창은 일직선으로 관통하니 몬스터를 한 줄로 세워서 쏘세요.","뼈 영혼은 적을 쫓아가서 맞아서 보스·단일 대상에 좋아요."]'::jsonb, '["마법 피해라 면역 몬스터가 적음","뼈 감옥·뼈의 벽으로 길을 막아 안전함"]'::jsonb, '["넓게 퍼진 무리 처리는 느린 편","마나 소모가 커서 마나 장비가 필요"]'::jsonb, '2026-09-10'::timestamptz),
  ('g-amazon-bow', 'amazon', '아마존', '멀티샷 바우아마존 — 원거리 광역 파밍', 'A TIER', '부채꼴로 퍼지는 다발 사격으로 통로를 쓸어버리는 활 빌드', '다발 사격으로 무리를 정리하고 유도 화살로 보스를 잡는 활 아마존이에요. 치명타·간파·관통으로 피해와 명중률을 보강해요.', '힘은 장비 요구치만, 민첩 위주(활 피해·명중률), 나머지는 활력.',
   '[{"level":"1~17","skill":"마법 화살·냉기 화살로 사냥, 다발 사격 (레벨 6부터)"},{"level":"18~","skill":"유도 화살 (선행: 냉기 화살·다발 사격), 치명타·간파"},{"level":"30~","skill":"발키리 1 (선행: 미끼·피하기), 관통"},{"level":"이후","skill":"다발 사격·유도 화살 20 → 치명타·간파"}]'::jsonb, '["활: 바람살 또는 라이칸더의 조준 (석궁이면 눈보라 포)","투구: 할리퀸 관모","갑옷: 수수께끼 또는 인내","장갑·벨트: 공격 속도(IAS) 옵션"]'::jsonb, '["초반엔 마법 화살로 마나 걱정 없이 레벨링하세요.","무리는 다발 사격, 보스는 유도 화살로 바꿔 쓰는 게 효율적이에요.","발키리가 앞을 막아줘서 생존이 쉬워져요."]'::jsonb, '["안전 거리에서 공격 가능","광역·단일 대상 모두 대응"]'::jsonb, '["근접하면 생존력이 낮음","활 장비 의존도가 높음"]'::jsonb, '2026-09-08'::timestamptz),
  ('g-druid-wind', 'druid', '드루이드', '허리케인 윈드 드루이드 — 지속 광역 딜러', 'A TIER', '회오리바람과 허리케인으로 화면을 뒤덮는 정령 드루이드', '허리케인(냉기)과 회오리바람(물리)을 함께 쓰는 원소 드루이드예요. 돌개바람·회오리바람·허리케인이 서로 시너지를 주고, 회오리 갑옷이 원소 피해를 흡수해요.', '힘은 장비 요구치만, 민첩은 방패 막기용(선택), 나머지는 활력.',
   '[{"level":"1~17","skill":"화염폭풍·극지 돌풍으로 사냥, 회오리 갑옷 1"},{"level":"18","skill":"돌개바람 1"},{"level":"24~","skill":"회오리바람 (선행: 돌개바람)"},{"level":"30~","skill":"허리케인 20 (선행: 회오리바람)"},{"level":"이후","skill":"회오리바람 20 → 돌개바람·회오리 갑옷 (시너지), 참나무 현자 1"}]'::jsonb, '["무기: 참나무의 심장 또는 +정령 기술 무기","투구: 잘랄의 갈기 또는 +정령 기술 드루이드 투구","갑옷: 수수께끼 또는 독사마술사의 가죽","반지: 요르단의 반지"]'::jsonb, '["허리케인은 캐릭터 주위를 도는 냉기 폭풍이라 적 사이로 들어가야 해요 — 회오리 갑옷을 꼭 켜세요.","냉기 면역 몬스터는 회오리바람(물리)으로 처리하세요."]'::jsonb, '["냉기·물리 두 가지 피해로 면역 대응","회오리 갑옷으로 원소 피해에 강함"]'::jsonb, '["냉기·물리 둘 다 면역인 몬스터에 약함","마나 소모가 큼"]'::jsonb, '2026-09-06'::timestamptz),
  ('g-assassin-trap', 'assassin', '어쌔신', '트랩신 — 번개 파수기로 순삭하기', 'A TIER', '설치형 트랩으로 안전하게 딜을 넣는 원거리 서포트형 빌드', '번개 파수기를 깔아두고 죽음 파수기(시체 폭발)로 마무리하는 함정 어쌔신이에요. 감전 그물·번개 줄기 파수기가 번개 파수기의 시너지예요.', '힘·민첩은 장비 요구치만, 나머지는 활력.',
   '[{"level":"1~11","skill":"화염 작렬 위주로 사냥"},{"level":"12~23","skill":"번개 줄기 파수기, 감전 그물"},{"level":"24~","skill":"번개 파수기 20 (선행: 번개 줄기 파수기)"},{"level":"30~","skill":"죽음 파수기 (선행: 번개 파수기)"},{"level":"이후","skill":"감전 그물·번개 줄기 파수기 (시너지), 흐리기·그림자 달인 1"}]'::jsonb, '["무기: 함정 기술이 붙은 어쌔신 클로","투구: 할리퀸 관모","갑옷: 수수께끼 또는 독사마술사의 가죽","방패: 폭풍막이 또는 영혼","벨트: 거미 그물띠"]'::jsonb, '["파수기는 한 번에 5개까지 깔 수 있어요 — 몬스터가 오는 길목에 모아서 설치하세요.","죽음 파수기는 시체가 있어야 터져요. 번개 파수기로 먼저 잡은 뒤 설치하세요.","번개 면역 몬스터는 죽음 파수기나 용병으로 처리하세요."]'::jsonb, '["안전 거리에서 공격 가능","보스 단일 대상 처치가 빠름"]'::jsonb, '["번개 면역 몬스터에 약함","좁은 곳에선 설치 자리가 부족"]'::jsonb, '2026-09-04'::timestamptz),
  ('g-warlock-summon', 'warlock', '악마술사', '악마 트리 소환 악마술사 — 신규 클래스 입문 가이드', 'B TIER', '염소인간·오염된 자·파멸자를 앞세우고 필드의 악마까지 결속하는 신규 클래스 입문 빌드', '''악마술사의 군림'' DLC로 추가된 신규 클래스 악마술사는 혼돈·기괴·악마 3개 스킬 트리로 구성됩니다. 이 가이드는 소환수를 앞세우고, 악마술사만의 특징인 결속(빙의)·흡수 메커닉으로 전투 중 임기응변까지 챙기는 악마 트리 기본형입니다.', '활력 위주로 투자하고, 장비 요구치만큼만 힘을 채우세요. 소환수 의존도가 높은 초반엔 생존이 최우선입니다.',
   '[{"level":"1~20","skill":"염소인간 소환 20 (주력 소환수)"},{"level":"21~30","skill":"악마 숙련 5 (소환 수 2마리) → 10 (3마리). 3.2부터 아이템 +스킬은 안 쳐주고 직접 찍은 포인트만 인정"},{"level":"31~40","skill":"오염된 자 소환, 파멸자 소환 분산 투자 (소환수 다양화)"},{"level":"41~","skill":"죽음의 징표, 악마 속박. 직접 찍은 포인트 10이면 챔피언, 15면 유니크, 20이면 슈퍼 유니크 속박 가능 (3.2)"},{"level":"이후","skill":"피의 맹세·포식·끓는 피·소모 등 자버프 스킬 마무리"}]'::jsonb, '["오프핸드: 그리모어(악마술사 전용) — 양손 무기를 한 손에 들려면 다른 손에 그리모어가 있어야 해요 (3.2)","방어구: 최대 생명력 및 속성 저항 위주","반지·목걸이: 마나 회복 및 저항","무기: 단검 + 악마술사 스킬이 붙은 룬워드 고려"]'::jsonb, '["악마술사의 핵심은 ''악마 속박(Bind Demon)''입니다 — 필드의 악마 몬스터를 속박해 능력을 빌려 쓸 수 있어요. 3.2부터 엘리트 악마는 악마 속박에 직접 찍은 포인트가 있어야 속박돼요.","''소모(Consume)''로 악마를 흡수하면 버프를 얻어요. 3.2부터 그 악마를 만든 난이도가 높을수록 보너스가 커요 (지옥 > 악몽 > 보통).","3.2부터 생명력 물약 효과가 150%로 올라서 초반 생존이 쉬워졌어요."]'::jsonb, '["소환수를 앞세워 안전하게 플레이 가능","결속·흡수로 전투 중 유연한 대응 가능"]'::jsonb, '["소환수 관리에 익숙해지기까지 진입장벽이 있음","엘리트 악마를 속박하려면 악마 속박에 포인트를 많이 써야 함"]'::jsonb, '2026-09-29'::timestamptz)
on conflict (slug) do nothing;

-- ── 2) 저장한 빌드 ──────────────────────────────────────────
create table if not exists public.tb_saved_build (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.tb_profile(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 60),
  class_key   text not null,
  level       smallint not null default 1 check (level between 1 and 99),
  code        text not null check (char_length(code) <= 20000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists tb_saved_build_user_idx on public.tb_saved_build (user_id, updated_at desc);

alter table public.tb_saved_build enable row level security;

drop policy if exists builds_own on public.tb_saved_build;
create policy builds_own on public.tb_saved_build
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 1인 100개까지, 수정 시각
create or replace function public.d2r_build_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' and (select count(*) from public.tb_saved_build where user_id = new.user_id) >= 100 then
    raise exception '빌드는 100개까지 저장할 수 있어요';
  end if;
  new.updated_at := now();
  if tg_op = 'UPDATE' then new.created_at := old.created_at; end if;
  return new;
end $$;
drop trigger if exists trg_build_guard on public.tb_saved_build;
create trigger trg_build_guard before insert or update on public.tb_saved_build
  for each row execute function public.d2r_build_guard();

revoke all on public.tb_saved_build from anon;
grant select, insert, update, delete on public.tb_saved_build to authenticated;

revoke all on function public.d2r_guide_touch() from public, anon, authenticated;
revoke all on function public.d2r_build_guard() from public, anon, authenticated;

commit;
