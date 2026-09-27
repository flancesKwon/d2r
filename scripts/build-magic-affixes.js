// 매직/레어 접사(접두사·접미사) 데이터 생성 -> src/data/magicAffixes.json
//
// 판매글 등록에서 매직/레어 아이템 옵션을 "그 베이스에 실제로 붙을 수 있는 것"만 고르게 하려고
// 게임 원본 magicprefix.txt / magicsuffix.txt 를 그대로 옮김. 어떤 접사가 어떤 베이스에 붙는지,
// 수치 범위, 같은 아이템에 같이 못 붙는 그룹 판단은 화면 쪽 src/magicAffixes.js 가 함.
// - 확장팩(D2R) 게임에서 실제로 나오는 줄만: spawnable=1, version>0(0은 클래식 전용), frequency>0
// - bases: 접사 판단에 필요한 베이스별 값 (종류 코드 전체, 직업, 레어 가능 여부, magic lvl, qlvl)
//   무기·방어구는 armor/weapons 전체, 그 외엔 반지·목걸이·주얼·부적
// - 스킬이 들어가는 옵션(충전·타격 시 시전 등)은 스킬 한글 이름(src/data/skill_text.json)과
//   요구 레벨(충전 스킬 레벨 계산용)을 같이 넣음
//
// 원본: https://github.com/blizzhackers/d2data (D2R 3.0 JSON) 의 json/magicprefix.json,
// magicsuffix.json, armor.json, weapons.json, misc.json, itemtypes.json, skills.json 을 받은 폴더를 넘겨서 실행
//   node scripts/build-magic-affixes.js <d2data json 폴더>
import fs from 'fs'
import path from 'path'

const SRC = process.argv[2]
if (!SRC) throw new Error('usage: node scripts/build-magic-affixes.js <d2data json dir>')
const load = (f) => {
  const d = JSON.parse(fs.readFileSync(path.join(SRC, f), 'utf8'))
  return Array.isArray(d) ? d : Object.values(d)
}
const types = new Map(load('itemtypes.json').map((t) => [t.Code, t]))
const skills = new Map(load('skills.json').map((s) => [Number(s['*Id']), s]))
const skillText = JSON.parse(fs.readFileSync(new URL('../src/data/skill_text.json', import.meta.url), 'utf8'))

function ancestors(code) {
  const out = []
  const stack = [code]
  while (stack.length) {
    const c = stack.pop()
    if (!c || out.includes(c)) continue
    out.push(c)
    const t = types.get(c)
    if (t) stack.push(t.Equiv1, t.Equiv2)
  }
  return out
}

// 스킬 id -> 한글 이름. skill_text.json 의 id 는 문자열 키 번호라 드루이드·어쌔신은 skills.txt id + 1,
// 악마술사는 id가 없어서 영문 이름으로 찾음 (src/skillText.js 와 같은 규칙). 영문 이름으로 한 번 더 확인
const TEXT_CLASS = { ama: 'amazon', sor: 'sorceress', nec: 'necromancer', pal: 'paladin', bar: 'barbarian', dru: 'druid', ass: 'assassin', war: 'warlock' }
const TEXT_ID_OFFSET = { dru: 1, ass: 1 }
const normEn = (s) => s.toLowerCase().replace(/[^a-z]/g, '')
// 게임 내부 이름이 화면 이름과 다른 스킬 (scripts/check-item-data.js 의 목록 중 여기서 쓰는 것)
const INTERNAL_NAMES = { Eruption: 'Fissure', 'Fire Trauma': 'Fire Blast', 'Shock Field': 'Shock Web' }
function skillInfo(id) {
  const s = skills.get(Number(id))
  if (!s) throw new Error(`no skill ${id}`)
  const list = skillText[TEXT_CLASS[s.charclass]] || []
  const e = s.charclass === 'war'
    ? list.find((x) => normEn(x.en) === normEn(s.skill))
    : list.find((x) => x.id === Number(id) + (TEXT_ID_OFFSET[s.charclass] || 0))
  if (!e) throw new Error(`no skill text for ${id} ${s.skill}`)
  if (normEn(e.en) !== normEn(INTERNAL_NAMES[s.skill] || s.skill)) throw new Error(`skill text mismatch ${id}: ${s.skill} vs ${e.en}`)
  return { ko: e.ko, req: Number(s.reqlevel) || 1 }
}
const SKILL_CODES = new Set(['hit-skill', 'att-skill', 'gethit-skill', 'kill-skill', 'charged'])

const num = (v) => (v === undefined || v === null || v === '' ? null : Number(v))
function affixRows(file, slot) {
  return load(file)
    .filter((x) => x.Name && Number(x.spawnable) === 1 && Number(x.version) > 0 && Number(x.frequency) > 0)
    .map((x) => {
      const mods = [1, 2, 3]
        .filter((i) => x[`mod${i}code`])
        .map((i) => {
          const m = { code: x[`mod${i}code`], param: num(x[`mod${i}param`]), min: num(x[`mod${i}min`]), max: num(x[`mod${i}max`]) }
          if (SKILL_CODES.has(m.code)) m.skill = skillInfo(m.param)
          return m
        })
      const row = {
        slot, name: x.Name, level: Number(x.level) || 0, rare: Number(x.rare) === 1 ? 1 : 0, group: num(x.group),
        itypes: [1, 2, 3, 4, 5, 6, 7].map((i) => x[`itype${i}`]).filter(Boolean),
        mods,
      }
      if (num(x.maxlevel)) row.maxlevel = Number(x.maxlevel)
      const etypes = [1, 2, 3, 4, 5].map((i) => x[`etype${i}`]).filter(Boolean)
      if (etypes.length) row.etypes = etypes
      if (x.classspecific) row.cls = x.classspecific
      return row
    })
}

// 베이스 종류(itemtypes)의 Class - 직업 전용 베이스면 그 직업, 아니면 null
const classOf = (typeList) => typeList.map((t) => types.get(t)?.Class).find(Boolean) || null
// 레어 가능 여부는 베이스 자기 종류의 Rare 칸 (상위 분류까지 보면 부적도 misc 때문에 레어로 잡힘)
const canRare = (type) => (Number(types.get(type)?.Rare) === 1 ? 1 : 0)

const bases = {}
for (const b of [...load('armor.json'), ...load('weapons.json')]) {
  if (!b.code || !b.name || Number(b.spawnable) !== 1) continue
  const tl = ancestors(b.type).concat(b.type2 ? ancestors(b.type2) : [])
  bases[b.code] = { qlvl: Number(b.level) || 0, types: [...new Set(tl)], cls: classOf(tl), rare: canRare(b.type) }
  if (num(b['magic lvl'])) bases[b.code].magic_lvl = Number(b['magic lvl'])
}

// 무기·방어구 외에 매직/레어로 거래되는 베이스 (판매글에서 버튼으로 고름)
const MISC_BASES = [
  { code: 'rin', name_ko: '반지' },
  { code: 'amu', name_ko: '목걸이' },
  { code: 'jew', name_ko: '주얼' },
  { code: 'cm1', name_ko: '작은 부적' },
  { code: 'cm2', name_ko: '큰 부적' },
  { code: 'cm3', name_ko: '거대 부적' },
]
const misc = new Map(load('misc.json').map((m) => [m.code, m]))
const miscBases = MISC_BASES.map(({ code, name_ko }) => {
  const m = misc.get(code)
  if (!m) throw new Error(`no misc ${code}`)
  const tl = ancestors(m.type)
  bases[code] = { qlvl: Number(m.level) || 0, types: tl, cls: classOf(tl), rare: canRare(m.type) }
  return { id: 'misc-' + code, code, name_ko, subtitle: m.name }
})

const affixes = [...affixRows('magicprefix.json', 'p'), ...affixRows('magicsuffix.json', 's')]
fs.writeFileSync(
  new URL('../src/data/magicAffixes.json', import.meta.url),
  JSON.stringify({ affixes, bases, miscBases }) + '\n'
)
console.log(`affixes ${affixes.length} (prefix ${affixes.filter((a) => a.slot === 'p').length}), bases ${Object.keys(bases).length}`)
