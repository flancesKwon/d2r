# 디아허브 (diahub.co.kr)

디아블로 2 레저렉션 거래·정보 사이트.
Vue 3 + Vite, Supabase, GitHub Pages (main 머지 = 자동 배포).

## 실행

```bash
npm install
npm run dev            # 개발 서버
npm run build          # 빌드 + 주소별 HTML(검색 노출용) 생성
npm run preview        # 빌드 결과 미리보기
npm run check:items    # 아이템 데이터 검사
npm run check:i18n     # 코드의 t() 문구 중 영어 없는 것 (에러 = 배포 막힘)
```

실제 데이터(로그인·거래)를 보려면 프로젝트 루트에 `.env.local` 을 만들고 아래 두 값을 넣는다. (`*.local` 은 git 에 안 올라감)

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...     # publishable(anon) 키만. service_role 키는 프론트에 절대 넣지 않음
```

없으면 로그인·게시판이 꺼진 채로 뜬다.

## 배포

- `main` 에 머지되면 `.github/workflows/deploy.yml` 이 `check:items` → `check:i18n` → `build` 후 GitHub Pages 에 올린다.
- 사이트 전체를 통째로 교체하는 방식이라 PR 미리보기는 없다.
- DB 를 바꿀 때는 `supabase/0NN_*.sql` 새 파일을 만들고 (여러 번 실행해도 되게), Supabase SQL Editor 에서 직접 실행한다. **머지 전에 알릴 것.**

## 폴더

| 폴더 | 내용 |
| --- | --- |
| `src/pages` | 화면 (거래 `Trade*Page`, 가이드, 커뮤니티, 룬워드, 시뮬레이터 ...) |
| `src/*Store.js` | Supabase 와 주고받는 로직 (`tradeStore.js` 가 거래 중심) |
| `src/data` | 아이템·접사·스킬 데이터 (json) |
| `src/locales` | 영어 사전 (`en.js`, `affixes.en.js`, `skills.en.json`) |
| `scripts` | 데이터 생성·검사 스크립트, 주소별 HTML 생성 (`prerender-routes.js`) |
| `supabase` | DB 변경 SQL |

## 다국어

주소로 언어를 정한다: `/en/...` = 영어, 나머지 = 한국어. 자세한 규칙은 [CLAUDE.md](CLAUDE.md) 참고.

- 화면 글자는 한국어 원문을 그대로 키로 `t('...')`, 영어는 `src/locales/en.js` 에 추가
- DB 에 한국어로 저장되는 값(판매글 이름·수량·가격·알림·서버/래더/모드 값)은 DB 는 그대로 두고 `src/tradeI18n.js` 로 화면에서만 바꿈
- 새 페이지는 `scripts/prerender-routes.js` 의 `EN_PAGES`·`EN_DESC` 에도 추가

## 작업 방식

작업 브랜치 → PR → 사용자가 "머지해줘" 하면 머지. PR 하나에는 한 가지 일만 담는다.

---

# 진행 내역

2026-10-13 ~ 14, 한 세션에서 한 일 ([PR #237](https://github.com/flancesKwon/d2r/pull/237) ~ [#249](https://github.com/flancesKwon/d2r/pull/249)). 이 전의 내역은 이 문서에 없음.

## 사이트 점검 후 화면 정리

| PR | 내용 |
| --- | --- |
| [#237](https://github.com/flancesKwon/d2r/pull/237) | 기간 지난 매물을 숨기지 않고 흐리게 보여줌 + 접근성 3건 |
| [#238](https://github.com/flancesKwon/d2r/pull/238) | 첫 화면을 검색창만 남기고 정리, 이용 안내는 헤더 메뉴로 |
| [#239](https://github.com/flancesKwon/d2r/pull/239) | 첫 화면 로고 교체·검은 띠 제거, 매물 검색 비율 수정 (검색창은 좁게, 매물 목록은 넓게) |
| [#240](https://github.com/flancesKwon/d2r/pull/240) | 로고·검색창 가운데로, 푸터 위 24px 띠 제거 |
| [#241](https://github.com/flancesKwon/d2r/pull/241) | 푸터 높이 줄임 (데스크톱 384→253, 폰 487→306) |

## 매물 검색 개편

| PR | 내용 |
| --- | --- |
| [#242](https://github.com/flancesKwon/d2r/pull/242) | 품질 기본값, 검색조건 초기화, 안내 문구 정리, 타자 치는 중에는 목록 필터 중지 (검색 누를 때만 적용) |
| [#243](https://github.com/flancesKwon/d2r/pull/243) [#244](https://github.com/flancesKwon/d2r/pull/244) | 조건 패널 상시 노출 / 분류 칸 제거 시도 → 대상별로 "해당 없는 칸"이 생기는 문제로 접음 |
| [#245](https://github.com/flancesKwon/d2r/pull/245) | #243·#244 되돌리기 |
| [#246](https://github.com/flancesKwon/d2r/pull/246) | 되돌리기에 같이 휩쓸린 3건 복구 + 검색창 위치 조정 |
| [#247](https://github.com/flancesKwon/d2r/pull/247) | 엔터로 베이스 바로 잡기 + 첫 화면 검색창 위치 |
| [#248](https://github.com/flancesKwon/d2r/pull/248) | 조건 패널 폭 400px, 품질 기본값에서 크래프트 제외 (매직·레어만 묶음) |
| [#249](https://github.com/flancesKwon/d2r/pull/249) | 베이스를 **이름**으로 묶기, 묶음에서 품질·옵션 후보 추리기, 품질 `일반` 표기 |

### 지금 검색이 동작하는 방식

- 검색창에 글자를 치고 엔터: 이름이 정확히 같은 베이스가 있으면 그 베이스, 이름에 글자가 든 베이스가 2개 이상이면 **묶음**, 아니면 글자 검색.
- 묶음 (`?bg=부츠`): 이름에 '부츠' 가 든 베이스 전부. 부위·세부 종류로는 묶지 않음 (글러브는 글러브만, 건틀릿은 건틀릿만). 왼쪽 조건 패널의 베이스 칸에서 한 종류를 고를 수 있고, 아이콘은 이름이 가장 짧은 베이스.
- 품질: 매직·레어 / 매직 / 레어 / 크래프트 / 일반. 묶음에서는 묶음 안 베이스들이 낼 수 있는 품질의 합집합만 보임 (목걸이처럼 흰 베이스가 없으면 `일반` 없음).
- 옵션 후보: 묶음 안 베이스들에 붙을 수 있는 접사의 합집합 (부츠 묶음에는 직업 전용 스킬이 안 나옴).
- 타자 치는 동안에는 아래 목록이 바뀌지 않고, 검색(엔터·버튼)을 눌렀을 때만 적용. 음수 입력은 막음.

## 이 세션에서 겪은 문제

- 첫 화면 로고 이미지 배경이 페이지 배경과 달라 네모가 보임 → 배경을 검정으로 정규화 + `mix-blend-mode: screen`.
- 타자 칠 때마다 목록이 걸러짐 → 주소 동기화가 키 입력마다 돌던 것이 원인. 적용된 검색어(`appliedQuery`)를 따로 둠.
- "가운데 검은 공백" → `.tr-body` 패딩과 `SiteFooter` 의 `margin-top` 이 겹친 것.
- #243 한 PR 에 서로 다른 변경 4개를 섞어서, 되돌리기가 멀쩡한 것까지 지움 (#246 에서 복구). 그 뒤로 PR 하나에 한 가지를 원칙으로 함.
- 부위로 묶는 시도를 사용자가 거절한 뒤에도 이어간 적 있음 → 이름 매칭만 남김 (#249).

## 아직 안 한 것

- **세계석 조각 아이콘**: 5종이 모두 `invtoa__uber` (절대의 증표) 그림을 씀. 사용자가 파일(28×28 RGBA PNG, `src/assets/itemicons/`)을 주기로 함.
- **`tb_profile.contact` anon GRANT**: 로그인 안 한 사용자가 연락처 컬럼을 읽을 수 있는 권한이 열려 있어 보임. 확인·정리 필요 (SQL 변경이라 실행 전 알림).
- **Google Fonts**: 가중치 8개 → 4개, `fonts.gstatic.com` preconnect 추가 (렌더 차단 182KB).
- **진입 번들 361KB(gzip)**: 데이터 import 를 나눠서 줄이기.
- **머지 규칙**: CLAUDE.md 는 "사용자가 머지해줘 하면 머지" 인데, 이번 세션에서 "배포해줘"·"올려줘"·"ㅇㅇ" 에도 머지한 적이 있음. 앞으로 어떻게 할지 사용자가 정하기로 함.
- 중국어는 예정만 있음.
