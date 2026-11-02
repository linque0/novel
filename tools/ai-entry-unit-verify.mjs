import assert from 'node:assert/strict'
const entry=await import('../src/services/ai/entry-modes.js').catch(()=>({}))
assert.equal(typeof entry.enterDreamMode,'function','the dream entry must open AI story mode independently of the built-in assistant')
const {enterDreamMode:dream,enterLightSleepMode:light,openDreamBook:open}=entry
const ui={workbenchMode:'writing',aiDrawerOpen:false,focusMode:true,readMode:true,autosave:{pending:0}}
const work={work:{id:'w'},selChapterId:'c'}
let flushes=0,focused=0
await dream({ui,work,flush:async()=>flushes++})
assert.equal(ui.workbenchMode,'agent');assert.equal(ui.aiDrawerOpen,false);assert.equal(work.selChapterId,'c');assert.equal(ui.focusMode,false)
await light({ui,work,flush:async()=>flushes++})
assert.equal(ui.workbenchMode,'writing');assert.equal(ui.aiDrawerOpen,true)
await light({ui,work,flush:async()=>{},toggle:true})
assert.equal(ui.aiDrawerOpen,false)
await light({ui,work,flush:async()=>{},isDetached:()=>true,focusDetached:async()=>focused++})
assert.equal(focused,1);assert.equal(ui.aiDrawerOpen,false)
work.work=null;await dream({ui,work,flush:async()=>{throw Error('no work should not flush')}})
assert.equal(ui.dreamLauncherOpen,true)
work.work={id:'w'};ui.workbenchMode='writing';ui.autosave.pending=1
await assert.rejects(()=>dream({ui,work,flush:async()=>{}}),/保存/)
assert.equal(ui.workbenchMode,'writing');ui.autosave.pending=0
await assert.rejects(()=>dream({ui,work,flush:async()=>{work.work={id:'other'}}}),/作品/)
assert.equal(ui.workbenchMode,'writing')
work.open=async id=>{work.work={id};assert.equal(ui.workbenchMode,'agent','shelf entry opens directly in story mode')}
await open({ui,work,workId:'new'})
assert.equal(ui.workbenchMode,'agent');assert.equal(ui.dreamLauncherOpen,false);assert.equal(work.work.id,'new')
assert.equal(flushes,2)
console.log('AI entry unit verification passed: dream, light sleep, detached assistant, empty shelf, save/identity guards and direct book entry')
