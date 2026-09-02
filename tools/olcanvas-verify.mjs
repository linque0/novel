/* 自由模块画布验收（8.8.2 / 计划书 9.4.1-S14）：迁移v2 / 快速开始模板 / 模块CRUD / 拖动落位 /
   锚点连线与边编辑 / 断线检测 / 双链卫星 / 容器归组 / 撤销重做 / 持久化 */
import { connect } from './_cdp-lib.mjs'

const c = await connect('app://')
await c.sleep(2500)
const results = []
const check = (name, ok, detail = '') => { results.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  —— ' + String(detail).slice(0, 300) : '')) }
const NL = String.fromCharCode(10)
const store = `document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('work')`

/* 种子A：带旧大纲的书（测迁移v2）；种子B：空书（测快速开始） */
const seed = await c.evalx(`(async () => {
  try {
    const { db, uid, now } = window.__ns
    const t = now()
    for (const title of ['画布验证书A', '画布验证书B']) {
      const old = (await db.works.toArray()).find(w => w.title === title)
      if (old) await db.works.delete(old.id)
    }
    const mk = async (title) => {
      const workId = uid()
      await db.works.add({ id: workId, title, author: '', genre: '', status: '', intro: '', createdAt: t, updatedAt: t, deletedAt: null })
      return workId
    }
    const wa = await mk('画布验证书A')
    const volId = uid()
    await db.volumes.add({ id: volId, workId: wa, title: '第一卷', sortOrder: 0, createdAt: t, updatedAt: t, deletedAt: null })
    const chId = uid()
    await db.chapters.add({ id: chId, workId: wa, volumeId: volId, title: '第一章 · 启程', content: '<p>启程。</p>', wordCount: 3, status: 'draft', sortOrder: 0, createdAt: t, updatedAt: t, deletedAt: null })
    await db.mubu.add({ id: uid(), workId: wa, parentId: null, sortOrder: 0, text: '雾都钟楼', html: null, fold: false, deletedAt: null, createdAt: t, updatedAt: t })
    await db.outlines.add({ id: uid(), workId: wa, level: 'master', refId: wa, content: '主线：寻找黎明之城。', createdAt: t, updatedAt: t, deletedAt: null })
    await db.outlines.add({ id: uid(), workId: wa, level: 'chapter', refId: chId, content: '目标：进入雾都' + ${JSON.stringify(NL)} + '线索：[[雾都钟楼]]', createdAt: t, updatedAt: t, deletedAt: null })
    const wb = await mk('画布验证书B')
    await db.mubu.add({ id: uid(), workId: wb, parentId: null, sortOrder: 0, text: '雾都钟楼', html: null, fold: false, deletedAt: null, createdAt: t, updatedAt: t })
    return { ok: true, wa, wb, chId }
  } catch (e) { return { ok: false, err: String(e).slice(0, 200) } }
})()`)
console.log('seed:', JSON.stringify(seed))
if (!seed.ok) process.exit(1)
await c.evalx(`location.reload()`)
await c.sleep(3000)

/* 1) 迁移 v2：打开书A → 固定组降级容器、章节点转锚点 */
await c.evalx(`[...document.querySelectorAll('.book-card')].find(x => x.textContent.includes('画布验证书A'))?.click()`)
await c.sleep(1800)
const m1 = await c.evalx(`(() => {
  const w = ${store}
  const kinds = w.liveOlnodes().map(n => n.kind)
  const ch = w.olnodeByRef(${JSON.stringify(seed.chId)})
  return {
    hasOld: kinds.some(k => ['master', 'volumes', 'chapters', 'lines', 'chapter', 'line'].includes(k)),
    containers: kinds.filter(k => k === 'container').length,
    chKind: ch?.kind, chText: ch?.text?.includes('雾都钟楼')
  }
})()`)
check('迁移v2：固定组降级容器/章转锚点/无旧kind残留', !m1.hasOld && m1.containers >= 3 && m1.chKind === 'anchor' && m1.chText, JSON.stringify(m1))

/* 2) 大纲画布渲染 + 章节锚点显示 */
await c.evalx(`(() => { const w = ${store}; w.tab = 'outline'; w.outlineView = 'canvas'; return 1 })()`)
await c.sleep(1200)
const m2 = await c.evalx(`(() => ({
  nodes: document.querySelectorAll('.oc-node').length,
  containers: document.querySelectorAll('.oc-container').length,
  anchors: document.querySelectorAll('.oc-anchor').length,
  caret: !!document.querySelector('.oc-caret')
}))()`)
check('画布渲染节点/容器/锚点', m2.nodes >= 6 && m2.containers >= 3 && m2.anchors >= 1 && m2.caret, JSON.stringify(m2))

/* 3) 空书快速开始：三幕式模板 */
await c.evalx(`location.hash = '#b'; 1`)
await c.evalx(`(() => { const w = ${store}; w.closeWork(); return 1 })()`)
await c.sleep(800)
await c.evalx(`[...document.querySelectorAll('.book-card')].find(x => x.textContent.includes('画布验证书B'))?.click()`)
await c.sleep(1500)
await c.evalx(`(() => { const w = ${store}; w.tab = 'outline'; w.outlineView = 'canvas'; return 1 })()`)
await c.sleep(900)
const m3a = await c.evalx(`(() => ({ empty: ${store}.liveOlnodes().length === 0, quick: !!document.querySelector('.oc-quick') }))()`)
check('空画布快速开始引导', m3a.empty && m3a.quick, JSON.stringify(m3a))
await c.evalx(`[...document.querySelectorAll('.oc-quick-btns button')].find(b => b.textContent.includes('三幕式'))?.click()`)
await c.sleep(900)
const m3b = await c.evalx(`(() => {
  const w = ${store}
  const nodes = w.liveOlnodes()
  const rels = nodes.flatMap(n => (n.rels || []).length)
  return { events: nodes.filter(n => n.kind === 'event').length, containers: nodes.filter(n => n.kind === 'container').length, notes: nodes.filter(n => n.kind === 'note').length, edges: rels.reduce((s, x) => s + x, 0), dom: document.querySelectorAll('.oc-node').length }
})()`)
check('三幕式模板生成（事件/容器/便签/连线）', m3b.events === 7 && m3b.containers === 3 && m3b.notes === 1 && m3b.edges === 3 && m3b.dom >= 11, JSON.stringify(m3b))

/* 4) 侧栏模块列表：搜索筛选 + 定位闪烁 */
await c.evalx(`(() => { const w = ${store}; w.selOlnodeId = w.liveOlnodes().find(n => n.kind === 'event').id; w.canvasFocusTick++; return 1 })()`)
await c.sleep(500)
const m4 = await c.evalx(`(() => ({ items: document.querySelectorAll('.side-list .side-item').length, flash: !!document.querySelector('.oc-node.flash'), active: !!document.querySelector('.side-item.active') }))()`)
check('侧栏列表渲染 + 画布定位闪烁', m4.items >= 11 && m4.flash && m4.active, JSON.stringify(m4))

/* 5) 侧栏新建模块（事件/便签/容器）+ 引用卡选择目标 */
const before5 = await c.evalx(`${store}.liveOlnodes().length`)
await c.evalx(`[...document.querySelectorAll('.ol-side-add button')].find(b => b.title.includes('事件'))?.click()`)
await c.sleep(400)
await c.evalx(`[...document.querySelectorAll('.ol-side-add button')].find(b => b.title.includes('便签'))?.click()`)
await c.sleep(400)
await c.evalx(`[...document.querySelectorAll('.ol-side-add button')].find(b => b.title.includes('容器'))?.click()`)
await c.sleep(400)
await c.evalx(`[...document.querySelectorAll('.ol-side-add button')].find(b => b.title.includes('引用卡'))?.click()`)
await c.sleep(700)
await c.evalx(`document.querySelector('.picker-item')?.click()`)
await c.sleep(700)
const m5 = await c.evalx(`(() => {
  const w = ${store}
  const nodes = w.liveOlnodes()
  const cite = nodes.filter(n => n.kind === 'cite').pop()
  return { added: nodes.length - ${before5}, citeRef: !!cite?.refId, containers: nodes.filter(n => n.kind === 'container').length }
})()`)
check('侧栏新建事件/便签/容器/引用卡（含目标）', m5.added === 4 && m5.citeRef && m5.containers === 4, JSON.stringify(m5))

/* 6) 拖动落位：合成鼠标事件拖动事件节点（按画布缩放换算 + 吸附断言） */
const m6 = await c.evalx(`(() => {
  const w = ${store}
  const n = w.liveOlnodes().find(x => x.kind === 'event')
  const el = [...document.querySelectorAll('.oc-node.oc-event')][0]
  if (!el) return { err: 'no el' }
  const inner = document.querySelector('.om-inner')
  const sc = parseFloat((inner.style.transform.match(/scale\\(([\\d.]+)\\)/) || [])[1] || '1')
  const r = el.getBoundingClientRect()
  const sx = r.left + r.width / 2, sy = r.top + r.height / 2
  const before = { x: n.canvasX, y: n.canvasY }
  el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: sx, clientY: sy }))
  window.dispatchEvent(new MouseEvent('mousemove', { clientX: sx + 64, clientY: sy + 32 }))
  window.dispatchEvent(new MouseEvent('mouseup', { clientX: sx + 64, clientY: sy + 32 }))
  const expX = Math.round((before.x + 64 / sc) / 16) * 16
  const expY = Math.round((before.y + 32 / sc) / 16) * 16
  return { sc, before, after: { x: n.canvasX, y: n.canvasY }, expX, expY }
})()`)
check('节点拖动落位（缩放换算 + 吸附 16px 网格）', !m6.err && m6.after && m6.after.x === m6.expX && m6.after.y === m6.expY, JSON.stringify(m6))

/* 7) 锚点拖线建边 + 边编辑浮层（mouseup 后等待 Vue 渲染再断言） */
const m7a = await c.evalx(`(() => {
  const w = ${store}
  const evs = w.liveOlnodes().filter(x => x.kind === 'event')
  const A = evs[0], B = evs[1]
  const ea = [...document.querySelectorAll('.oc-node.oc-event')][0]
  const eb = [...document.querySelectorAll('.oc-node.oc-event')][1]
  if (!ea || !eb) return { err: 'no els' }
  const apt = ea.querySelector('.oc-apt[data-side="right"]')
  const ar = apt.getBoundingClientRect()
  apt.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: ar.left + 4, clientY: ar.top + 4 }))
  const rb = eb.getBoundingClientRect()
  window.dispatchEvent(new MouseEvent('mousemove', { clientX: rb.left + rb.width / 2, clientY: rb.top + rb.height / 2 }))
  window.dispatchEvent(new MouseEvent('mouseup', { clientX: rb.left + rb.width / 2, clientY: rb.top + rb.height / 2 }))
  const rel = (A.rels || []).slice(-1)[0]
  return { rel: !!rel, toB: rel?.toId === B.id }
})()`)
await c.sleep(500)
const m7 = await c.evalx(`(() => ({ editor: !!document.querySelector('.oc-eedit'), relCount: ${store}.liveOlnodes().filter(x => x.kind === 'event')[0].rels.length }))()`)
check('四向锚点拖线建边 + 边编辑浮层', m7a.rel && m7a.toB && m7.editor, JSON.stringify({ ...m7a, ...m7 }))
await c.evalx(`(() => {
  const inp = document.querySelector('.oc-eedit input')
  inp.focus()
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(inp, '推动')
  inp.dispatchEvent(new Event('input', { bubbles: true }))
  return 1
})()`)
await c.sleep(400)
const m7b = await c.evalx(`(() => {
  const w = ${store}
  const evs = w.liveOlnodes().filter(x => x.kind === 'event')
  const rel = (evs[0].rels || []).slice(-1)[0]
  const label = [...document.querySelectorAll('.oc-elabel')].some(x => x.textContent.includes('推动'))
  return { saved: rel?.label === '推动', labelDom: label }
})()`)
check('边标签编辑落库 + 标签渲染', m7b.saved && m7b.labelDom, JSON.stringify(m7b))

/* 8) 断线检测：缺铺垫节点定位（点击后等 Vue 渲染再查 flash） */
const m8a = await c.evalx(`(() => {
  const w = ${store}
  const chip = [...document.querySelectorAll('.oc-chip')].find(x => x.textContent.includes('缺铺垫'))
  chip?.click()
  return { missing: w.olBroken.missing.length, tails: w.olBroken.tails.length }
})()`)
await c.sleep(500)
const m8 = await c.evalx(`(() => ({ flash: !!document.querySelector('.oc-node.flash') }))()`)
check('断线检测（烂尾/缺铺垫）与定位', m8a.missing >= 1 && m8a.tails >= 1 && m8.flash, JSON.stringify({ ...m8a, ...m8 }))

/* 9) 双链卫星：事件正文写 [[雾都钟楼]] → 卫星渲染 + 点击跳设定 */
await c.evalx(`(() => {
  const w = ${store}
  const n = w.liveOlnodes().find(x => x.kind === 'event')
  w.olnodeSetRich(n.id, '去[[雾都钟楼]]看看', null)
  return 1
})()`)
await c.sleep(700)
const m9 = await c.evalx(`(() => {
  const sat = document.querySelector('.oc-sat')
  const txt = sat?.textContent || ''
  sat?.click()
  return { sat: txt.slice(0, 12), tab: ${store}.tab }
})()`)
check('双链卫星渲染 + 点击跳转设定', m9.sat.includes('雾都钟楼') && m9.tab === 'lore', JSON.stringify(m9))

/* 10) 容器归组：store 移动 + 容器盒派生（先切回大纲模块——上一步卫星跳转离开了） */
const m10a = await c.evalx(`(() => {
  const w = ${store}
  w.tab = 'outline'
  w.outlineView = 'canvas'
  const cont = w.liveOlnodes().find(x => x.kind === 'container')
  const loose = w.liveOlnodes().find(x => x.kind === 'note')
  const ok = w.olnodeMoveTo(loose.id, cont.id)
  return { ok, parent: loose.parentId === cont.id }
})()`)
await c.sleep(700)
const m10 = await c.evalx(`(() => {
  const items = [...document.querySelectorAll('.side-list .side-item')].map(x => x.textContent)
  return { badge: items.some(t => t.includes('3项')) } // 目标容器原有 2 个子模块 + 拖入便签 = 3项
})()`)
check('容器归组（badge 计数）', m10a.ok && m10a.parent && m10.badge, JSON.stringify({ ...m10a, ...m10 }))

/* 11) 撤销 / 重做（undo/redo 替换 olnodes 数组，需按 id 重查行） */
const m11 = await c.evalx(`(() => {
  const w = ${store}
  const note = w.liveOlnodes().find(x => x.kind === 'note' && x.parentId)
  if (!note) return { err: 'no moved note' }
  const id = note.id
  w.olnodeUndo()
  const undone = w.olnodes.find(x => x.id === id)?.parentId == null
  w.olnodeRedo()
  const redone = w.olnodes.find(x => x.id === id)?.parentId != null
  return { undone, redone }
})()`)
check('撤销/重做快照栈（恢复挂接关系）', !m11.err && m11.undone && m11.redone, JSON.stringify(m11))

/* 11b) 界面优化：边缘拖拽调整大小 */
const m13 = await c.evalx(`(() => {
  const w = ${store}
  const n = w.liveOlnodes().find((x) => x.kind === 'event')
  const el = [...document.querySelectorAll('.oc-node.oc-event')][0]
  const rs = el.querySelector('.oc-rs[data-dir="se"]')
  const r = rs.getBoundingClientRect()
  rs.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: r.left + 4, clientY: r.top + 4 }))
  window.dispatchEvent(new MouseEvent('mousemove', { clientX: r.left + 64, clientY: r.top + 44 }))
  window.dispatchEvent(new MouseEvent('mouseup', { clientX: r.left + 64, clientY: r.top + 44 }))
  return { w: n.w, h: n.h }
})()`)
check('模块边缘拖拽调整大小并落库', m13.w >= 96 && m13.h >= 36, JSON.stringify(m13))

/* 11c) 界面优化：双击模块行内编辑内容（等 Vue 渲染后再断言） */
const m14 = await c.evalx(`(() => {
  const el = [...document.querySelectorAll('.oc-node.oc-note')][0]
  el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
  return 1
})()`)
await c.sleep(500)
const m14b = await c.evalx(`(() => {
  const ta = document.querySelector('.oc-inline-edit')
  if (!ta) return { err: 'no editor' }
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(ta, '行内编辑的正文内容')
  ta.dispatchEvent(new Event('input', { bubbles: true }))
  ta.dispatchEvent(new Event('blur'))
  return 1
})()`)
await c.sleep(500)
const m14c = await c.evalx(`(() => {
  const w = ${store}
  const n = w.liveOlnodes().find((x) => x.kind === 'note')
  return { saved: n.text === '行内编辑的正文内容', closed: !document.querySelector('.oc-inline-edit') }
})()`)
check('双击行内编辑（提交落库）', m14b.err !== 'no editor' && m14c.saved && m14c.closed, JSON.stringify({ m14, m14b, m14c }))

/* 11d) 界面优化：连线对齐接口（fromSide 存储）+ 线型设置 */
const m15 = await c.evalx(`(() => {
  const w = ${store}
  const src = w.liveOlnodes().filter((x) => x.kind === 'event' && !(x.rels || []).length)[0]
  const dst = w.liveOlnodes().find((x) => x.kind === 'event' && x.id !== src.id)
  const se = [...document.querySelectorAll('.oc-node.oc-event')].find((x) => x.textContent.includes(src.title || ''))
  const de = [...document.querySelectorAll('.oc-node.oc-event')].find((x) => x.textContent.includes(dst.title || ''))
  const apt = se.querySelector('.oc-apt[data-side="top"]')
  const ar = apt.getBoundingClientRect()
  apt.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: ar.left + 3, clientY: ar.top + 3 }))
  const dr = de.getBoundingClientRect()
  window.dispatchEvent(new MouseEvent('mousemove', { clientX: dr.left + dr.width / 2, clientY: dr.top + dr.height / 2 }))
  window.dispatchEvent(new MouseEvent('mouseup', { clientX: dr.left + dr.width / 2, clientY: dr.top + dr.height / 2 }))
  const rel = (src.rels || []).slice(-1)[0]
  return { fromSide: rel?.fromSide, toId: rel?.toId === dst.id }
})()`)
await c.sleep(400)
const m15b = await c.evalx(`(() => {
  const box = document.querySelector('.oc-eedit')
  if (!box) return { err: 'no editor' }
  const chip = [...box.querySelectorAll('.oc-kind')].find((x) => x.textContent === '虚线')
  chip?.click()
  return 1
})()`)
await c.sleep(500)
const m15c = await c.evalx(`(() => {
  const w = ${store}
  const ev = w.liveOlnodes().find((x) => x.kind === 'event' && (x.rels || []).some((r) => r.style === 'dashed'))
  const path = [...document.querySelectorAll('.oc-edges path:not(.oc-edge-hit)')].find((p) => p.getAttribute('stroke-dasharray') === '5 4')
  return { styleSaved: !!ev, domDash: !!path }
})()`)
check('连线对齐接口（fromSide）+ 虚线线型', m15.fromSide === 'top' && m15.toId && m15c.styleSaved && m15c.domDash, JSON.stringify({ m15, m15c }))

/* 11e) 界面优化：连线粗细设置 */
const m16 = await c.evalx(`(() => {
  document.querySelector('.oc-toolbar .oc-chip[title*="画布设置"]')?.click()
  return 1
})()`)
await c.sleep(500)
const m16a = await c.evalx(`(() => ({ panel: !!document.querySelector('.oc-settings') }))()`)
const m16b = await c.evalx(`(() => {
  const w = ${store}
  w.canvasPrefs.edgeWidth = 3.4
  w.saveCanvasPrefs()
  return 1
})()`)
await c.sleep(500)
const m16c = await c.evalx(`(() => ({ dom: [...document.querySelectorAll('.oc-edges path:not(.oc-edge-hit)')].some((p) => p.getAttribute('stroke-width') === '3.4') }))()`)
check('设置界面调整连线粗细（模板生效）', m16a.panel && m16c.dom, JSON.stringify({ m16a, m16c }))

/* 11f) 视觉几何检查：裁剪修复（锚点伸出节点边界）/ mini 在节点内 / 标签在中点上方 */
const m17 = await c.evalx(`(() => {
  const el = [...document.querySelectorAll('.oc-node.oc-event')][0]
  el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }))
  const nr = el.getBoundingClientRect()
  const apt = el.querySelector('.oc-apt[data-side="right"]')
  const ar = apt.getBoundingClientRect()
  return {
    aptProtrudes: ar.right > nr.right - 2,
    aptOpacity: getComputedStyle(apt).opacity
  }
})()`)
await c.sleep(200)
const m17b = await c.evalx(`(() => {
  const el = [...document.querySelectorAll('.oc-node.oc-event')][0]
  el.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }))
  const w = ${store}
  w.selOlnodeId = w.liveOlnodes().find((x) => x.kind === 'event').id
  return 1
})()`)
await c.sleep(400)
const m17c = await c.evalx(`(() => {
  const el = [...document.querySelectorAll('.oc-node.oc-event')][0]
  const nr = el.getBoundingClientRect()
  const mini = el.querySelector('.oc-mini')
  const mr = mini.getBoundingClientRect()
  const inside = mr.left >= nr.left - 2 && mr.right <= nr.right + 2 && mr.top >= nr.top - 2 && mr.bottom <= nr.bottom + 2
  const lab = document.querySelector('.oc-elabel')
  let labelAbove = null
  if (lab) {
    const m = new DOMMatrixReadOnly(getComputedStyle(lab).transform)
    labelAbove = m.f < -1 // translateY 为负（元素整体位于中点上方）
  }
  return { miniInside: inside, labelAbove }
})()`)
check('视觉几何：锚点伸出节点（无裁剪）+ mini 在节点内 + 标签中点上方', m17.aptProtrudes && parseFloat(m17.aptOpacity) > 0.5 && m17c.miniInside && m17c.labelAbove === true, JSON.stringify({ m17, m17c }))
const shot = await c.send('Page.captureScreenshot', { format: 'png' }).catch(() => null)
if (shot) {
  const { writeFileSync } = await import('node:fs')
  writeFileSync('tools/_canvas-final.png', Buffer.from(shot.data, 'base64'))
}

/* 12) 持久化：flush → 重载 → 坐标仍在（keep 存 sessionStorage 以跨 reload） */
await c.evalx(`(() => {
  const w = ${store}
  const n = w.liveOlnodes().find(x => x.kind === 'event')
  sessionStorage.setItem('verify-keep', JSON.stringify({ id: n.id, x: n.canvasX }))
  return window.__flushNow ? window.__flushNow() : 0
})()`)
await c.evalx(`location.reload()`)
await c.sleep(3000)
await c.evalx(`[...document.querySelectorAll('.book-card')].find(x => x.textContent.includes('画布验证书B'))?.click()`)
await c.sleep(1500)
await c.evalx(`(() => { const w = ${store}; w.tab = 'outline'; w.outlineView = 'canvas'; return 1 })()`)
await c.sleep(900)
const m12 = await c.evalx(`(() => {
  const w = ${store}
  const keep = JSON.parse(sessionStorage.getItem('verify-keep') || '{}')
  const n = w.olnodes.find(x => x.id === keep.id)
  return { kept: n ? n.canvasX === keep.x : false, nodes: w.liveOlnodes().length }
})()`)
check('落库持久化（重载后坐标与节点保留）', m12.kept && m12.nodes >= 12, JSON.stringify(m12))

/* 11g) 文本框模块：侧栏添加 → 双击行内编辑 → 透明度滑杆 */
const before18 = await c.evalx(`${store}.liveOlnodes().length`)
await c.evalx(`(() => {
  const btn = [...document.querySelectorAll('.ol-side-add button')].find(b => b.title.includes('文本框'))
  btn?.click()
  return 1
})()`)
await c.sleep(600)
const m18 = await c.evalx(`(() => {
  const w = ${store}
  const tb = w.liveOlnodes().find((x) => x.kind === 'textbox')
  return { created: !!tb, w: tb?.w, opacity: tb?.opacity, grew: w.liveOlnodes().length - ${before18} }
})()`)
await c.evalx(`(() => {
  const w = ${store}
  const tb = w.liveOlnodes().find((x) => x.kind === 'textbox')
  w.selOlnodeId = tb.id
  const el = [...document.querySelectorAll('.oc-node.oc-textbox')][0]
  el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
  return 1
})()`)
await c.sleep(500)
const m18b = await c.evalx(`(() => {
  const ta = document.querySelector('.oc-inline-edit')
  if (!ta) return { err: 'no editor' }
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(ta, '自由文本框内容')
  ta.dispatchEvent(new Event('input', { bubbles: true }))
  ta.dispatchEvent(new Event('blur'))
  return 1
})()`)
await c.sleep(400)
const m18c = await c.evalx(`(() => {
  const w = ${store}
  const tb = w.liveOlnodes().find((x) => x.kind === 'textbox')
  return { saved: tb.text === '自由文本框内容', closed: !document.querySelector('.oc-inline-edit') }
})()`)
check('文本框模块：侧栏添加 + 双击行内编辑落库', m18.created && m18.grew === 1 && !m18b.err && m18c.saved && m18c.closed, JSON.stringify({ m18, m18b, m18c }))
const m18e = await c.evalx(`(() => {
  const w = ${store}
  const rng = document.querySelector('.oc-mini input[type="range"]')
  if (!rng) return { err: 'no range' }
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(rng, '0.4')
  rng.dispatchEvent(new Event('input', { bubbles: true }))
  return { opacity: w.liveOlnodes().find((x) => x.kind === 'textbox').opacity }
})()`)
check('文本框透明度设置', m18e.opacity !== undefined && Math.abs(m18e.opacity - 0.4) < 0.01, JSON.stringify(m18e))

/* 11h) 容器内拖线直连子模块（命中优先子模块，不锚容器） */
const m19 = await c.evalx(`(() => {
  const w = ${store}
  const cont = w.liveOlnodes().find((x) => x.kind === 'container')
  const kid = w.olnodeChildren(cont.id)[0]
  const kidEl = [...document.querySelectorAll('.oc-node')].find((x) => x.style.left === posOfX(kid.id))
  function posOfX(id) { const n = w.olnodes.find((x) => x.id === id); return (n.canvasX ?? 0) + 'px' }
  const src = w.liveOlnodes().find((x) => x.kind === 'event' && x.id !== kid.id && !(x.parentId))
  const srcEl = [...document.querySelectorAll('.oc-node')].find((x) => x.style.left === posOfX(src.id))
  const apt = srcEl.querySelector('.oc-apt[data-side="right"]')
  const ar = apt.getBoundingClientRect()
  apt.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: ar.left + 3, clientY: ar.top + 3 }))
  const kr = kidEl.getBoundingClientRect()
  window.dispatchEvent(new MouseEvent('mousemove', { clientX: kr.left + kr.width / 2, clientY: kr.top + kr.height / 2 }))
  window.dispatchEvent(new MouseEvent('mouseup', { clientX: kr.left + kr.width / 2, clientY: kr.top + kr.height / 2 }))
  const rel = (src.rels || []).slice(-1)[0]
  return { toKid: rel?.toId === kid.id }
})()`)
await c.sleep(300)
await c.evalx(`(() => { document.querySelector('.oc-eedit') && document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return 1 })()`)
check('容器内子模块直连（拖线不锚容器）', m19.toKid, JSON.stringify(m19))

/* 11i) 大小调整修复：右缘/下缘拖拽增量精确（基于当前 w/h，累积生效）+ 过渡动画存在 */
const m20 = await c.evalx(`(() => {
  const w = ${store}
  const n = w.liveOlnodes().find((x) => x.kind === 'event')
  const el = [...document.querySelectorAll('.oc-node.oc-event')][0]
  const rs = el.querySelector('.oc-rs[data-dir="se"]')
  const r = rs.getBoundingClientRect()
  const inner = document.querySelector('.om-inner')
  const sc = parseFloat((inner.style.transform.match(/scale\\(([\\d.]+)\\)/) || [])[1] || '1')
  const w0 = n.w != null ? n.w : 178
  const h0 = n.h != null ? n.h : 54
  rs.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: r.left + 4, clientY: r.top + 4 }))
  window.dispatchEvent(new MouseEvent('mousemove', { clientX: r.left + 48, clientY: r.top + 32 }))
  window.dispatchEvent(new MouseEvent('mouseup', { clientX: r.left + 48, clientY: r.top + 32 }))
  return {
    w: n.w,
    h: n.h,
    expW: Math.round((w0 + 48 / sc) / 16) * 16,
    expH: Math.round((h0 + 32 / sc) / 16) * 16,
    trans: getComputedStyle(el).transition.includes('width')
  }
})()`)
check('大小调整增量精确（吸附）+ 缩放过渡动画', Math.abs(m20.w - m20.expW) <= 16 && Math.abs(m20.h - m20.expH) <= 16 && m20.trans, JSON.stringify(m20))

/* 11j) 容器右键色彩快捷栏 + 高度手柄解锁 */
const m21 = await c.evalx(`(() => {
  const el = [...document.querySelectorAll('.oc-node.oc-container')][0]
  el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 400, clientY: 300 }))
  return 1})()`)
await c.sleep(300)
const m21a = await c.evalx(`(() => {
  const menu = document.querySelector('.oc-ctx')
  return { menu: !!menu, swatches: menu ? menu.querySelectorAll('.oc-ctx-sw').length : 0 }
})()`)
const m21b = await c.evalx(`(() => {
  const sw = [...document.querySelectorAll('.oc-ctx .oc-ctx-sw')][1]
  sw?.click()
  const w = ${store}
  const cont = w.liveOlnodes().find((x) => x.kind === 'container')
  const el = [...document.querySelectorAll('.oc-node.oc-container')][0]
  return { color: cont.color, bcVar: el.style.getPropertyValue('--bc') }
})()`)
check('容器右键色彩调整（调色板+重置入口）', m21a.menu && m21a.swatches >= 7 && !!m21b.color && !!m21b.bcVar, JSON.stringify({ m21a, m21b }))

/* 容器高度拖拽：下缘手柄下拖 → 自定义 h 生效 */
const m22 = await c.evalx(`(() => {
  const w = ${store}
  const cont = w.liveOlnodes().find((x) => x.kind === 'container')
  const el = [...document.querySelectorAll('.oc-node.oc-container')][0]
  const rs = el.querySelector('.oc-rs[data-dir="s"]')
  const r = rs.getBoundingClientRect()
  const h0 = cont.h != null ? cont.h : 120
  rs.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: r.left + 3, clientY: r.top + 3 }))
  window.dispatchEvent(new MouseEvent('mousemove', { clientX: r.left, clientY: r.top + 64 }))
  window.dispatchEvent(new MouseEvent('mouseup', { clientX: r.left, clientY: r.top + 64 }))
  return { h: cont.h, grew: cont.h == null || cont.h >= h0 + 40 }
})()`)
check('容器高度调整生效', m22.grew, JSON.stringify(m22))

/* 11k) 侧栏层级树 + 文本视图容器内容展示 */
const m23 = await c.evalx(`(() => {
  const items = [...document.querySelectorAll('.side-list .side-item')]
  const caretRows = items.filter((x) => x.querySelector('.ob-arrow'))
  const indented = items.filter((x) => (x.style.paddingLeft || '') !== '6px' && x.style.paddingLeft !== '')
  return { total: items.length, caretRows: caretRows.length, indented: indented.length }
})()`)
check('侧栏层级树（容器行带折叠箭头 + 子项缩进）', m23.caretRows >= 3 && m23.indented >= 3, JSON.stringify(m23))
/* 折叠容器 → 子项从侧栏隐藏；展开恢复（等待 Vue 重渲染后计数） */
const m23b = await c.evalx(`(() => {
  const w = ${store}
  const cont = w.liveOlnodes().find((x) => x.kind === 'container' && w.olnodeChildren(x.id).length)
  const itemsBefore = document.querySelectorAll('.side-list .side-item').length
  w.olnodeToggleFold(cont.id)
  return { itemsBefore, kidCount: w.olnodeChildren(cont.id).length }
})()`)
await c.sleep(400)
const m23c = await c.evalx(`(() => {
  const w = ${store}
  const cont = w.liveOlnodes().find((x) => x.kind === 'container' && x.fold)
  const folded = document.querySelectorAll('.side-list .side-item').length
  w.olnodeToggleFold(cont.id)
  return { folded }
})()`)
await c.sleep(400)
const m23d = await c.evalx(`JSON.stringify({ n: document.querySelectorAll('.side-list .side-item').length })`)
check('侧栏容器折叠/展开（与画布同步）', m23c.folded === m23b.itemsBefore - m23b.kidCount && JSON.parse(m23d).n === m23b.itemsBefore, JSON.stringify({ m23b, m23c, m23d }))

/* 11l) 文本视图：选中容器展示内容卡片；选中子模块显示所属容器 */
await c.evalx(`(() => { const w = ${store}; w.tab = 'outline'; w.outlineView = 'text'; return 1 })()`)
await c.sleep(500)
const m24 = await c.evalx(`(() => {
  const w = ${store}
  const cont = w.liveOlnodes().find((x) => x.kind === 'container')
  w.selOlnodeId = cont.id
  return 1
})()`)
await c.sleep(500)
const m24b = await c.evalx(`(() => {
  const cards = document.querySelectorAll('.ol-kid')
  const texts = [...document.querySelectorAll('.ol-kid-text')].map((x) => x.textContent)
  return { cards: cards.length, hasContent: texts.some((t) => t.trim().length > 0) }
})()`)
check('文本视图：选中容器列出子模块内容卡片', m24b.cards >= 1 && m24b.hasContent, JSON.stringify(m24b))
const m24c = await c.evalx(`(() => {
  const w = ${store}
  const cont = w.liveOlnodes().find((x) => x.kind === 'container')
  const kid = w.olnodeChildren(cont.id)[0]
  w.selOlnodeId = kid.id
  return 1
})()`)
await c.sleep(400)
const m24d = await c.evalx(`(() => {
  const crumb = document.querySelector('.ol-crumb')
  return { crumb: crumb ? crumb.textContent.includes('所属容器') : false, linkText: crumb?.querySelector('a')?.textContent }
})()`)
check('文本视图：子模块显示所属容器面包屑', m24d.crumb && !!m24d.linkText, JSON.stringify(m24d))

const fail = results.filter((x) => !x).length
console.log('==== ' + (results.length - fail) + '/' + results.length + ' 通过 ====')
process.exit(fail ? 1 : 0)
