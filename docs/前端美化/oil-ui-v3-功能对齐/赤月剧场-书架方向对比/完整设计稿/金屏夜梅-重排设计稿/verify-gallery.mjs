/* D6 验收：before-after 对照页与 v2 预览器 */
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { existsSync } from 'node:fs'

const root = dirname(fileURLToPath(import.meta.url))
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
await page.waitForTimeout(700)
const gallery = await page.evaluate(() => ({
  overflow: document.documentElement.scrollWidth > innerWidth,
  sections: document.querySelectorAll('.compare').length,
  shots: document.querySelectorAll('.compare .shots').length,
  figures: document.querySelectorAll('.compare figure').length,
  v2: document.querySelectorAll('.compare figure.v2').length,
  imgs: document.images.length,
  broken: [...document.images].filter((x) => !x.complete || !x.naturalWidth).map((x) => x.getAttribute('src')),
  emptyAlts: [...document.images].filter((x) => !x.getAttribute('alt')).length
}))
if (gallery.overflow) fail.push('before-after: horizontal overflow')
if (gallery.sections !== 10 || gallery.shots !== 10) fail.push('before-after: not ten state sections')
if (gallery.figures !== 20 || gallery.v2 !== 10) fail.push('before-after: not 10 v1 + 10 v2 figures')
if (gallery.imgs !== 20) fail.push('before-after: expected 20 screenshots')
if (gallery.broken.length) fail.push('before-after: broken images ' + gallery.broken.join(', '))
if (gallery.emptyAlts) fail.push('before-after: images without alt text')
if (errors.length) fail.push('before-after: page errors ' + errors.join(' | '))
await page.evaluate(() => window.scrollTo(0, 0))
await page.waitForTimeout(250)
await page.screenshot({ path: join(root, 'screenshots', 'compare-top.png') })
await page.locator('#editor').scrollIntoViewIfNeeded()
await page.waitForTimeout(350)
await page.screenshot({ path: join(root, 'screenshots', 'compare-editor.png') })

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
  hasMissingVideo: !!document.querySelector('a[href*="evidence/"]'),
  iframe: document.querySelector('iframe')?.getAttribute('src') || null,
  iframeState: document.querySelector('iframe')?.contentDocument?.body?.dataset?.state || null,
  broken: [...document.images].filter((x) => !x.complete || !x.naturalWidth).length,
  materials: document.querySelectorAll('#materials .material').length
}))
if (!view.title.includes('重排设计稿 v2')) fail.push('index: title is not v2')
if (!view.aside.includes('重排设计稿 v2')) fail.push('index: sidebar label is not v2')
if (view.overflow) fail.push('index: horizontal overflow')
if (!view.hasCompare) fail.push('index: before-after link missing')
if (view.hasMissingVideo) fail.push('index: stale evidence video link')
if (!view.iframe || !view.iframe.includes('editor.html')) fail.push('index: state iframe did not load')
if (view.broken) fail.push('index: broken images')
if (view.materials !== 7) fail.push('index: material board is not seven items')
if (viewerErrors.length) fail.push('index: page errors ' + viewerErrors.join(' | '))

/* 对照页 1080 窄窗 */
const compareNarrow = await browser.newPage({ viewport: { width: 1080, height: 900 } })
await compareNarrow.goto(pathToFileURL(join(root, 'before-after.html')).href, { waitUntil: 'load' })
await compareNarrow.waitForTimeout(400)
const galleryNarrow = await compareNarrow.evaluate(() => ({
  overflow: document.documentElement.scrollWidth > innerWidth,
  columns: getComputedStyle(document.querySelector('.shots')).gridTemplateColumns.split(' ').length,
  imgs: document.querySelectorAll('.compare img').length
}))
await compareNarrow.screenshot({ path: join(root, 'screenshots', 'compare-1080.png') })
await compareNarrow.close()
if (galleryNarrow.overflow) fail.push('before-after 1080: horizontal overflow')
if (galleryNarrow.imgs !== 20) fail.push('before-after 1080: screenshots missing')
if (galleryNarrow.columns !== 2) fail.push('before-after 1080: comparison should stay side by side')

/* 文件存在性 */for (const state of ['shelf', 'editor', 'outline', 'outline-text', 'world', 'world-detail', 'characters', 'characters-graph', 'inspiration', 'settings']) {
  if (!existsSync(join(root, 'screenshots', state + '.png'))) fail.push('missing v2 screenshot ' + state)
  if (!existsSync(join(root, 'screenshots', 'narrow', state + '.png'))) fail.push('missing narrow screenshot ' + state)
  if (!existsSync(join(root, '..', '金屏夜梅-完整设计稿', 'screenshots', state, 'page.png'))) fail.push('missing v1 screenshot ' + state)
}
for (const file of ['重排说明.md', 'before-after.html', 'capture-report.json', join('screenshots', 'editor-collapsed.png')]) {
  if (!existsSync(join(root, file))) fail.push('missing deliverable ' + file)
}

await browser.close()
console.log(JSON.stringify({ gallery, galleryNarrow, view }, null, 2))
if (fail.length) {
  console.error('FAIL\n' + fail.join('\n'))
  process.exit(1)
}
console.log('PASS design v2 gallery')
