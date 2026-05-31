import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5180,
    // 配方 API（Starlette :2025）/ LangGraph server（:2024）反代，避免 CORS
    proxy: {
      '/api/recipes': { target: 'http://127.0.0.1:2025', changeOrigin: true, rewrite: p => p.replace(/^\/api/, '') },
      // LangGraph server（生成 agent，langgraph dev :2024）
      '/lg': { target: 'http://127.0.0.1:2024', changeOrigin: true, ws: true, rewrite: p => p.replace(/^\/lg/, '') },
    },
  },
})
