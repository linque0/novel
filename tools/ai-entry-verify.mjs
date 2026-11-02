import assert from 'node:assert/strict'
import {mkdirSync,writeFileSync} from 'node:fs'
import {connect} from './_cdp-lib.mjs'
import {assertAiTestProfile} from './_ai-test-profile.mjs'
import {buildSeedExpr} from './verify-seeds.mjs'
process.env.AI_TEST_PROFILE='booksource-verify'
const c=await connect('http://',process.env.CDP_PORT||9333),results=[],created=[]
const out='docs/恍然梦AI工作台/entry-20261028';mkdirSync(out,{recursive:true})
async function ev(code){const v=await c.evalx(code);if(v?.PAGE_ERR)throw Error(v.PAGE_ERR);return v}
async function wait(code){const until=Date.now()+15000;while(Date.now()<until){if(await ev(code))return;await c.sleep(80)}throw Error('Timed out: '+code)}
async function click(selector){await wait(`!![...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.getClientRects().length&&!e.disabled)`);const box=await ev(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.getClientRects().length&&!e.disabled);e.scrollIntoView({block:'center',behavior:'instant'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);await c.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...box});await c.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...box})}
async function test(name,fn){try{await fn();results.push({name,ok:true});console.log('PASS '+name)}catch(e){results.push({name,ok:false,error:e.message});throw e}}
async function shot(name,width=1440){await c.send('Emulation.setDeviceMetricsOverride',{width,height:width===1440?900:760,deviceScaleFactor:1,mobile:false});await c.sleep(120);const data=await Promise.race([c.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false}),new Promise((_,j)=>setTimeout(()=>j(Error('render timeout')),8000))]);writeFileSync(out+'/'+name+'.png',Buffer.from(data.data,'base64'))}
let originalSkin,seedId
try{
 await c.send('Page.reload',{ignoreCache:true});await wait('!!window.__ns?.getWork')
 assertAiTestProfile(await ev('window.native.getDataLocation()'))
 await c.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]})
 const win=await c.send('Browser.getWindowForTarget');await c.send('Browser.setWindowBounds',{windowId:win.windowId,bounds:{windowState:'normal'}});await c.send('Page.bringToFront')
 originalSkin=await ev('(async()=>{const db=window.__ns.db;return (await db.appconfig.get("skin"))||null})()')
 const seed=await ev(buildSeedExpr('AI 验证书'));assert(seed.ok);seedId=seed.books[0].workId
 await ev(`(async()=>{const w=window.__ns.getWork();if(w.work)await w.closeWork();const ui=(await import('/src/stores/ui.js')).useUiStore(),shelf=(await import('/src/stores/shelf.js')).useShelfStore();await shelf.refresh();await ui.setSkin('original');ui.topbarAutoHide=false;window.__entry={w,ui,shelf,db:window.__ns.db};return true})()`)
 // Earlier runs leave their own temporary books in the recycle bin. The seed
 // registry can return that deleted namesake; resume a live shelf book instead.
 seedId=await ev('window.__entry.shelf.works.find(w=>w.title==="AI 验证书"&&!w.deletedAt)?.id');assert(seedId,'a live registered verification book is required')
 await test('all four shelf skins expose the dream entry in their shared top bar',async()=>{
   for(const skin of ['original','gravity','glaze','crimson']){await ev(`window.__entry.ui.setSkin(${JSON.stringify(skin)})`);await wait('!!document.querySelector(".app-topbar [data-ai-mode=dream]")');assert.equal(await ev('document.querySelector(".app-topbar [data-ai-mode=dream]").textContent.trim()'),'恍然梦-入梦');assert.equal(await ev('document.querySelector(".app-topbar [data-ai-mode=light]")===null'),true)}
   await ev('window.__entry.ui.setSkin("original")');await shot('shelf-topbar-1440')
 })
 await test('empty shelf still opens the dream launcher without selecting a book',async()=>{
   await ev('window.__entry.savedWorks=window.__entry.shelf.works;window.__entry.shelf.works=[];true')
   await click('.app-topbar [data-ai-mode=dream]');await wait('!!document.querySelector(".dream-launch-dialog")')
   assert.equal(await ev('!!document.querySelector("[data-dream-start]")&&!document.querySelector("[data-dream-start]").disabled'),true)
   await ev('window.__entry.ui.dreamLauncherOpen=false;window.__entry.shelf.works=window.__entry.savedWorks;true')
   await wait('!document.querySelector(".n-modal-mask")')
 })
 await test('shelf starts one new story directly in AI mode without handwritten text',async()=>{
   const before=await ev('window.__entry.db.works.toArray().then(rows=>rows.map(r=>r.id))')
   await click('.app-topbar [data-ai-mode=dream]');await wait('!!document.querySelector(".dream-launch-dialog input[aria-label=新故事名称]")')
   await ev(`(()=>{const e=document.querySelector('.dream-launch-dialog input[aria-label=新故事名称]');e.value='AI 验证书';e.dispatchEvent(new Event('input',{bubbles:true}))})()`)
   await click('[data-dream-start]');await wait('window.__entry.ui.view==="work"&&window.__entry.ui.workbenchMode==="agent"')
   const after=await ev('window.__entry.db.works.toArray().then(rows=>rows.map(r=>r.id))');created.push(...after.filter(id=>!before.includes(id)));assert.equal(created.length,1)
   assert.equal(await ev('window.__entry.w.liveChapters.every(c=>!c.content)'),true)
   assert.equal(await ev('!!document.querySelector(".story-opening")'),true)
   assert.equal(await ev(`(async()=>{const story=(await import('/src/stores/story.js')).useStoryStore();await story.ensure();return !!window.__entry.w.activeChapter&&!story.active.text&&!window.__entry.w.activeChapter.content})()`),true,'a new empty story can prepare its first AI chapter without handwritten content or an editor prerequisite')
   await shot('dream-topbar-1440')
 })
 await test('dream top bar switches to light sleep in the same work and opens the built-in assistant',async()=>{
   const id=await ev('window.__entry.w.work.id')
   await click('.story-topbar [data-ai-mode=light]');await wait('window.__entry.ui.workbenchMode==="writing"&&document.querySelector(".ai-dock")?.getClientRects().length>0')
   assert.equal(await ev('window.__entry.w.work.id'),id)
   assert.equal(await ev('document.querySelector(".ai-drawer-name").textContent'),'恍然梦-浅眠')
   assert.equal(await ev('document.querySelector(".app-topbar [data-ai-mode=light]").getAttribute("aria-pressed")'),'true')
   await shot('light-topbar-1440')
 })
 await test('workshop top bar toggles light sleep and re-enters the independent story scene',async()=>{
   await click('.app-topbar [data-ai-mode=light]');await wait('window.__entry.ui.aiDrawerOpen===false')
   await click('.app-topbar [data-ai-mode=dream]');await wait('window.__entry.ui.workbenchMode==="agent"&&document.querySelector(".story-scene").getClientRects().length>0')
   await shot('dream-topbar-1080',1080)
   assert.equal(await ev('document.documentElement.scrollWidth<=innerWidth'),true)
   await click('.story-topbar [data-ai-mode=light]');await wait('window.__entry.ui.workbenchMode==="writing"')
   await shot('light-topbar-1080',1080)
   for(const mode of ['dream','light'])assert.equal(await ev(`(()=>{const r=document.querySelector('.app-topbar [data-ai-mode=${mode}]').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=90})()`),true)
 })
 await test('shelf dream entry resumes an explicitly chosen work rather than silently taking the first book',async()=>{
   await ev('window.__entry.w.closeWork()');await wait('window.__entry.ui.view==="shelf"')
   await click('.app-topbar [data-ai-mode=dream]');await click(`[data-dream-book="${seedId}"]`)
   await wait(`window.__entry.w.work?.id===${JSON.stringify(seedId)}&&window.__entry.ui.workbenchMode==='agent'`)
 })
}catch(e){console.error(e.stack);if(!results.some(r=>!r.ok))results.push({name:'setup',ok:false,error:e.message})}finally{
 await ev(`(async()=>{const f=window.__entry;if(!f)return;f.ui.dreamLauncherOpen=false;if(f.w.work)await f.w.closeWork();for(const id of ${JSON.stringify(created)}){const row=await f.db.works.get(id);if(row)await f.shelf.deleteWork(row)}if(${JSON.stringify(originalSkin)}?.value)await f.ui.setSkin(${JSON.stringify(originalSkin?.value)});return true})()`).catch(()=>{})
 writeFileSync(out+'/verification.json',JSON.stringify({kind:'isolated-ui-entry-routing',modelRequests:0,results},null,2));console.log(`${results.filter(r=>r.ok).length}/${results.length} checks passed`);process.exit(results.every(r=>r.ok)?0:1)
}
