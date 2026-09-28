// 아이템 아이콘(src/assets/itemicons/<icon_key>.png) - 빌드 시 파일 경로(URL)만 번들에 들어가고
// 그림은 화면에 보일 때 따로 받음 (예전엔 icons.json에 base64로 통째로 들어가 첫 로딩이 1MB 늘었음)
const files = import.meta.glob('./assets/itemicons/*.png', { eager: true, query: '?url', import: 'default' })

export const ITEM_ICONS = {}
for (const [path, url] of Object.entries(files)) {
  ITEM_ICONS[path.slice(path.lastIndexOf('/') + 1, -'.png'.length)] = url
}

