<script setup>
// 사용자 프로필 사진 - 디스코드·구글 사진 / 사이트 준비 그림(preset:키) / 없으면 닉네임 첫 글자
// userId 를 주면 지금 접속 중일 때 오른쪽 아래에 초록 점 (src/presence.js)
import { computed } from 'vue'
import { avatarSrc, presetOf } from '../avatars.js'
import { isOnline } from '../presence.js'

const props = defineProps({
  src: { type: String, default: null },
  name: { type: String, default: '' },
  size: { type: Number, default: 28 },
  userId: { type: String, default: null },
})
const url = computed(() => avatarSrc(props.src))
// 아이템 그림은 작은 도트 그림이라 꽉 채우지 않고 가운데에
const isItem = computed(() => !!presetOf(props.src)?.item)
const online = computed(() => isOnline(props.userId))
const dotSize = computed(() => Math.max(7, Math.round(props.size * 0.28)))
</script>

<template>
  <span class="user-avatar-wrap" :style="{ width: size + 'px', height: size + 'px' }">
    <span class="user-avatar" :class="{ item: isItem }" :style="{ fontSize: Math.round(size * 0.45) + 'px' }" aria-hidden="true">
      <img v-if="url" :src="url" alt="" />
      <template v-else>{{ (name || '?').slice(0, 1) }}</template>
    </span>
    <span v-if="online" class="user-online-dot" :style="{ width: dotSize + 'px', height: dotSize + 'px' }" title="접속 중" aria-label="접속 중"></span>
  </span>
</template>

<style scoped>
.user-avatar-wrap{position:relative; display:inline-flex; flex:none;}
.user-avatar{width:100%; height:100%; border-radius:999px; overflow:hidden; display:inline-flex; align-items:center; justify-content:center; background:var(--panel-2); border:1px solid var(--border); color:var(--gold-dim); font-weight:700;}
.user-avatar img{width:100%; height:100%; object-fit:cover;}
.user-avatar.item img{width:72%; height:72%; object-fit:contain; image-rendering:pixelated;}
.user-online-dot{position:absolute; right:-1px; bottom:-1px; border-radius:999px; background:#3ecf5a; box-shadow:0 0 0 2px var(--bg, #191512);}
</style>
