import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3003,
    strictPort: true,
    open: false
  },
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          maplibre: ['maplibre-gl'],
          pdf: ['jspdf', 'qrcode'],
          icons: ['lucide-react']
        }
      }
    }
  }
})
