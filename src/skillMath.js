// 실제 게임 skills.txt 데이터(EMin/EMax/MinDam/MaxDam + 레벨 구간 증가치)를 그대로 옮긴 계산식.
// l>28, >22, >16, >8 구간마다 증가폭이 달라지는 원작 방식(stagedDamage)을 그대로 구현.
export function stagedDamage(l, a, b, c, d, e, f, hitshift = 0, mult = 1) {
  l = l || 0
  a = a || 0
  b = b || 0
  c = c || 0
  d = d || 0
  e = e || 0
  f = f || 0

  if (l > 28) {
    a += f * (l - 28)
    l = 28
  }
  if (l > 22) {
    a += e * (l - 22)
    l = 22
  }
  if (l > 16) {
    a += d * (l - 16)
    l = 16
  }
  if (l > 8) {
    a += c * (l - 8)
    l = 8
  }
  a += b * (Math.max(0, l) - 1)

  return (mult * a) << hitshift
}

function rangeValue(level, arr) {
  if (!arr) return null
  const [base, l1, l2, l3, l4, l5, hitshift, mult] = arr
  return stagedDamage(level, base, l1, l2, l3, l4, l5, hitshift, mult)
}

// synergy = [{ skill: 코리안이름, percent: 포인트당 % }], getPoints(name) => 해당 스킬 하드포인트
export function synergyTotalPercent(synergy, getPoints) {
  if (!synergy || !synergy.length) return 0
  return synergy.reduce((sum, s) => sum + s.percent * getPoints(s.skill), 0)
}

// skill: skills.json의 한 스킬 항목(dmg/synergyPhy/synergyEle 포함), level: 해당 스킬의 하드 포인트
// getPoints: (skillName) => number, 같은 클래스 내 다른 스킬의 투자 포인트 조회 함수
export function computeSkillDamage(skill, level, getPoints) {
  if (!skill.dmg || level <= 0) return null
  const result = {}

  if (skill.dmg.phy) {
    const percent = synergyTotalPercent(skill.synergyPhy, getPoints)
    const mult = 1 + percent / 100
    const min = rangeValue(level, skill.dmg.phy.min)
    const max = rangeValue(level, skill.dmg.phy.max)
    result.phy = {
      min: min != null ? Math.max(0, Math.floor((min * mult) / 256)) : null,
      max: max != null ? Math.max(0, Math.floor((max * mult) / 256)) : null,
      percent,
    }
  }

  if (skill.dmg.ele) {
    const percent = synergyTotalPercent(skill.synergyEle, getPoints)
    const mult = 1 + percent / 100
    const min = rangeValue(level, skill.dmg.ele.min)
    const max = rangeValue(level, skill.dmg.ele.max)
    result.ele = {
      type: skill.dmg.ele.type,
      min: min != null ? Math.max(0, Math.floor((min * mult) / 256)) : null,
      max: max != null ? Math.max(0, Math.floor((max * mult) / 256)) : null,
      percent,
    }
  }

  return result
}

export const ELEMENT_LABELS = { fire: '화염', cold: '냉기', ltng: '번개', pois: '독', mag: '마법', phy: '물리' }
