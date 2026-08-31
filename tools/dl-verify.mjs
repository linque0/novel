/* 双链全链路验证（--profile=test 实例）：正文/幕布/大纲三链路 + 搜索命中选段 + 悬浮保持 */
import { connect } from './_cdp-lib.mjs'

const c = await connect('app://')
await c.sleep(2500)
const results = []
const check = (name, ok, detail = '') => { results.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  —— ' + String(detail).slice(0, 300) : '')) }
const rclick = async (x, y) => {
  await c.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: Math.round(x), y: Math.round(y), button: 'right', buttons: 2, clickCount: 1 })
  await c.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: Math.round(x), y: Math.round(y), button: 'right', buttons: 0, clickCount: 1 })
}

/* 0) 种子 */
const seed = await c.evalx(`(async () => {
  const { db, uid, now } = window.__ns
  const old = (await db.works.toArray()).find(w => w.title === '双链验证书')
  if (old) { await db.works.delete(old.id) }
  const t = now()
  const workId = uid()
  await db.works.add({ id: workId, title: '双链验证书', author: '', genre: '', status: '', intro: '', createdAt: t, updatedAt: t, deletedAt: null })
  await db.outlines.add({ id: uid(), workId, level: 'master', refId: workId, content: '主线围绕铜刻星辰的异动展开。', createdAt: t, updatedAt: t, deletedAt: null })
  const volId = uid()
  await db.volumes.add({ id: volId, workId, title: '第一卷', sortOrder: 0, createdAt: t, updatedAt: t, deletedAt: null })
  await db.chapters.add({ id: uid(), workId, volumeId: volId, title: '第一章 · 初雪', content: '<p>他抬头看去，三百六十枚铜刻星辰缓缓归位。</p>', wordCount: 0, status: 'draft', sortOrder: 0, createdAt: t, updatedAt: t, deletedAt: null })
  await db.mubu.bulkAdd([
    { id: uid(), workId, parentId: null, sortOrder: 0, text: '观测站', html: null, fold: false, deletedAt: null, createdAt: t, updatedAt: t },
    { id: uid(), workId, parentId: null, sortOrder: 1000, text: '穹顶大厅', html: null, fold: false, deletedAt: null, createdAt: t, updatedAt: t }
  ])
  const mb = (await db.mubu.toArray()).filter(n => n.workId === workId)
  const gz = mb.find(n => n.text === '观测站')
  await db.mubu.add({ id: uid(), workId, parentId: gz.id, sortOrder: 0, text: '建于界脊之上，穹顶内悬三百六十枚铜刻星辰的活星图。', html: null, fold: false, deletedAt: null, createdAt: t, updatedAt: t })
  await db.characters.add({ id: uid(), workId, name: '林远', aliases: '', role: '主角', tags: [], fields: {}, avatarAssetId: null, content: '他在穹顶大厅值守，熟悉每一枚铜刻星辰。', createdAt: t, updatedAt: t, deletedAt: null })
  await db.snippets.add({ id: uid(), workId, content: '穹顶大厅的第十二响钟声是关键伏笔。', tags: [], createdAt: t, updatedAt: t, deletedAt: null })
  return workId
})()`)
console.log('seed:', seed)
await c.evalx(`location.reload()`)
await c.sleep(2500)

/* 1) 打开书 */
await c.evalx(`[...document.querySelectorAll('.book-card')].find(x => x.textContent.includes('双链验证书'))?.click()`)
await c.sleep(1500)
check('打开测试书', await c.evalx(`!!document.querySelector('.rich-host .tiptap')`))

/* 2) 正文：选中“铜刻星辰”→ 真实右键 → 添加双链 */
const sel = await c.evalx(`(() => {
  const ed = window.__ns.editor
  const doc = ed.state.doc
  let p = null
  doc.descendants((n, pos) => { if (!p && n.isText && n.text && n.text.includes('铜刻星辰')) { const i = n.text.indexOf('铜刻星辰'); p = { from: pos + i, to: pos + i + 4 } } })
  if (!p) return 'not found'
  ed.chain().setTextSelection(p).focus().run()
  // 坐标取自编辑器 DOM（后台窗口 window.getSelection 可能为空，不可依赖）
  const dom = ed.view.domAtPos(p.from)
  let tn, off
  if (dom.node.nodeType === 3) { tn = dom.node; off = dom.offset } else {
    tn = [...dom.node.childNodes].find(n => n.nodeType === 3 && n.textContent.includes('铜刻星辰'))
    off = tn ? tn.textContent.indexOf('铜刻星辰') : 0
  }
  const r2 = document.createRange()
  r2.setStart(tn, off); r2.setEnd(tn, Math.min(off + 4, tn.textContent.length))
  const rect = r2.getBoundingClientRect()
  return { cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2, empty: ed.state.selection.empty }
})()`)
check('正文选区建立', sel.cx > 0 && !sel.empty, JSON.stringify(sel))
await rclick(sel.cx, sel.cy)
await c.sleep(600)
const m1 = await c.evalx(`(() => { const it = [...document.querySelectorAll('.ctx-menu .ctx-item')].find(i => i.textContent.includes('添加双链')); return { open: !!document.querySelector('.ctx-menu'), cls: it?.className } })()`)
check('右键菜单打开且「添加双链」可用', m1.open && m1.cls === 'ctx-item', JSON.stringify(m1))
await c.evalx(`[...document.querySelectorAll('.ctx-menu .ctx-item')].find(i => i.textContent.includes('添加双链'))?.click()`)
await c.sleep(500)
const m2 = await c.evalx(`(() => { const inp = document.querySelector('.ctx-dlwrap input'); return { picker: !!inp, q: inp?.value } })()`)
check('面板打开并预填选中关键词', m2.picker && m2.q === '铜刻星辰', JSON.stringify(m2))
const m3 = await c.evalx(`(() => [...document.querySelectorAll('.ctx-dlwrap .picker-item')].map(x => ({ t: x.textContent.trim().slice(0, 42), ex: !!x.querySelector('.picker-excerpt') })))()`)
check('内容搜索命中设定节点（含选段）', m3.some(x => x.t.startsWith('设定') && x.t.includes('铜刻星辰') && x.ex), JSON.stringify(m3))
await c.evalx(`(() => { [...document.querySelectorAll('.ctx-dlwrap .picker-item')].find(x => x.textContent.includes('设定') && x.textContent.includes('铜刻星辰'))?.click(); return 1 })()`)
await c.sleep(700)
const m4 = await c.evalx(`(async () => {
  await window.__flushNow()
  const app = document.querySelector('#app').__vue_app__
  const work = app.config.globalProperties.$pinia._s.get('work')
  const el = document.querySelector('.rich-host .dl-link')
  return { span: !!el, saved: (work.activeChapter?.content || '').includes('dl-link'), target: el?.getAttribute('data-dl-target')?.startsWith('mubu:') }
})()`)
check('双链标签写入正文并落库', m4.span && m4.saved && m4.target, JSON.stringify(m4))

/* 3) 悬浮预览 + 移入浮窗保持 + 跳转 */
await c.evalx(`(() => { const el = document.querySelector('.rich-host .dl-link'); const r = el.getBoundingClientRect(); el.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: r.left + 5, clientY: r.top + 5 })); return 1 })()`)
await c.sleep(700)
const m5 = await c.evalx(`(() => { const p = document.querySelector('.dl-pop'); return { shown: !!p, text: p?.innerText?.slice(0, 40) } })()`)
check('悬浮预览展示目标内容', m5.shown && (m5.text || '').includes('铜刻星辰'), JSON.stringify(m5))
// 鼠标移出双链（移到空白处），260ms 内移入浮窗 → 应保持
await c.evalx(`document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 30, clientY: 300 }))`)
await c.sleep(80)
await c.evalx(`(() => { const p = document.querySelector('.dl-pop'); if (!p) return 0; const r = p.getBoundingClientRect(); p.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: r.left + 40, clientY: r.top + 20 })); return 1 })()`)
await c.sleep(400)
const keep = await c.evalx(`!!document.querySelector('.dl-pop')`)
check('移入浮窗保持显示', keep)
await c.evalx(`document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 30, clientY: 300 }))`)
await c.sleep(450)
check('宽限期后正常消失', await c.evalx(`!document.querySelector('.dl-pop')`))
await c.evalx(`(() => { const el = document.querySelector('.rich-host .dl-link'); const r = el.getBoundingClientRect(); el.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: r.left + 5, clientY: r.top + 5 })); return 1 })()`)
await c.sleep(500)
await c.evalx(`document.querySelector('.dl-pop .dl-pop-jump')?.click()`)
await c.sleep(1300)
const m6 = await c.evalx(`(() => { const lore = [...document.querySelectorAll('.rail-item')].findIndex(x => x.textContent.includes('设')); const act = [...document.querySelectorAll('.rail-item')].findIndex(x => x.classList.contains('active')); return { tabLore: lore === act, flash: document.querySelector('.ob-flash .ob-text')?.textContent?.slice(0, 8) } })()`)
check('跳转至设定并高亮节点', m6.tabLore && !!m6.flash, JSON.stringify(m6))

/* 4) 幕布：选中“穹顶大厅”→ 真实右键 → 插入双链 → 搜到正文选段 */
await c.evalx(`(async () => {
  const app = document.querySelector('#app').__vue_app__
  const work = app.config.globalProperties.$pinia._s.get('work')
  work.setChapterContent(work.liveChapters[0].id, '<p>他推开了穹顶大厅的门，铜刻星辰缓缓归位。</p>', 'html')
  await window.__flushNow()
  return 1
})()`)
const s1 = await c.evalx(`(() => {
  const target = [...document.querySelectorAll('.ob-text')].filter(x => x.textContent.trim() === '穹顶大厅')[0]
  if (!target) return 'no node'
  target.focus()
  const s = window.getSelection(); s.removeAllRanges()
  const r = document.createRange(); r.selectNodeContents(target)
  s.addRange(r)
  const rect = r.getBoundingClientRect()
  return { cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2 }
})()`)
check('幕布节点选中文本', typeof s1 === 'object' && s1.cx > 0, JSON.stringify(s1))
await rclick(s1.cx, s1.cy)
await c.sleep(600)
await c.evalx(`(() => { [...document.querySelectorAll('.ob-ctx .ctx-item')].find(i => i.textContent.includes('插入双链'))?.click(); return 1 })()`)
await c.sleep(500)
const s2 = await c.evalx(`(() => { const inp = document.querySelector('.ob-ctx .ctx-dlwrap input'); return { picker: !!inp, q: inp?.value } })()`)
check('幕布面板预填关键词', s2.picker && s2.q === '穹顶大厅', JSON.stringify(s2))
const s3 = await c.evalx(`(() => [...document.querySelectorAll('.ob-ctx .ctx-dlwrap .picker-item')].map(x => x.textContent.trim().slice(0, 44)))()`)
check('设定中搜到正文选段', s3.some(x => x.includes('正文') && x.includes('穹顶大厅')), JSON.stringify(s3))
await c.evalx(`(() => { [...document.querySelectorAll('.ob-ctx .ctx-dlwrap .picker-item')].find(x => x.textContent.includes('正文'))?.click(); return 1 })()`)
await c.sleep(700)
const s4 = await c.evalx(`(async () => {
  await window.__flushNow()
  const app = document.querySelector('#app').__vue_app__
  const work = app.config.globalProperties.$pinia._s.get('work')
  const n = work.mubu.find(x => (x.text || '').trim() === '穹顶大厅')
  const m = (n?.html || '').match(/data-dl-target="([^"]+)"/)
  return { span: (n?.html || '').includes('dl-link'), isChapter: !!m && m[1].startsWith('chapter:') }
})()`)
check('双链写入幕布节点并落库（指向正文）', s4.span && s4.isChapter, JSON.stringify(s4))

/* 5) 大纲令牌链路 */
await c.evalx(`(() => { [...document.querySelectorAll('.rail-item')].find(x => x.textContent.includes('纲'))?.click(); return 1 })()`)
await c.sleep(800)
await c.evalx(`(() => { [...document.querySelectorAll('.side-item')].find(x => x.textContent.includes('总纲'))?.click(); return 1 })()`)
await c.sleep(800)
const t1 = await c.evalx(`(() => { const ta = document.querySelector('textarea[data-dl-token]'); return { ta: !!ta } })()`)
check('大纲文本域就绪', t1.ta, JSON.stringify(t1))
const t2 = await c.evalx(`(() => { const ta = document.querySelector('textarea[data-dl-token]'); ta.focus(); ta.setSelectionRange(0, 0); const r = ta.getBoundingClientRect(); return { x: r.left + 46, y: r.top + 22 } })()`)
await rclick(t2.x, t2.y)
await c.sleep(600)
const t3 = await c.evalx(`(() => ({ menu: !!document.querySelector('.ctx-menu'), add: [...document.querySelectorAll('.ctx-menu .ctx-item')].some(i => i.textContent.includes('添加双链')) }))()`)
check('大纲右键快捷栏出现', t3.menu && t3.add, JSON.stringify(t3))
await c.evalx(`(() => { [...document.querySelectorAll('.ctx-menu .ctx-item')].find(i => i.textContent.includes('添加双链'))?.click(); return 1 })()`)
await c.sleep(500)
await c.evalx(`(() => {
  const inp = document.querySelector('.ctx-menu .ctx-dlwrap input')
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(inp, '铜刻星辰')
  inp.dispatchEvent(new Event('input', { bubbles: true }))
  return 1
})()`)
await c.sleep(450)
const t5 = await c.evalx(`(() => [...document.querySelectorAll('.ctx-menu .ctx-dlwrap .picker-item')].map(x => x.textContent.trim().slice(0, 36)))()`)
check('大纲面板关键词搜索命中', t5.length > 0, JSON.stringify(t5))
await c.evalx(`document.querySelector('.ctx-menu .ctx-dlwrap .picker-item')?.click()`)
await c.sleep(600)
const t6 = await c.evalx(`(async () => {
  await window.__flushNow()
  const ta = document.querySelector('textarea[data-dl-token]')
  return { token: /\\[\\[.+\\]\\]/.test(ta?.value || ''), val: (ta?.value || '').slice(0, 40) }
})()`)
check('双链令牌写入大纲', t6.token, JSON.stringify(t6))
await c.evalx(`(() => { const ta = document.querySelector('textarea[data-dl-token]'); const r = ta.getBoundingClientRect(); ta.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: r.left + 40, clientY: r.top + 20 })); return 1 })()`)
await c.sleep(700)
const t8 = await c.evalx(`(() => { const p = document.querySelector('.dl-pop'); return { shown: !!p, text: p?.innerText?.slice(0, 30) } })()`)
check('令牌悬浮预览', t8.shown, JSON.stringify(t8))
await rclick(t2.x, t2.y)
await c.sleep(500)
const t9 = await c.evalx(`(() => { const it = [...document.querySelectorAll('.ctx-menu .ctx-item')].find(i => i.textContent.includes('移除该双链')); it?.click(); return { had: !!it } })()`)
await c.sleep(500)
const t10 = await c.evalx(`(async () => { await window.__flushNow(); const ta = document.querySelector('textarea[data-dl-token]'); return { val: (ta?.value || '').slice(0, 40) } })()`)
check('移除该双链', t9.had && !/\\[\\[.+\\]\\]/.test(t10.val), JSON.stringify(t10))

const fail = results.filter(x => !x).length
console.log('==== ' + (results.length - fail) + '/' + results.length + ' 通过 ====')
process.exit(fail ? 1 : 0)
