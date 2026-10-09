// 빌드 뒤에 실행: 검색엔진이 페이지마다 읽을 수 있게 주소별 HTML 을 만듦 (npm run build 에 포함)
// - dist/<경로>/index.html : 제목·설명·공유 미리보기를 그 페이지에 맞게 바꾼 index.html 복사본
//   (화면은 똑같이 앱이 그림. 자바스크립트를 안 돌리는 검색엔진용으로 <noscript> 에 요약 글)
// - dist/404.html : 미리 안 만든 주소(판매글·게시글 등)로 바로 들어와도 앱이 열리게
// - dist/sitemap.xml : 만든 주소 전부
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import EN from '../src/locales/en.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')
const SITE = 'https://diahub.co.kr/'
const read = (f) => JSON.parse(fs.readFileSync(path.join(root, 'src/data', f), 'utf8'))
const template = fs.readFileSync(path.join(dist, 'index.html'), 'utf8')
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s)

const pages = [
  { p: '', title: '디아허브 — 디아블로 2 레저렉션 거래·정보', desc: '디아블로 2 레저렉션 아이템 거래 (아시아·미주·유럽 서버) - 아이템 이름·종류·옵션으로 매물 검색, 고룬 매물, 거래 게시판' },
  { p: 'db', title: 'DB', desc: '디아블로 2 레저렉션 정보·도구 모음 - 아이템 사전, 룬워드, 큐브 레시피, 브레이크포인트·공속 계산기, 시뮬레이터, 빌드 가이드' },
  { p: 'items', title: '아이템 사전', desc: '디아블로 2 레저렉션 유니크·세트·룬워드·보석·룬 전체 옵션. 이름·옵션(패캐·올스 등)으로 검색' },
  { p: 'runewords', title: '룬워드 찾기', desc: '룬을 고르면 그 룬이 들어가는 룬워드와 더 필요한 룬 - 디아블로 2 레저렉션' },
  { p: 'simulator', title: '스킬·스탯 시뮬레이터', desc: '8개 직업 스킬 트리·시너지·스탯 시뮬레이터, 빌드 공유' },
  { p: 'breakpoints', title: '브레이크포인트 계산기', desc: '시전 속도·타격 회복·막기 브레이크포인트와 공격 속도(IAS) 프레임 계산기, 용병 포함' },
  { p: 'sockets', title: '소켓 계산기', desc: '큐브 소켓 뚫기 확률 계산 - 베이스·아이템 레벨별 소켓 수' },
  { p: 'craft-sim', title: '크래프트 시뮬레이터', desc: '블러드·캐스터·히트 파워·세이프티 크래프트 옵션 확률 시뮬레이터' },
  { p: 'cube', title: '큐브 레시피', desc: '디아블로 2 레저렉션 호라드림 큐브 레시피: 업그레이드·수리·크래프트·우버 포탈' },
  { p: 'guides', title: '빌드 가이드', desc: '직업별 빌드 가이드와 시즌 티어리스트 - 스킬 순서·스탯·추천 장비' },
  { p: 'patch', title: '패치노트', desc: '디아블로 2 레저렉션 패치노트 한글 요약 (악마술사의 군림 이후)' },
  { p: 'ladder', title: '레더 시즌 정보', desc: '디아블로 2 레저렉션 현재 레더 시즌 일정·남은 기간과 시즌 변경 사항 정리' },
  { p: 'market', title: '시세 게시판', desc: '디아블로 2 레저렉션 룬·유니크·룬워드 체감 가치 등급표 - 하이룬부터 잡템까지 거래 참고용' },
  { p: 'trade/history', title: '아이템별 거래내역', desc: '디아블로 2 레저렉션 아이템별 판매글과 거래완료 가격 - 변동 옵션별로 실제 거래된 값 확인' },
  { p: 'trade/wants', title: '삽니다', desc: '디아블로 2 레저렉션 아이템 구매 글 - 원하는 아이템·옵션을 올려두면 매물이 올라올 때 알림' },
  { p: 'community', title: '커뮤니티', desc: '디아블로 2 레저렉션 질문·공략·빌드 상담·잡담 게시판 - 거래 후기와 시즌 소식' },
  { p: 'terms', title: '이용 규칙', desc: '디아허브 이용 규칙 - 거래 진행 방식, 금지 행위, 신고와 제재 기준' },
  { p: 'privacy', title: '개인정보 처리 안내', desc: '디아허브가 모으는 정보와 쓰는 곳, 보관 기간, 지우는 방법 안내' },
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
  const catEn = { unique: 'Unique', set: 'Set item', runeword: 'Runeword', gem: it.type_sub === '룬' ? 'Rune' : 'Gem' }[it.category] || ''
  pages.push({
    en: { title: it.name_en, desc: clip(`${it.name_en} — Diablo II: Resurrected ${catEn}${it.level_req ? `, required level ${it.level_req}` : ''}. Stats, variable rolls and listings on DiabloHub.`, 160) },
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
  { p: 'admin/stats', title: '방문 통계' },
  { p: 'community/write', title: '글쓰기' },
  { p: 'trade/new', title: '판매글 등록' },
  { p: 'trade/search', title: '매물 검색', noindex: true },
  { p: 'guides/new', title: '가이드 쓰기' },
].map((pg) => ({ ...pg, noindex: true }))

// 영어판 (/en/...) - 화면 문구가 번역된 주요 화면 + 아이템. 가이드는 본문이 한국어라 안 만듦
const EN_DESC = {
  '': 'Diablo II: Resurrected item trading for the Asia, Americas and Europe realms — search listings by item, type and stats, plus a full item database and calculators.',
  db: 'Diablo II: Resurrected database and tools — items, runewords, cube recipes, breakpoint and IAS calculators, skill planner, build guides.',
  items: 'Every Diablo II: Resurrected unique, set, runeword, gem and rune with stats and variable rolls.',
  runewords: 'Pick the runes you have and see which Diablo II: Resurrected runewords they make.',
  simulator: 'Diablo II: Resurrected skill tree, stat and gear planner for all 8 classes, with shareable builds.',
  breakpoints: 'Faster Cast Rate, Faster Hit Recovery and block breakpoints plus an IAS frame calculator, mercenaries included.',
  sockets: 'Maximum sockets by base item and item level for Diablo II: Resurrected.',
  'craft-sim': 'Blood, Caster, Hit Power and Safety crafting odds simulator for Diablo II: Resurrected.',
  cube: 'Diablo II: Resurrected Horadric Cube recipes: upgrades, repairs, crafting and uber portals.',
  market: 'Diablo II: Resurrected rune, unique and runeword value tiers — from high runes down to junk, as a trading reference.',
  'trade/history': 'Diablo II: Resurrected listings and completed trade prices by item, broken down by variable rolls.',
  'trade/wants': 'Diablo II: Resurrected buy requests — post the item and stat rolls you want and get notified when a matching listing goes up.',
  community: 'DiabloHub community board — questions, builds, trade feedback and season news for Diablo II: Resurrected.',
}
const EN_PAGES = new Set(['', 'db', 'items', 'runewords', 'simulator', 'breakpoints', 'sockets', 'craft-sim', 'cube', 'market', 'trade/history', 'trade/wants', 'community', 'patch', 'ladder', 'guides', 'terms', 'privacy'])
function enVersion(page) {
  if (page.noindex) return { ...page, p: 'en' + (page.p ? '/' + page.p : ''), title: EN[page.title] || page.title, desc: null, body: null, lang: 'en' }
  if (page.en) return { ...page, p: 'en/' + page.p, title: page.en.title, desc: page.en.desc, body: null, lang: 'en' }
  if (!EN_PAGES.has(page.p)) return null
  const title = page.p ? EN[page.title] || page.title : EN['디아허브 — 디아블로 2 레저렉션 거래·정보']
  return { ...page, p: 'en' + (page.p ? '/' + page.p : ''), title, desc: EN_DESC[page.p] || null, body: null, lang: 'en' }
}
const urlOf = (p) => SITE + (p ? p + '/' : '')

function render({ p, title, desc, body, noindex, lang = 'ko', alt }) {
  const url = SITE + (p ? p + '/' : '')
  const brand = lang === 'en' ? 'DiabloHub' : '디아허브'
  const isRoot = p === '' || p === 'en'
  const fullTitle = isRoot ? title : `${title} — ${brand}`
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
  if (lang !== 'ko') html = html.replace('<html lang="ko">', `<html lang="${lang}">`).replace('<meta property="og:locale" content="ko_KR">', '<meta property="og:locale" content="en_US">')
  // 한국어판·영어판이 서로를 가리키게 (검색엔진이 언어별로 맞는 주소를 보여줌)
  // 검색엔진에 사이트 이름과 사이트 안 검색 주소를 알려줌 (첫 화면만)
  if (isRoot) {
    const ld = {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: brand,
      url,
      inLanguage: lang,
      potentialAction: {
        '@type': 'SearchAction',
        target: { '@type': 'EntryPoint', urlTemplate: url + '?q={search_term_string}' },
        'query-input': 'required name=search_term_string',
      },
    }
    html = html.replace('</head>', '<script type="application/ld+json">' + JSON.stringify(ld) + '</' + 'script>\n</head>')
  }
  if (alt) html = html.replace('</head>', `<link rel="alternate" hreflang="ko" href="${alt.ko}">\n<link rel="alternate" hreflang="en" href="${alt.en}">\n<link rel="alternate" hreflang="x-default" href="${alt.ko}">\n</head>`)
  if (noindex) html = html.replace('</head>', '<meta name="robots" content="noindex">\n</head>')
  if (body?.length) {
    const text = `<noscript><h1>${esc(title)}</h1>${body.filter(Boolean).map((l) => `<p>${esc(l)}</p>`).join('')}</noscript>`
    html = html.replace('<div id="app"></div>', `<div id="app"></div>${text}`)
  }
  return html
}

let n = 0
const sitemap = []
for (const page of [...pages, ...privatePages]) {
  const en = enVersion(page)
  const alt = en && !page.noindex ? { ko: urlOf(page.p), en: urlOf(en.p) } : null
  for (const pg of en ? [{ ...page, alt }, { ...en, alt }] : [page]) {
    const dir = path.join(dist, pg.p)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'index.html'), render(pg))
    n++
    if (!pg.noindex) sitemap.push(urlOf(pg.p))
  }
}
fs.writeFileSync(path.join(dist, '404.html'), template)
const urls = sitemap.map((u) => `  <url><loc>${u}</loc></url>`).join('\n')
fs.writeFileSync(path.join(dist, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`)
console.log(`주소별 HTML ${n}개, 404.html, sitemap.xml`)
