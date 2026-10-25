// 소켓에 박힌 룬·보석·주얼 - 판매글 옵션 줄로 저장하고(소켓 칸마다 한 줄), 툴팁이 그림과 효과로 바꿈
// 줄 모양: "박힌 것 1: 이스트 룬" / "박힌 것 2: 비어있음" / "박힌 것 3: 감시자의 빛 | 10,5,35,50" (굴린 수치, 범위 문구 순서대로)
//         / "박힌 것 4: 주얼 | 공격 속도 +15% | 최대 피해 +30" (옵션 줄 그대로)
import itemsData from './data/items.json'
import magicAffixData from './data/magicAffixes.json'
import { affixFamiliesFor, familyLines, filledValues } from './magicAffixes.js'

export const SOCKET_LINE = /^박힌 것 (\d+): (.+)$/
export const SOCKET_EMPTY = '비어있음'
export const SOCKET_JEWEL = '주얼'

export const SOCKET_KINDS = [
  { key: 'rune', label: '룬' },
  { key: 'gem', label: '보석' },
  { key: 'jewel', label: '주얼' },
  { key: 'unique', label: '유니크 주얼' },
  { key: 'empty', label: '비어있음' },
]

const gems = itemsData.filter((i) => i.category === 'gem')
export const SOCKET_RUNES = gems.filter((i) => i.type_sub === '룬')
export const SOCKET_GEMS = gems.filter((i) => i.type_sub === '보석')
export const SOCKET_UNIQUE_JEWELS = itemsData.filter((i) => i.category === 'unique' && i.subtitle === 'Jewel')
const byName = new Map([...gems, ...SOCKET_UNIQUE_JEWELS].map((i) => [i.name_ko, i]))
export const socketItem = (name) => byName.get(name) || null

// 박을 수 있는 매직·레어 주얼의 옵션 종류 (소켓에 박는 주얼은 반지·목걸이 같은 별도 아이템이 아니라 주얼 베이스)
const JEWEL_BASE = { ...magicAffixData.miscBases.find((b) => b.code === 'jew'), sockets: 0 }
export const JEWEL_FAMILIES = affixFamiliesFor(magicAffixData, JEWEL_BASE, 'rare')
export const JEWEL_LIMITS = { p: 3, s: 3, total: 4 }
export const JEWEL_ICON = 'invjw1__jewel'

// 유니크 주얼 옵션 줄 중 수치가 범위("5~10")인 자리 - 굴린 수치를 넣는 칸
const RANGE = /(\d+)~(\d+)/g
export function uniqueJewelRolls(item) {
  const out = []
  for (const a of item?.affixes || []) {
    for (const m of a.text.matchAll(RANGE)) out.push({ lo: Number(m[1]), hi: Number(m[2]), text: a.text })
  }
  return out
}
function uniqueJewelLines(item, rolls) {
  let n = 0
  return (item?.affixes || []).map((a) => a.text.replace(RANGE, (whole) => rolls[n++] ?? whole))
}

// 칸 하나의 입력 상태: { kind, name(룬·보석·유니크 주얼 이름), rolls(유니크 주얼 굴린 수치), picks(주얼 옵션: AffixPicker 값) }
export const emptySocket = () => ({ kind: 'empty', name: '', rolls: [], picks: { p: [], s: [] } })

// 주얼 옵션 줄 - 수치를 아직 안 넣은 칸은 범위("5~10")로 둠
function jewelLines(picks) {
  const byKey = new Map(JEWEL_FAMILIES.map((f) => [f.key, f]))
  return [...picks.p, ...picks.s].filter((r) => byKey.has(r.key)).flatMap((r) => {
    const fam = byKey.get(r.key)
    return familyLines(fam, filledValues(fam, r.values).map((v, i) => v ?? fam.slotRanges[i].join('~')))
  })
}

// 칸 입력 -> 안 채운 게 있으면 그 사유, 다 됐으면 ''
export function socketError(e) {
  if (e.kind === 'rune' || e.kind === 'gem') return e.name ? '' : e.kind
  if (e.kind === 'unique') {
    const need = uniqueJewelRolls(socketItem(e.name))
    return !e.name || e.rolls.length < need.length || e.rolls.some((r, i) => r === '' || r === undefined || r < need[i]?.lo || r > need[i]?.hi) ? 'unique' : ''
  }
  if (e.kind === 'jewel') {
    const lines = jewelLines(e.picks)
    return !lines.length || lines.some((l) => /\d+~\d+/.test(l)) ? 'jewel' : ''
  }
  return ''
}

// 칸 하나 -> 옵션 줄 (socketError 가 없을 때만)
export function socketLine(n, e) {
  const body = (() => {
    if (e.kind === 'rune' || e.kind === 'gem') return e.name
    if (e.kind === 'unique') return `${e.name} | ${e.rolls.join(',')}`
    if (e.kind === 'jewel') return [SOCKET_JEWEL, ...jewelLines(e.picks)].join(' | ')
    return SOCKET_EMPTY
  })()
  return `박힌 것 ${n}: ${body}`
}

// 옵션 줄 -> { n, kind, name, item, lines(그 줄이 주는 효과를 방어구·무기·방패 구분 없이 쓰는 줄), rolls } (모르는 이름이면 null)
export function parseSocketLine(line) {
  const m = SOCKET_LINE.exec(line)
  if (!m) return null
  const [head, ...rest] = m[2].split(' | ')
  const n = Number(m[1])
  if (head === SOCKET_EMPTY) return { n, kind: 'empty' }
  if (head === SOCKET_JEWEL) return { n, kind: 'jewel', lines: rest }
  const item = socketItem(head)
  if (!item) return null
  if (item.category === 'unique') return { n, kind: 'unique', item, rolls: (rest[0] || '').split(',') }
  return { n, kind: item.type_sub === '룬' ? 'rune' : 'gem', item }
}

// 칸에 박힌 것의 그림 이름 (ITEM_ICONS 키) - 비어있으면 null
export function socketIconKey(s) {
  if (s.kind === 'jewel') return JEWEL_ICON
  return s.item?.icon_key || null
}

// 박은 곳: 무기 / 방패(마법서 포함) / 투구·갑옷 (룬·보석 효과가 이 셋으로 나뉨)
export function socketSlotOf(base) {
  if (base?.base_stats?.category === 'weapon') return 'in_weapon'
  if (/방패|마법서/.test(base?.type_sub || '')) return 'in_shield'
  return 'in_helm'
}

// 칸에 박힌 것이 주는 효과 줄
export function socketEffects(s, slot) {
  if (s.kind === 'rune' || s.kind === 'gem') return (s.item.extra?.[slot] || []).map((a) => a.text).filter(Boolean)
  if (s.kind === 'unique') return uniqueJewelLines(s.item, s.rolls)
  if (s.kind === 'jewel') return s.lines
  return []
}

// 게임 툴팁처럼 같은 옵션은 한 줄로 합침 - 수치가 하나뿐인 줄끼리만 (범위("5~10")가 있거나 수치가 여럿인 줄은 그대로).
// 수치 없는 줄("대상의 방어력 무시")은 같은 줄이 또 나오면 하나만 남김
export function mergeSameStatLines(lines) {
  const out = []
  const at = new Map()
  for (const line of lines) {
    if (!/\d/.test(line) && out.includes(line)) continue
    const nums = line.match(/\d+/g) || []
    const key = nums.length === 1 && !line.includes('~') ? line.replace(/\d+/, '#') : null
    if (key && at.has(key)) {
      const i = at.get(key)
      out[i] = out[i].replace(/\d+/, (v) => String(Number(v) + Number(nums[0])))
    } else {
      if (key) at.set(key, out.length)
      out.push(line)
    }
  }
  return out
}

// 아이템 그림 위에 소켓 구멍을 놓을 자리 - 그림 가로 칸 수(w)와 소켓 수로 정함. [0~1 가로, 0~1 세로]
export function socketSpots(n, w) {
  if (w === 1) return Array.from({ length: n }, (_, i) => [0.5, (i + 0.5) / n])
  const GRID = {
    1: [[0.5, 0.5]],
    2: [[0.5, 0.33], [0.5, 0.67]],
    3: [[0.5, 0.25], [0.5, 0.5], [0.5, 0.75]],
    4: [[0.3, 0.33], [0.7, 0.33], [0.3, 0.67], [0.7, 0.67]],
    5: [[0.3, 0.25], [0.7, 0.25], [0.5, 0.5], [0.3, 0.75], [0.7, 0.75]],
    6: [[0.3, 0.25], [0.7, 0.25], [0.3, 0.5], [0.7, 0.5], [0.3, 0.75], [0.7, 0.75]],
  }
  return GRID[n] || []
}
