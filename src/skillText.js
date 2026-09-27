// 스킬 설명(src/data/skill_text.json)을 시뮬레이터 스킬(skills.json의 한글 이름)에 연결하는 규칙.
// 데이터를 인자로 받는 순수 함수라서 화면(SimulatorPage)과 데이터 검사 스크립트가 같이 씀.
//
// skill_text.json의 id는 게임 문자열 키 번호(Skillname{n})라서 skills.txt 스킬 id와 뜻이 다름:
// - 아마존·소서리스·네크로맨서·팔라딘·바바리안: 같음
// - 드루이드·어쌔신: skills.txt id + 1 (예: 레이븐은 skills.txt 221, 문자열 키 222)
// - 악마술사: id가 null -> 한글 이름(ko)으로 매칭 (시뮬레이터 이름과 30/30 일치)

// 시뮬레이터 직업 키 -> skill_text.json 직업 키
export const SKILL_TEXT_CLASS = {
  amazon: 'amazon', sorc: 'sorceress', necro: 'necromancer', paladin: 'paladin',
  barb: 'barbarian', druid: 'druid', assassin: 'assassin', warlock: 'warlock',
}
const TEXT_ID_OFFSET = { druid: 1, assassin: 1 }

// -> { 직업키: { 스킬 한글 이름: skill_text 항목 } }
export function buildSkillTextIndex(skillText, skillIdMap, skillsData) {
  const index = {}
  for (const [cls, textCls] of Object.entries(SKILL_TEXT_CLASS)) {
    const entries = skillText[textCls] || []
    const byId = new Map(entries.filter((e) => e.id != null).map((e) => [e.id, e]))
    const byKo = new Map(entries.map((e) => [e.ko, e]))
    index[cls] = {}
    for (const [id, v] of Object.entries(skillIdMap)) {
      if (v.class !== cls) continue
      const e = byId.get(Number(id) + (TEXT_ID_OFFSET[cls] || 0))
      if (e) index[cls][v.name] = e
    }
    // skillIdMap에 없는 직업(악마술사)이나 id가 없는 항목은 한글 이름으로
    for (const tab of skillsData[cls]?.tabs || []) {
      for (const s of tab.skills) {
        if (!index[cls][s.name] && byKo.has(s.name)) index[cls][s.name] = byKo.get(s.name)
      }
    }
  }
  return index
}

// 툴팁에 쓸 설명 줄: shortDesc, 비어 있으면(피의 맹세) longDesc
export function skillDescLines(entry) {
  const text = (entry?.shortDesc || '').trim() || (entry?.longDesc || '').trim()
  return text ? text.split('\n').map((l) => l.trim()).filter(Boolean) : []
}
