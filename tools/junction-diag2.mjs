/* junction-diag2.mjs —— 捕获 Vue 渲染错误 + 页内复算 edges 几何 */
import { connect } from './_cdp-lib.mjs'
const c = await connect('http://127.0.0.1:5173')
await c.sleep(1200)
const store = `document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('work')`

/* 1. 装错误捕获钩子 */
await c.evalx(`(() => {
  window.__errs = []
  const oe = console.error.bind(console)
  console.error = (...a) => { window.__errs.push(a.map((x) => { try { return typeof x === 'string' ? x : (x && x.message) || JSON.stringify(x) } catch { return '?' } }).join(' | ').slice(0, 400)); oe(...a) }
  window.onerror = (m) => { window.__errs.push(String(m).slice(0, 400)) }
  return 1
})()`)

/* 2. 触发 edges 重算：微移源节点 */
await c.evalx(`(() => { const w = ${store}; const src = w.liveOlnodes().find((n) => n.title === '源事件'); w.olnodeSetCanvas(src.id, src.canvasX + 1, src.canvasY); return 1 })()`)
await c.sleep(600)

const errs = await c.evalx(`(() => window.__errs || [])()`)
console.log('=== 捕获到的错误 ===')
console.log(JSON.stringify(errs, null, 2))

/* 3. 页内复算：导入 canvas-model，按 edgeGeomFor 同样逻辑跑一遍 */
const rep = await c.evalx(`(async () => {
  const m = await import('/src/components/outline/canvas-model.js')
  const w = ${store}
  const src = w.liveOlnodes().find((n) => n.title === '源事件')
  const dst = w.liveOlnodes().find((n) => n.title === '目标事件')
  const rel = (src.rels || [])[0]
  if (!rel) return { err: 'no rel' }
  const A = { x: src.canvasX, y: src.canvasY, w: 178, h: 54 }
  const B = { x: dst.canvasX, y: dst.canvasY, w: 178, h: 54 }
  const from = { x: A.x + A.w, y: A.y + A.h / 2 }
  const to = { x: B.x, y: B.y + B.h / 2 }
  const g = m.routeEdge(from, rel.fromSide || 'right', to, rel.toSide || 'left', [A, B], w.canvasPrefs.edgeStyle)
  return {
    prefs: w.canvasPrefs,
    relRaw: { fromSide: rel.fromSide, toSide: rel.toSide, toJunction: rel.toJunction || null, junctionsType: typeof rel.junctions, junctionsIsArray: Array.isArray(rel.junctions) },
    dstPos: { x: dst.canvasX, y: dst.canvasY },
    geomOk: !!g && !!g.d,
    dHead: g ? g.d.slice(0, 60) : null,
    domPaths: document.querySelectorAll('.om-edges path').length
  }
})()`)
console.log('=== 页内复算 ===')
console.log(JSON.stringify(rep, null, 2))
process.exit(0)
