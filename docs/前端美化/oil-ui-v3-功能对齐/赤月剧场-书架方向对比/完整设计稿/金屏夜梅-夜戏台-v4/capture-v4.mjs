/* 夜戏台 v4 截图与验收
   1440 / 1080 各 10 屏；去框、交叠、满屏舞台、动效、焦点、减少动画与 1080 重排。 */
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
  const el = (s) => document.querySelector(s)
  const box = (s) => {
    const e = el(s)
    if (!e) return null
    const r = e.getBoundingClientRect()
    return { l: Math.round(r.left), r: Math.round(r.right), w: Math.round(r.width), h: Math.round(r.height), t: Math.round(r.top), b: Math.round(r.bottom) }
  }
  const borders = (s) => {
    const e = el(s)
    if (!e) return null
    const cs = getComputedStyle(e)
    return [cs.borderTopWidth, cs.borderRightWidth, cs.borderBottomWidth, cs.borderLeftWidth].map((v) => Math.round(parseFloat(v) || 0))
  }
  const bg = (s) => {
    const e = el(s)
    if (!e) return null
    const cs = getComputedStyle(e)
    return { color: cs.backgroundColor, image: cs.backgroundImage }
  }
  const style = (s, prop, pseudo) => {
    const e = el(s)
    return e ? getComputedStyle(e, pseudo || null)[prop] : null
  }
  const tools = (s) => {
    const e = el(s)
    if (!e) return null
    return { w: Math.round(e.getBoundingClientRect().width), sw: e.scrollWidth, r: Math.round(e.getBoundingClientRect().right), clipped: e.scrollWidth > e.clientWidth + 2 }
  }
  const overlap = (a, b) => {
    if (!a || !b) return 0
    const w = Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l))
    const h = Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t))
    return Math.round(w * h)
  }
  const hardShadow = (s) => {
    const e = el(s)
    if (!e) return null
    const sh = getComputedStyle(e).boxShadow
    if (!sh || sh === 'none') return false
    return sh.split(/,(?![^()]*\))/).some((part) => {
      if (part.includes('inset')) return false
      const m = part.match(/(-?[\d.]+)px\s+(-?[\d.]+)px\s+(-?[\d.]+)px(?:\s+(-?[\d.]+)px)?/)
      if (!m) return false
      const [x, y, blur, spread] = [+m[1], +m[2], +m[3], +(m[4] || 0)]
      return (x !== 0 || y !== 0) && blur === 0 && spread === 0
    })
  }
  const sceneSelector = state === 'editor' ? '.c-stage' : state === 'shelf' ? '.frame' : '.scene'
  const book = box('.c-book')
  const canvas = box('.plot-canvas')
  const nodes = [...document.querySelectorAll('.plot-canvas .plot-node')].map((e) => {
    const r = e.getBoundingClientRect()
    return { l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top), b: Math.round(r.bottom) }
  })
  const portrait = box('.portrait-folio')
  const dossier = box('.dossier')
  const paper = box('.settings-paper')
  const preview = box('.preview-paper')
  const papers = box('.idea-papers')
  const reader = box('.idea-reader')
  const worldPaper = box('.world-paper')
  const worldArt = box('.art-pane')
  const lorePaper = box('.lore-paper')
  const loreArt = box('.lore-paper') ? box('.art-pane') : null
  return {
    state,
    overflow: document.documentElement.scrollWidth > innerWidth,
    broken: [...document.images].filter((x) => !x.complete || !x.naturalWidth).length,
    header: box('header'),
    footer: box('.studio-footer'),
    headerBg: bg('header'),
    footerBg: bg('.studio-footer'),
    nav: document.querySelectorAll('header .nav-item').length,
    scene: box(sceneSelector),
    toolbar: box('.module-toolbar'),
    contentTop: state === 'editor' ? (book && book.t) : state === 'shelf' ? (box('.nouveau-toolbar')?.t ?? null) : (box('.outline-layout, .world-layout, .lore-layout, .characters-layout, .character-graph-layout, .inspiration-layout, .settings-layout')?.t ?? null),
    book,
    rail: box('.c-chapter-rail'),
    page: box('.c-page'),
    margin: box('.c-margin'),
    chapterScroll: (() => { const e = el('.c-rail-chapters'); return e ? { sh: e.scrollHeight, ch: e.clientHeight } : null })(),
    canvas,
    nodes,
    nodeLines: style('.plot-lines', 'display'),
    nodeViewBox: el('.plot-lines')?.getAttribute('viewBox') || null,
    nodePathLength: el('.plot-lines path')?.getAttribute('d')?.length || 0,
    settings: {
      paper, preview, layout: box('.settings-layout'),
      previewOverlap: overlap(paper, preview),
      categories: bg('.settings-categories'),
      activeWriting: style('.settings-categories > button.current b', 'writingMode'),
      activeBg: style('.settings-categories > button.current', 'backgroundImage')
    },
    characters: {
      portrait, dossier, layout: box('.characters-layout'), overlap: overlap(portrait, dossier),
      cast: box('.cast-tabs'), castDisplay: style('.cast-tabs', 'display'), castH: box('.cast-tabs')?.h ?? null,
      castCurrentBg: style('.cast-tabs > button.current', 'backgroundColor')
    },
    inspiration: {
      papers, reader, art: box('.inspiration-art'), overlap: overlap(reader, papers),
      layout: box('.inspiration-layout')
    },
    world: {
      paper: worldPaper, art: worldArt, index: box('.world-index'), indexBg: bg('.world-index'),
      overlap: overlap(worldPaper, worldArt), layout: box('.world-layout')
    },
    lore: {
      paper: lorePaper, art: loreArt, connections: box('.lore-connections'), connectionsBg: bg('.lore-connections'),
      overlap: overlap(lorePaper, loreArt), layout: box('.lore-layout')
    },
    graph: {
      layout: box('.character-graph-layout'), canvas: box('.character-graph'),
      canvasBg: bg('.character-graph'), indexBg: bg('.graph-index'),
      pathAnimation: style('.character-graph > svg path', 'animationName')
    },
    shelf: {
      frame: box('.frame'), toolbar: box('.nouveau-toolbar'), program: box('.nouveau-program'),
      programBg: bg('.nouveau-program'), rows: document.querySelectorAll('.work-row').length,
      chapter: box('.nouveau-chapter'), cover: box('.nouveau-book-stage'),
      chapterOverlap: overlap(box('.nouveau-chapter'), box('.nouveau-book-stage')),
      chapterSeal: style('.nouveau-chapter h3', 'content', '::before')
    },
    mark: {
      exists: !!el('.v4-scene-mark'), position: style('.v4-scene-mark', 'position'),
      display: style('.v4-scene-mark', 'display'), host: el('.v4-scene-mark')?.parentElement?.className || null
    },
    navActive: {
      bg: style('.nav-item.active', 'backgroundImage'),
      transform: style('.nav-item.active', 'transform'),
      color: style('.nav-item.active', 'color')
    },
    directoryCurrent: (() => {
      const d = el('.module-directory'); const c = el('.directory-entry.current')
      if (!d || !c) return null
      return { dirR: Math.round(d.getBoundingClientRect().right), currentR: Math.round(c.getBoundingClientRect().right) }
    })(),
    ideaOutline: num(style('.idea-paper.current', 'outlineWidth')),
    surfaces: {
      paper: borders('.paper'),
      book: borders('.c-book'),
      page: borders('.c-page'),
      rail: borders('.c-chapter-rail'),
      margin: borders('.c-margin'),
      dossier: borders('.dossier'),
      worldPaper: borders('.world-paper'),
      lorePaper: borders('.lore-paper'),
      outlineFolio: borders('.outline-folio'),
      ideaReader: borders('.idea-reader'),
      settingsPaper: borders('.settings-paper'),
      previewPaper: borders('.preview-paper'),
      art: borders('.art-pane'),
      inspirationArt: borders('.inspiration-art'),
      directory: borders('.module-directory'),
      graphIndex: borders('.graph-index'),
      settingsCategories: borders('.settings-categories'),
      program: borders('.nouveau-program'),
      worldIndex: borders('.world-index'),
      characterGraph: borders('.character-graph'),
      loreConnections: borders('.lore-connections'),
      ideaPaper: borders('.idea-paper'),
      relationship: borders('.relationship'),
      tag: borders('.tag'),
      plotNode: borders('.plot-node')
    },
    shadows: {
      paper: hardShadow('.paper'),
      book: hardShadow('.c-book'),
      page: hardShadow('.c-page'),
      dossier: hardShadow('.dossier'),
      settingsPaper: hardShadow('.settings-paper'),
      previewPaper: hardShadow('.preview-paper'),
      ideaPaper: hardShadow('.idea-paper'),
      plotNode: hardShadow('.plot-node'),
      portraitNode: hardShadow('.portrait-node')
    },
    tools: tools('.module-toolbar .tools'),
    projectActions: tools('.project-line .actions')
  }
}

const open = async (state, width) => {
  const page = await browser.newPage({ viewport: { width, height: 900 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(pathToFileURL(join(root, state + '.html')).href, { waitUntil: 'load' })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(1500)
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

/* 折幕转场：抓一张中间帧，并验证到达页 */
const routePage = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const routeErrors = []
routePage.on('pageerror', (e) => routeErrors.push(e.message))
await routePage.goto(pathToFileURL(join(root, 'settings.html')).href, { waitUntil: 'load' })
await routePage.evaluate(() => document.fonts.ready)
await routePage.waitForTimeout(600)
await routePage.click('header nav a[href="editor.html"]')
await routePage.waitForTimeout(130)
const routeDuring = await routePage.evaluate(() => ({ curtain: !!document.querySelector('.v4-curtain'), mode: document.querySelector('.v4-curtain')?.className, url: location.pathname.split('/').pop() }))
await routePage.waitForTimeout(260)
await routePage.screenshot({ path: join(out, 'curtain.png') })
await routePage.waitForTimeout(350)
await routePage.waitForLoadState('load')
await routePage.waitForTimeout(700)
const routeAfter = await routePage.evaluate(() => ({ curtain: !!document.querySelector('.v4-curtain'), state: document.body.dataset.state, book: !!document.querySelector('.c-book') }))
await routePage.close()

/* 翻页中间帧 + 收起/搜索 */
const editorPage = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const editorErrors = []
editorPage.on('pageerror', (e) => editorErrors.push(e.message))
await editorPage.goto(pathToFileURL(join(root, 'editor.html')).href, { waitUntil: 'load' })
await editorPage.evaluate(() => document.fonts.ready)
await editorPage.waitForTimeout(900)
await editorPage.evaluate(() => {
  document.querySelectorAll('.v4-curtain').forEach((n) => n.remove())
  try { sessionStorage.removeItem('v4-route') } catch (_) { /* 文件预览可能禁用存储 */ }
})
await editorPage.click('[data-chapter="1"]')
await editorPage.waitForTimeout(140)
const chapterTurn = await editorPage.evaluate(() => ({ turning: document.querySelector('.c-book').classList.contains('v4-turning'), title: document.querySelector('.chapter-title h1').textContent.trim(), hasTurn: !!document.querySelector('.v4-turn') }))
await editorPage.screenshot({ path: join(out, 'page-turn.png') })
await editorPage.waitForTimeout(420)
const railOpen = await editorPage.evaluate(() => ({ railW: Math.round(document.querySelector('.c-chapter-rail').getBoundingClientRect().width), bookL: Math.round(document.querySelector('.c-book').getBoundingClientRect().left) }))
await editorPage.click('.c-rail-toggle')
await editorPage.waitForTimeout(350)
const railCollapsed = await editorPage.evaluate(() => ({
  railW: Math.round(document.querySelector('.c-chapter-rail').getBoundingClientRect().width),
  bookL: Math.round(document.querySelector('.c-book').getBoundingClientRect().left),
  progress: getComputedStyle(document.querySelector('.c-chapter-rail')).getPropertyValue('--chapter-progress').trim(),
  ring: getComputedStyle(document.querySelector('.mini-current'), '::before').backgroundImage
}))
await editorPage.click('[data-rail-next]')
await editorPage.waitForTimeout(220)
const miniNext = await editorPage.evaluate(() => ({ mini: document.querySelector('[data-rail-current]').firstChild.nodeValue.trim(), current: document.querySelector('[data-chapter-list] .chapter.current')?.getAttribute('data-chapter') }))
await editorPage.click('.c-rail-toggle')
await editorPage.waitForTimeout(300)
await editorPage.fill('[data-chapter-search]', '领航员')
const searchHits = await editorPage.evaluate(() => [...document.querySelectorAll('[data-chapter-list] [data-chapter]')].filter((b) => !b.hidden).length)
await editorPage.fill('[data-chapter-search]', '')
const searchReset = await editorPage.evaluate(() => [...document.querySelectorAll('[data-chapter-list] [data-chapter]')].filter((b) => !b.hidden).length)
await editorPage.close()

/* 选择与切页 */
const settingsPage = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await settingsPage.goto(pathToFileURL(join(root, 'settings.html')).href, { waitUntil: 'load' })
await settingsPage.evaluate(() => document.fonts.ready); await settingsPage.waitForTimeout(500)
await settingsPage.click('[data-settings-tab="编辑器"]')
await settingsPage.waitForTimeout(50)
const settingsSwapOut = await settingsPage.evaluate(() => ({ cls: document.querySelector('[data-settings-panel]').className, text: document.querySelector('[data-settings-panel]').textContent.trim().slice(0, 24) }))
await settingsPage.waitForTimeout(320)
const settingsSwapIn = await settingsPage.evaluate(() => ({ cls: document.querySelector('[data-settings-panel]').className, text: document.querySelector('[data-settings-panel]').textContent.trim().slice(0, 36) }))
await settingsPage.close()

const charactersPage = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await charactersPage.goto(pathToFileURL(join(root, 'characters.html')).href, { waitUntil: 'load' })
await charactersPage.evaluate(() => document.fonts.ready); await charactersPage.waitForTimeout(500)
await charactersPage.click('[data-person="1"]')
await charactersPage.waitForTimeout(70)
const person = await charactersPage.evaluate(() => ({ name: document.querySelector('[data-person-name]').textContent.trim(), src: document.querySelector('[data-main-portrait]').getAttribute('src'), cls: document.querySelector('.portrait-frame').className }))
await charactersPage.close()

const inspirationPage = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await inspirationPage.goto(pathToFileURL(join(root, 'inspiration.html')).href, { waitUntil: 'load' })
await inspirationPage.evaluate(() => document.fonts.ready); await inspirationPage.waitForTimeout(500)
await inspirationPage.click('[data-idea="1"]')
await inspirationPage.waitForTimeout(70)
const idea = await inspirationPage.evaluate(() => ({ title: document.querySelector('[data-idea-title]').value, cls: document.querySelector('.idea-reader').className }))
await inspirationPage.close()

/* 对话框 / Toast / 图谱线描 */
const dialogPage = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await dialogPage.goto(pathToFileURL(join(root, 'editor.html')).href, { waitUntil: 'load' })
await dialogPage.evaluate(() => document.fonts.ready); await dialogPage.waitForTimeout(500)
await dialogPage.click('[data-dialog="查找与替换"]')
await dialogPage.waitForTimeout(100)
const dialog = await dialogPage.evaluate(() => ({ open: !!document.querySelector('#overlay .dialog'), animation: getComputedStyle(document.querySelector('#overlay .dialog')).animationName }))
await dialogPage.keyboard.press('Escape')
await dialogPage.waitForTimeout(120)
const dialogClosed = await dialogPage.evaluate(() => !document.querySelector('#overlay .dialog'))
await dialogPage.close()

const toastPage = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await toastPage.goto(pathToFileURL(join(root, 'world-detail.html')).href, { waitUntil: 'load' })
await toastPage.evaluate(() => document.fonts.ready); await toastPage.waitForTimeout(500)
await toastPage.click('.orbit-core')
await toastPage.waitForTimeout(100)
const toast = await toastPage.evaluate(() => ({ text: document.querySelector('#toast').textContent.trim(), cls: document.querySelector('#toast').className }))
await toastPage.close()

const graphPage = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await graphPage.goto(pathToFileURL(join(root, 'characters-graph.html')).href, { waitUntil: 'load' })
await graphPage.evaluate(() => document.fonts.ready); await graphPage.waitForTimeout(500)
const graphAnimation = await graphPage.evaluate(() => {
  const p = document.querySelector('.character-graph > svg path')
  const c = getComputedStyle(p)
  return { animation: c.animationName, dash: c.strokeDasharray, offset: c.strokeDashoffset, color: c.stroke }
})
await graphPage.close()

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
    transition: getComputedStyle(el).transitionDuration,
    spotlight: !!document.querySelector('.v4-spotlight'),
    motion: document.body.classList.contains('v4-motion')
  }
})
await reducePage.close()

const reduceRoute = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
await reduceRoute.goto(pathToFileURL(join(root, 'settings.html')).href, { waitUntil: 'load' })
await reduceRoute.waitForTimeout(300)
await reduceRoute.click('header nav a[href="editor.html"]')
await reduceRoute.waitForTimeout(250)
const reduceRouteResult = await reduceRoute.evaluate(() => ({ state: document.body.dataset.state, curtain: !!document.querySelector('.v4-curtain') }))
await reduceRoute.close()

/* 静态查看 */
const staticPage = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await staticPage.goto(pathToFileURL(join(root, 'editor.html')).href, { waitUntil: 'load' })
await staticPage.evaluate(() => document.fonts.ready); await staticPage.waitForTimeout(400)
await staticPage.click('[data-static]')
await staticPage.waitForTimeout(100)
const staticView = await staticPage.evaluate(() => ({ cls: document.body.className, spotlight: getComputedStyle(document.querySelector('.v4-spotlight')).display }))
await staticPage.close()

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
  relationship: contrast('#6d4a3c', '#eee5cc'),
  settingsTitle: contrast('#1e3438', '#f5eddb'),
  graphIndex: contrast('#3f3327', '#ead9c6'),
  note: contrast('#4a4132', '#f7efdf')
}

const report = {
  wide,
  narrow,
  interactions: {
    routeDuring, routeAfter, routeErrors,
    chapterTurn, railOpen, railCollapsed, miniNext, searchHits, searchReset, editorErrors,
    settingsSwapOut, settingsSwapIn,
    person, idea, dialog, dialogClosed, toast, graphAnimation,
    reduceRouteResult, staticView
  },
  focus,
  reduced,
  contrasts
}
writeFileSync(join(root, 'capture-report.json'), JSON.stringify(report, null, 2))

const fail = []
const get = (list, state) => list.find((x) => x.state === state)
const both = [...wide, ...narrow]
if (both.some((x) => x.overflow || x.broken || x.errors.length)) fail.push('overflow / broken image / runtime error found')
if (both.some((x) => x.header?.h !== 76)) fail.push('header is not 76px')
if (both.some((x) => x.footer?.h !== 40)) fail.push('footer is not 40px')
if (both.some((x) => x.nav !== 7)) fail.push('nav is not seven items')
if (both.some((x) => x.headerBg?.color !== 'rgba(0, 0, 0, 0)' || x.footerBg?.color !== 'rgba(0, 0, 0, 0)')) fail.push('header/footer still have a solid bar background')
if (both.some((x) => x.scene?.t !== 0)) fail.push('scene/stage does not start at the top')
if (both.some((x) => (x.state === 'editor' ? x.contentTop !== 141 : x.state === 'shelf' ? x.contentTop !== 96 : x.contentTop !== 162))) fail.push('content is not aligned to the expected stage line')
if (both.some((x) => x.toolbar && x.toolbar.h !== 162)) fail.push('module toolbar is not 162px')
if (both.some((x) => !x.mark.exists || x.mark.position !== 'absolute')) fail.push('scene mark is missing or not absolute')

for (const x of both) {
  for (const [name, b] of Object.entries(x.surfaces)) {
    if (!b) continue
    if (name === 'plotNode') {
      if (b[1] || b[2] || b[3]) fail.push(`${x.state}: plot node still has side/bottom borders`)
    } else if (name === 'graphIndex' || name === 'worldIndex' || name === 'loreConnections') {
      if (b[0] || b[1] || b[2] || b[3] > 1) fail.push(`${x.state}: ${name} still has a panel border`)
    } else if (b.some((v) => v !== 0)) {
      fail.push(`${x.state}: ${name} still has a border`)
    }
  }
  for (const [name, v] of Object.entries(x.shadows)) {
    if (v) fail.push(`${x.state}: ${name} still has a hard offset shadow`)
  }
  if (x.ideaOutline !== 0) fail.push(`${x.state}: idea current outline still visible`)
  if (x.tools?.clipped || x.projectActions?.clipped) fail.push(`${x.state}: module actions are clipped`)
  if (!x.navActive.bg.includes('linear-gradient')) fail.push(`${x.state}: active nav plaque is missing`)
  if (x.navActive.transform === 'none') fail.push(`${x.state}: active nav plaque is not tilted`)
}

const shelf = get(wide, 'shelf')
if (shelf.shelf.rows !== 5) fail.push('shelf program does not have five tickets')
if (shelf.shelf.chapterSeal !== '"续"') fail.push('shelf chapter ticket seal missing')
if (shelf.shelf.programBg?.color !== 'rgba(0, 0, 0, 0)') fail.push('shelf program still has a panel background')
if (shelf.shelf.chapterOverlap <= 0) fail.push('shelf chapter ticket does not overlap the cover')
const editor = get(wide, 'editor')
if (editor.book?.h < 670) fail.push('editor book did not grow')
if (editor.rail?.w !== 248 || editor.book?.l !== 296) fail.push('editor rail/book geometry is wrong')
if (!editor.chapterScroll || editor.chapterScroll.sh <= editor.chapterScroll.ch) fail.push('editor chapter rail is not scrollable')
if (editor.margin?.w !== 252) fail.push('editor margin width is wrong')
const characters = get(wide, 'characters')
if (characters.characters.castDisplay !== 'flex') fail.push('characters cast is not a flex filmstrip')
if (characters.characters.castH <= 60) fail.push('characters cast strip is collapsed')
if (characters.characters.overlap <= 1000) fail.push('characters portrait does not overlap the dossier')
if (characters.characters.portrait?.w !== 380) fail.push('characters portrait column is not 380px')
const settings = get(wide, 'settings')
if (settings.settings.previewOverlap <= 1000) fail.push('settings preview does not overlap the form')
if (settings.settings.preview?.r > 1408) fail.push('settings preview overflows')
if (settings.settings.activeWriting !== 'vertical-rl') fail.push('settings categories are not vertical at 1440')
const inspiration = get(wide, 'inspiration')
if (inspiration.inspiration.overlap <= 3000) fail.push('inspiration reader does not overlap the notes')
if (inspiration.inspiration.papers?.r > inspiration.inspiration.reader?.l + 40) fail.push('inspiration notes are covered too deeply')
const world = get(wide, 'world')
if (world.world.overlap <= 1000) fail.push('world paper does not overlap the art')
if (world.world.indexBg?.color !== 'rgba(0, 0, 0, 0)') fail.push('world index still has a panel background')
const lore = get(wide, 'world-detail')
if (lore.lore.overlap <= 1000) fail.push('lore paper does not overlap the art')
if (lore.lore.connectionsBg?.color !== 'rgba(0, 0, 0, 0)') fail.push('lore connections still have a panel background')
const outline = get(wide, 'outline')
if (outline.nodes.length !== 6) fail.push('outline node count changed')
if (outline.nodeLines === 'none') fail.push('outline connectors are hidden')
if (outline.nodes.some((n) => n.r > outline.canvas.r + 1 || n.b > outline.canvas.b + 1)) fail.push('outline nodes exceed the canvas')
if (outline.nodePathLength < 50) fail.push('outline connector path is missing')
if (outline.nodeViewBox?.split(' ')[2] !== String(outline.canvas.w)) fail.push('outline connector viewBox does not match the canvas')
const graph = get(wide, 'characters-graph')
if (!graph.graph.canvasBg?.image.includes('radial-gradient')) fail.push('graph canvas is not a dark stage')
if (graph.graph.pathAnimation !== 'v4-draw') fail.push('graph edges do not draw in')
if (graph.graph.indexBg?.color !== 'rgba(0, 0, 0, 0)') fail.push('graph index still has a panel background')

const narrowOutline = get(narrow, 'outline')
if (!narrowOutline.canvas || narrowOutline.nodes.some((n) => n.r > narrowOutline.canvas.r + 1)) fail.push('1080 outline nodes are clipped')
if (narrowOutline.nodeLines === 'none') fail.push('1080 outline connectors are hidden')
if (narrowOutline.nodeViewBox?.split(' ')[2] !== String(narrowOutline.canvas.w)) fail.push('1080 outline connector viewBox does not match the canvas')
const narrowEditor = get(narrow, 'editor')
if (narrowEditor.rail?.w !== 216 || narrowEditor.book?.l !== 248) fail.push('1080 editor rail geometry is wrong')
if (narrowEditor.book?.r > 1064) fail.push('1080 editor book overflows')
const narrowChars = get(narrow, 'characters')
if (narrowChars.characters.portrait?.w !== 330) fail.push('1080 characters portrait column is not 330px')
if (narrowChars.characters.castDisplay !== 'flex') fail.push('1080 characters cast is not a filmstrip')
const narrowSettings = get(narrow, 'settings')
if (narrowSettings.settings.preview?.r > 1064) fail.push('1080 settings preview overflows')
if (narrowSettings.settings.activeWriting !== 'horizontal-tb') fail.push('1080 settings categories did not fall back to horizontal')

if (!routeDuring.curtain || routeDuring.url !== 'settings.html') fail.push('route curtain did not appear before navigation')
if (routeAfter.curtain || routeAfter.state !== 'editor') fail.push('route curtain did not finish / navigation failed')
if (routeErrors.length) fail.push('route transition page errors: ' + routeErrors.join(' | '))
if (!chapterTurn.turning || chapterTurn.title.indexOf('领航员') < 0) fail.push('chapter turn did not trigger')
if (railOpen.railW !== 248 || railOpen.bookL !== 296) fail.push('editor rail geometry is wrong before collapse')
if (railCollapsed.railW !== 56 || railCollapsed.bookL !== 104) fail.push('editor rail does not collapse')
if (!(parseFloat(railCollapsed.progress) > 0)) fail.push('chapter progress ring is not set')
if (!railCollapsed.ring.includes('conic-gradient')) fail.push('chapter progress ring is missing')
if (miniNext.mini !== '03' || miniNext.current !== '2') fail.push('collapsed mini nav cannot reach the next chapter')
if (searchHits !== 1 || searchReset !== 24) fail.push('chapter search does not filter/restore')
if (editorErrors.length) fail.push('editor interaction page errors: ' + editorErrors.join(' | '))
if (!settingsSwapOut.text.includes('段落首行缩进') || !settingsSwapOut.cls.includes('v4-swap-out')) fail.push('settings tab swap did not animate')
if (!settingsSwapIn.text.includes('拼写与标点提示')) fail.push('settings tab content did not change')
if (person.name !== '沈砚' || !person.src.includes('person1') || !person.cls.includes('v4-portrait-in')) fail.push('person selection/reveal failed')
if (idea.title !== '雾港来信' || !idea.cls.includes('v4-reader-in')) fail.push('idea selection/reveal failed')
if (!dialog.open || dialog.animation !== 'v4-dialog-in') fail.push('dialog animation missing')
if (!dialogClosed) fail.push('dialog did not close')
if (!toast.text.includes('已进入条目编辑') || !toast.cls.includes('v4-toast-in')) fail.push('toast animation missing')
if (graphAnimation.animation !== 'v4-draw' || graphAnimation.offset === '0px') fail.push('graph edge draw animation is missing')
if (focus.outlineWidth < 2) fail.push('keyboard focus ring is missing')
if (!reduced.media || !(parseFloat(reduced.duration) < 0.01) || reduced.spotlight || reduced.motion) fail.push('reduced motion is not honored')
if (reduceRouteResult.state !== 'editor' || reduceRouteResult.curtain) fail.push('reduced motion route transition is not skipped')
if (!staticView.cls.includes('static-view') || staticView.spotlight !== 'none') fail.push('static view did not stop ambient motion')
for (const [name, value] of Object.entries(contrasts)) {
  const min = name === 'body' || name === 'nav' || name === 'goldOnInk' ? 7 : 4.5
  if (value < min) fail.push(`contrast ${name} is ${value.toFixed(2)} < ${min}`)
}

writeFileSync(join(root, 'capture-report.json'), JSON.stringify({ fail, report }, null, 2))
if (fail.length) {
  console.error('FAIL\n' + fail.join('\n'))
  process.exit(1)
}
console.log('PASS night-stage v4')
