/* 标签面板检验（在「星尘旅人」实书上跑，测后还原）：
 * 幕布行右键 → 可拖动面板 / 选择栏彩色卡片（9 格 + 显示全部）/ 创建栏（回车与「创建」双路径）/
 * 侧边栏右键入口 / 创建时间排序 / 关闭 / 还原。
 * 运行前提：npm run dev（CDP 9222），书架含「星尘旅人」。 */
import { connect } from './_cdp-lib.mjs'

const c = await connect('app://')
const results = []
const check = (name, ok, detail = '') => {
  results.push(ok)
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  —— ' + String(detail).slice(0, 340) : ''))
}
const S = `document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s`
const W = `${S}.get('work')`
const U = `${S}.get('ui')`

await c.evalx('location.reload()')
await c.sleep(3200)

/* ---------- 0) 打开「星尘旅人」并进入设定模块，清理历史残留后记录基线 ---------- */
const base = await c.evalx(`(async () => {
  const { db } = window.__ns
  const works = await db.works.toArray()
  const t = works.find((w) => !w.deletedAt && (w.title || '').includes('星尘旅人'))
  if (!t) return { err: '书架中未找到「星尘旅人」' }
  const w = ${W}
  await w.open(t.id)
  w.tab = 'lore'
  await new Promise((r) => setTimeout(r, 800))
  const live = w.liveMubu()
  if (!live.length) return { err: '星尘旅人没有设定节点' }
  const first = live[0]
  /* 幂等：清理上次中断运行可能残留的检验标签（节点 + 创建时间表） */
  const cleanTags = (first.tags || []).filter((x) => !x.startsWith('__检验'))
  if (cleanTags.length !== (first.tags || []).length) w.mubuSetTags(first.id, cleanTags)
  const meta = { ...w.mubuTagMeta }
  let dirty = false
  for (const k of Object.keys(meta)) if (k.startsWith('__检验')) { delete meta[k]; dirty = true }
  if (dirty) { w.mubuTagMeta = meta; await w.saveMubuTagMeta() }
  await new Promise((r) => setTimeout(r, 300))
  return {
    id: t.id,
    title: t.title,
    nodes: live.length,
    targetId: first.id,
    targetText: first.text || '',
    targetTags: cleanTags,
    pool: w.mubuTags.map((x) => x.name)
  }
})()`)
if (base?.err) {
  console.log('FAIL 打开「星尘旅人」—— ' + base.err)
  process.exit(1)
}
check('打开「星尘旅人」并进入设定模块（记录基线）',
  base.nodes > 0 && !!base.targetId, JSON.stringify({ title: base.title, nodes: base.nodes, pool: base.pool.length, target: base.targetText.slice(0, 12) }))

/* ---------- 1) 幕布行右键「设置标签…」→ 面板打开 ---------- */
const openPanel = await c.evalx(`(async () => {
  const fire = (el, type) => el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }))
  const row = document.querySelector('.ob-row[data-node="m:${base.targetId}"]')
  if (!row) return { err: 'row absent' }
  const rect = row.getBoundingClientRect()
  row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, view: window, clientX: rect.left + 60, clientY: rect.top + rect.height / 2 }))
  await new Promise((r) => setTimeout(r, 350))
  const menu = document.querySelector('.ob-ctx')
  if (!menu) return { err: 'ctx not open' }
  const item = [...menu.querySelectorAll('.ctx-item')].find((i) => i.textContent.includes('设置标签'))
  if (!item) return { err: 'no menu item' }
  fire(item, 'mousedown')
  fire(item, 'click')
  await new Promise((r) => setTimeout(r, 400))
  const panel = document.getElementById('mubu-tag-panel')
  return {
    open: !!panel,
    title: panel?.querySelector('.mtp-title')?.textContent.trim() || '',
    hasGrid: !!panel?.querySelector('.mtp-box'),
    hasCreate: !!panel?.querySelector('.mtp-create input'),
    menuClosed: !document.querySelector('.ob-ctx')
  }
})()`)
check('幕布行右键「设置标签…」→ 面板打开（标题为节点名、含选择栏与创建栏）',
  openPanel.open === true && openPanel.hasGrid === true && openPanel.hasCreate === true && openPanel.menuClosed === true &&
    openPanel.title.includes((base.targetText || '（空节点）').slice(0, 4)), JSON.stringify(openPanel))

/* ---------- 2) 拖动面板 ---------- */
const dragTest = await c.evalx(`(async () => {
  const panel = document.getElementById('mubu-tag-panel')
  const head = panel.querySelector('.mtp-head')
  const r0 = panel.getBoundingClientRect()
  const hx = r0.left + 60
  const hy = r0.top + 14
  head.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window, clientX: hx, clientY: hy, button: 0 }))
  window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, view: window, clientX: hx + 150, clientY: hy + 100 }))
  await new Promise((r) => setTimeout(r, 80))
  window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, view: window, clientX: hx + 150, clientY: hy + 100 }))
  await new Promise((r) => setTimeout(r, 220))
  const r1 = panel.getBoundingClientRect()
  return { dx: Math.round(r1.left - r0.left), dy: Math.round(r1.top - r0.top) }
})()`)
check('面板可拖动（按住头部拖动，位置跟随）',
  dragTest.dx > 60 && dragTest.dy > 30, JSON.stringify(dragTest))

/* ---------- 3) 创建栏：回车创建「__检验甲__」+「创建」按钮创建「__检验乙__」 ---------- */
const createA = await c.evalx(`(async () => {
  const panel = document.getElementById('mubu-tag-panel')
  if (!panel) return { err: 'panel closed before create' }
  const inp = panel.querySelector('.mtp-create input')
  if (!inp) return { err: 'no create input' }
  const setVal = (el, v) => { const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })) }
  inp.focus()
  setVal(inp, '__检验甲__')
  await new Promise((r) => setTimeout(r, 220))
  inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }))
  await new Promise((r) => setTimeout(r, 500))
  const w = ${W}
  const node = w.mubu.find((n) => n.id === ${JSON.stringify(base.targetId)})
  const card = [...panel.querySelectorAll('.mtp-card')].find((b) => b.textContent.trim() === '__检验甲__')
  return {
    cardOn: !!card && card.classList.contains('on'),
    nodeTags: JSON.parse(JSON.stringify(node?.tags || [])),
    inputCleared: inp.value === ''
  }
})()`)
check('创建栏回车创建标签（卡片选中态 + 节点应用 + 输入清空）',
  createA?.cardOn === true && Array.isArray(createA?.nodeTags) && createA?.nodeTags.includes('__检验甲__') && createA?.inputCleared === true, JSON.stringify(createA))

const createB = await c.evalx(`(async () => {
  const panel = document.getElementById('mubu-tag-panel')
  if (!panel) return { err: 'panel closed before create' }
  const inp = panel.querySelector('.mtp-create input')
  if (!inp) return { err: 'no create input' }
  const setVal = (el, v) => { const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })) }
  inp.focus()
  setVal(inp, '__检验乙__')
  await new Promise((r) => setTimeout(r, 220))
  ;[...panel.querySelectorAll('.mtp-create button')].find((b) => b.textContent.includes('创建'))?.click()
  await new Promise((r) => setTimeout(r, 500))
  const w = ${W}
  const node = w.mubu.find((n) => n.id === ${JSON.stringify(base.targetId)})
  const card = [...panel.querySelectorAll('.mtp-card')].find((b) => b.textContent.trim() === '__检验乙__')
  return { cardOn: !!card && card.classList.contains('on'), nodeTags: JSON.parse(JSON.stringify(node?.tags || [])) }
})()`)
check('创建栏「创建」按钮创建标签（第二个路径）',
  createB?.cardOn === true && Array.isArray(createB?.nodeTags) && createB?.nodeTags.includes('__检验乙__'), JSON.stringify(createB))

/* ---------- 4) 选择栏点选切换（点已选取消 / 再点选回） ---------- */
const toggleChk = await c.evalx(`(async () => {
  const panel = document.getElementById('mubu-tag-panel')
  const w = ${W}
  const tagsNow = () => JSON.parse(JSON.stringify(w.mubu.find((n) => n.id === '${base.targetId}')?.tags || []))
  const card = () => [...panel.querySelectorAll('.mtp-card')].find((b) => b.textContent.trim() === '__检验乙__')
  card()?.click()
  await new Promise((r) => setTimeout(r, 350))
  const off = { on: card()?.classList.contains('on'), tags: tagsNow() }
  card()?.click()
  await new Promise((r) => setTimeout(r, 350))
  const onBack = { on: card()?.classList.contains('on'), tags: tagsNow() }
  return { off, onBack }
})()`)
check('选择栏点卡片即时切换应用（取消 → 选回，卡片保留在栏内）',
  toggleChk.off.on === false && !toggleChk.off.tags.includes('__检验乙__') &&
    toggleChk.onBack.on === true && toggleChk.onBack.tags.includes('__检验乙__'), JSON.stringify(toggleChk))

/* ---------- 5) 创建时间排序（先建的在前） + 9 格与「显示全部」 ---------- */
const orderChk = await c.evalx(`(async () => {
  const w = ${W}
  const mine = w.mubuTags.filter((t) => t.name.startsWith('__检验')).map((t) => t.name)
  const panel = document.getElementById('mubu-tag-panel')
  const cards = [...panel.querySelectorAll('.mtp-card')].map((b) => b.textContent.trim())
  return {
    mine,
    cardCount: cards.length,
    hasMore: !!panel.querySelector('.mtp-more'),
    moreText: panel.querySelector('.mtp-more')?.textContent.trim() || ''
  }
})()`)
check('选择栏按创建时间升序（甲先于乙）+ 超过 9 个时出现「显示全部」',
  orderChk.mine.join(',') === '__检验甲__,__检验乙__' &&
    (orderChk.hasMore ? orderChk.cardCount === 9 : orderChk.cardCount >= 2),
  JSON.stringify(orderChk))

/* ---------- 6) 侧边栏右键入口 ---------- */
const sideChk = await c.evalx(`(async () => {
  const fire = (el, type) => el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }))
  const item = [...document.querySelectorAll('.side-list .side-item')][0]
  if (!item) return { err: 'no side item' }
  const rect = item.getBoundingClientRect()
  item.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, view: window, clientX: rect.left + 50, clientY: rect.top + 10 }))
  await new Promise((r) => setTimeout(r, 400))
  const panel = document.getElementById('mubu-tag-panel')
  const ui = ${U}
  return {
    open: !!panel,
    title: panel?.querySelector('.mtp-title')?.textContent.trim() || '',
    nodeId: ui.mubuTagPanel?.nodeId || '',
    selected: ui.mubuSelectedId
  }
})()`)
check('侧边栏树行右键 → 面板打开且指向该条目',
  sideChk.open === true && sideChk.nodeId === sideChk.selected && sideChk.title.includes('标签 ·'), JSON.stringify(sideChk))

/* ---------- 7) 关闭面板（头部 × ） ---------- */
const closeChk = await c.evalx(`(async () => {
  const panel = document.getElementById('mubu-tag-panel')
  panel.querySelector('.mtp-close')?.click()
  await new Promise((r) => setTimeout(r, 250))
  const ui = ${U}
  return { closed: !document.getElementById('mubu-tag-panel'), state: ui.mubuTagPanel }
})()`)
check('关闭按钮关闭面板（状态清除）', closeChk.closed === true && closeChk.state === null, JSON.stringify(closeChk))

/* ---------- 8) 还原：节点标签与标签池回到基线 ---------- */
const restore = await c.evalx(`(async () => {
  const w = ${W}
  w.mubuSetTags(${JSON.stringify(base.targetId)}, ${JSON.stringify(base.targetTags)})
  const meta = { ...w.mubuTagMeta }
  delete meta['__检验甲__']
  delete meta['__检验乙__']
  w.mubuTagMeta = meta
  await w.saveMubuTagMeta()
  if (window.__flushNow) await window.__flushNow()
  return {
    tags: JSON.parse(JSON.stringify(w.mubu.find((n) => n.id === ${JSON.stringify(base.targetId)})?.tags || [])),
    pool: w.mubuTags.map((x) => x.name)
  }
})()`)
check('还原：节点标签与标签池回到基线（无 __检验 残留）',
  JSON.stringify(restore.tags) === JSON.stringify(base.targetTags) && !restore.pool.some((t) => t.startsWith('__检验')),
  JSON.stringify({ tags: restore.tags, poolLen: restore.pool.length, basePoolLen: base.pool.length }))

const pass = results.filter(Boolean).length
console.log(`\n${pass}/${results.length} 通过（检验书：星尘旅人，已还原）`)
process.exit(results.includes(false) ? 1 : 0)
