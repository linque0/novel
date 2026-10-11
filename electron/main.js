const { app, BrowserWindow, ipcMain, dialog, protocol, shell, clipboard, safeStorage } = require('electron')
const path = require('path')
const fs = require('fs')
const panels = require('./panels')

const isDev = !!process.env.NOVEL_STUDIO_DEV || process.argv.includes('--dev')

/* 多配置支持：--profile=xxx 使用独立数据目录（测试/多开互不干扰）。
   profile 名走锚定白名单校验（仅字母/数字/下划线/连字符，1–32 位），不合法一律回退默认目录，
   确保命令行参数没有任何字符能进入路径拼接 */
const profileArg = process.argv.find((a) => a.startsWith('--profile='))
const PROFILE_NAME_RE = /^[A-Za-z0-9_-]{1,32}$/
const profileRaw = profileArg ? profileArg.slice('--profile='.length) : ''
const profileName = PROFILE_NAME_RE.test(profileRaw) ? profileRaw : null

/* 自定义数据存储位置：指针文件固定存放在默认 userData 下（不随迁移移动），启动最早期重定向。
   所选目录只作为父目录，实际数据目录固定为其中的「小说工坊」子目录；指针目录须已含数据
   （IndexedDB）才重定向，否则回退默认位置并在设置面板提示（dataDirFallback）。 */
const defaultUserData = path.join(app.getPath('appData'), '小说工坊' + (profileName ? '-' + profileName : ''))
const DATA_DIR_FILE = path.join(defaultUserData, 'data-dir.json')
let dataDirFallback = false

function samePath(a, b) {
  const ra = path.resolve(a)
  const rb = path.resolve(b)
  return process.platform === 'win32' ? ra.toLowerCase() === rb.toLowerCase() : ra === rb
}

function isInside(child, parent) {
  const rel = path.relative(path.resolve(parent), path.resolve(child))
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
}

function readDataDirPointer() {
  try {
    const parsed = JSON.parse(fs.readFileSync(DATA_DIR_FILE, 'utf-8'))
    const dir = typeof parsed?.dir === 'string' ? parsed.dir : null
    /* 指针文件可能被磁盘写入者篡改：只接受绝对路径，拒绝 NUL 与任意分隔符写法的 .. 上跳 */
    if (!dir || !path.isAbsolute(dir) || dir.includes('\0') || /(^|[\\/])\.\.(?:[\\/]|$)/.test(dir)) return null
    return dir
  } catch {
    return null
  }
}

const customDir = readDataDirPointer()
const useCustomDir =
  customDir && !samePath(customDir, defaultUserData) && fs.existsSync(path.join(customDir, 'IndexedDB'))
if (customDir && !useCustomDir && !samePath(customDir, defaultUserData)) dataDirFallback = true
app.setPath('userData', useCustomDir ? customDir : defaultUserData)

/* 数据迁移期间挂起 window-all-closed 退出：迁移须在全部窗口关闭后继续拷贝/换位/写指针 */
let dataMigrating = false

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
    panels.onMainClosed()
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
  panels.init()
  createWindow()
  panels.setMainWindow(win)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
}

app.whenReady().then(startMain)
app.on('window-all-closed', () => {
  if (!dataMigrating) app.quit()
})

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

ipcMain.handle('export:save', async (_e, payload) => {  /* v1.0.6：带 dirPath 时跳过对话框直接写入（逐章分批导出仅首次确认位置） */
  /* v1.0.22 路径加固：dirPath 必须是绝对路径且解析后不含 .. 逃逸；文件名取 basename 防拼接逃逸 */
  if (!payload || typeof payload.content !== 'string') return { canceled: true }
  let filePath
  if (payload.dirPath) {
    if (typeof payload.dirPath !== 'string' || !path.isAbsolute(payload.dirPath) || payload.dirPath.includes('\0')) {
      return { canceled: true }
    }
    const dir = path.resolve(payload.dirPath)
    if (dir.split(path.sep).includes('..')) return { canceled: true }
    fs.mkdirSync(dir, { recursive: true })
    filePath = path.join(dir, path.basename(String(payload.defaultName || 'export.txt')))
  } else {
    const res = await dialog.showSaveDialog(win, { defaultPath: payload.defaultName || 'export.txt' })
    if (res.canceled || !res.filePath) return { canceled: true }
    filePath = res.filePath
  }
  if (payload.isBase64) {
    fs.writeFileSync(filePath, Buffer.from(payload.content, 'base64'))
  } else {
    fs.writeFileSync(filePath, payload.content, 'utf-8')
  }
  return { canceled: false, path: filePath }
})

/* ---------------- IPC：AI 凭据加解密（safeStorage / Windows DPAPI，方案 §三/§六.4） ----------------
 * 主进程只做加解密，不经手存储：密文由渲染层写入 Dexie appconfig（键 ai.credential）。
 * credential:put 明文进 → base64 密文出；返回 null = 本机加密不可用
 * credential:get 密文进 → 明文出；返回 null = 密文无效或解密失败（需重新配置密钥）
 */

ipcMain.handle('credential:put', (_e, plain) => {
  if (typeof plain !== 'string') throw new Error('credential:put 只接受字符串明文')
  if (!safeStorage.isEncryptionAvailable()) return null
  return safeStorage.encryptString(plain).toString('base64')
})

ipcMain.handle('credential:get', (_e, cipherB64) => {
  if (typeof cipherB64 !== 'string' || !cipherB64) return null
  try {
    return safeStorage.decryptString(Buffer.from(cipherB64, 'base64'))
  } catch {
    return null
  }
})

/* ---------------- IPC：数据存储位置（自定义数据目录；迁移需关闭应用重启生效） ----------------
 * 流程：data:move 只做校验并回复 ok → 异步执行迁移：关主窗口（走既有 flush 流程）→
 * closed 事件级联关闭全部面板（各自 flush）→ 等窗口全销毁 → 复制旧 userData 到暂存目录 →
 * 换位 + 写/删指针 → relaunch。指针文件在默认 userData（DATA_DIR_FILE），重启后按其重定向。
 * 失败路径：删暂存、错误框提示、不改指针重启 —— 原位置数据完好。 */

/* 迁移排除的易变缓存/锁文件（体积大头与运行期句柄，拷了也会失效） */
const MIGRATE_EXCLUDE = new Set([
  'Cache',
  'Code Cache',
  'GPUCache',
  'DawnCache',
  'DawnGraphiteCache',
  'DawnWebGPUCache',
  'ShaderCache',
  'Crashpad',
  'Crash Reports',
  'logs',
  'lockfile',
  'DevToolsActivePort'
])

function copyProfileDir(src, dest) {
  fs.cpSync(src, dest, {
    recursive: true,
    filter: (p) => !MIGRATE_EXCLUDE.has(path.basename(p))
  })
}

ipcMain.handle('data:location', () => {
  const current = app.getPath('userData')
  return {
    current,
    isCustom: !samePath(current, defaultUserData),
    defaultDir: defaultUserData,
    fallback: dataDirFallback
  }
})

ipcMain.handle('data:pickDir', async () => {
  const res = await dialog.showOpenDialog(win, {
    title: '选择数据存储位置',
    buttonLabel: '选择此目录',
    properties: ['openDirectory', 'createDirectory']
  })
  if (res.canceled || !res.filePaths?.length) return { canceled: true }
  return { canceled: false, dir: res.filePaths[0] }
})

ipcMain.handle('data:openFolder', () => shell.openPath(app.getPath('userData')))

ipcMain.handle('data:move', (_e, payload) => {
  const current = app.getPath('userData')
  const wantDefault = !payload || typeof payload.dir !== 'string' || !payload.dir.trim()
  let landing
  if (wantDefault) {
    landing = path.resolve(defaultUserData)
  } else {
    const dir = payload.dir.trim()
    /* .. 检查须同时覆盖 \ 与 / 写法（仅查 path.sep 会被 C:/a/../b 绕过） */
    if (!path.isAbsolute(dir) || dir.includes('\0') || /(^|[\\/])\.\.(?:[\\/]|$)/.test(dir)) {
      return { ok: false, error: '目录路径无效' }
    }
    landing = path.resolve(path.join(dir, '小说工坊'))
  }
  if (samePath(landing, current)) {
    return { ok: false, error: wantDefault ? '当前已使用默认存储位置' : '新位置与当前位置相同' }
  }
  /* 目标与当前互不嵌套，避免把数据目录拷进自身 */
  if (isInside(landing, current) || isInside(current, landing)) {
    return { ok: false, error: '新位置不能与当前数据目录嵌套' }
  }
  /* 落地目录已非空 → 拒绝（恢复默认分支除外：旧默认数据走整体换位让位） */
  if (!wantDefault) {
    try {
      if (fs.existsSync(landing) && fs.readdirSync(landing).length > 0) {
        return { ok: false, error: '目标位置已存在非空的「小说工坊」目录，请更换目录或先清理' }
      }
    } catch {
      /* 读取失败留给写探针报错 */
    }
  }
  try {
    fs.mkdirSync(landing, { recursive: true })
    const probe = path.join(landing, `.ns-probe-${Date.now()}`)
    fs.writeFileSync(probe, 'ok')
    fs.unlinkSync(probe)
  } catch (err) {
    return { ok: false, error: '目标位置不可写：' + (err?.code || err?.message || '未知错误') }
  }
  /* 校验全部通过：先回复渲染层（显示“正在迁移”），再异步执行迁移 */
  setTimeout(() => performDataMigration({ current, landing, wantDefault }), 80)
  return { ok: true }
})

async function performDataMigration({ current, landing, wantDefault }) {
  dataMigrating = true // 挂起 window-all-closed 的 app.quit，迁移完成后显式 relaunch+exit
  const stage = landing + '.migrating'
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  try {
    /* 1) 关闭主窗口（close 事件先 flush 再关），closed 级联关闭全部面板；限时兜底强杀 */
    if (win && !win.isDestroyed()) win.close()
    const deadline = Date.now() + 8000
    while (BrowserWindow.getAllWindows().length > 0 && Date.now() < deadline) await sleep(100)
    for (const w of BrowserWindow.getAllWindows()) if (!w.isDestroyed()) w.destroy()
    await sleep(600) // 等渲染/工具进程释放 LevelDB 文件句柄
    console.log('[data] 窗口已全部关闭，开始复制', current, '→', stage)

    /* 2) 复制到暂存目录（与落地目录同卷，换位为近原子 rename） */
    fs.rmSync(stage, { recursive: true, force: true })
    copyProfileDir(current, stage)

    /* 3) 换位：Windows 的 rename 不能落到已存在目录——自定义迁移落地处只可能是校验阶段的
       空占位（非空已被拒绝），先移除；恢复默认时旧默认目录（迁移前快照）先整体让位再删，
       换位失败可回滚，避免新旧 LevelDB 文件混杂 */
    if (wantDefault) {
      const oldDir = landing + '.old-' + Date.now()
      fs.renameSync(landing, oldDir)
      try {
        fs.renameSync(stage, landing)
      } catch (e) {
        fs.renameSync(oldDir, landing)
        throw e
      }
      try {
        fs.rmSync(oldDir, { recursive: true, force: true })
      } catch (e) {
        console.warn('[data] 旧默认目录清理失败（不影响使用，可手动删除）：', oldDir, e?.message)
      }
    } else {
      fs.rmSync(landing, { recursive: true, force: true })
      fs.renameSync(stage, landing)
      fs.mkdirSync(path.dirname(DATA_DIR_FILE), { recursive: true })
      fs.writeFileSync(DATA_DIR_FILE, JSON.stringify({ dir: landing, at: new Date().toISOString() }), 'utf-8')
    }
    if (wantDefault) fs.rmSync(DATA_DIR_FILE, { force: true }) // 指针随旧目录让位，此处兜底
    console.log('[data] 换位完成 →', landing)
    if (!fs.existsSync(path.join(landing, 'IndexedDB'))) throw new Error('迁移完成但未找到 IndexedDB 数据目录')
    console.log('[data] 迁移完成，重启应用（指针：' + (wantDefault ? '已删除' : DATA_DIR_FILE) + '）')
    app.relaunch()
    app.exit(0)
  } catch (err) {
    console.error('[data] 迁移失败：', err)
    try {
      fs.rmSync(stage, { recursive: true, force: true })
    } catch {}
    dialog.showErrorBox('数据迁移失败', `数据未迁移，应用将按原位置重启。\n\n${err?.message || err}`)
    app.relaunch()
    app.exit(1)
  }
}
