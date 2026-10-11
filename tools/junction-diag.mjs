/* junction-diag.mjs —— 诊断：为何新建连线不渲染（数据在、DOM 无） */
import { connect } from './_cdp-lib.mjs'
const c = await connect('http://127.0.0.1:5173')
await c.sleep(1500)
const store = `document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('work')`
const out = await c.evalx(`(() => {
  const w = ${store}
  const src = w.liveOlnodes().find((n) => n.title === '源事件')
  const rel = (src?.rels || [])[0]
  const svg = document.querySelector('.om-edges')
  const inner = document.querySelector('.om-inner')
  const hitPaths = document.querySelectorAll('.oc-edge-hit')
  const svgAttr = svg ? { left: svg.style.left, top: svg.style.top, w: svg.getAttribute('width'), h: svg.getAttribute('height'), vb: svg.getAttribute('viewBox') } : null
  const r = svg?.getBoundingClientRect()
  return {
    rel: rel ? { id: rel.id, toId: rel.toId, fromSide: rel.fromSide, toSide: rel.toSide, junctions: rel.junctions } : null,
    srcPos: src ? { x: src.canvasX, y: src.canvasY } : null,
    hitCount: hitPaths.length,
    visPaths: document.querySelectorAll('.om-edges path').length,
    svgAttr,
    svgRect: r ? { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } : null,
    innerTransform: inner?.style.transform,
    edgeLabelCount: document.querySelectorAll('.oc-elabel').length,
    nodeCount: document.querySelectorAll('.oc-node').length
  }
})()`)
console.log(JSON.stringify(out, null, 2))
