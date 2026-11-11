import test from 'node:test'
import assert from 'node:assert/strict'
import { titleTreatment, booklistPage } from '../src/services/original-booklist.mjs'
test('cover titles reserve vertical setting for short pure Chinese names',()=>{
 assert.equal(titleTreatment('长街晚风'),'vertical')
 assert.equal(titleTreatment('写给明天的信'),'balanced')
 assert.equal(titleTreatment('A Novel'),'mixed')
 assert.equal(titleTreatment('中文与 English 混排作品'),'mixed')
 assert.equal(titleTreatment('一部名字很长很长很长很长的中文作品'),'long')
 assert.equal(titleTreatment(''),'balanced')
})
test('pagination bounds the list and clamps after deleting or filtering the last page',()=>{
 const works=Array.from({length:100},(_,id)=>({id}))
 const last=booklistPage(works,16,6)
 assert.equal(last.page,16);assert.equal(last.count,17);assert.equal(last.items.length,4)
 assert.equal(booklistPage(works.slice(0,96),16,6).page,15)
 const empty=booklistPage([],10,6)
 assert.equal(empty.page,0);assert.equal(empty.count,1);assert.equal(empty.start,0)
 assert.equal(booklistPage(works,0,24).items.length,24)
 assert.equal(booklistPage(works,-1,6).page,0)
})
