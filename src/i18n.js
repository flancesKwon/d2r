// 다국어 - 한국어 원문을 그대로 키로 씀: t('판매글 등록') -> 영어 사전에 있으면 영어, 없으면 한국어 그대로
// (화면을 하나씩 옮겨도 안 옮긴 곳은 한국어로 보일 뿐 깨지지 않음)
// - 언어는 주소로 정함: /en/... = 영어, 그 외 = 한국어. 영어로 들어오면 앱 안에서 이동해도 /en 유지 (router.js)
// - 사전은 src/locales/<언어>.js, 고를 때만 받음 (한국어 사용자는 안 받음)
// - 자리 채우기: t('판매중 {n}개', { n: 3 })
// - 아이템 이름: itemName(it) - 영어면 name_en
import { ref } from 'vue'

export const LOCALES = [
  { code: 'ko', label: '한국어', short: 'KO', htmlLang: 'ko' },
  { code: 'en', label: 'English', short: 'EN', htmlLang: 'en' },
]
export const DEFAULT_LOCALE = 'ko'
const PREFIXED = LOCALES.filter((l) => l.code !== DEFAULT_LOCALE).map((l) => l.code)

export const locale = ref(DEFAULT_LOCALE)
const dicts = { ko: {} }
// 사전 받는 중엔 화면을 한 번 더 그리게 (dict 가 바뀌면 t 결과가 바뀌어야 함)
const dictVersion = ref(0)

const loaders = {
  en: () => Promise.all([import('./locales/en.js'), import('./locales/affixes.en.js'), import('./locales/skills.en.json')])
    .then(([d, a, sk]) => ({ default: d.default, affixes: a, skillDesc: sk.default })),
}
// 아이템 옵션 문구 사전 (locales/affixes.<언어>.js), 스킬 설명 (locales/skills.<언어>.json)
const affixDicts = {}
const skillDescDicts = {}

// 주소 앞의 언어 ('/en/trade/1' -> 'en', '/trade/1' -> 'ko')
export function localeOfPath(path) {
  const m = /^\/([a-z]{2})(?=\/|$)/.exec(path || '')
  return m && PREFIXED.includes(m[1]) ? m[1] : DEFAULT_LOCALE
}
// 언어를 뗀 주소 ('/en/trade/1' -> '/trade/1', '/en' -> '/')
export function stripLocale(path) {
  const code = localeOfPath(path)
  if (code === DEFAULT_LOCALE) return path || '/'
  return path.slice(code.length + 1) || '/'
}
// 언어를 붙인 주소
export function withLocale(path, code = locale.value) {
  const bare = stripLocale(path)
  if (code === DEFAULT_LOCALE) return bare
  return '/' + code + (bare === '/' ? '' : bare)
}

export async function setLocale(code) {
  if (!LOCALES.some((l) => l.code === code)) code = DEFAULT_LOCALE
  if (!dicts[code] && loaders[code]) {
    try {
      const mod = await loaders[code]()
      dicts[code] = mod.default
      affixDicts[code] = mod.affixes || null
      skillDescDicts[code] = mod.skillDesc || null
    } catch (e) {
      dicts[code] = {}
    }
    dictVersion.value++
  }
  locale.value = code
  if (typeof document !== 'undefined') document.documentElement.lang = LOCALES.find((l) => l.code === code).htmlLang
}

export function t(text, params) {
  void dictVersion.value
  const dict = locale.value !== DEFAULT_LOCALE ? dicts[locale.value] : null
  // 빈 문자열 번역('개' -> '')도 그대로 씀
  let out = dict && Object.prototype.hasOwnProperty.call(dict, text) ? dict[text] : text
  if (params) out = out.replace(/\{(\w+)\}/g, (m, k) => (params[k] ?? m))
  return out
}

// 아이템 이름 (items.json 의 한 줄, 또는 거래글처럼 itemName 만 있는 경우 fallback)
export function itemName(it, fallback = '') {
  if (!it) return fallback
  if (locale.value === 'en' && it.name_en) return it.name_en
  return it.name_ko || fallback
}

// 아이템 옵션 문구 (한국어로 저장된 '힘 +8', '시체 폭발 +1~3 (네크로맨서 전용)' 같은 줄) -> 지금 언어
// 문구 속 숫자를 #로 바꾼 모양으로 사전을 찾고, 숫자는 원문 그대로 다시 채움. 모르는 문구는 한국어 그대로
const NUM_RE = /(?<![\d.])-?\d+(?:\.\d+)?(?:~-?\d+(?:\.\d+)?)?/g
const affixCache = new Map()
function fillNums(tpl, nums, names) {
  return tpl.replace(/\{(\+?)(\d+|S|C)\}/g, (m, plus, k) => {
    if (k === 'S' || k === 'C') return names[k] ?? m
    const n = nums[Number(k)]
    if (n == null) return m
    const [a, b] = n.split('~')
    if (b != null) return a.startsWith('-') ? `(${a} to ${b})` : `${plus}(${a}-${b})`
    return plus && !a.startsWith('-') ? '+' + a : a
  })
}
function translateAffix(text, A) {
  const one = translateLine(text, A)
  if (one != null || !text.includes(', ')) return one
  // 한 줄에 옵션 여러 개 ('시야 +1, 명중률 +10') - 각각 바꿔서 다시 이음
  const parts = text.split(', ').map((x) => translateLine(x, A))
  return parts.every((x) => x != null) ? parts.join(', ') : null
}
function translateLine(text, A) {
  // '방어력 +0.5 (캐릭터 레벨당)'
  const per = /^(.+) \(캐릭터 레벨당\)$/.exec(text.trim())
  if (per) return translateLine('캐릭터 레벨당 ' + per[1], A)
  const nums = []
  const shape = text.trim().replace(NUM_RE, (m) => (nums.push(m), '#'))
  if (A.PATTERNS[shape]) return fillNums(A.PATTERNS[shape], nums, {})
  const lv = /^캐릭터 레벨당 (.+)$/.exec(shape)
  if (lv && A.PER_LEVEL[lv[1]]) return fillNums(A.PER_LEVEL[lv[1]], nums, {}) + ' (Based on Character Level)'
  for (const [re, tpl, kind] of A.SKILL_PATTERNS) {
    const m = re.exec(shape)
    if (!m) continue
    if (kind === 'raw') return fillNums(tpl, nums, { S: m[1] })
    if (kind === 'class') {
      if (!A.CLASSES[m[1]]) continue
      return fillNums(tpl, nums, { C: A.CLASSES[m[1]] })
    }
    const S = m[1] == null ? '' : A.SKILLS[m[1]] || A.SKILL_TABS[m[1]]
    const C = m[2] == null ? '' : A.CLASSES[m[2]]
    if (S === undefined || C === undefined) continue
    return fillNums(tpl, nums, { S, C })
  }
  return null
}
export function affixText(text) {
  void dictVersion.value
  if (!text || locale.value === DEFAULT_LOCALE) return text
  const A = affixDicts[locale.value]
  if (!A) return text
  const key = locale.value + '|' + text
  if (!affixCache.has(key)) affixCache.set(key, translateAffix(String(text), A))
  return affixCache.get(key) ?? text
}

// 스킬 설명 (게임 문자열 키 skillsd6 등) - 지금 언어 문구, 없으면 null
export function skillDescText(key) {
  void dictVersion.value
  if (!key || locale.value === DEFAULT_LOCALE) return null
  const text = skillDescDicts[locale.value]?.[key]
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : null
}

// 템플릿에서 $t, $itemName 으로 바로 쓰게
export const i18nPlugin = {
  install(app) {
    app.config.globalProperties.$t = t
    app.config.globalProperties.$itemName = itemName
    app.config.globalProperties.$affix = affixText
    app.config.globalProperties.$locale = locale
  },
}
