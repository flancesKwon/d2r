// 시즌 16 (패치 3.4) 상향 아이템을 "(시즌)" 이름으로 새 항목 추가 - src/data/items.json
//   node scripts/add-season-items.js   (여러 번 돌려도 같은 결과)
// 출처: 블리자드 공지 'Diablo II: Resurrected Ladder Season 16' - 악마술사의 군림 온라인 래더·오프라인 한정
// 다른 스크립트로 items.json 을 다시 만든 뒤에는 이 스크립트를 다시 돌릴 것 (시즌 항목은 원본 항목에서 복사해 만듦)
// 원래 항목(논레더용)은 그대로 두고, 상향 수치를 반영한 복사본을 원래 항목 바로 뒤에 넣음
import fs from 'fs'

const file = new URL('../src/data/items.json', import.meta.url)
const items = JSON.parse(fs.readFileSync(file, 'utf8'))

const A = (prop, stat, par, min, max, text) => ({ prop, stat, par, min: String(min), max: String(max), text })
const byProp = (list, prop, skillPar) => {
  const i = list.findIndex((a) => a.prop === prop && (skillPar === undefined || a.par === skillPar))
  if (i < 0) throw new Error(`옵션 못 찾음: ${prop} ${skillPar ?? ''}`)
  return i
}
// 옵션 줄 바꾸기·지우기·넣기
const put = (list, prop, next, skillPar) => { list[byProp(list, prop, skillPar)] = next }
const drop = (list, prop) => { list.splice(byProp(list, prop), 1) }

const dmg = (a, b) => A('dmg%', '', null, a, b, `피해 증가 +${a}~${b}%`)
const ias = (v) => A('swing2', 'item_fasterattackrate', null, v, v, `공격 속도 +${v}%`)

// 이름(name_en) -> 복사본을 고치는 함수
const CHANGES = {
  "Dimoak's Hew": (x) => {
    put(x.affixes, 'dex', A('str', 'strength', null, 20, 20, '힘 +20'))
    put(x.affixes, 'dmg%', dmg(100, 150))
  },
  'Serpent Lord': (x) => {
    put(x.affixes, 'dmg%', dmg(40, 80))
    x.affixes.push(ias(15), A('dmg-min', '', null, 5, 5, '최소 피해 +5'))
  },
  "Griswold's Edge": (x) => {
    put(x.affixes, 'knock', A('hit-skill', 'item_skillonhit', '66', 4, 1, '타격 시 4% 확률로 1 레벨 피해 증폭 시전'))
    put(x.affixes, 'dmg%', dmg(100, 160))
    x.affixes.push(A('slow', 'item_slow', null, 25, 25, '대상 감속 25%'))
  },
  'The Salamander': (x) => {
    put(x.affixes, 'skill', A('skill', 'item_singleskill', '47', 4, 4, '화염구 +4 (소서리스 전용)'), '47')
    put(x.affixes, 'fireskill', A('fireskill', 'item_elemskill', null, 3, 3, '화염 기술 +3'))
    x.affixes.push(A('cast1', 'item_fastercastrate', null, 10, 10, '시전 속도 +10%'))
  },
  'The Tannr Gorerod': (x) => {
    put(x.affixes, 'dmg%', dmg(200, 220))
    x.affixes.push(A('lifesteal', 'lifedrainmindam', null, 5, 9, '적중당 생명력 5~9% 훔침'))
  },
  'The Grim Reaper': (x) => {
    put(x.affixes, 'manasteal', A('manasteal', 'manadrainmindam', null, 5, 9, '적중당 마나 5~9% 훔침'))
    put(x.affixes, 'dmg%', dmg(80, 120))
  },
  'Silks of the Victor': (x) => {
    x.affixes.push(
      A('move2', 'item_fastermovevelocity', null, 20, 20, '달리기/걷기 속도 +20%'),
      ias(30),
      dmg(50, 100),
      A('mag%', 'item_magicbonus', null, 15, 15, '마법 아이템 발견 확률 15% 증가'),
    )
  },
  'The Impaler': (x) => {
    put(x.affixes, 'dmg%', dmg(170, 240))
    x.affixes.push(A('rep-dur', 'item_replenish_durability', '4', '', '', '내구도 1 회복 (매 4초)'))
  },
  Coldkill: (x) => {
    put(x.affixes, 'dmg-cold', A('dmg-cold', 'coldmindam', '50', 80, 100, '냉기 피해 80-100 추가'))
    put(x.affixes, 'dmg%', dmg(160, 200))
  },
  'The Atlantean': (x) => {
    put(x.affixes, 'dmg%', dmg(250, 300))
    x.affixes.push(
      A('skill', 'item_singleskill', '106', 2, 5, '열의 +2~5 (팔라딘 전용)'),
      A('att', 'tohit', null, 100, 125, '명중률 +100~125'),
      A('ease', 'item_req_percent', null, -20, -20, '착용 조건 -20%'),
    )
    x.level_req = '35'
  },
  'Lava Gout': (x) => {
    put(x.affixes, 'hit-skill', A('hit-skill', 'item_skillonhit', '52', 5, 10, '타격 시 5% 확률로 10 레벨 마법부여 시전'))
    put(x.affixes, 'half-freeze', A('nofreeze', 'item_cannotbefrozen', null, 1, 1, '빙결되지 않음'))
  },
  Earthshaker: (x) => {
    x.affixes.push(A('skill', 'item_singleskill', '240', 3, 5, '화염 발톱 +3~5 (드루이드 전용)'))
  },
  "Grim's Burning Dead": (x) => {
    put(x.affixes, 'nec', A('nec', 'item_addclassskills', null, 4, 4, '네크로맨서 기술 레벨 +4'))
    x.affixes.push(
      A('reanimate', 'item_reanimate', null, 15, 15, '처치 시 15% 확률로 불타는 망자 궁수 소생'),
      A('skill', 'item_singleskill', '94', 3, 5, '화염 골렘 +3~5 (네크로맨서 전용)'),
    )
  },
  Swordguard: (x) => {
    put(x.affixes, 'ac/lvl', A('ac/lvl', 'item_armor_perlevel', '63', '', '', '캐릭터 레벨당 방어력 +7.875'))
    put(x.affixes, 'res-all', A('res-all', 'fireresist', null, 20, 30, '모든 저항 +20~30%'))
    put(x.affixes, 'dmg%', dmg(180, 230))
    x.affixes.push(
      A('regen', 'hpregen', null, 10, 15, '생명력 회복 +10~15'),
      A('thorns', 'item_attackertakesdamage', null, 15, 25, '공격자가 피해를 15~25 받음'),
    )
  },
  "Demonhorn's Edge": (x) => {
    put(x.affixes, 'swing2', ias(20))
    x.affixes.push(A('bar', 'item_addclassskills', null, 1, 1, '바바리안 기술 레벨 +1'))
  },
  'Veil of Steel': (x) => {
    x.affixes.push(
      A('allskills', 'item_allskills', null, 2, 2, '모든 기술 +2'),
      A('red-dmg%', 'damageresist', null, 15, 25, '받는 물리 피해 15~25% 감소'),
      A('res-mag', 'magicresist', null, 20, 40, '마법 저항 +20~40%'),
    )
  },
  'Ethereal Edge': (x) => {
    put(x.affixes, 'dmg%', dmg(220, 260))
    put(x.affixes, 'swing2', ias(40))
    x.affixes.push(A('dmg/lvl', 'item_maxdamage_perlevel', '16', '', '', '캐릭터 레벨당 최대 피해 +2'))
  },
  "Executioner's Justice": (x) => {
    put(x.affixes, 'dmg%', dmg(260, 300))
    put(x.affixes, 'kill-skill', A('kill-skill', 'item_skillonkill', 'Amplify Damage', 25, 13, '적 처치 시 25% 확률로 13 레벨 피해 증폭 시전'))
    put(x.affixes, 'swing2', ias(40))
    x.affixes.push(
      A('heal-kill', 'item_healafterkill', null, 15, 15, '적 처치 시 생명력 +15'),
      A('mana-kill', 'item_manaafterkill', null, 5, 5, '적 처치 시 마나 +5'),
    )
  },
  Eternity: (x) => {
    x.subtitle = 'mele + miss'
    put(x.affixes, 'dmg%', dmg(300, 390))
    put(x.affixes, 'charged', A('oskill', 'item_nonclassskill', 'Revive', 5, 5, '부활 +5'))
    x.affixes.push(ias(30), A('dmg/lvl', 'item_maxdamage_perlevel', '24', '', '', '캐릭터 레벨당 최대 피해 +3'))
  },
}

// 아이젠하트의 무기고 - 세트 4개 전부 같은 세트 이름·전체 보너스를 새로 가짐
const ISENHART = {
  "Isenhart's Lightbrand": (x) => {
    put(x.affixes, 'swing2', ias(40))
    x.affixes.push(A('att/lvl', 'item_tohit_perlevel', '40', '', '', '캐릭터 레벨당 명중률 +5'))
    x.extra.set_item_bonus = [{ count: 3, affixes: [A('dmg/lvl', 'item_maxdamage_perlevel', '16', '', '', '캐릭터 레벨당 최대 피해 +2')] }]
  },
  "Isenhart's Parry": (x) => {
    x.extra.set_item_bonus[0].affixes.push(
      A('res-cold', 'coldresist', null, 15, 15, '냉기 저항 +15%'),
      A('res-fire', 'fireresist', null, 15, 15, '화염 저항 +15%'),
    )
  },
  "Isenhart's Case": (x) => {
    x.affixes.push(A('res-mag', 'magicresist', null, 25, 25, '마법 저항 +25%'))
  },
  "Isenhart's Horns": (x) => {
    x.affixes.push(A('lifesteal', 'lifedrainmindam', null, 5, 5, '적중당 생명력 5% 훔침'))
  },
}
const ISENHART_FULL = (full) => {
  const move = full.find((a) => a.prop === 'move2')
  Object.assign(move, { min: '30', max: '30', text: '달리기/걷기 속도 +30%' })
  full.push(A('balance2', 'item_fastergethitrate', null, 25, 25, '타격 회복 속도 +25%'))
}

const SEASON_LABEL_KO = ' (시즌)'
const SEASON_LABEL_EN = ' (Season)'

const base = items.filter((it) => !it.season)
const out = []
const used = new Set()
for (const it of base) {
  out.push(it)
  const change = CHANGES[it.name_en] || ISENHART[it.name_en]
  if (!change) continue
  used.add(it.name_en)
  const x = JSON.parse(JSON.stringify(it))
  x.id = it.id + 's'
  x.name_ko = it.name_ko + SEASON_LABEL_KO
  x.name_en = it.name_en + SEASON_LABEL_EN
  x.season = true
  x.aliases = []
  change(x)
  if (x.category === 'set') {
    x.extra.set_name_ko += SEASON_LABEL_KO
    x.extra.set_name_en += SEASON_LABEL_EN
    ISENHART_FULL(x.extra.set_full_bonus)
  }
  out.push(x)
}
for (const name of [...Object.keys(CHANGES), ...Object.keys(ISENHART)]) {
  if (!used.has(name)) throw new Error(`아이템 못 찾음: ${name}`)
}
fs.writeFileSync(file, JSON.stringify(out))
console.log(`시즌 항목 ${out.length - base.length}개 추가 (전체 ${out.length}개)`)
