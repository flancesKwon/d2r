// 빌드 뒤에 실행: 검색엔진이 페이지마다 읽을 수 있게 주소별 HTML 을 만듦 (npm run build 에 포함)
// - dist/<경로>/index.html : 제목·설명·공유 미리보기를 그 페이지에 맞게 바꾼 index.html 복사본
//   (화면은 똑같이 앱이 그림. 자바스크립트를 안 돌리는 검색엔진용으로 <noscript> 에 요약 글)
// - dist/404.html : 미리 안 만든 주소(판매글·게시글 등)로 바로 들어와도 앱이 열리게
// - dist/sitemap.xml : 만든 주소 전부
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')
const SITE = 'https://diahub.co.kr/'
const read = (f) => JSON.parse(fs.readFileSync(path.join(root, 'src/data', f), 'utf8'))
const template = fs.readFileSync(path.join(dist, 'index.html'), 'utf8')
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s)

const pages = [
  { p: '', title: '디아허브 — 디아블로 2 레저렉션 정보', desc: null },
  { p: 'items', title: '아이템 사전', desc: '디아블로 2 레저렉션 유니크·세트·룬워드·보석·룬 전체 옵션. 이름·옵션(패캐·올스 등)으로 검색' },
  { p: 'runewords', title: '룬워드 찾기', desc: '룬을 고르면 그 룬이 들어가는 룬워드와 더 필요한 룬 - 디아블로 2 레저렉션' },
  { p: 'simulator', title: '스킬·스탯 시뮬레이터', desc: '8개 직업 스킬 트리·시너지·스탯 시뮬레이터, 빌드 공유' },
  { p: 'breakpoints', title: '브레이크포인트 계산기', desc: '시전 속도·타격 회복·막기 브레이크포인트와 공격 속도(IAS) 프레임 계산기, 용병 포함' },
  { p: 'sockets', title: '소켓 계산기', desc: '큐브 소켓 뚫기 확률 계산 - 베이스·아이템 레벨별 소켓 수' },
  { p: 'craft-sim', title: '크래프트 시뮬레이터', desc: '블러드·캐스터·히트 파워·세이프티 크래프트 옵션 확률 시뮬레이터' },
  { p: 'cube', title: '큐브 레시피', desc: '디아블로 2 레저렉션 호라드림 큐브 레시피: 업그레이드·수리·크래프트·우버 포탈' },
  { p: 'guides', title: '빌드 가이드', desc: '직업별 빌드 가이드와 시즌 티어리스트 - 스킬 순서·스탯·추천 장비' },
  { p: 'patch', title: '패치노트', desc: '디아블로 2 레저렉션 패치노트 한글 요약 (악마술사의 군림 이후)' },
  { p: 'ladder', title: '레더 시즌 정보', desc: '현재 레더 시즌 일정과 변경 사항' },
  { p: 'market', title: '시세 게시판', desc: '룬·유니크 시세 등급' },
  { p: 'trade', title: '거래게시판', desc: '디아블로 2 레저렉션 아시아 서버 유저 간 아이템 거래게시판' },
  { p: 'trade/history', title: '아이템별 거래내역', desc: '아이템별 판매글과 거래완료 가격' },
  { p: 'community', title: '커뮤니티', desc: '디아블로 2 레저렉션 질문·공략·잡담 게시판' },
  { p: 'terms', title: '이용 규칙', desc: '디아허브 이용 규칙' },
  { p: 'privacy', title: '개인정보 처리 안내', desc: '디아허브 개인정보 처리 안내' },
]

// 빌드 가이드
for (const g of read('guides.json')) {
  pages.push({
    p: `guides/${g.id}`,
    title: g.title,
    desc: clip(`${g.className} ${g.tier || ''} 빌드 - ${g.desc || g.summary || ''}`, 150),
    body: [g.summary, ...(g.skillOrder || []).map((s) => `${s.level}: ${s.skill}`), ...(g.keyItems || [])],
  })
}

// 아이템 하나씩 (툴팁에 안 나오는 줄 빼고 옵션 요약)
for (const it of read('items.json')) {
  const lines = (it.affixes || []).filter((a) => !a.hidden && a.text).map((a) => a.text)
  const head = [it.category_label, it.subtitle, it.level_req ? `요구 레벨 ${it.level_req}` : ''].filter(Boolean).join(' · ')
  pages.push({
    p: `items/${it.id}`,
    title: `${it.name_ko} (${it.name_en})`,
    desc: clip(`${it.name_ko} ${it.name_en} - ${head}${lines.length ? ' - ' + lines.slice(0, 5).join(', ') : ''}`, 160),
    body: [head, ...lines],
  })
}

// 로그인해서 쓰는 화면 - 바로 들어와도 404 대신 200 으로 열리게 HTML 은 만들되, 검색에는 안 나오게(noindex, sitemap 제외)
const privatePages = [
  { p: 'messages', title: '쪽지함' },
  { p: 'deals', title: '거래중인 품목' },
  { p: 'mypage', title: '마이페이지' },
  { p: 'mypage/edit', title: '프로필 수정' },
  { p: 'admin', title: '관리자' },
  { p: 'community/write', title: '글쓰기' },
  { p: 'trade/new', title: '판매글 등록' },
  { p: 'guides/new', title: '가이드 쓰기' },
].map((pg) => ({ ...pg, noindex: true }))

function render({ p, title, desc, body, noindex }) {
  const url = SITE + (p ? p + '/' : '')
  const fullTitle = p ? `${title} — 디아허브` : title
  let html = template
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(fullTitle)}</title>`)
    .replace(/(<link rel="canonical" href=")[^"]*/, `$1${url}`)
    .replace(/(<meta property="og:url" content=")[^"]*/, `$1${url}`)
    .replace(/(<meta property="og:title" content=")[^"]*/, `$1${esc(fullTitle)}`)
  if (desc) {
    html = html
      .replace(/(<meta name="description" content=")[^"]*/, `$1${esc(desc)}`)
      .replace(/(<meta property="og:description" content=")[^"]*/, `$1${esc(desc)}`)
  }
  if (noindex) html = html.replace('</head>', '<meta name="robots" content="noindex">\n</head>')
  if (body?.length) {
    const text = `<noscript><h1>${esc(title)}</h1>${body.filter(Boolean).map((l) => `<p>${esc(l)}</p>`).join('')}</noscript>`
    html = html.replace('<div id="app"></div>', `<div id="app"></div>${text}`)
  }
  return html
}

let n = 0
for (const page of [...pages, ...privatePages]) {
  const dir = path.join(dist, page.p)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'index.html'), render(page))
  n++
}
fs.writeFileSync(path.join(dist, '404.html'), template)
const urls = pages.map(({ p }) => `  <url><loc>${SITE}${p ? p + '/' : ''}</loc></url>`).join('\n')
fs.writeFileSync(path.join(dist, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`)
console.log(`주소별 HTML ${n}개, 404.html, sitemap.xml`)
