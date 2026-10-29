import { supabase } from './supabase.js'
import { squashText } from './itemSearch.js'
import {
  searchAllItems, getItemAffixes, isRollRangeAffix, isRandomClassSkillAffix, isAllowedValue, searchBaseItems, CLASS_SKILL_NAMES,
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

const CLASS_CODE_BY_NAME = Object.fromEntries(Object.entries(CLASS_SKILL_NAMES).map(([code, name]) => [name, code]))
const RANDOM_CLASS_LINE = new RegExp(`^(${Object.keys(CLASS_CODE_BY_NAME).join('|')}) 기술 레벨 \\+(\\d+)$`)

// 읽은 결과를 사전 아이템에 맞춰 폼에 넣을 값으로 바꿈. 사전에서 못 찾은 것은 unmatched 로 돌려줌
// -> { item, base, ethereal, defense, dmgMin, dmgMax, rolled: {옵션 번호: 수치}, randClass: {옵션 번호: 직업 코드}, unmatched: [줄] }
export function matchTooltip(scan) {
  const key = squashText(scan.name)
  const item = searchAllItems(scan.name).find((it) => squashText(it.name_ko) === key) || null
  if (!item) return { item: null, unmatched: [] }

  const lines = scan.lines.map((l) => l.trim()).filter(Boolean)
  const used = new Set()
  const rolled = {}
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
      return
    }
    if (!isRollRangeAffix(a)) return
    const re = affixPattern(a)
    const idx = lines.findIndex((l, j) => !used.has(j) && re.test(squashText(l)))
    if (idx < 0) return
    used.add(idx)
    const v = re.exec(squashText(lines[idx]))[1]
    if (isAllowedValue(v, a)) rolled[i] = v
  })

  // 수치가 고정인 줄은 사전 문구와 같으면 읽힌 것으로 침
  const fixed = new Set(affixes.filter((a) => !isRollRangeAffix(a)).map((a) => squashText(a.text)))
  lines.forEach((l, j) => fixed.has(squashText(l)) && used.add(j))

  // 룬워드는 베이스를 골라야 함 - 허용되는 베이스 중 이름이 같은 것
  let base = null
  if (item.category === 'runeword' && scan.base_name) {
    const bk = squashText(scan.base_name)
    base = searchBaseItems(scan.base_name, null, item).find((b) => [b.name_ko, b.subtitle].some((n) => squashText(n) === bk)) || null
  }

  return {
    item,
    base,
    ethereal: scan.ethereal,
    defense: scan.defense,
    dmgMin: scan.damage_min,
    dmgMax: scan.damage_max,
    rolled,
    randClass,
    unmatched: lines.filter((_, j) => !used.has(j)),
  }
}
