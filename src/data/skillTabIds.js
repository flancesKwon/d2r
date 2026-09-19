// 아이템의 item_addskill_tab par 값(게임 내부 skilltab id) -> {classKey, tabName}
// items.json 안의 실제 옵션 텍스트(예: "소환 기술 +2")로 값을 교차 확인해 만든 표.
// 3,4,5(소서리스), 15/18(소환/함정, 데이터에 예시가 없어 통상적으로 알려진 순서를 그대로 사용)는
// 이 아이템 데이터셋에 해당 옵션이 없어 직접 검증은 못 했음.
export const SKILL_TAB_BY_ID = {
  0: { classKey: 'amazon', tabName: '궁술' },
  1: { classKey: 'amazon', tabName: '패시브 & 마법' },
  2: { classKey: 'amazon', tabName: '창술' },
  3: { classKey: 'sorc', tabName: '냉기 마법' },
  4: { classKey: 'sorc', tabName: '화염 마법' },
  5: { classKey: 'sorc', tabName: '번개 마법' },
  6: { classKey: 'necro', tabName: '저주' },
  7: { classKey: 'necro', tabName: '독/뼈 마법' },
  8: { classKey: 'necro', tabName: '시체 소환' },
  9: { classKey: 'paladin', tabName: '돌격 기술' },
  10: { classKey: 'paladin', tabName: '공격 오라' },
  11: { classKey: 'paladin', tabName: '방어 오라' },
  12: { classKey: 'barb', tabName: '전투 기술' },
  13: { classKey: 'barb', tabName: '전투 숙련' },
  14: { classKey: 'barb', tabName: '전투 함성' },
  15: { classKey: 'druid', tabName: '소환' },
  16: { classKey: 'druid', tabName: '변신' },
  17: { classKey: 'druid', tabName: '정령 마법' },
  18: { classKey: 'assassin', tabName: '함정' },
  19: { classKey: 'assassin', tabName: '그림자 기술' },
  20: { classKey: 'assassin', tabName: '무술' },
}

// 클래스 코드(ama/sor/...) <-> 시뮬레이터 classKey
export const CLASS_CODE_TO_KEY = { ama: 'amazon', sor: 'sorc', nec: 'necro', pal: 'paladin', bar: 'barb', dru: 'druid', ass: 'assassin' }
export const CLASS_KEY_TO_CODE = Object.fromEntries(Object.entries(CLASS_CODE_TO_KEY).map(([code, key]) => [key, code]))
