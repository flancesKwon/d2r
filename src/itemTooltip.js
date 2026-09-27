// 판매글(또는 등록 중인 폼) 정보를 게임 아이템 툴팁 모양의 줄 목록으로 바꿈 - ItemTooltipCanvas가 그림
// 색은 게임 툴팁 규칙: 유니크 금색, 세트 초록, 룬워드 이름 금색 + 베이스 회색, 룬 주황,
// 매직 파랑, 레어 노랑, 방어력·데미지·요구 레벨 흰색, 옵션 줄 파랑
import { itemLevelReq, baseForItem, getItemAffixes } from './tradeStore.js'
import { runePips } from './itemStats.js'

export const TOOLTIP_COLORS = {
  white: '#FFFFFF',
  gray: '#8C8C8C',
  magic: '#6969FF',
  rare: '#FFFF64',
  set: '#00C400',
  unique: '#C7B377',
  orange: '#FFA800',
}

// 판매글 옵션 중 툴팁에서 따로 다루는 줄 (베이스 이름·방어력·데미지·소켓 등)
const META = [
  { key: 'base', re: /^베이스: (.+?)(?: \(.+\))?$/ },
  { key: 'runes', re: /^베이스 룬 조합: / },
  { key: 'defense', re: /^기본 방어력 (.+)$/ },
  { key: 'damage', re: /^기본 데미지 (.+)$/ },
  { key: 'sockets', re: /^소켓 (\d+)개$/ },
]

function nameColor(item, category, name, quality) {
  if (quality === 'magic') return TOOLTIP_COLORS.magic
  if (quality === 'rare') return TOOLTIP_COLORS.rare
  if (quality === 'crafted') return TOOLTIP_COLORS.orange
  if (item?.category === 'unique') return TOOLTIP_COLORS.unique
  if (item?.category === 'set') return TOOLTIP_COLORS.set
  if (item?.category === 'runeword') return TOOLTIP_COLORS.unique
  if (item?.type_sub === '룬' || category === '우버보스 재료') return TOOLTIP_COLORS.orange
  if (category === '매직/레어/일반') {
    if (/레어/.test(name)) return TOOLTIP_COLORS.rare
    if (/매직/.test(name)) return TOOLTIP_COLORS.magic
  }
  return TOOLTIP_COLORS.white
}

// { item, name, category, quality, options, ethereal, amountLabel } -> { icon_key, lines: [{ text, color }] }
// quality: 사전에 없는 장비를 등록할 때 고른 품질(magic|rare|crafted|normal) - 이름 색에 씀
export function buildTooltip({ item = null, name = '', category = '', quality = '', options = [], ethereal = false, amountLabel = '' }) {
  const meta = {}
  const mods = []
  for (const line of options.filter(Boolean)) {
    const hit = META.find((m) => m.re.test(line))
    if (hit) meta[hit.key] = line.match(hit.re)[1] ?? true
    else mods.push(line)
  }

  const lines = []
  const push = (text, color = TOOLTIP_COLORS.white) => text && lines.push({ text, color })
  const displayName = (name || item?.name_ko || '').trim()
  push(displayName, nameColor(item, category, displayName, quality))

  if (item?.category === 'runeword') {
    push(meta.base || '베이스 미정', TOOLTIP_COLORS.gray)
    const runes = runePips(item.extra?.rune_sequence)
    if (runes.length) push(`'${runes.join('')}'`, TOOLTIP_COLORS.unique)
  } else if (item?.category === 'unique' || item?.category === 'set') {
    const base = baseForItem(item)
    if (base || (item.subtitle && item.subtitle !== 'charm')) {
      push(base?.name_ko || item.subtitle, nameColor(item, category, displayName))
    }
  } else if (meta.base) {
    push(meta.base, TOOLTIP_COLORS.white)
  }

  if (meta.defense) push(`방어력: ${meta.defense}`)
  if (meta.damage) push(`데미지: ${meta.damage}`)
  if (amountLabel && amountLabel !== '1개') push(`수량: ${amountLabel}`)
  const lv = itemLevelReq(item)
  if (lv) push(`요구 레벨: ${lv}`)

  // 룬·보석은 게임처럼 박는 부위별 효과를 보여줌 (무기 / 갑옷·투구 / 방패)
  if (item?.category === 'gem' && !mods.length) {
    push('소켓에 박을 수 있어요', TOOLTIP_COLORS.gray)
    for (const [slot, label] of [['in_weapon', '무기'], ['in_helm', '갑옷·투구'], ['in_shield', '방패']]) {
      const texts = (item.extra?.[slot] || []).map((a) => a.text).filter(Boolean)
      if (texts.length) push(`${label}: ${texts.join(', ')}`)
    }
  }

  // 옵션 줄 - 판매글에 옵션이 없고 사전 아이템이면(유니크 참 등) 사전 옵션을 그대로 보여줌
  const modLines = mods.length ? mods : item && !['runeword', 'gem'].includes(item.category) ? getItemAffixes(item).map((a) => a.text) : []
  for (const m of modLines) push(m, TOOLTIP_COLORS.magic)

  const tail = []
  if (ethereal) tail.push('에테리얼 (수리 불가)')
  const sockets = meta.sockets || (item?.category === 'runeword' ? item.extra?.socket_count : null)
  if (sockets) tail.push(`소켓 (${sockets})`)
  if (tail.length) push(tail.join(', '), TOOLTIP_COLORS.magic)

  return { icon_key: item?.icon_key || null, ethereal, lines }
}
