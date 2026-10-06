// 영어 데이터 정합성 검사 - 영어 화면에 나오는 이름·문구가 게임 영어 표기와 맞는지
//   node scripts/check-en-data.js <d2data json 폴더>
// 원본: https://github.com/blizzhackers/d2data (D2R) 의 json/ (uniqueitems, setitems, runes, misc, weapons, armor, allstrings-eng)
// 검사:
//  1) 아이템 영어 이름(name_en): 유니크·세트·룬워드·보석·룬이 게임 표시 이름(문자열 표)과 같은지
//  2) 유니크·세트 베이스 이름(subtitle)이 게임 베이스 이름과 같은지
//  3) 세트 영어 이름(set_name_en) 빠진 것
//  4) 옵션 문구 영어 변환: 아이템 사전·매직/레어 옵션이 전부 바뀌는지, 한글·{자리} 남은 것
//  5) 화면 사전(locales/en.js): 영어에 한글이 남은 것, {n} 같은 자리 표시가 원문과 다른 것
//  6) 스킬 설명(locales/skills.en.json): 빠진 것
// 에러가 있으면 종료 코드 1
import fs from 'fs'
import path from 'path'
import { build } from 'esbuild'

const SRC = process.argv[2]
if (!SRC) throw new Error('usage: node scripts/check-en-data.js <d2data json dir>')
const ROOT = new URL('..', import.meta.url).pathname
const load = (f) => Object.values(JSON.parse(fs.readFileSync(path.join(SRC, f), 'utf8')))
const eng = JSON.parse(fs.readFileSync(path.join(SRC, 'allstrings-eng.json'), 'utf8'))
const items = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/items.json'), 'utf8'))
const errors = []
const warns = []
const err = (m) => errors.push(m)
const warn = (m) => warns.push(m)
// 게임 문자열은 색 코드·줄바꿈이 붙어 있을 수 있음
const clean = (s) => String(s ?? '').replace(/ÿc./g, '').trim()
const display = (key) => clean(eng[key] ?? key)
const norm = (s) => clean(s).toLowerCase().replace(/[’`]/g, "'").replace(/\s+/g, ' ')

// ---- 1) 아이템 이름 ----
const uniques = load('uniqueitems.json').filter((u) => u.index && u['*ID'] != null)
const uniqueById = new Map(uniques.map((u) => [Number(u['*ID']), u]))
const setItems = load('setitems.json').filter((s) => s.index)
const setByName = new Map(setItems.map((s) => [norm(display(s.index)), s]))
const misc = load('misc.json')
// 룬워드는 룬 코드(r08 등)로 조합을 만들어 찾음 - 게임 표의 *RunesUsed 메모칸은 오타가 있음 (PulRalSur, LmKoTir)
// 같은 룬 조합이 갑옷·무기로 나뉜 룬워드(발작·광기)는 장착 종류(itype)까지 맞춤
const runeName = new Map(misc.filter((m) => /^r\d\d$/.test(m.code)).map((m) => [m.code, String(m.name).replace(/ Rune$/, '')]))
const runes = load('runes.json').filter((r) => r.Name && r.complete)
const runeSeq = (r) => [1, 2, 3, 4, 5, 6].map((i) => runeName.get(r['Rune' + i]) || '').join('')
const runewordsFor = (seq) => runes.filter((r) => runeSeq(r) === seq)
const miscNames = new Set(misc.map((m) => norm(display(m.code))).concat(misc.map((m) => norm(m.name))))
// 퀘스트 유니크(왕들의 지팡이 등)는 게임 표의 *ItemName(Staff·Hammer)을 베이스로 씀
const baseNames = new Set([...load('weapons.json'), ...load('armor.json'), ...misc].flatMap((b) => [norm(b.name), norm(display(b.code))]).concat(uniques.map((u) => norm(u['*ItemName']))))

for (const it of items) {
  const where = `${it.id} ${it.name_ko}`
  if (!it.name_en) { err(`${where}: 영어 이름 없음`); continue }
  if (it.category === 'unique') {
    const u = uniqueById.get(Number(it.id.slice(1)))
    if (!u) { warn(`${where}: 게임 유니크 표에서 못 찾음`); continue }
    const want = display(u.index)
    if (norm(it.name_en) !== norm(want)) err(`${where}: 영어 이름 "${it.name_en}" ≠ 게임 "${want}"`)
  } else if (it.category === 'set') {
    if (!setByName.has(norm(it.name_en))) err(`${where}: 세트 아이템 영어 이름 "${it.name_en}" 이 게임 세트 표에 없음`)
    if (!it.extra?.set_name_en) err(`${where}: 세트 영어 이름(set_name_en) 없음`)
  } else if (it.category === 'runeword') {
    const cands = runewordsFor(it.extra?.rune_sequence)
    const types = (it.subtitle || '').split('+').map((x) => x.trim())
    const r = cands.length > 1 ? cands.find((c) => types.includes(c.itype1)) || cands[0] : cands[0]
    if (!r) { warn(`${where}: 룬 조합 ${it.extra?.rune_sequence} 로 게임 룬워드를 못 찾음`); continue }
    const want = display(r.Name)
    if (norm(it.name_en) !== norm(want)) err(`${where}: 영어 이름 "${it.name_en}" ≠ 게임 "${want}"`)
  } else if (it.category === 'gem') {
    if (!miscNames.has(norm(it.name_en))) err(`${where}: 보석·룬 영어 이름 "${it.name_en}" 이 게임 표에 없음`)
  }
  // 2) 베이스 이름
  if ((it.category === 'unique' || it.category === 'set') && it.subtitle && !baseNames.has(norm(it.subtitle))) {
    warn(`${where}: 베이스 이름 "${it.subtitle}" 이 게임 베이스 표에 없음`)
  }
}

// ---- 1-2) 거래 재료(열쇠·장기·정수·세계석 파편 등, src/tradeStore.js) 영어 이름 ----
const storeSrc = fs.readFileSync(path.join(ROOT, 'src/tradeStore.js'), 'utf8')
let materialCount = 0
for (const m of storeSrc.matchAll(/^\s*(?:uber|essence|worldstone)\('([^']+)', '([^']+)', (?:'([^']+)'|"([^"]+)"),/gm)) {
  materialCount++
  const en = m[3] || m[4]
  if (!miscNames.has(norm(en))) err(`거래 재료 ${m[1]} ${m[2]}: 영어 이름 "${en}" 이 게임 표에 없음`)
}
console.log(`거래 재료 ${materialCount}개`)

// ---- 4·5·6) 번역 문구 - 화면 코드(i18n.js 등)를 그대로 묶어서 돌림 ----
const entry = path.join(ROOT, 'scripts/.check-en-entry.mjs')
fs.writeFileSync(entry, `
import { setLocale, affixText, skillDescText } from '../src/i18n.js'
import items from '../src/data/items.json'
import data from '../src/data/magicAffixes.json'
import bases from '../src/data/baseItems.json'
import skillText from '../src/data/skill_text.json'
import { affixFamiliesFor, familyLines } from '../src/magicAffixes.js'
import en from '../src/locales/en.js'
export async function run() {
  await setLocale('en')
  const lines = new Set()
  const add = (a) => a && a.text && lines.add(a.text)
  for (const i of items) {
    (i.affixes || []).forEach(add)
    const e = i.extra || {}
    ;['set_full_bonus', 'in_weapon', 'in_helm', 'in_shield'].forEach((k) => (e[k] || []).forEach(add))
    ;['set_item_bonus', 'set_partial_bonus'].forEach((k) => (e[k] || []).forEach((g) => g.affixes.forEach(add)))
    ;(e.random_groups || []).forEach((g) => g.forEach(add))
  }
  for (const b of [...bases, ...data.miscBases]) for (const q of ['magic', 'rare', 'crafted']) {
    for (const f of affixFamiliesFor(data, b, q)) {
      lines.add(f.label)
      familyLines(f, f.slotRanges.map(([lo, hi]) => (lo === hi ? lo : lo + '~' + hi))).forEach((l) => lines.add(l))
    }
  }
  const affix = [...lines].map((ko) => ({ ko, en: affixText(ko) }))
  const skills = Object.values(skillText).flat().map((s) => ({ ko: s.ko, short: s.keys?.short, long: s.keys?.long, en: skillDescText(s.keys?.short) || skillDescText(s.keys?.long) }))
  return { affix, en, skills }
}
`)
const out = path.join(ROOT, 'scripts/.check-en-entry.out.mjs')
try {
  await build({ entryPoints: [entry], bundle: true, platform: 'node', format: 'esm', outfile: out, logLevel: 'error' })
  const { run } = await import(out + '?' + Date.now())
  const { affix, en, skills } = await run()
  const HANGUL = /[가-힣]/
  let affixMiss = 0
  for (const { ko, en: e } of affix) {
    if (e === ko) { affixMiss++; err(`옵션 문구 변환 안 됨: ${ko}`) }
    else if (HANGUL.test(e)) err(`옵션 문구에 한글 남음: ${ko} -> ${e}`)
    else if (/\{[+]?(\d+|S|C)\}/.test(e)) err(`옵션 문구에 자리 표시 남음: ${ko} -> ${e}`)
  }
  console.log(`옵션 문구 ${affix.length}줄 중 변환 ${affix.length - affixMiss}`)
  const slots = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',')
  for (const [ko, v] of Object.entries(en)) {
    if (HANGUL.test(v)) err(`화면 사전 영어에 한글: "${ko}" -> "${v}"`)
    if (slots(ko) !== slots(v)) {
      // 영어에서 일부러 뺀 자리(예: '{n}개' -> '')는 경고만
      ;(slots(v).split(',').every((x) => !x || slots(ko).includes(x)) ? warn : err)(`화면 사전 자리 표시 다름: "${ko}" -> "${v}"`)
    }
  }
  console.log(`화면 사전 ${Object.keys(en).length}개`)
  const noDesc = skills.filter((s) => !s.en)
  noDesc.forEach((s) => warn(`스킬 설명 영어 없음: ${s.ko} (${s.short || '-'} / ${s.long || '-'})`))
  console.log(`스킬 설명 ${skills.length}개 중 영어 ${skills.length - noDesc.length}`)
} finally {
  fs.rmSync(entry, { force: true })
  fs.rmSync(out, { force: true })
}

for (const w of warns) console.log('경고:', w)
for (const e of errors) console.log('에러:', e)
console.log(`\n에러 ${errors.length}건, 경고 ${warns.length}건`)
if (errors.length) process.exit(1)
