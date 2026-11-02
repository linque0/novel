import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const view = await import('../src/services/ai/workbench-view.js').catch(() => ({}))
assert.equal(typeof view.chapterWorkbenchState, 'function', 'chapter UI must derive actions from persisted facts')
const {chapterWorkbenchState:state,canExecuteCreativeHere}=view
assert.equal(canExecuteCreativeHere(''),true)
assert.equal(canExecuteCreativeHere('?panel=agent:w:'),true)
assert.equal(canExecuteCreativeHere('?panel=ai:w:'),false)
assert.equal(state(null,'c').action,'plan')
const card={id:'a',revision:0,kind:'draft',text:'旧稿',complete:true,status:'pending',dependencies:[]}
const ch={chapterId:'c',artifacts:[card],decisions:{}}
const run={chapters:[ch],stages:[]}
assert.equal(state(run,'c').action,'review')
ch.review={sourceDraft:{id:'a',revision:0,contentHash:'wrong'},items:[]}
assert.equal(state(run,'c').stale,true)
delete ch.review
card.status='applied'
assert.equal(state(run,'c').label,'作者已采纳')
card.status='pending';card.dependencies=[{id:'missing'}]
assert.equal(state(run,'c').stale,true)
const require=createRequire(import.meta.url)
const locks=(()=>{try{return require('../electron/panel-locks.cjs')}catch{return {}}})()
assert.equal(typeof locks.panelLockKey,'function')
assert.equal(locks.panelLockKey({type:'agent',workId:'w'}),'w:chapter:*')
assert.equal(locks.panelLocksConflict('w:chapter:*','w:chapter:c'),true)
assert.equal(locks.panelLocksConflict('w:chapter:c','w:chapter:d'),false)
assert.equal(locks.panelLocksConflict('w:chapter:*','other:chapter:c'),false)
assert.equal(locks.panelLocksConflict('w:agent:*','w:chapter:c'),false)
const bridge=await import('../src/services/ai/chapter-editor-bridge.js')
await assert.rejects(()=>bridge.ensureChapterEditor('w','c'))
let active='w',target=null
const dispose=bridge.registerChapterEditorBridge({getWorkId:()=>active,ensure:async id=>{target=id;return {chapterId:id}}})
await assert.rejects(()=>bridge.ensureChapterEditor('other','c'),/作品/)
assert.equal(target,null)
await bridge.ensureChapterEditor('w','c')
assert.equal(target,'c')
const disposeNew=bridge.registerChapterEditorBridge({getWorkId:()=>active,ensure:async()=>{active='changed'}})
dispose()
await assert.rejects(()=>bridge.ensureChapterEditor('w','c'),/作品/)
disposeNew()
console.log('agent workbench unit verification passed: state, dependencies, execution host, window locks and editor bridge')
