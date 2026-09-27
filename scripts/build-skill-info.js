// 스킬 툴팁용 데이터 생성 -> src/data/skillInfo.json
// { 직업키: { 스킬 한글 이름: { desc: [설명 줄...], syn: [{ skill, percent, kind }] } } }
//
// - desc: 게임 공식 설명 (localestrings의 skilldesc 'str long'). 게임 문자열은 툴팁을 아래에서 위로
//   그려서 줄 순서가 거꾸로 저장돼 있어 뒤집음. 워록은 이 데이터 버전에 설명 문자열이 없어서 비어 있음
// - syn: 이 스킬의 데미지를 올려주는 시너지. skills.txt의 EDmgSymPerCalc(원소 데미지),
//   DmgSymPerCalc(물리 데미지) 공식 "(skill('A'.blvl)+skill('B'.blvl))*par8"에서 스킬과 %(Param8 등)를 뽑음
//
// 원본: https://github.com/blizzhackers/d2data 의 json/skills.json, skilldesc.json,
// localestrings-kor.json, localestrings-eng.json 을 받은 폴더를 넘겨서 실행
//   node scripts/build-skill-info.js <d2data json 폴더>
import fs from 'fs'
import path from 'path'

const SRC = process.argv[2]
if (!SRC) throw new Error('usage: node scripts/build-skill-info.js <d2data json dir>')
const read = (f) => JSON.parse(fs.readFileSync(path.join(SRC, f), 'utf8'))
const vals = (o) => (Array.isArray(o) ? o : Object.values(o))
const skills = vals(read('skills.json'))
const descs = new Map(vals(read('skilldesc.json')).map((d) => [d.skilldesc, d]))
const kor = read('localestrings-kor.json')
const eng = read('localestrings-eng.json')

const CLASS_CODE = { amazon: 'ama', sorc: 'sor', necro: 'nec', paladin: 'pal', barb: 'bar', druid: 'dru', assassin: 'ass', warlock: 'war' }
const norm = (s) => s.toLowerCase().replace(/[^a-z ]/g, '').split(' ').filter(Boolean).map((w) => w.replace(/s$/, '')).sort().join(' ')
const ours = JSON.parse(fs.readFileSync(new URL('../src/data/skills.json', import.meta.url), 'utf8'))

// "(skill('A'.blvl)+skill('B'.blvl))*par8" / "skill('A'.blvl)*par7+skill('B'.blvl)*par8" -> [{ en, percent }]
// "*parN" 앞의 괄호 묶음을 짝 맞는 여는 괄호까지 거슬러 올라가 찾고, 그 안의 skill('..') 전부에 parN 값을 줌
// (묶음 안에 skill(...) 괄호가 또 들어 있어서 단순 정규식으로는 안 됨)
function parseSynergy(formula, row) {
  if (!formula) return []
  const out = []
  const par = (n) => Number(row[`Param${n}`]) || 0
  for (const m of formula.matchAll(/\)\s*\*\s*par(\d)/g)) {
    let depth = 0
    let start = -1
    for (let i = m.index; i >= 0; i--) {
      if (formula[i] === ')') depth++
      else if (formula[i] === '(' && --depth === 0) { start = i; break }
    }
    if (start < 0) continue
    // 괄호가 skill(...) 호출 자체의 것이면("skill('Warmth'.blvl)*par8") 앞의 skill까지 포함
    if (formula.slice(Math.max(0, start - 5), start) === 'skill') start -= 5
    const group = formula.slice(start, m.index + 1)
    for (const s of group.matchAll(/skill\('([^']+)'\.blvl\)/g)) out.push({ en: s[1], percent: par(m[1]) })
  }
  const seen = new Set()
  return out.filter((s) => s.percent && !seen.has(s.en) && seen.add(s.en))
}

const result = {}
const report = []
for (const [key, cc] of Object.entries(CLASS_CODE)) {
  const list = ours[key].tabs.flatMap((t) => t.skills)
  const koByNorm = new Map(list.map((s) => [norm(s.nameEn), s.name]))
  const rows = new Map(skills.filter((s) => s.charclass === cc).map((s) => [norm(s.skill), s]))
  result[key] = {}
  let withDesc = 0, withSyn = 0
  for (const s of list) {
    const row = rows.get(norm(s.nameEn))
    if (!row) throw new Error(`${key}: no game row for ${s.nameEn}`)
    const d = descs.get(row.skilldesc)
    const strKey = d?.['str long'] || d?.['str short']
    const text = (strKey && (kor[strKey] || eng[strKey])) || ''
    const desc = text ? text.split('\n').map((l) => l.trim()).filter(Boolean).reverse() : []
    const syn = [
      ...parseSynergy(row.EDmgSymPerCalc, row).map((x) => ({ ...x, kind: 'ele' })),
      ...parseSynergy(row.DmgSymPerCalc, row).map((x) => ({ ...x, kind: 'phy' })),
    ].map((x) => ({ skill: koByNorm.get(norm(x.en)) || x.en, percent: x.percent, kind: x.kind }))
    if (desc.length) withDesc++
    if (syn.length) withSyn++
    result[key][s.name] = { desc, syn }
  }
  report.push(`${key} 설명 ${withDesc}/${list.length} 시너지 ${withSyn}`)
}
fs.writeFileSync(new URL('../src/data/skillInfo.json', import.meta.url), JSON.stringify(result) + '\n')
console.log(report.join('\n'))
