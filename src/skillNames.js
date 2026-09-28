// 게임 내부 스킬 영문 이름(skills.txt / classSkills.json) -> 공식 한글·영문 표시 이름(skill_text.json)
// 데이터를 인자로 받는 순수 함수라 화면과 데이터 검사 스크립트가 같이 씀
//
// 대부분은 표기만 다름 ("Hex Bane" = "Hex: Bane", "Pole Arm Mastery" = "Polearm Mastery", "BloodGolem" = "Blood Golem")
// -> 글자만 남겨 비교. 게임 내부 이름이 아예 다른 건 아래 표로
export const INTERNAL_SKILL_NAMES = {
  Dopplezon: 'Decoy', 'Plague Poppy': 'Poison Creeper', Wearwolf: 'Werewolf', 'Shape Shifting': 'Lycanthropy',
  Wearbear: 'Werebear', 'Cycle of Life': 'Carrion Vine', Eruption: 'Fissure', 'Summon Fenris': 'Summon Dire Wolf',
  Vines: 'Solar Creeper', 'Fire Trauma': 'Fire Blast', 'Shock Field': 'Shock Web', Quickness: 'Burst of Speed',
  'Wake of Fire Sentry': 'Wake of Fire', 'Inferno Sentry': 'Wake of Inferno', 'Royal Strike': 'Phoenix Strike',
  Levitate: 'Levitation Mastery',
}
const norm = (s) => s.toLowerCase().replace(/[^a-z]/g, '').replace(/s$/, '')

// -> (internalEn) => { ko, en } | null
export function buildSkillNameLookup(skillText) {
  const byNorm = new Map()
  for (const list of Object.values(skillText)) for (const e of list) byNorm.set(norm(e.en), e)
  return (internalEn) => {
    const e = byNorm.get(norm(INTERNAL_SKILL_NAMES[internalEn] || internalEn))
    return e ? { ko: e.ko, en: e.en } : null
  }
}
