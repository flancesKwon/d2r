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
    base_stats: stats,
  }
})

fs.writeFileSync(new URL('../src/data/baseItems.json', import.meta.url), JSON.stringify(out) + '\n')
const noKo = out.filter((b) => !b.name_ko).map((b) => b.subtitle)
console.log(`bases: ${out.length}, no official ko: ${noKo.length} (${noKo.join(', ')})`)
