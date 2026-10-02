// 검색·공유 미리보기용 페이지 정보 - 화면(router.afterEach)과 빌드 후 정적 HTML 만들기(scripts/prerender-meta.mjs)가 같이 씀
// 여기 있는 주소는 빌드 때 dist/<주소>/index.html 이 따로 생겨서 검색엔진이 제목·설명을 바로 읽음 (sitemap 에도 들어감)
// 로그인해야 쓰는 화면(쪽지·마이페이지·관리자·글쓰기)은 일부러 뺌
export const SITE_NAME = '디아허브'
export const SITE_URL = 'https://flanceskwon.github.io/d2r'
export const DEFAULT_TITLE = '디아허브 — 디아블로 2 레저렉션 정보'
export const DEFAULT_DESCRIPTION = '디아블로 2 레저렉션 룬워드 찾기, 스킬 시뮬레이터, 공속·패캐 브레이크포인트, 아이템 사전, 유저 거래게시판'

export const PAGE_META = {
  '/': { description: DEFAULT_DESCRIPTION },
  '/items': { title: '아이템 사전', description: '디아2 레저렉션 유니크·세트·룬워드·룬·보석·참 전체 옵션과 수치 범위, 베이스, 세트 보너스' },
  '/runewords': { title: '룬워드 찾기', description: '가진 룬으로 만들 수 있는 룬워드 찾기 - 소켓 수, 베이스 종류, 레더 전용 여부까지' },
  '/cube': { title: '큐브 레시피', description: '호라드릭 큐브 레시피 전체 - 룬 업그레이드, 보석, 크래프트, 소켓 뚫기, 제작 아이템' },
  '/craft-sim': { title: '크래프트 시뮬레이터', description: '캐스터·블러드·히트·세이프티 크래프트 옵션이 붙을 확률과 가중치 표' },
  '/sockets': { title: '소켓 계산기', description: '베이스 아이템별 최대 소켓 수와 아이템 레벨에 따른 라쿠니 소켓 퀘스트·큐브 소켓 결과' },
  '/breakpoints': { title: '브레이크포인트 계산기', description: '직업·모습별 시전 속도(패캐), 타격 회복(패히), 막기 속도 브레이크포인트와 공격 속도(공속) 계산기' },
  '/simulator': { title: '스킬·스탯 시뮬레이터', description: '직업별 스킬 트리와 스탯 배분, 장비·참 시뮬레이션, 빌드 저장·공유' },
  '/guides': { title: '빌드 가이드', description: '디아2 레저렉션 직업별 빌드 가이드 - 스킬 배분, 스탯, 장비, 용병 추천' },
  '/ladder': { title: '레더 시즌 정보', description: '현재 레더 시즌 시작일, 패치 버전, 레더 전용 룬워드와 시즌 초기화 안내' },
  '/patch': { title: '패치노트', description: '디아블로 2 레저렉션 패치노트 한글 정리' },
  '/market': { title: '시세 게시판', description: '고룬·주요 아이템 시세 티어와 유저 거래 완료 가격' },
  '/trade': { title: '거래게시판', description: '디아2 레저렉션 유저 거래게시판 - 래더/스탠다드, 하드코어 구분, 룬·아이템 교환' },
  '/trade/history': { title: '아이템별 거래내역', description: '아이템 이름별 최근 거래 완료 가격과 판매글 기록' },
  '/community': { title: '커뮤니티', description: '디아허브 커뮤니티 - 질문, 공략, 잡담, 건의' },
  '/terms': { title: '이용 규칙', description: '디아허브 이용 규칙' },
  '/privacy': { title: '개인정보 처리 안내', description: '디아허브가 받는 정보와 보관·삭제 안내' },
}

export function pageTitle(title) {
  return title ? `${title} — ${SITE_NAME}` : DEFAULT_TITLE
}
