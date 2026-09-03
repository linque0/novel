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

const pass = results.filter((r) => r.ok).length
console.log(`\nrelfollow-verify: ${pass}/${results.length}`)
process.exit(pass === results.length ? 0 : 1)
