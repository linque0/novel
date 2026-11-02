// Deterministic transport exercises the real application. It does not measure model prose quality.
import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {mkdirSync,writeFileSync} from 'node:fs'
import {connect} from './_cdp-lib.mjs'
import {assertAiTestProfile} from './_ai-test-profile.mjs'
import {buildSeedExpr} from './verify-seeds.mjs'
const out='docs/恍然梦AI工作台/story-ui-20261028',results=[],requests=[]
mkdirSync(out,{recursive:true})
let fail=false,delay=0,serial=0,restore=[]
const server=createServer(async(req,res)=>{
  res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Headers','*')
  if(req.method==='OPTIONS'){res.end();return}
  let raw='';for await(const part of req)raw+=part
  const body=JSON.parse(raw);requests.push(body)
  if(fail){res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:{message:'isolated story transport interrupted'}}));return}
  let task
  for(const m of body.messages||[])for(const line of String(m.content||'').split('\n'))if(line.startsWith('{"type":"chapter.'))try{task=JSON.parse(line)}catch{}
  let name='submit_chapter',data
  if(task?.type==='chapter.review'){name='submit_review';data={data:{items:[{id:'motivation',severity:'suggestion',category:'人物动机',problem:'可以让守灯人的动作更具体。',expected:'只补充一个回避动作，保留所有情节。',quote:'船灯亮了。',evidence:[]}]}}}
  else if(task?.type==='chapter.recheck'){name='submit_recheck';data={data:{items:task.confirmedReview.items.map(i=>({id:i.id,status:'resolved',quote:'守灯人转过身。',explanation:'补充了回避动作。'}))}}}
  else if(task?.type==='chapter.revise')data={title:'雾港第一夜',text:task.draftSource.text+'\n\n守灯人转过身。',evidence:[],warnings:[]}
  else if(task?.story?.operation==='discuss')data={text:'保留船票的秘密，下一幕让守灯人主动交出半张旧地图。',evidence:[],warnings:[]}
  else {serial++;data={title:'雾港第一夜',text:`船灯亮了。第${serial}阵海风掠过渡口，送信人收好旧船票，沿石阶走向守灯人的住处。\n\n“这封信，原本是寄给你的。”他说。守灯人没有接，先把窗边那盏灯移到了门后。`,evidence:[],warnings:[]}}
  if(delay)await new Promise(r=>setTimeout(r,delay))
  res.writeHead(200,{'Content-Type':'text/event-stream'})
  res.write('data: '+JSON.stringify({choices:[{index:0,delta:{tool_calls:[{index:0,id:'story-test',type:'function',function:{name,arguments:JSON.stringify(data)}}]},finish_reason:null}]})+'\n\n')
  res.end('data: '+JSON.stringify({choices:[{index:0,delta:{},finish_reason:'tool_calls'}],usage:{prompt_tokens:400,completion_tokens:300,total_tokens:700}})+'\n\ndata: [DONE]\n\n')
})
await new Promise(r=>server.listen(0,'127.0.0.1',r))
process.env.AI_TEST_PROFILE='booksource-verify'
const c=await connect('http://',process.env.CDP_PORT||9333)
async function evaluate(code){const v=await c.evalx(code);if(v?.PAGE_ERR)throw new Error(v.PAGE_ERR);return v}
async function wait(code){const end=Date.now()+25000;while(Date.now()<end){if(await evaluate(code))return;await c.sleep(100)}throw Error('Timed out: '+code)}
async function click(selector,text=''){
  const expr=`[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.getClientRects().length&&!e.disabled&&e.textContent.includes(${JSON.stringify(text)}))`
  await wait(`!!(${expr})`)
  await evaluate(`(${expr}).scrollIntoView({block:'center',behavior:'instant'})`)
  await c.sleep(120)
  const box=await evaluate(`(()=>{const r=(${expr}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`)
  await c.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...box});await c.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...box})
}
async function test(name,fn){try{await fn();results.push({name,ok:true});console.log('PASS '+name)}catch(e){results.push({name,ok:false,error:e.message});throw e}}
async function shot(name,width=1440,height=900){await c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await c.sleep(150);const s=await Promise.race([c.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false}),new Promise((_,j)=>setTimeout(()=>j(Error('render timeout')),8000))]);writeFileSync(`${out}/${name}.png`,Buffer.from(s.data,'base64'))}
try{
  await c.send('Page.reload',{ignoreCache:true});await wait('!!window.__ns?.getWork')
  await c.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]})
  assertAiTestProfile(await evaluate('window.native.getDataLocation()'))
  const win=await c.send('Browser.getWindowForTarget');await c.send('Browser.setWindowBounds',{windowId:win.windowId,bounds:{windowState:'normal'}});await c.send('Page.bringToFront')
  const seed=await evaluate(buildSeedExpr('AI 验证书',{reset:true}));assert(seed.ok)
  restore=await evaluate(`window.__ns.db.appconfig.toArray().then(rows=>rows.filter(r=>['ai.providers','ai.activeProviderId','ai.stageConfig','ai.cred.story-test','skin'].includes(r.key)))`)
  await evaluate(`(async()=>{
    const db=window.__ns.db,w=window.__ns.getWork();await w.open(${JSON.stringify(seed.books[0].workId)});
    const ui=(await import('/src/stores/ui.js')).useUiStore(),ai=(await import('/src/stores/ai.js')).useAiStore();await ui.setSkin('original');
    const story=(await import('/src/stores/story.js')).useStoryStore(),flow=(await import('/src/stores/creative-workflow.js')).useCreativeWorkflowStore();flow.visible=false;
    const old=await db.airuns.where('workId').equals(w.work.id).toArray();await db.airuns.bulkDelete(old.filter(r=>['story-document','story-run','creative-lock'].includes(r.type)).map(r=>r.id));story.documents={};
    const c=w.liveChapters[0];c.content='';c.fmt='text';c.wordCount=0;w.selChapterId=c.id;c.title='雾港第一夜';w.work.title='雾港来信';
    const autosave=(await import('/src/services/autosave.js')).autosave;autosave.mark('works',w.work);autosave.mark('chapters',c);await autosave.flushAll();
    const provider={id:'story-test',name:'隔离故事机制验证',enabled:true,baseURL:${JSON.stringify('http://127.0.0.1:'+server.address().port+'/v1')},apiFormat:'openai',activeModel:'story-test',models:[{name:'story-test',enabled:true}],params:{maxContext:64000,temperature:0,privacy:false,kb:{auto:false}},modelCfg:{'story-test':{enabled:true,maxTokens:6000,contextWindow:64000}}};
    await db.appconfig.bulkPut([{key:'ai.providers',value:[provider]},{key:'ai.activeProviderId',value:provider.id},{key:'ai.cred.story-test',value:await window.native.credentialEncrypt('local-story-fixture')}]);await db.appconfig.delete('ai.stageConfig');await ai.loadSettings();await ai.loadPresets();ui.workbenchMode='agent';
    window.__storyFixture={w,ui,ai,story,db,autosave};return true
  })()`)
  await wait('!!document.querySelector(".story-scene")&&!!window.__ns.editor')
  await shot('opening-1440');await shot('opening-1080',1080,760)
  await test('blank chapter opens directly as AI story without an outline or handwritten text',async()=>{
    await click('.story-input-shell .story-primary','开始故事');await wait('!!window.__storyFixture.story.active?.text&&!window.__storyFixture.story.busy')
    assert.equal(await evaluate('window.__storyFixture.w.activeChapter.content'),'')
    assert.equal(await evaluate('window.__storyFixture.story.active.turns.length'),1)
  })
  await test('three empty-guidance continues use latest manuscript and default narrator policy',async()=>{
    for(let i=0;i<3;i++){await click('.story-input-shell .story-primary','继续故事');await wait(`window.__storyFixture.story.active.turns.length===${i+2}&&!window.__storyFixture.story.busy`)}
    assert.equal(await evaluate('window.__storyFixture.story.active.turns.length'),4)
    const tasks=requests.flatMap(r=>r.messages.flatMap(m=>String(m.content||'').split('\n').filter(s=>s.startsWith('{"type":"chapter.story"')).map(s=>JSON.parse(s))))
    assert(tasks.length>=4);assert(tasks.every(t=>t.story.controlPolicy==='narrator'));assert(tasks.at(-1).story.text.includes('第3阵海风'))
    assert.equal(await evaluate('window.__storyFixture.w.activeChapter.content'),'')
  })
  await shot('story-1440');await shot('story-1080',1080,760)
  await test('workshop and story scene share the same editable manuscript and preserve manual changes',async()=>{
    await evaluate('window.__storyEditorNode=document.querySelector(".story-prose")')
    await click('.story-workshop-link','工坊编辑');await wait('document.querySelector("#writing-story-editor-host .story-prose")?.getClientRects().length>0')
    assert.equal(await evaluate('document.querySelector("#writing-story-editor-host .story-prose")===window.__storyEditorNode'),true)
    await click('.story-prose');await c.send('Input.dispatchKeyEvent',{type:'keyDown',key:'End',code:'End',windowsVirtualKeyCode:35,modifiers:2});await c.send('Input.dispatchKeyEvent',{type:'keyUp',key:'End',code:'End',windowsVirtualKeyCode:35,modifiers:2});await c.send('Input.insertText',{text:'人工补充：他决定把信交给船长。'})
    await evaluate('window.__storyFixture.story.flush()')
    await click('.story-workshop-bar button','回到故事现场');await click('.story-input-shell .story-primary','继续故事');await wait('window.__storyFixture.story.active.turns.length===5&&!window.__storyFixture.story.busy')
    assert.equal(await evaluate('window.__storyFixture.story.active.turns.at(-1).baseText.includes("人工补充")'),true)
  })
  await test('regeneration switches only the latest turn and keeps alternate variants',async()=>{
    await click('.story-turn-footer>button','换一版');await wait('window.__storyFixture.story.active.turns.at(-1).variants.length===2&&!window.__storyFixture.story.busy')
    await click('.story-variant-controls button','‹');await wait('window.__storyFixture.story.active.turns.at(-1).selected===0')
    assert.equal(await evaluate('window.__storyFixture.story.active.turns.length'),5)
  })
  await test('independent review and selected revision stay inside the story scene',async()=>{
    await click('.story-chapter-caption>button','审阅');await click('.story-inspector-content>button','审读本章');await wait('!!window.__storyFixture.story.active.review&&!window.__storyFixture.story.busy')
    await shot('review-1440')
    await click('.story-checkbox');await click('.story-inspector-content>.story-primary','按所选意见修稿');await wait('!!window.__storyFixture.story.active.confirmation&&!window.__storyFixture.story.busy')
    await click('.story-inspector-content>button','复核原问题');await wait('!!window.__storyFixture.story.active.check&&!window.__storyFixture.story.busy')
    assert.equal(await evaluate('window.__storyFixture.story.active.check.items[0].status'),'resolved')
  })
  await test('failed transport retains current prose and records interruption',async()=>{
    const before=await evaluate('window.__storyFixture.story.active.text');fail=true
    await click('.story-input-shell .story-primary','继续故事');await wait('!window.__storyFixture.story.busy&&!!window.__storyFixture.story.error');fail=false
    assert.equal(await evaluate('window.__storyFixture.story.active.text'),before)
    assert.equal(await evaluate('(async()=>{const f=window.__storyFixture;return (await f.db.airuns.get(f.story.active.lastRunId)).status})()'),'completed','last successfully applied run remains identifiable')
    await evaluate('window.__storyFixture.story.error=""')
  })
  await test('plot discussion stays separate and its selected conclusion becomes optional next-turn guidance',async()=>{
    const before=await evaluate('window.__storyFixture.story.active.text')
    await click('.story-compose-modes button','聊剧情');await click('.story-input-shell .story-primary','一起推演');await wait('!!window.__storyFixture.story.active.discussion?.length&&!window.__storyFixture.story.busy')
    assert.equal(await evaluate('window.__storyFixture.story.active.text'),before)
    await click('.story-discussion>button','把这个方向带入下一幕')
    assert.equal(await evaluate('document.querySelector(".story-input-shell textarea").value.includes("保留船票的秘密")'),true)
    await click('.story-input-shell .story-primary','继续故事');await wait('!window.__storyFixture.story.busy&&window.__storyFixture.story.active.text!=='+JSON.stringify(before))
  })
  await test('automatic chapter advances at most six rounds, independently reviews and never confirms canonical prose',async()=>{
    await evaluate('window.__storyFixture.autoBase=window.__storyFixture.story.active.turns.length')
    await click('.story-config-toggle','故事设定')
    await evaluate(`(()=>{const e=document.querySelector('.story-inspector input[type="number"]');e.value='20000';e.dispatchEvent(new Event('input',{bubbles:true}))})()`)
    await click('.story-compose-secondary button','让 AI 写完本章');await wait('!window.__storyFixture.story.busy&&window.__storyFixture.story.active.turns.length===window.__storyFixture.autoBase+6')
    assert.equal(await evaluate('!!window.__storyFixture.story.active.review'),true)
    assert.equal(await evaluate('window.__storyFixture.w.activeChapter.content'),'')
  })
  await test('stopping generation never commits its late output',async()=>{
    delay=1200;const before=await evaluate('window.__storyFixture.story.active.text')
    await click('.story-input-shell .story-primary','继续故事');await wait('window.__storyFixture.story.busy');await click('.story-stop','停止生成');await wait('!window.__storyFixture.story.busy');delay=0
    assert.equal(await evaluate('window.__storyFixture.story.active.text'),before)
    await evaluate('window.__storyFixture.story.error=""')
  })
  await test('draft survives full reload without issuing a model request',async()=>{
    const before=await evaluate('window.__storyFixture.story.active.text'),book=await evaluate('window.__storyFixture.w.work.id'),chapter=await evaluate('window.__storyFixture.w.selChapterId'),count=requests.length
    await evaluate('window.__storyFixture.story.flush()');await c.send('Page.reload',{ignoreCache:true});await wait('!!window.__ns?.getWork')
    await evaluate(`(async()=>{const w=window.__ns.getWork();if(w.work?.id!==${JSON.stringify(book)})await w.open(${JSON.stringify(book)});w.selChapterId=${JSON.stringify(chapter)};const ui=(await import('/src/stores/ui.js')).useUiStore(),story=(await import('/src/stores/story.js')).useStoryStore();ui.workbenchMode='agent';await story.load(w.work.id,w.selChapterId);window.__storyFixture={w,ui,story,ai:(await import('/src/stores/ai.js')).useAiStore(),db:window.__ns.db};return true})()`)
    await wait('!!window.__storyFixture.story.active')
    assert.equal(await evaluate('window.__storyFixture.story.active.text'),before);assert.equal(requests.length,count)
  })
  await test('chapter confirmation saves canonical text and queues memory through existing application service',async()=>{
    await click('.story-compose-secondary button','确认本章');await click('.story-confirm-actions .story-primary','确认保存本章');await wait('window.__storyFixture.story.active.status==="confirmed"')
    assert.equal(await evaluate('(async()=>{const f=window.__storyFixture;return (await f.db.airuns.where("workId").equals(f.w.work.id).filter(r=>r.type==="memory-queue").toArray()).length>0})()'),true)
    assert.equal(await evaluate('(async()=>{const f=window.__storyFixture;const {plainChapter}=await import("/src/services/project/text.js");return plainChapter(await f.db.chapters.get(f.w.selChapterId))===f.story.active.text})()'),true)
  })
  await shot('confirmed-1440')
  await test('independent window owns editing and synchronizes its actual draft back to the workshop',async()=>{
    await click('.story-top-actions button[aria-label="打开独立窗口"]')
    const until=Date.now()+10000;let found=false
    while(Date.now()<until){const pages=await(await fetch('http://127.0.0.1:'+(process.env.CDP_PORT||9333)+'/json/list')).json();if(pages.some(p=>p.url.includes('panel=agent'))){found=true;break}await c.sleep(100)}
    assert(found,'independent agent window must exist before connecting')
    const panel=await connect('panel=agent',process.env.CDP_PORT||9333)
    async function pe(code){const v=await panel.evalx(code);if(v?.PAGE_ERR)throw Error(v.PAGE_ERR);return v}
    let closed=false
    try{
      assert.equal(await pe('location.search.includes("panel=agent")'),true,'never fall back to the main application window')
      const end=Date.now()+15000;while(Date.now()<end&&!await pe('!!document.querySelector(".story-prose")'))await panel.sleep(100)
      assert.equal(await evaluate('document.querySelector("#agent-story-editor-host .story-prose").contentEditable'),'false','main draft must be read-only after handoff')
      await pe(`(async()=>{const s=(await import('/src/stores/story.js')).useStoryStore();s.edit({text:s.active.text+${JSON.stringify('\n\n独立窗口修订：他把地图交给了船长。')},html:s.active.html+'<p>独立窗口修订：他把地图交给了船长。</p>'});s.active.config.guidance='跨窗口持续要求：保留船票秘密';s.active.config.controlPolicy='participant';await s.save();return true})()`)
      await wait('window.__storyFixture.story.active.text.includes("独立窗口修订")')
      await pe('setTimeout(()=>window.native.panelCloseSelf(),30);true');closed=true
      await wait('document.querySelector("#agent-story-editor-host .story-prose").contentEditable==="true"')
      await click('.story-config-toggle','故事设定')
      assert.equal(await evaluate('document.querySelector(".story-inspector-content textarea").value'),'跨窗口持续要求：保留船票秘密','configuration form must follow remote updates, not overwrite them on next send')
    }finally{if(!closed)await pe('setTimeout(()=>window.native.panelCloseSelf(),30);true').catch(()=>{})}
  })
  await test('lease release storage failure never leaves a permanent busy state',async()=>{
    const state=await evaluate(`(async()=>{const f=window.__storyFixture,put=f.db.airuns.put.bind(f.db.airuns);let failed=false;f.db.airuns.put=async row=>{if(!failed&&row.type==='creative-lock'&&row.status==='completed'){failed=true;throw Error('isolated lease release write failure')}return put(row)};try{await f.story.advance().catch(()=>{});return {failed,busy:f.story.busy}}finally{f.db.airuns.put=put;await f.db.airuns.update('creative-lock:'+f.w.work.id,{owner:null,leaseUntil:0,status:'completed'})}})()`)
    assert.equal(state.failed,true);assert.equal(state.busy,false)
  })
  await test('stop during post-generation source validation does not publish late text',async()=>{
    const state=await evaluate(`(async()=>{const f=window.__storyFixture,get=f.db.airuns.get.bind(f.db.airuns),before=f.story.active.text;let stopped=false;f.db.airuns.get=async id=>{const row=await get(id);if(!stopped&&String(id).startsWith('creative-lock:')&&f.story.liveMessage?.complete){stopped=true;f.story.stop();await new Promise(r=>setTimeout(r,60))}return row};try{await f.story.advance().catch(()=>{});return {stopped,unchanged:f.story.active.text===before}}finally{f.db.airuns.get=get}})()`)
    assert.equal(state.stopped,true);assert.equal(state.unchanged,true)
  })
  await test('chapter confirmation freezes editing until the application and document are saved',async()=>{
    try{
      const locked=await evaluate(`(async()=>{const f=window.__storyFixture;f.originalApply=f.w.applyAiProposal;f.w.applyAiProposal=async function(...args){await new Promise(r=>setTimeout(r,300));return f.originalApply.apply(this,args)};f.confirmPromise=f.story.confirm().then(()=>true,e=>({error:e.message}));await new Promise(r=>setTimeout(r,70));return f.story.readOnly})()`)
      assert.equal(locked,true,'closing the confirmation modal must not permit editing the in-flight snapshot')
    }finally{const outcome=await evaluate('(async()=>{const f=window.__storyFixture;const outcome=await f.confirmPromise;f.w.applyAiProposal=f.originalApply;return outcome})()');assert.equal(outcome,true,JSON.stringify(outcome))}
  })
  await test('reopening recovers an applied chapter when the final document status write failed',async()=>{
    const saved=await evaluate(`(async()=>{const f=window.__storyFixture;f.story.edit({text:f.story.active.text+${JSON.stringify('\n\n最后一行。')},html:f.story.active.html+'<p>最后一行。</p>'});await f.story.flush();const put=f.db.airuns.put.bind(f.db.airuns);let failed=false;f.db.airuns.put=async row=>{if(!failed&&row.type==='story-document'&&row.status==='confirmed'){failed=true;throw Error('isolated confirmation status failure')}return put(row)};try{await f.story.confirm().catch(()=>{})}finally{f.db.airuns.put=put}return {failed,book:f.w.work.id,chapter:f.w.selChapterId,count:(await f.db.airuns.where('workId').equals(f.w.work.id).filter(r=>r.type==='application').toArray()).length}})()`)
    assert.equal(saved.failed,true)
    await c.send('Page.reload',{ignoreCache:true});await wait('!!window.__ns?.getWork')
    const result=await evaluate(`(async()=>{const w=window.__ns.getWork();if(w.work?.id!==${JSON.stringify(saved.book)})await w.open(${JSON.stringify(saved.book)});w.selChapterId=${JSON.stringify(saved.chapter)};const s=(await import('/src/stores/story.js')).useStoryStore();await s.load(w.work.id,w.selChapterId);window.__storyFixture={w,story:s,db:window.__ns.db};let error='';await s.confirm().catch(e=>error=e.message);return {error,status:s.active?.status,count:(await window.__ns.db.airuns.where('workId').equals(w.work.id).filter(r=>r.type==='application').toArray()).length}})()`)
    assert.equal(result.error,'');assert.equal(result.status,'confirmed');assert.equal(saved.count,result.count,'recovery must not apply or enqueue a second time')
  })
}catch(e){console.error(e.stack);if(!results.some(r=>!r.ok))results.push({name:'setup',ok:false,error:e.message})}
finally{
  await evaluate(`(async()=>{(await import('/src/services/ai/memory-queue.js')).cancelMemoryJobs();const db=window.__ns.db;await db.appconfig.bulkDelete(['ai.providers','ai.activeProviderId','ai.stageConfig','ai.cred.story-test','skin']);await db.appconfig.bulkPut(${JSON.stringify(restore)});await (await import('/src/stores/ai.js')).useAiStore().loadSettings();return true})()`).catch(()=>{})
  server.closeAllConnections();await new Promise(r=>server.close(r));writeFileSync(out+'/verification.json',JSON.stringify({kind:'deterministic-application',requests:requests.length,results},null,2));console.log(`${results.filter(r=>r.ok).length}/${results.length} passed`);process.exit(results.every(r=>r.ok)?0:1)
}
