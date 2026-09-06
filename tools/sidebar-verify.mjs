/* sidebar-verify.mjs —— 侧栏调宽 + 画布文本按钮验收（v0.4.7）
 * 覆盖：「整理/适应」汉字按钮文字居框内（不再溢出 24px 方钮）；
 *       侧栏右缘拖拽调宽（±位移生效）、上下限钳制（180–480）、appconfig 记忆、双击复位。
 * 运行前提：npm run build && npm run start -- --remote-debugging-port=9222（测试在开发版本默认数据中进行，2026-09-06 规则）
 */
import { connect } from './_cdp-lib.mjs'

const results = []
const check = (name, ok, extra = '') => {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  [' + extra + ']' : ''}`)
}

const c = await connect('app://')
await c.sleep(1800)

/* 种子：打开验证书，进入大纲画布 */
const seed = await c.evalx(`(async () => {
  const app = document.querySelector('#app').__vue_app__
  const work = app.config.globalProperties.$pinia._s.get('work')
  const shelf = app.config.globalProperties.$pinia._s.get('shelf')
  await shelf.refresh()
  const exist = shelf.works.find((w) => w.title === '侧栏验证书')
  const wid = exist ? exist.id : (await shelf.createWork({ title: '侧栏验证书' })).id
  if (!work.work || work.work.id !== wid) { await work.open(wid); await new Promise((r) => setTimeout(r, 900)) }
  work.tab = 'outline'
  work.outlineView = 'canvas'
  await new Promise((r) => setTimeout(r, 700))
  return { ok: true, wid }
})()`)
if (!seed.ok) {
  console.log('seed failed')
  process.exit(1)
}

/* 1. 大纲画布「整理」「适应」按钮：汉字不溢出（文字宽 ≤ 框宽，高度不塌行） */
const btn = await c.evalx(`(() => {
  const btns = [...document.querySelectorAll('.om-toolbar .om-btn')]
  const mk = (label) => {
    const b = btns.find((x) => x.textContent.trim() === label)
    return b ? { w: b.offsetWidth, h: b.offsetHeight, sw: b.scrollWidth } : null
  }
  return { tidy: mk('整理'), fit: mk('适应') }
})()`)
check(
  '1 大纲画布 整理/适应 文字居框内',
  !!btn.tidy && !!btn.fit && btn.tidy.sw <= btn.tidy.w && btn.fit.sw <= btn.fit.w && btn.tidy.h === 24 && btn.fit.h === 24,
  `整理 ${btn.tidy?.sw}/${btn.tidy?.w}px 适应 ${btn.fit?.sw}/${btn.fit?.w}px`
)

/* 2. 人物关系图「适应」按钮同样修复 */
const btn2 = await c.evalx(`(async () => {
  const app = document.querySelector('#app').__vue_app__
  const work = app.config.globalProperties.$pinia._s.get('work')
  work.tab = 'characters'
  work.charView = 'graph'
  await new Promise((r) => setTimeout(r, 800))
  const b = [...document.querySelectorAll('.om-toolbar .om-btn')].find((x) => x.textContent.trim() === '适应')
  return b ? { w: b.offsetWidth, h: b.offsetHeight, sw: b.scrollWidth } : null
})()`)
check('2 人物关系图 适应 文字居框内', !!btn2 && btn2.sw <= btn2.w && btn2.h === 24, btn2 ? `${btn2.sw}/${btn2.w}px` : '未找到')

/* 3. 侧栏拖拽调宽 + 下限钳制 + 记忆 */
const drag = await c.evalx(`(async () => {
  const app = document.querySelector('#app').__vue_app__
  const ui = app.config.globalProperties.$pinia._s.get('ui')
  const r = document.querySelector('.side-resizer')
  if (!r) return { err: 'no resizer' }
  const b = r.getBoundingClientRect()
  const sx = b.x + b.width / 2, sy = b.y + b.height / 2
  const mk = (t, x, y) => new MouseEvent(t, { bubbles: true, clientX: x, clientY: y, button: 0 })
  // 3a. 向右拖 +80
  r.dispatchEvent(mk('mousedown', sx, sy))
  window.dispatchEvent(mk('mousemove', sx + 80, sy))
  window.dispatchEvent(mk('mouseup', sx + 80, sy))
  await new Promise((r2) => setTimeout(r2, 300))
  const widened = { ui: ui.sideWidth, panel: document.querySelector('.side-panel').offsetWidth }
  // 3b. 向左拖过界 → 钳到 180
  r.dispatchEvent(mk('mousedown', sx, sy))
  window.dispatchEvent(mk('mousemove', sx - 999, sy))
  window.dispatchEvent(mk('mouseup', sx - 999, sy))
  await new Promise((r2) => setTimeout(r2, 300))
  const { db } = window.__ns
  const row = await db.appconfig.get('sideWidth')
  return { widened, clamped: ui.sideWidth, saved: Number(row?.value) }
})()`)
check('3a 拖拽调宽 +80 生效且面板跟随', drag.widened?.ui === 332 && drag.widened?.panel === 332, JSON.stringify(drag.widened))
check('3b 过界钳制 180 并写入记忆', drag.clamped === 180 && drag.saved === 180, `clamped=${drag.clamped} saved=${drag.saved}`)

/* 4. 双击复位默认 252 */
const rst = await c.evalx(`(async () => {
  const app = document.querySelector('#app').__vue_app__
  const ui = app.config.globalProperties.$pinia._s.get('ui')
  document.querySelector('.side-resizer').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
  await new Promise((r2) => setTimeout(r2, 300))
  return { w: ui.sideWidth }
})()`)
check('4 双击恢复默认 252', rst.w === 252)

const pass = results.filter((r) => r.ok).length
console.log(`\nsidebar-verify: ${pass}/${results.length}`)
process.exit(pass === results.length ? 0 : 1)
