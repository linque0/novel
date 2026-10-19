/* 赤月戏 v3 接入：把设计稿里已确认的三张新背景转成应用 WebP。
 * 只写 src/assets/skins/crimson/{characters,world,inspiration}.webp，不碰业务代码。
 * 用法：node tools/crimson-art-import.mjs
 */
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync, writeFileSync, statSync } from 'node:fs'
import { createHash } from 'node:crypto'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const design = join(
  root,
  'docs/前端美化/oil-ui-v3-功能对齐/赤月剧场-书架方向对比/完整设计稿/金屏夜梅-重排设计稿-v3'
)
const outDir = join(root, 'src/assets/skins/crimson')

const items = [
  {
    module: '人物',
    src: join(design, '人物深化与设定重绘-v6/assets/characters-03-staggered-light-v6.png'),
    out: join(outDir, 'characters.webp')
  },
  {
    module: '设定',
    src: join(design, '人物深化与设定重绘-v6/assets/world-celestial-atlas-v6.png'),
    out: join(outDir, 'world.webp')
  },
  {
    module: '灵感',
    src: join(design, '赤月戏-人物与灵感-素材重绘-v3/inspiration-lantern-river-v3.png'),
    out: join(outDir, 'inspiration.webp')
  }
]

const sha = (buf) => createHash('sha256').update(buf).digest('hex')
const require = createRequire(import.meta.url)
const { chromium } = require(require.resolve('playwright', {
  paths: [join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node')]
}))

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage()
const report = []

for (const item of items) {
  const src = readFileSync(item.src)
  const b64 = src.toString('base64')
  const dataUrl = await page.evaluate(async ({ b64 }) => {
    const img = new Image()
    img.src = 'data:image/png;base64,' + b64
    await img.decode()
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0)
    return canvas.toDataURL('image/webp', 0.9)
  }, { b64 })
  const out = Buffer.from(dataUrl.split(',')[1], 'base64')
  writeFileSync(item.out, out)
  report.push({
    module: item.module,
    source: item.src.replace(root + '\\', '').replaceAll('\\', '/'),
    output: item.out.replace(root + '\\', '').replaceAll('\\', '/'),
    sourceBytes: src.length,
    sourceSha256: sha(src),
    outputBytes: out.length,
    outputSha256: sha(out)
  })
}

await browser.close()
console.log(JSON.stringify(report, null, 2))
