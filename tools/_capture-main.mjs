/* 主进程侧截图：经 --inspect 连 Node inspector，用 webContents.capturePage() 取图。
   与窗口是否可见/前台无关（渲染进程被遮挡或最小化时 Page.captureScreenshot 会挂起，capturePage 不会）。 */
import { writeFileSync } from 'node:fs'

const PORT = 9229

async function connectInspector() {
  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
  const t = list[0]
  const ws = new WebSocket(t.webSocketDebuggerUrl)
  await new Promise((r, j) => ((ws.onopen = r), (ws.onerror = j)))
  let id = 0
  const pending = new Map()
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data)
    if (m.id && pending.has(m.id)) {
      const { res, rej } = pending.get(m.id)
      pending.delete(m.id)
      m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result)
    }
  }
  const send = (method, params = {}) => {
    const i = ++id
    ws.send(JSON.stringify({ id: i, method, params }))
    return new Promise((res, rej) => pending.set(i, { res, rej }))
  }
  await send('Runtime.enable')
  return { send, ws }
}

/** 在主进程内执行表达式（可 require electron / fs），返回其值 */
async function evalMain(ins, expression) {
  const r = await ins.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, includeCommandLineAPI: true })
  if (r.exceptionDetails) {
    const d = r.exceptionDetails.exception?.description || r.exceptionDetails.text
    throw new Error(String(d).slice(0, 400))
  }
  return r.result?.value
}

/**
 * 按 webContents URL 关键字截图到 outPath。
 * @param {object} ins  inspector 连接
 * @param {string} match  URL 关键字（主窗口用 'index.html' 或 '127.0.0.1:5173/'）
 * @param {string} outPath 输出 PNG 绝对路径
 * @param {object} opts  { skip, exclude } —— exclude 命中的 URL 一律排除（主窗口需排除 'panel='）
 */
export async function captureWindow(ins, match, outPath, opts = {}) {
  const { skip = 0, exclude = null } = typeof opts === 'number' ? { skip: opts } : opts
  const filter = `const wins = BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed() && String(w.webContents.getURL()).includes(${JSON.stringify(match)})${exclude ? ` && !String(w.webContents.getURL()).includes(${JSON.stringify(exclude)})` : ''})`
  /* 关键：被遮挡的后台窗口 Chromium 不重绘，capturePage 会拿到过期帧。
     这里关闭后台节流 + 临时置顶并聚焦，强制合成一帧后再取图。 */
  await evalMain(
    ins,
    `(async () => {
      const { BrowserWindow } = require('electron')
      ${filter}
      const w = wins[${skip}]
      if (!w) return 0
      w.webContents.setBackgroundThrottling(false)
      if (w.isMinimized()) w.restore()
      w.show()
      w.setAlwaysOnTop(true)
      w.focus()
      w.webContents.invalidate()
      await new Promise((r) => setTimeout(r, 900))
      return 1
    })()`
  )
  const b64 = await evalMain(
    ins,
    `(async () => {
      const { BrowserWindow } = require('electron')
      ${filter}
      const w = wins[${skip}]
      if (!w) return { err: 'no window for ' + ${JSON.stringify(match)} + ' :: ' + BrowserWindow.getAllWindows().map((x) => x.webContents.getURL()).join(' | ') }
      const img = await w.webContents.capturePage()
      w.setAlwaysOnTop(false)
      return { png: img.toPNG().toString('base64'), size: img.getSize(), url: w.webContents.getURL() }
    })()`
  )
  if (b64?.err) throw new Error(b64.err)
  if (!b64.size || !b64.size.width) throw new Error('capturePage returned empty image for ' + match)
  writeFileSync(outPath, Buffer.from(b64.png, 'base64'))
  return { size: b64.size, url: b64.url, bytes: Math.round((b64.png.length * 3) / 4) }
}

export { connectInspector, evalMain }
