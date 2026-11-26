import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // `@` → `src`, so components can be imported as `@/components/ui/...`.
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // Proxy API calls to the FastAPI backend during local development so the
    // frontend can call `/api/...` without hard-coding the backend origin.
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
})
