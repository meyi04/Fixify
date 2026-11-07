import { defineConfig } from 'vite'
import react from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
  },
})