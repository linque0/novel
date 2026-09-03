/* 功能面板窗口管理（开发计划 9.2-W5）：
 * - panel:open 打开（或聚焦已存在的）模块面板窗口，URL 注入 ?panel=<type>:<workId>:<entityId>
 * - 实体/模块级锁表：同作品同实体全应用仅一个可写面板；锁变更经 panel:event 广播到所有窗口
 * - 面板几何按类型记忆（userData/panel-geometry.json），恢复时夹取到可见屏内
 * - 生命周期：面板关闭前走 __flushNow 优雅保存并释放锁；主窗口关闭级联关闭全部面板
 */
const { BrowserWindow, ipcMain, screen, app } = require('electron')
const path = require('path')
const fs = require('fs')

const isDev = !!process.env.NOVEL_STUDIO_DEV || process.argv.includes('--dev')

const PANEL_META = {
  chapter: { label: '正文', w: 1080, h: 740 },
  outline: { label: '大纲', w: 1200, h: 780 },
  characters: { label: '人物', w: 1080, h: 740 },
  lore: { label: '设定', w: 1080, h: 740 },
  snippets: { label: '灵感', w: 960, h: 660 }
}

let mainWindow = null
const panels = [] // { win, key, spec }
const locks = new Map() // key -> panelKey

function lockKeyOf(spec) {
  return `${spec.workId}:${spec.type}:${spec.entityId || '*'}`
}

/* ---------- 几何记忆 ---------- */
function geomFile() {
  return path.join(app.getPath('userData'), 'panel-geometry.json')
}
function loadGeom() {
  try {
    return JSON.parse(fs.readFileSync(geomFile(), 'utf-8')) || {}
  } catch {
    return {}
  }
}
function saveGeom(type, bounds) {
  try {
    const all = loadGeom()
    all[type] = bounds
    fs.writeFileSync(geomFile(), JSON.stringify(all), 'utf-8')
  } catch {
    /* 几何记忆失败可忽略 */
  }
}
function clampToScreen(b) {
  const area = screen.getDisplayMatching(b).workArea
  const w = Math.min(b.width, area.width)
  const h = Math.min(b.height, area.height)
  return {
    width: w,
    height: h,
    x: Math.max(area.x, Math.min(b.x, area.x + area.width - w)),
    y: Math.max(area.y, Math.min(b.y, area.y + area.height - h))
  }
}

/* ---------- 广播中枢 ---------- */
function broadcast(channel, payload) {
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.webContents.send(channel, payload)
  }
}

/* ---------- 面板窗口 ---------- */
function panelUrl(spec) {
  const q = `panel=${encodeURIComponent(`${spec.type}:${spec.workId}:${spec.entityId || ''}`)}`
  return isDev ? `http://127.0.0.1:5173/?${q}` : `app://local/index.html?${q}`
}

function openPanel(spec) {
  const meta = PANEL_META[spec.type]
  if (!meta || !spec.workId) return { ok: false, reason: 'bad-spec' }
  const key = lockKeyOf(spec)
  const existed = panels.find((p) => p.key === key && !p.win.isDestroyed())
  if (existed) {
    if (existed.win.isMinimized()) existed.win.restore()
    existed.win.focus()
    return { ok: true, focused: true }
  }
  if (locks.has(key) && locks.get(key) !== key) return { ok: false, reason: 'locked' }

  const saved = loadGeom()[spec.type]
  const mainB = mainWindow && !mainWindow.isDestroyed() ? mainWindow.getBounds() : null
  const base = saved || {
    width: meta.w,
    height: meta.h,
    x: mainB ? mainB.x + 48 + (panels.length % 5) * 28 : undefined,
    y: mainB ? mainB.y + 42 + (panels.length % 5) * 26 : undefined
  }
  const bounds = clampToScreen(base)

  const win = new BrowserWindow({
    ...bounds,
    minWidth: 800,
    minHeight: 500,
    backgroundColor: '#f6f2e7',
    title: spec.title || `小说工坊 · ${meta.label}`,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false
    }
  })
  win.setMenuBarVisibility(false)
  win.webContents.setWindowOpenHandler(({ url }) => ({ action: 'deny' }))
  win.webContents.on('console-message', (_e, _l, message, line, source) => {
    if (!message.includes('DevTools')) console.log(`[panel] ${message} (${source}:${line})`)
  })

  const record = { win, key, spec }
  panels.push(record)
  locks.set(key, key)
  broadcast('panel:event', { kind: 'opened', key, spec, locks: [...locks.keys()] })

  // 关闭前等待渲染进程把脏数据落盘（与主窗口同一策略），随后释放锁并广播
  win.on('close', (e) => {
    if (win.__flushed) return
    e.preventDefault()
    const done = () => {
      if (!win || win.__flushed) return
      win.__flushed = true
      saveGeom(spec.type, win.getBounds())
      win.close()
    }
    const t = setTimeout(done, 1500)
    win.webContents
      .executeJavaScript('window.__flushNow ? window.__flushNow() : 0', true)
      .then(() => {
        clearTimeout(t)
        done()
      })
      .catch(() => {
        clearTimeout(t)
        done()
      })
  })
  win.on('closed', () => {
    const i = panels.indexOf(record)
    if (i >= 0) panels.splice(i, 1)
    if (locks.get(key) === key) locks.delete(key)
    broadcast('panel:event', { kind: 'closed', key, spec, locks: [...locks.keys()] })
  })

  win.loadURL(panelUrl(spec))
  return { ok: true, created: true }
}

/* ---------- IPC ---------- */
function init() {
  ipcMain.handle('panel:open', (_e, spec) => {
    if (!spec || typeof spec !== 'object') return { ok: false, reason: 'bad-spec' }
    return openPanel({
      type: String(spec.type || ''),
      workId: String(spec.workId || ''),
      entityId: spec.entityId ? String(spec.entityId) : '',
      title: spec.title ? String(spec.title).slice(0, 80) : ''
    })
  })
  ipcMain.handle('panel:list', () => ({
    panels: panels.filter((p) => !p.win.isDestroyed()).map((p) => ({ key: p.key, spec: p.spec })),
    locks: [...locks.keys()]
  }))
  ipcMain.handle('panel:focus', (_e, key) => {
    const p = panels.find((x) => x.key === key && !x.win.isDestroyed())
    if (!p) return { ok: false }
    if (p.win.isMinimized()) p.win.restore()
    p.win.focus()
    return { ok: true }
  })
  ipcMain.handle('panel:close-self', (e) => {
    const w = BrowserWindow.fromWebContents(e.sender)
    if (w && !w.isDestroyed()) w.close()
    return { ok: true }
  })
  /* 实体锁随面板内选中迁移（章节/人物/灵感）：面板切选 → 旧锁释放、新锁登记并广播 */
  ipcMain.handle('panel:set-entity', (e, entityId) => {
    const w = BrowserWindow.fromWebContents(e.sender)
    const p = panels.find((x) => x.win === w && !x.win.isDestroyed())
    if (!p) return { ok: false, reason: 'not-a-panel' }
    const newSpec = { ...p.spec, entityId: entityId ? String(entityId) : '' }
    const newKey = lockKeyOf(newSpec)
    if (newKey === p.key) return { ok: true, unchanged: true }
    if (locks.has(newKey)) return { ok: false, reason: 'locked' }
    const oldKey = p.key
    if (locks.get(oldKey) === oldKey) locks.delete(oldKey)
    p.spec = newSpec
    p.key = newKey
    locks.set(newKey, newKey)
    broadcast('panel:event', { kind: 'moved', key: newKey, oldKey, spec: newSpec, locks: [...locks.keys()] })
    return { ok: true }
  })
}

function onMainClosed() {
  // 级联关闭：每个面板走自己的 close 保存流程
  for (const p of panels.slice()) {
    if (!p.win.isDestroyed()) p.win.close()
  }
}

module.exports = { init, openPanel, broadcast, onMainClosed, setMainWindow: (w) => (mainWindow = w) }
