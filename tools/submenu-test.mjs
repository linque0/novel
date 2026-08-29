/* 二级飞出菜单可见性验收：elementFromPoint 证明子菜单未被裁剪，且可点击生效 */
import { writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const here = dirname(fileURLToPath(import.meta.url))
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
  async shot(name) {
    const { data } = await this.send('Page.captureScreenshot', { format: 'png' })
    writeFileSync(resolve(here, name), Buffer.from(data, 'base64'))
  }
}

const cdp = await CDP.connect()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  —— ' + detail : ''}`)
}

await cdp.eval(`location.reload()`)
await sleep(1800)
await cdp.eval(`[...document.querySelectorAll('.book-card')].find(c => c.textContent.includes('星尘旅人')).click()`)
await sleep(900)
await cdp.eval(`window.__ns.editor.commands.setTextSelection({ from: 5, to: 12 })`)

const openMenu = () =>
  cdp.eval(`(() => {
    const ed = window.__ns.editor
    const el = document.querySelector('.rich-host .tiptap')
    const at = Math.min(ed.state.selection.from + 1, ed.state.doc.content.size - 1)
    const c = ed.view.coordsAtPos(at)
    el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: Math.round(c.left + 4), clientY: Math.round(c.top + 4) }))
  })()`)
const hoverItem = (text) =>
  cdp.eval(`(() => {
    const item = [...document.querySelectorAll('.ctx-menu .ctx-item')].find(i => i.textContent.trim().startsWith(${JSON.stringify(text)}))
    item.dispatchEvent(new MouseEvent('mouseenter'))
    return item.getBoundingClientRect()
  })()`)

/* 每个飞出子菜单：存在 + 视口内 + elementFromPoint 命中自身（未被 overflow 裁剪） */
for (const [label, key] of [['标题', 'heading'], ['字号', 'size'], ['字体颜色', 'color'], ['突出显示', 'highlight'], ['对齐', 'align']]) {
  await openMenu()
  await sleep(250)
  await hoverItem(label)
  await sleep(350)
  const v = await cdp.eval(`(() => {
    const sub = document.querySelector('.ctx-sub')
    if (!sub) return { exists: false }
    const r = sub.getBoundingClientRect()
    const cx = r.left + r.width / 2
    const cy = r.top + r.height / 2
    const hit = document.elementFromPoint(cx, cy)
    return {
      exists: true,
      inViewport: r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1,
      hitInside: !!(hit && sub.contains(hit)),
      rect: { l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom) }
    }
  })()`)
  check(
    `飞出菜单可见：${label}`,
    v.exists && v.inViewport && v.hitInside,
    v.exists ? `rect=${JSON.stringify(v.rect)} hitInside=${v.hitInside}` : '子菜单不存在'
  )
  if (key === 'heading') {
    await cdp.eval(`[...document.querySelectorAll('.ctx-sub .ctx-item')].find(i => i.textContent.trim() === '标题二')?.click()`)
    await sleep(250)
    const html = await cdp.eval(`window.__ns.editor.getHTML()`)
    check('子菜单点击生效（标题二）', /<h2>/.test(html))
  }
}

/* 视觉证据：展开“字号”子菜单截图 */
await openMenu()
await sleep(250)
await cdp.eval(`(() => { const item = [...document.querySelectorAll('.ctx-menu .ctx-item')].find(i => i.textContent.trim().startsWith('字号')); item.dispatchEvent(new MouseEvent('mouseenter')) })()`)
await sleep(400)
await cdp.shot('shot-submenu.png')

/* 恢复干净正文并返回书架 */
await closeMenuSafe()
await cdp.eval(`window.__ns.editor.commands.setContent("<p>夜色像一块浸透了墨的绒布，沉沉压在观测站的穹顶之上。</p><p>林远抬头，星图在头顶缓缓旋转。三百六十枚铜刻的星辰各自归位，唯独"黎明"那一枚，二十年来始终空着。</p><p>初雪落进界脊的风里。他把黄铜罗盘揣进大衣内袋，罗盘贴着心口，微微发烫。</p>", true)`)
await cdp.eval(`window.__flushNow()`)
await sleep(400)
await cdp.eval(`[...document.querySelectorAll('.topbar button')].find(b => b.textContent.includes('书架')).click()`)
await sleep(500)

function closeMenuSafe() {
  return cdp.eval(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`)
}

const failed = results.filter((r) => !r.ok)
console.log(`\n==== ${results.length - failed.length}/${results.length} 项通过 ====`)
process.exit(failed.length ? 1 : 0)
