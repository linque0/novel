const { app, BrowserWindow, ipcMain, dialog, protocol, shell, clipboard } = require('electron')
const path = require('path')
const fs = require('fs')

const isDev = !!process.env.NOVEL_STUDIO_DEV || process.argv.includes('--dev')

/* 多配置支持：--profile=xxx 使用独立数据目录（测试/多开互不干扰） */
const profileArg = process.argv.find((a) => a.startsWith('--profile='))
const profileName = profileArg ? profileArg.split('=')[1].replace(/[^\w-]/g, '').slice(0, 32) : null
if (profileName) {
  app.setPath('userData', path.join(app.getPath('appData'), '小说工坊-' + profileName))
}

/** 仅放行公网 http/https 链接（拒绝本地/私有/保留地址），其余一律不在应用内打开 */
function isPublicHttpUrl(url) {
  try {
    const u = new URL(url)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
    const h = u.hostname.toLowerCase()
    if (h === 'localhost' || h === '0.0.0.0' || h === '::1' || h.endsWith('.local') || h.endsWith('.internal')) return false
    if (/^127\.|^10\.|^192\.168\.|^169\.254\./.test(h)) return false
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return false
    if (/^22[4-9]\.|^2[3-5]\d\./.test(h)) return false
    return true
  } catch {
    return false
  }
}

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }
])

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff'
}

let win = null

function createWindow() {
  win = new BrowserWindow({
    width: 1400,
    height: 880,
    minWidth: 1080,
    minHeight: 680,
    backgroundColor: '#f6f2e7',
    title: '小说工坊' + (profileName ? ' · ' + profileName : ''),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false
    }
  })
  win.setMenuBarVisibility(false)
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isPublicHttpUrl(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (e, url) => {
    // 同地址刷新放行；跨页导航一律拦下，外部 http(s) 链接转交系统浏览器
    if (url === win.webContents.getURL()) return
    e.preventDefault()
    if (isPublicHttpUrl(url)) shell.openExternal(url)
  })
  win.webContents.on('console-message', (_e, _level, message, line, source) => {
    if (!message.includes('DevTools')) console.log(`[renderer] ${message} (${source}:${line})`)
  })

  if (isDev) {
    win.loadURL('http://127.0.0.1:5173')
  } else {
    win.loadURL('app://local/index.html')
  }

  // 关闭前等待渲染进程把脏数据落盘（最长 1.5s），避免最后 1 秒输入丢失
  win.on('close', (e) => {
    if (win.__flushed) return
    e.preventDefault()
    const done = () => {
      if (!win || win.__flushed) return
      win.__flushed = true
      win.close()
    }
    const t = setTimeout(done, 1500)
    win.webContents
      .executeJavaScript('window.__flushNow ? window.__flushNow() : 0', true)
      .then(() => {
        clearTimeout(t)
        done()
      })
      .catch(() => {})
  })

  win.on('closed', () => {
    win = null
  })
}

function serveDist(req) {
  const distRoot = path.resolve(__dirname, '..', 'dist')
  const u = new URL(req.url)
  let rel = decodeURIComponent(u.pathname || '/')
  if (rel === '/' || rel === '') rel = '/index.html'
  if (rel.includes('\0') || rel.includes('\\')) return new Response('forbidden', { status: 403 })
  const target = path.resolve(distRoot, '.' + rel)
  // 边界校验：解析后的目标必须仍在 dist 目录内
  if (target !== distRoot && !target.startsWith(distRoot + path.sep)) {
    return new Response('forbidden', { status: 403 })
  }
  try {
    const st = fs.statSync(target)
    if (!st.isFile()) return new Response('not found', { status: 404 })
    const buf = fs.readFileSync(target)
    return new Response(buf, {
      headers: { 'content-type': MIME[path.extname(target).toLowerCase()] || 'application/octet-stream' }
    })
  } catch {
    return new Response('not found', { status: 404 })
  }
}

function startMain() {
  if (!isDev) {
    protocol.handle('app', serveDist)
  }
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
}

app.whenReady().then(startMain)
app.on('window-all-closed', () => app.quit())

/* ---------------- IPC：文件选择 / 导入 / 导出 ---------------- */

ipcMain.handle('import:pick', async (_e, opts) => {
  const res = await dialog.showOpenDialog(win, {
    properties: ['openFile', 'multiSelections'],
    filters: opts?.filters || [
      {
        name: '所有支持格式',
        extensions: ['txt', 'md', 'markdown', 'docx', 'pdf', 'epub', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg', 'avif']
      }
    ]
  })
  if (res.canceled) return { canceled: true }
  const files = []
  for (const p of res.filePaths) {
    const buf = fs.readFileSync(p)
    files.push({
      name: path.basename(p),
      ext: path.extname(p).toLowerCase().replace('.', ''),
      data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
    })
  }
  return { canceled: false, files }
})

ipcMain.handle('docx:toHtml', async (_e, payload) => {
  const mammoth = require('mammoth')
  const buf = Buffer.from(payload.data)
  const res = await mammoth.convertToHtml(
    { buffer: buf },
    {
      styleMap: [
        "p[style-name='Title'] => h1:fresh",
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h1:fresh",
        "p[style-name='Heading 3'] => h2:fresh"
      ]
    }
  )
  return { html: res.value }
})

ipcMain.handle('clip:readText', () => clipboard.readText())
ipcMain.handle('clip:writeText', (_e, text) => clipboard.writeText(String(text ?? '')))

ipcMain.handle('export:save', async (_e, payload) => {  const res = await dialog.showSaveDialog(win, { defaultPath: payload.defaultName || 'export.txt' })
  if (res.canceled || !res.filePath) return { canceled: true }
  if (payload.isBase64) {
    fs.writeFileSync(res.filePath, Buffer.from(payload.content, 'base64'))
  } else {
    fs.writeFileSync(res.filePath, payload.content, 'utf-8')
  }
  return { canceled: false, path: res.filePath }
})
