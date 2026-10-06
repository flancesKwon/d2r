// 글에 넣는 사진 올리기 - 올리기 전에 긴 변 1600px 로 줄이고 webp 로 바꿈 (움짤 gif 는 그대로)
// 저장 위치: post-images/<내 id>/<시간>-<랜덤>.<확장자>  (DB 정책상 내 폴더에만 올릴 수 있음)
import { supabase } from './supabase.js'
import { authState } from './profileStore.js'
import { IMAGE_BUCKET } from './richText.js'

const MAX_SIDE = 1600
const MAX_INPUT = 20 * 1024 * 1024
const MAX_OUTPUT = 5 * 1024 * 1024

async function shrink(file) {
  if (file.type === 'image/gif') return file
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * scale)
  c.height = Math.round(bmp.height * scale)
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height)
  bmp.close?.()
  const blob = await new Promise((r) => c.toBlob(r, 'image/webp', 0.85))
  // webp 로 못 만드는 브라우저(옛 사파리)는 png 가 나옴 -> jpeg 로
  if (blob && blob.type === 'image/webp') return blob
  return new Promise((r) => c.toBlob(r, 'image/jpeg', 0.86))
}

export async function uploadImage(file) {
  if (!supabase || !authState.user) throw new Error('로그인 필요')
  if (!file.type.startsWith('image/')) throw new Error('사진 파일만 첨부 가능')
  if (file.size > MAX_INPUT) throw new Error('20MB 이하 사진만 가능')
  const blob = await shrink(file)
  if (!blob) throw new Error('사진 변환 실패')
  if (blob.size > MAX_OUTPUT) throw new Error('5MB 이하 움짤만 가능')
  const ext = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/gif': 'gif' }[blob.type] || 'jpg'
  const path = `${authState.user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, blob, { contentType: blob.type, cacheControl: '31536000' })
  if (error) {
    if (/row-level security|policy/i.test(error.message)) throw new Error('사진 올리기 제한 (이용 정지 또는 1시간 60장 초과)')
    throw new Error(error.message || '사진 올리기 실패')
  }
  return supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl
}
