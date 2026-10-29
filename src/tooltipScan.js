import { supabase } from './supabase.js'
import { squashText } from './itemSearch.js'
import {
  searchAllItems, getItemAffixes, isRollRangeAffix, isRandomClassSkillAffix, isAllowedValue, searchBaseItems, CLASS_SKILL_NAMES,
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
// 게임 표기 차이도 같게 봄: "(암살자 전용)" 꼬리, 스킬 트리 "무술 기술 +2" / "무술 +2", 생명력 "흡혈" / "훔침", 석궁 "쇠뇌" / "석궁"
const wordKey = (s) => s
  .replace(/\([^)]*전용\)/g, ' ')
  .replace(/\(캐릭터 레벨에 비례\)|캐릭터 레벨당/g, ' ')
  .replace(/\s기술(?=\s*\+\d)/g, ' ')
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
  return loose >= 0 ? { idx: loose, v: looseValue(a, lines[loose]) } : null
}

const CLASS_CODE_BY_NAME = Object.fromEntries(Object.entries(CLASS_SKILL_NAMES).map(([code, name]) => [name, code]))
const RANDOM_CLASS_LINE = new RegExp(`^(${Object.keys(CLASS_CODE_BY_NAME).join('|')}) 기술 레벨 \\+(\\d+)$`)

// 읽은 결과를 사전 아이템에 맞춰 폼에 넣을 값으로 바꿈. 사전에서 못 찾은 것은 unmatched 로 돌려줌
// -> { item, base, ethereal, defense, dmgMin, dmgMax, superior: {mods, values}, rolled: {옵션 번호: 수치}, randClass: {옵션 번호: 직업 코드}, unmatched: [줄] }
// unmatched = 사전에 없는 줄 + 읽은 수치가 사전 범위를 벗어난 줄 (판매자가 확인)
// 이름 줄 끝의 * 같은 표시와 따옴표·괄호 기호는 이름이 아님
const cleanName = (s) => s.replace(/[*'"\[\]【】]/g, '').trim()

export function matchTooltip(scan) {
  const key = squashText(cleanName(scan.name))
  const item = searchAllItems(cleanName(scan.name)).find((it) => squashText(it.name_ko) === key) || null
  if (!item) return { item: null, unmatched: [] }

  const lines = scan.lines.map((l) => l.trim()).filter(Boolean)
  const used = new Set()
  const rolled = {}
  const rejected = []
  const randClass = {}
  const affixes = getItemAffixes(item)
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
    base = searchBaseItems(baseName, null, item).find((b) => [b.name_ko, b.subtitle].some((n) => squashText(n) === bk)) || null
  }

  // 상급(방어력 증가·피해 증가·명중률 줄이 보이는 것)은 남은 줄에서 읽음. 최대 내구도는 줄로 안 나와서 못 읽음
  const superior = { mods: [], values: {} }
  if (base) {
    for (const k of new Set(superiorCombosFor(base).flat())) {
      const mod = SUPERIOR_MODS[k]
      const hit = findRoll({ ...mod, text: mod.text.replace('{v}', `${mod.min}~${mod.max}`) }, lines, used)
      if (!hit) continue
      used.add(hit.idx)
      if (isAllowedValue(hit.v, mod)) { superior.mods.push(k); superior.values[k] = hit.v } else rejected.push(lines[hit.idx])
    }
  }

  // 최대 내구도가 베이스보다 크면 상급 내구도 증가가 붙은 것 - 줄로 안 나와서 %는 못 정함 (조합만 고름, 에테리얼·내구도 옵션이 있으면 비교가 안 맞아 건너뜀)
  const hasDurAffix = affixes.some((a) => /dur/.test(a.prop))
  if (base && !scan.ethereal && !hasDurAffix && scan.durability_max > base.base_stats.durability && superiorCombosFor(base).flat().includes('dur%')) {
    superior.mods.push('dur%')
  }

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
