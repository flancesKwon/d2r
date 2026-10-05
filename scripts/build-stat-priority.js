// 옵션 표시 순서 데이터 생성 -> src/data/statPriority.json  ({ 옵션 코드(prop): 우선순위 })
//   node scripts/build-stat-priority.js <d2data json 폴더>
// 게임 툴팁은 옵션 줄을 ItemStatCost.txt 의 descpriority 가 큰 것부터 보여줌 (스킬 > 공격 속도 > ... > 저항 > ...)
// 옵션 코드(Properties.txt)는 스탯 여러 개를 쓸 수 있어서 그중 가장 큰 값을 씀.
// 스탯 없이 함수로만 정해지는 코드(피해 증가·최소/최대 피해·파괴 불가)는 게임이 실제로 쓰는 스탯으로 맞춤
// 원본: https://github.com/blizzhackers/d2data 의 json/itemstatcost.json, json/properties.json
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dir = process.argv[2]
if (!dir) throw new Error('d2data json 폴더를 넘겨주세요')
const read = (f) => Object.values(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')))
const prio = new Map(read('itemstatcost.json').map((s) => [s.Stat, Number(s.descpriority) || 0]))
const SPECIAL = { 'dmg%': ['item_maxdamage_percent'], 'dmg-min': ['mindamage'], 'dmg-max': ['maxdamage'], indestruct: ['item_indesctructible'] }

const out = {}
for (const p of read('properties.json')) {
  const stats = SPECIAL[p.code] || [1, 2, 3, 4, 5, 6, 7].map((i) => p[`stat${i}`]).filter(Boolean)
  const best = Math.max(0, ...stats.map((s) => prio.get(s) || 0))
  if (best) out[p.code] = best
}
const file = path.join(root, 'src/data/statPriority.json')
fs.writeFileSync(file, JSON.stringify(out) + '\n')
console.log(`${Object.keys(out).length}개 -> ${path.relative(root, file)}`)
