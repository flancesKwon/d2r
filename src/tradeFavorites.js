import { reactive } from 'vue'

// 트레더리의 즐겨찾기(watchlist)처럼, 관심 있는 판매글을 별표로 찜해두고 나중에
// 모아볼 수 있게 함. 백엔드가 없어서 계정 간 공유는 안 되고 이 브라우저에서만
// 유지되지만(localStorage), 그래도 "다시 보러 오기" 용도로는 충분히 쓸모 있음
const STORAGE_KEY = 'd2r-trade-favorites'

function loadFavorites() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export const favoritesState = reactive({
  ids: new Set(loadFavorites()),
})

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...favoritesState.ids]))
  } catch {
    // 프라이빗 창 등 localStorage를 못 쓰는 환경 - 이번 세션 안에서만 유지됨
  }
}

export function isFavorite(id) {
  return favoritesState.ids.has(id)
}

export function toggleFavorite(id) {
  if (favoritesState.ids.has(id)) favoritesState.ids.delete(id)
  else favoritesState.ids.add(id)
  persist()
}
