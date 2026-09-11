/* 文档截图采集：CDP 驱动 UI 状态（store 直控，避免点错按钮），主进程 capturePage() 取图
   （渲染进程被遮挡/最小化时 Page.captureScreenshot 不产帧会挂起，capturePage 无此问题）。
   用法：node tools/shot-docs.mjs <group>    group = a|b|c|d|e|all                       */
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { connectInspector, captureWindow, evalMain } from './_capture-main.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = resolve(here, '../docs/assets')
mkdirSync(outDir, { recursive: true })

const PAGE_PORT = 9222
const APP_URL = '127.0.0.1:5173'
const group = (process.argv[2] || 'all').toLowerCase()

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
  static async connect(match = APP_URL) {
    const t = (await PageCDP.targets()).find((x) => x.url.includes(match))
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
  async eval(expression, timeout = 20000) {
    const r = await Promise.race([
      this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('eval timeout')), timeout))
    ])
    if (r.exceptionDetails) throw new Error((r.exceptionDetails.exception?.description || r.exceptionDetails.text).slice(0, 300))
    return r.result?.value
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const ins = await connectInspector()

const shot = async (name, match = '127.0.0.1:5173/', exclude = 'panel=') => {
  const r = await captureWindow(ins, match, resolve(outDir, name + '.png'), { exclude })
  console.log(`  ✓ ${name}.png  ${r.size.width}x${r.size.height}`)
}

/* 采集前清场：关闭所有遗留的面板窗口，避免与主窗口 URL 关键字相互匹配 */
const closeAllPanels = () => evalMain(ins, `(() => {
  const { BrowserWindow } = require('electron')
  const ps = BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed() && String(w.webContents.getURL()).includes('panel='))
  ps.forEach((w) => w.close())
  return ps.length
})()`)

const closedStale = await closeAllPanels()
if (closedStale) console.log(`   (closed ${closedStale} stale panel window(s))`)
const cdp = await PageCDP.connect()

/* ---------- 页内助手：Pinia store 直控 ---------- */
const HELPERS = `window.__doc = {
  st() { const p = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia; return { w: p._s.get('work'), u: p._s.get('ui'), s: p._s.get('shelf') } },
  async open(title) {
    const { s, w } = this.st()
    await s.refresh()
    const target = s.works.find(x => x.title === title)
    if (!target) return { err: 'no work ' + title, have: s.works.map(x => x.title) }
    if (w.work?.id !== target.id) await w.open(target.id)
    return { opened: w.work?.title, chapters: w.chapters.length, chars: w.characters.length }
  },
  shelf() { const { w, u } = this.st(); u.view = 'shelf'; u.theme = 'xuan'; u.focusMode = false; for (const k of ['searchOpen','statsOpen','trashOpen','importOpen','exportOpen','helpOpen']) u[k] = false; w.$reset(); return u.view },
  set(patch) {
    const { w, u } = this.st()
    if (patch.tab) w.tab = patch.tab
    if (patch.outlineView) w.outlineView = patch.outlineView
    if (patch.charView) w.charView = patch.charView
    if (patch.chapterTitle) { const c = w.chapters.find(x => x.title.includes(patch.chapterTitle)); if (c) { w.selChapterId = c.id; w.selVolumeId = c.volumeId } }
    if (patch.charName) { const c = w.characters.find(x => x.name === patch.charName); if (c) w.selCharacterId = c.id }
    if (patch.theme) u.theme = patch.theme
    if (patch.focus != null) u.focusMode = patch.focus
    return { tab: w.tab, theme: u.theme }
  },
  modal(key) {
    const { u } = this.st()
    for (const k of ['searchOpen','statsOpen','trashOpen','importOpen','exportOpen','helpOpen']) u[k] = false
    if (key) u[key] = true
    return key
  },
  fitOutline() { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === '适应'); if (!b) return false; b.click(); return true },
  zoomIn(n = 1) { const b = [...document.querySelectorAll('.om-btn')].find(x => x.title === '放大'); if (!b) return false; for (let i = 0; i < n; i++) b.click(); return true },
  center(wx, wy) {
    const el = document.querySelector('.oc-canvas'), inner = document.querySelector('.om-inner')
    if (!el || !inner) return 'no canvas'
    const m = /translate\\(([-\\d.]+)px,\\s*([-\\d.]+)px\\)\\s*scale\\(([\\d.]+)\\)/.exec(inner.style.transform)
    if (!m) return 'transform parse'
    const tx = +m[1], ty = +m[2], z = +m[3]
    const dx = el.clientWidth / 2 - (tx + wx * z), dy = el.clientHeight / 2 - (ty + wy * z)
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 40, clientY: 40 }))
    window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 40 + dx, clientY: 40 + dy }))
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    return { dx: Math.round(dx), dy: Math.round(dy), z }
  },
  ctxOnEdge() {
    const hit = document.querySelector('.oc-edge-hit')
    if (!hit) return 'no edge'
    const r = hit.getBoundingClientRect()
    hit.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }))
    return 'ok'
  },
  ctxOnEditor() {
    const host = document.querySelector('.rich-host') || document.querySelector('.ProseMirror')
    if (!host) return 'no host'
    const r = host.getBoundingClientRect()
    host.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.left + 200, clientY: r.top + 90 }))
    return 'ok'
  },
  ctxOnNode(sel) {
    const n = document.querySelector(sel || '.oc-event')
    if (!n) return 'no node'
    const r = n.getBoundingClientRect()
    n.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }))
    return 'ok'
  },
  panelOpen(spec) { return window.native.panelOpen(spec) },
  panelList() { return window.native.panelList() },
  panelClose(key) { return window.native.panelCloseSelf ? null : null },
  esc() { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return 1 }
}`

const run = (expr) => cdp.eval(expr)
const runAsync = (expr) => cdp.eval('(async () => (' + expr + '))()')
const info = (v) => console.log('   ', typeof v === 'object' ? JSON.stringify(v) : v)

/* ---------- 步骤表 ---------- */
const GROUPS = {
  a: [
    ['01-shelf', `window.__doc.shelf()`, 1400],
    ['02-chapter-editor', `(await window.__doc.open('星尘旅人'), window.__doc.set({ tab: 'chapters', theme: 'xuan', chapterTitle: '初雪', focus: false }), 1)`, 1500],
    ['03-chapter-contextmenu', `window.__doc.ctxOnEditor()`, 900],
    ['04-theme-night', `(window.__doc.esc(), window.__doc.set({ theme: 'night' }), 1)`, 1000],
    ['05-stats', `(window.__doc.modal('statsOpen'), 1)`, 1800]
  ],
  b: [
    ['06-outline-canvas-overview', `(window.__doc.modal(null), window.__doc.set({ tab: 'outline', outlineView: 'canvas', theme: 'xuan' }), 1)`, 2400],
    ['07-outline-canvas-detail', `(window.__doc.zoomIn(3), window.__doc.center(900, 380), 1)`, 1400],
    ['08-outline-edge-menu', `window.__doc.ctxOnEdge()`, 900],
    ['09-outline-node-menu', `(window.__doc.esc(), window.__doc.ctxOnNode('.oc-event'), 1)`, 900],
    ['10-outline-text', `(window.__doc.esc(), window.__doc.set({ outlineView: 'text' }), 1)`, 1400]
  ],
  c: [
    ['11-character-graph', `(window.__doc.set({ tab: 'characters', charView: 'graph' }), 1)`, 2200],
    ['12-character-list', `(window.__doc.set({ charView: 'list', charName: '林远' }), 1)`, 1400]
  ],
  d: [
    ['13-lore-mubu', `(window.__doc.set({ tab: 'lore' }), 1)`, 1600],
    ['14-snippet', `(window.__doc.set({ tab: 'snippets' }), 1)`, 1200],
    ['15-search', `(window.__doc.modal('searchOpen'), 1)`, 900],
    ['16-export', `(window.__doc.modal(null), window.__doc.set({ tab: 'chapters' }), window.__doc.modal('exportOpen'), 1)`, 1500],
    ['17-import', `(window.__doc.modal(null), window.__doc.modal('importOpen'), 1)`, 1200],
    ['18-help', `(window.__doc.modal(null), window.__doc.modal('helpOpen'), 1)`, 1600],
    ['19-trash', `(window.__doc.modal(null), window.__doc.modal('trashOpen'), 1)`, 1200]
  ]
}

/* ---------- 执行 ---------- */
if (group === 'e') {
  /* e 组：多窗口拆窗（面板窗口是独立页面 target，截图走主进程 capturePage） */
  await runAsync(`window.__doc.modal(null)`)
  const ctx = await runAsync(`(async () => {
    await window.__doc.open('星尘旅人')
    const { w } = window.__doc.st()
    window.__doc.set({ tab: 'chapters', chapterTitle: '初雪' })
    const ch = w.chapters.find((c) => c.title.includes('初雪'))
    return { workId: w.work.id, title: w.work.title, chapterId: ch?.id || '' }
  })()`)
  info({ workId: ctx.workId, chapter: ctx.chapterId })
  await sleep(1500)
  const panels = [['20-panel-chapter', 'chapter', ctx.chapterId], ['21-panel-outline', 'outline', '']]
  for (const [name, type, entityId] of panels) {
    const r = await runAsync(`window.__doc.panelOpen({ type: ${JSON.stringify(type)}, workId: ${JSON.stringify(ctx.workId)}, entityId: ${JSON.stringify(entityId)}, title: ${JSON.stringify(ctx.title)} })`)
    info(r)
    await sleep(3000)
    await shot(name, 'panel=' + type, null)
  }
  /* 主窗口：拆窗后正文面板占用的章节显示只读占位 */
  await runAsync(`window.__doc.set({ tab: 'chapters', chapterTitle: '初雪' })`)
  await sleep(1800)
  await shot('22-main-readonly-placeholder')
  /* 收尾：经主进程关闭全部面板窗口（保留主窗口） */
  const closed = await evalMain(ins, `(() => {
    const { BrowserWindow } = require('electron')
    const panels = BrowserWindow.getAllWindows().filter((w) => String(w.webContents.getURL()).includes('panel='))
    panels.forEach((w) => w.close())
    return { closed: panels.length }
  })()`)
  info(closed)
  console.log('done')
  process.exit(0)
}

const plan = group === 'all' ? [...GROUPS.a, ...GROUPS.b, ...GROUPS.c, ...GROUPS.d] : GROUPS[group]
if (!plan) throw new Error('unknown group: ' + group)

for (const [name, expr, wait] of plan) {
  await run(HELPERS + '; 1')
  const r = await runAsync(expr)
  if (r && r.PAGE_ERR) throw new Error(name + ' -> ' + r.PAGE_ERR)
  if (r && r.err) throw new Error(name + ' -> ' + JSON.stringify(r))
  if (name === '02-chapter-editor') info(r)
  await sleep(wait)
  await shot(name)
}

console.log('done')
process.exit(0)
