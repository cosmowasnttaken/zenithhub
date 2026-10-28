import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5173,
    proxy: {
      '/proxy': { target: 'http://localhost:3001', changeOrigin: true },
      '/raw':   { target: 'http://localhost:3001', changeOrigin: true },
    }
  },
  build: { outDir: 'dist' }
})
