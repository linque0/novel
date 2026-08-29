/* 疑点清查：实例数量、选区保持、挂载时序 */
const PORT = 9222

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
    const r = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (r.exceptionDetails) return { PAGE_ERR: r.exceptionDetails.exception?.description || r.exceptionDetails.text }
    return r.result?.value
  }
}

const cdp = await CDP.connect()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

console.log('tiptap nodes:', await cdp.eval(`document.querySelectorAll('.rich-host .tiptap, .ProseMirror').length`))
console.log('doc size:', await cdp.eval(`window.__ns.editor.state.doc.content.size`))
await cdp.eval(`window.__ns.editor.commands.setTextSelection({from:20,to:26})`)
console.log('sel immediately:', JSON.stringify(await cdp.eval(`(()=>{const s=window.__ns.editor.state.selection;return{from:s.from,to:s.to}})()`)))
await sleep(100)
console.log('sel after 100ms:', JSON.stringify(await cdp.eval(`(()=>{const s=window.__ns.editor.state.selection;return{from:s.from,to:s.to}})()`)))
await sleep(1200)
console.log('sel after 1300ms (autosave flush window):', JSON.stringify(await cdp.eval(`(()=>{const s=window.__ns.editor.state.selection;return{from:s.from,to:s.to}})()`)))
console.log('bold plain:', JSON.stringify(await cdp.eval(`(()=>{const ed=window.__ns.editor;const ok=ed.commands.toggleBold();return{ok,strong:/<strong>/.test(ed.getHTML())}})()`)))
process.exit(0)
