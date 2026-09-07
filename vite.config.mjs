import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)), // cwd 句柄失效时 npm/vite 找不到入口，显式锚定项目根
  base: './',
  plugins: [vue()],
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 4096
  }
})
