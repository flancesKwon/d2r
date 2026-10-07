# 디아허브 (diahub.co.kr)

디아블로 2 레저렉션 거래·정보 사이트. Vue 3 + Vite, Supabase, GitHub Pages(main 머지 = 자동 배포).

## 작업 규칙
- 사용자와는 반말로 편하게. 커밋·PR 설명은 한국어.
- 작업 브랜치 → PR → 사용자가 "머지해줘" 하면 머지.
- DB 바꿀 때는 `supabase/0NN_*.sql` 새 파일 (여러 번 실행해도 되게). 사용자가 Supabase SQL Editor에서 직접 실행함 - 머지 전에 꼭 알려줄 것.
- service_role 키는 프론트에 절대 넣지 않음.

## 다국어 (한국어·영어, 중국어 예정) - 기능을 추가·수정할 때 항상 같이 할 것
- 주소로 언어를 정함: `/en/...` = 영어, 나머지 = 한국어 (`src/i18n.js`, `src/router.js`)
- **화면 글자**: 한국어 원문을 그대로 키로 `t('...')` / 템플릿 `$t('...')`, 영어는 `src/locales/en.js` 에 추가.
  자리 표시는 `t('판매중 {n}개', { n })`. 문구를 고치면 en.js 키도 같이 고칠 것.
- **아이템 이름**: `itemName(it)` (영어면 `name_en`). 새 아이템·재료를 넣으면 `name_en` 은 게임 공식 영어 표기.
- **아이템 옵션 문구**(한국어로 저장된 줄): 보여줄 때 `affixText(text)`. 새 옵션 문구 모양이 생기면
  `src/locales/affixes.en.js` 에 패턴 추가.
- **DB에 한국어로 저장되는 값**(판매글 이름·수량·가격·알림 문구 등)은 DB는 그대로 두고 화면에서만 바꿈:
  `src/tradeI18n.js` (postName, countText, priceText, notifText ...)
- 새 페이지는 `scripts/prerender-routes.js` 의 `EN_PAGES`·`EN_DESC` 에도 넣기 (영어 검색 노출).
- 검사:
  - `npm run check:i18n` - 코드의 t() 문구 중 영어 없는 것 (에러, 배포 막힘), $t 없이 박힌 한글 (경고)
  - `node scripts/check-en-data.js <d2data json 폴더>` - 아이템 영어 이름·옵션 문구 3000여 줄·스킬 설명을
    게임 문자열과 대조 (데이터를 바꿨을 때. d2data = github.com/blizzhackers/d2data 의 json/)
- 운영진 전용 화면(Admin*, GuideEditPage)과 사람이 쓴 글(가이드 본문·게시글)은 번역 안 함.
