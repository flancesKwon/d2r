// 다국어 검사 - 화면 글자를 추가할 때 영어도 같이 넣었는지 (배포 전에 자동으로 돌림, npm run check:i18n)
//  에러: 코드의 t('...') / $t('...') 한국어 문구가 영어 사전(src/locales/en.js)에 없음
//  경고: 템플릿에 $t 없이 박힌 한글 (관리자 화면은 빼고) - 데이터 값·고유명사일 수도 있어서 경고만
// 사전 키는 한국어 원문 그대로 - 문구를 고치면 en.js 키도 같이 고쳐야 함
import fs from 'fs'
import path from 'path'

const ROOT = new URL('..', import.meta.url).pathname
const SRC = path.join(ROOT, 'src')
const en = (await import(path.join(SRC, 'locales/en.js'))).default
const HANGUL = /[가-힣]/
// 운영진만 보는 화면은 한국어로 둠
const SKIP_HARDCODED = /Admin|GuideEditPage/

const files = []
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
  const p = path.join(d, e.name)
  if (e.isDirectory()) { if (e.name !== 'locales' && e.name !== 'data') walk(p) }
  else if (/\.(vue|js)$/.test(e.name)) files.push(p)
})
walk(SRC)

const missing = new Map()
const hardcoded = []
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8')
  const rel = path.relative(ROOT, f)
  // t( / $t( 의 첫 번째 인자 안 문자열 전부 (삼항식 'a' : 'b' 도)
  const re = /(?:\$t|(?<![\w.$])t)\(/g
  let m
  while ((m = re.exec(s))) {
    let i = m.index + m[0].length, depth = 1, q = null
    const start = i
    for (; i < s.length && depth; i++) {
      const c = s[i]
      if (q) { if (c === '\\') i++; else if (c === q) q = null; continue }
      if (c === "'" || c === '"' || c === '`') q = c
      else if (c === '(') depth++
      else if (c === ')') depth--
    }
    let arg = s.slice(start, i - 1)
    const brace = arg.search(/,\s*\{/)
    if (brace > 0) arg = arg.slice(0, brace)
    for (const sm of arg.matchAll(/(['"])((?:\\.|(?!\1).)*)\1/g)) {
      const k = sm[2].replace(/\\'/g, "'").replace(/\\"/g, '"')
      if (HANGUL.test(k) && !(k in en)) missing.set(k, rel)
    }
  }
  // 템플릿에 그대로 박힌 한글 (주석 빼고)
  if (f.endsWith('.vue') && !SKIP_HARDCODED.test(f)) {
    const a = s.indexOf('<template>'), b = s.lastIndexOf('</template>')
    if (a >= 0) {
      // 주석·{{ }} 식은 같은 길이 공백으로 지움 (줄 번호 유지, 식 안의 > < 비교를 태그로 착각하지 않게)
      const blank = (x) => x.replace(/[^\n]/g, ' ')
      const tpl = s.slice(a, b).replace(/<!--[\s\S]*?-->/g, blank).replace(/\{\{[\s\S]*?\}\}/g, blank)
      const lineOf = (idx) => s.slice(0, a + idx).split('\n').length
      for (const tm of tpl.matchAll(/>([^<>]*?)</g)) {
        const txt = tm[1]
        if (HANGUL.test(txt)) hardcoded.push(`${rel}:${lineOf(tm.index)} ${txt.trim().slice(0, 60)}`)
      }
      for (const am of tpl.matchAll(/\s(placeholder|title|aria-label|alt|label)="([^"]*[가-힣][^"]*)"/g)) {
        hardcoded.push(`${rel}:${lineOf(am.index)} ${am[1]}="${am[2].slice(0, 50)}"`)
      }
    }
  }
}

for (const h of hardcoded) console.log('경고: $t 없는 한글', h)
for (const [k, f] of missing) console.log(`에러: 영어 없음 (${f}) ${JSON.stringify(k)}`)
console.log(`\n영어 사전 ${Object.keys(en).length}개 · 빠진 영어 ${missing.size}건 · $t 없는 한글 ${hardcoded.length}건`)
if (missing.size) {
  console.log('-> src/locales/en.js 에 위 문구의 영어를 추가할 것')
  process.exit(1)
}
