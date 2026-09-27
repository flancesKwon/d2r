// scripts/item-aliases.js의 별칭을 src/data/items.json의 aliases에 합쳐 넣음 (여러 번 돌려도 같은 결과)
//   node scripts/apply-item-aliases.js
import fs from 'fs'
import { ITEM_ALIASES, SET_ALIASES, RUNE_ALIASES } from './item-aliases.js'

const path = new URL('../src/data/items.json', import.meta.url)
const raw = fs.readFileSync(path, 'utf8')
const items = JSON.parse(raw)

const add = (it, list) => {
  it.aliases = [...new Set([...(it.aliases || []), ...list])]
}
const missing = []
let touched = 0

for (const [nameEn, list] of Object.entries({ ...ITEM_ALIASES, ...RUNE_ALIASES })) {
  const matches = items.filter((it) => it.name_en === nameEn)
  if (!matches.length) missing.push(nameEn)
  for (const it of matches) { add(it, list); touched++ }
}
for (const [prefix, list] of Object.entries(SET_ALIASES)) {
  const matches = items.filter((it) => it.category === 'set' && it.name_en.startsWith(prefix))
  if (!matches.length) missing.push(`(set) ${prefix}`)
  for (const it of matches) { add(it, list); touched++ }
}

if (missing.length) {
  console.error('아이템 사전에 없는 이름:', missing.join(', '))
  process.exit(1)
}
fs.writeFileSync(path, JSON.stringify(items) + (raw.endsWith('\n') ? '\n' : ''))
console.log(`별칭 적용: ${touched}개 아이템`)
