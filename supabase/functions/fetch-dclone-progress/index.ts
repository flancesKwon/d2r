// 우버 디아(디아블로 클론) 진행 단계 가져오기 - d2runewizard API → tb_dclone_progress (031 SQL), 서버별로 바뀐 것만 한 줄씩 추가
// 배포: Supabase 대시보드 Edge Functions 에 이 파일을 붙여넣고, Cron 으로 1분마다 호출 (그쪽 규칙: 60초보다 자주 부르지 않기)
// 필요한 Secrets: D2R_CONTACT (연락 이메일, 공포의 영역 함수와 같은 값). SUPABASE_URL·SUPABASE_SERVICE_ROLE_KEY 는 Supabase 가 자동으로 넣어줌
// 이 키는 서버(Edge Function) 안에서만 씀 - 프론트에 넣지 않음
import { createClient } from 'npm:@supabase/supabase-js@2'

const API = 'https://d2runewizard.com/api/diablo-clone-progress/all'

Deno.serve(async () => {
  const contact = Deno.env.get('D2R_CONTACT')
  if (!contact) throw new Error('D2R_CONTACT 없음')
  const res = await fetch(API, {
    headers: { 'D2R-Contact': contact, 'D2R-Platform': 'Website', 'D2R-Repo': 'https://diahub.co.kr' },
  })
  if (!res.ok) throw new Error(`d2runewizard ${res.status}`)
  const { servers } = await res.json()
  if (!Array.isArray(servers) || !servers.length) throw new Error('서버 목록 없음')

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: latest, error: e1 } = await db.from('v_dclone_latest').select('server, progress, reported_at')
  if (e1) throw e1
  const known = new Map(latest.map((r) => [r.server, r]))

  const changed = servers
    .map((s) => ({ server: s.server, progress: s.progress, reported_at: new Date(s.lastUpdate.seconds * 1000).toISOString() }))
    .filter((s) => {
      const k = known.get(s.server)
      return !k || k.progress !== s.progress || new Date(k.reported_at).getTime() !== new Date(s.reported_at).getTime()
    })
  if (!changed.length) return new Response('unchanged')
  const { error } = await db.from('tb_dclone_progress').insert(changed)
  if (error) throw error
  return new Response(`ok ${changed.length}`)
})
