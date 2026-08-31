/* 大纲重构验证（8.8 v0.4.0）：迁移 / 侧边栏 CRUD / Word 工具栏 / 导图 / 卫星 / 故事线 / 章节同步 */
import { connect } from './_cdp-lib.mjs'

const c = await connect('app://')
await c.sleep(2500)
const results = []
const check = (name, ok, detail = '') => { results.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  —— ' + String(detail).slice(0, 300) : '')) }
const NL = String.fromCharCode(10)

/* 种子：书 + 卷 + 章 + 幕布目标节点 + 旧 outlines（用于迁移） */
const seed = await c.evalx(`(async () => {
  try {
    const { db, uid, now } = window.__ns
    const old = (await db.works.toArray()).find(w => w.title === '导图验证书')
    if (old) await db.works.delete(old.id)
    const t = now()
    const workId = uid()
    await db.works.add({ id: workId, title: '导图验证书', author: '', genre: '', status: '', intro: '', createdAt: t, updatedAt: t, deletedAt: null })
    const volId = uid()
    await db.volumes.add({ id: volId, workId, title: '第一卷', sortOrder: 0, createdAt: t, updatedAt: t, deletedAt: null })
    const chId = uid()
    await db.chapters.add({ id: chId, workId, volumeId: volId, title: '第一章 · 启程', content: '<p>启程。</p>', wordCount: 3, status: 'draft', sortOrder: 0, createdAt: t, updatedAt: t, deletedAt: null })
    await db.mubu.add({ id: uid(), workId, parentId: null, sortOrder: 0, text: '雾都钟楼', html: null, fold: false, deletedAt: null, createdAt: t, updatedAt: t })
    await db.outlines.add({ id: uid(), workId, level: 'master', refId: workId, content: '主线：寻找黎明之城。', createdAt: t, updatedAt: t, deletedAt: null })
    await db.outlines.add({ id: uid(), workId, level: 'volume', refId: volId, content: '卷一：北渡。', createdAt: t, updatedAt: t, deletedAt: null })
    const outlineText = '- [ ] 目标：进入雾都' + ${JSON.stringify(NL)} + '伏笔线索：[[雾都钟楼]]'
    await db.outlines.add({ id: uid(), workId, level: 'chapter', refId: chId, content: outlineText, createdAt: t, updatedAt: t, deletedAt: null })
    return { ok: true, workId, chId }
  } catch (e) { return { ok: false, err: String(e).slice(0, 150) } }
})()`)
console.log('seed:', JSON.stringify(seed))
if (!seed.ok) process.exit(1)
await c.evalx(`location.reload()`)
await c.sleep(3000)

/* 1) 迁移：打开书 → olnodes 生成 */
await c.evalx(`[...document.querySelectorAll('.book-card')].find(x => x.textContent.includes('导图验证书'))?.click()`)
await c.sleep(1600)
const m1 = await c.evalx(`(() => {
  const app = document.querySelector('#app').__vue_app__
  const work = app.config.globalProperties.$pinia._s.get('work')
  const kinds = work.liveOlnodes().map(n => n.kind)
  const chNode = work.olnodeByRef(${JSON.stringify(seed.chId)})
  return { roots: work.olnodeChildren(null).map(n => n.title), kinds: kinds.join(','), chText: chNode?.text?.includes('雾都钟楼'), chTitle: chNode?.title }
})()`)
check('迁移生成节点树（固定四组+卷+章+文本迁移）', m1.kinds.includes('master') && m1.kinds.includes('volume') && m1.kinds.includes('chapter') && m1.chText && m1.chTitle === '第一章 · 启程', JSON.stringify(m1))

/* 2) 大纲模块：侧边栏渲染 + 选中章节点 */
await c.evalx(`(() => { const app = document.querySelector('#app').__vue_app__; app.config.globalProperties.$pinia._s.get('work').tab = 'outline'; return 1 })()`)
await c.sleep(800)
const m2 = await c.evalx(`(() => ({ items: document.querySelectorAll('.side-list .side-item').length, sel: !!document.querySelector('.side-item.active') }))()`)
check('侧边栏树渲染', m2.items >= 6, JSON.stringify(m2))

/* 3) 自定义增：给章节点加子条目 + 重命名 + 删除 */
await c.evalx(`(() => {
  const app = document.querySelector('#app').__vue_app__
  const work = app.config.globalProperties.$pinia._s.get('work')
  work.selOlnodeId = work.olnodeByRef(${JSON.stringify(seed.chId)}).id
  return 1
})()`)
await c.sleep(400)
await c.evalx(`window.confirm = () => true; (() => {
  const items = [...document.querySelectorAll('.side-list .side-item')]
  const it = items.find(x => x.textContent.includes('第一章 · 启程'))
  it.querySelector('.ol-op[title="添加子条目"]')?.click()
  return 1
})()`)
await c.sleep(500)
const m3a = await c.evalx(`(() => { const app = document.querySelector('#app').__vue_app__; const work = app.config.globalProperties.$pinia._s.get('work'); const n = work.olnodes[work.olnodes.length - 1]; return { created: n?.kind === 'note', selected: work.selOlnodeId === n?.id } })()`)
check('自定义子条目添加并选中', m3a.created && m3a.selected, JSON.stringify(m3a))
await c.evalx(`(() => {
  const inp = document.querySelector('.ol-title-input')
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(inp, '伏笔铺垫')
  inp.dispatchEvent(new Event('change'))
  return 1
})()`)
await c.sleep(400)
const m3b = await c.evalx(`(() => { const app = document.querySelector('#app').__vue_app__; const work = app.config.globalProperties.$pinia._s.get('work'); const n = work.olnodes[work.olnodes.length - 1]; return { renamed: n.title === '伏笔铺垫' } })()`)
check('条目标题编辑', m3b.renamed, JSON.stringify(m3b))
await c.evalx(`(() => {
  const items = [...document.querySelectorAll('.side-list .side-item')]
  const it = items.find(x => x.textContent.includes('伏笔铺垫'))
  it.querySelector('.ol-op-danger')?.click()
  return 1
})()`)
await c.sleep(500)
const m3c = await c.evalx(`(() => { const app = document.querySelector('#app').__vue_app__; const work = app.config.globalProperties.$pinia._s.get('work'); return { gone: !work.liveOlnodes().some(n => n.title === '伏笔铺垫') } })()`)
check('自定义条目删除', m3c.gone, JSON.stringify(m3c))

/* 4) Word 式工具栏：选中编辑器文字 → 加粗 → html 落库 */
await c.evalx(`(() => {
  const app = document.querySelector('#app').__vue_app__
  const work = app.config.globalProperties.$pinia._s.get('work')
  work.selOlnodeId = work.olnodeByRef(${JSON.stringify(seed.chId)}).id
  return 1
})()`)
await c.sleep(500)
await c.evalx(`(() => {
  const el = document.querySelector('.ol-editor')
  el.focus()
  const tn = el.firstChild
  const r = document.createRange()
  r.setStart(tn, 0); r.setEnd(tn, Math.min(6, tn.textContent.length))
  const s = window.getSelection(); s.removeAllRanges(); s.addRange(r)
  return 1
})()`)
await c.evalx(`(() => { const b = [...document.querySelectorAll('.ol-toolbar .ol-tb')].find(x => x.title === '加粗'); b?.click(); return 1 })()`)
await c.sleep(500)
const m4 = await c.evalx(`(async () => {
  await window.__flushNow()
  const app = document.querySelector('#app').__vue_app__
  const work = app.config.globalProperties.$pinia._s.get('work')
  const n = work.olnodeByRef(${JSON.stringify(seed.chId)})
  return { boldHtml: (n.html || '').includes('<b>') || (n.html || '').includes('<strong>') }
})()`)
check('Word 工具栏加粗并落库（text+html）', m4.boldHtml, JSON.stringify(m4))

/* 5) 导图视图：节点 + 卫星 + 点击跳转 */
await c.evalx(`(() => { [...document.querySelectorAll('.ol-viewtoggle button')].find(b => b.textContent.includes('导图'))?.click(); return 1 })()`)
await c.sleep(800)
const m5 = await c.evalx(`(() => ({
  nodes: document.querySelectorAll('.om-node').length,
  sats: [...document.querySelectorAll('.om-sat')].map(x => x.textContent.trim().slice(0, 16)),
  edges: document.querySelectorAll('.om-edges path').length
}))()`)
check('导图渲染节点与连线', m5.nodes >= 6 && m5.edges >= 3, JSON.stringify(m5))
check('双链卫星节点（雾都钟楼）', m5.sats.some(x => x.includes('雾都钟楼')), JSON.stringify(m5.sats))
await c.evalx(`(() => { document.querySelector('.om-sat')?.click(); return 1 })()`)
await c.sleep(900)
const m6 = await c.evalx(`(() => { const app = document.querySelector('#app').__vue_app__; const work = app.config.globalProperties.$pinia._s.get('work'); return { tab: work.tab, flash: !!document.querySelector('.ob-flash') } })()`)
check('卫星节点点击跳转设定', m6.tab === 'lore', JSON.stringify(m6))

/* 6) 双击章节点跳正文 */
await c.evalx(`(() => { const app = document.querySelector('#app').__vue_app__; app.config.globalProperties.$pinia._s.get('work').tab = 'outline'; return 1 })()`)
await c.sleep(700)
await c.evalx(`(() => { const app = document.querySelector('#app').__vue_app__; app.config.globalProperties.$pinia._s.get('work').outlineView = 'map'; return 1 })()`)
await c.sleep(600)
await c.evalx(`(() => { const n = [...document.querySelectorAll('.om-node.om-chapter')][0]; const ev = new MouseEvent('dblclick', { bubbles: true }); n?.dispatchEvent(ev); return 1 })()`)
await c.sleep(900)
const m7 = await c.evalx(`(() => { const app = document.querySelector('#app').__vue_app__; const work = app.config.globalProperties.$pinia._s.get('work'); return { tab: work.tab, ch: work.activeChapter?.title } })()`)
check('双击章节点跳正文', m7.tab === 'chapters' && m7.ch === '第一章 · 启程', JSON.stringify(m7))

/* 7) 故事线：新增线 → 导图聚焦 */
await c.evalx(`(() => { const app = document.querySelector('#app').__vue_app__; app.config.globalProperties.$pinia._s.get('work').tab = 'outline'; return 1 })()`)
await c.sleep(600)
await c.evalx(`(() => { [...document.querySelectorAll('.ol-side-foot button')].find(b => b.textContent.includes('故事线'))?.click(); return 1 })()`)
await c.sleep(500)
await c.evalx(`(() => {
  const inp = document.querySelector('.ol-title-input')
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(inp, '暗线：钟楼之谜')
  inp.dispatchEvent(new Event('change'))
  return 1
})()`)
await c.sleep(400)
await c.evalx(`(() => { const app = document.querySelector('#app').__vue_app__; app.config.globalProperties.$pinia._s.get('work').outlineView = 'map'; return 1 })()`)
await c.sleep(600)
const m8 = await c.evalx(`(() => ({ chips: [...document.querySelectorAll('.om-chip')].map(x => x.textContent.trim()), lineNodes: document.querySelectorAll('.om-node.om-line').length }))()`)
check('故事线创建与导图着色', m8.chips.some(x => x.includes('暗线')) && m8.lineNodes >= 1, JSON.stringify(m8))
await c.evalx(`(() => { [...document.querySelectorAll('.om-chip')].find(x => x.textContent.includes('暗线'))?.click(); return 1 })()`)
await c.sleep(700)
const m9 = await c.evalx(`(() => {
  const labels = [...document.querySelectorAll('.om-node')].map(x => x.textContent.trim().slice(0, 10))
  return { onlyLineBranch: labels.length <= 4, hasLine: labels.some(x => x.includes('暗线')) }
})()`)
check('脉络聚焦（仅显示该故事线分支）', m9.onlyLineBranch && m9.hasLine, JSON.stringify(m9))

/* 8) 章节同步：新增章 → 章节点出现；删章 → 节点移除 */
const sync = await c.evalx(`(async () => {
  const app = document.querySelector('#app').__vue_app__
  const work = app.config.globalProperties.$pinia._s.get('work')
  const before = work.olnodeChildren(work.olnodeByKind('chapters').id).length
  const ch = await work.addChapter(work.selVolumeId, '第二章 · 夜行')
  const afterAdd = work.olnodeChildren(work.olnodeByKind('chapters').id).length
  const node = work.olnodeByRef(ch.id)
  await work.deleteChapter(ch.id)
  const afterDel = work.olnodeChildren(work.olnodeByKind('chapters').id).length
  return { before, afterAdd, nodeCreated: !!node, afterDel }
})()`)
check('章节增删与章纲节点同步', sync.afterAdd === sync.before + 1 && sync.nodeCreated && sync.afterDel === sync.before, JSON.stringify(sync))

const fail = results.filter(x => !x).length
console.log('==== ' + (results.length - fail) + '/' + results.length + ' 通过 ====')
process.exit(fail ? 1 : 0)
