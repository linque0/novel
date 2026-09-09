/* junction-fix-verify.mjs —— 连线生成 + 编辑浮层 + 连接点全链路验收（v1.0.13 修复轮）
 * 运行前提：vite dev (5173) + electron . --profile=jfix --remote-debugging-port=9333 */
import { connect } from './_cdp-lib.mjs'

const results = []
const check = (name, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  [' + extra + ']' : ''}`)
}

const c = await connect('http://127.0.0.1:5173')
await c.sleep(2000)
const store = `document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('work')`

/* 种子：新书 + 两个事件模块 + 画布视图 */
await c.evalx(`(async () => {
  const w = ${store}
  const shelf = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('shelf')
  await shelf.refresh()
  let book = shelf.works.find((x) => x.title === '连接点修复验证书')
  if (!book) book = await shelf.createWork({ title: '连接点修复验证书' })
  if (!w.work || w.work.id !== book.id) { await w.open(book.id); await new Promise((r) => setTimeout(r, 900)) }
  for (const n of [...w.olnodes]) if (!n.deletedAt) await w.olnodeRemove(n.id)
  w.olnodeAdd(null, { kind: 'event', title: '源事件', canvasX: 300, canvasY: 300 })
  w.olnodeAdd(null, { kind: 'event', title: '目标事件', canvasX: 800, canvasY: 300 })
  w.tab = 'outline'; w.outlineView = 'canvas'
  await new Promise((r) => setTimeout(r, 800))
  return 1
})()`)
await c.evalx(`(() => { const btn = [...document.querySelectorAll('.om-btn.text')].find((x) => x.textContent.includes('适应')); btn?.click(); return 1 })()`)
await c.sleep(600)

/* 1. 普通拖线建边（源→目标）：连线应渲染 */
const dragTo = async (selFrom, selTo) => {
  const from = await c.evalx(`(() => { const el = ${selFrom}; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)
  const to = await c.evalx(`(() => { const el = ${selTo}; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)
  await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: from.x, y: from.y, button: 'none' })
  await c.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: from.x, y: from.y, button: 'left', buttons: 1, clickCount: 1 })
  for (let i = 1; i <= 6; i++) {
    await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: from.x + ((to.x - from.x) * i) / 6, y: from.y + ((to.y - from.y) * i) / 6, button: 'left', buttons: 1 })
    await c.sleep(25)
  }
  await c.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: to.x, y: to.y, button: 'left', buttons: 0, clickCount: 1 })
  await c.sleep(400)
}

/* 拖锚点（源右侧）到目标中心 */
const aptDrag = await c.evalx(`(() => {
  const src = [...document.querySelectorAll('.oc-node.oc-event')].find((x) => x.textContent.includes('源事件'))
  if (!src) return { err: 'no src' }
  const apt = src.querySelector('.oc-apt[data-side="right"]')
  apt.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: apt.getBoundingClientRect().x + 4, clientY: apt.getBoundingClientRect().y + 4 }))
  return { ok: 1 }
})()`)
check('1a 锚点 mousedown 派发', !aptDrag.err, JSON.stringify(aptDrag))
const dropOn = await c.evalx(`(() => {
  const dst = [...document.querySelectorAll('.oc-node.oc-event')].find((x) => x.textContent.includes('目标事件'))
  const r = dst.getBoundingClientRect()
  window.dispatchEvent(new MouseEvent('mousemove', { clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }))
  window.dispatchEvent(new MouseEvent('mouseup', { clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }))
  return 1
})()`)
await c.sleep(500)
const edgeState = await c.evalx(`(() => {
  const w = ${store}
  const src = w.liveOlnodes().find((n) => n.title === '源事件')
  const rel = (src?.rels || [])[0]
  const hitDom = document.querySelectorAll('.oc-edge-hit').length
  const eedit = !!document.querySelector('.oc-eedit')
  return { rel: !!rel, toId: rel?.toId, hitDom, eedit }
})()`)
check('1b 拖线建边成功且渲染', edgeState.rel && edgeState.toId && edgeState.hitDom >= 1, JSON.stringify(edgeState))

/* 2. 编辑浮层：位置/尺寸记录 → Ctrl+滚轮缩放 → 尺寸应不变 */
const before = await c.evalx(`(() => {
  const pop = document.querySelector('.oc-eedit')
  if (!pop) return { err: 'no popover' }
  const r = pop.getBoundingClientRect()
  const st = getComputedStyle(pop)
  return { w: r.width, h: r.height, pos: st.position, zoom1: (m => m ? m[1] : '1')((document.querySelector('.om-inner').style.transform.match(/scale\\(([\\d.]+)\\)/) || [])) }
})()`)
check('2a 浮层弹出（fixed）', !before.err && before.pos === 'fixed', JSON.stringify(before))
/* Ctrl+滚轮缩放（在画布中心） */
const cvc = await c.evalx(`(() => { const r = document.querySelector('.om-canvas').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)
await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: cvc.x, y: cvc.y, button: 'none' })
for (let i = 0; i < 6; i++) {
  await c.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: cvc.x, y: cvc.y, deltaX: 0, deltaY: -120, modifiers: 2 })
  await c.sleep(60)
}
await c.sleep(400)
const after = await c.evalx(`(() => {
  const pop = document.querySelector('.oc-eedit')
  if (!pop) return { err: 'gone' }
  const r = pop.getBoundingClientRect()
  return { w: r.width, h: r.height, zoom2: (m => m ? m[1] : '1')((document.querySelector('.om-inner').style.transform.match(/scale\\(([\\d.]+)\\)/) || [])) }
})()`)
const szDelta = after.err ? 999 : Math.abs(after.w - before.w) + Math.abs(after.h - before.h)
check('2b 缩放后浮层尺寸不变（且缩放确实发生）', !after.err && szDelta < 2 && Number(after.zoom2) > Number(before.zoom1) + 0.3, JSON.stringify({ before, after, szDelta: Math.round(szDelta) }))
/* 关闭浮层 */
await c.evalx(`(() => { document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 10, clientY: 10 })); return 1 })()`)
await c.sleep(300)

/* 3. 右键连线创建连接点 */
const edgeHitPt = await c.evalx(`(() => {
  const el = document.querySelector('.oc-edge-hit')
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { x: r.x + r.width * 0.55, y: r.y + r.height / 2 }
})()`)
if (!edgeHitPt) {
  check('3 右键连线创建连接点', false, 'no edge')
} else {
  await c.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: edgeHitPt.x, y: edgeHitPt.y, button: 'right', buttons: 2, clickCount: 1 })
  await c.sleep(60)
  await c.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: edgeHitPt.x, y: edgeHitPt.y, button: 'right', buttons: 0, clickCount: 1 })
  await c.sleep(400)
  const menuShown = await c.evalx(`(() => {
    const items = [...document.querySelectorAll('.oc-ctx .oc-ctx-item')]
    const btn = items.find((x) => x.textContent.includes('创建连接点'))
    if (!btn) return { err: 'no menu', count: items.length, texts: items.map((x) => x.textContent.trim()) }
    btn.click()
    return { clicked: 1 }
  })()`)
  await c.sleep(400)
  const juncState = await c.evalx(`(() => {
    const w = ${store}
    const src = w.liveOlnodes().find((n) => n.title === '源事件')
    const rel = (src?.rels || [])[0]
    const dot = document.querySelector('.oc-junc-dot')
    return { junctions: rel?.junctions?.length || 0, dot: !!dot, dotR: dot ? dot.getAttribute('r') : null }
  })()`)
  check('3 右键连线→创建连接点（数据+渲染）', menuShown.clicked && juncState.junctions === 1 && juncState.dot, JSON.stringify({ menuShown, juncState }))
}

/* 4. 从另一模块拖线到连接点：线连线应生成并渲染 */
const juncPt = await c.evalx(`(() => {
  const g = document.querySelector('.oc-junc')
  if (!g) return null
  const r = g.getBoundingClientRect()
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
})()`)
if (!juncPt) {
  check('4 拖线到连接点建线', false, 'no junction dot')
} else {
  /* 新建第三个模块放连接点下方 */
  await c.evalx(`(() => { const w = ${store}; w.olnodeAdd(null, { kind: 'event', title: '支线事件', canvasX: 550, canvasY: 620 }); return 1 })()`)
  await c.sleep(500)
  /* 缩放已放大到 2.2，先复位视图避免路径穿过上方节点 */
  await c.evalx(`(() => { const btn = [...document.querySelectorAll('.om-btn.text')].find((x) => x.textContent.includes('适应')); btn?.click(); return 1 })()`)
  await c.sleep(600)
  const dragStart = await c.evalx(`(() => {
    const src = [...document.querySelectorAll('.oc-node.oc-event')].find((x) => x.textContent.includes('支线事件'))
    if (!src) return { err: 'no node' }
    const apt = src.querySelector('.oc-apt[data-side="top"]')
    const r = apt.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })()`)
  const juncPt2 = await c.evalx(`(() => { const r = document.querySelector('.oc-junc-dot').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)
  if (dragStart.err) {
    check('4 拖线到连接点建线', false, JSON.stringify(dragStart))
  } else {
    await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: dragStart.x, y: dragStart.y, button: 'none' })
    await c.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: dragStart.x, y: dragStart.y, button: 'left', buttons: 1, clickCount: 1 })
    for (let i = 1; i <= 6; i++) {
      await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: dragStart.x + ((juncPt2.x - dragStart.x) * i) / 6, y: dragStart.y + ((juncPt2.y - dragStart.y) * i) / 6, button: 'left', buttons: 1 })
      await c.sleep(25)
    }
    await c.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: juncPt2.x, y: juncPt2.y, button: 'left', buttons: 0, clickCount: 1 })
    await c.sleep(500)
    const toJunc = await c.evalx(`(() => {
      const w = ${store}
      const branch = w.liveOlnodes().find((n) => n.title === '支线事件')
      const rel = (branch?.rels || []).find((r) => r.toJunction)
      const hits = document.querySelectorAll('.oc-edge-hit').length
      return { rel: !!rel, toJunction: rel?.toJunction ? 1 : 0, hits }
    })()`)
    check('4 拖线到连接点建线（toJunction 数据 + 渲染）', toJunc.rel && toJunc.toJunction === 1 && toJunc.hits >= 2, JSON.stringify(toJunc))
  }
}

/* 5. 连接点跟随宿主连线：拖动目标节点后，连接点应仍在宿主线上（距路径 < 12px） */
const follow = await c.evalx(`(() => {
  const w = ${store}
  const src = w.liveOlnodes().find((n) => n.title === '源事件')
  const rel = (src?.rels || [])[0]
  const j = rel?.junctions?.[0]
  if (!j) return { err: 'no junction' }
  const host = document.querySelector('.oc-edge-hit')
  const dot = document.querySelector('.oc-junc-dot')
  if (!host || !dot) return { err: 'no dom' }
  const moveNode = w.liveOlnodes().find((n) => n.title === '目标事件')
  moveNode.canvasX += 200
  w.olnodeSetCanvas(moveNode.id, moveNode.canvasX, moveNode.canvasY)
  return { jid: j.id }
})()`)
await c.sleep(500)
const followChk = await c.evalx(`(() => {
  const dot = document.querySelector('.oc-junc-dot')
  if (!dot) return { err: 'no dot' }
  const dr = dot.getBoundingClientRect()
  const dx = dr.x + dr.width / 2, dy = dr.y + dr.height / 2
  // 用 elementFromPoint 检查连接点中心是否落在命中路径 20px 带内
  const el = document.elementFromPoint(dx, dy)
  return { onHit: !!(el && (el.classList?.contains('oc-junc-hit') || el.closest?.('.oc-edge-hit'))) }
})()`)
check('5 连接点跟随宿主连线（节点挪位后仍在线上）', followChk.onHit === true, JSON.stringify({ follow, followChk }))

/* 6. 创建后高亮 → 淡出隐藏：再创建一个连接点，立即检查 flash 类与显性样式，2s 后检查淡出 */
const edgeHitPt2 = await c.evalx(`(() => {
  const els = [...document.querySelectorAll('.oc-edge-hit')]
  const el = els[0]
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { x: r.x + r.width * 0.3, y: r.y + r.height / 2 }
})()`)
if (!edgeHitPt2) {
  check('6 连接点创建高亮→淡出', false, 'no edge')
} else {
  await c.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: edgeHitPt2.x, y: edgeHitPt2.y, button: 'right', buttons: 2, clickCount: 1 })
  await c.sleep(60)
  await c.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: edgeHitPt2.x, y: edgeHitPt2.y, button: 'right', buttons: 0, clickCount: 1 })
  await c.sleep(350)
  await c.evalx(`(() => { const b = [...document.querySelectorAll('.oc-ctx .oc-ctx-item')].find((x) => x.textContent.includes('创建连接点')); b?.click(); return 1 })()`)
  await c.sleep(300)
  const lit = await c.evalx(`(() => {
    const g = [...document.querySelectorAll('.oc-junc')].find((x) => x.classList.contains('flash'))
    const dot = g ? g.querySelector('.oc-junc-dot') : null
    return { hasFlash: !!g, opacity: dot ? getComputedStyle(dot).opacity : null, r: dot ? dot.getAttribute('r') : null }
  })()`)
  await c.sleep(2200) // 等高亮过期（1.6s + 淡出过渡）
  const faded = await c.evalx(`(() => {
    const dots = [...document.querySelectorAll('.oc-junc-dot')]
    // 鼠标此刻可能悬停在连接点上（hover 显形 0.75）——以“无 flash 类”为准；hover 态属预期交互显形
    const all = dots.map((d) => getComputedStyle(d).opacity)
    return { anyFlash: [...document.querySelectorAll('.oc-junc')].some((g) => g.classList.contains('flash')), opacities: all }
  })()`)
  check('6 连接点创建高亮（加深显形）→ 2s 后淡出隐藏', lit.hasFlash && Number(lit.opacity) > 0.8 && !faded.anyFlash, JSON.stringify({ lit, faded }))
}

/* 7. 从连接点引出连线（连接点作起点）：mousedown 连接点 → 拖到支线事件 → _out 连线生成并渲染 */
const juncPt3 = await c.evalx(`(() => { const r = document.querySelector('.oc-junc-hit').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)
if (!juncPt3) {
  check('7 从连接点引出连线', false, 'no junction')
} else {
  const branchPt = await c.evalx(`(() => { const el = [...document.querySelectorAll('.oc-node')].find((x) => x.textContent.includes('支线事件')); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)
  if (!branchPt) {
    check('7 从连接点引出连线', false, 'no branch node')
  } else {
    await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: juncPt3.x, y: juncPt3.y, button: 'none' })
    await c.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: juncPt3.x, y: juncPt3.y, button: 'left', buttons: 1, clickCount: 1 })
    for (let i = 1; i <= 6; i++) {
      await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: juncPt3.x + ((branchPt.x - juncPt3.x) * i) / 6, y: juncPt3.y + ((branchPt.y - juncPt3.y) * i) / 6, button: 'left', buttons: 1 })
      await c.sleep(25)
    }
    await c.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: branchPt.x, y: branchPt.y, button: 'left', buttons: 0, clickCount: 1 })
    await c.sleep(500)
    const outRel = await c.evalx(`(() => {
      const w = ${store}
      const src = w.liveOlnodes().find((n) => n.title === '源事件')
      const rel = (src?.rels || [])[0]
      const outs = rel?._out || []
      const hits = document.querySelectorAll('.oc-edge-hit').length
      return { outCount: outs.length, fromJunction: outs[0]?.fromJunction ? 1 : 0, toId: outs[0]?.toId ? 1 : 0, hits }
    })()`)
    check('7 从连接点引出连线（_out 数据 + 渲染）', outRel.outCount === 1 && outRel.fromJunction === 1 && outRel.toId === 1 && outRel.hits >= 2, JSON.stringify(outRel))
  }
}

/* 8. 编辑浮层美术风格：标题行 + 分区线存在（与模块右键菜单同语言） */
const styleChk = await c.evalx(`(() => {
  const pop = document.querySelector('.oc-eedit')
  if (!pop) return { err: 'no popover（上一步建边若未弹层则点一条连线）' }
  const title = pop.querySelector('.oc-eedit-title')
  const secs = pop.querySelectorAll('.oc-eedit-sec')
  const st = getComputedStyle(pop)
  const titleSt = title ? getComputedStyle(title) : null
  return {
    hasTitle: !!title,
    titleText: title ? title.textContent : null,
    secCount: secs.length,
    padding: st.padding,
    titleColor: titleSt ? titleSt.color : null
  }
})()`)
if (styleChk.err) {
  /* 点击一条连线弹出浮层再查 */
  const ehp = await c.evalx(`(() => { const el = document.querySelector('.oc-edge-hit'); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)
  await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: ehp.x, y: ehp.y, button: 'none' })
  await c.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: ehp.x, y: ehp.y, button: 'left', buttons: 1, clickCount: 1 })
  await c.sleep(60)
  await c.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: ehp.x, y: ehp.y, button: 'left', buttons: 0, clickCount: 1 })
  await c.sleep(400)
  const re = await c.evalx(`(() => {
    const pop = document.querySelector('.oc-eedit')
    if (!pop) return { err: 'still no popover' }
    const title = pop.querySelector('.oc-eedit-title')
    const secs = pop.querySelectorAll('.oc-eedit-sec')
    return { hasTitle: !!title, titleText: title ? title.textContent : null, secCount: secs.length }
  })()`)
  check('8 编辑浮层美术风格对齐模块菜单（标题+分区线）', !re.err && re.hasTitle && re.titleText === '编辑连线' && re.secCount >= 1, JSON.stringify(re))
} else {
  check('8 编辑浮层美术风格对齐模块菜单（标题+分区线）', styleChk.hasTitle && styleChk.titleText === '编辑连线' && styleChk.secCount >= 1, JSON.stringify(styleChk))
}

const pass = results.filter(Boolean).length
console.log(`\n==== ${pass}/${results.length} 通过 ====`)
process.exit(pass === results.length ? 0 : 1)
