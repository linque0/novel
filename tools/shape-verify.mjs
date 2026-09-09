/* shape-verify.mjs —— v1.0.16 单一功能验收（只测新功能，不做全量回归）
 * 1. 线间连线（连接点→连接点）箭头在接入端（倒错修复）
 * 2. 左键点击连线不弹编辑浮层
 * 3. 左键按住拖动 → 连线弯曲（custom 控制点 + 路径变弯）
 * 4. 拖回近直线 → 自动拉直（custom 清除）
 * 5. 双击弯曲连线 → 恢复自动路由 */
import { connect } from './_cdp-lib.mjs'
const c = await connect('http://127.0.0.1:5173')
await c.sleep(2000)
const results = []
const check = (name, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  [' + extra + ']' : ''}`)
}
const store = `document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('work')`

/* 种子：两模块一条线 + 连接点 + 从连接点引到另一条线（形成线间连线） */
await c.evalx(`(async () => {
  const w = ${store}
  const shelf = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('shelf')
  await shelf.refresh()
  let book = shelf.works.find((x) => x.title === '塑形验证书')
  if (!book) book = await shelf.createWork({ title: '塑形验证书' })
  if (!w.work || w.work.id !== book.id) { await w.open(book.id); await new Promise((r) => setTimeout(r, 900)) }
  for (const n of [...w.olnodes]) if (!n.deletedAt) await w.olnodeRemove(n.id)
  const a = w.olnodeAdd(null, { kind: 'event', title: '甲', canvasX: 200, canvasY: 200 })
  const b = w.olnodeAdd(null, { kind: 'event', title: '乙', canvasX: 700, canvasY: 200 })
  w.olnodeRelAdd(a.id, b.id, { label: '上线' })
  const cc = w.olnodeAdd(null, { kind: 'event', title: '丙', canvasX: 200, canvasY: 640 })
  const d = w.olnodeAdd(null, { kind: 'event', title: '丁', canvasX: 700, canvasY: 640 })
  w.olnodeRelAdd(cc.id, d.id, { label: '下线' })
  /* 上线建连接点，用 store API 直接线连到下线（复现倒错场景） */
  const topRel = a.rels[0]
  const j1 = w.olnodeJunctionAdd(a.id, topRel.id, 0.5)
  const bottomRel = cc.rels[0]
  const j2 = w.olnodeJunctionAdd(cc.id, bottomRel.id, 0.5)
  w.olnodeRelAddJunctionToJunction({ ownerId: a.id, relId: topRel.id, junctionId: j1.id }, { ownerId: cc.id, relId: bottomRel.id, junctionId: j2.id })
  w.tab = 'outline'; w.outlineView = 'canvas'
  await new Promise((r) => setTimeout(r, 800))
  return 1
})()`)
await c.evalx(`(() => { const btn = [...document.querySelectorAll('.om-btn.text')].find((x) => x.textContent.includes('适应')); btn?.click(); return 1 })()`)
await c.sleep(600)
/* 关闭可能残留的 Naive UI 模态/确认层（n-modal 会盖住画布使 elementFromPoint/鼠标全部失效） */
await c.evalx(`(() => {
  const modals = document.querySelectorAll('.n-modal-mask, .n-modal-scroll-content, .n-modal-container')
  modals.forEach((m) => m.remove())
  document.querySelectorAll('.n-modal-body-wrapper').forEach((m) => m.remove())
  return document.querySelectorAll('.n-modal').length
})()`)
await c.sleep(300)

/* 1. 倒错修复：线间连线（桥线）箭头应在接入端（下线连接点）。
 * 统一画布坐标：箭头 polygon 本身就是画布坐标；连接点画布坐标由 store 数据经组件 junctionItems 换算——
 * 直接用桥线 rel 的 toJunction 对应 t 在下线几何上的点（画布坐标），箭头 tip 应距它 < 40 */
const arrowChk = await c.evalx(`(async () => {
  const w = ${store}
  const jia = w.liveOlnodes().find((n) => n.title === '甲')
  const out = (jia.rels[0]._out || [])[0]
  if (!out || !out.toJunction) return { err: 'no bridge' }
  /* 下线终点连接点画布坐标：下线几何（甲乙水平线 y=227、丙丁 y=667）——直接读组件的 junctionItems */
  const el = document.querySelector('.om-canvas')
  let inst = el.__vueParentComponent
  while (inst) { if (inst.setupState && inst.setupState.junctionItems !== undefined) break; inst = inst.parent }
  const items = inst.setupState.junctionItems
  const target = items.find((it) => it.junctionId === out.toJunction.junctionId)
  if (!target) return { err: 'no target junction item' }
  /* 所有箭头（画布坐标）距目标连接点最近者 */
  const polys = [...document.querySelectorAll('.om-edges polygon')]
  let best = null
  for (const poly of polys) {
    const tip = poly.getAttribute('points').split(' ')[0].split(',').map(Number)
    const dist = Math.hypot(tip[0] - target.x, tip[1] - target.y)
    if (best === null || dist < best) best = dist
  }
  /* 画布坐标 vs 屏幕：polygon 与 junctionItems 都是画布坐标，可直接比 */
  return { bestDist: Math.round(best), target: { x: Math.round(target.x), y: Math.round(target.y) } }
})()`)
check('1 线间连线箭头指向接入端连接点（倒错修复）', !arrowChk.err && arrowChk.bestDist < 40, JSON.stringify(arrowChk))

/* 2. 左键点击连线不弹浮层 */
const hitPt = await c.evalx(`(() => { const el = document.querySelector('.oc-edge-hit'); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)
await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: hitPt.x, y: hitPt.y, button: 'none' })
await c.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: hitPt.x, y: hitPt.y, button: 'left', buttons: 1, clickCount: 1 })
await c.sleep(60)
await c.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: hitPt.x, y: hitPt.y, button: 'left', buttons: 0, clickCount: 1 })
await c.sleep(400)
const popAfterClick = await c.evalx(`(() => ({ eedit: !!document.querySelector('.oc-eedit') }))()`)
check('2 左键点击连线不弹编辑浮层', popAfterClick.eedit === false, JSON.stringify(popAfterClick))

/* 3. 左键按住拖动 → 弯曲（起点用 elementFromPoint 扫描验证确实落在上线 hit 上，避开连接点热区） */
const shapeStart = await c.evalx(`(() => {
  const el = document.querySelector('.oc-edge-hit')
  const r = el.getBoundingClientRect()
  const y = r.y + r.height / 2
  /* 沿 x 从 20% 到 45% 扫描：找 elementFromPoint 直接命中 oc-edge-hit 且不靠近 oc-junc 的点 */
  for (let f = 0.2; f <= 0.45; f += 0.05) {
    const x = r.x + r.width * f
    const t = document.elementFromPoint(x, y)
    if (t && t.classList && t.classList.contains('oc-edge-hit')) return { x, y }
  }
  /* 兜底：垂线扫描（y ± 6） */
  const x0 = r.x + r.width * 0.3
  for (let dy = -6; dy <= 6; dy += 2) {
    const t = document.elementFromPoint(x0, y + dy)
    if (t && t.classList && t.classList.contains('oc-edge-hit')) return { x: x0, y: y + dy }
  }
  return null
})()`)
if (!shapeStart) {
  check('3 拖拽弯曲（custom 控制点写入）', false, 'no reliable point on edge')
} else {
  const dragFrom = { x: shapeStart.x, y: shapeStart.y }
  const dragTo = { x: shapeStart.x + 10, y: shapeStart.y + 120 }
  await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: dragFrom.x, y: dragFrom.y, button: 'none' })
  await c.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: dragFrom.x, y: dragFrom.y, button: 'left', buttons: 1, clickCount: 1 })
  for (let i = 1; i <= 8; i++) {
    await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: dragFrom.x + ((dragTo.x - dragFrom.x) * i) / 8, y: dragFrom.y + ((dragTo.y - dragFrom.y) * i) / 8, button: 'left', buttons: 1 })
    await c.sleep(25)
  }
  await c.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: dragTo.x, y: dragTo.y, button: 'left', buttons: 0, clickCount: 1 })
  await c.sleep(500)
  const afterBend = await c.evalx(`(() => {
    const w = ${store}
    const jia = w.liveOlnodes().find((n) => n.title === '甲')
    const hasCustom = jia.rels[0].custom != null
    return { hasCustom, customRaw: JSON.stringify(jia.rels[0].custom || null) }
  })()`)
  check('3 拖拽弯曲（custom 控制点写入）', afterBend.hasCustom === true, JSON.stringify(afterBend))
  /* 第4/5步复用 dragFrom（拖回直线目标点） */
  globalThis.__straightTarget = dragFrom
}

/* 4. 拖回近直线 → 自动拉直（用 elementFromPoint 扫描弯上线的可靠起点——bounding 中心可能偏离曲线） */
const bendHit = await c.evalx(`(() => {
  /* 弯上线的 hit path：data-rel = 甲 rels[0].id */
  const w = ${store}
  const jia = w.liveOlnodes().find((n) => n.title === '甲')
  const relId = jia.rels[0].id
  const hit = [...document.querySelectorAll('.oc-edge-hit')].find((p) => p.dataset.rel === relId)
  if (!hit) return null
  const r = hit.getBoundingClientRect()
  /* 沿 x 扫描：找直接命中该 hit path 的屏幕点 */
  for (let f = 0.15; f <= 0.85; f += 0.05) {
    const x = r.x + r.width * f
    for (let dy = -8; dy <= 8; dy += 4) {
      const y = r.y + r.height * 0.5 + dy
      const t = document.elementFromPoint(x, y)
      if (t === hit) return { x, y }
    }
  }
  return null
})()`)
if (!bendHit) {
  check('4 拖回近直线自动拉直（custom 清除）', false, 'no bent path')
} else {
  /* 从弯曲顶点起拖回原起点（拉直目标 = 原来在直线上的位置，垂距 < 6px 触发拉直） */
  const straightTo = globalThis.__straightTarget || bendHit
  await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: bendHit.x, y: bendHit.y, button: 'none' })
  await c.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: bendHit.x, y: bendHit.y, button: 'left', buttons: 1, clickCount: 1 })
  for (let i = 1; i <= 8; i++) {
    await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: bendHit.x + ((straightTo.x - bendHit.x) * i) / 8, y: bendHit.y + ((straightTo.y - bendHit.y) * i) / 8, button: 'left', buttons: 1 })
    await c.sleep(25)
  }
  await c.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: straightTo.x, y: straightTo.y, button: 'left', buttons: 0, clickCount: 1 })
  await c.sleep(500)
  const afterStraight = await c.evalx(`(() => {
    const w = ${store}
    const jia = w.liveOlnodes().find((n) => n.title === '甲')
    return { hasCustom: jia.rels[0].custom != null }
  })()`)
  check('4 拖回近直线自动拉直（custom 清除）', afterStraight.hasCustom === false, JSON.stringify(afterStraight))
}

/* 5. 再弯曲后双击拉直（从弯曲路径当前命中处起拖——扫描可靠起点） */
const bentMid = await c.evalx(`(() => {
  const w = ${store}
  const jia = w.liveOlnodes().find((n) => n.title === '甲')
  const relId = jia.rels[0].id
  const hit = [...document.querySelectorAll('.oc-edge-hit')].find((p) => p.dataset.rel === relId)
  if (!hit) return null
  const r = hit.getBoundingClientRect()
  for (let f = 0.15; f <= 0.85; f += 0.05) {
    const x = r.x + r.width * f
    for (let dy = -8; dy <= 8; dy += 4) {
      const y = r.y + r.height * 0.5 + dy
      const t = document.elementFromPoint(x, y)
      if (t === hit) return { x, y }
    }
  }
  return null
})()`)
if (!bentMid) {
  check('5 双击弯曲连线拉直（恢复自动路由）', false, 'no bent path to start from')
} else {
  await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: bentMid.x, y: bentMid.y, button: 'none' })
  await c.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: bentMid.x, y: bentMid.y, button: 'left', buttons: 1, clickCount: 1 })
  for (let i = 1; i <= 6; i++) {
    await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: bentMid.x + 8, y: bentMid.y - 60 * (i / 6), button: 'left', buttons: 1 })
    await c.sleep(25)
  }
  await c.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: bentMid.x + 8, y: bentMid.y - 60, button: 'left', buttons: 0, clickCount: 1 })
  await c.sleep(400)
  const bent2 = await c.evalx(`(() => { const w = ${store}; const jia = w.liveOlnodes().find((n) => n.title === '甲'); return { hasCustom: jia.rels[0].custom != null } })()`)
  /* 双击拉直——拖弯后 bentMid 处已离线，重新扫描新弯线上的可靠点 */
  const dblPt = await c.evalx(`(() => {
    const w = ${store}
    const jia = w.liveOlnodes().find((n) => n.title === '甲')
    const relId = jia.rels[0].id
    const hit = [...document.querySelectorAll('.oc-edge-hit')].find((p) => p.dataset.rel === relId)
    if (!hit) return null
    const r = hit.getBoundingClientRect()
    for (let f = 0.15; f <= 0.85; f += 0.05) {
      const x = r.x + r.width * f
      for (let dy = -8; dy <= 8; dy += 4) {
        const y = r.y + r.height * 0.5 + dy
        const t = document.elementFromPoint(x, y)
        if (t === hit) return { x, y }
      }
    }
    return null
  })()`)
  if (!dblPt) {
    check('5 双击弯曲连线拉直（恢复自动路由）', false, 'no point on re-bent edge')
  } else {
    await c.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: dblPt.x, y: dblPt.y, button: 'left', buttons: 1, clickCount: 1 })
    await c.sleep(40)
    await c.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: dblPt.x, y: dblPt.y, button: 'left', buttons: 0, clickCount: 1 })
    await c.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: dblPt.x, y: dblPt.y, button: 'left', buttons: 1, clickCount: 2 })
    await c.sleep(40)
    await c.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: dblPt.x, y: dblPt.y, button: 'left', buttons: 0, clickCount: 2 })
    await c.sleep(500)
    const afterDbl = await c.evalx(`(() => { const w = ${store}; const jia = w.liveOlnodes().find((n) => n.title === '甲'); return { hasCustom: jia.rels[0].custom != null } })()`)
    check('5 双击弯曲连线拉直（恢复自动路由）', bent2.hasCustom === true && afterDbl.hasCustom === false, JSON.stringify({ bent2, afterDbl }))
  }
}

const pass = results.filter(Boolean).length
console.log(`\n==== ${pass}/${results.length} 通过 ====`)
process.exit(pass === results.length ? 0 : 1)
