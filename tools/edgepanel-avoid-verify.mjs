/* edgepanel-avoid-verify.mjs —— v1.0.18 单一功能验收：连线编辑浮层避线放置
 * 1. 右键水平连线 → 浮层弹出且不遮挡连线本体（按渲染路径真实几何采样判定）
 * 2. 右键竖直连线 → 同样不遮挡（竖线时浮层应弹到线的左右侧）
 * 3. 浮层完整落在画布可视区内（不被裁掉） */
import { connect } from './_cdp-lib.mjs'
const c = await connect('http://127.0.0.1:5173', process.env.CDP_PORT || '9333')
await c.sleep(2500)
const results = []
const check = (name, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  [' + extra + ']' : ''}`)
}
const store = `document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('work')`

/* 遮挡判定：被编辑连线按 getTotalLength 均匀采样 64 点，getScreenCTM 映射屏幕坐标，
 * 统计落入浮层矩形内的采样数（inside）与最近距离（minDist）。clickPt 邻域过滤只看被编辑的线 */
const probe = (cx, cy) => `(() => {
  const pop = document.querySelector('.oc-eedit')
  if (!pop) return { hasPop: false }
  const pr = pop.getBoundingClientRect()
  let inside = 0, total = 0, minDist = Infinity
  for (const p of document.querySelectorAll('.oc-edge-hit')) {
    const r = p.getBoundingClientRect()
    if (r.right < pr.x - 260 || r.left > pr.right + 260 || r.bottom < pr.y - 260 || r.top > pr.bottom + 260) continue
    const len = p.getTotalLength()
    const m = p.getScreenCTM()
    if (!m) continue
    for (let i = 0; i <= 64; i++) {
      const q = p.getPointAtLength((len * i) / 64)
      const sx = q.x * m.a + q.y * m.c + m.e
      const sy = q.x * m.b + q.y * m.d + m.f
      /* 只统计右键落点邻域内的采样（= 被编辑的这条线） */
      if (Math.hypot(sx - (${cx}), sy - (${cy})) > 260) continue
      total++
      const dx = Math.max(pr.x - sx, 0, sx - pr.right)
      const dy = Math.max(pr.y - sy, 0, sy - pr.bottom)
      const d = Math.hypot(dx, dy)
      if (d === 0) inside++
      if (d < minDist) minDist = d
    }
  }
  const canvas = document.querySelector('.om-canvas')
  const cr = canvas ? canvas.getBoundingClientRect() : document.body.getBoundingClientRect()
  const dirCls = (pop.className.split(' ').find((x) => x.startsWith('dir-')) || '').slice(4)
  return { hasPop: true, dir: dirCls, inside, total, minDist: Math.round(minDist), rect: { x: Math.round(pr.x), y: Math.round(pr.y), w: Math.round(pr.width), h: Math.round(pr.height) }, canvas: { l: Math.round(cr.left), t: Math.round(cr.top), r: Math.round(cr.right), b: Math.round(cr.bottom) } }
})()`
const esc = async () => {
  await c.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
  await c.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
  await c.sleep(300)
}

/* 种子：水平线（甲→乙）+ 竖直线（丙→丁） */
await c.evalx(`(async () => {
  const w = ${store}
  const shelf = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('shelf')
  await shelf.refresh()
  let book = shelf.works.find((x) => x.title === '浮层避线验证书')
  if (!book) book = await shelf.createWork({ title: '浮层避线验证书' })
  if (!w.work || w.work.id !== book.id) { await w.open(book.id); await new Promise((r) => setTimeout(r, 900)) }
  for (const n of [...w.olnodes]) if (!n.deletedAt) await w.olnodeRemove(n.id)
  const a = w.olnodeAdd(null, { kind: 'event', title: '甲', canvasX: 260, canvasY: 320 })
  const b = w.olnodeAdd(null, { kind: 'event', title: '乙', canvasX: 900, canvasY: 320 })
  w.olnodeRelAdd(a.id, b.id, { label: '横线' })
  const c1 = w.olnodeAdd(null, { kind: 'event', title: '丙', canvasX: 1200, canvasY: 180 })
  const d = w.olnodeAdd(null, { kind: 'event', title: '丁', canvasX: 1200, canvasY: 700 })
  w.olnodeRelAdd(c1.id, d.id, { label: '竖线' })
  w.tab = 'outline'; w.outlineView = 'canvas'
  await new Promise((r) => setTimeout(r, 800))
  return 1
})()`)
await c.evalx(`(() => { const btn = [...document.querySelectorAll('.om-btn.text')].find((x) => x.textContent.includes('适应')); btn?.click(); return 1 })()`)
await c.sleep(700)
await c.evalx(`(() => { document.querySelectorAll('.n-modal-mask, .n-modal-scroll-content, .n-modal-container, .n-modal-body-wrapper').forEach((m) => m.remove()); return 1 })()`)
await c.sleep(200)

/* 1. 右键水平连线 */
const hz = await c.evalx(`(() => {
  const hits = [...document.querySelectorAll('.oc-edge-hit')].filter((p) => { const r = p.getBoundingClientRect(); return r.width > r.height })
  const r = hits[0].getBoundingClientRect()
  return { x: r.x + r.width * 0.55, y: r.y + r.height / 2 }
})()`)
await c.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: hz.x, y: hz.y, button: 'right', buttons: 2, clickCount: 1 })
await c.sleep(60)
await c.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: hz.x, y: hz.y, button: 'right', buttons: 0, clickCount: 1 })
await c.sleep(600)
let ov = await c.evalx(probe(hz.x, hz.y))
check('1 水平连线右键 → 浮层弹出且不遮挡连线', ov.hasPop && ov.inside === 0 && ov.minDist > 4, JSON.stringify(ov))
const inCv1 = ov.hasPop && ov.rect.x >= ov.canvas.l - 1 && ov.rect.y >= ov.canvas.t - 1 && ov.rect.x + ov.rect.w <= ov.canvas.r + 1 && ov.rect.y + ov.rect.h <= ov.canvas.b + 1
check('1b 浮层完整落在画布可视区内', inCv1, JSON.stringify({ rect: ov.rect, canvas: ov.canvas }))

/* 2. Esc 关闭后右键竖直连线 */
await esc()
const vt = await c.evalx(`(() => {
  const hits = [...document.querySelectorAll('.oc-edge-hit')].filter((p) => { const r = p.getBoundingClientRect(); return r.height > r.width })
  const r = hits[0].getBoundingClientRect()
  return { x: r.x + r.width / 2, y: r.y + r.height * 0.55 }
})()`)
await c.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: vt.x, y: vt.y, button: 'right', buttons: 2, clickCount: 1 })
await c.sleep(60)
await c.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: vt.x, y: vt.y, button: 'right', buttons: 0, clickCount: 1 })
await c.sleep(600)
ov = await c.evalx(probe(vt.x, vt.y))
check('2 竖直连线右键 → 浮层弹出且不遮挡连线', ov.hasPop && ov.inside === 0 && ov.minDist > 4, JSON.stringify(ov))
const inCv2 = ov.hasPop && ov.rect.x >= ov.canvas.l - 1 && ov.rect.y >= ov.canvas.t - 1 && ov.rect.x + ov.rect.w <= ov.canvas.r + 1 && ov.rect.y + ov.rect.h <= ov.canvas.b + 1
check('2b 浮层完整落在画布可视区内', inCv2, JSON.stringify({ rect: ov.rect, canvas: ov.canvas }))

await c.send('Page.captureScreenshot', { format: 'png' }).then((s) => import('fs').then((fs) => fs.writeFileSync('tools/_edgepanel-avoid.png', Buffer.from(s.data, 'base64'))))

const pass = results.filter(Boolean).length
console.log(`\n==== ${pass}/${results.length} 通过 ====`)
process.exit(pass === results.length ? 0 : 1)
