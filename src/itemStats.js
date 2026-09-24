import skillIdMap from './data/skillIdMap.json'
import { SKILL_TAB_BY_ID, CLASS_CODE_TO_KEY } from './data/skillTabIds.js'

export const SLOT_DEFS = [
  { key: 'weapon', label: '무기' },
  { key: 'shield', label: '방패' },
  { key: 'helm', label: '투구' },
  { key: 'armor', label: '갑옷' },
  { key: 'gloves', label: '장갑' },
  { key: 'boots', label: '신발' },
  { key: 'belt', label: '벨트' },
  { key: 'amulet', label: '목걸이' },
  { key: 'ring1', label: '반지 1' },
  { key: 'ring2', label: '반지 2' },
]

export function runewordSlots(subtitle) {
  const slots = []
  if (!subtitle) return slots
  if (subtitle.includes('shld')) slots.push('shield')
  if (subtitle.includes('tors')) slots.push('armor')
  if (subtitle.includes('helm')) slots.push('helm')
  const weaponHint = /weap|mele|h2h|miss|axe|swor|hamm|mace|club|pole|staf|scep|knif|wand|spea/
  if (weaponHint.test(subtitle)) slots.push('weapon')
  return slots
}

export function runePips(seq) {
  return (seq || '').match(/[A-Z][a-z]+/g) || []
}

// 룬워드 최종 옵션 = 룬워드 고유 옵션(runes.txt T1Code, 최대 7개) + 박힌 룬 각각의
// 자체 효과(gems.txt weaponMod/helmMod/shieldMod, 장착 부위별로 다름) - 이 둘을 합쳐야
// 실제 게임의 완전한 옵션 목록이 됨
const RUNE_MOD_FIELD = { weapon: 'in_weapon', shield: 'in_shield', armor: 'in_helm', helm: 'in_helm' }

// 룬 이름(El, Ber 등) -> 룬 아이템 데이터 조회 테이블
export function buildRuneLookup(items) {
  const lookup = {}
  items.forEach((it) => {
    if (it.type_sub === '룬' && it.name_en && it.name_en.endsWith(' Rune')) {
      lookup[it.name_en.replace(' Rune', '')] = it
    }
  })
  return lookup
}

// slotKey를 알면(실제 장착 중) 그 부위 기준, 모르면(목록 표시용) 장착 가능한 첫 번째
// 부위 기준으로 룬들의 자체 효과를 모아서 반환
export function runewordRuneAffixes(item, runeLookup, slotKey) {
  if (item.category !== 'runeword' || !item.extra || !item.extra.rune_sequence) return []
  const category = slotKey || runewordSlots(item.subtitle)[0]
  const field = RUNE_MOD_FIELD[category]
  if (!field) return []
  const out = []
  runePips(item.extra.rune_sequence).forEach((runeName) => {
    const rune = runeLookup[runeName]
    if (rune && rune.extra && rune.extra[field]) out.push(...rune.extra[field])
  })
  return out
}

function baseSlotOf(item) {
  if (item.category === 'runeword') return null // 별도 처리
  if (item.type_group === '무기') return 'weapon'
  const map = { 방패: 'shield', 투구: 'helm', 갑옷: 'armor', 장갑: 'gloves', 신발: 'boots', 벨트: 'belt', 목걸이: 'amulet', 반지: 'ring1' }
  return map[item.type_sub] || null
}

// slotKey별로 고를 수 있는 아이템 목록 (ring1/ring2는 같은 반지 풀 공유)
export function buildItemsBySlot(items) {
  const bySlot = Object.fromEntries(SLOT_DEFS.map((s) => [s.key, []]))
  items.forEach((item) => {
    if (item.category === 'gem') return // 소켓용 보석/룬은 장비 슬롯 대상 아님
    if (item.category === 'runeword') {
      runewordSlots(item.subtitle).forEach((slot) => bySlot[slot] && bySlot[slot].push(item))
      return
    }
    const slot = baseSlotOf(item)
    if (slot === 'ring1') {
      bySlot.ring1.push(item)
      bySlot.ring2.push(item)
    } else if (slot && bySlot[slot]) {
      bySlot[slot].push(item)
    }
  })
  Object.values(bySlot).forEach((list) => list.sort((a, b) => a.name_ko.localeCompare(b.name_ko, 'ko')))
  return bySlot
}

function avg(a) {
  const min = Number(a.min)
  const max = Number(a.max)
  if (Number.isNaN(min) && Number.isNaN(max)) return 0
  if (Number.isNaN(max)) return min
  if (Number.isNaN(min)) return max
  return (min + max) / 2
}

const RESIST_STATS = { fireresist: 'fire', coldresist: 'cold', lightresist: 'ltng', poisonresist: 'pois' }

// equippedItems: { slotKey: itemObject|null }, classKey: 'amazon' 등, extraItems: 참(charm) 등 슬롯 없이 추가되는 아이템 목록,
// runeLookup: buildRuneLookup() 결과 - 룬워드에 박힌 룬 자체 효과까지 합산하는 데 씀
export function aggregateItemStats(equippedItems, classKey, extraItems = [], runeLookup = {}) {
  const result = {
    str: 0,
    dex: 0,
    vit: 0,
    nrg: 0,
    life: 0,
    mana: 0,
    resist: { fire: 0, cold: 0, ltng: 0, pois: 0 },
    acFlat: 0,
    acPercent: 0,
    allSkills: 0,
    classSkills: 0, // 현재 클래스에 해당하는 item_addclassskills 합
    tabBonus: {}, // tabName -> 합
    singleSkill: {}, // 스킬 한국어 이름 -> 합
    weaponDamage: null, // {min, max} 장착 무기 물리 데미지 (2handmindam 우선)
  }

  function applyAffixes(affixes) {
    ;(affixes || []).forEach((a) => {
      const v = avg(a)
      // "모든 속성"/"모든 저항"은 원본 데이터에 단일 스탯(strength/fireresist)으로만
      // 붙어있어서 나머지 3개가 누락됨 - prop으로 구분해서 4개 전부에 더해줌
      if (a.prop === 'all-stats') {
        result.str += v; result.dex += v; result.vit += v; result.nrg += v
        return
      }
      if (a.prop === 'res-all') {
        result.resist.fire += v; result.resist.cold += v; result.resist.ltng += v; result.resist.pois += v
        return
      }
      switch (a.stat) {
        case 'strength':
          result.str += v
          break
        case 'dexterity':
          result.dex += v
          break
        case 'vitality':
          result.vit += v
          break
        case 'energy':
          result.nrg += v
          break
        case 'maxhp':
        case 'hp':
          result.life += v
          break
        case 'maxmana':
        case 'mana':
          result.mana += v
          break
        case 'armorclass':
          result.acFlat += v
          break
        case 'item_armor_percent':
          result.acPercent += v
          break
        case 'item_allskills':
          result.allSkills += v
          break
        case 'item_addclassskills':
          if (CLASS_CODE_TO_KEY[a.prop] === classKey) result.classSkills += v
          break
        case 'item_addskill_tab': {
          const tab = SKILL_TAB_BY_ID[a.par]
          if (tab && tab.classKey === classKey) result.tabBonus[tab.tabName] = (result.tabBonus[tab.tabName] || 0) + v
          break
        }
        case 'item_singleskill': {
          const sk = skillIdMap[a.par]
          if (sk && sk.class === classKey) result.singleSkill[sk.name] = (result.singleSkill[sk.name] || 0) + v
          break
        }
        default:
          if (RESIST_STATS[a.stat]) result.resist[RESIST_STATS[a.stat]] += v
      }
    })
  }

  function applyItem(item) {
    if (!item) return
    if (item.base_stats && item.base_stats.category === 'weapon') {
      const min = item.base_stats['2handmindam'] ?? item.base_stats.mindam
      const max = item.base_stats['2handmaxdam'] ?? item.base_stats.maxdam
      if (min != null && max != null) {
        result.weaponDamage = result.weaponDamage || { min: 0, max: 0 }
        result.weaponDamage.min += min
        result.weaponDamage.max += max
      }
    }
    if (item.base_stats && item.base_stats.minac != null) {
      result.acFlat += avg({ min: item.base_stats.minac, max: item.base_stats.maxac })
    }
    applyAffixes(item.affixes)
  }

  Object.entries(equippedItems).forEach(([slotKey, item]) => {
    applyItem(item)
    if (item && item.category === 'runeword') applyAffixes(runewordRuneAffixes(item, runeLookup, slotKey))
  })
  extraItems.forEach(applyItem)

  return result
}

// 특정 스킬이 아이템으로 받는 총 +스킬 보너스 (하드 포인트에는 영향 없음, 데미지 계산용 유효 레벨에만 사용)
export function itemSkillBonus(itemAgg, skillName, tabName) {
  let bonus = itemAgg.allSkills + itemAgg.classSkills
  if (tabName && itemAgg.tabBonus[tabName]) bonus += itemAgg.tabBonus[tabName]
  if (itemAgg.singleSkill[skillName]) bonus += itemAgg.singleSkill[skillName]
  return bonus
}
