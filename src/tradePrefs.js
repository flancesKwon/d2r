import { reactive, watch } from 'vue'
import { supabase } from './supabase.js'
import { authState } from './profileStore.js'
import { TRADE_REALMS, TRADE_LADDERS, TRADE_HARDCORE, GAME_VERSIONS } from './tradeStore.js'

// 거래 설정(서버·게임·레더·하드코어) - 검색 필터와 판매글 등록 기본값이 같이 씀. null = 고르지 않음(전체)
// 로그인하면 계정(tb_trade_pref)에 저장돼 다른 기기에서도 이어지고, 비로그인은 이 브라우저에만 저장
const KEY = 'd2r-trade-prefs'
const LISTS = { realm: TRADE_REALMS, game: GAME_VERSIONS, ladder: TRADE_LADDERS, hardcore: TRADE_HARDCORE }

const clean = (src) => Object.fromEntries(Object.entries(LISTS).map(([k, list]) => [k, list.includes(src?.[k]) ? src[k] : null]))

function readLocal() {
  try { return clean(JSON.parse(localStorage.getItem(KEY))) } catch { return clean(null) }
}

export const tradePrefs = reactive(readLocal())

let synced = JSON.stringify(clean(tradePrefs))

async function save(userId) {
  const json = JSON.stringify(clean(tradePrefs))
  if (json === synced) return
  synced = json
  const { error } = await supabase.from('tb_trade_pref').upsert({ user_id: userId, prefs: JSON.parse(json) })
  if (error) console.warn('거래 설정 저장 실패', error.message)
}

watch(tradePrefs, () => {
  try { localStorage.setItem(KEY, JSON.stringify(clean(tradePrefs))) } catch { /* 프라이빗 창 등 */ }
  if (authState.user && supabase) save(authState.user.id)
})

// 로그인하면 계정에 저장된 설정으로 바꿈 (저장된 게 없으면 지금 설정을 계정에 저장)
watch(() => authState.user?.id, async (id) => {
  if (!id || !supabase) return
  const { data, error } = await supabase.from('tb_trade_pref').select('prefs').eq('user_id', id).maybeSingle()
  if (error) return console.warn('거래 설정 불러오기 실패', error.message)
  if (!data) {
    synced = ''
    return save(id)
  }
  const saved = clean(data.prefs)
  synced = JSON.stringify(saved)
  Object.assign(tradePrefs, saved)
}, { immediate: true })
