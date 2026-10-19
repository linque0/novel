import assert from 'node:assert/strict'
import { relationTransaction, flattenRelations } from '../src/components/outline/canvas-relations.js'
let n=0,seq=0
const run=(nodes,command)=>relationTransaction(nodes,command,{uid:()=>`new${++seq}`,now:()=>1})
const check=(name,fn)=>{fn();console.log('PASS',name);n++}
const seed=()=>[
 {id:'a',rels:[{id:'ab',toId:'b',fromSide:'right',toSide:'left',label:'因果',arrows:'<->',color:'#abc',routing:{version:1,waypoints:[{x:50,y:-30}]},junctions:[{id:'j',t:.3}],_out:[{id:'branch',fromJunction:{ownerId:'a',relId:'ab',junctionId:'j'},toId:'c',junctions:[]}]}]},
 {id:'b',rels:[]},{id:'c',rels:[{id:'ca',toJunction:{ownerId:'a',relId:'ab',junctionId:'j'},junctions:[]}]}]
check('reconnect source preserves ID, metadata, junctions, outgoing branches and references',()=>{
 const nodes=seed(),before=JSON.stringify(nodes),r=run(nodes,{type:'reconnect',ownerId:'a',relId:'ab',end:'source',endpoint:{nodeId:'b',side:'bottom'}})
 assert.equal(r.ok,true);assert.equal(JSON.stringify(nodes),before)
 const e=flattenRelations(r.nodes).find(e=>e.rel.id==='ab');assert.equal(e.owner.id,'b');assert.equal(e.rel.label,'因果');assert.equal(e.rel._out[0].fromJunction.ownerId,'b');assert.equal(r.nodes[2].rels[0].toJunction.ownerId,'b');assert.equal(e.rel.color,'#abc')
})
check('target reconnect does not lose branch or manual routing',()=>{
 const r=run(seed(),{type:'reconnect',ownerId:'a',relId:'ab',end:'target',endpoint:{nodeId:'c',side:'top'}})
 assert.equal(r.ok,true);assert.equal(r.rel.toId,'c');assert.equal(r.rel._out.length,1);assert.equal(r.rel.routing.waypoints.length,1)
})
check('story cycles are legal; host dependency cycles rejected atomically',()=>{
 let r=run(seed(),{type:'connect',source:{nodeId:'b'},target:{nodeId:'a'}});assert.equal(r.ok,true)
 const nodes=seed(),before=JSON.stringify(nodes)
 r=run(nodes,{type:'reconnect',ownerId:'a',relId:'ab',end:'target',endpoint:{ownerId:'c',relId:'ca',t:.5}})
 assert.equal(r.ok,false);assert.equal(JSON.stringify(nodes),before)
})
check('same host used by both endpoints is legal, self dependency is not',()=>{
 const r=run(seed(),{type:'connect',source:{ownerId:'a',relId:'ab',junctionId:'j'},target:{ownerId:'a',relId:'ab',t:.8}})
 assert.equal(r.ok,true)
 assert.equal(run(seed(),{type:'reconnect',ownerId:'a',relId:'ab',end:'target',endpoint:{ownerId:'a',relId:'ab',t:.5}}).ok,false)
})
check('invalid drop/duplicate produce no mutations or orphan junctions',()=>{
 const nodes=seed(),before=JSON.stringify(nodes)
 assert.equal(run(nodes,{type:'connect',source:{nodeId:'a'},target:{nodeId:'b'}}).ok,false)
 assert.equal(run(nodes,{type:'reconnect',ownerId:'a',relId:'ab',end:'target',endpoint:{nodeId:'missing'}}).ok,false)
 assert.equal(JSON.stringify(nodes),before)
})
check('node to line, line to node, line to line and nested hosts survive ownership changes',()=>{
 let nodes=seed()
 for(const [source,target] of [
  [{nodeId:'b'},{ownerId:'a',relId:'ab',t:.6}],
  [{ownerId:'a',relId:'ab',junctionId:'j'},{nodeId:'b'}],
  [{ownerId:'a',relId:'branch',t:.4},{ownerId:'c',relId:'ca',t:.6}]
 ]) {const r=run(nodes,{type:'connect',source,target});assert.equal(r.ok,true,r.error);nodes=r.nodes}
 assert.equal(flattenRelations(nodes).length,6)
})
check('moving relation under a host retains its own outgoing tree',()=>{
 const r=run(seed(),{type:'reconnect',ownerId:'a',relId:'ab',end:'source',endpoint:{ownerId:'c',relId:'ca',t:.4}})
 // ca depends on ab: reparenting ab below ca would cause recursion.
 assert.equal(r.ok,false)
})
check('remove host cascades all incoming and outgoing dependent relations',()=>{
 const r=run(seed(),{type:'remove',ownerId:'a',relId:'ab'})
 assert.equal(r.ok,true);assert.equal(flattenRelations(r.nodes).length,0)
})
check('remove junction preserves host, cascades incoming and outgoing edges',()=>{
 const r=run(seed(),{type:'junction-remove',ownerId:'a',relId:'ab',junctionId:'j'})
 assert.equal(r.ok,true);assert.equal(flattenRelations(r.nodes).length,1);assert.equal(r.nodes[0].rels[0].junctions.length,0)
})
check('node deletion cleans incoming hosts and their dependent branches recursively',()=>{
 const nodes=seed();nodes[1].deletedAt=1
 const r=run(nodes,{type:'prune'})
 assert.equal(r.ok,true);assert.equal(flattenRelations(r.nodes).length,0)
 assert.equal(run(r.nodes,{type:'connect',source:{nodeId:'a'},target:{nodeId:'c'}}).ok,true)
})
check('unrelated legacy orphan does not prevent a valid new connection',()=>{
 const nodes=seed();nodes[0].rels=[]
 const r=run(nodes,{type:'connect',source:{nodeId:'a'},target:{nodeId:'c'}})
 assert.equal(r.ok,true);assert.equal(r.nodes[2].rels[0].id,'ca')
})
console.log(`${n}/${n} relation tests passed`)
