/* 历史 v1 皮肤验收：v3 接入后正文/设定/人物/灵感栏宽已变化。
   当前请运行 `node tools/crimson-v3-verify.mjs`。 */
/* 赤月戏 · 工作台与各模块布局验收（照设计稿：76px 顶栏 + 86px 模块条 + 40px 底栏 + 各页栏结构）
   隔离实例：electron . --dev --profile=crimson-skin-verify --remote-debugging-port=9225 --disable-backgrounding-occluded-windows */
import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { connect } from './_cdp-lib.mjs'

const c = await connect('http://127.0.0.1:5173', '9225')
const ev = async (code, client = c) => {
  const r = await client.evalx(code)
  if (r?.PAGE_ERR) throw new Error(r.PAGE_ERR)
  return r
}
async function wait(code, client = c) {
  const end = Date.now() + 15000
  while (Date.now() < end) {
    if (await ev(code, client)) return
    await c.sleep(80)
  }
  throw new Error('Timed out: ' + code)
}
const check = (ok, msg) => { assert.ok(ok, msg); console.log('PASS ' + msg) }
async function init(client = c) {
  await wait('!!window.__ns && !!document.querySelector(".app-root")', client)
  await client.send('Emulation.setFocusEmulationEnabled', { enabled: true })
  await ev(`(async()=>{const {useUiStore}=await import('/src/stores/ui.js');const {useShelfStore}=await import('/src/stores/shelf.js');window.__k={ui:useUiStore(),shelf:useShelfStore(),work:__ns.getWork()};return true})()`, client)
}
async function shot(name, width = 1440, height = 900, client = c) {
  await client.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
  await ev('document.fonts.ready.then(()=>true)', client)
    await c.sleep(300)
  await client.send('Page.bringToFront')
  const frame = await Promise.race([
    client.send('Page.captureScreenshot', { format: 'png' }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Screenshot timeout')), 10000))
  ])
  await writeFile(new URL(`./_crimson-work-${name}.png`, import.meta.url), Buffer.from(frame.data, 'base64'))
}

let fixture = null
let prefs = null
try {
  await c.send('Page.reload', { ignoreCache: true })
  await init()
  await c.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
  await c.sleep(300)
  const loc = await ev('native.getDataLocation()')
  check(loc.defaultDir.endsWith('小说工坊-crimson-skin-verify') && loc.current === loc.defaultDir && !loc.isCustom, 'isolated crimson verification profile')
  prefs = await ev(`({skin:window.__k.ui.skin})`)

  fixture = await ev(`(async()=>{
    if(__k.work.work) await __k.work.closeWork()
    const row = await __k.shelf.createWork({title:'星尘旅人',author:'林间',genre:'科幻',status:'连载',intro:'一枚铜星的熄灭，唤醒了一张被遗忘的星图。',kind:'novel',withVolume:true})
    await __k.work.open(row.id)
    const w = __k.work
    const ch = await w.addChapter(w.volumes[0]?.id,'第一章 · 初雪')
    await w.addChapter(w.volumes[0]?.id,'第二章 · 领航员')
    w.setChapterContent(ch.id,'<p>穹顶大厅的钟声在雾中回荡了十二下。</p><p>林远把掌心贴在观测台的铜面上。</p>')
    const p = await w.addCharacter('林远'); await w.addCharacter('沈砚')
    await w.addSnippet('雾港来信：一封没有寄件人的信。')
    const root = w.mubuAdd ? await w.mubuAdd(null,null,'星图系统') : null
    if (root) await w.mubuAdd(root.id,null,'铜星：用于记录航路的古老载体')
    const co = await w.olnodeAdd(null,{kind:'container',title:'第一卷 · 星图初醒',canvasX:60,canvasY:70,w:560,h:250})
    const ev1 = await w.olnodeAdd(co.id,{kind:'event',title:'铜星熄灭',text:'一枚铜星在雾中熄灭。',canvasX:100,canvasY:150,w:220,h:120})
    await w.olnodeAdd(null,{kind:'cite',refId:'character:'+p.id,title:'林远',canvasX:680,canvasY:90,w:210,h:120})
    w.selOlnodeId = ev1.id
    const {autosave} = await import('/src/services/autosave'); await autosave.flushAll()
    await __k.ui.setSkin('crimson')
    /* 新建人物/灵感/节点会切换选中的实体，最后把章节选择恢复到第一章 */
    w.selChapterId = ch.id
    if (ch.volumeId) w.selVolumeId = ch.volumeId
    w.tab = 'chapters'
    return row.id
  })()`)
  await wait('!!document.querySelector(".crimson-topbar")')
  await c.sleep(700)
  await ev('__k.work.tab="chapters"')
  await wait('!!document.querySelector(".crimson-book")')
  await c.sleep(500)

  /* 外壳 */
  const shell = await ev(`(()=>{const b=s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return {w:Math.round(r.width),h:Math.round(r.height),t:Math.round(r.top)}};return {head:b('.crimson-topbar'),bar:b('.crimson-modulebar'),foot:b('.crimson-statusbar'),nav:document.querySelectorAll('.crimson-topnav-item').length,rail:!!document.querySelector('.nav-rail'),backdrop:!!document.querySelector('.crimson-backdrop')}})()`)
  check(shell.head?.h === 76 && shell.nav === 7, 'top bar is 76px with seven horizontal module entries')
  check(shell.rail === false && shell.backdrop, 'the side rail is replaced by the top navigation and the module backdrop is present')
  check(shell.foot?.h === 40, 'a 40px status bar closes the workbench')

  /* 正文：project-line + 双页稿本 + 章条 */
  const ed = await ev(`(()=>{const b=s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return {w:Math.round(r.width),h:Math.round(r.height),l:Math.round(r.left),t:Math.round(r.top)}};const v=document.querySelector('.crimson-work-vertical');const mb=document.querySelector('.crimson-modulebar');return {project:b('.crimson-project-line'),stage:b('.crimson-editor-stage'),column:b('.crimson-chapter-column'),book:b('.crimson-book'),page:b('.crimson-page'),margin:b('.crimson-margin'),strip:b('.crimson-chapter-strip'),tabs:document.querySelectorAll('.crimson-chapter-tab').length,vertical:v?getComputedStyle(v).writingMode:null,side:!!document.querySelector('.side-panel'),bar:!!mb&&getComputedStyle(mb).display!=='none'}})()`)
  check(ed.project?.h === 62 && ed.bar === false, 'the editor carries a 62px project line instead of the module bar')
  check(ed.stage && ed.column?.w === 158 && ed.vertical === 'vertical-rl', 'the manuscript keeps a 158px vertical title column')
  check(ed.book && ed.margin && Math.round(ed.margin.w) === 252, 'the book splits into a page and a 252px notes margin')
  check(ed.strip?.h === 76 && ed.tabs === 2, 'the bottom chapter strip is 76px and lists every chapter')
  check(ed.side === false, 'the side panel is folded into the manuscript layout')
  check(await ev(`(()=>{const a=document.querySelector('.crimson-project-actions');const p=document.querySelector('.crimson-project-line');return getComputedStyle(a).backgroundColor!=='rgba(0, 0, 0, 0)'&&Math.round(a.getBoundingClientRect().right)<=Math.round(p.getBoundingClientRect().right-30)})()`), 'the project actions sit in a dark bordered group inside the line')
  check(await ev(`(()=>{const h=document.querySelector('.crimson-page-head');const t=document.querySelector('.crimson-type-tools');const v=document.querySelector('.crimson-work-vertical');return getComputedStyle(h).textAlign==='center'&&Math.round(t.getBoundingClientRect().height)===43&&parseFloat(getComputedStyle(v).fontSize)===48&&getComputedStyle(v).writingMode==='vertical-rl'})()`), 'the page head is centered, the type tools are 43px and the left column sets the book title vertically at 48px')
  check(await ev(`(()=>{const h=document.querySelector('.crimson-margin-head');const f=document.querySelector('#crimson-margin-foot .editor-foot');return !!h&&/页边留白/.test(h.textContent)&&!!f&&Math.round(f.getBoundingClientRect().top)>Math.round(document.querySelector('.crimson-margin').getBoundingClientRect().top)})()`), 'the notes margin carries 页边留白 and the word-goal foot lives inside it')
  check(await ev(`(()=>{const b=document.querySelector('.crimson-book').getBoundingClientRect();const s=document.querySelector('.crimson-chapter-strip').getBoundingClientRect();return Math.round(b.left)===246&&Math.round(b.right)===1406&&Math.round(b.height)===604&&Math.round(s.top-b.bottom)===22&&Math.round(s.height)===76})()`), 'the book is 246–1406 at 604px with a 22px gap to the 76px chapter strip')
  await c.send('Page.bringToFront')
  await ev(`(async()=>{const {playStage}=await import('/src/services/stage-play');playStage();return true})()`)
  await c.sleep(80)
  const animState = await ev(`(()=>{const g=s=>{const e=document.querySelector(s);if(!e)return null;const cs=getComputedStyle(e);return {name:cs.animationName,dur:cs.animationDuration,delay:cs.animationDelay,ease:cs.animationTimingFunction}};return {flag:document.body.dataset.stagePlay,skin:document.body.dataset.skin,book:g('.crimson-book'),title:g('.crimson-work-vertical'),bg:g('.crimson-backdrop')}})()`)
  check(animState.flag === '1' && animState.book?.name === 'folio-reveal' && animState.book?.dur === '0.6s' && animState.book?.delay === '0.06s' && animState.title?.name === 'ink-reveal' && animState.bg?.name === 'scenery-reveal' && animState.bg?.dur === '1.2s' && /cubic-bezier/.test(animState.bg?.ease || ''), 'editor entrance: paper folio-reveal .6s/60ms, title ink-reveal, backdrop scenery 1.2s')
  await shot('chapters')

  /* 大纲：模块条接管视图切换，画布成纸 */
  await ev(`__k.work.tab='outline';__k.work.outlineView='canvas'`)
  await wait('!!document.querySelector(".oc-canvas")')
  await wait('!!document.querySelector("#crimson-bar-tools .ol-viewtoggle")')
  await c.sleep(400)
  check(await ev(`(()=>{const bar=document.querySelector('#crimson-bar-tools');const cv=document.querySelector('.oc-canvas');if(!bar||!cv)return false;const cs=getComputedStyle(cv);const head=document.querySelector('[data-module="outline"] .module-heading');return bar.querySelectorAll('.ol-viewtoggle button').length===2&&/gradient/.test(cs.backgroundImage)&&(!head||getComputedStyle(head).display==='none')})()`), 'the outline moves its view switch into the module bar and the canvas becomes a paper sheet')
  check(await ev(`(()=>{const n=document.querySelector('.oc-node.oc-event');return !!n&&/250|244|243/.test(getComputedStyle(n).backgroundColor)})()`), 'canvas nodes are paper cards')
  await shot('outline')
  await ev(`__k.work.outlineView='text'`)
  await c.sleep(700)
  check(await ev(`(()=>{const e=document.querySelector('.crimson-outline-folio');return !!e&&/gradient/.test(getComputedStyle(e).backgroundImage)})()`), 'the outline text view is a continuous folio')
  check(await ev(`(()=>{const r=document.querySelector('.crimson-outline-folio').getBoundingClientRect();return Math.round(r.left)===266&&Math.round(r.width)===1004})()`), 'the outline text folio spans the 266–1270 working column')
  await ev(`__k.work.outlineView='canvas'`)
  await wait('!!document.querySelector(".oc-canvas")')
  await c.sleep(400)
  check(await ev(`(()=>{const b=s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return {l:Math.round(r.left),r:Math.round(r.right),w:Math.round(r.width),b:Math.round(r.bottom)}};const d=b('.crimson-outline-directory');const cv=b('.oc-canvas');const ct=b('.oc-toolbar');return Math.round(d.w)===214&&d.l===32&&Math.round(cv.l)===266&&Math.round(cv.r)===1270&&!!document.querySelector('.crimson-canvas-caption')&&ct&&ct.b<=835})()`), 'outline: 214px directory at 32, canvas 266–1270 and a bottom controls bar')

  /* 设定：布景栏 + 纸面树 + 索引列 */
  await ev(`__k.work.tab='lore'`)
  await wait('!!document.querySelector(".crimson-lore-index")')
  await c.sleep(500)
  const lore = await ev(`(()=>{const b=s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return {w:Math.round(r.width),l:Math.round(r.left)}};return {art:b('.crimson-art-pane'),paper:b('.ob-editor'),index:b('.crimson-lore-index'),side:!!document.querySelector('.side-panel'),barTools:document.querySelectorAll('#crimson-bar-tools button').length}})()`)
  check(lore.art?.w === 248 && lore.index?.w === 220 && lore.side === false, 'lore lays out as 248px art pane + paper + 220px index')
  check(lore.barTools >= 1, 'lore offers its window action in the module bar')
  check(await ev(`(()=>{const b=s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return {l:Math.round(r.left),r:Math.round(r.right),w:Math.round(r.width)}};const a=b('.crimson-art-pane');const p=b('.crimson-lore-paper');const i=b('.crimson-lore-index');return a.l===32&&p.l===304&&p.r===1164&&i.l===1188&&i.r===1408&&!!document.querySelector('.crimson-lore-paper .paper-running')&&!!document.querySelector('.crimson-tree-title')})()`), 'lore: art at 32, paper 304–1164, index 1188–1408 with running head and title')
  await shot('lore')

  /* 人物：肖像卷宗列 + 档案 */
  await ev(`__k.work.tab='characters';__k.work.charView='list'`)
  await wait('!!document.querySelector(".crimson-portrait-column")')
  await c.sleep(400)
  const ch = await ev(`(()=>{const b=s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return {w:Math.round(r.width),l:Math.round(r.left)}};return {folio:b('.crimson-portrait-column'),frame:b('.crimson-portrait-frame'),cast:b('.crimson-cast'),side:!!document.querySelector('.side-panel')}})()`)
  check(ch.folio?.w === 443 && ch.frame && ch.cast && ch.side === false, 'characters lay out as a 443px portrait folio plus the dossier')
  const chGeo = await ev(`(()=>{const b=s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return {l:Math.round(r.left),r:Math.round(r.right),w:Math.round(r.width),h:Math.round(r.height)}};const f=b('.crimson-portrait-frame');const d=b('.crimson-dossier');return {frame:f,dossier:d,head:!!document.querySelector('.crimson-dossier-head'),cast:!!document.querySelector('.crimson-cast-row')}})()`)
  check(chGeo.frame?.w === 298 && chGeo.frame?.h === 414 && chGeo.dossier?.l === 508 && chGeo.dossier?.r === 1408 && chGeo.head && chGeo.cast, 'characters: 298×414 portrait at 177, dossier 508–1408 with its own header and cast row')
  await shot('characters')

  /* 关系图：图谱 + 索引列 */
  await ev(`__k.work.charView='graph'`)
  await wait('!!document.querySelector(".crimson-graph-index")')
  await c.sleep(500)
  check(await ev(`(()=>{const idx=document.querySelector('.crimson-graph-index');const cv=document.querySelector('.rg-canvas');if(!idx||!cv)return false;return Math.round(idx.getBoundingClientRect().width)===239&&/gradient/.test(getComputedStyle(cv).backgroundImage)})()`), 'the relation graph gets a 239px index column and a paper canvas')
  check(await ev(`(()=>{const b=s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return {l:Math.round(r.left),r:Math.round(r.right),w:Math.round(r.width)}};const m=b('.crimson-graph-main');const c=b('.rg-canvas');const i=b('.crimson-graph-index');const n=document.querySelector('.rg-node');return m.l===310&&m.r===1147&&c.l>=330&&c.l<=335&&i.l===1169&&i.r===1408&&n&&parseFloat(getComputedStyle(n).width)===118})()`), 'graph: scenic 310px, paper 310–1147, index 1169–1408 and 118px portrait cards')
  await ev(`__k.work.charView='list'`)

  /* 灵感：布景 + 手记墙 + 阅读纸 */
  await ev(`__k.work.tab='snippets'`)
  await wait('!!document.querySelector(".crimson-idea-wall")')
  await c.sleep(400)
  const sn = await ev(`(()=>{const b=s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return {w:Math.round(r.width)}};return {art:b('.crimson-art-pane.compact'),wall:b('.crimson-idea-wall'),cards:document.querySelectorAll('.crimson-idea-wall .side-item').length,side:!!document.querySelector('.side-panel')}})()`)
  check(sn.art?.w === 245 && sn.wall && sn.cards >= 1 && sn.side === false, 'inspiration lays out as art pane + idea wall + reader')
  check(await ev(`(()=>{const b=s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return {l:Math.round(r.left),r:Math.round(r.right),w:Math.round(r.width),h:Math.round(r.height)}};const a=b('.crimson-art-pane.compact');const w=b('.crimson-idea-wall');const r=b('.crimson-idea-reader');const st=b('.crimson-idea-strip');const card=document.querySelector('.crimson-idea-wall .side-item');return a.l===32&&w.l===300&&w.r===762&&r.l===785&&r.r===1408&&st.h===43&&card&&card.getBoundingClientRect().height>=230})()`), 'inspiration: 245/462/623 columns at 32, a 43px wall strip and 230px pinned cards')
  await shot('snippets')

  /* 最小桌面窗：逐页无横向溢出 */
  await c.send('Emulation.setDeviceMetricsOverride', { width: 1080, height: 680, deviceScaleFactor: 1, mobile: false })
  await c.sleep(300)
  for (const [tab, sel] of [['chapters', '.crimson-book'], ['outline', '.crimson-outline-layout'], ['lore', '.crimson-lore-paper'], ['characters', '.character-surface.is-crimson'], ['snippets', '.crimson-idea-reader']]) {
    await ev(`__k.work.tab=${JSON.stringify(tab)}`)
    await wait(`!!document.querySelector(${JSON.stringify(sel)})`)
    await c.sleep(250)
    check(await ev(`document.documentElement.scrollWidth<=innerWidth&&document.body.scrollWidth<=innerWidth`), `minimum window (1080×680): ${tab} has no horizontal overflow`)
  }
  await ev(`__k.work.tab='chapters';__k.work.charView='list'`)
  await c.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
  await c.sleep(350)

  /* 皮肤隔离与热切换 */
  await ev(`__k.ui.setSkin('glaze').then(()=>true)`)
  await wait(`document.body.dataset.skin==='glaze'`)
  check(await ev(`!document.querySelector('.crimson-topbar')&&!document.querySelector('.crimson-portrait-column')`), 'glaze keeps its own shell (no crimson structures)')
  await ev(`__k.ui.setSkin('crimson').then(()=>true)`)
  await wait(`document.body.dataset.skin==='crimson'`)
  check(await ev(`!!document.querySelector('.crimson-topbar')`), 'switching back restores the crimson shell')

  console.log('PASS crimson workbench suite')
} catch (error) {
  process.exitCode = 1
  console.error(error)
  console.error(await ev(`({skin:document.body?.dataset?.skin,tab:window.__k?.work?.tab,chapter:window.__k?.work?.activeChapter?.title,bar:!!document.querySelector('.crimson-modulebar'),popLock:!!document.querySelector('.pop-lock-pane'),wrap:!!document.querySelector('.editor-wrap'),center:[...(document.querySelector('.center-pane')?.children||[])].map(e=>e.className||e.tagName),empty:!!document.querySelector('.empty-shelf')})`).catch(() => '(state unavailable)'))
  await shot('failure').catch(() => {})
} finally {
  if (fixture) await ev(`(async()=>{await window.__k.work.closeWork();const row=await __ns.db.works.get(${JSON.stringify(fixture)});if(row)await window.__k.shelf.deleteWork(row);await window.__k.ui.setSkin(${JSON.stringify(prefs?.skin || 'original')});return true})()`).catch(() => {})
  await c.send('Emulation.clearDeviceMetricsOverride')
  setTimeout(() => process.exit(process.exitCode || 0), 150)
}
