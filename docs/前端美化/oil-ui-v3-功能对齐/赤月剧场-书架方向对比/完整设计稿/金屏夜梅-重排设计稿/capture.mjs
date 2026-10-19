/* 重排设计稿 v2 截图与验收：1440×900 基准 + 1080×900 窄窗 */
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { mkdirSync, writeFileSync } from 'node:fs'

const root = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const { chromium } = require(require.resolve('playwright', {
  paths: [join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node')]
}))
const states = ['shelf', 'editor', 'outline', 'outline-text', 'world', 'world-detail', 'characters', 'characters-graph', 'inspiration', 'settings']
const out = join(root, 'screenshots')
const narrowOut = join(out, 'narrow')
mkdirSync(out, { recursive: true })
mkdirSync(narrowOut, { recursive: true })
const browser = await chromium.launch({ channel: 'msedge', headless: true })

const measure = ({ state, width, errors }) => {
  const box = (s) => {
    const e = document.querySelector(s)
    if (!e) return null
    const r = e.getBoundingClientRect()
    return { l: Math.round(r.left), r: Math.round(r.right), w: Math.round(r.width), h: Math.round(r.height), t: Math.round(r.top) }
  }
  const tools = (s) => {
    const e = document.querySelector(s)
    if (!e) return null
    const r = e.getBoundingClientRect()
    return { l: Math.round(r.left), r: Math.round(r.right), w: Math.round(r.width), sw: e.scrollWidth, clipped: e.scrollWidth > e.clientWidth + 2 }
  }
  return {
    state,
    width,
    errors,
    overflow: document.documentElement.scrollWidth > innerWidth,
    broken: [...document.images].filter((x) => !x.complete || !x.naturalWidth).length,
    header: box('header'),
    nav: document.querySelectorAll('header .nav-item').length,
    tools: tools('.module-toolbar .tools'),
    projectActions: tools('.project-line .actions'),
    rail: !!document.querySelector('.nouveau-rail'),
    chapterRail: box('.c-chapter-rail'),
    chapterStrip: !!document.querySelector('.c-chapters'),
    chapterScroll: (() => { const e = document.querySelector('.c-rail-chapters'); return e ? { sh: e.scrollHeight, ch: e.clientHeight } : null })(),
    book: box('.c-book'),
    outline: box('.outline-layout'),
    canvas: box('.plot-canvas'),
    world: box('.world-layout'),
    lore: box('.lore-layout'),
    characters: box('.characters-layout'),
    portrait: box('.portrait-folio'),
    graph: box('.character-graph-layout'),
    inspiration: box('.inspiration-layout'),
    settings: box('.settings-layout'),
    preview: box('.preview-paper')
  }
}

const open = async (state, width) => {
  const page = await browser.newPage({ viewport: { width, height: 900 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(pathToFileURL(join(root, state + '.html')).href, { waitUntil: 'load' })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(1600)
  return { page, errors }
}

/* ── 1440×900：基准截图 + 章节栏交互 ─────────────────── */
const wide = []
for (const state of states) {
  const { page, errors } = await open(state, 1440)
  const m = await page.evaluate(measure, { state, width: 1440, errors })
  await page.screenshot({ path: join(out, state + '.png') })
  wide.push(m)
  console.log('1440', state, JSON.stringify({ errors: errors.length, overflow: m.overflow, broken: m.broken }))
  await page.close()
}

/* 正文章节目录：收起/恢复 + 搜索过滤（1440 演示） */
const editorPage = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await editorPage.goto(pathToFileURL(join(root, 'editor.html')).href, { waitUntil: 'load' })
await editorPage.evaluate(() => document.fonts.ready)
await editorPage.waitForTimeout(500)
const railOpen = await editorPage.evaluate(() => {
  const r = document.querySelector('.c-chapter-rail').getBoundingClientRect()
  const b = document.querySelector('.c-book').getBoundingClientRect()
  return { railW: Math.round(r.width), bookL: Math.round(b.left) }
})
await editorPage.click('.c-rail-toggle')
await editorPage.waitForTimeout(350)
const railCollapsed = await editorPage.evaluate(() => {
  const r = document.querySelector('.c-chapter-rail').getBoundingClientRect()
  const b = document.querySelector('.c-book').getBoundingClientRect()
  return { railW: Math.round(r.width), bookL: Math.round(b.left), toggle: document.querySelector('.c-rail-toggle').textContent }
})
await editorPage.click('[data-rail-next]')
await editorPage.waitForTimeout(200)
const miniNext = await editorPage.evaluate(() => ({
  mini: document.querySelector('[data-rail-current]').firstChild.nodeValue.trim(),
  current: document.querySelector('[data-chapter-list] .chapter.current')?.getAttribute('data-chapter'),
  title: document.querySelector('.chapter-title h1').textContent.trim()
}))
await editorPage.screenshot({ path: join(out, 'editor-collapsed.png') })
await editorPage.click('[data-rail-prev]')
await editorPage.waitForTimeout(200)
const miniPrev = await editorPage.evaluate(() => ({
  mini: document.querySelector('[data-rail-current]').firstChild.nodeValue.trim(),
  current: document.querySelector('[data-chapter-list] .chapter.current')?.getAttribute('data-chapter')
}))
await editorPage.click('.c-rail-toggle')
await editorPage.waitForTimeout(350)
const railRestored = await editorPage.evaluate(() => {
  const r = document.querySelector('.c-chapter-rail').getBoundingClientRect()
  return { railW: Math.round(r.width) }
})
await editorPage.fill('[data-chapter-search]', '领航员')
const searchHits = await editorPage.evaluate(() =>
  [...document.querySelectorAll('[data-chapter-list] [data-chapter]')].filter((b) => !b.hidden).length
)
await editorPage.fill('[data-chapter-search]', '')
const searchReset = await editorPage.evaluate(() =>
  [...document.querySelectorAll('[data-chapter-list] [data-chapter]')].filter((b) => !b.hidden).length
)
await editorPage.close()
const railInteractions = { railOpen, railCollapsed, railRestored, miniNext, miniPrev, searchHits, searchReset }

/* ── 1080×900：窄窗检查 + 截图 ────────────────────────── */
const narrow = []
for (const state of states) {
  const { page, errors } = await open(state, 1080)
  const m = await page.evaluate(measure, { state, width: 1080, errors })
  await page.screenshot({ path: join(narrowOut, state + '.png') })
  narrow.push(m)
  console.log('1080', state, JSON.stringify({ errors: errors.length, overflow: m.overflow, broken: m.broken }))
  await page.close()
}

/* 1080 章节栏收起 */
const narrowEditorPage = await browser.newPage({ viewport: { width: 1080, height: 900 } })
await narrowEditorPage.goto(pathToFileURL(join(root, 'editor.html')).href, { waitUntil: 'load' })
await narrowEditorPage.evaluate(() => document.fonts.ready)
await narrowEditorPage.waitForTimeout(500)
const narrowRailOpen = await narrowEditorPage.evaluate(() => {
  const r = document.querySelector('.c-chapter-rail').getBoundingClientRect()
  const b = document.querySelector('.c-book').getBoundingClientRect()
  return { railW: Math.round(r.width), bookL: Math.round(b.left), bookR: Math.round(b.right) }
})
await narrowEditorPage.click('.c-rail-toggle')
await narrowEditorPage.waitForTimeout(350)
const narrowRailCollapsed = await narrowEditorPage.evaluate(() => {
  const r = document.querySelector('.c-chapter-rail').getBoundingClientRect()
  const b = document.querySelector('.c-book').getBoundingClientRect()
  return { railW: Math.round(r.width), bookL: Math.round(b.left), bookR: Math.round(b.right) }
})
await narrowEditorPage.close()

await browser.close()
const report = { wide, narrow, railInteractions, narrowRail: { open: narrowRailOpen, collapsed: narrowRailCollapsed } }
writeFileSync(join(root, 'capture-report.json'), JSON.stringify(report, null, 2))

/* ── 硬性检查 ────────────────────────────────────────── */
const fail = []
const get = (list, state) => list.find((x) => x.state === state)
const shelf = get(wide, 'shelf')
if (shelf.rail) fail.push('shelf still has a left rail')
if (shelf.nav !== 7) fail.push('shelf nav is not seven items')
if (shelf.header?.h !== 76) fail.push('shelf header is not 76px')
const editor = get(wide, 'editor')
if (editor.chapterStrip) fail.push('editor still has a bottom chapter strip')
if (!editor.chapterRail) fail.push('editor chapter rail missing')
if (!(editor.chapterScroll?.sh > editor.chapterScroll?.ch)) fail.push('chapter rail does not scroll with many chapters')
if (!(editor.book?.h >= 670)) fail.push('editor book did not grow after removing the strip')
const outline = get(wide, 'outline')
if (!outline.canvas || outline.canvas.r < 1400) fail.push('outline canvas does not use the full width')
const graph = get(wide, 'characters-graph')
if (!graph.graph || graph.graph.l !== 32) fail.push('graph still reserves a left scenic column')
const characters = get(wide, 'characters')
if (characters.portrait?.w !== 380) fail.push('characters portrait column is not 380px')
const wideSettings = get(wide, 'settings')
if (!wideSettings.preview || wideSettings.preview.r > 1408) fail.push('1440: settings preview paper intrudes on the right margin')
if (!(wideSettings.preview?.h >= 600)) fail.push('1440: settings preview paper does not fill its column')
if (wide.some((x) => x.overflow || x.broken || x.errors.length)) fail.push('1440: overflow / broken image / runtime error found')
if (wide.some((x) => x.tools?.clipped || x.projectActions?.clipped)) fail.push('1440: module actions are clipped')

if (railInteractions.railOpen.railW !== 248) fail.push('1440: chapter rail is not 248px')
if (railInteractions.railOpen.bookL !== 296) fail.push('1440: book does not start after the chapter rail')
if (railInteractions.railCollapsed.railW !== 56) fail.push('1440: chapter rail does not collapse to 56px')
if (railInteractions.railCollapsed.bookL !== 104) fail.push('1440: book does not move left when the rail collapses')
if (railInteractions.railCollapsed.toggle !== '›') fail.push('1440: collapsed rail toggle does not point right')
if (railInteractions.railRestored.railW !== 248) fail.push('1440: chapter rail does not restore')
if (railInteractions.miniNext.mini !== '02' || railInteractions.miniNext.current !== '1') fail.push('1440: collapsed mini nav cannot reach the next chapter')
if (!railInteractions.miniNext.title.includes('领航员')) fail.push('1440: next chapter does not update the page title')
if (railInteractions.miniPrev.mini !== '01' || railInteractions.miniPrev.current !== '0') fail.push('1440: collapsed mini nav cannot return to the previous chapter')
if (railInteractions.searchHits !== 1) fail.push('1440: chapter search does not filter to one hit')
if (railInteractions.searchReset !== 24) fail.push('1440: chapter search does not restore all 24 chapters')

for (const x of narrow) {
  if (x.overflow) fail.push(`1080 ${x.state}: horizontal overflow`)
  if (x.broken) fail.push(`1080 ${x.state}: broken image`)
  if (x.errors.length) fail.push(`1080 ${x.state}: runtime error`)
  if (x.header?.h !== 76) fail.push(`1080 ${x.state}: header is not 76px`)
  if (x.nav !== 7) fail.push(`1080 ${x.state}: nav is not seven items`)
  if (x.tools?.clipped || x.projectActions?.clipped) fail.push(`1080 ${x.state}: module actions are clipped`)
  if (x.tools && x.tools.r > 1080 - 16) fail.push(`1080 ${x.state}: module actions exceed the right margin`)
}
const nShelf = get(narrow, 'shelf')
if (nShelf.rail) fail.push('1080 shelf still has a left rail')
const nEditor = get(narrow, 'editor')
if (!nEditor.chapterRail || nEditor.chapterRail.w !== 216) fail.push('1080 editor chapter rail is not 216px')
if (!(nEditor.chapterScroll?.sh > nEditor.chapterScroll?.ch)) fail.push('1080 chapter rail does not scroll')
if (!(nEditor.book?.h >= 670)) fail.push('1080 editor book is shorter than expected')
if (narrowRailOpen.railW !== 216 || narrowRailOpen.bookL !== 248) fail.push('1080: chapter rail / book geometry is wrong')
if (narrowRailCollapsed.railW !== 56 || narrowRailCollapsed.bookL !== 104) fail.push('1080: chapter rail does not collapse properly')
if (narrowRailCollapsed.bookR > 1080 - 16) fail.push('1080: book overflows when the rail collapses')
const nGraph = get(narrow, 'characters-graph')
if (!nGraph.graph || nGraph.graph.l !== 16) fail.push('1080 graph does not start at 16px')
const nOutline = get(narrow, 'outline')
if (!nOutline.canvas || nOutline.canvas.r < 1050) fail.push('1080 outline canvas does not fill the width')
const nSettings = get(narrow, 'settings')
if (!nSettings.settings || nSettings.settings.r > 1080 - 16) fail.push('1080 settings does not fit')
if (!nSettings.preview || nSettings.preview.r > 1080 - 16) fail.push('1080: settings preview paper overflows')
if (!(nSettings.preview?.h >= 600)) fail.push('1080: settings preview paper does not fill its column')

writeFileSync(join(root, 'capture-report.json'), JSON.stringify({ fail, report }, null, 2))
if (fail.length) {
  console.error('FAIL\n' + fail.join('\n'))
  process.exit(1)
}
console.log('PASS design v2 capture')
