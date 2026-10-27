import assert from 'node:assert/strict'
import {mkdirSync,writeFileSync} from 'node:fs'
import {connect} from './_cdp-lib.mjs'
import {connectInspector,evalMain,captureWindow} from './_capture-main.mjs'
import {assertAiTestProfile} from './_ai-test-profile.mjs'
import {buildSeedExpr} from './verify-seeds.mjs'
process.env.AI_TEST_PROFILE='booksource-verify'
const c=await connect('app://',9333),ins=await connectInspector(),dir='docs/studio-writing-skins-20261026'
mkdirSync(dir,{recursive:true});assertAiTestProfile(await c.evalx('window.native.getDataLocation()'))
const seed=await c.evalx(buildSeedExpr('AI 验证书',{reset:true}));assert(seed?.ok)
await c.evalx(`window.__sceneLayoutSetup=(async()=>{const w=window.__ns.getWork(),ui=(await import('/src/stores/ui.js')).useUiStore();await w.open(${JSON.stringify(seed.books[0].workId)});ui.aiDrawerOpen=false;ui.sideWidth=252;await ui.setSkin('gravity');const first=w.selChapterId;for(const name of ['第二卷 · 渡口来信','第三卷 · 钟楼回声']){const v=await w.addVolume(name);for(let i=0;i<7;i++)await w.addChapter(v.id,name+' · '+(i+1)+' 夜航记录')}await w.addVolume('尚未落笔的空卷');w.selChapterId=first;w.selVolumeId=w.activeChapter.volumeId;w.renameChapter(first,'第一章 · 雾都启程，和那封尚未寄出的信');await new Promise(r=>setTimeout(r,150));const e=window.__ns.editor;e.commands.setContent('<p>'+Array.from({length:18},(_,i)=>['钟声从雾里传来时，林昭正站在渡口。水面上最后一盏灯还没有熄灭。','他把铜镜收回衣袖，沿着码头边缘缓缓向前。旧木板在脚下轻响，像有人隔着很远的地方回应。','“天亮之前，我们还有时间。”沈青梧没有回头，只把那封没有署名的信递给他。'][i%3]).join('</p><p>')+'</p>');await (await import('/src/services/autosave.js')).autosave.flushAll();window.__sceneLayout={w,ui,e};return true})();window.__sceneLayoutSetup`)
await captureWindow(ins,'127.0.0.1:5173/','tools/_scene-layout-visible.png',{exclude:'panel='})
const results=[]
for(const [width,height]of (process.argv.includes('--windows-only')?[]:[[1280,720],[1440,900],[1920,1080]])){
 await evalMain(ins,`(()=>{const{BrowserWindow}=require('electron');BrowserWindow.getAllWindows().find(w=>!w.webContents.getURL().includes('panel=')).setContentSize(${width},${height});return true})()`)
 for(const skin of ['gravity','glaze']){
  await c.evalx(`window.__sceneLayout.ui.setSkin('${skin}')`);await c.sleep(350)
  for(const side of [180,252,480]){
   await c.evalx(`window.__sceneLayout.ui.sideWidth=${side}`);await c.sleep(140)
   let baseline
   for(const paper of ['booklet','manuscript','hardcover']){
    await c.evalx(`window.__sceneLayout.ui.setWritingPaperStyle('${paper}')`);await c.sleep(130)
    const r=await c.evalx(`(()=>{const{e}=window.__sceneLayout;const names=['.chapter-catalog','.chapter-catalog .side-list','.catalog-masthead','.catalog-controls','.catalog-shortcuts','.rich-host','.editor-toolbar'];const overflow=names.map(sel=>{const el=document.querySelector(sel);return {sel,delta:el.scrollWidth-el.clientWidth,width:el.clientWidth}});const title=document.querySelector('.chapter-title-control'),doc=e.view.dom,s=getComputedStyle(doc),host=doc.closest('.rich-host');return {overflow,titleOK:title.scrollWidth<=title.clientWidth+1&&title.scrollHeight<=title.clientHeight+1,editorSame:e===window.__ns.editor&&doc.isConnected,bodyHeight:host.clientHeight,titleHeight:title.clientHeight,html:e.getHTML(),selection:e.state.selection.toJSON(),scroll:host.scrollTop,docWidth:doc.getBoundingClientRect().width,font:s.fontFamily,fontSize:s.fontSize,lineHeight:s.lineHeight,padding:s.padding,headingHeight:document.querySelector('.gravity-manuscript-head').getBoundingClientRect().height,toolbarHeight:document.querySelector('.editor-toolbar').clientHeight,art:getComputedStyle(document.querySelector('.catalog-art')).pointerEvents}})()`)
    assert(r.overflow.every(o=>o.delta<=1)&&r.titleOK&&r.editorSame&&r.bodyHeight>150&&r.art==='none',JSON.stringify({skin,side,paper,width,r}))
    if(baseline)for(const key of ['html','font','fontSize','lineHeight','padding','scroll','docWidth','headingHeight','toolbarHeight'])assert.deepEqual(r[key],baseline[key],`${skin}/${paper}/${key}`);else baseline=r
    results.push({skin,side,paper,viewport:[width,height],...Object.fromEntries(Object.entries(r).filter(([k])=>k!=='html'))})
    if(width===1440&&side===252){await c.evalx('document.activeElement?.blur()');await captureWindow(ins,'127.0.0.1:5173/',`${dir}/${skin}-${paper}.png`,{exclude:'panel='})}
   }
  }
  console.log(`PASS ${skin} ${width}×${height}: 3 sidebar widths × 3 papers`)
 }
}
// Long project/volume/chapter names, unbroken English, orphans and empty volumes.
await c.evalx(`window.__sceneBoundary=(async()=>{const{w,ui}=window.__sceneLayout;ui.sideWidth=180;w.work.title='当雾都最后一盏灯熄灭时，我们仍在寻找那封没有署名的来信';w.renameVolume(w.liveVolumes[0].id,'TheLongestVolumeNameWithoutSpaces'.repeat(3));w.renameChapter(w.selChapterId,'TheLongestChapterTitleWithoutSpaces'.repeat(4));await w.moveChapterTo(w.liveChapters.at(-1).id,'orphans','inside');await new Promise(r=>setTimeout(r,180));return true})();window.__sceneBoundary`)
for(const skin of ['gravity','glaze']){
 await c.evalx(`window.__sceneLayout.ui.setSkin('${skin}')`);await c.sleep(200)
 const r=await c.evalx(`(()=>{const rail=document.querySelector('.chapter-catalog'),t=document.querySelector('.chapter-title-control');return rail.scrollWidth<=rail.clientWidth+1&&t.scrollWidth<=t.clientWidth+1&&t.scrollHeight<=t.clientHeight+1&&!!document.querySelector('[data-volume-id="orphans"]')&&document.querySelectorAll('[data-volume-id]').length===window.__sceneLayout.w.liveVolumes.length+1})()`);assert.equal(r,true,skin+' boundary')
 await captureWindow(ins,'127.0.0.1:5173/',`${dir}/${skin}-long-names.png`,{exclude:'panel='})
}
console.log('PASS empty volumes, orphans, long unbroken names; 180px catalog')
await c.evalx(`window.__sceneLayout.w.work.title='AI 验证书';window.__sceneLayout.w.renameChapter(window.__sceneLayout.w.selChapterId,'第一章 · 雾都启程');window.__sceneLayout.w.renameVolume(window.__sceneLayout.w.liveVolumes[0].id,'第一卷 · 雾都来信');window.__sceneLayout.ui.sideWidth=252`)
// Real 800×500 chapter window, shared scene and host-supplied actions.
const opened=await c.evalx('document.querySelector(".catalog-shortcuts [data-action=window]").click();true');assert(opened)
let p
for(let i=0;i<60;i++){const pages=await(await fetch('http://127.0.0.1:9333/json/list')).json();if(pages.some(x=>x.url.includes('panel=chapter%3A'))){p=await connect('panel=chapter%3A',9333);break}await c.sleep(100)}
assert(p);assert.equal(await p.evalx("new URLSearchParams(location.search).get('panel')?.startsWith('chapter:')"),true)
try{
 for(let i=0;i<60&&!await p.evalx("!!document.querySelector('.chapter-catalog')");i++)await p.sleep(100)
 await evalMain(ins,"(()=>{const{BrowserWindow}=require('electron');BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('panel=chapter')).setContentSize(800,500);return true})()")
 for(const skin of ['gravity','glaze']){
  await p.send('Input.dispatchMouseEvent',{type:'mousePressed',x:790,y:480,button:'left',clickCount:1})
  await p.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:790,y:480,button:'left',clickCount:1})
  await p.sleep(250)
  await c.evalx(`window.__sceneLayout.ui.setSkin('${skin}')`);await p.sleep(250)
  await captureWindow(ins,'panel=chapter',`${dir}/${skin}-window-800.png`)
  const r=await p.evalx(`window.__scenePanel=(async()=>{const ui=(await import('/src/stores/ui.js')).useUiStore(),e=window.__ns.editor,html=e.getHTML(),button=document.querySelector('.catalog-shortcuts [data-action="window"]');const all=['.chapter-catalog','.catalog-shortcuts','.rich-host','.editor-toolbar'].map(s=>{const el=document.querySelector(s);return [s,el.scrollWidth-el.clientWidth,el.clientWidth]});const list=document.querySelector('.chapter-catalog .side-list');if(!button.disabled||button.textContent.trim()!=='当前窗口'||all.some(x=>x[1]>1)||list.clientHeight<160)return {all,disabled:button.disabled,listHeight:list.clientHeight};document.querySelector('.catalog-shortcuts [data-action="read"]').click();await new Promise(r=>setTimeout(r,150));const hidden=!document.querySelector('.chapter-catalog').getBoundingClientRect().width&&!e.isEditable;ui.readMode=false;await new Promise(r=>setTimeout(r,150));return hidden&&e===window.__ns.editor&&html===e.getHTML()})();window.__scenePanel`);assert.equal(r,true,JSON.stringify({skin,panel:r}));console.log(`PASS ${skin} independent 800×500, catalog height, current-window disabled, reading restore`)
  const paper=await p.evalx(`window.__panelPaper=(async()=>{const ui=(await import('/src/stores/ui.js')).useUiStore(),e=window.__ns.editor,html=e.getHTML(),wait=()=>new Promise(r=>setTimeout(r,180));for(const style of ['booklet','manuscript','hardcover']){const more=document.querySelector('button[title^="更多格式"]');if(!more.title.includes('纸面'))return {missingHint:true};let trigger=document.querySelector('.tb-paper-in-more [aria-label="纸面"]');if(!trigger?.getBoundingClientRect().width){more.click();await wait();trigger=document.querySelector('.tb-paper-in-more [aria-label="纸面"]')}trigger.click();await wait();const option=[...document.querySelectorAll('.writing-paper-menu-list [data-paper-choice="'+style+'"]')].find(b=>b.getBoundingClientRect().width);option.click();for(let i=0;i<30&&ui.writingPaperStyle!==style;i++)await wait();if(ui.writingPaperStyle!==style)return {style,actual:ui.writingPaperStyle}}document.querySelector('.tb-paper-in-more [aria-label="纸面"]').click();await wait();return e===window.__ns.editor&&html===e.getHTML()})();window.__panelPaper`);assert.equal(paper,true,JSON.stringify({skin,paper}));await captureWindow(ins,'panel=chapter',`${dir}/${skin}-window-paper-menu.png`);await p.evalx('document.body.click()');console.log(`PASS ${skin} compact paper menu switches all 3 materials`)
 }
}finally{await p.evalx('window.native.panelCloseSelf()')}
// Native zoom checks the real short viewport rather than scaling an image.
try{
 await evalMain(ins,"(()=>{const{BrowserWindow}=require('electron');const w=BrowserWindow.getAllWindows().find(w=>!w.webContents.getURL().includes('panel='));w.setContentSize(1920,1080);w.webContents.setZoomFactor(2);return true})()")
 for(const skin of ['gravity','glaze']){
  await c.evalx(`window.__sceneLayout.ui.setSkin('${skin}');window.__sceneLayout.ui.sideWidth=180`);await c.sleep(300)
  const ok=await c.evalx(`['.catalog-controls','.catalog-shortcuts','.editor-toolbar'].every(s=>{const e=document.querySelector(s);return e.scrollWidth<=e.clientWidth+1})`);assert.equal(ok,true,skin+' zoom 200%');await captureWindow(ins,'127.0.0.1:5173/',`${dir}/${skin}-zoom-200.png`,{exclude:'panel='})
 }
}finally{await evalMain(ins,"(()=>{const{BrowserWindow}=require('electron');BrowserWindow.getAllWindows().find(w=>!w.webContents.getURL().includes('panel=')).webContents.setZoomFactor(1);return true})()")}
console.log('PASS both skins at native 200% zoom')
writeFileSync(`${dir}/${process.argv.includes('--windows-only')?'window-results':'layout-results'}.json`,JSON.stringify({cases:results,windows:true,compactPaperMenu:true,zoom200:true},null,2));ins.ws.close();console.log(`${results.length}/${results.length} layout/editor cases, boundary cases and both independent scenes passed`);process.exit(0)
