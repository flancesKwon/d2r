#!/usr/bin/env node
// 아이템 사전(items.json)의 구조적 정합성을 자동으로 검사하는 스크립트.
// "실제 게임 수치가 맞는지"까지는 확인 못하지만(그건 여전히 사람이 원본 txt나
// 여러 출처를 대조해야 함), 지금까지 실제로 발견됐던 버그 유형들
// (아이콘 매핑 누락, 인코딩 깨짐, min/max 뒤바뀜, 번역 누락, 룬워드 재료
// 불일치 등)은 전부 기계적으로 잡아낼 수 있어서 회귀 방지용으로 둠.
//
// 실행: node scripts/check-item-data.js
// exit code 0 = 문제 없음(경고는 있을 수 있음), 1 = errors 존재

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// import 속성(`with { type: 'json' }`)은 Node 버전에 따라 지원 여부가 갈려서
// CI에서도 그대로 돌아가게 fs로 직접 읽음
const __dirname = dirname(fileURLToPath(import.meta.url))
const itemsData = JSON.parse(readFileSync(join(__dirname, '../src/data/items.json'), 'utf8'))
const iconsData = JSON.parse(readFileSync(join(__dirname, '../src/data/icons.json'), 'utf8'))

// itemStats.js는 다른 data/*.json을 import 속성 없이 불러오는 Vite 전용 코드라
// 순수 Node ESM에서는 못 돌림 - 이 체크에 필요한 세 함수만 그대로 옮겨옴
// (원본: src/itemStats.js)
function runePips(seq) {
  return (seq || '').match(/[A-Z][a-z]+/g) || []
}
function buildRuneLookup(items) {
  const lookup = {}
  items.forEach((it) => {
    if (it.type_sub === '룬' && it.name_en && it.name_en.endsWith(' Rune')) {
      lookup[it.name_en.replace(' Rune', '')] = it
    }
  })
  return lookup
}
function runewordSlots(subtitle) {
  const slots = []
  if (!subtitle) return slots
  if (subtitle.includes('shld')) slots.push('shield')
  if (subtitle.includes('tors')) slots.push('armor')
  if (subtitle.includes('helm')) slots.push('helm')
  const weaponHint = /weap|mele|h2h|miss|axe|swor|hamm|mace|club|pole|staf|scep|knif|wand|spea/
  if (weaponHint.test(subtitle)) slots.push('weapon')
  return slots
}

const errors = []
const warnings = []

function err(msg) { errors.push(msg) }
function warn(msg) { warnings.push(msg) }

// ---------- 1. 기본 스키마 체크 ----------
const REQUIRED_FIELDS = ['category', 'category_label', 'id', 'name_ko', 'name_en']
// 카테고리별 정확한 라벨 문자열을 미리 못박아두지 않고, "같은 category는 항상
// 같은 category_label을 쓴다"는 자기일관성만 검사함(gem 카테고리는 실제로
// "보석·룬"이라는 라벨을 씀 - 룬도 gem 카테고리 소속이라서 정상)
const categoryLabelSeen = new Map()
const ids = new Map()
const nameKoByCategory = new Map() // "category|name_ko" -> [ids]
// 무지개 자락(Rainbow Facet)처럼 실제 게임에서도 여러 개가 완전히 같은 이름으로
// 나오는 정상 케이스 - 검증에서 오탐 안 나게 예외 처리
const KNOWN_DUPLICATE_NAMES = new Set(['무지개 자락'])

itemsData.forEach((it, idx) => {
  const where = `#${idx} (id=${it.id ?? '?'})`

  REQUIRED_FIELDS.forEach((f) => {
    if (it[f] === undefined || it[f] === null || it[f] === '') err(`${where}: 필수 필드 "${f}"가 비어있음`)
  })

  if (it.id) {
    if (ids.has(it.id)) err(`중복 id "${it.id}" - ${ids.get(it.id)} 와 ${where}`)
    else ids.set(it.id, where)
  }

  if (categoryLabelSeen.has(it.category) && categoryLabelSeen.get(it.category) !== it.category_label) {
    err(`${where}: category="${it.category}"의 category_label이 다른 항목과 다름 ("${it.category_label}" vs "${categoryLabelSeen.get(it.category)}")`)
  } else {
    categoryLabelSeen.set(it.category, it.category_label)
  }

  // 이름 번역 누락 - name_ko가 영문 이름 그대로면 십중팔구 번역이 안 된 것
  if (it.name_ko && it.name_en && it.name_ko === it.name_en) {
    err(`${where}: name_ko가 name_en과 동일("${it.name_ko}") - 한글 번역 누락 의심`)
  }

  // 인코딩 깨짐 - Windows-1252 등에서 잘못 디코딩되면 \92 같은 리터럴 백슬래시+숫자가 남음
  ;['name_ko', 'name_en', 'subtitle'].forEach((f) => {
    if (typeof it[f] === 'string' && /\\\d{2,3}/.test(it[f])) {
      err(`${where}: "${f}" 값에 인코딩 깨짐 의심 패턴 발견 ("${it[f]}")`)
    }
  })

  // 아이콘 키가 있는데 실제 icons.json에 없으면 화면에 빈 아이콘으로 뜸
  if (it.icon_key && !iconsData[it.icon_key]) {
    err(`${where}: icon_key "${it.icon_key}"가 icons.json에 없음`)
  }
  if (!it.icon_key) warn(`${where}: icon_key가 비어있음`)

  // affixes min/max 뒤바뀜 체크 - hit-skill/charged/aura류는 min/max가 범위가
  // 아니라 서로 다른 의미(확률·레벨 등)라 숫자만 보고 비교하면 오탐 남. 텍스트에
  // 실제로 "min~max" 패턴이 있는(진짜 굴러가는 범위인) 옵션만 대상으로 함
  ;(it.affixes || []).forEach((a, ai) => {
    const min = Number(a.min)
    const max = Number(a.max)
    const isRollRange = a.min !== '' && a.max !== '' && String(a.min) !== String(a.max)
      && typeof a.text === 'string' && a.text.includes(`${a.min}~${a.max}`)
    if (isRollRange && !Number.isNaN(min) && !Number.isNaN(max) && min > max) {
      err(`${where}: affixes[${ai}] (${a.prop}) min(${a.min}) > max(${a.max})`)
    }
  })

  // 옵션 문구가 비어 있으면 사전엔 "텍스트 준비 중"으로 나오고 판매글엔 빈 줄로 저장됨 -
  // 고유 옵션과 룬의 부위별 효과(룬워드 최종 옵션에 합쳐짐) 모두 검사
  ;(it.affixes || []).forEach((a, ai) => {
    if (a.prop && !a.text) err(`${where}: affixes[${ai}] (${a.prop}) 옵션 문구(text)가 비어있음`)
  })
  // (cold-len/pois-len 같은 지속시간 값은 게임에서도 따로 줄로 안 나오고 피해 줄에 합쳐져서 제외)
  for (const slot of ['in_weapon', 'in_helm', 'in_shield']) {
    ;(it.extra?.[slot] || []).forEach((a, ai) => {
      if (!a.text && !/-len$/.test(a.prop)) err(`${where}: extra.${slot}[${ai}] (${a.prop}) 옵션 문구(text)가 비어있음`)
    })
  }

  const key = `${it.category}|${it.name_ko}`
  if (!nameKoByCategory.has(key)) nameKoByCategory.set(key, [])
  nameKoByCategory.get(key).push(it.id)
})

// 같은 카테고리 안에서 이름이 겹치면 진짜 중복/충돌 아이템일 가능성이 커서
// 에러로 잡되, 무지개 자락처럼 실제 게임에도 동명이인이 있는 알려진 예외는
// 경고로만 남김(다른 카테고리끼리 겹치는 건 지옥불 횃불 사례처럼 실제로 있을
// 수 있어서 아예 체크 대상에서 제외함)
for (const [key, idList] of nameKoByCategory) {
  if (idList.length > 1) {
    const [category, nameKo] = key.split('|')
    const msg = `같은 카테고리(${category}) 안에서 이름 중복: "${nameKo}" - id ${idList.join(', ')}`
    if (KNOWN_DUPLICATE_NAMES.has(nameKo)) warn(msg + ' (알려진 예외로 등록됨)')
    else err(msg)
  }
}

// ---------- 2. 룬워드 재료·소켓 체크 ----------
const runeLookup = buildRuneLookup(itemsData)
const runewords = itemsData.filter((it) => it.category === 'runeword')
runewords.forEach((rw) => {
  const where = `룬워드 "${rw.name_ko}" (id=${rw.id})`
  if (!rw.extra || !rw.extra.rune_sequence) {
    err(`${where}: extra.rune_sequence가 없음`)
    return
  }
  const pips = runePips(rw.extra.rune_sequence)
  if (!pips.length) err(`${where}: rune_sequence "${rw.extra.rune_sequence}"에서 룬 이름을 하나도 못 뽑아냄`)
  pips.forEach((name) => {
    if (!runeLookup[name]) err(`${where}: rune_sequence 속 룬 "${name}"이 사전 룬 목록에 없음`)
  })
  if (typeof rw.extra.socket_count === 'number' && rw.extra.socket_count !== pips.length) {
    err(`${where}: socket_count(${rw.extra.socket_count})와 rune_sequence 룬 개수(${pips.length})가 다름`)
  }
  const slots = runewordSlots(rw.subtitle)
  if (!slots.length) warn(`${where}: subtitle "${rw.subtitle}"에서 장착 부위(무기/방어구 등)를 하나도 못 알아냄`)
})

// ---------- 3. 베이스 스탯 체크 ----------
itemsData.forEach((it) => {
  const b = it.base_stats
  if (!b) return
  const where = `"${it.name_ko}" (id=${it.id})`
  if (b.category === 'armor' && b.minac != null && b.maxac != null && Number(b.minac) > Number(b.maxac)) {
    err(`${where}: base_stats.minac(${b.minac}) > maxac(${b.maxac})`)
  }
  if (b.category === 'weapon') {
    const hasNormal = b.mindam != null && b.maxdam != null
    const has2h = b['2handmindam'] != null && b['2handmaxdam'] != null
    if (!hasNormal && !has2h) warn(`${where}: base_stats에 무기 데미지(mindam/maxdam, 2handmindam/2handmaxdam)가 전혀 없음`)
    if (hasNormal && Number(b.mindam) > Number(b.maxdam)) err(`${where}: base_stats.mindam(${b.mindam}) > maxdam(${b.maxdam})`)
    if (has2h && Number(b['2handmindam']) > Number(b['2handmaxdam'])) err(`${where}: base_stats.2handmindam > 2handmaxdam`)
  }
})

// ---------- 4. 보석 카테고리 개수·아이콘 중복 체크 ----------
const gems = itemsData.filter((it) => it.category === 'gem')
if (gems.length !== 68) {
  warn(`gem 카테고리 총 개수가 68이 아님(현재 ${gems.length}) - 룬 33 + 보석 30 + 해골 5 기준값과 다름`)
}
const iconByKey = new Map()
gems.forEach((g) => {
  if (!g.icon_key) return
  const data = iconsData[g.icon_key]
  if (!data) return
  if (!iconByKey.has(data)) iconByKey.set(data, [])
  iconByKey.get(data).push(g.name_ko)
})
for (const [, names] of iconByKey) {
  if (names.length > 1) err(`룬/보석 중 서로 다른 아이템이 완전히 같은 아이콘 이미지를 공유함: ${names.join(', ')}`)
}

// ---------- 5. 스킬 설명 연결 체크 (시뮬레이터 스킬 -> skill_text.json) ----------
// 직업마다 id 규칙이 달라서(드루이드·어쌔신 +1, 악마술사 id 없음) 잘못 연결되면 설명이 한 칸씩
// 밀려 보여도 "전부 연결됨"으로 보이기 쉬움 - 영문 이름까지 대조해서 밀림을 잡음
{
  const { buildSkillTextIndex, skillDescLines } = await import('../src/skillText.js')
  const readData = (f) => JSON.parse(readFileSync(join(__dirname, '../src/data/' + f), 'utf8'))
  const skillsData = readData('skills.json')
  const index = buildSkillTextIndex(readData('skill_text.json'), readData('skillIdMap.json'), skillsData)
  // 게임 내부 이름(skills.json nameEn) ↔ 표시 이름(skill_text en)이 원래 다른 스킬들
  const INTERNAL_NAMES = {
    Dopplezon: 'Decoy', 'Plague Poppy': 'Poison Creeper', 'Cycle of Life': 'Carrion Vine', 'Summon Fenris': 'Summon Dire Wolf',
    Vines: 'Solar Creeper', 'Shape Shifting': 'Lycanthropy', Eruption: 'Fissure', 'Fire Trauma': 'Fire Blast',
    'Shock Field': 'Shock Web', 'Wake of Fire Sentry': 'Wake of Fire', 'Inferno Sentry': 'Wake of Inferno',
    Quickness: 'Burst of Speed', 'Royal Strike': 'Phoenix Strike', Levitate: 'Levitation Mastery',
    Wearwolf: 'Werewolf', Wearbear: 'Werebear', 'Pole Arm Mastery': 'Polearm Mastery',
  }
  const normEn = (s) => s.toLowerCase().replace(/[^a-z ]/g, ' ').replace(/golem/g, ' golem').split(/\s+/).filter(Boolean).map((w) => w.replace(/s$/, '')).sort().join(' ')
  let checked = 0
  for (const [cls, data] of Object.entries(skillsData)) {
    for (const s of data.tabs.flatMap((t) => t.skills)) {
      checked++
      const e = index[cls]?.[s.name]
      const where = `스킬 ${cls}/${s.name}`
      if (!e) { err(`${where}: skill_text.json에 연결되는 설명이 없음`); continue }
      if (!skillDescLines(e).length) err(`${where}: 설명(shortDesc/longDesc)이 비어있음`)
      if (normEn(INTERNAL_NAMES[s.nameEn] || s.nameEn) !== normEn(e.en)) {
        err(`${where}: 영문 이름 불일치 (시뮬레이터 ${s.nameEn} / 설명 ${e.en}) - id 규칙이 밀렸을 수 있음`)
      }
    }
  }
  console.log(`스킬 설명 연결 검사: ${checked}개`)
}

// ---------- 6. 매직/레어 접사 체크 (판매글 등록에서 베이스별로 고르는 옵션) ----------
// 원본 접사 옵션 코드에 문구가 없으면 그 접사가 조용히 목록에서 빠지니 에러로 잡고, 알려진 게임 수치로 회귀 확인
{
  const R = await import('../src/magicAffixes.js')
  const readData = (f) => JSON.parse(readFileSync(join(__dirname, '../src/data/' + f), 'utf8'))
  const data = readData('magicAffixes.json')
  const bases = [...readData('baseItems.json'), ...data.miscBases]
  const missing = new Set(data.affixes.flatMap((a) => a.mods.map((m) => m.code)).filter((c) => !R.AFFIX_MOD_CODES.includes(c)))
  if (missing.size) err(`매직/레어 접사: 문구가 없는 옵션 코드 ${[...missing].join(', ')} (src/magicAffixes.js MODS)`)
  let famCount = 0
  for (const b of bases) {
    if (!data.bases[b.code]) { err(`매직/레어 접사: 베이스 정보 없음 ${b.code}`); continue }
    for (const q of ['magic', 'rare']) {
      const fams = R.affixFamiliesFor(data, b, q)
      famCount += fams.length
      if (q === 'magic' && !fams.length) err(`매직/레어 접사: ${b.code} 매직 옵션이 하나도 없음`)
      for (const f of fams) {
        if (/undefined|NaN/.test(f.label)) err(`매직/레어 접사: ${b.code} 문구 오류 "${f.label}"`)
        if (f.slotRanges.some(([lo, hi]) => lo > hi)) err(`매직/레어 접사: ${b.code} 범위 오류 "${f.label}"`)
      }
    }
  }
  const B = (code) => bases.find((b) => b.code === code)
  const fam = (code, q, re) => R.affixFamiliesFor(data, B(code), q).find((f) => re.test(f.label))
  const expect = (cond, msg) => cond || err(`매직/레어 접사: ${msg}`)
  expect(fam('cm3', 'magic', /^생명력 \+/)?.slotRanges[0][1] === 45, '거대 부적 생명력 최대 45')
  expect(fam('cm1', 'magic', /^생명력 \+/)?.slotRanges[0][1] === 20, '작은 부적 생명력 최대 20')
  expect(!fam('jew', 'rare', /^공격 속도/), '레어 주얼에 공격 속도 불가 (매직 전용)')
  expect(fam('jew', 'magic', /^공격 속도/)?.slotRanges[0][1] === 15, '매직 주얼 공격 속도 15')
  expect(fam('rin', 'rare', /^시전 속도/)?.slotRanges[0][1] === 10, '레어 반지 시전 속도 10')
  expect(!R.affixFamiliesFor(data, B('cm3'), 'rare').length, '부적은 레어 불가')
  // 같은 그룹(반지 접미사 "빛 반경+명중률" / "빛 반경+명중률 보너스")은 한 아이템에 같이 못 붙고,
  // 그룹이 다른 인핸스드 데미지 두 종류(Jagged / Sharp)는 레어에 같이 붙을 수 있음
  const pickOf = (f) => ({ fam: f, values: f.slotRanges.map((r) => r[0]) })
  const lightAr = fam('rin', 'rare', /^빛 반경 \+[\d~]+, 명중률 \+/)
  const lightArPct = fam('rin', 'rare', /^빛 반경 \+[\d~]+, 명중률 보너스/)
  expect(lightAr && lightArPct, '레어 반지 빛 반경 옵션 두 종류')
  if (lightAr && lightArPct) {
    const errs = R.validateAffixPicks(data, B('rin'), 'rare', [pickOf(lightAr), pickOf(lightArPct)])
    expect(errs.length === 1, `같은 그룹 두 개가 통과됨 (${errs.join(' / ')})`)
  }
  const ed = fam('7cr', 'rare', /^인핸스드 데미지 \+[\d~]+%$/)
  const edAr = fam('7cr', 'rare', /^명중률 \+[\d~]+, 인핸스드 데미지/)
  expect(ed && edAr && !R.validateAffixPicks(data, B('7cr'), 'rare', [pickOf(ed), pickOf(edAr)]).length, '레어 무기 인핸스드 데미지 두 종류는 같이 가능')
  // 수치가 한 단계 안에서 안 나오는 조합 (Sharp 단계: 명중률 10~20 + 인핸스드 10~20 -> 명중률 10 + 인핸스드 30 불가)
  if (edAr) expect(R.validateAffixPicks(data, B('7cr'), 'rare', [{ fam: edAr, values: [10, 30] }]).length === 1, '단계가 다른 수치 조합이 통과됨')
  // 크래프트: 제작법 고정 옵션 문구, 제작법마다 재료 베이스가 있는지, 알려진 제작법 내용
  const craftMissing = new Set(data.crafts.flatMap((c) => c.mods.map((m) => m.code)).filter((c) => !R.AFFIX_MOD_CODES.includes(c)))
  if (craftMissing.size) err(`크래프트: 문구가 없는 옵션 코드 ${[...craftMissing].join(', ')} (src/magicAffixes.js MODS)`)
  for (const c of data.crafts) {
    const n = bases.filter((b) => R.craftRecipesFor(data, b).some((r) => r.id === c.id)).length
    if (!n) err(`크래프트: ${c.name} 재료로 쓸 베이스가 없음`)
  }
  for (const b of bases) {
    for (const r of R.craftRecipesFor(data, b)) {
      if (/undefined|NaN/.test(r.fam.label)) err(`크래프트: ${b.code} ${r.name} 문구 오류 "${r.fam.label}"`)
    }
  }
  const craftOf = (code, name) => R.craftRecipesFor(data, B(code)).find((r) => r.name === name)
  expect(craftOf('rin', '블러드 반지')?.fam.label === '적중당 생명력 1~3% 훔침, 생명력 +10~20, 힘 +1~5', '블러드 반지 고정 옵션')
  expect(craftOf('7wa', '블러드 무기'), '버서커 액스로 블러드 무기 가능 (도끼 종류 전체)')
  expect(craftOf('uhl', '히트 파워 투구')?.fam.label.startsWith('피격 시 5% 확률로 4 레벨'), '히트 파워 투구 (엘리트 베이스 포함)')
  expect(R.craftRecipesFor(data, B('amu')).length === 4, '목걸이 크래프트 4종')
  // 크래프트 무작위 옵션은 최대 4개, 4개면 아이템 레벨 51 이상이라 저레벨 전용 접사와 같이 못 붙음
  const cRing = R.affixFamiliesFor(data, B('rin'), 'crafted')
  const fcr = cRing.find((f) => /^시전 속도/.test(f.label))
  expect(fcr, '크래프트 반지 시전 속도')
  const five = cRing.filter((f) => f.slot === 'p').slice(0, 3).concat(cRing.filter((f) => f.slot === 's').slice(0, 2))
  expect(R.validateAffixPicks(data, B('rin'), 'crafted', five.map(pickOf)).some((e) => /최대 4개/.test(e)), '크래프트 옵션 5개가 통과됨')
  console.log(`매직/레어 접사 검사: 베이스 ${bases.length}개, 옵션 종류 ${famCount}개, 크래프트 제작법 ${data.crafts.length}개`)
}

// ---------- 결과 출력 ----------
console.log(`검사 대상: 아이템 ${itemsData.length}개`)
console.log(`에러 ${errors.length}건, 경고 ${warnings.length}건\n`)

if (errors.length) {
  console.log('=== 에러 (반드시 고쳐야 함) ===')
  errors.forEach((e) => console.log('  ✗ ' + e))
  console.log('')
}
if (warnings.length) {
  console.log('=== 경고 (확인 권장) ===')
  warnings.forEach((w) => console.log('  ! ' + w))
  console.log('')
}
if (!errors.length && !warnings.length) console.log('문제 없음')

process.exit(errors.length ? 1 : 0)
