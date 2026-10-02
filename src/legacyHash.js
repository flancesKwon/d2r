// 예전 주소(#/items 처럼 #/ 가 붙은 것)로 들어오면 새 주소(/d2r/items)로 바꿈
// 라우터가 처음 주소를 읽기 전에 해야 해서 main.js 에서 가장 먼저 불러옴
if (window.location.hash.startsWith('#/')) {
  window.history.replaceState(null, '', import.meta.env.BASE_URL + window.location.hash.slice(2))
}
