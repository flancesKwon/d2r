// 무기 아이템의 실제 물리 피해 (게임 툴팁과 같은 계산)
//   최소 = 내림(베이스 최소 × (100 + 피해 증가%) / 100) + 추가 최소 피해
//   최대 = 내림(베이스 최대 × (100 + 피해 증가% + 레벨당 최대 피해%) / 100) + 추가 최대 피해 + 레벨당 최대 피해
//   최소가 최대 이상이면 최대 = 최소 + 1
// 피해 증가·추가 피해가 범위로 굴러가는 아이템은 결과도 범위 [가장 낮게, 가장 높게]
// 레벨당 옵션(dmg/lvl, dmg%/lvl)은 par ÷ 8 이 레벨당 값 - level 을 주면 그 캐릭터 레벨 기준으로 더함

const num = (v) => (v === '' || v == null ? 0 : Number(v))

function sumRange(affixes, props, pick) {
  let lo = 0
  let hi = 0
  for (const a of affixes) {
    if (!props.includes(a.prop)) continue
    const [l, h] = pick(a)
    lo += l
    hi += h
  }
  return [lo, hi]
}

// 옵션에서 피해 관련 값 모으기
export function damageMods(item) {
  const affixes = item?.affixes || []
  const both = (a) => [num(a.min), num(a.max)]
  return {
    ed: sumRange(affixes, ['dmg%'], both),
    minAdd: [
      sumRange(affixes, ['dmg-min'], both),
      sumRange(affixes, ['dmg-norm', 'dmg'], (a) => [num(a.min), num(a.min)]),
    ].reduce((s, r) => [s[0] + r[0], s[1] + r[1]], [0, 0]),
    maxAdd: [
      sumRange(affixes, ['dmg-max'], both),
      sumRange(affixes, ['dmg-norm', 'dmg'], (a) => [num(a.max), num(a.max)]),
    ].reduce((s, r) => [s[0] + r[0], s[1] + r[1]], [0, 0]),
    maxPerLevel: affixes.filter((a) => a.prop === 'dmg/lvl').reduce((s, a) => s + num(a.par) / 8, 0),
    maxPctPerLevel: affixes.filter((a) => a.prop === 'dmg%/lvl').reduce((s, a) => s + num(a.par) / 8, 0),
  }
}

function calc(bmin, bmax, m, level, eth) {
  if (bmin == null || bmax == null) return null
  const bMin = eth ? Math.floor(bmin * 1.5) : bmin
  const bMax = eth ? Math.floor(bmax * 1.5) : bmax
  const lvlPct = m.maxPctPerLevel * level
  const lvlFlat = Math.floor(m.maxPerLevel * level)
  const one = (i) => {
    const mn = Math.floor((bMin * (100 + m.ed[i])) / 100) + m.minAdd[i]
    let mx = Math.floor((bMax * (100 + m.ed[i] + lvlPct)) / 100) + m.maxAdd[i] + lvlFlat
    if (mx <= mn) mx = mn + 1
    return [mn, mx]
  }
  const [lo, hi] = [one(0), one(1)]
  return { min: [lo[0], hi[0]], max: [lo[1], hi[1]] }
}

// { one: 한손 피해, two: 양손 피해 } - 각각 { min: [낮게, 높게], max: [낮게, 높게] } 또는 null
export function itemDamage(item, { level = 0, ethereal = false } = {}) {
  const b = item?.base_stats
  if (!b || b.category !== 'weapon') return null
  const m = damageMods(item)
  const one = calc(b.mindam, b.maxdam, m, level, ethereal)
  const two = calc(b['2handmindam'], b['2handmaxdam'], m, level, ethereal)
  if (!one && !two) return null
  return { one, two, perLevel: m.maxPerLevel > 0 || m.maxPctPerLevel > 0 }
}

const r = ([lo, hi]) => (lo === hi ? `${lo}` : `(${lo}-${hi})`)
// "45~189" / 범위면 "(68-79)~(194-225)", 한쪽만 범위면 "14~(17-18)"
export function formatDamage(d) {
  return d ? `${r(d.min)}~${r(d.max)}` : ''
}
