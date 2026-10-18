// 공포의 영역 가져오기 - d2runewizard API → tb_terror_zone (030 SQL)
// 배포: Supabase 대시보드 Edge Functions 에 이 파일을 붙여넣고, Cron 으로 1분마다 호출 (그쪽 규칙: 30초보다 자주 부르지 않기)
// 필요한 Secrets: D2R_CONTACT (연락 이메일). SUPABASE_URL·SUPABASE_SERVICE_ROLE_KEY 는 Supabase 가 자동으로 넣어줌
// 이 키는 서버(Edge Function) 안에서만 씀 - 프론트에 넣지 않음
import { createClient } from 'npm:@supabase/supabase-js@2'

const API = 'https://d2runewizard.com/api/trackers/terror-zone'

Deno.serve(async () => {
  const contact = Deno.env.get('D2R_CONTACT')
  if (!contact) throw new Error('D2R_CONTACT 없음')
  const res = await fetch(API, {
    headers: { 'D2R-Contact': contact, 'D2R-Platform': 'Website', 'D2R-Repo': 'https://diahub.co.kr' },
  })
  if (!res.ok) throw new Error(`d2runewizard ${res.status}`)
  const j = await res.json()
  const current = j?.currentTerrorZone?.zone
  if (!current) throw new Error('현재 구역 없음: ' + JSON.stringify(j))

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { error } = await db.from('tb_terror_zone').upsert({
    id: 1, current_zone: current, next_zone: j?.nextTerrorZone?.zone ?? null, fetched_at: new Date().toISOString(),
  })
  if (error) throw error
  return new Response('ok')
})
