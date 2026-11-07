import { defineConfig } from 'vite'
import react from '@vitejs/plugin-vue'

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  build: {
    outDir: mode === 'vercel' ? '../dist' : 'dist',
    emptyOutDir: mode === 'vercel',
  },
}))