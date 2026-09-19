/* v1.0.22 缺陷修复针对性验收：恢复备份时序 / 大纲视图切换 / 幕布合并与按钮 / mubuMove 同层 /
 * 侧栏重命名（prompt→弹窗）/ 关系图新人物补位 / 拆窗批注写回门禁 / stripTags / 分章短首章 /
 * docx 裸文本 / 连接点引出连线去重
 * 运行前提：npm run dev（自带 CDP 9222，验证书自动种入）
 * 用法：node tools/bugfix-verify.mjs
 */
import { connect } from './_cdp-lib.mjs'
import { buildSeedExpr } from './verify-seeds.mjs'

const c = await connect('app://')
await c.sleep(2500)
/* 清掉历次拆窗验收遗留的面板窗口（面板持有旧 store 会把过期状态写回、干扰种子与锁） */
{
  const list = await (await fetch('http://127.0.0.1:9222/json/list')).json()
  for (const t of list.filter((x) => x.type === 'page' && x.url.includes('panel='))) {
    try {
      const ws2 = new WebSocket(t.webSocketDebuggerUrl)
      await new Promise((r, j) => ((ws2.onopen = r), (ws2.onerror = j)))
      ws2.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: 'window.close()' } }))
      await c.sleep(250)
      ws2.close()
    } catch {
      /* 已关闭则忽略 */
    }
  }
  await c.sleep(600)
}
const results = []
const check = (name, ok, detail = '') => {
  results.push(ok)
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  —— ' + String(detail).slice(0, 360) : ''))
}

/* ---------- 1) 纯函数修复：stripTags / splitTxtChapters ---------- */
const pure = await c.evalx(`(async () => {
  const { stripTags } = await import('/src/services/wordcount.js')
  const { splitTxtChapters } = await import('/src/services/importers.js')
  return {
    inline: stripTags('<p>他抬头看去，<span class="dl-link">铜刻星辰</span>缓缓归位，<span class="note-mark">雪落在界脊之上</span>。</p>').replace(/\\n/g, '|'),
    blockSep: stripTags('<p>甲</p><p>乙</p>').includes('\\n'),
    shortFirst: (() => {
      const secs = splitTxtChapters('第一章 楔子\\n短。\\n第二章 启程\\n正文正文正文。')
      return { n: secs.length, t0: secs[0]?.title }
    })(),
    prefaceMerged: (() => {
      const secs = splitTxtChapters('某书名\\n作者：某人\\n第一章 初雪\\n正文。\\n第二章 夜行\\n正文。')
      return { n: secs.length, t0: secs[0]?.title }
    })()
  }
})()`)
check('stripTags 行内标记不再打断词语', pure.inline.includes('铜刻星辰缓缓归位') && !pure.inline.includes(' 铜刻星辰 '), JSON.stringify(pure.inline))
check('stripTags 块级标签仍分段', pure.blockSep, JSON.stringify(pure.blockSep))
check('TXT 分章：短首章（有标题）不再被并入次章', pure.shortFirst.n === 2 && pure.shortFirst.t0.includes('楔子'), JSON.stringify(pure.shortFirst))
check('TXT 分章：无标题短前言仍并入第一章', pure.prefaceMerged.n === 2 && pure.prefaceMerged.t0.includes('初雪'), JSON.stringify(pure.prefaceMerged))

/* ---------- 2) docx 裸文本成段 ---------- */
const bare = await c.evalx(`(async () => {
  const { buildBookDocx } = await import('/src/services/exporter.js')
  await import('/node_modules/jszip/dist/jszip.min.js') // UMD 在模块脚本环境下挂到 window
  const JSZip = window.JSZip
  const work = { title: '裸文本验证书', author: '' }
  const b64 = await buildBookDocx(work, [], [{ id: 'x', title: '第一章', fmt: 'html', content: '裸文本一句<p>段落一句</p>' }], null)
  const zip = await JSZip.loadAsync(Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0)))
  const xml = await zip.file('word/document.xml').async('string')
  return { bare: xml.includes('裸文本一句'), para: xml.includes('段落一句') }
})()`)
check('docx 导出保留块级标签外的裸文本', bare.bare && bare.para, JSON.stringify(bare))

/* ---------- 3) 种子并打开批注验证书（后续交互用） ---------- */
await c.evalx(buildSeedExpr('批注验证书', { reset: true }))
await c.evalx(`location.reload()`)
await c.sleep(2600)
await c.evalx(`[...document.querySelectorAll('.book-card')].find(x => x.textContent.includes('批注验证书'))?.click()`)
await c.sleep(1800)
check('打开批注验证书', await c.evalx(`!!document.querySelector('.rich-host .tiptap')`))
const base = await c.evalx(`(() => {
  const w = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('work')
  return { workId: w.work.id, chapterId: w.selChapterId }
})()`)

/* ---------- 4) 恢复备份时序：编辑 → 恢复 → 内容应等于备份 ---------- */
const seq = await c.evalx(`(async () => {
  const { db } = window.__ns
  const tables = ['works','volumes','chapters','outlines','characters','relations','lorecats','lore','mubu','snippets','links','wordlog','appconfig','bookmarks','olnodes','annotations']
  const data = {}
  for (const t of tables) data[t] = await db.table(t).toArray()
  window.__backup = JSON.stringify({ version: 1, exportedAt: Date.now(), assets: [], data })
  const ed = window.__ns.editor
  ed.commands.focus('end')
  ed.chain().insertContent('【恢复前新增的一句】').run()
  await new Promise((r) => setTimeout(r, 120)) // 不等防抖，立即恢复（复现原缺陷时序）
  const { restoreBackup } = await import('/src/services/exporter.js')
  const buf = new TextEncoder().encode(window.__backup).buffer
  await restoreBackup(buf)
  await new Promise((r) => setTimeout(r, 2500)) // 原缺陷在此窗口把脏数据写回
  const ch = (await db.chapters.toArray()).find((x) => x.workId === ${JSON.stringify(base.workId)} && x.title === '第一章 · 初雪')
  return {
    stale: (ch?.content || '').includes('【恢复前新增的一句】'),
    restored: (ch?.content || '').includes('雪落在界脊之上')
  }
})()`)
check('恢复备份不被恢复前的脏数据覆盖', seq.restored === true && seq.stale === false, JSON.stringify(seq))

/* 重新载入（恢复后 store 与库已脱节） */
await c.evalx(`location.reload()`)
await c.sleep(2600)
await c.evalx(`[...document.querySelectorAll('.book-card')].find(x => x.textContent.includes('批注验证书'))?.click()`)
await c.sleep(1800)

/* ---------- 5) 大纲：侧栏重命名（prompt→弹窗）——先建一个模块再操作 ---------- */
await c.evalx(`(() => { const w = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('work'); w.tab = 'outline'; w.outlineView = 'canvas'; w.olnodeAdd(null, { title: '待改名模块', text: '内容草稿' }); return 1 })()`)
await c.sleep(900)
const sideRename = await c.evalx(`(async () => {
  const item = [...document.querySelectorAll('.ol-side .side-item, .side-item')].find(i => i.querySelector('.ol-op'))
  if (!item) return 'no sidebar item'
  ;[...item.querySelectorAll('.ol-op')].find(b => b.title === '重命名')?.click()
  await new Promise((r) => setTimeout(r, 500))
  const modal = [...document.querySelectorAll('.n-modal input, .n-dialog input')].find(i => i)
  return { modalOpened: !!modal, err: window.__lastErr || '' }
})()`)
check('侧栏「重命名」打开弹窗（不再依赖 window.prompt）', sideRename.modalOpened === true, JSON.stringify(sideRename))
const renamed = await c.evalx(`(() => {
  const modal = [...document.querySelectorAll('.n-modal input, .n-dialog input')].find(i => i)
  if (!modal) return 'no modal'
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(modal, '改名后的模块')
  modal.dispatchEvent(new Event('input', { bubbles: true }))
  ;[...document.querySelectorAll('.n-modal button, .n-dialog button')].find(b => b.textContent.trim() === '确定')?.click()
  const w = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('work')
  return w.olnodeSetTitle ? (w.liveOlnodes().some((n) => n.title === '改名后的模块') ? 'renamed' : 'pending') : 'no store'
})()`)
await c.sleep(600)
const renamed2 = await c.evalx(`document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('work').liveOlnodes().some((n) => n.title === '改名后的模块')`)
check('侧栏重命名生效', renamed2 === true, JSON.stringify({ renamed, renamed2 }))

/* ---------- 6) 大纲：视图切换后编辑器不空白 ---------- */
const viewSwitch = await c.evalx(`(async () => {
  const w = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('work')
  const n = w.liveOlnodes().find((x) => (x.text || x.html) && x.kind !== 'anchor') || w.liveOlnodes()[0]
  if (!n) return { err: 'no olnode' }
  w.outlineView = 'text'
  w.selOlnodeId = n.id
  await new Promise((r) => setTimeout(r, 500))
  const el1 = document.querySelector('.ol-editor')
  const before = el1?.innerHTML || ''
  w.outlineView = 'canvas'
  await new Promise((r) => setTimeout(r, 400))
  w.outlineView = 'text'
  await new Promise((r) => setTimeout(r, 500))
  const el2 = document.querySelector('.ol-editor')
  return { nodeHas: (n.html || n.text || '').length > 0, beforeLen: before.length, afterLen: el2?.innerHTML?.length || 0, same: el2?.innerHTML === before }
})()`)
check('大纲视图切换后编辑器保留节点内容', viewSwitch.nodeHas && viewSwitch.same === true && viewSwitch.afterLen > 0, JSON.stringify(viewSwitch))

/* ---------- 7) 幕布：同级/子级按钮命中焦点节点 ---------- */
await c.evalx(`(() => { const w = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('work'); w.tab = 'lore'; return 1 })()`)
await c.sleep(1200)
const mubuBtns = await c.evalx(`(async () => {
  const w = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('work')
  const first = w.liveMubu()[0]
  const el = document.querySelector('.ob-editor [data-node], [data-node]')
  const textEl = el ? el.querySelector('.ob-text') || el : null
  // 触发 onTextFocus：dispatch focus（事件目标需带 data-node 结构）
  textEl?.dispatchEvent(new FocusEvent('focus', { bubbles: true }))
  await new Promise((r) => setTimeout(r, 200))
  const before = w.liveMubu().length
  const btnChild = [...document.querySelectorAll('.tb')].find((b) => b.title.includes('新建子节点'))
  if (!btnChild) return { err: 'no child btn', before }
  const err = btnChild.disabled ? 'disabled' : null
  if (!err) btnChild.click()
  await new Promise((r) => setTimeout(r, 400))
  const after = w.liveMubu().length
  const newNode = w.liveMubu().find((n) => n.parentId === first.id)
  return { before, after, created: !!newNode, underFocused: newNode?.parentId === first.id, err }
})()`)
check('幕布「子级」按钮在焦点节点下建子节点（不再 TypeError）', mubuBtns.created === true && mubuBtns.underFocused === true, JSON.stringify(mubuBtns))

/* ---------- 8) mubuMove 同层排序 ---------- */
const reorder = await c.evalx(`(() => {
  const w = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('work')
  const parent = w.mubuAdd(null, null, '排序父节点')
  const a = w.mubuAdd(parent.id, null, 'A')
  const b = w.mubuAdd(parent.id, null, 'B')
  const t = w.mubuAdd(parent.id, null, 'T')
  w.mubuMove(a.id, t.id, 'after') // A 拖到 T 之后：期望 B, T, A
  const order1 = w.mubuChildren(parent.id).map((n) => n.text).join(',')
  w.mubuMove(a.id, t.id, 'before') // A 拖到 T 之前：期望 B, A, T
  const order2 = w.mubuChildren(parent.id).map((n) => n.text).join(',')
  return { order1, order2, ok: order1 === 'B,T,A' && order2 === 'B,A,T' }
})()`)
check('mubuMove 同层 before/after 排序正确', reorder.ok === true, JSON.stringify(reorder))

/* ---------- 9) 连接点引出连线去重（不同连接点同目标各自保留） ---------- */
const junc = await c.evalx(`(() => {
  const w = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('work')
  const n1 = w.olnodeAdd(null, { title: '宿主' })
  const n2 = w.olnodeAdd(null, { title: '目标' })
  const rel = w.olnodeRelAdd(n1.id, n2.id, {})
  const j1 = w.olnodeJunctionAdd(n1.id, rel.id, 0.3)
  const j2 = w.olnodeJunctionAdd(n1.id, rel.id, 0.7)
  const host = { ownerId: n1.id, relId: rel.id }
  w.olnodeRelAddFromJunction({ ...host, junctionId: j1.id }, n2.id, {})
  w.olnodeRelAddFromJunction({ ...host, junctionId: j2.id }, n2.id, {})
  const outs = (w.olnodes.find((x) => x.id === n1.id).rels.find((r) => r.id === rel.id)._out || [])
  return { outs: outs.length, ok: outs.length === 2 }
})()`)
check('不同连接点引向同一目标的连线各自保留', junc.ok === true, JSON.stringify(junc))

/* ---------- 10) 拆窗后主窗口批注写回门禁 ---------- */
const anno = await c.evalx(`(() => {
  const ed = window.__ns.editor
  let p = null
  ed.state.doc.descendants((n, pos) => { if (!p && n.isText && n.text && n.text.includes('雪落在界脊之上')) { const i = n.text.indexOf('雪落在界脊之上'); p = { from: pos + i, to: pos + i + 7 } } })
  ed.chain().setTextSelection(p).setMark('annotation', { noteId: 'bv-note-1', color: '#c0392b' }).run()
  const w = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('work')
  w.addAnnotation({ chapterId: w.selChapterId, noteId: 'bv-note-1', text: '雪落在界脊之上', note: '门禁探针', color: '#c0392b' })
  return { chapterId: w.selChapterId, workId: w.work.id }
})()`)
await c.evalx(`window.__flushNow && window.__flushNow()`)
await c.sleep(1100)
await c.evalx(`(async () => {
  const w = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('work')
  return window.native.panelOpen({ type: 'chapter', workId: w.work.id, entityId: w.selChapterId, title: '门禁探针面板' })
})()`)
await c.sleep(4000)
const list = await (await fetch('http://127.0.0.1:9222/json/list')).json()
const pt = list.find((x) => x.type === 'page' && x.url.includes('panel='))
const ws = new WebSocket(pt.webSocketDebuggerUrl)
await new Promise((r, j) => ((ws.onopen = r), (ws.onerror = j)))
let mid = 0
const peval = async (expr) => {
  const r = await new Promise((res) => { const i = ++mid; ws.addEventListener('message', function h(ev) { const m = JSON.parse(ev.data); if (m.id === i) { ws.removeEventListener('message', h); res(m) } }); ws.send(JSON.stringify({ id: i, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true, awaitPromise: true } })) })
  const inner = r?.result
  if (inner?.exceptionDetails) return { PAGE_ERR: (inner.exceptionDetails.exception?.description || inner.exceptionDetails.text).slice(0, 300) }
  return inner?.result?.value
}
const panelEdit = await peval(`(async () => {
  for (let i = 0; i < 20 && !window.__ns.editor; i++) await new Promise((r) => setTimeout(r, 250))
  const ed = window.__ns.editor
  if (!ed) return { err: 'panel editor missing' }
  ed.chain().insertContent('【面板新增句】').run() // 隐藏窗口不 focus，插入落当前光标（commands 裸命名空间没有 .run）
  const w = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('work')
  const storeHas = (w.chapters.find((x) => x.id === w.selChapterId)?.content || '').includes('【面板新增句】')
  window.__flushNow && window.__flushNow()
  const { db } = window.__ns
  const ch = (await db.chapters.where('workId').equals(w.work.id).toArray()).find((x) => x.id === w.selChapterId)
  return { storeHas, dbHasFromPanel: (ch?.content || '').includes('【面板新增句】'), selChapter: w.selChapterId }
})()`)
console.log('面板编辑结果:', JSON.stringify(panelEdit))
await c.sleep(1200)
const panelPersist = await c.evalx(`(async () => {
  const { db } = window.__ns
  const ch = (await db.chapters.toArray()).find((x) => x.workId === ${JSON.stringify(base.workId)} && x.title === '第一章 · 初雪')
  return { panelEditInDb: (ch?.content || '').includes('【面板新增句】') }
})()`)
console.log('中间诊断（面板落盘后、主窗改色前）:', JSON.stringify(panelPersist))
const guard = await c.evalx(`(async () => {
  const { recolorNoteMark } = await import('/src/services/annotations.js')
  const hit = recolorNoteMark('bv-note-1', '#27ae60') // 章节已拆出：应拒绝写回（返回 false）
  window.__flushNow && window.__flushNow()
  await new Promise((r) => setTimeout(r, 1500))
  const { db } = window.__ns
  const ch = (await db.chapters.toArray()).find((x) => x.workId === ${JSON.stringify(base.workId)} && x.title === '第一章 · 初雪')
  return { refused: hit === false, panelEditKept: (ch?.content || '').includes('【面板新增句】') }
})()`)
check('拆窗后主窗口批注写回被门禁拦截（面板编辑幸存）', guard.refused === true && guard.panelEditKept === true, JSON.stringify(guard))

const pass = results.filter(Boolean).length
console.log(`\n${pass}/${results.length} 通过`)
process.exit(pass === results.length ? 0 : 1)
