import assert from 'node:assert/strict'
import { freezeDraft, assertReviewCurrent, normalizeReview, confirmReview, normalizeRecheck } from '../src/services/ai/review-cycle.js'
import { normalizeChapterPlan } from '../src/services/ai/chapter-plan.js'
let passed=0
const test=(name,fn)=>{fn();passed++;console.log('PASS '+name)}
const draft=freezeDraft({id:'d',revision:2,text:'旧稿',editText:'甲重复。甲重复。唯一结尾。'})
const input={items:[{severity:'error',category:'连续性',problem:'重复',expected:'删改',quote:'甲重复。'},{severity:'warning',problem:'定位',quote:'甲重复。',start:4},{severity:'suggestion',problem:'结尾',quote:'唯一结尾。'}]}
const review=normalizeReview(input,draft)
test('draft is immutable and detects edits, revision and identity',()=>{
 assert(Object.isFrozen(draft));assert.equal(draft.text,'甲重复。甲重复。唯一结尾。')
 assertReviewCurrent(review,draft)
 for(const patch of [{id:'other'},{revision:3},{editText:'改稿'}]) assert.throws(()=>assertReviewCurrent(review,freezeDraft({id:'d',revision:2,text:draft.text,...patch})))
 assert.throws(()=>normalizeReview({...input,sourceDraft:{...draft,revision:1}},draft))
})
test('quotes require unique or correct explicit position',()=>{
 assert.equal(review.items[0].evidenceStatus,'unverified')
 assert.equal(review.items[1].evidenceStatus,'verified')
 assert.equal(review.items[2].evidenceStatus,'verified')
 assert.deepEqual(normalizeReview(input,draft).items.map(x=>x.id),review.items.map(x=>x.id))
})
test('source evidence resolver validates source and quote',()=>{
 const data={items:[{problem:'来源',quote:'唯一结尾。',evidence:[{sourceId:'c',quote:'不存在'}]}]}
 assert.equal(normalizeReview(data,draft,()=>({text:'实际材料'})).items[0].evidenceStatus,'unverified')
 data.items[0].evidence[0].quote='实际材料'
 assert.equal(normalizeReview(data,draft,()=>({text:'实际材料'})).items[0].evidenceStatus,'verified')
})
test('author confirms only selected findings and guidance',()=>{
 const result=confirmReview(review,draft,{[review.items[2].id]:'apply',[review.items[1].id]:'ignore'},'保留悬念')
 assert.equal(result.items.length,1);assert.equal(result.authorGuidance,'保留悬念');assert(Object.isFrozen(result.items))
 assert.throws(()=>confirmReview(review,freezeDraft({id:'d',revision:3,text:draft.text})))
})
test('malformed reviews are rejected',()=>{
 for(const data of [null,{}, {items:'oops'},{items:[null]},{items:[{severity:'critical'}]}]) assert.throws(()=>normalizeReview(data,draft))
})
test('recheck covers exact findings and requires revised evidence',()=>{
 const revised=freezeDraft({id:'d',revision:3,text:'新的结尾。'})
 const rows=review.items.map(x=>({id:x.id,status:'resolved',quote:'新的结尾。'}))
 assert(normalizeRecheck({items:rows},review,revised).items.every(x=>x.status==='resolved'))
 assert.throws(()=>normalizeRecheck({items:rows.slice(1)},review,revised))
 assert.throws(()=>normalizeRecheck({items:[...rows,{id:'extra'}]},review,revised))
 assert.throws(()=>normalizeRecheck({items:[rows[0],rows[0],rows[2]]},review,revised))
 assert.throws(()=>normalizeRecheck({items:rows},review,freezeDraft({id:'other',revision:3,text:'新的结尾。'})))
 assert.throws(()=>normalizeRecheck({items:rows},review,freezeDraft({id:'d',revision:1,text:'新的结尾。'})))
 rows[0].quote='不存在';assert.equal(normalizeRecheck({items:rows},review,revised).items[0].status,'unresolved')
})
test('scene plan keeps editable fields and bounded values',()=>{
 const data={scenes:[{goal:'寻找钥匙',pov:'甲',characters:['甲'],conflict:'门锁',turn:'发现暗门',ending:'进入',targetWords:800}]}
 const plan=normalizeChapterPlan(data);assert.equal(plan.scenes[0].goal,'寻找钥匙');assert.equal(plan.scenes[0].targetWords,800)
 assert.equal(plan.scenes[0].id,normalizeChapterPlan(data).scenes[0].id)
 for(const value of [null,{}, {scenes:[]},{scenes:[{}]},{scenes:Array(101).fill(data.scenes[0])},{scenes:[{...data.scenes[0],targetWords:-1}]}]) assert.throws(()=>normalizeChapterPlan(value))
})
test('recheck accepts only a strictly newer direct descendant',()=>{
 const rows=review.items.map(x=>({id:x.id,status:'unresolved'}))
 const next={id:'next',parentDraftId:'d',revision:3,text:'修稿'}
 assert.equal(normalizeRecheck({items:rows},review,next).revisedDraft.id,'next')
 for(const patch of [{parentDraftId:'other'},{revision:2},{contentHash:'forged'}]) assert.throws(()=>normalizeRecheck({items:rows},review,{...next,...patch}))
 assert.throws(()=>normalizeRecheck({items:rows},review,{id:'d',revision:2,text:'改稿'}))
 assert.throws(()=>normalizeRecheck({items:[{...rows[0],status:'invented'},...rows.slice(1)]},review,next))
 assert.throws(()=>normalizeReview({...input,sourceDraft:{...draft,text:'伪造'}},draft))
})
test('protocol caps strings and rejects false evidence verification',()=>{
 assert.throws(()=>normalizeReview({items:[{problem:'x'.repeat(20001)}]},draft))
 assert.throws(()=>confirmReview(review,draft,{},'x'.repeat(20001)))
 const bad=normalizeReview({items:[{problem:'一致性冲突',quote:'唯一结尾。',evidence:[{sourceId:'missing',quote:'材料'}]}]},draft,()=>null)
 assert.equal(bad.items[0].evidenceStatus,'unverified')
})
console.log(`${passed} review protocol tests passed`)
