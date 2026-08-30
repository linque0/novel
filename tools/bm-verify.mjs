/* 书签验证（从当前已打开的章节状态继续） */
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
    const r = await Promise.race([
      this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('eval timeout')), 15000))
    ])
    if (r.exceptionDetails) return { PAGE_ERR: r.exceptionDetails.exception?.description || r.exceptionDetails.text }
    return r.result?.value
  }
  async shot(name) {
    try {
      const r = await Promise.race([
        this.send('Page.captureScreenshot', { format: 'png' }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('shot timeout')), 8000))
      ])
      writeFileSync(resolve(here, name), Buffer.from(r.data, 'base64'))
    } catch {
      console.log('  (截图跳过)')
    }
  }
}

const cdp = await CDP.connect()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let v
const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  —— ' + detail : ''}`)
}

/* 前置：清空书签并打开作品 */
await cdp.eval(`(async () => {
  const { db } = window.__ns
  const workId = (await db.works.toArray())[0].id
  await db.bookmarks.where('workId').equals(workId).delete()
})()`)
await cdp.eval(`[...document.querySelectorAll('.topbar button')].find(b => b.textContent.includes('书架'))?.click()`)
await sleep(400)
await cdp.eval(`[...document.querySelectorAll('.book-card')].find(c => c.textContent.includes('星尘旅人')).click()`)
await sleep(900)

/* 1. 右键初雪章节行 → 快捷栏 */
await cdp.eval(`(() => {
  const node = [...document.querySelectorAll('.n-tree-node')].find(n => n.textContent.includes('初雪'))
  const target = node?.querySelector('.n-tree-node-content') || node
  target.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 200, clientY: 300 }))
})()`)
await sleep(700)
v = await cdp.eval(`({
  menu: !!document.querySelector('.n-dropdown-menu'),
  items: [...document.querySelectorAll('.n-dropdown-menu .n-dropdown-option-body')].map(o => o.textContent.trim())
})()`)
check('侧边栏右键快捷栏（含收藏书签项）', v.menu && v.items.some(x => x.includes('收藏书签')), JSON.stringify(v.items))
await cdp.shot('bm-1-ctx.png')

/* 2. 收藏书签 → 数据库 */
await cdp.eval(`[...document.querySelectorAll('.n-dropdown-menu .n-dropdown-option-body')].find(o => o.textContent.includes('收藏书签'))?.click()`)
await sleep(700)
v = await cdp.eval(`(async () => {
  await window.__flushNow()
  const { db } = window.__ns
  const b = (await db.bookmarks.toArray()).filter(x => !x.deletedAt)
  return { n: b.length, first: b[0]?.title }
})()`)
check('收藏书签写入数据库', v.n >= 1, JSON.stringify(v))

/* 3. 树 ★ 前缀 + 工具栏 ★ 态 */
v = await cdp.eval(`({
  tree: [...document.querySelectorAll('.n-tree-node')].some(n => n.textContent.includes('★')),
  toolbar: [...document.querySelectorAll('.editor-toolbar .tb')].some(b => b.textContent.trim() === '★' && b.className.includes('on'))
})()`)
check('树 ★ 前缀与工具栏书签态', v.tree && v.toolbar, JSON.stringify(v))

/* 4. 工具栏书签键再点 → 移除 → 再收藏（恢复） */
await cdp.eval(`(() => {
  const btn = [...document.querySelectorAll('.editor-toolbar .tb')].find(b => b.title === '移除书签')
  btn?.click()
})()`)
await sleep(700)
v = await cdp.eval(`(async () => {
  await window.__flushNow()
  return (await window.__ns.db.bookmarks.toArray()).filter(x => !x.deletedAt).length
})()`)
check('工具栏书签键移除', v === 0, `n=${v}`)
await cdp.eval(`(() => {
  const btn = [...document.querySelectorAll('.editor-toolbar .tb')].find(b => b.title === '收藏本书签')
  btn?.click()
})()`)
await sleep(700)

/* 5. 顶栏书签下拉列出 + 跳转 */
await cdp.eval(`[...document.querySelectorAll('.topbar button')].find(b => b.textContent.includes('书签')).click()`)
await sleep(700)
v = await cdp.eval(`[...document.querySelectorAll('.n-dropdown-menu .n-dropdown-option-body')].map(o => o.textContent.trim())`)
check('顶栏书签下拉列出章节', v.some(x => x.includes('初雪')), JSON.stringify(v).slice(0, 60))
await cdp.eval(`document.querySelectorAll('.rail-item')[1].click()`)
await sleep(200)
await cdp.eval(`document.querySelectorAll('.rail-item')[0].click()`)
await sleep(200)
await cdp.eval(`[...document.querySelectorAll('.topbar button')].find(b => b.textContent.includes('书签')).click()`)
await sleep(700)
await cdp.eval(`[...document.querySelectorAll('.n-dropdown-menu .n-dropdown-option-body')].find(o => o.textContent.includes('初雪'))?.click()`)
await sleep(900)
v = await cdp.eval(`({
  chapter: window.__ns.getWork().selChapterId ? 'set' : 'null',
  tab: window.__ns.getWork().tab
})()`)
check('书签跳转到目标章节', v.chapter !== 'null' && v.tab === 'chapters', JSON.stringify(v))
await cdp.shot('bm-final.png')

/* 恢复：清空书签 */
await cdp.eval(`(async () => {
  const { db } = window.__ns
  const workId = (await db.works.toArray())[0].id
  await db.bookmarks.where('workId').equals(workId).delete()
})()`)

const failed = results.filter(r => !r.ok)
console.log(`\n==== ${results.length - failed.length}/${results.length} 项通过 ====`)
process.exit(failed.length ? 1 : 0)
