import assert from 'node:assert/strict'

const core = await import('../src/services/writing-position-core.js').catch(()=>null)
assert.ok(core, 'Writing position resolution and stale-write protection must exist')
const { resolveWritingChapter, restoreWritingSelection, isNewerWritingPosition } = core
const bundle = {
  volumes: [{id:'v2',sortOrder:2},{id:'v1',sortOrder:1}],
  chapters: [{id:'c2',volumeId:'v2',sortOrder:0},{id:'c1',volumeId:'v1',sortOrder:1},{id:'gone',deletedAt:1},{id:'orphan',volumeId:null,sortOrder:-1}]
}
assert.equal(resolveWritingChapter(bundle,{chapterId:'c2'}).id,'c2')
assert.equal(resolveWritingChapter(bundle,{chapterId:'c2'},'c1').id,'c1')
assert.equal(resolveWritingChapter(bundle,{chapterId:'gone'}).id,'c1')
assert.equal(resolveWritingChapter(bundle,null).id,'c1')
assert.equal(resolveWritingChapter({chapters:[],volumes:[]},null),null)
assert.deepEqual(restoreWritingSelection({selection:{from:900,to:1000}},20),{from:20,to:20})
assert.deepEqual(restoreWritingSelection({selection:{from:-9,to:5}},20),{from:1,to:5})
assert.deepEqual(restoreWritingSelection({selection:{from:8,to:3}},20),{from:3,to:8})
assert.deepEqual(restoreWritingSelection({selection:{from:NaN,to:Infinity}},20),{from:1,to:1})
assert.equal(isNewerWritingPosition({updatedAt:10},{updatedAt:20}),false)
assert.equal(isNewerWritingPosition({updatedAt:20},{updatedAt:10}),true)
assert.equal(isNewerWritingPosition({updatedAt:10,writerId:'a',sequence:3},{updatedAt:10,writerId:'a',sequence:2}),true)
assert.equal(isNewerWritingPosition({updatedAt:10},null),true)
console.log('13 writing position checks passed')
