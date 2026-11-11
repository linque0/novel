import test from 'node:test'
import assert from 'node:assert/strict'
import { originalPaneMode, originalSaveState } from '../src/services/original-workspace.mjs'
test('panes preserve readable central space and do not depend on saved open preferences',()=>{
 assert.deepEqual(originalPaneMode(1440,252),{directory:false,notes:false})
 assert.deepEqual(originalPaneMode(1080,252),{directory:false,notes:true})
 assert.deepEqual(originalPaneMode(800,252),{directory:true,notes:true})
 assert.deepEqual(originalPaneMode(1280,480),{directory:false,notes:true})
})
test('failed saves are never shown as saved or hidden by pending rows',()=>{
 assert.equal(originalSaveState({saving:false,pending:1,error:'disk full'}),'error')
 assert.equal(originalSaveState({saving:true,pending:1,error:'disk full'}),'saving')
 assert.equal(originalSaveState({pending:1,error:null}),'dirty')
 assert.equal(originalSaveState({pending:0,error:null}),'saved')
})
