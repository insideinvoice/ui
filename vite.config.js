import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // Local UI can be pointed at the deployed backend by setting
  // VITE_PROXY_TARGET (e.g. in .env.local). Requests stay same-origin in the
  // browser (localhost:5173/api -> proxied server-side), so no CORS involved.
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.VITE_PROXY_TARGET || 'http://localhost:8080'

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': { target: apiTarget, changeOrigin: true },
      },
      fs: { strict: false },
      middlewareMode: false,
    },
    appType: 'spa',
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom'],
            charts: ['recharts'],
            pdf: ['jspdf', 'html2canvas', 'qrcode.react'],
          }
        }
      }
    }
  }
})
