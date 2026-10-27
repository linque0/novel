import assert from 'node:assert/strict'
import {writeFileSync,readFileSync} from 'node:fs'
import {connect} from './_cdp-lib.mjs'
import {connectInspector,evalMain,captureWindow} from './_capture-main.mjs'
import {assertAiTestProfile} from './_ai-test-profile.mjs'
import {buildSeedExpr} from './verify-seeds.mjs'
process.env.AI_TEST_PROFILE='booksource-verify'
const c=await connect('app://',9333)
for(let i=0;i<60&&!await c.evalx('!!window.__ns?.getWork');i++)await c.sleep(100)
assertAiTestProfile(await c.evalx('window.native.getDataLocation()'))
if(process.argv.includes('--restart-check')){
  const expected=JSON.parse(readFileSync('tools/_writing-paper-restart.json','utf8'))
  assert.equal(await c.evalx(`window.__paperRestart=(async()=>{const w=window.__ns.getWork(),ui=(await import('/src/stores/ui.js')).useUiStore();await ui.loadPrefs();await w.open(${JSON.stringify(expected.workId)});await new Promise(r=>setTimeout(r,150));return ui.writingPaperStyle===${JSON.stringify(expected.style)}&&document.querySelector('.editor-wrap').dataset.writingPaper===${JSON.stringify(expected.style)}})();window.__paperRestart`),true)
  console.log('PASS 正常重启恢复纸面偏好与正文界面');process.exit(0)
}
const ins=await connectInspector(),results=[]
const pass=name=>{results.push({name,ok:true});console.log('PASS '+name)}
const seed=await c.evalx(buildSeedExpr('AI 验证书',{reset:true}));assert(seed?.ok)
await c.evalx(`window.__paperWindowSetup=(async()=>{const w=window.__ns.getWork(),ui=(await import('/src/stores/ui.js')).useUiStore();await w.open(${JSON.stringify(seed.books[0].workId)});await ui.setSkin('original');await ui.setPref('theme','xuan');await ui.setWritingPaperStyle('booklet');window.__paperWindow={w,ui};return true})();window.__paperWindowSetup`)
await evalMain(ins,"(()=>{const {BrowserWindow}=require('electron');BrowserWindow.getAllWindows().find(w=>!w.webContents.getURL().includes('panel=')).setContentSize(1100,720);return true})()")
await c.sleep(250)
async function test(name,body){const r=await c.evalx(`window.__paperWindowCheck=(async()=>{const {w,ui}=window.__paperWindow;const wait=()=>new Promise(r=>setTimeout(r,120));${body}})();window.__paperWindowCheck`);results.push({name,ok:r===true,...(r===true?{}:{detail:r})});console.log((r===true?'PASS ':'FAIL ')+name+(r===true?'':' '+JSON.stringify(r)))}
await test('窄工具栏把纸面收进更多格式且菜单支持方向键/Esc',`const direct=document.querySelector('.tb-paper-direct');if(direct)return {unexpectedDirect:true};const more=[...document.querySelectorAll('.editor-toolbar button')].find(b=>b.title.startsWith('更多格式'));more?.click();await wait();const trigger=document.querySelector('.tb-paper-in-more [aria-label="纸面"]');trigger?.click();await wait();const list=document.querySelector('.writing-paper-menu-list'),first=document.activeElement;if(!list?.contains(first))return {focused:document.activeElement?.outerHTML};first.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}));const moved=document.activeElement!==first;document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));await wait();return !!trigger&&moved&&document.activeElement===trigger;`)
if(process.argv.includes('--screens')){await c.evalx("document.querySelector('.tb-paper-in-more [aria-label=\"纸面\"]').click()");await c.sleep(120);await captureWindow(ins,'127.0.0.1:5173/','docs/writing-paper-20261025/paper-menu.png',{exclude:'panel='});await c.evalx("document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}))")}
await test('菜单保存失败展示提示，保持原选择',`const db=window.__ns.db,old=ui.writingPaperStyle,reject=function(_changes,key){if(key==='writingPaperStyle')throw new Error('injected preference failure')};db.appconfig.hook('updating',reject);try{const trigger=document.querySelector('.tb-paper-in-more [aria-label="纸面"]');trigger.click();await wait();[...document.querySelectorAll('.writing-paper-menu-list [data-paper-choice="manuscript"]')].at(-1).click();await wait();return ui.writingPaperStyle===old&&!ui.writingPaperSaving&&document.body.textContent.includes('纸面未能保存')}finally{db.appconfig.hook('updating').unsubscribe(reject)};`)
// Close residual popovers without sending editing commands.
await c.evalx("document.activeElement?.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}))")
const settings=await c.evalx("window.native.panelOpen({type:'settings',workId:'__global__',entityId:''})");assert(settings?.ok)
const s=await connect('panel=settings%3A',9333);assert.equal(await s.evalx("new URLSearchParams(location.search).get('panel')?.startsWith('settings:')"),true)
for(let i=0;i<60&&!await s.evalx("!!document.querySelector('.writing-paper-options')");i++)await s.sleep(100)
try{
  await s.evalx("document.querySelector('.writing-paper-options [data-paper-choice=\"manuscript\"]').click()")
  for(let i=0;i<40&&!await c.evalx("window.__paperWindow.ui.writingPaperStyle==='manuscript'");i++)await c.sleep(100)
  assert.equal(await c.evalx("document.querySelector('.editor-wrap').dataset.writingPaper==='manuscript'"),true)
  assert.equal(await s.evalx("document.querySelector('.writing-paper-preview').dataset.writingPaper==='manuscript'"),true);pass('设置选择同步到主窗口与相同材料预览')
  await c.evalx("window.__paperWindow.ui.setWritingPaperStyle('hardcover')")
  for(let i=0;i<40&&!await s.evalx("document.querySelector('.writing-paper-options [data-paper-choice=\"hardcover\"]').getAttribute('aria-pressed')==='true'");i++)await s.sleep(100)
  assert.equal(await s.evalx("document.querySelector('.writing-paper-preview').dataset.writingPaper==='hardcover'"),true);pass('主窗口选择反向同步到设置选中态与预览')
  await s.evalx("[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='恢复默认').click()")
  for(let i=0;i<40&&!await c.evalx("window.__paperWindow.ui.writingPaperStyle==='booklet'");i++)await c.sleep(100)
  assert.equal(await c.evalx("window.__paperWindow.ui.writingPaperStyle==='booklet'"),true);pass('恢复外观默认值同时恢复轻装帧')
  if(process.argv.includes('--screens'))for(const skin of ['original','gravity','glaze','crimson']){await c.evalx(`window.__paperWindow.ui.setSkin('${skin}')`);await c.sleep(400);await captureWindow(ins,'panel=settings',`docs/writing-paper-20261025/${skin}-settings.png`)}
}finally{await s.evalx('window.native.panelCloseSelf()')}
await c.evalx("window.__paperWindow.ui.setSkin('crimson')")
await c.evalx(`window.native.panelOpen({type:'chapter',workId:${JSON.stringify(seed.books[0].workId)},entityId:window.__paperWindow.w.selChapterId})`)
const p=await connect('panel=chapter%3A',9333);assert.equal(await p.evalx("new URLSearchParams(location.search).get('panel')?.startsWith('chapter:')"),true)
for(let i=0;i<60&&!await p.evalx("!!document.querySelector('.editor-wrap[data-writing-paper]')");i++)await p.sleep(100)
try{
  await c.evalx("window.__paperWindow.ui.setWritingPaperStyle('hardcover')")
  for(let i=0;i<40&&!await p.evalx("document.querySelector('.editor-wrap').dataset.writingPaper==='hardcover'");i++)await p.sleep(100)
  assert.equal(await p.evalx("document.querySelector('.editor-wrap').dataset.writingPaper==='hardcover'"),true);pass('正文独立窗口跟随应用级纸面')
  await p.evalx("(async()=>{const ui=(await import('/src/stores/ui.js')).useUiStore();await ui.setWritingPaperStyle('manuscript');return true})()")
  for(let i=0;i<40&&!await c.evalx("window.__paperWindow.ui.writingPaperStyle==='manuscript'");i++)await c.sleep(100)
  assert.equal(await c.evalx("window.__paperWindow.ui.writingPaperStyle==='manuscript'"),true);pass('独立窗口选择同步回主窗口')
}finally{await p.evalx('window.native.panelCloseSelf()')}
await c.sleep(350)
await test('阅读和沉浸沿用三套材料并减弱边缘，不重建编辑器',`const e=window.__ns.editor,html=e.getHTML();for(const style of ['booklet','manuscript','hardcover']){await ui.setWritingPaperStyle(style);await wait();const normal=getComputedStyle(document.querySelector('.crimson-page')).boxShadow;ui.readMode=true;await wait();const reading=document.querySelector('.editor-wrap').dataset.paperQuiet==='true'&&document.querySelector('.editor-wrap').dataset.writingPaper===style&&!e.isEditable;ui.readMode=false;ui.focusMode=true;await wait();const focus=document.querySelector('.editor-wrap').dataset.paperQuiet==='true'&&getComputedStyle(document.querySelector('.crimson-page')).boxShadow!==normal;ui.focusMode=false;if(!reading||!focus)return {style,reading,focus}}return e===window.__ns.editor&&e.getHTML()===html;`)
await c.evalx("window.__paperWindow.original=window.__paperWindow.w.work.id;window.__paperWindow.ui.setWritingPaperStyle('hardcover')")
const other=await c.evalx(buildSeedExpr('批注验证书',{reset:true}));assert(other?.ok)
await c.evalx(`window.__paperOther=(async()=>{await window.__paperWindow.w.open(${JSON.stringify(other.books[0].workId)});return true})();window.__paperOther`)
assert.equal(await c.evalx("document.querySelector('.editor-wrap').dataset.writingPaper==='hardcover'"),true);pass('跨作品保持应用级偏好')
await c.evalx("window.__paperWindow.w.open(window.__paperWindow.original)");await c.sleep(200)
writeFileSync('tools/_writing-paper-restart.json',JSON.stringify({workId:seed.books[0].workId,style:'hardcover'}));writeFileSync('docs/writing-paper-20261025/window-results.json',JSON.stringify(results,null,2));ins.ws.close();process.exit(results.every(r=>r.ok)?0:1)
