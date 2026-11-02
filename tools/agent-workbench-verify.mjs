// Isolated application acceptance with deterministic model transport, not a quality evaluation.
import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {mkdirSync,writeFileSync} from 'node:fs'
import {connect} from './_cdp-lib.mjs'
import {assertAiTestProfile} from './_ai-test-profile.mjs'
import {buildSeedExpr} from './verify-seeds.mjs'
const results=[],requests=[]
const prose=`雾沿着石阶爬上渡口。林昭把最后一枚铜钱压在船票上，纸角被潮气卷起，露出背面的半行墨迹。

“这班船，昨夜已经走了。”守灯人没有抬头。

林昭望向河面。泊位上的缆绳还绷着，水底却传来一声船钟。他没有提起钟声，只把那张旧票推近了一寸。“那就问问，昨夜是谁收的票。”

守灯人的手停在灯芯旁。他的左腕缠着一圈褪色的红线，恰好遮住林昭一直在找的烙印。

铜符毫无代价地释放了力量。灯焰向河面倾过去，照见水下另一层台阶。守灯人终于抬起脸，却看的不是林昭，而是他身后的空处。

“你带了谁来？”他问。

林昭没有回头。他只知道那条巷子里一直有第二种脚步声，停得比自己慢半拍。眼下，那声音停在了最后一级石阶。

他将铜符扣进掌心，收起船票。“先告诉我，这盏灯为什么不能灭。”`
const revised=prose.replace('铜符毫无代价地释放了力量。','铜符吸走了他的体力，才释放出力量。')
const server=createServer(async(req,res)=>{
  res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Headers','*')
  if(req.method==='OPTIONS'){res.end();return}
  let raw='';for await(const b of req)raw+=b
  let body;try{body=JSON.parse(raw)}catch{res.writeHead(400);res.end();return}
  requests.push(body);let task
  for(const m of body.messages||[])for(const line of String(m.content||'').split('\n'))if(line.startsWith('{"type":"chapter.'))try{task=JSON.parse(line)}catch{}
  let name,data
  if(task?.type==='chapter.plan'){name='submit_chapter_plan';data={data:{title:'雾灯未熄',scenes:[{id:'harbor',goal:'查明旧船票的来源',pov:'林昭',characters:['林昭'],conflict:'守灯人隐瞒昨夜的船',turn:'铜符照见水下台阶',ending:'追问不能熄灭的灯',targetWords:1500}]}}}
  else if(task?.type==='chapter.draft'){name='submit_chapter';data={title:'雾灯未熄',text:prose,warnings:[],evidence:[],review:'生成时核查说明'}}
  else if(task?.type==='chapter.review'){name='submit_review';data={data:{items:[{id:'cost',severity:'warning',category:'能力代价',problem:'铜符力量没有付出已设定的体力代价',expected:'呈现已经发生的体力消耗，保留渡口试探',quote:'铜符毫无代价地释放了力量。',evidence:[]}]}}}
  else if(task?.type==='chapter.revise'){name='submit_chapter';data={title:'雾灯未熄 · 修订',text:revised,evidence:[],warnings:[],review:'需独立复核'}}
  else if(task?.type==='chapter.recheck'){name='submit_recheck';data={data:{items:task.confirmedReview.items.map(i=>({id:i.id,status:'resolved',quote:'铜符吸走了他的体力，才释放出力量。',explanation:'本章已实际消耗体力。'}))}}}
  else {res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:{message:'isolated memory fixture unavailable'}}));return}
  res.writeHead(200,{'Content-Type':'text/event-stream'})
  res.write('data: '+JSON.stringify({choices:[{index:0,delta:{tool_calls:[{index:0,id:'stage',type:'function',function:{name,arguments:JSON.stringify(data)}}]},finish_reason:null}]})+'\n\n')
  res.end('data: '+JSON.stringify({choices:[{index:0,delta:{},finish_reason:'tool_calls'}],usage:{prompt_tokens:200,completion_tokens:100,total_tokens:300}})+'\n\ndata: [DONE]\n\n')
})
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
process.env.AI_TEST_PROFILE='booksource-verify'
const port=process.env.CDP_PORT||9333,c=await connect('http://',port)
let panel,restore
const evalWith=async(client,code)=>{const v=await client.evalx(code);if(v?.PAGE_ERR)throw Error(v.PAGE_ERR);return v}
const evaluate=code=>evalWith(c,code)
async function wait(code,client=c){const end=Date.now()+20000;while(Date.now()<end){if(await evalWith(client,code))return;await client.sleep(80)}throw Error('Timed out: '+code)}
async function test(name,fn){try{await fn();results.push({name,ok:true});console.log('PASS '+name)}catch(e){results.push({name,ok:false,error:e.message});console.log('FAIL '+name+' '+e.message);throw e}}
const click=async(selector,text)=>{
  const find=`[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.getClientRects().length&&e.textContent.includes(${JSON.stringify(text)})&&!e.disabled)`
  await wait(`!!(${find})`)
  assert.equal(await evaluate(`(()=>{const el=${find};if(!el)return false;el.click();return true})()`),true,'visible enabled action '+text)
}
const evidence='docs/恍然梦AI工作台/implementation-20261027'
mkdirSync(evidence,{recursive:true})
async function screenshot(name,width=1440,height=900){await c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await c.send('Page.bringToFront');await wait('document.fonts.status==="loaded"');await c.sleep(150);const shot=await c.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(evidence+'/'+name+'.png',Buffer.from(shot.data,'base64'))}
try{
  await c.send('Page.reload',{ignoreCache:true});await c.sleep(400);await wait('!window.__agentFixture&&!!window.__ns?.getWork')
  await wait('!!window.__ns?.getWork');assertAiTestProfile(await evaluate('window.native.getDataLocation()'))
  const browserWindow=await c.send('Browser.getWindowForTarget');await c.send('Browser.setWindowBounds',{windowId:browserWindow.windowId,bounds:{windowState:'normal'}});await c.send('Page.bringToFront')
  await evaluate("window.__creativeFixture?.ai.cancel();document.querySelectorAll('.n-modal-mask').forEach(e=>e.click())")
  const seed=await evaluate(buildSeedExpr('AI 验证书',{reset:true}));assert(seed.ok)
  restore=await evaluate(`(async()=>{const db=window.__ns.db;return (await db.appconfig.toArray()).filter(r=>['ai.providers','ai.activeProviderId','ai.stageConfig','ai.cred.workbench-fixture','skin'].includes(r.key))})()`)
  await evaluate(`(async()=>{
    const db=window.__ns.db,w=window.__ns.getWork();await w.open(${JSON.stringify(seed.books[0].workId)});const ui=(await import('/src/stores/ui.js')).useUiStore();await ui.setSkin('original');ui.workbenchMode='writing';ui.agentCandidateId=null;
    const ai=(await import('/src/stores/ai.js')).useAiStore();await ai.loadSettings();await ai.loadPresets();
    const provider={id:'workbench-fixture',enabled:true,name:'隔离创作验证',baseURL:${JSON.stringify('http://127.0.0.1:'+server.address().port+'/v1')},apiFormat:'openai',activeModel:'workbench-fixture',models:[{name:'workbench-fixture',enabled:true}],params:{maxContext:64000,temperature:0,privacy:false,kb:{auto:false}},modelCfg:{'workbench-fixture':{enabled:true,maxTokens:6000,contextWindow:64000}}};
    const cipher=await window.native.credentialEncrypt('local-workbench-fixture');await db.appconfig.bulkPut([{key:'ai.providers',value:[provider]},{key:'ai.activeProviderId',value:provider.id},{key:'ai.cred.workbench-fixture',value:cipher}]);await db.appconfig.delete('ai.stageConfig');await ai.loadSettings();
    const autosave=(await import('/src/services/autosave.js')).autosave;w.work.title='雾港来信';autosave.mark('works',w.work);
    const names=['雾灯未熄','旧船票','渡口的价码'];for(const [i,ch]of w.liveChapters.entries()){ch.title=names[i]||ch.title;autosave.mark('chapters',ch);let n=w.olnodeByRef(ch.id);if(!n)n=w.olnodeAdd(null,{kind:'anchor',refId:ch.id,title:ch.title});n.outlineNature='future';n.text='林昭在渡口追查旧船票，用铜符显露水下台阶，必须承担体力代价。';autosave.mark('olnodes',n)}await autosave.flushAll();
    const flow=(await import('/src/stores/creative-workflow.js')).useCreativeWorkflowStore();flow.visible=false;const old=await db.airuns.where('workId').equals(w.work.id).filter(r=>r.type==='creative-workflow'||r.type==='creative-lock').toArray();await db.airuns.bulkDelete(old.map(r=>r.id));delete flow.byWork[w.work.id];
    window.__agentFixture={w,ui,ai,flow,db,autosave};return true
  })()`)
  await wait('!!window.__ns.editor&&!window.__ns.editor.isDestroyed')
  await test('same editor, selection and undo session survive workbench switching',async()=>{
    await evaluate('window.__agentEditor=window.__ns.editor;window.__ns.editor.commands.setTextSelection(3);window.__formalBefore=window.__ns.getWork().activeChapter.content')
    await click('.workbench-shell button','恍然梦-入梦');await click('.story-rail-bottom>button','高级创作工具');await wait("document.querySelector('.hm-workbench').getClientRects().length>0")
    assert.equal(await evaluate('window.__ns.editor===window.__agentEditor&&window.__ns.editor.state.selection.from===3'),true)
  })
  await test('chapter plan is saved through the real editor form',async()=>{
    await click('.hm-view-tabs button','章纲与场景')
    await evaluate(`(()=>{const e=document.querySelector('.hm-plan>label textarea');e.value='林昭在渡口追查旧船票，用铜符显露水下台阶，必须承担体力代价。';e.dispatchEvent(new Event('input',{bubbles:true}))})()`)
    await click('.hm-plan>button','保存关联章纲');await wait("document.body.textContent.includes('本章章纲已保存')")
    assert.equal(await evaluate('(async()=>{const f=window.__agentFixture,n=f.w.olnodeByRef(f.w.selChapterId);return (await f.db.olnodes.get(n.id)).text===n.text})()'),true)
  })
  await test('unsaved outline drafts survive chapter navigation and work reopening',async()=>{
    await evaluate(`(()=>{const e=document.querySelector('.hm-plan>label textarea');e.value+='保留作者草稿。';e.dispatchEvent(new Event('input',{bubbles:true}));window.__outlineDraft=e.value})()`)
    const originalId=await evaluate('window.__agentFixture.w.selChapterId')
    await click('.hm-chapter-row','旧船票');await wait("window.__agentFixture.w.activeChapter.title==='旧船票'&&!document.querySelector('.hm-chapters-head button').disabled")
    await click('.hm-chapter-row','雾灯未熄');await wait("window.__agentFixture.w.activeChapter.title==='雾灯未熄'&&!document.querySelector('.hm-chapters-head button').disabled")
    await click('.hm-view-tabs button','章纲与场景');await wait('document.querySelector(".hm-plan>label textarea")?.value===window.__outlineDraft')
    assert.equal(await evaluate('document.querySelector(".hm-plan>label textarea").value===window.__outlineDraft'),true)
    assert.equal(await evaluate('(async()=>{const f=window.__agentFixture;return !(await f.db.olnodes.get(f.w.olnodeByRef(f.w.selChapterId).id)).text.includes("保留作者草稿")})()'),true,'local drafts must not silently become author facts')
    await click('.hm-chapter-row','雾灯未熄');await wait("!document.querySelector('.hm-chapters-head button').disabled");await click('.hm-view-tabs button','章纲与场景')
    await wait('!!document.querySelector(".hm-plan>label textarea")')
    assert.equal(await evaluate('document.querySelector(".hm-plan>label textarea").value===window.__outlineDraft'),true,'reselecting the same chapter must retain input')
    await evaluate(`(async()=>{const w=window.__agentFixture.w,id=w.work.id;await w.closeWork();await w.open(id);w.selChapterId=${JSON.stringify(originalId)}})()`)
    await click('.story-rail-bottom>button','高级创作工具')
    await wait('!!document.querySelector(".hm-view-tabs")');await click('.hm-view-tabs button','章纲与场景')
    await wait('!!document.querySelector(".hm-workbench")&&document.querySelector(".hm-plan>label textarea")?.value===window.__outlineDraft')
    await click('.hm-direction button','新建本章任务');await wait("!!window.__agentFixture.flow.active&&!document.querySelector('.hm-chapters-head button').disabled")
    assert.equal(await evaluate('(async()=>{const f=window.__agentFixture;return (await f.db.olnodes.get(f.w.olnodeByRef(f.w.selChapterId).id)).text===window.__outlineDraft})()'),true,'new tasks must freeze the edited outline')
  })
  await test('real UI plans then drafts a candidate without changing formal prose',async()=>{
    await click('.hm-direction button','新建本章任务');await wait("!!window.__agentFixture.flow.active&&!document.querySelector('.hm-chapters-head button').disabled")
    await click('.hm-direction .agent-primary','生成场景计划');await wait('!!window.__agentFixture.flow.active.chapters[0].plan&&!window.__agentFixture.flow.running')
    await click('.hm-direction .agent-primary','按计划起草');await wait('!!document.querySelector(".hm-workbench .candidate-prose")&&!window.__agentFixture.flow.running')
    assert.equal(await evaluate('window.__ns.getWork().activeChapter.content===window.__formalBefore'),true)
    await screenshot('candidate-1440')
  })
  await test('independent review, selected revision and targeted recheck run from UI',async()=>{
    await click('.hm-direction .agent-primary','独立审稿');await wait("!!document.querySelector('.hm-finding')&&!window.__agentFixture.flow.running")
    await screenshot('review-1440');await screenshot('review-1280',1280,800)
    assert.equal(await evaluate("document.querySelector('.hm-review>.agent-primary').disabled"),true,'no selected findings must disable revision')
    await evaluate("document.querySelector('.hm-finding .hm-check input').click()")
    await click('.hm-review>.agent-primary','按所选意见修稿');await wait('!!window.__agentFixture.flow.active.chapters[0].revisionId&&!window.__agentFixture.flow.running')
    await click('.hm-review>button','定向复核');await wait('!!window.__agentFixture.flow.active.chapters[0].check&&!window.__agentFixture.flow.running')
  })
  await test('candidate handoff stays a candidate and author edits persist',async()=>{
    await evaluate("window.__agentFixture.w.tab='outline'")
    await click('.hm-workbench .candidate-toolbar button','到手写工作台精修');await wait("window.__agentFixture.ui.workbenchMode==='writing'&&!!window.__agentFixture.ui.agentCandidateId")
    assert.equal(await evaluate("window.__agentFixture.w.tab==='chapters'&&window.__agentFixture.w.selChapterId===window.__agentFixture.flow.active.chapters[0].chapterId"),true,'handoff must explicitly choose its chapter and module')
    assert.equal(await evaluate('window.__ns.getWork().activeChapter.content===window.__formalBefore'),true)
    await evaluate(`(()=>{const e=document.querySelector('.workbench-shell .candidate-prose');e.value+=String.fromCharCode(10,10)+'林昭把铜符收回袖中。';e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('blur'))})()`)
    await evaluate('window.__agentFixture.w.selChapterId=window.__agentFixture.w.liveChapters[1].id');await wait('!window.__agentFixture.ui.agentCandidateId')
    assert.equal(await evaluate("!document.querySelector('.workbench-shell .candidate-prose')"),true,'manual navigation must dismiss another chapter candidate')
    await evaluate('window.__agentFixture.w.selChapterId=window.__agentFixture.flow.active.chapters[0].chapterId')
    await click('.workbench-shell button','恍然梦-入梦');await wait("window.__agentFixture.ui.workbenchMode==='agent'")
    assert.equal(await evaluate('window.__agentFixture.flow.latest(0).editText.endsWith("林昭把铜符收回袖中。")'),true)
  })
  await test('failed candidate save retains text and exposes failure',async()=>{
    await evaluate(`(()=>{const f=window.__agentFixture;f.put=f.db.airuns.put;f.db.airuns.put=async()=>{throw Error('intentional candidate save failure')}})()`)
    await evaluate(`(()=>{const e=document.querySelector('.hm-workbench .candidate-prose');e.value+='保存失败仍保留。';e.dispatchEvent(new Event('input',{bubbles:true}))})()`)
    await click('.hm-workbench .candidate-footer button','保存候选');await wait("document.querySelector('.hm-workbench .candidate-editor').textContent.includes('intentional candidate save failure')")
    await evaluate('window.__agentFixture.flow.load()')
    assert.equal(await evaluate('document.querySelector(".hm-workbench .candidate-prose").value.endsWith("保存失败仍保留。")'),true,'background reload must retain unsaved changes after failure')
    await evaluate('window.__agentFixture.db.airuns.put=window.__agentFixture.put')
    await click('.hm-workbench .candidate-footer button','保存候选');await wait("!document.querySelector('.hm-workbench .candidate-editor .agent-error')")
  })
  await test('adoption keeps the candidate confirmed before an asynchronous save',async()=>{
    const originalId=await evaluate(`(()=>{const f=window.__agentFixture;f.persist=f.flow.persist;f.adopt=f.flow.adopt;f.expected=f.flow.latest(0).id;f.flow.persist=()=>new Promise(resolve=>f.release=resolve);f.flow.adopt=async(index,id)=>{f.adoptedId=id};return f.expected})()`)
    await click('.hm-workbench .candidate-footer button','采纳为正式正文');await wait('!!window.__agentFixture.release')
    await evaluate(`(()=>{const f=window.__agentFixture,e=document.querySelector('.hm-version-select select');e.value=f.flow.active.chapters[0].artifacts.find(c=>c.id!==f.expected).id;e.dispatchEvent(new Event('change',{bubbles:true}));f.release()})()`)
    await wait('!!window.__agentFixture.adoptedId')
    assert.equal(await evaluate('window.__agentFixture.adoptedId'),originalId)
    await evaluate("(()=>{const f=window.__agentFixture;f.flow.persist=f.persist;f.flow.adopt=f.adopt;const e=document.querySelector('.hm-version-select select');e.value='';e.dispatchEvent(new Event('change',{bubbles:true}))})()")
  })
  await test('adoption selects its explicit target and atomically registers saved-prose memory',async()=>{
    assert.equal(await evaluate(`(async()=>{const {w,flow,db}=window.__agentFixture;const chapterId=flow.active.chapters[0].chapterId,card=flow.latest(0);w.selChapterId=w.liveChapters[1].id;await new Promise(r=>setTimeout(r,30));await flow.adopt(0,card.id);const row=await db.chapters.get(chapterId),jobs=await db.airuns.where('workId').equals(w.work.id).toArray();return w.selChapterId===chapterId&&row.content.includes('林昭把铜符收回袖中')&&jobs.some(j=>j.type==='memory-queue'&&j.chapterId===chapterId)&&jobs.some(j=>j.type==='application'&&j.cardId===card.id&&j.status==='applied')})()`),true)
  })
  await test('six navigation pages open with real chapter, material and run data',async()=>{
    for(const label of ['故事规划','章节生产','审稿与修订','作品资料','运行与历史','创作台']){await click('.hm-navigation>button',label);await wait(`document.querySelector('.hm-topbar').textContent.includes(${JSON.stringify(label)})`)}
    await screenshot('adopted-1440')
  })
  await test('failed edit-right handoff preserves pending local prose and editor history',async()=>{
    await evaluate("window.__beforeHandoffEditor=window.__ns.editor;window.__beforeHandoffPreparation=window.__prepareForPanel;window.__ns.editor.commands.insertContent('移交失败仍保留。');window.__prepareForPanel=async()=>{throw Error('intentional handoff failure')}")
    try{
      assert.equal(await evaluate("window.native.panelOpen({type:'agent',workId:window.__ns.getWork().work.id,entityId:''}).then(r=>!r.ok&&r.reason==='save-failed')"),true)
      await wait('window.__ns.editor.isEditable')
      assert.equal(await evaluate('window.__ns.editor===window.__beforeHandoffEditor&&window.__ns.editor.getText().includes("移交失败仍保留。")'),true,'failed handoff must retain pending input and the same undo session')
    }finally{await evaluate('window.__prepareForPanel=window.__beforeHandoffPreparation')}
    await evaluate('window.__agentFixture.autosave.flushAll()')
  })
  await test('dedicated AI window mounts and owns the formal editor lock',async()=>{
    await evaluate("window.__ns.editor.commands.insertContent('移交前待保存。')")
    await click('.hm-topbar button','独立窗口');await wait("window.__ns.getWork().popped===undefined||true")
    for(let n=0;n<40;n++){const pages=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();if(pages.some(p=>p.url.includes('panel=agent%3A')))break;await c.sleep(100)}
    panel=await connect('panel=agent%3A',port);await wait('!!document.querySelector(".hm-workbench")&&!!window.__ns?.editor',panel)
    await evalWith(panel,"[...document.querySelectorAll('.story-rail-bottom>button')].find(e=>e.textContent.includes('高级创作工具')).click()")
    assert.equal(await evalWith(panel,'window.__ns.editor.isEditable'),true)
    assert.equal(await evalWith(panel,'window.__ns.editor.getText().includes("移交前待保存。")'),true,'the new owner must receive pending local edits')
    await wait('!window.__ns.editor.isEditable')
    assert.equal(await evaluate("window.native.panelOpen({type:'chapter',workId:window.__ns.getWork().work.id,entityId:window.__ns.getWork().chapters[1].id}).then(r=>!r.ok)"),true)
  })
  await test('AI window runs and adopts while the main window stays on the bookshelf',async()=>{
    const workId=await evaluate('window.__ns.getWork().work.id');await evaluate('window.__ns.getWork().closeWork()')
    assert.equal(await evalWith(panel,`(async()=>{const w=window.__ns.getWork(),flow=(await import('/src/stores/creative-workflow.js')).useCreativeWorkflowStore();await flow.create({chapterIds:[w.liveChapters[1].id],maxTokens:120000});await flow.dispatch('run');if(flow.active.status!=='completed')return {error:flow.active.error};await flow.adopt(0,flow.latest(0).id);return flow.latest(0).status==='applied'})()`),true)
    assert.equal(await evaluate("(async()=>(await import('/src/stores/ui.js')).useUiStore().view==='shelf')()"),true)
    await evaluate(`window.__ns.getWork().open(${JSON.stringify(workId)})`);await wait('!!window.__ns.editor');assert.equal(await evaluate('window.__ns.editor.isEditable'),false)
  })
  await test('closing dedicated window restores formal editing without copying the book',async()=>{
    const chapterId=await evalWith(panel,'window.__ns.editorTarget.chapterId')
    await evaluate(`window.__ns.getWork().selChapterId=${JSON.stringify(chapterId)}`);await c.sleep(100)
    await evalWith(panel,"(async()=>{const ed=window.__ns.editor;ed.commands.insertContent('跨窗口最新正文。');await (await import('/src/services/autosave.js')).autosave.flushAll();return true})()")
    await evalWith(panel,'window.native.panelCloseSelf()');panel=null;await wait('window.__ns.editor.isEditable')
    assert.equal(await evaluate('window.__ns.editor.getText().includes("跨窗口最新正文。")'),true,'unlock must refresh actual editor, not only Pinia row')
    assert.equal(await evaluate('window.__ns.editor.can().undo()'),false,'external edits must not leave stale undo history')
    assert.equal(await evaluate('(async()=>{const ed=window.__ns.editor;ed.commands.insertContent("继续手写。");await window.__agentFixture.autosave.flushAll();return (await window.__agentFixture.db.chapters.get(window.__ns.editorTarget.chapterId)).content.includes("跨窗口最新正文。")})()'),true,'next edit must retain the external body')
    assert.equal(await evaluate('window.__ns.getWork().chapters.some(ch=>ch.content.includes("铜符吸走了他的体力"))'),true)
  })
  await test('failed close retains the AI window and manual shelf exit releases its lock',async()=>{
    await click('.story-rail-bottom>button','高级创作工具')
    await click('.hm-topbar button','独立窗口')
    for(let n=0;n<40;n++){const pages=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();if(pages.some(p=>p.url.includes('panel=agent%3A')))break;await c.sleep(100)}
    panel=await connect('panel=agent%3A',port);await wait('!!window.__ns?.editor&&!!document.querySelector(".hm-workbench")',panel)
    await evalWith(panel,"[...document.querySelectorAll('.story-rail-bottom>button')].find(e=>e.textContent.includes('高级创作工具')).click()")
    await evalWith(panel,"(async()=>{window.__closeFlow=(await import('/src/stores/creative-workflow.js')).useCreativeWorkflowStore();await window.__closeFlow.load();return true})()")
    await wait('!!window.__closeFlow.active',panel)
    await evalWith(panel,"(async()=>{window.__closePersist=window.__closeFlow.persist;window.__closeFlow.persist=async()=>{throw Error('intentional close failure')};await window.native.panelCloseSelf();return true})()")
    await wait("document.querySelector('.hm-alert')?.textContent.includes('窗口与输入已保留')",panel)
    assert.equal(await evalWith(panel,'document.body.inert'),false,'failed close must restore input')
    assert.equal(await evaluate('window.__ns.editor.isEditable'),false,'failed close must keep the edit lock')
    await evalWith(panel,"window.__closeFlow.persist=window.__closePersist;[...document.querySelectorAll('.hm-topbar button')].find(e=>e.textContent.includes('转入手写')).click()")
    await wait("document.querySelector('.workbench-shell').getClientRects().length>0",panel)
    await evalWith(panel,"document.querySelector('.workbench-shell .app-topbar-brand').click()");panel=null
    await wait('window.__ns.editor.isEditable')
    assert.equal(await evaluate('!!window.__ns.getWork().work'),true,'closing the panel must leave the main book intact')
  })
}catch(e){console.error(e.stack);if(!results.some(r=>!r.ok))results.push({name:'setup',ok:false,error:e.message})}
finally{
  if(panel)await panel.evalx('window.native.panelCloseSelf()').catch(()=>{})
  await evaluate(`(async()=>{const db=window.__ns.db;const f=window.__agentFixture;if(f?.put)f.db.airuns.put=f.put;if(f?.persist)f.flow.persist=f.persist;if(f?.adopt)f.flow.adopt=f.adopt;f?.ai.cancel();(await import('/src/services/ai/memory-queue.js')).cancelMemoryJobs();await db.appconfig.bulkDelete(['ai.providers','ai.activeProviderId','ai.stageConfig','ai.cred.workbench-fixture','skin']);if(${JSON.stringify(restore||[])}.length)await db.appconfig.bulkPut(${JSON.stringify(restore||[])});await (await import('/src/stores/ai.js')).useAiStore().loadSettings();return true})()`).catch(()=>{})
  server.closeAllConnections();await new Promise(r=>server.close(r));writeFileSync(evidence+'/verification.json',JSON.stringify({kind:'deterministic-ui-integration',requests:requests.length,results},null,2));console.log(results.filter(r=>r.ok).length+'/'+results.length+' checks passed');process.exit(results.every(r=>r.ok)?0:1)
}
