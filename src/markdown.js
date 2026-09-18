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
  let inList = false

  for (const line of lines) {
    const listMatch = line.match(/^[-*]\s+(.*)$/)
    if (listMatch) {
      if (!inList) {
        out.push('<ul>')
        inList = true
      }
      out.push('<li>' + renderInline(listMatch[1]) + '</li>')
      continue
    }
    if (inList) {
      out.push('</ul>')
      inList = false
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
  if (inList) out.push('</ul>')
  return out.join('')
}
