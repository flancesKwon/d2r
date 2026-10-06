// 세트 아이템에 세트 영어 이름(extra.set_name_en)을 채움 (여러 번 돌려도 같은 결과)
//   node scripts/add-set-names-en.js <d2data json 폴더>
// 원본: https://github.com/blizzhackers/d2data (D2R) 의 json/setitems.json - 아이템 영어 이름(index) -> 세트(set)
import fs from 'fs'
import path from 'path'

const SRC = process.argv[2]
if (!SRC) throw new Error('usage: node scripts/add-set-names-en.js <d2data json dir>')
const setItems = Object.values(JSON.parse(fs.readFileSync(path.join(SRC, 'setitems.json'), 'utf8')))
const setOf = new Map(setItems.filter((s) => s.index && s.set).map((s) => [s.index.toLowerCase(), s.set]))
const itemsPath = new URL('../src/data/items.json', import.meta.url)
const items = JSON.parse(fs.readFileSync(itemsPath, 'utf8'))
// 같은 한글 세트 이름끼리는 같은 영어 이름 (영어 이름이 안 맞는 아이템도 세트 동료로 채움)
// setitems.json 에서 아이템 이름이 달라 못 찾는 세트
const byKo = new Map([['샌더의 어리석음', "Sander's Folly"]])
for (const it of items) {
  if (it.category !== 'set' || !it.extra) continue
  const en = setOf.get((it.name_en || '').toLowerCase())
  if (en) byKo.set(it.extra.set_name_ko, en)
}
let miss = 0
for (const it of items) {
  if (it.category !== 'set' || !it.extra) continue
  const en = byKo.get(it.extra.set_name_ko)
  if (en) it.extra.set_name_en = en
  else miss++
}
fs.writeFileSync(itemsPath, JSON.stringify(items))
console.log('sets', byKo.size, 'missing items', miss)
