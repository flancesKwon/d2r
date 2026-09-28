// 공속 계산기 점검: node scripts/check-ias.js
// - 모든 직업·모습·스킬·무기 조합이 표를 만들고, 공속이 오를수록 프레임이 줄기만 하는지
// - 몇 가지 조합은 Warren1001 IAS Calculator(D2R 3.3) 표와 같은지
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { IAS_CLASSES, IAS_SKILLS, skillsFor, weaponOk, canDual, offhandOk, iasTables, framesAvg } from '../src/iasCalc.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const W = JSON.parse(fs.readFileSync(path.join(root, 'src/data/iasWeapons.json'), 'utf8'))
const byEn = (n) => W.find((w) => w.en === n)
let fail = 0
const expect = (ok, msg) => { if (!ok) { fail++; console.log('실패:', msg) } }

let count = 0
for (const c of IAS_CLASSES) {
  for (const form of c.key === 'dru' ? ['human', 'wolf', 'bear'] : ['human']) {
    for (const s of skillsFor(c.key, form)) {
      const need = IAS_SKILLS.find((x) => x.key === s.key).dual === 'need'
      for (const w1 of [null, ...W]) {
        if (!weaponOk(c.key, form, s.key, w1)) continue
        let w2 = null
        if (need) {
          if (!canDual(c.key, form, s.key, w1)) continue
          w2 = W.find((w) => offhandOk(c.key, s.key, w1, w))
          if (!w2) continue
        }
        const r = iasTables({ cls: c.key, form, skill: s.key, w1, w2, buffs: {} })
        count++
        const label = `${c.key} ${form} ${s.key} ${w1?.en || '맨손'}`
        expect(r.tables.length > 0, label + ' 표 없음')
        for (const t of r.tables) {
          expect(t.rows.length > 0 && t.rows[0].ias === 0, label + ' 첫 줄이 0% 가 아님')
          for (let i = 1; i < t.rows.length; i++) {
            // 되감기 스킬(펜드·스트레이프)은 되감는 양이 달라져 타격별 프레임이 오르내릴 수 있어 제외
            if (typeof t.rows[i].frames === 'number') expect(t.rows[i].frames < t.rows[i - 1].frames, label + ' 공속이 올랐는데 느려짐')
            expect(t.rows.every((x) => [x.frames].flat().every((f) => Number.isFinite(f) && f > 0)), label + ' 프레임 값 이상')
          }
        }
      }
    }
  }
}

// Warren1001 IAS Calculator 3.3 와 맞춰본 값 (공속:프레임)
const rowsText = (o) => iasTables(o).tables[0].rows.map((r) => `${r.ias}:${[r.frames].flat().join('/')}`).join(' ')
const KNOWN = [
  [{ cls: 'pal', form: 'human', skill: 'zeal', w1: byEn('Phase Blade') }, '0:6/6/11 8:6/6/10 13:5/5/10 24:5/5/9 54:5/5/8 72:4/4/8'],
  [{ cls: 'dru', form: 'wolf', skill: 'fury', w1: null, buffs: { wolf: 1 } }, '0:7/7/6/6/11 5:6/6/5/5/10 19:6/6/5/5/9 30:5/6/5/5/9 39:5/5/5/5/9 42:5/5/5/5/8 48:5/5/4/4/8 86:5/5/4/4/7 95:4/5/4/4/7 142:4/4/4/4/7 194:4/4/4/4/6 304:4/4/3/3/6'],
  [{ cls: 'bar', form: 'human', skill: 'ww', w1: byEn('Colossus Blade'), w2: byEn('Phase Blade') }, '0:6 13:5 75:4'],
  [{ cls: 'bar', form: 'human', skill: 'frenzy', w1: byEn('Phase Blade'), w2: byEn('Phase Blade') }, '0:17 8:16 16:15 27:14 42:13 65:12 102:11 174:10'],
]
for (const [o, want] of KNOWN) expect(rowsText({ buffs: {}, ...o }) === want, `${o.cls} ${o.skill}: ${rowsText({ buffs: {}, ...o })} != ${want}`)

console.log(`조합 ${count}개 확인`, fail ? `실패 ${fail}` : '이상 없음')
process.exit(fail ? 1 : 0)
