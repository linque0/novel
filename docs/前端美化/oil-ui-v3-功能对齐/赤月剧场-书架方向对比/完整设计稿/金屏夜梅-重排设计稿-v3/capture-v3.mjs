/* 折屏戏本 v3 截图与验收：1440 / 1080，含去框、对比度、交互、焦点与减少动画 */
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

const measure = ({ state }) => {
  const num = (v) => Math.round(parseFloat(v) || 0)
  const box = (s) => {
    const e = document.querySelector(s)
    if (!e) return null
    const r = e.getBoundingClientRect()
    return { l: Math.round(r.left), r: Math.round(r.right), w: Math.round(r.width), h: Math.round(r.height), t: Math.round(r.top), b: Math.round(r.bottom) }
  }
  const borders = (s) => {
    const e = document.querySelector(s)
    if (!e) return null
    const cs = getComputedStyle(e)
    return [cs.borderTopWidth, cs.borderRightWidth, cs.borderBottomWidth, cs.borderLeftWidth].map((v) => Math.round(parseFloat(v) || 0))
  }
  const style = (s, prop, pseudo) => {
    const e = document.querySelector(s)
    if (!e) return null
    return getComputedStyle(e, pseudo || null)[prop]
  }
  const tools = (s) => {
    const e = document.querySelector(s)
    if (!e) return null
    return { w: Math.round(e.getBoundingClientRect().width), sw: e.scrollWidth, r: Math.round(e.getBoundingClientRect().right), clipped: e.scrollWidth > e.clientWidth + 2 }
  }
  const canvas = box('.plot-canvas')
  const nodes = [...document.querySelectorAll('.plot-canvas .plot-node')].map((e) => {
    const r = e.getBoundingClientRect()
    return { l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top), b: Math.round(r.bottom) }
  })
  return {
    state,
    overflow: document.documentElement.scrollWidth > innerWidth,
    broken: [...document.images].filter((x) => !x.complete || !x.naturalWidth).length,
    header: box('header'),
    nav: document.querySelectorAll('header .nav-item').length,
    shelfRail: !!document.querySelector('.nouveau-rail'),
    chapterStrip: !!document.querySelector('.c-chapters'),
    chapterRail: box('.c-chapter-rail'),
    chapterScroll: (() => { const e = document.querySelector('.c-rail-chapters'); return e ? { sh: e.scrollHeight, ch: e.clientHeight } : null })(),
    book: box('.c-book'),
    canvas,
    nodes,
    nodeLines: style('.plot-lines', 'display'),
    outline: box('.outline-layout'),
    world: box('.world-layout'),
    lore: box('.lore-layout'),
    characters: box('.characters-layout'),
    portrait: box('.portrait-folio'),
    graph: box('.character-graph-layout'),
    inspiration: box('.inspiration-layout'),
    settings: box('.settings-layout'),
    preview: box('.preview-paper'),
    tools: tools('.module-toolbar .tools'),
    projectActions: tools('.project-line .actions'),
    surfaces: {
      book: borders('.c-book'),
      rail: borders('.c-chapter-rail'),
      paper: borders('.paper'),
      dossier: borders('.dossier'),
      worldPaper: borders('.world-paper'),
      lorePaper: borders('.lore-paper'),
      outlineFolio: borders('.outline-folio'),
      ideaReader: borders('.idea-reader'),
      settingsPaper: borders('.settings-paper'),
      graph: borders('.character-graph'),
      art: borders('.art-pane'),
      inspirationArt: borders('.inspiration-art'),
      directory: borders('.module-directory'),
      graphIndex: borders('.graph-index'),
      settingsCategories: borders('.settings-categories'),
      preview: borders('.preview-paper'),
      relationship: borders('.relationship'),
      plotContainer: borders('.plot-container'),
      ideaOutline: num(style('.idea-paper.current', 'outlineWidth')),
      pageBefore: style('.c-page', 'display', '::before'),
      marginAfter: style('.c-margin', 'display', '::after'),
      pageDogEar: style('.c-page', 'content', '::after'),
      railSeal: style('.c-rail-head .seal', 'backgroundColor'),
      castDisplay: style('.characters-layout .cast-tabs', 'display'),
      castCurrentBg: style('.characters-layout .cast-tabs > button.current', 'backgroundColor'),
      graphCastCurrentBg: style('.graph-index .cast-tabs > button.current', 'backgroundColor'),
      directoryTypesCurrentBg: style('.directory-types button.current', 'backgroundColor'),
      portraitNote: style('.portrait-note', 'display'),
      shelfChapterSeal: style('.nouveau-chapter h3', 'content', '::before')
    }
  }
}

const open = async (state, width, options = {}) => {
  const page = await browser.newPage({ viewport: { width, height: 900 }, ...options })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(pathToFileURL(join(root, state + '.html')).href, { waitUntil: 'load' })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(1600)
  return { page, errors }
}

const wide = []
for (const state of states) {
  const { page, errors } = await open(state, 1440)
  const m = await page.evaluate(measure, { state })
  m.errors = errors
  await page.screenshot({ path: join(out, state + '.png') })
  wide.push(m)
  console.log('1440', state, JSON.stringify({ errors: errors.length, overflow: m.overflow, broken: m.broken }))
  await page.close()
}

const narrow = []
for (const state of states) {
  const { page, errors } = await open(state, 1080)
  const m = await page.evaluate(measure, { state })
  m.errors = errors
  await page.screenshot({ path: join(narrowOut, state + '.png') })
  narrow.push(m)
  console.log('1080', state, JSON.stringify({ errors: errors.length, overflow: m.overflow, broken: m.broken }))
  await page.close()
}

/* 正文章节交互与收起态 */
const editorPage = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const editorErrors = []
editorPage.on('pageerror', (e) => editorErrors.push(e.message))
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
  const rail = document.querySelector('.c-chapter-rail')
  return {
    railW: Math.round(r.width),
    bookL: Math.round(b.left),
    progress: getComputedStyle(rail).getPropertyValue('--chapter-progress').trim(),
    ring: getComputedStyle(document.querySelector('.mini-current'), '::before').backgroundImage
  }
})
await editorPage.screenshot({ path: join(out, 'editor-collapsed.png') })
await editorPage.click('[data-rail-next]')
await editorPage.waitForTimeout(200)
const miniNext = await editorPage.evaluate(() => ({
  mini: document.querySelector('[data-rail-current]').firstChild.nodeValue.trim(),
  current: document.querySelector('[data-chapter-list] .chapter.current')?.getAttribute('data-chapter'),
  title: document.querySelector('.chapter-title h1').textContent.trim()
}))
await editorPage.click('[data-rail-prev]')
await editorPage.waitForTimeout(200)
const miniPrev = await editorPage.evaluate(() => ({
  mini: document.querySelector('[data-rail-current]').firstChild.nodeValue.trim(),
  current: document.querySelector('[data-chapter-list] .chapter.current')?.getAttribute('data-chapter')
}))
await editorPage.click('.c-rail-toggle')
await editorPage.waitForTimeout(300)
const railRestored = await editorPage.evaluate(() => ({
  railW: Math.round(document.querySelector('.c-chapter-rail').getBoundingClientRect().width)
}))
await editorPage.fill('[data-chapter-search]', '领航员')
const searchHits = await editorPage.evaluate(() =>
  [...document.querySelectorAll('[data-chapter-list] [data-chapter]')].filter((b) => !b.hidden).length
)
await editorPage.fill('[data-chapter-search]', '')
const searchReset = await editorPage.evaluate(() =>
  [...document.querySelectorAll('[data-chapter-list] [data-chapter]')].filter((b) => !b.hidden).length
)
await editorPage.close()

/* 1080 收起态 */
const narrowEditor = await browser.newPage({ viewport: { width: 1080, height: 900 } })
await narrowEditor.goto(pathToFileURL(join(root, 'editor.html')).href, { waitUntil: 'load' })
await narrowEditor.evaluate(() => document.fonts.ready)
await narrowEditor.waitForTimeout(500)
const narrowOpen = await narrowEditor.evaluate(() => {
  const r = document.querySelector('.c-chapter-rail').getBoundingClientRect()
  const b = document.querySelector('.c-book').getBoundingClientRect()
  return { railW: Math.round(r.width), bookL: Math.round(b.left), bookR: Math.round(b.right) }
})
await narrowEditor.click('.c-rail-toggle')
await narrowEditor.waitForTimeout(350)
const narrowCollapsed = await narrowEditor.evaluate(() => {
  const r = document.querySelector('.c-chapter-rail').getBoundingClientRect()
  const b = document.querySelector('.c-book').getBoundingClientRect()
  return { railW: Math.round(r.width), bookL: Math.round(b.left), bookR: Math.round(b.right) }
})
await narrowEditor.screenshot({ path: join(narrowOut, 'editor-collapsed.png') })
await narrowEditor.close()

/* 焦点 */
const focusPage = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await focusPage.goto(pathToFileURL(join(root, 'settings.html')).href, { waitUntil: 'load' })
await focusPage.waitForTimeout(300)
await focusPage.keyboard.press('Tab')
const focus = await focusPage.evaluate(() => {
  const el = document.activeElement
  const cs = getComputedStyle(el)
  return { tag: el.tagName, text: el.textContent.trim().slice(0, 12), outlineWidth: Math.round(parseFloat(cs.outlineWidth) || 0), outlineStyle: cs.outlineStyle, boxShadow: cs.boxShadow }
})
await focusPage.close()

/* 减少动画 */
const reducePage = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
await reducePage.goto(pathToFileURL(join(root, 'shelf.html')).href, { waitUntil: 'load' })
await reducePage.waitForTimeout(300)
const reduced = await reducePage.evaluate(() => {
  const el = document.querySelector('.nouveau-chapter')
  return {
    media: matchMedia('(prefers-reduced-motion: reduce)').matches,
    duration: getComputedStyle(el).animationDuration,
    transition: getComputedStyle(el).transitionDuration
  }
})
await reducePage.close()

await browser.close()

/* 对比度（token 层） */
const luminance = (hex) => {
  const n = parseInt(hex.slice(1), 16)
  const rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]
}
const contrast = (a, b) => {
  const la = luminance(a)
  const lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}
const contrasts = {
  body: contrast('#3c382b', '#eee5cc'),
  nav: contrast('#f0e7d5', '#151918'),
  goldOnInk: contrast('#cfb06b', '#151918'),
  sealText: contrast('#f4ecd9', '#a84135'),
  paperGold: contrast('#7a5f2c', '#eee5cc'),
  paperRed: contrast('#a84135', '#eee5cc'),
  relation: contrast('#6d4a3c', '#eee5cc')
}

const report = { wide, narrow, interactions: { railOpen, railCollapsed, railRestored, miniNext, miniPrev, searchHits, searchReset, editorErrors }, narrowRail: { open: narrowOpen, collapsed: narrowCollapsed }, focus, reduced, contrasts }
writeFileSync(join(root, 'capture-report.json'), JSON.stringify(report, null, 2))

const fail = []
const get = (list, state) => list.find((x) => x.state === state)
const both = [...wide, ...narrow]
if (both.some((x) => x.overflow || x.broken || x.errors.length)) fail.push('overflow / broken image / runtime error found')
if (both.some((x) => x.header?.h !== 76)) fail.push('header is not 76px')
if (both.some((x) => x.nav !== 7)) fail.push('nav is not seven items')
for (const x of both) {
  for (const [name, b] of Object.entries(x.surfaces)) {
    if (Array.isArray(b) && b.some((v) => v !== 0)) fail.push(`${x.state}: ${name} still has a border`)
  }
}
for (const x of both) {
  if (x.surfaces.pageBefore && x.surfaces.pageBefore !== 'none') fail.push(`${x.state}: page inner frame still visible`)
  if (x.surfaces.marginAfter && x.surfaces.marginAfter !== 'none') fail.push(`${x.state}: margin inner frame still visible`)
  if (x.surfaces.ideaOutline !== 0) fail.push(`${x.state}: idea current outline still visible`)
  if (x.surfaces.castCurrentBg && x.surfaces.castCurrentBg !== 'rgba(0, 0, 0, 0)') fail.push(`${x.state}: cast current still has a filled background`)
  if (x.surfaces.graphCastCurrentBg && x.surfaces.graphCastCurrentBg !== 'rgba(0, 0, 0, 0)') fail.push(`${x.state}: graph cast current still has a filled background`)
  if (x.surfaces.directoryTypesCurrentBg && x.surfaces.directoryTypesCurrentBg !== 'rgba(0, 0, 0, 0)') fail.push(`${x.state}: directory type current still has a filled background`)
  if (x.tools?.clipped || x.projectActions?.clipped) fail.push(`${x.state}: module actions are clipped`)
}
const shelf = get(wide, 'shelf')
if (shelf.shelfRail) fail.push('shelf still has a left rail')
if (shelf.surfaces.shelfChapterSeal !== '"续"') fail.push('shelf chapter ticket seal missing')
const editor = get(wide, 'editor')
if (editor.chapterStrip) fail.push('editor still has a bottom chapter strip')
if (!editor.chapterRail || !(editor.chapterScroll?.sh > editor.chapterScroll?.ch)) fail.push('editor chapter rail is not scrollable')
if (!(editor.book?.h >= 670)) fail.push('editor book did not grow')
if (editor.surfaces.pageDogEar === 'none') fail.push('editor page dog-ear missing')
if (editor.surfaces.railSeal !== 'rgb(168, 65, 53)') fail.push('editor rail seal is not vermilion')
const characters = get(wide, 'characters')
if (characters.portrait?.w !== 380) fail.push('characters portrait column is not 380px')
if (characters.surfaces.castDisplay !== 'flex') fail.push('characters cast is not a list')
if (characters.surfaces.portraitNote !== 'none') fail.push('characters decorative note still occupies space')
const settings = get(wide, 'settings')
if (!settings.preview || settings.preview.r > 1408 || !(settings.preview.h >= 600)) fail.push('settings sample sheet does not fit the column')
const outline = get(wide, 'outline')
if (!outline.canvas || outline.canvas.r < 1400) fail.push('outline canvas does not use the full width')
if (outline.nodes.length !== 6) fail.push('outline node count changed')
const graph = get(wide, 'characters-graph')
if (!graph.graph || graph.graph.l !== 32) fail.push('graph still reserves a left scenic column')
const narrowOutline = get(narrow, 'outline')
if (!narrowOutline.canvas || narrowOutline.nodes.some((n) => n.r > narrowOutline.canvas.r + 1)) fail.push('1080 outline nodes are clipped')
if (narrowOutline.nodeLines !== 'none') fail.push('1080 outline lines should be hidden when nodes reflow')
const narrowChars = get(narrow, 'characters')
if (narrowChars.portrait?.w !== 330) fail.push('1080 characters portrait column is not 330px')
const narrowSettings = get(narrow, 'settings')
if (!narrowSettings.preview || narrowSettings.preview.r > 1064) fail.push('1080 settings sample sheet overflows')

if (railOpen.railW !== 248 || railOpen.bookL !== 296) fail.push('editor rail/book geometry is wrong')
if (railCollapsed.railW !== 56 || railCollapsed.bookL !== 104) fail.push('editor rail does not collapse')
if (!(parseFloat(railCollapsed.progress) > 0)) fail.push('chapter progress ring is not set')
if (!railCollapsed.ring.includes('conic-gradient')) fail.push('chapter progress ring is missing')
if (railRestored.railW !== 248) fail.push('editor rail does not restore')
if (miniNext.mini !== '02' || miniNext.current !== '1' || !miniNext.title.includes('领航员')) fail.push('collapsed mini nav cannot reach the next chapter')
if (miniPrev.mini !== '01' || miniPrev.current !== '0') fail.push('collapsed mini nav cannot return')
if (searchHits !== 1 || searchReset !== 24) fail.push('chapter search does not filter/restore')
if (editorErrors.length) fail.push('editor interaction page errors: ' + editorErrors.join(' | '))
if (narrowOpen.railW !== 216 || narrowOpen.bookL !== 248) fail.push('1080 editor rail geometry is wrong')
if (narrowCollapsed.railW !== 56 || narrowCollapsed.bookL !== 104 || narrowCollapsed.bookR > 1064) fail.push('1080 editor collapse is wrong')
if (focus.outlineWidth < 2) fail.push('keyboard focus ring is missing')
if (!reduced.media || !(parseFloat(reduced.duration) < 0.01)) fail.push('reduced motion is not honored')
for (const [name, value] of Object.entries(contrasts)) {
  const min = name === 'sealText' ? 4.5 : name === 'paperGold' || name === 'paperRed' || name === 'relation' ? 4.5 : 7
  if (value < min) fail.push(`contrast ${name} is ${value.toFixed(2)} < ${min}`)
}

writeFileSync(join(root, 'capture-report.json'), JSON.stringify({ fail, report }, null, 2))
if (fail.length) {
  console.error('FAIL\n' + fail.join('\n'))
  process.exit(1)
}
console.log('PASS fold-screen v3')
