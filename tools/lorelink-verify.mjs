/* 关系链接（条目级关联关系）+ 设定详情页 验收（在「星尘旅人」实书上跑，测后还原）：
 * 关系设置面板（行右键入口 / 目标选择 / 类型 chips / 描述 / 添加 / 删除）→ 行尾关系卡片 →
 * 悬停浮层（图二行样式；移入保持 / 移出消失）→ 双向展示（反向名）→ 人物侧入口与展示 →
 * 双击进入详情页（面包屑 / 子条目 / 关系列表）→ 关系图谱（节点·连线数 / 拖动落库 / 重开保持 / 点击切换）→
 * 关系行点击跳转 → 删除与还原（关系与图谱布局都回基线，无 __检验 残留）。
 * 运行前提：npm run dev（CDP 9222），书架含「星尘旅人」，窗口可见（合成鼠标事件依赖真实布局）。 */
import fs from 'node:fs'
import path from 'node:path'
import { connect } from './_cdp-lib.mjs'

const c = await connect('app://')
const results = []
const check = (name, ok, detail = '') => {
  results.push(ok)
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  —— ' + String(detail).slice(0, 420) : ''))
}
const S = `document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s`
const W = `${S}.get('work')`
const U = `${S}.get('ui')`
const MK = '__检验__'
const shotDir = path.join(process.cwd(), 'tools')
async function shot(name) {
  /* 窗口隐藏（最小化/被遮挡）时 Page.captureScreenshot 不产帧会挂起——限时兜底，不阻塞验收 */
  try {
    const r = await Promise.race([
      c.send('Page.captureScreenshot', { format: 'png' }),
      new Promise((res) => setTimeout(() => res(null), 6000))
    ])
    if (r?.data) {
      const p = path.join(shotDir, '_llshot-' + name + '.png')
      fs.writeFileSync(p, Buffer.from(r.data, 'base64'))
      console.log('  [shot] ' + p)
    } else {
      console.log('  [shot] 跳过（' + name + '）：窗口隐藏时截图会挂起')
    }
  } catch (e) {
    console.log('  [shot] 失败（' + name + '）：' + String(e).slice(0, 80))
  }
}

await c.evalx('location.reload()')
await c.sleep(3400)

/* ---------- 0) 页面侧助手 + 基线（含幂等清理） ---------- */
await c.evalx(`(() => {
  window.__ll = {
    setVal(el, v) {
      const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      set.call(el, v)
      el.dispatchEvent(new Event('input', { bubbles: true }))
    },
    async cleanRels(w, prefix) {
      const { db } = window.__ns
      const dead = w.lorelinks.filter((l) => String(l.label || '').startsWith(prefix) || String(l.description || '').includes(prefix))
      if (dead.length) {
        await db.lorelinks.bulkDelete(dead.map((l) => l.id))
        const ids = new Set(dead.map((l) => l.id))
        w.lorelinks = w.lorelinks.filter((l) => !ids.has(l.id))
      }
      return dead.length
    },
    /* 目标选择：真实下拉（点击 → 过滤 → 点选项）；失败回退注入组件状态（同一 v-model 链路）。
       注意：窗口隐藏（最小化/被遮挡）时 naive 虚拟列表不渲染选项，真实路径必失败——先恢复窗口可见 */
    async pickSelect(panel, value, text) {
      const sel = panel.querySelector('.n-base-selection')
      if (!sel) return 'no-select'
      const fire = (el, t, extra = {}) => el.dispatchEvent(new MouseEvent(t, Object.assign({ bubbles: true, cancelable: true, view: window, button: 0 }, extra)))
      const r = sel.getBoundingClientRect()
      fire(sel, 'mousedown', { clientX: r.left + 20, clientY: r.top + 12 })
      fire(sel, 'mouseup', { clientX: r.left + 20, clientY: r.top + 12 })
      fire(sel, 'click', { clientX: r.left + 20, clientY: r.top + 12 })
      await new Promise((x) => setTimeout(x, 600))
      const inp = sel.querySelector('input')
      if (inp && text) {
        this.setVal(inp, text)
        await new Promise((x) => setTimeout(x, 640))
      }
      const opt = [...document.querySelectorAll('.n-base-select-option')].find((o) => o.textContent.includes(text))
      if (opt) {
        fire(opt, 'mousedown')
        fire(opt, 'mouseup')
        fire(opt, 'click')
        await new Promise((x) => setTimeout(x, 420))
        const lbl = panel.querySelector('.n-base-selection-label')?.textContent || ''
        if (lbl.includes(text)) return 'ui'
      }
      const inst = panel.__vueParentComponent
      if (inst && inst.setupState) {
        inst.setupState.target = value
        await new Promise((x) => setTimeout(x, 280))
        return 'state'
      }
      return 'fail'
    }
  }
  return 'helpers-ok'
})()`)

const base = await c.evalx(`(async () => {
  const { db } = window.__ns
  const works = await db.works.toArray()
  const t = works.find((w) => !w.deletedAt && (w.title || '').includes('星尘旅人'))
  if (!t) return { err: '书架中未找到「星尘旅人」' }
  const w = ${W}
  await w.open(t.id)
  w.tab = 'lore'
  await new Promise((r) => setTimeout(r, 900))
  await window.__ll.cleanRels(w, ${JSON.stringify(MK)}) /* 幂等：清上次中断残留 */
  await new Promise((r) => setTimeout(r, 250))
  const live = w.liveMubu()
  if (live.length < 3) return { err: '设定节点不足' }
  const a = live.find((n) => w.mubuChildren(n.id).length > 0) || live[0]
  const b = live.find((n) => n.id !== a.id)
  const ch = w.liveCharacters[0]
  if (!b || !ch) return { err: '缺少第二节点或人物' }
  const crumbs = []
  let cur = a
  let g = 0
  while (cur && g++ < 20) {
    crumbs.unshift((cur.text || '（空节点）').slice(0, 24))
    cur = cur.parentId ? w.mubu.find((x) => x.id === cur.parentId && !x.deletedAt) : null
  }
  const cfg = await db.appconfig.get('loreGraph:' + t.id)
  const rows = await db.lorelinks.where('workId').equals(t.id).toArray()
  /* 子条目数 = 递归全部后代（详情页渲染为扁平缩进列表） */
  let kidsFlat = 0
  const walkKids = (pid) => { for (const k of w.mubuChildren(pid)) { kidsFlat++; walkKids(k.id) } }
  walkKids(a.id)
  return {
    id: t.id,
    title: t.title,
    nodes: live.length,
    aId: a.id, aText: (a.text || '').trim() || '（空节点）',
    bId: b.id, bText: (b.text || '').trim() || '（空节点）',
    cId: ch.id, cName: ch.name || '未命名',
    kids: kidsFlat,
    crumbs,
    rels: rows.length,
    graphKeys: cfg?.value ? Object.keys(cfg.value).length : 0,
    graphRaw: JSON.stringify(cfg?.value || {})
  }
})()`)
if (base?.err) {
  console.log('FAIL 打开「星尘旅人」—— ' + base.err)
  process.exit(1)
}
check('打开「星尘旅人」并进入设定模块（记录关系与图谱基线）',
  base.nodes > 0 && !!base.aId && !!base.bId && !!base.cId, JSON.stringify({ title: base.title, nodes: base.nodes, a: base.aText.slice(0, 10), b: base.bText.slice(0, 10), c: base.cName, kids: base.kids, rels: base.rels }))

/* ---------- 1) 行右键「设置关系…」→ 面板打开 ---------- */
const p1 = await c.evalx(`(async () => {
  const fire = (el, type, init = {}) => el.dispatchEvent(new MouseEvent(type, Object.assign({ bubbles: true, cancelable: true, view: window }, init)))
  const row = document.querySelector('.ob-row[data-node="m:${base.aId}"]')
  if (!row) return { err: 'row absent' }
  const r = row.getBoundingClientRect()
  fire(row, 'contextmenu', { clientX: r.left + 60, clientY: r.top + r.height / 2 })
  await new Promise((rr) => setTimeout(rr, 340))
  const menu = document.querySelector('.ob-ctx')
  if (!menu) return { err: 'ctx not open' }
  const item = [...menu.querySelectorAll('.ctx-item')].find((i) => i.textContent.includes('设置关系'))
  if (!item) return { err: 'no 设置关系 item', items: [...menu.querySelectorAll('.ctx-item')].map((i) => i.textContent.trim()).slice(0, 40) }
  fire(item, 'mousedown')
  fire(item, 'click')
  await new Promise((rr) => setTimeout(rr, 420))
  const panel = document.getElementById('lore-rel-panel')
  const ui = ${U}
  return {
    open: !!panel,
    title: panel?.querySelector('.lrp-title')?.textContent.trim() || '',
    hasPreset: !!panel?.querySelector('.lrp-chip'),
    hasSelect: !!panel?.querySelector('.n-base-selection'),
    menuClosed: !document.querySelector('.ob-ctx'),
    stateKind: ui.loreRelationPanel?.kind || ''
  }
})()`)
check('幕布行右键「设置关系…」→ 面板打开（标题为条目名、含目标选择与类型 chips）',
  p1.open === true && p1.hasPreset === true && p1.hasSelect === true && p1.menuClosed === true &&
    p1.title.includes(base.aText.slice(0, 4)) && p1.stateKind === 'mubu', JSON.stringify(p1))

/* ---------- 2) 新建关系（目标 + chips「位于」+ 反向名 + 描述 → 添加） ---------- */
const p2 = await c.evalx(`(async () => {
  const panel = document.getElementById('lore-rel-panel')
  if (!panel) return { err: 'panel absent' }
  const path = await window.__ll.pickSelect(panel, 'mubu:${base.bId}', ${JSON.stringify(base.bText.slice(0, 8))})
  const chip = [...panel.querySelectorAll('.lrp-chip')].find((el) => el.textContent.trim() === '位于')
  chip?.click()
  await new Promise((r) => setTimeout(r, 220))
  window.__ll.setVal(panel.querySelector('input[placeholder^="反向名"]'), '包含')
  window.__ll.setVal(panel.querySelector('input[placeholder^="描述"]'), '${MK}大陆东南沿海')
  await new Promise((r) => setTimeout(r, 260))
  const labelVal = panel.querySelector('input[placeholder^="关系类型"]')?.value || ''
  const btn = [...panel.querySelectorAll('.lrp-actions button')].find((b) => b.textContent.trim() === '添加')
  const disabled = btn?.disabled === true
  btn?.click()
  await new Promise((r) => setTimeout(r, 360))
  if (window.__flushNow) await window.__flushNow() // 关系行走 autosave 防抖（1s），断言前先落盘
  const w = ${W}
  const { db } = window.__ns
  const rows = await db.lorelinks.where('workId').equals(w.work.id).toArray()
  const rel = rows.find((l) => l.fromId === '${base.aId}' && l.toId === '${base.bId}' && l.label === '位于')
  return {
    path, labelVal, disabled, count: rows.length,
    rel: rel ? { label: rel.label, reverse: rel.reverseLabel, desc: rel.description, fromKind: rel.fromKind, toKind: rel.toKind } : null,
    selectCleared: !panel.querySelector('.n-base-selection-label')?.textContent?.trim()
  }
})()`)
check('面板新建关系（搜索目标 + chips 位于 + 反向名 包含 + 描述 → 落库）',
  p2.rel && p2.rel.label === '位于' && p2.rel.reverse === '包含' && p2.rel.desc.includes(MK) && p2.rel.fromKind === 'mubu' && p2.rel.toKind === 'mubu' && p2.disabled === false,
  JSON.stringify({ path: p2.path, labelVal: p2.labelVal, rel: p2.rel, count: p2.count }))

/* ---------- 3) 行尾关系卡片 ---------- */
const chipChk = await c.evalx(`(async () => {
  await new Promise((r) => setTimeout(r, 350))
  const row = document.querySelector('.ob-row[data-node="m:${base.aId}"]')
  const chip = row?.querySelector('.ob-relchip')
  return { chip: !!chip, text: chip?.textContent.trim() || '' }
})()`)
check('行尾出现关系卡片（彩色胶囊：类型名）', chipChk.chip === true && chipChk.text.includes('位于'), JSON.stringify(chipChk))

/* ---------- 4) 悬停浮层（内容 + 移入保持 + 移出消失） ---------- */
const hov = await c.evalx(`(async () => {
  const chip = document.querySelector('.ob-row[data-node="m:${base.aId}"] .ob-relchip')
  if (!chip) return { err: 'no chip' }
  chip.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false, view: window }))
  await new Promise((r) => setTimeout(r, 340))
  const pop = document.querySelector('.ob-relpop')
  const text = pop?.textContent || ''
  /* 真实移动顺序：先离开卡片（进入 220ms 宽限）→ 再移入浮层（取消隐藏） */
  chip.dispatchEvent(new MouseEvent('mouseleave', { bubbles: false, view: window }))
  await new Promise((r) => setTimeout(r, 120))
  pop?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false, view: window }))
  await new Promise((r) => setTimeout(r, 420))
  const kept = !!document.querySelector('.ob-relpop')
  document.querySelector('.ob-relpop')?.dispatchEvent(new MouseEvent('mouseleave', { bubbles: false, view: window }))
  await new Promise((r) => setTimeout(r, 460))
  const gone = !document.querySelector('.ob-relpop')
  return {
    opened: !!pop,
    hasKind: text.includes('位于'),
    hasOther: text.includes(${JSON.stringify(base.bText.slice(0, 8))}),
    hasDesc: text.includes('大陆东南沿海'),
    hasDir: text.includes('→'),
    kept, gone
  }
})()`)
check('悬停卡片出浮层（类型/目标/描述齐全）', hov.opened === true && hov.hasKind && hov.hasOther && hov.hasDesc && hov.hasDir, JSON.stringify(hov))
check('浮层交互：移入浮层保持 / 移出后消失', hov.kept === true && hov.gone === true, JSON.stringify({ kept: hov.kept, gone: hov.gone }))
await shot('01-chip-hover')

/* ---------- 5) 双向展示（目标侧入向行用反向名） ---------- */
const rev = await c.evalx(`(async () => {
  const w = ${W}
  const ui = ${U}
  /* 目标条目可能在折叠节点内部：先全部展开并触发幕布重建（同侧栏「全部展开」路径） */
  w.mubuFoldAll(false)
  ui.mubuSyncTick++
  await new Promise((r) => setTimeout(r, 520))
  const entries = w.loreLinksOf('mubu', '${base.bId}')
  const inRow = entries.find((e) => e.dir === 'in')
  const chip = document.querySelector('.ob-row[data-node="m:${base.bId}"] .ob-relchip')
  const folds = []
  let cur = w.mubu.find((n) => n.id === '${base.bId}')
  let g = 0
  while (cur && g++ < 12) {
    if (cur.fold) folds.push((cur.text || '').slice(0, 10))
    cur = cur.parentId ? w.mubu.find((x) => x.id === cur.parentId && !x.deletedAt) : null
  }
  return {
    list: entries.map((e) => e.dir + ':' + e.label + ':' + e.otherTitle),
    inLabel: inRow?.label || '',
    chip: chip?.textContent.trim() || '',
    rowExists: !!document.querySelector('.ob-row[data-node="m:${base.bId}"]'),
    rows: document.querySelectorAll('.ob-row').length,
    nodes: w.liveMubu().length,
    folds
  }
})()`)
check('双向展示：目标条目出现入向关系（反向名「包含」）且行尾卡片同步',
  rev.inLabel === '包含' && rev.rowExists === true && rev.chip.includes('包含'), JSON.stringify(rev))

/* ---------- 6) 人物侧入口：人物「属于」地点（反向名自定义「成员」） ---------- */
const p3 = await c.evalx(`(async () => {
  const w = ${W}
  w.tab = 'characters'
  w.charView = 'list'
  w.selCharacterId = '${base.cId}'
  await new Promise((r) => setTimeout(r, 620))
  const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('添加关联'))
  if (!btn) return { err: 'no 添加关联 button' }
  btn.click()
  await new Promise((r) => setTimeout(r, 420))
  const panel = document.getElementById('lore-rel-panel')
  const ui = ${U}
  return { open: !!panel, kind: ui.loreRelationPanel?.kind || '', title: panel?.querySelector('.lrp-title')?.textContent.trim() || '' }
})()`)
check('人物详情「关联关系」区「添加关联」→ 面板打开（角色 = 人物）',
  p3.open === true && p3.kind === 'character' && p3.title.includes(base.cName.slice(0, 4)), JSON.stringify(p3))

const p4 = await c.evalx(`(async () => {
  const panel = document.getElementById('lore-rel-panel')
  if (!panel) return { err: 'panel absent' }
  const path = await window.__ll.pickSelect(panel, 'mubu:${base.aId}', ${JSON.stringify(base.aText.slice(0, 8))})
  const chip = [...panel.querySelectorAll('.lrp-chip')].find((el) => el.textContent.trim() === '属于')
  chip?.click()
  await new Promise((r) => setTimeout(r, 220))
  window.__ll.setVal(panel.querySelector('input[placeholder^="反向名"]'), '成员')
  window.__ll.setVal(panel.querySelector('input[placeholder^="描述"]'), '${MK}居民')
  await new Promise((r) => setTimeout(r, 240))
  ;[...panel.querySelectorAll('.lrp-actions button')].find((b) => b.textContent.trim() === '添加')?.click()
  await new Promise((r) => setTimeout(r, 360))
  if (window.__flushNow) await window.__flushNow()
  const w = ${W}
  const { db } = window.__ns
  const rows = await db.lorelinks.where('workId').equals(w.work.id).toArray()
  const rel = rows.find((l) => l.fromKind === 'character' && l.fromId === '${base.cId}' && l.toId === '${base.aId}' && l.label === '属于')
  /* 人物详情区应出现该关系行（出向：属于 → 地点） */
  const sec = [...document.querySelectorAll('.rel-row')].map((r) => r.textContent.trim())
  return { path, rel: rel ? { label: rel.label, reverse: rel.reverseLabel } : null, sec }
})()`)
check('人物侧新建「属于」关系（人物 → 地点）并显示在关联区',
  p4.rel && p4.rel.label === '属于' && p4.rel.reverse === '成员' && p4.sec.some((t) => t.includes('属于') && t.includes(base.aText.slice(0, 6))),
  JSON.stringify(p4))

/* ---------- 7) 数据完整性：备份含 lorelinks / 端点彻底删除级联清理 ---------- */
const bk = await c.evalx(`(async () => {
  try {
    const mod = await import('/src/db/repo.js')
    const dump = JSON.parse(await mod.exportBackupJson())
    return { has: Array.isArray(dump.data.lorelinks), count: (dump.data.lorelinks || []).length }
  } catch (e) {
    return { err: String(e).slice(0, 160) }
  }
})()`)
check('备份 JSON 含 lorelinks 表（关系随备份迁移）', bk.has === true && bk.count >= 2, JSON.stringify(bk))

const purge = await c.evalx(`(async () => {
  const w = ${W}
  const { db } = window.__ns
  /* 临时节点 + 一条关系 → 彻底删除节点（回收站 purge 路径）→ 关系应被连带清理；软删路径不清理 */
  const node = w.mubuAdd(null, null, '${MK}purge')
  await window.__flushNow()
  w.addLoreLink({ fromKind: 'mubu', fromId: node.id, toKind: 'mubu', toId: '${base.bId}', label: '关联', description: '${MK}purge' })
  await window.__flushNow()
  const before = (await db.lorelinks.where('workId').equals(w.work.id).toArray()).filter((l) => l.description === '${MK}purge').length
  await w.mubuPurge(node.id)
  await window.__flushNow()
  const after = (await db.lorelinks.where('workId').equals(w.work.id).toArray()).filter((l) => l.description === '${MK}purge').length
  return { relBefore: before, relAfter: after, nodeGone: !w.mubu.some((n) => n.id === node.id) }
})()`)
check('端点条目彻底删除（purge）→ 关联关系连带清理',
  purge.relBefore === 1 && purge.relAfter === 0 && purge.nodeGone === true, JSON.stringify(purge))

/* ---------- 8) 双击条目 → 详情页 ---------- */
const det = await c.evalx(`(async () => {
  const w = ${W}
  const ui = ${U}
  ui.loreRelationPanel = null /* 关掉上一步的人物侧面板，避免遮挡截图与断言 */
  w.tab = 'lore'
  await new Promise((r) => setTimeout(r, 420))
  const row = document.querySelector('.ob-row[data-node="m:${base.aId}"]')
  if (!row) return { err: 'row absent' }
  row.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true, view: window }))
  await new Promise((r) => setTimeout(r, 560))
  const page = document.querySelector('.ldt-page')
  if (!page) return { err: 'detail not open', state: ui.loreDetailId }
  return {
    open: true,
    title: page.querySelector('.ldt-title')?.textContent.trim() || '',
    crumbs: [...page.querySelectorAll('.ldt-crumb')].map((b) => b.textContent.trim()),
    kids: page.querySelectorAll('.ldt-kid').length,
    relRows: page.querySelectorAll('.rel-row').length,
    kinds: [...page.querySelectorAll('.rel-row .rel-kind')].map((k) => k.textContent.trim()),
    graphNodes: page.querySelectorAll('.lg-node').length,
    graphEdges: page.querySelectorAll('.lg-edges path[stroke]:not(.lg-edge-hit)').length,
    center: page.querySelector('.lg-node.center .lg-title')?.textContent.trim() || '',
    state: ui.loreDetailId
  }
})()`)
check('双击条目 → 详情页（标题 / 面包屑 / 子条目数与幕布一致）',
  det.open === true && det.title === base.aText && det.kids === base.kids && JSON.stringify(det.crumbs) === JSON.stringify(base.crumbs) && det.state === base.aId,
  JSON.stringify({ title: det.title, crumbs: det.crumbs, kids: det.kids, state: det.state, err: det.err }))
check('详情页关系列表（出向位于 + 入向 成员）与图谱（中心 + 2 邻居 / 2 连线）',
  det.relRows === 2 && det.kinds.includes('位于') && det.kinds.includes('成员') && det.graphNodes === 3 && det.graphEdges === 2 && det.center === base.aText.slice(0, 20),
  JSON.stringify({ relRows: det.relRows, kinds: det.kinds, graphNodes: det.graphNodes, graphEdges: det.graphEdges, center: det.center }))
await shot('02-detail')

/* ---------- 8) 图谱：拖动邻居（位置跟随 + 落库 + 重开保持） ---------- */
const drag = await c.evalx(`(async () => {
  const page = document.querySelector('.ldt-page')
  const node = [...page.querySelectorAll('.lg-node')].find((n) => !n.classList.contains('center'))
  if (!node) return { err: 'no neighbor' }
  const nk = node.textContent.trim()
  const r0 = node.getBoundingClientRect()
  const sx = r0.left + 24
  const sy = r0.top + 18
  const fire = (el, type, x, y) => el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y, button: 0 }))
  fire(node, 'mousedown', sx, sy)
  window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, view: window, clientX: sx + 70, clientY: sy + 50 }))
  await new Promise((r) => setTimeout(r, 90))
  window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, view: window, clientX: sx + 120, clientY: sy + 86 }))
  await new Promise((r) => setTimeout(r, 90))
  window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, view: window, clientX: sx + 120, clientY: sy + 86 }))
  await new Promise((r) => setTimeout(r, 800))
  const r1 = node.getBoundingClientRect()
  const { db } = window.__ns
  const w = ${W}
  const cfg = await db.appconfig.get('loreGraph:' + w.work.id)
  const layout = cfg?.value?.['mubu:${base.aId}'] || {}
  const styles = [...page.querySelectorAll('.lg-node')].filter((n) => !n.classList.contains('center')).map((n) => ({ t: n.textContent.trim(), left: parseInt(n.style.left, 10), top: parseInt(n.style.top, 10) }))
  return {
    nk,
    dx: Math.round(r1.left - r0.left),
    dy: Math.round(r1.top - r0.top),
    layoutKeys: Object.keys(layout).length,
    styles
  }
})()`)
check('图谱拖动邻居节点（位置跟随 + 落库 loreGraph:<workId>）',
  drag.dx > 60 && drag.dy > 30 && drag.layoutKeys > 0, JSON.stringify({ nk: drag.nk, dx: drag.dx, dy: drag.dy, layoutKeys: drag.layoutKeys, err: drag.err }))
await shot('03-graph-drag')

const persist = await c.evalx(`(async () => {
  const ui = ${U}
  const before = ${JSON.stringify(JSON.stringify(drag.styles || []))}
  const want = JSON.parse(before).find((s) => s.t === ${JSON.stringify(drag.nk)})
  ui.loreDetailId = null
  await new Promise((r) => setTimeout(r, 260))
  ui.loreDetailId = '${base.aId}'
  await new Promise((r) => setTimeout(r, 820))
  const page = document.querySelector('.ldt-page')
  const now = [...page.querySelectorAll('.lg-node')].filter((n) => !n.classList.contains('center'))
    .map((n) => ({ t: n.textContent.trim(), left: parseInt(n.style.left, 10), top: parseInt(n.style.top, 10) }))
  const got = now.find((s) => s.t === ${JSON.stringify(drag.nk)})
  return { want, got }
})()`)
check('重开详情页：图谱节点位置保持（布局记忆生效）',
  !!persist.want && !!persist.got && persist.want.left === persist.got.left && persist.want.top === persist.got.top,
  JSON.stringify(persist))

/* ---------- 9) 图谱节点点击 / 详情关系行点击 的导航 ---------- */
const nav = await c.evalx(`(async () => {
  const page = document.querySelector('.ldt-page')
  const w = ${W}
  const ui = ${U}
  /* 点击图谱里的设定邻居（B）→ 就地切换到该条目的详情页 */
  const node = [...page.querySelectorAll('.lg-node')].find((n) => !n.classList.contains('center') && n.textContent.includes(${JSON.stringify(base.bText.slice(0, 6))}))
  if (!node) return { err: 'no b node', texts: [...page.querySelectorAll('.lg-node')].map((n) => n.textContent.trim()) }
  const r = node.getBoundingClientRect()
  const fire = (type, x, y) => node.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y, button: 0 }))
  fire('mousedown', r.left + 20, r.top + 16)
  window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, view: window, clientX: r.left + 20, clientY: r.top + 16 }))
  await new Promise((rr) => setTimeout(rr, 620))
  const page2 = document.querySelector('.ldt-page')
  const title2 = page2?.querySelector('.ldt-title')?.textContent.trim() || ''
  /* 详情页关系行点击：B 页里的入向行（位于←A 的反向）指向设定 A → 再切回 A */
  const rows = [...(page2?.querySelectorAll('.rel-row') || [])]
  const back = rows.find((x) => x.textContent.includes(${JSON.stringify(base.aText.slice(0, 6))}))
  back?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))
  await new Promise((rr) => setTimeout(rr, 620))
  const title3 = document.querySelector('.ldt-page .ldt-title')?.textContent.trim() || ''
  return { title2, title3, state: ui.loreDetailId }
})()`)
check('图谱邻居点击 → 切换详情页；关系行点击 → 再切回（就地导航）',
  nav.title2 === base.bText && nav.title3 === base.aText,
  JSON.stringify({ title2: (nav.title2 || '').slice(0, 12), title3: (nav.title3 || '').slice(0, 12), want2: base.bText.slice(0, 12), want3: base.aText.slice(0, 12), err: nav.err }))

/* 人物邻居行点击 → 关闭详情页并跳人物模块 */
const navC = await c.evalx(`(async () => {
  const w = ${W}
  const ui = ${U}
  const page = document.querySelector('.ldt-page')
  const rows = [...page.querySelectorAll('.rel-row')]
  const inRow = rows.find((x) => x.querySelector('.rel-dir')?.textContent.trim() === '←')
  if (!inRow) return { err: 'no in row', rows: rows.map((r) => r.textContent.trim()) }
  inRow.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))
  await new Promise((r) => setTimeout(r, 620))
  return { closed: !document.querySelector('.ldt-page'), tab: w.tab, sel: w.selCharacterId, want: '${base.cId}' }
})()`)
check('详情页入向行（人物）点击 → 关闭详情页并跳到人物模块',
  navC.closed === true && navC.tab === 'characters' && navC.sel === navC.want, JSON.stringify(navC))

/* ---------- 10) 行尾卡片点击开面板 → × 删除全部检验关系 ---------- */
const del = await c.evalx(`(async () => {
  const w = ${W}
  const ui = ${U}
  const { db } = window.__ns
  ui.loreDetailId = null
  w.tab = 'lore'
  await new Promise((r) => setTimeout(r, 420))
  const row = document.querySelector('.ob-row[data-node="m:${base.aId}"]')
  const chip = row?.querySelector('.ob-relchip')
  if (!chip) return { err: 'no chip' }
  chip.click()
  await new Promise((r) => setTimeout(r, 420))
  const panel = document.getElementById('lore-rel-panel')
  if (!panel) return { err: 'panel not open via chip' }
  const before = panel.querySelectorAll('.rel-row').length
  let n = 0
  for (let i = 0; i < 8; i++) {
    const x = panel.querySelector('.rel-row .rel-x')
    if (!x) break
    x.click()
    n++
    await new Promise((r) => setTimeout(r, 320))
  }
  const after = panel.querySelectorAll('.rel-row').length
  const rows = await db.lorelinks.where('workId').equals(w.work.id).toArray()
  const leftover = rows.filter((l) => String(l.label || '').startsWith(${JSON.stringify(MK)}) || String(l.description || '').includes(${JSON.stringify(MK)}))
  return {
    before, after, removed: n,
    leftover: leftover.length,
    chipGone: !document.querySelector('.ob-row[data-node="m:${base.aId}"] .ob-relchip')
  }
})()`)
check('行尾卡片点击开面板；× 删除关系（卡片随之消失）',
  del.before === 2 && del.after === 0 && del.removed === 2 && del.chipGone === true, JSON.stringify(del))

/* ---------- 11) 还原：关系与图谱布局回基线，无残留 ---------- */
const restore = await c.evalx(`(async () => {
  const w = ${W}
  const ui = ${U}
  const { db } = window.__ns
  await window.__ll.cleanRels(w, ${JSON.stringify(MK)})
  await db.appconfig.put({ key: 'loreGraph:' + w.work.id, value: JSON.parse(${JSON.stringify(base.graphRaw)}) })
  w.loreGraph = JSON.parse(${JSON.stringify(base.graphRaw)})
  ui.loreRelationPanel = null
  ui.loreDetailId = null
  if (window.__flushNow) await window.__flushNow()
  const rows = await db.lorelinks.where('workId').equals(w.work.id).toArray()
  const cfg = await db.appconfig.get('loreGraph:' + w.work.id)
  return {
    count: rows.length,
    dirty: rows.some((l) => String(l.label || '').startsWith(${JSON.stringify(MK)}) || String(l.description || '').includes(${JSON.stringify(MK)})),
    graphKeys: cfg?.value ? Object.keys(cfg.value).length : 0,
    panels: !document.getElementById('lore-rel-panel') && !document.querySelector('.ldt-page') || undefined,
    stateClean: ui.loreRelationPanel === null && ui.loreDetailId === null
  }
})()`)
check('还原：关系计数回基线、图谱布局回基线、面板关闭、无 __检验 残留',
  restore.count === base.rels && restore.dirty === false && restore.graphKeys === base.graphKeys && restore.stateClean === true,
  JSON.stringify(restore))

const pass = results.filter(Boolean).length
console.log(`\n${pass}/${results.length} 通过（检验书：星尘旅人，已还原）`)
process.exit(results.includes(false) ? 1 : 0)
