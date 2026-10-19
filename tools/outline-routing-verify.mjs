import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { connect } from './_cdp-lib.mjs'
import { buildSeedExpr } from './verify-seeds.mjs'
const c=await connect()
const win=await c.send('Browser.getWindowForTarget')
if(win?.windowId) await c.send('Browser.setWindowBounds',{windowId:win.windowId,bounds:{windowState:'normal'}})
await c.send('Page.bringToFront')
// Start from one module graph, rather than a long-lived Vite HMR session.
await c.evalx('location.reload()')
await c.sleep(700)
const W=`document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('work')`
const U=`document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('ui')`
const results=[]
const check=(name,ok,detail)=>{results.push({name,ok,detail});console.log(ok?'PASS':'FAIL',name,detail??'');assert.ok(ok,name)}
const evalx=async code=>{const r=await c.evalx(code);if(r?.PAGE_ERR) throw Error(r.PAGE_ERR);return r}
await evalx(`(async()=>{window.__routingAutosave=(await import(performance.getEntriesByType('resource').find(r=>r.name.includes('/src/services/autosave.js'))?.name||'/src/services/autosave.js')).autosave;await window.__routingAutosave.flushAll();window.__routingOriginal={workId:${W}.work?.id,skin:${U}.skin,theme:${U}.theme};return true})()`)
await evalx(`(async()=>{await ${W}.closeWork();return true})()`);
const newDefaults=await evalx(`(async()=>{
 const {db}=await import('/src/db/database.js');const {createWorkRow}=await import('/src/db/repo.js');
 const row=await createWorkRow({title:'画布验证书B'});const value=(await db.appconfig.get('olcanvas:'+row.id)).value;
 await db.outlines.where('workId').equals(row.id).delete();await db.appconfig.delete('olcanvas:'+row.id);await db.works.delete(row.id);return value
})()`)
check('new work defaults to rounded orthogonal',newDefaults.edgeStyle==='ortho',newDefaults)
// Registry reset replaces the named dedicated verification work.
const seed=await evalx(buildSeedExpr(['画布验证书B'],{reset:true}))
check('dedicated verification work',seed.ok)
const workId=seed.books[0].workId
await evalx(`(async()=>{await ${W}.open('${workId}');${W}.tab='outline';${W}.outlineView='canvas';return true})()`)
await c.sleep(500)
await evalx(`(async()=>{
 const w=${W}; const {db}=await import('/src/db/database.js');
 const rows=[
  {id:'routing-a',kind:'event',title:'发现异常',text:'故事从一封匿名信开始',canvasX:70,canvasY:150,w:180,h:90},
  {id:'routing-b',kind:'event',title:'追查线索',text:'选择进入旧城调查',canvasX:480,canvasY:150,w:180,h:90},
  {id:'routing-c',kind:'note',title:'支线 · 见证人',text:'提供相互矛盾的证词',canvasX:480,canvasY:390,w:180,h:90},
  {id:'routing-d',kind:'event',title:'真相浮现',text:'线索最终在此汇合',canvasX:860,canvasY:150,w:180,h:90},
  {id:'routing-obstacle',kind:'note',title:'待展开的伏笔',text:'连线将自动绕开这张卡片',canvasX:320,canvasY:120,w:110,h:140}
 ].map((n,i)=>({...n,workId:w.work.id,parentId:null,sortOrder:i*1000,rels:[],createdAt:1,updatedAt:1,deletedAt:null}));
 rows[0].rels=[{id:'routing-ab',toId:'routing-b',fromSide:'right',toSide:'left',label:'发现线索',kind:'因果',arrows:'->',junctions:[{id:'routing-j',t:.4}],_out:[{id:'routing-jc',fromJunction:{ownerId:'routing-a',relId:'routing-ab',junctionId:'routing-j'},toId:'routing-c',toSide:'top',kind:'伏笔',label:'另一种可能',arrows:'->',junctions:[]}]}];
 rows[1].rels=[{id:'routing-bd',toId:'routing-d',fromSide:'right',toSide:'left',label:'因果推进',kind:'因果',arrows:'<->',junctions:[]}];
 await db.olnodes.where('workId').equals(w.work.id).delete();await db.olnodes.bulkPut(rows);w.olnodes=rows;w.canvasPrefs={snap:false,density:'detail',edgeStyle:'ortho',edgeWidth:1.8,arrowSize:1};w.olUndo=[];w.olRedo=[];
 return true
})()`)
await c.sleep(500)
const state=await evalx(`({nodes:document.querySelectorAll('.oc-node').length,edges:document.querySelectorAll('.oc-edge').length,blocked:document.querySelectorAll('.oc-edge.blocked').length,text:document.body.innerText.slice(-150)})`)
check('production canvas renders unified routes',state.nodes===5&&state.edges===3&&state.blocked===0,state)
await fs.mkdir('docs/outline-routing-validation',{recursive:true})
const screenshot=async name=>{
 const r=await c.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});if(r.data) await fs.writeFile(`docs/outline-routing-validation/${name}.png`,Buffer.from(r.data,'base64'))
}
const mouse=async(type,x,y,button='left',clickCount=1)=>evalx(`(()=>{const type=${JSON.stringify(type)}==='mousePressed'?'mousedown':${JSON.stringify(type)}==='mouseReleased'?'mouseup':'mousemove';const target=type==='mousedown'?document.elementFromPoint(${x},${y}):window;target?.dispatchEvent(new MouseEvent(type,{clientX:${x},clientY:${y},button:0,buttons:type==='mouseup'?0:1,bubbles:true,detail:${clickCount}}));return true})()`)
const edgePoint=async(id,t=.5)=>evalx(`(()=>{const p=document.querySelector('.oc-edge[data-rel="${id}"] .oc-edge-hit');const q=p.getPointAtLength(p.getTotalLength()*${t}),m=p.getScreenCTM();return {x:q.x*m.a+m.e,y:q.y*m.d+m.f}})()`)
const select=async(id)=>{await evalx(`document.querySelector('.oc-edge[data-rel="${id}"] .oc-edge-hit').dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0}))`);await c.sleep(50)}
await select('routing-ab')
check('click selects and shows handles/toolbar',await evalx(`document.querySelectorAll('.oc-endpoint').length===2&&!!document.querySelector('.oc-route-handle')&&!!document.querySelector('.oc-edge-tools')`))
// Screenshots are captured in the visible browser harness; this Electron run tests persistence.
// Persist exact before/after snapshots around a real pointer gesture.
const snapshot=()=>evalx(`JSON.stringify(${W}.olnodes)`)
await evalx(`window.__routingRAF=requestAnimationFrame;window.__routingCAF=cancelAnimationFrame;requestAnimationFrame=cb=>setTimeout(()=>cb(performance.now()),0);cancelAnimationFrame=clearTimeout;true`);
const before=await snapshot(),undo=await evalx(`${W}.olUndo.length`)
const h=await evalx(`(()=>{const e=document.querySelector('.oc-route-handle'),r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,horizontal:e.classList.contains('horizontal')}})()`)
await mouse('mousePressed',h.x,h.y)
await mouse('mouseMoved',h.x+(h.horizontal?0:65),h.y+(h.horizontal?-65:0))
await c.sleep(60)
check('path preview stays transient',await snapshot()===before)
await mouse('mouseReleased',h.x+(h.horizontal?0:65),h.y+(h.horizontal?-65:0))
await c.sleep(100)
check('manual routing commits one undo',await evalx(`${W}.olUndo.length===${undo+1}&&${W}.olnodes[0].rels[0].routing?.version===1`))
const after=await snapshot()
await evalx(`${W}.olnodeUndo()`);await c.sleep(50);check('undo restores gesture completely',await snapshot()===before)
await evalx(`${W}.olnodeRedo()`);await c.sleep(50);check('redo restores manual preferences',await snapshot()===after)
// Escape cancels a second route edit, without changing data or adding undo.
await select('routing-ab')
const h2=await evalx(`(()=>{const r=document.querySelector('.oc-route-handle').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`)
const cancelPath=await evalx(`document.querySelector('.oc-edge[data-rel="routing-ab"] .oc-edge-hit').getAttribute('d')`)
await mouse('mousePressed',h2.x,h2.y);await mouse('mouseMoved',h2.x+40,h2.y-40);await c.sleep(40)
await evalx(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`);await mouse('mouseReleased',h2.x+40,h2.y-40)
check('Escape restores pre-gesture state',await snapshot()===after)
await c.sleep(40)
check('Escape restores the exact visible path, including cached corridors',await evalx(`document.querySelector('.oc-edge[data-rel="routing-ab"] .oc-edge-hit').getAttribute('d')`)===cancelPath)
const center=async selector=>evalx(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`)
const drag=async(selector,target)=>{
 const p=await center(selector),q=typeof target==='function'?await target():typeof target==='string'?await center(target):target
 await evalx(`document.querySelector(${JSON.stringify(selector)}).dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0,clientX:${p.x},clientY:${p.y}}))`)
 await mouse('mouseMoved',q.x,q.y);await c.sleep(40)
 const preview=await evalx(`document.querySelector('.oc-connection-preview')?.getAttribute('d')`)
 await mouse('mouseReleased',q.x,q.y);await c.sleep(60)
 return preview
}
const port=(node,side)=>`.oc-node[data-node-id="routing-${node}"] .oc-apt[data-side="${side}"]`
for(const style of ['ortho','bezier']) {
 await evalx(`${W}.canvasPrefs.edgeStyle='${style}';true`)
 await select('routing-ab')
 await evalx(`document.querySelector('.oc-edge-tools button[title*="清除手动"]').click()`);await c.sleep(40)
 const original=await snapshot(),undo=await evalx(`${W}.olUndo.length`)
 const preview=await drag('.oc-endpoint-control[data-end="target"]',port('c','left'))
 check(`${style}: reconnect target uses previewed port/path`,await evalx(`${W}.olnodes[0].rels[0].toId==='routing-c'&&${W}.olnodes[0].rels[0].toSide==='left'&&document.querySelector('.oc-edge[data-rel="routing-ab"] .oc-edge-hit').getAttribute('d')===${JSON.stringify(preview)}`))
 check(`${style}: reconnect is one undo`,await evalx(`${W}.olUndo.length===${undo+1}`))
 await evalx(`${W}.olnodeUndo()`);await c.sleep(30);check(`${style}: reconnect undo`,await snapshot()===original)
 await select('routing-ab')
 await drag('.oc-endpoint-control[data-end="source"]',port('c','right'))
 check(`${style}: source reconnect preserves branches and identity`,await evalx(`(()=>{const r=${W}.olnodes.find(n=>n.id==='routing-c').rels.find(r=>r.id==='routing-ab');return r?.label==='发现线索'&&r._out[0].fromJunction.ownerId==='routing-c'&&r.junctions[0].id==='routing-j'})()`))
 await evalx(`${W}.olnodeUndo()`);await c.sleep(30)
 await select('routing-ab')
 const invalidBefore=await snapshot()
 await drag('.oc-endpoint-control[data-end="target"]',{x:300,y:800})
 check(`${style}: invalid drop leaves data intact`,await snapshot()===invalidBefore)
 // All four endpoint combinations, with edge-body junction creation included in one undo.
 const cases=[
  [port('c','left'),port('a','bottom'),'node-node'],
  [port('c','right'),()=>edgePoint('routing-bd',.5),'node-line'],
  ['.oc-junc-hit',port('a','top'),'line-node'],
  ['.oc-junc-hit',()=>edgePoint('routing-bd',.5),'line-line']
 ]
 for(const [from,to,name] of cases) {
  const baseline=await snapshot(),u=await evalx(`${W}.olUndo.length`)
  const drawn=await drag(from,to)
  check(`${style}: ${name} commits once`,await evalx(`${W}.olUndo.length===${u+1}`),drawn?'preview rendered':'no preview')
  await evalx(`${W}.olnodeUndo()`);await c.sleep(30)
  check(`${style}: ${name} undo removes provisional junction too`,await snapshot()===baseline)
 }
 await select('routing-ab')
 const h=await center('.oc-route-handle'),manualBefore=await snapshot()
 await drag('.oc-route-handle',{x:h.x+45,y:h.y-50})
 check(`${style}: route handle saves manual preference`,await evalx(`${W}.olnodes[0].rels[0].routing?.version===1`))
 await evalx(`${W}.olnodeUndo()`);await c.sleep(30);check(`${style}: route edit undo`,await snapshot()===manualBefore)
 await select('routing-ab')
 await evalx(`document.querySelector('.oc-edge[data-rel="routing-ab"] .oc-edge-hit').dispatchEvent(new MouseEvent('dblclick',{bubbles:true,button:0}))`);await c.sleep(50)
 check(`${style}: double click edits properties`,await evalx(`!!document.querySelector('.oc-eedit input')`))
 const inputBefore=await snapshot()
 await evalx(`document.querySelector('.oc-eedit input').dispatchEvent(new KeyboardEvent('keydown',{key:'Delete',bubbles:true}));true`)
 check(`${style}: text Delete never deletes relation`,await snapshot()===inputBefore)
 await evalx(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));true`)
 await select('routing-ab')
 const deleteBefore=await snapshot()
 await evalx(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'Delete',bubbles:true}));true`);await c.sleep(30)
 check(`${style}: Delete removes selected edge and branches`,await evalx(`!document.querySelector('.oc-edge[data-rel="routing-ab"]')&&!document.querySelector('.oc-edge[data-rel="routing-jc"]')`))
 await evalx(`${W}.olnodeUndo()`);await c.sleep(30);check(`${style}: deletion undo`,await snapshot()===deleteBefore)
}
// Persist and reopen the dedicated test work only.
const blockedObstacle=await evalx(`(()=>{const n=${W}.olnodes.find(n=>n.id==='routing-obstacle');const original={canvasX:n.canvasX,canvasY:n.canvasY,w:n.w,h:n.h};Object.assign(n,{canvasX:200,canvasY:180,w:110,h:40});return original})()`);await c.sleep(40)
check('unreachable layout displays blocked connection',await evalx(`document.querySelector('.oc-edge[data-rel="routing-ab"]').classList.contains('blocked')`))
const blockedUndo=await evalx(`${W}.olUndo.length`),blockedJunction=await center('.oc-junc-hit')
await drag(port('c','bottom'),blockedJunction)
check('blocked host junction is not a valid snap target',await evalx(`${W}.olUndo.length===${blockedUndo}`))
await evalx(`Object.assign(${W}.olnodes.find(n=>n.id==='routing-obstacle'),${JSON.stringify(blockedObstacle)});true`);await c.sleep(40)
const deletionSnapshot=await snapshot()
await evalx(`${W}.olnodeRemove('routing-b');true`);await c.sleep(40)
check('node deletion cascades hosts owned by other nodes and all branches',await evalx(`!document.querySelector('.oc-edge[data-rel="routing-ab"]')&&!document.querySelector('.oc-edge[data-rel="routing-jc"]')`))
await evalx(`${W}.olnodeUndo()`);await c.sleep(40)
check('node deletion and dependency cleanup undo together',await snapshot()===deletionSnapshot)
await select('routing-ab')
const ph=await center('.oc-route-handle')
await drag('.oc-route-handle',{x:ph.x+30,y:ph.y-40})
await evalx(`(async()=>{await window.__routingAutosave.flushAll();await ${W}.saveCanvasPrefs();return true})()`)
await evalx(`(async()=>{await ${W}.open('${workId}');${W}.tab='outline';${W}.outlineView='canvas';return true})()`);await c.sleep(80)
check('manual routing and style survive database reload',await evalx(`${W}.olnodes.find(n=>n.id==='routing-a').rels[0].routing?.version===1&&${W}.canvasPrefs.edgeStyle==='bezier'`))
await evalx('location.reload()');await c.sleep(700)
await evalx(`(async()=>{await ${W}.open('${workId}');${W}.tab='outline';${W}.outlineView='canvas';return true})()`);await c.sleep(80)
check('manual routing and style survive a full page refresh',await evalx(`${W}.olnodes.find(n=>n.id==='routing-a').rels[0].routing?.version===1&&${W}.canvasPrefs.edgeStyle==='bezier'`))
await evalx(`(async()=>{const {db}=await import('/src/db/database.js');await db.appconfig.delete('olcanvas:'+${W}.work.id);${W}.canvasPrefs={edgeStyle:'ortho',density:'compact',snap:false};await ${W}.loadCanvasPrefs();return true})()`)
check('work without saved preferences resets to legacy defaults',await evalx(`${W}.canvasPrefs.edgeStyle==='bezier'&&${W}.canvasPrefs.snap===true&&${W}.canvasPrefs.density==='detail'`))
await fs.writeFile('docs/outline-routing-validation/interaction-results.json',JSON.stringify(results,null,2))
console.log('INITIAL INTERACTION CHECKS COMPLETE',workId)
process.exit(0)
