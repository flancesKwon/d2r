// 스킬 공식 한글 이름(게임 현재 표기) <-> 예전에 많이 쓰던 음역 이름(classSkills.json)
// 예: 눈보라 = 블리자드, 축복받은 망치 = 블레스드 해머. 악마술사는 새 직업이라 예전 이름 없음
import skillText from './data/skill_text.json'
import classSkills from './data/classSkills.json'
import { buildSkillNameLookup } from './skillNames.js'

const lookup = buildSkillNameLookup(skillText)
// 가이드 직업 키 -> classSkills 키
const CLASS_KEY = { amazon: 'ama', sorc: 'sor', necro: 'nec', paladin: 'pal', barb: 'bar', druid: 'dru', assassin: 'ass', warlock: 'war' }

// 직업별 [공식 이름, 예전 이름] (둘이 다를 때만)
const PAIRS = {}
for (const [guideKey, csKey] of Object.entries(CLASS_KEY)) {
  PAIRS[guideKey] = (classSkills[csKey]?.skills || [])
    .map((s) => [lookup(s.en)?.ko, s.ko])
    .filter(([official, old]) => official && old && official !== old)
}

// 글에 나온 스킬만 골라 [공식, 예전] 목록으로. 긴 이름부터 찾고 찾은 자리는 지워서
// "연쇄 번개" 안의 "번개"가 따로 잡히지 않게 함
export function skillPairsIn(text, classKey) {
  const pairs = [...(PAIRS[classKey] || [])].sort((a, b) => b[0].length - a[0].length)
  let rest = text || ''
  const found = []
  for (const p of pairs) {
    if (rest.includes(p[0])) {
      found.push(p)
      rest = rest.split(p[0]).join('\u0000')
    }
  }
  return found
}
