/* 同步品牌图标：把设计稿 docs/logo/faction-v5-six/02-sealed-codex 的成品
 * 复制成 electron-builder 读取的 build/icon.ico 与 build/icon.png。
 *
 * 历史上这里是用代码现画一个开卷占位图，成品视觉与品牌稿对不上；
 * 现改为以设计稿为唯一来源——别再改回画图，改图请改设计稿再跑本脚本。 */
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const srcDir = join(root, 'docs/logo/faction-v5-six/02-sealed-codex')
const outDir = join(root, 'build')

const SOURCES = [
  ['app-icon.ico', 'icon.ico'], // electron-builder win.icon（含 16–256 七档尺寸）
  ['app-icon-1024.png', 'icon.png'], // 备用/其他打包目标
]

mkdirSync(outDir, { recursive: true })

let copied = 0
for (const [from, to] of SOURCES) {
  const src = join(srcDir, from)
  if (!existsSync(src)) {
    console.error(`[icon] 缺少设计稿素材：${src}`)
    process.exitCode = 1
    continue
  }
  copyFileSync(src, join(outDir, to))
  console.log(`[icon] ${from} -> build/${to}`)
  copied++
}

if (copied === SOURCES.length) console.log('[icon] 品牌图标已同步自 02-sealed-codex 设计稿')
