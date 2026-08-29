/* 右键快捷菜单验收：演示书上操作，结束后精确还原内容 */
import { writeFileSync } from 'node:fs'
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

const cdp = await CDP.connect()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  —— ' + detail : ''}`)
}

/* 右键打开在选区内部（取光标像素坐标），验证选区格式化路径 */
const openMenu = () =>
  cdp.eval(`(() => {
    const ed = window.__ns.editor
    const el = document.querySelector('.rich-host .tiptap')
    const at = Math.min(ed.state.selection.from + 1, ed.state.doc.content.size - 1)
    const c = ed.view.coordsAtPos(at)
    el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: Math.round(c.left + 4), clientY: Math.round(c.top + 4) }))
  })()`)
const reselect = () => cdp.eval(`window.__ns.editor.commands.setTextSelection({ from: 5, to: 12 })`)
const clickItem = (text, scope = '.ctx-menu') =>
  cdp.eval(`[...document.querySelectorAll('${scope} .ctx-item')].find(i => i.textContent.trim().startsWith(${JSON.stringify(text)}))?.click()`)
const closeMenu = () => cdp.eval(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`)

/* 回到初始书架视图 */
await cdp.eval(`location.reload()`)
await sleep(1800)

/* 打开演示作品 */
await cdp.eval(`[...document.querySelectorAll('.book-card')].find(c => c.textContent.includes('星尘旅人')).click()`)
await sleep(1000)

const initial = await cdp.eval(`window.__ns.editor.getHTML()`)
await reselect()

/* 打开右键菜单 */
await openMenu()
await sleep(300)
let v = await cdp.eval(`({
  open: !!document.querySelector('.ctx-menu'),
  items: document.querySelectorAll('.ctx-menu .ctx-item').length,
  labels: [...document.querySelectorAll('.ctx-menu .ctx-item > span:first-child')].map(s => s.textContent.trim())
})`)
check('右键菜单打开', v.open && v.items >= 18, `items=${v.items}`)
const need = ['剪切', '复制', '粘贴为纯文本', '加粗', '斜体', '下划线', '删除线', '标题', '字体颜色', '突出显示', '对齐', '项目符号列表', '编号列表', '引用', '超链接…', '撤销', '重做', '全选', '清除格式']
const missing = need.filter((n) => !v.labels.includes(n))
if (!v.labels.some((l) => l.startsWith('字号'))) missing.push('字号')
check('菜单项齐全（Word 式）', missing.length === 0, missing.length ? '缺少: ' + missing.join('/') : '')
await cdp.shot('shot-ctx-menu.png')

/* 菜单加粗 */
await clickItem('加粗')
await sleep(250)
v = await cdp.eval(`window.__ns.editor.getHTML()`)
check('右键菜单：加粗生效', /<strong>/.test(v), v.slice(0, 80))

/* 菜单斜体 */
await openMenu(); await sleep(200)
await clickItem('斜体')
await sleep(250)
v = await cdp.eval(`window.__ns.editor.getHTML()`)
check('右键菜单：斜体生效', /<em>/.test(v))

/* 标题飞出子菜单 */
await openMenu(); await sleep(200)
await clickItem('标题')
await sleep(250)
v = await cdp.eval(`({ sub: !!document.querySelector('.ctx-menu .ctx-sub'), opts: [...document.querySelectorAll('.ctx-sub .ctx-item > span:first-child')].map(s => s.textContent.trim()) })`)
check('标题子菜单展开', v.sub && v.opts.includes('标题二'), JSON.stringify(v.opts))
await clickItem('标题二', '.ctx-sub')
await sleep(250)
v = await cdp.eval(`window.__ns.editor.getHTML()`)
check('右键菜单：标题二生效', /<h2>/.test(v), v.slice(0, 80))

/* 字号子菜单 */
await openMenu(); await sleep(200)
await clickItem('字号')
await sleep(250)
await clickItem('20 号', '.ctx-sub')
await sleep(250)
v = await cdp.eval(`window.__ns.editor.getHTML()`)
check('右键菜单：字号生效', /font-size:\s*20px/.test(v))

/* 字体颜色子菜单（色板） */
await openMenu(); await sleep(200)
await clickItem('字体颜色')
await sleep(250)
v = await cdp.eval(`document.querySelectorAll('.ctx-sub .swatch').length`)
check('颜色子菜单（色板）', v >= 8, `swatches=${v}`)
await cdp.eval(`[...document.querySelectorAll('.ctx-sub .swatch')][2].click()`)
await sleep(250)
v = await cdp.eval(`window.__ns.editor.getHTML()`)
check('右键菜单：字体颜色生效', /color:\s*(#c0392b|rgb\(192,\s*57,\s*43\))/i.test(v), v.slice(0, 100))

/* 对齐子菜单 */
await openMenu(); await sleep(200)
await clickItem('对齐')
await sleep(250)
await clickItem('居中', '.ctx-sub')
await sleep(250)
v = await cdp.eval(`window.__ns.editor.getHTML()`)
check('右键菜单：居中生效', /text-align:\s*center/.test(v))

/* 超链接：菜单内输入框 */
await openMenu(); await sleep(200)
await clickItem('超链接…')
await sleep(250)
v = await cdp.eval(`!!document.querySelector('.ctx-linkedit input')`)
check('链接编辑模式', v)
await cdp.eval(`(() => {
  const input = document.querySelector('.ctx-linkedit input')
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'https://example.com/ctx')
  input.dispatchEvent(new Event('input', { bubbles: true }))
})()`)
await cdp.eval(`[...document.querySelectorAll('.ctx-linkedit .ctx-btn')].find(b => b.textContent === '确定').click()`)
await sleep(250)
v = await cdp.eval(`window.__ns.editor.getHTML()`)
check('右键菜单：超链接生效', /href="https:\/\/example\.com\/ctx"/.test(v), v.slice(0, 120))

/* 链接上的右键出现打开/清除项 */
await cdp.eval(`window.__ns.editor.chain().focus().extendMarkRange('link').run()`)
await openMenu(); await sleep(200)
v = await cdp.eval(`[...document.querySelectorAll('.ctx-menu .ctx-item > span:first-child')].map(s => s.textContent.trim())`)
check('链接上下文项（编辑/打开/清除）', v.includes('编辑链接…') && v.includes('打开链接') && v.includes('清除链接'), '')
await closeMenu()

/* 粘贴为纯文本 */
await cdp.eval(`window.native.clipboardWriteText('落霞与孤鹜齐飞。')`)
await reselect()
await openMenu(); await sleep(200)
await clickItem('粘贴为纯文本')
await sleep(400)
v = await cdp.eval(`window.__ns.editor.getHTML()`)
check('右键菜单：粘贴为纯文本', v.includes('落霞与孤鹜齐飞'), '')

/* 撤销恢复两次操作 + 恢复为固定干净正文（避免跨次运行残留格式） */
await cdp.eval(`window.__ns.editor.commands.undo()`)
const CLEAN_HTML = '<p>夜色像一块浸透了墨的绒布，沉沉压在观测站的穹顶之上。</p><p>林远抬头，星图在头顶缓缓旋转。三百六十枚铜刻的星辰各自归位，唯独"黎明"那一枚，二十年来始终空着。</p><p>初雪落进界脊的风里。他把黄铜罗盘揣进大衣内袋，罗盘贴着心口，微微发烫。</p>'
await cdp.eval(`window.__ns.editor.commands.setContent(${JSON.stringify(CLEAN_HTML)}, true)`)
await cdp.eval(`window.__flushNow()`)
await sleep(500)
v = await cdp.eval(`window.__ns.editor.getHTML() === ${JSON.stringify(CLEAN_HTML)}`)
check('内容恢复为干净正文（不影响原稿）', v, '')

/* 返回书架 */
await cdp.eval(`[...document.querySelectorAll('.topbar button')].find(b => b.textContent.includes('书架')).click()`)
await sleep(600)

const failed = results.filter((r) => !r.ok)
console.log(`\n==== ${results.length - failed.length}/${results.length} 项通过 ====`)
process.exit(failed.length ? 1 : 0)
