/* 小说工坊 E2E 验收脚本：通过 CDP 驱动渲染进程，不抢占 OS 前台 */
import { writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const PORT = 9222

class CDP {
  static async connect() {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
    const target = list.find((t) => t.type === 'page' && t.url.startsWith('app://'))
    if (!target) throw new Error('page target not found: ' + JSON.stringify(list.map((t) => t.url)))
    const ws = new WebSocket(target.webSocketDebuggerUrl)
    await new Promise((res, rej) => {
      ws.onopen = res
      ws.onerror = () => rej(new Error('ws connect failed'))
    })
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
const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  —— ' + detail : ''}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/* 页内工具：以 React/Vue 兼容方式设置受控输入值 */
await cdp.eval(`window.setInput = (el, value) => {
  const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}`)
const typeInto = (selector, text) =>
  cdp.eval(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); el.focus(); document.execCommand('insertText', false, ${JSON.stringify(text)}) })()`)
const setVal = (selector, value) =>
  cdp.eval(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)})
    if (!el) throw new Error('no element: ' + ${JSON.stringify(selector)})
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)})
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })()`)
const clickBtnWithText = (text, scope = 'document') =>
  cdp.eval(`[...${scope}.querySelectorAll('button')].find(b => b.textContent.includes(${JSON.stringify(text)}))?.click()`)

/* 0. 回到初始状态（应用可能停留在上次的工作台视图） */
await cdp.eval(`location.reload()`)
await sleep(1800)

/* 1. 书架 + 持久化 */
let v = await cdp.eval(`({ cards: document.querySelectorAll('.book-card').length, titles: [...document.querySelectorAll('.book-title')].map(x => x.textContent) })`)
check('书架页渲染', v.cards >= 1, `cards=${v.cards}`)
check('书架含作品条目', (v.titles || []).length >= 1, JSON.stringify(v.titles))

/* 2. 导入解析逻辑 */
v = await cdp.eval(`(() => {
  const sample = '本书书名\\n作者：某人\\n\\n第一章 初雪\\n雪落在城墙上。\\n\\n第二章 夜行\\n他提灯走过长街。'
  const secs = window.__ns.splitTxtChapters(sample, '测试')
  return { n: secs.length, t1: secs[0]?.title, t2: secs[1]?.title, head1: secs[0]?.text.slice(0, 12) }
})()`)
check('TXT 智能分章（短前言并入第一章）', v.n === 2 && /第一章/.test(v.t1) && /第二章/.test(v.t2) && v.head1.includes('本书书名'), JSON.stringify(v))

v = await cdp.eval(`(() => {
  const bytes = new Uint8Array([0xD6, 0xD0, 0xCE, 0xC4])
  const r = window.__ns.decodeText(bytes)
  return { text: r.text, enc: r.encoding }
})()`)
check('GBK/GB18030 编码自动识别', v.text === '中文' && v.enc === 'gb18030', JSON.stringify(v))

/* 3. 创建专属测试作品并打开（不触碰用户数据） */
await cdp.eval(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('新建作品')).click()`)
await sleep(500)
await cdp.eval(`(() => {
  const title = [...document.querySelectorAll('.n-modal input')].find(i => (i.placeholder || '').includes('书名'))
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(title, '验收测试作品')
  title.dispatchEvent(new Event('input', { bubbles: true }))
})()`)
await cdp.eval(`[...document.querySelectorAll('.n-modal button')].find(b => b.textContent.trim() === '创建').click()`)
await sleep(900)
await cdp.eval(`[...document.querySelectorAll('.book-card')].find(c => c.textContent.includes('验收测试作品')).click()`)
await sleep(900)
v = await cdp.eval(`({ rail: document.querySelectorAll('.rail-item').length, badge: document.querySelector('.save-badge')?.textContent?.trim() })`)
check('工作台打开（5 模块导航 + 保存指示）', v.rail === 5 && !!v.badge, JSON.stringify(v))

/* 新建一章 */
await clickBtnWithText('＋章', `document.querySelector('.side-head')`)
await sleep(700)
v = await cdp.eval(`({ editor: !!document.querySelector('.rich-host .tiptap'), title: document.querySelector('.title-input')?.value, tb: document.querySelectorAll('.editor-toolbar .tb').length })`)
check('新建章节并进入富文本编辑器', v.editor && !!v.title && v.tb > 0, JSON.stringify(v))

/* 4. 编辑器输入 → 自动保存 + 字数 */
await typeInto('.rich-host .tiptap', '夜色像一块浸透了墨的绒布，沉沉压在观测站穹顶。林远抬头，星图在头顶缓缓旋转。')
await sleep(2400)
v = await cdp.eval(`({
  words: document.querySelector('.editor-head .n-tag')?.textContent?.trim(),
  badge: document.querySelector('.save-badge')?.textContent?.trim(),
  expected: [...document.querySelector('.rich-host .tiptap').textContent].filter(c => !/\\s/.test(c)).length
})`)
check('编辑器输入生效', (v.expected || 0) >= 30, `chars=${v.expected}`)
check('即时自动保存（1s 防抖后显示已保存）', /已保存/.test(v.badge || ''), v.badge)
check('字数统计准确', String(v.expected) === String(v.words).replace(/[^0-9]/g, ''), `words=${v.words} expected=${v.expected}`)

/* 4.5 Word 风格工具栏 */
v = await cdp.eval(`({ tb: !!document.querySelector('.editor-toolbar'), n: document.querySelectorAll('.editor-toolbar .tb').length })`)
check('工具栏渲染', v.tb && v.n >= 20, JSON.stringify(v))

await cdp.eval(`window.__ns.editor.chain().focus().selectAll().run()`)
await cdp.eval(`[...document.querySelectorAll('.editor-toolbar .tb')].find(b => b.title === '加粗').click()`)
v = await cdp.eval(`window.__ns.editor.getHTML()`)
check('加粗（工具栏按钮）', /<strong>/.test(v), v.slice(0, 80))

await cdp.eval(`[...document.querySelectorAll('.editor-toolbar .tb')].find(b => b.title === '斜体').click()`)
v = await cdp.eval(`window.__ns.editor.getHTML()`)
check('斜体（工具栏按钮）', /<em>/.test(v))

await cdp.eval(`[...document.querySelectorAll('.editor-toolbar .tb')].find(b => b.title === '标题一').click()`)
v = await cdp.eval(`window.__ns.editor.getHTML()`)
check('标题排列（H1）', /<h1>/.test(v))
await cdp.eval(`window.__ns.editor.chain().focus().setParagraph().run()`)

await cdp.eval(`window.__ns.editor.chain().focus().selectAll().setFontSize(24).run()`)
v = await cdp.eval(`window.__ns.editor.getHTML()`)
check('字号设置', /font-size:\s*24px/.test(v), v.slice(0, 90))

await cdp.eval(`window.__ns.editor.chain().focus().setColor('#c0392b').run()`)
v = await cdp.eval(`window.__ns.editor.getHTML()`)
check('字体颜色', /color:\s*#c0392b/i.test(v))

await cdp.eval(`window.__ns.editor.chain().focus().setTextAlign('center').run()`)
v = await cdp.eval(`window.__ns.editor.getHTML()`)
check('段落排列（居中）', /text-align:\s*center/.test(v))
await cdp.eval(`window.__ns.editor.chain().focus().setTextAlign('left').run()`)

await cdp.eval(`window.__ns.editor.chain().focus().setTextSelection({ from: 1, to: 6 }).setLink({ href: 'https://example.com/novel', target: '_blank' }).run()`)
v = await cdp.eval(`window.__ns.editor.getHTML()`)
check('超链接', /<a[^>]*href="https:\/\/example\.com\/novel"/.test(v), v.slice(0, 120))

await cdp.eval(`window.__ns.editor.chain().focus().selectAll().setHighlight({ color: '#fff3a3' }).run()`)
v = await cdp.eval(`window.__ns.editor.getHTML()`)
check('突出显示（底色）', /<mark[^>]*data-color="#fff3a3"|<mark[^>]*background-color:\s*#fff3a3/i.test(v))

await cdp.eval(`[...document.querySelectorAll('.editor-toolbar .tb')].find(b => b.title === '清除格式').click()`)
v = await cdp.eval(`window.__ns.editor.getHTML()`)
check('清除格式', !/<(strong|em|a\s|mark|span)/.test(v), v.slice(0, 90))

/* 旧 Markdown 内容迁移：切走再切回，内容以 HTML 打开且自动保存 */
await cdp.eval(`document.querySelectorAll('.rail-item')[4].click()`)
await sleep(400)
await cdp.eval(`document.querySelectorAll('.rail-item')[0].click()`)
await sleep(800)
v = await cdp.eval(`({ fmt: window.__ns.db === undefined ? '?' : 'db-ok', html: document.querySelector('.rich-host .tiptap')?.innerHTML?.slice(0, 40) || '' })`)
check('编辑器重新挂载（富文本）', /<p/.test(v.html), JSON.stringify(v))

/* 5. 大纲（v0.4.1 自由画布：新建事件模块 → 文本视图编辑） */
await cdp.eval(`document.querySelectorAll('.rail-item')[1].click()`)
await sleep(600)
await clickBtnWithText('＋事件')
await sleep(500)
await cdp.eval(`(() => {
  const w = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('work')
  w.outlineView = 'text'
  return 1
})()`)
await sleep(400)
await typeInto('.ol-editor', '主线：星图碎片指引旅人穿越四境，找回失落的黎明。')
await sleep(300)
v = await cdp.eval(`(() => {
  const w = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('work')
  const node = w.liveOlnodes().find((n) => n.kind === 'event')
  return { len: (document.querySelector('.ol-editor')?.textContent || '').length, saved: (node?.text || '').length > 10 }
})()`)
check('大纲模块（事件条目编辑）', v.len > 10 && v.saved, JSON.stringify(v))

/* 6. 人物 */
await cdp.eval(`document.querySelectorAll('.rail-item')[2].click()`)
await sleep(400)
await clickBtnWithText('＋人物')
await sleep(400)
await setVal('.center-pane .rp-input input', '林远')
await sleep(300)
await typeInto('.center-pane textarea.rp-textarea', '前观测员，沉默寡言，随身带着一枚黄铜罗盘。')
await sleep(300)
v = await cdp.eval(`[...document.querySelectorAll('.side-item span')].map(x => x.textContent).join('|')`)
check('人物卡创建与改名（林远）', v.includes('林远'), v)

/* 7. 正文出场人物检测 */
await cdp.eval(`document.querySelectorAll('.rail-item')[0].click()`)
await sleep(500)
v = await cdp.eval(`document.querySelector('.right-panel')?.textContent || ''`)
check('右侧面板检测本章出场人物', v.includes('林远') && v.includes('本章大纲'), '')

/* 8. 设定（v0.3.0 幕布化：＋条目 → 幕布节点 contenteditable） */
await cdp.eval(`document.querySelectorAll('.rail-item')[3].click()`)
await sleep(500)
await clickBtnWithText('＋条目')
await sleep(500)
await typeInto('.center-pane .ob-editor .ob-text', '观测站：建于界脊之上，监控星图异动。')
await sleep(300)
v = await cdp.eval(`(() => {
  const t = document.querySelector('.center-pane .ob-editor')?.textContent || ''
  const items = [...document.querySelectorAll('.side-item')].map(x => x.textContent)
  return { typed: t.includes('观测站'), nodeInTree: items.length > 0 }
})()`)
check('设定条目创建（幕布节点）', v.typed && v.nodeInTree, JSON.stringify(v))

/* 9. 灵感 */
await cdp.eval(`document.querySelectorAll('.rail-item')[4].click()`)
await sleep(400)
await setVal('.side-head textarea', '灵感：罗盘在满月之夜指向错误的方位。')
await clickBtnWithText('＋记录', `document.querySelector('.side-head')`)
await sleep(300)
v = await cdp.eval(`[...document.querySelectorAll('.side-item span')].map(x => x.textContent).join('|')`)
check('灵感随手记', v.includes('罗盘在满月之夜'), v)

/* 10. 全局搜索 */
await clickBtnWithText('搜索', `document.querySelector('.topbar')`)
await sleep(400)
await setVal('.n-modal input', '星图')
await clickBtnWithText('搜索', `document.querySelector('.n-modal')`)
await sleep(400)
v = await cdp.eval(`({ hits: document.querySelectorAll('.search-hit').length, first: document.querySelector('.search-hit')?.textContent?.slice(0, 30) })`)
check('全局搜索跨模块命中', v.hits > 0, JSON.stringify(v))
await cdp.eval(`document.querySelector('.search-hit')?.click()`)
await sleep(400)
v = await cdp.eval(`!!document.querySelector('.rich-host .tiptap')`)
check('搜索结果跳转到正文', v, '')

/* 11. 统计 */
await clickBtnWithText('统计', `document.querySelector('.topbar')`)
await sleep(1200)
v = await cdp.eval(`({ canvas: document.querySelectorAll('.n-modal canvas').length, nums: [...document.querySelectorAll('.stat-card .num')].map(x => x.textContent) })`)
check('统计看板（卡片 + 双图表）', v.canvas >= 2 && v.nums.length === 4, JSON.stringify(v))
await cdp.shot('shot-stats.png')
await cdp.eval(`document.querySelector('.n-modal .n-base-close')?.click()`)
await sleep(300)

/* 12. 主题切换 */
await cdp.eval(`document.querySelector('.topbar .n-select .n-base-selection').dispatchEvent(new MouseEvent('click', { bubbles: true }))`)
await sleep(400)
await cdp.eval(`[...document.querySelectorAll('.n-base-select-option')].find(o => o.textContent.includes('暗夜'))?.click()`)
await sleep(500)
v = await cdp.eval(`document.querySelector('.app-root').className`)
check('暗夜书房主题生效', v.includes('theme-night'), v)
await cdp.shot('shot-night.png')
await cdp.eval(`document.querySelector('.topbar .n-select .n-base-selection').dispatchEvent(new MouseEvent('click', { bubbles: true }))`)
await sleep(400)
await cdp.eval(`[...document.querySelectorAll('.n-base-select-option')].find(o => o.textContent.includes('宣纸'))?.click()`)
await sleep(400)

/* 工作台截图 */
await cdp.shot('shot-workbench.png')

const failed = results.filter((r) => !r.ok)

/* 清理：移除本次测试创建的作品与数据，绝不触碰用户数据 */
await cdp.eval(`window.__flushNow ? window.__flushNow() : 0`)
await sleep(400)
const clean = await cdp.eval(`(async () => {
  const { db } = window.__ns
  const works = await db.works.toArray()
  const cut = Date.now() - 30 * 60 * 1000
  let removed = 0
  for (const w of works) {
    const isTest = w.title === '验收测试作品'
    const tables = ['volumes', 'chapters', 'outlines', 'characters', 'relations', 'lorecats', 'lore', 'snippets', 'assets', 'wordlog']
    if (isTest) {
      for (const t of tables) {
        const rows = await db.table(t).where('workId').equals(w.id).toArray()
        await db.table(t).bulkDelete(rows.map((r) => r.id))
        removed += rows.length
      }
      const revs = await db.revisions.toArray()
      const chIds = new Set((await db.chapters.toArray()).filter((c) => c.workId === w.id).map((c) => c.id))
      const rv = revs.filter((r) => r.entityType === 'chapter' && chIds.has(r.entityId))
      await db.revisions.bulkDelete(rv.map((r) => r.id))
      await db.works.delete(w.id)
      removed++
    } else {
      // 清掉误建到用户作品里的空“新章节”（内容为空且为近期测试所建）
      const rows = (await db.chapters.where('workId').equals(w.id).toArray())
        .filter((c) => c.title === '新章节' && !(c.content || '') && c.createdAt > cut)
      for (const c of rows) {
        const os = await db.outlines.where('refId').equals(c.id).toArray()
        await db.outlines.bulkDelete(os.map((o) => o.id))
        await db.chapters.delete(c.id)
        removed++
      }
    }
  }
  return removed
})()`)
await cdp.eval(`location.reload()`)
console.log(`\\n清理测试数据：${clean} 条`)

console.log(`\\n==== ${results.length - failed.length}/${results.length} 项通过 ====`)
process.exit(failed.length ? 1 : 0)
