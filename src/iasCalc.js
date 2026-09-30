// 공격 속도(IAS) 계산 - 장비 공속이 몇 %일 때 공격 한 번에 몇 프레임(1초 = 25프레임)이 걸리는지
//
// 공식 (Amazon Basin·Phrozen Keep 에 정리된 게임 계산식)
//   EIAS = 스킬 공속 - 무기 속도(WSM) + ⌊120 × 공속 ÷ (120 + 공속)⌋   (-85 ~ 75, 변신 중엔 150 까지)
//   속도 = ⌊애니메이션 속도(보통 256) × (100 + EIAS) ÷ 100⌋
//   프레임 = ⌈256 × 동작 길이 ÷ 속도⌉ - 1   (연속 동작 스킬은 -1 없음)
// 동작 길이(직업·무기 종류별 프레임 수)는 D2R 3.3 animdata 기준 (Warren1001 IAS Calculator 에 정리된 값)

// f: 동작 길이, af: 타격 프레임, alt: 두 번째 공격 동작 길이(무작위로 둘 중 하나)
const T = (f, af, alt) => ({ f, af, alt })
const ANIM = {
  hth: { ama: T(13, 8), ass: T(11, 6, 12), bar: T(12, 6), dru: T(16, 8), nec: T(15, 8), pal: T(14, 7), sor: T(16, 9), war: T(16, 9), m1: T(15), m2: T(16), m5: T(16), m5f: T(16) },
  ht1: { ass: T(11, 6, 12) },
  '1hs': { ama: T(16, 10), ass: T(15, 7), bar: T(16, 7), dru: T(19, 9), nec: T(19, 9), pal: T(15, 7), sor: T(20, 12), war: T(16, 9), m5: T(16), m5f: T(16) },
  '1ht': { ama: T(15, 9), ass: T(15, 7), bar: T(16, 7), dru: T(19, 8), nec: T(19, 9), pal: T(17, 8), sor: T(19, 11), war: T(16, 8), m2: T(16) },
  '2hs': { ama: T(20, 12), ass: T(23, 11), bar: T(18, 8), dru: T(21, 10), nec: T(23, 11), pal: T(18, 8, 19), sor: T(24, 14), war: T(19, 11), m5: T(16) },
  '2ht': { ama: T(18, 11), ass: T(23, 10), bar: T(19, 9), dru: T(23, 9), nec: T(24, 10), pal: T(20, 8), sor: T(23, 13), war: T(21, 11, 23), m2: T(16) },
  stf: { ama: T(20, 12), ass: T(19, 9), bar: T(19, 9), dru: T(17, 9), nec: T(20, 11), pal: T(18, 9), sor: T(18, 11), war: T(17, 10), m2: T(16) },
  bow: { ama: T(14, 6), ass: T(16, 7), bar: T(15, 7), dru: T(16, 8), nec: T(18, 9), pal: T(16, 8), sor: T(17, 9), war: T(17, 11), m1: T(15) },
  xbw: { ama: T(20, 9), ass: T(21, 10), bar: T(20, 10), dru: T(20, 10), nec: T(20, 11), pal: T(20, 10), sor: T(20, 11), war: T(18, 10) },
  thr: { ama: T(16), ass: T(16), bar: T(16), dru: T(18), nec: T(20), pal: T(16), sor: T(20), war: T(20, 10) },
}

export const IAS_CLASSES = [
  { key: 'ama', name: '아마존' }, { key: 'ass', name: '어쌔신' }, { key: 'bar', name: '바바리안' }, { key: 'dru', name: '드루이드' },
  { key: 'nec', name: '네크로맨서' }, { key: 'pal', name: '팔라딘' }, { key: 'sor', name: '소서리스' }, { key: 'war', name: '악마술사' },
  // 용병 (3막 용병은 근접 공격 안 함)
  { key: 'm1', name: '1막 로그', merc: true }, { key: 'm2', name: '2막 사막 용병', merc: true },
  { key: 'm5', name: '5막 바바리안 (배쉬)', merc: true }, { key: 'm5f', name: '5막 바바리안 (프렌지)', merc: true },
]
export const isMerc = (cls) => cls[0] === 'm'
export const IAS_FORMS = [{ key: 'human', name: '사람' }, { key: 'wolf', name: '워울프' }, { key: 'bear', name: '워베어' }]

// kind: std(일반 공격과 같은 동작) seq(연속 동작) roll(되감기 동작) 등 / need: 무기 조건
// dual: 'need' 무기 둘 필수, 'can' 둘 들 수 있음
const S = (key, ko, en, o = {}) => ({ key, ko, en, ...o })
export const IAS_SKILLS = [
  S('std', '일반 공격', 'Attack', { dual: 'can' }),
  S('throw', '던지기', 'Throw', { need: 'throw', forms: ['human'] }),
  // 아마존
  S('strafe', '스트레이프', 'Strafe', { cls: ['ama'], need: 'ranged', roll: [50, 4] }),
  S('jab', '잽', 'Jab', { cls: ['ama'], need: 'spear', seq: true }),
  S('impale', '임페일', 'Impale', { cls: ['ama'], need: 'spear', seq: true, sias: 30 }),
  S('fend', '펜드', 'Fend', { cls: ['ama'], need: 'spear', roll: [30, 4] }),
  // 어쌔신
  S('tiger', '타이거 · 코브라 · 피닉스 스트라이크', 'Tiger / Cobra / Phoenix Strike', { cls: ['ass'], same: 'std', need: 'melee' }),
  S('fof', '피스트 오브 파이어 · 클러 오브 선더 · 블레이드 오브 아이스', 'Fists of Fire / Claws of Thunder / Blades of Ice', { cls: ['ass'], need: 'claw', seq: true, martial: true, dual: 'can' }),
  S('dclaw', '드래곤 클러', 'Dragon Claw', { cls: ['ass'], need: 'claw', seq: true, martial: true, dual: 'need' }),
  S('dtail', '드래곤 테일', 'Dragon Tail', { cls: ['ass'], fixed: 13, sias: -40, martial: true }),
  S('dtalon', '드래곤 탈런', 'Dragon Talon', { cls: ['ass'], fixed: 13, roll: [100, 1], martial: true }),
  S('traps', '덫 설치 (센트리)', 'Laying Traps', { cls: ['ass'], fixed: 8 }),
  // 바바리안
  S('bash', '배쉬 · 스턴 · 컨센트레이트 · 버서크', 'Bash / Stun / Concentrate / Berserk', { cls: ['bar'], same: 'std', need: 'melee' }),
  S('frenzy', '프렌지', 'Frenzy', { cls: ['bar'], need: 'melee', seq: true, dual: 'need' }),
  S('ds', '더블 스윙', 'Double Swing', { cls: ['bar'], need: 'melee', seq: true, dual: 'need', sias: 50 }),
  S('dthrow', '더블 스로우', 'Double Throw', { cls: ['bar'], need: 'throw', seq: true, dual: 'need' }),
  S('ww', '훨윈드', 'Whirlwind', { cls: ['bar', 'ass'], need: 'melee', dual: 'can' }),
  // 드루이드 (변신)
  S('fury', '퓨리', 'Fury', { cls: ['dru'], forms: ['wolf'], roll: [70, 3] }),
  S('rabies', '레이비즈', 'Rabies', { cls: ['dru'], forms: ['wolf'] }),
  S('feral', '피어럴 레이지', 'Feral Rage', { cls: ['dru'], forms: ['wolf'], same: 'std' }),
  S('hunger', '헝거', 'Hunger', { cls: ['dru'], forms: ['wolf', 'bear'] }),
  S('maul', '마울', 'Maul', { cls: ['dru'], forms: ['bear'], same: 'std' }),
  // 팔라딘
  S('smite', '스마이트', 'Smite', { cls: ['pal'], fixed: 12 }),
  S('zeal', '질', 'Zeal', { need: 'melee', roll: [100, 1] }),
  S('sac', '세크리파이스 · 벤젠스 · 컨버젼', 'Sacrifice / Vengeance / Conversion', { cls: ['pal'], same: 'std', need: 'melee' }),
  // 악마술사
  S('cleave', '가르기', 'Cleave', { cls: ['war'], need: 'melee', seq: true }),
  S('mirrored', '거울상 칼날', 'Mirrored Blades', { cls: ['war'], seq: true }),
  // 용병
  S('mjab', '잽', 'Jab', { cls: ['m2'], seq: true }),
  S('mbash', '배쉬 · 스턴', 'Bash / Stun', { cls: ['m5'], same: 'std' }),
  S('mfrenzy', '프렌지', 'Frenzy', { cls: ['m5f'], seq: true, dual: 'can' }),
  S('taunt', '도발', 'Taunt', { cls: ['m5f'], same: 'std', dual: 'can' }),
]
const SKILL = Object.fromEntries(IAS_SKILLS.map((s) => [s.key, s]))

// 스킬 레벨 -> 공속 (skillcalc 의 체감 공식)
const dim = (a, b, lvl) => (lvl > 0 ? a + Math.trunc(((b - a) * Math.trunc((110 * lvl) / (lvl + 6))) / 100) : 0)
export const BUFFS = {
  fana: { ko: '파나티시즘 (팔라딘 오라)', calc: (l) => dim(10, 40, l) },
  bos: { ko: '버스트 오브 스피드', calc: (l) => dim(15, 60, l), noMerc: true },
  frenzy: { ko: '프렌지 (공속 버프)', calc: (l) => dim(0, 50, l), cls: ['bar', 'm5f'] },
  wolf: { ko: '워울프 스킬 레벨', calc: (l) => dim(10, 80, l), forms: ['wolf'] },
  maul: { ko: '마울 스킬 레벨', calc: (l) => (l > 0 ? 3 * (Math.floor(l / 2) + 3) : 0), forms: ['bear'], skills: ['maul'] },
  purge: { ko: '주술: 처단', calc: (l) => (l > 0 ? Math.min(30, 10 + (l - 1)) : 0), cls: ['war'] },
  cleave: { ko: '가르기 스킬 레벨', calc: (l) => dim(10, 30, l), skills: ['cleave'] },
  mirrored: { ko: '거울상 칼날 스킬 레벨', calc: (l) => dim(10, 30, l), skills: ['mirrored'] },
}
export function buffsFor(cls, form, skillKey) {
  return Object.entries(BUFFS)
    .filter(([, b]) => (!b.cls || b.cls.includes(cls)) && !(b.noMerc && isMerc(cls)) && (!b.forms || b.forms.includes(form)) && (!b.skills || b.skills.includes(skillKey)))
    .map(([key, b]) => ({ key, ...b }))
}

export const eiasFromIas = (ias) => Math.trunc((120 * ias) / (120 + ias))

const isRanged = (w) => w && (w.wc === 'bow' || w.wc === 'xbw')
const isClaw = (w) => w && w.wc === 'ht1'
// 들 수 있는 손 수: 바바리안은 양손검을 한손으로
export const isTwoHanded = (cls, w) => !!w?.twoHanded && !(cls === 'bar' && w.oneOrTwo)

export function skillsFor(cls, form) {
  return IAS_SKILLS.filter((s) => {
    const forms = s.forms || ['human']
    if (!forms.includes(form)) return false
    if (!s.cls) return s.key === 'std' || (form === 'human' && !isMerc(cls))
    return s.cls.includes(cls)
  })
}

// 스킬·직업이 허용하는 주무기 / 보조 무기
export function weaponOk(cls, form, skillKey, w) {
  const s = SKILL[skillKey]
  if (w?.cls && w.cls !== cls) return false
  if (isMerc(cls) && w) {
    if (cls === 'm1') return w.wc === 'bow'
    if (cls === 'm2') return w.sub === '폴암' || w.sub === '창'
    return w.sub === '검' && (cls === 'm5' || !w.twoHanded)
  }
  if (form !== 'human') return !isRanged(w)
  switch (s.need) {
    case 'throw': return !!w?.throw
    case 'ranged': return isRanged(w)
    case 'spear': return !!w?.spear
    case 'claw': return isClaw(w)
    case 'melee': return !!w && !isRanged(w)
  }
  return true
}
export function canDual(cls, form, skillKey, w1) {
  const s = SKILL[skillKey]
  if (form !== 'human' || !s.dual || !w1 || isTwoHanded(cls, w1)) return false
  if (cls === 'ass') return isClaw(w1)
  if (cls === 'bar') return !isRanged(w1) && !isClaw(w1)
  if (cls === 'm5f') return true
  return false
}
export function offhandOk(cls, skillKey, w1, w2) {
  if (!w2 || isTwoHanded(cls, w2) || isRanged(w2) || (w2.cls && w2.cls !== cls)) return false
  if (cls === 'ass') return isClaw(w2)
  if (cls === 'm5f') return w2.sub === '검'
  if (skillKey === 'dthrow') return !!w2.throw
  return !isClaw(w2)
}

// 동작 종류: 맨손 hth, 클로 ht1, 그 외 무기의 wclass (바바리안이 양손검을 한손으로 들면 1hs)
function animClass(cls, w, oneHand) {
  if (!w) return 'hth'
  if (cls === 'bar' && w.oneOrTwo && oneHand) return w.wc
  return w.wc2
}

function sequenceLength(s, wc, dual) {
  switch (s.key) {
    case 'jab': return wc === '2ht' ? 21 : 18
    case 'impale': return wc === '2ht' ? 24 : 21
    case 'mjab': return 14
    case 'frenzy': case 'ds': case 'mfrenzy': return 17
    case 'dthrow': return 12
    case 'fof': case 'dclaw': return dual ? 16 : 12
    case 'cleave': return { '1hs': 16, '1ht': 16, '2hs': 18, '2ht': 20, stf: 22 }[wc]
    case 'mirrored': return { hth: 17, '1hs': 16, '1ht': 16, '2hs': 19, '2ht': 21, bow: 18, xbw: 18, stf: 17 }[wc]
  }
  return null
}

// 사람 모습 기준 동작 길이
function humanLength(cls, s, wc, dual) {
  if (s.key === 'throw') return ANIM.thr[cls].f
  if (s.fixed) return s.fixed
  if (s.seq) return sequenceLength(s, wc, dual)
  return ANIM[wc][cls].f
}

// 한 손(무기 하나) 기준 표. 반환: [{ias, frames}] - frames 는 숫자 또는 타격별 프레임 배열
function computeTable(o, hand) {
  const { cls, form } = o
  const s = SKILL[o.skill]
  const dual = !!o.w2
  const w = hand === 2 ? o.w2 : o.w1
  // 바바리안 양손검: 한손 체크 또는 쌍수·훨윈드면 한손 동작
  const oneHand = o.oneHand || dual || s.key === 'ww'
  const wc = animClass(cls, w, oneHand)
  const humanLen = humanLength(cls, s, wc, dual)

  let len1 // 첫 동작 길이
  if (form === 'wolf') len1 = s.key === 'fury' ? 7 : s.key === 'hunger' || s.key === 'rabies' ? 10 : 13
  else if (form === 'bear') len1 = s.key === 'hunger' ? 10 : 12
  else if (s.key === 'dtalon') len1 = 4
  else if (s.roll || s.key === 'ww') len1 = ANIM[wc][cls].af
  else if (o.alt) len1 = ANIM[wc][cls].alt
  else len1 = humanLen
  const len2 = s.key === 'fury' ? 13 : form === 'wolf' ? 9 : form === 'bear' ? 10 : humanLen // 되감기 동작의 마지막 타
  const formLen = form === 'wolf' ? 13 : 12

  let animSpeed = 256
  if (s.key === 'traps') animSpeed = 128
  else if (form === 'human' && isClaw(w) && !s.martial) animSpeed = len1 === 12 ? 227 : 208

  // 아마존·소서리스의 일반 공격·펜드·질은 동작 1~2프레임째부터 시작
  const start = (cls === 'ama' || cls === 'sor') && ['std', 'fend', 'zeal'].includes(s.key)
    ?(wc === 'hth' ? 1 : ['1hs', '2hs', '1ht', '2ht', 'stf'].includes(wc) ? 2 : 0) : 0

  // 스킬로 얻는 공속 (버프 - 느려짐)
  let sias = 0
  for (const b of buffsFor(cls, form, s.key)) sias += b.calc(Number(o.buffs?.[b.key]) || 0)
  if (o.chill) sias -= 50
  if (o.decrep) sias -= 50
  if (s.seq && !isMerc(cls)) sias -= 30 // 연속 동작 -30 은 캐릭터만
  sias += s.sias || 0

  const cap = form === 'human' ? 75 : 150
  const clamp = (e) => Math.max(-85, Math.min(cap, e))
  const wsm = (x) => x?.wsm || 0
  // 쌍수 연속 동작(프렌지·더블 스윙·더블 스로우·드래곤 클러)은 두 무기를 평균 - 프렌지 용병은 쌍수면 모든 공격
  const avgHands = dual && ((s.dual === 'need' && s.seq) || cls === 'm5f')
  const eiasAt = (g) => avgHands
    ? Math.trunc(sias - (wsm(o.w1) + wsm(o.w2)) / 2 + (eiasFromIas(g + (o.wias1 || 0)) + eiasFromIas(g + (o.wias2 || 0))) / 2)
    : sias - wsm(w) + eiasFromIas(g + ((hand === 2 ? o.wias2 : o.wias1) || 0))

  // 첫 타는 보통 1프레임 빠름(-1). 연속 동작·훨윈드·되감기 스킬은 빼지 않음 - 단 퓨리는 첫 타도 -1
  const offset = s.seq || (s.roll && s.key !== 'fury') || s.key === 'ww' ? 0 : 1
  const framesAt = (g) => {
    const e = clamp(eiasAt(g))
    const speed = form === 'human'
      ? Math.trunc((animSpeed * (100 + e)) / 100)
      : Math.trunc((animSpeed + Math.trunc((animSpeed * e) / 100)) * (formLen / humanLen))
    const first = (256 * (len1 - start)) / speed
    if (s.key === 'ww') return { e, f: Math.trunc(first) }
    const f1 = Math.ceil(first) - offset
    if (!s.roll) return { e, f: f1 }
    // 되감기 스킬: 타격 후 동작을 일정 비율 되감아 다음 타를 이어감
    const [rb, hits] = s.roll
    const lens = [f1]
    const backs = [start]
    let odd = null
    for (let h = 0; h < hits; h++) {
      const back = Math.trunc((Math.trunc((256 * backs[h] + speed * lens[h]) / 256) * (100 - rb)) / 100)
      backs.push(back)
      lens.push(Math.ceil((256 * (len1 - back)) / speed))
      if (hits === 4 && h === hits - 2) odd = [...lens, Math.ceil((256 * (len2 - back)) / speed) - 1]
    }
    lens.push(Math.ceil((256 * (len2 - backs[backs.length - 1])) / speed) - 1)
    return { e, f: lens, odd }
  }
  framesAt.eias = eiasAt
  return framesAt
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
// 장비 공속으로 올릴 수 있는 EIAS 는 현실적으로 +88 (양손 무기는 +83, 용병은 +78) 까지만 표에 보여줌
function tabulate(framesAt, pick, maxGain) {
  const rows = []
  const e0 = framesAt.eias(0)
  for (let g = 0; g <= 1000 && framesAt.eias(g) - e0 <= maxGain; g++) {
    const f = pick(framesAt(g))
    if (!rows.length || !same(rows[rows.length - 1].frames, f)) rows.push({ ias: g, frames: f })
  }
  return rows
}

// 여러 번 때리는 되감기 스킬(질·퓨리·스트레이프 등)은 타격별 프레임 배열 -> "6 (마지막 11)" / "7·7·6·6 (마지막 11)"
export function framesText(f) {
  if (typeof f === 'number') return String(f)
  const first = f[0]
  const last = f[f.length - 1]
  const hits = f.slice(0, -1)
  const head = hits.every((x) => x === first) ? String(first) : hits.join('·')
  return `${head} (마지막 ${last})`
}
// 한 번 공격(여러 타 스킬은 한 사이클)에 걸리는 평균 프레임 - 비교·초당 횟수용
export function framesAvg(f) {
  return typeof f === 'number' ? f : f.reduce((a, b) => a + b, 0) / f.length
}

// 결과: 표 목록 [{label, rows}]
// o: { cls, form, skill, w1, w2, oneHand, wias1, wias2, buffs, chill, decrep }
export function iasTables(o) {
  const s = SKILL[o.skill]
  const tables = []
  const maxGain = isMerc(o.cls) ? 78 : !o.w1 || !isTwoHanded(o.cls, o.w1) || o.cls === 'bar' ? 88 : 83
  const t1 = computeTable(o, 1)
  if (s.key === 'strafe' || s.key === 'fend') {
    const cross = o.w1?.wc === 'xbw'
    if (s.key === 'fend' || cross) tables.push({ label: '공격 횟수가 짝수일 때', rows: tabulate(t1, (r) => r.f, maxGain) })
    tables.push({ label: s.key === 'fend' || cross ? '공격 횟수가 홀수일 때' : '', rows: tabulate(t1, (r) => r.odd, maxGain) })
  } else if (s.key === 'ww' && o.w2) {
    const t2 = computeTable(o, 2)
    const r1 = tabulate(t1, (r) => r.f, maxGain)
    const r2 = tabulate(t2, (r) => r.f, maxGain)
    const both = (g) => ({ f: Math.ceil((t1(g).f + t2(g).f) / 2) })
    both.eias = t1.eias
    tables.push({ label: '두 무기 함께', rows: tabulate(both, (r) => r.f, maxGain) })
    tables.push({ label: '주무기만', rows: r1 })
    tables.push({ label: '보조 무기만', rows: r2 })
  } else {
    tables.push({ label: '', rows: tabulate(t1, (r) => r.f, maxGain) })
    // 공격 동작이 두 가지인 경우 (무작위)
    const wc = animClass(o.cls, o.w1, o.oneHand || !!o.w2)
    if (s.key === 'std' && o.form === 'human' && ANIM[wc][o.cls]?.alt) {
      const alt = tabulate(computeTable({ ...o, alt: true }, 1), (r) => r.f, maxGain)
      if (!same(alt, tables[0].rows)) {
        tables[0].label = '공격 동작 1'
        tables.push({ label: '공격 동작 2', rows: alt })
      }
    }
  }
  return { tables, eias: t1(Number(o.gias) || 0).e }
}

// 표에서 지금 공속이 속한 줄과 다음 단계
export function rowState(rows, gias) {
  let idx = 0
  rows.forEach((r, i) => { if (gias >= r.ias) idx = i })
  const next = rows[idx + 1] || null
  return { idx, next, need: next ? next.ias - gias : 0 }
}
