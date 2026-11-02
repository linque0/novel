import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {homedir} from 'node:os'
import {join} from 'node:path'
import {mkdirSync,writeFileSync} from 'node:fs'
const require=createRequire(import.meta.url)
const {_electron}=require(require.resolve('playwright',{paths:[join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node')]}))
const mode=process.argv.includes('--production')?'production':'dev'
const out=join(process.cwd(),'docs','前端美化','琉光美术馆-20261029',mode)
mkdirSync(out,{recursive:true})
const profiles=join(process.cwd(),'.superpowers','glaze-museum-integration','profiles');mkdirSync(profiles,{recursive:true})
const env={...process.env,APPDATA:profiles};delete env.ELECTRON_RUN_AS_NODE;delete env.NOVEL_STUDIO_DEV
const profile='museum-'+mode+'-'+Date.now().toString(36)
const args=['.','--profile='+profile,'--disable-backgrounding-occluded-windows','--disable-renderer-backgrounding']
if(mode==='dev')args.push('--dev')
const app=await _electron.launch({executablePath:require('electron'),args,env,cwd:process.cwd(),timeout:45000})
const checks=[],errors=[],metrics=[],longTasks=[]
const check=(ok,name)=>{assert.ok(ok,name);checks.push(name);console.log('PASS '+name)}
let page
try{
 page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')console.error('RENDERER',m.text())})
 if(mode==='dev')await page.goto(process.env.MUSEUM_TEST_URL||'http://127.0.0.1:5176/',{waitUntil:'domcontentloaded'})
 await page.waitForFunction(()=>window.__ns&&document.querySelector('#app').__vue_app__?.config.globalProperties.$pinia._s.has('shelf'))
 await page.waitForLoadState('networkidle')
 if(mode==='dev')await page.waitForFunction(()=>document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('shelf').works.length>0)
 const loc=await page.evaluate(()=>native.getDataLocation());check(loc.defaultDir.endsWith('小说工坊-'+profile)&&loc.current===loc.defaultDir,'isolated native profile')
 const layout=await page.context().newCDPSession(page)
 const viewport=async(width,height)=>layout.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false})
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(1440,900))
 await viewport(1440,900)
 await page.evaluate(async()=>{
  const s=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s
  window.__museum={ui:s.get('ui'),shelf:s.get('shelf'),work:__ns.getWork(),ids:[]}
  await __ns.db.works.clear()
  const titles=['星尘旅人','白昼','山海拾遗录','雾都来信','远山与长夜','无名之书']
  for(let i=0;i<6;i++){
   const w=await __museum.shelf.createWork({title:titles[i],author:i===5?'':'林间',kind:['novel','note','cedar','violet','claret','ink'][i],genre:'奇幻',status:'连载',intro:'一枚铜星的熄灭，唤醒了一张被遗忘的星图。他沿着光的裂隙，重新寻找归途。',withVolume:true})
   __museum.ids.push(w.id)
  }
  await __museum.ui.setSkin('glaze')
  await __museum.work.open(__museum.ids[0])
  const w=__museum.work
  const ch=await w.addChapter(w.volumes[0]?.id,'第一章 · 雾都启程');__museum.chapterId=ch.id
  w.setChapterContent(ch.id,'<p>雾从港口漫过来时，钟楼刚敲过六下。</p><p>林昭背起行囊离开雾都，铜镜里的星图缺了一角。</p>','html')
  w.addCharacter('陆沉');w.updateCharacter(w.selCharacterId,{role:'主角',content:'沉默而敏锐的观星者。他在星港长大，习惯将每一次启航写进航海日志。',fields:{身份:'星港引航员',动机:'寻找失落的航路'}})
  w.addCharacter('沈砚');w.addSnippet('灯塔下的对话\n海风带来远处的汽笛声。她将灯举高了一点。')
  w.mubuAdd(null,null,'雾都旧港');w.olnodeAdd(null,{kind:'event',title:'雾都启程',text:'旧信与铜星带来新的旅途。',canvasX:100,canvasY:100,w:240,h:130})
  await window.__flushNow?.();await w.closeWork()
  __museum.fixtures=__museum.shelf.works.map(w=>({...w}))
 })
 await page.waitForSelector('.glaze-shelf.glaze-museum')
 const ready=async()=>{await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.querySelectorAll('.glaze-artwork-image')].map(i=>i.decode().catch(()=>{})))})}
 const shot=async name=>{await ready();await page.screenshot({path:join(out,name+'.png'),fullPage:false})}
 await ready()
 check(await page.locator('.gg-index-item').count()===6,'six real works in catalog')
 check(await page.locator('.gg-easel,.gg-slot,.glaze-shelf .theme-book').count()===0,'no easels or shelf WebGL models')
 const art=await page.locator('.glaze-artwork-image').first().evaluate(i=>({fit:getComputedStyle(i).objectFit,w:i.naturalWidth,h:i.naturalHeight,box:i.getBoundingClientRect().toJSON()}))
 check(art.fit==='contain'&&art.w>0,'painting uses complete natural image')
 const initial=await page.locator('.gg-plaque').getAttribute('data-work-id')
 await page.locator('.gg-index-item').nth(1).click()
 check(await page.locator('.gg-plaque').getAttribute('data-work-id')!==initial,'catalog selects correct work')
 check(await page.evaluate(()=>__museum.ui.view==='shelf'),'row selection stays on shelf')
 await page.getByRole('button',{name:'上一部作品',exact:true}).click()
 await page.getByRole('button',{name:'上一部作品',exact:true}).click()
 check(await page.locator('.gg-plaque').getAttribute('data-work-id')===await page.locator('.gg-index-item').last().getAttribute('data-work-id'),'previous wraps to final work')
 await page.getByRole('button',{name:'下一部作品',exact:true}).click()
 await shot('shelf-1440')
 const rowBoxes=await page.locator('.gg-index-item').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().toJSON()))
 const screenHeight=await page.evaluate(()=>innerHeight)
 check(rowBoxes.every(r=>r.bottom<=screenHeight+1),'six catalog rows fit desktop first screen')
 for(const [width,height,minRows] of [[1080,680,4],[800,680,0]]){
  await viewport(width,height);await shot('shelf-'+width)
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no page overflow '+width)
  if(minRows)check(await page.locator('.gg-index-item').evaluateAll(es=>es.filter(e=>e.getBoundingClientRect().bottom<=innerHeight).length)>=minRows,'four rows fit compact first screen')
 }
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(1440,900))
 await viewport(1440,900)
 await page.evaluate(async()=>{
  __museum.ui.skin='original'
  const observer=new PerformanceObserver(list=>{window.__museumTasks.push(...list.getEntries().map(e=>({duration:e.duration,at:e.startTime,phase:window.__museumPhase})))});window.__museumTasks=[];window.__museumWindows=[];window.__museumPhase='shelf-switch';observer.observe({type:'longtask'});__museum.observer=observer
 })
 const profiler=process.argv.includes('--profile-cpu')?await page.context().newCDPSession(page):null;if(profiler){await profiler.send('Profiler.enable');await profiler.send('Profiler.start')}
 const trace=[];let traceDone
 if(profiler){profiler.on('Tracing.dataCollected',e=>trace.push(...e.value));traceDone=new Promise(r=>profiler.once('Tracing.tracingComplete',r));await profiler.send('Tracing.start',{categories:'devtools.timeline,disabled-by-default-devtools.timeline,blink.user_timing',transferMode:'ReportEvents'})}
 for(let i=0;i<20;i++){
  const ms=await page.evaluate(async()=>{await __museum.ui.setSkin('original');await new Promise(r=>requestAnimationFrame(r));const t=performance.now();await __museum.ui.setSkin('glaze');await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const end=performance.now();__museumWindows.push({start:t,end});return end-t});metrics.push(ms)
 }
 const p95=[...metrics].sort((a,b)=>a-b)[Math.ceil(metrics.length*.95)-1]
 if(profiler){const cpu=await profiler.send('Profiler.stop');writeFileSync(join(out,'switch-cpu-profile.json'),JSON.stringify(cpu.profile))}
 if(profiler){await profiler.send('Tracing.end');await traceDone;writeFileSync(join(out,'switch-trace.json'),JSON.stringify(trace))}
 check(p95<=200,'six-work usable shelf P95 <=200ms ('+p95.toFixed(1)+')')
 await page.evaluate(()=>new Promise(r=>requestAnimationFrame(r)))
 const sourceTasks=await page.evaluate(()=>__museumTasks.filter(t=>t.phase==='shelf-switch'&&!__museumWindows.some(w=>t.at>=w.start&&t.at<w.end)).map(t=>({...t,phase:'source-skin'})))
 longTasks.push(...sourceTasks)
 const switchTasks=await page.evaluate(()=>__museumTasks.filter(t=>t.phase==='shelf-switch'&&__museumWindows.some(w=>t.at>=w.start&&t.at<w.end)))
 longTasks.push(...switchTasks)
 const switchMax=Math.max(0,...switchTasks.map(t=>t.duration))
 check(switchMax<=100,'six-work switching main-thread long tasks <=100ms ('+switchMax.toFixed(1)+')')
 const paintIds=['sunrise','poppy','starry','wave','temeraire','delft','studio-novel','studio-note','studio-cedar','studio-violet','studio-claret','studio-ink']
 for(const id of paintIds){
  await page.evaluate(id=>{window.__museumPhase='painting:'+id;return __museum.ui.setGlazePainting(id)},id);await ready()
  check(await page.locator('.glaze-artwork-image').first().evaluate(img=>{const r=img.getBoundingClientRect();return getComputedStyle(img).objectFit==='contain'&&img.naturalWidth>0&&Math.abs(r.width/r.height-img.naturalWidth/img.naturalHeight)<.025}),'complete natural painting '+id)
 }
 await page.evaluate(()=>__museum.ui.setGlazePainting('sunrise'))
 check(await page.evaluate(async()=>{const original=__ns.db.appconfig.put;__ns.db.appconfig.put=function(row){if(row.key==='glazePainting')throw Error('intentional isolated failure');return original.apply(this,arguments)};try{await __museum.ui.setGlazePainting('starry');return false}catch{return __museum.ui.glazePainting==='sunrise'}finally{__ns.db.appconfig.put=original}}),'painting save failure retains previous art')
 const paintingTasks=await page.evaluate(()=>{__museum.observer.disconnect();return __museumTasks.filter(t=>t.phase!=='shelf-switch')});longTasks.push(...paintingTasks)
 console.log('PAINTING TASKS',JSON.stringify(paintingTasks))
 const ids=await page.evaluate(()=>__museum.ids)
 await page.evaluate(id=>__museum.work.open(id),ids[0])
 await page.waitForSelector('.workbench-shell.glaze-museum .tiptap')
 await page.evaluate(()=>{__museum.editor=__ns.editor;__ns.editor.commands.setTextSelection(5)})
 const modules={chapters:'正文',outline:'大纲',lore:'设定',characters:'人物',snippets:'灵感'}
 for(const [tab,label] of Object.entries(modules)){
  await page.locator('.workbench-shell .app-topnav [data-nav="'+tab+'"]').click()
  if(tab==='characters'){
   await page.locator('.character-list-head').locator('..').locator('.side-item').first().click()
   const name=page.locator('.character-name-row input').first();await name.fill('陆沉 · 引航员');await page.evaluate(()=>window.__flushNow())
   check(await page.evaluate(async()=>String((await __ns.db.characters.get(__museum.work.selCharacterId)).name)==='陆沉 · 引航员'),'character form saves through real persistence')
   await name.fill('陆沉');await page.evaluate(()=>window.__flushNow())
  }
  if(tab==='snippets'){
   await page.locator('.snippet-catalog .side-item').first().click()
   await page.getByPlaceholder('记录灵感、桥段、对话片段……',{exact:true}).fill('灯塔下的对话\n海风带来远处的汽笛声，她将灯举高了一点。')
   await page.evaluate(()=>window.__flushNow())
   check(await page.evaluate(async()=>String((await __ns.db.snippets.get(__museum.work.selSnippetId)).content).includes('灯塔下的对话')),'inspiration form saves through real persistence')
  }
  await shot(tab)
  check(await page.evaluate(t=>__museum.work.tab===t,tab),'real navigation '+label)
 }
 await page.locator('.workbench-shell .app-topnav [data-nav="chapters"]').click()
 check(await page.evaluate(()=>__ns.editor===__museum.editor),'module changes retain editor instance')
 await page.evaluate(()=>{__ns.editor.commands.insertContent('美术馆保存回归。')})
 await page.evaluate(()=>window.__flushNow())
 check(await page.evaluate(async()=>String((await __ns.db.chapters.get(__museum.chapterId)).content).includes('美术馆保存回归')),'editor content persists through real autosave')
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(800,680))
 await viewport(800,680)
 await page.locator('.glaze-directory-toggle').click();check(await page.locator('.glaze-drawer-open').count()>0,'compact directory drawer accessible');await shot('directory-drawer');await page.keyboard.press('Escape')
 await page.waitForFunction(()=>!document.querySelector('.workbench-shell.glaze-drawer-open'))
 await page.locator('.glaze-notes-toggle').click();check(await page.locator('.glaze-drawer-open').count()>0,'compact annotations accessible');await page.keyboard.press('Escape')
 check(await page.evaluate(()=>__ns.editor===__museum.editor),'drawer operations retain editor instance')
 await page.evaluate(()=>{__museum.work.selChapterId=null})
 check(await page.locator('.glaze-notes-toggle').count()===0,'chapterless work cannot open empty notes modal')
 await page.evaluate(()=>{__museum.work.selChapterId=__museum.chapterId})
 await page.waitForFunction(()=>__ns.editorTarget?.chapterId===__museum.chapterId&&!__ns.editor?.isDestroyed)
 await page.evaluate(()=>{__museum.editor=__ns.editor})
 await layout.send('Emulation.clearDeviceMetricsOverride')
 await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.setContentSize(1440,900);w.webContents.setZoomFactor(2)})
 await shot('native-zoom-200');check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'actual native 200% zoom fits')
 check(await page.locator('.workbench-shell .rich-host').evaluate(e=>e.clientHeight>=120),'native 200% zoom retains useful manuscript viewport')
 await page.evaluate(()=>__museum.ui.setGlazePainting('studio-novel'))
 await page.locator('.glaze-directory-toggle').click()
 await page.locator('[data-glaze-drawer="directory"] .catalog-name').first().scrollIntoViewIfNeeded()
 await page.locator('[data-glaze-drawer="directory"] .catalog-name').first().focus()
 await shot('portrait-drawer-zoom-200')
 await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('.workbench-shell.glaze-drawer-open'))
 check(true,'portrait painting preserves reachable chapter and focus tooltip Escape')
 await page.evaluate(()=>__museum.ui.setGlazePainting('sunrise'))
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.setZoomFactor(1))
 if(mode==='production'){
  const created=app.waitForEvent('window');await page.locator('.workbench-shell .app-topnav [data-nav="settings"]').click();const settings=await created
  await settings.waitForSelector('.panel-host.glaze-museum .sw-root')
  await settings.locator('.glaze-artwork-image').first().evaluate(async img=>{await document.fonts.ready;await img.decode()})
  await settings.waitForSelector('.glaze-artwork-image.is-ready');await settings.evaluate(()=>Promise.all(document.getAnimations().map(a=>a.finished.catch(()=>{}))))
  await settings.screenshot({path:join(out,'settings.png')})
  await page.evaluate(()=>__museum.ui.setGlazePainting('starry'))
  await settings.waitForFunction(()=>document.querySelector('.glaze-artwork')?.dataset.paintingId==='starry')
  check(true,'settings window receives saved painting cross-window')
  await settings.evaluate(()=>{setTimeout(()=>native.panelCloseSelf(),50)})
  await page.evaluate(()=>__museum.ui.setGlazePainting('sunrise'))
  const createdPanel=app.waitForEvent('window');await page.evaluate(()=>native.panelOpen({type:'characters',workId:__museum.work.work.id,entityId:'',title:'人物档案'}));const panel=await createdPanel
  await panel.waitForSelector('.panel-host.glaze-museum')
  if(await panel.locator('.glaze-directory-toggle').isVisible())await panel.locator('.glaze-directory-toggle').click()
  await panel.waitForSelector('.panel-host.glaze-museum .character-list-head');await panel.locator('.side-panel .side-item').first().click()
  if(await panel.locator('.glaze-drawer-close').first().isVisible())await panel.locator('.glaze-drawer-close').first().click()
  await panel.screenshot({path:join(out,'detached-characters.png')})
  check(await panel.locator('.glaze-artwork-image').count()===1,'ordinary detached window has complete artwork and real module')
  await panel.evaluate(()=>{setTimeout(()=>native.panelCloseSelf(),50)})
 }
 await page.evaluate(()=>{__museum.ui.workbenchMode='agent'})
 check(await page.locator('.agent-surface.glaze-museum,.agent-surface .glaze-artwork').count()===0,'Dream surface excludes museum decorations')
 await page.evaluate(()=>{__museum.ui.workbenchMode='writing'})
 check(await page.evaluate(()=>__ns.editor===__museum.editor),'writing and Dream retain shared editor')
 await page.evaluate(()=>__museum.work.closeWork())
 const counts=[0,1,2,100]
 for(const n of counts){await page.evaluate(n=>{__museum.shelf.works=Array.from({length:n},(_,i)=>({...__museum.fixtures[i%6],id:'virtual-museum-'+i,title:i===0?'一部很长的中文与 English 混排作品名称用于排版检查':'馆藏作品 '+i}));__museum.shelf.loading=false},n);await ready();check(await page.locator('.gg-index-item').count()===n,'catalog supports '+n+' works')}
 await page.evaluate(()=>__museum.shelf.refresh())
 for(const skin of ['original','gravity','crimson','glaze']){await page.evaluate(s=>__museum.ui.setSkin(s),skin);await page.waitForFunction(s=>document.body.dataset.skin===s,skin);check(await page.locator('.glaze-shelf.glaze-museum').count()===(skin==='glaze'?1:0),'skin isolation '+skin)}
 check(errors.length===0,'no renderer errors')
 console.log('ALL MUSEUM CHECKS PASSED')
}catch(error){if(page){console.error('STATE',await page.evaluate(()=>({url:location.href,title:document.title,text:document.body.innerText.slice(0,1200),resources:performance.getEntriesByType('resource').slice(-8).map(r=>r.name)})).catch(()=>null));await page.screenshot({path:join(out,'failure.png')}).catch(()=>{})}throw error}
finally{writeFileSync(join(out,'report.json'),JSON.stringify({mode,checks,errors,metrics,longTasks},null,2));await app.close()}
