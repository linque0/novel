import { assertAiTestProfile } from './_ai-test-profile.mjs'
/* 只在 dev 调试 profile 上跑（数据目录须以 小说工坊-dev 结尾；正式版 profile 一律拒绝）。
   CDP 9222、Vite 5173、本地 mock 18700（可用 CDP_PORT 覆盖端口）。 */
import { connect } from './_cdp-lib.mjs'
const c = await connect('app://', process.env.CDP_PORT || '9222')
const loc = await c.evalx('window.native.getDataLocation()')
assertAiTestProfile(loc)
for (let i = 0; i < 40 && !(await c.evalx('!!window.__ns')); i++) await c.sleep(200)
await c.sleep(1500)
const results = []
async function test(name, body) {
  try {
    const value = await c.evalx(`(async()=>{${body}})()`)
    if (value?.PAGE_ERR || value !== true) throw new Error(JSON.stringify(value))
    results.push({ name, ok: true })
    console.log('PASS ' + name)
  } catch (e) {
    results.push({ name, ok: false })
    console.log('FAIL ' + name + ' ' + e.message)
  }
}
await test(
  'setup isolated fixture and encrypted mock credential',
  `
  const {db}=window.__ns;
  for(const t of ['works','volumes','chapters','characters','relations','mubu','olnodes','aisum','aikbblock','aikb','aikbmeta','airuns','aistyle','aidecisions','aikbvec']) {
    const rows=await db.table(t).toArray(); await db.table(t).bulkDelete(rows.filter(r=>r.workId==='v2-work'||r.id==='v2-work').map(r=>r.id));
  }
  await db.works.put({id:'v2-work',title:'Agent v2 验证作品',genre:'玄幻',updatedAt:Date.now(),deletedAt:null});
  await db.volumes.put({id:'v2-vol',workId:'v2-work',title:'第一卷',sortOrder:0,deletedAt:null});
  for(const [i,content] of ['林昭埋下铜符。暗门尚未开启。','林昭见铜符发光。夜行客从雾中走来。','林昭用铜符打开石门。此时伤势已愈。',''].entries()) await db.chapters.put({id:'v2-ch'+i,workId:'v2-work',volumeId:'v2-vol',title:'第'+(i+1)+'章',content,fmt:'text',sortOrder:i,deletedAt:null});
  await db.characters.bulkPut([{id:'v2-char',workId:'v2-work',name:'林昭',aliases:'小昭',fields:{伤势:'右臂受伤'},deletedAt:null},{id:'v2-char2',workId:'v2-work',name:'沈青梧',aliases:'',fields:{},deletedAt:null}]);
  await db.mubu.put({id:'v2-lore',workId:'v2-work',text:'铜符',parentId:null,sortOrder:0,deletedAt:null});
  await db.olnodes.bulkPut([{id:'v2-ol',workId:'v2-work',title:'主线',parentId:null,kind:'event',text:'调查铜符',sortOrder:0,deletedAt:null,rels:[]},{id:'v2-other',workId:'v2-work',title:'其他节点',parentId:null,kind:'event',text:'',sortOrder:1,deletedAt:null,rels:[]}]);
  const w=window.__ns.getWork(); await w.open('v2-work');
  const {useAiStore}=await import('/src/stores/ai.js'); window.__v2={w,a:useAiStore()};
  window.__v2.a.switchWork(w.work.id);
  await window.__v2.a.saveSettings({baseURL:'http://127.0.0.1:18700/v1',model:'mock-model',apiKey:'sk-mock-v2',maxContext:10000,privacy:false,options:{kb:{auto:false,usageCap:0},embeddings:{enabled:false,model:''},roles:{}}});
  return window.__v2.a.ready;
`,
)

await test(
  'serial extraction, zero-event chapter completion and payoff replay',
  `
  const {a}=window.__v2; await a.buildKnowledge(); await a.refreshKnowledge();
  return a.kb.ready===4&&a.kb.hooks.length===1&&a.kb.hooks[0].status==='paid'&&a.kb.metas.find(m=>m.chapterId==='v2-ch3')?.status==='success';
`,
)

await test(
  'historical cutoff excludes later payoff and future states',
  `
  const {knowledgeSnapshot,replayForeshadows}=await import('/src/services/ai/knowledge.js');
  const snap=await knowledgeSnapshot(window.__v2.w,'v2-ch0');
  return snap.cards.every(c=>!c.chapterId||c.chapterId==='v2-ch0')&&replayForeshadows(snap.cards)[0]?.status==='active';
`,
)

await test(
  'volume moves invalidate aggregates even when chapter order is unchanged',
  `
  const {snapshotWork}=await import('/src/services/ai/contracts.js');const {knowledgeSnapshot}=await import('/src/services/ai/knowledge.js');const work=snapshotWork(window.__v2.w);work.volumes.push({id:'moved-volume',workId:'v2-work',title:'序卷',sortOrder:-1});work.chapters.find(ch=>ch.id==='v2-ch0').volumeId='moved-volume';const snap=await knowledgeSnapshot(work);return snap.valid.size===4&&!snap.cards.some(c=>c.kind==='arc');
`,
)

await test(
  'long chapter extraction chunking covers middle paragraphs without truncation',
  `
  const {splitParagraphs}=await import('/src/services/ai/knowledge.js');const paragraphs=Array.from({length:40},(_,i)=>'第'+i+'段：'+('正文内容'+i).repeat(50));const text=paragraphs.join('\\n'),chunks=splitParagraphs(text,600);return chunks.join('').replace(/\\n/g,'')===text.replace(/\\n/g,'')&&chunks.length>10;
`,
)

await test(
  'evidence validation excludes fabricated quotations',
  `
  const {normalizeExtraction}=await import('/src/services/ai/knowledge.js'); const {w}=window.__v2;
  const cards=normalizeExtraction({events:[{summary:'伪造事件',characters:[],evidence:'从未写过的原句'}],foreshadows:[],charstates:[],lore_terms:[],new_entities:[]},w.chapters[0],w,0,[]);
  const empty=normalizeExtraction({events:[{summary:'没有依据的事件',characters:[],evidence:'',evidence_start:0}],foreshadows:[],charstates:[],lore_terms:[],new_entities:[]},w.chapters[0],w,0,[]);
  return cards.length===1&&cards[0].verified===false&&empty[0].verified===false;
`,
)

await test(
  'source edits invalidate changed facts, downstream state dependencies and arcs',
  `
  const {w}=window.__v2; w.chapters.find(c=>c.id==='v2-ch1').content+=' 新线索出现。';
  const {knowledgeSnapshot}=await import('/src/services/ai/knowledge.js'); const snap=await knowledgeSnapshot(w);
  return snap.stale.length===3&&snap.valid.has('v2-ch0')&&!snap.cards.some(c=>['v2-ch1','v2-ch2','v2-ch3'].includes(c.chapterId))&&!snap.cards.some(c=>c.kind==='arc'&&c.body.subtype==='main');
`,
)

await test(
  'update completes and unresolved entity remains a separate proposal',
  `
  const {autosave}=await import('/src/services/autosave.js');const {a,w}=window.__v2;autosave.mark('chapters',w.chapters.find(c=>c.id==='v2-ch1'));await autosave.flushAll();await a.buildKnowledge();await a.refreshKnowledge();
  return a.kb.ready===4&&a.kb.rows.some(c=>c.kind==='entity'&&c.body.name==='夜行客')&&!w.characters.some(c=>c.name==='夜行客');
`,
)

await test(
  'ambiguous aliases never auto-merge',
  `
  const {matchEntity}=await import('/src/services/ai/knowledge.js'); const {snapshotWork}=await import('/src/services/ai/contracts.js');const w=snapshotWork(window.__v2.w);w.characters.push({id:'ambiguous',name:'另一人',aliases:'小昭'});
  return matchEntity('小昭',w)===null&&matchEntity('林昭',w).refId==='v2-char';
`,
)

await test(
  'privacy denies background raw extraction',
  `
  const {a}=window.__v2;await a.saveSettings({privacy:true});await fetch('http://127.0.0.1:18700/__reset');let rejected=false;try{await a.buildKnowledge()}catch{rejected=true};const reqs=await(await fetch('http://127.0.0.1:18700/__requests')).json();await a.saveSettings({privacy:false});return rejected&&reqs.length===0;
`,
)

await test(
  'complete-message budget enforces output reservation and valid JSON pages',
  `
  const {fitMessages,paginate,messageTokens}=await import('/src/services/ai/contracts.js');const complete=fitMessages([{role:'system',content:'甲'.repeat(100)},{role:'user',content:'乙'.repeat(100)}],{budget:1200,maxTokens:800});if(complete.inputTokens+complete.maxTokens+128>1200)return false;let rejected=false;try{fitMessages([{role:'system',content:'甲'.repeat(500)},{role:'user',content:'乙'.repeat(500)}],{budget:2000,contextWindow:1200,maxTokens:800})}catch{rejected=true};const page=paginate([{s:'甲'.repeat(400)},{s:'乙'.repeat(400)}],{maxTokens:500});return rejected&&page.items.length===1&&page.truncated&&page.nextCursor===1&&JSON.parse(JSON.stringify(page)).items.length===1;
`,
)

await test(
  'lease prevents simultaneous knowledge writers',
  `
  const {leaseJob,updateJob}=await import('/src/db/ai-repo.js');const first=await leaseJob({id:'test-lease',workId:'v2-work',type:'knowledge',owner:'one'});const second=await leaseJob({id:'test-lease',workId:'v2-work',type:'knowledge',owner:'two'});await updateJob('test-lease','one',{owner:null,leaseUntil:0,status:'paused'});return !!first&&second===null;
`,
)

await test(
  'automatic budget prevents request before cap is exceeded',
  `
  const {a,w}=window.__v2;await window.__ns.db.aikbblock.where('workId').equals(w.work.id).filter(r=>r.docId==='doc:'+w.work.id+':chapter:v2-ch0').delete();await(await import('/src/db/project-repo.js')).ensureProjection(w.work.id);await fetch('http://127.0.0.1:18700/__reset');const {buildKnowledge}=await import('/src/services/ai/knowledge.js');let error='',progress;try{progress=await buildKnowledge({workId:w.work.id,opts:await a.buildOpts(),owner:'verify-budget',auto:true,usageCap:1,force:true,onlyIds:['v2-ch0']})}catch(e){error=e.message}const requests=await(await fetch('http://127.0.0.1:18700/__requests')).json();return requests.length===0&&error.includes('预算') || {requests:requests.length,error,progress,workId:w.work.id};
`,
)

await test(
  'historical tools cannot escape cutoff through arguments or source reads',
  `
  const {executeTool}=await import('/src/services/ai/tools.js');const {w}=window.__v2;const env={work:w,privacy:false,asOfChapterId:'v2-ch0'};
  const read=await executeTool('read_chapter',{chapterId:'v2-ch2'},env);const search=await executeTool('search_chapters',{query:'石门'},env);const future=await executeTool('get_foreshadows',{asOfChapterId:'v2-ch2'},env);return !!read.error&&search.items.length===0&&!!future.error;
`,
)

await test(
  'source changes and force-rebuild retain manual ignore and correction decisions',
  `
  const {a,w}=window.__v2;await a.buildKnowledge();await a.refreshKnowledge();const row=a.kb.rows.find(r=>r.kind==='event'&&r.chapterId==='v2-ch1');await a.decideKnowledge(row.decisionKey,'override',{body:{...row.body,summary:'作者核对后的事件'}});await a.decideKnowledge('entity:夜行客','ignore');
  w.setChapterContent('v2-ch1',w.chapters.find(c=>c.id==='v2-ch1').content+' 新增一句。','text');const {autosave}=await import('/src/services/autosave.js');await autosave.flushAll();await a.buildKnowledge({rebuild:true});await a.refreshKnowledge();return a.kb.rows.some(r=>r.corrected&&r.body.summary==='作者核对后的事件')&&!a.kb.rows.some(r=>r.kind==='entity'&&r.body.name==='夜行客');
`,
)

await test(
  'vector persistence and missing endpoint fall back to lexical recall',
  `
  const {a,w}=window.__v2;await a.buildKnowledge();const {rebuildVectors,kbQuery}=await import('/src/services/ai/retrieval.js');const opts=await a.buildOpts();const vec=await rebuildVectors({work:w,opts,model:'mock-embed'});const {vectors,replaceVectors}=await import('/src/db/ai-repo.js');await replaceVectors(w.work.id,(await vectors(w.work.id)).map(v=>({...v,model:'missing'})));const r=await kbQuery({work:w,query:'铜符',embeddings:{enabled:true,model:'missing'},opts});return vec.done>0&&r.cards.length>0&&r.vectorFallback;
`,
)

await test(
  'backup contains AI state, explicit vectors and excludes credentials',
  `
  const {exportBackupJson}=await import('/src/db/repo.js');const backup=JSON.parse(await exportBackupJson());return ['aisum','aikb','aikbmeta','airuns','aidecisions','aistyle','aikbvec'].every(t=>Array.isArray(backup.data[t]))&&!backup.data.appconfig.some(r=>String(r.key||'').startsWith('ai.cred'))&&backup.data.aikbvec.every(r=>Array.isArray(r.vec));
`,
)

await test(
  'deleting setup invalidates downstream payoff and historical register',
  `
  const {w}=window.__v2;const {knowledgeSnapshot,replayForeshadows}=await import('/src/services/ai/knowledge.js');w.chapters.find(c=>c.id==='v2-ch0').deletedAt=Date.now();const snap=await knowledgeSnapshot(w);return replayForeshadows(snap.cards).length===0&&!snap.cards.some(c=>c.kind==='foreshadow'&&c.body.action==='payoff');
`,
)

await test(
  'backup restore is atomic, restores vectors and accepts old backups',
  `
  const {db}=window.__ns;const {exportBackupJson,importBackupJson}=await import('/src/db/repo.js');const raw=await exportBackupJson();let invalid=false;const bad=JSON.parse(raw);bad.data.characters.push({workId:'v2-work',name:'missing primary key'});try{await importBackupJson(JSON.stringify(bad))}catch{invalid=true};if(!invalid||!await db.works.get('v2-work'))return false;
  await importBackupJson(raw);const vec=await db.aikbvec.toArray();if(!vec.length||!vec.every(v=>v.vec instanceof ArrayBuffer))return false;const old=JSON.parse(raw);for(const t of ['aisum','aikb','aikbmeta','airuns','aidecisions','aistyle','aikbvec','aipresets','aipresetstate'])delete old.data[t];await importBackupJson(JSON.stringify(old));return !!await db.works.get('v2-work')&&await db.aikb.count()===0;
`,
)

console.log(JSON.stringify({ passed: results.filter((r) => r.ok).length, total: results.length, results }, null, 2))
process.exit(results.every((r) => r.ok) ? 0 : 1)
