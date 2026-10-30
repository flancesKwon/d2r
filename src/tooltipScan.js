import { supabase } from './supabase.js'
import { squashText } from './itemSearch.js'
import magicAffixData from './data/magicAffixes.json'
import { familyLineSlots, craftRecipesFor } from './magicAffixes.js'
import {
  findItemsByReadName, getItemAffixes, isRollRangeAffix, isRandomClassSkillAffix, isAllowedValue, searchBaseItems, BASE_ITEMS, CLASS_SKILL_NAMES,
  SUPERIOR_MODS, superiorCombosFor,
} from './tradeStore.js'

const MAX_SIDE = 1600

// 이미지 파일을 긴 변 1600px 이하 JPEG 로 줄여서 base64 (앞의 data: 부분 없이)
async function toJpegBase64(file) {
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bmp.width * scale)
  canvas.height = Math.round(bmp.height * scale)
  canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.9).split(',')[1]
}

// Edge Function read-tooltip 호출 -> { found, name, base_name, ethereal, defense, damage_min, damage_max, sockets, lines }
export async function readTooltipImage(file) {
  const image = await toJpegBase64(file)
  const { data, error } = await supabase.functions.invoke('read-tooltip', { body: { image, media_type: 'image/jpeg' } })
  if (error) {
    const body = await error.context?.json?.().catch(() => null)
    throw new Error(body?.error || '툴팁 읽기 실패')
  }
  return data
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// 옵션 문구에서 범위("12~15") 자리를 숫자 캡처로 바꾼 패턴 (띄어쓰기 무시)
function affixPattern(a) {
  const text = squashText(a.text)
  const range = squashText(`${a.min}~${a.max}`)
  const at = text.indexOf(range)
  return new RegExp(`^${escapeRe(text.slice(0, at))}(\\d+)${escapeRe(text.slice(at + range.length))}$`)
}

// 게임 툴팁은 사전과 어순이 다를 수 있음 ("피해 +280% 증가" / "피해 증가 +230~280%") -> 숫자·기호를 뺀 낱말 묶음이 같은지로도 봄
// 게임 표기 차이도 같게 봄: "(암살자 전용)" 꼬리, 스킬 트리 "무술 기술 +2" / "무술 +2", 생명력 "흡혈" / "훔침", 석궁 "쇠뇌" / "석궁", 적 저항 "적의 화염 저항 5~10% 감소" / "적 화염 저항 -10%"
// 직업 이름도 사전("어쌔신", "팔라딘", "네크로맨서"...)과 게임("암살자", "성기사", "강령술사"...)이 다름. 독 피해 "6초 동안 독 피해 12 추가" / "독 피해 +12 (6초에 걸쳐)"도 같게
export const wordKey = (s) => s
  .replace(/\([^)]*전용\)/g, ' ')
  .replace(/\(캐릭터 레벨에 비례\)|캐릭터 레벨당/g, ' ')
  .replace(/\s기술(?=\s*\+\d)/g, ' ')
  .replace(/^(적의?\s.*저항)\s*-\s*(\d+%?)$/, '$1 $2 감소')
  .replace(/^적의?\s(.*저항.*?)\s*감소$/, '적 $1')
  .replace('어쌔신', '암살자')
  .replace('팔라딘', '성기사')
  .replace('네크로맨서', '강령술사')
  .replace('소서리스', '원소술사')
  .replace('바바리안', '야만용사')
  .replace('모든 속성', '모든 능력치')
  .replace(/(최대|최소) 공격력/, '$1 피해')
  .replace(/초 동안|초에 걸쳐|초간/g, '초')
  .replace(/(독 피해.*초.*) 추가$/, '$1')
  .replace(/\s효과(?=\s*적용)/g, '')
  .replace('받는 물리 ', ' ')
  .replace('흡혈', '훔침')
  .replace('쇠뇌', '석궁')
  .replace(/[\d+\-~%().]/g, ' ').split(/\s+/).filter(Boolean).sort().join(' ')
const numbersIn = (s) => s.match(/\d+/g) || []

// 어순이 다른 줄에서 수치 읽기: 범위 밖의 고정 숫자(예: "15 레벨")를 빼고 하나 남을 때만
function looseValue(a, line) {
  if (wordKey(a.text) !== wordKey(line)) return null
  const fixed = numbersIn(a.text.replace(`${a.min}~${a.max}`, ''))
  const rest = numbersIn(line).filter((n) => { const i = fixed.indexOf(n); return i < 0 || !fixed.splice(i, 1) })
  return rest.length === 1 ? rest[0] : null
}

// 아직 안 쓴 줄 중에서 이 옵션의 수치가 든 줄 찾기 -> { idx, v } (사전 어순 그대로 먼저, 안 되면 낱말로)
function findRoll(a, lines, used) {
  const re = affixPattern(a)
  const strict = lines.findIndex((l, j) => !used.has(j) && re.test(squashText(l)))
  if (strict >= 0) return { idx: strict, v: re.exec(squashText(lines[strict]))[1] }
  const loose = lines.findIndex((l, j) => !used.has(j) && looseValue(a, l) !== null)
  if (loose < 0) return null
  // 범위가 음수인 옵션("독 저항 -90~-70%")은 줄에 마이너스가 있어야 음수 수치로 읽음
  const negative = Number(a.max) <= 0 && /-\s*\d/.test(lines[loose])
  return { idx: loose, v: (negative ? '-' : '') + looseValue(a, lines[loose]) }
}

const CLASS_CODE_BY_NAME = Object.fromEntries(Object.entries(CLASS_SKILL_NAMES).map(([code, name]) => [name, code]))
const RANDOM_CLASS_LINE = new RegExp(`^(${Object.keys(CLASS_CODE_BY_NAME).join('|')}) 기술 레벨 \\+(\\d+)$`)

// 읽은 결과를 사전 아이템에 맞춰 폼에 넣을 값으로 바꿈. 사전에서 못 찾은 것은 unmatched 로 돌려줌
// -> { item, base, ethereal, defense, dmgMin, dmgMax, superior: {mods, values}, rolled: {옵션 번호: 수치}, randClass: {옵션 번호: 직업 코드}, unmatched: [줄] }
// unmatched = 사전에 없는 줄 + 읽은 수치가 사전 범위를 벗어난 줄 (판매자가 확인)
// 이름 줄 끝의 * 같은 표시와 따옴표·괄호 기호는 이름이 아님
const cleanName = (s) => s.replace(/[*'"\[\]【】]/g, '').trim()

// 상급(방어력 증가·피해 증가·명중률 줄이 보이는 것)은 남은 줄에서 읽음. 최대 내구도는 줄로 안 나와서 못 읽음
function readSuperior(base, lines, used, rejected) {
  const superior = { mods: [], values: {} }
  for (const k of new Set(superiorCombosFor(base).flat())) {
    const mod = SUPERIOR_MODS[k]
    const hit = findRoll({ ...mod, text: mod.text.replace('{v}', `${mod.min}~${mod.max}`) }, lines, used)
    if (!hit) continue
    used.add(hit.idx)
    if (isAllowedValue(hit.v, mod)) { superior.mods.push(k); superior.values[k] = hit.v } else rejected.push(lines[hit.idx])
  }
  return superior
}

// 최대 내구도가 베이스보다 크면 상급 내구도 증가가 붙은 것 - 줄로 안 나와서 %는 못 정함 (조합만 고름, 에테리얼·내구도 옵션이 있으면 비교가 안 맞아 건너뜀)
function addSuperiorDurability(superior, base, scan, affixes) {
  const hasDurAffix = affixes.some((a) => /dur/.test(a.prop))
  if (base && !scan.ethereal && !hasDurAffix && scan.durability_max > base.base_stats.durability && superiorCombosFor(base).flat().includes('dur%')) {
    superior.mods.push('dur%')
  }
}

// 이름이 같은 아이템이 여럿이면 못 맞춘 줄이 가장 적은 쪽
export function matchTooltip(scan) {
  const results = findItemsByReadName(cleanName(scan.name)).map((item) => matchItem(item, scan))
  if (!results.length) return { item: null, unmatched: [] }
  return results.reduce((best, r) => (r.unmatched.length < best.unmatched.length ? r : best))
}

// 옵션이 아닌 안내 줄 ("무형 (수리 불가)", 부적 머리말, 완드·철퇴류 베이스가 원래 갖는 언데드 피해)
const INDESTRUCTIBLE_LINE = /^(무형\s*\(수리 불가\)|소지품에 보관 시 보너스 획득|언데드에게 주는 피해 \+50%)$/
// 툴팁은 힘·민첩·활력·마력이 같은 수치면 "모든 능력치 +N" 한 줄로 보여줌 - 사전이 네 줄로 갈라 둔 아이템은 풀어서 맞춤
const ALL_STATS_LINE = /^모든 (?:능력치|속성) \+(\d+)$/
const expandAllStats = (lines) => lines.flatMap((l) => {
  const m = ALL_STATS_LINE.exec(l)
  return m ? ['힘', '민첩', '활력', '마력'].map((n) => `${n} +${m[1]}`) : [l]
})

function matchItem(item, scan) {
  const affixes = getItemAffixes(item)
  const cleaned = scan.lines.map((l) => l.trim()).filter((l) => l && !INDESTRUCTIBLE_LINE.test(l))
  const lines = affixes.some((a) => /^모든 (?:능력치|속성)/.test(a.text)) ? cleaned : expandAllStats(cleaned)
  const used = new Set()
  const rolled = {}
  const rejected = []
  const randClass = {}
  affixes.forEach((a, i) => {
    if (isRandomClassSkillAffix(a)) {
      const idx = lines.findIndex((l, j) => !used.has(j) && RANDOM_CLASS_LINE.test(l))
      if (idx < 0) return
      const [, className, level] = RANDOM_CLASS_LINE.exec(lines[idx])
      used.add(idx)
      randClass[i] = CLASS_CODE_BY_NAME[className]
      if (isAllowedValue(level, a)) rolled[i] = level
      else rejected.push(lines[idx])
      return
    }
    if (!isRollRangeAffix(a)) return
    const hit = findRoll(a, lines, used)
    if (!hit) return
    used.add(hit.idx)
    if (isAllowedValue(hit.v, a)) rolled[i] = hit.v
    else rejected.push(lines[hit.idx])
  })

  // 수치가 고정인 줄은 사전 문구와 같으면 읽힌 것으로 침
  const fixed = new Set(affixes.filter((a) => !isRollRangeAffix(a)).map((a) => wordKey(a.text)))
  lines.forEach((l, j) => fixed.has(wordKey(l)) && used.add(j))

  // 룬워드는 베이스를 골라야 함 - 허용되는 베이스 중 이름이 같은 것
  let base = null
  if (item.category === 'runeword' && scan.base_name) {
    // 상급 베이스는 이름 앞에 "상급"이 붙음
    const baseName = cleanName(scan.base_name).replace(/^(상급|superior)\s*/i, '')
    const bk = squashText(baseName)
    const allowed = searchBaseItems('', null, item)
    base = allowed.find((b) => [b.name_ko, b.subtitle].some((n) => squashText(n) === bk)) || null
    // 모델이 글자를 한두 개 틀리게 읽거나(스바이핸더) 사전 이름이 게임과 다르면, 허용 베이스 중 가장 가까운 하나
    if (!base) {
      const scored = allowed.map((b) => ({ b, d: editDistance(squashText(b.name_ko), bk) })).sort((x, y) => x.d - y.d)
      if (scored[0] && scored[0].d <= 2 && (!scored[1] || scored[1].d > scored[0].d)) base = scored[0].b
    }
  }

  const superior = base ? readSuperior(base, lines, used, rejected) : { mods: [], values: {} }

  addSuperiorDurability(superior, base, scan, affixes)

  // 룬워드 방어구는 툴팁 방어력에 "방어력 +N" 옵션이 합쳐져 있음 - 폼의 기본 방어력은 그걸 뺀 베이스 값
  const acIdx = affixes.findIndex((a) => a.prop === 'ac')
  const defense = item.category === 'runeword' && scan.defense && acIdx >= 0 ? (rolled[acIdx] ? scan.defense - Number(rolled[acIdx]) : null) : scan.defense

  return {
    item,
    base,
    ethereal: scan.ethereal,
    defense,
    dmgMin: scan.damage_min,
    dmgMax: scan.damage_max,
    superior,
    rolled,
    randClass,
    unmatched: [...rejected, ...lines.filter((_, j) => !used.has(j))],
  }
}

// 옵션 줄 문구 비교용: 전용 꼬리·"캐릭터 레벨에 비례" 꼬리를 떼고 독 피해 "3초간"/"3초에 걸쳐"를 같게 봄
const slotText = (s) => squashText(s.replace(/\([^)]*전용\)|\(캐릭터 레벨에 비례\)/g, ' ').replace('초에 걸쳐', '초간').replace('어쌔신', '암살자').replace('팔라딘', '성기사').replace('네크로맨서', '강령술사').replace('소서리스', '원소술사').replace('바바리안', '야만용사'))

// 이 옵션 줄의 수치 칸마다 숫자 자리를 둔 패턴으로 툴팁 줄 찾기 -> { idx, vals: {칸 번호: 수치} }
// 범위 밖 수치는 못 읽은 것으로 침
function findSlotPattern(fam, ml, lines, skip) {
  const text = slotText(ml.text)
  let re = '^'
  let at = 0
  const caps = []
  for (const i of ml.slots) {
    const [lo, hi] = fam.slotRanges[i]
    const shown = slotText(lo === hi ? String(lo) : `${lo}~${hi}`)
    const pos = text.indexOf(shown, at)
    if (pos < 0) return null
    re += escapeRe(text.slice(at, pos)) + (lo === hi ? escapeRe(shown) : '(\\d+)')
    if (lo !== hi) caps.push(i)
    at = pos + shown.length
  }
  const pattern = new RegExp((re + escapeRe(text.slice(at)) + '$').replace('\\(충전\\)', '\\(충전\\d+/\\d+회\\)'))
  for (let j = 0; j < lines.length; j++) {
    if (skip.has(j)) continue
    const m = pattern.exec(slotText(lines[j]))
    if (!m) continue
    const vals = new Map(caps.map((i, k) => [i, m[k + 1]]))
    if ([...vals].every(([i, v]) => Number(v) >= fam.slotRanges[i][0] && Number(v) <= fam.slotRanges[i][1])) return { idx: j, vals }
  }
  return null
}

// 매직·레어 옵션 줄을 이 베이스에 붙을 수 있는 옵션 종류(families)에 맞춰 고름 - 수치가 범위 안인 것만
// 소켓 옵션은 families 에 없음
// -> { picks: { p: [{ key, values }], s: [...] }, unmatched: [줄] }
export function matchAffixLines(families, lines, limits) {
  const used = new Set()
  const picks = { p: [], s: [] }
  for (const f of families) {
    if (picks[f.slot].length >= limits[f.slot] || picks.p.length + picks.s.length >= limits.total) continue
    const taken = new Set()
    const values = []
    let ok = true
    const mlines = familyLineSlots(f)
    for (let k = 0; k < mlines.length; k++) {
      const ml = mlines[k]
      // 원소 최소·최대 피해는 게임에서 한 줄 "화염 피해 4-8 추가"로 나옴 - 두 칸을 한 번에 읽음
      const elem = /^최소 (화염|냉기|번개) 피해/.exec(ml.text)?.[1]
      if (elem && mlines[k + 1]?.text.startsWith(`최대 ${elem} 피해`)) {
        const [i0] = ml.slots
        const [i1] = mlines[k + 1].slots
        const re = new RegExp(`^${elem}피해(\\d+)-(\\d+)추가$`)
        const idx = lines.findIndex((l, j) => !used.has(j) && !taken.has(j) && re.test(squashText(l)))
        const m = idx >= 0 ? re.exec(squashText(lines[idx])) : null
        const [lo0, hi0] = f.slotRanges[i0]
        const [lo1, hi1] = f.slotRanges[i1]
        if (!m || Number(m[1]) < lo0 || Number(m[1]) > hi0 || Number(m[2]) < lo1 || Number(m[2]) > hi1) { ok = false; break }
        values[i0] = m[1]
        values[i1] = m[2]
        taken.add(idx)
        k++
        continue
      }
      const ranged = ml.slots.filter((i) => f.slotRanges[i][0] !== f.slotRanges[i][1])
      let hit
      if (!ranged.length) {
        const idx = lines.findIndex((l, j) => !used.has(j) && !taken.has(j) && wordKey(l) === wordKey(ml.text) && numbersIn(l).join() === numbersIn(ml.text).join())
        hit = idx >= 0 ? { idx } : null
      } else {
        if (ranged.length === 1) {
          const [lo, hi] = f.slotRanges[ranged[0]]
          hit = findRoll({ text: ml.text, min: lo, max: hi }, lines, new Set([...used, ...taken]))
          if (hit && !(Number(hit.v) >= lo && Number(hit.v) <= hi)) hit = null
          if (hit) values[ranged[0]] = hit.v
        }
        if (!hit) {
          // 수치 칸이 둘 이상이거나 충전처럼 줄 끝이 다른 옵션: 칸 자리를 숫자로 바꾼 패턴으로 읽음
          hit = findSlotPattern(f, ml, lines, new Set([...used, ...taken]))
          if (hit) hit.vals.forEach((v, i) => { values[i] = v })
        }
      }
      if (!hit) { ok = false; break }
      taken.add(hit.idx)
    }
    if (!ok) continue
    f.slotRanges.forEach(([lo, hi], i) => { if (lo === hi) values[i] = lo })
    taken.forEach((j) => used.add(j))
    picks[f.slot].push({ key: f.key, values })
  }
  return { picks, unmatched: lines.filter((_, j) => !used.has(j)) }
}

// 일반·매직·레어 장비는 사전 아이템이 아님 - 베이스와 품질만 찾음
// 일반: 첫 줄이 베이스 이름 / 레어: 둘째 줄이 베이스 이름 / 매직: 첫 줄 "접두 베이스 접미" 안에 베이스 이름이 들어 있음
// -> { base, misc(반지·목걸이 등 베이스 이름), quality, ethereal, defense, dmgMin, dmgMax, superior, sockets, unmatched } | null
// 매직·레어는 옵션을 안 읽음 (소켓 여부만)
function editDistance(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    prev = cur
  }
  return prev[b.length]
}
// fuzzy: 모델이 글자를 한두 개 틀리게 읽거나 사전 한글 이름이 게임과 조금 달라도, 가장 가까운 베이스가 하나일 때 그걸로 봄
function findBaseByName(text, fuzzy = false, kind = null) {
  const k = squashText(text.replace(/^(상급|superior)\s*/i, ''))
  if (!k) return null
  const base = BASE_ITEMS.find((b) => [b.name_ko, b.alt_ko, b.subtitle].some((n) => n && squashText(n) === k))
  if (base) return { base }
  // 짧은 이름은 낱말이 둘 이상일 때만 한 글자 차이를 봄 (낱말 하나는 접두사·접미사와 헷갈림)
  const maxDist = k.length >= 4 && /\s/.test(text.trim()) ? 2 : k.length >= 5 ? 2 : k.length >= 3 && /\s/.test(text.trim()) ? 1 : 0
  if (fuzzy && maxDist) {
    // 거리가 같으면 사전 이름(name_ko)에 더 가까운 쪽 - 대체 이름("완드")만 가까운 짧은 베이스에 끌려가지 않게
    const dist = (b, names) => Math.min(...names.filter(Boolean).map((n) => editDistance(squashText(n), k)))
    // 그래도 같으면 이름 길이가 읽은 글자 수에 가까운 쪽 ("페럴 클러"는 "클러"보다 "피어럴 클러")
    const lenGap = (b) => Math.abs(squashText(b.name_ko).length - k.length)
    const scored = BASE_ITEMS.filter((b) => !kind || b.base_stats?.category === kind).map((b) => ({ b, d: dist(b, [b.name_ko, b.alt_ko]), dName: dist(b, [b.name_ko]), gap: lenGap(b) })).sort((x, y) => x.d - y.d || x.dName - y.dName || x.gap - y.gap)
    const tied = scored[1] && scored[1].d === scored[0].d && scored[1].dName === scored[0].dName && scored[1].gap === scored[0].gap
    if (scored[0] && scored[0].d <= maxDist && !tied) return { base: scored[0].b }
  }
  const misc = magicAffixData.miscBases.find((b) => squashText(b.name_ko) === k)
  return misc ? { misc: misc.name_ko } : null
}
function findBaseInMagicName(name, kind) {
  const words = name.split(/\s+/).filter(Boolean)
  // 긴 낱말 묶음부터 - 게임 표기와 사전 표기가 한두 글자 다른 베이스("페이즈 블레이드" / "패이즈 블레이드")는 같은 길이에서 정확히 맞는 게 없을 때 비슷한 이름으로
  for (let len = words.length; len >= 1; len--) {
    for (const fuzzy of [false, true]) {
      for (let i = 0; i + len <= words.length; i++) {
        const hit = findBaseByName(words.slice(i, i + len).join(' '), fuzzy, kind)
        if (hit) return hit
      }
    }
  }
  return null
}

export function matchEquipTooltip(scan) {
  const name = cleanName(scan.name)
  const baseLine = scan.base_name ? cleanName(scan.base_name) : ''
  let quality = 'normal'
  let hit = findBaseByName(name)
  if (!hit && baseLine) { hit = findBaseByName(baseLine, true); quality = 'rare' }
  // 툴팁에 피해가 보이면 무기, 방어력이 보이면 방어구 - 이름이 비슷한 베이스가 여럿일 때 가르는 데 씀
  const kind = scan.damage_min != null ? 'weapon' : scan.defense != null ? 'armor' : null
  // 이름이 흰색(일반·소켓 아이템)이면 베이스 이름 하나 - 사전 표기와 한두 글자 달라도 가까운 베이스로 ("페럴 클러" / "피어럴 클러")
  if (!hit && !baseLine && scan.name_color === 'white') { hit = findBaseByName(name, true, kind); quality = 'normal' }
  if (!hit) { hit = findBaseInMagicName(name, kind); quality = 'magic' }
  if (!hit && !baseLine) { hit = findBaseByName(name, true); quality = 'normal' }
  if (!hit) return null

  const lines = scan.lines.map((l) => l.trim()).filter((l) => l && !INDESTRUCTIBLE_LINE.test(l))
  const used = new Set()
  const rejected = []
  const out = { ...hit, quality, lines, ethereal: scan.ethereal, sockets: scan.sockets || 0, superior: { mods: [], values: {} }, defense: null, dmgMin: null, dmgMax: null, unmatched: [] }
  // 레어처럼 이름 줄이 둘인 아이템 중 제작법 고정 옵션이 전부 읽히면 크래프트 (예: 블러드 장갑 = 생명력 훔침·생명력·강타)
  if (quality === 'rare' && hit.base) {
    for (const r of craftRecipesFor(magicAffixData, hit.base)) {
      const read = matchAffixLines([{ ...r.fam, slot: 'p' }], lines, { p: 1, s: 0, total: 1 })
      if (!read.picks.p.length) continue
      out.quality = 'crafted'
      out.craft = { id: r.id, values: read.picks.p[0].values }
      out.lines = read.unmatched
      break
    }
  }
  if (quality === 'normal' && hit.base) {
    out.superior = readSuperior(hit.base, lines, used, rejected)
    addSuperiorDurability(out.superior, hit.base, scan, [])
    out.defense = scan.defense
    out.dmgMin = scan.damage_min
    out.dmgMax = scan.damage_max
    out.unmatched = [...rejected, ...lines.filter((_, j) => !used.has(j))]
  } else if (quality === 'normal') out.unmatched = lines
  return out
}
