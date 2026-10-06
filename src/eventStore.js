// 이벤트 (024 SQL) - 매물 등록 이벤트
// 응모권: 이벤트 시간에 판매글을 올리면 DB가 tb_event_entry 에 자동 기록 (1인 최대 ticket_cap 장, 잡템·중복·운영진 글 제외)
// 추첨: 추첨 시각(draw_at)에 나오는 drand 공개 난수(누구도 미리 모름)로 DB가 뽑음 - d2r_event_draw
//   응모권(제외 안 된 것, 기록 순 번호) × SHA-256("난수:등수") 앞 6바이트 mod 남은 장수 → 당첨 번호, 당첨자 나머지 응모권 빼고 다음 등수
//   pickWinners() 가 같은 계산 - 이벤트 페이지 "직접 검증"에 씀
import { locale } from './i18n.js'
import { reactive } from 'vue'
import { supabase } from './supabase.js'

export const eventState = reactive({ current: null, loadedAt: 0 })

const mapEvent = (r) => r && {
  id: r.id, title: r.title, startsAt: r.starts_at, endsAt: r.ends_at, drawAt: r.draw_at, drandRound: r.drand_round,
  ticketCap: r.ticket_cap, prizes: Array.isArray(r.prizes) ? r.prizes : [], rules: r.rules || '', result: r.result || null,
}
const mapEntry = (r) => ({
  id: r.id, userId: r.user_id, postId: r.post_id, nickname: r.nickname || '알 수 없음', itemName: r.item_name, category: r.category,
  excluded: !!r.excluded, reason: r.excluded_reason || '', createdAt: r.created_at,
})

// ---- drand (League of Entropy 공개 난수, 30초마다 새 값) ----
export const DRAND_CHAIN = '8990e7a9aaed2ffed73dbd7092123d6f289930540d7651336225dc172e51b2ce'
const DRAND_GENESIS = 1595431050
const DRAND_PERIOD = 30
const DRAND_RELAYS = ['https://api.drand.sh', 'https://api2.drand.sh', 'https://api3.drand.sh', 'https://drand.cloudflare.com']
// 이 시각 이후 처음 나오는 라운드
export const drandRoundAt = (date) => Math.ceil((new Date(date).getTime() / 1000 - DRAND_GENESIS) / DRAND_PERIOD) + 1
export const drandTimeOf = (round) => new Date((DRAND_GENESIS + (round - 1) * DRAND_PERIOD) * 1000)
export const drandUrl = (round) => `${DRAND_RELAYS[0]}/${DRAND_CHAIN}/public/${round}`
export async function fetchDrand(round) {
  for (const base of DRAND_RELAYS) {
    try {
      const res = await fetch(`${base}/${DRAND_CHAIN}/public/${round}`, { cache: 'no-store' })
      if (!res.ok) continue
      const j = await res.json()
      if (j.round === round && /^[0-9a-f]{64}$/.test(j.randomness)) return j.randomness
    } catch { /* 다음 서버 */ }
  }
  throw new Error('drand 난수를 못 가져옴 - 아래에 직접 붙여넣기')
}

// ---- 이벤트 ----
export function phaseOf(ev, now = Date.now()) {
  if (!ev) return null
  if (ev.result) return 'announced'
  if (now < new Date(ev.startsAt).getTime()) return 'upcoming'
  if (now < new Date(ev.endsAt).getTime()) return 'live'
  if (now < new Date(ev.drawAt).getTime()) return 'review'
  return 'ready'
}
export const PHASE_KO = { upcoming: '시작 전', live: '진행 중', review: '종료 · 추첨 준비', ready: '추첨 대기', announced: '당첨 발표' }

// 진행 중 / 곧 시작 / 최근(7일 안에) 끝난 이벤트 하나 - 배너용 (1분 캐시)
export async function loadCurrentEvent(force = false) {
  if (!supabase) return null
  if (!force && Date.now() - eventState.loadedAt < 60000) return eventState.current
  eventState.loadedAt = Date.now()
  const since = new Date(Date.now() - 7 * 86400000).toISOString()
  const { data, error } = await supabase.from('tb_event').select('*').gte('ends_at', since).order('starts_at', { ascending: true }).limit(10)
  if (error) return eventState.current // 024 SQL 전이면 그냥 없음
  const list = (data || []).map(mapEvent)
  const now = Date.now()
  eventState.current = list.find((e) => phaseOf(e, now) === 'live')
    || list.find((e) => phaseOf(e, now) === 'upcoming')
    || [...list].reverse().find((e) => phaseOf(e, now) !== 'upcoming') || null
  return eventState.current
}
export async function fetchEvent(id) {
  const { data, error } = await supabase.from('tb_event').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return mapEvent(data)
}
export async function fetchEvents() {
  const { data, error } = await supabase.from('tb_event').select('*').order('starts_at', { ascending: false }).limit(30)
  if (error) throw error
  return (data || []).map(mapEvent)
}
export async function createEvent({ title, startsAt, endsAt, drawAt, ticketCap, prizes, rules }) {
  const { data, error } = await supabase.from('tb_event').insert({
    title, starts_at: startsAt, ends_at: endsAt, draw_at: drawAt, drand_round: drandRoundAt(drawAt),
    ticket_cap: ticketCap, prizes, rules: rules || null,
  }).select('*').single()
  if (error) throw error
  eventState.loadedAt = 0
  return mapEvent(data)
}
export async function updateEvent(id, patch) {
  const row = {}
  if ('title' in patch) row.title = patch.title
  if ('startsAt' in patch) row.starts_at = patch.startsAt
  if ('endsAt' in patch) row.ends_at = patch.endsAt
  if ('drawAt' in patch) { row.draw_at = patch.drawAt; row.drand_round = drandRoundAt(patch.drawAt) }
  if ('rules' in patch) row.rules = patch.rules || null
  const { data, error } = await supabase.from('tb_event').update(row).eq('id', id).select('*').single()
  if (error) throw error
  eventState.loadedAt = 0
  return mapEvent(data)
}
export async function deleteEvent(id) {
  const { data, error } = await supabase.from('tb_event').delete().eq('id', id).select('id')
  if (error) throw error
  if (!data?.length) throw new Error('삭제 안 됨 (추첨한 이벤트는 삭제 불가)')
  eventState.loadedAt = 0
}

// ---- 응모권 ----
export async function fetchEntries(eventId) {
  const { data, error } = await supabase.from('tb_event_entry').select('*').eq('event_id', eventId).order('id', { ascending: true }).limit(5000)
  if (error) throw error
  return (data || []).map(mapEntry)
}
export async function setEntryExcluded(entryId, excluded, reason = '') {
  const { data, error } = await supabase.from('tb_event_entry').update({ excluded, excluded_reason: excluded ? reason || '운영진 제외' : null }).eq('id', entryId).select('id')
  if (error) throw error
  if (!data?.length) throw new Error('수정 안 됨 (추첨 시각이 지나면 목록 고정)')
}
// 제외 안 된 응모권에 추첨 번호(1부터, 기록 순)를 붙임 - DB 추첨의 ticket_no 와 같음
export function numberTickets(entries) {
  let n = 0
  return entries.map((e) => ({ ...e, ticketNo: e.excluded ? null : ++n }))
}
// 응모자별 요약 [{ userId, nickname, tickets, entries }]
export function summarizeEntries(entries) {
  const m = new Map()
  for (const e of entries) {
    if (!m.has(e.userId)) m.set(e.userId, { userId: e.userId, nickname: e.nickname, tickets: 0, entries: [] })
    const u = m.get(e.userId)
    u.entries.push(e)
    if (!e.excluded) u.tickets++
  }
  return [...m.values()].sort((a, b) => b.tickets - a.tickets || a.nickname.localeCompare(b.nickname, 'ko'))
}

// ---- 추첨 ----
export async function drawEvent(id, randomness) {
  const { data, error } = await supabase.rpc('d2r_event_draw', { p_event_id: id, p_randomness: randomness })
  if (error) throw error
  eventState.loadedAt = 0
  return data
}
async function sha256Head6(text) {
  const buf = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))
  let v = 0n
  for (let i = 0; i < 6; i++) v = (v << 8n) | BigInt(buf[i])
  return v
}
// DB 의 d2r_event_pick 과 같은 계산 - 응모권 목록(entries: 기록 순, 제외 포함)과 난수로 당첨자
export async function pickWinners(entries, prizes, randomness) {
  let pool = entries.filter((e) => !e.excluded)
  const winners = []
  const sorted = [...prizes].sort((a, b) => (a.rank || 0) - (b.rank || 0))
  for (let k = 1; k <= sorted.length; k++) {
    if (!pool.length) break
    const idx = Number((await sha256Head6(`${randomness}:${k}`)) % BigInt(pool.length))
    const w = pool[idx]
    winners.push({ rank: k, label: sorted[k - 1].label, item: sorted[k - 1].item, user_id: w.userId, nickname: w.nickname, entry_id: w.id, ticket_no: idx + 1, tickets_left: pool.length })
    pool = pool.filter((e) => e.userId !== w.userId)
  }
  return winners
}

// ---- 표시 ----
export function fmtCountdown(ms) {
  if (ms <= 0) return '0:00'
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60
  const pad = (n) => String(n).padStart(2, '0')
  return h ? `${h}:${pad(m)}:${pad(ss)}` : `${m}:${pad(ss)}`
}
export function fmtEventTime(iso) {
  const d = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')
  const wd = (locale.value === 'ko' ? '일월화수목금토' : 'SMTWTFS')[d.getDay()]
  if (locale.value !== 'ko') return `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()]} ${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  return `${d.getMonth() + 1}/${d.getDate()}(${wd}) ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
