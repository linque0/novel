/* freeze-repro-verify.mjs —— 卡死复现验证：打开含旧连接点数据（junctions/_out/toJunction）的书进入画布，
 * 页面必须保持响应（8s 内可交互、UI 无卡死）。修复前：edges computed 自引用死循环 → 主线程卡死。 */
import { connect } from './_cdp-lib.mjs'
const c = await connect('http://127.0.0.1:5173')
await c.sleep(2500)
const results = []
const check = (name, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  [' + extra + ']' : ''}`)
}
const store = `document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('work')`

/* 1. 打开含旧数据的书并切画布（超时 = 卡死） */
const opened = await Promise.race([
  c.evalx(`(async () => {
    const w = ${store}
    const shelf = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('shelf')
    await shelf.refresh()
    const book = shelf.works.find((x) => x.title === '连接点修复验证书')
    if (!book) return { err: 'no book' }
    if (!w.work || w.work.id !== book.id) { await w.open(book.id); await new Promise((r) => setTimeout(r, 900)) }
    w.tab = 'outline'; w.outlineView = 'canvas'
    await new Promise((r) => setTimeout(r, 1500))
    /* 统计旧数据规模 */
    let junctions = 0, outs = 0, toJuncs = 0
    for (const n of w.liveOlnodes()) {
      for (const r of n.rels || []) {
        junctions += (r.junctions || []).length
        outs += (r._out || []).length
        if (r.toJunction) toJuncs++
      }
    }
    return { junctions, outs, toJuncs, nodes: w.liveOlnodes().length }
  })()`),
  new Promise((r) => setTimeout(() => r({ TIMEOUT: true }), 12000))
])
check('1 打开含旧连接点数据的书画布不卡死（12s 内完成）', !opened.TIMEOUT && !opened.err, JSON.stringify(opened))

/* 2. 页面响应性：UI 线程未被阻塞（连续两次 eval 快速返回 + 点击事件可派发） */
const t0 = Date.now()
const resp = await Promise.race([
  c.evalx(`(() => {
    /* 模拟真实点击画布空白（pan 起止）确认事件链畅通 */
    const cv = document.querySelector('.om-canvas')
    const r = cv.getBoundingClientRect()
    cv.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: r.x + r.width * 0.3, clientY: r.y + r.height * 0.3 }))
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: r.x + r.width * 0.3, clientY: r.y + r.height * 0.3 }))
    return { nodes: document.querySelectorAll('.oc-node').length, paths: document.querySelectorAll('.om-edges path').length, juncs: document.querySelectorAll('.oc-junc').length }
  })()`),
  new Promise((r) => setTimeout(() => r({ TIMEOUT: true }), 8000))
])
const dt = Date.now() - t0
check('2 页面响应（8s 内可交互，连线/连接点已渲染）', !resp.TIMEOUT && resp.paths >= 1, JSON.stringify({ ...resp, ms: dt }))

/* 3. edges computed 无自引用死循环：再次触发重算（挪动节点）仍快速完成 */
const recalc = await Promise.race([
  c.evalx(`(() => {
    const w = ${store}
    const n = w.liveOlnodes()[0]
    if (!n) return { err: 'no node' }
    w.olnodeSetCanvas(n.id, (n.canvasX || 100) + 1, n.canvasY || 100)
    return { done: 1 }
  })()`),
  new Promise((r) => setTimeout(() => r({ TIMEOUT: true }), 8000))
])
check('3 触发 edges 重算（挪节点）不死循环', !recalc.TIMEOUT, JSON.stringify(recalc))

/* 4. 撤销/重做栈可用（此前 PushUndo 在死循环前后可能异常） */
const undoChk = await Promise.race([
  c.evalx(`(() => { const w = ${store}; const r = w.olnodeUndo(); return { undo: r } })()`),
  new Promise((r) => setTimeout(() => r({ TIMEOUT: true }), 5000))
])
check('4 撤销操作响应', !undoChk.TIMEOUT, JSON.stringify(undoChk))
if (!undoChk.TIMEOUT && !undoChk.err) await c.evalx(`(() => { ${store}.olnodeRedo(); return 1 })()`)

const pass = results.filter(Boolean).length
console.log(`\n==== ${pass}/${results.length} 通过 ====`)
process.exit(pass === results.length ? 0 : 1)
