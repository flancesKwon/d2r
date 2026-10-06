function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderInline(s) {
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>')
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>')
  s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>')
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
  return s
}

// 신뢰할 수 없는 사용자 입력을 렌더링하므로 HTML을 먼저 전부 escape한 뒤,
// 제한된 마크다운 패턴만 화이트리스트로 다시 태그로 바꾼다.
export function renderMarkdown(raw) {
  if (!raw) return ''
  const lines = escapeHtml(raw).split('\n')
  const out = []
  let inList = null // 'ul' | 'ol'

  for (const line of lines) {
    const listMatch = line.match(/^[-*]\s+(.*)$/)
    const olMatch = line.match(/^\d+\.\s+(.*)$/)
    const kind = listMatch ? 'ul' : olMatch ? 'ol' : null
    if (inList && inList !== kind) {
      out.push(`</${inList}>`)
      inList = null
    }
    if (kind) {
      if (!inList) {
        out.push(`<${kind}>`)
        inList = kind
      }
      out.push('<li>' + renderInline((listMatch || olMatch)[1]) + '</li>')
      continue
    }

    const headMatch = line.match(/^(#{2,3})\s+(.*)$/)
    if (headMatch) {
      const tag = headMatch[1].length === 2 ? 'h2' : 'h3'
      out.push(`<${tag}>${renderInline(headMatch[2])}</${tag}>`)
      continue
    }
    if (/^-{3,}$/.test(line.trim())) {
      out.push('<hr>')
      continue
    }

    const quoteMatch = line.match(/^&gt;\s?(.*)$/)
    if (quoteMatch) {
      out.push('<blockquote>' + renderInline(quoteMatch[1]) + '</blockquote>')
      continue
    }
    if (line.trim() === '') {
      out.push('<br>')
      continue
    }
    out.push('<p>' + renderInline(line) + '</p>')
  }
  if (inList) out.push(`</${inList}>`)
  return out.join('')
}
