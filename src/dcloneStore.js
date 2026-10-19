// 우버 디아(디아블로 클론) 진행 단계 (031 SQL) - 서버별 가장 최근 줄. 데이터는 d2runewizard 의 유저 제보 (Edge Function 이 1분마다 저장)
import { reactive } from 'vue'
import { supabase } from './supabase.js'
import { guessRealm, DEFAULT_GAME_VERSION } from './tradeStore.js'

export const dcloneState = reactive({ rows: {}, loaded: false })

export const DCLONE_SOURCE = 'https://d2runewizard.com/diablo-clone-tracker'
export const DCLONE_MAX = 6

const REGION = { 아시아: 'Asia', 미주: 'Americas', 유럽: 'Europe' }
// 보여주는 4칸 (레더 여부 × 하드코어 여부). d2runewizard 서버 이름 = <레더><모드><지역>[Rotw]
export const DCLONE_KINDS = [
  { label: '레더', ladder: true, hardcore: false },
  { label: '레더 하드코어', ladder: true, hardcore: true },
  { label: '논레더', ladder: false, hardcore: false },
  { label: '논레더 하드코어', ladder: false, hardcore: true },
]

export async function loadDclone() {
  if (!supabase) return
  const { data, error } = await supabase.from('v_dclone_latest').select('server, progress, reported_at')
  if (error) throw error
  dcloneState.rows = Object.fromEntries(data.map((r) => [r.server, r]))
  dcloneState.loaded = true
}

// 사이트가 기본으로 보는 서버(마지막에 고른 지역, 기본 모드 '악마술사의 군림')의 4칸. 데이터가 없는 칸은 건너뜀
export function dcloneChips() {
  if (DEFAULT_GAME_VERSION !== '악마술사의 군림') throw new Error('우버 디아 서버 이름은 악마술사의 군림(Rotw) 기준')
  const region = REGION[guessRealm()]
  return DCLONE_KINDS.map((k) => {
    const server = `${k.ladder ? 'ladder' : 'nonLadder'}${k.hardcore ? 'Hardcore' : 'Softcore'}${region}Rotw`
    return { ...k, row: dcloneState.rows[server] }
  }).filter((c) => c.row)
}
