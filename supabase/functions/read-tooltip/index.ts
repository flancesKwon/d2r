// 툴팁 캡쳐 읽기 - 판매글 폼에서 올린 아이템 툴팁 이미지를 비전 모델로 읽어 JSON 으로 돌려줌 (038 SQL)
// 배포: Supabase 대시보드 Edge Functions 에 이 파일을 붙여넣고 배포 (JWT 검증 켜둔 채로)
// 필요한 Secrets: ANTHROPIC_API_KEY. SUPABASE_URL·SUPABASE_ANON_KEY·SUPABASE_SERVICE_ROLE_KEY 는 Supabase 가 자동으로 넣어줌
// 키는 서버(Edge Function) 안에서만 씀 - 프론트에 넣지 않음
import { createClient } from 'npm:@supabase/supabase-js@2'

const MODEL = 'claude-haiku-5-5'
const DAILY_LIMIT = 30
const MAX_IMAGE_BYTES = 3_000_000
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PROMPT = `디아블로 2 레저렉션 아이템 툴팁 캡쳐다. 툴팁에 보이는 글자를 그대로 옮겨 read_tooltip 도구로 답해라.
- name: 맨 윗줄 한 줄만. 아이템 이름이고, 괄호 안 영어 이름과 [ ] 기호는 뺀다. 아래 줄을 이어 붙이지 마라
- base_name: 둘째 줄(베이스 종류) 한 줄만. 없으면 null
- 룬워드는 셋째 줄에 룬 글자가 따옴표로 나온다(예: '자아이드베르'). name·base_name·lines 어디에도 넣지 마라
  예) 첫 줄 수수께끼, 둘째 줄 더스크 슈라우드, 셋째 줄 '자아이드베르' -> name 은 수수께끼, base_name 은 더스크 슈라우드
- ethereal: "무형 (수리 불가)"·"에테리얼"·"Ethereal" 줄이 있으면 true
- defense: "방어력: N" 의 N (없으면 null)
- damage_min, damage_max: "한손 피해"/"양손 피해"/"피해" 줄의 최소·최대 (없으면 null)
- durability_max: "내구도: 현재 / 최대" 의 최대 숫자 (없으면 null)
- sockets: "홈 있음 (N)"·"소켓 (N)"·"Socketed (N)" 의 N (없으면 null)
- lines: 위에 쓴 줄과 요구 능력치(필요/요구 힘·민첩·레벨)·룬 글자 줄·내구도 줄·무기 종류 줄("철퇴 계열 - 매우 빠른 공격 속도" 같은 것)·"무형 (수리 불가)"·"미확인"·"(암살자 전용)"만 있는 줄·맨 아래 "Ctrl + ..." 안내를 뺀 나머지 옵션 줄을 위에서 아래 순서로, 보이는 글자 그대로. 숫자와 부호(+, %, ~)를 바꾸지 마라.
툴팁이 없는 이미지면 found 를 false 로 하고 나머지는 비워라. 보이지 않는 글자를 추측해서 채우지 마라.`

const TOOL = {
  name: 'read_tooltip',
  description: '툴팁 읽은 결과',
  input_schema: {
    type: 'object',
    properties: {
      found: { type: 'boolean' },
      name: { type: 'string' },
      base_name: { type: ['string', 'null'] },
      ethereal: { type: 'boolean' },
      defense: { type: ['integer', 'null'] },
      damage_min: { type: ['integer', 'null'] },
      damage_max: { type: ['integer', 'null'] },
      durability_max: { type: ['integer', 'null'] },
      sockets: { type: ['integer', 'null'] },
      lines: { type: 'array', items: { type: 'string' } },
    },
    required: ['found', 'name', 'base_name', 'ethereal', 'defense', 'damage_min', 'damage_max', 'durability_max', 'sockets', 'lines'],
  },
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY 없음')

  const url = Deno.env.get('SUPABASE_URL')!
  const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data: { user } } = await asUser.auth.getUser()
  if (!user) return json({ error: '로그인 필요' }, 401)

  const { image, media_type } = await req.json()
  if (typeof image !== 'string' || !['image/jpeg', 'image/png'].includes(media_type)) return json({ error: '이미지 형식 오류' }, 400)
  if (image.length * 0.75 > MAX_IMAGE_BYTES) return json({ error: '이미지가 너무 큼' }, 413)

  // 실패해도 호출 한 번으로 셈 - 사용 기록을 먼저 남김
  const db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  const { count, error: e1 } = await db.from('tb_tooltip_scan').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', since)
  if (e1) throw e1
  if ((count ?? 0) >= DAILY_LIMIT) return json({ error: '하루 사용 횟수를 넘음' }, 429)
  const { error: e2 } = await db.from('tb_tooltip_scan').insert({ user_id: user.id })
  if (e2) throw e2

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      tools: [TOOL],
      tool_choice: { type: 'tool', name: TOOL.name },
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type, data: image } },
          { type: 'text', text: PROMPT },
        ],
      }],
    }),
  })
  if (!res.ok) throw new Error(`anthropic ${res.status}: ${await res.text()}`)
  const out = await res.json()
  const result = out.content?.find((c: { type: string }) => c.type === 'tool_use')?.input
  if (!result) throw new Error('응답에 결과 없음: ' + JSON.stringify(out))
  return json(result)
})
