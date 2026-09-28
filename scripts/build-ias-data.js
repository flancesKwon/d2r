// 공격 속도 계산기용 무기 목록 - weapons.json(d2data D2R) 의 무기 속도(WSM)와 공격 동작 종류(wclass)
// 사용: node scripts/build-ias-data.js <d2data 폴더>
// 결과: src/data/iasWeapons.json
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dir = process.argv[2]
if (!dir) throw new Error('d2data 폴더를 넘겨주세요')
const read = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))

const weapons = Object.values(read('weapons.json'))
const bases = JSON.parse(fs.readFileSync(path.join(root, 'src/data/baseItems.json'), 'utf8'))
const baseByCode = new Map((Array.isArray(bases) ? bases : Object.values(bases)).map((b) => [b.code, b]))

// 직업 전용 무기
const CLASS_TYPES = { abow: 'ama', aspe: 'ama', ajav: 'ama', h2h: 'ass', h2h2: 'ass', orb: 'sor' }
const THROW_TYPES = new Set(['taxe', 'tkni', 'jave', 'ajav'])
// 잽·임페일·펜드는 창·재벌린만
const SPEAR_TYPES = new Set(['spea', 'aspe', 'jave', 'ajav'])
const TIER_ORDER = { 노멀: 0, 익셉셔널: 1, 엘리트: 2 }

const out = []
for (const w of weapons) {
  if (!w.code || w.spawnable !== 1 || w.type === 'tpot') continue
  const b = baseByCode.get(w.code)
  if (!b) continue
  out.push({
    code: w.code,
    ko: b.name_ko,
    en: w.name,
    sub: b.type_sub,
    tier: b.tier,
    wsm: Number(w.speed) || 0,
    // 한손으로 들 때 / 두손으로 들 때 공격 동작 (바바리안만 양손검을 한손으로 들 수 있음)
    wc: w.wclass,
    wc2: w['2handedwclass'] || w.wclass,
    oneOrTwo: w['1or2handed'] === 1 || undefined,
    twoHanded: w['2handed'] === 1 || undefined,
    throw: THROW_TYPES.has(w.type) || undefined,
    spear: SPEAR_TYPES.has(w.type) || undefined,
    cls: CLASS_TYPES[w.type] || undefined,
    qlvl: b.qlvl,
  })
}
out.sort((a, b) => a.sub.localeCompare(b.sub, 'ko') || (TIER_ORDER[a.tier] ?? 9) - (TIER_ORDER[b.tier] ?? 9) || a.qlvl - b.qlvl)
for (const w of out) delete w.qlvl

fs.writeFileSync(path.join(root, 'src/data/iasWeapons.json'), JSON.stringify(out, null, 0).replace(/\},\{/g, '},\n{') + '\n')
console.log('무기', out.length)
