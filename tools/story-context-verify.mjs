import assert from 'node:assert/strict'
import {connect} from './_cdp-lib.mjs'
const c=await connect('http://',process.env.CDP_PORT||9333)
try{
 const r=await c.evalx(`(async()=>{const {snapshotWork,plainChapter}=await import('/src/services/ai/contracts.js'),{freezeContext,assembleSlots}=await import('/src/services/ai/novel-context.js'),{TOOL_REGISTRY}=await import('/src/services/ai/tools.js');const w=window.__ns.getWork(),work=snapshotWork(w),chapter=w.activeChapter,oldTail=plainChapter(chapter).slice(-28);const task={type:'chapter.story',workId:work.work.id,chapterId:chapter.id,story:{documentId:'isolated-context-check',revision:0,operation:'advance',controlPolicy:'narrator',genre:'自由构思',instruction:'',guidance:'',text:'码头上只剩下安静的晨雾。'}};const frozen=freezeContext(work,{taskRequest:task});const material=await assembleSlots(work,frozen,{contextBudget:60000},false,'继续故事');const read=await TOOL_REGISTRY.read_chapter.execute({chapterId:chapter.id},{work,asOfChapterId:chapter.id,allowedIds:frozen.allowedIds,writingBoundary:frozen.writingBoundary,authorProfiles:true});return {boundary:frozen.writingBoundary,reference:material.slots.writingReference,oldTail,inPrompt:JSON.stringify(material.slots).includes(oldTail),inRead:JSON.stringify(read).includes(oldTail)}})()`)
 assert(!r?.PAGE_ERR,r?.PAGE_ERR)
 assert.equal(r.boundary?.end,0,'current draft must hide all old canonical chapter text from retrieval')
 assert.equal(r.inPrompt,false,'deleted canonical tail cannot re-enter prompt slots')
 assert.equal(r.inRead,false,'read_chapter cannot bypass the current draft boundary')
 assert(r.reference.includes('码头上只剩下安静的晨雾。'))
 console.log('story context verification passed: current draft reference and canonical-tail exclusion in prompt and read tools')
}catch(e){console.error(e);process.exitCode=1}finally{process.exit(process.exitCode||0)}
