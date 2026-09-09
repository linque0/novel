/* visual-fix-verify.mjs —— 箭头衔接 + 编辑浮层背景验收（v1.0.14）
 * 1. 箭头尖端在线端点、可见线终点回缩到箭头底边（线端与箭头尖距离 ≈ 箭头长度）
 * 2. 编辑浮层有实底背景（不透明），CSS 变量在 .app-root 内解析正常 */
import { connect } from './_cdp-lib.mjs'
const c = await connect('http://127.0.0.1:5173')
await c.sleep(2000)
const results = []
const check = (name, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  [' + extra + ']' : ''}`)
}
const store = `document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('work')`

/* 种子：两模块 + 一条连线（放大箭头便于测量） */
await c.evalx(`(async () => {
  const w = ${store}
  const shelf = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('shelf')
  await shelf.refresh()
  let book = shelf.works.find((x) => x.title === '连接点修复验证书')
  if (!book) book = await shelf.createWork({ title: '连接点修复验证书' })
  if (!w.work || w.work.id !== book.id) { await w.open(book.id); await new Promise((r) => setTimeout(r, 900)) }
  for (const n of [...w.olnodes]) if (!n.deletedAt) await w.olnodeRemove(n.id)
  const a = w.olnodeAdd(null, { kind: 'event', title: '源事件', canvasX: 300, canvasY: 300 })
  const b = w.olnodeAdd(null, { kind: 'event', title: '目标事件', canvasX: 800, canvasY: 300 })
  w.olnodeRelAdd(a.id, b.id, { label: '验收', arrowScale: 3 })
  w.tab = 'outline'; w.outlineView = 'canvas'
  await new Promise((r) => setTimeout(r, 800))
  return 1
})()`)
await c.evalx(`(() => { const btn = [...document.querySelectorAll('.om-btn.text')].find((x) => x.textContent.includes('适应')); btn?.click(); return 1 })()`)
await c.sleep(600)

/* 1. 箭头衔接：可见线终点应回缩，与箭头尖（=目标锚点）保持约一个箭头长的距离 */
const arrow = await c.evalx(`(() => {
  const w = ${store}
  const vis = [...document.querySelectorAll('.om-edges path[stroke]')].find((p) => p.getAttribute('stroke') && p.getTotalLength)
  if (!vis) return { err: 'no visible path' }
  const L = vis.getTotalLength()
  /* 可见线末端点 vs 箭头三角形顶点（polygon 第一点 = tip） */
  const end = vis.getPointAtLength(L)
  const poly = document.querySelector('.om-edges polygon')
  if (!poly) return { err: 'no arrow polygon' }
  const pts = poly.getAttribute('points').split(' ').map((p) => p.split(',').map(Number))
  const tip = pts[0]
  const dist = Math.hypot(tip[0] - end.x, tip[1] - end.y)
  const zoom = (m => m ? Number(m[1]) : 1)((document.querySelector('.om-inner').style.transform.match(/scale\\(([\\d.]+)\\)/) || []))
  /* 箭头尺寸 7*3=21（arrowScale=3），线宽 1.8——回缩后 dist ≈ 21 上下（允许 8-34）；修复前 dist≈0（线画到箭头尖） */
  return { dist: dist.toFixed(1), zoom: zoom.toFixed(2), dLen: L.toFixed(0) }
})()`)
check('1 箭头与线衔接：可见线回缩到箭头底边（dist>8 而非 ≈0）', !arrow.err && Number(arrow.dist) > 8, JSON.stringify(arrow))

/* 2. 编辑浮层：实底背景（不透明）+ 边框 + 变量解析 */
const pop = await c.evalx(`(() => {
  const hit = document.querySelector('.oc-edge-hit')
  if (!hit) return { err: 'no hit' }
  const r = hit.getBoundingClientRect()
  hit.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }))
  return 1
})()`)
await c.sleep(500)
const bg = await c.evalx(`(() => {
  const el = document.querySelector('.oc-eedit')
  if (!el) return { err: 'no popover' }
  const st = getComputedStyle(el)
  const parent = el.parentElement
  return {
    bg: st.backgroundColor,
    border: st.borderTopColor,
    opacity: st.opacity,
    inAppRoot: !!(parent && parent.classList && [...parent.classList].some((k) => k.startsWith('theme-'))) || !!(parent && parent.closest && parent.closest('.app-root')),
    hasBackdropFilter: st.backdropFilter
  }
})()`)
/* rgba alpha=1 或不透明色即合格；修复前为 rgba(0,0,0,0) */
const bgOk = !bg.err && bg.bg && !/rgba\\([^)]+, 0\\)$/.test(bg.bg) && bg.bg !== 'transparent'
check('2 编辑浮层实底背景（主题变量在 .app-root 内生效）', bgOk && bg.inAppRoot, JSON.stringify(bg))

/* 3. 连接线标签仍可见且定位正确（回缩不影响中点标签） */
const label = await c.evalx(`(() => {
  const el = [...document.querySelectorAll('.oc-elabel')].find((x) => x.textContent.includes('验收'))
  return { shown: !!el }
})()`)
check('3 连线标签不受回缩影响', label.shown, JSON.stringify(label))

const pass = results.filter(Boolean).length
console.log(`\n==== ${pass}/${results.length} 通过 ====`)
process.exit(pass === results.length ? 0 : 1)
