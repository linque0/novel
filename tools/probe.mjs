/* 完整复现：Enter 建节点 → 右键降级 + 下拉 body 点击 */
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
  async key(key, code, vk, modifiers = 0) {
    await this.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, modifiers })
    await this.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, modifiers })
  }
}

const cdp = await CDP.connect()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

await cdp.eval(`location.reload()`)
await sleep(1800)
await cdp.eval(`[...document.querySelectorAll('.book-card')].find(c => c.textContent.includes('星尘旅人')).click()`)
await sleep(900)
await cdp.eval(`document.querySelectorAll('.rail-item')[3].click()`)
await sleep(400)
await cdp.eval(`(() => {
  const node = [...document.querySelectorAll('.n-tree-node')].find(n => n.textContent.includes('观测站'))
  ;(node?.querySelector('.n-tree-node-content') || node)?.click()
})()`)
await sleep(600)

/* 建第二个节点 */
await cdp.eval(`(() => {
  const el = document.querySelector('.ob-text')
  el.focus()
  const r = document.createRange(); r.selectNodeContents(el); r.collapse(false)
  const s = getSelection(); s.removeAllRanges(); s.addRange(r)
})()`)
await cdp.key('Enter', 'Enter', 13)
await sleep(300)
console.log('rows before:', await cdp.eval(`document.querySelectorAll('.ob-row').length`))

/* 右键最后一行 → 菜单 → 降级 */
await cdp.eval(`(() => {
  const rows = [...document.querySelectorAll('.ob-row')]
  rows[rows.length - 1].dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 500, clientY: 400 }))
})()`)
await sleep(300)
console.log('ctx open:', await cdp.eval(`!!document.querySelector('.ob-ctx')`))
await cdp.eval(`[...document.querySelectorAll('.ob-ctx .ctx-item')].find(i => i.textContent.trim() === '降级')?.click()`)
await sleep(400)
console.log('guides after:', JSON.stringify(await cdp.eval(`[...document.querySelectorAll('.ob-row')].map(r => r.querySelectorAll('.ob-guide').length)`)))
console.log('tree:', JSON.stringify(await cdp.eval(`window.__obState ? window.__obState().map(n => ({ t: n.text.slice(0, 6), ch: n.children.length })) : 'no hook'`)))

/* 下拉 body 点击（重命名路径） */
await cdp.eval(`document.querySelectorAll('.rail-item')[0].click()`)
await sleep(300)
await cdp.eval(`document.querySelectorAll('.rail-item')[3].click()`)
await sleep(400)
await cdp.eval(`(() => {
  const nodes = [...document.querySelectorAll('.n-tree-node')]
  const n = nodes.find(n => n.textContent.includes('地点'))
  const target = n?.querySelector('.n-tree-node-content') || n
  target.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 200, clientY: 300 }))
})()`)
await sleep(300)
console.log('dropdown:', await cdp.eval(`!!document.querySelector('.n-dropdown-menu')`))
await cdp.eval(`(() => {
  const opt = [...document.querySelectorAll('.n-dropdown-option')].find(o => o.textContent.includes('重命名'))
  const body = opt?.querySelector('.n-dropdown-option-body') || opt
  body.click()
})()`)
await sleep(300)
console.log('modal:', await cdp.eval(`!!document.querySelector('.n-modal input')`))
process.exit(0)
