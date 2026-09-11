/* HTML → PDF：无头 Chrome + CDP Page.printToPDF
   保留 CSS 页面尺寸（preferCSSPageSize），带页脚页码。 */
import { writeFileSync, mkdtempSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'
import { spawn } from 'node:child_process'

const here = dirname(fileURLToPath(import.meta.url))
const [htmlArg, pdfArg] = process.argv.slice(2)
const html = resolve(htmlArg || join(here, '../docs/产品介绍-图文版.html'))
const pdf = resolve(pdfArg || join(here, '../docs/产品介绍-图文版.pdf'))

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORT = 9333

const profile = mkdtempSync(join(tmpdir(), 'ns-pdf-'))
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
const url = pathToFileURL(html).href
await send('Page.navigate', { url })
await sleep(2500)

/* 等待全部图片解码完成 + 字体就绪 */
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
if (info.broken?.length) console.log('WARN broken images above')

/* 溢出检测：.page 固定 A4 高，内容超出即被裁掉（打印不可见） */
const overflow = await send('Runtime.evaluate', {
  expression: `(() => {
    const WARN = 2  // 容忍 2px 亚像素误差
    const pages = [...document.querySelectorAll('.page')]
    return pages.map((p, i) => {
      const over = p.scrollHeight - p.clientHeight
      // 页脚绝对定位于底部，若正文最后元素压过页脚上沿，同样算溢出
      let lastBottom = 0
      for (const el of p.children) {
        if (el.classList.contains('p-foot')) continue
        const r = el.getBoundingClientRect(), pr = p.getBoundingClientRect()
        lastBottom = Math.max(lastBottom, r.bottom - pr.top)
      }
      const foot = p.querySelector('.p-foot')
      const footTop = foot ? foot.getBoundingClientRect().top - p.getBoundingClientRect().top : p.clientHeight
      return { page: i + 1, over, lastBottom: Math.round(lastBottom), footTop: Math.round(footTop), bad: over > WARN || lastBottom > footTop + WARN }
    }).filter((x) => x.bad)
  })()`,
  returnByValue: true
})
const bad = overflow.result.value
if (bad.length) {
  console.log('OVERFLOW on pages:', bad.map((b) => `p${b.page}(+${b.over}px, content ${b.lastBottom} > foot ${b.footTop})`).join('  '))
} else {
  console.log('overflow: none — all pages fit')
}

const { data } = await send('Page.printToPDF', {
  printBackground: true,
  preferCSSPageSize: true,
  displayHeaderFooter: false,
  marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0
})
writeFileSync(pdf, Buffer.from(data, 'base64'))
console.log('PDF written:', pdf, Math.round(Buffer.from(data, 'base64').length / 1024) + ' KB')

ws.close()
chrome.kill()
process.exit(0)
