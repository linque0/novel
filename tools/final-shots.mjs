/* 最终交付截图：书架 / 工作台（演示数据） */
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const here = dirname(fileURLToPath(import.meta.url))
const PORT = 9222

class CDP {
  static async connect() {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
    const target = list.find((t) => t.type === 'page' && t.url.startsWith('app://'))
    const ws = new WebSocket(target.webSocketDebuggerUrl)
    await new Promise((res, rej) => ((ws.onopen = res), (ws.onerror = rej)))
    const cdp = new CDP(ws)
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data)
      if (msg.id && cdp.pending.has(msg.id)) {
        const { res, rej } = cdp.pending.get(msg.id)
        cdp.pending.delete(msg.id)
        msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result)
      }
    }
    return cdp
  }
  constructor(ws) {
    this.ws = ws
    this.id = 0
    this.pending = new Map()
  }
  send(method, params = {}) {
    const id = ++this.id
    this.ws.send(JSON.stringify({ id, method, params }))
    return new Promise((res, rej) => this.pending.set(id, { res, rej }))
  }
  async eval(expression) {
    const r = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || JSON.stringify(r.exceptionDetails))
    return r.result?.value
  }
  async shot(name) {
    const { data } = await this.send('Page.captureScreenshot', { format: 'png' })
    writeFileSync(resolve(here, name), Buffer.from(data, 'base64'))
  }
}

import { writeFileSync } from 'node:fs'
const cdp = await CDP.connect()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

await cdp.shot('final-shelf.png')
await cdp.eval(`document.querySelector('.book-card').click()`)
await sleep(1200)
await cdp.shot('final-workbench.png')
/* 夜间主题预览 */
await cdp.eval(`window.__setTheme = async () => { const { useUiStore } = await import('/src/stores/ui.js') }`)
await cdp.eval(`document.querySelector('.topbar .n-select .n-base-selection').dispatchEvent(new MouseEvent('click', { bubbles: true }))`)
await sleep(400)
await cdp.eval(`[...document.querySelectorAll('.n-base-select-option')].find(o => o.textContent.includes('羊皮纸'))?.click()`)
await sleep(600)
await cdp.shot('final-parchment.png')
await cdp.eval(`document.querySelector('.topbar .n-select .n-base-selection').dispatchEvent(new MouseEvent('click', { bubbles: true }))`)
await sleep(400)
await cdp.eval(`[...document.querySelectorAll('.n-base-select-option')].find(o => o.textContent.includes('宣纸'))?.click()`)
await sleep(400)
console.log('screenshots saved')
process.exit(0)
