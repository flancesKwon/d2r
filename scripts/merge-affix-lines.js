// 게임 툴팁처럼 옵션 줄을 합치거나 숨김 (여러 번 돌려도 같은 결과)
//   node scripts/merge-affix-lines.js
// - 최소·최대 원소 피해가 둘 다 고정값으로 붙으면 한 줄: "냉기 피해 4-8 추가"
//   (fire / ltng / cold / mag -min·-max. 범위로 굴러가는 건 판매글에서 값을 따로 넣어야 해서 그대로 둠)
// - 독 피해 pois-min·pois-max·pois-len 은 한 줄: "3초 동안 독 피해 5-9 추가" (값 × 프레임 ÷ 256, 25프레임 = 1초)
// - 게임 툴팁에 안 나오는 값은 숨김(hidden): cold-len(냉기 지속), pois-len(독 지속 - 위 줄에 합쳐짐), fade(흐려지는 겉모습)
// - 대상 빙결은 2 이상이면 "대상 빙결 +N" (게임 표기)
// - 방어력: "방어력 증가 +N%", 추가 방어력 "방어력 +N"
// - 물리 피해: 인핸스드 데미지 -> "피해 증가 +N%", 최소·최대 공격력 -> "최소·최대 피해 +N" (둘 다 고정값이면 "피해 a-b 추가")
// - 세트 전체 보너스 문구 오류: 모든 저항(res-all)이 "화염 저항"으로, 악마술사 기술(war)이 "아마존 기술"로 적혀 있던 것
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/data/items.json')
const raw = fs.readFileSync(file, 'utf8')
const items = JSON.parse(raw)

const ELEM = { fire: '화염', ltng: '번개', cold: '냉기', mag: '마법' }
const fixed = (a) => a && a.min !== '' && a.min != null && String(a.min) === String(a.max)
const range = (a) => (String(a.min) === String(a.max) ? a.min : `${a.min}~${a.max}`)
const num = (v) => (v === '' || v == null ? NaN : Number(v))
let changed = 0

function fixList(list) {
  if (!list?.length) return
  const find = (p) => list.find((a) => a.prop === p)
  for (const [k, ko] of Object.entries(ELEM)) {
    const mn = find(k + '-min')
    const mx = find(k + '-max')
    if (mn && mx && fixed(mn) && fixed(mx)) {
      const text = `${ko} 피해 ${mn.min}-${mx.min} 추가`
      if (mn.text !== text || !mx.hidden) changed++
      mn.text = text
      mx.hidden = true
    }
  }
  const pmin = find('pois-min')
  const pmax = find('pois-max')
  const plen = find('pois-len')
  if (pmin && pmax && plen && fixed(pmin) && fixed(pmax) && fixed(plen)) {
    const len = Number(plen.min)
    const lo = Math.round((Number(pmin.min) * len) / 256)
    const hi = Math.round((Number(pmax.min) * len) / 256)
    const text = `${len / 25}초 동안 독 피해 ${lo === hi ? lo : `${lo}-${hi}`} 추가`
    if (pmin.text !== text || !pmax.hidden || !plen.hidden) changed++
    pmin.text = text
    pmax.hidden = true
    plen.hidden = true
  }
  // 물리 피해 문구: 인핸스드 데미지 -> 피해 증가, 최소·최대 공격력 -> 최소·최대 피해 (둘 다 고정값이면 한 줄)
  const setText = (a, text) => { if (a.text !== text) { a.text = text; changed++ } }
  const dmn = find('dmg-min')
  const dmx = find('dmg-max')
  const dmgPair = dmn && dmx && fixed(dmn) && fixed(dmx)
  if (dmgPair) {
    setText(dmn, `피해 ${dmn.min}-${dmx.min} 추가`)
    if (!dmx.hidden) { dmx.hidden = true; changed++ }
  }
  for (const a of list) {
    if (a.prop === 'dmg%') setText(a, `피해 증가 +${range(a)}%`)
    if (a.prop === 'dmg-min' && !dmgPair) setText(a, `최소 피해 +${range(a)}`)
    if (a.prop === 'dmg-max' && !dmgPair) setText(a, `최대 피해 +${range(a)}`)
    if (a.prop === 'dmg') setText(a, `피해 ${a.min}-${a.max} 추가`) // item_normaldamage: min 은 최소, max 는 최대 피해에 더함
  }
  for (const a of list) {
    if (['cold-len', 'fade'].includes(a.prop) && !a.hidden) { a.hidden = true; changed++ }
    if (a.prop === 'freeze' && Number(a.max) > 1 && a.text !== `대상 빙결 +${a.max}`) { a.text = `대상 빙결 +${a.max}`; changed++ }
    if (a.prop === 'res-all' && a.text.startsWith('화염 저항')) { a.text = a.text.replace('화염 저항', '모든 저항'); changed++ }
    if (a.prop === 'war' && a.text.startsWith('아마존 기술')) { a.text = a.text.replace('아마존 기술', '악마술사 기술'); changed++ }
  }
}

for (const it of items) {
  fixList(it.affixes)
  const e = it.extra || {}
  fixList(e.set_full_bonus)
  for (const g of e.set_partial_bonus || []) fixList(g.affixes)
  for (const g of e.set_item_bonus || []) fixList(g.affixes)
}
// 룬 소켓 옵션(in_weapon 등)·무작위 옵션 묶음처럼 다른 곳에 있는 피해 증가 문구도
;(function walk(o) {
  if (Array.isArray(o)) return o.forEach(walk)
  if (!o || typeof o !== 'object') return
  if (o.prop === 'dmg%' && typeof o.text === 'string') {
    const text = `피해 증가 +${range(o)}%`
    if (o.text !== text) { o.text = text; changed++ }
  }
  if (typeof o.text === 'string' && o.text.includes('인핸스드 데미지')) { o.text = o.text.replaceAll('인핸스드 데미지', '피해 증가'); changed++ }
  // 방어력: "방어력 N% 증가" -> "방어력 증가 +N%", 추가 방어력은 "방어력 +N" (범위여도 + 붙임)
  const set = (text) => { if (o.text !== text) { o.text = text; changed++ } }
  if (o.prop === 'ac%' && typeof o.text === 'string' && num(o.min) >= 0) set(`방어력 증가 +${range(o)}%`)
  if (o.prop === 'ac' && typeof o.text === 'string' && num(o.min) >= 0 && o.min !== '') set(`방어력 +${range(o)}`)
  // 레벨당 방어력인데 par 없이 min 에 값이 있는 것 (잎새: 16 -> 레벨당 +2)
  if (o.prop === 'ac/lvl' && o.par == null && o.min !== '' && o.min != null) set(`캐릭터 레벨당 방어력 +${num(o.min) / 8}`)
  // "힘 20~30", "모든 저항 10~20%", "투창과 창 기술 1~3" 처럼 이름 뒤 숫자로 끝나는 더하기 옵션은 + 를 붙여 통일
  // (문장으로 된 "적중당 생명력 6% 훔침"·"피해 3 감소" 는 그대로, 감속은 더하기가 아니라 뺌)
  if (o.prop && o.prop !== 'slow' && typeof o.text === 'string' && !(num(o.min) < 0)) {
    const m = o.text.match(/^(.*\S) (\d+(?:\.\d+)?(?:~\d+(?:\.\d+)?)?%?)$/)
    if (m && !/[+-]\d/.test(o.text)) set(`${m[1]} +${m[2]}`)
  }
  Object.values(o).forEach(walk)
})(items)
fs.writeFileSync(file, JSON.stringify(items) + (raw.endsWith('\n') ? '\n' : ''))
console.log('바뀐 줄', changed)
