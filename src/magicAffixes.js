// 매직/레어 접사(접두사·접미사) 규칙 - 판매글 등록에서 "이 베이스에 실제로 붙을 수 있는 옵션과 수치"만
// 고르게 함. 데이터는 게임 원본 magicprefix/magicsuffix (scripts/build-magic-affixes.js).
//
// 게임 규칙 (그대로 옮김):
// - 접사는 itype(붙는 종류) 중 하나가 베이스 종류(상위 분류 포함)에 있고, etype(제외 종류)은 없어야 함
// - classspecific 접사(아마존 스킬 트리 등)는 직업 전용 베이스면 그 직업 것만
// - 레어는 rare=1 접사만, 접두사·접미사 각각 최대 3개 (주얼은 합쳐서 4개), 매직은 각각 1개
// - 같은 group 번호 접사는 한 아이템에 하나만 (예: 생명력 접미사 두 개 불가)
// - 접사 레벨(level~maxlevel)은 아이템의 affix level(alvl) 안이어야 함. alvl 은 아이템 레벨과
//   베이스 qlvl(+magic lvl)로 정해져서, 베이스마다 alvl 최솟값이 있음 -> 같이 붙은 접사들이 한 alvl 에서
//   동시에 가능해야 함 (예: maxlevel 이 낮은 저레벨 접사 + 고레벨 접사 조합 불가)
// 수치는 접사 단계(tier)마다 범위가 있고, 한 옵션 안의 수치들(예: 인핸스드 데미지 + 명중률)은 같은 단계여야 함
// data = src/data/magicAffixes.json (화면과 데이터 검사 스크립트가 같이 쓰도록 인자로 받음)

const CLASS_KO = {
  ama: '아마존', sor: '소서리스', nec: '네크로맨서', pal: '팔라딘', bar: '바바리안', dru: '드루이드', ass: '어쌔신', war: '악마술사',
}
// 스킬 트리 번호(skilltab param) -> 이름 (아이템 사전 옵션 표기와 같은 이름)
const SKILL_TAB_KO = [
  ['활과 석궁 기술', 'ama'], ['패시브와 마법 기술', 'ama'], ['투창과 창 기술', 'ama'],
  ['화염 기술', 'sor'], ['번개 기술', 'sor'], ['냉기 기술', 'sor'],
  ['저주 기술', 'nec'], ['독과 뼈 기술', 'nec'], ['소환 기술', 'nec'],
  ['전투 기술', 'pal'], ['공격 오라', 'pal'], ['방어 오라', 'pal'],
  ['전투 기술', 'bar'], ['전투 숙련', 'bar'], ['함성', 'bar'],
  ['소환 기술', 'dru'], ['변신 기술', 'dru'], ['정령 기술', 'dru'],
  ['덫 기술', 'ass'], ['그림자 수련', 'ass'], ['무술 기술', 'ass'],
  ['악마 기술', 'war'], ['기괴 기술', 'war'], ['혼돈 기술', 'war'],
]
export const SKILL_TAB_NAMES = [...new Set(SKILL_TAB_KO.map(([n]) => n))]

// 옵션 종류가 같은지 가를 때 param 까지 봐야 하는 것 (스킬 트리 번호, 스킬 id)
const IDENTITY_PARAM = new Set(['skilltab', 'hit-skill', 'att-skill', 'gethit-skill', 'charged'])
const fixed = (v) => [v, v]
const range = (a, b) => [Math.min(a, b), Math.max(a, b)]
const frames = (v, len) => Math.round((v * len) / 256) // 독 피해: 프레임당 값 -> 총 피해
const sec = (len) => Math.round(len / 25)

// 문구는 아이템 사전(items.json) 옵션 표기에 맞춤 (예: Light Radius = 시야, Knockback = 밀쳐내기)
// 옵션 코드별: slots(mod, siblings, ctx) -> 수치 칸마다 [최소, 최대], text(values, mod) -> 옵션 문구
// (수치 칸이 없는 옵션은 slots 가 빈 배열)
const simple = (tpl) => ({ slots: (m) => [range(m.min, m.max)], text: ([v]) => tpl.replace('#', v) })
const noValue = (text) => ({ slots: () => [], text: () => text })
const perLevel = (label, div) => ({
  slots: (m) => [fixed(m.param / div)],
  text: ([v]) => `${label} +${v} (캐릭터 레벨당)`,
})
const skillProc = (when) => ({
  slots: (m) => [fixed(m.min), fixed(m.max)],
  text: ([chance, lv], m) => `${when} ${chance}% 확률로 ${lv} 레벨 ${m.skill.ko} 시전`,
})
const MODS = {
  ac: simple('방어력 +#'), 'ac%': simple('방어력 +#% 증가'),
  'dmg%': simple('인핸스드 데미지 +#%'), 'dmg-min': simple('최소 피해 +#'), 'dmg-max': simple('최대 피해 +#'),
  att: simple('명중률 +#'), 'att%': simple('명중률 보너스 #%'),
  'dmg-to-mana': simple('받는 피해의 +#%만큼 마나 회복'), 'regen-stam': simple('지구력 회복 속도 #% 증가'),
  stam: simple('최대 지구력 +#'), light: simple('시야 +#'), 'mag%': simple('마법 아이템 발견 확률 #% 증가'),
  'gold%': simple('괴물에게서 얻는 금화 #% 증가'),
  mana: simple('마나 +#'), hp: simple('생명력 +#'), regen: simple('생명력 회복 +#'),
  'res-all': simple('모든 저항 +#%'), 'res-cold': simple('냉기 저항 +#%'), 'res-fire': simple('화염 저항 +#%'),
  'res-ltng': simple('번개 저항 +#%'), 'res-pois': simple('독 저항 +#%'),
  'mana-kill': simple('적 처치 시 마나 +#'),
  'att-demon': simple('악마에 대한 명중률 +#'), 'dmg-demon': simple('악마에게 주는 피해 +#%'),
  'att-undead': simple('언데드에 대한 명중률 +#'), 'dmg-undead': simple('언데드에게 주는 피해 +#%'),
  stack: simple('중첩 수량 +#'),
  'cold-min': simple('최소 냉기 피해 +#'), 'cold-max': simple('최대 냉기 피해 +#'),
  'fire-min': simple('최소 화염 피해 +#'), 'fire-max': simple('최대 화염 피해 +#'),
  'ltng-min': simple('최소 번개 피해 +#'), 'ltng-max': simple('최대 번개 피해 +#'),
  'cold-len': { slots: (m) => [range(sec(m.min), sec(m.max))], text: ([v]) => `냉기 효과 지속시간 ${v}초` },
  'red-dmg': simple('피해 # 감소'), 'red-mag': simple('마법 피해 # 감소'),
  'dmg-ac': { slots: (m) => [range(Math.abs(m.min), Math.abs(m.max))], text: ([v]) => `적중당 괴물 방어력 -${v} 감소` },
  thorns: simple('공격자가 피해를 # 받음'),
  swing1: simple('공격 속도 +#%'), swing2: simple('공격 속도 +#%'), swing3: simple('공격 속도 +#%'),
  block: simple('막기 확률 #% 증가'),
  block1: simple('막기 속도 +#%'), block2: simple('막기 속도 +#%'), block3: simple('막기 속도 +#%'),
  cast1: simple('시전 속도 +#%'), cast2: simple('시전 속도 +#%'), cast3: simple('시전 속도 +#%'),
  balance1: simple('타격 회복 속도 +#%'), balance2: simple('타격 회복 속도 +#%'), balance3: simple('타격 회복 속도 +#%'),
  move1: simple('달리기/걷기 속도 +#%'), move2: simple('달리기/걷기 속도 +#%'), move3: simple('달리기/걷기 속도 +#%'),
  str: simple('힘 +#'), dex: simple('민첩 +#'), enr: simple('마력 +#'), vit: simple('활력 +#'),
  lifesteal: simple('적중당 생명력 #% 훔침'), manasteal: simple('적중당 마나 #% 훔침'),
  'res-pois-len': simple('독 지속시간 #% 감소'), ease: simple('착용 조건 #%'), stamdrain: simple('지구력 고갈 속도 #% 감소'),
  // 적중 시 괴물 도주: 128 = 100%
  howl: { slots: (m) => [range(Math.round((m.min * 100) / 128), Math.round((m.max * 100) / 128))], text: ([v]) => `적중 시 괴물 도주 +${v}%` },
  'ignore-ac': noValue('대상의 방어력 무시'), 'half-freeze': noValue('빙결 지속시간 절반으로 감소'),
  noheal: noValue('괴물 회복 저지'), knock: noValue('밀쳐내기'), indestruct: noValue('파괴 불가'),
  'rep-dur': { slots: (m) => [fixed(Math.round(100 / m.param))], text: ([v]) => `내구도 1 회복 (매 ${v}초)` },
  'rep-quant': { slots: (m) => [fixed(Math.round(100 / m.param))], text: ([v]) => `수량 1 회복 (매 ${v}초)` },
  'ac/lvl': perLevel('방어력', 8), 'dmg/lvl': perLevel('최대 피해', 8), 'att/lvl': perLevel('명중률', 2),
  'att%/lvl': perLevel('명중률 보너스(%)', 2), 'mana/lvl': perLevel('마나', 8), 'hp/lvl': perLevel('생명력', 8),
  // 소켓: param 이 있으면 그 개수, 없으면 min~max. 베이스 최대 소켓 수를 넘을 수 없음
  sock: {
    slots: (m, _s, ctx) => {
      const [lo, hi] = m.param ? fixed(m.param) : range(m.min, m.max)
      const cap = ctx.maxSockets || 0
      return [[Math.min(lo, cap), Math.min(hi, cap)]]
    },
    text: ([v]) => `소켓 ${v}개`,
  },
  // 독 피해 (param = 지속 프레임): 게임 표기처럼 총 피해와 초로
  'dmg-pois': {
    slots: (m) => [range(frames(m.min, m.param), frames(m.max, m.param)), fixed(sec(m.param))],
    text: ([v, s]) => `독 피해 +${v} (${s}초간)`,
  },
  'pois-min': { slots: (m, sib) => [fixed(frames(m.min, sib['pois-len']?.min || 25))], text: ([v]) => `최소 독 피해 +${v}` },
  'pois-max': { slots: (m, sib) => [fixed(frames(m.max, sib['pois-len']?.min || 25))], text: ([v]) => `최대 독 피해 +${v}` },
  'pois-len': { slots: (m) => [fixed(sec(m.min))], text: ([v]) => `독 피해 지속시간 ${v}초` },
  'dmg-fire': { slots: (m) => [fixed(m.min), fixed(m.max)], text: ([a, b]) => `화염 피해 ${a}-${b} 추가` },
  'dmg-ltng': { slots: (m) => [fixed(m.min), fixed(m.max)], text: ([a, b]) => `번개 피해 ${a}-${b} 추가` },
  'dmg-cold': { slots: (m) => [fixed(m.min), fixed(m.max)], text: ([a, b]) => `냉기 피해 ${a}-${b} 추가` },
  skilltab: {
    slots: (m) => [range(m.min, m.max)],
    text: ([v], m) => `${SKILL_TAB_KO[m.param][0]} +${v} (${CLASS_KO[SKILL_TAB_KO[m.param][1]]} 전용)`,
  },
  'hit-skill': skillProc('타격 시'), 'att-skill': skillProc('공격 시'), 'gethit-skill': skillProc('피격 시'),
  // 충전: max 가 음수면 스킬 레벨이 아이템 레벨로 정해짐 (slvl = (ilvl - 스킬 요구 레벨) / ((99 - 요구 레벨) / -max)),
  // 충전 횟수 = -min + (-min * slvl / 8). 판매자는 스킬 레벨만 고르고 충전 횟수는 계산해서 넣음
  charged: {
    slots: (m, _s, ctx) => {
      if (m.max > 0) return [fixed(m.max)]
      const step = Math.max(1, Math.floor((99 - m.skill.req) / -m.max))
      const lv = (ilvl) => Math.max(1, Math.floor((ilvl - m.skill.req) / step))
      return [[lv(ctx.ilvlMin), lv(ctx.ilvlMax)]]
    },
    text: ([lv], m) => {
      if (typeof lv !== 'number') return `${lv} 레벨 ${m.skill.ko} (충전)`
      const charges = m.min > 0 ? m.min : Math.min(255, -m.min + Math.floor((-m.min * lv) / 8))
      return `${lv} 레벨 ${m.skill.ko} (충전 ${charges}/${charges}회)`
    },
  },
}
// 크래프트 제작법 고정 옵션에만 나오는 것
Object.assign(MODS, {
  'ac-miss': simple('원거리 공격 방어력 +#'), 'ac-hth': simple('근접 공격 방어력 +#'),
  deadly: simple('치명적 공격 +#%'), crush: simple('강타 확률 +#%'), openwounds: simple('상처 악화 확률 +#%'),
  'demon-heal': simple('악마 처치 시 생명력 +#'), 'regen-mana': simple('마나 재생 #%'), 'mana%': simple('최대 마나 #% 증가'),
  'res-mag': simple('마법 저항 +#%'),
})
for (const c of Object.keys(CLASS_KO)) MODS[c] = simple(`${CLASS_KO[c]} 기술 레벨 +#`)
export const AFFIX_MOD_CODES = Object.keys(MODS)

// 아이템 레벨(ilvl) -> affix level(alvl): alvl = ilvl + magic lvl (지팡이·완드·오브·서클릿),
// 아니면 ilvl < 99 - qlvl/2 일 때 ilvl - qlvl/2, 그 이상은 2*ilvl - 99 (1~99)
export function affixLevelAt(info, ilvl) {
  const half = Math.floor(info.qlvl / 2)
  const a = info.magic_lvl ? ilvl + info.magic_lvl : ilvl < 99 - half ? ilvl - half : 2 * ilvl - 99
  return Math.max(1, Math.min(99, a))
}
// 품질별 아이템 레벨 범위: 드랍 매직/레어는 qlvl~99,
// 크래프트는 캐릭터 레벨/2 + 재료 아이템 레벨/2 (최대 49+49=98), qlvl 보다 낮으면 qlvl
function ilvlRange(info, quality) {
  return quality === 'crafted' ? [Math.min(info.qlvl, 98), 98] : [info.qlvl, 99]
}
// 크래프트 아이템 레벨 = floor(캐릭터 레벨/2) + floor(재료 아이템 레벨/2), 베이스 qlvl 보다 낮으면 qlvl
export const craftItemLevel = (info, clvl, inputIlvl) => Math.max(info.qlvl, Math.floor(clvl / 2) + Math.floor(inputIlvl / 2))
// 크래프트 무작위 옵션 개수 확률 (아이템 레벨 구간별) - [1개, 2개, 3개, 4개]
// 1~30: 40/20/20/20%, 31~50: 0/60/20/20%, 51~70: 0/0/80/20%, 71 이상: 항상 4개. 레벨이 낮아도 4개는 나올 수 있음
export function craftAffixCountOdds(ilvl) {
  if (ilvl <= 30) return [0.4, 0.2, 0.2, 0.2]
  if (ilvl <= 50) return [0, 0.6, 0.2, 0.2]
  if (ilvl <= 70) return [0, 0, 0.8, 0.2]
  return [0, 0, 0, 1]
}

// 한 접사 줄(tier)의 수치 칸들 - 여러 옵션(mod)의 칸을 순서대로 이어붙임
function tierSlots(tier, ctx) {
  const sib = Object.fromEntries(tier.mods.map((m) => [m.code, m]))
  const ilvlMin = Math.max(ctx.ilvlMin, tier.level - (ctx.magicLvl || 0), 1)
  return tier.mods.flatMap((m) => MODS[m.code].slots(m, sib, { ...ctx, ilvlMin }))
}
const familyKey = (a) => a.slot + ':' + a.mods.map((m) => m.code + (IDENTITY_PARAM.has(m.code) ? '=' + m.param : '')).join('+')
const withRanges = (f) => {
  const n = f.tiers[0].slots.length
  const slotRanges = Array.from({ length: n }, (_, i) => [
    Math.min(...f.tiers.map((t) => t.slots[i][0])), Math.max(...f.tiers.map((t) => t.slots[i][1])),
  ])
  return { ...f, slotRanges, label: familyText(f, slotRanges.map(([lo, hi]) => (lo === hi ? lo : `${lo}~${hi}`))) }
}

// 이 베이스·품질(magic|rare|crafted)에 붙을 수 있는 옵션 종류 목록 (크래프트는 레어 접사 풀)
// -> [{ key, slot:'p'|'s', mods, tiers:[{ level, maxlevel, group, slots }], slotRanges, label }]
// base: { code, sockets } (baseItems.json 항목이나 MISC_BASES 항목)
export function affixFamiliesFor(data, base, quality) {
  const info = base && data.bases[base.code]
  const rarePool = quality === 'rare' || quality === 'crafted'
  if (!info || (quality === 'rare' && !info.rare)) return []
  const [ilvlMin, ilvlMax] = ilvlRange(info, quality)
  const ctx = { magicLvl: info.magic_lvl || 0, maxSockets: base.sockets || 0, ilvlMin, ilvlMax }
  const amin = affixLevelAt(info, ilvlMin)
  const amax = affixLevelAt(info, ilvlMax)
  const types = new Set(info.types)
  const fams = new Map()
  for (const a of data.affixes) {
    if (rarePool && !a.rare) continue
    if (!a.itypes.some((t) => types.has(t)) || (a.etypes || []).some((t) => types.has(t))) continue
    if (a.cls && info.cls && a.cls !== info.cls) continue
    if (a.level > amax || (a.maxlevel && a.maxlevel < amin)) continue
    if (a.mods.some((m) => !MODS[m.code])) continue
    const slots = tierSlots(a, ctx)
    // 소켓 옵션인데 이 베이스는 소켓을 못 뚫는 경우
    if (a.mods.some((m) => m.code === 'sock') && slots.some(([, hi]) => hi <= 0)) continue
    const key = familyKey(a)
    if (!fams.has(key)) fams.set(key, { key, slot: a.slot, mods: a.mods, tiers: [] })
    fams.get(key).tiers.push({ level: a.level, maxlevel: a.maxlevel || 99, group: a.group, slots })
  }
  return [...fams.values()].map(withRanges).sort((x, y) => x.label.localeCompare(y.label, 'ko'))
}

// 이 베이스로 만들 수 있는 크래프트 제작법 -> [{ id, name, fam }] (fam: 고정 옵션을 옵션 종류 모양으로)
export function craftRecipesFor(data, base) {
  const info = base && data.bases[base.code]
  if (!info) return []
  const ctx = { magicLvl: info.magic_lvl || 0, maxSockets: base.sockets || 0, ilvlMin: 1, ilvlMax: 98 }
  return (data.crafts || [])
    .filter((c) => (c.codes ? c.codes.includes(base.code) : info.types.includes(c.type)))
    .map((c) => ({
      id: c.id, name: c.name,
      fam: withRanges({ key: 'craft:' + c.id, slot: 'c', mods: c.mods, tiers: [{ level: 0, maxlevel: 99, group: null, slots: tierSlots({ mods: c.mods, level: 0 }, ctx) }] }),
    }))
}

// 옵션 종류 + 수치 -> 판매글에 들어갈 옵션 줄들
export const familyText = (fam, values) => familyLines(fam, values).join(', ')
export function familyLines(fam, values) {
  let i = 0
  return fam.mods.map((m) => {
    const n = MODS[m.code].slots(m, {}, { maxSockets: 6, ilvlMin: 1, ilvlMax: 99 }).length
    const vals = values.slice(i, i + n)
    i += n
    return MODS[m.code].text(vals, m)
  })
}

export const affixLimits = (base, quality) => {
  if (quality === 'magic') return { p: 1, s: 1, total: 2 }
  if (quality === 'crafted' || base?.code === 'jew') return { p: 3, s: 3, total: 4 }
  return { p: 3, s: 3, total: 6 }
}

// 수치가 다 들어간 옵션인지 (고정 수치는 자동으로 채워짐)
export const filledValues = (fam, values) =>
  fam.slotRanges.map(([lo, hi], i) => (lo === hi ? lo : values?.[i] === '' || values?.[i] === undefined || values?.[i] === null ? null : Number(values[i])))

// 수치 칸이 범위 밖이면 그 칸 번호, 아니면 -1
// (고정 수치 칸은 검사 안 함 - 레벨당 옵션은 '마나 +0.75 (캐릭터 레벨당)'처럼 원래 소수라 정수 검사에 걸림)
const badSlot = (fam, vals) =>
  vals.findIndex((v, i) => {
    const [lo, hi] = fam.slotRanges[i]
    return v !== null && lo !== hi && (!Number.isInteger(v) || v < lo || v > hi)
  })

// 크래프트 고정 옵션 수치 검사 -> 문제 문구 목록
export function validateCraftValues(recipe, values) {
  const vals = filledValues(recipe.fam, values)
  if (vals.some((v) => v === null)) return [`${recipe.name} 고정 옵션 수치를 골라주세요`]
  const bad = badSlot(recipe.fam, vals)
  return bad >= 0 ? [`${recipe.name} 고정 옵션 (수치 ${recipe.fam.slotRanges[bad].join('~')})`] : []
}

// 고른 옵션들이 한 아이템에 같이 있을 수 있는지 검사 -> 문제 문구 목록 (없으면 [])
// picks: [{ fam, values }]
export function validateAffixPicks(data, base, quality, picks) {
  const errs = []
  const info = base && data.bases[base.code]
  if (!info) return errs
  const lim = affixLimits(base, quality)
  const count = (s) => picks.filter((p) => p.fam.slot === s).length
  if (count('p') > lim.p) errs.push(`접두사는 최대 ${lim.p}개예요`)
  if (count('s') > lim.s) errs.push(`접미사는 최대 ${lim.s}개예요`)
  if (picks.length > lim.total) errs.push(`옵션은 합쳐서 최대 ${lim.total}개예요`)
  // 옵션마다 입력한 수치에 맞는 단계(tier) 후보
  const cands = []
  for (const p of picks) {
    const vals = filledValues(p.fam, p.values)
    const bad = badSlot(p.fam, vals)
    if (bad >= 0) {
      const [lo, hi] = p.fam.slotRanges[bad]
      errs.push(`${p.fam.label} (수치 ${lo}~${hi})`)
      continue
    }
    const ts = p.fam.tiers.filter((t) => t.slots.every(([lo, hi], i) => vals[i] === null || (vals[i] >= lo && vals[i] <= hi)))
    if (!ts.length) {
      errs.push(`${familyText(p.fam, vals.map((v, i) => v ?? p.fam.slotRanges[i].join('~')))} - 이 수치 조합은 한 단계에서 나오지 않아요`)
      continue
    }
    cands.push({ p, ts })
  }
  if (errs.length) return errs
  // 같은 그룹 금지 + 모든 옵션이 한 affix level 에서 동시에 가능해야 함 -> 단계 조합을 전부 시도
  const [ilvlMin, ilvlMax] = ilvlRange(info, quality)
  const amin = affixLevelAt(info, ilvlMin)
  const amax = affixLevelAt(info, ilvlMax)
  const levels = [amin, ...cands.flatMap((c) => c.ts.map((t) => t.level))].filter((l) => l >= amin && l <= amax)
  const ok = levels.some((L) => {
    const used = new Set()
    const pick = (i) => {
      if (i === cands.length) return true
      for (const t of cands[i].ts) {
        if (t.level > L || t.maxlevel < L || used.has(t.group)) continue
        used.add(t.group)
        if (pick(i + 1)) return true
        used.delete(t.group)
      }
      return false
    }
    return pick(0)
  })
  if (!ok) errs.push('고른 옵션들은 한 아이템에 같이 붙을 수 없어요 (같은 종류 옵션이 겹치거나 아이템 레벨 조건이 안 맞아요)')
  return errs
}

// ---------- 크래프트 시뮬레이터 ----------
// 게임 방식: 옵션 개수를 아이템 레벨 구간 확률로 정한 뒤, 하나씩 접두사/접미사를 50:50으로 정하고
// (한쪽이 3개 찼거나 뽑을 게 없으면 다른 쪽) 레어 접사 풀에서 frequency 가중치로 뽑음. 같은 그룹은 다시 안 나옴.
// 수치는 고른 단계의 범위 안에서 균등하게

// 이 베이스·크래프트 아이템 레벨에서 뽑힐 수 있는 접사 -> { p: [...], s: [...], alvl }
export function craftPools(data, base, ilvl) {
  const info = data.bases[base.code]
  const alvl = affixLevelAt(info, ilvl)
  const types = new Set(info.types)
  const ctx = { magicLvl: info.magic_lvl || 0, maxSockets: base.sockets || 0, ilvlMin: ilvl, ilvlMax: ilvl }
  const pools = { p: [], s: [], alvl }
  for (const a of data.affixes) {
    if (!a.rare || !(a.freq > 0)) continue
    if (!a.itypes.some((t) => types.has(t)) || (a.etypes || []).some((t) => types.has(t))) continue
    if (a.cls && info.cls && a.cls !== info.cls) continue
    if (a.level > alvl || (a.maxlevel && a.maxlevel < alvl)) continue
    if (a.mods.some((m) => !MODS[m.code])) continue
    const slots = tierSlots(a, ctx)
    if (a.mods.some((m) => m.code === 'sock') && slots.some(([, hi]) => hi <= 0)) continue
    pools[a.slot].push({ key: familyKey(a), mods: a.mods, group: a.group, freq: a.freq, slots, name: a.name, level: a.level, maxlevel: a.maxlevel || null })
  }
  return pools
}

// 뽑힐 수 있는 옵션 종류 (목표 옵션 선택·가중치 표) -> [{ key, slot, mods, slotRanges, label, tiers: [{ name, level, maxlevel, freq, slots }] }]
export function craftPoolFamilies(pools) {
  const fams = new Map()
  for (const slot of ['p', 's']) {
    for (const a of pools[slot]) {
      if (!fams.has(a.key)) fams.set(a.key, { key: a.key, slot, mods: a.mods, tiers: [] })
      fams.get(a.key).tiers.push({ slots: a.slots, name: a.name, level: a.level, maxlevel: a.maxlevel, freq: a.freq })
    }
  }
  return [...fams.values()].map(withRanges).sort((x, y) => x.label.localeCompare(y.label, 'ko'))
}

const rollInt = (lo, hi, rng) => lo + Math.floor(rng() * (hi - lo + 1))
function pickWeighted(list, rng) {
  const total = list.reduce((s, a) => s + a.freq, 0)
  let r = rng() * total
  for (const a of list) {
    r -= a.freq
    if (r < 0) return a
  }
  return list[list.length - 1]
}

// 한 번 제작 -> { count, fixed: 고정 옵션 수치, affixes: [{ key, slot, mods, values }] }
export function rollCraft(pools, recipe, ilvl, rng = Math.random) {
  const odds = craftAffixCountOdds(ilvl)
  let r = rng()
  let count = 4
  for (let i = 0; i < 4; i++) {
    r -= odds[i]
    if (r < 0) { count = i + 1; break }
  }
  const used = new Set()
  const n = { p: 0, s: 0 }
  const affixes = []
  const avail = (slot) => (n[slot] < 3 ? pools[slot].filter((a) => !used.has(a.group)) : [])
  for (let k = 0; k < count; k++) {
    const ap = avail('p')
    const as = avail('s')
    let slot
    if (ap.length && as.length) slot = rng() < 0.5 ? 'p' : 's'
    else if (ap.length) slot = 'p'
    else if (as.length) slot = 's'
    else break
    const a = pickWeighted(slot === 'p' ? ap : as, rng)
    used.add(a.group)
    n[slot]++
    affixes.push({ key: a.key, slot, mods: a.mods, values: a.slots.map(([lo, hi]) => rollInt(lo, hi, rng)) })
  }
  const fixed = recipe.fam.slotRanges.map(([lo, hi]) => rollInt(lo, hi, rng))
  return { count, fixed, affixes }
}

// 여러 번 제작해서 통계 -> { runs, countDist: [1~4개 횟수], keyHits: Map<key, 횟수>, targetHits }
// targets: [{ key, min }] - 그 옵션이 붙고 첫 수치가 min 이상 (전부 만족해야 성공)
export function simulateCraft(pools, recipe, ilvl, runs, targets = [], rng = Math.random) {
  const countDist = [0, 0, 0, 0]
  const keyHits = new Map()
  let targetHits = 0
  for (let i = 0; i < runs; i++) {
    const res = rollCraft(pools, recipe, ilvl, rng)
    countDist[res.affixes.length - 1] = (countDist[res.affixes.length - 1] || 0) + 1
    for (const a of res.affixes) keyHits.set(a.key, (keyHits.get(a.key) || 0) + 1)
    if (targets.length && targets.every((t) => res.affixes.some((a) => a.key === t.key && (a.values[0] ?? 0) >= (t.min || 0)))) targetHits++
  }
  return { runs, countDist, keyHits, targetHits }
}
