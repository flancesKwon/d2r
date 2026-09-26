import { reactive } from 'vue'
import seedPosts from './data/tradePosts.json'
import itemsData from './data/items.json'
import { buildRuneLookup, runewordRuneAffixes, runewordSlots, runePips } from './itemStats.js'
import baseItemsData from './data/baseItems.json'
import classSkillsData from './data/classSkills.json'
import { pushNotification } from './notificationsStore.js'
import { createDeal } from './dealsStore.js'

export { itemsData }

// 아이템 사전엔 룬·보석·유니크·세트·룬워드(730종)만 있고 우버보스 열쇠 재료(다이아블로
// 뿔 등 퀘스트용 소환 재료)는 장비가 아니라서 원래 사전에 없음 - 그래도 검색으로
// 팔 수 있어야 해서 자주 거래되는 재료를 별도 목록으로 만들어 검색 대상에 포함시킴
export const UBER_MATERIALS = [
  { id: 'uber-diablo-horn', category: 'uber', name_ko: '다이아블로의 뿔', name_en: "Diablo's Horn" },
  { id: 'uber-baal-eye', category: 'uber', name_ko: '바알의 눈', name_en: "Baal's Eye" },
  { id: 'uber-meph-brain', category: 'uber', name_ko: '메피스토의 뇌', name_en: 'Mephisto Brain' },
  { id: 'uber-essence-suffering', category: 'uber', name_ko: '고통의 뒤틀린 정수', name_en: 'Twisted Essence of Suffering' },
  { id: 'uber-essence-hatred', category: 'uber', name_ko: '증오의 충전된 정수', name_en: 'Charged Essence of Hatred' },
  { id: 'uber-essence-terror', category: 'uber', name_ko: '공포의 불타는 정수', name_en: 'Burning Essence of Terror' },
  { id: 'uber-token', category: 'uber', name_ko: '용서의 증표', name_en: 'Token of Absolution' },
]
const ALL_TRADE_ITEMS = [...itemsData, ...UBER_MATERIALS]

// 희망 가격이 대부분 룬·보석 이름으로 적히는데("이스트 룬 2개" 등) 그냥 텍스트라
// 뭔지 한눈에 안 들어옴 - 가격 문자열에서 룬·보석 이름을 찾아서 아이콘을 붙여주려고
// 이름별로 찾아볼 수 있게 정리해둠. 긴 이름부터 매칭해야 "최상급 다이아몬드"가
// "다이아몬드"보다 먼저 잡힘
const CURRENCY_ITEMS = itemsData.filter((it) => it.category === 'gem')
const CURRENCY_BY_NAME = new Map(CURRENCY_ITEMS.map((it) => [it.name_ko, it]))
const CURRENCY_PATTERN = new RegExp(
  '(' + [...CURRENCY_BY_NAME.keys()].sort((a, b) => b.length - a.length).map(escapeRegExp).join('|') + ')',
  'g'
)
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// 가격 문자열을 일반 텍스트/룬·보석 이름 조각으로 쪼개서 반환 - 화면에서 룬·보석
// 이름 앞에만 아이콘을 붙여 보여주는 데 씀
export function parsePriceTokens(text) {
  if (!text) return []
  return text.split(CURRENCY_PATTERN).filter((part) => part !== '').map((part) => ({
    text: part,
    item: CURRENCY_BY_NAME.get(part) || null,
  }))
}

const runeLookup = buildRuneLookup(itemsData)

// 룬워드는 고유 옵션(affixes) + 박힌 룬들 자체 효과가 합쳐져서 최종 옵션이 됨(아이템
// 사전 페이지와 동일한 로직). 유니크·세트는 affixes 그대로.
export function getItemAffixes(item) {
  if (!item) return []
  if (item.category === 'runeword') return [...item.affixes, ...runewordRuneAffixes(item, runeLookup)]
  return item.affixes || []
}

// min~max 범위로 굴러가는 옵션인지 - 판매자가 실제 아이템에 뜬 값을 직접 입력하게
// 하려고 구분함. 충전형 스킬(레벨/충전 횟수처럼 min!==max지만 실제로는 두 값 다 고정인
// 경우)은 text에 "min~max" 패턴이 그대로 없으므로 자연히 제외됨
export function isRollRangeAffix(a) {
  if (!a || a.min === undefined || a.max === undefined || a.min === '' || a.max === '') return false
  if (String(a.min) === String(a.max)) return false
  return typeof a.text === 'string' && a.text.includes(`${a.min}~${a.max}`)
}

export function resolveAffixText(a, rolledValue) {
  if (rolledValue === undefined || rolledValue === null || rolledValue === '') return a.text
  return a.text.replace(`${a.min}~${a.max}`, String(rolledValue))
}

// 지옥불 횃불처럼 "무작위 직업 기술"이 붙는 아이템은 실제로는 아이템 하나당 7개
// 직업 중 하나로 고정돼서 나옴 - 판매자가 자기 아이템이 어떤 직업으로 나왔는지
// 고를 수 있게 함
export function isRandomClassSkillAffix(a) {
  return !!a && a.prop === 'randclassskill'
}
export const CLASS_SKILL_NAMES = {
  ama: '아마존', sor: '소서리스', nec: '네크로맨서', pal: '팔라딘', bar: '바바리안', dru: '드루이드', ass: '어쌔신',
}
export function resolveRandomClassSkillText(a, classCode, level) {
  const className = CLASS_SKILL_NAMES[classCode]
  if (className && level) return `${className} 기술 레벨 +${level}`
  if (className) return `${className} 기술 레벨 +${a.min}~${a.max}`
  return a.text
}

// 룬워드는 박히는 룬 조합(rune_sequence)이 고정돼 있어서 필요한 재료 룬을 그대로
// 보여줄 수 있음 - 판매글 등록할 때 재료가 뭔지 매번 직접 타이핑할 필요 없게 함
export function runewordMaterials(item) {
  if (!item || item.category !== 'runeword' || !item.extra || !item.extra.rune_sequence) return []
  return runePips(item.extra.rune_sequence).map((name) => runeLookup[name]).filter(Boolean)
}

// 룬·퍼펙트 보석·우버보스 재료(소환 재료)는 여러 개를 묶어 파는 경우가 많아서 개수를
// 입력받고, 장비(유니크·세트·룬워드·매직/레어/일반)나 기타는 낱개(1개)로 고정
export const QUANTITY_CATEGORIES = ['룬', '퍼펙트 보석', '우버보스 재료']
export function categoryHasQuantity(category) {
  return QUANTITY_CATEGORIES.includes(category)
}

export const TRADE_CATEGORIES = ['룬', '퍼펙트 보석', '우버보스 재료', '유니크/세트', '룬워드', '매직/레어/일반', '기타']
export const TRADE_STATUSES = ['판매중', '예약중', '거래완료']
// 아시아 서버 유저 대상 게시판이라 서버 선택 자체를 없앰 - 항상 아시아로 고정
export const TRADE_REALMS = ['아시아']
export const TRADE_LADDERS = ['레더', '논레더']
export const TRADE_HARDCORE = ['일반', '하드코어']

// 카테고리를 미리 고르지 않아도 아이템명만 검색해서 바로 선택할 수 있게 하는
// 통합 검색 - 사전 730종(룬·보석·유니크·세트·룬워드) + 우버보스 재료 목록을 대상으로
// 찾고, 고르면 트레이드 카테고리가 자동으로 맞춰짐. 아이템 사전 검색처럼 별칭(샤코,
// 애니참, 파괴참 등 유저들이 실제로 부르는 이름)으로도 찾을 수 있게 함
export function searchAllItems(query) {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return ALL_TRADE_ITEMS
    .filter(
      (it) =>
        it.name_ko.toLowerCase().includes(q) ||
        it.name_en.toLowerCase().includes(q) ||
        (it.aliases || []).some((a) => a.toLowerCase().includes(q))
    )
    .slice(0, 40)
}

export function tradeCategoryForItem(item) {
  if (!item) return null
  if (item.category === 'gem' && item.type_sub === '룬') return '룬'
  if (item.category === 'gem' && item.type_sub === '보석') return '퍼펙트 보석'
  if (item.category === 'unique' || item.category === 'set') return '유니크/세트'
  if (item.category === 'runeword') return '룬워드'
  if (item.category === 'uber') return '우버보스 재료'
  return null
}

// 룬워드·유니크·세트는 베이스가 무기인지 방어구인지에 따라 실제로 붙을 수 있는 옵션이
// 갈려서(방어력은 방어구에만, 인핸스드 데미지는 무기에만 등), "옵션 직접 추가" 목록을
// 그 아이템에 맞는 것만 보여주려고 구분함. 판단 불가능하면(우버 재료·자유입력 등) null
const ARMOR_TYPE_SUBS = ['방패', '투구', '갑옷', '장갑', '신발', '벨트']
export function itemBaseKind(item) {
  if (!item) return null
  if (item.category === 'runeword') {
    const slots = runewordSlots(item.subtitle)
    const hasWeapon = slots.includes('weapon')
    const hasArmor = slots.some((s) => s !== 'weapon')
    if (hasWeapon && !hasArmor) return 'weapon'
    if (hasArmor && !hasWeapon) return 'armor'
    return null
  }
  if (item.category === 'unique' || item.category === 'set') {
    if (item.type_group === '무기') return 'weapon'
    if (ARMOR_TYPE_SUBS.includes(item.type_sub)) return 'armor'
  }
  return null
}

// 에테리얼(내구도 없이 무형화되지만 스탯이 강화되는 등급)은 장신구엔 없고 무기·방어구
// 계열에만 적용되는 실제 아이템 속성이라, 장비 계열 카테고리에서만 체크박스를 보여줌
export const ETHEREAL_CATEGORIES = ['유니크/세트', '룬워드', '매직/레어/일반']
export function categorySupportsEthereal(category) {
  return ETHEREAL_CATEGORIES.includes(category)
}

// 룬워드·매직/레어/일반은 베이스로 실제 어떤 무기·방어구를 썼는지가 매번 달라서
// 사전에 없음 - 게임 원본 데이터로 만든 전체 베이스 목록(508종, scripts/build-base-items.js)
// 에서 고름. 한글 이름은 게임 공식 이름이고, 예전에 직접 붙였던 이름(alt_ko)도 검색됨
export const BASE_ITEMS = baseItemsData
const TIER_ORDER = { 엘리트: 0, 익셉셔널: 1, 노멀: 2 }
const squash = (s) => (s || '').toLowerCase().replace(/\s+/g, '')

// 룬워드를 만들 수 있는 베이스인지 - 룬워드 허용 종류(subtitle의 "pole + spea" 같은
// 게임 종류 코드) 중 하나가 베이스의 종류/상위 분류에 있고, 필요한 소켓 수만큼 뚫을 수
// 있어야 함 (예: 수수께끼 = 갑옷 3소켓 -> 신발·투구나 최대 2소켓인 퀼티드 아머는 제외)
export function baseFitsRuneword(base, runeword) {
  const allowed = (runeword.subtitle || '').split('+').map((s) => s.trim()).filter(Boolean)
  const need = Number(runeword.extra?.socket_count) || 0
  return allowed.some((c) => base.types.includes(c)) && base.sockets >= need
}

// runeword를 넘기면 그 룬워드를 만들 수 있는 베이스만, 엘리트부터 전부 보여줌
export function searchBaseItems(query, kind, runeword = null) {
  let list = BASE_ITEMS
  if (runeword) list = list.filter((b) => baseFitsRuneword(b, runeword))
  else if (kind === 'weapon' || kind === 'armor') list = list.filter((b) => b.base_stats.category === kind)
  // 띄어쓰기 차이(메이지플레이트 / 메이지 플레이트)는 무시하고, 세부 종류(갑옷, 폴암)나
  // 등급(엘리트)으로도 찾을 수 있게 함
  const q = squash(query)
  if (q) {
    list = list.filter((b) =>
      [b.subtitle, b.name_ko, b.alt_ko, b.type_sub, b.tier].some((s) => squash(s).includes(q))
    )
  }
  if (runeword) return [...list].sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier])
  return list.slice(0, 40)
}

// 직업 전용 베이스에 실제로 붙을 수 있는 클래스 스킬만 (스태프 모드 규칙)
// - 아이템 레벨이 높으면 낮은 단계 스킬은 안 붙음: 아이템 레벨 25~36이면 1단계(요구 레벨 1) 제외,
//   37 이상이면 1~2단계(요구 레벨 1·6) 제외. 베이스 레벨보다 낮은 아이템 레벨로는 안 떨어져서
//   베이스 레벨로 판단 (예: 엘리트 오브엔 파이어 볼트·웜쓰 등이 안 붙음)
// - 특정 무기가 필요한 스킬은 그 종류 베이스에만 (홀엔 스마이트·홀리 실드 X, 바바리안 투구엔 근접 스킬 X)
export function classSkillsForBase(base) {
  const cls = base?.class_skills && classSkillsData[base.class_skills]
  if (!cls) return null
  const minReq = base.qlvl >= 37 ? 12 : base.qlvl >= 25 ? 6 : 1
  const skills = cls.skills.filter((s) => s.req >= minReq && (!s.itype || base.types.includes(s.itype)))
  return { name: cls.name, skills, minReq }
}

export function baseItemLabel(b) {
  return b.name_ko ? `${b.name_ko} (${b.subtitle})` : `${b.subtitle} · ${b.type_sub}`
}

// "기타 옵션 직접 추가" 콤보박스 목록 - 기본방어력/증가된방어력/추가내구도(방어구)나
// 증가된데미지/추가내구도/추가스킬(무기)은 전용 입력칸으로 따로 빠졌고, 여기 남은
// 목록은 그 외에 자주 붙는 옵션들. "기타"는 목록에 없는 옵션을 위한 자유 입력 폴백
export const CUSTOM_OPTION_PRESETS = [
  { key: 'ias', label: '공격 속도 증가(%)', restrict: 'weapon', format: (v) => `공격 속도 증가 +${v}%` },
  { key: 'frw', label: '이동/공격 속도 증가(%)', restrict: 'armor', format: (v) => `이동/공격 속도 증가 +${v}%` },
  { key: 'sockets', label: '소켓 개수', format: (v) => `소켓 ${v}개` },
  { key: 'life', label: '생명력', format: (v) => `생명력 +${v}` },
  { key: 'mana', label: '마나', format: (v) => `마나 +${v}` },
  { key: 'str', label: '힘', format: (v) => `힘 +${v}` },
  { key: 'dex', label: '민첩', format: (v) => `민첩 +${v}` },
  { key: 'vit', label: '활력', format: (v) => `활력 +${v}` },
  { key: 'enr', label: '마력', format: (v) => `마력 +${v}` },
  { key: 'allstats', label: '모든 속성', format: (v) => `모든 속성 +${v}` },
  { key: 'allres', label: '모든 저항(%)', format: (v) => `모든 저항 +${v}%` },
  { key: 'fireres', label: '화염 저항(%)', format: (v) => `화염 저항 +${v}%` },
  { key: 'coldres', label: '냉기 저항(%)', format: (v) => `냉기 저항 +${v}%` },
  { key: 'ltngres', label: '번개 저항(%)', format: (v) => `번개 저항 +${v}%` },
  { key: 'poisres', label: '독 저항(%)', format: (v) => `독 저항 +${v}%` },
  { key: 'allskills', label: '모든 기술', format: (v) => `모든 기술 +${v}` },
  { key: 'mf', label: '마법 아이템 발견 확률(%)', format: (v) => `마법 아이템 발견 확률 +${v}%` },
  { key: 'gf', label: '골드 발견 확률(%)', format: (v) => `골드 발견 확률 +${v}%` },
  { key: 'lifesteal', label: '공격 시 생명력 흡수(%)', format: (v) => `공격 시 생명력 흡수 +${v}%` },
  { key: 'manasteal', label: '공격 시 마나 흡수(%)', format: (v) => `공격 시 마나 흡수 +${v}%` },
  { key: 'fhr', label: '재빠른 히트 회복(%)', format: (v) => `재빠른 히트 회복 +${v}%` },
  { key: 'custom', label: '기타 (직접 입력)', freeText: true, placeholder: '예: 베이스 3소켓 크리스 소드' },
]

// 무기 베이스로 확정되면 방어구 전용 옵션을 숨기고, 방어구 베이스면 무기 전용 옵션을
// 숨김 - 베이스를 알 수 없으면(우버 재료 등) 전부 노출. kind는 itemBaseKind() 결과나
// (아이템 사전에 없는 매직/레어/일반처럼) 사용자가 직접 고른 무기/방어구 값을 받음
export function optionPresetsFor(kind) {
  if (!kind) return CUSTOM_OPTION_PRESETS
  return CUSTOM_OPTION_PRESETS.filter((p) => !p.restrict || p.restrict === kind)
}

// 거래게시판 목록의 "옵션 조건" 필터 - 트레더리의 Stats 필터처럼 "모든 저항 20 이상"
// 같은 조건으로 판매글을 거를 수 있게 함. 판매글 옵션은 완성된 문장(텍스트)으로만
// 저장돼서, 아이템 사전 옵션 문구("마법 아이템 발견 확률 50% 증가")와 직접 추가 옵션
// 문구("마법 아이템 발견 확률 +50%")를 둘 다 잡는 패턴으로 수치를 뽑아냄. 판매자가
// 실제 값을 안 넣어서 "15~20"처럼 범위로 남은 옵션은 보장되는 최솟값(앞 숫자)으로 비교
const N = '\\+?(-?\\d+)(?:~\\d+)?'
export const TRADE_STAT_FILTERS = [
  { key: 'allskills', label: '모든 기술', pattern: `^모든 기술 ${N}` },
  { key: 'allres', label: '모든 저항(%)', pattern: `^모든 저항 ${N}` },
  { key: 'fireres', label: '화염 저항(%)', pattern: `^화염 저항 ${N}` },
  { key: 'coldres', label: '냉기 저항(%)', pattern: `^냉기 저항 ${N}` },
  { key: 'ltngres', label: '번개 저항(%)', pattern: `^번개 저항 ${N}` },
  { key: 'poisres', label: '독 저항(%)', pattern: `^독 저항 ${N}` },
  { key: 'mf', label: '마법 아이템 발견 확률(%)', pattern: `^마법 아이템 발견 확률 ${N}` },
  { key: 'gf', label: '골드 발견 확률(%)', pattern: `^(?:괴물에게서 얻는 금화|골드 발견 확률) ${N}` },
  { key: 'life', label: '생명력', pattern: `^생명력 ${N}` },
  { key: 'mana', label: '마나', pattern: `^마나 ${N}` },
  { key: 'allstats', label: '모든 속성', pattern: `^모든 속성 ${N}` },
  { key: 'str', label: '힘', pattern: `^힘 ${N}` },
  { key: 'dex', label: '민첩', pattern: `^민첩 ${N}` },
  { key: 'vit', label: '활력', pattern: `^활력 ${N}` },
  { key: 'enr', label: '마력', pattern: `^마력 ${N}` },
  { key: 'fcr', label: '시전 속도(%)', pattern: `^시전 속도 ${N}` },
  { key: 'ias', label: '공격 속도(%)', pattern: `^공격 속도(?: 증가)? ${N}` },
  { key: 'fhr', label: '타격 회복 속도(%)', pattern: `^(?:타격 회복 속도|재빠른 히트 회복) ${N}` },
  { key: 'frw', label: '달리기/걷기 속도(%)', pattern: `^(?:달리기/걷기 속도|이동/공격 속도 증가) ${N}` },
  { key: 'ed', label: '인핸스드 데미지(%)', pattern: `^(?:인핸스드 데미지|증가된 데미지) ${N}` },
  { key: 'edef', label: '방어력 증가(%)', pattern: `^(?:방어력|증가된 방어력) ${N}%` },
  { key: 'sockets', label: '소켓 개수', pattern: '^소켓 (\\d+)개' },
  { key: 'lifesteal', label: '생명력 흡수(%)', pattern: `^(?:적중당 생명력|공격 시 생명력 흡수) ${N}` },
  { key: 'manasteal', label: '마나 흡수(%)', pattern: `^(?:적중당 마나|공격 시 마나 흡수) ${N}` },
  { key: 'dr', label: '받는 물리 피해 감소(%)', pattern: `^받는 물리 피해 ${N}% 감소` },
  { key: 'cb', label: '강타 확률(%)', pattern: `^강타 확률 ${N}` },
  { key: 'ds', label: '치명적 공격(%)', pattern: `^치명적 공격 ${N}` },
  { key: 'skilldmg', label: '원소·마법 기술 피해(%)', pattern: `^(?:냉기|화염|번개|독|마법) 기술 피해 ${N}` },
  // "적의 냉기 저항 -7%"처럼 음수로 적히는 옵션이라 크기(양수)로 비교
  { key: 'pierce', label: '적 저항 감소(%)', pattern: '^적(?:의)? (?:냉기|화염|번개|독|마법|물리 피해) 저항 -(\\d+)' },
  { key: 'pdr', label: '피해 감소', pattern: `^피해 ${N} 감소` },
  { key: 'mdr', label: '마법 피해 감소', pattern: `^마법 피해 ${N} 감소` },
  // 직업 전용 베이스 스킬("블리자드 +3 (소서리스 전용)") - 여러 개 붙어도 합치지 않고 가장 높은
  // 수치로 비교해서 "3 이상" = +3짜리 스킬이 하나라도 있음
  { key: 'classskill', label: '클래스 스킬 (가장 높은 수치)', pattern: '^.+ \\+(\\d+) \\((?:아마존|소서리스|네크로맨서|팔라딘|바바리안|드루이드|어쌔신|워록) 전용\\)$', agg: 'max' },
].map((s) => ({ ...s, regex: new RegExp(s.pattern) }))
const STAT_FILTER_BY_KEY = new Map(TRADE_STAT_FILTERS.map((s) => [s.key, s]))

// 판매글에서 해당 옵션 수치를 찾아 반환 (같은 옵션이 여러 줄이면 합산 - 무한의
// "강타 확률 +20%"처럼 룬워드 고유 옵션과 룬 효과가 겹쳐 두 번 붙는 경우. agg: 'max'인
// 조건은 합산 대신 가장 높은 값), 없으면 null
export function postStatValue(post, key) {
  const stat = STAT_FILTER_BY_KEY.get(key)
  if (!stat) return null
  let total = null
  for (const line of post.options || []) {
    const m = stat.regex.exec(line)
    if (!m) continue
    const v = Number(m[1])
    total = total === null ? v : stat.agg === 'max' ? Math.max(total, v) : total + v
  }
  return total
}

// 아이템 사전의 룬·룬워드는 level_req가 비어 있어서(유니크·세트만 채워짐) 룬 요구
// 레벨을 따로 둠 - 게임 고정값(엘 11 ~ 조드 69). 룬워드 요구 레벨 = 박힌 룬 중 최고값
const RUNE_LEVEL_REQ = {
  El: 11, Eld: 11, Tir: 13, Nef: 13, Eth: 15, Ith: 15, Tal: 17, Ral: 19, Ort: 21, Thul: 23, Amn: 25,
  Sol: 27, Shael: 29, Dol: 31, Hel: 33, Io: 35, Lum: 37, Ko: 39, Fal: 41, Lem: 43, Pul: 45, Um: 47,
  Mal: 49, Ist: 51, Gul: 53, Vex: 55, Ohm: 57, Lo: 59, Sur: 61, Ber: 63, Jah: 65, Cham: 67, Zod: 69,
}

// 요구 레벨은 판매글이 아니라 아이템 사전 데이터에서 가져옴 - 사전에 없는 아이템(매직/
// 레어, 기타, 우버 재료)이나 보석처럼 레벨 정보가 없는 건 null
export function itemLevelReq(item) {
  if (!item) return null
  if (item.level_req) return Number(item.level_req)
  if (item.type_sub === '룬' && item.name_en?.endsWith(' Rune')) {
    return RUNE_LEVEL_REQ[item.name_en.replace(' Rune', '')] ?? null
  }
  if (item.category === 'runeword' && item.extra?.rune_sequence) {
    const levels = runePips(item.extra.rune_sequence).map((r) => RUNE_LEVEL_REQ[r])
    return levels.length && levels.every((lv) => lv !== undefined) ? Math.max(...levels) : null
  }
  return null
}
export function postLevelReq(post) {
  return itemLevelReq(getTradeItem(post.itemId))
}

// 콤보박스 없이 숫자만 입력받아서 "N개"로 만듦
export function buildAmountLabel(count) {
  const n = Number(count) || 0
  return n > 0 ? `${n}개` : ''
}

export const tradeState = reactive({
  posts: seedPosts.map((p) => ({
    ...p,
    requests: p.requests ? p.requests.map((r) => ({ ...r })) : [],
  })),
})

let nextPostId = seedPosts.length + 1
let nextRequestId =
  Math.max(0, ...seedPosts.flatMap((p) => (p.requests || []).map((r) => r.id))) + 1

function today() {
  return new Date().toISOString().slice(0, 10)
}

export function getTradeItem(itemId) {
  return itemId ? ALL_TRADE_ITEMS.find((it) => it.id === itemId) : null
}

export function addTradePost({
  category,
  itemId,
  itemName,
  amountLabel,
  price,
  realm,
  ladder,
  hardcore,
  author,
  contact,
  content,
  options,
  ethereal,
  negotiable,
}) {
  const post = {
    id: 't-new-' + nextPostId++,
    category,
    itemId: itemId || null,
    itemName,
    amountLabel,
    // 텍스트가 없는 옵션(데이터 누락)은 빈 줄로 저장되지 않게 뺌
    options: (options || []).filter(Boolean),
    ethereal: !!ethereal,
    negotiable: !!negotiable,
    price,
    realm,
    ladder,
    hardcore,
    author: author || '익명',
    contact: contact || '',
    date: today(),
    views: 0,
    status: '판매중',
    content: content || '',
    requests: [],
  }
  tradeState.posts.unshift(post)
  return post
}

// kind: 'inquiry'(기존 구매신청 폼) | 'buy_now'(판매글의 "구매하기" 버튼) - 흥정 가능
// 판매글이면 buy_now 신청에 offerItems(제안하는 룬/보석 목록)가 같이 담김
export function addTradeRequest(postId, { buyer, contact, qty, message, offerItems = [], kind = 'inquiry' }) {
  const post = tradeState.posts.find((p) => p.id === postId)
  if (!post) return
  post.requests.push({
    id: nextRequestId++,
    buyer: buyer || '익명',
    contact: contact || '',
    qty: Number(qty) || 1,
    message: message || '',
    offerItems: offerItems || [],
    kind,
    date: today(),
    status: 'pending',
  })
  const label = kind === 'buy_now' ? '구매 신청' : '구매신청'
  pushNotification(`"${post.itemName}" 판매글에 새 ${label}이 도착했어요.`, `/trade/${postId}`)
}

// 판매자가 구매신청을 수락/거절 - 트레더리의 "오퍼 수락" 흐름과 비슷하게, 수락하면
// 판매중이던 글이 자동으로 예약중으로 넘어가서 다른 구매자에게도 진행 상황이 보이고,
// 이 신청을 위한 거래방(채팅)이 "거래중인 품목"에 새로 열림
export function respondToRequest(postId, requestId, decision) {
  const post = tradeState.posts.find((p) => p.id === postId)
  const req = post && post.requests.find((r) => r.id === requestId)
  if (!req) return
  req.status = decision
  if (decision === 'accepted') {
    if (post.status === '판매중') post.status = '예약중'
    createDeal(post, req)
  }
  const decisionLabel = decision === 'accepted' ? '수락' : '거절'
  pushNotification(`"${post.itemName}" 구매신청이 ${decisionLabel}됐어요.`, `/trade/${postId}`)
}

export function updateTradeStatus(postId, status) {
  const post = tradeState.posts.find((p) => p.id === postId)
  if (!post) return
  post.status = status
}

export function getTradePost(postId) {
  return tradeState.posts.find((p) => p.id === postId)
}

// 로그인이 없어서 "내가 쓴 글"·"거래내역"은 프로필에 저장된 닉네임과 author/buyer
// 문자열이 일치하는지로 찾음 - 마이페이지에서 사용
export function tradePostsByAuthor(nickname) {
  if (!nickname) return []
  return tradeState.posts.filter((p) => p.author === nickname)
}

export function tradePostsWithMyRequests(nickname) {
  if (!nickname) return []
  return tradeState.posts.filter((p) => p.requests.some((r) => r.buyer === nickname))
}
