// 판매글 수정 - 저장된 옵션 줄에서 고칠 수 있는 숫자와 그 숫자가 게임에서 나올 수 있는 범위를 찾음
// 아이템·옵션 종류는 그대로 두고 수치만 고침 (옵션을 더하거나 빼려면 새 글). 범위를 모르는 줄은 잠금
//  - 유니크·세트·룬워드: 사전 옵션의 min~max (+ 그룹 무작위 옵션, 무작위 직업 기술)
//  - 매직·레어·크래프트: 그 베이스·품질에 붙을 수 있는 접사·크래프트 고정 옵션의 범위
//  - 상급 옵션, 직업 베이스 자체 옵션·스킬 레벨, 기본 방어력·데미지, 소켓 수
import {
  getTradeItem, getItemAffixes, isRollRangeAffix, postBaseItem, uniqueDefenseRange,
  SUPERIOR_MODS, classSkillsForBase,
} from './tradeStore.js'
import { itemDamage } from './itemDamage.js'
import magicAffixData from './data/magicAffixes.json'
import { affixFamiliesFor, craftRecipesFor, familyLines } from './magicAffixes.js'

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const SENTINEL = 987600
// 문구 틀(숫자 자리 = 표시) -> { re, ranges } (re 는 줄 전체와 맞아야 하고, 숫자 자리마다 범위 하나)
function template(text, marks) {
  let src = ''
  let rest = text
  const ranges = []
  for (;;) {
    let best = null
    for (const m of marks) {
      const i = rest.indexOf(m.token)
      if (i >= 0 && (!best || i < best.i)) best = { i, m }
    }
    if (!best) break
    src += esc(rest.slice(0, best.i)) + '(\\d+)'
    ranges.push(best.m.range)
    rest = rest.slice(best.i + best.m.token.length)
  }
  if (!ranges.length) return null
  return { re: new RegExp('^' + src + esc(rest) + '$', 'd'), ranges }
}

function itemTemplates(item) {
  const out = []
  const affixes = [...getItemAffixes(item), ...(item?.extra?.random_groups || []).flat()]
  for (const a of affixes) {
    if (a.prop === 'randclassskill') {
      const lo = Math.min(a.min, a.max), hi = Math.max(a.min, a.max)
      if (lo !== hi) out.push({ re: /^(?:.+) 기술 레벨 \+(\d+)$/d, ranges: [[lo, hi]] })
      continue
    }
    if (!isRollRangeAffix(a)) continue
    const lo = Math.min(Number(a.min), Number(a.max)), hi = Math.max(Number(a.min), Number(a.max))
    const t = template(a.text, [{ token: `${a.min}~${a.max}`, range: [lo, hi] }])
    if (t) out.push(t)
  }
  return out
}

function familyTemplates(fams) {
  const out = []
  for (const fam of fams) {
    const sentinels = fam.slotRanges.map((_, i) => SENTINEL + i)
    let lines
    try { lines = familyLines(fam, sentinels) } catch { continue }
    for (const line of lines) {
      const t = template(line, sentinels.map((v, i) => ({ token: String(v), range: fam.slotRanges[i] })))
      if (t) out.push(t)
    }
  }
  return out
}

function baseTemplates(base, quality) {
  const out = []
  for (const m of Object.values(SUPERIOR_MODS)) {
    const t = template(m.text, [{ token: '{v}', range: [m.min, m.max] }])
    if (t) out.push(t)
  }
  for (const m of base?.auto_mods || []) {
    const lo = m.min ?? Math.min(...(m.values || [])), hi = m.max ?? Math.max(...(m.values || []))
    const t = Number.isFinite(lo) && Number.isFinite(hi) && template(m.text, [{ token: '{v}', range: [lo, hi] }])
    if (t) out.push(t)
  }
  const cls = classSkillsForBase(base)
  if (cls) out.push({ re: new RegExp(`^(?:.+) \\+(\\d+) \\(${esc(cls.name)} 전용\\)$`, 'd'), ranges: [[1, 3]] })
  if (quality && base) {
    out.push(...familyTemplates(affixFamiliesFor(magicAffixData, base, quality)))
    if (quality === 'crafted') out.push(...familyTemplates(craftRecipesFor(magicAffixData, base).map((r) => r.fam)))
  }
  return out
}

// 기본 방어력·데미지·소켓 줄의 범위 (아이템·베이스·에테리얼 기준)
function statTemplates(post, item, base) {
  const out = []
  const mul = post.ethereal ? 1.5 : 1
  const def = uniqueDefenseRange(item, post.ethereal) ||
    (base?.base_stats?.category === 'armor' ? { min: Math.floor(base.base_stats.minac * mul), max: Math.floor(base.base_stats.maxac * mul) } : null)
  if (def) out.push({ re: /^기본 방어력 (\d+)$/d, ranges: [[def.min, def.max]] })
  const dmg = ['unique', 'set'].includes(item?.category)
    ? [itemDamage(item, { level: 0, ethereal: post.ethereal }), itemDamage(item, { level: 99, ethereal: post.ethereal })]
    : null
  const hands = dmg ? ['one', 'two'].filter((h) => dmg[0]?.[h] && dmg[1]?.[h]) : []
  if (hands.length) {
    // 한손·양손 중 넓은 쪽으로
    const lo = (k, i) => Math.min(...hands.map((h) => dmg[0][h][k][i])), hi = (k, i) => Math.max(...hands.map((h) => dmg[1][h][k][i]))
    out.push({ re: /^기본 데미지 (\d+)~(\d+)$/d, ranges: [[lo('min', 0), hi('min', 1)], [lo('max', 0), hi('max', 1)]], ordered: true })
  } else if (!item && base?.base_stats?.category === 'weapon') {
    // 매직·레어 무기는 피해 증가 접사로 값이 바뀌어서 위쪽 제한 없이 (최소 ≤ 최대만)
    out.push({ re: /^기본 데미지 (\d+)~(\d+)$/d, ranges: [[1, 99999], [1, 99999]], ordered: true })
  }
  const maxSock = ['unique', 'set'].includes(item?.category) ? 1 : base?.sockets || 0
  if (maxSock) out.push({ re: /^소켓 (\d+)개$/d, ranges: [[1, maxSock]] })
  return out
}

// 옵션 줄마다 { text, parts: [{ text } | { value, min, max }], editable, ordered }
export function editableOptionLines(post) {
  const item = getTradeItem(post.itemId)
  const base = postBaseItem(post)
  const templates = [
    ...statTemplates(post, item, base),
    ...(item ? itemTemplates(item) : []),
    ...(item?.category === 'runeword' || !item ? baseTemplates(base, item ? '' : post.quality) : []),
  ]
  return (post.options || []).map((text) => {
    if (post.unidentified) return { text, parts: [{ text }], editable: false }
    for (const t of templates) {
      const m = t.re.exec(text)
      if (!m) continue
      const spans = m.indices.slice(1)
      const vals = spans.map(([s, e]) => Number(text.slice(s, e)))
      // 지금 값이 그 옵션 범위 안이어야 같은 옵션 (룬 고정 옵션 "피해 증가 +50%"가 다른 옵션 틀에 걸리는 것 막기),
      // 범위가 한 값뿐이면(고정 수치) 고칠 게 없음. 크래프트 고정 옵션과 접사가 합쳐진 줄처럼 범위 밖이면 잠금
      if (vals.some((v, i) => v < t.ranges[i][0] || v > t.ranges[i][1])) continue
      if (t.ranges.every(([lo, hi]) => lo === hi)) continue
      const parts = []
      let at = 0
      spans.forEach(([s, e], i) => {
        if (s > at) parts.push({ text: text.slice(at, s) })
        parts.push({ value: vals[i], original: vals[i], min: t.ranges[i][0], max: t.ranges[i][1] })
        at = e
      })
      if (at < text.length) parts.push({ text: text.slice(at) })
      return { text, parts, editable: true, ordered: !!t.ordered }
    }
    return { text, parts: [{ text }], editable: false }
  })
}

// 고친 수치로 줄 다시 만들기 + 검사 (틀린 줄 문구 목록)
export function buildEditedLines(lines) {
  const errors = []
  const out = lines.map((l) => {
    if (!l.editable) return l.text
    const nums = l.parts.filter((p) => 'value' in p)
    for (const p of nums) {
      const n = Number(p.value)
      if (p.value === '' || !Number.isInteger(n) || n < p.min || n > p.max) errors.push(`${l.text} (${p.min}~${p.max})`)
    }
    if (l.ordered && Number(nums[0].value) > Number(nums[1].value)) errors.push(`${l.text} (최소 ≤ 최대)`)
    return l.parts.map((p) => ('value' in p ? String(Number(p.value)) : p.text)).join('')
  })
  return { lines: out, errors }
}
