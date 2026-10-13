import { assertAiTestProfile } from './_ai-test-profile.mjs'
/* 只在 dev 调试 profile 上跑（数据目录须以 小说工坊-dev 结尾；正式版 profile 一律拒绝）。
   用本地 mock 18700 + CDP 9222（可用 CDP_PORT 覆盖）。 */
import { connect } from './_cdp-lib.mjs'
const c = await connect('app://', process.env.CDP_PORT || '9222'),
  loc = await c.evalx('window.native.getDataLocation()')
assertAiTestProfile(loc)
for (let i = 0; i < 40 && !(await c.evalx('!!window.__ns')); i++) await c.sleep(200)
await c.sleep(1500) // Allow development hot reload to settle before mutating fixtures.
const results = []
async function test(name, body) {
  try {
    const r = await c.evalx(`(async()=>{${body}})()`)
    if (r !== true) throw new Error(JSON.stringify(r))
    results.push({ name, ok: true })
    console.log('PASS ' + name)
  } catch (e) {
    results.push({ name, ok: false })
    console.log('FAIL ' + name + ' ' + e.message)
  }
}
await test(
  'isolated setup and v11 schema',
  `
 const {db}=window.__ns;for(const t of ['works','volumes','chapters','outlines','characters','relations','mubu','olnodes','aikb','aikbmeta','airuns','aidecisions']){const rows=await db.table(t).toArray();await db.table(t).bulkDelete(rows.filter(r=>r.workId==='preset-work'||r.id==='preset-work').map(r=>r.id))}
 await db.works.put({id:'preset-work',title:'预设验证作品',genre:'玄幻',deletedAt:null});await db.volumes.put({id:'p-vol',workId:'preset-work',title:'第一卷',sortOrder:0,deletedAt:null});
 await db.chapters.bulkPut([{id:'p-ch0',workId:'preset-work',volumeId:'p-vol',title:'第一章',content:'林昭握住铜符。原文秘密标记PRIVATE_RAW。',fmt:'text',sortOrder:0,deletedAt:null},{id:'p-ch1',workId:'preset-work',volumeId:'p-vol',title:'第二章',content:'后文秘密FUTURE_FACT，铜符已经回收。',fmt:'text',sortOrder:1,deletedAt:null}]);
 await db.characters.put({id:'p-char',workId:'preset-work',name:'林昭',fields:{身份:'旅人'},deletedAt:null});await db.olnodes.put({id:'p-ol',workId:'preset-work',title:'主线',text:'计划PLAN_NOT_FACT',sortOrder:0,deletedAt:null,rels:[]});await db.mubu.put({id:'p-lore',workId:'preset-work',text:'铜符',sortOrder:0,deletedAt:null});
 const w=window.__ns.getWork();await w.open('preset-work');w.tab='chapters';w.selChapterId='p-ch0';const {useAiStore}=await import('/src/stores/ai.js');const a=useAiStore();a.switchWork(w.work.id);await a.saveSettings({baseURL:'http://127.0.0.1:18700/v1',model:'preset-native',apiKey:'sk-local-test',privacy:false,maxContext:10000});await a.loadPresets();const {defaultPreset}=await import('/src/services/ai/presets.js');const toolsPreset=defaultPreset();toolsPreset.id='novel-default';toolsPreset.revision=(await db.aipresets.get(toolsPreset.id))?.revision || 0;toolsPreset.payload.function_calling=true;await a.savePreset(toolsPreset);await a.selectPreset('novel-default');window.__preset={a,w,db};await new Promise(r=>setTimeout(r,500));return db.verno===11 && a.ready && !!window.__ns.editor;
`,
)
await test(
  'free dialogue, native tool draft and immutable chapter anchor',
  `
 const {a,w}=window.__preset;await a.clearChat();await fetch('http://127.0.0.1:18700/__reset');const pending=a.send('生成草稿',{contextRefs:{chapterId:'p-ch0',outlineId:'p-ol'}});w.selChapterId='p-ch1';await pending;const m=a.chat.at(-1),req=await(await fetch('http://127.0.0.1:18700/__requests')).json();window.__preset.draft=m.cards[0];return m.complete && m.cards[0]?.anchorId==='p-ch0' && req.length===2 && req.every(r=>!JSON.stringify(r.body.messages).includes('FUTURE_FACT')) && req[0].body.temperature===.7 && !('runTask' in a);
`,
)
await test(
  'append via editor transaction, persistence, snapshot and undo',
  `
 const {a,w,db,draft}=window.__preset;w.selChapterId='p-ch0';await new Promise(r=>setTimeout(r,350));await w.applyAiProposal(draft,{action:'append'});const ch=await db.chapters.get('p-ch0'),audit=await db.airuns.get(draft.auditId);if(!ch.content.includes('雾气漫入') || !audit.changes.length || !(await db.revisions.where('[entityType+entityId]').equals(['chapter','p-ch0']).count()))return false;await w.undoAiApplication(draft.auditId);return (await db.chapters.get('p-ch0')).content==='林昭握住铜符。原文秘密标记PRIVATE_RAW。';
`,
)
await test(
  'replace selected text preserves surrounding formatting and undo',
  `
 const {a,w,db}=window.__preset;w.selChapterId='p-ch0';const ed=window.__ns.editor;ed.commands.setContent('<p><strong>林昭</strong>握住铜符。原文秘密标记PRIVATE_RAW。</p>');await new Promise(r=>setTimeout(r,500));await window.__flushNow();await a.send('生成草稿',{contextRefs:{chapterId:'p-ch0',selection:'握住铜符'}});const d=a.chat.at(-1).cards[0];d.text='放下铜符';await w.applyAiProposal(d,{action:'replace'});if(!ed.getHTML().includes('<strong>林昭</strong>') || !ed.getText().includes('放下铜符'))return false;await w.undoAiApplication(d.auditId);return ed.getText().includes('握住铜符');
`,
)
await test(
  'new chapter position and undo includes chapter outline',
  `
 const {a,w,db}=window.__preset;await a.send('生成草稿',{contextRefs:{chapterId:'p-ch0'}});const d=a.chat.at(-1).cards[0];await w.applyAiProposal(d,{action:'newchapter',title:'雾中来客',volumeId:'p-vol',afterId:'p-ch0'});const ch=w.activeChapter,auditId=d.auditId;if(ch.title!=='雾中来客' || ch.sortOrder<=0 || ch.sortOrder>=1 || !(await db.outlines.where('refId').equals(ch.id).count()))return false;await w.undoAiApplication(auditId);return !!(await db.chapters.get(ch.id)).deletedAt && (await db.outlines.where('refId').equals(ch.id).first()).deletedAt>0;
`,
)
await test(
  'version conflicts and duplicate application block',
  `
 const {a,w}=window.__preset;w.selChapterId='p-ch0';await new Promise(r=>setTimeout(r,250));await a.send('生成草稿',{contextRefs:{chapterId:'p-ch0'}});const d=a.chat.at(-1).cards[0];w.renameChapter('p-ch0','第一章变更');await window.__flushNow();try{await w.applyAiProposal(d,{action:'append'});return false}catch(e){return /来源|变化/.test(e.message)}
`,
)
await test(
  'plain response conversion, continue and regenerate candidates',
  `
 const {a}=window.__preset;await a.send('写一段场景',{contextRefs:{chapterId:'p-ch0'}});const m=a.chat.at(-1),content=m.content,count=a.chat.length;a.draftFromMessage(m,content);if(!m.cards[0].text)return false;await a.continueMessage(m);if(a.chat.length!==count||!m.cards[0]?.text.startsWith(content)||m.candidates.length!==2)return false;await a.regenerateMessage(m);return a.chat.length===count && m.candidates.length===3 && m.activeCandidate===2 && m.candidates[0].content===content;
`,
)
await test(
  'cancel stops late callback and preserves non-applicable partial text',
  `
 const {a}=window.__preset;await a.saveSettings({model:'preset-slow'});const pending=a.send('普通对话');await new Promise(r=>setTimeout(r,650));a.cancel();const snapshot=a.chat.at(-1).content;await pending;await new Promise(r=>setTimeout(r,700));await a.saveSettings({model:'preset-native'});return !a.busy && a.chat.at(-1).content===snapshot && !a.chat.at(-1).complete && a.chat.at(-1).cards.length===0;
`,
)
await test(
  'length finish disables conversion and application',
  `
 const {a}=window.__preset;await a.saveSettings({model:'preset-length'});await a.send('普通对话');const m=a.chat.at(-1);let rejected=false;try{a.draftFromMessage(m,m.content)}catch{rejected=true}await a.saveSettings({model:'preset-native'});return !m.complete && m.finishReason==='length' && rejected;
`,
)
await test(
  'native draft survives followup failure without becoming applicable',
  `
 const {a,w}=window.__preset;await a.saveSettings({model:'preset-draft-fail'});await a.send('生成草稿');const m=a.chat.at(-1),d=m.cards[0];let blocked=false;try{await w.applyAiProposal(d,{action:'append'})}catch{blocked=true}await a.saveSettings({model:'preset-native'});return !!m.error && !m.complete && d?.text.includes('雾气漫入') && d.complete===false && blocked;
`,
)
await test(
  'length-limited native draft can continue with its original candidate retained',
  `
 const {a}=window.__preset;await a.saveSettings({model:'preset-length'});await a.send('生成草稿');const m=a.chat.at(-1),d=m.cards[0];if(!d?.text || d.complete!==false)return false;await a.saveSettings({model:'preset-native'});await a.continueMessage(m);const next=a.chat.at(-1);return next.complete && next.cards[0]?.text.startsWith(d.text) && m.candidates[0].cards[0].complete===false;
`,
)
await test(
  'privacy captures outbound requests without raw/history/global variable samples',
  `
 const {a,w,db}=window.__preset;const repo=await import('/src/db/preset-repo.js');const {defaultPreset}=await import('/src/services/ai/presets.js');const row=defaultPreset();row.id='privacy-preset';row.revision=(await db.aipresets.get(row.id))?.revision || 0;row.payload.prompts[0].content+=' {{getglobalvar::sample}} {{selection}}';row.payload.prompts.push({identifier:'sample',name:'范文',role:'system',novel_verbatim:true,content:'SAMPLE_SECRET'});row.payload.prompt_order[0].order.push({identifier:'sample',enabled:true});await a.savePreset(row);await a.selectPreset(row.id);const global=await repo.globalState();await repo.commitState(null,{...global,global:{sample:'GLOBAL_SECRET'}});await a.saveSettings({privacy:true});await fetch('http://127.0.0.1:18700/__reset');await a.send('只读检索',{contextRefs:{chapterId:'p-ch0',selection:'握住铜符'}});const req=await(await fetch('http://127.0.0.1:18700/__requests')).json();const raw=JSON.stringify(req);await a.saveSettings({privacy:false});await a.selectPreset('novel-default');return req.length>=1 && !/PRIVATE_RAW|FUTURE_FACT|GLOBAL_SECRET|SAMPLE_SECRET|雾气漫入/.test(raw);
`,
)
await test(
  'native JSON tool-call response and unsupported-tools fallback',
  `
 const {a}=window.__preset;await a.saveSettings({model:'preset-native-json'});await a.send('生成草稿');if(!a.chat.at(-1).cards[0])return false;await a.saveSettings({model:'preset-no-tools'});await a.send('普通对话');const m=a.chat.at(-1);await a.saveSettings({model:'preset-native'});return m.complete && m.context.warnings.some(w=>w.includes('不支持工具'));
`,
)
await test(
  'backup includes presets and isolated macro state, excludes credential',
  `
 const {exportBackupJson}=await import('/src/db/repo.js');const b=JSON.parse(await exportBackupJson());return Array.isArray(b.data.aipresets) && Array.isArray(b.data.aipresetstate) && !b.data.appconfig.some(r=>r.key==='ai.credential');
`,
)
await test(
  'preset conflict and preview does not commit macro variables',
  `
 const {a,w,db}=window.__preset;const {defaultPreset}=await import('/src/services/ai/presets.js'),repo=await import('/src/db/preset-repo.js');const row=defaultPreset();row.id='macro-test';row.revision=(await db.aipresets.get(row.id))?.revision || 0;row.payload.prompts[0].content+=' {{incvar::counter}}';const saved=await a.savePreset(row);const before=await repo.presetState(w.work.id);await a.previewPreset(saved);const after=await repo.presetState(w.work.id);const stale=JSON.parse(JSON.stringify(saved));await a.savePreset(saved);let conflict=false;try{await a.savePreset(stale)}catch{conflict=true}return conflict && JSON.stringify(before)===JSON.stringify(after);
`,
)
await test(
  'changing presets alters output while work facts remain stable',
  `
 const {a,db}=window.__preset;await a.selectPreset('novel-default');await fetch('http://127.0.0.1:18700/__reset');await a.send('写一段场景',{contextRefs:{chapterId:'p-ch0'}});const normal=a.chat.at(-1).content;const {defaultPreset}=await import('/src/services/ai/presets.js');const row=defaultPreset();row.id='style-switch';row.revision=(await db.aipresets.get(row.id))?.revision || 0;row.name='短句';row.payload.prompts[0].content+=' 短句测试';await a.savePreset(row);await a.selectPreset(row.id);await a.send('写一段场景',{contextRefs:{chapterId:'p-ch0'}});const short=a.chat.at(-1).content,req=await(await fetch('http://127.0.0.1:18700/__requests')).json();await a.selectPreset('novel-default');return normal!==short && req.every(r=>JSON.stringify(r.body.messages).includes('林昭')) && !req.some(r=>JSON.stringify(r.body.messages).includes('FUTURE_FACT'));
`,
)
await test(
  'source entity and chapter order changes block stale drafts',
  `
 const {a,w}=window.__preset;w.tab='chapters';w.selChapterId='p-ch0';await new Promise(r=>setTimeout(r,200));await a.send('生成草稿',{contextRefs:{chapterId:'p-ch0'}});const d=a.chat.at(-1).cards[0],char=w.characters.find(c=>c.id==='p-char'),old=char.fields;char.fields={身份:'另一身份'};let blocked=false;try{await w.applyAiProposal(d,{action:'append'})}catch{blocked=true}char.fields=old;if(!blocked)return false;const chapter=w.chapters.find(c=>c.id==='p-ch1');chapter.sortOrder=-1;try{await w.applyAiProposal(d,{action:'append'});return false}catch(e){return e.message.includes('顺序')}finally{chapter.sortOrder=1}
`,
)
await test(
  'protected double-link and annotation spans block replacement',
  `
 const {a,w}=window.__preset;w.selChapterId='p-ch0';const ed=window.__ns.editor;ed.commands.setContent('<p>林昭<span data-note-id="p-note">握住铜符</span>。<span data-dl="mubu:p-lore">铜符标记</span></p>',true);await window.__flushNow();await a.send('生成草稿',{contextRefs:{chapterId:'p-ch0',selection:'握住铜符'}});const card=a.chat.at(-1).cards[0];let blocked=false;try{await w.applyAiProposal(card,{action:'replace'})}catch(e){blocked=/批注|双链/.test(e.message)}return blocked && ed.getText().includes('握住铜符');
`,
)
await test(
  'small budgets disable tools before sending an oversized request',
  `
 const {a}=window.__preset;const {defaultPreset}=await import('/src/services/ai/presets.js');const row=defaultPreset();row.id='tiny-budget';row.revision=(await window.__ns.db.aipresets.get(row.id))?.revision || 0;row.payload.function_calling=true;row.payload.openai_max_context=1600;row.payload.openai_max_tokens=400;row.adaptation.contextBudget=256;row.payload.prompts[0].content='简短回答';await a.savePreset(row);await a.selectPreset(row.id);await a.send('普通对话',{contextRefs:{chapterId:'p-ch0'}});const m=a.chat.at(-1);await a.selectPreset('novel-default');return m.complete && m.context.warnings.some(w=>w.includes('预算不足')) && m.rounds.every(r=>r.used+r.outputReserve+128<=1600);
`,
)
await test(
  'outline proposal with blank edges uses its fixed anchor and atomic undo',
  `
 const {a,w}=window.__preset;const {proposalFromTool}=await import('/src/services/ai/dialogue.js'),{freezeContext}=await import('/src/services/ai/novel-context.js'),{snapshotWork}=await import('/src/services/ai/contracts.js');const view=snapshotWork(w);view.selectedChapterId='p-ch0';const frozen=freezeContext(view);const card=proposalFromTool({type:'outline',targetId:'p-ol',data:{name:'安排',nodes:[{title:'一',points:'开场',edge:''},{title:'二',points:'转折',edge:''}]}},view,frozen,'test');w.selOlnodeId=null;const before=w.liveOlnodes().length;await w.applyAiProposal(card);const created=w.liveOlnodes().filter(n=>!view.olnodes.some(old=>old.id===n.id));if(created.length!==2 || created.some(n=>n.parentId!=='p-ol' || n.rels?.length))return false;await w.undoAiApplication(card.auditId);return w.liveOlnodes().length===before;
`,
)
console.log(JSON.stringify({ passed: results.filter((r) => r.ok).length, total: results.length, results }, null, 2))
process.exit(results.every((r) => r.ok) ? 0 : 1)
