import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5180,
    // 配方 API（Starlette :2025）/ LangGraph server（:2024）反代，避免 CORS
    proxy: {
      '/api/recipes': { target: 'http://127.0.0.1:2025', changeOrigin: true, rewrite: p => p.replace(/^\/api/, '') },
      // run 产物（slide_plan 缩略图 + 内嵌预览 index.html）
      '/api/runs': { target: 'http://127.0.0.1:2025', changeOrigin: true, rewrite: p => p.replace(/^\/api/, '') },
      // 资料抽取（上传 PDF/文本 → 文本）
      '/api/extract': { target: 'http://127.0.0.1:2025', changeOrigin: true, rewrite: p => p.replace(/^\/api/, '') },
      // 风格导入（上传图片 → 视觉模型识别 → 新 preset）
      '/api/styles': { target: 'http://127.0.0.1:2025', changeOrigin: true, rewrite: p => p.replace(/^\/api/, '') },
      // Skill 展示/下载独立页
      '/api/skill': { target: 'http://127.0.0.1:2025', changeOrigin: true, rewrite: p => p.replace(/^\/api/, '') },
      // LangGraph server（生成 agent，langgraph dev :2024）
      '/lg': { target: 'http://127.0.0.1:2024', changeOrigin: true, ws: true, rewrite: p => p.replace(/^\/lg/, '') },
    },
  },
})
