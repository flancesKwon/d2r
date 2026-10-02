import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// 주소가 /d2r/trade/1 같은 일반 주소라 파일 경로도 절대 경로여야 함 (./ 면 /d2r/trade/assets/.. 로 깨짐)
// 배포(GitHub Pages)는 /d2r/, 개발 서버는 / (로그인 돌아올 주소 http://localhost:5173/ 그대로)
export default defineConfig(({ command }) => ({
  plugins: [vue()],
  base: command === 'build' ? '/d2r/' : '/',
  build: {
    // 아이템·스킬·장비칸 아이콘은 작은 파일이라도 base64로 JS에 끼워넣지 않고 따로 받게 함
    // (끼워넣으면 시뮬레이터가 8개 직업 스킬 아이콘 240개를 한 번에 받아서 첫 로딩이 1MB 가까이 늘었음)
    assetsInlineLimit: (file) => (/\/(itemicons|skillicons|equipicons)\//.test(file) ? false : undefined),
  },
}))
