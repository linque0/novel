import assert from 'node:assert/strict'
import { normalizeTaskRequest, assertTaskTool, taskApplyActions, TASK_PROFILES } from '../src/services/ai/task-profiles.js'
import { workflowProposal, workflowChanges, TASK_OUTPUT_TOOLS, taskEvidence } from '../src/services/ai/task-proposals.js'
import { projectBook, sourceManifest } from '../src/services/project/normalize.js'
import { chapterHash, rowHash } from '../src/services/project/text.js'
let passed=0
const test=(name,fn)=>{fn();passed++;console.log('PASS '+name)}
const work={work:{id:'w',title:'样书'},volumes:[],chapters:[{id:'c',workId:'w',title:'第一章',fmt:'text',content:'林昭受伤。沈青梧救了林昭。二人成为同伴。',sortOrder:0},{id:'future',workId:'w',title:'后章',fmt:'text',content:'林昭恢复。',sortOrder:1}],characters:[{id:'a',workId:'w',name:'林昭',aliases:'小昭',fields:{},content:''}],relations:[],mubu:[{id:'l',workId:'w',text:'伤势需要治疗。'}],olnodes:[],outlines:[],snippets:[],annotations:[],assets:[],links:[],lore:[],lorecats:[]}
const evidence=[{sourceType:'chapter',sourceId:'c',quote:'沈青梧救了林昭。'}]
function frozen(type,extra={}){const taskRequest=normalizeTaskRequest({type,chapterId:'c',chapterIds:['c'],...extra},work);return {workId:'w',taskRequest,allowedIds:['c'],bookRevision:sourceManifest(work).hash,sourceVersions:[]}}
test('all five modules have explicit output boundaries',()=>{
  assert.deepEqual([...new Set(Object.values(TASK_PROFILES).map(p=>p.module))].sort(),['chapters','characters','lore','outline','snippets'])
  for(const p of Object.values(TASK_PROFILES))assert(TASK_OUTPUT_TOOLS.includes(p.outputTool))
  assert.throws(()=>assertTaskTool(frozen('chapter.continue').taskRequest,'submit_outline_plan',TASK_OUTPUT_TOOLS))
  assert.throws(()=>assertTaskTool(null,'submit_proposal',TASK_OUTPUT_TOOLS))
})
test('rewrite requires valid source selection and prohibits append',()=>{
  assert.throws(()=>frozen('chapter.rewrite'))
  assert.throws(()=>frozen('chapter.rewrite',{selection:'不存在'}))
  assert.deepEqual(taskApplyActions('chapter.rewrite','林昭受伤。'),['replace'])
  assert.deepEqual(taskApplyActions('chapter.continue',''),['append'])
})
test('task cannot use another book, nonexistent target or deleted range',()=>{
  assert.throws(()=>normalizeTaskRequest({type:'outline.plan',workId:'other'},work))
  assert.throws(()=>frozen('lore.revise',{targetId:'gone'}))
  assert.throws(()=>frozen('character.extract',{chapterIds:['missing']}))
})
test('evidence must match unique source and stay inside selected chapter range',()=>{
  assert.throws(()=>taskEvidence([{sourceType:'chapter',sourceId:'future',quote:'林昭恢复。'}],work,frozen('outline.summarize'),true))
  assert.throws(()=>taskEvidence([{sourceType:'chapter',sourceId:'c',quote:'猜测剧情'}],work,frozen('outline.summarize'),true))
  const refs=taskEvidence(evidence,work,frozen('outline.summarize'),true)
  assert.equal(refs[0].start,5);assert.equal(refs[0].sourceHash,chapterHash(work.chapters[0]))
})
test('new character and directed relations share stable ID mapping',()=>{
  const card=workflowProposal({characters:[{key:'new1',name:'沈青梧',fields:{身份:'医师'},bio:'救助林昭',evidence}],relations:[{from:'a',to:'new1',label:'同伴',chapterId:'c',evidence}],evidence},work,frozen('character.extract'))
  const changes=workflowChanges(card,work),character=changes.find(c=>c.table==='characters'),relation=changes.find(c=>c.table==='relations')
  assert.equal(relation.after.fromId,'a');assert.equal(relation.after.toId,character.id)
  assert.equal(relation.after.effectiveChapterId,'c');assert.equal(character.after.fields.身份,'医师')
  for(const c of changes)assert.equal(c.afterHash,rowHash(c.after))
})
test('ambiguous identity, orphan and self relations are rejected',()=>{
  assert.throws(()=>workflowProposal({characters:[{key:'x',name:'小昭'}]},work,frozen('character.design')))
  assert.throws(()=>workflowProposal({relations:[{from:'a',to:'gone',label:'敌对',evidence}],evidence},work,frozen('character.relations')))
  assert.throws(()=>workflowProposal({relations:[{from:'a',to:'a',label:'同伴',evidence}],evidence},work,frozen('character.relations')))
})
test('new aliases cannot collide with registered identities or other proposed characters',()=>{
  assert.throws(()=>workflowProposal({characters:[{key:'x',name:'新人',aliases:['小昭']}]},work,frozen('character.design')))
  assert.throws(()=>workflowProposal({characters:[{key:'x',name:'甲',aliases:['乙']},{key:'y',name:'乙'}]},work,frozen('character.design')))
})
test('one proposal cannot update the same character or setting twice',()=>{
  assert.throws(()=>workflowProposal({characters:[{key:'x',id:'a',name:'林昭'},{key:'y',id:'a',name:'林昭改名'}]},work,frozen('character.revise',{targetId:'a'})))
  assert.throws(()=>workflowProposal({entries:[{id:'l',text:'甲'},{id:'l',text:'乙'}]},work,frozen('lore.revise',{targetId:'l'})))
})
test('duplicate relations are refused after resolving temporary IDs',()=>{
  const card=workflowProposal({characters:[{key:'n',name:'沈青梧'}],relations:[{from:'a',to:'n',label:'同伴'},{from:'a',to:'n',label:'同伴'}]},work,frozen('character.design'))
  assert.throws(()=>workflowChanges(card,work))
})
test('written outline is separate from future plan and depends on its chapter',()=>{
  const card=workflowProposal({nodes:[{title:'救助',points:'沈青梧救林昭',chapterId:'c',evidence}],evidence},work,frozen('outline.summarize'))
  const changes=workflowChanges(card,work),bundle={...work,olnodes:changes.map(c=>c.after)}
  const doc=projectBook(bundle).docs.find(d=>d.sourceType==='olnode')
  assert.equal(doc.semanticClass,'summary');assert(doc.deps.some(d=>d.table==='chapters'&&d.id==='c'))
  const plan=workflowProposal({nodes:[{title:'后续',points:'恢复'}]},work,frozen('outline.plan'))
  assert.equal(projectBook({...work,olnodes:workflowChanges(plan,work).map(c=>c.after)}).docs.find(d=>d.sourceType==='olnode').semanticClass,'plan')
  assert.throws(()=>workflowProposal({nodes:[{title:'无出处',points:'猜测',chapterId:'c'}],evidence},work,frozen('outline.summarize')))
})
test('lore revision cannot modify another target',()=>{
  assert.throws(()=>workflowProposal({entries:[{id:'other',text:'规则'}]},work,frozen('lore.revise',{targetId:'l'})))
  const card=workflowProposal({entries:[{id:'l',text:'伤势不能瞬间恢复。'}]},work,frozen('lore.revise',{targetId:'l'}))
  const c=workflowChanges(card,work)[0];assert.equal(c.before.text,'伤势需要治疗。');assert.equal(c.after.id,'l')
})
test('inspiration links are author opt-in and never mutate linked targets',()=>{
  const card=workflowProposal({items:[{content:'铜符藏城',knownFacts:'人物受伤',newIdea:'铜符藏城',links:[{type:'character',id:'a'}]}]},work,frozen('snippet.generate'))
  assert.deepEqual(workflowChanges(card,work)[0].after.aiLinks,[])
  const changes=workflowChanges(card,work,{includeLinks:true});assert.equal(changes.length,1);assert.equal(changes[0].table,'snippets');assert.equal(changes[0].after.aiLinks[0].id,'a')
})
test('approved memory carries evidence and replaces same chapter summary',()=>{
  const card=workflowProposal({summary:'林昭受伤后获救。',facts:[{kind:'charstate',title:'伤势',characterId:'a',body:{dimension:'伤势',change:'受伤'},evidence}],evidence},work,frozen('memory.extract'))
  const prior={id:'sum',workId:'w',entityType:'chapter',entityId:'c',summary:'旧摘要'}
  const changes=workflowChanges(card,{...work,aisum:[prior]})
  assert.equal(changes[0].id,'sum');assert.equal(changes[0].before.summary,'旧摘要');assert.equal(changes[0].after.assertionStatus,'confirmed')
  assert.equal(changes[1].after.refId,'a');assert.equal(changes[1].after.evidence.sourceId,'c')
})
test('character stage states keep chapter evidence without changing character profiles',()=>{
  const card=workflowProposal({states:[{character:'a',chapterId:'c',dimension:'伤势',change:'受伤',evidence}],evidence},work,frozen('character.states'))
  const changes=workflowChanges(card,work)
  assert.equal(changes.length,1);assert.equal(changes[0].table,'aikb');assert.equal(changes[0].after.refId,'a');assert.equal(changes[0].after.sourceHash,chapterHash(work.chapters[0]))
  assert.throws(()=>workflowProposal({characters:[{id:'a',key:'a',name:'林昭',evidence}],evidence},work,frozen('character.states')))
  assert.throws(()=>workflowProposal({states:[{character:'a',chapterId:'future',dimension:'伤势',change:'恢复',evidence}],evidence},work,frozen('character.states')))
})
test('apply revalidates malformed payload instead of trusting UI card',()=>{
  const card=workflowProposal({items:[{content:'创意'}]},work,frozen('snippet.generate'))
  card.payload.items[0].links=[{type:'character',id:'missing'}]
  assert.throws(()=>workflowChanges(card,work,{includeLinks:true}))
})
console.log(`${passed} deterministic task checks passed; no model quality claim.`)
