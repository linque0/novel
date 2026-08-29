/* 幕布式设定大纲编辑器验收：真实键盘事件驱动 */
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
  async key(key, code, vk, modifiers = 0) {
    await this.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, modifiers })
    await this.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, modifiers })
  }
  async insertText(text) {
    await this.send('Input.insertText', { text })
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

/* 重置测试 profile 数据：清空分类、观测站为干净纯文本（验证迁移） */
await cdp.eval(`location.reload()`)
await sleep(1800)
await cdp.eval(`(async () => {
  const { db, uid, now } = window.__ns
  let workId
  if (!(await db.works.toArray()).length) {
    const t = now()
    workId = uid()
    await db.works.add({ id: workId, title: '星尘旅人', author: '', genre: '科幻', status: '连载', intro: '', createdAt: t, updatedAt: t, deletedAt: null })
    await db.outlines.add({ id: uid(), workId, level: 'master', refId: workId, content: '', createdAt: t, updatedAt: t, deletedAt: null })
    await db.volumes.add({ id: uid(), workId, title: '第一卷', sortOrder: 0, createdAt: t, updatedAt: t, deletedAt: null })
  } else {
    workId = (await db.works.toArray())[0].id
  }
  await db.lorecats.clear()
  const catId = uid()
  await db.lorecats.add({ id: catId, workId, name: '地点', sortOrder: 0, deletedAt: null })
  const l = (await db.lore.toArray()).find(x => x.title === '观测站')
  if (l) {
    l.content = '建于界脊之上，监控星图异动。'
    l.categoryId = catId
    delete l.fmt
    await db.lore.put(l)
  } else {
    await db.lore.add({ id: uid(), workId, categoryId: catId, title: '观测站', content: '建于界脊之上，监控星图异动。', tags: [], createdAt: now(), updatedAt: now(), deletedAt: null })
  }
})()`)
await cdp.eval(`location.reload()`)
await sleep(1600)
await cdp.eval(`[...document.querySelectorAll('.book-card')].find(c => c.textContent.includes('星尘旅人')).click()`)
await sleep(900)
await cdp.eval(`document.querySelectorAll('.rail-item')[3].click()`)
await sleep(400)
await cdp.eval(`(() => {
  const node = [...document.querySelectorAll('.n-tree-node')].find(n => n.textContent.includes('观测站'))
  ;(node?.querySelector('.n-tree-node-content') || node)?.click()
})()`)
await sleep(600)

/* 1. 旧文本自动迁移为大纲节点 */
let v = await cdp.eval(`({
  editor: !!document.querySelector('.ob-editor'),
  rows: document.querySelectorAll('.ob-row').length,
  first: document.querySelector('.ob-text')?.textContent
})`)
check('设定条目打开为幕布式编辑器', v.editor && v.rows >= 1, JSON.stringify(v))
check('旧文本自动迁移为节点', (v.first || '').includes('建于界脊之上'), v.first)

/* 2. 回车新建节点 */
await cdp.eval(`(() => {
  const el = document.querySelector('.ob-text')
  el.focus()
  const r = document.createRange(); r.selectNodeContents(el); r.collapse(false)
  const s = getSelection(); s.removeAllRanges(); s.addRange(r)
})()`)
await cdp.key('Enter', 'Enter', 13)
await sleep(300)
v = await cdp.eval(`({
  rows: document.querySelectorAll('.ob-row').length,
  focused: document.activeElement?.classList?.contains('ob-text'),
  focusedEmpty: document.activeElement?.textContent === ''
})`)
check('回车新建节点并聚焦', v.rows === 2 && v.focused && v.focusedEmpty, JSON.stringify(v))

/* 3. 输入文本 */
await cdp.insertText('穹顶的铜刻星辰会随季节转向')
await sleep(200)
v = await cdp.eval(`document.activeElement?.textContent`)
check('节点输入文本', (v || '').includes('穹顶的铜刻星辰'), v)

/* 4. Tab 降级（内部记录 → 穹顶节点的子节点） */
await cdp.key('Enter', 'Enter', 13)
await sleep(200)
await cdp.insertText('内部记录')
await sleep(200)
await cdp.key('Tab', 'Tab', 9)
await sleep(400)
v = await cdp.eval(`(async () => {
  await window.__flushNow()
  const row = document.activeElement.closest('[data-node]')
  const depth = row.querySelectorAll('.ob-guide').length
  const { db } = window.__ns
  const lore = (await db.lore.toArray()).find(l => l.title === '观测站')
  let tree = null
  try { tree = JSON.parse(lore.content) } catch {}
  let found = null
  const walk = (n) => { if (n.text === '内部记录') found = n; (n.children || []).forEach(walk) }
  ;(tree || []).forEach(walk)
  return { depth, fmt: lore.fmt, nested: !!found }
})()`)
check('Tab 降级为子节点并保存', v.depth === 1 && v.fmt === 'outline' && v.nested, JSON.stringify(v))

/* 5. 折叠/展开：点「穹顶」行的圆点（有子节点） */
await cdp.eval(`(() => {
  const row = [...document.querySelectorAll('.ob-row')].find(r => r.querySelector('.ob-text').textContent.includes('穹顶'))
  row.querySelector('.ob-bullet').click()
})()`)
await sleep(250)
const foldedRows = await cdp.eval(`document.querySelectorAll('.ob-row').length`)
await cdp.eval(`(() => {
  const row = [...document.querySelectorAll('.ob-row')].find(r => r.querySelector('.ob-text').textContent.includes('穹顶'))
  row.querySelector('.ob-bullet').click()
})()`)
await sleep(250)
const expandedRows = await cdp.eval(`document.querySelectorAll('.ob-row').length`)
check('点圆点折叠/展开', foldedRows === 2 && expandedRows === 3, `folded=${foldedRows} expanded=${expandedRows}`)

/* 6. Backspace 在子节点起始处合并到父节点 */
await cdp.eval(`(() => {
  const rows = [...document.querySelectorAll('.ob-row')]
  const childRow = rows.find(r => r.querySelectorAll('.ob-guide').length === 1)
  const el = childRow.querySelector('.ob-text')
  el.focus()
  const r = document.createRange(); r.selectNodeContents(el); r.collapse(true)
  const s = getSelection(); s.removeAllRanges(); s.addRange(r)
})()`)
await cdp.key('Backspace', 'Backspace', 8)
await sleep(300)
v = await cdp.eval(`document.querySelectorAll('.ob-row').length`)
check('Backspace 合并子节点到父节点', v === 2, `rows=${v}`)

/* 7. Alt+↑ 移动节点（modifier: Alt=1） */
const before = await cdp.eval(`[...document.querySelectorAll('.ob-row')].map(r => r.querySelector('.ob-text').textContent.slice(0, 6))`)
await cdp.eval(`(() => {
  const el = document.querySelectorAll('.ob-text')[1]
  el.focus()
  const r = document.createRange(); r.selectNodeContents(el); r.collapse(false)
  const s = getSelection(); s.removeAllRanges(); s.addRange(r)
})()`)
await cdp.key('ArrowUp', 'ArrowUp', 38, 1)
await sleep(300)
const after = await cdp.eval(`[...document.querySelectorAll('.ob-row')].map(r => r.querySelector('.ob-text').textContent.slice(0, 6))`)
check('Alt+↑ 移动节点', JSON.stringify(before) !== JSON.stringify(after), JSON.stringify({ before, after }))

await cdp.shot('shot-outline.png')

/* ============ B. 文件夹树 ============ */
const W = `window.__ns.getWork()`
await cdp.eval(`(() => { const w = ${W}; w.addCategory('地理', null); const east = w.addCategory('东部', w.liveCategories.find(c => c.name === '地理').id); w.moveLoreTo(w.liveLore.find(l => l.title === '观测站').id, east.id) })()`)
await sleep(400)
v = await cdp.eval(`(() => {
  const w = ${W}
  const data = w.categoryTreeData()
  const geo = data.find(n => n.label === '地理')
  const east = geo?.children.find(n => n.label === '东部')
  return {
    geo: !!geo,
    eastUnderGeo: !!east,
    entriesUnderEast: east ? east.children.filter(c => c.type === 'entry').map(c => c.label) : [],
    guidCount: document.querySelectorAll('.ob-row [data-node]') ? undefined : undefined,
    treeDOM: [...document.querySelectorAll('.n-tree-node')].length
  }
})()`)
check('文件夹嵌套 + 条目归档（地理/东部/观测站）', v.geo && v.eastUnderGeo && v.entriesUnderEast.includes('观测站'), JSON.stringify(v))

/* 重命名文件夹（模拟右键菜单） */
await cdp.eval(`(() => {
  const nodes = [...document.querySelectorAll('.n-tree-node')]
  const n = nodes.find(n => n.textContent.includes('地理'))
  const target = n?.querySelector('.n-tree-node-content') || n
  target.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 200, clientY: 300 }))
  return !!document.querySelector('.n-dropdown-menu')
})()`)
await sleep(300)
await cdp.eval(`[...document.querySelectorAll('.n-dropdown-menu .n-dropdown-option-body')].find(o => o.textContent.includes('重命名'))?.click()`)
await sleep(300)
await cdp.eval(`(() => {
  const input = document.querySelector('.n-modal input')
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '九州地理')
  input.dispatchEvent(new Event('input', { bubbles: true }))
})()`)
await cdp.eval(`[...document.querySelectorAll('.n-modal button')].find(b => b.textContent.trim() === '确定')?.click()`)
await sleep(300)
v = await cdp.eval(`(() => { const w = ${W}; return w.categoryTreeData().find(n => n.label === '九州地理') ? 'renamed' : 'fail' })()`)
check('文件夹重命名（右键菜单）', v === 'renamed', v)

/* 删除文件夹 → 子项上提 */
await cdp.eval(`(() => {
  const w = ${W}
  const east = w.liveCategories.find(c => c.name === '东部')
  w.deleteCategory(east.id)
})()`)
await sleep(400)
v = await cdp.eval(`(async () => {
  const w = ${W}
  await window.__flushNow()
  const data = w.categoryTreeData()
  const geo = data.find(n => n.label === '九州地理')
  const entries = geo ? geo.children.filter(c => c.type === 'entry').map(c => c.label) : []
  const { db } = window.__ns
  const lore = (await db.lore.toArray()).find(l => l.title === '观测站')
  return { eastGone: !data.some(n => n.label === '东部'), entries, obsUnderGeo: lore.categoryId ? 'in-geo' : 'root' }
})()`)
check('删除文件夹子项上提（观测站/界脊镇 归入九州地理）', v.eastGone && v.entries.includes('观测站'), JSON.stringify(v))

/* ============ C. 工具栏格式化 + 撤销 + 右键菜单 ============ */
/* 选中第一节点全部文字，点工具栏加粗 */
await cdp.eval(`(() => {
  const el = document.querySelector('.ob-text')
  el.focus()
  const r = document.createRange(); r.selectNodeContents(el)
  const s = getSelection(); s.removeAllRanges(); s.addRange(r)
})()`)
await cdp.eval(`(() => {
  const btn = [...document.querySelectorAll('.ob-toolbar .tb')].find(b => b.title === '加粗')
  btn.dispatchEvent(new MouseEvent('mousedown', { cancelable: true }))
  btn.click()
})()`)
await sleep(300)
v = await cdp.eval(`(() => {
  const w = ${W}
  const n = w.categoryTreeData().find(n => n.type === 'entry') // 任一根条目
  const lore = w.liveLore.find(l => l.title === '观测站')
  return { html: lore.html ?? lore.content, hasBold: /<(b|strong)>/i.test(JSON.stringify(lore.content)) }
})()`)
check('工具栏加粗（节点内联 HTML）', v.hasBold, JSON.stringify(v).slice(0, 120))

/* Ctrl+Z 撤销 */
await cdp.eval(`(() => {
  const el = document.querySelector('.ob-text')
  el.focus()
})()`)
await cdp.key('z', 'KeyZ', 90, 2) // Ctrl=2
await sleep(300)
v = await cdp.eval(`(async () => {
  await window.__flushNow()
  const { db } = window.__ns
  const lore = (await db.lore.toArray()).find(l => l.title === '观测站')
  return { hasBold: /<(b|strong)>/i.test(lore.content) }
})()`)
check('Ctrl+Z 撤销格式化', v.hasBold === false, JSON.stringify(v))

/* 右键菜单：降级 */
await cdp.eval(`(() => {
  const rows = [...document.querySelectorAll('.ob-row')]
  rows[rows.length - 1].dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 500, clientY: 400 }))
})()`)
await sleep(300)
v = await cdp.eval(`({ menu: !!document.querySelector('.ob-ctx'), items: document.querySelectorAll('.ob-ctx .ctx-item').length })`)
check('大纲右键菜单打开', v.menu && v.items >= 15, JSON.stringify(v))
await cdp.eval(`[...document.querySelectorAll('.ob-ctx .ctx-item')].find(i => i.textContent.trim().startsWith('降级'))?.click()`)
await sleep(300)
v = await cdp.eval(`(() => {
  const rows = [...document.querySelectorAll('.ob-row')]
  return rows.map(r => r.querySelectorAll('.ob-guide').length)
})()`)
check('右键菜单：降级生效', v[v.length - 1] === 1, JSON.stringify(v))
await cdp.shot('shot-ob-ctx.png')

/* 恢复「观测站」为干净单节点大纲 */
await cdp.eval(`(async () => {
  const { db, uid } = window.__ns
  await window.__flushNow()
  const l = (await db.lore.toArray()).find(x => x.title === '观测站')
  l.content = JSON.stringify([{ id: uid(), text: '建于界脊之上，监控星图异动。', fold: false, children: [] }])
  l.fmt = 'outline'
  await db.lore.put(l)
})()`)
await cdp.eval(`[...document.querySelectorAll('.topbar button')].find(b => b.textContent.includes('书架')).click()`)
await sleep(400)

const failed = results.filter((r) => !r.ok)
console.log(`\n==== ${results.length - failed.length}/${results.length} 项通过 ====`)
process.exit(failed.length ? 1 : 0)
