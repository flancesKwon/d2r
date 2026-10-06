// 해외에서 처음 들어온 사람(브라우저 언어가 한국어 아님)은 같은 페이지의 영어판(/en/...)으로
// 라우터가 주소를 읽기 전에 바꿔야 해서 main.js 맨 앞에서 불러옴 (legacyHash.js 처럼)
// KO/EN 버튼을 한 번이라도 누르면 그 선택을 따름, 로그인에서 돌아온 주소(?code=)·검색 봇은 그대로 - i18n.js autoLocaleFor
import { autoLocaleFor, withLocale } from './i18n.js'

const params = new URLSearchParams(window.location.search)
if (!params.has('code') && !params.has('error')) {
  const code = autoLocaleFor(window.location.pathname)
  if (code) {
    const { pathname, search, hash } = window.location
    window.history.replaceState(window.history.state, '', withLocale(pathname, code) + search + hash)
  }
}
