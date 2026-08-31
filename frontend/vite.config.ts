import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Proxy API calls to the FastAPI backend during local development so the
    // frontend can call `/api/...` without hard-coding the backend origin.
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
})
