/* multiwindow-verify.mjs —— 功能面板多窗口验收（9.2-W5，计划书 9.2 验收条款）
 * 覆盖：拆窗创建 / 重复打开聚焦（锁互斥）/ 主窗口只读占位出现与恢复 /
 *       面板写入落库 / 面板关闭释放锁 / 面板列表一致性。
 * 运行前提：npm run build && npm run start -- --profile=test --remote-debugging-port=9222
 */
import { connect } from './_cdp-lib.mjs'

const results = []
const check = (name, ok, extra = '') => {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  [' + extra + ']' : ''}`)
}

const c = await connect('app://')
await c.sleep(1800)

/* ---------- 种子：打开验证书（不重复打开同一作品：work.work 已是目标则复用） ---------- */
const seed = await c.evalx(`(async () => {
  const app = document.querySelector('#app').__vue_app__
  const work = app.config.globalProperties.$pinia._s.get('work')
  const shelf = app.config.globalProperties.$pinia._s.get('shelf')
  await shelf.refresh()
  const exist = shelf.works.find((w) => w.title === '多窗口验证书')
  const wid = exist ? exist.id : (await shelf.createWork({ title: '多窗口验证书' })).id
  if (!work.work || work.work.id !== wid) {
    await work.open(wid)
    await new Promise((r) => setTimeout(r, 900))
  }
  work.tab = 'chapters'
  await new Promise((r) => setTimeout(r, 300))
  let ch = work.liveChapters[0]
  if (!ch) ch = await work.addChapter(null, '验收章节')
  work.selChapterId = ch.id
  await new Promise((r) => setTimeout(r, 200))
  return { ok: true, wid, chId: ch.id }
})()`)
if (!seed.ok) {
  console.log('seed failed:', JSON.stringify(seed))
  process.exit(1)
}
await c.sleep(700)

/* ---------- 1. 拆出正文面板 ---------- */
const pop1 = await c.evalx(`(async () => {
  const app = document.querySelector('#app').__vue_app__
  const work = app.config.globalProperties.$pinia._s.get('work')
  const r = await window.native.panelOpen({ type: 'chapter', workId: '${seed.wid}', entityId: '${seed.chId}', title: '验收正文' })
  const list = await window.native.panelList()
  return { r, locks: list.locks, n: list.panels.length }
})()`)
check('1 拆出正文面板 created', pop1.r.ok && pop1.r.created && pop1.n === 1)
await c.sleep(3000)

/* ---------- 2. 重复打开 → 聚焦而非新建（锁互斥） ---------- */
const pop2 = await c.evalx(`(async () => {
  const r = await window.native.panelOpen({ type: 'chapter', workId: '${seed.wid}', entityId: '${seed.chId}', title: '验收正文' })
  const list = await window.native.panelList()
  return { r, n: list.panels.length }
})()`)
check('2 重复打开聚焦不新建', pop2.r.ok && pop2.r.focused && pop2.n === 1)

/* ---------- 3. 主窗口只读占位出现（.panel-lock-note）且编辑器不可写 ---------- */
const lock = await c.evalx(`(() => {
  const note = document.querySelector('.panel-lock-note')
  const app = document.querySelector('#app').__vue_app__
  const work = app.config.globalProperties.$pinia._s.get('work')
  return { hasNote: !!note, noteText: note?.textContent?.trim().slice(0, 40) || '', editable: window.__ns.editor?.isEditable }
})()`)
check('3 主窗口只读占位出现', lock.hasNote && lock.editable === false, lock.noteText)

/* ---------- 4. 面板写入 → 自动保存落库 ---------- */
const p = await connect('panel=')
await p.sleep(2000)
const write = await p.evalx(`(async () => {
  const ed = window.__ns.editor
  if (!ed) return { ok: false }
  ed.commands.insertContent('<p>多窗口验收写入 MW-9876</p>')
  await new Promise((r) => setTimeout(r, 400))
  const app = document.querySelector('#app').__vue_app__
  const ui = app.config.globalProperties.$pinia._s.get('ui')
  return { ok: true, pending: ui.autosave.pending }
})()`)
check('4a 面板编辑进入保存队列', write.ok && write.pending >= 1)
await p.sleep(3500)
const dbChk = await p.evalx(`(async () => {
  const { db } = window.__ns
  const row = await db.chapters.get('${seed.chId}')
  return { has: (row?.content || '').includes('MW-9876') }
})()`)
check('4b 面板写入落库', dbChk.has)

/* ---------- 5. 关闭面板 → 锁释放 + 主窗口占位消失恢复可写 ---------- */
await p.evalx(`window.native.panelCloseSelf()`)
await c.sleep(3200)
const after = await c.evalx(`(async () => {
  const list = await window.native.panelList()
  const note = document.querySelector('.panel-lock-note')
  const app = document.querySelector('#app').__vue_app__
  const work = app.config.globalProperties.$pinia._s.get('work')
  return { n: list.panels.length, locks: list.locks.length, noteGone: !note, editable: window.__ns.editor?.isEditable }
})()`)
check('5 面板关闭释放锁并恢复编辑', after.n === 0 && after.locks === 0 && after.noteGone && after.editable === true)

/* ---------- 6. 拆出大纲模块面板（模块级锁）→ 主窗口大纲页占位 ---------- */
const pop3 = await c.evalx(`(async () => {
  const app = document.querySelector('#app').__vue_app__
  const work = app.config.globalProperties.$pinia._s.get('work')
  work.tab = 'outline'
  await new Promise((r) => setTimeout(r, 500))
  const r = await window.native.panelOpen({ type: 'outline', workId: '${seed.wid}', entityId: '', title: '验收大纲' })
  await new Promise((r2) => setTimeout(r2, 1500))
  const note = document.querySelector('.pop-lock-note')
  return { ok: r.ok, hasNote: !!note }
})()`)
check('6 大纲拆窗 + 主窗口模块占位', pop3.ok && pop3.hasNote)
await c.sleep(2500)

/* ---------- 7. 大纲面板渲染画布 ---------- */
const p3 = await connect('panel=')
await p3.sleep(2200)
const ol = await p3.evalx(`(() => {
  const host = document.querySelector('.panel-topbar')
  const canvas = document.querySelector('.oc-node') || document.querySelector('.oc-canvas') || document.querySelector('.oc-edges')
  return { title: host?.querySelector('.serif')?.textContent || '', hasCanvas: !!canvas }
})()`)
check('7 大纲面板渲染画布', ol.hasCanvas && ol.title.includes('大纲'))

/* ---------- 8. 关闭大纲面板恢复 ---------- */
await p3.evalx(`window.native.panelCloseSelf()`)
await c.sleep(3200)
const fin = await c.evalx(`(async () => {
  const list = await window.native.panelList()
  return { n: list.panels.length, noteGone: !document.querySelector('.pop-lock-note') }
})()`)
check('8 关闭大纲面板恢复主窗口', fin.n === 0 && fin.noteGone)

/* ---------- 汇总 ---------- */
const pass = results.filter((r) => r.ok).length
console.log(`\nmultiwindow-verify: ${pass}/${results.length}`)
process.exit(pass === results.length ? 0 : 1)
