/* line2line-verify.mjs —— 线连到线验收（v1.0.15）
 * 1. 连线A右键建连接点P1 → 按住P1拖到连线B本体上 → B上落点自动创建新连接点P2并接线（A线→B线）
 * 2. 同一条连线A上再建第二个连接点P3 → 从P3引出第二条线到模块（多连接点多引出）
 * 3. 两条引出线均渲染、箭头正确 */
import { connect } from './_cdp-lib.mjs'
const c = await connect('http://127.0.0.1:5173')
await c.sleep(2000)
const results = []
const check = (name, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  [' + extra + ']' : ''}`)
}
const store = `document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('work')`

/* 种子：两条独立连线（甲→乙 水平线、丙→丁 下方水平线） */
await c.evalx(`(async () => {
  const w = ${store}
  const shelf = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('shelf')
  await shelf.refresh()
  let book = shelf.works.find((x) => x.title === '线连到线验证书')
  if (!book) book = await shelf.createWork({ title: '线连到线验证书' })
  if (!w.work || w.work.id !== book.id) { await w.open(book.id); await new Promise((r) => setTimeout(r, 900)) }
  for (const n of [...w.olnodes]) if (!n.deletedAt) await w.olnodeRemove(n.id)
  const a = w.olnodeAdd(null, { kind: 'event', title: '甲', canvasX: 200, canvasY: 200 })
  const b = w.olnodeAdd(null, { kind: 'event', title: '乙', canvasX: 700, canvasY: 200 })
  w.olnodeRelAdd(a.id, b.id, { label: '上线' })
  const cc = w.olnodeAdd(null, { kind: 'event', title: '丙', canvasX: 200, canvasY: 640 })
  const d = w.olnodeAdd(null, { kind: 'event', title: '丁', canvasX: 700, canvasY: 640 })
  w.olnodeRelAdd(cc.id, d.id, { label: '下线' })
  w.tab = 'outline'; w.outlineView = 'canvas'
  await new Promise((r) => setTimeout(r, 800))
  return 1
})()`)
await c.evalx(`(() => { const btn = [...document.querySelectorAll('.om-btn.text')].find((x) => x.textContent.includes('适应')); btn?.click(); return 1 })()`)
await c.sleep(600)

const edgeHitCenter = (idx) => c.evalx(`(() => {
  const els = [...document.querySelectorAll('.oc-edge-hit')]
  const el = els[${idx}]
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width }
})()`)

/* 1. 上线右键建连接点 P1 */
const e0 = await edgeHitCenter(0)
if (!e0) {
  check('1 上线右键建连接点', false, 'no edge')
} else {
  await c.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: e0.x, y: e0.y, button: 'right', buttons: 2, clickCount: 1 })
  await c.sleep(60)
  await c.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: e0.x, y: e0.y, button: 'right', buttons: 0, clickCount: 1 })
  await c.sleep(350)
  const clicked = await c.evalx(`(() => { const b = [...document.querySelectorAll('.oc-ctx .oc-ctx-item')].find((x) => x.textContent.includes('创建连接点')); if (b) { b.click(); return 1 } return 0 })()`)
  await c.sleep(400)
  const j1 = await c.evalx(`(() => document.querySelectorAll('.oc-junc').length)()`)
  check('1 上线右键建连接点 P1', clicked === 1 && j1 === 1, JSON.stringify({ clicked, j1 }))
}

/* 2. 按住 P1 拖到下线（连线本体）→ 下线自动建新连接点 P2 并接线 */
const p1 = await c.evalx(`(() => { const r = document.querySelector('.oc-junc-hit').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)
const e1 = await edgeHitCenter(1)
if (!p1 || !e1) {
  check('2 拖到下线本体自动建点接线', false, 'no junc/edge')
} else {
  await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p1.x, y: p1.y, button: 'none' })
  await c.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p1.x, y: p1.y, button: 'left', buttons: 1, clickCount: 1 })
  for (let i = 1; i <= 8; i++) {
    await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p1.x + ((e1.x - p1.x) * i) / 8, y: p1.y + ((e1.y - p1.y) * i) / 8, button: 'left', buttons: 1 })
    await c.sleep(25)
  }
  await c.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: e1.x, y: e1.y, button: 'left', buttons: 0, clickCount: 1 })
  await c.sleep(600)
  const st = await c.evalx(`(() => {
    const w = ${store}
    const jia = w.liveOlnodes().find((n) => n.title === '甲')
    const hostRel = (jia.rels || [])[0]
    const outs = hostRel?._out || []
    const bing = w.liveOlnodes().find((n) => n.title === '丙')
    const bingRel = (bing.rels || [])[0]
    return {
      topJunctions: hostRel?.junctions?.length || 0,
      outCount: outs.length,
      outHasToJunction: outs[0]?.toJunction ? 1 : 0,
      /* 下线自动创建了新连接点 */
      bottomJunctions: bingRel?.junctions?.length || 0,
      /* 下线连接点 id === 引出线的 toJunction.junctionId（真正接上了） */
      linked: outs[0]?.toJunction && bingRel?.junctions?.[0] ? (outs[0].toJunction.junctionId === bingRel.junctions[0].id ? 1 : 0) : 0,
      edgeCount: document.querySelectorAll('.oc-edge-hit').length
    }
  })()`)
  check('2 拖到下线本体：自动建点 P2 + 连接点→连接点接线', st.outCount === 1 && st.outHasToJunction === 1 && st.bottomJunctions === 1 && st.linked === 1 && st.edgeCount >= 3, JSON.stringify(st))
}

/* 3. 上线再建第二个连接点 P3，从 P3 引第二条线到「丙」模块（多连接点多引出） */
const e0b = await c.evalx(`(() => { const els = [...document.querySelectorAll('.oc-edge-hit')]; const el = els[0]; const r = el.getBoundingClientRect(); return { x: r.x + r.width * 0.75, y: r.y + r.height / 2 } })()`)
if (!e0b) {
  check('3 多连接点多引出', false, 'no edge')
} else {
  await c.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: e0b.x, y: e0b.y, button: 'right', buttons: 2, clickCount: 1 })
  await c.sleep(60)
  await c.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: e0b.x, y: e0b.y, button: 'right', buttons: 0, clickCount: 1 })
  await c.sleep(350)
  await c.evalx(`(() => { const b = [...document.querySelectorAll('.oc-ctx .oc-ctx-item')].find((x) => x.textContent.includes('创建连接点')); b?.click(); return 1 })()`)
  await c.sleep(400)
  /* P3 = 上线第二个连接点（junctionItems 顺序：上线两个 + 下线一个 → 取属于上线的、非 P1 的） */
  const p3 = await c.evalx(`(() => {
    const w = ${store}
    const jia = w.liveOlnodes().find((n) => n.title === '甲')
    const js = (jia.rels[0].junctions || []).sort((x, y) => x.t - y.t)
    const j3 = js[js.length - 1] /* t 最大的 = 最靠乙端 = 刚建的 P3 */
    const dots = [...document.querySelectorAll('.oc-junc')]
    /* 画布坐标转屏幕：直接用 junctionItems 顺序不可靠——按宿主连线找 */
    const g = dots.map((d) => { const c0 = d.querySelector('.oc-junc-dot'); const r = c0.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })
    /* 上线的连接点 y 在上半屏 */
    const top = g.filter((p) => p.y < 400).sort((a, b) => a.x - b.x)
    return top.length ? top[top.length - 1] : null
  })()`)
  const bingNode = await c.evalx(`(() => { const el = [...document.querySelectorAll('.oc-node')].find((x) => x.textContent.includes('丙')); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)
  if (!p3 || !bingNode) {
    check('3 多连接点多引出', false, JSON.stringify({ p3: !!p3, bing: !!bingNode }))
  } else {
    await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p3.x, y: p3.y, button: 'none' })
    await c.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p3.x, y: p3.y, button: 'left', buttons: 1, clickCount: 1 })
    for (let i = 1; i <= 8; i++) {
      await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p3.x + ((bingNode.x - p3.x) * i) / 8, y: p3.y + ((bingNode.y - p3.y) * i) / 8, button: 'left', buttons: 1 })
      await c.sleep(25)
    }
    await c.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: bingNode.x, y: bingNode.y, button: 'left', buttons: 0, clickCount: 1 })
    await c.sleep(600)
    const st3 = await c.evalx(`(() => {
      const w = ${store}
      const jia = w.liveOlnodes().find((n) => n.title === '甲')
      const hostRel = (jia.rels || [])[0]
      const bing = w.liveOlnodes().find((n) => n.title === '丙')
      return {
        topJunctions: hostRel.junctions.length,
        outCount: (hostRel._out || []).length,
        toBing: (hostRel._out || []).some((r) => r.toId === bing.id) ? 1 : 0,
        edgeCount: document.querySelectorAll('.oc-edge-hit').length,
        juncCount: document.querySelectorAll('.oc-junc').length
      }
    })()`)
    check('3 上线两连接点各引一条线（1→下线连接点，1→丙模块）', st3.topJunctions === 2 && st3.outCount === 2 && st3.toBing === 1 && st3.edgeCount >= 4 && st3.juncCount === 3, JSON.stringify(st3))
  }
}

/* 4. 页面健康：无死循环、可交互 */
const health = await Promise.race([
  c.evalx(`(() => ({ nodes: document.querySelectorAll('.oc-node').length, ok: 1 }))()`),
  new Promise((r) => setTimeout(() => r({ TIMEOUT: true }), 5000))
])
check('4 页面健康（无卡死）', !health.TIMEOUT, JSON.stringify(health))

const pass = results.filter(Boolean).length
console.log(`\n==== ${pass}/${results.length} 通过 ====`)
process.exit(pass === results.length ? 0 : 1)
