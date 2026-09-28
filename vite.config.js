import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  base: './',
  build: {
    // 아이템 아이콘은 작은 파일이라도 base64로 JS에 끼워넣지 않고 따로 받게 함
    assetsInlineLimit: (file) => (file.includes('/itemicons/') ? false : undefined),
  },
})
