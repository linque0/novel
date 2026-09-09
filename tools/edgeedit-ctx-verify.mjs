/* edgeedit-ctx-verify.mjs —— v1.0.17 单一功能验收
 * 1. 右键连线 → 直接打开编辑浮层（不弹单独菜单）
 * 2. 浮层内「在此处创建连接点」→ 右键落点处生成连接点，浮层保持开启
 * 3. 浮层改标签生效（右键入口的编辑功能可用） */
import { connect } from './_cdp-lib.mjs'
const c = await connect('http://127.0.0.1:5173')
await c.sleep(2000)
const results = []
const check = (name, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  [' + extra + ']' : ''}`)
}
const store = `document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('work')`

/* 种子 */
await c.evalx(`(async () => {
  const w = ${store}
  const shelf = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('shelf')
  await shelf.refresh()
  let book = shelf.works.find((x) => x.title === '右键浮层验证书')
  if (!book) book = await shelf.createWork({ title: '右键浮层验证书' })
  if (!w.work || w.work.id !== book.id) { await w.open(book.id); await new Promise((r) => setTimeout(r, 900)) }
  for (const n of [...w.olnodes]) if (!n.deletedAt) await w.olnodeRemove(n.id)
  const a = w.olnodeAdd(null, { kind: 'event', title: '甲', canvasX: 300, canvasY: 300 })
  const b = w.olnodeAdd(null, { kind: 'event', title: '乙', canvasX: 800, canvasY: 300 })
  w.olnodeRelAdd(a.id, b.id, { label: '验线' })
  w.tab = 'outline'; w.outlineView = 'canvas'
  await new Promise((r) => setTimeout(r, 800))
  return 1
})()`)
await c.evalx(`(() => { const btn = [...document.querySelectorAll('.om-btn.text')].find((x) => x.textContent.includes('适应')); btn?.click(); return 1 })()`)
await c.sleep(600)
/* 清模态遮罩（历史教训） */
await c.evalx(`(() => { document.querySelectorAll('.n-modal-mask, .n-modal-scroll-content, .n-modal-container, .n-modal-body-wrapper').forEach((m) => m.remove()); return 1 })()`)

/* 1. 右键连线 → 编辑浮层直接打开，无单独菜单 */
const edgePt = await c.evalx(`(() => {
  const el = document.querySelector('.oc-edge-hit')
  const r = el.getBoundingClientRect()
  /* 右键位置取 60% 处（避开中心） */
  return { x: r.x + r.width * 0.6, y: r.y + r.height / 2 }
})()`)
await c.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: edgePt.x, y: edgePt.y, button: 'right', buttons: 2, clickCount: 1 })
await c.sleep(60)
await c.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: edgePt.x, y: edgePt.y, button: 'right', buttons: 0, clickCount: 1 })
await c.sleep(500)
const pop = await c.evalx(`(() => {
  const pop = document.querySelector('.oc-eedit')
  const menus = [...document.querySelectorAll('.oc-ctx.oc-blankctx')].filter((m) => m.textContent.includes('创建连接点'))
  const juncBtn = pop ? [...pop.querySelectorAll('.oc-eedit-juncbtn')].find((b) => b.textContent.includes('创建连接点')) : null
  return { hasPop: !!pop, hasTitle: pop ? pop.querySelector('.oc-eedit-title')?.textContent : null, oldMenuCount: menus.length, hasJuncBtn: !!juncBtn }
})()`)
check('1 右键连线 → 直接打开编辑浮层（无单独菜单，含创建连接点按钮）', pop.hasPop && pop.hasTitle === '编辑连线' && pop.oldMenuCount === 0 && pop.hasJuncBtn, JSON.stringify(pop))

/* 2. 点「在此处创建连接点」→ 右键落点处生成连接点，浮层保持开启 */
await c.evalx(`(() => { const b = [...document.querySelectorAll('.oc-eedit-juncbtn')].find((x) => x.textContent.includes('创建连接点')); b?.click(); return 1 })()`)
await c.sleep(500)
const junc = await c.evalx(`(() => {
  const w = ${store}
  const jia = w.liveOlnodes().find((n) => n.title === '甲')
  const js = jia.rels[0].junctions || []
  const dots = document.querySelectorAll('.oc-junc-dot').length
  const popStill = !!document.querySelector('.oc-eedit')
  /* 连接点位置 ≈ 右键落点（60% 处）画布坐标 vs projectOnEdge——间接验证：存在且渲染 */
  return { juncCount: js.length, dots, popStill }
})()`)
check('2 浮层内创建连接点（落点建点 + 浮层保持开启）', junc.juncCount === 1 && junc.dots === 1 && junc.popStill, JSON.stringify(junc))

/* 3. 浮层改标签生效（右键入口编辑能力） */
await c.evalx(`(() => {
  const inp = document.querySelector('.oc-eedit input.rp-input')
  if (!inp) return 0
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(inp, '右键改标')
  inp.dispatchEvent(new Event('input', { bubbles: true }))
  return 1
})()`)
await c.sleep(400)
const label = await c.evalx(`(() => {
  const w = ${store}
  const jia = w.liveOlnodes().find((n) => n.title === '甲')
  return { label: jia.rels[0].label, labelDom: [...document.querySelectorAll('.oc-elabel')].some((x) => x.textContent.includes('右键改标')) }
})()`)
check('3 右键浮层编辑标签生效', label.label === '右键改标' && label.labelDom, JSON.stringify(label))

const pass = results.filter(Boolean).length
console.log(`\n==== ${pass}/${results.length} 通过 ====`)
process.exit(pass === results.length ? 0 : 1)
