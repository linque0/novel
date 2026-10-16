/* 大纲页设计稿对齐验收（引力书舱）：侧栏标题计数与类型管理、筛选行的皮肤取舍、
   按钮形状（6px 矩形替下药丸）、模块行排布、卡片排版（顶部类型行 / 宋体标题 / 便签与文本框形态）
   与放大档位；每条引力断言都配一条原版对照，确认改动不外溢。
   仅使用隔离的 gravity-skin-verify Electron 配置（5173 + 9223），不触碰日常用户数据。 */
import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { connect } from './_cdp-lib.mjs'

const c = await connect('http://127.0.0.1:5173', '9223')
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
const check = (ok, message) => {
  assert.ok(ok, message)
  console.log('PASS ' + message)
}
async function shot(name, width = 1440, height = 900) {
  await c.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
  await ev('document.fonts.ready.then(()=>true)')
  await c.sleep(200)
  await c.send('Page.bringToFront')
  const frame = await Promise.race([
    c.send('Page.captureScreenshot', { format: 'png' }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Screenshot timeout')), 10000))
  ])
  await writeFile(new URL(`./_gravity-outline-${name}.png`, import.meta.url), Buffer.from(frame.data, 'base64'))
}
async function init() {
  await wait('!!window.__ns && !!document.querySelector(".app-root")')
  await c.send('Emulation.setFocusEmulationEnabled', { enabled: true })
  await ev(`(async()=>{const {useUiStore}=await import('/src/stores/ui.js');const {useShelfStore}=await import('/src/stores/shelf.js');window.__g={ui:useUiStore(),shelf:useShelfStore(),work:__ns.getWork()};return true})()`)
}

let prefs, id
try {
  await c.send('Page.reload', { ignoreCache: true })
  await init()
  const loc = await ev('native.getDataLocation()')
  check(loc.defaultDir.endsWith('小说工坊-gravity-skin-verify') && loc.current === loc.defaultDir && !loc.isCustom, 'isolated data profile')
  prefs = await ev('__ns.db.appconfig.toArray()')
  id = await ev(`(async()=>{
    if(__g.work.work)await __g.work.closeWork();
    const row=await __g.shelf.createWork({title:'星尘旅人',author:'林间',genre:'科幻',status:'连载',kind:'novel',intro:'一枚铜星，唤醒了一张遗忘的星图。',withVolume:true});
    await __g.ui.setSkin('gravity');await __g.work.open(row.id);
    const w=__g.work;
    const ch=await w.addChapter(w.volumes[0]?.id,'第一章 · 初雪');
    const person=w.addCharacter('林远');
    w.tab='outline';w.outlineView='canvas';w.selOlnodeId=null;
    const co=w.olnodeAdd(null,{kind:'container',title:'第一卷 · 星图',canvasX:60,canvasY:60});
    w.olnodeAdd(co.id,{kind:'event',title:'铜星熄灭',text:'一枚铜星在雾中熄灭，旧航线失去坐标。'});
    w.olnodeAdd(co.id,{kind:'note',title:'保留第十二声钟响',text:'只让读者听见异常，暂不解释原因。'});
    w.olnodeAdd(null,{kind:'textbox',title:'',text:'一张会改变的星图\\n所有航线，终将交会。',canvasX:620,canvasY:60});
    w.olnodeAdd(null,{kind:'cite',refId:'character:'+person.id,title:'林远',canvasX:620,canvasY:300});
    const a=w.olnodeAdd(null,{kind:'anchor',refId:ch.id,title:'',canvasX:880,canvasY:60});
    const e2=w.olnodeAdd(null,{kind:'event',title:'钟楼中的星图',text:'沈砚带他来到钟楼，找到缺失的航线。',canvasX:880,canvasY:330});
    w.olnodeRelAdd(e2.id,a.id,{kind:'伏笔',label:'伏笔'});
    w.selOlnodeId=null;
    return row.id;
  })()`)
  await wait('!!document.querySelector(".oc-canvas") && !!document.querySelector(".side-item")')

  /* 1) 侧栏标题行：计数徽标 + 类型管理齿轮 */
  check(
    await ev(`(()=>{const h=document.querySelector('.gravity-sidebar-title'),n=document.querySelector('.gravity-side-count'),g=document.querySelector('.gravity-side-gear');return !!h&&h.textContent.trim()==='模块条目'&&!!n&&/^\\d+ 项$/.test(n.textContent.trim())&&!!g})()`),
    'outline sidebar title carries a count badge and the type-manager gear'
  )
  check(
    await ev(`document.querySelector('.gravity-side-count').textContent.trim()===''+__g.work.liveOlnodes().length+' 项' && __g.work.liveOlnodes().length===7`),
    'count badge equals the live module total'
  )
  check(
    await ev(`document.querySelectorAll('.side-item').length===7 && !document.querySelector('.ol-typefilter')`),
    'gravity drops the type-filter chip row and lists every module'
  )
  check(
    await ev(`(()=>{const h=document.querySelector('.gravity-side-hint'),f=document.querySelector('.ol-side-foot .om-chip'),r=getComputedStyle(f);return h&&h.textContent.trim()==='点击条目定位画布'&&/断线 \\d+/.test(f.textContent.trim())&&parseFloat(r.borderTopLeftRadius)<12})()`),
    'sidebar foot keeps the broken-link toggle as a rectangular tool and moves the count into the title'
  )

  /* 2) 类型管理：仍能从标题行齿轮新建与删除自定义类型 */
  await ev(`document.querySelector('.gravity-side-gear').click()`)
  await wait(`!!document.querySelector('.gravity-type-manage')`)
  check(await ev(`getComputedStyle(document.querySelector('.gravity-type-manage')).position==='absolute'`), 'type manager opens as an overlay instead of taking catalog space')
  await ev(`(()=>{const i=document.querySelector('.gravity-type-manage input.rp-input');i.value='验收类型';i.dispatchEvent(new Event('input'));return true})()`)
  await ev(`[...document.querySelectorAll('.gravity-type-manage .ol-op')].filter(b=>!b.classList.contains('ol-op-danger')).pop().click()`)
  await wait(`__g.work.olTypes.some(t=>t.name==='验收类型')`)
  check(await ev(`__g.work.olTypes.some(t=>t.name==='验收类型')`), 'custom types can still be created from the title row')
  await ev(`[...document.querySelectorAll('.gravity-type-manage .ol-op-danger')].pop().click()`)
  await wait(`!__g.work.olTypes.some(t=>t.name==='验收类型')`)
  check(await ev(`!__g.work.olTypes.some(t=>t.name==='验收类型')`), 'custom types can still be removed from the title row')
  await ev(`document.querySelector('.gravity-side-gear').click()`)
  await wait(`!document.querySelector('.gravity-type-manage')`)

  /* 3) 新建按钮与模块行排布 */
  check(
    await ev(`(()=>{const b=[...document.querySelectorAll('.ol-side-add .btn-ghost')];const cs=getComputedStyle(b[0]);const grid=getComputedStyle(document.querySelector('.ol-side-add'));return b.length===5&&b[0].textContent.trim()==='＋ 事件'&&b[4].textContent.trim()==='＋ 容器'&&parseFloat(cs.borderTopLeftRadius)<12&&cs.borderTopColor==='rgb(48, 66, 78)'&&grid.gap==='7px'&&grid.gridTemplateColumns.split(' ').length===2})()`),
    'add grid keeps two columns of rectangular 6px buttons with the design labels'
  )
  check(
    await ev(`(()=>{const r=document.querySelector('.side-item:not([data-kind="container"])'),dot=r.querySelector('.ol-type-icon'),b=dot.getBoundingClientRect();return r.getBoundingClientRect().height>=49&&getComputedStyle(r).borderBottomStyle==='solid'&&Math.round(b.width)===7&&Math.round(b.height)===7&&getComputedStyle(dot).borderTopLeftRadius==='50%'})()`),
    'catalog rows use the 49px hairline row with the copper dot marker'
  )
  check(
    await ev(`(()=>{const m=document.querySelector('.side-item[data-kind="container"] .ol-type-icon'),b=m.getBoundingClientRect(),cs=getComputedStyle(m);return Math.round(b.width)===10&&Math.round(b.height)===9&&parseFloat(cs.borderTopWidth)<=1.5&&cs.backgroundColor==='rgba(0, 0, 0, 0)'})()`),
    'container rows use the outlined square marker'
  )
  check(
    await ev(`(()=>{const op=document.querySelector('.side-item .ol-op'),row=document.querySelector('.side-item');return getComputedStyle(op).borderTopWidth==='0px'&&getComputedStyle(op).backgroundColor==='rgba(0, 0, 0, 0)'&&getComputedStyle(row).fontSize==='14px'})()`),
    'row actions are borderless secondary and the row text follows the catalog scale'
  )
  check(
    await ev(`(()=>{const ops=document.querySelector('.side-item .ol-ops'),name=document.querySelector('.side-item:not([data-kind="container"]) .gv-row-kind');return getComputedStyle(ops).position==='absolute'&&!!name})()`),
    'row actions overlay the row instead of squeezing the module name'
  )
  check(
    await ev(`(()=>{const k=[...document.querySelectorAll('.side-item .gv-row-kind')];const words=k.map(n=>n.textContent.trim());return k.length===document.querySelectorAll('.side-item').length&&k.every(n=>parseFloat(getComputedStyle(n).fontSize)===13)&&['事件','便签','引用卡','章节锚点'].every(x=>words.includes(x))})()`),
    'every catalog row shows its module type in the design wording'
  )

  /* 4) 工具条按钮形状 */
  check(
    await ev(`(()=>{const s=document.querySelector('.oc-toolbar .oc-chip'),b=document.querySelector('.oc-toolbar .om-btn');return parseFloat(getComputedStyle(s).borderTopLeftRadius)<12&&parseFloat(getComputedStyle(s).fontSize)===13&&parseFloat(getComputedStyle(b).borderTopLeftRadius)<12&&parseFloat(getComputedStyle(b).fontSize)===13})()`),
    'canvas toolbar uses rectangular chips and buttons at 13px'
  )
  check(
    await ev(`(()=>{const c2=document.querySelector('.oc-count'),z=document.querySelector('.oc-zoom');return parseFloat(getComputedStyle(c2).fontSize)===13&&parseFloat(getComputedStyle(z).fontSize)===13})()`),
    'module counter and zoom readout follow the design text style'
  )

  /* 5) 卡片排版：顶部类型行 / 宋体标题 / 各类型形态 */
  check(
    await ev(`(()=>{const k=[...document.querySelectorAll('.gv-kind')].map(n=>n.textContent.trim());const tb=document.querySelector('.oc-textbox');return ['事件','便签','引用卡','章节锚点'].every(x=>k.includes(x))&&document.querySelectorAll('.gv-more').length===k.length&&!tb.querySelector('.gv-kindrow')})()`),
    'every canvas card except the text box carries the design type row with its ⋯ entry'
  )
  check(
    await ev(`(()=>{const l=document.querySelector('.oc-event .oc-label'),cs=getComputedStyle(l);return cs.fontFamily.includes('Noto Serif SC')&&parseFloat(cs.fontSize)>=19&&cs.whiteSpace==='normal'&&cs.webkitLineClamp==='2'})()`),
    'card titles use the serif display face at the design size'
  )
  check(
    await ev(`(()=>{const n=document.querySelector('.oc-note'),cs=getComputedStyle(n);return parseFloat(cs.borderTopLeftRadius)<=2&&parseFloat(cs.borderBottomRightRadius)>=12&&cs.transform!=='none'&&parseFloat(getComputedStyle(n.querySelector('.oc-label')).fontSize)===17})()`),
    'sticky notes keep the asymmetric radius and the tilt'
  )
  check(
    await ev(`(()=>{const t=document.querySelector('.oc-textbox');return getComputedStyle(t).borderTopStyle==='solid'&&getComputedStyle(t.querySelector('.oc-tbbg')).display==='none'&&getComputedStyle(t.querySelector('.oc-label')).display==='none'&&getComputedStyle(t.querySelector('.oc-fulltext')).color==='rgb(242, 156, 98)'})()`),
    'text boxes render as bare copper serif text without the dashed frame'
  )
  check(
    await ev(`(()=>{const a=document.querySelector('.oc-anchor'),c3=document.querySelector('.oc-cite');return [a,c3].every(n=>getComputedStyle(n).borderTopStyle==='solid'&&parseFloat(getComputedStyle(n).borderLeftWidth)<=1.5)})()`),
    'chapter and citation cards drop the dashed pill and the accent bar'
  )
  check(
    await ev(`(()=>{const l=document.querySelector('.oc-elabel'),cs=getComputedStyle(l);return !!l&&parseFloat(cs.borderTopWidth)===0&&cs.backgroundColor==='rgba(0, 0, 0, 0)'&&parseFloat(cs.fontSize)===13})()`),
    'edge labels read as plain 13px text on the line'
  )

  /* 6) 放大档位 */
  check(
    await ev(`(()=>{const n=document.querySelector('.oc-node.oc-event');return parseFloat(n.style.width)>=210&&parseFloat(n.style.height)>=130})()`),
    'cards use the enlarged design tier'
  )
  check(
    await ev(`(()=>{const w=__g.work,co=w.liveOlnodes().find(n=>n.kind==='container'),kids=w.olnodeChildren(co.id);const el=[...document.querySelectorAll('.oc-node')].find(n=>n.classList.contains('oc-container'));const childH=parseFloat(document.querySelector('.oc-node.oc-event').style.height);const top=Math.min(...kids.map(k=>k.canvasY))-co.canvasY;const bottom=Math.max(...kids.map(k=>k.canvasY+(k.h!=null?k.h:childH)))-co.canvasY;return kids.length===2&&top>=44&&parseFloat(el.style.height)>=bottom+16})()`),
    'container box grows with the enlarged grid cell and still covers its children'
  )
  await shot('design')
  await shot('design-1080', 1080, 680)

  /* 7) 原版对照：改动不外溢 */
  await ev(`__g.ui.setSkin('original').then(()=>true)`)
  await wait(`document.body.dataset.skin==='original'`)
  check(
    await ev(`(()=>{const s=document.querySelector('.oc-toolbar .oc-chip'),b=[...document.querySelectorAll('.ol-side-add .btn-ghost')][0],n=document.querySelector('.oc-node.oc-event');return !!document.querySelector('.ol-typefilter')&&!document.querySelector('.gravity-side-gear')&&parseFloat(getComputedStyle(s).borderTopLeftRadius)>=12&&b.textContent.trim()==='＋事件'&&!document.querySelector('.gv-kindrow')&&parseFloat(n.style.height)===54})()`),
    'original skin keeps its chip row, pill chips, tight labels and previous card tier'
  )
  await shot('original-control')
  await ev(`__g.ui.setSkin('gravity').then(()=>true)`)
  await wait(`document.body.dataset.skin==='gravity' && !!document.querySelector('.gv-kindrow')`)
  check(await ev(`document.querySelectorAll('.gv-kind').length>=5`), 'gravity skin restores the design cards after the control switch')

  console.log('PASS gravity outline design alignment suite')
} catch (error) {
  process.exitCode = 1
  console.error(error)
  console.error(await ev(`({skin:document.body.dataset.skin,tab:__g?.work?.tab,rows:document.querySelectorAll('.side-item').length,chips:!!document.querySelector('.ol-typefilter'),gear:!!document.querySelector('.gravity-side-gear'),kinds:[...document.querySelectorAll('.gv-kind')].map(n=>n.textContent.trim())})`).catch(() => '(state unavailable)'))
  await shot('failure').catch(() => {})
} finally {
  if (id) await ev(`(async()=>{await __g.work.closeWork();const row=await __ns.db.works.get(${JSON.stringify(id)});if(row)await __g.shelf.deleteWork(row);return true})()`).catch(() => {})
  if (prefs) await ev(`(async()=>{await __ns.db.appconfig.clear();await __ns.db.appconfig.bulkPut(${JSON.stringify(prefs)});await __g.ui.loadPrefs();return true})()`).catch(() => {})
  await c.send('Emulation.clearDeviceMetricsOverride')
  // CDP socket is intentionally retained by the shared helper.
  setTimeout(() => process.exit(process.exitCode), 100)
}
