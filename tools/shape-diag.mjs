/* shape-diag.mjs —— 塑形验收失败诊断 */
import { connect } from './_cdp-lib.mjs'
const c = await connect('http://127.0.0.1:5173')
await c.sleep(800)
const store = `document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('work')`
const r = await c.evalx(`(() => {
  const w = ${store}
  const jia = w.liveOlnodes().find((n) => n.title === '甲')
  const topRel = jia.rels[0]
  const outs = topRel._out || []
  const dots = [...document.querySelectorAll('.oc-junc-dot')].map((d) => { const r = d.getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) } })
  const polys = [...document.querySelectorAll('.om-edges polygon')].map((p) => { const tip = p.getAttribute('points').split(' ')[0].split(',').map(Number); return { x: Math.round(tip[0]), y: Math.round(tip[1]) } })
  const paths = [...document.querySelectorAll('.om-edges path[stroke]')].map((p) => { const r = p.getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), w: Math.round(r.width), h: Math.round(r.height), d: p.getAttribute('d').slice(0, 30) } })
  return { dots, polys, paths, outs: outs.length, outHasToJunction: outs[0]?.toJunction ? 1 : 0, topCustom: topRel.custom || null }
})()`)
console.log(JSON.stringify(r, null, 2))
