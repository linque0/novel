/* 验证回退版打包产物：顶栏无 书签/插件 按钮，设定为幕布视图 */
const PORT = 9224

class CDP {
  static async connect() {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
    const target = list.find((t) => t.type === 'page' && t.url.startsWith('app://'))
    if (!target) throw new Error('page not found')
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
    const r = await this.send('Runtime.evaluate', { expression, returnByValue: true })
    if (r.exceptionDetails) return { PAGE_ERR: r.exceptionDetails.exception?.description?.slice(0, 60) }
    return r.result?.value
  }
}

const cdp = await CDP.connect()
await new Promise((r) => setTimeout(r, 1000))
const v = await cdp.eval(`({
  topbar: [...document.querySelectorAll('.topbar button')].map(b => b.textContent.trim()),
  noBookmarkBtn: ![...document.querySelectorAll('.topbar button')].some(b => b.textContent.includes('书签') || b.textContent.includes('插件')),
  brand: !!document.querySelector('.brand')
})`)
console.log(JSON.stringify(v, null, 1))
if (v.noBookmarkBtn && v.brand) {
  console.log('VERIFY PASS: 回退版不含插件化入口')
  process.exit(0)
}
console.log('VERIFY FAIL')
process.exit(1)
