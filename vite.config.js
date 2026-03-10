import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
  },
  preview: {
    allowedHosts: 'all',
  },
  server: {
    allowedHosts: 'all',
    proxy: {
      '/api': 'http://localhost:3001'
    }
  }
})
