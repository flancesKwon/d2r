// 베이스 아이템(무기·방어구) 전체 목록 생성 -> src/data/baseItems.json
//
// 룬워드·매직/레어/일반 판매글 등록에서 고르는 베이스 목록. 예전엔 아이템 사전의
// 유니크·세트가 쓰는 베이스(subtitle)만 모아서 만들었는데, 그러면 유니크가 없는
// 베이스(아칸 플레이트, 크리스탈 소드, 이글 오브 등)가 통째로 빠지고 세부 종류도
// 부정확해서, 게임 원본 armor.txt / weapons.txt 기준으로 새로 만듦.
// - types: 종류 코드와 상위 분류 전부 (예: 이지스 shie -> shld -> seco -> armo).
//   룬워드 허용 종류(tors, shld, weap ...)가 여기 하나라도 있으면 그 룬워드를 만들 수 있음
// - sockets: 그 베이스에 뚫을 수 있는 최대 소켓 수 (베이스 값과 종류별 상한 중 작은 값)
// - name_ko: 게임 공식 한글 이름 (localestrings-kor), alt_ko: 예전에 직접 붙였던 한글 이름
//
// 원본: https://github.com/blizzhackers/d2data (D2R 3.0 JSON) 의 json/armor.json,
// json/weapons.json, json/itemtypes.json, json/localestrings-kor.json 을 받은 폴더를 넘겨서 실행
//   node scripts/build-base-items.js <d2data json 폴더>
import fs from 'fs'
import path from 'path'
import { BASE_ITEM_KO_NAMES } from '../src/data/baseItemNames.js'

const SRC = process.argv[2]
if (!SRC) throw new Error('usage: node scripts/build-base-items.js <d2data json dir>')
const load = (f) => {
  const d = JSON.parse(fs.readFileSync(path.join(SRC, f), 'utf8'))
  return Array.isArray(d) ? d : Object.values(d)
}
const kor = JSON.parse(fs.readFileSync(path.join(SRC, 'localestrings-kor.json'), 'utf8'))
const types = new Map(load('itemtypes.json').map((t) => [t.Code, t]))
const altKo = new Map(Object.entries(BASE_ITEM_KO_NAMES).map(([k, v]) => [k.toLowerCase(), v]))

const TYPE_KO = {
  tors: '갑옷', helm: '투구', circ: '서클릿', phlm: '바바리안 투구', pelt: '드루이드 투구', shie: '방패',
  ashd: '팔라딘 방패', head: '네크로맨서 방패', grim: '마법서', glov: '장갑', boot: '신발', belt: '벨트',
  axe: '도끼', taxe: '투척 도끼', swor: '검', knif: '단검', tkni: '투척 단검', club: '곤봉', mace: '철퇴',
  hamm: '망치', scep: '홀', wand: '완드', staf: '지팡이', pole: '폴암', spea: '창', jave: '투창', bow: '활',
  xbow: '석궁', h2h: '어쌔신 클로', h2h2: '어쌔신 클로', abow: '아마존 활', aspe: '아마존 창',
  ajav: '아마존 투창', orb: '소서리스 오브',
}

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

// 직업 전용 베이스(오브·지팡이·클로·드루이드/바바리안 투구·네크로 머리·완드·홀·마법서·단검)는
// 하얀 상태에서도 그 직업 스킬 최대 3개가 각각 +1~3으로 붙을 수 있음 (itemtypes StaffMods)
const CLASS_KO = {
  ama: '아마존', sor: '소서리스', nec: '네크로맨서', pal: '팔라딘', bar: '바바리안', dru: '드루이드', ass: '어쌔신', war: '워록',
}
// 베이스마다 자동으로 붙는 옵션(armor/weapons의 auto prefix -> automagic 그룹). 아이템 레벨에 따라
// 단계가 나뉘는데 판매글엔 실제 값을 입력받으니 전체 범위로 합침
const AUTO_MOD_TEXT = {
  'res-all': '모든 저항 +{v}%', att: '명중률 +{v}', 'pois-min': '독 피해 +{v}', 'dmg-mag': '마법 피해 +{v}',
  'fire-min': '화염 피해 +{v}', hp: '생명력 +{v}', mana: '마나 +{v}',
  'skilltab:0': '보우 & 크로스보우 스킬 +{v} (아마존 전용)', 'skilltab:2': '재벌린 & 스피어 스킬 +{v} (아마존 전용)',
}
const automagic = load('automagic.json')
function autoModsOf(b) {
  const group = b['auto prefix']
  if (!group) return null
  const mods = new Map()
  for (const a of automagic.filter((x) => String(x.group) === String(group) && Number(x.spawnable) === 1)) {
    const key = a.mod1code === 'skilltab' ? `skilltab:${a.mod1param}` : a.mod1code
    if (!AUTO_MOD_TEXT[key]) throw new Error(`no text for auto mod ${key} (${a.Name})`)
    const m = mods.get(key) || { key, text: AUTO_MOD_TEXT[key], min: Infinity, max: -Infinity }
    m.min = Math.min(m.min, Number(a.mod1min))
    m.max = Math.max(m.max, Number(a.mod1max))
    mods.set(key, m)
  }
  return mods.size ? [...mods.values()] : null
}

const num = (v) => (v === undefined || v === null || v === '' ? null : Number(v))
const tierOf = (b) => (b.code === b.ultracode ? '엘리트' : b.code === b.ubercode ? '익셉셔널' : '노멀')

const rows = [
  ...load('armor.json').map((b) => ({ ...b, category: 'armor' })),
  ...load('weapons.json').map((b) => ({ ...b, category: 'weapon' })),
].filter((b) => b.name && b.code && Number(b.spawnable) === 1 && !b.quest && TYPE_KO[b.type])

const out = rows.map((b) => {
  const typeMax = Number(types.get(b.type)?.MaxSockets3) || 0
  const official = kor[b.namestr] || null
  const alt = altKo.get(b.name.toLowerCase()) || null
  const stats = b.category === 'armor'
    ? { category: 'armor', minac: num(b.minac), maxac: num(b.maxac), block: num(b.block) }
    : {
        category: 'weapon', mindam: num(b.mindam), maxdam: num(b.maxdam),
        '2handmindam': num(b['2handmindam']), '2handmaxdam': num(b['2handmaxdam']), speed: num(b.speed),
      }
  Object.assign(stats, { reqstr: num(b.reqstr), reqdex: num(b.reqdex), durability: num(b.durability) })
  return {
    id: 'base-' + b.code,
    code: b.code,
    subtitle: b.name,
    name_ko: official,
    alt_ko: alt && alt !== official ? alt : null,
    tier: tierOf(b),
    type_group: b.category === 'armor' ? '방어구' : '무기',
    type_sub: TYPE_KO[b.type],
    types: ancestors(b.type),
    sockets: Math.min(Number(b.gemsockets) || 0, typeMax || 6),
    // 베이스 레벨 = 이 베이스가 떨어질 수 있는 최소 아이템 레벨 (클래스 스킬 단계 제한에 씀)
    qlvl: num(b.level),
    class_skills: types.get(b.type)?.StaffMods || null,
    auto_mods: autoModsOf(b),
    base_stats: stats,
  }
})

fs.writeFileSync(new URL('../src/data/baseItems.json', import.meta.url), JSON.stringify(out) + '\n')
const noKo = out.filter((b) => !b.name_ko).map((b) => b.subtitle)
console.log(`bases: ${out.length}, no official ko: ${noKo.length} (${noKo.join(', ')})`)

// 직업별 스킬 목록 (공식 한글 이름 + 영문) -> src/data/classSkills.json
// - req: 스킬 요구 레벨 (1/6/12/18/24/30 = 스태프 모드 1~6단계)
// - itype: 이 스킬을 쓰려면 필요한 무기 종류 (예: 스마이트 = 방패). 베이스가 이 종류가 아니면
//   그 베이스엔 안 붙음 (홀엔 스마이트·홀리 실드 X, 바바리안 투구엔 근접 스킬 X)
const skillDesc = new Map(load('skilldesc.json').map((d) => [d.skilldesc, d]))
const classSkills = {}
for (const s of load('skills.json')) {
  if (!CLASS_KO[s.charclass] || !s.skilldesc) continue
  const ko = kor[skillDesc.get(s.skilldesc)?.['str name']] || null
  const entry = (classSkills[s.charclass] ??= { name: CLASS_KO[s.charclass], skills: [] })
  entry.skills.push({ en: s.skill, ko: ko ? ko.trim() : null, req: num(s.reqlevel), itype: s.itypea1 || null })
}
fs.writeFileSync(new URL('../src/data/classSkills.json', import.meta.url), JSON.stringify(classSkills) + '\n')
const counts = Object.entries(classSkills).map(([c, v]) => `${c} ${v.skills.length}`).join(', ')
const withMods = out.filter((b) => b.class_skills || b.auto_mods)
console.log(`class skills: ${counts}; bases with class skills/auto mods: ${withMods.length}`)
