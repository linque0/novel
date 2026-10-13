import assert from 'node:assert/strict'
import { normalizeText, tokens, rowHash, chapterHash } from '../src/services/project/text.js'
import { chunkText, paragraphRanges } from '../src/services/project/chunker.js'
import { projectBook, sourceManifest } from '../src/services/project/normalize.js'
import { projectGraph } from '../src/services/project/graph.js'
let passed=0
const test=(name,fn)=>{fn();passed++;console.log('PASS '+name)}
const work={work:{id:'w',title:'样书'},volumes:[{id:'v',title:'卷一',sortOrder:0}],chapters:[{id:'c1',workId:'w',title:'章一',volumeId:'v',content:'林昭受伤。\n\n铜符发光。',fmt:'text',sortOrder:0},{id:'c2',workId:'w',title:'章二',content:'林昭得知秘密。',fmt:'text',sortOrder:1}],
  characters:[{id:'a',workId:'w',name:'林昭',aliases:'小昭',fields:{能力:'凝气'},content:'少年'}],relations:[],mubu:[{id:'l',workId:'w',text:'势力',parentId:null},{id:'l2',workId:'w',text:'云宗禁止复活。',parentId:'l'}],
  olnodes:[{id:'o',workId:'w',title:'章纲',text:'寻找铜符',refId:'c1',rels:[],textboxes:[{text:'先受伤后获救'}]}],snippets:[{id:'s',workId:'w',content:'也许铜符藏着一座城。',tags:['灵感']}],annotations:[{id:'n',workId:'w',chapterId:'c1',text:'受伤',note:'保持伤势'}],assets:[{id:'asset',workId:'w',name:'地图.png',mime:'image/png'}],links:[]}
test('HTML boundaries, entities, inline links and literal angle brackets',()=>{
  assert.equal(normalizeText('<p>林<span data-note-id="n">昭</span>&#x4F24;。</p><p>下一段。</p>','html'),'林昭伤。\n\n下一段。')
  assert.equal(normalizeText('a < b <span>文字</span>','text'),'a < b <span>文字</span>')
  assert(!normalizeText('<script>leak()</script><p>正文</p>','html').includes('leak'))
})
test('all core ranges cover exact Unicode input and overlap counts toward budget',()=>{
  const text='\n'+('😀甲乙丙丁。\n\n'+('无标点长句'.repeat(7))).repeat(20)+'尾声。'
  const chunks=chunkText(text,{budget:37,overlap:9})
  assert.equal(chunks.map((c)=>text.slice(c.coreStart,c.coreEnd)).join(''),text)
  let end=0
  for(const c of chunks){assert.equal(c.coreStart,end);assert(c.tokenEstimate<=37);assert.equal(c.text.slice(c.headLen),text.slice(c.coreStart,c.coreEnd));assert(!/[\uD800-\uDBFF]$/.test(c.text));end=c.coreEnd}
  assert(chunks.some((c)=>c.headLen>0))
})
test('empty and invalid budgets have explicit behavior',()=>{assert.deepEqual(chunkText(''),[]);assert.throws(()=>chunkText('abc',{budget:0}));assert.throws(()=>chunkText('abc',{budget:NaN}))})
test('paragraph identities survive insertion and duplicate passages remain distinct',()=>{
  const first=paragraphRanges('甲。\n\n乙。\n\n甲。'),second=paragraphRanges('新段。\n\n甲。\n\n乙。\n\n甲。',first)
  assert.equal(first[1].id,second[2].id);assert.notEqual(first[0].id,first[2].id)
})
test('recursive hashes are independent of field insertion order',()=>assert.equal(rowHash({id:'a',fields:{a:1,b:{x:2,y:3}}}),rowHash({fields:{b:{y:3,x:2},a:1},id:'a',updatedAt:10})))
test('all core author sources project with correct semantic classes',()=>{
  const model=projectBook(work)
  for(const type of ['chapter','character','mubu','olnode','snippet','annotation','asset'])assert(model.docs.some((d)=>d.sourceType===type))
  assert.equal(model.docs.find((d)=>d.sourceType==='snippet').semanticClass,'inspiration')
  assert.equal(model.docs.find((d)=>d.sourceType==='olnode').semanticClass,'plan')
  assert(model.docs.find((d)=>d.sourceType==='olnode').plainText.includes('章纲'))
  assert(model.docs.find((d)=>d.sourceType==='olnode').plainText.includes('先受伤后获救'))
  assert(model.issues.some((i)=>i.type==='unparsed-asset'))
})
test('orphan chapters follow ordered volumes and deleted chapters are excluded',()=>{
  const model=projectBook({...work,chapters:[...work.chapters,{id:'gone',deletedAt:10,content:'不读'}]})
  assert.deepEqual(model.docs.filter((d)=>d.sourceType==='chapter').map((d)=>d.sourceId),['c1','c2'])
})
test('parent rename invalidates descendants without altering their text hash',()=>{
  const a=projectBook(work),changed=structuredClone(work);changed.mubu[0].text='门派'
  const b=projectBook(changed,a.docs),find=(m)=>m.docs.find((d)=>d.sourceId==='l2')
  assert.equal(find(a).textHash,find(b).textHash);assert.notEqual(find(a).contextHash,find(b).contextHash)
})
test('relations change both character dependency hashes',()=>{
  const changed=structuredClone(work);changed.characters.push({id:'b',workId:'w',name:'沈青梧'});changed.relations.push({id:'r',workId:'w',fromId:'a',toId:'b',label:'同伴'})
  const first=projectBook(changed);changed.relations[0].label='敌对';const second=projectBook(changed,first.docs)
  for(const id of ['a','b'])assert.notEqual(first.docs.find((d)=>d.sourceId===id).contextHash,second.docs.find((d)=>d.sourceId===id).contextHash)
})
test('cyclic trees terminate and report data quality issues',()=>{const m=projectBook({...work,mubu:[{id:'x',parentId:'y',text:'甲'},{id:'y',parentId:'x',text:'乙'}]});assert.equal(m.docs.filter((d)=>d.sourceType==='mubu').length,2);assert(m.issues.some((i)=>i.type==='tree-cycle'))})
test('graph separates mentions from relations and detects ambiguous names',()=>{
  const changed=structuredClone(work);changed.characters.push({id:'b',workId:'w',name:'林昭'})
  const graph=projectGraph(changed,projectBook(changed).docs)
  assert(graph.issues.some((i)=>i.type==='ambiguous-mention'));assert(!graph.edges.some((e)=>e.kind==='relationship'))
})
test('source manifests detect direct deletion and ignore timestamps',()=>{
  const copy=structuredClone(work);copy.chapters[0].updatedAt=100
  assert.equal(sourceManifest(work).hash,sourceManifest(copy).hash)
  copy.snippets=[];assert.notEqual(sourceManifest(work).hash,sourceManifest(copy).hash)
})
test('explicit double links, ambiguous title links and attachments preserve provenance',()=>{
  const copy=structuredClone(work)
  copy.chapters[0].fmt='html';copy.chapters[0].content='<p><span data-dl-target="character:a">林昭</span> [[章纲]] [[章二]]</p>'
  copy.olnodes.push({id:'o2',title:'章纲',text:'另一计划'})
  copy.links.push({id:'ln',entityType:'chapter',entityId:'c1',assetId:'asset'})
  const graph=projectGraph(copy,projectBook(copy).docs)
  assert(graph.edges.some((e)=>e.kind==='doublelink'&&e.toId==='doc:w:character:a'))
  assert(graph.edges.some((e)=>e.kind==='doublelink'&&e.toId==='doc:w:chapter:c2'))
  assert(graph.edges.some((e)=>e.kind==='attachment'&&e.toId==='doc:w:asset:asset'))
  assert(graph.issues.some((e)=>e.type==='ambiguous-doublelink'))
})
console.log(`${passed}/${passed} project unit checks passed`)
