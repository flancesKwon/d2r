// 예전 주소로 들어오면 새 주소로 바꿈 - 라우터가 처음 주소를 읽기 전에 해야 해서 main.js 에서 가장 먼저 불러옴
//  - #/items 처럼 #/ 가 붙은 것 -> /items
//  - github.io 시절 경로 /d2r/items -> /items
const BASE = import.meta.env.BASE_URL
if (window.location.hash.startsWith('#/')) {
  window.history.replaceState(null, '', BASE + window.location.hash.slice(2))
} else if (/^\/d2r(\/|$)/.test(window.location.pathname)) {
  window.history.replaceState(null, '', BASE + window.location.pathname.replace(/^\/d2r\/?/, '') + window.location.search + window.location.hash)
}
