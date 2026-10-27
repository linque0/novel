import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
assert(existsSync('src/services/ai/retrieval-policy.js'), 'task-aware retrieval policy must exist')
const { buildRetrievalRequest, vectorPolicy, classifyRule } = await import('../src/services/ai/retrieval-policy.js')
const { materialBudget } = await import('../src/services/ai/material-budget.js')
const work={chapters:[{id:'c',title:'铜符',content:'林昭来到城门',fmt:'text'}],characters:[{id:'a',name:'林昭',aliases:'小昭'}],olnodes:[{id:'o',refId:'c',title:'开门',text:'寻找钥匙'}],mubu:[]}
const frozen={chapterId:'c',chapterTitle:'铜符',allowedIds:['c'],refs:{},taskRequest:{type:'chapter.continue',writingAnchor:{left:'小昭来到城门',right:'后文秘密'},selectedDirection:{title:'潜入',development:'先找钥匙'}}}
for(const [type,task] of [['chapter.continue','plot'],['chapter.review','consistency'],['outline.plan','outline'],['character.revise','character'],['lore.create','lore'],['snippet.generate','plot'],['memory.extract','consistency']])assert.equal(buildRetrievalRequest(work,{...frozen,taskRequest:{type}},'问题').task,task)
const request=buildRetrievalRequest(work,frozen,'继续')
assert.equal(request.anchorId,'c');assert(request.query.includes('林昭'));assert(request.query.includes('潜入'));assert(request.query.includes('寻找钥匙'));assert(!request.query.includes('后文秘密'))
assert.equal(buildRetrievalRequest(work,{...frozen,taskRequest:{type:'character.revise',targetId:'a'}},'').anchorId,'a')
assert.equal(vectorPolicy({privacy:true,embeddings:{enabled:true},opts:{},query:'q'}).reason,'privacy')
assert.equal(vectorPolicy({embeddings:{enabled:true},opts:{},query:'q'}).enabled,true)
assert.equal(classifyRule({scope:'global',status:'confirmed'},{}),'required')
assert.equal(classifyRule({scope:'local',chapterId:'other'},{chapterId:'c'}),'irrelevant')
assert.equal(classifyRule({},{}),'required')
const b=materialBudget(20);b.add({id:'r',text:'必需',required:true,sourceVersions:[{table:'mubu',id:'x',hash:'v1'}]});assert.equal(b.add({id:'large',text:'长'.repeat(100)}),false);assert.equal(b.diagnostics().omitted[0].id,'large');assert.equal(b.diagnostics().included[0].sourceVersions[0].hash,'v1');assert.throws(()=>b.add({id:'required',text:'长'.repeat(100),required:true}),/预算/)
console.log('PASS task mapping, bounded composite query, vector privacy policy, rule scope and atomic material budget')

// Bundle the real retrieval implementation; only persistence/network boundaries are replaced.
import { build } from 'esbuild'
const snapshot={cards:[{id:'k',kind:'event',title:'城门',chapterId:'c',orderIdx:0,body:{text:'林昭开门'}}],chapters:[{id:'c',title:'铜符'}],index:new Map([['c',0]]),valid:new Set(['c']),stale:[]}
globalThis.__retrievalTest={snapshot,rows:[],calls:0,fail:false}
const result=await build({entryPoints:['src/services/ai/retrieval.js'],bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'io-boundaries',setup(b){
  b.onResolve({filter:/^(\.\/knowledge|\.\/contracts|\.\.\/\.\.\/db\/ai-repo|\.\.\/\.\.\/db\/database(?:\.js)?|\.\/provider|\.\/summarize|\.\/booksource\.js)$/},args=>({path:args.path,namespace:'io'}))
  b.onLoad({filter:/.*/,namespace:'io'},args=>({contents:args.path.includes('knowledge')?'export const knowledgeSnapshot=async()=>globalThis.__retrievalTest.snapshot; export const replayForeshadows=()=>[]':args.path.includes('ai-repo')?'export const vectors=async()=>globalThis.__retrievalTest.rows;export const leaseJob=async()=>true;export const updateJob=async()=>{}':args.path.includes('database')?'export const db={};export const uid=()=>"id"':args.path.includes('contracts')?'export const tokens=s=>s.length;export const withoutQuotes=x=>x':args.path.includes('provider')?'export const embed=async()=>{const t=globalThis.__retrievalTest;t.calls++;if(t.fail)throw Error("offline");return {vectors:[[1,0]]}}':args.path.includes('summarize')?'export const hashContent=x=>x':'export const queryTerms=q=>q.split(/\\s+/).filter(Boolean)'}))
}}]})
const {kbQuery}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'))
const rt=globalThis.__retrievalTest, options={work:{work:{id:'w'}},anchorId:'c',asOfChapterId:'c',query:'城门',embeddings:{enabled:true,model:'embed'},opts:{baseURL:'local'}}
let r=await kbQuery(options);assert.equal(r.vectorStatus.reason,'no-current-vectors');assert.equal(rt.calls,0)
rt.rows=[{model:'embed',provider:'local',cardId:'k',sourceHash:'城门'+JSON.stringify(snapshot.cards[0].body),dim:2,vec:new Float32Array([1,0]).buffer}]
r=await kbQuery({...options,privacy:true});assert.equal(rt.calls,0);assert.equal(r.vectorStatus.reason,'privacy')
r=await kbQuery(options);assert.equal(rt.calls,1);assert.equal(r.vectorStatus.mode,'hybrid');assert.equal(r.cards[0].id,'k')
rt.fail=true;r=await kbQuery(options);assert.equal(r.vectorFallback,true);assert.equal(r.vectorStatus.reason,'embedding-unavailable');assert.equal(r.cards[0].id,'k')
await assert.rejects(kbQuery({...options,opts:{...options.opts,signal:{aborted:true}}}),/offline/)
console.log('PASS real retrieval vector connection, privacy, missing index, network fallback and abort propagation')

const contextStubs={
  './knowledge':'export const ordered=w=>w.chapters',
  './retrieval':'export const kbQuery=async o=>{globalThis.__contextOptions=o;return {cards:[],snapshot:{valid:new Set(),stale:[]},vectorStatus:{mode:"lexical",reason:"disabled"}}}',
  './summarize':'export const getChapterSummary=async()=>null',
  './contracts':'export const plainChapter=c=>c?.content||"";export const chapterHash=c=>JSON.stringify(c);export const entityHash=c=>JSON.stringify(c);export const withoutQuotes=x=>x',
  './presets':'export const estimate=s=>Math.ceil(s.length/2);export const fingerprint=JSON.stringify;export const copy=structuredClone',
  './booksource.js':'export const readBook=async()=>({});export const queryBook=()=>({items:[]})',
  './constraints.js':'export const constraintPack=()=>({text:"必要设定",sourceVersions:[],unresolved:[],omitted:[]})',
  './state.js':'export const stateAt=async()=>[]',
  './task-profiles.js':'export const normalizeTaskRequest=x=>x;export const taskProfile=()=>({extraction:false});export const taskPrompt=t=>JSON.stringify(t)',
}
const contextBundle=await build({entryPoints:['src/services/ai/novel-context.js'],bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'context-io',setup(b){b.onResolve({filter:/.*/},args=>Object.hasOwn(contextStubs,args.path)?{path:args.path,namespace:'context'}:null);b.onLoad({filter:/.*/,namespace:'context'},args=>({contents:contextStubs[args.path]}))}}]})
const {assembleSlots}=await import('data:text/javascript;base64,'+Buffer.from(contextBundle.outputFiles[0].text).toString('base64'))
const cw={...work,work:{id:'w',title:'样书',description:'简介'.repeat(4000)},chapters:[{id:'c',title:'铜符',content:'小昭来到城门',fmt:'text'}],characters:[],mubu:[],olnodes:[],relations:[]}
const cf={...frozen,workId:'w',sourceHash:'hash',scope:'chapter',sourceVersions:[],asOfChapterId:'c'}
const embeddingOptions={embeddings:{enabled:true,model:'embedding'},opts:{baseURL:'local',signal:new AbortController().signal}}
const material=await assembleSlots(cw,cf,{contextBudget:900},false,'继续',embeddingOptions)
assert.equal(globalThis.__contextOptions.embeddings,embeddingOptions.embeddings);assert.equal(globalThis.__contextOptions.opts,embeddingOptions.opts);assert.equal(globalThis.__contextOptions.task,'plot');assert.equal(globalThis.__contextOptions.anchorId,'c');assert.equal(globalThis.__contextOptions.asOfChapterId,'c')
assert(material.budget.used<=material.budget.limit);assert(material.materials.omitted.some(x=>x.id==='workBrief:w'&&x.sourceVersions[0].table==='works'));assert(material.materials.included.some(x=>x.id==='task-input'&&x.required));assert(material.materials.sourceVersions.some(x=>x.table==='chapters'&&x.id==='c'))
await assert.rejects(assembleSlots(cw,{...cf,taskRequest:{...cf.taskRequest,selection:'原选段'.repeat(1000)},sourceVersions:[]},{contextBudget:256},false,''),/预算/)
await assert.rejects(assembleSlots(cw,{...cf,sourceVersions:[]},{contextBudget:900},false,'',{opts:{stageSnapshot:{skill:{text:'写作规则'.repeat(1000)}}}}),/预算/)
console.log('PASS assembled material wiring, source versions, omitted sources, bounded budget and whole required input rejection')

const constraintBundle=await build({entryPoints:['src/services/ai/constraints.js'],bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'constraint-io',setup(b){
  b.onResolve({filter:/^(\.\/booksource\.js|\.\.\/\.\.\/db\/database\.js|\.\.\/\.\.\/db\/project-repo\.js)$/},args=>({path:args.path,namespace:'constraint'}))
  b.onLoad({filter:/.*/,namespace:'constraint'},args=>({contents:args.path.includes('booksource')?'export const documentView=d=>({text:d.plainText})':args.path.includes('project-repo')?'export const ensureProjection=async()=>{};export const readSourceSnapshot=async()=>{}':'export const db={}'}))
}}]})
const {constraintPack}=await import('data:text/javascript;base64,'+Buffer.from(constraintBundle.outputFiles[0].text).toString('base64'))
const cs={access:{privacy:false},work:{mubu:[{id:'global',rulePolicy:{scope:'global',status:'confirmed'}},{id:'local',rulePolicy:{scope:'local',chapterId:'other'}},{id:'legacy'}]},docs:['global','local','legacy'].map(id=>({id:'doc:'+id,sourceId:id,sourceTable:'mubu',sourceType:'mubu',semanticClass:'setting',plainText:id+' 不得违反。',meta:{},deps:[{table:'mubu',id,hash:'v1'}]}))}
const cp=constraintPack(cs,{chapterId:'c',budget:2000})
assert.equal(cp.items.length,2);assert.equal(cp.items[0].status,'confirmed-rule');assert.equal(cp.items[1].scope,'unclassified');assert.equal(cp.omitted[0].sourceVersions[0].id,'local');assert.throws(()=>constraintPack(cs,{chapterId:'c',budget:1}),/预算/)
console.log('PASS real rule source classification, confirmed global, irrelevant local omission and conservative legacy constraints')
