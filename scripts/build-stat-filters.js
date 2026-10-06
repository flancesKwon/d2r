// 거래게시판 옵션 검색 목록 만들기 - src/data/statFilters.json
//   node scripts/build-stat-filters.js
//
// traderie 의 Stats 처럼 "아이템에 붙을 수 있는 거의 모든 옵션"을 검색 대상으로 둠.
// 판매글에 저장되는 옵션 줄은 사람이 읽는 문구라서(예: "모든 저항 +17%"), 문구에서 수치만
// 자리표(X)로 바꾼 걸 하나의 검색 항목으로 봄 - 같은 문구 모양이면 같은 옵션.
//
// 모으는 곳
//   1) 아이템 사전(items.json)의 유니크·세트·룬워드 옵션 문구
//   2) 매직/레어/크래프트 접사(magicAffixes.json) 로 만들어지는 문구
//   3) 직업별 개별 스킬 (skills.json) - "블리자드 +X (소서리스 전용)"
//   4) 판매글 등록이 직접 넣는 줄 (기본 방어력·기본 데미지·소켓 등)
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { affixFamiliesFor, craftPoolFamilies, familyLines } from '../src/magicAffixes.js'

const DIR = path.dirname(fileURLToPath(import.meta.url))
const read = (p) => JSON.parse(fs.readFileSync(path.join(DIR, '..', 'src', 'data', p), 'utf8'))
const items = read('items.json')
const magic = read('magicAffixes.json')
const skills = read('skills.json')
const skillText = read('skill_text.json')

// 수치 자리를 X 로 (범위 "10~20"·소수 "1.5"·음수 "-7" 도 한 덩어리)
const NUM = /[+-]?\d+(?:\.\d+)?(?:~[+-]?\d+(?:\.\d+)?)?/g
const shape = (text) => String(text).trim().replace(NUM, 'X')

const found = new Map() // 모양 -> { label, from:Set }
function add(text, from) {
  if (!text || typeof text !== 'string') return
  const t = text.trim()
  if (!t || t.length > 90) return
  const key = shape(t)
  // 수치가 여러 개면(예: "타격 시 X% 확률로 X 레벨 화염폭풍 시전") 첫 수치만 비교 대상
  if (!found.has(key)) found.set(key, { label: key, from: new Set() })
  found.get(key).from.add(from)
}

// 1) 사전 아이템 옵션
for (const it of items) for (const a of it.affixes || []) add(a.text, '사전')

// 2) 매직/레어/크래프트 접사 - 베이스마다 붙는 게 달라서, 종류별 대표 베이스를 돌려 전부 모음
const bases = Object.entries(magic.bases || {}).map(([code, b]) => ({
  code, name_ko: b.name_ko || code, type_sub: b.type_sub || '', tier: b.tier || '',
  sockets: b.sockets || 0, base_stats: { category: b.category || 'misc' },
}))
const miscBases = (magic.miscBases || []).map((b) => ({ ...b, type_sub: b.name_ko, tier: '', sockets: 0, base_stats: { category: 'misc' } }))
for (const base of [...bases, ...miscBases]) {
  for (const quality of ['magic', 'rare']) {
    let fams = []
    try { fams = affixFamiliesFor(magic, base, quality) } catch { continue }
    for (const fam of fams) for (const line of familyLines(fam, fam.slotRanges.map(([lo, hi]) => (lo === hi ? lo : `${lo}~${hi}`)))) add(line, '매직레어')
  }
  let crafts = []
  try { crafts = craftPoolFamilies(magic.crafts || {}) } catch { crafts = [] }
  for (const c of crafts) {
    const fam = c.fam || c
    if (!fam?.slotRanges) continue
    for (const line of familyLines(fam, fam.slotRanges.map(([lo, hi]) => (lo === hi ? lo : `${lo}~${hi}`)))) add(line, '크래프트')
  }
}

// 3) 직업별 개별 스킬 - 사전에 안 붙는 스킬도 매직·레어 오브/스태프 등에 붙음
// skills.json 의 클래스 키 (amazon, sorc, …) -> 옵션 문구에 쓰는 한글 이름
const CLASS_KO = {
  amazon: '아마존', sorc: '소서리스', necro: '네크로맨서', paladin: '팔라딘',
  barb: '바바리안', druid: '드루이드', assassin: '어쌔신', warlock: '악마술사',
  // skill_text.json 은 클래스 키가 조금 다름
  sorceress: '소서리스', necromancer: '네크로맨서', barbarian: '바바리안',
}
// 스킬 이름이 우리 데이터에 두 벌 있음 - 아이템 옵션에 쓰이는 건 skill_text.json 쪽(게임 공식 번역: "죽음 파수기"),
// 시뮬레이터 쪽 skills.json 은 음차("데스 센트리"). 검색은 어느 쪽으로 쳐도 되게 둘 다 넣음
for (const [code, cls] of Object.entries(skills)) {
  const ko = CLASS_KO[code]
  if (!ko) throw new Error(`skills.json 의 클래스 "${code}" 한글 이름 없음 - CLASS_KO 에 추가`)
  for (const tab of cls.tabs || []) {
    for (const s of tab.skills || []) add(`${s.name} +1 (${ko} 전용)`, '스킬(음차)')
    add(`${tab.name} +1 (${ko} 전용)`, '스킬트리')
  }
  add(`${ko} 기술 레벨 +1`, '스킬')
}
for (const [code, list] of Object.entries(skillText)) {
  const ko = CLASS_KO[code]
  if (!ko) throw new Error(`skill_text.json 의 클래스 "${code}" 한글 이름 없음 - CLASS_KO 에 추가`)
  for (const s of list || []) if (s.ko) add(`${s.ko} +1 (${ko} 전용)`, '스킬(공식)')
}

// 4) 판매글이 직접 넣는 줄
for (const t of ['기본 방어력 100', '기본 데미지 10~20', '소켓 1개', '모든 기술 +1', '요구 레벨 50']) add(t, '기본')

// 검색 항목으로 바꾸기 - 수치 자리가 하나라도 있으면 숫자 범위 검색, 없으면 "붙어 있음" 검색
const XCOUNT = (s) => (s.match(/X/g) || []).length
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const rows = [...found.entries()].map(([key, v]) => {
  const n = XCOUNT(key)
  // 첫 X 만 수치로 잡고 나머지 X 는 아무 수나 허용
  let i = 0
  const ONE = '[+-]?\\d+(?:\\.\\d+)?(?:~[+-]?\\d+(?:\\.\\d+)?)?'
  const pattern = '^' + key.split('X').map(esc).join('\u0000').replace(/\u0000/g, () => (i++ === 0 ? '([+-]?\\d+(?:\\.\\d+)?)(?:~[+-]?\\d+(?:\\.\\d+)?)?' : ONE)) + '$'
  return { key: 'x:' + key, label: key, pattern, numeric: n > 0 }
}).sort((a, b) => a.label.localeCompare(b.label, 'ko'))

const out = path.join(DIR, '..', 'src', 'data', 'statFilters.json')
fs.writeFileSync(out, JSON.stringify(rows, null, 0) + '\n')
const bySrc = {}
for (const v of found.values()) for (const s of v.from) bySrc[s] = (bySrc[s] || 0) + 1
console.log(`옵션 검색 항목 ${rows.length}개 (수치 ${rows.filter((r) => r.numeric).length} / 유무 ${rows.filter((r) => !r.numeric).length})`)
console.log('출처별:', Object.entries(bySrc).map(([k, n]) => `${k} ${n}`).join(', '))
console.log('->', path.relative(path.join(DIR, '..'), out))
