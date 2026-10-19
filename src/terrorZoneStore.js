// 공포의 영역 (030 SQL) - 가장 최근 줄이 지금·다음 구역. 데이터는 d2runewizard (Edge Function 이 1분마다 저장)
import { reactive } from 'vue'
import { locale } from './i18n.js'
import { supabase } from './supabase.js'
import AREA_KO from './data/areaNames.json'

export const terrorZoneState = reactive({ current: '', next: '', loaded: false })

export const TERROR_ZONE_SOURCE = 'https://d2runewizard.com/terror-zone-tracker'

export async function loadTerrorZone() {
  if (!supabase) return
  const { data, error } = await supabase.from('tb_terror_zone').select('current_zone, next_zone').order('id', { ascending: false }).limit(1).maybeSingle()
  if (error) throw error
  terrorZoneState.loaded = true
  if (!data) return
  Object.assign(terrorZoneState, { current: data.current_zone, next: data.next_zone || '' })
}

// 구역 이름 영어 → 한국어 (사전에 없으면 영어 그대로).
// d2runewizard 철자가 게임 데이터와 달라서(Ancient's Way ↔ The Ancients' Way) 대소문자·아포스트로피·앞의 The를 무시하고 찾음
const areaKey = (name) => name.toLowerCase().replace(/['’]/g, '').replace(/^the /, '')
const AREA_BY_KEY = new Map(Object.entries(AREA_KO).map(([en, ko]) => [areaKey(en), ko]))
const koArea = (name) => AREA_BY_KEY.get(areaKey(name)) ?? name

// d2runewizard 는 구역이 둘이면 'A and B', 셋 이상이면 'A, B, and C' 로 보냄
// 'Dark Wood and Underground Passage' → 한국어면 '어둠숲, 지하 통로'
export function zoneText(zone) {
  if (locale.value !== 'ko') return zone
  return zone.split(/, and | and |, /).map(koArea).join(', ')
}
