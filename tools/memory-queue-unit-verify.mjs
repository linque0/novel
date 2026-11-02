import assert from 'node:assert/strict'
import { memoryJob, isMemoryCurrent, recoverMemoryJob, mergeMemoryIntent } from '../src/services/ai/memory-queue-core.js'
const ch={id:'c',workId:'w',title:'章',fmt:'text',content:'正文'}
const a=memoryJob(ch,{applicationId:'a'},1),b=memoryJob(ch,{},2)
assert.equal(a.id,b.id);assert.equal(a.status,'pending')
assert.equal(isMemoryCurrent(a,ch),true);assert.equal(isMemoryCurrent(a,{...ch,content:'撤销'}),false)
assert.equal(recoverMemoryJob({...a,status:'running',owner:'x'}).status,'interrupted')
assert.equal(recoverMemoryJob(a).autoEligible,false)
assert.deepEqual(mergeMemoryIntent({memoryIntent:{applicationId:'a'}},{}).memoryIntent,{applicationId:'a'})
console.log('memory queue unit verification passed')

// Execute the production repository save function against a rollback-capable transaction double.
// This covers persistence ordering, deduplication, actual saved hash, and atomic failure.
const { readFile } = await import('node:fs/promises')
const repoSource=await readFile(new URL('../src/db/repo.js',import.meta.url),'utf8')
const putBody=repoSource.slice(repoSource.indexOf('export async function putRow('),repoSource.indexOf('export async function softDeleteRow(')).replace('export ','')
const rows=new Map(),jobs=new Map();let failJob=false
const db={chapters:{put:async row=>rows.set(row.id,structuredClone(row))},airuns:{get:async id=>jobs.get(id),put:async row=>{if(failJob)throw Error('disk full');jobs.set(row.id,structuredClone(row))}},table(){return this.chapters},async transaction(mode,...args){const callback=args.pop(),beforeRows=new Map(rows),beforeJobs=new Map(jobs);try{return await callback()}catch(e){rows.clear();jobs.clear();for(const [k,v]of beforeRows)rows.set(k,v);for(const [k,v]of beforeJobs)jobs.set(k,v);throw e}}}
const putRow=new Function('db','now','memoryJob',`${putBody};return putRow`)(db,()=>3,memoryJob)
await putRow('chapters',ch,{memoryIntent:{applicationId:'a'}})
assert.equal(rows.get('c').content,'正文');assert.equal(jobs.size,1)
await putRow('chapters',ch,{memoryIntent:{applicationId:'b'}});assert.equal(jobs.size,1)
const changed={...ch,content:'作者最终编辑后的正文'}
failJob=true;await assert.rejects(()=>putRow('chapters',changed,{memoryIntent:{}}),/disk full/)
assert.equal(rows.get('c').content,'正文');assert.equal(jobs.size,1)
failJob=false;await putRow('chapters',changed,{memoryIntent:{}})
assert.equal(jobs.get(memoryJob(changed).id).sourceHash,memoryJob(changed).sourceHash)
assert.equal(rows.get('c').content,changed.content)
// An extraction failure changes only the job; saved prose remains intact.
jobs.set(memoryJob(changed).id,{...memoryJob(changed),status:'failed',error:'provider failed'})
assert.equal(rows.get('c').content,changed.content)
console.log('memory queue atomic repository verification passed')

const aiRepoSource=await readFile(new URL('../src/db/ai-repo.js',import.meta.url),'utf8')
const guardBody=aiRepoSource.slice(aiRepoSource.indexOf('export async function assertMemoryPublication')).replace('export ','')
let guardJob={id:'q',owner:'owner',status:'running',leaseUntil:Date.now()+60000},manifest='v1'
const assertPublication=new Function('db','sourceManifest','readSourceSnapshot',`${guardBody};return assertMemoryPublication`)({airuns:{get:async()=>guardJob}},x=>({hash:x}),async()=>manifest)
const guard={id:'q',owner:'owner',workId:'w',sourceVersion:'v1'}
await assertPublication(guard)
manifest='v2';await assert.rejects(()=>assertPublication(guard),/来源或租约/)
manifest='v1';guardJob={...guardJob,owner:null,status:'interrupted'}
await assert.rejects(()=>assertPublication(guard),/来源或租约/)
console.log('memory queue changed-source and same-hash restore publication guards passed')
import { memoryStageMessages } from '../src/services/ai/memory-stage.js'
const stagePreset={id:'p',name:'memory preset',payload:{prompts:[{identifier:'main',role:'system',content:'Use short factual clauses.'}],prompt_order:[{identifier:'main',enabled:true}],function_calling:true},adaptation:{}}
const memoryMessages=memoryStageMessages('STRICT JSON FACT CONTRACT','{"text":"正文"}',{stageSnapshot:{presetSnapshot:stagePreset,skill:{text:'Keep supplied names.'}},inputBudget:10000,maxTokens:512})
assert.match(memoryMessages[0].content,/short factual clauses/)
assert.match(memoryMessages[0].content,/Keep supplied names/)
assert.match(memoryMessages[0].content,/STRICT JSON FACT CONTRACT/)
assert.equal(memoryMessages.at(-1).content,'{"text":"正文"}')
assert(memoryMessages.every(m=>!m.tool_calls&&!m.tool_call_id))
console.log('memory stage preset and text Skill consumed without tools')
const restoredCreative=recoverMemoryJob({type:'creative-workflow',status:'paused',activeToken:'old',stages:[{status:'running'}],chapters:[]})
assert.equal(restoredCreative.activeToken,null)
assert.equal(restoredCreative.status,'interrupted')
assert.equal(restoredCreative.stages[0].status,'interrupted')
console.log('creative backup interrupted-stage normalization passed')

// Evaluate queue orchestration with an in-memory DB and controlled timers: no real network.
const queueCode=(await readFile(new URL('../src/services/ai/memory-queue.js',import.meta.url),'utf8')).replace(/^import .*\r?\n/gm,'').replace(/^export /gm,'')
let scheduled,buildCalls=0,storedJob=memoryJob(ch),meta,summary
const qdb={airuns:{where:()=>({equals:id=>({toArray:async()=>storedJob.workId===id?[structuredClone(storedJob)]:[]})}),toArray:async()=>[structuredClone(storedJob)],get:async()=>structuredClone(storedJob),put:async row=>{storedJob=structuredClone(row)}},chapters:{get:async()=>ch},aikbmeta:{get:async()=>meta},aisum:{where:()=>({equals:()=>({first:async()=>summary})})},transaction:async(mode,...args)=>args.at(-1)()}
const qai={privacy:false,ready:true,busy:true,kb:{},providers:[],presets:[],buildOpts:async()=>({}),addUsage(){},refreshKnowledge:async()=>{}}
const qwindow={dispatchEvent(){},native:{appBroadcast(){}}}
const qfactory=new Function('db','uid','readSourceSnapshot','sourceManifest','hashContent','buildKnowledge','updateJob','isMemoryCurrent','freezeStage','loadStageConfig','window','CustomEvent','setTimeout','clearTimeout','setInterval','clearInterval',`${queueCode};return {runMemoryQueue,recoverMemoryQueue,cancelMemoryJobs}`)
const qapi=qfactory(qdb,()=> 'owner',async()=>({}),()=>({hash:'v'}),()=> 'content-hash',async()=>{buildCalls++;meta={status:'success',sourceHash:storedJob.sourceHash};summary={contentHash:'content-hash',sourceHash:storedJob.sourceHash}},async(id,owner,patch)=>{if(storedJob.owner===owner)storedJob={...storedJob,...patch}},isMemoryCurrent,()=>({}),async()=>({}),qwindow,class {constructor(type,init){this.type=type;this.detail=init?.detail}},fn=>{scheduled=fn;return 1},()=>{},()=>1,()=>{})
await qapi.runMemoryQueue(qai,{workId:'w',jobId:storedJob.id})
assert.equal(buildCalls,0);assert.equal(typeof scheduled,'function')
qai.busy=false;scheduled()
await qapi.runMemoryQueue(qai,{workId:'w',jobId:'barrier'})
assert.equal(buildCalls,1);assert.equal(storedJob.status,'completed')
storedJob={...memoryJob(ch),status:'running',owner:'dead-window',leaseUntil:Date.now()-1}
await qapi.recoverMemoryQueue()
assert.equal(storedJob.status,'interrupted');assert.equal(storedJob.autoEligible,false)
console.log('live busy-to-idle dispatch and expired lease recovery passed')
