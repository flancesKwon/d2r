// 이벤트 (024 SQL tb_event) - 매물 등록 이벤트의 응모권 계산·추첨
// 응모권: 이벤트 기간 안에 올린 판매글 중 "인정 매물" 1개당 1장, 1인 최대 ticket_cap 장
// 인정 안 되는 글 (자동): 삭제한 글(목록에 안 옴), 골드, 코 룬 미만 룬, 최상급이 아닌 보석,
//   같은 사람이 같은 아이템을 여러 번 올린 글(첫 글만), 운영진 글
// 매직·레어·일반 장비와 기타는 자동으로 인정하되 관리자 화면에서 "검토" 표시 - 관리자가 잡템이면 빼고 추첨
// 거래완료는 조건에 안 넣음 (부계정으로 자작 거래가 가능해서)
import { reactive } from 'vue'
import { supabase } from './supabase.js'
import { mapTradePost, POST_AUTHOR, getTradeItem, itemLevelReq } from './tradeStore.js'

export const MIN_RUNE_LEVEL = 39 // 코 룬 요구 레벨 - 이보다 낮은 룬은 잡템

export const eventState = reactive({ current: null, loadedAt: 0 })

const mapEvent = (r) => r && {
  id: r.id, title: r.title, startsAt: r.starts_at, endsAt: r.ends_at, ticketCap: r.ticket_cap,
  prizes: Array.isArray(r.prizes) ? r.prizes : [], rules: r.rules || '', result: r.result || null,
}

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
  // 진행 중 > 곧 시작(가장 빠른) > 최근 끝난(가장 최근)
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
export async function createEvent({ title, startsAt, endsAt, ticketCap, prizes, rules }) {
  const { data, error } = await supabase.from('tb_event').insert({
    title, starts_at: startsAt, ends_at: endsAt, ticket_cap: ticketCap, prizes, rules: rules || null,
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
  if ('ticketCap' in patch) row.ticket_cap = patch.ticketCap
  if ('prizes' in patch) row.prizes = patch.prizes
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
export async function saveEventResult(id, result) {
  const { error } = await supabase.rpc('d2r_event_save_result', { p_event_id: id, p_result: result })
  if (error) throw error
  eventState.loadedAt = 0
}

export function phaseOf(ev, now = Date.now()) {
  if (!ev) return null
  if (now < new Date(ev.startsAt).getTime()) return 'upcoming'
  if (now < new Date(ev.endsAt).getTime()) return 'live'
  return ev.result ? 'announced' : 'ended'
}

// 이벤트 기간에 올라온 판매글 (삭제한 글 빼고). authorId 를 주면 그 사람 글만
export async function fetchEventPosts(ev, authorId = null) {
  let q = supabase.from('tb_trade_post').select(`*, ${POST_AUTHOR}`)
    .gte('created_at', ev.startsAt).lt('created_at', ev.endsAt).is('deleted_at', null)
    .order('created_at', { ascending: true }).limit(2000)
  if (authorId) q = q.eq('author_id', authorId)
  const { data, error } = await q
  if (error) throw error
  return (data || []).map(mapTradePost)
}

// 글 하나가 자동으로 인정 안 되는 이유 (인정이면 '') / 관리자 검토가 필요한지
export function autoJudge(post) {
  if (post.category === '골드') return { reason: '골드' }
  const item = getTradeItem(post.itemId)
  if (item?.type_sub === '룬') {
    const lv = itemLevelReq(item)
    if (lv !== null && lv < MIN_RUNE_LEVEL) return { reason: '하급 룬 (코 룬 미만)' }
  }
  if (item?.category === 'gem' && item.type_sub !== '룬' && !/최상급/.test(item.name_ko || '')) return { reason: '최상급이 아닌 보석' }
  const review = post.category === '매직/레어/일반' || post.category === '기타'
  return { reason: '', review }
}

// 응모자 목록 - [{ userId, nickname, posts: [{ post, ok, reason, review, manual }], count, tickets }]
// overrides: { [postId]: true(인정) | false(제외) } - 관리자가 바꾼 것, staffIds: 운영진(응모 제외)
export function computeEntries(posts, ev, { overrides = {}, staffIds = new Set() } = {}) {
  const byUser = new Map()
  const seen = new Set()
  for (const post of posts) {
    let { reason, review } = autoJudge(post)
    const dupKey = `${post.authorId}|${post.category}|${(post.itemName || '').trim()}`
    if (!reason && seen.has(dupKey)) reason = '같은 매물 중복'
    seen.add(dupKey)
    if (staffIds.has(post.authorId)) reason = '운영진'
    const manual = post.id in overrides
    const ok = manual ? !!overrides[post.id] : !reason
    if (!byUser.has(post.authorId)) byUser.set(post.authorId, { userId: post.authorId, nickname: post.author, posts: [] })
    byUser.get(post.authorId).posts.push({ post, ok, reason: manual ? (ok ? '관리자 인정' : '관리자 제외') : reason, review: !!review, manual })
  }
  return [...byUser.values()].map((u) => {
    const count = u.posts.filter((x) => x.ok).length
    return { ...u, count, tickets: staffIds.has(u.userId) ? 0 : Math.min(count, ev.ticketCap) }
  }).sort((a, b) => b.tickets - a.tickets || a.nickname.localeCompare(b.nickname, 'ko'))
}

// 공정한 난수 (브라우저 암호 난수) 0 <= r < n
function randInt(n) {
  const buf = new Uint32Array(1)
  const limit = Math.floor(0x100000000 / n) * n
  do crypto.getRandomValues(buf); while (buf[0] >= limit)
  return buf[0] % n
}
// 응모권 수만큼 확률을 주고 상품 순서대로(1등부터) 한 명씩 뽑음 - 한 사람은 한 번만 당첨
export function drawWinners(entries, prizes, rand = randInt) {
  let pool = entries.filter((e) => e.tickets > 0)
  const winners = []
  for (const prize of [...prizes].sort((a, b) => (a.rank || 0) - (b.rank || 0))) {
    const total = pool.reduce((s, e) => s + e.tickets, 0)
    if (!total) break
    let r = rand(total)
    const w = pool.find((e) => (r -= e.tickets) < 0)
    winners.push({ rank: prize.rank, label: prize.label, item: prize.item, user_id: w.userId, nickname: w.nickname, tickets: w.tickets })
    pool = pool.filter((e) => e !== w)
  }
  return winners
}

// 남은 시간 "1:23:45" / "12:05"
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
  const wd = '일월화수목금토'[d.getDay()]
  return `${d.getMonth() + 1}/${d.getDate()}(${wd}) ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
