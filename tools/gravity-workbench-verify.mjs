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
  const frame = await Promise.race([client.send('Page.captureScreenshot', { format: 'png' }), new Promise((_, reject) => setTimeout(() => reject(new Error('Screenshot timeout')), 10000))])
  await writeFile(new URL(`./_gravity-work-${name}.png`, import.meta.url), Buffer.from(frame.data, 'base64'))
}
async function init(client = c) {
  await wait('!!window.__ns && !!document.querySelector(".app-root")', client)
  await client.send('Emulation.setFocusEmulationEnabled', { enabled: true })
  await ev(`(async()=>{const {useUiStore}=await import('/src/stores/ui.js');const {useShelfStore}=await import('/src/stores/shelf.js');window.__g={ui:useUiStore(),shelf:useShelfStore(),work:__ns.getWork()};return true})()`, client)
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
    if(__g.work.work)await __g.work.closeWork();
    const row=await __g.shelf.createWork({title:'星尘旅人',author:'林间',genre:'科幻',status:'连载',kind:'novel',intro:'一枚铜星，唤醒了一张遗忘的星图。',withVolume:true});
    await __g.ui.setSkin('gravity');await __g.work.open(row.id);
    const w=__g.work;
    const ch=await w.addChapter(w.volumes[0]?.id,'第一章 星海来信');
    w.toggleChapterBookmark(ch.id);
    w.setChapterContent(ch.id,'夜色漫过舷窗，远处的星辰缓缓亮起。\\n她将铜星放在桌面，几条细线从星图的边缘浮现。\\n“航路没有消失。”她说，“只是我们还没有读懂。”');
    w.addCharacter('陆沉');w.updateCharacter(w.selCharacterId,{role:'主角',aliases:'观星者',tags:['引航员'],fields:{身份:'星港引航员',动机:'寻找失落的航路'},content:'沉默而敏锐的观星者。他在星港长大，习惯将每一次告别写进航海日志。'});
    const second=w.addCharacter('叶青');w.updateCharacter(second.id,{role:'配角',content:'收集古老星图的档案员。'});
    w.selCharacterId=w.liveCharacters.find(c=>c.name==='陆沉').id;
    w.addSnippet('如果星图记录的不是航路，而是每一个曾经抵达过那里的人呢？\\n\\n她将铜星收进口袋，决定从那封没有署名的信开始。');
    w.addSnippet('雾港来信\\n一封没有寄件人的信，提起父亲从未抵达的海岸。');
    w.addSnippet('白鸽的约定\\n她带走的并非手稿，而是另一个人的姓名。');
    w.addSnippet('第十二声钟响\\n如果钟声不是报时，而是唤醒一段被抹去的记忆。');
    const root=w.mubuAdd(null,null,'星图系统');window.__gRoot=root.id;
    const copper=w.mubuAdd(root.id,null,'铜星：用于记录航路的古老载体');w.mubuAdd(copper.id,null,'铜星记录观测者的位置与记忆。');
    w.mubuAdd(root.id,null,'失落坐标：尚未解明的航行规律');
    const co=w.olnodeAdd(null,{kind:'container',title:'第一卷 · 失落的星图',canvasX:70,canvasY:70,w:600,h:300});
    w.olnodeAdd(co.id,{kind:'event',title:'星港来信',text:'一封迟到的来信，改变了原定航程。',canvasX:100,canvasY:140,w:210,h:100});
    w.olnodeAdd(co.id,{kind:'note',title:'伏笔',text:'铜星上刻着熟悉的名字。',canvasX:360,canvasY:160,w:210,h:100});
    const end=w.olnodeAdd(null,{kind:'event',title:'启航',text:'在黎明到来之前离开星港。',canvasX:290,canvasY:450,w:230,h:100});w.selOlnodeId=end.id;
    w.tab='chapters';w.outlineView='text';w.charView='list';__g.ui.aiDrawerOpen=false;__g.ui.focusMode=false;__g.ui.readMode=false;
    await __g.ui.setPref('rightPanelOpen',true);await __g.ui.setPref('sideWidth',252);return row.id;
  })()`)
  await wait('!!document.querySelector(".tiptap")')
  await ev(`__ns.editor.commands.setContent('<p>夜色漫过舷窗，远处的星辰缓缓亮起。</p><p>她将铜星放在桌面，几条细线从星图的边缘浮现。</p><p>“航路没有消失。”她说，“只是我们还没有读懂。”</p>')`)
  check(await ev(`document.body.dataset.skin==='gravity'&&getComputedStyle(document.querySelector('.app-root')).getPropertyValue('--bg-panel').trim()==='#14212c'`), 'workbench gravity tokens')
  check(await ev(`document.querySelectorAll('.nav-rail .rail-item').length===7 && [...document.querySelectorAll('.nav-rail .oicon')].every(s=>s.children.length)&&!!document.querySelector('.gravity-masthead button[aria-pressed]')`), 'seven module/shelf/settings entries and independent AI masthead control')
  await shot('chapters')
  check(await ev(`getComputedStyle(document.querySelector('.n-tree-node--selected')).backgroundColor==='rgb(36, 51, 64)'`),'chapter selection uses blue slate rather than the component accent tint')
  // A skin change must not remount the editor or lose unsaved content/selection.
  await ev(`window.__gEditor=__ns.editor;__gEditor.commands.insertContent('验收文本');window.__gText=__gEditor.getText();window.__gSelection=__gEditor.state.selection.from;__g.ui.setSkin('original').then(()=>true)`)
  check(await ev(`__ns.editor===__gEditor&&__ns.editor.getText()===__gText&&__ns.editor.state.selection.from===__gSelection&&document.body.dataset.skin==='original'`), 'hot switch preserves editor instance, text and selection')
  await shot('original')
  await ev('__g.ui.setSkin("gravity").then(()=>true)')
  for (const [tab, selector] of [['outline','.outline-surface'],['characters','.character-surface'],['lore','.lore-surface'],['snippets','.snippet-surface'],['chapters','.editor-wrap']]) {
    await ev(`[...document.querySelectorAll('.nav-rail .rail-item')].find(n=>n.textContent.trim()===${JSON.stringify({outline:'大纲',characters:'人物',lore:'设定',snippets:'灵感',chapters:'正文'}[tab])}).click()`)
    await wait(`__g.work.tab===${JSON.stringify(tab)}&&!!document.querySelector(${JSON.stringify(selector)})`)
    // Order and label spacing are presentation; compare a multiset of the actual original controls.
    // The two new tab buttons and outline-citation shortcut are checked separately.
    // Sanctioned skin-only swap on the outline page: gravity replaces the type-filter chip row with
    // the title-row count badge + gear and adds a per-card ⋯. Those are excluded from the parity
    // multiset here and asserted from both sides in tools/gravity-outline-verify.mjs.
    // gravity additionally appends the row's badge to the row tooltip (`第一卷 · 1项`); that is the
    // same sanctioned decoration, so the comparison strips a badge-shaped tail before comparing.
    // Two more sanctioned swaps, each excluded only on its own tab and pinned by an assertion below:
    //   characters — gravity moves 恍然梦：丰富 / 删除 into the dossier header (already excluded) and puts
    //                设头像/换头像 under the portrait as `.gravity-avatar-action`, then swaps the tag
    //                multi-select for the chip editor (+ / × / 输入标签) inside `.character-alias-row`;
    //                those two controls are asserted directly instead of through the multiset
    //                (the alias input exists on both sides);
    //   snippets   — gravity turns the inline quick-capture (textarea + 记录) into a popover whose
    //                trigger is 「记录灵感」, so `.side-head` is compared by the assertions below.
    const swap = tab === 'characters' ? ',.character-alias-row,.character-tag-select,.gravity-avatar-action' : tab === 'snippets' ? ',.side-head' : ''
    const signature = `(()=>{const badge=/[ \\t]*·[ \\t]*(?:(?:\\d+字|\\d+项|↔\\d+)[ \\t]*)+$/;const strip=t=>t?t.replace(badge,'').trim():t;return JSON.stringify([...new Set([...document.querySelectorAll('.side-panel button,.side-panel [role="button"],.side-panel input,.center-pane button,.center-pane input,.center-pane textarea,.center-pane [contenteditable="true"],.right-panel button,.right-panel textarea,.module-agent button')])].filter(n=>!n.closest('.gravity-right-tabs,.gravity-dossier-heading,.ol-typefilter,.gravity-side-gear,.gv-more${swap}')).map(n=>JSON.stringify([n.tagName,strip(n.title),n.getAttribute('placeholder'),n.tagName==='BUTTON'?n.textContent.replace(/\\s+/g,'').trim():''])).sort())})()`
    const gravityControls = await ev(signature)
    if (tab === 'characters') check(await ev(`(()=>{const h=document.querySelector('.gravity-dossier-heading'),r=document.querySelector('.gravity-character-meta-row'),a=document.querySelector('.gravity-avatar-action');return !!h&&/丰富/.test(h.textContent)&&/删除/.test(h.textContent)&&!!a&&/头像/.test(a.textContent)&&!!document.querySelector('.gravity-tag-add')&&!!r&&!!r.querySelector('input[placeholder="别名（用 / 分隔）"]')})()`), 'gravity keeps enrich / delete in the dossier header, the avatar action under the portrait and tags as chips')
    if (tab === 'snippets') check(await ev(`document.querySelector('.gravity-quick-trigger')?.textContent.trim()==='记录灵感'`), 'gravity reaches quick capture through the 记录灵感 popover trigger')
    await ev(`__g.ui.setSkin('original').then(()=>true)`)
    check(await ev(signature)===gravityControls, tab+' original controls and editor fields match')
    if (tab === 'characters') check(await ev(`(()=>{const r=document.querySelector('.character-alias-row'),h=document.querySelector('.gravity-dossier-heading');return !!r&&r.textContent.includes('删除')&&r.textContent.includes('恍然梦：丰富')&&!h&&!!document.querySelector('.character-tag-select')})()`), 'original keeps the character row actions inline and tags in the multi-select')
    if (tab === 'snippets') check(await ev(`[...document.querySelectorAll('.side-head button')].some(b=>b.textContent.trim()==='记录')`), 'original keeps the inline quick-capture button')
    await ev(`__g.ui.setSkin('gravity').then(()=>true)`)
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
    if(tab==='snippets')check(await ev(`(()=>{const card=document.querySelector('.gravity-inspiration-assistant'),button=card.querySelector('button'),r=button.getBoundingClientRect(),n=document.querySelector('.nav-rail').getBoundingClientRect();return r.bottom<=n.top&&card.getBoundingClientRect().bottom<=n.top&&button.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2))})()`),'inspiration CTA and final copy fit safely above dock and receive pointer events')
  }
  await ev(`__g.ui.readMode=true`);await wait('!!document.querySelector(".read-mode")')
  check(await ev('!document.querySelector(".nav-rail") && __ns.editor.isEditable===false'), 'original reading mode remains read-only')
  await shot('reading');await ev('__g.ui.readMode=false')
  await ev('__g.ui.focusMode=true');check(await ev('!document.querySelector(".nav-rail")&&!document.querySelector(".side-panel")'), 'focus mode retains original behavior');await ev('__g.ui.focusMode=false')
  await ev(`__g.work.tab='outline';__g.work.outlineView='canvas'`);await wait('!!document.querySelector(".oc-canvas")')
  await shot('outline-canvas')
  check(await ev(`document.querySelectorAll('.oc-node').length>=4 && !!document.querySelector('button[title="整理布局（固定模块除外）"]')`), 'free canvas nodes, containers and arrangement controls preserved')
  await ev(`document.querySelector('button[title="放大"]').click()`)
  await ev(`__g.work.tab='characters';__g.work.charView='graph'`);await wait('!!document.querySelector(".rg-canvas")')
  await shot('character-graph')
  check(await ev('document.querySelectorAll(".rg-node").length===2'), 'character graph preserves all real characters')
  await ev(`__g.work.charView='list'`);await wait('!!document.querySelector(".character-surface")')
  await ev(`(()=>{const n=document.querySelector('.character-surface textarea');n.value='人物小传保存验收';n.dispatchEvent(new Event('input',{bubbles:true}));return true})()`)
  check(await ev('__g.work.activeCharacter.content==="人物小传保存验收"'), 'real character form still updates its store')
  await ev(`__g.work.tab='lore'`);await wait('!!document.querySelector(".ob-row")')
  await ev(`[...document.querySelectorAll('.ob-row')].find(n=>n.textContent.includes('星图系统')).dispatchEvent(new MouseEvent('dblclick',{bubbles:true}))`)
  await wait('!!document.querySelector(".ldt-page")');await shot('lore-detail')
  check(await ev(`!!document.querySelector('.gravity-detail-orbit')&&!!document.querySelector('.ldt-graph')&&document.querySelectorAll('.ldt-kid').length===3`), 'lore detail retains breadcrumbs, graph and recursive child navigation with orbital artwork')
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
  settings=await connect('panel=', '9223');await init(settings)
  await wait('!!document.querySelector(".sw-root")',settings)
  await wait('document.querySelector(".app-root").dataset.skin==="gravity"',settings)
  check(await ev(`document.querySelector('.app-root').dataset.skin==='gravity'&&getComputedStyle(document.querySelector('.app-root')).getPropertyValue('--bg').trim()==='#0b131d'`,settings), 'independent settings uses matching root tokens')
  await shot('settings',1000,700,settings)
  for(const page of ['模型设置','数据','关于']) {
    await ev(`[...document.querySelectorAll('.sw-nav-item')].find(n=>n.textContent.includes(${JSON.stringify(page)})).click()`,settings)
    await c.sleep(150)
    check(await ev(`document.querySelector('.sw-h').textContent===${JSON.stringify(page)}`,settings), 'settings retains '+page)
  }
  await ev(`__g.ui.setSkin('original').then(()=>true)`,settings);await wait('document.body.dataset.skin==="original"')
  check(await ev(`document.querySelector('.app-root').dataset.skin==='original'`,settings), 'settings skin switch synchronizes main window')
  await ev(`__g.ui.setSkin('gravity').then(()=>true)`,settings);await wait('document.body.dataset.skin==="gravity"')
  await ev(`__g.ui.setPref('fontSize',20).then(()=>true)`,settings);await wait('__g.ui.fontSize===20')
  await ev(`native.panelCloseSelf()`,settings);settings=null
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
    if(type==='snippets')check(await ev(`(()=>{const n=document.querySelector('.snippet-catalog .side-item'),d=n.querySelector('.gravity-snippet-date');return n.getBoundingClientRect().width>=120&&d.getBoundingClientRect().height<20&&getComputedStyle(document.querySelector('.snippet-catalog>.side-list')).gridTemplateColumns.split(' ').length===1})()`,settings),'minimum native inspiration panel uses readable single-column cards and one-line timestamps')
    await ev('native.panelCloseSelf()',settings);settings=null
    await wait(type==='chapter'?`!document.querySelector('.panel-lock-note')||getComputedStyle(document.querySelector('.panel-lock-note')).display==='none'`:`!document.querySelector('.pop-lock-pane')`)
    check(true,type+' panel closing restores main editor')
  }
  // Flush and reopen proves the original autosave path still persists our edits.
  await ev(`__g.work.closeWork().then(()=>__g.work.open(${JSON.stringify(id)})).then(()=>true)`)
  check(await ev(`__g.work.characters.some(n=>n.content==='人物小传保存验收')&&__g.work.chapters.some(n=>n.content.includes('验收文本'))`), 'edits survive autosave and reopening')
  console.log('PASS gravity workbench integration suite')
} catch (error) {
  process.exitCode=1
  console.error(error)
  console.error(await ev(`({warnings:window.__gWarnings,agents:[...document.querySelectorAll('.module-agent')].map(n=>n.outerHTML.slice(0,300)),target:document.querySelector('#studio-task-actions')?.outerHTML,tab:__g.work.tab})`))
  await shot('failure').catch(()=>{})
} finally {
  if(settings)await ev('native.panelCloseSelf()',settings).catch(()=>{})
  if(id)await ev(`(async()=>{await __g.work.closeWork();const row=await __ns.db.works.get(${JSON.stringify(id)});if(row)await __g.shelf.deleteWork(row);return true})()`)
  if(prefs)await ev(`(async()=>{await __ns.db.appconfig.clear();await __ns.db.appconfig.bulkPut(${JSON.stringify(prefs)});await __g.ui.loadPrefs();return true})()`)
  await c.send('Emulation.clearDeviceMetricsOverride')
  // CDP socket is intentionally retained by the shared helper.
  setTimeout(()=>process.exit(process.exitCode),100)
}
