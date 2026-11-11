import test from 'node:test'
import assert from 'node:assert/strict'
import { groupBooks, bookDimensions } from '../src/services/original-shelf.mjs'
test('groups preserve every work and input order including unknown states', () => {
  const works = ['连载','搁置','完结','构思','其他'].map((status,id)=>({id,status}))
  const groups = groupBooks(works)
  assert.deepEqual(groups.flatMap(g=>g.books).map(w=>w.id).sort(), [0,1,2,3,4])
  assert.deepEqual(groups[2].books.map(w=>w.id), [1,3,4])
})
test('book thickness is bounded, monotonic and independent of collection', () => {
  const values = [0,100,10000,100000,1000000,Infinity,-1,NaN].map(totalWords=>bookDimensions({id:'a',totalWords}).thickness)
  assert.ok(values.every(n=>Number.isFinite(n)&&n>=22&&n<=54))
  assert.ok(values.slice(0,5).every((n,i,a)=>!i||n>=a[i-1]))
  assert.deepEqual(bookDimensions({id:'a',totalWords:100}),bookDimensions({id:'a',totalWords:100}))
})
