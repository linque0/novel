/* HTML → 逐页 PNG：用无头 Chrome 打开 A4 文档，按 .page 元素逐页截图，
   供视觉验收（PDF 页面渲染）使用。
   用法：node tools/html-to-page-png.mjs [html] [outDir] */
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawn } from 'node:child_process'

const here = dirname(fileURLToPath(import.meta.url))
const html = resolve(process.argv[2] || join(here, '../docs/产品介绍-图文版.html'))
const outDir = resolve(process.argv[3] || mkdtempSync(join(tmpdir(), 'ns-intro-pages-')))
mkdirSync(outDir, { recursive: true })

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORT = 9334
const profile = mkdtempSync(join(tmpdir(), 'ns-png-'))
const chrome = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-gpu',
  '--hide-scrollbars',
  '--allow-file-access-from-files',
  'about:blank'
], { stdio: 'ignore', detached: false })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function waitForTarget() {
  for (let i = 0; i < 40; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
      const t = list.find((x) => x.type === 'page')
      if (t?.webSocketDebuggerUrl) return t
    } catch { /* 未就绪 */ }
    await sleep(500)
  }
  throw new Error('Chrome 调试端口未就绪')
}

const target = await waitForTarget()
const ws = new WebSocket(target.webSocketDebuggerUrl)
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

await send('Page.enable')
await send('Emulation.setDeviceMetricsOverride', {
  width: 900, height: 1200, deviceScaleFactor: 1.5, mobile: false
})
await send('Page.navigate', { url: pathToFileURL(html).href })
await sleep(2600)

const ready = await send('Runtime.evaluate', {
  expression: `(async () => {
    const imgs = [...document.images]
    await Promise.all(imgs.map((im) => im.complete ? null : new Promise((r) => { im.onload = im.onerror = r })))
    if (document.fonts?.ready) await document.fonts.ready
    return { images: imgs.length, broken: imgs.filter((i) => !i.naturalWidth).map((i) => i.getAttribute('src')) }
  })()`,
  returnByValue: true,
  awaitPromise: true
})
const info = ready.result.value
console.log('images:', info.images, 'broken:', info.broken.length ? info.broken : '(none)')

const count = await send('Runtime.evaluate', {
  expression: `document.querySelectorAll('.page').length`,
  returnByValue: true
})
const total = count.result.value
console.log('pages:', total, '->', outDir)

for (let i = 0; i < total; i++) {
  const rect = await send('Runtime.evaluate', {
    expression: `(() => {
      const r = document.querySelectorAll('.page')[${i}].getBoundingClientRect()
      return {
        x: Math.max(0, Math.round(r.left + window.scrollX)),
        y: Math.max(0, Math.round(r.top + window.scrollY)),
        width: Math.round(r.width),
        height: Math.round(r.height)
      }
    })()`,
    returnByValue: true
  })
  const r = rect.result.value
  const { data } = await send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: true,
    clip: { x: r.x, y: r.y, width: r.width, height: r.height, scale: 1 }
  })
  const file = join(outDir, `page-${String(i + 1).padStart(2, '0')}.png`)
  writeFileSync(file, Buffer.from(data, 'base64'))
  console.log(`  ${file}  ${r.width}x${r.height} @ ${r.x},${r.y}`)
}

ws.close()
chrome.kill()
process.exit(0)
