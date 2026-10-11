/* shape-diag5.mjs —— elementFromPoint 在上线各处返回什么 */
import { connect } from './_cdp-lib.mjs'
const c = await connect('http://127.0.0.1:5173')
await c.sleep(1500)
const store = `document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('work')`

/* 与验收相同的种子 */
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

const r = await c.evalx(`(() => {
  const el = document.querySelector('.oc-edge-hit')
  const r0 = el.getBoundingClientRect()
  const y = r0.y + r0.height / 2
  const samples = []
  for (const f of [0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5]) {
    const x = r0.x + r0.width * f
    const t = document.elementFromPoint(x, y)
    samples.push({
      f,
      tag: t ? t.tagName : null,
      cls: t ? (t.getAttribute && t.getAttribute('class') || String(t.className || '')) : null,
      isHit: !!(t && t.classList && t.classList.contains('oc-edge-hit'))
    })
  }
  return { rect: { x: Math.round(r0.x), y: Math.round(r0.y), w: Math.round(r0.width), h: Math.round(r0.height) }, samples, hitCount: document.querySelectorAll('.oc-edge-hit').length }
})()`)
console.log(JSON.stringify(r, null, 2))
