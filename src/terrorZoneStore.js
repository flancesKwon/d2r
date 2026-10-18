// 공포의 영역 (030 SQL) - 지금·다음 구역. 데이터는 d2runewizard (Edge Function 이 1분마다 저장)
import { reactive } from 'vue'
import { locale } from './i18n.js'
import { supabase } from './supabase.js'
import AREA_KO from './data/areaNames.json'

export const terrorZoneState = reactive({ current: '', next: '', fetchedAt: null, loaded: false })

export const TERROR_ZONE_SOURCE = 'https://d2runewizard.com/terror-zone-tracker'

export async function loadTerrorZone() {
  if (!supabase) return
  const { data, error } = await supabase.from('tb_terror_zone').select('*').eq('id', 1).maybeSingle()
  if (error) throw error
  terrorZoneState.loaded = true
  if (!data) return
  Object.assign(terrorZoneState, { current: data.current_zone, next: data.next_zone || '', fetchedAt: data.fetched_at })
}

// 'Dark Wood and Underground Passage' → 한국어면 '어둠숲, 지하 통로' (사전에 없는 이름은 영어 그대로)
export function zoneText(zone) {
  if (locale.value !== 'ko') return zone
  return zone.split(' and ').map((a) => AREA_KO[a] || a).join(', ')
}
