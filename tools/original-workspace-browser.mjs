import {Browser} from 'file:///C:/Users/linque/.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs'
import assert from 'node:assert/strict'
import {mkdirSync,writeFileSync} from 'node:fs'
const phase=process.env.PHASE||'before',out='tools/_original-workspace/'+phase;mkdirSync(out,{recursive:true})
const b=await Browser.launch();const p=await b.newPage()
try{
 await p.goto('http://127.0.0.1:5192')
 for(let i=0;i<100;i++){if(await p.eval(()=>!!window.__ns&&!!document.querySelector('.app-root')))break;await new Promise(r=>setTimeout(r,100))}
 await p.eval(`(async()=>{const {useUiStore}=await import('/src/stores/ui.js');const {useShelfStore}=await import('/src/stores/shelf.js');window.w=__ns.getWork();window.u=useUiStore(w._p);window.s=useShelfStore(w._p);await u.setSkin('original');const row=await s.createWork({title:'长街书房 · 工作区体验验收',author:'林间',genre:'都市',status:'连载',kind:'cedar',withVolume:true});await w.open(row.id);for(const title of ['第一章 午后旧书店','第二章 那封未寄出的信','第三章 灯火与归途']){const ch=await w.addChapter(w.volumes[0]?.id,title);w.setChapterContent(ch.id,'<p>斜阳穿过窗棂，落在书桌的一角。她翻开那本旧书，纸页间藏着一封没有寄出的信。</p><p>街上的行人慢慢走远，书店里只剩下钟表的声音。故事从这个午后开始。</p>')}const c=w.addCharacter('林晚');w.updateCharacter(c.id,{role:'主角',bio:'旧书店的店主。温和、敏锐，正寻找一封信背后的故事。'});w.addCharacter('陈远');w.addSnippet('雨夜重逢\\n\\n旧书店打烊后，一位陌生客人带来了一本没有结尾的手稿。');w.mubuAddInCurrentSet('长街书店');u.workbenchMode='writing';w.tab='chapters';return true})()`)
 await p.eval(()=>document.fonts.ready.then(()=>true));await new Promise(r=>setTimeout(r,500));await p.eval(()=>__ns.editor.commands.setContent('<p>斜阳穿过窗棂，落在书桌的一角。她翻开那本旧书，纸页间藏着一封没有寄出的信。</p><p>街上的行人慢慢走远，书店里只剩下钟表的声音。故事从这个午后开始。</p>',true))
 for(const tab of ['chapters','outline','lore','characters','snippets']){await p.eval(value=>w.tab=value,tab);await new Promise(r=>setTimeout(r,200));await p.screenshot({path:out+'/'+tab+'-1440.png',format:'png'})}
 if(phase==='after'){
  const wait=async expr=>{for(let i=0;i<160;i++){if(await p.eval(expr))return;await new Promise(r=>setTimeout(r,80))}throw new Error('Timeout '+expr)}
  await p.eval(()=>{w.tab='chapters';window.editorRef=__ns.editor})
  for(const theme of ['xuan','parchment','night']){
   await p.eval(value=>u.setPref('theme',value),theme)
   for(const tab of ['chapters','outline','lore','characters','snippets']){await p.eval(value=>w.tab=value,tab);await new Promise(r=>setTimeout(r,150));await p.screenshot({path:out+'/'+theme+'-'+tab+'.png',format:'png'});assert.ok(await p.eval(()=>document.documentElement.scrollWidth<=innerWidth),'theme page no overflow '+theme+' '+tab)}
  }
  await p.eval(()=>{u.setPref('theme','xuan');w.tab='chapters'})
  for(const width of [1080,800,390]){
   await p.setViewport({width,height:width===390?844:900});await new Promise(r=>setTimeout(r,200))
   for(const tab of ['chapters','outline','lore','characters','snippets']){await p.eval(value=>w.tab=value,tab);await new Promise(r=>setTimeout(r,150));assert.ok(await p.eval(()=>document.documentElement.scrollWidth<=innerWidth),'narrow no overflow '+width+' '+tab);await p.screenshot({path:out+'/'+tab+'-'+width+'.png',format:'png'})}
  }
  await p.eval(()=>{w.tab='chapters'});await p.setViewport({width:390,height:450});await p.screenshot({path:out+'/chapters-short.png',format:'png'})
  assert.ok(await p.eval(()=>__ns.editor===editorRef),'single editor across resizing and modules')
  await p.eval(()=>[...document.querySelectorAll('.ow-modulebar>button')].find(e=>e.textContent.includes('目录')).click());await wait('document.querySelector(".workbench-shell").dataset.owOpen==="directory"')
  assert.ok(await p.eval(()=>document.activeElement.closest('[data-ow-pane="directory"]')),'drawer receives focus')
  await p.screenshot({path:out+'/directory-390.png',format:'png'})
  await p.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await p.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await wait('!document.querySelector(".workbench-shell").dataset.owOpen')
  assert.ok(await p.eval(()=>document.activeElement.closest('.ow-modulebar')),'drawer returns focus')
  await p.eval(()=>[...document.querySelectorAll('.ow-modulebar>button')].find(e=>e.textContent.includes('批注')).click());await wait('document.querySelector(".workbench-shell").dataset.owOpen==="notes"');await p.screenshot({path:out+'/notes-390.png',format:'png'});await p.eval(()=>document.querySelector('[data-ow-pane="notes"] .ow-pane-close').click())
  await p.setViewport({width:1440,height:900});await p.eval(()=>{window.savedSelection=__ns.editor.state.selection;__ns.editor.commands.setTextSelection({from:1,to:6})})
  await p.eval(()=>{window.beforeContent=__ns.editor.getHTML();document.querySelector('.editor-toolbar button[title="加粗"]').click()});assert.ok(await p.eval(()=>__ns.editor.getHTML().includes('<strong>')),'format command preserves selected text')
  await p.eval(`(async()=>{window.auto=(await import('/src/services/autosave.js')).autosave;await auto.flushAll();window.chapterId=w.selChapterId;return true})()`)
  console.log('SAVE TRACE',await p.eval(()=>({target:__ns.editorTarget,selected:w.selChapterId,active:w.activeChapter?.content,html:__ns.editor.getHTML(),editable:__ns.editor.isEditable,pending:u.autosave.pending,error:u.autosave.error})))
  assert.equal(await p.eval(()=>__ns.db.chapters.get(chapterId).then(c=>c.content)),await p.eval(()=>__ns.editor.getHTML()))
  await p.eval(()=>{window.beforeHook=auto.hooks.beforePut;auto.hooks.beforePut=async()=>{throw new Error('验证：模拟保存失败')};__ns.editor.commands.insertContent('保存错误回归');})
  await p.eval(()=>auto.flushAll());assert.ok(await p.eval(()=>u.autosave.error&&u.autosave.pending>0),'real save failure retained')
  await p.screenshot({path:out+'/save-error.png',format:'png'})
  await p.eval(()=>{auto.hooks.beforePut=beforeHook;[...document.querySelectorAll('.ow-save-state button')].find(e=>e.getClientRects().length).click()});await wait('!u.autosave.error&&!u.autosave.pending&&!u.autosave.saving')
  await p.eval(()=>{window.originalChapters=[...w.chapters];for(let i=0;i<500;i++)w.chapters.push({...originalChapters[0],id:'bulk-'+i,title:'大规模章节'+i})})
  await p.eval(()=>{const input=document.querySelector('input[placeholder="搜索章节或卷名"]');input.value='大规模章节499';input.dispatchEvent(new Event('input',{bubbles:true}))});assert.ok(await p.eval(()=>document.querySelector('[data-ow-pane="directory"]').textContent.includes('大规模章节499')))
  await p.eval(()=>{w.chapters=originalChapters;const input=document.querySelector('input[placeholder="搜索章节或卷名"]');input.value='';input.dispatchEvent(new Event('input',{bubbles:true}))})
  await p.eval(()=>u.searchOpen=true);await wait('!!document.querySelector(".original-overlay")');await p.screenshot({path:out+'/search.png',format:'png'});await p.eval(()=>u.searchOpen=false)
  for(const key of ['exportOpen','statsOpen','trashOpen','helpOpen','importOpen']){await p.eval(k=>u[k]=true,key);await new Promise(r=>setTimeout(r,200));await p.screenshot({path:out+'/'+key+'.png',format:'png'});await p.eval(k=>u[k]=false,key)}
  await p.eval(()=>{window.priorEditor=__ns.editor;u.workbenchMode='agent'});assert.equal(await p.eval(()=>document.querySelector('.workbench-shell').classList.contains('original-workspace')),false);await p.eval(()=>u.workbenchMode='writing');assert.ok(await p.eval(()=>__ns.editor===priorEditor),'AI handoff keeps editor')
  for(const skin of ['gravity','glaze','crimson']){await p.eval(value=>u.setSkin(value),skin);assert.equal(await p.eval(()=>document.querySelectorAll('.original-workspace').length),0)}await p.eval(()=>u.setSkin('original'))
  await p.setViewport({width:720,height:450,dsf:2});assert.ok(await p.eval(()=>document.documentElement.scrollWidth<=innerWidth));await p.screenshot({path:out+'/zoom-equivalent.png',format:'png'})
  console.log('PASS themes, five modules, responsive, drawers/focus, shared editor, format, save/readback/failure/retry, 500 chapter search, dialogs, AI/skin isolation')
 }
 console.log({phase,errors:p.consoleErrors});assert.deepEqual(p.consoleErrors,[]);writeFileSync(out+'/result.json',JSON.stringify({passed:true,errors:p.consoleErrors},null,2))
}catch(error){writeFileSync(out+'/result.json',JSON.stringify({passed:false,error:error.message},null,2));throw error}finally{await b.close()}
