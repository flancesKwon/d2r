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
