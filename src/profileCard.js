// 프로필 카드 - 프로필 사진을 누르면 뜨는 작은 회원 정보 창 (components/UserProfileCard.vue 가 그림)
import { reactive } from 'vue'

export const profileCardState = reactive({ userId: null })
export function openProfileCard(userId) {
  if (userId) profileCardState.userId = userId
}
export function closeProfileCard() {
  profileCardState.userId = null
}
