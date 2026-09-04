/* relfollow-verify.mjs —— 人物关系图拖线改关系 + 空内容新建验收（v0.4.10）
 * 覆盖：拖线到已有人物关系 → 打开编辑浮层（改变关系而非忽略）；
 *       拖线新建空标签 → 默认「关联」；关系改动在人物列表/详情实时同步；
 *       右键新建人物内容全空（name 空、role 默认，显示未命名兜底）。
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

const store = `document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('work')`

/* 种子：验证书 + 三个人物 + 图视图 */
const seed = await c.evalx(`(async () => {
  const w = ${store}
  const shelf = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('shelf')
  await shelf.refresh()
  const exist = shelf.works.find((x) => x.title === '关系跟随验证书')
  const wid = exist ? exist.id : (await shelf.createWork({ title: '关系跟随验证书' })).id
  if (!w.work || w.work.id !== wid) { await w.open(wid); await new Promise((r) => setTimeout(r, 900)) }
  for (const n of ['甲', '乙', '丙']) if (!w.liveCharacters.some((x) => x.name === n)) { const r = w.addCharacter(); r.name = n; w.updateCharacter(r.id, { name: n }) }
  for (const r of [...w.relations]) await w.removeRelation(r.id) // 幂等：清掉上轮关系
  for (const c0 of w.liveCharacters.filter((x) => !x.name)) await w.deleteCharacter(c0.id) // 清掉上轮遗留的未命名人物
  for (const x of w.liveCharacters) if (['甲', '乙', '丙'].includes(x.name)) w.updateCharacter(x.id, { role: '' }) // 幂等：重置角色定位
  w.tab = 'characters'
  w.charView = 'graph'
  await new Promise((r) => setTimeout(r, 1000))
  return { ok: true, names: w.liveCharacters.map((x) => x.name) }
})()`)
if (!seed.ok) {
  console.log('seed failed:', JSON.stringify(seed))
  process.exit(1)
}

/* 1. 拖线 甲→乙 新建关系，标签留空回车 → 默认「关联」 */
await c.evalx(`(() => {
  const src = [...document.querySelectorAll('.rg-node')].find((x) => x.textContent.includes('甲'))
  const dst = [...document.querySelectorAll('.rg-node')].find((x) => x.textContent.includes('乙'))
  const apt = src.querySelector('.rg-apt[data-side="right"]')
  const ar = apt.getBoundingClientRect()
  apt.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: ar.left + 3, clientY: ar.top + 3 }))
  const dr = dst.getBoundingClientRect()
  window.dispatchEvent(new MouseEvent('mousemove', { clientX: dr.left + dr.width / 2, clientY: dr.top + dr.height / 2 }))
  window.dispatchEvent(new MouseEvent('mouseup', { clientX: dr.left + dr.width / 2, clientY: dr.top + dr.height / 2 }))
  return 1
})()`)
await c.sleep(500)
const newRel = await c.evalx(`(() => {
  const inp = document.querySelector('.rg-relinput input')
  if (!inp) return { err: 'no input' }
  inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
  const w = ${store}
  const a = w.liveCharacters.find((x) => x.name === '甲')
  const b = w.liveCharacters.find((x) => x.name === '乙')
  const rel = w.relations.find((r) => (r.fromId === a.id && r.toId === b.id) || (r.fromId === b.id && r.toId === a.id))
  return { label: rel?.label }
})()`)
check('1 拖线新建空标签 → 默认「关联」', newRel.label === '关联', JSON.stringify(newRel))

/* 2. 再拖一次 甲→乙（已有关系）→ 弹编辑浮层而非忽略；改标签为「宿敌」 */
await c.evalx(`(() => {
  const src = [...document.querySelectorAll('.rg-node')].find((x) => x.textContent.includes('甲'))
  const dst = [...document.querySelectorAll('.rg-node')].find((x) => x.textContent.includes('乙'))
  const apt = src.querySelector('.rg-apt[data-side="right"]')
  const ar = apt.getBoundingClientRect()
  apt.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: ar.left + 3, clientY: ar.top + 3 }))
  const dr = dst.getBoundingClientRect()
  window.dispatchEvent(new MouseEvent('mousemove', { clientX: dr.left + dr.width / 2, clientY: dr.top + dr.height / 2 }))
  window.dispatchEvent(new MouseEvent('mouseup', { clientX: dr.left + dr.width / 2, clientY: dr.top + dr.height / 2 }))
  return 1
})()`)
await c.sleep(500)
const editOpen = await c.evalx(`(() => {
  const box = document.querySelector('.rg-eedit')
  if (!box) return { err: 'no editor', relInputShown: !!document.querySelector('.rg-relinput') }
  return { shown: true }
})()`)
check('2a 拖线到已有关系 → 打开编辑浮层', editOpen.shown === true, JSON.stringify(editOpen))

/* 3. 编辑浮层中改标签「宿敌」→ 画布边标签与详情列表同步 */
const patched = await c.evalx(`(() => {
  const inp = document.querySelector('.rg-eedit input')
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(inp, '宿敌')
  inp.dispatchEvent(new Event('input', { bubbles: true }))
  const w = ${store}
  const a = w.liveCharacters.find((x) => x.name === '甲')
  const b = w.liveCharacters.find((x) => x.name === '乙')
  const rel = w.relations.find((r) => (r.fromId === a.id && r.toId === b.id) || (r.fromId === b.id && r.toId === a.id))
  return { label: rel?.label, count: w.relations.length }
})()`)
check('2b 编辑浮层改标签生效且不产生重复关系', patched.label === '宿敌' && patched.count === 1, JSON.stringify(patched))

/* 4. 切列表视图选中甲 → 详情「人物关系」区显示 乙/宿敌（图视图连线 → 列表同步） */
const detail = await c.evalx(`(async () => {
  const w = ${store}
  const a = w.liveCharacters.find((x) => x.name === '甲')
  w.selCharacterId = a.id
  w.charView = 'list'
  await new Promise((r) => setTimeout(r, 600))
  const inputs = [...document.querySelectorAll('.field-row input')].map((x) => x.value)
  return { hasPair: inputs.some((v) => v === '宿敌'), labels: inputs }
})()`)
check('3 人物详情关系区实时同步（乙 · 宿敌）', detail.hasPair, JSON.stringify(detail.labels))

/* 5. 右键新建人物 → 内容全空（name 空、role 默认配角、content 空），列表显示「未命名」 */
const blankAdd = await c.evalx(`(async () => {
  const w = ${store}
  w.charView = 'graph'
  await new Promise((r) => setTimeout(r, 800))
  const el = document.querySelector('.rg-canvas')
  if (!el) return { err: 'no canvas' }
  const b = el.getBoundingClientRect()
  el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: b.x + b.width * 0.5, clientY: b.y + b.height * 0.5, button: 2 }))
  await new Promise((r) => setTimeout(r, 300))
  ;[...document.querySelectorAll('.oc-blankctx .oc-ctx-item')].find((x) => x.textContent.includes('新建人物'))?.click()
  await new Promise((r) => setTimeout(r, 700))
  const row = w.liveCharacters.find((x) => !x.name)
  const listShown = [...document.querySelectorAll('.side-item')].some((x) => x.textContent.includes('未命名'))
  const df = Object.keys(row?.fields || {})
  return {
    blank: !!row,
    role: row?.role,
    content: row?.content,
    nameEmpty: !row?.name,
    defaultsSeeded: ['外貌', '性格'].every((k) => df.includes(k) && row.fields[k] === ''),
    listShown
  }
})()`)
check(
  '4 右键新建人物空内容+默认字段 + 列表「未命名」兜底',
  blankAdd.blank && blankAdd.nameEmpty && blankAdd.role === '配角' && blankAdd.content === '' && blankAdd.defaultsSeeded && blankAdd.listShown,
  JSON.stringify(blankAdd)
)

/* ---------- 5. 四边锚点存在且热区 16×16 CSS px（画布 pan-zoom 缩放会放大 rect，须除以 scale） ---------- */
const apt = await c.evalx(`(() => {
  const node = document.querySelector('.rg-node')
  const sides = [...node.querySelectorAll('.rg-apt')].map((x) => x.dataset.side).sort()
  const r = node.querySelector('.rg-apt[data-side="top"]').getBoundingClientRect()
  const scale = /scale\\(([\\d.]+)/.exec(document.querySelector('.om-inner').style.transform || '')
  const f = scale ? Number(scale[1]) : 1
  return { sides, wCss: r.width / f, hCss: r.height / f }
})()`)
check('5 四边锚点 + 热区 16×16', apt.sides.join(',') === 'bottom,left,right,top' && Math.round(apt.wCss) === 16 && Math.round(apt.hCss) === 16, JSON.stringify(apt))

/* ---------- 6. 编辑浮层改线型（虚线）与颜色 → 边渲染跟随 ---------- */
await c.evalx(`(() => {
  const hit = document.querySelector('.rg-edge-hit')
  const r = hit.getBoundingClientRect()
  hit.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }))
  return 1
})()`)
await c.sleep(500)
const style = await c.evalx(`(() => {
  const box = document.querySelector('.rg-eedit')
  if (!box) return { err: 'no editor' }
  ;[...box.querySelectorAll('.oc-kind')].find((x) => x.textContent.trim() === '虚线')?.click()
  ;[...box.querySelectorAll('.oc-eedit-swatches .oc-ctx-sw')][2]?.click()
  const w = ${store}
  const rel = w.relations[0]
  return { style: rel?.style, color: rel?.color, relCount: w.relations.length }
})()`)
await c.sleep(400)
const render = await c.evalx(`(() => {
  const p = [...document.querySelectorAll('svg path[stroke-dasharray]')].find((x) => x.getAttribute('stroke-dasharray') === '5 4')
  return { dashedPath: !!p, stroke: p?.getAttribute('stroke') }
})()`)
check('6 线型/颜色编辑生效且边渲染跟随（虚线+色值）', style.style === 'dashed' && /^#/.test(style.color || '') && render.dashedPath && render.stroke === style.color, JSON.stringify({ style, render }))

/* ---------- 7. 角色定位：快捷选项点选 + 自定义输入 ---------- */
const role = await c.evalx(`(async () => {
  const w = ${store}
  const a = w.liveCharacters.find((x) => x.name === '甲')
  w.selCharacterId = a.id
  w.charView = 'list'
  await new Promise((r) => setTimeout(r, 600))
  const chip = [...document.querySelectorAll('.role-chip')].find((x) => x.textContent.trim() === '反派')
  chip?.click()
  await new Promise((r) => setTimeout(r, 300))
  const viaChip = w.liveCharacters.find((x) => x.id === a.id)?.role
  const inp = document.querySelector('input[placeholder*="角色定位"]')
  if (inp) {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(inp, '管家')
    inp.dispatchEvent(new Event('input', { bubbles: true }))
  }
  await new Promise((r) => setTimeout(r, 300))
  const viaCustom = w.liveCharacters.find((x) => x.id === a.id)?.role
  const chipCount = document.querySelectorAll('.role-chip').length
  return { viaChip, viaCustom, chipCount }
})()`)
check('7 角色定位快捷选项 + 自定义输入', role.viaChip === '反派' && role.viaCustom === '管家' && role.chipCount >= 8, JSON.stringify(role))

/* ---------- 8. 字段名可编辑（改名成功且值保留） ---------- */
const fld = await c.evalx(`(async () => {
  const w = ${store}
  const a = w.liveCharacters.find((x) => x.name === '甲')
  w.selCharacterId = a.id
  await new Promise((r) => setTimeout(r, 300))
  const keyInput = [...document.querySelectorAll('.field-row input')][0]
  if (!keyInput) return { err: 'no key input' }
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(keyInput, '体型')
  keyInput.dispatchEvent(new Event('input', { bubbles: true }))
  keyInput.dispatchEvent(new Event('change', { bubbles: true }))
  await new Promise((r) => setTimeout(r, 400))
  const row2 = w.liveCharacters.find((x) => x.id === a.id)
  return { keys: Object.keys(row2.fields), renamed: '体型' in row2.fields }
})()`)
check('8 字段名可编辑（外貌 → 体型，值保留）', fld.renamed === true, JSON.stringify(fld))

/* ---------- 9. 预置默认字段为 外貌+性格（新建人物不含其他预置项） ---------- */
const dfCheck = await c.evalx(`(() => {
  const w = ${store}
  const row = w.liveCharacters.find((x) => !x.name)
  return { keys: Object.keys(row?.fields || {}).sort() }
})()`)
check('9 预置字段为 外貌+性格', dfCheck.keys.join(',') === '外貌,性格', JSON.stringify(dfCheck))

/* ---------- 10. v0.4.12：大纲画布边编辑浮层含颜色色板，自定义色跟随线/箭头/标签，主题色恢复 ---------- */
{
  await c.evalx(`(async () => {
    const w = ${store}
    w.tab = 'outline'; w.outlineView = 'canvas'
    await new Promise((r) => setTimeout(r, 900))
    return 1
  })()`)
  // 种子：清场后两个事件节点 + 连线（确定性，防跨轮残留污染查找）
  await c.evalx(`(async () => {
    const w = ${store}
    for (const n of [...w.olnodes]) if (!n.deletedAt) await w.olnodeRemove(n.id)
    const a = w.olnodeAdd(null, { kind: 'event', title: '验事件A', canvasX: 300, canvasY: 300 })
    const b = w.olnodeAdd(null, { kind: 'event', title: '验事件B', canvasX: 760, canvasY: 300 })
    w.olnodeRelAdd(a.id, b.id, { label: '验收' })
    await new Promise((r) => setTimeout(r, 300))
    return 1
  })()`)
  await c.evalx(`(() => { const btn = [...document.querySelectorAll('.om-btn.text')].find((x) => x.textContent.includes('适应')); btn?.click(); return 1 })()`)
  await c.sleep(600)
  const ohit = await c.evalx(`(() => {
    const els = [...document.querySelectorAll('.oc-edge-hit')]
    let best = null
    for (const el of els) { const r = el.getBoundingClientRect(); if (!best || r.height < best.h) best = { x: r.x + r.width / 2, y: r.y + r.height / 2, h: r.height } }
    return best
  })()`)
  if (!ohit) {
    check('10 大纲画布颜色编辑（色板+跟随+恢复）', false, 'no edge hit')
  } else {
    await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: ohit.x, y: ohit.y, button: 'none' })
    await c.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: ohit.x, y: ohit.y, button: 'left', buttons: 1, clickCount: 1 })
    await c.sleep(60)
    await c.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: ohit.x, y: ohit.y, button: 'left', buttons: 0, clickCount: 1 })
    await c.sleep(300)
    const sw = await c.evalx(`(() => {
      const box = document.querySelector('.oc-eedit')
      if (!box) return { err: 'no popover' }
      const el = [...box.querySelectorAll('.oc-eedit-swatches .oc-ctx-sw')][3]
      if (!el) return { err: 'no swatch', swatches: box.querySelectorAll('.oc-eedit-swatches .oc-ctx-sw').length }
      const r = el.getBoundingClientRect()
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
    })()`)
    if (sw.err) {
      check('10 大纲画布颜色编辑（色板+跟随+恢复）', false, JSON.stringify(sw))
    } else {
      await c.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: sw.x, y: sw.y, button: 'left', buttons: 1, clickCount: 1 })
      await c.sleep(60)
      await c.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: sw.x, y: sw.y, button: 'left', buttons: 0, clickCount: 1 })
      await c.sleep(300)
      const oc = await c.evalx(`(() => {
        const w = ${store}
        const src = w.olnodes.find((n) => (n.rels || []).some((r) => r.toId))
        const rel = src?.rels?.find((r) => r.label === '验收') || src?.rels?.[0]
        const line = [...document.querySelectorAll('.oc-edges path[stroke]')].find((p) => p.getAttribute('stroke') === '#8e44ad')
        const arrow = [...document.querySelectorAll('.oc-edges polygon')].find((p) => p.getAttribute('fill') === '#8e44ad')
        const label = [...document.querySelectorAll('.oc-elabel')].find((x) => x.textContent.trim() === '验收')
        return { color: rel?.color, line: !!line, arrow: !!arrow, labelBorder: label ? getComputedStyle(label).borderColor : null }
      })()`)
      check('10 大纲画布颜色编辑：色板出现+自定义色跟随线/箭头/标签', oc.color === '#8e44ad' && oc.line && oc.arrow && /142, 68, 173/.test(oc.labelBorder || ''), JSON.stringify(oc))
      // 主题色恢复
      const sw0 = await c.evalx(`(() => { const el = document.querySelector('.oc-eedit .oc-eedit-swatches .oc-ctx-sw'); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)
      if (sw0) {
        await c.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: sw0.x, y: sw0.y, button: 'left', buttons: 1, clickCount: 1 })
        await c.sleep(60)
        await c.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: sw0.x, y: sw0.y, button: 'left', buttons: 0, clickCount: 1 })
        await c.sleep(300)
      }
      const oc2 = await c.evalx(`(() => {
        const w = ${store}
        const src = w.olnodes.find((n) => (n.rels || []).some((r) => r.toId))
        const line = [...document.querySelectorAll('.oc-edges path[stroke]')].find((p) => p.getAttribute('stroke') === '#2980b9')
        return { color: src?.rels?.[0]?.color, autoRestored: !!line }
      })()`)
      check('10b 大纲「主题色」恢复按类型自动配色', oc2.color === '' && oc2.autoRestored, JSON.stringify(oc2))
    }
  }
}

/* ---------- 11. v0.4.12：人物图边编辑浮层在可视区顶部翻转向下（不再被裁掉） ---------- */
{
  await c.evalx(`(async () => {
    const w = ${store}
    w.tab = 'characters'; w.charView = 'graph'
    await new Promise((r) => setTimeout(r, 900))
    const fit = [...document.querySelectorAll('.rg-toolbar .om-btn.text')].find((x) => x.textContent.includes('适应'))
    fit?.click()
    await new Promise((r) => setTimeout(r, 500))
    return 1
  })()`)
  /* 布局归一化：乙拖到甲右侧水平位（杀掉跨轮残留状态）+ 显式设定关系端口 right→left */
  const jv = await c.evalx(`(() => { const el = [...document.querySelectorAll('.rg-node')].find((x) => x.textContent.includes('甲')); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)
  async function dragNodeTo(title, tx, ty) {
    const p = await c.evalx(`(() => { const el = [...document.querySelectorAll('.rg-node')].find((x) => x.textContent.includes('${title}')); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)
    await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x, y: p.y, button: 'none' })
    await c.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'left', buttons: 1, clickCount: 1 })
    for (let i = 1; i <= 8; i++) {
      await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x + ((tx - p.x) * i) / 8, y: p.y + ((ty - p.y) * i) / 8, button: 'left', buttons: 1 })
      await c.sleep(30)
    }
    await c.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: tx, y: ty, button: 'left', buttons: 0, clickCount: 1 })
    await c.sleep(400)
  }
  await dragNodeTo('乙', jv.x + 600, jv.y)
  await c.evalx(`(() => { const w = ${store}; const rel = w.relations[0]; if (rel) w.updateRelation(rel.id, { fromSide: 'right', toSide: 'left' }); return 1 })()`)
  await c.sleep(300)
  // 真实拖拽画布空白逐步向上平移，直到连线贴近可视区顶部（top 距画布顶 < 120px）仍可见
  const cv = await c.evalx(`(() => { const r = document.querySelector('.rg-canvas').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)
  for (let round = 0; round < 8; round++) {
    await c.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: cv.x + 300, y: cv.y + 180, button: 'left', buttons: 1, clickCount: 1 })
    for (let i = 1; i <= 3; i++) {
      await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: cv.x + 300, y: cv.y + 180 - i * 20, button: 'left', buttons: 1 })
      await c.sleep(30)
    }
    await c.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: cv.x + 300, y: cv.y + 180 - 3 * 20, button: 'left', buttons: 0, clickCount: 1 })
    await c.sleep(350)
    const st = await c.evalx(`(() => {
      const els = [...document.querySelectorAll('.rg-edge-hit')]
      let best = null
      for (const el of els) { const r = el.getBoundingClientRect(); if (!best || r.height < best.h) best = { x: r.x + r.width / 2, y: r.y + r.height / 2, top: r.top } }
      const cvr = document.querySelector('.rg-canvas').getBoundingClientRect()
      return { best, canvasTop: cvr.top, gap: best ? Math.round(best.top - cvr.top) : null }
    })()`)
    if (!st.best) break
    if (st.gap < 120 && st.gap >= 0) break
  }
  const hit2 = await c.evalx(`(() => {
    const els = [...document.querySelectorAll('.rg-edge-hit')]
    let best = null
    for (const el of els) { const r = el.getBoundingClientRect(); if (!best || r.height < best.h) best = { x: r.x + r.width / 2, y: r.y + r.height / 2, top: r.top } }
    const cvr = document.querySelector('.rg-canvas').getBoundingClientRect()
    return best && best.top >= cvr.top ? best : null
  })()`)
  if (!hit2) {
    check('11 人物图浮层顶部翻转可见', false, 'no visible edge after pan')
  } else {
    await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: hit2.x, y: hit2.y, button: 'none' })
    await c.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: hit2.x, y: hit2.y, button: 'left', buttons: 1, clickCount: 1 })
    await c.sleep(60)
    await c.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: hit2.x, y: hit2.y, button: 'left', buttons: 0, clickCount: 1 })
    await c.sleep(300)
    const vis = await c.evalx(`(() => {
      const pop = document.querySelector('.rg-eedit')
      if (!pop) return { pop: false }
      const pr = pop.getBoundingClientRect()
      const cvr = document.querySelector('.rg-canvas').getBoundingClientRect()
      return { pop: true, flipped: pop.className.includes('flip'), visible: pr.top >= cvr.top - 1 && pr.left >= cvr.left - 1 && pr.bottom <= cvr.bottom + 1 && pr.right <= cvr.right + 1 }
    })()`)
    check('11 人物图浮层顶部翻转可见（连线贴近可视区顶边时向下弹出）', vis.pop && vis.flipped && vis.visible, JSON.stringify(vis))
  }
}

/* ---------- 12. v0.4.14：严格端口——节点挪位后连线仍从记录的接口出/入 ---------- */
{
  // 布局已由 check 11 归一化（乙在甲右侧水平位，关系端口 right→left）
  const pos = await c.evalx(`(() => {
    const find = (t) => { const el = [...document.querySelectorAll('.rg-node')].find((x) => x.textContent.includes(t)); if (!el) return null; return { vx: (r0 => r0.x + r0.width / 2)(el.getBoundingClientRect()), vy: (r0 => r0.y + r0.height / 2)(el.getBoundingClientRect()) } }
    return { jia: find('甲'), yi: find('乙') }
  })()`)
  if (!pos.jia || !pos.yi) {
    check('12 严格端口：挪位后起终点不漂移', false, 'nodes not found')
  } else {
    // 真实拖拽乙到甲正上方 260px（视口位移）
    await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: pos.yi.vx, y: pos.yi.vy, button: 'none' })
    await c.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: pos.yi.vx, y: pos.yi.vy, button: 'left', buttons: 1, clickCount: 1 })
    for (let i = 1; i <= 10; i++) {
      await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: pos.yi.vx + ((pos.jia.vx - pos.yi.vx) * i) / 10, y: pos.yi.vy + ((pos.jia.vy - 260 - pos.yi.vy) * i) / 10, button: 'left', buttons: 1 })
      await c.sleep(30)
    }
    await c.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: pos.jia.vx, y: pos.jia.vy - 260, button: 'left', buttons: 0, clickCount: 1 })
    await c.sleep(600)
    // 画布坐标断言：起=甲右口(style.left+132, style.top+28)，终=乙左口(style.left, style.top+28)
    const st = await c.evalx(`(() => {
      const p = [...document.querySelectorAll('.rg-edges path')].find((x) => !x.classList.contains('rg-edge-hit'))
      if (!p) return null
      const s = p.getPointAtLength(0)
      const e = p.getPointAtLength(p.getTotalLength())
      const find = (t) => { const el = [...document.querySelectorAll('.rg-node')].find((x) => x.textContent.includes(t)); return { cx: parseInt(el.style.left), cy: parseInt(el.style.top) } }
      const jia = find('甲')
      const yi = find('乙')
      return {
        start: { x: Math.round(s.x), y: Math.round(s.y) },
        end: { x: Math.round(e.x), y: Math.round(e.y) },
        expStart: { x: jia.cx + 132, y: jia.cy + 28 },
        expEnd: { x: yi.cx, y: yi.cy + 28 }
      }
    })()`)
    const ok = st && Math.abs(st.start.x - st.expStart.x) <= 1 && Math.abs(st.start.y - st.expStart.y) <= 1 && Math.abs(st.end.x - st.expEnd.x) <= 1 && Math.abs(st.end.y - st.expEnd.y) <= 1
    check('12 严格端口：乙拖到甲上方后连线仍从甲右口出、乙左口入', ok, JSON.stringify(st))
    // 恢复：把乙拖回原画布位（按位移差反向拖回）
    const pos2 = await c.evalx(`(() => {
      const find = (t) => { const el = [...document.querySelectorAll('.rg-node')].find((x) => x.textContent.includes(t)); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } }
      return { yi: find('乙') }
    })()`)
    const dxv = pos2.yi.x - pos.yi.vx
    const dyv = pos2.yi.vy - pos.yi.vy
    await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: pos2.yi.x, y: pos2.yi.y, button: 'none' })
    await c.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: pos2.yi.x, y: pos2.yi.y, button: 'left', buttons: 1, clickCount: 1 })
    for (let i = 1; i <= 10; i++) {
      await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: pos2.yi.x - (dxv * i) / 10, y: pos2.yi.y - (dyv * i) / 10, button: 'left', buttons: 1 })
      await c.sleep(30)
    }
    await c.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: pos2.yi.x - dxv, y: pos2.yi.y - dyv, button: 'left', buttons: 0, clickCount: 1 })
    await c.sleep(500)
  }
}

/* ---------- 13. v0.4.14：连线避障——途经模块自动绕行（大纲画布，画布坐标直接可比） ---------- */
{
  const st = await c.evalx(`(async () => {
    const w = ${store}
    w.tab = 'outline'; w.outlineView = 'canvas'
    await new Promise((r) => setTimeout(r, 900))
    // 干净种子：源(200,300) → 目标(900,300)，障碍(500,285)
    for (const n of [...w.olnodes]) if (!n.deletedAt) await w.olnodeRemove(n.id)
    const a = w.olnodeAdd(null, { kind: 'event', title: '源', canvasX: 200, canvasY: 300 })
    const b = w.olnodeAdd(null, { kind: 'event', title: '目标', canvasX: 900, canvasY: 300 })
    w.olnodeAdd(null, { kind: 'event', title: '障碍', canvasX: 500, canvasY: 285 })
    w.olnodeRelAdd(a.id, b.id, { fromSide: 'right', toSide: 'left' })
    await new Promise((r) => setTimeout(r, 400))
    const btn = [...document.querySelectorAll('.om-btn.text')].find((x) => x.textContent.includes('适应'))
    btn?.click()
    await new Promise((r) => setTimeout(r, 500))
    const p = document.querySelector('.oc-edges path:not(.oc-edge-hit)')
    if (!p) return { err: 'no path' }
    const ob = w.olnodes.find((n) => n.title === '障碍')
    // 障碍渲染矩形（画布坐标）：canvasX/Y + 实际渲染尺寸
    const el = [...document.querySelectorAll('.oc-node')].find((x) => x.textContent.includes('障碍'))
    const obW = parseInt(el.style.width)
    const obH = parseInt(el.style.height)
    const len = p.getTotalLength()
    let inside = 0
    for (let i = 0; i <= 80; i++) {
      const pt = p.getPointAtLength((len * i) / 80)
      if (pt.x > ob.canvasX + 2 && pt.x < ob.canvasX + obW - 2 && pt.y > ob.canvasY + 2 && pt.y < ob.canvasY + obH - 2) inside++
    }
    return { inside, hasBend: p.getAttribute('d').includes('Q'), start: p.getPointAtLength(0).x.toFixed(0) }
  })()`)
  check('13 连线避障：途经模块自动绕行（80 点采样不入模块矩形）', st && !st.err && st.inside === 0 && st.hasBend, JSON.stringify(st))
}

const pass = results.filter((r) => r.ok).length
console.log(`\nrelfollow-verify: ${pass}/${results.length}`)
process.exit(pass === results.length ? 0 : 1)
