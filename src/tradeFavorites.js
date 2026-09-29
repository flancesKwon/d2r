import { reactive, watch } from 'vue'
import { supabase } from './supabase.js'
import { authState, signIn } from './profileStore.js'

// 판매글 찜(별표) - tb_trade_favorite, 내 것만 보이고 내 것만 쓸 수 있음(RLS). 로그인해야 씀
export const favoritesState = reactive({ ids: new Set() })

async function loadFavorites(uid) {
  favoritesState.ids = new Set()
  if (!supabase || !uid) return
  const { data } = await supabase.from('tb_trade_favorite').select('post_id')
  favoritesState.ids = new Set((data || []).map((r) => r.post_id))
}
watch(() => authState.user?.id, loadFavorites, { immediate: true })

export function isFavorite(id) {
  return favoritesState.ids.has(Number(id))
}

export async function toggleFavorite(id) {
  if (!authState.user) return signIn()
  const postId = Number(id)
  const uid = authState.user.id
  const had = favoritesState.ids.has(postId)
  // 화면은 바로 바꾸고, 실패하면 되돌림 (돌아온 행이 없으면 실패)
  had ? favoritesState.ids.delete(postId) : favoritesState.ids.add(postId)
  const q = had
    ? supabase.from('tb_trade_favorite').delete().eq('user_id', uid).eq('post_id', postId).select('post_id')
    : supabase.from('tb_trade_favorite').insert({ user_id: uid, post_id: postId }).select('post_id')
  const { data, error } = await q
  if (error || !data?.length) had ? favoritesState.ids.add(postId) : favoritesState.ids.delete(postId)
}
