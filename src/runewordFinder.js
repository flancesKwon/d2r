// 가진 룬으로 만들 수 있는 룬워드 찾기 - 화면(RunewordFinderPage)과 데이터 검사 스크립트가 같이 쓰도록
// 데이터(items.json, runeUpgradeChain.json)를 인자로 받는 순수 함수만 둠.
//
// 큐브 룬 업그레이드는 아래 룬 N개(+보석) -> 바로 윗 룬 1개, 아래로는 못 내림. 그래서 룬워드에 필요한 룬을
// 가장 높은 룬부터 채우면서 모자란 만큼을 바로 아래 룬 업그레이드로 요구하면(위 -> 아래로 내려가며)
// 최소 업그레이드 횟수·필요 보석이 정확히 나옴. 제일 아래(엘)까지 내려가도 모자라면 큐브로도 불가

// "JahIthBer" -> ['Jah', 'Ith', 'Ber'] (src/itemStats.js 와 같음 - 그 파일은 JSON import 가 있어서 Node 에서 못 불러옴)
const runePips = (seq) => (seq || '').match(/[A-Z][a-z]+/g) || []

// items.json + runeUpgradeChain.json -> 룬 33종 (엘 -> 조드 순) + 업그레이드 단계
export function buildRuneTable(itemsData, runeChain) {
  const runeItems = itemsData.filter((it) => it.type_sub === '룬' && it.name_en?.endsWith(' Rune'))
  const byKo = new Map(runeItems.map((it) => [it.name_ko, it]))
  // 업그레이드 표 순서가 곧 룬 순서 (엘 -> 엘드 -> ... -> 조드)
  const order = [runeChain[0].from, ...runeChain.map((s) => s.to)]
  const runes = order.map((ko, i) => {
    const it = byKo.get(ko)
    if (!it) throw new Error(`룬 아이템 없음: ${ko}`)
    return { index: i, code: it.name_en.replace(' Rune', ''), ko, short: ko.replace(/ 룬$/, ''), item: it }
  })
  // steps[i] = 룬 i -> 룬 i+1 업그레이드 (qty 개 + 보석)
  const steps = runeChain.map((s) => ({ qty: s.qty, gem: s.gem }))
  return { runes, steps, byCode: new Map(runes.map((r) => [r.code, r])) }
}

// 룬워드 목록 -> [{ item, runes: [룬 index...], need: Map<index, 개수>, top: 가장 높은 룬 index }]
export function buildRunewordList(itemsData, table) {
  return itemsData
    .filter((it) => it.category === 'runeword' && it.extra?.rune_sequence)
    .map((it) => {
      const runes = runePips(it.extra.rune_sequence).map((code) => {
        const r = table.byCode.get(code)
        if (!r) throw new Error(`${it.name_ko}: 알 수 없는 룬 ${code}`)
        return r.index
      })
      const need = new Map()
      for (const i of runes) need.set(i, (need.get(i) || 0) + 1)
      return { item: it, runes, need, top: Math.max(...runes) }
    })
}

// 가진 룬(have: 룬 index -> 개수)으로 이 룬워드를 만들 수 있는지
// -> { status: 'ready' | 'upgrade' | 'missing', upgrades: [{ from, to, times, qty, gem }], gems: Map<보석, 개수>,
//      missing: [{ index, count }] (바로 없는 룬 - 'missing'일 때 사야 할 룬), missingTotal }
export function evaluateRuneword(rw, have, table) {
  const n = table.runes.length
  // 업그레이드 없이 바로 없는 룬
  const missing = []
  for (const [i, c] of rw.need) {
    const lack = c - (have[i] || 0)
    if (lack > 0) missing.push({ index: i, count: lack })
  }
  missing.sort((a, b) => b.index - a.index)
  const missingTotal = missing.reduce((s, m) => s + m.count, 0)
  if (!missingTotal) return { status: 'ready', upgrades: [], gems: new Map(), missing, missingTotal }

  // 위에서부터: 룬 i 에 필요한 수(룬워드 필요 + 위 룬을 만들려고 요구된 수)가 가진 것보다 많으면
  // 모자란 만큼을 룬 i-1 업그레이드로 만듦 -> 룬 i-1 에 (모자란 수 × 업그레이드 개수) 요구
  const demand = new Array(n).fill(0)
  for (const [i, c] of rw.need) demand[i] += c
  const made = new Array(n).fill(0) // made[i] = 룬 i 를 업그레이드로 만든 횟수
  for (let i = n - 1; i >= 0; i--) {
    const short = demand[i] - (have[i] || 0)
    if (short <= 0) continue
    if (i === 0) return { status: 'missing', upgrades: [], gems: new Map(), missing, missingTotal }
    made[i] = short
    demand[i - 1] += short * table.steps[i - 1].qty
  }
  const upgrades = []
  const gems = new Map()
  for (let i = 1; i < n; i++) {
    if (!made[i]) continue
    const s = table.steps[i - 1]
    upgrades.push({ from: i - 1, to: i, times: made[i], qty: s.qty, gem: s.gem })
    if (s.gem) gems.set(s.gem, (gems.get(s.gem) || 0) + made[i])
  }
  return { status: 'upgrade', upgrades, gems, missing, missingTotal }
}
