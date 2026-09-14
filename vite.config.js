import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { host: true, port: 5173, strictPort: false, allowedHosts: true },
  preview: { host: true, port: Number(process.env.PORT) || 3000, allowedHosts: true }
})
