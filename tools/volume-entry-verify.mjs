import assert from 'node:assert/strict'
import{mkdirSync,writeFileSync}from'node:fs'
import{connect}from'./_cdp-lib.mjs'
import{connectInspector,evalMain,captureWindow}from'./_capture-main.mjs'
import{assertAiTestProfile}from'./_ai-test-profile.mjs'
import{buildSeedExpr}from'./verify-seeds.mjs'
process.env.AI_TEST_PROFILE='booksource-verify'
const c=await connect('app://',9333),ins=await connectInspector(),dir='docs/volume-entry-20261026'
mkdirSync(dir,{recursive:true});for(let i=0;i<80&&!await c.evalx('!!window.__ns?.getWork');i++)await c.sleep(100)
assertAiTestProfile(await c.evalx('window.native.getDataLocation()'))
const seed=await c.evalx(buildSeedExpr('AI 验证书',{reset:true}));assert(seed?.ok)
await c.evalx(`window.__volumeSetup=(async()=>{const w=window.__ns.getWork(),ui=(await import('/src/stores/ui.js')).useUiStore();await w.open(${JSON.stringify(seed.books[0].workId)});ui.aiDrawerOpen=false;ui.sideWidth=252;window.__volumeEntry={w,ui};return true})();window.__volumeSetup`)
await evalMain(ins,"(()=>{const{BrowserWindow}=require('electron');BrowserWindow.getAllWindows().find(w=>!w.webContents.getURL().includes('panel=')).setContentSize(1440,900);return true})()")
await captureWindow(ins,'127.0.0.1:5173/','tools/_volume-entry-visible.png',{exclude:'panel='})
const results=[]
async function test(name,body){const r=await c.evalx(`window.__volumeCheck=(async()=>{const{w,ui}=window.__volumeEntry,wait=()=>new Promise(r=>setTimeout(r,180)),visible=e=>!!e?.getClientRects().length,input=()=>[...document.querySelectorAll('.n-dialog input')].find(visible),button=text=>[...document.querySelectorAll('.n-dialog button')].find(e=>visible(e)&&e.textContent.trim()===text);${body}})();window.__volumeCheck`);results.push({name,ok:r===true,...(r===true?{}:{detail:r})});console.log((r===true?'PASS ':'FAIL ')+name+(r===true?'':' '+JSON.stringify(r)))}
for(const skin of ['gravity','glaze']){
 await c.evalx(`window.__volumeEntry.ui.setSkin('${skin}')`);await c.sleep(250)
 await test(`${skin} 新建卷及逐卷编辑入口直接可见`,`const create=document.querySelector('[data-action="new-volume"]'),edits=[...document.querySelectorAll('[data-action="rename-volume"]')];return !!create?.getBoundingClientRect().width&&create.textContent.includes('新建卷')&&edits.length===w.liveVolumes.length&&edits.every(visible);`)
 if(process.argv.includes('--screens')&&results.at(-1).ok){
  for(const [action,name]of [['new-volume','new-volume'],['rename-volume','edit-volume']]){
   await c.evalx(`document.querySelector('[data-action="${action}"]').click()`);await c.sleep(250)
   await captureWindow(ins,'127.0.0.1:5173/',`${dir}/${skin}-${name}.png`,{exclude:'panel='})
   await c.evalx("[...document.querySelectorAll('.n-dialog button')].find(b=>b.getBoundingClientRect().width&&b.textContent.trim()==='取消').click()");await c.sleep(250)
  }
 }
}
if(results.every(r=>r.ok)){
 for(const skin of ['gravity','glaze']){
  await c.evalx(`window.__volumeEntry.ui.setSkin('${skin}')`);await c.sleep(200)
  await test(`${skin} 新建卷先命名，取消不产生空卷`,`const n=w.liveVolumes.length;document.querySelector('[data-action="new-volume"]').click();await wait();const ok=!!input()&&w.liveVolumes.length===n&&document.body.textContent.includes('新建卷');button('取消').click();await wait();return ok&&w.liveVolumes.length===n;`)
  await test(`${skin} 空白卷名不可提交，中文输入法确认不误创建`,`document.querySelector('[data-action="new-volume"]').click();await wait();const el=input(),n=w.liveVolumes.length;el.value='  ';el.dispatchEvent(new Event('input',{bubbles:true}));await wait();const disabled=button('确定').disabled;el.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));el.value='远航卷';el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',keyCode:229,isComposing:true,bubbles:true,cancelable:true}));el.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true}));el.dispatchEvent(new KeyboardEvent('keyup',{key:'Enter',bubbles:true}));await wait();return disabled&&!!input()&&w.liveVolumes.length===n;`)
  await test(`${skin} 确认创建卷并落盘，新章归入新卷`,`const n=w.liveVolumes.length,el=input();el.value='  ${skin} · 远航来信  ';el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));await wait();const vol=w.liveVolumes.find(v=>v.title==='${skin} · 远航来信');if(!vol||w.liveVolumes.length!==n+1||w.selVolumeId!==vol.id)return {created:false};await (await import('/src/services/autosave.js')).autosave.flushAll();const stored=await window.__ns.db.volumes.get(vol.id);document.querySelector('[data-action="new-chapter"]').click();await wait();window.__volumeEntry.createdId=vol.id;return stored.title===vol.title&&w.activeChapter.volumeId===vol.id;`)
  await test(`${skin} 行内编辑只改指定卷，不切章或丢失正文`,`const id=w.liveVolumes[0].id,other=w.liveVolumes.find(v=>v.id!==id),before=other.title,chapter=w.selChapterId,e=window.__ns.editor,html=e.getHTML();document.querySelector('[data-volume-target="'+id+'"]').click();await wait();const el=input();if(!el||el.value!==w.liveVolumes.find(v=>v.id===id).title)return {wrongTarget:true};w.selVolumeId=other.id;el.value='${skin} · 第一卷修订';el.dispatchEvent(new Event('input',{bubbles:true}));button('确定').click();await wait();await (await import('/src/services/autosave.js')).autosave.flushAll();return (await window.__ns.db.volumes.get(id)).title==='${skin} · 第一卷修订'&&other.title===before&&w.selChapterId===chapter&&window.__ns.editor===e&&e.getHTML()===html;`)
  await test(`${skin} 180px侧栏入口不裁切，未分卷无改名按钮`,`ui.sideWidth=180;await w.moveChapterTo(w.liveChapters[0].id,'orphans','inside');await wait();const nodes=['.catalog-controls','.chapter-catalog','.chapter-catalog .side-list'].map(s=>document.querySelector(s));return nodes.every(e=>e.scrollWidth<=e.clientWidth+1)&&!document.querySelector('[data-volume-id="orphans"] [data-action="rename-volume"]');`)
  if(process.argv.includes('--screens'))await captureWindow(ins,'127.0.0.1:5173/',`${dir}/${skin}-180.png`,{exclude:'panel='})
  await c.evalx('window.__volumeEntry.ui.sideWidth=252')
 }
 const expected=await c.evalx('window.__volumeEntry.w.liveVolumes.map(v=>({id:v.id,title:v.title}))')
 await c.evalx('location.reload()');await c.sleep(900)
 for(let i=0;i<80&&!await c.evalx('!!window.__ns?.getWork');i++)await c.sleep(100)
 await c.evalx(`window.__volumeReopen=(async()=>{const w=window.__ns.getWork(),ui=(await import('/src/stores/ui.js')).useUiStore();await w.open(${JSON.stringify(seed.books[0].workId)});window.__volumeEntry={w,ui};return true})();window.__volumeReopen`)
 await test('刷新后新卷和修订名称保持',`const expected=${JSON.stringify(expected)};return expected.every(v=>w.liveVolumes.some(x=>x.id===v.id&&x.title===v.title));`)
}
writeFileSync(`${dir}/results.json`,JSON.stringify(results,null,2));ins.ws.close();console.log(`${results.filter(r=>r.ok).length}/${results.length} passed`);process.exit(results.every(r=>r.ok)?0:1)
