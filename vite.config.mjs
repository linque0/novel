import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import vue from '@vitejs/plugin-vue'

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)), // cwd 句柄失效时 npm/vite 找不到入口，显式锚定项目根
  base: './',
  plugins: [vue()],
  define: { __NS_PLUGIN__: JSON.stringify(false), __NS_VERSION__: JSON.stringify(version) },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 4096
  }
})
