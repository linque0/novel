// UI/state regression checks. Only the named isolated profile is allowed; no model requests.
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { connect } from './_cdp-lib.mjs'
import { buildSeedExpr } from './verify-seeds.mjs'

const c = await connect('127.0.0.1:5173', process.env.CDP_PORT || '9333')
const run = async expression => {
  const result = await c.evalx(expression)
  if (result?.PAGE_ERR) throw new Error(result.PAGE_ERR)
  return result
}
const until = async expression => {
  for (let n = 0; n < 100; n++) {
    if (await run(expression)) return
    await c.sleep(100)
  }
  throw new Error('Timed out: ' + expression)
}
const results = []
const check = async (name, fn) => {
  try { await fn(); results.push({ name, ok: true }); console.log('PASS ' + name) }
  catch (error) { results.push({ name, ok: false, error: error.message }); console.log('FAIL ' + name + ': ' + error.message) }
}

await until(`!!window.__ns?.getWork && document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('shelf')?.loading === false`)
const loc = await run(`window.native.getDataLocation()`)
assert.ok(!loc.isCustom && loc.current === loc.defaultDir && loc.defaultDir.endsWith('小说工坊-writing-position-verify'), 'Refusing non-isolated profile')
await run(`window.__testStores = (() => { const p = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia; return {work:p._s.get('work'),ui:p._s.get('ui'),ai:p._s.get('ai')} })()`)
if (process.argv.includes('--restart-check')) {
  const expected=JSON.parse(readFileSync('tools/_writing-session.json','utf8'))
  await run(`window.__testStores.work.open(${JSON.stringify(expected.workId)})`)
  await until(`window.__ns.editor?.state?.selection?.from===${expected.from}`)
  await until(`Math.abs((document.querySelector('.crimson-page .rich-inner')||document.querySelector('.rich-host')).scrollTop-${expected.scrollTop})<=1`)
  assert.equal(await run(`window.__testStores.work.selChapterId`),expected.chapterId)
  console.log('PASS normal restart restores chapter, selection and manuscript scroll')
  process.exit(0)
}
const seed = await run(buildSeedExpr('AI 验证书', { reset: true }))
assert.ok(seed.ok)
const wid = seed.books[0].workId
await run(`(async()=>{const {db,uid}=window.__ns; const rows=await db.chapters.where('workId').equals(${JSON.stringify(wid)}).toArray();const v2=uid();await db.volumes.add({id:v2,workId:${JSON.stringify(wid)},title:'第二卷',sortOrder:1}); for(const [i,ch] of rows.entries()){if(i===2)ch.volumeId=v2;ch.fmt='html';ch.content=Array.from({length:90},(_,i)=>'<p>第'+i+'段，林昭在雾都查阅铜符和钟楼的记录，必须在天亮之前找到答案。</p>').join('');await db.chapters.put(ch)} await window.__testStores.work.open(${JSON.stringify(wid)});window.__testStores.ui.aiDrawerOpen=false;window.__testStores.ui.aiDrawerWidth=400})()`)
await until(`!!window.__ns.editor && !window.__ns.editor.isDestroyed`)
mkdirSync('tools/_writing-evidence', { recursive: true })
const geometry = () => run(`(()=>{const host=document.querySelector('.crimson-page .rich-inner')||document.querySelector('.rich-host');const r=host.getBoundingClientRect();const t=document.querySelector('.editor-toolbar').getBoundingClientRect();return {width:r.width,x:r.x,toolbar:t.height,scroll:host.scrollTop}})()`)

for (const skin of process.argv.includes('--red') ? ['crimson'] : ['original','gravity','glaze','crimson']) {
  await run(`(async()=>{await window.__testStores.work.closeWork();await new Promise(r=>requestAnimationFrame(r));await window.__testStores.ui.setSkin(${JSON.stringify(skin)});await window.__testStores.work.open(${JSON.stringify(wid)})})()`)
  await until(`!!window.__ns.editor?.view?.dom?.isConnected`)
  await until(`document.body.dataset.stagePlay!=='1'`)
  for (const [width,height] of process.argv.includes('--red') ? [[1280,720]] : [[1280,720],[1440,900],[1920,1080]]) {
    await c.send('Emulation.setDeviceMetricsOverride', {width,height,deviceScaleFactor:1,mobile:false})
    await run(`window.__testStores.ui.aiDrawerOpen=false`)
    await c.sleep(80)
    const before = await geometry()
    await run(`window.__testEditor=window.__ns.editor;window.__testStores.ui.aiDrawerOpen=true`)
    await until(`!!document.querySelector('.ai-dock')`)
    const after = await geometry()
    await check(`${skin} ${width} AI does not change manuscript geometry`, async()=> {
      assert.ok(Math.abs(before.width-after.width)<=1, JSON.stringify({before,after}))
      assert.ok(Math.abs(before.toolbar-after.toolbar)<=1)
      assert.ok(await run(`window.__testEditor===window.__ns.editor`))
    })
    if (width === 1280 && !process.argv.includes('--red')) {
      const shot = await c.send('Page.captureScreenshot',{format:'png'})
      writeFileSync(`tools/_writing-evidence/${skin}-ai.png`,Buffer.from(shot.data,'base64'))
    }
    await run(`window.__testStores.ui.aiDrawerOpen=false`)
  }
}

await check('continue writing restores the selected non-first chapter',async()=>{
  const target = await run(`(()=>{const w=window.__testStores.work;w.selChapterId=w.liveChapters[2].id;w.selVolumeId=w.liveChapters[2].volumeId;return w.selChapterId})()`)
  await until(`window.__ns.editor?.view?.dom?.textContent?.includes('第89段')`)
  await c.sleep(100)
  await run(`(async()=>{await window.__flushNow();await window.__testStores.work.closeWork();await window.__testStores.work.open(${JSON.stringify(wid)})})()`)
  assert.equal(await run(`window.__testStores.work.selChapterId`),target)
})

if (!process.argv.includes('--red')) {
  await check('AI overlay keeps unsent input and clamps its width',async()=>{
    await run(`window.__testStores.ui.aiDrawerOpen=true`)
    await until(`!!document.querySelector('.ai-panel textarea')`)
    await run(`(()=>{const el=document.querySelector('.ai-panel textarea');el.value='保留这条未发送的创作要求';el.dispatchEvent(new Event('input',{bubbles:true}));window.__testQuestion=el;window.__testStores.ui.aiDrawerOpen=false})()`)
    await run(`window.__testStores.ui.aiDrawerOpen=true;window.__testStores.ui.aiDrawerWidth=640`)
    assert.ok(await run(`window.__testQuestion===document.querySelector('.ai-panel textarea') && window.__testQuestion.value==='保留这条未发送的创作要求'`))
    assert.ok(await run(`(()=>{const d=document.querySelector('.ai-dock').getBoundingClientRect(),b=document.querySelector('.wb-body').getBoundingClientRect();return d.width<=b.width+1 && d.right<=b.right+1 && getComputedStyle(document.querySelector('.ai-dock')).position==='absolute'})()`))
    for(const mode of ['readMode','focusMode']) {
      await run(`window.__testStores.ui.${mode}=true`)
      assert.ok(await run(`getComputedStyle(document.querySelector('.ai-dock')).display==='none'`))
      await run(`window.__testStores.ui.${mode}=false`)
    }
    await run(`window.__testStores.ui.aiDrawerOpen=false`)
  })

  await check('closing AI does not cancel a running conversation',async()=>{
    assert.ok(await run(`(()=>{const ai=window.__testStores.ai,old=ai.cancel;let cancelled=false;ai.cancel=()=>{cancelled=true};window.__testStores.ui.aiDrawerOpen=true;window.__testStores.ui.aiDrawerOpen=false;ai.cancel=old;return !cancelled})()`))
  })

  await check('dragging the AI edge persists width without reflow; narrow windows clamp the overlay',async()=>{
    await run(`window.__testStores.ui.aiDrawerWidth=400;window.__testStores.ui.aiDrawerOpen=true`)
    const before=await geometry()
    const point=await run(`(()=>{const r=document.querySelector('.ai-dock-resizer').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+100}})()`)
    await c.send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',buttons:1,clickCount:1})
    await c.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:point.x-200,y:point.y,button:'left',buttons:1})
    await c.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:point.x-200,y:point.y,button:'left',buttons:0,clickCount:1})
    await until(`window.__ns.db.appconfig.get('aiDrawerWidth').then(r=>r?.value===600)`)
    assert.ok(Math.abs((await geometry()).width-before.width)<=1)
    await c.send('Emulation.setDeviceMetricsOverride',{width:600,height:720,deviceScaleFactor:1,mobile:false})
    await run(`window.__testStores.ui.aiDrawerWidth=640`)
    assert.ok(await run(`(()=>{const r=document.querySelector('.ai-dock').getBoundingClientRect();return r.width<=600 && r.right<=600+1})()`))
    await c.send('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false})
    await run(`window.__testStores.ui.aiDrawerWidth=400;window.__testStores.ui.aiDrawerOpen=false`)
  })

  await check('AI child dialogs render above the overlay',async()=>{
    await run(`window.__testStores.ui.aiDrawerOpen=true`)
    await run(`[...document.querySelectorAll('.ai-top button')].find(b=>b.textContent.includes('作品知识')).click()`)
    await until(`!!document.querySelector('.n-modal')?.offsetWidth`)
    assert.ok(await run(`(()=>{const m=document.querySelector('.n-modal'),r=m.getBoundingClientRect();const top=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return m.contains(top)})()`))
    await run(`document.querySelector('.n-modal .n-base-close').click()`)
    await until(`!document.querySelector('.n-modal')`)
    await run(`window.__testStores.ui.aiDrawerOpen=false`)
  })

  await check('selection and manuscript scroll survive leaving and reopening',async()=>{
    await until(`!!window.__ns.editor?.view?.dom?.isConnected`)
    await c.sleep(100)
    const expected = await run(`(async()=>{const ed=window.__ns.editor;ed.commands.focus();ed.commands.setTextSelection({from:400,to:425});const h=ed.view.dom.closest('.crimson-page').querySelector('.rich-inner');h.scrollTop=630;h.dispatchEvent(new Event('scroll'));await window.__flushNow();return {chapterId:window.__testStores.work.selChapterId,scrollTop:h.scrollTop}})()`)
    await run(`(async()=>{await window.__testStores.work.closeWork();await window.__testStores.work.open(${JSON.stringify(wid)})})()`)
    await until(`window.__ns.editor?.state?.selection?.from===400`)
    await until(`Math.abs(document.querySelector('.crimson-page .rich-inner').scrollTop-${expected.scrollTop})<=1`)
    const actual = await run(`(()=>{const ed=window.__ns.editor;return {chapterId:window.__testStores.work.selChapterId,from:ed.state.selection.from,to:ed.state.selection.to,scrollTop:ed.view.dom.closest('.crimson-page').querySelector('.rich-inner').scrollTop}})()`)
    assert.equal(actual.chapterId,expected.chapterId)
    assert.equal(actual.from,400);assert.equal(actual.to,425)
    assert.ok(Math.abs(actual.scrollTop-expected.scrollTop)<=1,JSON.stringify({expected,actual}))
    writeFileSync('tools/_writing-session.json',JSON.stringify({workId:wid,...actual}))
  })

  await check('reading does not overwrite the writing bookmark',async()=>{
    const before=await run(`window.__ns.db.appconfig.get('writing-position:'+window.__testStores.work.work.id).then(r=>r.value)`)
    await run(`window.__testStores.ui.readMode=true`)
    await until(`!!document.querySelector('.editor-wrap.read-mode .rich-host')`)
    await run(`(()=>{const h=document.querySelector('.rich-host');h.scrollTop=1400;h.dispatchEvent(new Event('scroll'))})()`)
    await run(`window.__testStores.ui.readMode=false`)
    await c.sleep(150)
    await run(`window.__flushNow()`)
    const after=await run(`window.__ns.db.appconfig.get('writing-position:'+window.__testStores.work.work.id).then(r=>r.value)`)
    assert.equal(after.scrollTop,before.scrollTop)
    assert.deepEqual(after.selection,before.selection)
  })

  await check('page reload restores the same chapter, selection and scroll',async()=>{
    await run(`window.__flushNow()`)
    const expected=await run(`window.__ns.db.appconfig.get('writing-position:'+window.__testStores.work.work.id).then(r=>r.value)`)
    await c.send('Page.reload')
    await until(`!!window.__ns?.getWork && document.querySelector('#app')?.__vue_app__?.config.globalProperties.$pinia._s.get('shelf')?.works.length>0`)
    await run(`window.__testStores=(()=>{const p=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;return {work:p._s.get('work'),ui:p._s.get('ui'),ai:p._s.get('ai')}})()`)
    await run(`window.__testStores.work.open(${JSON.stringify(wid)})`)
    await until(`window.__ns.editor?.state?.selection?.from===${expected.selection.from}`)
    await until(`Math.abs(document.querySelector('.crimson-page .rich-inner').scrollTop-${expected.scrollTop})<=1`)
    assert.equal(await run(`window.__testStores.work.selChapterId`),expected.chapterId)
  })

  await check('reading mode keeps the editor read-only and Escape returns to writing',async()=>{
    await run(`window.__readEditor=window.__ns.editor;window.__testStores.ui.readMode=true`)
    assert.ok(await run(`!window.__ns.editor.isEditable && !!document.querySelector('.editor-wrap.read-mode')`))
    await run(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`)
    assert.ok(await run(`!window.__testStores.ui.readMode && window.__readEditor===window.__ns.editor && window.__ns.editor.isEditable`))
  })

  await check('explicit chapter targets override saved continuation',async()=>{
    const target=await run(`window.__testStores.work.liveChapters[0].id`)
    await run(`(async()=>{await window.__testStores.work.closeWork();await window.__testStores.work.open(${JSON.stringify(wid)},{chapterId:${JSON.stringify(target)}})})()`)
    assert.equal(await run(`window.__testStores.work.selChapterId`),target)
  })

  await check('chapter popout keeps explicit target and read-only main cannot overwrite its position',async()=>{
    const target=await run(`window.__testStores.work.liveChapters[1].id`)
    const opened=await run(`window.native.panelOpen({type:'chapter',workId:${JSON.stringify(wid)},entityId:${JSON.stringify(target)},title:'位置恢复验证'})`)
    assert.ok(opened.ok)
    await run(`window.__testStores.work.selChapterId=${JSON.stringify(target)}`)
    const p=await connect('panel=chapter',process.env.CDP_PORT||'9333')
    for(let n=0;n<100;n++) { if(await p.evalx(`!!window.__ns?.editor?.view?.dom?.isConnected`))break;await p.sleep(100) }
    assert.equal(await p.evalx(`window.__ns.getWork().selChapterId`),target)
    await p.sleep(100)
    await p.evalx(`(async()=>{const ed=window.__ns.editor;ed.commands.focus();ed.commands.setTextSelection({from:200,to:220});const h=ed.view.dom.closest('.crimson-page').querySelector('.rich-inner');h.scrollTop=450;h.dispatchEvent(new Event('scroll'));await window.__flushNow()})()`)
    await until(`window.__ns.editor.isEditable===false`)
    await run(`window.__flushNow()`)
    assert.equal(await run(`window.__ns.db.appconfig.get('writing-position:'+${JSON.stringify(wid)}).then(r=>r.value.selection.from)`),200)
    await p.evalx(`window.native.panelCloseSelf()`)
    await until(`window.native.panelList().then(r=>r.panels.length===0)`)
    await until(`window.__ns.editor.isEditable===true`)
    await run(`window.__flushNow()`)
    assert.equal(await run(`window.__ns.db.appconfig.get('writing-position:'+${JSON.stringify(wid)}).then(r=>r.value.selection.from)`),200)
    await run(`(async()=>{await window.__testStores.work.closeWork();await window.__testStores.work.open(${JSON.stringify(wid)})})()`)
    await until(`window.__ns.editor?.state?.selection?.from===200`)
  })

  await check('shelf continuation card refreshes after a position write from another window',async()=>{
    await run(`window.__testStores.work.closeWork()`)
    await until(`!!document.querySelector('.crimson-chapter-card')`)
    const target=await run(`window.__ns.db.chapters.where('workId').equals(${JSON.stringify(wid)}).toArray().then(a=>a.find(ch=>!ch.deletedAt && !document.querySelector('.crimson-chapter-card').textContent.includes(ch.title)))`)
    const opened=await run(`window.native.panelOpen({type:'chapter',workId:${JSON.stringify(wid)},entityId:${JSON.stringify(target.id)},title:'书架同步验证'})`)
    assert.ok(opened.ok)
    const p=await connect('panel=chapter',process.env.CDP_PORT||'9333')
    for(let n=0;n<100;n++){if(await p.evalx(`!!window.__ns?.editor?.view?.dom?.isConnected`))break;await p.sleep(100)}
    await p.sleep(100)
    await p.evalx(`window.__flushNow()`)
    try { await until(`document.querySelector('.crimson-chapter-card')?.textContent.includes(${JSON.stringify(target.title)})`) }
    finally { await p.evalx(`window.native.panelCloseSelf()`);await until(`window.native.panelList().then(r=>r.panels.length===0)`) }
    await run(`window.__testStores.work.open(${JSON.stringify(wid)})`)
  })

  await check('shortened manuscript clamps the old selection safely',async()=>{
    await run(`window.__flushNow()`)
    const id=await run(`window.__testStores.work.selChapterId`)
    await run(`(async()=>{await window.__testStores.work.closeWork();const key='writing-position:'+${JSON.stringify(wid)};const row=await window.__ns.db.appconfig.get(key);row.value.selection={from:9000,to:9200};await window.__ns.db.appconfig.put(row);await window.__ns.db.chapters.update(${JSON.stringify(id)},{content:'<p>正文已缩短。</p>'});await window.__testStores.work.open(${JSON.stringify(wid)})})()`)
    await until(`window.__ns.editor?.view?.dom?.textContent==='正文已缩短。'`)
    await c.sleep(100)
    assert.ok(await run(`window.__ns.editor.state.selection.to<=window.__ns.editor.state.doc.content.size`))
  })

  await check('atomic position storage rejects an older delayed window write',async()=>{
    assert.ok(await run(`(async()=>{const p=await import('/src/services/writing-position.js');const id=window.__testStores.work.work.id;const key=p.writingPositionKey(id);const old=await window.__ns.db.appconfig.get(key);p.queueWritingPosition(id,{chapterId:'stale-window',selection:{from:1,to:1}});await window.__ns.db.appconfig.put({key,value:{chapterId:'newer-window',updatedAt:Date.now()+60000}});await p.flushWritingPositions();const hit=await window.__ns.db.appconfig.get(key);await window.__ns.db.appconfig.put(old);return hit.value.chapterId==='newer-window'})()`))
  })

  await check('deleted continuation falls back safely and shelf card matches',async()=>{
    const data=await run(`(async()=>{const w=window.__testStores.work;const ch=w.liveChapters[2];await w.closeWork();await window.__ns.db.appconfig.put({key:'writing-position:'+${JSON.stringify(wid)},value:{chapterId:ch.id,updatedAt:Date.now()}});await window.__ns.db.chapters.update(ch.id,{deletedAt:Date.now()});await w.open(${JSON.stringify(wid)});const r=await import('/src/db/repo.js');return {current:w.selChapterId,card:(await r.resumeChapterOf(w.work.id))?.id,deleted:ch.id}})()`)
    assert.notEqual(data.current,data.deleted);assert.equal(data.current,data.card)
  })

  await check('empty work opens without inheriting another work bookmark',async()=>{
    const empty=await run(buildSeedExpr('验收测试作品',{reset:true}))
    await run(`(async()=>{await window.__testStores.work.closeWork();await window.__testStores.work.open(${JSON.stringify(empty.books[0].workId)})})()`)
    assert.equal(await run(`window.__testStores.work.selChapterId`),null)
  })

  // Keep a valid, long chapter as a fixture for a separate *actual process restart* check.
  await run(`(async()=>{const rows=await window.__ns.db.chapters.where('workId').equals(${JSON.stringify(wid)}).toArray();for(const ch of rows)await window.__ns.db.chapters.update(ch.id,{deletedAt:null});await window.__testStores.work.open(${JSON.stringify(wid)},{chapterId:rows.find(ch=>ch.content.includes('第89段')).id})})()`)
  await until(`window.__ns.editor?.view?.dom?.textContent?.includes('第89段')`)
  await c.sleep(100)
  const fixture=await run(`(async()=>{const ed=window.__ns.editor;ed.commands.focus();ed.commands.setTextSelection({from:300,to:320});const h=ed.view.dom.closest('.crimson-page').querySelector('.rich-inner');h.scrollTop=700;h.dispatchEvent(new Event('scroll'));await window.__flushNow();return {workId:window.__testStores.work.work.id,chapterId:window.__testStores.work.selChapterId,from:ed.state.selection.from,to:ed.state.selection.to,scrollTop:h.scrollTop}})()`)
  writeFileSync('tools/_writing-session.json',JSON.stringify(fixture))
}

console.log(`${results.filter(r=>r.ok).length}/${results.length} writing experience checks passed`)
writeFileSync('tools/_writing-results.json',JSON.stringify(results,null,2))
process.exit(results.every(r=>r.ok)?0:1)
