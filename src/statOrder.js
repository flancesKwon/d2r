// 옵션 줄 표시 순서 - 게임 툴팁처럼 ItemStatCost.txt 의 descpriority 큰 것부터 (src/data/statPriority.json)
// 판매글 옵션은 글자로만 저장돼서, 사전·접사 데이터의 옵션 문구를 숫자만 지운 틀로 만들어 옵션 코드를 찾음
//   "피해 증가 +60~70%" / "피해 증가 +65%" -> "피해 증가 +#%" -> dmg% -> 129
// 틀에 없는 줄(직접 쓴 기타 옵션 등)은 맨 아래, 같은 순위끼리는 원래 순서
import itemsData from './data/items.json'
import magicAffixData from './data/magicAffixes.json'
import STAT_PRIORITY from './data/statPriority.json'
import { familyLines } from './magicAffixes.js'

const NUM = /\d+(?:\.\d+)?(?:\s*[~-]\s*\d+(?:\.\d+)?)?/g
const norm = (text) => String(text).replace(NUM, '#').trim()

// 판매글 등록의 "기타 옵션 직접 추가" 문구 (tradeStore CUSTOM_OPTION_PRESETS)
const PRESET_LINES = {
  '공격 속도 증가 +#%': 'swing2', '이동/공격 속도 증가 +#%': 'move2', '생명력 +#': 'hp', '마나 +#': 'mana',
  '힘 +#': 'str', '민첩 +#': 'dex', '활력 +#': 'vit', '마력 +#': 'enr', '모든 속성 +#': 'all-stats',
  '모든 저항 +#%': 'res-all', '화염 저항 +#%': 'res-fire', '냉기 저항 +#%': 'res-cold', '번개 저항 +#%': 'res-ltng', '독 저항 +#%': 'res-pois',
  '모든 기술 +#': 'allskills', '마법 아이템 발견 확률 +#%': 'mag%', '골드 발견 확률 +#%': 'gold%',
  '공격 시 생명력 흡수 +#%': 'lifesteal', '공격 시 마나 흡수 +#%': 'manasteal', '재빠른 히트 회복 +#%': 'balance2',
  // 상급(Superior) 옵션 (tradeStore SUPERIOR_MODS)
  '명중률 +#': 'att', '방어력 증가 +#%': 'ac%', '최대 내구도 +#%': 'dur%',
}
// 틀로 못 찾은 스킬 줄 (스킬 이름이 들어가서 틀이 다 다름)
const FALLBACK = [
  [/^모든 기술 \+/, 'allskills'],
  [/ \+\d+ \(.+ 전용\)$/, 'skill'],
  [/^(아마존|소서리스|네크로맨서|팔라딘|바바리안|드루이드|어쌔신|악마술사) 기술 (레벨 )?\+\d/, 'ama'],
  [/기술 (레벨 )?\+\d+$/, 'skilltab'],
]

let table = null
function buildTable() {
  const t = new Map()
  const add = (text, prop) => {
    const p = STAT_PRIORITY[prop]
    if (!text || !p) return
    const k = norm(text)
    if (!t.has(k) || t.get(k) < p) t.set(k, p)
  }
  for (const [line, prop] of Object.entries(PRESET_LINES)) add(line, prop)
  for (const it of itemsData) {
    const ex = it.extra || {}
    const lists = [it.affixes, ...(ex.random_groups || []), ex.set_full_bonus, ...(ex.set_item_bonus || []).map((g) => g.affixes), ...(ex.set_partial_bonus || []).map((g) => g.affixes), ex.in_weapon, ex.in_helm, ex.in_shield]
    for (const list of lists) for (const a of list || []) add(a?.text, a?.prop)
  }
  // 매직·레어 접사, 크래프트 고정 옵션 - 수치 칸에 아무 숫자나 넣어 문구를 만들고 숫자는 지움
  const nums = Array.from({ length: 8 }, (_, i) => 11 + i)
  for (const a of [...magicAffixData.affixes, ...(magicAffixData.crafts || [])]) {
    for (const m of a.mods) {
      try { add(familyLines({ mods: [m] }, nums)[0], m.code) } catch { /* 문구를 못 만드는 옵션은 건너뜀 */ }
    }
  }
  return t
}

export function linePriority(text) {
  table ||= buildTable()
  const p = table.get(norm(text))
  if (p) return p
  const hit = FALLBACK.find(([re]) => re.test(text))
  return hit ? STAT_PRIORITY[hit[1]] || 0 : 0
}

// 게임처럼 네 개가 같은 값이면 한 줄로: 힘·민첩·활력·마력 -> 모든 속성, 화염·냉기·번개·독 저항 -> 모든 저항
const GROUPS = [
  { parts: ['힘', '민첩', '활력', '마력'].map((n) => new RegExp(`^${n} \\+(\\d+)$`)), line: (v) => `모든 속성 +${v}` },
  { parts: ['화염', '냉기', '번개', '독'].map((n) => new RegExp(`^${n} 저항 \\+(\\d+)%$`)), line: (v) => `모든 저항 +${v}%` },
]
function groupLines(lines) {
  let out = [...lines]
  for (const g of GROUPS) {
    const idx = g.parts.map((re) => out.findIndex((l) => re.test(l)))
    if (idx.some((i) => i < 0)) continue
    const vals = idx.map((i, k) => out[i].match(g.parts[k])[1])
    if (new Set(vals).size !== 1) continue
    const first = Math.min(...idx)
    out = out.map((l, i) => (i === first ? g.line(vals[0]) : l)).filter((_, i) => i === first || !idx.includes(i))
  }
  return out
}

// 옵션 줄 목록 -> 게임 표시 순서
export function sortOptionLines(lines) {
  return groupLines(lines).map((text, i) => ({ text, i, p: linePriority(text) }))
    .sort((a, b) => b.p - a.p || a.i - b.i)
    .map((e) => e.text)
}
