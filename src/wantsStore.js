// 삽니다 글 (027 SQL tb_trade_want) - "이 아이템을 이런 조건으로 삽니다"
// 조건이 맞는 판매글이 올라오면 DB가 글쓴이에게 알림을 보냄 (notify)
// 14일 동안 보이고, 끌어올리면(하루 한 번) 다시 14일
import { reactive } from 'vue'
import { supabase, mustReturnRows } from './supabase.js'
import { authState } from './profileStore.js'
import { statFilterByKey } from './tradeStore.js'

export const WANT_DAYS = 14
const WANT_MS = WANT_DAYS * 86400000
export const WANT_MAX_CONDS = 5
const WANT_AUTHOR = 'author:tb_profile!tb_trade_want_author_id_fkey(nickname, avatar_url)'

export const wantsState = reactive({ list: [], loaded: false, loading: false, error: '' })

export function mapWant(r) {
  return {
    id: r.id,
    authorId: r.author_id,
    author: r.author?.nickname || '알 수 없음',
    avatar: r.author?.avatar_url || null,
    itemId: r.item_id || null,
    itemName: r.item_name,
    category: r.category,
    realm: r.realm || null,
    ladder: r.ladder || null,
    hardcore: r.hardcore || null,
    gameVersion: r.game_version || null,
    ethereal: !!r.ethereal,
    conds: Array.isArray(r.conds) ? r.conds : [],
    price: r.price || '',
    memo: r.memo || '',
    notify: !!r.notify,
    bumpedAt: r.bumped_at,
    createdAt: r.created_at,
  }
}
export const wantEndsAt = (w) => new Date(w.bumpedAt).getTime() + WANT_MS
export const wantLeftMs = (w, now = Date.now()) => wantEndsAt(w) - now
// 끌어올리기는 하루에 한 번 (DB가 다시 확인)
export const canBumpWant = (w, now = Date.now()) => now - new Date(w.bumpedAt).getTime() >= 86400000

// 검색 조건(옵션 key + 범위) -> DB에 저장할 조건 (DB가 판매글 옵션 줄에 같은 정규식을 돌림)
export function condForDb(c) {
  const st = statFilterByKey(c.key)
  if (!st) return null
  return {
    key: st.key,
    label: st.label,
    pattern: st.pattern,
    numeric: st.numeric ?? /\((?!\?)/.test(st.pattern),
    agg: st.agg === 'max' ? 'max' : 'sum',
    min: c.min ?? null,
    max: c.max ?? null,
  }
}

function needUser() {
  if (!supabase) throw new Error('거래 서버 연결 실패')
  if (!authState.user) throw new Error('로그인 필요')
  return authState.user.id
}

// 목록 - 최근 14일 안의 글 (끌어올린 순)
export async function loadWants() {
  if (!supabase || wantsState.loading) return
  wantsState.loading = true
  wantsState.error = ''
  try {
    const since = new Date(Date.now() - WANT_MS).toISOString()
    const { data, error } = await supabase.from('tb_trade_want').select(`*, ${WANT_AUTHOR}`)
      .gt('bumped_at', since).order('bumped_at', { ascending: false }).limit(500)
    if (error) throw error
    wantsState.list = data.map(mapWant)
    wantsState.loaded = true
  } catch (e) {
    wantsState.error = e.message || '불러오기 실패'
  } finally {
    wantsState.loading = false
  }
}

// 아이템 하나를 구하는 글 수 (판매글 등록·매물 검색 화면에 "구하는 사람 N명")
export async function countWantsForItem(itemId) {
  if (!supabase || !itemId) return 0
  const since = new Date(Date.now() - WANT_MS).toISOString()
  const { count, error } = await supabase.from('tb_trade_want').select('id', { count: 'exact', head: true })
    .eq('item_id', itemId).gt('bumped_at', since)
  return error ? 0 : count || 0
}

export async function addWant(w) {
  const uid = needUser()
  const conds = (w.conds || []).map(condForDb).filter(Boolean).slice(0, WANT_MAX_CONDS)
  const rows = await mustReturnRows(
    supabase.from('tb_trade_want').insert({
      author_id: uid,
      item_id: w.itemId || null,
      item_name: w.itemName,
      category: w.category,
      realm: w.realm || null,
      ladder: w.ladder || null,
      hardcore: w.hardcore || null,
      game_version: w.gameVersion || null,
      ethereal: !!w.ethereal,
      conds,
      price: w.price || null,
      memo: w.memo || null,
      notify: w.notify !== false,
    }).select(`*, ${WANT_AUTHOR}`),
    '삽니다 글 등록 실패'
  )
  const want = mapWant(rows[0])
  wantsState.list.unshift(want)
  return want
}

async function patchWant(want, patch) {
  needUser()
  const rows = await mustReturnRows(
    supabase.from('tb_trade_want').update(patch).eq('id', want.id).select(`*, ${WANT_AUTHOR}`),
    '권한 없음'
  )
  const next = mapWant(rows[0])
  Object.assign(want, next)
  return want
}
export const setWantNotify = (want, on) => patchWant(want, { notify: !!on })
export async function bumpWant(want) {
  await patchWant(want, { bumped_at: new Date().toISOString() })
  wantsState.list.sort((a, b) => (a.bumpedAt < b.bumpedAt ? 1 : -1))
}
export async function deleteWant(want) {
  needUser()
  await mustReturnRows(supabase.from('tb_trade_want').delete().eq('id', want.id).select('id'), '권한 없음')
  wantsState.list = wantsState.list.filter((w) => w.id !== want.id)
}
