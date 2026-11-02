// Deterministic transport + real application/store/IndexedDB acceptance. Not a model-quality test.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { writeFileSync } from 'node:fs'
import { connect } from './_cdp-lib.mjs'
import { assertAiTestProfile } from './_ai-test-profile.mjs'
import { buildSeedExpr } from './verify-seeds.mjs'
const requests=[],results=[]
let revisionFailures=0
const server=createServer(async(req,res)=>{
  res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Headers','*')
  if(req.method==='OPTIONS'){res.writeHead(204);res.end();return}
  let raw='';for await(const chunk of req)raw+=chunk
  const body=JSON.parse(raw);requests.push(body)
  let task
  for(const msg of body.messages||[])for(const line of String(msg.content||'').split('\n'))if(line.startsWith('{"type":"chapter.'))try{task=JSON.parse(line)}catch{}
  const type=task?.type
  let name,data
  if(type==='chapter.plan'){name='submit_chapter_plan';data={data:{title:'铜符试验',scenes:[{id:'scene1',goal:'验证铜符',pov:'林昭',characters:['林昭'],conflict:'力量需要代价',turn:'主动承担代价',ending:'决定继续调查',targetWords:100}]}}}
  else if(type==='chapter.draft'){name='submit_chapter';data={title:'验证候选',text:'林昭举起铜符。铜符毫无代价地释放了力量。林昭决定继续调查。',warnings:[],evidence:[],review:'生成自评，不能代替审稿'}}
  else if(type==='chapter.review'){name='submit_review';data={data:{items:[{id:'cost',category:'能力代价',severity:'warning',problem:'力量未付出代价',expected:'明确承担体力代价',quote:'铜符毫无代价地释放了力量。',evidence:[]}]}}}
  else if(type==='chapter.revise'){
    if(revisionFailures){revisionFailures--;res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:{message:'intentional transient transport failure'}}));return}
    name='submit_chapter';data={title:'修稿候选',text:'林昭举起铜符。铜符吸走了他的体力，才释放出力量。林昭扶着墙，决定继续调查。',evidence:[],warnings:[],review:'修稿仍需作者检查'}
  }
  else if(type==='chapter.recheck'){name='submit_recheck';data={data:{items:task.confirmedReview.items.map(item=>({id:item.id,status:'resolved',quote:'铜符吸走了他的体力，才释放出力量。',explanation:'明确写出已消耗的体力。'}))}}}
  else {res.writeHead(400);res.end(JSON.stringify({error:{message:'unexpected fixture task '+type}}));return}
  assert(body.tools.some(t=>t.function.name===name),'registered stage output tool')
  res.writeHead(200,{'Content-Type':'text/event-stream'})
  res.write('data: '+JSON.stringify({choices:[{index:0,delta:{tool_calls:[{index:0,id:'fixture',type:'function',function:{name,arguments:JSON.stringify(data)}}]},finish_reason:null}]})+'\n\n')
  res.write('data: '+JSON.stringify({choices:[{index:0,delta:{},finish_reason:'tool_calls'}],usage:{prompt_tokens:200,completion_tokens:100,total_tokens:300}})+'\n\n');res.end('data: [DONE]\n\n')
})
await new Promise(r=>server.listen(0,'127.0.0.1',r))
process.env.AI_TEST_PROFILE='booksource-verify'
const c=await connect('app://',process.env.CDP_PORT||9333)
async function evaluate(expression){const v=await c.evalx(expression);if(v?.PAGE_ERR)throw new Error(v.PAGE_ERR);return v}
async function test(name,body){try{const v=await evaluate(`(async()=>{const {w,ai,flow,db}=window.__creativeFixture;${body}})()`);assert.equal(v,true,JSON.stringify(v));results.push({name,ok:true});console.log('PASS '+name)}catch(e){results.push({name,ok:false,error:e.message});console.log('FAIL '+name+' '+e.message)}}
try{
  for(let i=0;i<80&&!await c.evalx('!!window.__ns?.getWork');i++)await c.sleep(100)
  assertAiTestProfile(await evaluate('window.native.getDataLocation()'))
  const realConfig=await evaluate(`(async()=>{const a=(await import('/src/stores/ai.js')).useAiStore();await a.loadSettings();return {ready:a.ready,model:a.model,expected:a.model==='deepseek-v4.1-flash'||a.model==='deepseek/deepseek-v4.1-flash'}})()`)
  console.log('Isolated model configuration: '+JSON.stringify(realConfig))
  const seed=await evaluate(buildSeedExpr('AI 验证书',{reset:true}));assert(seed.ok)
  const url='http://127.0.0.1:'+server.address().port+'/v1'
  await evaluate(`(async()=>{
    const db=window.__ns.db,w=window.__ns.getWork();await w.open(${JSON.stringify(seed.books[0].workId)});
    const ai=(await import('/src/stores/ai.js')).useAiStore();await ai.loadSettings();await ai.loadPresets();
    const restore={providers:JSON.parse(JSON.stringify(ai.providers)),credentials:{...ai.credentials},activeProviderId:ai.activeProviderId,stage:await db.appconfig.get('ai.stageConfig')};
    await db.appconfig.delete('ai.stageConfig');
    const cipher=await window.native.credentialEncrypt('local-mechanism-fixture');
    ai.providers=[{id:'creative-fixture',enabled:true,name:'机制验证',baseURL:${JSON.stringify(url)},apiFormat:'openai',activeModel:'creative-fixture',models:[{name:'creative-fixture',enabled:true}],params:{maxContext:64000,temperature:0,privacy:false,kb:{auto:false}},modelCfg:{'creative-fixture':{enabled:true,maxTokens:6000,contextWindow:64000}}}];ai.activeProviderId='creative-fixture';ai.credentials={'creative-fixture':cipher};
    for(const ch of w.chapters.slice(0,2)){const node=w.olnodes.find(n=>!n.refId);node.refId=ch.id;node.title='验证铜符';node.text='林昭验证铜符并承担体力消耗，结束后继续调查。';(await import('/src/services/autosave.js')).autosave.mark('olnodes',node)}
    await (await import('/src/services/autosave.js')).autosave.flushAll();
    const flow=(await import('/src/stores/creative-workflow.js')).useCreativeWorkflowStore();
    window.__creativeFixture={db,w,ai,flow,restore};return true
  })()`)
  await test('real stage tools create linked batch candidates without writing prose',`const ids=w.chapters.slice(0,2).map(c=>c.id);window.__creativeFixture.before=JSON.stringify(w.chapters);await flow.create({chapterIds:ids,autoRevise:true,maxTokens:120000});await flow.dispatch('run');if(flow.active.status!=='completed')return {status:flow.active.status,error:flow.active.error,stages:flow.active.stages};return flow.active.chapters.every(ch=>ch.artifacts.length===2&&ch.check.items[0].status==='resolved')&&JSON.stringify(w.chapters)===window.__creativeFixture.before&&flow.active.chapters[1].artifacts[0].dependencies.length===1;`)
  await test('author edits invalidate review and all downstream candidate dependencies',`const card=flow.latest(0);flow.editCandidate(card,'作者编辑了修稿。');await flow.persist();const core=await import('/src/services/ai/workflow-core.js');let refused=false;try{core.assertCandidateDependencies(flow.active,flow.latest(1))}catch{refused=true}return !flow.active.chapters[0].check&&!flow.active.chapters[0].review&&refused;`)
  revisionFailures=1
  await test('interrupted revision keeps confirmation and resumes same repair cycle',`await flow.create({chapterIds:[w.chapters[0].id],autoRevise:true,maxTokens:120000});await flow.dispatch('run');const run=flow.active;window.__creativeFixture.retryRunId=run.id;return run.status==='interrupted'&&!!run.chapters[0].confirmation&&!run.chapters[0].revisionId;`)
  await test('retry generates revision and recheck from persisted checkpoints',`await flow.dispatch('run');return flow.active.id===window.__creativeFixture.retryRunId&&flow.active.status==='completed'&&flow.active.chapters[0].check.items[0].status==='resolved';`)
  const beforeRecovery=requests.length
  await test('completed but unconsumed revision survives crash without another generation request',`const run=flow.active,ch=run.chapters[0],revision=run.stages.find(s=>s.stage==='revision'&&s.status==='completed');if(!revision?.result?.artifact)return false;ch.artifacts=ch.artifacts.filter(c=>!c.parentDraftId);ch.revisionId=null;ch.check=null;run.stages=run.stages.filter(s=>s.stage!=='recheck');revision.consumed=false;run.status='interrupted';await flow.persist();await flow.load(run.workId,run.id);await flow.dispatch('run');return flow.active.status==='completed'&&flow.active.chapters[0].artifacts.length===2&&flow.active.chapters[0].check.items[0].status==='resolved';`)
  if(requests.length!==beforeRecovery+1){results.push({name:'recovered revision did not spend another model request',ok:false});console.log('FAIL unexpected extra requests in crash recovery')}
  await test('workflow modal mounts actual stage controls and candidates',`(await import('/src/stores/ui.js')).useUiStore().aiDrawerOpen=true;flow.visible=true;for(let i=0;i<30&&!document.querySelector('.creative-workflow');i++)await new Promise(r=>setTimeout(r,100));return !!document.querySelector('.creative-workflow')&&document.body.textContent.includes('独立审稿清单');`)
  await test('candidate adoption preserves application audit and atomically registers memory',`const run=flow.active,card=flow.latest(0);w.selChapterId=run.chapters[0].chapterId;await new Promise(r=>setTimeout(r,300));await flow.adopt(0,card.id);const rows=await db.airuns.where('workId').equals(w.work.id).toArray(),job=rows.find(r=>r.type==='memory-queue'&&r.chapterId===card.anchorId),stored=rows.find(r=>r.id===run.id)?.chapters[0].artifacts.find(c=>c.id===card.id),audit=rows.find(r=>r.type==='application'&&r.cardId===card.id&&r.status==='applied');return stored?.status==='applied'&&!!audit&&!!job&&(await db.chapters.get(card.anchorId)).content.includes('体力');`)
  await test('same-version backup recovery rejects a pre-restore late save',`const run=flow.active,old=await db.airuns.get(run.id),{recoverMemoryJob}=await import('/src/services/ai/memory-queue-core.js');await db.airuns.put(recoverMemoryJob(old));let refused=false;try{await flow.persist(run)}catch{refused=true}await db.airuns.put(old);return refused;`)
  await test('missing record cannot be resurrected by a late workflow save',`const run=flow.active;await db.airuns.delete(run.id);let refused=false;try{await flow.persist(run)}catch{refused=true}return refused&&!await db.airuns.get(run.id);`)
  // The destructive restore fixture intentionally leaves an unsavable dirty run.
  // Begin the independent window-sync case without asking create() to republish it.
  await evaluate('delete window.__creativeFixture.flow.byWork[window.__creativeFixture.w.work.id]')
  let panel
  try{
    const sync=await evaluate(`(async()=>{const {w,flow,db}=window.__creativeFixture;const run=await flow.create({chapterIds:[w.chapters[0].id]});await db.airuns.put({id:'creative-lock:'+w.work.id,workId:w.work.id,type:'creative-lock',owner:'window-sync-fixture',status:'running',leaseUntil:Date.now()+60000});run.owner='window-sync-fixture';run.status='running';await flow.persist();const opened=await window.native.panelOpen({type:'ai',workId:w.work.id,entityId:''});return {opened,workId:w.work.id,runId:run.id}})()`)
    assert(sync.opened.ok);panel=await connect('panel=ai%3A',process.env.CDP_PORT||9333)
    for(let i=0;i<80&&!await panel.evalx("!!document.querySelector('.agent-composer')");i++)await panel.sleep(100)
    const loaded=await panel.evalx(`(async()=>{const flow=(await import('/src/stores/creative-workflow.js')).useCreativeWorkflowStore();await flow.load(${JSON.stringify(sync.workId)},${JSON.stringify(sync.runId)});window.__creativeSyncFlow=flow;return flow.active?.status==='running'&&flow.running})()`);assert.equal(loaded,true,'secondary window loads the live workflow')
    await evaluate(`(async()=>{const {db,w}=window.__creativeFixture;await db.airuns.update(${JSON.stringify(sync.runId)},{owner:null,status:'completed',activeToken:null});await db.airuns.update('creative-lock:'+w.work.id,{owner:null,status:'completed',leaseUntil:0});window.native.appBroadcast({kind:'creative-workflow-changed',data:{workId:w.work.id,runId:${JSON.stringify(sync.runId)}}});return true})()`)
    for(let i=0;i<40&&!await panel.evalx("window.__creativeSyncFlow?.active?.status==='completed'");i++)await panel.sleep(100)
    assert.equal(await panel.evalx("window.__creativeSyncFlow.active.status==='completed'&&!window.__creativeSyncFlow.running"),true,'secondary window receives completion broadcast')
    results.push({name:'secondary window observes main workflow completion without reopening',ok:true});console.log('PASS secondary window observes main workflow completion without reopening')
  }catch(e){results.push({name:'secondary window completion sync',ok:false,error:e.message});console.log('FAIL secondary window completion sync '+e.message)}
  finally{if(panel)await panel.evalx('window.native.panelCloseSelf()')}
}catch(e){console.error(e.stack);results.push({name:'setup/runtime',ok:false,error:e.message})}
finally{
  await evaluate(`(async()=>{const f=window.__creativeFixture;if(!f)return;f.ai.cancel();(await import('/src/services/ai/memory-queue.js')).cancelMemoryJobs();Object.assign(f.ai,{providers:f.restore.providers,credentials:f.restore.credentials,activeProviderId:f.restore.activeProviderId});if(f.restore.stage)await f.db.appconfig.put(f.restore.stage);else await f.db.appconfig.delete('ai.stageConfig');return true})()`).catch(()=>{})
  server.closeAllConnections();await new Promise(r=>server.close(r))
  writeFileSync('tools/_creative-workflow-results.json',JSON.stringify({kind:'deterministic-integration',requests:requests.length,results},null,2))
  console.log(`${results.filter(r=>r.ok).length}/${results.length} integration checks passed; no model quality claim`)
  process.exit(results.every(r=>r.ok)?0:1)
}
