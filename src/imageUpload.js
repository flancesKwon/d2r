// 글·댓글 이미지 올리기 - Supabase Storage 버킷 community-images (supabase/010_community_images.sql)
// - 큰 사진은 브라우저에서 가로세로 1600px 안으로 줄이고 webp 로 바꿔서 올림 (버킷 한도 2MB)
// - gif 는 움직임이 깨지니 그대로 (2MB 넘으면 거절)
// - 경로는 <내 uuid>/<시각>-<난수>.<확장자> (내 폴더에만 올릴 수 있음 - DB 정책)
import { supabase } from './supabase.js'
import { authState } from './profileStore.js'

export const IMAGE_BUCKET = 'community-images'
const MAX_BYTES = 2 * 1024 * 1024
const MAX_SIDE = 1600
const ACCEPT = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']

// 마크다운에서 이미지로 그려줄 주소 (이 버킷의 공개 주소만 - 다른 사이트 이미지는 링크로만)
export const IMAGE_URL_PREFIX = `${import.meta.env.VITE_SUPABASE_URL || ''}/storage/v1/object/public/${IMAGE_BUCKET}/`

async function shrink(file) {
  if (file.type === 'image/gif') return file
  let bitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch (e) {
    throw new Error('이미지를 읽을 수 없음')
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  // 이미 작고 가벼우면 그대로
  if (scale === 1 && file.size <= 600 * 1024) return file
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close?.()
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.85))
  return blob ? new File([blob], 'image.webp', { type: 'image/webp' }) : file
}

export async function uploadImage(file) {
  if (!supabase) throw new Error('서버 연결 안 됨')
  if (!authState.user) throw new Error('로그인 필요')
  if (!ACCEPT.includes(file.type)) throw new Error('png·jpg·webp·gif 만 가능')
  const ready = await shrink(file)
  if (ready.size > MAX_BYTES) throw new Error('2MB 이하만 가능')
  const ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' }[ready.type]
  const path = `${authState.user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, ready, { contentType: ready.type, cacheControl: '31536000' })
  if (error) {
    const msg = error.message || ''
    if (/bucket not found/i.test(msg)) throw new Error('이미지 올리기 준비 중')
    if (/row-level security|unauthorized|403/i.test(msg)) throw new Error('지금은 올릴 수 없음 (정지 또는 1시간 30장 초과)')
    if (/too large|size/i.test(msg)) throw new Error('2MB 이하만 가능')
    throw new Error('이미지를 올리지 못함')
  }
  return supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl
}
