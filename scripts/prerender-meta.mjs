// vite build 다음에 실행 (npm run build 에 들어 있음)
// GitHub Pages 는 서버가 없어서 /d2r/items 같은 주소에 파일이 없으면 404 를 줌. 그래서:
// 1) 주요 화면마다 dist/<주소>.html 과 dist/<주소>/index.html 을 만들어 둠 - 제목·설명·공유 미리보기를 그 화면 것으로
//    (검색엔진이 자바스크립트 없이도 읽음, 200 으로 열림)
// 2) 빌드 가이드도 한 편씩 (배포 때 DB 공개 키가 있으면 DB 목록, 없으면 guides.json)
// 3) 그 밖의 주소(판매글·커뮤니티 글 등)는 404.html = index.html 복사본으로 앱이 그대로 뜸 (검색 제외 표시)
// 4) sitemap.xml 생성
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { PAGE_META, SITE_URL, DEFAULT_DESCRIPTION, pageTitle } from '../src/seoMeta.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = process.env.PRERENDER_DIST ? path.resolve(process.env.PRERENDER_DIST) : path.join(root, 'dist')
const template = fs.readFileSync(path.join(dist, 'index.html'), 'utf8')

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function render({ title, description, url, noindex = false }) {
  const swaps = [
    [/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`],
    [/(<meta name="description" content=")[^"]*(")/, `$1${esc(description)}$2`],
    [/(<link rel="canonical" href=")[^"]*(")/, `$1${esc(url)}$2`],
    [/(<meta property="og:title" content=")[^"]*(")/, `$1${esc(title)}$2`],
    [/(<meta property="og:description" content=")[^"]*(")/, `$1${esc(description)}$2`],
    [/(<meta property="og:url" content=")[^"]*(")/, `$1${esc(url)}$2`],
  ]
  let html = template
  for (const [re, to] of swaps) {
    if (!re.test(html)) throw new Error(`index.html 에서 못 찾음: ${re}`)
    html = html.replace(re, to)
  }
  if (noindex) html = html.replace('<meta charset="UTF-8">', '<meta charset="UTF-8">\n<meta name="robots" content="noindex">')
  return html
}

function write(routePath, html) {
  const rel = routePath.replace(/^\//, '')
  fs.mkdirSync(path.join(dist, path.dirname(rel)), { recursive: true })
  fs.writeFileSync(path.join(dist, rel + '.html'), html)
  fs.mkdirSync(path.join(dist, rel), { recursive: true })
  fs.writeFileSync(path.join(dist, rel, 'index.html'), html)
}

const urls = []
const today = new Date().toISOString().slice(0, 10)

for (const [p, m] of Object.entries(PAGE_META)) {
  const url = SITE_URL + (p === '/' ? '/' : p)
  const html = render({ title: pageTitle(m.title), description: m.description || DEFAULT_DESCRIPTION, url })
  if (p === '/') fs.writeFileSync(path.join(dist, 'index.html'), html)
  else write(p, html)
  urls.push(url)
}

// 빌드 가이드
async function guideList() {
  const base = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_ANON_KEY
  if (base && key) {
    try {
      const res = await fetch(`${base}/rest/v1/tb_guide?select=slug,title,summary,description&published=eq.true&order=created_at.desc`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(10000),
      })
      if (res.ok) {
        const rows = await res.json()
        if (rows.length) return rows.map((r) => ({ id: r.slug, title: r.title, summary: r.summary || r.description || '' }))
      }
      console.log(`가이드 DB 응답 ${res.status} - guides.json 사용`)
    } catch (e) {
      console.log('가이드 DB 못 읽음 - guides.json 사용')
    }
  }
  return JSON.parse(fs.readFileSync(path.join(root, 'src/data/guides.json'), 'utf8'))
}
const guides = (await guideList()).filter((g) => /^[a-z0-9-]+$/i.test(g.id || ''))
for (const g of guides) {
  const p = `/guides/${g.id}`
  const url = SITE_URL + p
  const description = (g.summary || g.desc || DEFAULT_DESCRIPTION).replace(/\s+/g, ' ').slice(0, 150)
  write(p, render({ title: pageTitle(g.title), description, url }))
  urls.push(url)
}

// 로그인해야 쓰는 화면 - 200 으로 열리게만 하고 검색 제외 (판매글 등록 등)
const PRIVATE = { '/trade/new': '판매글 등록', '/community/write': '글쓰기', '/guides/new': '가이드 쓰기', '/messages': '쪽지함', '/mypage': '마이페이지', '/deals': '거래중인 품목', '/admin': '관리자', '/signup': '마이페이지' }
for (const [p, title] of Object.entries(PRIVATE)) {
  write(p, render({ title: pageTitle(title), description: DEFAULT_DESCRIPTION, url: SITE_URL + p, noindex: true }))
}

// 나머지 주소는 앱이 처리 (검색 제외)
fs.writeFileSync(path.join(dist, '404.html'), render({ title: pageTitle(''), description: DEFAULT_DESCRIPTION, url: SITE_URL + '/', noindex: true }))

fs.writeFileSync(
  path.join(dist, 'sitemap.xml'),
  '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map((u) => `  <url><loc>${esc(u)}</loc><lastmod>${today}</lastmod></url>`).join('\n') +
    '\n</urlset>\n'
)
console.log(`정적 페이지 ${Object.keys(PAGE_META).length - 1}개 + 가이드 ${guides.length}개 + 로그인 화면 ${Object.keys(PRIVATE).length}개, sitemap ${urls.length}개, 404.html`)
