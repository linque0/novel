/* 只在 dev 调试 profile 上跑（数据目录须以 小说工坊-dev 结尾；正式版 profile 一律拒绝）。
   CDP 9222、Vite 5173、本地 mock 18700（可用 CDP_PORT 覆盖端口）。 */
import { connect } from './_cdp-lib.mjs'
const c = await connect('app://', process.env.CDP_PORT || '9222')
const loc = await c.evalx('window.native.getDataLocation()')
if (!String(loc?.defaultDir).endsWith('小说工坊-dev')) throw new Error('Refusing to touch non-dev profile（只允许 dev 调试 profile）')
const results = []
async function test(name, body) {
  try {
    const value = await c.evalx(`(async()=>{${body}})()`)
    if (value?.PAGE_ERR || value !== true) throw new Error(JSON.stringify(value))
    results.push({ name, ok: true }); console.log('PASS ' + name)
  } catch (e) { results.push({ name, ok: false }); console.log('FAIL ' + name + ' ' + e.message) }
}
await test('setup isolated fixture and encrypted mock credential', `
  const {db}=window.__ns;
  for(const t of ['works','volumes','chapters','characters','relations','mubu','olnodes','aikb','aikbmeta','airuns','aistyle','aidecisions','aikbvec']) {
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
  await window.__v2.a.saveSettings({baseURL:'http://127.0.0.1:18700/v1',model:'mock-model',apiKey:'sk-mock-v2',maxContext:10000,privacy:false,options:{kb:{auto:false,usageCap:0},embeddings:{enabled:false,model:''},roles:{}}});
  return window.__v2.a.ready;
`)
await test('serial extraction, zero-event chapter completion and payoff replay', `
  const {a}=window.__v2; await a.buildKnowledge(); await a.refreshKnowledge();
  return a.kb.ready===4&&a.kb.hooks.length===1&&a.kb.hooks[0].status==='paid'&&a.kb.metas.find(m=>m.chapterId==='v2-ch3')?.status==='success';
`)
await test('historical cutoff excludes later payoff and future states', `
  const {knowledgeSnapshot,replayForeshadows}=await import('/src/services/ai/knowledge.js');
  const snap=await knowledgeSnapshot(window.__v2.w,'v2-ch0');
  return snap.cards.every(c=>!c.chapterId||c.chapterId==='v2-ch0')&&replayForeshadows(snap.cards)[0]?.status==='active';
`)
await test('volume moves invalidate aggregates even when chapter order is unchanged', `
  const {snapshotWork}=await import('/src/services/ai/contracts.js');const {knowledgeSnapshot}=await import('/src/services/ai/knowledge.js');const work=snapshotWork(window.__v2.w);work.volumes.push({id:'moved-volume',workId:'v2-work',title:'序卷',sortOrder:-1});work.chapters.find(ch=>ch.id==='v2-ch0').volumeId='moved-volume';const snap=await knowledgeSnapshot(work);return snap.valid.size===4&&!snap.cards.some(c=>c.kind==='arc');
`)
await test('long chapter extraction chunking covers middle paragraphs without truncation', `
  const {splitParagraphs}=await import('/src/services/ai/knowledge.js');const paragraphs=Array.from({length:40},(_,i)=>'第'+i+'段：'+('正文内容'+i).repeat(50));const text=paragraphs.join('\\n'),chunks=splitParagraphs(text,600);return chunks.join('').replace(/\\n/g,'')===text.replace(/\\n/g,'')&&chunks.length>10;
`)
await test('evidence validation excludes fabricated quotations', `
  const {normalizeExtraction}=await import('/src/services/ai/knowledge.js'); const {w}=window.__v2;
  const cards=normalizeExtraction({events:[{summary:'伪造事件',characters:[],evidence:'从未写过的原句'}],foreshadows:[],charstates:[],lore_terms:[],new_entities:[]},w.chapters[0],w,0,[]);
  return cards.length===1&&cards[0].verified===false;
`)
await test('source edits invalidate only changed facts and dependent arcs', `
  const {w}=window.__v2; w.chapters.find(c=>c.id==='v2-ch1').content+=' 新线索出现。';
  const {knowledgeSnapshot}=await import('/src/services/ai/knowledge.js'); const snap=await knowledgeSnapshot(w);
  return snap.stale.length===1&&snap.valid.has('v2-ch0')&&!snap.cards.some(c=>c.chapterId==='v2-ch1')&&!snap.cards.some(c=>c.kind==='arc'&&c.body.subtype==='main');
`)
await test('update completes and unresolved entity remains a separate proposal', `
  const {autosave}=await import('/src/services/autosave.js');const {a,w}=window.__v2;autosave.mark('chapters',w.chapters.find(c=>c.id==='v2-ch1'));await autosave.flushAll();await a.buildKnowledge();await a.refreshKnowledge();
  return a.kb.ready===4&&a.kb.rows.some(c=>c.kind==='entity'&&c.body.name==='夜行客')&&!w.characters.some(c=>c.name==='夜行客');
`)
await test('ambiguous aliases never auto-merge', `
  const {matchEntity}=await import('/src/services/ai/knowledge.js'); const {snapshotWork}=await import('/src/services/ai/contracts.js');const w=snapshotWork(window.__v2.w);w.characters.push({id:'ambiguous',name:'另一人',aliases:'小昭'});
  return matchEntity('小昭',w)===null&&matchEntity('林昭',w).refId==='v2-char';
`)
await test('query misses preserve legacy fallback', `
  const {assembleContext}=await import('/src/services/ai/context.js'); const r=await assembleContext({task:'lore',anchorId:'v2-lore',query:'完全无关关键词',budget:8000});
  const {clearKnowledge}=await import('/src/db/ai-repo.js'); await clearKnowledge('v2-work');const fallback=await assembleContext({task:'character',anchorId:'v2-char',budget:8000});
  return !r.text.includes('未来章')&&fallback.report.some(x=>x.includes('出场片段'));
`)
await test('privacy prevents raw summary calls, search results and history forwarding', `
  const {a,w}=window.__v2;await a.saveSettings({privacy:true});await fetch('http://127.0.0.1:18700/__reset');
  a.chat=[{workId:'v2-work',role:'user',content:'OLD_RAW_SECRET'}]; const r=await a.startPlotBranch('v2-ch2'); await a.send('工具测试：林昭');
  const reqs=await (await fetch('http://127.0.0.1:18700/__requests')).json();const payload=JSON.stringify(reqs);
  return !!r&&reqs.length>=3&&!payload.includes('林昭埋下铜符')&&!payload.includes('林昭用铜符打开石门')&&!payload.includes('OLD_RAW_SECRET')&&!reqs.some(r=>r.body.messages[0].content.includes('摘要员'));
`)
await test('private tools and context exclude raw archive snippets and knowledge quotations', `
  const {w}=window.__v2;const {snapshotWork}=await import('/src/services/ai/contracts.js');const copy=snapshotWork(w);copy.characters[0].content='BIO_VERBATIM_SECRET_142';copy.mubu[0].text='铜符\\nLORE_VERBATIM_SECRET_142';const {executeTool}=await import('/src/services/ai/tools.js');const {assembleContext}=await import('/src/services/ai/context.js');
  const character=await executeTool('get_character',{characterId:'v2-char'},{work:copy,privacy:true});const lore=await executeTool('get_lore_subtree',{nodeId:'v2-lore'},{work:copy,privacy:true});const ctx=await assembleContext({task:'character',anchorId:'v2-char',workSnapshot:copy,privacy:true,budget:8000});return !JSON.stringify([character,lore,ctx.text]).includes('VERBATIM_SECRET');
`)
await test('privacy denies background raw extraction', `
  const {a}=window.__v2;await fetch('http://127.0.0.1:18700/__reset');let rejected=false;try{await a.buildKnowledge()}catch{rejected=true};const reqs=await(await fetch('http://127.0.0.1:18700/__requests')).json();await a.saveSettings({privacy:false});return rejected&&reqs.length===0;
`)
await test('complete-message budget enforces output reservation and valid JSON pages', `
  const {fitMessages,paginate,messageTokens}=await import('/src/services/ai/contracts.js');const complete=fitMessages([{role:'system',content:'甲'.repeat(100)},{role:'user',content:'乙'.repeat(100)}],{budget:1200,maxTokens:800});if(complete.inputTokens+complete.maxTokens+128>1200)return false;let rejected=false;try{fitMessages([{role:'system',content:'甲'.repeat(500)},{role:'user',content:'乙'.repeat(500)}],{budget:2000,contextWindow:1200,maxTokens:800})}catch{rejected=true};const page=paginate([{s:'甲'.repeat(400)},{s:'乙'.repeat(400)}],{maxTokens:500});return rejected&&page.items.length===1&&page.truncated&&page.nextCursor===1&&JSON.parse(JSON.stringify(page)).items.length===1;
`)
await test('plot/outline/lore/character v2 all operate without knowledge', `
  const {a}=window.__v2;const tasks=[['plot','v2-ch2'],['outline','v2-ol'],['lore','v2-lore'],['character','v2-char']];
  for(const [task,id] of tasks){const r=await a.runTask(task,id);if(!r||r.degraded||!r.cards.length)return {task,error:a.error,result:r}}
  return true;
`)
await test('outline target stays at generation anchor and blank edges stay disconnected', `
  const {a,w}=window.__v2; const r=await a.startOutlinePlan('v2-ol');w.selOlnodeId='v2-other';const card=r.cards[0];card.nodes[1].edge='';const undo=w.olUndo.length;
  await w.applyAiProposal(card);const children=w.olnodeChildren('v2-ol');return children.length===3&&!w.olnodeChildren('v2-other').length&&children[0].rels.length===0&&w.olUndo.length===undo+1;
`)
await test('application audit prevents duplicate application and supports undo', `
  const {a,w}=window.__v2;const card=a.result.cards[0];let refused=false;try{await w.applyAiProposal(card)}catch{refused=true};await w.undoAiApplication(card.auditId);return refused&&w.olnodeChildren('v2-ol').length===0;
`)
await test('save failure rolls back this batch and does not mark it applied', `
  const {w,a}=window.__v2,db=window.__ns.db;const r=await a.startOutlinePlan('v2-other');const card=r.cards[0],before=w.olnodeChildren('v2-other').length;let failed=false,once=true;const hook=()=>{if(once){once=false;throw new Error('injected write failure')}};db.olnodes.hook('creating',hook);
  try{await w.applyAiProposal(card)}catch{failed=true}finally{db.olnodes.hook('creating').unsubscribe(hook)}
  return failed&&w.olnodeChildren('v2-other').length===before&&!(await db.airuns.toArray()).some(row=>row.type==='application'&&row.cardId===card.id);
`)
await test('partial character application never creates unknown relation targets', `
  const {a,w}=window.__v2;const r=await a.startCharacterEnrich('v2-char');const before=w.characters.length;const card=r.cards[0];await w.applyAiProposal(card,{selected:{fields:['师承'],bio:false,aliases:[],relations:[]}});return w.characters.length===before&&w.characters.find(c=>c.id==='v2-char').fields.师承==='雾都星匠遗脉'&&!w.characters.find(c=>c.id==='v2-char').content;
`)
await test('source revision change blocks stale proposals', `
  const {a,w}=window.__v2;const r=await a.startLoreExpand('v2-lore');w.mubu.find(n=>n.id==='v2-lore').text='铜符改版';let refused=false;try{await w.applyAiProposal(r.cards[0])}catch{refused=true};return refused;
`)
await test('cancellation after late provider response cannot replace newer state', `
  const {a}=window.__v2;const real=window.fetch;let release;window.fetch=async (url,init)=>{if(String(url).includes('/chat/completions'))return await new Promise(resolve=>{release=()=>resolve(new Response(JSON.stringify({choices:[{message:{content:'{"answer":"late"}'},finish_reason:'stop'}]}),{headers:{'content-type':'application/json'}}))});return real(url,init)};
  const pending=a.send('取消竞态');while(!release)await new Promise(r=>setTimeout(r,10));a.cancel();a.chatBusy=true;release();await pending;const safe=a.chatBusy===true&&!a.chat.some(m=>m.content==='late');window.fetch=real;a.chatBusy=false;return safe;
`)
await test('switching books isolates history and results', `
  const {a}=window.__v2;a.chat.push({workId:'v2-work',role:'user',content:'本书独有记忆'});a.switchWork('another');const isolated=a.chat.length===0&&a.result===null;a.switchWork('v2-work');return isolated&&a.chat.some(m=>m.content==='本书独有记忆');
`)
await test('lease prevents simultaneous knowledge writers', `
  const {leaseJob,updateJob}=await import('/src/db/ai-repo.js');const first=await leaseJob({id:'test-lease',workId:'v2-work',type:'knowledge',owner:'one'});const second=await leaseJob({id:'test-lease',workId:'v2-work',type:'knowledge',owner:'two'});await updateJob('test-lease','one',{owner:null,leaseUntil:0,status:'paused'});return !!first&&second===null;
`)
await test('automatic budget prevents request before cap is exceeded', `
  const {a}=window.__v2;await a.saveSettings({options:{...a.options,kb:{auto:true,usageCap:1}}});await fetch('http://127.0.0.1:18700/__reset');await a.buildKnowledge({auto:true,onlyIds:['v2-ch0']});const requests=await(await fetch('http://127.0.0.1:18700/__requests')).json();await a.saveSettings({options:{...a.options,kb:{auto:false,usageCap:0}}});return requests.length===0&&a.kb.error.includes('预算');
`)
await test('style keeps author/external sources and needs explicit confirmation', `
  const {a}=window.__v2;const p=await a.addStyle({name:'验证文风',samples:[{source:'author',text:'林昭静静望着灯火。',label:'作者选段'},{source:'external',text:'夜色沉沉。风停了。',label:'外部范文'}],dimensions:'句段节奏'});await a.analyzeStyle(p.id,true);const learned=a.styles.find(x=>x.id===p.id);if(learned.status!=='review'||learned.samples[0].source!=='author'||learned.samples[1].source!=='external')return false;await a.confirmStyle(learned);return a.styles.find(x=>x.id===p.id).status==='confirmed';
`)
await test('chapter and book review produce evidence-backed suspected issues only', `
  const {a}=window.__v2;const r=await a.runTask('consistency','v2-ch0','',{scope:'book'});return !!r&&r.cards.length===4&&r.cards.every(x=>['suspected','insufficient'].includes(x.verdict))&&r.status==='completed';
`)
await test('review pause/resume has checkpoints and no duplicate issues', `
  const {runProfessional}=await import('/src/services/ai/professional.js');const {a}=window.__v2;let pause=false;const opts=await a.buildOpts();const first=await runProfessional({task:'consistency',workId:'v2-work',anchorId:'v2-ch0',scope:'book',opts,shouldPause:()=>pause,onProgress:()=>{pause=true}});const second=await runProfessional({task:'consistency',workId:'v2-work',anchorId:'v2-ch0',scope:'book',opts,resume:true});return first.status==='paused'&&first.cards.length===1&&second.cards.length===4;
`)
await test('professional review restores saved scope and cards after state reset', `
  const {runProfessional}=await import('/src/services/ai/professional.js');const {a}=window.__v2;const opts=await a.buildOpts();let pause=false;await runProfessional({task:'consistency',workId:'v2-work',anchorId:'v2-ch0',scope:'book',opts,shouldPause:()=>pause,onProgress:()=>{pause=true}});a.result=null;a.phase='idle';await a.refreshKnowledge();if(a.result?.status!=='paused'||a.reviewRequest?.scope!=='book'||a.result.cards.length!==1)return false;const r=await a.runTask('consistency','v2-ch0','',{...a.reviewRequest,resume:true});return r?.cards.length===4&&r.status==='completed';
`)
await test('rewrite yields original-bound patches and rejects overlapping edits', `
  const {a,w}=window.__v2;const r=await a.runTask('rewrite','v2-ch0','',{level:'light'});const {validatePatches}=await import('/src/services/ai/professional.js');let overlap=false;try{validatePatches({patches:[r.cards[0],r.cards[0]]},w.chapters.find(c=>c.id==='v2-ch0'))}catch{overlap=true};return !!r&&r.cards.length===1&&r.cards[0].original==='林昭埋下铜符。暗门尚未开启。'&&overlap;
`)
await test('manual workflow has bounded retrieval/generation/verification stages', `
  const {a}=window.__v2;await a.startWorkflow('review','v2-ch0');return a.workflow.length===3&&a.workflow.every(s=>s.status==='completed')&&a.result.cards.every(c=>c.status==='pending');
`)
await test('workflow checkpoints persist and final review can resume without regenerating', `
  const {a}=window.__v2;const {jobById}=await import('/src/db/ai-repo.js');const job=await jobById('workflow:v2-work');if(job?.steps?.length!==3)return false;
  await fetch('http://127.0.0.1:18700/__reset');await a.startWorkflow('review','v2-ch0',{fromPhase:2});const requests=await(await fetch('http://127.0.0.1:18700/__requests')).json();return requests.length===1&&requests[0].body.messages[0].content.includes('结果复核');
`)
await test('historical tools cannot escape cutoff through arguments or source reads', `
  const {executeTool}=await import('/src/services/ai/tools.js');const {w}=window.__v2;const env={work:w,privacy:false,asOfChapterId:'v2-ch0'};
  const read=await executeTool('read_chapter',{chapterId:'v2-ch2'},env);const search=await executeTool('search_chapters',{query:'石门'},env);const future=await executeTool('get_foreshadows',{asOfChapterId:'v2-ch2'},env);return !!read.error&&search.items.length===0&&!!future.error;
`)
await test('source changes and force-rebuild retain manual ignore and correction decisions', `
  const {a,w}=window.__v2;await a.buildKnowledge();await a.refreshKnowledge();const row=a.kb.rows.find(r=>r.kind==='event'&&r.chapterId==='v2-ch1');await a.decideKnowledge(row.decisionKey,'override',{body:{...row.body,summary:'作者核对后的事件'}});await a.decideKnowledge('entity:夜行客','ignore');
  w.setChapterContent('v2-ch1',w.chapters.find(c=>c.id==='v2-ch1').content+' 新增一句。','text');const {autosave}=await import('/src/services/autosave.js');await autosave.flushAll();await a.buildKnowledge({rebuild:true});await a.refreshKnowledge();return a.kb.rows.some(r=>r.corrected&&r.body.summary==='作者核对后的事件')&&!a.kb.rows.some(r=>r.kind==='entity'&&r.body.name==='夜行客');
`)
await test('rich-text patches preserve unaffected marks, apply individually and undo safely', `
  const {a,w}=window.__v2;w.tab='chapters';w.selChapterId='v2-ch2';
  for(let i=0;i<100&&(!window.__ns.editor||window.__ns.editor.isDestroyed);i++)await new Promise(r=>setTimeout(r,30));await new Promise(r=>setTimeout(r,300));const ed=window.__ns.editor;if(!ed)return false;
  ed.commands.setContent('<p><strong>保留加粗</strong>，待修改甲。</p><p>待修改乙。</p><p><span data-dl-target="character:v2-char" data-dl-title="林昭">林昭</span>与<span data-note-id="v2-note" data-note-color="#e8b547">批注文字</span>。</p>',true);
  const {autosave}=await import('/src/services/autosave.js');await autosave.flushAll();const {chapterHash}=await import('/src/services/ai/contracts.js');const ch=w.chapters.find(c=>c.id==='v2-ch2');const make=(id,original,replacement)=>({id,task:'rewrite',kind:'rewrite',workId:w.work.id,anchorId:ch.id,sourceHash:chapterHash(ch),original,replacement,status:'pending'});
  const cards=[make('edit-a','待修改甲。','润色甲。'),make('edit-b','待修改乙。','润色乙。')];a.result={task:'rewrite',cards};await w.applyAiProposal(cards[0]);await w.applyAiProposal(cards[1]);
  let html=ed.getHTML();if(!html.includes('<strong>保留加粗</strong>')||!html.includes('data-dl-target')||!html.includes('data-note-id')||!html.includes('润色甲。')||!html.includes('润色乙。'))return {html};
  await w.undoAiApplication(cards[1].auditId);html=ed.getHTML();return html.includes('待修改乙。')&&html.includes('润色甲。')&&html.includes('data-note-id')&&(await window.__ns.db.revisions.toArray()).some(r=>r.entityId===ch.id);
`)
await test('doublelink and annotation patches are blocked before mutation', `
  const {a,w}=window.__v2;const ch=w.chapters.find(c=>c.id==='v2-ch2');const {chapterHash}=await import('/src/services/ai/contracts.js');const {locateEditorPatch}=await import('/src/services/ai/application.js');const ed=window.__ns.editor, original=ed.getHTML();let blocked=0;
  for(const quote of ['林昭','批注文字']){const card={id:'protected-'+quote,task:'rewrite',kind:'rewrite',workId:w.work.id,anchorId:ch.id,sourceHash:chapterHash(ch),original:quote,replacement:'改动'};if(!locateEditorPatch(ed,quote).protectedMark)return false;try{await w.applyAiProposal(card)}catch{blocked++}}
  return blocked===2&&ed.getHTML()===original;
`)
await test('vector persistence and missing endpoint fall back to lexical recall', `
  const {a,w}=window.__v2;await a.buildKnowledge();const {rebuildVectors,kbQuery}=await import('/src/services/ai/retrieval.js');const opts=await a.buildOpts();const vec=await rebuildVectors({work:w,opts,model:'mock-embed'});const {vectors,replaceVectors}=await import('/src/db/ai-repo.js');await replaceVectors(w.work.id,(await vectors(w.work.id)).map(v=>({...v,model:'missing'})));const r=await kbQuery({work:w,query:'铜符',embeddings:{enabled:true,model:'missing'},opts});return vec.done>0&&r.cards.length>0&&r.vectorFallback;
`)
await test('backup contains AI state, explicit vectors and excludes credentials', `
  const {exportBackupJson}=await import('/src/db/repo.js');const backup=JSON.parse(await exportBackupJson());return ['aisum','aikb','aikbmeta','airuns','aidecisions','aistyle','aikbvec'].every(t=>Array.isArray(backup.data[t]))&&!backup.data.appconfig.some(r=>r.key==='ai.credential')&&backup.data.aikbvec.every(r=>Array.isArray(r.vec));
`)
await test('deleting setup invalidates downstream payoff and historical register', `
  const {w}=window.__v2;const {knowledgeSnapshot,replayForeshadows}=await import('/src/services/ai/knowledge.js');w.chapters.find(c=>c.id==='v2-ch0').deletedAt=Date.now();const snap=await knowledgeSnapshot(w);return replayForeshadows(snap.cards).length===0&&!snap.cards.some(c=>c.kind==='foreshadow'&&c.body.action==='payoff');
`)
await test('backup restore is atomic, restores vectors and accepts old backups', `
  const {db}=window.__ns;const {exportBackupJson,importBackupJson}=await import('/src/db/repo.js');const raw=await exportBackupJson();let invalid=false;const bad=JSON.parse(raw);bad.data.characters.push({workId:'v2-work',name:'missing primary key'});try{await importBackupJson(JSON.stringify(bad))}catch{invalid=true};if(!invalid||!await db.works.get('v2-work'))return false;
  await importBackupJson(raw);const vec=await db.aikbvec.toArray();if(!vec.length||!vec.every(v=>v.vec instanceof ArrayBuffer))return false;const old=JSON.parse(raw);for(const t of ['aisum','aikb','aikbmeta','airuns','aidecisions','aistyle','aikbvec'])delete old.data[t];await importBackupJson(JSON.stringify(old));return !!await db.works.get('v2-work')&&await db.aikb.count()===0;
`)
console.log(JSON.stringify({ passed: results.filter(r=>r.ok).length, failed: results.filter(r=>!r.ok).map(r=>r.name) }))
process.exit(results.every(r=>r.ok) ? 0 : 1)
