import { defineConfig } from 'vite'
import base from './vite.config.mjs'

/* DSH 插件版独立构建目标：桌面版配置原样继承，只改产物目录并打开 __NS_PLUGIN__。 */
export default defineConfig({
  ...base,
  define: { ...(base.define || {}), __NS_PLUGIN__: JSON.stringify(true) },
  /* 插件版把 CSS 并成单文件并由 index.html 直接引用：dsh.css 已用 body[data-skin='dsh'] 作用域，
   * 属性落定前保持惰性，随手写进首屏可消除动态 chunk 到达时的 FOUC。 */
  build: { ...base.build, outDir: 'dist-plugin', cssCodeSplit: false }
})
