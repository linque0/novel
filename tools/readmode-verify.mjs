/* 正文阅读模式验收（v1.0.26）：入口 / 纯净版式 / 巨排章号 / 只读 / 目录抽屉切章 / 两级 Esc / 编辑器不重建。
 * 运行前提：npm run dev（自带 CDP 9222，验证书自动种入）
 * 用法：node tools/readmode-verify.mjs；截图存档：tools/_readmode-verify.png
 */
import { connect } from './_cdp-lib.mjs'
import { writeFileSync } from 'node:fs'
import { buildSeedExpr } from './verify-seeds.mjs'

const c = await connect('5173')
await c.sleep(2000)
const results = []
const check = (name, ok, detail = '') => {
  results.push(ok)
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  —— ' + String(detail).slice(0, 400) : ''))
}
/* v-show 元素用可见性断言（存在但 display:none 不算通过） */
const vis = (sel) => `(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return false; return e.offsetWidth > 0 && e.offsetHeight > 0 && getComputedStyle(e).display !== 'none' })()`
const clickByText = (scope, text) => `(() => { const b = [...document.querySelectorAll(${JSON.stringify(scope)})].find((x) => x.innerText.includes(${JSON.stringify(text)})); if (!b) return false; b.click(); return true })()`

/* ---------- 0) 种子：批注验证书（含正文与多章） ---------- */
const seed = await c.evalx(buildSeedExpr('批注验证书', { reset: true }))
if (!seed.ok) { console.log('seed 失败', JSON.stringify(seed)); process.exit(1) }
await c.evalx(`location.reload()`)
await c.sleep(2600)
await c.evalx(`[...document.querySelectorAll('.book-card')].find((x) => x.textContent.includes('批注验证书'))?.click()`)
await c.sleep(1800)
check('打开测试书并进入编辑器', await c.evalx(vis('.rich-host .tiptap')))
/* 补一章，保证抽屉内有可切换的目标（来源脚本 reset 重建，无残留） */
const added = await c.evalx(`(async () => {
  const { useWorkStore } = await import('/src/stores/work.js')
  const w = useWorkStore()
  if (w.liveChapters.length >= 2) return w.liveChapters.length
  await w.addChapter(w.liveVolumes[0]?.id || 'orphans', '第二章 · 阅读验证')
  return w.liveChapters.length
})()`)
check('测试书具备 ≥2 章（供抽屉切章）', added >= 2, String(added))
await c.sleep(400)

/* ---------- 1) 进入前记录：编辑器引用 / 滚动锚点 / 选区 ---------- */
const before = await c.evalx(`(() => {
  const ed = window.__ns.editor
  window.__rmRef = ed
  ed.commands.setTextSelection(Math.min(6, ed.state.doc.content.size))
  const host = document.querySelector('.rich-host')
  host.scrollTop = 150
  return { editable: ed.isEditable, scroll: host.scrollTop, selFrom: ed.state.selection.from }
})()`)
console.log('[before]', JSON.stringify(before))

/* ---------- 2) 点「阅读」进入 ---------- */
const entered = await c.evalx(clickByText('.topbar button', '阅读'))
await c.sleep(700)
check('顶栏「阅读」按钮可进入阅读模式', entered && (await c.evalx(`!!document.querySelector('.read-mode')`)), String(entered))

/* ---------- 3) 纯净版式（两侧与工具条/章头收起） ---------- */
const chrome = await c.evalx(`(() => ({
  rail: !!document.querySelector('.nav-rail'),
  side: !!document.querySelector('.side-panel'),
  right: !!document.querySelector('.right-panel'),
  aiDock: !!document.querySelector('.ai-dock'),
  taskBar: !!document.querySelector('.module-agent'),
  headVis: ${vis('.editor-head')},
  toolbarVis: ${vis('.editor-toolbar')},
  readHeadVis: ${vis('.ed-read-head')},
  edgeVis: ${vis('.ed-read-edge')},
  countVis: ${vis('.ed-read-count')},
  barTexts: [...document.querySelectorAll('.topbar button')].map((b) => b.innerText.trim())
}))()`)
check('两侧区域与任务条全部收起（rail/章节树/批注栏/AI 列/恍然梦助手条）', !chrome.rail && !chrome.side && !chrome.right && !chrome.aiDock && !chrome.taskBar, JSON.stringify(chrome))
check('章头与工具条隐藏、阅读头/边条/底右字数出现', !chrome.headVis && !chrome.toolbarVis && chrome.readHeadVis && chrome.edgeVis && chrome.countVis, JSON.stringify(chrome))
check('顶栏切换为阅读变体（退出阅读 + 搜索/设置；书架/沉浸/书签隐去）', chrome.barTexts.some((t) => t.includes('退出阅读')) && !chrome.barTexts.some((t) => t.includes('沉浸')) && !chrome.barTexts.some((t) => t.includes('书签')), JSON.stringify(chrome.barTexts))

/* ---------- 4) 巨排章号：与独立重算（liveVolumes×liveChapters）一致 ---------- */
const ordinal = await c.evalx(`(async () => {
  const { useWorkStore } = await import('/src/stores/work.js')
  const work = useWorkStore()
  const flat = []
  for (const v of work.liveVolumes) for (const ch of work.liveChapters.filter((x) => x.volumeId === v.id)) flat.push(ch.id)
  for (const ch of work.liveChapters.filter((x) => !work.liveVolumes.some((v) => v.id === x.volumeId))) flat.push(ch.id)
  const exp = String(flat.indexOf(work.selChapterId) + 1).padStart(2, '0')
  return { exp, no: document.querySelector('.ed-read-no')?.textContent || '', title: document.querySelector('.ed-read-title')?.textContent || '' }
})()`)
check('巨排章号 = 独立重算的全书序（补零）且章题同源', ordinal.no === ordinal.exp && /^\d{2,}$/.test(ordinal.no) && ordinal.title.length > 0, JSON.stringify(ordinal))

/* ---------- 5) 只读 + 限宽列 + 底右字数 ---------- */
const readonly = await c.evalx(`(() => {
  const col = document.querySelector('.ed-read-col')
  const cnt = document.querySelector('.ed-read-count')?.textContent || ''
  return { editable: window.__ns.editor.isEditable, mx: getComputedStyle(col).maxWidth, w: col.getBoundingClientRect().width, cnt }
})()`)
check('编辑器只读（isEditable=false）且限宽列 ≤680px', readonly.editable === false && readonly.mx === '680px' && readonly.w <= 680.5, JSON.stringify(readonly))
const wordOk = await c.evalx(`(async () => {
  const { useWorkStore } = await import('/src/stores/work.js')
  const work = useWorkStore()
  return (document.querySelector('.ed-read-count')?.textContent || '').trim() === String(work.activeChapter.wordCount || 0) + ' 字'
})()`)
check('底右字数与本章字数一致', wordOk)
const ctxBlocked = await c.evalx(`(() => {
  const host = document.querySelector('.rich-host')
  host.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 400, clientY: 300 }))
  return !document.querySelector('.ctx-menu')
})()`)
check('阅读模式右键不弹格式化菜单', ctxBlocked)

/* ---------- 6) 不重建：编辑器引用 / 选区 / 滚动锚点保持 ---------- */
const kept = await c.evalx(`(() => ({
  same: window.__ns.editor === window.__rmRef,
  selFrom: window.__ns.editor.state.selection.from,
  scroll: document.querySelector('.rich-host').scrollTop
}))()`)
check('进入阅读不重建编辑器（引用同一）且选区保持', kept.same && kept.selFrom === before.selFrom, JSON.stringify(kept))
check('滚动锚点保持（scrollTop 未被重置）', Math.abs(kept.scroll - before.scroll) <= 2, JSON.stringify({ before: before.scroll, now: kept.scroll }))

/* ---------- 7) 目录抽屉：边条开启 → 切章自动关 ---------- */
await c.evalx(`document.querySelector('.ed-read-edge')?.click()`)
await c.sleep(600)
const drawer1 = await c.evalx(`(() => {
  const d = document.querySelector('.n-drawer')
  const nodes = [...document.querySelectorAll('.n-drawer .n-tree-node')]
  return { open: !!d && d.offsetWidth > 0, nodes: nodes.length }
})()`)
check('点击边条滑出章节抽屉且含章节节点', drawer1.open && drawer1.nodes >= 3, JSON.stringify(drawer1))
const switched = await c.evalx(`(async () => {
  const { useWorkStore } = await import('/src/stores/work.js')
  const w = useWorkStore()
  const cur = w.activeChapter?.title
  const other = w.liveChapters.find((c) => c.title !== cur)?.title
  if (!other) return { err: 'no other chapter' }
  const node = [...document.querySelectorAll('.n-drawer .n-tree-node')].find((n) => n.textContent.includes(other))
  if (!node) return { err: 'node not found: ' + other }
  /* naive NTree 的选中监听挂在内容元素上，点外壳不触发 */
  ;(node.querySelector('.n-tree-node-content') || node).click()
  return { title: other }
})()`)
await c.sleep(800)
const after = await c.evalx(`(async () => {
  const { useWorkStore } = await import('/src/stores/work.js')
  const work = useWorkStore()
  const flat = []
  for (const v of work.liveVolumes) for (const ch of work.liveChapters.filter((x) => x.volumeId === v.id)) flat.push(ch.id)
  for (const ch of work.liveChapters.filter((x) => !work.liveVolumes.some((v) => v.id === x.volumeId))) flat.push(ch.id)
  const exp = String(flat.indexOf(work.selChapterId) + 1).padStart(2, '0')
  const d = document.querySelector('.n-drawer')
  return { exp, no: document.querySelector('.ed-read-no')?.textContent || '', drawerOpen: !!d && d.offsetWidth > 0, readHead: ${vis('.ed-read-head')}, title: document.querySelector('.ed-read-title')?.textContent || '' }
})()`)
check('抽屉内点章：切换生效 + 章号更新 + 抽屉自动收起 + 仍在阅读模式',
  after.no === after.exp && after.title === switched.title && !after.drawerOpen && after.readHead, JSON.stringify({ switched, after }))

/* ---------- 8) 两级 Esc：先关抽屉、再退出阅读 ---------- */
await c.evalx(`document.querySelector('.ed-read-edge')?.click()`)
await c.sleep(500)
await c.evalx(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`)
await c.sleep(400)
const esc1 = await c.evalx(`(() => { const d = document.querySelector('.n-drawer'); return { drawerOpen: !!d && d.offsetWidth > 0, readHead: ${vis('.ed-read-head')} } })()`)
check('Esc 第一级：只关抽屉、停留阅读模式', !esc1.drawerOpen && esc1.readHead, JSON.stringify(esc1))
/* 抽屉切章会换编辑器实例（设计如此）；此处以当前实例为基线，断言“退出阅读”本身不重建 */
await c.evalx(`window.__rmRef2 = window.__ns.editor`)
await c.evalx(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`)
await c.sleep(600)
const esc2 = await c.evalx(`(() => ({
  readHead: ${vis('.ed-read-head')},
  head: ${vis('.editor-head')},
  toolbar: ${vis('.editor-toolbar')},
  rail: !!document.querySelector('.nav-rail'),
  editable: window.__ns.editor.isEditable,
  same: window.__ns.editor === window.__rmRef2
}))()`)
check('Esc 第二级：退出阅读，chrome/可编辑恢复且编辑器仍不重建', !esc2.readHead && esc2.head && esc2.toolbar && esc2.rail && esc2.editable === true && esc2.same, JSON.stringify(esc2))

/* ---------- 9) 截图（重新进入阅读态拍图，随后复位） ---------- */
await c.evalx(clickByText('.topbar button', '阅读'))
await c.sleep(600)
const shot = await c.send('Page.captureScreenshot', { format: 'png' })
writeFileSync('tools/_readmode-verify.png', Buffer.from(shot.data, 'base64'))
await c.evalx(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`)
await c.sleep(400)
console.log('[shot] tools/_readmode-verify.png')

const pass = results.filter(Boolean).length
console.log(`\n${pass}/${results.length} 通过`)
process.exit(pass === results.length ? 0 : 1)
