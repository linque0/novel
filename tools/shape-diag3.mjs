/* shape-diag3.mjs —— 在与验收完全相同的执行流中打印第1步的中间量 */
import { connect } from './_cdp-lib.mjs'
const c = await connect('http://127.0.0.1:5173')
await c.sleep(2000)
const store = `document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('work')`

/* 与 shape-verify 相同的种子 */
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

/* 完全复刻 shape-verify 第1步并打印全部中间量 */
const r = await c.evalx(`(async () => {
  const w = ${store}
  const jia = w.liveOlnodes().find((n) => n.title === '甲')
  const out = (jia.rels[0]._out || [])[0]
  const el = document.querySelector('.om-canvas')
  let inst = el.__vueParentComponent
  while (inst) { if (inst.setupState && inst.setupState.junctionItems !== undefined) break; inst = inst.parent }
  const items = inst.setupState.junctionItems
  const target = items.find((it) => it.junctionId === out.toJunction.junctionId)
  const polys = [...document.querySelectorAll('.om-edges polygon')]
  const detail = polys.map((poly) => {
    const tip = poly.getAttribute('points').split(' ')[0].split(',').map(Number)
    return { tip, dist: Math.round(Math.hypot(tip[0] - target.x, tip[1] - target.y)) }
  })
  return { target, detail, outId: out.id }
})()`)
console.log(JSON.stringify(r, null, 2))
