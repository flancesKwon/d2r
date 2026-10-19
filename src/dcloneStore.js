// 우버 디아(디아블로 클론) 진행 단계 (031 SQL) - 서버별 가장 최근 줄. 데이터는 d2runewizard 의 유저 제보 (Edge Function 이 1분마다 저장)
import { reactive } from 'vue'
import { supabase } from './supabase.js'

export const dcloneState = reactive({ rows: {}, loaded: false })

export const DCLONE_SOURCE = 'https://d2runewizard.com/diablo-clone-tracker'
export const DCLONE_MAX = 6

// 지역 (화면 이름 → d2runewizard 지역 이름). 서버 이름 = <레더><모드><지역>Rotw ('악마술사의 군림' 서버만 보여줌)
export const DCLONE_REGIONS = [
  { label: '아시아', key: 'Asia' },
  { label: '미주', key: 'Americas' },
  { label: '유럽', key: 'Europe' },
]
// 지역마다 4칸 (레더 여부 × 하드코어 여부)
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

// 지역별 4칸. 데이터가 없는 칸은 건너뛰고, 칸이 하나도 없는 지역은 뺌
export function dcloneRegions() {
  return DCLONE_REGIONS.map((r) => ({
    label: r.label,
    chips: DCLONE_KINDS.map((k) => ({
      ...k,
      row: dcloneState.rows[`${k.ladder ? 'ladder' : 'nonLadder'}${k.hardcore ? 'Hardcore' : 'Softcore'}${r.key}Rotw`],
    })).filter((c) => c.row),
  })).filter((r) => r.chips.length)
}
