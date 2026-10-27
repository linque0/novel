import assert from 'node:assert/strict'
import {mkdirSync,writeFileSync} from 'node:fs'
import {connect} from './_cdp-lib.mjs'
import {connectInspector,evalMain,captureWindow} from './_capture-main.mjs'
import {assertAiTestProfile} from './_ai-test-profile.mjs'
import {buildSeedExpr} from './verify-seeds.mjs'
process.env.AI_TEST_PROFILE='booksource-verify'
const c=await connect('app://',9333),ins=await connectInspector(),dir='docs/chapter-title-wrap-20261025'
for(let i=0;i<60&&!await c.evalx('!!window.__ns?.getWork');i++)await c.sleep(100)
assertAiTestProfile(await c.evalx('window.native.getDataLocation()'));mkdirSync(dir,{recursive:true})
const seed=await c.evalx(buildSeedExpr('AI 验证书',{reset:true}));assert(seed?.ok)
const title='第一章 · 当雾都最后一盏灯熄灭时，那封没有署名的来信终于抵达钟楼与远方的渡口'
await c.evalx(`window.__titleSetup=(async()=>{const w=window.__ns.getWork(),ui=(await import('/src/stores/ui.js')).useUiStore();await w.open(${JSON.stringify(seed.books[0].workId)});ui.aiDrawerOpen=false;await ui.setSkin('original');w.renameChapter(w.selChapterId,${JSON.stringify(title)});window.__titleCheck={w,ui,title:${JSON.stringify(title)}};return true})();window.__titleSetup`)
await captureWindow(ins,'127.0.0.1:5173/','tools/_title-window-visible.png',{exclude:'panel='})
const results=[]
async function test(name,body){const r=await c.evalx(`window.__titlePending=(async()=>{const {w,ui,title}=window.__titleCheck,field=()=>[...document.querySelectorAll('.title-input,.crimson-chapter-title')].find(e=>e.getBoundingClientRect().height>0),wait=()=>new Promise(r=>setTimeout(r,120));${body}})();window.__titlePending`);results.push({name,ok:r===true,...(r===true?{}:{detail:r})});console.log((r===true?'PASS ':'FAIL ')+name+(r===true?'':' '+JSON.stringify(r)))}
for(const [width,height] of [[1280,720],[1440,900],[1920,1080]]){
  await evalMain(ins,`(()=>{const {BrowserWindow}=require('electron');BrowserWindow.getAllWindows().find(w=>!w.webContents.getURL().includes('panel=')).setContentSize(${width},${height});return true})()`)
  for(const skin of ['original','gravity','glaze','crimson']){
    await c.evalx(`window.__titleCheck.ui.setSkin('${skin}')`);await c.sleep(1400)
    await test(`${skin} ${width}×${height} 长标题完整换行，无省略和内部裁切`,`await document.fonts.ready;const e=field(),s=getComputedStyle(e);return e.tagName==='TEXTAREA'&&e.value===title&&e.scrollWidth<=e.clientWidth+1&&e.scrollHeight<=e.clientHeight+1&&s.textOverflow!=='ellipsis'&&window.__ns.editor.view.dom.isConnected||{tag:e.tagName,scrollWidth:e.scrollWidth,clientWidth:e.clientWidth,scrollHeight:e.scrollHeight,clientHeight:e.clientHeight,textOverflow:s.textOverflow};`)
    if(width===1280&&process.argv.includes('--screens'))await captureWindow(ins,'127.0.0.1:5173/',`${dir}/${skin}-long-title.png`,{exclude:'panel='})
  }
}
if(results.every(r=>r.ok)){
  await test('中文输入法确认不误提交，下一次Enter确认一次并落盘',`const e=field(),before=w.activeChapter.title;window.__titleCheck.originalHtml=window.__ns.editor.getHTML();e.focus();e.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));e.value='中文输入法确认后的完整章节标题';e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',keyCode:229,isComposing:true,bubbles:true,cancelable:true}));e.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true}));e.dispatchEvent(new KeyboardEvent('keyup',{key:'Enter',bubbles:true}));await wait();if(document.activeElement!==e||w.activeChapter.title!==before)return {premature:true};e.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));await wait();await (await import('/src/services/autosave.js')).autosave.flushAll();return w.activeChapter.title==='中文输入法确认后的完整章节标题'&&(await window.__ns.db.chapters.get(w.selChapterId)).title===w.activeChapter.title&&window.__ns.editor.getHTML()===window.__titleCheck.originalHtml;`)
  await test('粘贴换行保持逻辑单行标题，失焦保存',`const e=field();e.focus();e.value=${JSON.stringify('标题第一行\n标题第二行')};e.dispatchEvent(new Event('input',{bubbles:true}));e.blur();await wait();return w.activeChapter.title==='标题第一行 标题第二行';`)
  await test('连续英文长词也可换行，收短标题后自动回缩',`w.renameChapter(w.selChapterId,'VeryLongChapterTitleWithoutAnySpaces'.repeat(4));await wait();const e=field(),longHeight=e.clientHeight,wrapped=e.scrollWidth<=e.clientWidth+1&&e.scrollHeight<=e.clientHeight+1;w.renameChapter(w.selChapterId,'短章名');await wait();return wrapped&&e.clientHeight<longHeight;`)
  await test('章节切换后的旧控件回调不会改写新章节',`const e=field(),second=w.liveChapters.find(c=>c.id!==w.selChapterId),before=second.title;e.value='旧章节迟到的标题';e.dispatchEvent(new Event('input',{bubbles:true}));w.selChapterId=second.id;await wait();e.dispatchEvent(new Event('change',{bubbles:true}));return second.title===before&&field().value===before;`)
  await test('阅读标题同样换行，退出后正文与编辑器实例保持',`const editor=window.__ns.editor,html=editor.getHTML();w.renameChapter(w.selChapterId,'LongUnbrokenReadingChapterTitle'.repeat(4));ui.readMode=true;await wait();const e=document.querySelector('.ed-read-title'),ok=e.scrollWidth<=e.clientWidth+1;ui.readMode=false;await wait();return ok&&editor===window.__ns.editor&&html===editor.getHTML();`)
  await test('空标题仍回退未命名章节',`const e=field();e.focus();e.value='  ';e.dispatchEvent(new Event('input',{bubbles:true}));e.blur();await wait();return w.activeChapter.title==='未命名章节'&&e.value==='未命名章节';`)
  await c.evalx('window.__titleCheck.w.renameChapter(window.__titleCheck.w.selChapterId,window.__titleCheck.title)')
  const opened=await c.evalx('window.native.panelOpen({type:"chapter",workId:window.__titleCheck.w.work.id,entityId:window.__titleCheck.w.selChapterId})');assert(opened?.ok)
  const p=await connect('panel=chapter%3A',9333);assert.equal(await p.evalx("new URLSearchParams(location.search).get('panel')?.startsWith('chapter:')"),true)
  try{
    for(let i=0;i<60&&!await p.evalx("!!document.querySelector('.chapter-title-control')");i++)await p.sleep(100)
    await captureWindow(ins,'panel=chapter','tools/_title-panel-visible.png')
    await test('正文拆窗后主窗口标题保持只读',`await wait();const e=document.querySelector('.chapter-title-control');if(!e)return !document.querySelector('.rich-host .tiptap')&&document.body.textContent.includes('已在独立窗口编辑')&&w.activeChapter.title===title;e.dispatchEvent(new Event('change',{bubbles:true}));await wait();return e.readOnly&&w.activeChapter.title===title;`)
    const r=await p.evalx(`window.__panelTitleCheck=(async()=>{await document.fonts.ready;const e=document.querySelector('.chapter-title-control'),title=${JSON.stringify(title)};if(e.readOnly||e.tagName!=='TEXTAREA'||e.value!==title||e.scrollWidth>e.clientWidth+1||e.scrollHeight>e.clientHeight+1)return {value:e.value,readonly:e.readOnly,width:e.clientWidth,scrollWidth:e.scrollWidth};const html=window.__ns.editor.getHTML();e.focus();e.value=title+' · 独立窗口';e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));await (await import('/src/services/autosave.js')).autosave.flushAll();return window.__ns.getWork().activeChapter.title===title+' · 独立窗口'&&window.__ns.editor.getHTML()===html})();window.__panelTitleCheck`)
    results.push({name:'独立窗口长标题完整显示并可保存，正文不变',ok:r===true,...(r===true?{}:{detail:r})});console.log((r===true?'PASS ':'FAIL ')+'独立窗口长标题完整显示并可保存，正文不变')
  }finally{await p.evalx('window.native.panelCloseSelf()')}
}
writeFileSync(`${dir}/results.json`,JSON.stringify(results,null,2));ins.ws.close();console.log(`${results.filter(r=>r.ok).length}/${results.length} passed`);process.exit(results.every(r=>r.ok)?0:1)
