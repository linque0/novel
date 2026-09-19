/* 双链浮窗交互验收（v1.0.21）：出现/消失过渡动画 + 标题栏拖动 + 拖离钉住（常驻预览）+ 停靠记忆
 * 运行前提：npm run dev（自带 CDP 9222，验证书已自动种入）
 * 用法：node tools/dlpop-verify.mjs
 *
 * 环境说明：
 *  - 悬停 / 移开用 CDP 真实鼠标移动（隐藏窗口下 hover 级输入可用）；
 *  - 按压类输入（左键拖动 / Esc）在隐藏窗口会被 Chromium 丢弃（实测 mousePressed 零事件派发），
 *    故拖动 / 关闭 / Esc 用合成 PointerEvent / KeyboardEvent 驱动——被测对象是组件的监听器与
 *    状态机本身；真实输入管线在可见窗口下与合成事件走同一监听器；
 *  - 进场过渡的 opacity 完成值依赖 rAF 推进，窗口隐藏（rAF 冻结）时按可见性显式跳过并计数，
 *    可见窗口下为硬断言。
 * 种子统一走 tools/verify-seeds.mjs 注册表（与开发调试版书架同源）
 */
import { connect } from './_cdp-lib.mjs'
import { buildSeedExpr } from './verify-seeds.mjs'

const c = await connect('app://')
await c.sleep(2500)
const results = []
let skipped = 0
const check = (name, ok, detail = '') => {
  results.push(ok)
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  —— ' + String(detail).slice(0, 400) : ''))
}
const skip = (name, reason) => {
  skipped++
  console.log('SKIP ' + name + '  —— ' + reason)
}
const move = async (x, y, buttons = 0) => {
  await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: Math.round(x), y: Math.round(y), buttons })
}
/** 合成指针序列（按住左键拖动） */
const drag = async (fromX, fromY, toX, toY) => {
  await c.evalx(`(() => {
    const o = (x, y) => ({ bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, buttons: 1, pointerId: 1, pointerType: 'mouse', isPrimary: true })
    const head = document.querySelector('.dl-pop .dl-pop-head')
    head.dispatchEvent(new PointerEvent('pointerdown', o(${Math.round(fromX)}, ${Math.round(fromY)})))
    window.dispatchEvent(new PointerEvent('pointermove', o(${Math.round((fromX + toX) / 2)}, ${Math.round((fromY + toY) / 2)})))
    window.dispatchEvent(new PointerEvent('pointermove', o(${Math.round(toX)}, ${Math.round(toY)})))
    window.dispatchEvent(new PointerEvent('pointerup', o(${Math.round(toX)}, ${Math.round(toY)})))
    return true
  })()`)
}
/** 轮询等待页面内条件成立（卸载类断言在节流窗口下需 1s+） */
const waitFor = async (expr, budgetMs, step = 250) => {
  const deadline = Date.now() + budgetMs
  for (;;) {
    const v = await c.evalx(expr)
    if (v) return v
    if (Date.now() > deadline) return v
    await c.sleep(step)
  }
}
const vis = await c.evalx('document.visibilityState')
const hidden = vis === 'hidden'
if (hidden) console.log('[env] 窗口隐藏：进场 opacity 完成断言将跳过（rAF 冻结，CSS 过渡不推进）；卸载/逻辑断言不受影响')

/* 0) 种子（注册表 reset 重建）→ 打开书 */
const seed = await c.evalx(buildSeedExpr('双链验证书', { reset: true }))
console.log('seed:', JSON.stringify(seed))
if (!seed.ok) process.exit(1)
await c.evalx(`location.reload()`)
await c.sleep(2600)
await c.evalx(`[...document.querySelectorAll('.book-card')].find(x => x.textContent.includes('双链验证书'))?.click()`)
await c.sleep(1700)
check('打开双链验证书', await c.evalx(`!!document.querySelector('.rich-host .tiptap')`))

/* 在正文里做两个指向不同目标的双链标签（供钉住态「原位换内容」断言） */
const mkLinks = await c.evalx(`(async () => {
  const ed = window.__ns.editor
  const { db } = window.__ns
  const w = (await db.works.toArray()).find((x) => x.title === '双链验证书')
  const nodes = (await db.mubu.where('workId').equals(w.id).toArray()).filter((n) => !n.deletedAt)
  const gz = nodes.find((n) => n.text === '观测站')
  const kt = nodes.find((n) => n.text === '穹顶大厅')
  const setLink = (kw, target, title) => {
    let p = null
    ed.state.doc.descendants((n, pos) => { if (!p && n.isText && n.text && n.text.includes(kw)) { const i = n.text.indexOf(kw); p = { from: pos + i, to: pos + i + kw.length } } })
    if (!p) return false
    ed.chain().setTextSelection(p).setMark('dlLink', { target, title }).run()
    return true
  }
  return { a: setLink('铜刻星辰', 'mubu:' + gz.id, '观测站'), b: setLink('缓缓归位', 'mubu:' + kt.id, '穹顶大厅') }
})()`)
check('正文建立两个双链标签（不同目标）', mkLinks.a === true && mkLinks.b === true, JSON.stringify(mkLinks))
await c.evalx(`window.__flushNow && window.__flushNow()`)
await c.sleep(600)

const rects = await c.evalx(`(() => {
  const g = (kw) => {
    const el = [...document.querySelectorAll('.rich-host .tiptap .dl-link')].find((s) => s.textContent.includes(kw))
    const r = el.getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  }
  return { a: g('铜刻星辰'), b: g('缓缓归位') }
})()`)
check('取得双链坐标', rects.a.x > 0 && rects.b.x > 0, JSON.stringify(rects))

/* 1) 悬停双链 → 浮窗出现，动画接线（过渡属性 / 初始隐藏类已移除进入过渡） */
await move(rects.a.x, rects.a.y)
await c.sleep(80)
const enter = await c.evalx(`(() => {
  const p = document.querySelector('.dl-pop')
  if (!p) return null
  const cs = getComputedStyle(p)
  return { cls: p.className, trans: cs.transitionProperty + '/' + cs.transitionDuration, opacity: cs.opacity }
})()`)
check('悬停双链浮窗出现', !!enter, JSON.stringify(enter))
check(
  '进场动画已接线（opacity/transform 过渡 + enter-from 已移除）',
  enter && enter.trans.includes('opacity') && enter.trans.includes('0.17') && !String(enter.cls).includes('dl-pop-enter-from'),
  JSON.stringify(enter)
)
if (hidden) {
  skip('进场过渡完成（opacity=1）', '窗口隐藏 rAF 冻结，CSS 过渡不推进；可见窗口下为硬断言')
} else {
  const settled = await waitFor(
    `(() => { const p = document.querySelector('.dl-pop'); if (!p) return null; return getComputedStyle(p).opacity === '1' ? { opacity: getComputedStyle(p).opacity } : null })()`,
    3000
  )
  check('进场过渡完成（opacity=1）', !!settled, JSON.stringify(settled))
}
const posA = await c.evalx(`(() => { const r = document.querySelector('.dl-pop').getBoundingClientRect(); return { x: r.left, y: r.top } })()`)
check('未拖动时无钉住态、无关闭按钮', await c.evalx(`(() => { const p = document.querySelector('.dl-pop'); return !p.className.includes('pinned') && !p.querySelector('.dl-pop-close') })()`))

/* 2) 拖动标题栏（合成指针序列，按住左键）→ 浮窗随动 + 钉住 */
const head = await c.evalx(`(() => { const r = document.querySelector('.dl-pop .dl-pop-head').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } })()`)
await drag(head.x, head.y, head.x + 90, head.y + 70)
await c.sleep(300)
const dragged = await c.evalx(`(() => {
  const p = document.querySelector('.dl-pop')
  if (!p) return null
  const r = p.getBoundingClientRect()
  return { x: r.left, y: r.top, pinned: p.className.includes('pinned'), closeBtn: !!p.querySelector('.dl-pop-close'), dragging: p.className.includes('dragging') }
})()`)
check('拖动后浮窗随动（≈+90/+70）', dragged && Math.abs(dragged.x - (posA.x + 90)) <= 6 && Math.abs(dragged.y - (posA.y + 70)) <= 6, JSON.stringify({ posA, dragged }))
check('拖离后进入钉住态（pinned 类 + 关闭按钮）', dragged && dragged.pinned && dragged.closeBtn && !dragged.dragging, JSON.stringify(dragged))
const posParked = { x: dragged.x, y: dragged.y }

/* 3) 钉住态不随鼠标移开消失 */
await move(30, 400)
await c.sleep(700)
const stillPinned = await c.evalx(`(() => { const p = document.querySelector('.dl-pop'); return p ? { shown: true, title: p.querySelector('.dl-pop-title')?.textContent } : { shown: false } })()`)
check('钉住态移开鼠标 700ms 仍显示', stillPinned.shown === true, JSON.stringify(stillPinned))

/* 4) 钉住态点击编辑器空白 / 滚动不关闭 */
await c.evalx(`document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 400, clientY: 500 }))`)
await c.evalx(`document.dispatchEvent(new Event('scroll'))`)
await c.sleep(400)
check('钉住态点空白 / 滚动不关闭', await c.evalx(`!!document.querySelector('.dl-pop')`))

/* 5) 钉住态悬停另一个双链 → 原位换内容（位置不变、标题更新） */
await move(rects.b.x, rects.b.y)
await c.sleep(450)
const swapped = await c.evalx(`(() => {
  const p = document.querySelector('.dl-pop')
  if (!p) return null
  const r = p.getBoundingClientRect()
  return { x: r.left, y: r.top, title: p.querySelector('.dl-pop-title')?.textContent, pinned: p.className.includes('pinned') }
})()`)
check('钉住态悬停另一双链原位换内容（位置不变）', swapped && swapped.title === '穹顶大厅' && Math.abs(swapped.x - posParked.x) <= 2 && Math.abs(swapped.y - posParked.y) <= 2, JSON.stringify({ posParked, swapped }))

/* 6) 点击 × 关闭（离场态类在场 → 随后卸载） */
await c.evalx(`document.querySelector('.dl-pop .dl-pop-close')?.click()`)
await c.sleep(40)
const leaving = await c.evalx(`(() => { const p = document.querySelector('.dl-pop'); return p ? { cls: p.className } : { gone: true } })()`)
check('点击 × 进入离场态（leave-to 类）', leaving && !leaving.gone && String(leaving.cls).includes('dl-pop-leave-to'), JSON.stringify(leaving))
const gone1 = await waitFor(`!document.querySelector('.dl-pop')`, 4500)
check('离场过渡结束后浮窗卸载', !!gone1, String(gone1))

/* 7) 停靠记忆：再次悬停 → 浮窗停在上次拖放的位置附近 */
await move(rects.a.x, rects.a.y)
await c.sleep(500)
const recall = await c.evalx(`(() => { const p = document.querySelector('.dl-pop'); if (!p) return null; const r = p.getBoundingClientRect(); return { x: r.left, y: r.top, pinned: p.className.includes('pinned') } })()`)
check('停靠记忆：再次悬停停在上次拖放位（非跟随位）', recall && !recall.pinned && Math.abs(recall.x - posParked.x) <= 6 && Math.abs(recall.y - posParked.y) <= 6, JSON.stringify({ posParked, recall }))

/* 8) 双击标题恢复跟随：偏移清零，浮窗回到光标旁默认位（offsetLeft 为纯布局位，不受冻结的过渡 transform 影响） */
await c.evalx(`document.querySelector('.dl-pop .dl-pop-head')?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))`)
await c.sleep(450)
const reset = await c.evalx(`(() => { const p = document.querySelector('.dl-pop'); if (!p) return null; return { x: p.offsetLeft, y: p.offsetTop, pinned: p.className.includes('pinned') } })()`)
check('双击标题恢复跟随（回到光标旁默认位）', reset && !reset.pinned && Math.abs(reset.x - (rects.a.x + 14)) <= 4 && Math.abs(reset.y - (rects.a.y + 18)) <= 4, JSON.stringify({ expectX: rects.a.x + 14, expectY: rects.a.y + 18, reset }))

/* 9) 重新拖动 → Esc 关闭钉住态 */
const head2 = await c.evalx(`(() => { const r = document.querySelector('.dl-pop .dl-pop-head').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } })()`)
await drag(head2.x, head2.y, head2.x - 60, head2.y - 40)
await c.sleep(300)
check('再次拖动进入钉住态', await c.evalx(`!!document.querySelector('.dl-pop.pinned')`))
await c.evalx(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`)
const gone2 = await waitFor(`!document.querySelector('.dl-pop')`, 4500)
check('Esc 关闭钉住态浮窗', !!gone2, String(gone2))

/* 10) 回归：非钉住态悬停后移开 → 宽限期后消失 */
await move(rects.a.x, rects.a.y)
await c.sleep(450)
await move(30, 300)
const gone3 = await waitFor(`!document.querySelector('.dl-pop')`, 4500)
check('非钉住态移开后浮窗按宽限期消失', !!gone3, String(gone3))

const pass = results.filter(Boolean).length
console.log(`\n${pass}/${results.length} 通过` + (skipped ? `（另跳过 ${skipped} 项环境受限断言）` : ''))
process.exit(pass === results.length ? 0 : 1)
