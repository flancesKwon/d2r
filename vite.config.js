import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  base: './',
  build: {
    // 아이템·스킬·장비칸 아이콘은 작은 파일이라도 base64로 JS에 끼워넣지 않고 따로 받게 함
    // (끼워넣으면 시뮬레이터가 8개 직업 스킬 아이콘 240개를 한 번에 받아서 첫 로딩이 1MB 가까이 늘었음)
    assetsInlineLimit: (file) => (/\/(itemicons|skillicons|equipicons)\//.test(file) ? false : undefined),
  },
})
