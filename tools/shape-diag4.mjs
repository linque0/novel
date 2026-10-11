/* shape-diag4.mjs —— 拖拽塑形未生效诊断：打点 startEdgeShape 是否触发 */
import { connect } from './_cdp-lib.mjs'
const c = await connect('http://127.0.0.1:5173')
await c.sleep(1500)
const store = `document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('work')`

/* 干净种子：仅两个模块一条线 */
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
  w.tab = 'outline'; w.outlineView = 'canvas'
  await new Promise((r) => setTimeout(r, 800))
  return 1
})()`)
await c.evalx(`(() => { const btn = [...document.querySelectorAll('.om-btn.text')].find((x) => x.textContent.includes('适应')); btn?.click(); return 1 })()`)
await c.sleep(600)

/* 给组件函数打 spy */
await c.evalx(`(() => {
  const el = document.querySelector('.om-canvas')
  let inst = el.__vueParentComponent
  while (inst) { if (inst.setupState && inst.setupState.edges !== undefined) break; inst = inst.parent }
  const s = inst.setupState
  window.__spy = { shape: 0, patch: 0 }
  const orig = s.startEdgeShape
  // setupState 是 proxy——直接读引用
  if (typeof orig === 'function') {
    // 包装不了 proxy 方法（只读），改 spy patchAny
  }
  const origPatch = s.work.olnodeRelPatchAny.bind(s.work)
  s.work.olnodeRelPatchAny = (...args) => { window.__spy.patch++; return origPatch(...args) }
  /* mousedown 打点：直接在 edge-hit 上加原生监听 */
  const hit = document.querySelector('.oc-edge-hit')
  hit.addEventListener('mousedown', () => { window.__spy.shape++ })
  return { hasShape: typeof s.startEdgeShape }
})()`)

/* 拖拽 */
const hitPt = await c.evalx(`(() => { const el = document.querySelector('.oc-edge-hit'); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)
await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: hitPt.x, y: hitPt.y, button: 'none' })
await c.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: hitPt.x, y: hitPt.y, button: 'left', buttons: 1, clickCount: 1 })
for (let i = 1; i <= 8; i++) {
  await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: hitPt.x + 10, y: hitPt.y + 120 * (i / 8), button: 'left', buttons: 1 })
  await c.sleep(25)
}
await c.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: hitPt.x + 10, y: hitPt.y + 120, button: 'left', buttons: 0, clickCount: 1 })
await c.sleep(500)

const r = await c.evalx(`(() => {
  const w = ${store}
  const jia = w.liveOlnodes().find((n) => n.title === '甲')
  return { spy: window.__spy, custom: jia.rels[0].custom || null }
})()`)
console.log(JSON.stringify(r, null, 2))
