// 스킬 설명 영어 (시뮬레이터 툴팁) - skill_text.json 의 문자열 키(skillsd6 등)로 D2R 영어 문구를 찾아 저장
//   node scripts/build-skill-desc-en.js <d2data json 폴더>
// 원본: https://github.com/blizzhackers/d2data (D2R) 의 json/allstrings-eng.json
// 결과: src/locales/skills.en.json { 문자열 키: 영어 문구 } - 영어 화면에서만 받음
import fs from 'fs'
import path from 'path'

const SRC = process.argv[2]
if (!SRC) throw new Error('usage: node scripts/build-skill-desc-en.js <d2data json dir>')
const eng = JSON.parse(fs.readFileSync(path.join(SRC, 'allstrings-eng.json'), 'utf8'))
const skillText = JSON.parse(fs.readFileSync(new URL('../src/data/skill_text.json', import.meta.url), 'utf8'))
// 게임 문자열 색 코드(ÿc4 등) 빼기
const clean = (s) => String(s).replace(/ÿc./g, '').replace(/\r/g, '').trim()
const out = {}
let miss = 0
for (const list of Object.values(skillText)) {
  for (const s of list) {
    for (const k of [s.keys?.short, s.keys?.long]) {
      if (!k) continue
      if (eng[k] != null) out[k] = clean(eng[k])
      else miss++
    }
  }
}
fs.writeFileSync(new URL('../src/locales/skills.en.json', import.meta.url), JSON.stringify(out))
console.log('strings', Object.keys(out).length, 'missing', miss)
