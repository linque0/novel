/* 折屏戏本 v3：v2↔v3 对照页与 v3 预览器验收 */
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { existsSync } from 'node:fs'

const root = dirname(fileURLToPath(import.meta.url))
const v2 = join(root, '..', '金屏夜梅-重排设计稿')
const require = createRequire(import.meta.url)
const { chromium } = require(require.resolve('playwright', {
  paths: [join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node')]
}))
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const fail = []

/* 对照页 */
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
await page.goto(pathToFileURL(join(root, 'before-after.html')).href, { waitUntil: 'load' })
await page.evaluate(() => document.fonts.ready)
await page.evaluate(() => document.querySelectorAll('img').forEach((img) => { img.loading = 'eager' }))
await page.evaluate(async () => {
  for (let y = 0; y < document.body.scrollHeight; y += 800) {
    window.scrollTo(0, y)
    await new Promise((r) => setTimeout(r, 80))
  }
  window.scrollTo(0, document.body.scrollHeight)
})
await page.waitForTimeout(800)
const gallery = await page.evaluate(() => ({
  overflow: document.documentElement.scrollWidth > innerWidth,
  sections: document.querySelectorAll('.compare').length,
  figures: document.querySelectorAll('.compare figure').length,
  v3: document.querySelectorAll('.compare figure.v3').length,
  imgs: document.images.length,
  broken: [...document.images].filter((x) => !x.complete || !x.naturalWidth).map((x) => x.getAttribute('src')),
  emptyAlts: [...document.images].filter((x) => !x.getAttribute('alt')).length,
  v2Links: [...document.images].filter((x) => (x.getAttribute('src') || '').includes('金屏夜梅-重排设计稿')).length
}))
if (gallery.overflow) fail.push('before-after: horizontal overflow')
if (gallery.sections !== 10) fail.push('before-after: not ten state sections')
if (gallery.figures !== 20 || gallery.v3 !== 10) fail.push('before-after: not 10 v2 + 10 v3 figures')
if (gallery.imgs !== 20) fail.push('before-after: expected 20 screenshots')
if (gallery.v2Links !== 10) fail.push('before-after: v2 screenshots are not linked')
if (gallery.broken.length) fail.push('before-after: broken images ' + gallery.broken.join(', '))
if (gallery.emptyAlts) fail.push('before-after: images without alt text')
if (errors.length) fail.push('before-after: page errors ' + errors.join(' | '))
await page.evaluate(() => window.scrollTo(0, 0))
await page.waitForTimeout(250)
await page.screenshot({ path: join(root, 'screenshots', 'compare-top.png') })
await page.locator('#editor').scrollIntoViewIfNeeded()
await page.waitForTimeout(350)
await page.screenshot({ path: join(root, 'screenshots', 'compare-editor.png') })

/* 1080 对照 */
const narrow = await browser.newPage({ viewport: { width: 1080, height: 900 } })
await narrow.goto(pathToFileURL(join(root, 'before-after.html')).href, { waitUntil: 'load' })
await narrow.waitForTimeout(400)
const galleryNarrow = await narrow.evaluate(() => ({
  overflow: document.documentElement.scrollWidth > innerWidth,
  columns: getComputedStyle(document.querySelector('.shots')).gridTemplateColumns.split(' ').length,
  imgs: document.querySelectorAll('.compare img').length
}))
await narrow.screenshot({ path: join(root, 'screenshots', 'compare-1080.png') })
await narrow.close()
if (galleryNarrow.overflow) fail.push('before-after 1080: horizontal overflow')
if (galleryNarrow.imgs !== 20) fail.push('before-after 1080: screenshots missing')
if (galleryNarrow.columns !== 2) fail.push('before-after 1080: comparison should stay side by side')

/* 预览器 */
const viewer = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
const viewerErrors = []
viewer.on('pageerror', (e) => viewerErrors.push(e.message))
await viewer.goto(pathToFileURL(join(root, 'index.html')).href, { waitUntil: 'load' })
await viewer.waitForTimeout(1200)
const view = await viewer.evaluate(() => ({
  title: document.title,
  overflow: document.documentElement.scrollWidth > innerWidth,
  aside: document.querySelector('aside p')?.textContent || '',
  hasCompare: !!document.querySelector('a[href="before-after.html"]'),
  hasV2: !!document.querySelector('a[href="../金屏夜梅-重排设计稿/index.html"]'),
  hasMissingVideo: !!document.querySelector('a[href*="evidence/"]'),
  iframe: document.querySelector('iframe')?.getAttribute('src') || null,
  broken: [...document.images].filter((x) => !x.complete || !x.naturalWidth).length,
  materials: document.querySelectorAll('#materials .material').length
}))
if (!view.title.includes('折屏戏本 v3')) fail.push('index: title is not v3')
if (!view.aside.includes('折屏戏本 v3')) fail.push('index: sidebar label is not v3')
if (view.overflow) fail.push('index: horizontal overflow')
if (!view.hasCompare || !view.hasV2) fail.push('index: comparison links missing')
if (view.hasMissingVideo) fail.push('index: stale evidence video link')
if (!view.iframe || !view.iframe.includes('editor.html')) fail.push('index: state iframe did not load')
if (view.broken) fail.push('index: broken images')
if (view.materials !== 7) fail.push('index: material board is not seven items')
if (viewerErrors.length) fail.push('index: page errors ' + viewerErrors.join(' | '))

/* 文件存在性 */
for (const state of ['shelf', 'editor', 'outline', 'outline-text', 'world', 'world-detail', 'characters', 'characters-graph', 'inspiration', 'settings']) {
  if (!existsSync(join(root, 'screenshots', state + '.png'))) fail.push('missing v3 screenshot ' + state)
  if (!existsSync(join(root, 'screenshots', 'narrow', state + '.png'))) fail.push('missing v3 narrow screenshot ' + state)
  if (!existsSync(join(v2, 'screenshots', state + '.png'))) fail.push('missing v2 screenshot ' + state)
}
for (const file of ['视觉升级说明.md', '重排说明.md', 'before-after.html', 'capture-report.json', join('screenshots', 'editor-collapsed.png')]) {
  if (!existsSync(join(root, file))) fail.push('missing deliverable ' + file)
}

await browser.close()
console.log(JSON.stringify({ gallery, galleryNarrow, view }, null, 2))
if (fail.length) {
  console.error('FAIL\n' + fail.join('\n'))
  process.exit(1)
}
console.log('PASS fold-screen v3 gallery')
