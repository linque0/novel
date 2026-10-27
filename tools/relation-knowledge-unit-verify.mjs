import assert from 'node:assert/strict'
import { projectBook, sourceManifest, SOURCE_TABLES } from '../src/services/project/normalize.js'
import { projectGraph } from '../src/services/project/graph.js'
let passed=0, failed=0
const test=(name,fn)=>{try{fn();passed++;console.log('PASS '+name)}catch(e){failed++;console.error('FAIL '+name+' — '+e.message)}}
const bundle={work:{id:'w',title:'关联样书'},characters:[{id:'c',workId:'w',name:'青禾'}],mubu:[{id:'a',workId:'w',text:'云城'},{id:'b',workId:'w',text:'星塔'}],
  lorelinks:[{id:'r',workId:'w',fromKind:'mubu',fromId:'a',toKind:'character',toId:'c',label:'属于',reverseLabel:'拥有',description:'祖传领地，不可转让'},{id:'r2',workId:'w',fromKind:'mubu',fromId:'b',toKind:'mubu',toId:'a',label:'位于',reverseLabel:'包含'}],
  chapters:[],volumes:[],relations:[],olnodes:[],links:[]}
test('entry relationships enter source manifest and invalidate edits/deletes',()=>{
  assert(SOURCE_TABLES.includes('lorelinks'))
  const copy=structuredClone(bundle);copy.lorelinks[0].description='已修改'
  assert.notEqual(sourceManifest(bundle).hash,sourceManifest(copy).hash)
  copy.lorelinks=[];assert.notEqual(sourceManifest(bundle).hash,sourceManifest(copy).hash)
})
test('entry relationship documents retain direction, reverse name, description and endpoint dependencies',()=>{
  const model=projectBook(bundle),doc=model.docs.find(d=>d.sourceType==='lorelink'&&d.sourceId==='r')
  assert(doc,'missing lorelink document');assert.equal(doc.semanticClass,'setting');assert.equal(doc.sourceTable,'lorelinks')
  for(const text of ['云城','青禾','属于','拥有','祖传领地，不可转让'])assert(doc.plainText.includes(text),text)
  for(const [table,id] of [['lorelinks','r'],['mubu','a'],['characters','c']])assert(doc.deps.some(v=>v.table===table&&v.id===id))
  const renamed=structuredClone(bundle);renamed.mubu[0].text='新云城'
  assert.notEqual(doc.textHash,projectBook(renamed).docs.find(d=>d.sourceId==='r').textHash)
})
test('graph connects both entry kinds and preserves reverse label with source citation',()=>{
  const graph=projectGraph(bundle,projectBook(bundle).docs),edge=graph.edges.find(e=>e.docId==='doc:w:lorelink:r')
  assert(edge,'missing lorelink edge');assert.equal(edge.fromId,'lore:a');assert.equal(edge.toId,'character:c')
  assert.equal(edge.reverseLabel,'拥有');assert.equal(edge.description,'祖传领地，不可转让');assert.equal(edge.semanticClass,'setting')
  assert(graph.edges.some(e=>e.fromId==='lore:b'&&e.toId==='lore:a'))
})
test('deleted, missing, foreign and unsupported endpoints cannot become usable relationships',()=>{
  const copy=structuredClone(bundle);copy.characters[0].deletedAt=1;copy.mubu[1].workId='foreign'
  copy.lorelinks.push({...copy.lorelinks[0],id:'bad',fromKind:'unknown'})
  const model=projectBook(copy),graph=projectGraph(copy,model.docs)
  assert(!model.docs.some(d=>d.sourceType==='lorelink'));assert(model.issues.some(i=>i.type==='orphan-lorelink'))
  assert(!graph.edges.some(e=>e.kind==='entry-relationship'))
})
const canvas=()=>({...structuredClone(bundle),olnodes:[{id:'o1',workId:'w',title:'起因',text:'',rels:[{id:'e1',toId:'o2',kind:'因果',label:'开启城门',junctions:[{id:'j',t:.5}],_out:[{id:'branch',fromJunction:{ownerId:'o1',relId:'e1',junctionId:'j'},toId:'o3',kind:'分支',label:'同时点火'}]}]}, {id:'o2',workId:'w',title:'后果',rels:[]},{id:'o3',workId:'w',title:'支线',rels:[{id:'join',toJunction:{ownerId:'o1',relId:'e1',junctionId:'j'},kind:'汇入',label:'返回主线'}]}]})
test('outline text includes labels and nested junction connections, with target dependencies',()=>{
  const model=projectBook(canvas()),docs=model.docs.filter(d=>d.sourceType==='outlineconnection'&&d.sourceId==='o1')
  for(const text of ['开启城门','同时点火','后果','支线'])assert(docs.some(d=>d.plainText.includes(text)),text)
  assert(docs.some(d=>d.deps.some(v=>v.table==='olnodes'&&v.id==='o3')))
})
test('outline graph preserves node and connection endpoints without inventing node causality',()=>{
  const b=canvas(),graph=projectGraph(b,projectBook(b).docs)
  assert(graph.edges.some(e=>e.fromId==='doc:w:olnode:o1'&&e.toId==='doc:w:olnode:o2'&&e.label==='开启城门'))
  assert(graph.edges.some(e=>e.fromId==='outline-connection:o1:e1'&&e.toId==='doc:w:olnode:o3'&&e.label==='同时点火'))
  assert(graph.edges.some(e=>e.fromId==='doc:w:olnode:o3'&&e.toId==='outline-connection:o1:e1'&&e.label==='返回主线'))
  assert(!graph.edges.some(e=>e.fromId==='doc:w:olnode:o1'&&e.toId==='doc:w:olnode:o3'))
})
test('approved inspiration associations enter graph with inspiration provenance',()=>{
  const b={...structuredClone(bundle),snippets:[{id:'s',workId:'w',content:'候选想法',aiLinks:[{type:'character',id:'c'},{type:'lore',id:'a'},{type:'outline',id:'o1'}]}],olnodes:canvas().olnodes}
  const graph=projectGraph(b,projectBook(b).docs)
  for(const id of ['doc:w:character:c','doc:w:mubu:a','doc:w:olnode:o1'])assert(graph.edges.some(e=>e.kind==='inspiration-link'&&e.fromId==='doc:w:snippet:s'&&e.toId===id&&e.semanticClass==='inspiration'))
})
test('written outline references remain navigable without becoming future plans',()=>{
  const b={...structuredClone(bundle),chapters:[{id:'ch',workId:'w',content:'<p><span data-dl-target="outline:ref">已写章纲</span></p>',fmt:'html'}],olnodes:[{id:'o',workId:'w',refId:'ref',title:'已写章纲',outlineNature:'written',sourceChapterVersions:[]}]}
  assert(projectGraph(b,projectBook(b).docs).edges.some(e=>e.kind==='doublelink'&&e.toId==='doc:w:olnode:o'))
})
test('plain tokens resolve the same snippet, truncated setting and chapter-outline titles shown by UI',()=>{
  const b=structuredClone(bundle),title='很长的设定节点标题'.repeat(8)
  b.mubu[0].text=title;b.snippets=[{id:'s',workId:'w',content:'铜符也许化作星门'}]
  b.chapters=[{id:'ch',workId:'w',title:'第三章',fmt:'text',content:`[[铜符也许化作星门]] [[${title.slice(0,40)}]] [[章纲 · 第三章]]`}]
  b.olnodes=[{id:'o',workId:'w',title:'事件节点',refId:'ch',text:'计划内容'}]
  const graph=projectGraph(b,projectBook(b).docs)
  for(const id of ['doc:w:snippet:s','doc:w:mubu:a','doc:w:olnode:o'])assert(graph.edges.some(e=>e.kind==='doublelink'&&e.toId===id),id)
})
test('connections from written outlines are separate plans, never embedded in historical summaries',()=>{
  const b=canvas();b.olnodes[0].outlineNature='written';b.olnodes[0].text='已发生的内容'
  const model=projectBook(b),summary=model.docs.find(d=>d.sourceType==='olnode'&&d.sourceId==='o1')
  assert.equal(summary.semanticClass,'summary');assert(!summary.plainText.includes('开启城门'))
  assert(model.docs.some(d=>d.sourceType==='outlineconnection'&&d.sourceId==='o1'&&d.semanticClass==='plan'&&d.plainText.includes('开启城门')))
  assert(projectGraph(b,model.docs).edges.filter(e=>e.kind==='outline-因果').every(e=>e.semanticClass==='plan'))
})
test('same-label connections to different junctions remain distinct',()=>{
  const b=canvas();b.olnodes[0].rels[0].junctions.push({id:'j2',t:.7});b.olnodes[2].rels.push({...structuredClone(b.olnodes[2].rels[0]),id:'join2',toJunction:{ownerId:'o1',relId:'e1',junctionId:'j2'}})
  const edges=projectGraph(b,projectBook(b).docs).edges.filter(e=>e.kind==='outline-汇入')
  assert.equal(edges.length,2);assert.equal(new Set(edges.map(e=>e.toEndpoint.junctionId)).size,2)
})
console.log(`${passed}/${passed+failed} relationship unit checks passed`)
process.exitCode=failed?1:0
