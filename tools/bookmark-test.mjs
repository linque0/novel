/* 书签系统验收：侧边栏右键收藏 / 工具栏书签键 / 顶栏跳转 */
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
    if (r.exceptionDetails)
      return {
        PAGE_ERR: r.exceptionDetails.exception?.description || r.exceptionDetails.text,
        EXPR: String(expression).slice(0, 70)
      }
    return r.result?.value
  }
}

const cdp = await CDP.connect()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function waitForBrand(c = cdp) {
  for (let i = 0; i < 30; i++) {
    if (await c.eval(`!!document.querySelector('.brand')`)) {
      await sleep(600)
      return
    }
    await sleep(300)
  }
}
let v
const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  —— ' + detail : ''}`)
}
setTimeout(() => {
  console.error('WATCHDOG: 测试总超时，强制退出')
  process.exit(2)
}, 240000)

/* 重置：清书签，种一个带内容的章节 */
await cdp.eval(`location.reload()`)
await waitForBrand()
await cdp.eval(`(async () => {
  const { db, uid, now } = window.__ns
  const workId = (await db.works.toArray())[0].id
  await db.bookmarks.where('workId').equals(workId).delete()
  await db.chapters.where('workId').equals(workId).delete()
  const vols = await db.volumes.where('workId').equals(workId).toArray()
  const volId = vols[0]?.id || uid()
  if (!vols.length) await db.volumes.add({ id: volId, workId, title: '第一卷', sortOrder: 0, createdAt: now(), updatedAt: now(), deletedAt: null })
  const t = now()
  await db.chapters.add({ id: uid(), workId, volumeId: volId, title: '第一章 · 初雪', content: '<p>穹顶大厅的钟声在雾中回荡。</p>', wordCount: 13, status: 'draft', sortOrder: 0, createdAt: t, updatedAt: t, deletedAt: null })
})()`)
await cdp.eval(`location.reload()`)
await waitForBrand()
await cdp.eval(`[...document.querySelectorAll('.book-card')].find(c => c.textContent.includes('星尘旅人')).click()`)
await sleep(900)

/* 1. 侧边栏右键章节 → 快捷栏 → 收藏书签 */
await cdp.eval(`(() => {
  const node = [...document.querySelectorAll('.n-tree-node')].find(n => n.textContent.includes('初雪'))
  const target = n?.querySelector('.n-tree-node-content') || n
  target.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 200, clientY: 300 }))
})()`)
await sleep(300)
v = await cdp.eval(`({
  menu: !!document.querySelector('.n-dropdown-menu'),
  items: [...document.querySelectorAll('.n-dropdown-menu .n-dropdown-option-body')].map(o => o.textContent.trim())
})()`)
check('侧边栏右键打开快捷栏（含书签项）', v.menu && v.items.some(x => x.includes('书签')), JSON.stringify(v.items))
await cdp.eval(`[...document.querySelectorAll('.n-dropdown-menu .n-dropdown-option-body')].find(o => o.textContent.includes('收藏书签'))?.click()`)
await sleep(300)
v = await cdp.eval(`(async () => {
  await window.__flushNow()
  const { db } = window.__ns
  return (await db.bookmarks.toArray()).filter(x => !x.deletedAt).length
})()`)
check('收藏书签写入数据库', v >= 1, `n=${v}`)

/* 2. 树与工具栏显示书签态 */
v = await cdp.eval(`({
  tree: [...document.querySelectorAll('.n-tree-node')].some(n => n.textContent.includes('★')),
  toolbar: [...document.querySelectorAll('.editor-toolbar .tb')].some(b => b.textContent.trim() === '★' && b.className.includes('on'))
})()`)
check('树与工具栏显示书签态', v.tree && v.toolbar, JSON.stringify(v))

/* 3. 工具栏书签键切换（再点移除） */
await cdp.eval(`(() => {
  const btn = [...document.querySelectorAll('.editor-toolbar .tb')].find(b => b.title === '收藏本书签' || b.title === '移除书签')
  btn?.click()
})()`)
await sleep(300)
v = await cdp.eval(`(async () => {
  await window.__flushNow()
  return (await window.__ns.db.bookmarks.toArray()).filter(x => !x.deletedAt).length
})()`)
check('工具栏书签键移除书签', v === 0, `n=${v}`)
/* 重新收藏（供后续跳转测试） */
await cdp.eval(`(() => {
  const btn = [...document.querySelectorAll('.editor-toolbar .tb')].find(b => b.title === '收藏本书签')
  btn?.click()
})()`)
await sleep(300)

/* 4. 顶栏书签下拉列出并跳转 */
await cdp.eval(`[...document.querySelectorAll('.topbar button')].find(b => b.textContent.includes('书签')).click()`)
await sleep(300)
v = await cdp.eval(`[...document.querySelectorAll('.n-dropdown-menu .n-dropdown-option-body')].map(o => o.textContent.trim())`)
check('顶栏书签下拉列出章节', v.some(x => x.includes('初雪')), JSON.stringify(v).slice(0, 60))
await cdp.eval(`[...document.querySelectorAll('.n-dropdown-menu .n-dropdown-option-body')].find(o => o.textContent.includes('初雪'))?.click()`)
await sleep(400)
v = await cdp.eval(`({
  tab: document.querySelector('.rail-item.active')?.textContent?.includes('正文'),
  sel: window.__ns.getWork().selChapterId ? 'set' : 'null'
})()`)
check('书签跳转到目标章节', v.tab && v.sel !== 'null', JSON.stringify(v))

/* 恢复：清空书签，返回书架 */
await cdp.eval(`(async () => {
  const { db } = window.__ns
  const workId = (await db.works.toArray())[0].id
  await db.bookmarks.where('workId').equals(workId).delete()
})()`)
await cdp.eval(`[...document.querySelectorAll('.topbar button')].find(b => b.textContent.includes('书架')).click()`)
await sleep(400)

const failed = results.filter(r => !r.ok)
console.log(`\n==== ${results.length - failed.length}/${results.length} 项通过 ====`)
process.exit(failed.length ? 1 : 0)
