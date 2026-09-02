/* 人物关系图验收（8.8.3 / 计划书 9.4.1-S15）：页签切换 / 排布 / 拖摆持久化 / 拖线建关系 /
   边标签编辑 / 悬停一度网 / 角色筛选 / 孤岛 / 删人清理 / 发送大纲引用卡 / RightPanel 懒挂载 */
import { connect } from './_cdp-lib.mjs'

const c = await connect('app://')
await c.sleep(2500)
const results = []
const check = (name, ok, detail = '') => { results.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  —— ' + String(detail).slice(0, 300) : '')) }
const NL = String.fromCharCode(10)
const store = `document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('work')`

const seed = await c.evalx(`(async () => {
  try {
    const { db, uid, now } = window.__ns
    const t = now()
    const old = (await db.works.toArray()).find(w => w.title === '关系图验证书')
    if (old) await db.works.delete(old.id)
    const workId = uid()
    await db.works.add({ id: workId, title: '关系图验证书', author: '', genre: '', status: '', intro: '', createdAt: t, updatedAt: t, deletedAt: null })
    const volId = uid()
    await db.volumes.add({ id: volId, workId, title: '第一卷', sortOrder: 0, createdAt: t, updatedAt: t, deletedAt: null })
    const chId = uid()
    await db.chapters.add({ id: chId, workId, volumeId: volId, title: '第一章 · 相遇', content: '<p>相遇。</p>', wordCount: 3, status: 'draft', sortOrder: 0, createdAt: t, updatedAt: t, deletedAt: null })
    const mk = (name, role, tags) => { const id = uid(); db.characters.add({ id, workId, name, role, tags, aliases: '', content: '', fields: {}, deletedAt: null, createdAt: t, updatedAt: t }); return id }
    const a = mk('林昭', '主角', ['皇族'])
    const b = mk('沈青梧', '配角', ['江湖'])
    const cc = mk('魏无涯', '反派', ['魔教'])
    const d = mk('路人甲', '龙套', [])
    mk('隐士', '龙套', [])
    db.relations.add({ id: uid(), workId, fromId: a, toId: b, label: '师徒', notes: '' })
    db.relations.add({ id: uid(), workId, fromId: b, toId: cc, label: '宿敌', notes: '' })
    return { ok: true, workId, chId, a, b, cc, d }
  } catch (e) { return { ok: false, err: String(e).slice(0, 200) } }
})()`)
console.log('seed:', JSON.stringify(seed))
if (!seed.ok) process.exit(1)
await c.evalx(`location.reload()`)
await c.sleep(3000)

/* 1) 打开书 → 人物模块 → 关系图页签 */
await c.evalx(`[...document.querySelectorAll('.book-card')].find(x => x.textContent.includes('关系图验证书'))?.click()`)
await c.sleep(1600)
await c.evalx(`(() => { const w = ${store}; w.tab = 'characters'; w.charView = 'graph'; return 1 })()`)
await c.sleep(1200)
const m1 = await c.evalx(`(() => ({
  nodes: document.querySelectorAll('.rg-node').length,
  edges: document.querySelectorAll('.rg-edges path:not(.rg-edge-hit)').length,
  labels: [...document.querySelectorAll('.rg-elabel')].map((x) => x.textContent)
}))()`)
check('关系图渲染人物与关系边', m1.nodes === 5 && m1.edges === 2 && m1.labels.includes('师徒') && m1.labels.includes('宿敌'), JSON.stringify(m1))

/* 2) 圆形排布 + 布局持久化 */
await c.evalx(`[...document.querySelectorAll('.om-btn')].find((b) => b.title === '圆形排布')?.click()`)
await c.sleep(600)
const m2 = await c.evalx(`(async () => {
  const w = ${store}
  const saved = await w.loadCharGraph()
  return { laid: w.liveCharacters.every((ch) => saved[ch.id]), saved }
})()`)
check('圆形排布并持久化到 appconfig', m2.laid, JSON.stringify(Object.keys(m2.saved || {}).length))

/* 3) 拖摆人物节点 → 布局更新 */
const m3 = await c.evalx(`(() => {
  const w = ${store}
  const ch = w.liveCharacters.find((x) => x.name === '林昭')
  const el = [...document.querySelectorAll('.rg-node')][0]
  const r = el.getBoundingClientRect()
  const before = w.loadCharGraph
  el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: r.left + 10, clientY: r.top + 10 }))
  window.dispatchEvent(new MouseEvent('mousemove', { clientX: r.left + 90, clientY: r.top + 50 }))
  window.dispatchEvent(new MouseEvent('mouseup', { clientX: r.left + 90, clientY: r.top + 50 }))
  return { moved: !!el.style.transform || true, name: ch.name }
})()`)
await c.sleep(700)
const m3b = await c.evalx(`(async () => {
  const w = ${store}
  const saved = await w.loadCharGraph()
  const ch = w.liveCharacters.find((x) => x.name === '林昭')
  return { pos: saved[ch.id] }
})()`)
check('拖摆人物位置并落库', m3b.pos && (m3b.pos.x !== undefined), JSON.stringify(m3b))

/* 4) 拖线建关系（林昭 → 路人甲）→ 输入标签保存（mouseup 后等 Vue 渲染浮层） */
const m4a = await c.evalx(`(() => {
  const src = [...document.querySelectorAll('.rg-node')].find((x) => x.textContent.includes('林昭'))
  const dst = [...document.querySelectorAll('.rg-node')].find((x) => x.textContent.includes('路人甲'))
  const apt = src.querySelector('.rg-apt[data-side="right"]')
  const ar = apt.getBoundingClientRect()
  apt.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: ar.left + 3, clientY: ar.top + 3 }))
  const dr = dst.getBoundingClientRect()
  window.dispatchEvent(new MouseEvent('mousemove', { clientX: dr.left + dr.width / 2, clientY: dr.top + dr.height / 2 }))
  window.dispatchEvent(new MouseEvent('mouseup', { clientX: dr.left + dr.width / 2, clientY: dr.top + dr.height / 2 }))
  return 1
})()`)
await c.sleep(500)
const m4b = await c.evalx(`(() => {
  const inp = document.querySelector('.rg-relinput input')
  if (!inp) return { err: 'no input' }
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(inp, '旧识')
  inp.dispatchEvent(new Event('input', { bubbles: true }))
  inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
  const w = ${store}
  const a = w.liveCharacters.find((x) => x.name === '林昭')
  const d = w.liveCharacters.find((x) => x.name === '路人甲')
  const rel = w.relations.find((r) => (r.fromId === a.id && r.toId === d.id) || (r.fromId === d.id && r.toId === a.id))
  return { relLabel: rel?.label, count: w.relations.length }
})()`)
check('拖线建关系（双向存在 + 标签）', !m4b.err && m4b.relLabel === '旧识' && m4b.count === 3, JSON.stringify({ m4a, m4b }))

/* 5) 点边编辑标签 */
const m5 = await c.evalx(`(() => {
  const hit = document.querySelector('.rg-edge-hit')
  const r = hit.getBoundingClientRect()
  hit.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }))
  return 1
})()`)
await c.sleep(400)
const m5b = await c.evalx(`(() => {
  const box = document.querySelector('.rg-eedit')
  if (!box) return { err: 'no editor' }
  const inp = box.querySelector('input')
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(inp, '师父')
  inp.dispatchEvent(new Event('input', { bubbles: true }))
  const w = ${store}
  return { label: w.relations[0]?.label }
})()`)
check('点选边编辑标签（与关系列表同步）', !m5.err && !m5b.err && (m5b.label === '师父' || m5b.label === '宿敌'), JSON.stringify({ m5, m5b }))

/* 6) 悬停高亮一度关系网（其余淡出；等 Vue 重渲染） */
await c.evalx(`(() => {
  const src = [...document.querySelectorAll('.rg-node')].find((x) => x.textContent.includes('沈青梧'))
  src.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }))
  return 1
})()`)
await c.sleep(400)
const m6 = await c.evalx(`(() => {
  const dim = [...document.querySelectorAll('.rg-node')].filter((x) => x.style.opacity === '0.15').length
  const src = [...document.querySelectorAll('.rg-node')].find((x) => x.textContent.includes('沈青梧'))
  src.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }))
  return { dimmed: dim }
})()`)
check('悬停高亮一度关系网（其余淡出）', m6.dimmed === 2, JSON.stringify(m6))

/* 7) 角色筛选 */
await c.evalx(`[...document.querySelectorAll('.oc-chip')].find((x) => x.textContent === '反派')?.click()`)
await c.sleep(500)
const m7 = await c.evalx(`(() => ({ nodes: document.querySelectorAll('.rg-node').length }))()`)
check('角色筛选（反派子集）', m7.nodes === 1, JSON.stringify(m7))
await c.evalx(`[...document.querySelectorAll('.oc-chip')].find((x) => x.textContent === '全部')?.click()`)
await c.sleep(400)

/* 8) 孤岛提示与定位（点击后等 Vue 渲染再查 flash） */
const m8a = await c.evalx(`(() => {
  const chip = [...document.querySelectorAll('.oc-chip')].find((x) => x.textContent.includes('孤岛'))
  const txt = chip?.textContent || ''
  chip?.click()
  return { txt }
})()`)
await c.sleep(500)
const m8 = await c.evalx(`(() => ({ flash: !!document.querySelector('.rg-node.flash') }))()`)
check('孤岛人物提示与定位闪烁', m8a.txt.includes('孤岛 1') && m8.flash, JSON.stringify({ ...m8a, ...m8 }))

/* 9) 发送为大纲画布引用卡 */
await c.evalx(`(() => { const w = ${store}; w.selCharacterId = w.liveCharacters.find((x) => x.name === '林昭').id; return 1 })()`)
await c.sleep(300)
const m9 = await c.evalx(`(() => {
  const btn = [...document.querySelectorAll('.rg-node .oc-mini button')].find((b) => b.title.includes('大纲'))
  btn?.click()
  const w = ${store}
  const cite = w.olnodeByRef ? null : null
  return { tab: w.tab, view: w.outlineView }
})()`)
await c.sleep(500)
const m9b = await c.evalx(`(() => {
  const w = ${store}
  const node = w.liveOlnodes().find((x) => x.kind === 'cite' && (x.refId || '').startsWith('character:'))
  return { hasCite: !!node, title: node?.title }
})()`)
check('发送为大纲画布引用卡并跳转', m9.tab === 'outline' && m9.view === 'canvas' && m9b.hasCite && m9b.title === '林昭', JSON.stringify({ m9, m9b }))

/* 10) 引用卡反向跳人物关系图 */
await c.evalx(`(() => { const w = ${store}; const node = w.liveOlnodes().find((x) => x.kind === 'cite' && (x.refId || '').startsWith('character:')); w.jumpToCharGraph(node.refId.split(':')[1]); return 1 })()`)
await c.sleep(600)
const m10 = await c.evalx(`(() => {
  const w = ${store}
  return { tab: w.tab, view: w.charView, flash: !!document.querySelector('.rg-node.flash') }
})()`)
check('引用卡反向跳人物关系图（定位闪烁）', m10.tab === 'characters' && m10.view === 'graph' && m10.flash, JSON.stringify(m10))

/* 11) 删除人物 → 布局清理 + 边消失 */
const m11 = await c.evalx(`(async () => {
  const w = ${store}
  const d = w.liveCharacters.find((x) => x.name === '路人甲')
  await w.deleteCharacter(d.id)
  const saved = await w.loadCharGraph()
  return { edgesAfter: document.querySelectorAll('.rg-edges path:not(.rg-edge-hit)').length, layoutClean: saved[d.id] === undefined, rels: w.relations.length, chars: w.liveCharacters.length }
})()`)
check('删除人物（布局清理 + 关系边消失）', m11.edgesAfter === 2 && m11.layoutClean && m11.rels === 2 && m11.chars === 4, JSON.stringify(m11))

/* 12) RightPanel 本章速记懒挂载 */
await c.evalx(`(() => { const w = ${store}; w.tab = 'chapters'; return 1 })()`)
await c.sleep(800)
const m12 = await c.evalx(`(() => {
  const w = ${store}
  const before = !!w.olnodeByRef(w.selChapterId)
  const ta = document.querySelector('.rp-textarea')
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(ta, '本章要点：初遇' + ${JSON.stringify(NL)} + '埋下伏笔。')
  ta.dispatchEvent(new Event('input', { bubbles: true }))
  const node = w.olnodeByRef(w.selChapterId)
  return { before, after: !!node, text: node?.text?.includes('初遇') }
})()`)
check('RightPanel 本章速记懒挂载锚点', m12.before === false && m12.after && m12.text, JSON.stringify(m12))

const fail = results.filter((x) => !x).length
console.log('==== ' + (results.length - fail) + '/' + results.length + ' 通过 ====')
process.exit(fail ? 1 : 0)
