import { reactive } from 'vue'

// 로그인 서버가 없어서 닉네임/연락처만 브라우저에 저장해두고, 판매글·게시글 작성 시
// 자동으로 채워주는 용도로 씀 - "내가 쓴 글"도 이 닉네임과 author가 일치하는 글을 찾는 방식
const STORAGE_KEY = 'd2r-profile'

function loadProfile() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return { nickname: parsed.nickname || '', contact: parsed.contact || '' }
    }
  } catch (e) {}
  return { nickname: '', contact: '' }
}

export const profileState = reactive(loadProfile())

export function saveProfile({ nickname, contact }) {
  profileState.nickname = (nickname || '').trim()
  profileState.contact = (contact || '').trim()
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ nickname: profileState.nickname, contact: profileState.contact }))
  } catch (e) {}
}
