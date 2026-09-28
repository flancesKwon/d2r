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
// magicsuffix.json, automagic.json, armor.json, weapons.json, misc.json, itemtypes.json, skills.json, cubemain.json 을 받은 폴더를 넘겨서 실행
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
        freq: Number(x.frequency), // 뽑힐 가중치 (크래프트 시뮬레이터)
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

// 아이콘: 게임 원본 invfile 칸(파일 이름)으로 아이콘 키(src/assets/itemicons/<키>.png)를 찾음 ("invfile__종류" 모양, 코드로 추측하지 않음)
// 같은 invfile에 종류가 여럿이면 앞쪽 키를 쓰므로 순서가 고정된 목록(icon-keys.json)을 씀
const iconKeys = JSON.parse(fs.readFileSync(new URL('./icon-keys.json', import.meta.url), 'utf8'))
const iconFor = (invfile, prefer) => {
  if (!invfile) return null
  const keys = iconKeys.filter((k) => k.startsWith(invfile + '__'))
  return keys.find((k) => k.endsWith('__' + prefer)) || keys[0] || null
}

const automagic = load('automagic.json')
function autoRareOf(group) {
  const out = {}
  for (const a of automagic.filter((x) => String(x.group) === String(group) && Number(x.spawnable) === 1 && Number(x.rare) === 1)) {
    const key = a.mod1code === 'skilltab' ? `skilltab:${a.mod1param}` : a.mod1code
    const m = out[key] || (out[key] = { min: Infinity, max: -Infinity, set: new Set() })
    m.min = Math.min(m.min, Number(a.mod1min))
    m.max = Math.max(m.max, Number(a.mod1max))
    for (let v = Number(a.mod1min); v <= Number(a.mod1max); v++) m.set.add(v)
  }
  // 단계 사이에 빈 값이 있으면 가능한 값 목록을 values 로 (scripts/build-base-items.js 의 auto_mods 와 같은 모양)
  for (const [k, { set, ...m }] of Object.entries(out)) {
    out[k] = set.size === m.max - m.min + 1 ? m : { ...m, values: [...set].sort((x, y) => x - y) }
  }
  return out
}

const bases = {}
// 아이콘 그림이 없는 베이스는 같은 계열(일반·익셉셔널·엘리트)의 그림을 대신 씀 (iconApprox 표시)
const familyOf = {}
for (const b of [...load('armor.json'), ...load('weapons.json')]) {
  if (!b.code || !b.name || Number(b.spawnable) !== 1) continue
  const tl = ancestors(b.type).concat(b.type2 ? ancestors(b.type2) : [])
  bases[b.code] = { qlvl: Number(b.level) || 0, types: [...new Set(tl)], cls: classOf(tl), rare: canRare(b.type) }
  if (num(b['magic lvl'])) bases[b.code].magic_lvl = Number(b['magic lvl'])
  const icon = iconFor(b.invfile)
  if (icon) bases[b.code].icon = icon
  else familyOf[b.code] = [b.normcode, b.ubercode, b.ultracode].filter((c) => c && c !== b.code)
  // 아이템 레벨 구간별 최대 소켓 (itemtypes MaxSockets1~3, 구간 기준 MaxSocketsLevelThreshold1·2 = 25·40), 베이스 gemsockets 가 상한
  const t = types.get(b.type)
  const cap = Number(b.gemsockets) || 0
  bases[b.code].sock = [1, 2, 3].map((n) => Math.min(cap, Number(t?.['MaxSockets' + n]) || 0))
  bases[b.code].sockLv = [Number(t?.MaxSocketsLevelThreshold1) || 25, Number(t?.MaxSocketsLevelThreshold2) || 40]
  // 베이스 자체 옵션(auto prefix -> automagic) 중 레어·크래프트에 붙을 수 있는 단계만의 범위 (rare=1).
  // 가장 높은 단계는 보통 레어 불가 (예: 팔라딘 방패 모든 저항 35~45, 오브 생명력 41~60)
  if (b['auto prefix']) bases[b.code].autoRare = autoRareOf(b['auto prefix'])
}

for (const [code, fam] of Object.entries(familyOf)) {
  const alt = fam.map((c) => bases[c]?.icon).find(Boolean)
  if (alt) Object.assign(bases[code], { icon: alt, iconApprox: true })
}
// 계열에도 그림이 없으면 같은 종류 -> 그 상위 분류 순으로 베이스 그림을 대신 (iconApprox)
// 예: 이글오브 -> 다른 오브, 방패(shie) -> 방패 계열(shld: 팔라딘 방패 등), 석궁 -> 원거리(miss: 활), 곤봉 -> 둔기
// - 거래게시판 목록에서 아이콘이 비지 않게. 정확한 그림이 아니라서 상세에선 이름으로 구분
const equipRowsList = [...load('armor.json'), ...load('weapons.json')].filter((b) => bases[b.code])
const iconByType = {}
for (const b of equipRowsList) {
  if (!bases[b.code].icon || bases[b.code].iconApprox) continue
  for (const t of ancestors(b.type)) if (!iconByType[t]) iconByType[t] = bases[b.code].icon
}
// 모양이 비슷한 종류를 먼저 (상위 분류만 보면 방패에 네크로 머리, 곤봉에 지팡이 그림이 들어감)
const LOOKALIKE_TYPE = { shie: 'ashd', club: 'mace', xbow: 'bow' }
for (const b of equipRowsList) {
  if (bases[b.code].icon) continue
  const t = [LOOKALIKE_TYPE[b.type], ...ancestors(b.type)].find((x) => x && iconByType[x])
  if (t) Object.assign(bases[b.code], { icon: iconByType[t], iconApprox: true })
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
const MISC_ICON_OVERRIDE = { jew: 'invjw1__jewel', cm1: 'invch1__charm', cm2: 'invch2__charm', cm3: 'invgceye__charm' }
const miscBases = MISC_BASES.map(({ code, name_ko }) => {
  const m = misc.get(code)
  if (!m) throw new Error(`no misc ${code}`)
  const tl = ancestors(m.type)
  bases[code] = { qlvl: Number(m.level) || 0, types: tl, cls: classOf(tl), rare: canRare(m.type) }
  // 부적·주얼은 misc.txt invfile(invchm/invwnd/invsst/invgswe)이 완드·지팡이·다이아몬드 그림 파일과 이름이 같아서
  // 실제 인벤토리 그림(invch1·invch2·그랜드 참 눈 문양·주얼)을 직접 지정함
  const icon = MISC_ICON_OVERRIDE[code] || iconFor(m.invfile, { rin: 'ring', amu: 'amulet' }[code] || 'charm')
  if (!icon) throw new Error(`no icon for ${code} (${m.invfile})`)
  return { id: 'misc-' + code, code, name_ko, subtitle: m.name, icon_key: icon }
})

// 크래프트 제작법 (cubemain.txt 의 output "usetype,crf" 줄) - 재료 매직 아이템의 베이스가 그대로 결과 베이스가 되고,
// 제작법 고정 옵션(mod 1~5)이 붙은 뒤 레어 접사 풀에서 무작위 옵션이 붙음
// 재료 칸(input 1): "fhl,mag,upg" = 풀 헬름 매직(upg: 익셉셔널·엘리트 버전도), "blun,mag" = 둔기 종류 전체
const CRAFT_KIND_KO = { 'Hit Power': '히트 파워', Blood: '블러드', Caster: '캐스터', Safety: '세이프티' }
const CRAFT_SLOT_KO = { Helm: '투구', Boots: '신발', Gloves: '장갑', Belt: '벨트', Shield: '방패', Body: '갑옷', Amulet: '목걸이', Ring: '반지', Weapon: '무기' }
const equipRows = new Map([...load('armor.json'), ...load('weapons.json')].filter((b) => b.code).map((b) => [b.code, b]))
const crafts = load('cubemain.json')
  .filter((r) => Number(r.enabled) === 1 && Number(r.version) === 100 && /\bcrf\b/.test(r.output || ''))
  .map((r) => {
    const m = r.description.match(/-> (Hit Power|Blood|Caster|Safety) (\w+)$/)
    if (!m || !CRAFT_SLOT_KO[m[2]]) throw new Error(`unknown craft ${r.description}`)
    const [input, ...flags] = r['input 1'].replace(/"/g, '').split(',')
    const craft = { id: `${m[1]}-${m[2]}`.toLowerCase().replace(/ /g, '-'), name: `${CRAFT_KIND_KO[m[1]]} ${CRAFT_SLOT_KO[m[2]]}` }
    // 재료: 매직 아이템 + 주얼 + 룬 + 퍼펙트 보석 (영문 이름 - 화면에서 아이템 사전의 한글 이름·아이콘으로 바꿈)
    const mat = r.description.match(/\+ (?:1 )?(\w+ Rune) \+ 1 (Perfect \w+)/)
    if (!mat) throw new Error(`craft materials ${r.description}`)
    craft.rune = mat[1]
    craft.gem = mat[2]
    // 종류 코드가 우선 ("axe"는 아이템 Axe 코드이기도 하지만 제작법에선 도끼 종류 전체)
    const eq = !types.has(input) && equipRows.get(input)
    if (eq) {
      const codes = [input]
      if (flags.includes('upg')) codes.push(eq.ubercode, eq.ultracode)
      craft.codes = [...new Set(codes.filter(Boolean))]
    } else if (types.has(input)) {
      craft.type = input
    } else throw new Error(`craft input ${input}`)
    craft.mods = [1, 2, 3, 4, 5]
      .filter((i) => r[`mod ${i}`])
      .map((i) => {
        const mod = { code: r[`mod ${i}`], param: num(r[`mod ${i} param`]), min: num(r[`mod ${i} min`]), max: num(r[`mod ${i} max`]) }
        if (SKILL_CODES.has(mod.code)) mod.skill = skillInfo(mod.param)
        return mod
      })
    return craft
  })

const affixes = [...affixRows('magicprefix.json', 'p'), ...affixRows('magicsuffix.json', 's')]
fs.writeFileSync(
  new URL('../src/data/magicAffixes.json', import.meta.url),
  JSON.stringify({ affixes, bases, miscBases, crafts }) + '\n'
)
console.log(`affixes ${affixes.length} (prefix ${affixes.filter((a) => a.slot === 'p').length}), bases ${Object.keys(bases).length}, crafts ${crafts.length}`)
