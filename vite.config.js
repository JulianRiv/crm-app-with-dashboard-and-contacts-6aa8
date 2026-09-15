import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const API_PORT = process.env.API_PORT || 3001

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    strictPort: false,
    allowedHosts: true,
    // The client only ever calls relative /api paths, so the same code works
    // here behind the proxy and in production where node serves both.
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${API_PORT}`,
        changeOrigin: false
      }
    }
  },
  preview: { host: true, port: Number(process.env.PORT) || 3000, allowedHosts: true }
})
