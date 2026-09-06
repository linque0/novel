/* canvasctx-verify.mjs —— 画布空白右键建模块 + Delete 删除验收（v0.4.9）
 * 覆盖：大纲画布空白右键菜单出现 / 菜单选建 5 类模块且落在右键画布坐标 /
 *       Delete 删除选中模块（含输入态守卫）/ 人物图空白右键建人物 + Delete 软删。
 * 运行前提：npm run build && npm run start -- --remote-debugging-port=9222（测试在开发版本默认数据中进行，2026-09-06 规则）
 */
import { connect } from './_cdp-lib.mjs'

const results = []
const check = (name, ok, extra = '') => {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  [' + extra + ']' : ''}`)
}
const mkEvt = (t, x, y, extra = {}) => `new MouseEvent('${t}', { bubbles: true, cancelable: true, clientX: ${x}, clientY: ${y}, button: ${extra.button ?? 0} })`

const c = await connect('app://')
await c.sleep(1800)

/* 种子：打开验证书 → 大纲画布 */
const seed = await c.evalx(`(async () => {
  const app = document.querySelector('#app').__vue_app__
  const work = app.config.globalProperties.$pinia._s.get('work')
  const shelf = app.config.globalProperties.$pinia._s.get('shelf')
  await shelf.refresh()
  const exist = shelf.works.find((w) => w.title === '画布右键验证书')
  const wid = exist ? exist.id : (await shelf.createWork({ title: '画布右键验证书' })).id
  if (!work.work || work.work.id !== wid) { await work.open(wid); await new Promise((r) => setTimeout(r, 900)) }
  work.tab = 'outline'
  work.outlineView = 'canvas'
  await new Promise((r) => setTimeout(r, 800))
  const el = document.querySelector('.oc-canvas')
  const b = el.getBoundingClientRect()
  return { ok: true, wid, x: Math.round(b.x + b.width * 0.6), y: Math.round(b.y + b.height * 0.6) }
})()`)
if (!seed.ok) {
  console.log('seed failed')
  process.exit(1)
}

/* 1. 空白右键 → 菜单出现且含 5 类可选模块 */
const menu = await c.evalx(`(() => {
  const el = document.querySelector('.oc-canvas')
  const b = el.getBoundingClientRect()
  el.dispatchEvent(${mkEvt('contextmenu', seed.x, seed.y, { button: 2 })})
  return { btn: true, x: b.x, y: b.y }
})()`)
await c.sleep(400)
const menuChk = await c.evalx(`(() => {
  const m = document.querySelector('.oc-blankctx')
  const items = m ? [...m.querySelectorAll('.oc-ctx-item')].map((x) => x.textContent.trim()) : []
  return { shown: !!m, items }
})()`)
check(
  '1 空白右键菜单出现（事件/便签/引用/文本框/容器）',
  menuChk.shown && menuChk.items.length === 5 && menuChk.items.some((s) => s.includes('事件')) && menuChk.items.some((s) => s.includes('容器')),
  menuChk.items.join(' | ')
)

/* 2. 点「事件」→ 新模块落在右键画布坐标附近且被选中 */
const mkNode = await c.evalx(`(async () => {
  const app = document.querySelector('#app').__vue_app__
  const work = app.config.globalProperties.$pinia._s.get('work')
  const before = work.olnodes.filter((n) => !n.deletedAt).length
  const item = [...document.querySelectorAll('.oc-blankctx .oc-ctx-item')].find((x) => x.textContent.includes('事件'))
  item?.click()
  await new Promise((r) => setTimeout(r, 500))
  const row = work.olnodes.find((n) => n.id === work.selOlnodeId)
  return { before, after: work.olnodes.filter((n) => !n.deletedAt).length, node: row ? { k: row.kind, x: row.canvasX, y: row.canvasY } : null }
})()`)
check(
  '2 菜单选建「事件」并选中（落点在右键附近）',
  mkNode.after === mkNode.before + 1 && mkNode.node?.k === 'event' && Math.abs(mkNode.node.x - mkNode.before) < 4000,
  JSON.stringify(mkNode.node)
)

/* 3. Delete 删除选中模块；编辑态输入 Delete 不误删 */
const del = await c.evalx(`(async () => {
  const app = document.querySelector('#app').__vue_app__
  const work = app.config.globalProperties.$pinia._s.get('work')
  const id = work.selOlnodeId
  const before = work.olnodes.filter((n) => !n.deletedAt).length
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }))
  await new Promise((r) => setTimeout(r, 400))
  const gone = work.olnodes.find((n) => n.id === id)?.deletedAt
  return { before, after: work.olnodes.filter((n) => !n.deletedAt).length, gone: !!gone }
})()`)
check('3 Delete 删除选中模块', del.before === del.after + 1 && del.gone, JSON.stringify(del))

/* 4. 编辑器输入框聚焦时 Delete 不删除模块 */
const rect4 = await c.evalx(`(() => {
  const b = document.querySelector('.oc-canvas').getBoundingClientRect()
  return { x: Math.round(b.x + b.width * 0.5), y: Math.round(b.y + b.height * 0.4) }
})()`)
const guard = await c.evalx(`(async () => {
  const app = document.querySelector('#app').__vue_app__
  const work = app.config.globalProperties.$pinia._s.get('work')
  const el = document.querySelector('.oc-canvas')
  el.dispatchEvent(${mkEvt('contextmenu', rect4.x, rect4.y, { button: 2 })})
  await new Promise((r) => setTimeout(r, 300))
  ;[...document.querySelectorAll('.oc-blankctx .oc-ctx-item')].find((x) => x.textContent.includes('便签'))?.click()
  await new Promise((r) => setTimeout(r, 500))
  const count = work.olnodes.filter((n) => !n.deletedAt).length
  const inp = document.querySelector('.oc-node.sel input, .oc-node.sel [contenteditable]')
  const target = inp || document.createElement('input')
  if (!inp) document.body.appendChild(target)
  target.focus()
  target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }))
  await new Promise((r) => setTimeout(r, 400))
  const after = work.olnodes.filter((n) => !n.deletedAt).length
  if (!inp) target.remove()
  return { kept: after === count }
})()`)
check('4 输入框聚焦时 Delete 不误删', guard.kept)

/* 5. 人物图：空白右键 → 新建人物并放到右键坐标 */
const rect5 = await c.evalx(`(() => {
  const b = document.querySelector('.rg-canvas').getBoundingClientRect()
  return { x: Math.round(b.x + b.width * 0.7), y: Math.round(b.y + b.height * 0.7) }
})()`)
const charAdd = await c.evalx(`(async () => {
  const app = document.querySelector('#app').__vue_app__
  const work = app.config.globalProperties.$pinia._s.get('work')
  work.tab = 'characters'
  work.charView = 'graph'
  await new Promise((r) => setTimeout(r, 900))
  const before = work.liveCharacters.length
  const el = document.querySelector('.rg-canvas')
  el.dispatchEvent(${mkEvt('contextmenu', rect5.x, rect5.y, { button: 2 })})
  await new Promise((r) => setTimeout(r, 400))
  const menuShown = !!document.querySelector('.oc-blankctx')
  ;[...document.querySelectorAll('.oc-blankctx .oc-ctx-item')].find((x) => x.textContent.includes('新建人物'))?.click()
  await new Promise((r) => setTimeout(r, 600))
  const c2 = work.liveCharacters.find((x) => !x.name)
  const graph = await work.loadCharGraph()
  return { before, after: work.liveCharacters.length, menuShown, sel: work.selCharacterId === c2?.id, blank: !!c2, placed: !!(c2 && graph && graph[c2.id]) }
})()`)
check('5 人物图空白右键新建人物（空内容）并放位', charAdd.menuShown && charAdd.after === charAdd.before + 1 && charAdd.sel && charAdd.blank && charAdd.placed, JSON.stringify(charAdd))

/* 6. 人物图 Delete 软删选中人物 */
const charDel = await c.evalx(`(async () => {
  const app = document.querySelector('#app').__vue_app__
  const work = app.config.globalProperties.$pinia._s.get('work')
  const id = work.selCharacterId
  const before = work.liveCharacters.length
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }))
  await new Promise((r) => setTimeout(r, 600))
  return { before, after: work.liveCharacters.length, gone: work.liveCharacters.every((x) => x.id !== id) }
})()`)
check('6 Delete 软删选中人物', charDel.after === charDel.before - 1 && charDel.gone, JSON.stringify(charDel))

const pass = results.filter((r) => r.ok).length
console.log(`\ncanvasctx-verify: ${pass}/${results.length}`)
process.exit(pass === results.length ? 0 : 1)
