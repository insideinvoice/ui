import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:8080', changeOrigin: true },
    },
    fs: { strict: false },
    middlewareMode: false,
  },
  appType: 'spa',
  build: {
    // Route-level splitting is done with React.lazy; Vite's default chunking
    // keeps shared deps out of the entry graph (no eager modulepreload of heavy
    // vendor chunks), so the first paint only downloads index + CSS.
    chunkSizeWarningLimit: 900,
  },
})
