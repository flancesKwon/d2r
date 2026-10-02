// 브라우저 기본 confirm·prompt·alert 대신 쓰는 사이트 모달 (화면은 components/AppDialog.vue)
// 문구가 "제목 - 설명" 이면 제목과 설명으로 나눠서 보여줌
//   if (!await askConfirm('글 삭제 - 되돌릴 수 없음')) return
//   const reason = await askPrompt('정지 - 사유 입력')   // 취소면 null
//   await showAlert('삭제 실패')
import { reactive } from 'vue'

export const dialogState = reactive({
  open: false,
  kind: 'confirm', // 'confirm' | 'prompt' | 'alert'
  title: '',
  message: '',
  confirmText: '확인',
  danger: false,
  value: '',
  placeholder: '',
  resolve: null,
})

// 되돌리기 어려운·부정적인 동작은 빨간 버튼
const DANGER = /삭제|거절|정지(?! 해제)|나가기|불발|취소|해제/
// 빨간 버튼 글자 (없으면 걸린 말 그대로: 삭제·거절·나가기·해제)
const BUTTON = { 불발: '거래불발', 취소: '취소하기', 정지: '정지하기' }

function split(text) {
  const s = String(text || '')
  const i = s.indexOf(' - ')
  return i > 0 ? [s.slice(0, i), s.slice(i + 3)] : [s, '']
}

function open(kind, text, opts = {}) {
  // 이미 열린 창이 있으면 취소로 닫고 새로
  if (dialogState.open && dialogState.resolve) dialogState.resolve(kind === 'prompt' ? null : false)
  const [title, message] = split(text)
  return new Promise((resolve) => {
    Object.assign(dialogState, {
      open: true,
      kind,
      title: opts.title || title,
      message: opts.message ?? message,
      confirmText: opts.confirmText || (kind !== 'alert' && DANGER.test(title) ? BUTTON[title.match(DANGER)[0]] || title.match(DANGER)[0] : '확인'),
      danger: opts.danger ?? (kind !== 'alert' && DANGER.test(title)),
      value: opts.value || '',
      placeholder: opts.placeholder || '',
      resolve,
    })
  })
}

export const askConfirm = (text, opts) => open('confirm', text, opts)
export const askPrompt = (text, opts) => open('prompt', text, opts)
export const showAlert = (text, opts) => open('alert', text, opts)

export function closeDialog(ok) {
  const { resolve, kind, value } = dialogState
  dialogState.open = false
  dialogState.resolve = null
  if (!resolve) return
  if (kind === 'prompt') resolve(ok ? value : null)
  else resolve(kind === 'alert' ? undefined : !!ok)
}
