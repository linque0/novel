/* 产品介绍截图（赤月戏皮肤）：生产版 Electron + CDP 驱动 + 主进程 capturePage。
   与 shot-docs.mjs 的区别：
   - 固定使用赤月戏皮肤（ui.setSkin('crimson')），输出到 docs/assets/crimson/
   - 适配 app://local/index.html（生产构建），面板窗口路径相同
   - 状态表覆盖 v1.1.3 分层大纲、容器、关系投影与赤月戏三张布景
   用法：
     1) npm run build
     2) npx electron . --profile=shot-crimson-docs --inspect=9229 --remote-debugging-port=9222 \
          --disable-backgrounding-occluded-windows
     3) node tools/shot-docs-crimson.mjs
   （首次运行前可清理 %APPDATA%\小说工坊-shot-crimson-docs，确保书架只有演示书） */
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { connectInspector, captureWindow, evalMain } from './_capture-main.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = resolve(here, '../docs/assets/crimson')
mkdirSync(outDir, { recursive: true })

const PAGE_PORT = 9222
const APP_MATCH = process.env.NS_APP_MATCH || 'app://local/index.html'
const WORK_TITLE = process.env.NS_WORK_TITLE || '星尘旅人'
const report = {}

/* ---------- 渲染进程 CDP（驱动 UI） ---------- */
class PageCDP {
  constructor(ws) {
    this.ws = ws
    this.id = 0
    this.pending = new Map()
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data)
      if (m.id && this.pending.has(m.id)) {
        const { res, rej } = this.pending.get(m.id)
        this.pending.delete(m.id)
        m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result)
      }
    }
  }
  static async targets() {
    return (await (await fetch(`http://127.0.0.1:${PAGE_PORT}/json/list`)).json()).filter((x) => x.type === 'page')
  }
  static async connect(match = APP_MATCH) {
    const t = (await PageCDP.targets()).find((x) => x.url.includes(match) && !x.url.includes('panel='))
    if (!t) throw new Error('page target not found: ' + match)
    const ws = new WebSocket(t.webSocketDebuggerUrl)
    await new Promise((r, j) => ((ws.onopen = r), (ws.onerror = j)))
    return new PageCDP(ws)
  }
  send(method, params = {}) {
    const id = ++this.id
    this.ws.send(JSON.stringify({ id, method, params }))
    return new Promise((res, rej) => this.pending.set(id, { res, rej }))
  }
  async eval(expression, timeout = 30000) {
    const r = await Promise.race([
      this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('eval timeout')), timeout))
    ])
    if (r.exceptionDetails) throw new Error((r.exceptionDetails.exception?.description || r.exceptionDetails.text).slice(0, 400))
    return r.result?.value
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const ins = await connectInspector()

const closeAllPanels = () => evalMain(ins, `(() => {
  const { BrowserWindow } = require('electron')
  const ps = BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed() && String(w.webContents.getURL()).includes('panel='))
  ps.forEach((w) => w.close())
  return ps.length
})()`)

const closedStale = await closeAllPanels()
if (closedStale) console.log(`   (closed ${closedStale} stale panel window(s))`)
const cdp = await PageCDP.connect()

/* 等待应用挂载 + 赤月戏生效 */
for (let i = 0; i < 40; i++) {
  const ready = await cdp.eval(`!!(document.querySelector('#app')?.__vue_app__?.config?.globalProperties?.$pinia)`)
  if (ready) break
  await sleep(500)
}

const settle = async (extra = 0) => {
  const r = await cdp.eval(`(async () => {
    if (document.fonts?.ready) await document.fonts.ready
    const imgs = [...document.images]
    await Promise.all(imgs.map((i) => i.complete ? 0 : new Promise((res) => { i.onload = i.onerror = res })))
    await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)))
    return { images: imgs.length, broken: imgs.filter((i) => !i.complete || !i.naturalWidth).map((i) => i.src.split('/').pop()) }
  })()`)
  if (extra) await sleep(extra)
  return r
}

const shot = async (name, match = APP_MATCH, exclude = 'panel=') => {
  const s = await settle(0)
  try { await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 4, y: 4 }) } catch {}
  await sleep(120)
  const r = await captureWindow(ins, match, resolve(outDir, name + '.png'), { exclude })
  const m = await cdp.eval(`({
    skin: document.body.dataset.skin,
    tab: document.querySelector('.workbench-shell')?.dataset.module || 'shelf',
    overflow: document.documentElement.scrollWidth > innerWidth,
    broken: [...document.images].filter((i) => !i.complete || !i.naturalWidth).map((i) => i.src.split('/').pop())
  })`)
  report[name] = { ...r, ...m, settle: s }
  console.log(`  ✓ ${name}.png  ${r.size.width}x${r.size.height}  skin=${m.skin} tab=${m.tab}${m.overflow ? '  OVERFLOW' : ''}${m.broken.length ? '  BROKEN:' + m.broken.join(',') : ''}`)
  return report[name]
}

/* ---------- 页内助手：Pinia store 直控 ---------- */
const HELPERS = `window.__doc = {
  st() { const p = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia; return { w: p._s.get('work'), u: p._s.get('ui'), s: p._s.get('shelf') } },
  async open(title) {
    const { s, w } = this.st()
    await s.refresh()
    const target = s.works.find(x => x.title === title)
    if (!target) return { err: 'no work ' + title, have: s.works.map(x => x.title) }
    if (w.work?.id !== target.id) await w.open(target.id)
    await s.refresh()
    return { opened: w.work?.title, chapters: w.chapters.length, chars: w.characters.length }
  },
  async shelf() {
    const { s, w, u } = this.st()
    u.view = 'shelf'; u.theme = 'xuan'; u.focusMode = false
    for (const k of ['searchOpen','statsOpen','trashOpen','importOpen','exportOpen','helpOpen','revisionsOpen']) u[k] = false
    u.loreDetailId = null
    w.$reset()
    await s.refresh()
    return { view: u.view, works: s.works.map(x => x.title) }
  },
  async resetPrefs() {
    const { u } = this.st()
    await u.setPref('editorFont', 'song')
    await u.setPref('editorLatin', 'none')
    await u.setPref('fontSize', 17)
    await u.setSkin('crimson')
    u.theme = 'xuan'
    u.focusMode = false
    return { skin: u.skin, theme: u.theme, font: u.editorFont, latin: u.editorLatin, fs: u.fontSize }
  },
  set(patch) {
    const { w, u } = this.st()
    if (patch.tab) w.tab = patch.tab
    if (patch.outlineView) w.outlineView = patch.outlineView
    if (patch.charView) w.charView = patch.charView
    if (patch.chapterTitle) { const c = w.chapters.find(x => x.title.includes(patch.chapterTitle)); if (c) { w.selChapterId = c.id; w.selVolumeId = c.volumeId } }
    if (patch.charName) { const c = w.characters.find(x => x.name === patch.charName); if (c) w.selCharacterId = c.id }
    if (patch.theme) u.theme = patch.theme
    if (patch.focus != null) u.focusMode = patch.focus
    if (patch.loreDetailId !== undefined) u.loreDetailId = patch.loreDetailId
    return { tab: w.tab, theme: u.theme }
  },
  modal(key) {
    const { u } = this.st()
    for (const k of ['searchOpen','statsOpen','trashOpen','importOpen','exportOpen','helpOpen','revisionsOpen']) u[k] = false
    if (key) u[key] = true
    return key
  },
  fitOutline() {
    const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === '适应')
    if (!b) return false
    b.click()
    return true
  },
  overview() {
    const b = [...document.querySelectorAll('.oc-head-actions button')].find(x => x.textContent.trim() === '总览')
    if (!b) return false
    b.click()
    return true
  },
  zoomIn(n = 1) {
    const b = [...document.querySelectorAll('button')].find(x => (x.title || '').includes('放大'))
    if (!b) return false
    for (let i = 0; i < n; i++) b.click()
    return true
  },
  center(wx, wy) {
    const el = document.querySelector('.oc-canvas'), inner = document.querySelector('.om-inner')
    if (!el || !inner) return 'no canvas'
    const m = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)\s*scale\(([\d.]+)\)/.exec(inner.style.transform)
    if (!m) return 'transform parse'
    const tx = +m[1], ty = +m[2], z = +m[3]
    const dx = el.clientWidth / 2 - (tx + wx * z), dy = el.clientHeight / 2 - (ty + wy * z)
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 40, clientY: 40 }))
    window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 40 + dx, clientY: 40 + dy }))
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    return { dx: Math.round(dx), dy: Math.round(dy), z }
  },
  outlineList() {
    const { w } = this.st()
    return typeof w.liveOlnodes === 'function' ? w.liveOlnodes() : (w.liveOlnodes || w.olnodes || [])
  },
  selectOutline(title) {
    const { w } = this.st()
    const n = this.outlineList().find(x => (x.title || '').includes(title))
    w.selOlnodeId = n?.id || null
    return n?.title || 'none'
  },
  enterContainer(title) {
    const { w } = this.st()
    const n = this.outlineList().find(x => x.kind === 'container' && (x.title || '').includes(title))
    if (!n) return 'no container'
    w.canvasPrefs.scopeId = n.id
    return n.title
  },
  rootScope() {
    const { w } = this.st()
    w.canvasPrefs.scopeId = null
    return null
  },
  selectSnippet(index = 0) {
    const { w } = this.st()
    const list = typeof w.liveSnippets === 'function' ? w.liveSnippets() : (w.liveSnippets || w.snippets || [])
    w.selSnippetId = list[index]?.id || null
    return w.selSnippetId
  },
  async openLoreDetail(title) {
    const { w } = this.st()
    const node = (w.mubu || []).find(n => !n.deletedAt && (n.text || '').includes(title))
    if (!node) return 'no node'
    const root = w.mubuRootOf(node.id)
    if (root) w.setMubuSet(root.id)
    await new Promise(r => setTimeout(r, 500))
    const row = [...document.querySelectorAll('.ob-row')].find(r => (r.textContent || '').includes(title))
    if (!row) return 'no row'
    row.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }))
    return 'ok'
  },
  ctxOnNodeByTitle(title) {
    const n = [...document.querySelectorAll('.oc-node')].find(el => (el.textContent || '').includes(title))
    if (!n) return 'no node'
    const r = n.getBoundingClientRect()
    n.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }))
    return 'ok'
  },
  ctxOnEditor() {
    const host = document.querySelector('.rich-host') || document.querySelector('.ProseMirror')
    if (!host) return 'no host'
    const r = host.getBoundingClientRect()
    host.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.left + 260, clientY: r.top + 120 }))
    return 'ok'
  },
  ctxOnEdge() {
    const hit = document.querySelector('.oc-edge-hit')
    if (!hit) return 'no edge'
    const r = hit.getBoundingClientRect()
    hit.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }))
    return 'ok'
  },
  ctxOnNode(sel) {
    const n = document.querySelector(sel || '.oc-node')
    if (!n) return 'no node'
    const r = n.getBoundingClientRect()
    n.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }))
    return 'ok'
  },
  esc() { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return 1 },
  panelOpen(spec) { return window.native.panelOpen(spec) },
  panelList() { return window.native.panelList() },
  async settingsWindow() {
    return window.native.panelOpen({ type: 'settings', workId: 'app', entityId: '', title: '小说工坊 · 设置' })
  }
}`

const run = (expr) => cdp.eval(expr)
const runAsync = (expr) => cdp.eval('(async () => (' + expr + '))()')
const info = (v) => console.log('   ', typeof v === 'object' ? JSON.stringify(v) : v)

await run(HELPERS + '; 1')
info(await runAsync(`(await window.__doc.resetPrefs(), 1)`))
await sleep(1200)

/* ---------- 步骤表 ---------- */
const plan = [
  ['01-shelf', `(await window.__doc.resetPrefs(), await window.__doc.shelf(), 1)`, 2200],
  ['02-editor', `(await window.__doc.open('${WORK_TITLE}'), window.__doc.set({ tab: 'chapters', theme: 'xuan', chapterTitle: '初雪', focus: false }), 1)`, 2200],
  ['03-editor-contextmenu', `window.__doc.ctxOnEditor()`, 900],
  ['04-outline-root', `(async () => {
    window.__doc.esc()
    window.__doc.set({ tab: 'outline', outlineView: 'canvas' })
    await new Promise(r => setTimeout(r, 700))
    return window.__doc.overview()
  })()`, 2200],
  ['05-outline-container', `(async () => {
    const t = window.__doc.enterContainer('容器 · 归组示例')
    await new Promise(r => setTimeout(r, 700))
    window.__doc.overview()
    return t
  })()`, 1800],
  ['06-outline-detail', `(async () => {
    window.__doc.rootScope()
    window.__doc.set({ outlineView: 'canvas' })
    await new Promise(r => setTimeout(r, 500))
    window.__doc.overview()
    await new Promise(r => setTimeout(r, 500))
    window.__doc.zoomIn(2)
    await new Promise(r => setTimeout(r, 400))
    return window.__doc.center(760, 320)
  })()`, 1500],
  ['07-outline-edge-menu', `window.__doc.ctxOnEdge()`, 900],
  ['08-outline-node-menu', `(window.__doc.esc(), window.__doc.ctxOnNodeByTitle('钟楼即星图'), 1)`, 900],
  ['09-outline-text', `(async () => {
    window.__doc.esc()
    window.__doc.set({ outlineView: 'text' })
    await new Promise(r => setTimeout(r, 400))
    return window.__doc.selectOutline('钟楼即星图')
  })()`, 1600],
  ['10-character-graph', `(window.__doc.set({ tab: 'characters', charView: 'graph' }), 1)`, 2200],
  ['11-character-list', `(window.__doc.set({ charView: 'list', charName: '林远' }), 1)`, 1600],
  ['12-lore', `(window.__doc.set({ tab: 'lore', loreDetailId: null }), 1)`, 1800],
  ['13-lore-detail', `(async () => { const r = await window.__doc.openLoreDetail('界脊'); await new Promise(x => setTimeout(x, 800)); return r })()`, 1700],
  ['14-snippet', `(window.__doc.set({ tab: 'snippets', loreDetailId: null }), window.__doc.selectSnippet(0), 1)`, 1500],
  ['15-search', `(window.__doc.modal('searchOpen'), 1)`, 900],
  ['16-stats', `(window.__doc.modal('statsOpen'), 1)`, 1800],
  ['17-import', `(window.__doc.modal('importOpen'), 1)`, 1200],
  ['18-export', `(window.__doc.modal(null), window.__doc.set({ tab: 'chapters' }), window.__doc.modal('exportOpen'), 1)`, 1500],
  ['19-help', `(window.__doc.modal(null), window.__doc.modal('helpOpen'), 1)`, 1600],
  ['20-trash', `(window.__doc.modal(null), window.__doc.modal('trashOpen'), 1)`, 1200]
]

for (const [name, expr, wait] of plan) {
  await run(HELPERS + '; 1')
  const r = await runAsync(expr)
  if (r && r.err) throw new Error(name + ' -> ' + JSON.stringify(r))
  await sleep(wait)
  await shot(name)
}

/* ---------- 多窗口 / 实体锁 ---------- */
const resizePanel = (type, width, height) => evalMain(ins, `(() => {
  const { BrowserWindow } = require('electron')
  const win = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed() && String(w.webContents.getURL()).includes('panel=' + ${JSON.stringify(type)}))
  if (!win) return null
  win.setBounds({ width: ${width}, height: ${height} })
  return win.getBounds()
})()`)

await runAsync(`window.__doc.modal(null)`)
const ctx = await runAsync(`(async () => {
  await window.__doc.open('${WORK_TITLE}')
  const { w } = window.__doc.st()
  window.__doc.set({ tab: 'chapters', chapterTitle: '初雪' })
  const ch = w.chapters.find((c) => c.title.includes('初雪'))
  const persona = w.liveCharacters?.[0] || w.characters?.[0]
  return { workId: w.work.id, title: w.work.title, chapterId: ch?.id || '', characterId: persona?.id || '' }
})()`)
info({ workId: ctx.workId, chapter: ctx.chapterId, character: ctx.characterId })
await sleep(1500)

/* 正文面板 */
const chapterPanel = await runAsync(`window.__doc.panelOpen({ type: 'chapter', workId: ${JSON.stringify(ctx.workId)}, entityId: ${JSON.stringify(ctx.chapterId)}, title: ${JSON.stringify(ctx.title)} })`)
info(chapterPanel)
await sleep(1400)
info({ chapterBounds: await resizePanel('chapter', 1200, 820) })
await sleep(2800)
await shot('21-panel-chapter', 'panel=chapter', null)
const closed1 = await closeAllPanels()
info({ closedPanels: closed1 })
await sleep(1400)

/* 人物面板：第二个完整功能窗口 */
const charactersPanel = await runAsync(`window.__doc.panelOpen({ type: 'characters', workId: ${JSON.stringify(ctx.workId)}, entityId: ${JSON.stringify(ctx.characterId)}, title: ${JSON.stringify(ctx.title)} })`)
info(charactersPanel)
await sleep(1400)
info({ charactersBounds: await resizePanel('characters', 1120, 780) })
await sleep(2800)
await shot('22-panel-characters', 'panel=characters', null)
const closed2 = await closeAllPanels()
info({ closedPanels: closed2 })
await sleep(1200)

/* ---------- 设置窗口 ---------- */
const settings = await runAsync(`window.__doc.settingsWindow()`)
info(settings)
await sleep(2600)
await shot('23-settings', 'panel=settings', null)
await closeAllPanels()
await sleep(1200)

/* ---------- 赤月戏视觉主图：换一本作品作为书架主角，展示另一套舞台与书封 ---------- */
const featured = await runAsync(`(async () => {
  const { s, u } = window.__doc.st()
  await s.refresh()
  const target = s.works.find((x) => x.title === '雾都来信')
  if (target) await s.recordOpen(target.id)
  u.view = 'shelf'
  await s.refresh()
  return { featured: target?.title || 'none', works: s.works.map((x) => x.title) }
})()`)
info(featured)
await sleep(2200)
await shot('24-crimson-stage')

/* ---------- 收尾 ---------- */
writeFileSync(resolve(outDir, 'capture-report.json'), JSON.stringify(report, null, 2))
console.log('done ->', outDir)
await evalMain(ins, `require('electron').app.quit()`).catch(() => {})
process.exit(0)
