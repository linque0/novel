/* 幕布式设定库验收：迁移 / 结构操作 / 折叠 / 撤销 / MD 导入 */
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
let v
const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  —— ' + detail : ''}`)
}

/* 种旧格式数据（分类 + 条目），验证自动迁移 */
await cdp.eval(`location.reload()`)
await sleep(1800)
await cdp.eval(`(async () => {
  const { db, uid, now } = window.__ns
  let workId
  const existing = await db.works.toArray()
  if (existing.length) { workId = existing[0].id } else {
    const t = now(); workId = uid()
    await db.works.add({ id: workId, title: '星尘旅人', author: '', genre: '科幻', status: '连载', intro: '', createdAt: t, updatedAt: t, deletedAt: null })
    await db.outlines.add({ id: uid(), workId, level: 'master', refId: workId, content: '', createdAt: t, updatedAt: t, deletedAt: null })
    await db.volumes.add({ id: uid(), workId, title: '第一卷', sortOrder: 0, createdAt: t, updatedAt: t, deletedAt: null })
  }
  await db.mubu.where('workId').equals(workId).delete()
  await db.appconfig.where('key').equals('mubu-mig:' + workId).delete()
  await db.lorecats.where('workId').equals(workId).delete()
  await db.lore.where('workId').equals(workId).delete()
  const cat1 = uid(), cat2 = uid()
  await db.lorecats.bulkAdd([
    { id: cat1, workId, name: '地点', parentId: null, sortOrder: 0, deletedAt: null },
    { id: cat2, workId, name: '观测站', parentId: cat1, sortOrder: 1, deletedAt: null }
  ])
  await db.lore.add({ id: uid(), workId, categoryId: cat2, title: '穹顶大厅', content: '高得望不到顶。\\n四壁刻满星图。', tags: [], createdAt: now(), updatedAt: now(), deletedAt: null })
})()`)
await cdp.eval(`location.reload()`)
await sleep(1800)
await cdp.eval(`[...document.querySelectorAll('.book-card')].find(c => c.textContent.includes('星尘旅人')).click()`)
await sleep(900)
await cdp.eval(`document.querySelectorAll('.rail-item')[3].click()`)
await sleep(600)

/* 1. 迁移：旧分类/条目 → 节点树 */
v = await cdp.eval(`(() => {
  const rows = [...document.querySelectorAll('.ob-row .ob-text')].map(x => x.textContent)
  return { rows, guides: [...document.querySelectorAll('.ob-row')].map(r => r.querySelectorAll('.ob-guide').length) }
})()`)
check('旧分类/条目自动迁移为幕布节点', v.rows.some(t => t.includes('地点')) && v.rows.some(t => t.includes('观测站')) && v.rows.some(t => t.includes('穹顶大厅')), JSON.stringify(v.rows))
check('迁移保留层级（观测站嵌套于地点下）', v.guides[v.rows.findIndex(t => t.includes('观测站'))] === 1, JSON.stringify(v.guides))
check('条目正文行迁移为子节点', v.rows.some(t => t.includes('四壁刻满星图')), '')

/* 2. 回车新建 + 输入 */
await cdp.eval(`(() => {
  const el = document.querySelector('.ob-text')
  el.focus()
  const r = document.createRange(); r.selectNodeContents(el); r.collapse(false)
  const s = getSelection(); s.removeAllRanges(); s.addRange(r)
})()`)
await cdp.key('Enter', 'Enter', 13)
await sleep(300)
await cdp.insertText('新写的设定细节')
await sleep(300)
v = await cdp.eval(`({ rows: document.querySelectorAll('.ob-row').length, text: document.activeElement?.textContent })`)
check('回车新建节点 + 输入', v.rows >= 5 && (v.text || '').includes('新写的设定细节'), JSON.stringify(v))

/* 3. Tab 降级（深度 +1） */
const depthBefore = await cdp.eval(`document.activeElement.closest('[data-node]').querySelectorAll('.ob-guide').length`)
await cdp.key('Tab', 'Tab', 9)
await sleep(300)
v = await cdp.eval(`document.activeElement.closest('[data-node]').querySelectorAll('.ob-guide').length`)
check('Tab 降级', v === depthBefore + 1, `before=${depthBefore} after=${v}`)

/* 4. 点圆点折叠/展开 */
await cdp.eval(`(() => {
  const rows = [...document.querySelectorAll('.ob-row')]
  const target = rows.find(r => r.querySelector('.ob-text').textContent.includes('地点'))
  target?.querySelector('.ob-bullet').click()
})()`)
await sleep(250)
const folded = await cdp.eval(`document.querySelectorAll('.ob-row').length`)
await cdp.eval(`(() => {
  const rows = [...document.querySelectorAll('.ob-row')]
  const target = rows.find(r => r.querySelector('.ob-text').textContent.includes('地点'))
  target?.querySelector('.ob-bullet').click()
})()`)
await sleep(250)
const expanded = await cdp.eval(`document.querySelectorAll('.ob-row').length`)
check('点圆点折叠/展开', folded < expanded, `folded=${folded} expanded=${expanded}`)

/* 5. 撤销（把焦点放回文本节点后 Ctrl+Z 两次：回退 Tab 降级与新建节点） */
await cdp.eval(`(() => {
  const el = [...document.querySelectorAll('.ob-text')].find(x => x.textContent.includes('新写的设定细节')) || document.querySelector('.ob-text')
  el.focus()
  const r = document.createRange(); r.selectNodeContents(el); r.collapse(false)
  const s = getSelection(); s.removeAllRanges(); s.addRange(r)
})()`)
await cdp.key('z', 'KeyZ', 90, 2)
await sleep(300)
await cdp.key('z', 'KeyZ', 90, 2)
await sleep(400)
v = await cdp.eval(`(() => {
  const rows = [...document.querySelectorAll('.ob-row')]
  return { n: rows.length, hasTyped: rows.some(r => r.querySelector('.ob-text').textContent.includes('新写的设定细节')) }
})()`)
check('Ctrl+Z 撤销（结构回退）', v.hasTyped === false, JSON.stringify(v))

/* 6. MD 导入按钮（解析与入库路径） */
const MD = ['# 势力', '## 观测局', '监视所有星图异动的官方机构。', '### 内部派系', '保守派与激进派明争暗斗。'].join('\n')
await cdp.eval(`(() => {
  const { parseMubuMd } = window.__ns
  const tree = parseMubuMd(${JSON.stringify(MD)})
  window.__ns.getWork().mubuAddTree(null, null, tree)
})()`)
await sleep(400)
v = await cdp.eval(`(() => {
  const rows = [...document.querySelectorAll('.ob-row .ob-text')].map(x => x.textContent)
  return { has: rows.includes('势力') && rows.includes('观测局') && rows.includes('保守派与激进派明争暗斗。'), n: rows.length }
})()`)
check('MD 导入为幕布节点', v.has, JSON.stringify(v).slice(0, 80))

/* 7. 删除节点 → 回收站（软删除） */
const beforeDel = await cdp.eval(`document.querySelectorAll('.ob-row').length`)
await cdp.eval(`(() => {
  const rows = [...document.querySelectorAll('.ob-row')]
  const last = rows[rows.length - 1]
  const delBtn = [...last.querySelectorAll('.ob-ops .ob-op')].find(b => b.title === '删除节点')
  delBtn.click()
})()`)
await sleep(300)
v = await cdp.eval(`({ rows: document.querySelectorAll('.ob-row').length, before: ${beforeDel} })`)
check('删除节点（行数减少）', v.rows < v.before, JSON.stringify(v))

await cdp.shot('shot-mubu.png')

/* 回到书架 */
await cdp.eval(`[...document.querySelectorAll('.topbar button')].find(b => b.textContent.includes('书架')).click()`)
await sleep(400)

const failed = results.filter((r) => !r.ok)
console.log(`\n==== ${results.length - failed.length}/${results.length} 项通过 ====`)
process.exit(failed.length ? 1 : 0)
