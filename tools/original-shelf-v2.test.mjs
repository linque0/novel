import test from 'node:test'
import assert from 'node:assert/strict'
import { layoutShelfBooks } from '../src/services/original-shelf-layout.mjs'
test('six books use a 4+2 arrangement with two face-out volumes and stable dimensions',()=>{
 const books=Array.from({length:6},(_,id)=>({id:String(id),totalWords:id*50000}))
 const a=layoutShelfBooks(books)
 assert.equal(a.length,6);assert.equal(a.filter(b=>b.row===0).length,4)
 assert.equal(a.filter(b=>b.faceOut).length,2)
 assert.deepEqual(a,layoutShelfBooks(books))
 for(const b of a){assert.ok(b.height>=.2&&b.height<=.24);assert.ok(b.thickness>=.016&&b.thickness<=.042);assert.ok(Math.abs(b.x)<.85);assert.ok(b.baseY>0)}
})
test('layout only accepts eight visible objects and never normalises dimensions to collection',()=>{
 const books=Array.from({length:100},(_,id)=>({id:String(id),totalWords:id*10000}))
 const a=layoutShelfBooks(books), b=layoutShelfBooks(books.slice(0,2))
 assert.equal(a.length,8);assert.equal(a[0].height,b[0].height);assert.equal(a[0].thickness,b[0].thickness)
})
