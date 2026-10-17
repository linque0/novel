/* Real component/persistence checks. Only the isolated gravity-skin-verify
   Electron profile on 9223 is accepted; no normal user data is touched. */
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
  while (Date.now() < end) { if (await ev(code, client)) return; await c.sleep(80) }
  throw new Error('Timed out: ' + code)
}
const check = (ok, message) => { assert.ok(ok, message); console.log('PASS ' + message) }
async function shot(name, width = 1440, height = 900, client = c) {
  await client.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
  await ev('document.fonts.ready.then(()=>true)', client)
  await c.sleep(200)
  await client.send('Page.bringToFront')
  await client.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:4,y:4})
  const frame = await Promise.race([client.send('Page.captureScreenshot', { format: 'png' }), new Promise((_, reject) => setTimeout(() => reject(new Error('Screenshot timeout')), 10000))])
  await writeFile(new URL(`./_gravity-work-${name}.png`, import.meta.url), Buffer.from(frame.data, 'base64'))
}
async function init(client = c) {
  await wait('!!window.__ns && !!document.querySelector(".app-root")', client)
  await client.send('Emulation.setFocusEmulationEnabled', { enabled: true })
  await ev(`(async()=>{const {useUiStore}=await import('/src/stores/ui.js');const {useShelfStore}=await import('/src/stores/shelf.js');window.__g={ui:useUiStore(),shelf:useShelfStore(),work:__ns.getWork()};return true})()`, client)
}
async function closePanel(client) {
  const url=await ev('location.href',client)
  await ev('setTimeout(()=>native.panelCloseSelf(),50);true',client)
  const end=Date.now()+15000
  while((await(await fetch('http://127.0.0.1:9223/json/list')).json()).some(t=>t.url===url)){
    assert.ok(Date.now()<end,'native panel closes');await c.sleep(80)
  }
}
let prefs, id, settings
try {
  await c.send('Page.reload', { ignoreCache: true })
  await init()
  await ev(`window.__gWarnings=[];for(const key of ['warn','error']){const original=console[key];console[key]=(...args)=>{__gWarnings.push(args.map(x=>typeof x==='string'?x:String(x)).join(' '));original(...args)}};window.addEventListener('unhandledrejection',e=>__gWarnings.push(e.reason?.stack||String(e.reason)));true`)
  const loc = await ev('native.getDataLocation()')
  check(loc.defaultDir.endsWith('小说工坊-gravity-skin-verify') && loc.current === loc.defaultDir && !loc.isCustom, 'isolated data profile')
  prefs = await ev('__ns.db.appconfig.toArray()')
  id = await ev(`(async()=>{
    window.__gFixtureId=null;if(__g.work.work)await __g.work.closeWork();
    const row=await __g.shelf.createWork({title:'星尘旅人',author:'林间',genre:'科幻',status:'连载',kind:'novel',intro:'一枚铜星，唤醒了一张遗忘的星图。',withVolume:true});
    window.__gFixtureId=row.id;await __g.ui.setSkin('gravity');await __g.work.open(row.id);
    const w=__g.work;
    const ch=await w.addChapter(w.volumes[0]?.id,'第一章 星海来信');
    w.toggleChapterBookmark(ch.id);
    w.setChapterContent(ch.id,'夜色漫过舷窗，远处的星辰缓缓亮起。\\n她将铜星放在桌面，几条细线从星图的边缘浮现。\\n“航路没有消失。”她说，“只是我们还没有读懂。”');
    w.addCharacter('陆沉');w.updateCharacter(w.selCharacterId,{role:'主角',aliases:'观星者',tags:['引航员'],fields:{身份:'星港引航员',动机:'寻找失落的航路'},content:'沉默而敏锐的观星者。他在星港长大，习惯将每一次告别写进航海日志。'});
    const second=w.addCharacter('叶青');w.updateCharacter(second.id,{role:'配角',content:'收集古老星图的档案员。'});
    const third=w.addCharacter('沈砚');w.updateCharacter(third.id,{role:'导师',fields:{外貌:'旧铜边眼镜，深色长衣',性格:'沉稳而寡言'},content:'守着旧钟楼的领航员。'});w.addRelation(second.id,third.id,'旧识');
    w.selCharacterId=w.liveCharacters.find(c=>c.name==='陆沉').id;w.addRelation(w.selCharacterId,third.id,'师徒');
    w.addSnippet('如果星图记录的不是航路，而是每一个曾经抵达过那里的人呢？\\n\\n她将铜星收进口袋，决定从那封没有署名的信开始。');
    w.addSnippet('雾港来信\\n一封没有寄件人的信，提起父亲从未抵达的海岸。');
    w.addSnippet('白鸽的约定\\n她带走的并非手稿，而是另一个人的姓名。');
    w.addSnippet('第十二声钟响\\n如果钟声不是报时，而是唤醒一段被抹去的记忆。');
    const root=w.mubuAdd(null,null,'星图系统');window.__gRoot=root.id;w.addLoreLink({fromKind:'character',fromId:w.selCharacterId,toKind:'mubu',toId:root.id,label:'研究',reverseLabel:'研究者',description:'铜星与航线'});
    const copper=w.mubuAdd(root.id,null,'铜星：用于记录航路的古老载体');const record=w.mubuAdd(copper.id,null,'铜星记录观测者的位置与记忆。');w.mubuAdd(record.id,null,'观测记录必须由两位引航员复核。');
    w.mubuAdd(root.id,null,'失落坐标：尚未解明的航行规律');
    const co=w.olnodeAdd(null,{kind:'container',title:'第一卷 · 失落的星图',canvasX:40,canvasY:40,w:900,h:265});
    const event=w.olnodeAdd(co.id,{kind:'event',title:'星港来信',text:'一封迟到的来信，改变了原定航程。',canvasX:70,canvasY:115,w:230,h:150});
    const next=w.olnodeAdd(co.id,{kind:'event',title:'领航员测试',text:'林远接受测试，第一次听见星图的回声。',canvasX:370,canvasY:115,w:230,h:150});
    const end=w.olnodeAdd(co.id,{kind:'event',title:'启航',text:'在黎明到来之前离开星港。',canvasX:670,canvasY:115,w:230,h:150});
    w.olnodeAdd(null,{kind:'note',title:'伏笔',text:'铜星上刻着熟悉的名字。',canvasX:70,canvasY:340,w:230,h:150});
    w.olnodeAdd(null,{kind:'cite',title:'陆沉',refId:'character:'+w.selCharacterId,canvasX:370,canvasY:340,w:230,h:150});
    w.olnodeAdd(null,{kind:'anchor',refId:ch.id,canvasX:670,canvasY:340,w:230,h:150});
    w.olnodeAdd(null,{kind:'textbox',text:'一张会改变的星图',canvasX:370,canvasY:510,w:270,h:80,opacity:.7});
    w.olnodeRelAdd(event.id,next.id,{kind:'因果',label:'因果'});w.olnodeRelAdd(next.id,end.id,{kind:'因果',label:'因果'});
    w.selOlnodeId=event.id;window.__gCanvasGeometry=w.olnodes.map(({id,canvasX,canvasY,w,h,color})=>({id,canvasX,canvasY,w,h,color}));
    w.tab='chapters';w.outlineView='text';w.charView='list';__g.ui.aiDrawerOpen=false;__g.ui.focusMode=false;__g.ui.readMode=false;
    await __g.ui.setPref('rightPanelOpen',true);await __g.ui.setPref('sideWidth',252);return row.id;
  })()`)
  await wait('!!document.querySelector(".tiptap")')
  await ev(`__ns.editor.commands.setContent('<p>夜色漫过舷窗，远处的星辰缓缓亮起。</p><p>她将铜星放在桌面，几条细线从星图的边缘浮现。</p><p>“航路没有消失。”她说，“只是我们还没有读懂。”</p>')`)
  check(await ev(`document.body.dataset.skin==='gravity'&&getComputedStyle(document.querySelector('.app-root')).getPropertyValue('--bg-panel').trim()==='#14212c'`), 'workbench gravity tokens')
  check(await ev(`document.querySelectorAll('.nav-rail .rail-item').length===7 && [...document.querySelectorAll('.nav-rail .oicon')].every(s=>s.children.length)&&!!document.querySelector('.gravity-masthead button[aria-pressed]')`), 'seven module/shelf/settings entries and independent AI masthead control')
  await shot('chapters')
  check(await ev(`getComputedStyle(document.querySelector('.n-tree-node--selected')).backgroundColor==='rgb(36, 51, 64)'`),'chapter selection uses blue slate rather than the component accent tint')
  await ev(`window.__gEditor=__ns.editor;__gEditor.commands.insertContent('验收文本')`)
  for (const [tab, selector] of [['outline','.outline-surface'],['characters','.character-surface'],['lore','.lore-surface'],['snippets','.snippet-surface'],['chapters','.editor-wrap']]) {
    await ev(`[...document.querySelectorAll('.nav-rail .rail-item')].find(n=>n.textContent.trim()===${JSON.stringify({outline:'大纲',characters:'人物',lore:'设定',snippets:'灵感',chapters:'正文'}[tab])}).click()`)
    await wait(`__g.work.tab===${JSON.stringify(tab)}&&!!document.querySelector(${JSON.stringify(selector)})`)
    await wait(`!!document.querySelector('#studio-task-actions button')`)
    await ev(`document.querySelector('#studio-task-actions button').click()`)
    await wait(`!!document.querySelector('.task-form')`)
    check(await ev(`document.querySelectorAll('.task-form .n-select').length>=2`),tab+' relocated assistant opens original task form')
    await ev(`[...document.querySelectorAll('.task-actions button')].find(n=>n.textContent.trim()==='关闭').click()`)
    await wait(`!document.querySelector('.task-form')`)
    await shot(tab)
    await shot(tab+'-1080',1080,680)
    check(await ev(`(()=>{const a=document.querySelector('.center-pane').getBoundingClientRect(),b=document.querySelector('.nav-rail').getBoundingClientRect();return a.bottom<=b.top&&a.width>250&&b.right<=innerWidth&&b.left>=0&&document.documentElement.scrollWidth<=innerWidth})()`), tab+' usable minimum-size layout and unobscured navigation')
    if(tab==='outline')check(await ev(`document.querySelector('.ol-editor').getBoundingClientRect().bottom<=document.querySelector('.nav-rail').getBoundingClientRect().top`),'outline editable scroll viewport stays above navigation')
    if(tab==='chapters')check(await ev(`(()=>{const t=document.querySelector('.editor-toolbar');return t.scrollWidth<=t.clientWidth&&[...t.querySelectorAll('button')].every(n=>{const a=n.getBoundingClientRect(),b=t.getBoundingClientRect();return a.left>=b.left&&a.right<=b.right})})()`),'minimum manuscript toolbar exposes all formatting actions without horizontal scrolling')
    if(tab==='outline')check(await ev(`(()=>{const f=document.querySelector('.ol-typefilter');return f.scrollWidth<=f.clientWidth})()`),'module type choices wrap without horizontal scrolling')
    if(tab==='snippets')check(await ev(`getComputedStyle(document.querySelector('.snippet-catalog>.side-list')).gridTemplateColumns.split(' ').length===1&&document.querySelector('.snippet-catalog .side-item').getBoundingClientRect().width>=240`),'minimum main inspiration cards keep readable single-column width')
    if(tab==='snippets'){
      check(await ev(`!!document.querySelector('.gravity-quick-trigger')&&!document.querySelector('.snippet-catalog>.side-head textarea')`),'inspiration keeps its collage visible with a clear quick-note entry')
      await ev(`document.querySelector('.gravity-quick-trigger').click()`)
      await wait(`!!document.querySelector('.gravity-quick-popover textarea')`)
      await ev(`const input=document.querySelector('.gravity-quick-popover textarea');input.value='尚未提交的草稿';input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));true`)
      await wait(`!document.querySelector('.gravity-quick-popover')`)
      check(await ev(`document.activeElement?.classList.contains('gravity-quick-trigger')`),'Escape dismisses quick note and restores trigger focus')
      await ev(`document.querySelector('.gravity-quick-trigger').click()`)
      await wait(`!!document.querySelector('.gravity-quick-popover textarea')`)
      check(await ev(`document.querySelector('.gravity-quick-popover textarea').value==='尚未提交的草稿'`),'dismissed quick-note draft survives reopening')
      await ev(`window.__previousSnippet=__g.work.selSnippetId;const i=document.querySelector('.gravity-quick-popover textarea');i.value='即时记录验收';i.dispatchEvent(new Event('input',{bubbles:true}));i.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',ctrlKey:true,bubbles:true}));true`)
      await wait(`!document.querySelector('.gravity-quick-popover')&&__g.work.liveSnippets.some(n=>n.content==='即时记录验收')`)
      check(await ev(`document.activeElement?.classList.contains('gravity-quick-trigger')`),'quick-note Ctrl+Enter creates a real inspiration, closes composer and restores focus')
      await ev(`__g.work.deleteSnippet(__g.work.liveSnippets.find(n=>n.content==='即时记录验收').id);__g.work.selSnippetId=__previousSnippet;true`)
    }
    if(tab==='snippets')check(await ev(`(()=>{const card=document.querySelector('.gravity-inspiration-assistant'),button=card.querySelector('button'),r=button.getBoundingClientRect(),n=document.querySelector('.nav-rail').getBoundingClientRect();return r.bottom<=n.top&&card.getBoundingClientRect().bottom<=n.top&&button.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2))})()`),'inspiration CTA and final copy fit safely above dock and receive pointer events')
  }
  await ev(`__g.ui.readMode=true`);await wait('!!document.querySelector(".read-mode")')
  check(await ev('!document.querySelector(".nav-rail") && __ns.editor.isEditable===false'), 'gravity reading mode remains read-only')
  await shot('reading');await ev('__g.ui.readMode=false')
  await ev('__g.ui.focusMode=true');check(await ev('!document.querySelector(".nav-rail")&&!document.querySelector(".side-panel")'), 'focus mode retains original behavior');await ev('__g.ui.focusMode=false')
  await ev(`__g.work.tab='outline';__g.work.outlineView='canvas'`);await wait('!!document.querySelector(".oc-canvas")')
  check(await ev(`!!document.querySelector('.ol-typefilter')&&[...document.querySelectorAll('.ol-typefilter .om-chip')].some(n=>n.textContent==='便签')`), 'gravity retains discoverable module type filtering')
  await ev(`[...document.querySelectorAll('.ol-typefilter .om-chip')].find(n=>n.textContent==='便签').click()`)
  check(await ev(`document.querySelectorAll('.ol-side-root .side-list .side-item').length===1&&document.querySelector('.ol-side-root .side-item').dataset.kind==='note'`), 'type filter really narrows the module catalog')
  await ev(`[...document.querySelectorAll('.ol-typefilter .om-chip')].find(n=>n.textContent==='全部').click()`)
  check(await ev(`(()=>{const b=document.querySelector('.ol-side-root .gv-more');return !!b&&getComputedStyle(b).opacity==='1'&&b.getBoundingClientRect().width>=24})()`), 'module actions remain visible without hover')
  await ev(`(()=>{const row=[...document.querySelectorAll('.ol-side-root .side-item')].find(n=>n.textContent.includes('星港来信'));row.querySelector('.glaze-module-menu').click();return true})()`)
  await wait(`[...document.querySelectorAll('.n-dropdown-option-body')].some(n=>n.textContent==='重命名')`)
  await ev(`[...document.querySelectorAll('.n-dropdown-option-body')].find(n=>n.textContent==='重命名').click()`)
  await wait(`!!document.querySelector('.n-dialog input')`)
  await ev(`(()=>{const input=document.querySelector('.n-dialog input');input.value='星港来信 · 校订';input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new KeyboardEvent('keyup',{key:'Enter',bubbles:true}));return true})()`)
  await wait(`!document.querySelector('.n-dialog')&&__g.work.olnodes.some(n=>n.title==='星港来信 · 校订')`)
  check(true,'visible module menu invokes the original rename dialog and updates the real node')
  assert.deepEqual(await ev(`__g.work.olnodes.map(({id,canvasX,canvasY,w,h,color})=>({id,canvasX,canvasY,w,h,color}))`),await ev(`__gCanvasGeometry`),'skin presentation preserves user canvas geometry')
  check(await ev(`['event','note','cite','anchor','textbox','container'].every(k=>!!document.querySelector('.oc-'+k))`),'all canvas object kinds remain rendered')
  await shot('outline-canvas')
  check(await ev(`document.querySelectorAll('.oc-node').length>=8 && !!document.querySelector('button[title="整理布局（固定模块除外）"]')`), 'free canvas nodes, containers and arrangement controls preserved')
  await ev(`document.querySelector('button[title="放大"]').click()`)
  await ev(`__g.work.tab='characters';__g.work.charView='graph'`);await wait('!!document.querySelector(".rg-canvas")')
  await ev(`document.querySelector('button[title="圆形排布"]').click()`)
  await wait(`__g.work.loadCharGraph().then(p=>Object.keys(p).length===3)`)
  // Real drag updates canonical coordinates; changing skins must only project them.
  const graphBefore=await ev(`__g.work.loadCharGraph()`)
  const drag=await ev(`(()=>{const n=[...document.querySelectorAll('.rg-node')].find(n=>n.textContent.includes('陆沉')),r=n.getBoundingClientRect();return {x:r.left+20,y:r.top+30}})()`)
  await c.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...drag})
  await c.send('Input.dispatchMouseEvent',{type:'mouseMoved',button:'left',buttons:1,x:drag.x+34,y:drag.y+22})
  await c.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,x:drag.x+34,y:drag.y+22})
  const personId=await ev(`__g.work.liveCharacters.find(n=>n.name==='陆沉').id`)
  await wait(`__g.work.loadCharGraph().then(p=>p[${JSON.stringify(personId)}].x!==${graphBefore[personId].x})`)
  const graphAfter=await ev(`__g.work.loadCharGraph()`)
  await ev(`(()=>{const from=[...document.querySelectorAll('.rg-node')].find(n=>n.textContent.includes('陆沉')),to=[...document.querySelectorAll('.rg-node')].find(n=>n.textContent.includes('叶青')),a=from.querySelector('.rg-apt[data-side="right"]'),r=a.getBoundingClientRect(),t=to.getBoundingClientRect();a.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,clientX:r.left+r.width/2,clientY:r.top+r.height/2}));window.dispatchEvent(new MouseEvent('mousemove',{clientX:t.left+t.width/2,clientY:t.top+t.height/2}));window.dispatchEvent(new MouseEvent('mouseup',{clientX:t.left+t.width/2,clientY:t.top+t.height/2}));return true})()`)
  await wait(`!!document.querySelector('.rg-relinput input')`)
  await ev(`(()=>{const i=document.querySelector('.rg-relinput input');i.value='对立';i.dispatchEvent(new Event('input',{bubbles:true}));i.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));return true})()`)
  check(await ev(`__g.work.relations.some(r=>r.label==='对立'&&r.fromSide==='right'&&!!r.toSide)&&document.querySelectorAll('.rg-elabel').length===3`),'portrait hit boxes and projected ports create a real labeled relationship')
  await ev(`document.querySelector('button[title="适应视图"]').click()`)
  check(await ev(`(()=>{const n=document.querySelector('.rg-node');return parseFloat(n.style.height)>=200&&!!document.querySelector('.rg-heading')&&!!document.querySelector('.rg-tagpick')&&n.textContent.includes('陆')})()`), 'gravity character graph uses portrait cards and real name initial')
  await ev(`document.querySelectorAll('.rg-node').forEach(n=>n.dispatchEvent(new MouseEvent('mouseleave')));true`);await c.sleep(180)
  await shot('character-graph')
  check(await ev('document.querySelectorAll(".rg-node").length===3'), 'character graph preserves all real characters')
  await ev(`__g.work.charView='list'`);await wait('!!document.querySelector(".character-surface")')
  check(await ev(`(()=>{const heads=[...document.querySelectorAll('.gravity-section-head')],meta=document.querySelector('.gravity-character-meta-row'),labels=[...meta.querySelectorAll('.gravity-field-label')].map(n=>n.textContent.trim());return heads.length===4&&heads.every(n=>n.querySelector('.rp-title'))&&labels.join(',')==='别名,标签'&&!!meta.querySelector('.gravity-character-tags')&&!!document.querySelector('.gravity-avatar-action')})()`),'gravity dossier matches the reference section headers and alias/tag metadata row')
  check(await ev(`(()=>{const sections=document.querySelector('.character-sections'),a=sections.querySelector('.character-fields').getBoundingClientRect(),b=sections.querySelector('.character-biography').getBoundingClientRect(),c=sections.querySelector('.character-relations').getBoundingClientRect(),d=sections.querySelector('.character-crosslinks').getBoundingClientRect();return Math.abs(a.top-b.top)<3&&Math.abs(c.top-d.top)<3&&a.width>300&&b.width>300})()`),'dossier keeps the reference two-column field, biography and relation alignment')
  check(await ev(`(()=>{const row=document.querySelector('.character-crosslinks .rel-row'),kind=row?.querySelector('.rel-object-kind'),name=row?.querySelector('.rel-other'),rel=row?.querySelector('.rel-kind'),dir=row?.querySelector('.rel-dir'),desc=row?.querySelector('.rel-desc');return kind?.textContent.trim()==='设'&&name?.textContent.trim()==='星图系统'&&rel?.textContent.trim()==='研究'&&getComputedStyle(dir).display==='none'&&getComputedStyle(desc).display==='none'})()`),'gravity dossier cross-module relation uses the reference type, object and relation order')
  check(await ev(`(()=>{const tags=document.querySelector('.gravity-character-tags');return tags?.querySelector('.gravity-character-tag')?.textContent.includes('引航员')&&!!tags.querySelector('.gravity-tag-add')&&!tags.querySelector('.n-base-selection')})()`),'gravity dossier tags use separate copper chips and a direct add affordance')
  await ev(`document.querySelector('.gravity-tag-add').click()`);await wait(`!!document.querySelector('.gravity-tag-input')`)
  await ev(`(()=>{const n=document.querySelector('.gravity-tag-input');n.value='观测者';n.dispatchEvent(new Event('input',{bubbles:true}));n.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));return true})()`)
  await wait(`__g.work.activeCharacter.tags.includes('观测者')`)
  check(await ev(`!![...document.querySelectorAll('.gravity-character-tag')].find(n=>n.textContent.includes('观测者'))`),'gravity dossier inline tag editor writes through the original character store')
  await ev(`[...document.querySelectorAll('.gravity-character-tag')].find(n=>n.textContent.includes('观测者')).querySelector('.gravity-tag-remove').click()`)
  await wait(`!__g.work.activeCharacter.tags.includes('观测者')`)
  check(true,'gravity dossier chip removal preserves the original tag deletion capability')
  await ev(`(()=>{const n=document.querySelector('.character-surface textarea');n.value='人物小传保存验收';n.dispatchEvent(new Event('input',{bubbles:true}));return true})()`)
  check(await ev('__g.work.activeCharacter.content==="人物小传保存验收"'), 'real character form still updates its store')
  await ev(`__g.work.tab='lore'`);await wait('!!document.querySelector(".ob-row")')
  await ev(`[...document.querySelectorAll('.ob-row')].find(n=>n.textContent.includes('星图系统')).dispatchEvent(new MouseEvent('dblclick',{bubbles:true}))`)
  await wait('!!document.querySelector(".ldt-page")');await shot('lore-detail');check(await ev(`(()=>{const n=document.querySelector('.lg-node.center .lg-title');return n.scrollWidth<=n.clientWidth})()`),'detail graph keeps the actual center title readable alongside relationship count');check(await ev(`document.querySelector('.gravity-detail-content').textContent.includes('两位引航员复核')`),'detail retains deep recursive node content')
  check(await ev(`!!document.querySelector('.gravity-detail-orbit')&&!!document.querySelector('.ldt-graph')&&document.querySelectorAll('.ldt-kid').length===4`), 'lore detail retains breadcrumbs, graph and recursive child navigation with orbital artwork')
  check(await ev(`(()=>{const page=document.querySelector('.ldt-page'),r=page.getBoundingClientRect();return page.contains(document.elementFromPoint(8,r.top+r.height/2))&&page.contains(document.elementFromPoint(innerWidth-8,r.top+r.height/2))})()`),'detail background fully covers underlying module at both edges')
  await ev(`document.querySelector('.gravity-masthead button[title="搜索"]')?.click();__g.ui.searchOpen=true`)
  await wait(`!!document.querySelector('.n-modal')`)
  check(await ev(`(()=>{const n=[...document.querySelectorAll('.n-modal')].find(n=>n.textContent.includes('全局搜索')),r=n?.getBoundingClientRect();return !!r&&n.contains(document.elementFromPoint(r.left+r.width/2,r.top+30))})()`),'global search remains above lore detail')
  await ev(`__g.ui.searchOpen=false`);await wait(`!document.querySelector('.n-modal')`)
  await ev(`document.querySelector('.gravity-masthead button[title="拆窗、书签、沉浸、阅读与皮肤"]').click()`)
  await wait(`[...document.querySelectorAll('.n-dropdown-option-body')].some(n=>n.textContent.includes('章节书签'))`)
  const bookmarkMenu=await ev(`(()=>{const r=[...document.querySelectorAll('.n-dropdown-option-body')].find(n=>n.textContent.includes('章节书签')).getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()`)
  await c.send('Input.dispatchMouseEvent',{type:'mouseMoved',...bookmarkMenu})
  await wait(`[...document.querySelectorAll('.n-dropdown-option-body')].some(n=>n.textContent.includes('第一章 星海来信'))`)
  await ev(`[...document.querySelectorAll('.n-dropdown-option-body')].find(n=>n.textContent.includes('第一章 星海来信')).click()`)
  await wait(`__g.work.tab==='chapters'&&!document.querySelector('.ldt-page')`)
  check(true,'bookmark navigation from lore detail closes the overlay and opens the real chapter')
  await ev(`__g.work.tab='lore';__g.ui.loreDetailId=__gRoot`);await wait('!!document.querySelector(".ldt-page")')
  await ev(`[...document.querySelectorAll('.nav-rail .rail-item')].find(n=>n.textContent.trim()==='人物').click()`)
  await wait(`__g.work.tab==='characters'&&!document.querySelector('.ldt-page')`)
  check(true,'dock navigation from lore detail closes the overlay')
  await ev(`__g.work.tab='snippets'`);await wait('!!document.querySelector(".snippet-surface textarea")')
  await ev(`document.querySelector('.gravity-inspiration-assistant button').click()`)
  await wait(`!!document.querySelector('.ai-dock textarea')`)
  check(await ev(`document.querySelector('.ai-dock textarea').value.includes('扩展成一个场景')`),'inspiration assistant carries real prompt into existing AI conversation without sending')
  // Reproduce the common sequence: open the dock, detach it, then discuss an inspiration.
  await ev(`native.panelOpen({type:'ai',workId:__g.work.work.id,entityId:'',title:'恍然梦验收'})`)
  const aiUntil=Date.now()+10000
  while(!(await(await fetch('http://127.0.0.1:9223/json/list')).json()).some(t=>t.url.includes('panel=ai'))){assert.ok(Date.now()<aiUntil,'AI panel appears');await c.sleep(80)}
  settings=await connect('panel=ai','9223');await init(settings)
  await wait(`!document.querySelector('.ai-dock')`)
  check(await ev(`!!document.querySelector('.gravity-inspiration-assistant button')`),'inspiration discussion stays reachable after an already-open AI dock is detached')
  await ev(`document.querySelector('.gravity-inspiration-assistant button').click()`)
  await wait(`!!document.querySelector('.glaze-inspiration-dialogue textarea')`)
  check(await ev(`document.querySelector('.glaze-inspiration-dialogue textarea').value.includes('场景')`),'detached AI uses a local editable conversation without sending')
  await ev(`document.querySelector('.glaze-inspiration-dialogue .n-base-close').click()`)
  await closePanel(settings);settings=null
  await ev(`__g.ui.aiDrawerOpen=false`)
  await ev(`(()=>{const n=document.querySelector('.snippet-surface textarea');n.value='灵感转换验收\\n保持真实内容';n.dispatchEvent(new Event('input',{bubbles:true}));[...document.querySelectorAll('.snippet-actions button')].find(n=>n.textContent.includes('转为设定')).click();return true})()`)
  await wait('__g.work.tab==="lore"')
  check(await ev('__g.work.mubu.some(n=>n.text==="灵感转换验收")'), 'snippet converts through original lore action')
  await ev(`__g.ui.aiDrawerOpen=true`);await wait('!!document.querySelector(".ai-dock")')
  await shot('ai-1080',1080,680)
  await ev(`__g.work.tab='chapters'`);await wait('!!document.querySelector(".editor-head")')
  await shot('chapter-ai-1080',1080,680)
  check(await ev(`(()=>{const p=document.querySelector('.center-pane').getBoundingClientRect(),a=document.querySelector('.ai-dock').getBoundingClientRect(),t=document.querySelector('.editor-toolbar').getBoundingClientRect();return p.width>=300&&a.right<=innerWidth&&!!document.querySelector('.editor-toolbar .editor-bar-status')&&t.left>=p.left&&t.right<=p.right+1})()`), 'chapter, notes, AI and catalog remain usable together at minimum size')
  await ev(`__g.ui.setPref('sideWidth',480).then(()=>__g.ui.setPref('aiDrawerWidth',640)).then(()=>true)`)
  await shot('chapter-ai-wide',1400,880)
  check(await ev(`document.querySelector('.center-pane').getBoundingClientRect().width>=300&&__g.ui.sideWidth===480&&__g.ui.aiDrawerWidth===640`), 'large saved widths adapt without overwriting preferences')
  await ev(`__g.ui.setPref('sideWidth',252).then(()=>__g.ui.setPref('aiDrawerWidth',400)).then(()=>true)`)
  await ev(`__g.ui.aiDrawerOpen=false;native.panelOpen({type:'settings',workId:'app',entityId:'',title:'设置'})`)
  await c.sleep(700)
  settings=await connect('panel=', '9223');await init(settings)
  await wait('!!document.querySelector(".sw-root")',settings)
  await wait('document.querySelector(".app-root").dataset.skin==="gravity"',settings)
  check(await ev(`document.querySelector('.app-root').dataset.skin==='gravity'&&getComputedStyle(document.querySelector('.app-root')).getPropertyValue('--bg').trim()==='#0b131d'`,settings), 'independent settings uses matching root tokens')
  await shot('settings',1440,900,settings);await shot('settings-1000',1000,700,settings);await shot('settings-800',800,500,settings)
  for(const page of ['模型设置','数据','关于']) {
    await ev(`[...document.querySelectorAll('.sw-nav-item')].find(n=>n.textContent.includes(${JSON.stringify(page)})).click()`,settings)
    await c.sleep(150)
    check(await ev(`document.querySelector('.sw-h').textContent===${JSON.stringify(page)}`,settings), 'settings retains '+page)
  }
  await ev(`__g.ui.setPref('fontSize',20).then(()=>true)`,settings);await wait('__g.ui.fontSize===20')
  await closePanel(settings);settings=null
  for(const type of ['chapter','outline','characters','lore','snippets']) {
    await ev(`(async()=>{const {autosave}=await import('/src/services/autosave.js');await autosave.flushAll();__g.work.tab=${JSON.stringify(type==='chapter'?'chapters':type)};const entities={chapter:__g.work.selChapterId,characters:__g.work.selCharacterId,snippets:__g.work.selSnippetId};const {popOut}=await import('/src/services/panelwindows.js');return popOut(__g.work,${JSON.stringify(type)},entities[${JSON.stringify(type)}]||'','验收面板')})()`)
    const until=Date.now()+10000
    while(!(await(await fetch('http://127.0.0.1:9223/json/list')).json()).some(t=>t.url.includes('panel='+type))) {
      assert.ok(Date.now()<until,'native module panel appears');await c.sleep(80)
    }
    settings=await connect('panel='+type,'9223');await init(settings)
    await wait('!!document.querySelector(".panel-body")&&document.querySelector(".app-root").dataset.skin==="gravity"',settings)
    check(await ev(`getComputedStyle(document.querySelector('.app-root')).getPropertyValue('--bg-panel').trim()==='#14212c'&&!!document.querySelector('.side-panel')&&!!document.querySelector('.center-pane')`,settings), type+' independent panel retains full module and skin')
    await wait(type==='chapter'?`!!document.querySelector('.panel-lock-note')&&getComputedStyle(document.querySelector('.panel-lock-note')).display!=='none'`:`!!document.querySelector('.pop-lock-pane')`)
    await shot('panel-'+type,1080,680,settings)
    await shot('panel-'+type+'-800',800,500,settings)
    check(await ev(`document.documentElement.scrollWidth<=innerWidth&&document.querySelector('.center-pane').getBoundingClientRect().width>=250`,settings),type+' native minimum-size panel remains usable')
    if(type==='outline')check(await ev(`document.querySelector('.oc-canvas').getBoundingClientRect().height>=260&&document.querySelector('.ol-side-root>.side-list').getBoundingClientRect().height>=100`,settings),'native outline preserves space for both canvas and catalog')
    if(type==='snippets'){
      await wait(`!!document.querySelector('.gravity-inspiration-assistant button')`,settings)
      await ev(`document.querySelector('.gravity-inspiration-assistant button').scrollIntoView({block:'center'});true`,settings)
      check(await ev(`(()=>{const b=document.querySelector('.gravity-inspiration-assistant button'),r=b.getBoundingClientRect();return b.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2))})()`,settings),'native inspiration discussion action can be scrolled into view and hit')
      check(await ev(`(()=>{const p=document.querySelector('.snippet-surface'),input=p.querySelector(':scope>.n-input'),actions=p.querySelector('.snippet-actions');return input.getBoundingClientRect().bottom<=actions.getBoundingClientRect().top})()`,settings),'native inspiration keeps content before conversion actions')
      await ev(`document.querySelector('.gravity-inspiration-assistant button').click()`,settings)
      await wait(`!!document.querySelector('.glaze-inspiration-dialogue textarea')`,settings)
      check(await ev(`document.querySelector('.glaze-inspiration-dialogue textarea').value.includes('场景')`,settings),'native inspiration opens usable discussion without sending')
      await ev(`document.querySelector('.glaze-inspiration-dialogue .n-base-close')?.click()`,settings)
    }
    if(type==='snippets')check(await ev(`(()=>{const n=document.querySelector('.snippet-catalog .side-item'),d=n.querySelector('.gravity-snippet-date');return n.getBoundingClientRect().width>=120&&d.getBoundingClientRect().height<20&&getComputedStyle(document.querySelector('.snippet-catalog>.side-list')).gridTemplateColumns.split(' ').length===1})()`,settings),'minimum native inspiration panel uses readable single-column cards and one-line timestamps')
    await closePanel(settings);settings=null
    await wait(type==='chapter'?`!document.querySelector('.panel-lock-note')||getComputedStyle(document.querySelector('.panel-lock-note')).display==='none'`:`!document.querySelector('.pop-lock-pane')`)
    check(true,type+' panel closing restores main editor')
  }
  // Flush and reopen proves the original autosave path still persists our edits.
  await ev(`__g.work.closeWork().then(()=>__g.work.open(${JSON.stringify(id)})).then(()=>true)`)
  check(await ev(`__g.work.characters.some(n=>n.content==='人物小传保存验收')&&__g.work.chapters.some(n=>n.content.includes('验收文本'))`), 'edits survive autosave and reopening')
  check(await ev(`!(__gWarnings||[]).some(w=>/Teleport|Unhandled error|TypeError/.test(w))`),'no presentation lifecycle or runtime errors');
  console.log('PASS gravity-only refinement suite')
} catch (error) {
  process.exitCode=1
  console.error(error)
  console.error(await ev(`({warnings:window.__gWarnings,agents:[...document.querySelectorAll('.module-agent')].map(n=>n.outerHTML.slice(0,300)),target:document.querySelector('#studio-task-actions')?.outerHTML,tab:__g.work.tab})`))
  await shot('failure').catch(()=>{})
} finally {
  if(settings)await closePanel(settings).catch(()=>{})
  id ||= prefs ? await ev('window.__gFixtureId').catch(()=>null) : null
  if(id)await ev(`(async()=>{await __g.work.closeWork();const row=await __ns.db.works.get(${JSON.stringify(id)});if(row)await __g.shelf.deleteWork(row);return true})()`)
  if(prefs)await ev(`(async()=>{await __ns.db.appconfig.clear();await __ns.db.appconfig.bulkPut(${JSON.stringify(prefs)});await __g.ui.loadPrefs();return true})()`)
  await c.send('Emulation.clearDeviceMetricsOverride')
  // CDP socket is intentionally retained by the shared helper.
  setTimeout(()=>process.exit(process.exitCode),100)
}
