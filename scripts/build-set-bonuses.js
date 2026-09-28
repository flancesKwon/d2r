// 세트 부분 보너스(초록 글씨)를 items.json 세트 아이템에 채워 넣음 (여러 번 돌려도 같은 결과)
//   node scripts/build-set-bonuses.js <d2data json 폴더>
// 원본: https://github.com/blizzhackers/d2data (D2R) 의 json/setitems.json, sets.json, skills.json
// - extra.set_item_bonus: 이 아이템 자체의 "N개 착용 시" 보너스 (setitems.txt aprop1a~5b, N = 번호 + 1)
// - extra.set_partial_bonus: 세트 전체의 "N개 착용 시" 보너스 (sets.txt PCode2a~5b)
// 옵션 문구는 아이템 사전에 이미 있는 같은 옵션의 문구 모양을 그대로 따라감 (새 문구 체계를 만들지 않음)
import fs from 'fs'
import path from 'path'

const SRC = process.argv[2]
if (!SRC) throw new Error('usage: node scripts/build-set-bonuses.js <d2data json dir>')
const load = (f) => {
  const d = JSON.parse(fs.readFileSync(path.join(SRC, f), 'utf8'))
  return Array.isArray(d) ? d : Object.values(d)
}
const itemsPath = new URL('../src/data/items.json', import.meta.url)
const raw = fs.readFileSync(itemsPath, 'utf8')
const items = JSON.parse(raw)
const skillText = JSON.parse(fs.readFileSync(new URL('../src/data/skill_text.json', import.meta.url), 'utf8'))

// ---- 스킬 이름 (게임 스킬 번호 -> 한글). skill_text.json 은 드루이드·어쌔신 번호가 게임보다 1 큼
const skillIdByName = new Map(load('skills.json').filter((s) => s.skill && s['*Id'] != null).map((s) => [s.skill.toLowerCase(), Number(s['*Id'])]))
const skillKoById = new Map()
const skillKoByEn = new Map()
for (const list of Object.values(skillText)) {
  for (const s of list) {
    if (s.id != null) skillKoById.set(s.id, s.ko)
    skillKoByEn.set(s.en.toLowerCase(), s.ko)
  }
}
const skillKo = (par) => {
  const p = String(par ?? '')
  const id = /^\d+$/.test(p) ? Number(p) : skillIdByName.get(p.toLowerCase())
  const fixedId = id >= 221 && id <= 280 ? id + 1 : id
  return skillKoById.get(fixedId) || skillKoByEn.get(p.toLowerCase()) || null
}

// ---- 아이템 사전의 기존 문구에서 옵션별 문구 모양을 배움 (고정값 예시를 우선)
const examples = new Map()
const walk = (o) => {
  if (Array.isArray(o)) return o.forEach(walk)
  if (!o || typeof o !== 'object') return
  if (o.prop && typeof o.text === 'string') {
    const list = examples.get(o.prop) || []
    list.push(o)
    examples.set(o.prop, list)
  }
  Object.values(o).forEach(walk)
}
walk(items)
const exampleFor = (prop, par) => {
  const list = examples.get(prop) || []
  const samePar = list.filter((e) => String(e.par ?? '') === String(par ?? ''))
  const pool = samePar.length ? samePar : list
  return pool.find((e) => String(e.min) === String(e.max) && e.text.includes(String(e.min))) || pool[0] || null
}

const range = (a, b, sep = '~') => (String(a) === String(b) ? `${a}` : `${a}${sep}${b}`)
const perLevel = (par) => Math.round((Number(par) / 8) * 1000) / 1000
const DMG_EL = { 'dmg-fire': '화염', 'dmg-ltng': '번개', 'dmg-cold': '냉기', 'dmg-mag': '마법', 'dmg-elem': '화염·번개·냉기', 'dmg-norm': '' }
const PIERCE = { 'pierce-fire': '화염', 'pierce-ltng': '번개', 'pierce-cold': '냉기', 'pierce-pois': '독', 'pierce-mag': '마법', 'pierce-dmg': '물리 피해' }
const PROC = { 'hit-skill': '타격 시', 'gethit-skill': '피격 시', 'att-skill': '공격 시', 'kill-skill': '처치 시', 'death-skill': '사망 시', 'levelup-skill': '레벨 상승 시' }
const PER_LEVEL_LABEL = { 'dmg-fire/lvl': '최대 화염 피해', 'dmg-ltng/lvl': '최대 번개 피해', 'dmg-cold/lvl': '최대 냉기 피해' }

function affixText(prop, par, min, max) {
  if (prop in DMG_EL) return `${DMG_EL[prop] ? DMG_EL[prop] + ' ' : ''}피해 ${range(min, max, '-')} 추가`
  if (prop === 'dmg-pois') {
    const frames = Number(par)
    const shown = (v) => Math.floor((Number(v) * frames) / 256 + 0.5)
    return `${frames / 25}초 동안 독 피해 ${range(shown(min), shown(max), '-')} 추가`
  }
  if (prop in PIERCE) return `적의 ${PIERCE[prop]} 저항 ${range(min, max)}% 감소`
  if (prop in PROC) return `${PROC[prop]} ${min}% 확률로 ${max} 레벨 ${skillKo(par)} 시전`
  if (prop === 'charged') return `${max} 레벨 ${skillKo(par)} (충전 ${min}/${min}회)`
  if (prop === 'oskill') return `${skillKo(par)} +${range(min, max)}`
  if (prop === 'dmg') return `피해 +${range(min, max)}`
  if (prop in PER_LEVEL_LABEL) return `캐릭터 레벨당 ${PER_LEVEL_LABEL[prop]} +${perLevel(par)}`
  const ex = exampleFor(prop, par)
  if (!ex) return null
  if (prop.endsWith('/lvl')) return ex.text.replace(/\+[\d.]+/, `+${perLevel(par)}`)
  if (!/\d/.test(ex.text)) return ex.text // 빙결되지 않음처럼 수치가 없는 옵션
  const value = range(min, max)
  if (String(ex.min) !== String(ex.max) && ex.text.includes(`${ex.min}~${ex.max}`)) return ex.text.replace(`${ex.min}~${ex.max}`, value)
  if (ex.text.includes(String(ex.min))) return ex.text.replace(String(ex.min), value)
  return null
}

const missing = []
// 수치 칸(min·max)이 비어 있는 일반 옵션은 게임에서 0으로 붙어 화면에 안 나옴 (예: 일부 세트의 par만 적힌 명중률) - 건너뜀
const isEmptyValue = (prop, min, max) => (min == null || min === '') && (max == null || max === '') && !prop.endsWith('/lvl') && !prop.startsWith('dmg-')
function affix(prop, par, min, max, where) {
  const p = par === '' || par == null ? null : String(par)
  const text = affixText(prop, p, min, max)
  if (!text || text.includes('null')) missing.push(`${where}: ${prop} ${p ?? ''} ${min}~${max}`)
  return { prop, stat: null, par: p, min: String(min ?? ''), max: String(max ?? ''), text: text || '' }
}

// ---- 세트 아이템별 보너스 (aprop1a/1b = 2개 착용 시, 2a/2b = 3개 ...)
const setItems = load('setitems.json')
const setItemById = new Map(setItems.map((r, i) => [Number(r['*ID'] ?? i), r]))
const sets = new Map(load('sets.json').map((s) => [s.index, s]))

let filled = 0
for (const it of items) {
  if (it.category !== 'set') continue
  const row = setItemById.get(Number(it.id.slice(1)))
  if (!row) throw new Error(`setitems.json 에 ${it.id} ${it.name_en} 없음`)
  const itemBonus = []
  for (let n = 1; n <= 5; n++) {
    const affixes = ['a', 'b']
      .filter((s) => row[`aprop${n}${s}`] && !isEmptyValue(row[`aprop${n}${s}`], row[`amin${n}${s}`], row[`amax${n}${s}`]))
      .map((s) => affix(row[`aprop${n}${s}`], row[`apar${n}${s}`], row[`amin${n}${s}`], row[`amax${n}${s}`], `${it.id} ${it.name_en}`))
    if (affixes.length) itemBonus.push({ count: n + 1, affixes })
  }
  const set = sets.get(row.set)
  const partial = []
  for (let n = 2; n <= 5; n++) {
    const affixes = ['a', 'b']
      .filter((s) => set?.[`PCode${n}${s}`] && !isEmptyValue(set[`PCode${n}${s}`], set[`PMin${n}${s}`], set[`PMax${n}${s}`]))
      .map((s) => affix(set[`PCode${n}${s}`], set[`PParam${n}${s}`], set[`PMin${n}${s}`], set[`PMax${n}${s}`], `${row.set}`))
    if (affixes.length) partial.push({ count: n, affixes })
  }
  it.extra = it.extra || {}
  if (itemBonus.length) it.extra.set_item_bonus = itemBonus
  else delete it.extra.set_item_bonus
  if (partial.length) it.extra.set_partial_bonus = partial
  else delete it.extra.set_partial_bonus
  if (itemBonus.length) filled++
}

if (missing.length) {
  console.error('문구를 만들지 못한 옵션:\n  ' + [...new Set(missing)].join('\n  '))
  process.exit(1)
}
fs.writeFileSync(itemsPath, JSON.stringify(items) + (raw.endsWith('\n') ? '\n' : ''))
console.log(`세트 보너스 적용: 아이템별 보너스 ${filled}개`)
