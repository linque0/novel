// UI relocation only: isolated registered book, original bookmark/read/window actions.
import assert from 'node:assert/strict'
import {connect} from './_cdp-lib.mjs'
import {assertAiTestProfile} from './_ai-test-profile.mjs'
import {buildSeedExpr} from './verify-seeds.mjs'
import {connectInspector,evalMain,captureWindow} from './_capture-main.mjs'
process.env.AI_TEST_PROFILE='booksource-verify'
const c=await connect('app://',9333)
for(let i=0;i<60&&!await c.evalx('!!window.__ns?.getWork');i++)await c.sleep(100)
assertAiTestProfile(await c.evalx('window.native.getDataLocation()'))
const ins=await connectInspector()
await evalMain(ins,"(()=>{const {BrowserWindow}=require('electron');const w=BrowserWindow.getAllWindows().find(w=>!w.webContents.getURL().includes('panel='));w.setContentSize(1440,900);return true})()")
const seed=await c.evalx(buildSeedExpr('AI 验证书',{reset:true}));assert(seed?.ok)
await c.evalx(`window.__railSetup=(async()=>{const w=window.__ns.getWork(),ui=(await import('/src/stores/ui.js')).useUiStore();await w.open(${JSON.stringify(seed.books[0].workId)});const first=w.selChapterId;for(const title of ['第二卷 · 渡口旧事','第三卷 · 旧城钟声']){const v=await w.addVolume(title);for(let i=0;i<3;i++)await w.addChapter(v.id,title+' · '+['故人来信','渡口的约定','雨夜钟声'][i])}w.selChapterId=first;w.selVolumeId=w.chapters.find(c=>c.id===first).volumeId;await ui.setSkin('crimson');ui.aiDrawerOpen=false;window.__railCheck={w,ui};return true})();window.__railSetup`)
await c.sleep(1400)
const results=[]
async function test(name,body){const r=await c.evalx(`window.__railPending=(async()=>{const {w,ui}=window.__railCheck;const wait=()=>new Promise(r=>setTimeout(r,100));${body}})();window.__railPending`);results.push(r===true);console.log((r===true?'PASS ':'FAIL ')+name+(r===true?'':' '+JSON.stringify(r)))}
await test('移除顶部作品条，稿本使用新增的全部高度',`const stage=document.querySelector('.crimson-editor-stage'),book=document.querySelector('.crimson-book');return !document.querySelector('.crimson-project-line')&&book.clientHeight>=stage.clientHeight-5;`)
await test('目录栏包含书签、阅读和独立窗口入口',`return ['bookmark','read','window'].every(action=>!!document.querySelector('.crimson-rail-actions [data-action="'+action+'"]'));`)
await test('侧栏书签调用原动作并保持状态反馈',`const b=document.querySelector('.crimson-rail-actions [data-action="bookmark"]');if(!b)return false;const before=w.isChapterBookmarked(w.selChapterId);b.click();await wait();const changed=w.isChapterBookmarked(w.selChapterId)!==before&&b.getAttribute('aria-pressed')===String(!before);b.click();await wait();return changed&&w.isChapterBookmarked(w.selChapterId)===before;`)
await test('侧栏阅读沿用只读模式，退出保持同一编辑器',`const b=document.querySelector('.crimson-rail-actions [data-action="read"]');if(!b)return false;const editor=window.__ns.editor;b.click();await wait();const reading=ui.readMode&&!editor.isEditable;document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await wait();return reading&&!ui.readMode&&editor===window.__ns.editor&&editor.isEditable;`)
await test('查找与历史仍可从目录栏打开',`const search=document.querySelector('.crimson-chapter-rail [data-action="search"]'),history=document.querySelector('.crimson-chapter-rail [data-action="history"]');if(!search||!history)return false;search.click();await wait();const opened=ui.searchOpen;ui.searchOpen=false;history.click();await wait();const revisions=ui.revisionsCtx;ui.revisionsCtx=null;return opened&&!!revisions;`)
await test('目录搜索、切章与收起时快捷功能可用',`const input=document.querySelector('.crimson-rail-search input');input.value='第二章';input.dispatchEvent(new Event('input',{bubbles:true}));await wait();const rows=[...document.querySelectorAll('.crimson-rail-chapter')];if(rows.length!==1)return {rows:rows.length};rows[0].click();await wait();const picked=w.activeChapter.title.includes('第二章');input.value='';input.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('.crimson-rail-toggle').click();await wait();const buttons=[...document.querySelectorAll('.crimson-rail-actions button')],accessible=buttons.length===3&&buttons.every(b=>b.getBoundingClientRect().width>0);document.querySelector('.crimson-rail-toggle').click();await wait();return picked&&accessible;`)
await test('多卷目录无横向溢出，序号按正文卷序连续',`const nav=document.querySelector('.crimson-rail-chapters'),nums=[...document.querySelectorAll('.crimson-rail-chapter .num')].map(e=>Number(e.textContent));return nav.scrollWidth<=nav.clientWidth+1&&nums.length===9&&nums.every((n,i)=>n===i+1);`)
if(results.every(Boolean)){
  await test('侧栏独立窗口拆出当前章',`const b=document.querySelector('.crimson-rail-actions [data-action="window"]');if(!b)return false;b.click();for(let i=0;i<40;i++){const list=await window.native.panelList();if(list.panels.some(p=>p.spec.type==='chapter'&&p.spec.entityId===w.selChapterId))return true;await wait()}return false;`)
  const p=await connect('panel=chapter%3A',9333)
  assert.equal(await p.evalx("new URLSearchParams(location.search).get('panel')?.startsWith('chapter:')"),true)
  await p.evalx('window.native.panelCloseSelf()');await c.sleep(500)
  await test('关闭独立窗口后原章恢复编辑',`for(let i=0;i<40;i++){const list=await window.native.panelList();if(!list.panels.some(p=>p.spec.type==='chapter'))return window.__ns.editor.isEditable;await wait()}return false;`)
  for(const [width,height] of [[1280,720],[1440,900],[1920,1080]]){
    await evalMain(ins,`(()=>{const {BrowserWindow}=require('electron');BrowserWindow.getAllWindows().find(w=>!w.webContents.getURL().includes('panel=')).setContentSize(${width},${height});return true})()`)
    await c.sleep(200)
    await test(`${width}×${height} 目录完整、正文填满可用高度`,`const nav=document.querySelector('.crimson-rail-chapters'),rail=document.querySelector('.crimson-chapter-rail'),book=document.querySelector('.crimson-book'),stage=document.querySelector('.crimson-editor-stage');return nav.clientHeight>100&&nav.scrollWidth<=nav.clientWidth+1&&rail.getBoundingClientRect().bottom<=innerHeight&&book.clientHeight>=stage.clientHeight-5;`)
    if(width===1440)await captureWindow(ins,'127.0.0.1:5173/','tools/_crimson-writing-rail-after.png',{exclude:'panel='})
  }
}
ins.ws.close();console.log(`${results.filter(Boolean).length}/${results.length} passed`);process.exit(results.every(Boolean)?0:1)
