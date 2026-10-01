<script setup>
// 사용자 프로필 사진 - 디스코드·구글 사진 / 사이트 준비 그림(preset:키) / 없으면 닉네임 첫 글자
import { computed } from 'vue'
import { avatarSrc, presetOf } from '../avatars.js'

const props = defineProps({ src: { type: String, default: null }, name: { type: String, default: '' }, size: { type: Number, default: 28 } })
const url = computed(() => avatarSrc(props.src))
// 아이템 그림은 작은 도트 그림이라 꽉 채우지 않고 가운데에
const isItem = computed(() => !!presetOf(props.src)?.item)
</script>

<template>
  <span class="user-avatar" :class="{ item: isItem }" :style="{ width: size + 'px', height: size + 'px', fontSize: Math.round(size * 0.45) + 'px' }" aria-hidden="true">
    <img v-if="url" :src="url" alt="" />
    <template v-else>{{ (name || '?').slice(0, 1) }}</template>
  </span>
</template>

<style scoped>
.user-avatar{border-radius:999px; overflow:hidden; display:inline-flex; align-items:center; justify-content:center; flex:none; background:var(--panel-2); border:1px solid var(--border); color:var(--gold-dim); font-weight:700;}
.user-avatar img{width:100%; height:100%; object-fit:cover;}
.user-avatar.item img{width:72%; height:72%; object-fit:contain; image-rendering:pixelated;}
</style>
