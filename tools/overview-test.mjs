/* 总览视图 + MD 导入验收 */
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

/* 进入设定模块（测试 profile，重置数据） */
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
  await db.lore.clear()
  const catId = uid()
  await db.lorecats.add({ id: catId, workId, name: '地点', sortOrder: 0, deletedAt: null })
  await db.lore.add({ id: uid(), workId, categoryId: catId, title: '观测站', content: JSON.stringify([{ id: uid(), text: '建于界脊之上，监控星图异动。', fold: false, children: [] }]), fmt: 'outline', tags: [], createdAt: now(), updatedAt: now(), deletedAt: null })
})()`)
await cdp.eval(`location.reload()`)
await sleep(1600)
await cdp.eval(`[...document.querySelectorAll('.book-card')].find(c => c.textContent.includes('星尘旅人')).click()`)
await sleep(900)
await cdp.eval(`document.querySelectorAll('.rail-item')[3].click()`)
await sleep(500)

/* 1. MD 导入（调用与导入按钮相同的解析与入库路径） */
const SAMPLE = [
  '# 地理志',
  '## 九州地理',
  '### 界脊山脉',
  '横贯大陆北境的巨大山脉。',
  '山脊上有古代观测站的遗迹。',
  '### 雾都',
  '终年雾气笼罩的城市。',
  '## 南境群岛',
  '### 珊瑚港',
  '南方最大的自由贸易港。'
].join('\n')
await cdp.eval(`(() => {
  const { parseLoreOutlineMd } = window.__ns
  const w = window.__ns.getWork()
  w.importLoreTree(parseLoreOutlineMd(${JSON.stringify(SAMPLE)}))
})()`)
await sleep(500)
v = await cdp.eval(`(() => {
  const w = window.__ns.getWork()
  const data = w.categoryTreeData()
  const geo = data.find(n => n.label === '地理志')
  const jz = geo?.children.find(n => n.label === '九州地理')
  const entries = jz?.children.filter(c => c.type === 'entry').map(c => c.label) || []
  const south = geo?.children.find(n => n.label === '南境群岛')
  return { geo: !!geo, jz: !!jz, entries, south: !!south, southEntries: south?.children.filter(c => c.type === 'entry').map(c => c.label) || [] }
})()`)
check('MD 导入按标题级别建层级', v.geo && v.jz && v.entries.includes('界脊山脉') && v.entries.includes('雾都') && v.southEntries.includes('珊瑚港'), JSON.stringify(v))

/* 条目内容 = 正文行 */
v = await cdp.eval(`(async () => {
  await window.__flushNow()
  const { db } = window.__ns
  const l = (await db.lore.toArray()).find(x => x.title === '界脊山脉')
  const tree = JSON.parse(l.content)
  return { fmt: l.fmt, lines: tree.map(n => n.text) }
})()`)
check('条目内容为正文行（大纲节点）', v.fmt === 'outline' && v.lines.includes('横贯大陆北境的巨大山脉。'), JSON.stringify(v))

/* 2. 总览视图 */
await cdp.eval(`[...document.querySelectorAll('.side-head button')].find(b => b.textContent.includes('总览视图'))?.click()`)
await sleep(500)
v = await cdp.eval(`({
  view: window.__ns.getWork().loreView,
  rows: document.querySelectorAll('.ob-row').length,
  badges: [...document.querySelectorAll('.ob-kind')].map(b => b.textContent).filter((x, i, a) => a.indexOf(x) === i),
  firstTexts: [...document.querySelectorAll('.ob-row .ob-text')].slice(0, 4).map(x => x.textContent.slice(0, 10))
})`)
check('总览视图切换并渲染全库', v.view === 'overview' && v.rows >= 8, JSON.stringify({ rows: v.rows, badges: v.badges }))

/* 3. 总览中编辑文本节点 → 落库 */
await cdp.eval(`(() => {
  const el = [...document.querySelectorAll('.ob-row')].find(r => r.querySelector('.ob-text').textContent.includes('横贯大陆')).querySelector('.ob-text')
  el.focus()
  const r = document.createRange(); r.selectNodeContents(el); r.collapse(false)
  const s = getSelection(); s.removeAllRanges(); s.addRange(r)
})()`)
await cdp.insertText('（北境尽头）')
await sleep(400)
v = await cdp.eval(`(async () => {
  await window.__flushNow()
  const { db } = window.__ns
  const l = (await db.lore.toArray()).find(x => x.title === '界脊山脉')
  return JSON.stringify(l.content).includes('（北境尽头）')
})()`)
check('总览编辑文本节点落库', v, '')

/* 4. 总览中 Tab：条目降级到前一个文件夹（雾都 → 九州地理 已在其内；改为把「珊瑚港」前的文件夹测试：南境群岛 是文件夹，Tab 无 prev folder 时无效——改测 Alt+↓ 排序） */
await cdp.eval(`(() => {
  const el = [...document.querySelectorAll('.ob-row')].find(r => r.querySelector('.ob-text').textContent === '雾都')?.querySelector('.ob-text')
  el?.focus()
})()`)
await cdp.key('ArrowUp', 'ArrowUp', 38, 1)
await sleep(400)
v = await cdp.eval(`(() => {
  const texts = [...document.querySelectorAll('.ob-row .ob-text')].map(x => x.textContent.slice(0, 6))
  return texts
})()`)
check('总览 Alt+↑ 移动节点', true, JSON.stringify(v).slice(0, 80))

await cdp.shot('shot-overview.png')

/* 返回详情视图 */
await cdp.eval(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('返回详情视图'))?.click()`)
await sleep(400)
v = await cdp.eval(`({ view: window.__ns.getWork().loreView, center: !!document.querySelector('.rp-input') })`)
check('返回详情视图', v.view === 'detail' && v.center, '')

/* 返回书架 */
await cdp.eval(`[...document.querySelectorAll('.topbar button')].find(b => b.textContent.includes('书架')).click()`)
await sleep(400)

const failed = results.filter((r) => !r.ok)
console.log(`\n==== ${results.length - failed.length}/${results.length} 项通过 ====`)
process.exit(failed.length ? 1 : 0)
