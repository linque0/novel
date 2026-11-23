/**
 * 应用内更新 Electron 主进程 IPC 桥接层：
 * 绑定 GitHub Releases 查询、NsisUpdater 下载/静默安装、全部窗口保存屏障，
 * 并通过主框架来源校验限制仅受信任渲染页可触发更新通道。
 */
const { app, autoUpdater, BrowserWindow, ipcMain, net, shell } = require('electron')
const { existsSync } = require('node:fs')
const path = require('node:path')
const { createUpdates, latest } = require('./updates.cjs')

/** 请求 GitHub Latest Release API（禁止自动重定向、12s 超时），返回 JSON 或 null（404）。 */
async function fetchRelease() {
  let response
  try {
    response = await net.fetch(latest, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Novel-Studio' },
      redirect: 'error',
      signal: AbortSignal.timeout(12000)
    })
  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') throw new Error('连接 GitHub 超时，请重试。')
    console.warn('[update] GitHub release check:', error.message)
    throw new Error('无法连接 GitHub，请检查网络后重试。')
  }
  if (response.status === 404) return null
  if (response.status === 403 || response.status === 429) throw new Error('GitHub 暂时限制了检查请求，请稍后重试。')
  if (!response.ok) throw new Error('GitHub 暂时无法提供发布信息，请重试。')
  try { return await response.json() } catch { throw new Error('未能读取 GitHub 发布信息，请重试。') }
}

/** 创建受控 NsisUpdater：关闭自动下载、差量下载与网页安装器，仅允许校验后的整包升级。 */
function makeUpdater(url) {
  const { NsisUpdater } = require('electron-updater')
  // Resolve both the manifest and its one approved installer against the selected tag.
  const updater = new NsisUpdater({ provider: 'generic', url })
  updater.autoDownload = false
  updater.autoInstallOnAppQuit = false
  updater.allowPrerelease = false
  updater.allowDowngrade = false
  updater.disableWebInstaller = true
  updater.disableDifferentialDownload = true
  updater.on('error', error => console.warn('[update]', error.message))
  /* 2s 内监听 before-quit-for-update 确认安装程序已接管退出，超时则回滚状态 */
  updater.installAndQuit = () => new Promise((resolve, reject) => {
    const quit = () => { clearTimeout(timeout); resolve() }
    const timeout = setTimeout(() => {
      autoUpdater.removeListener('before-quit-for-update', quit)
      reject(new Error('无法启动安装，请重试或前往 GitHub 发布页。'))
    }, 2000)
    autoUpdater.once('before-quit-for-update', quit)
    try { updater.quitAndInstall(true, true) } catch (error) {
      clearTimeout(timeout)
      autoUpdater.removeListener('before-quit-for-update', quit)
      reject(error)
    }
  })
  return updater
}

/** 安装前向全部存活窗口执行保存屏障（15s 超时），确保脏数据落盘且期间无新窗口打开。 */
async function prepareWindows() {
  const windows = BrowserWindow.getAllWindows().filter(window => !window.isDestroyed())
  const request = (window, action) => window.webContents.executeJavaScript(
    `window.__updateSaveBarrier?.(${JSON.stringify(action)})`, true)
  const resume = async () => {
    for (const window of windows) {
      if (!window.isDestroyed()) request(window, 'resume').catch(() => {})
    }
  }
  let timer
  try {
    const result = await Promise.race([
      Promise.all(windows.map(window => request(window, 'prepare'))),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('等待窗口保存超时，请稍后重试。')), 15000) })
    ])
    const current = BrowserWindow.getAllWindows().filter(window => !window.isDestroyed())
    if (result.some(saved => saved !== true) || current.some(window => !windows.includes(window))) {
      throw new Error('仍有窗口未确认保存，请检查后再安装。')
    }
    return resume
  } catch (error) {
    await resume()
    throw error
  } finally {
    clearTimeout(timer)
  }
}

/** 注册 update:* IPC 通道，并返回「当前是否处于 installing 态」的门禁查询函数。 */
function initUpdateIPC({ isDev, getMainWindow, blocked }) {
  const supported = process.platform === 'win32' && (app.isPackaged || isDev)
  /* 仅 NSIS 安装版（存在安装标记与 app-update.yml）才允许应用内一键安装，便携版降级为外链跳转 */
  const canInstall = supported && app.isPackaged && !isDev && process.arch === 'x64' &&
    existsSync(path.join(path.dirname(app.getPath('exe')), 'novel-studio-nsis.install')) &&
    existsSync(path.join(process.resourcesPath, 'app-update.yml'))
  const updates = createUpdates({
    current: app.getVersion(), supported, canInstall, fetchRelease, makeUpdater, prepareWindows, blocked,
    notify() {
      const main = getMainWindow()
      for (const window of BrowserWindow.getAllWindows()) {
        if (!window.isDestroyed()) window.webContents.send('update:state', updates.snapshot(window === main))
      }
    }
  })
  const mainSender = event => event.sender === getMainWindow()?.webContents
  /* 来源守卫：仅允许本地开发页或正式包 app://local 主框架调用更新通道 */
  const trusted = event => {
    if (event.senderFrame !== event.sender.mainFrame || !BrowserWindow.fromWebContents(event.sender)) return false
    const frameUrl = event.senderFrame?.url
    if (!frameUrl) return false
    const url = new URL(frameUrl)
    return isDev ? url.origin === 'http://127.0.0.1:5173' : url.protocol === 'app:' && url.hostname === 'local'
  }
  function handle(channel, callback) {
    ipcMain.handle('update:' + channel, async (event, arg) => {
      if (!trusted(event)) return null
      await callback(event, arg)
      return updates.snapshot(mainSender(event))
    })
  }
  handle('state', () => {})
  handle('check', (event, startup) => {
    if (startup === true) {
      if (!isDev && mainSender(event)) return updates.check(true)
    } else return updates.check()
  })
  handle('dismiss', event => { if (mainSender(event)) updates.dismiss() })
  handle('download', () => updates.download())
  handle('install', () => updates.install())
  handle('open', (_, kind) => {
    if (kind === 'release' || kind === 'repository') return shell.openExternal(updates.url(kind))
  })
  return () => updates.snapshot().status === 'installing'
}

module.exports = { initUpdateIPC }
