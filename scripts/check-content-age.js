// 손으로 고치는 정보(래더·패치노트·시세 티어)가 오래됐는지 확인 - src/data/contentMeta.json 기준
// - 정한 날짜(maxDays)가 지났으면 경고 (CI 에서는 노란 경고, 실패는 아님)
// - json 파일을 고쳤는데 contentMeta 날짜를 안 바꿨으면 실패 (git 기록과 비교)
// 사용: node scripts/check-content-age.js
import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const meta = JSON.parse(fs.readFileSync(path.join(root, 'src/data/contentMeta.json'), 'utf8'))
const ci = !!process.env.GITHUB_ACTIONS
const today = new Date(new Date().toISOString().slice(0, 10))
let fail = 0
let stale = 0
let shallow = true
try {
  shallow = execSync('git rev-parse --is-shallow-repository', { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() !== 'false'
} catch (e) {}

for (const [key, m] of Object.entries(meta)) {
  if (key.startsWith('_')) continue
  if (!/^\d{4}-\d{2}-\d{2}$/.test(m.updated || '')) {
    console.log(`실패: ${key} 날짜 형식이 YYYY-MM-DD 가 아님 (${m.updated})`)
    fail++
    continue
  }
  const days = Math.floor((today - new Date(m.updated)) / 86400000)
  if (days > m.maxDays) {
    stale++
    const msg = `${m.label} 정보가 ${days}일 전 것 (기준 ${m.maxDays}일) - src/data/${m.file} 확인 후 contentMeta.json 날짜 갱신`
    console.log(ci ? `::warning::${msg}` : `경고: ${msg}`)
  }
  // 파일은 고쳤는데 날짜는 그대로인지 (얕은 clone 이면 기록이 없어서 건너뜀)
  let lastCommit = ''
  try {
    lastCommit = execSync(`git log -1 --format=%cs -- src/data/${m.file}`, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch (e) {}
  if (!shallow && lastCommit && lastCommit > m.updated) {
    console.log(`실패: src/data/${m.file} 를 ${lastCommit} 에 고쳤는데 contentMeta.json 의 ${key}.updated 는 ${m.updated}`)
    fail++
  }
}
console.log(fail ? `실패 ${fail}개` : stale ? `오래된 정보 ${stale}개 (경고)` : '정보 날짜 이상 없음')
process.exit(fail ? 1 : 0)
