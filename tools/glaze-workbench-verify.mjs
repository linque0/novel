/* Real component/persistence checks. Only the isolated glaze-skin-verify
   Electron profile on 9224 is accepted; no normal user data is touched. */
import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { connect } from './_cdp-lib.mjs'
const c = await connect('http://127.0.0.1:5173', '9224')
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
  const frame = await Promise.race([client.send('Page.captureScreenshot', { format: 'png' }), new Promise((_, reject) => setTimeout(() => reject(new Error('Screenshot timeout')), 10000))])
  await writeFile(new URL(`./_glaze-work-${name}.png`, import.meta.url), Buffer.from(frame.data, 'base64'))
}
async function init(client = c) {
  await wait('!!window.__ns && !!document.querySelector(".app-root")', client)
  await client.send('Emulation.setFocusEmulationEnabled', { enabled: true })
  await ev(`(async()=>{const {useUiStore}=await import('/src/stores/ui.js');const {useShelfStore}=await import('/src/stores/shelf.js');window.__g={ui:useUiStore(),shelf:useShelfStore(),work:__ns.getWork()};return true})()`, client)
}
async function closePanel(client) {
  const url=await ev('location.href',client)
  // Closing the renderer within Runtime.evaluate can destroy its CDP reply.
  // Acknowledge the request before invoking the real native close, then observe the target.
  await ev('setTimeout(()=>native.panelCloseSelf(),50);true',client)
  const deadline=Date.now()+15000
  while((await(await fetch('http://127.0.0.1:9224/json/list')).json()).some(t=>t.url===url)){
    assert.ok(Date.now()<deadline,'native panel closes');await c.sleep(80)
  }
}
let prefs, id, settings
try {
  await c.send('Page.bringToFront');
  await c.send('Page.reload', { ignoreCache: true })
  await init()
  await ev(`window.__gWarnings=[];for(const key of ['warn','error']){const original=console[key];console[key]=(...args)=>{__gWarnings.push(args.map(x=>typeof x==='string'?x:String(x)).join(' '));original(...args)}};window.addEventListener('unhandledrejection',e=>__gWarnings.push(e.reason?.stack||String(e.reason)));true`)
  const loc = await ev('native.getDataLocation()')
  check(loc.defaultDir.endsWith('小说工坊-glaze-skin-verify') && loc.current === loc.defaultDir && !loc.isCustom, 'isolated data profile')
  prefs = await ev('__ns.db.appconfig.toArray()')
  id = await ev(`(async()=>{
    if(__g.work.work)await __g.work.closeWork();
    const row=await __g.shelf.createWork({title:'星尘旅人',author:'林间',genre:'科幻',status:'连载',kind:'novel',intro:'一枚铜星，唤醒了一张遗忘的星图。',withVolume:true});
    await __g.ui.setSkin('glaze');await __g.work.open(row.id);
    const w=__g.work;
    const ch=await w.addChapter(w.volumes[0]?.id,'第一章 星海来信');
    w.toggleChapterBookmark(ch.id);
    w.setChapterContent(ch.id,'夜色漫过舷窗，远处的星辰缓缓亮起。\\n她将铜星放在桌面，几条细线从星图的边缘浮现。\\n“航路没有消失。”她说，“只是我们还没有读懂。”');
    w.addCharacter('陆沉');w.updateCharacter(w.selCharacterId,{role:'主角',aliases:'观星者',tags:['引航员'],fields:{身份:'星港引航员',动机:'寻找失落的航路'},content:'沉默而敏锐的观星者。他在星港长大，习惯将每一次告别写进航海日志。'});
    const second=w.addCharacter('叶青');w.updateCharacter(second.id,{role:'配角',content:'收集古老星图的档案员。'});const third=w.addCharacter('沈砚');w.updateCharacter(third.id,{role:'反派',content:'航路秘密的守护者。'});w.addRelation(w.liveCharacters[0].id,second.id,'师徒');
    w.selCharacterId=w.liveCharacters.find(c=>c.name==='陆沉').id;
    w.addSnippet('如果星图记录的不是航路，而是每一个曾经抵达过那里的人呢？\\n\\n她将铜星收进口袋，决定从那封没有署名的信开始。');
    w.addSnippet('雾港来信\\n一封没有寄件人的信，提起父亲从未抵达的海岸。');
    w.addSnippet('白鸽的约定\\n她带走的并非手稿，而是另一个人的姓名。');
    w.addSnippet('第十二声钟响\\n如果钟声不是报时，而是唤醒一段被抹去的记忆。');
    const root=w.mubuAdd(null,null,'星图系统');window.__gRoot=root.id;
    const copper=w.mubuAdd(root.id,null,'铜星：用于记录航路的古老载体');const copperBody=w.mubuAdd(copper.id,null,'铜星记录观测者的位置与记忆。');w.mubuAdd(copperBody.id,null,'更深层观测规则：同一颗铜星只有一位观测者。');
    const coords=w.mubuAdd(root.id,null,'失落坐标：尚未解明的航行规律');
    /* 关联关系：让「设定详情 → 关系图谱」有真实邻居与连线（对照设计稿需要非空图谱） */
    w.addLoreLink({fromKind:'character',fromId:second.id,toKind:'mubu',toId:root.id,label:'研究者',description:'负责铜星观测'});
    w.addLoreLink({fromKind:'mubu',fromId:root.id,toKind:'mubu',toId:coords.id,label:'管理',description:'记录航线与观测结果'});
    const co=w.olnodeAdd(null,{kind:'container',title:'第一卷 · 失落的星图',canvasX:50,canvasY:50,w:580,h:280,color:'#619b86'});
    w.olnodeAdd(co.id,{kind:'event',title:'星港来信',text:'一封迟到的来信，改变了原定航程。',canvasX:100,canvasY:140,w:210,h:100});
    w.olnodeAdd(co.id,{kind:'note',title:'伏笔',text:'铜星上刻着熟悉的名字。',canvasX:360,canvasY:160,w:210,h:100});
    const end=w.olnodeAdd(null,{kind:'event',title:'启航',text:'在黎明到来之前离开星港。',canvasX:290,canvasY:400,w:230,h:100});
    w.olnodeAdd(null,{kind:'textbox',text:'一张会改变的星图\\n所有航线，终将交会。',canvasX:70,canvasY:540,w:240,h:100});
    w.olnodeAdd(null,{kind:'cite',refId:'character:'+w.selCharacterId,title:'陆沉',canvasX:675,canvasY:90,w:210,h:150});
    const anchor=w.olnodeAdd(null,{kind:'anchor',refId:ch.id,title:ch.title,canvasX:675,canvasY:360,w:210,h:130});
    w.olnodeRelAdd(end.id,anchor.id,{kind:'伏笔',label:'星图的回声'});w.selOlnodeId=end.id;
    window.__gCanvasGeometry=w.olnodes.map(({id,canvasX,canvasY,w,h,color})=>({id,canvasX,canvasY,w,h,color}));
    w.tab='chapters';w.outlineView='text';w.charView='list';__g.ui.aiDrawerOpen=false;__g.ui.focusMode=false;__g.ui.readMode=false;
    await __g.ui.setPref('rightPanelOpen',true);await __g.ui.setPref('sideWidth',252);return row.id;
  })()`)
  await wait('!!document.querySelector(".tiptap")')
  await ev(`__ns.editor.commands.setContent('<p>夜色漫过舷窗，远处的星辰缓缓亮起。</p><p>她将铜星放在桌面，几条细线从星图的边缘浮现。</p><p>“航路没有消失。”她说，“只是我们还没有读懂。”</p>')`)
  check(await ev(`document.body.dataset.skin==='glaze'&&getComputedStyle(document.querySelector('.app-root')).getPropertyValue('--bg-panel').trim()==='#f3f8f9'`), 'workbench glaze tokens')
  check(await ev(`document.querySelectorAll('.nav-rail .rail-item').length===7 && [...document.querySelectorAll('.nav-rail .oicon')].every(s=>s.children.length)&&!!document.querySelector('.gravity-masthead button[aria-pressed]')`), 'seven module/shelf/settings entries and independent AI masthead control')
  await shot('chapters')
  /* 顶栏右端：章节状态 / 字数 / 历史（原先在章题下方那一行，现归 .editor-toolbar 末尾、右对齐）
     注意：章节状态存的是键（draft/done/revise），顶栏显示的是中文标签，所以这里比标签不比键。 */
  check(await ev(`(()=>{const b=document.querySelector('.editor-toolbar'),s=b&&b.querySelector('.editor-bar-status');return !!s&&s===b.lastElementChild&&!!s.querySelector('.n-base-selection')&&!!s.querySelector('.n-tag')&&[...s.querySelectorAll('button')].some(x=>x.textContent.trim()==='历史')&&/^\\d+ 字$/.test(s.querySelector('.n-tag').textContent.trim())&&['草稿','完成','待修改'].includes(s.querySelector('.n-base-selection').textContent.trim())})()`), 'chapter status, word count and history render inside the editor top bar')
  await ev(`(()=>{__g.work.setChapterStatus(__g.work.activeChapter.id,'done');return true})()`)
  await c.sleep(400)
  check(await ev(`(()=>{const s=document.querySelector('.editor-bar-status');return s.querySelector('.n-base-selection').textContent.trim()==='完成'&&s.querySelector('.n-tag').textContent.trim()===(__g.work.activeChapter.wordCount||0)+' 字'})()`), 'the bar follows the chapter status and word count it is bound to')
  await ev(`(()=>{__g.work.setChapterStatus(__g.work.activeChapter.id,'draft');return true})()`)
  /* 右对齐量的是结果而不是 `margin-left:auto` 的字面值：Chromium 对弹性项的 auto 外边距
     在 getComputedStyle 里给出的是已解析的像素值（实测 503.8px），不是 'auto'。 */
  check(await ev(`(()=>{const bar=document.querySelector('.editor-toolbar').getBoundingClientRect(),s=document.querySelector('.editor-bar-status'),r=s.getBoundingClientRect();return r.right>=bar.right-22&&r.right<=bar.right+1&&r.left>bar.left&&!document.querySelector('.gravity-manuscript-head .editor-bar-status,.gravity-manuscript-head .gravity-manuscript-status')})()`), 'the status group is pinned to the right edge of the bar and no longer sits under the chapter title')
  await ev(`window.__gBodyPrefs={editorFont:__g.ui.editorFont,editorLatin:__g.ui.editorLatin,fontSize:__g.ui.fontSize};__g.ui.setPref('editorFont','jinghua').then(()=>__g.ui.setPref('editorLatin','playfair')).then(()=>__g.ui.setPref('fontSize',19)).then(()=>__g.ui.setSkin('original')).then(()=>__g.ui.setSkin('gravity')).then(()=>__g.ui.setSkin('glaze')).then(()=>true)`)
  check(await ev(`(()=>{const s=getComputedStyle(document.querySelector('.tiptap'));return s.fontFamily.includes('KingHwa OldSong')&&s.fontFamily.includes('Playfair Display')&&parseFloat(s.fontSize)===19&&__g.ui.editorFont==='jinghua'&&__g.ui.editorLatin==='playfair'&&__g.ui.fontSize===19})()`),'CJK, Latin and body size preferences survive all skin switches and remain effective')
  await ev(`__g.ui.setPref('editorFont',__gBodyPrefs.editorFont).then(()=>__g.ui.setPref('editorLatin',__gBodyPrefs.editorLatin)).then(()=>__g.ui.setPref('fontSize',__gBodyPrefs.fontSize)).then(()=>true)`)
  check(await ev(`getComputedStyle(document.querySelector('.n-tree-node--selected')).getPropertyValue('--n-node-color-active').trim()==='#cde3e6'`),'chapter selection uses the light teal component theme')
  // A skin change must not remount the editor or lose unsaved content/selection.
  await ev(`window.__gEditor=__ns.editor;__gEditor.commands.insertContent('验收文本');window.__gText=__gEditor.getText();window.__gSelection=__gEditor.state.selection.from;__g.ui.setSkin('original').then(()=>true)`)
  check(await ev(`__ns.editor===__gEditor&&__ns.editor.getText()===__gText&&__ns.editor.state.selection.from===__gSelection&&document.body.dataset.skin==='original'`), 'hot switch preserves editor instance, text and selection')
  check(await ev(`(()=>{const h=document.querySelector('.editor-head');return !document.querySelector('.editor-bar-status')&&!!h&&!!h.querySelector('.n-base-selection')&&!!h.querySelector('.n-tag')&&[...h.querySelectorAll('button')].some(b=>b.textContent.trim()==='历史')})()`), 'original keeps its own status / word count / history row above the toolbar')
  await shot('original')
  await ev('__g.ui.setSkin("glaze").then(()=>true)')
  for (const [tab, selector] of [['outline','.outline-surface'],['characters','.character-surface'],['lore','.lore-surface'],['snippets','.snippet-surface'],['chapters','.editor-wrap']]) {
    await ev(`[...document.querySelectorAll('.nav-rail .rail-item')].find(n=>n.textContent.trim()===${JSON.stringify({outline:'大纲',characters:'人物',lore:'设定',snippets:'灵感',chapters:'正文'}[tab])}).click()`)
    await wait(`__g.work.tab===${JSON.stringify(tab)}&&!!document.querySelector(${JSON.stringify(selector)})`)
    // Order and label spacing are presentation; compare a multiset of the actual original controls.
    // The two new tab buttons and outline-citation shortcut are checked separately.
    // Sanctioned skin-only swap on the outline page: gravity replaces the type-filter chip row with
    // the title-row count badge + gear and adds a per-card ⋯. Those are excluded from the parity
    // multiset here and asserted from both sides in tools/gravity-outline-verify.mjs.
    const signature = `JSON.stringify([...new Set([...document.querySelectorAll('.side-panel button,.side-panel [role="button"],.side-panel input,.center-pane button,.center-pane input,.center-pane textarea,.center-pane [contenteditable="true"],.right-panel button,.right-panel textarea,.module-agent button')])].filter(n=>!n.closest('.gravity-right-tabs,.gravity-dossier-heading,.ol-typefilter,.gravity-side-gear,.gv-more,.gravity-inspiration-assistant')).map(n=>JSON.stringify([n.tagName,n.title,n.getAttribute('placeholder'),n.tagName==='BUTTON'?n.textContent.replace(/\\s+/g,'').trim():''])).sort())`
    const gravityControls = await ev(signature)
    await ev(`__g.ui.setSkin('original').then(()=>true)`)
    check(await ev(signature)===gravityControls, tab+' original controls and editor fields match')
    await ev(`__g.ui.setSkin('glaze').then(()=>true)`)
    await wait(`!!document.querySelector('#studio-task-actions button')`)
    await ev(`document.querySelector('#studio-task-actions button').click()`)
    await wait(`!!document.querySelector('.task-form')`)
    check(await ev(`document.querySelectorAll('.task-form .n-select').length>=2`),tab+' relocated assistant opens original task form')
    await ev(`[...document.querySelectorAll('.task-actions button')].find(n=>n.textContent.trim()==='关闭').click()`)
    await wait(`!document.querySelector('.task-form')`)
    await shot(tab)
    await shot(tab+'-1080',1080,680)
    check(await ev(`(()=>{const a=document.querySelector('.center-pane').getBoundingClientRect(),b=document.querySelector('.nav-rail').getBoundingClientRect();return a.top>=b.bottom&&a.width>250&&b.right<=innerWidth&&b.left>=0&&document.documentElement.scrollWidth<=innerWidth})()`), tab+' usable minimum-size layout and unobscured navigation')
    if(tab==='outline')check(await ev(`document.querySelector('.ol-editor').getBoundingClientRect().top>=document.querySelector('.nav-rail').getBoundingClientRect().bottom`),'outline editable scroll viewport stays below navigation')
    if(tab==='snippets')check(await ev(`(()=>{const sheet=document.querySelector('.center-pane');return !!sheet.querySelector('#glaze-inspiration-tools .gravity-inspiration-assistant')&&sheet.scrollHeight>=sheet.clientHeight})()`),'inspiration instruction stays within the scrollable detail sheet')
  }
  await ev(`__g.ui.readMode=true`);await wait('!!document.querySelector(".read-mode")')
  check(await ev('!document.querySelector(".nav-rail") && __ns.editor.isEditable===false'), 'original reading mode remains read-only')
  await shot('reading');await ev('__g.ui.readMode=false')
  await ev('__g.ui.focusMode=true');check(await ev('!document.querySelector(".nav-rail")&&!document.querySelector(".side-panel")'), 'focus mode retains original behavior');await ev('__g.ui.focusMode=false')
  await ev(`__g.work.tab='outline';__g.work.outlineView='canvas'`);await wait('!!document.querySelector(".oc-canvas")')
  await shot('outline-canvas')
  const canvasCheck=await ev(`({kinds:['event','note','textbox','cite','anchor','container'].map(k=>[k,!!document.querySelector('.oc-'+k)]),arrange:!!document.querySelector('button[title="整理布局（固定模块除外）"]'),before:__gCanvasGeometry,after:__g.work.olnodes.map(({id,canvasX,canvasY,w,h,color})=>({id,canvasX,canvasY,w,h,color}))})`)
  assert.deepEqual(canvasCheck.after,canvasCheck.before,'canvas custom geometry must not change on skin switch')
  check(canvasCheck.kinds.every(([,found])=>found)&&canvasCheck.arrange&&canvasCheck.after.find(n=>n.color==='#619b86'), 'all six canvas kinds, custom color, canonical geometry and arrangement controls preserved')
  check(await ev(`(()=>{const b=document.querySelector('.glaze-module-menu');return !!b&&getComputedStyle(b).opacity==='1'&&b.getBoundingClientRect().width>=24})()`),'outline module actions are discoverable without hover')
  await ev(`(()=>{const row=[...document.querySelectorAll('.ol-side-root .side-item')].find(n=>n.textContent.includes('星港来信'));row.querySelector('.glaze-module-menu').click();return true})()`)
  await wait(`[...document.querySelectorAll('.n-dropdown-option-body')].some(n=>n.textContent==='重命名')`)
  await ev(`[...document.querySelectorAll('.n-dropdown-option-body')].find(n=>n.textContent==='重命名').click()`)
  await wait(`!!document.querySelector('.n-dialog input')`)
  await ev(`(()=>{const input=document.querySelector('.n-dialog input');input.value='星港来信 · 校订';input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new KeyboardEvent('keyup',{key:'Enter',bubbles:true}));return true})()`)
  await wait(`!document.querySelector('.n-dialog')&&__g.work.olnodes.some(n=>n.title==='星港来信 · 校订')`)
  check(true,'visible module menu invokes the original rename dialog and updates the real node')
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
  await ev(`window.__graphSelection=__g.work.selCharacterId;__g.ui.setSkin('original').then(()=>__g.ui.setSkin('gravity')).then(()=>__g.ui.setSkin('glaze')).then(()=>true)`)
  check(JSON.stringify(await ev(`__g.work.loadCharGraph()`))===JSON.stringify(graphAfter)&&await ev(`__g.work.selCharacterId===__graphSelection`),'graph skin round trip preserves canonical positions and selected character')
  await ev(`(()=>{const from=[...document.querySelectorAll('.rg-node')].find(n=>n.textContent.includes('陆沉')),to=[...document.querySelectorAll('.rg-node')].find(n=>n.textContent.includes('沈砚')),a=from.querySelector('.rg-apt[data-side="right"]'),r=a.getBoundingClientRect(),t=to.getBoundingClientRect();a.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,clientX:r.left+r.width/2,clientY:r.top+r.height/2}));window.dispatchEvent(new MouseEvent('mousemove',{clientX:t.left+t.width/2,clientY:t.top+t.height/2}));window.dispatchEvent(new MouseEvent('mouseup',{clientX:t.left+t.width/2,clientY:t.top+t.height/2}));return true})()`)
  await wait(`!!document.querySelector('.rg-relinput input')`)
  await ev(`(()=>{const i=document.querySelector('.rg-relinput input');i.value='对立';i.dispatchEvent(new Event('input',{bubbles:true}));i.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));return true})()`)
  check(await ev(`__g.work.relations.some(r=>r.label==='对立'&&r.fromSide==='right'&&!!r.toSide)&&document.querySelectorAll('.rg-elabel').length===2`),'portrait hit boxes and projected ports create a real labeled relationship')
  await ev(`document.querySelector('button[title="适应视图"]').click()`)
  await shot('character-graph')
  check(await ev('document.querySelectorAll(".rg-node").length===3'), 'character graph preserves all real characters')
  await ev(`__g.work.charView='list'`);await wait('!!document.querySelector(".character-surface")')
  await ev(`(()=>{const n=document.querySelector('.character-surface textarea');n.value='人物小传保存验收';n.dispatchEvent(new Event('input',{bubbles:true}));return true})()`)
  check(await ev('__g.work.activeCharacter.content==="人物小传保存验收"'), 'real character form still updates its store')
  await ev(`__g.work.tab='lore'`);await wait('!!document.querySelector(".ob-row")')
  await ev(`[...document.querySelectorAll('.ob-row')].find(n=>n.textContent.includes('星图系统')).dispatchEvent(new MouseEvent('dblclick',{bubbles:true}))`)
  await wait('!!document.querySelector(".ldt-page")');await shot('lore-detail')
  check(await ev(`!!document.querySelector('.gravity-detail-orbit')&&!!document.querySelector('.ldt-graph')&&document.querySelectorAll('.ldt-kid').length===4&&document.querySelector('.gravity-detail-content').textContent.includes('更深层观测规则')`), 'lore detail retains breadcrumbs, graph and recursive child navigation with orbital artwork')
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
  settings=await connect('panel=', '9224');await init(settings)
  await wait('!!document.querySelector(".sw-root")',settings)
  await wait('document.querySelector(".app-root").dataset.skin==="glaze"',settings)
  check(await ev(`document.querySelector('.app-root').dataset.skin==='glaze'&&getComputedStyle(document.querySelector('.app-root')).getPropertyValue('--bg').trim()==='#e7eff1'`,settings), 'independent settings uses matching root tokens')
  await shot('settings-reference',1440,900,settings)
  await shot('settings',1000,700,settings)
  for(const page of ['模型设置','数据','关于']) {
    await ev(`[...document.querySelectorAll('.sw-nav-item')].find(n=>n.textContent.includes(${JSON.stringify(page)})).click()`,settings)
    await c.sleep(150)
    check(await ev(`document.querySelector('.sw-h').textContent===${JSON.stringify(page)}`,settings), 'settings retains '+page)
  }
  await ev(`__g.ui.setSkin('original').then(()=>true)`,settings);await wait('document.body.dataset.skin==="original"')
  check(await ev(`document.querySelector('.app-root').dataset.skin==='original'`,settings), 'settings skin switch synchronizes main window')
  await ev(`__g.ui.setSkin('glaze').then(()=>true)`,settings);await wait('document.body.dataset.skin==="glaze"')
  await ev(`__g.ui.setPref('fontSize',20).then(()=>true)`,settings);await wait('__g.ui.fontSize===20')
  await closePanel(settings);settings=null
  for(const type of ['chapter','outline','characters','lore','snippets']) {
    await ev(`(async()=>{const {autosave}=await import('/src/services/autosave.js');await autosave.flushAll();__g.work.tab=${JSON.stringify(type==='chapter'?'chapters':type)};const entities={chapter:__g.work.selChapterId,characters:__g.work.selCharacterId,snippets:__g.work.selSnippetId};const {popOut}=await import('/src/services/panelwindows.js');return popOut(__g.work,${JSON.stringify(type)},entities[${JSON.stringify(type)}]||'','验收面板')})()`)
    const until=Date.now()+10000
    while(!(await(await fetch('http://127.0.0.1:9224/json/list')).json()).some(t=>t.url.includes('panel='+type))) {
      assert.ok(Date.now()<until,'native module panel appears');await c.sleep(80)
    }
    settings=await connect('panel='+type,'9224');await init(settings)
    await wait('!!document.querySelector(".panel-body")&&document.querySelector(".app-root").dataset.skin==="glaze"',settings)
    check(await ev(`getComputedStyle(document.querySelector('.app-root')).getPropertyValue('--bg-panel').trim()==='#f3f8f9'&&!!document.querySelector('.side-panel')&&!!document.querySelector('.center-pane')`,settings), type+' independent panel retains full module and skin')
    await wait(type==='chapter'?`!!document.querySelector('.panel-lock-note')&&getComputedStyle(document.querySelector('.panel-lock-note')).display!=='none'`:`!!document.querySelector('.pop-lock-pane')`)
    await shot('panel-'+type,1080,680,settings)
    await shot('panel-'+type+'-800',800,500,settings)
    check(await ev(`document.documentElement.scrollWidth<=innerWidth&&document.querySelector('.center-pane').getBoundingClientRect().width>=250`,settings),type+' native minimum-size panel remains usable')
    if(type==='outline')check(await ev(`document.querySelector('.oc-canvas').getBoundingClientRect().height>=260&&document.querySelector('.ol-side-root>.side-list').getBoundingClientRect().height>=110`,settings),'800px outline panel reserves space for a whole event card and a scrollable module tree')
    if(type==='snippets')check(await ev(`(()=>{const n=document.querySelector('.snippet-catalog .side-item'),d=n.querySelector('.gravity-snippet-date');return n.getBoundingClientRect().width>=120&&d.getBoundingClientRect().height<20&&getComputedStyle(document.querySelector('.snippet-catalog>.side-list')).gridTemplateColumns.split(' ').length===1})()`,settings),'minimum native inspiration panel uses readable single-column cards and one-line timestamps')
    if(type==='snippets'){
      await ev(`document.querySelector('.gravity-inspiration-assistant button').click()`,settings)
      await wait(`!!document.querySelector('.glaze-inspiration-dialogue textarea')`,settings)
      check(await ev(`document.querySelector('.glaze-inspiration-dialogue textarea').value.includes('扩展成一个场景')`,settings),'independent inspiration opens visible discussion with the real prompt')
    }
    await closePanel(settings);settings=null
    await wait(type==='chapter'?`!document.querySelector('.panel-lock-note')||getComputedStyle(document.querySelector('.panel-lock-note')).display==='none'`:`!document.querySelector('.pop-lock-pane')`)
    check(true,type+' panel closing restores main editor')
  }
  await ev(`__g.work.tab='snippets';native.panelOpen({type:'ai',workId:__g.work.work.id,entityId:'',title:'恍然梦验收'})`)
  await c.sleep(500)
  settings=await connect('panel=ai','9224');await init(settings)
  await wait(`!document.querySelector('.ai-dock')`)
  await ev(`document.querySelector('.gravity-inspiration-assistant button').click()`)
  await wait(`!!document.querySelector('.glaze-inspiration-dialogue textarea')`)
  check(await ev(`document.querySelector('.glaze-inspiration-dialogue textarea').value.includes('扩展成一个场景')&&!document.querySelector('.ai-dock')`),'inspiration remains actionable when AI is detached')
  await ev(`document.querySelector('.glaze-inspiration-dialogue .n-base-close').click()`)
  await closePanel(settings);settings=null
  // Flush and reopen proves the original autosave path still persists our edits.
  await ev(`__g.work.closeWork().then(()=>__g.work.open(${JSON.stringify(id)})).then(()=>true)`)
  check(await ev(`__g.work.characters.some(n=>n.content==='人物小传保存验收')&&__g.work.chapters.some(n=>n.content.includes('验收文本'))&&__g.work.olnodes.some(n=>n.title==='星港来信 · 校订')`), 'edits survive autosave and reopening')
  check(await ev(`!(__gWarnings||[]).some(w=>/Teleport|Unhandled error|TypeError/.test(w))`),'no presentation lifecycle or runtime errors');
  console.log('PASS glaze workbench integration suite')
} catch (error) {
  process.exitCode=1
  console.error(error)
  console.error(await ev(`({warnings:window.__gWarnings,agents:[...document.querySelectorAll('.module-agent')].map(n=>n.outerHTML.slice(0,300)),target:document.querySelector('#studio-task-actions')?.outerHTML,tab:__g.work.tab})`))
  await shot('failure').catch(()=>{})
} finally {
  if(settings)await closePanel(settings).catch(()=>{})
  if(id)await ev(`(async()=>{await __g.work.closeWork();const row=await __ns.db.works.get(${JSON.stringify(id)});if(row)await __g.shelf.deleteWork(row);return true})()`)
  if(prefs)await ev(`(async()=>{await __ns.db.appconfig.clear();await __ns.db.appconfig.bulkPut(${JSON.stringify(prefs)});await __g.ui.loadPrefs();return true})()`)
  await c.send('Emulation.clearDeviceMetricsOverride')
  // CDP socket is intentionally retained by the shared helper.
  setTimeout(()=>process.exit(process.exitCode),100)
}
