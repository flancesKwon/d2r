// 아이템 사전(items.json)의 유니크·세트·룬워드 옵션을 게임 원본(d2data)과 비교 - 패치 뒤 바뀐 아이템 찾기용
//   node scripts/compare-game-data.js <d2data json 폴더>
// 원본: https://github.com/blizzhackers/d2data 의 json/ (uniqueitems·setitems·runes·allstrings-eng)
// 옵션을 (prop, par, min, max) 로 맞춰보고 다른 아이템만 출력. 사전에 없는 아이템도 출력.
// 3.3 기준 알려진 차이 17개(출력돼도 정상): 게임에서 꺼둔 옵션(*로 시작 - 무쇠돌·검은혀·사신의 낫·까마귀 울음),
// 무지개 자락 8종(영어 이름이 같아 하나로만 맞춰짐), 전용 옵션 코드(도적의 활·망령걸음·오팔맥), 지옥불 횃불 무작위 직업 스킬 표기,
// 아르스 토르바알로스 par 공백, 지옥불 횃불(세트) 원드 기본 언데드 피해
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dir = process.argv[2]
if (!dir) throw new Error('d2data json 폴더를 넘겨주세요')
const read = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))
const vals = (o) => (Array.isArray(o) ? o : Object.values(o))
const items = JSON.parse(fs.readFileSync(path.join(root, 'src/data/items.json'), 'utf8'))
const eng = new Map(Object.entries(read('allstrings-eng.json')))
// 게임 데이터 이름과 사전 이름이 다른 것
const RENAME = { "Ars Al'Diablolos": "Ars Al'Diabolos", 'Unique Warlock Helm': "Hellwarden's Will", 'Hustle (armor)': 'Hysteria', 'Hustle (weapon)': 'Mania' }

const key = (p, par, mn, mx) => [p, par ?? '', String(mn ?? ''), String(mx ?? '')].join('/')
const out = []
function compare(label, name, props, cat) {
  const it = items.find((x) => x.category === cat && x.name_en === name)
  if (!it) return out.push(`${label} 사전에 없음: ${name}`)
  const ours = it.affixes.map((a) => key(a.prop, a.par, a.min, a.max))
  const game = props.map((p) => key(...p))
  const onlyOurs = ours.filter((x) => !game.includes(x))
  const onlyGame = game.filter((x) => !ours.includes(x))
  if (onlyOurs.length || onlyGame.length) out.push(`${label} ${name} (${it.name_ko})\n   사전만: ${onlyOurs.join(' ; ')}\n   게임만: ${onlyGame.join(' ; ')}`)
}
const propsOf = (row, n, p = 'prop', par = 'par', mn = 'min', mx = 'max') => {
  const list = []
  for (let i = 1; i <= n; i++) if (row[p + i]) list.push([row[p + i], row[par + i], row[mn + i], row[mx + i]])
  return list
}
for (const u of vals(read('uniqueitems.json'))) {
  if (u.spawnable !== 1 || u.index.startsWith('PreCrafted')) continue
  const name = RENAME[u.index] || eng.get(u.index) || u.index
  compare('유니크', name, propsOf(u, 12), 'unique')
}
for (const s of vals(read('setitems.json'))) compare('세트', RENAME[s.index] || eng.get(s.index) || s.index, propsOf(s, 9), 'set')
for (const r of vals(read('runes.json'))) {
  if (!r.Rune1 || r.complete !== 1) continue
  compare('룬워드', RENAME[r['*Rune Name']] || r['*Rune Name'], propsOf(r, 7, 'T1Code', 'T1Param', 'T1Min', 'T1Max'), 'runeword')
}
console.log(out.length ? out.join('\n') : '차이 없음')
console.log(`다른 아이템 ${out.length}개`)
