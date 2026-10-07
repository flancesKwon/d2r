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
import { buildSkillTextIndex } from '../src/skillText.js'

const DIR = path.dirname(fileURLToPath(import.meta.url))
const read = (p) => JSON.parse(fs.readFileSync(path.join(DIR, '..', 'src', 'data', p), 'utf8'))
const items = read('items.json')
const magic = read('magicAffixes.json')
const skills = read('skills.json')
const skillText = read('skill_text.json')
const skillIdMap = read('skillIdMap.json')

// 수치 자리를 X 로 (범위 "10~20"·소수 "1.5"·음수 "-7" 도 한 덩어리)
const NUM = /[+-]?\d+(?:\.\d+)?(?:~[+-]?\d+(?:\.\d+)?)?/g
const shape = (text) => String(text).trim().replace(NUM, 'X')

const found = new Map() // 모양 -> { label, from:Set, aliases:Set, allClass, ex:Set(아이템 id) }
function add(text, from, meta = {}) {
  if (!text || typeof text !== 'string') return
  const t = text.trim()
  if (!t || t.length > 90) return
  const key = shape(t)
  // 수치가 여러 개면(예: "타격 시 X% 확률로 X 레벨 화염폭풍 시전") 첫 수치만 비교 대상
  if (!found.has(key)) found.set(key, { label: key, from: new Set(), aliases: new Set(), allClass: false, ex: new Set() })
  const row = found.get(key)
  row.from.add(from)
  // 직업 상관없이 쓰는 스킬 옵션 (게임 oskill - "심연 +1~3") - 화면에서 [모든 직업] 태그
  if (meta.allClass) row.allClass = true
  if (meta.ex && row.ex.size < 3) row.ex.add(meta.ex)
  if (meta.alias) row.aliases.add(meta.alias)
}

// 1) 사전 아이템 옵션
for (const it of items) for (const a of it.affixes || []) add(a.text, '사전', a.prop === 'oskill' ? { allClass: true, ex: it.id } : {})

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
// 시뮬레이터 쪽 skills.json 은 음차("데스 센트리"). 판매글 줄은 공식 이름이라 항목은 공식 이름으로 하나만 두고
// 음차는 그 항목의 별칭(검색어)으로만 붙임 - 예전엔 음차 항목이 따로 있어서 골라도 매물이 안 걸렸음
// (스킬 트리 이름도 시뮬레이터 이름('궁술')이 아니라 옵션 문구 이름('활과 석궁 기술')만 씀 - 매직/레어 접사에서 들어옴)
for (const [code, list] of Object.entries(skillText)) {
  const ko = CLASS_KO[code]
  if (!ko) throw new Error(`skill_text.json 의 클래스 "${code}" 한글 이름 없음 - CLASS_KO 에 추가`)
  for (const s of list || []) if (s.ko) add(`${s.ko} +1 (${ko} 전용)`, '스킬(공식)')
}
const textIndex = buildSkillTextIndex(skillText, skillIdMap, skills)
// 공식 스킬 이름 -> 시뮬레이터 음차 이름 ('순간이동' -> '텔레포트')
const skillAlias = new Map()
for (const [code, cls] of Object.entries(skills)) {
  const ko = CLASS_KO[code]
  if (!ko) throw new Error(`skills.json 의 클래스 "${code}" 한글 이름 없음 - CLASS_KO 에 추가`)
  for (const tab of cls.tabs || []) {
    for (const s of tab.skills || []) {
      const official = textIndex[code]?.[s.name]?.ko
      if (official && official !== s.name) {
        add(`${official} +1 (${ko} 전용)`, '스킬(공식)', { alias: s.name })
        skillAlias.set(official, s.name)
      }
    }
  }
  add(`${ko} 기술 레벨 +1`, '스킬')
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
  const row = { key: 'x:' + key, label: key, pattern, numeric: n > 0 }
  // 화면 태그용: 직업 전용 옵션 (cls = 한글 직업 이름), 직업 상관없는 스킬 옵션 (allClass + 예시 아이템 id)
  const cls = /\((.+) 전용\)$/.exec(key)?.[1]
  if (cls && Object.values(CLASS_KO).includes(cls)) row.cls = cls
  if (v.allClass && !row.cls) { row.allClass = true; row.ex = [...v.ex] }
  // 스킬 이름이 들어간 항목은 전부 음차로도 찾을 수 있게 ('텔레포트' 로 수수께끼의 '순간이동 X' 까지)
  for (const [official, nick] of skillAlias) if (key.includes(official)) v.aliases.add(nick)
  if (v.aliases.size) row.aliases = [...v.aliases]
  return row
}).sort((a, b) => a.label.localeCompare(b.label, 'ko'))

// 스킬 트리·직업 기술 옵션은 문구에 "전용"이 없어도 그 직업만 쓰는 옵션 ("공격 오라 +2" = 팔라딘)
// - 매직/레어 쪽 "공격 오라 X (팔라딘 전용)" 항목에서 트리 이름 -> 직업을 배워서 붙임
const tabClass = new Map()
for (const r of rows) {
  const m = /^(.+) X \((.+) 전용\)$/.exec(r.label)
  if (m && r.cls && / 기술$| 오라$|^저주|수련$|숙련$|함성$/.test(m[1])) tabClass.set(m[1], [...new Set([...(tabClass.get(m[1]) || []), r.cls])])
}
// 두 직업에 같은 이름이 있는 트리(소환 기술 = 네크로맨서·드루이드, 전투 기술 = 팔라딘·바바리안)는 태그 안 붙임
for (const [k, v] of tabClass) if (v.length === 1) tabClass.set(k, v[0]); else tabClass.delete(k)
// 유니크 쪽 "공격 오라 X" 와 매직/레어 쪽 "공격 오라 X (팔라딘 전용)" 은 게임에선 같은 옵션 -> 한 항목으로 합침
const byLabel = new Map(rows.map((r) => [r.label, r]))
const merged = new Set()
for (const r of rows) {
  if (r.cls) continue
  const m = /^(.+) X$/.exec(r.label)
  if (m && tabClass.has(m[1])) {
    r.cls = tabClass.get(m[1])
    const twin = byLabel.get(`${r.label} (${r.cls} 전용)`)
    if (twin) {
      twin.pattern = twin.pattern.replace(/ \\\(.+ 전용\\\)\$$/, (s) => `(?:${s.slice(0, -1)})?$`)
      merged.add(r)
    }
  }
  const lv = /^(.+) 기술 레벨 X$/.exec(r.label)
  if (lv && Object.values(CLASS_KO).includes(lv[1])) r.cls = lv[1]
}

const out = path.join(DIR, '..', 'src', 'data', 'statFilters.json')
fs.writeFileSync(out, JSON.stringify(rows.filter((r) => !merged.has(r)), null, 0) + '\n')
const bySrc = {}
for (const v of found.values()) for (const s of v.from) bySrc[s] = (bySrc[s] || 0) + 1
console.log(`옵션 검색 항목 ${rows.length - merged.size}개 (합침 ${merged.size}) (수치 ${rows.filter((r) => r.numeric).length} / 유무 ${rows.filter((r) => !r.numeric).length})`)
console.log('출처별:', Object.entries(bySrc).map(([k, n]) => `${k} ${n}`).join(', '))
console.log('->', path.relative(path.join(DIR, '..'), out))
