import {connect} from './_cdp-lib.mjs'
import {assertAiTestProfile} from './_ai-test-profile.mjs'
import {buildSeedExpr} from './verify-seeds.mjs'
const c=await connect('app://',process.env.CDP_PORT||'9235')
assertAiTestProfile(await c.evalx('window.native.getDataLocation()'))
for (let i=0;i<40&&!(await c.evalx('!!window.__ns'));i++)await c.sleep(200)
await c.sleep(1500)
const seed=await c.evalx(buildSeedExpr('书内知识验证书',{reset:true}))
if(!seed?.ok)throw new Error(JSON.stringify(seed))
await c.evalx(`window.__bookFixture=${JSON.stringify(seed.books[0])}`)
const results=[]
async function test(name,body){const value=await c.evalx(`(async()=>{const f=window.__bookFixture,db=window.__ns.db;${body}})()`);results.push({name,ok:value===true});console.log((value===true?'PASS ':'FAIL ')+name+(value===true?'':' '+JSON.stringify(value)))}
await test('source snapshot includes entry associations and publishes complete generation',`
 const r=await import('/src/db/project-repo.js');window.__bookRepo=r;window.__bookSource=await r.readSourceSnapshot(f.workId);const p=await r.ensureProjection(f.workId);window.__bookProjection=p;
 return Array.isArray(window.__bookSource.lorelinks)&&['chapter','mubu','olnode','character','relation','snippet','annotation','asset'].every(t=>p.index.counts[t]>0)&&p.index.issues.some(i=>i.type==='unparsed-asset');
`)
await test('read model incremental reuse and ancestor rename',`
 const {ensureProjection}=window.__bookRepo;const old=window.__bookProjection,chapter=old.docs.find(d=>d.sourceId===f.c1);await db.mubu.update(f.loreId,{text:'世界规则'});const p=await ensureProjection(f.workId);window.__bookProjection=p;
 return p.index.generation===old.index.generation&&p.docs.find(d=>d.sourceId===f.c1).textHash===chapter.textHash&&p.docs.find(d=>d.sourceId===f.c1).updatedAt>=chapter.updatedAt&&p.docs.find(d=>d.sourceId===f.childId).headingPath.includes('世界规则');
`)
await test('full source snapshot adds inspirations and comments',`
 const {snapshotWork}=await import('/src/services/ai/contracts.js');const source=await window.__bookRepo.readSourceSnapshot(f.workId),s=snapshotWork(source);return s.snippets.length===1&&s.annotations.length===1&&s.assets.length===1;
`)
await test('cross-source Chinese query finds inspiration and preserves nature',`
 const {readBook,queryBook}=await import('/src/services/ai/booksource.js'),source=await window.__bookRepo.readSourceSnapshot(f.workId),s=await readBook(source);window.__bookSession=s;const result=queryBook(s,{query:'铜符天宫',limitTokens:4000});return result.items.some(i=>i.sourceType==='snippet'&&i.semanticClass==='inspiration')&&result.items.some(i=>i.sourceType==='chapter');
`)
await test('continuous document pages cover every character including middle',`
 const {readBook,readDocument}=await import('/src/services/ai/booksource.js'),source=await window.__bookRepo.readSourceSnapshot(f.workId),chapter=source.chapters.find(c=>c.id===f.c1);chapter.fmt='text';chapter.content='开场。'+'长段落😀。'.repeat(140)+'中间关键证据。'+'后续段落。'.repeat(130)+'尾声。';const s=await readBook(source),doc=s.docs.find(d=>d.sourceId===f.c1);let cursor=0,output='';do{const page=readDocument(s,{docId:doc.id,cursor,limitTokens:50});output+=page.text;cursor=page.nextCursor}while(cursor!==null);return output===doc.plainText&&output.includes('中间关键证据');
`)
await test('historical tools cannot read later chapter or current future biography',`
 const {executeTool}=await import('/src/services/ai/tools.js'),work=await window.__bookRepo.readSourceSnapshot(f.workId),env={work,asOfChapterId:f.c1,privacy:false};const future=await executeTool('read_document',{docId:'doc:'+f.workId+':chapter:'+f.c2},env);const bio=await executeTool('read_document',{docId:'doc:'+f.workId+':character:'+f.characterId},env);const expanded=await executeTool('search_kb',{query:'秘密',asOfChapterId:f.c2},env);return !!future.error&&bio.withheld&&!JSON.stringify(bio).includes('云宗之主')&&!!expanded.error;
`)
await test('privacy filters raw text from all new tools and relations',`
 const {executeTool}=await import('/src/services/ai/tools.js'),work=await window.__bookRepo.readSourceSnapshot(f.workId),env={work,privacy:true};for(const [name,args] of [['search_book',{query:'铜符'}],['read_document',{docId:'doc:'+f.workId+':snippet:'+f.snippetId}],['get_related_entities',{entityId:'character:'+f.characterId}],['get_book_coverage',{}]]){const r=await executeTool(name,args,env);if(/林昭埋下铜符|可能开启天宫|未来云宗之主/.test(JSON.stringify(r)))return r;}return true;
`)
await test('source records build locally with semantic distinction and preserve decisions',`
 const {buildBookMemory}=await import('/src/services/ai/book-memory.js');await db.aidecisions.put({id:'keep:'+f.workId,workId:f.workId,key:'author-rule',action:'lock'});await buildBookMemory(f.workId);const rows=await db.aikb.where('workId').equals(f.workId).toArray(),meta=await db.aikbmeta.where('workId').equals(f.workId).toArray();return rows.some(r=>r.kind==='inspiration'&&r.semanticClass==='inspiration')&&rows.some(r=>r.kind==='planBeat'&&r.semanticClass==='plan')&&meta.some(m=>m.mode==='source-records'&&!m.extracted);
`)
await test('required rules and outline stay protected through disabled preset slots',`
 const {readBook}=await import('/src/services/ai/booksource.js'),{constraintPack}=await import('/src/services/ai/constraints.js'),{defaultPreset,compilePreset}=await import('/src/services/ai/presets.js');const source=await window.__bookRepo.readSourceSnapshot(f.workId),s=await readBook(source),p=constraintPack(s,{chapterId:f.c1,budget:3000}),row=defaultPreset();for(const o of row.payload.prompt_order?.[0]?.order||[])o.enabled=false;const r=compilePreset({row,slots:{requiredContext:p.text},question:'写正文',opts:{inputBudget:10000,maxTokens:1000}});return r.blocks.some(b=>b.blockId==='bookConstraints'&&b.protected)&&r.messages.some(m=>m.content.includes('云宗禁止复活'));
`)
await test('full-text summary feeds middle blocks and rejects late stale results',`
 const {getChapterSummary}=await import('/src/services/ai/summarize.js');const original=await db.chapters.get(f.c1),chapter={...original,fmt:'text',content:'开头。'+'前段内容。'.repeat(900)+'中段唯一关键证据。'+'后段内容。'.repeat(900)};await db.chapters.put(chapter);const seen=[];const provider=async ({user})=>{seen.push(user);return user.includes('中段唯一关键证据')?'发现中段唯一关键证据。':'保持全文情节。'};const summary=await getChapterSummary(chapter,provider);let rejected=false;const newer={...chapter,content:'另一个版本'};await db.chapters.put(newer);try{await getChapterSummary(newer,async()=>{await db.chapters.update(f.c1,{content:'再次编辑'});return '旧摘要'})}catch(e){rejected=e.code==='source-changed'}await db.chapters.put(original);return seen.some(t=>t.includes('中段唯一关键证据'))&&!!summary&&rejected;
`)
await test('exact evidence rejects ambiguous or wrong offsets and covers chunk overlap',`
 const {resolveEvidence}=await import('/src/services/ai/contracts.js'),{readBook,queryBook}=await import('/src/services/ai/booksource.js');const work=await window.__bookRepo.readSourceSnapshot(f.workId);work.chapters.find(c=>c.id===f.c1).content='相同证据。相同证据。';work.chapters.find(c=>c.id===f.c1).fmt='text';if(resolveEvidence({sourceType:'chapter',sourceId:f.c1,quote:'相同证据'},work)||resolveEvidence({sourceType:'chapter',sourceId:f.c1,quote:'相同证据',start:2},work)||!resolveEvidence({sourceType:'chapter',sourceId:f.c1,quote:'相同证据',start:5},work))return false;const s=await readBook(work),r=queryBook(s,{query:'云宗',limitTokens:4000});return !!resolveEvidence({sourceType:'work',sourceId:f.workId,quote:work.work.title},work)&&r.items.every(i=>s.docs.find(d=>d.id===i.docId).plainText.slice(i.citation.start,i.citation.end)===i.text);
`)
await test('evidence states are protected and an insufficient required budget rejects',`
 const {readBook}=await import('/src/services/ai/booksource.js'),{constraintPack}=await import('/src/services/ai/constraints.js');const s=await readBook(await window.__bookRepo.readSourceSnapshot(f.workId)),states=[{entityId:'character:'+f.characterId,name:'林昭',states:{伤势:{value:'右臂受伤'}},sourceVersions:[{table:'chapters',id:f.c1,hash:'test'}]}];const p=constraintPack(s,{chapterId:f.c1,states,budget:3000});let rejected=false;try{constraintPack(s,{chapterId:f.c1,states,budget:10})}catch{rejected=true}return rejected&&p.text.includes('右臂受伤')&&p.sourceVersions.some(v=>v.id===f.c1);
`)
await test('attachment-only writes mark the owning book dirty after commit',`
 const p=await window.__bookRepo.ensureProjection(f.workId);const asset=await db.assets.where('workId').equals(f.workId).first();await db.links.put({id:'booksource-link-test',entityType:'chapter',entityId:f.c1,assetId:asset.id});await new Promise(r=>setTimeout(r,100));const dirty=await db.aiindex.get(f.workId);const next=await window.__bookRepo.ensureProjection(f.workId);await db.links.delete('booksource-link-test');return dirty.status==='dirty'&&next.index.sourceRevision!==p.index.sourceRevision&&next.edges.some(e=>e.kind==='attachment');
`)
await test('direct delete removes source projection and source memories',`
 await db.snippets.delete(f.snippetId);const p=await window.__bookRepo.ensureProjection(f.workId);const {buildBookMemory}=await import('/src/services/ai/book-memory.js');await buildBookMemory(f.workId);const cards=await db.aikb.where('workId').equals(f.workId).toArray();return !p.docs.some(d=>d.sourceId===f.snippetId)&&!cards.some(r=>r.refId===f.snippetId);
`)
await test('restore epoch prevents unpublished staged projection from being committed',`
 const {suspendProjection,resumeProjection,ensureProjection}=window.__bookRepo;await db.mubu.update(f.childId,{text:'云宗不得复活。'});const task=ensureProjection(f.workId,{force:true});suspendProjection();let rejected=false;try{await task}catch(e){rejected=e.code==='source-changed'}finally{resumeProjection()}const p=await ensureProjection(f.workId);return rejected&&p.index.status==='ready';
`)
await test('clear paid knowledge preserves author decisions and read model',`
 const {clearKnowledge}=await import('/src/db/ai-repo.js');await clearKnowledge(f.workId);return !!await db.aidecisions.get('keep:'+f.workId)&&!!await db.aiindex.get(f.workId)&&(await db.aikb.where('workId').equals(f.workId).count())===0;
`)
await test('persisted book changes reject proposals even when the live store is older',`
 const {snapshotWork,chapterHash}=await import('/src/services/ai/contracts.js'),{freezeContext}=await import('/src/services/ai/novel-context.js'),{applyProposal}=await import('/src/services/ai/application.js');const work=snapshotWork(await window.__bookRepo.readSourceSnapshot(f.workId));work.selectedChapterId=f.c1;work.olUndo=[];work.olRedo=[];const frozen=freezeContext(work),card={id:'booksource-stale-proposal',task:'plot',kind:'draft',workId:f.workId,anchorId:f.c1,sourceHash:chapterHash(work.chapters.find(c=>c.id===f.c1)),source:frozen,complete:true,text:'待保存草稿',status:'pending'};await db.mubu.update(f.childId,{text:'云宗规则再次更新。'});let rejected=false;try{await applyProposal(work,card,{action:'newchapter',title:'新章'})}catch(e){rejected=/数据库中的作品资料已变化/.test(e.message)}return rejected;
`)
await test('backup keeps attachment transcripts and rebuilds projections after restore',`
 const {exportBackupJson,importBackupJson}=await import('/src/db/repo.js'),asset=await db.assets.where('workId').equals(f.workId).first();await db.assets.update(asset.id,{transcript:'地图说明与地点位置',parserVersion:2});const raw=await exportBackupJson(),dump=JSON.parse(raw);if(dump.assets.find(a=>a.id===asset.id)?.transcript!=='地图说明与地点位置'||'aidoc' in dump.data||'aikbblock' in dump.data)return false;await importBackupJson(raw);const restored=await db.assets.get(asset.id),p=await window.__bookRepo.ensureProjection(f.workId);return restored.parserVersion===2&&p.docs.some(d=>d.sourceId===asset.id&&d.plainText==='地图说明与地点位置')&&!p.index.issues.some(i=>i.type==='unparsed-asset'&&i.sourceId===asset.id);
`)
console.log(JSON.stringify({passed:results.filter(r=>r.ok).length,total:results.length}))
process.exit(results.every(r=>r.ok)?0:1)
