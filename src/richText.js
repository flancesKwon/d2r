// 글 본문 렌더링 - 새 글은 에디터가 만든 HTML, 예전 글은 마크다운
// 사용자 입력이므로 HTML 은 DOMPurify 로 허용 태그만 남기고, 이미지는 우리 저장소 주소만 허용
import DOMPurify from 'dompurify'
import { renderMarkdown } from './markdown.js'

export const IMAGE_BUCKET = 'post-images'
const IMAGE_PREFIX = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/${IMAGE_BUCKET}/`

const ALLOWED_TAGS = ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'del', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote', 'hr', 'a', 'img', 'code', 'pre']
const ALLOWED_ATTR = ['href', 'src', 'alt', 'target', 'rel', 'start']

let hooked = false
function addHooks() {
  if (hooked) return
  hooked = true
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A') {
      const href = node.getAttribute('href') || ''
      if (!/^https?:\/\//i.test(href) && !href.startsWith('/')) node.removeAttribute('href')
      node.setAttribute('target', '_blank')
      node.setAttribute('rel', 'noopener noreferrer nofollow')
    }
    if (node.tagName === 'IMG') {
      const src = node.getAttribute('src') || ''
      if (!src.startsWith(IMAGE_PREFIX)) node.remove()
      else node.setAttribute('loading', 'lazy')
    }
  })
}

export const isHtml = (raw) => /^\s*</.test(raw || '')

export function renderContent(raw) {
  if (!raw) return ''
  if (!isHtml(raw)) return renderMarkdown(raw)
  addHooks()
  return DOMPurify.sanitize(raw, { ALLOWED_TAGS, ALLOWED_ATTR: [...ALLOWED_ATTR, 'loading'] })
}

// 에디터에 넣을 HTML (예전 마크다운 글을 수정할 때 변환)
export const toEditorHtml = (raw) => renderContent(raw)

// 태그 뺀 글자만 (빈 글 확인 등)
export function plainText(raw) {
  if (!raw) return ''
  if (!isHtml(raw)) return raw
  const d = document.createElement('div')
  d.innerHTML = DOMPurify.sanitize(raw)
  return d.textContent || ''
}
