import {connect} from './_cdp-lib.mjs'
import {assertAiTestProfile} from './_ai-test-profile.mjs'
const c=await connect('app://',process.env.CDP_PORT||'9333');assertAiTestProfile(await c.evalx('window.native.getDataLocation()'))
await c.sleep(1500) // Allow development hot reload to settle before mutating fixtures.
const results=[]
async function test(name,body,page=c){const value=await page.evalx(`(async()=>{${body}})()`);const ok=value===true;results.push({name,ok});console.log(`${ok?'PASS':'FAIL'} ${name}${ok?'':' '+JSON.stringify(value)}`)}
await test('setup text-first asset and activate only on save',`
 const {useAiStore}=await import('/src/stores/ai.js'),{defaultPreset}=await import('/src/services/ai/presets.js');const w=window.__ns.getWork(),db=window.__ns.db;await w.open('preset-work');w.tab='chapters';w.selChapterId='p-ch0';const a=useAiStore();a.switchWork(w.work.id);await a.saveSettings({baseURL:'http://127.0.0.1:18700/v1',model:'preset-text',privacy:false,apiKey:'sk-local-test'});await a.clearChat();const row=defaultPreset();row.id='experience-text';row.name='体验验证·文本';row.revision=(await db.aipresets.get(row.id))?.revision||0;const saved=await a.savePreset(row,{activateWorkId:w.work.id});window.__experience={a,w,db,row:saved};return !row.payload.function_calling && a.selectedPresetId===row.id;
`)
if(!results.at(-1).ok)process.exit(1)
await test('preview equals text-only first real request with explicit sampling',`
 const {a,w,row}=window.__experience;row.payload.prompts[0].content='只输出正文 TEST-A {{incvar::once}} {{lastMessageId}} {{currentSwipeId}}';Object.assign(row.payload,{seed:18,reasoning_effort:'low',verbosity:'high',stream_openai:false,openai_max_context:12000,openai_max_tokens:7000});window.__experience.row=await a.savePreset(row,{activateWorkId:w.work.id});a.modelCfg['preset-text']={enabled:true,contextWindow:10000,maxTokens:8000,temperature:.1};const pre=await a.previewPreset(window.__experience.row,'写一段场景');await fetch('http://127.0.0.1:18700/__reset');await a.send('写一段场景');const req=(await(await fetch('http://127.0.0.1:18700/__requests')).json())[0].body;const state=await(await import('/src/db/preset-repo.js')).presetState(w.work.id);return JSON.stringify(req.messages)===JSON.stringify(pre.messages)&&!req.tools&&!req.tool_choice&&!JSON.stringify(req).includes('submit_draft')&&req.max_tokens===7000&&req.seed===18&&req.reasoning_effort==='low'&&req.verbosity==='high'&&req.stream===false&&state.local.once===1;
`)
await test('editing unsaved copy leaves actual generation unchanged',`
 const {a,row}=window.__experience;const draft=JSON.parse(JSON.stringify(row));draft.payload.prompts[0].content='UNSAVED';await a.previewPreset(draft,'讨论');await fetch('http://127.0.0.1:18700/__reset');await a.send('讨论');const req=await(await fetch('http://127.0.0.1:18700/__requests')).json();return !JSON.stringify(req).includes('UNSAVED')&&JSON.stringify(req).includes('TEST-A');
`)
await test('worker regular, display and prompt views stay separated across history',`
 const {a,w,row}=window.__experience;row.payload.openai_max_tokens=2048;row.payload.extensions={regex_scripts:[{id:'regular',scriptName:'常规',findRegex:'/林昭/g',replaceString:'旅人',placement:[2],trimStrings:[]},{id:'display',scriptName:'展示',findRegex:'/旅人/g',replaceString:'<details><summary>SHOW</summary>旅人</details>',placement:[2],trimStrings:[],markdownOnly:true},{id:'prompt',scriptName:'发送',findRegex:'/旅人/g',replaceString:'PROMPT_PERSON',placement:[2],trimStrings:[],promptOnly:true}]};window.__experience.row=await a.savePreset(row,{activateWorkId:w.work.id});await a.clearChat();await a.send('写一段场景');const m=a.chat.at(-1);if(!m.rawContent.includes('林昭')||!m.content.includes('旅人')||!m.displayText.includes('SHOW')||!m.promptText.includes('PROMPT_PERSON'))return false;await fetch('http://127.0.0.1:18700/__reset');await a.send('讨论');const req=(await(await fetch('http://127.0.0.1:18700/__requests')).json())[0];const raw=JSON.stringify(req.body.messages);return raw.includes('PROMPT_PERSON')&&!raw.includes('SHOW');
`)
await test('regex timeout and invalid rule restore entire stage input',`
 const {processRegex}=await import('/src/services/ai/regex.js');const row={payload:{extensions:{regex_scripts:[{scriptName:'bad',findRegex:'/[/',replaceString:'oops',placement:[2]}]}}};const invalid=await processRegex('TEXT',row,{placement:2});row.payload.extensions.regex_scripts=[{scriptName:'catastrophic',findRegex:'/^(a+)+$/',replaceString:'x',placement:[2]}];const input='a'.repeat(32)+'!';const slow=await processRegex(input,row,{placement:2});return invalid.text==='TEXT'&&invalid.warnings.length===1&&slow.text===input&&slow.warnings.some(w=>w.includes('500'));
`)
await test('static Markdown sanitized; selected display text bound to candidate',`
 const {renderChat,plainChat}=await import('/src/services/ai/chat-text.js');const html=renderChat('<details><summary>fold</summary>text</details><iframe src="https://x"></iframe><script>alert(1)</script><a onclick="alert(1)" href="javascript:alert(1)">x</a>');if(/iframe|script|onclick|javascript:/.test(html)||!html.includes('<details>'))return false;const {a}=window.__experience,m=a.chat.at(-1);const visible=plainChat(m.displayText);const card=a.draftFromMessage(m,visible);return card.text===visible&&card.candidateIndex===m.activeCandidate;
`)
await test('same-turn swipes retain candidates and selected history only',`
 const {a}=window.__experience;const count=a.chat.length,m=a.chat.at(-1),first=m.rawContent;await a.regenerateMessage(m);if(a.chat.length!==count||m.candidates.length!==2||m.activeCandidate!==1)return false;a.selectCandidate(m,0);if(m.rawContent!==first)return false;const row=JSON.parse(JSON.stringify(window.__experience.row));row.payload.prompts[0].content+=' SWIPE {{lastGenerationType}} {{currentSwipeId}}';row.payload.prompts[0].injection_trigger=['swipe'];window.__experience.row=await a.savePreset(row,{activateWorkId:a.workId});await fetch('http://127.0.0.1:18700/__reset');await a.regenerateMessage(m);const req=(await(await fetch('http://127.0.0.1:18700/__requests')).json())[0];return a.chat.length===count&&m.candidates.length===3&&JSON.stringify(req).includes('SWIPE swipe 3');
`)
await test('continue keeps old candidate without synthetic author turn and executes postfix',`
 const {a,row}=window.__experience;row.payload.continue_prefill=true;row.payload.continue_postfix=' ';row.payload.continue_nudge_prompt='CUSTOM-CONTINUE {{lastChatMessage}}';window.__experience.row=await a.savePreset(row,{activateWorkId:a.workId});const m=a.chat.at(-1),raw=m.rawContent,count=a.chat.length;await fetch('http://127.0.0.1:18700/__reset');await a.continueMessage(m);const req=(await(await fetch('http://127.0.0.1:18700/__requests')).json())[0].body;return a.chat.length===count&&m.candidates.at(-2).rawContent===raw&&m.rawContent.startsWith(raw+' ')&&req.messages.at(-1).role==='assistant'&&!req.messages.some(x=>x.role==='user'&&x.content.includes('继续上一条'));
`)
await test('unsupported prefill falls back using frozen preset nudge',`
 const {a}=window.__experience;await a.saveSettings({model:'preset-prefill'});await fetch('http://127.0.0.1:18700/__reset');const m=a.chat.at(-1);await a.continueMessage(m);const req=await(await fetch('http://127.0.0.1:18700/__requests')).json();await a.saveSettings({model:'preset-text'});return m.complete&&req.length===2&&req[1].body.messages.at(-1).content.startsWith('CUSTOM-CONTINUE')&&m.context.warnings.some(w=>w.includes('prefill'));
`)
await test('explicit rejected field reported without silent removal or retry',`
 const {a}=window.__experience;await a.saveSettings({model:'preset-param-reject'});await fetch('http://127.0.0.1:18700/__reset');await a.send('写作');const req=await(await fetch('http://127.0.0.1:18700/__requests')).json(),error=a.chat.at(-1).error;await a.saveSettings({model:'preset-text'});return req.length===1&&error.message.includes('seed');
`)
await test('reasoning handled separately from prose and cards',`
 const {a,row}=window.__experience;row.payload.prompts[0].injection_trigger=[];window.__experience.row=await a.savePreset(row,{activateWorkId:a.workId});await a.saveSettings({model:'preset-reasoning'});await a.send('写作');const m=a.chat.at(-1);await a.saveSettings({model:'preset-text'});return m.reasoning.rawText.includes('铜符')&&!m.content.includes('思考')&&m.cards.length===0;
`)
await test('manual A/B makes six isolated calls and leaves conversation/macros unchanged',`
 const {a,w,db,row}=window.__experience;const b=JSON.parse(JSON.stringify(row));b.id='experience-b';b.revision=(await db.aipresets.get(b.id))?.revision||0;b.name='B·短句';b.payload.prompts[0].content='短句测试';await a.savePreset(b);await fetch('http://127.0.0.1:18700/__reset');const chat=JSON.stringify(a.chat),repo=await import('/src/db/preset-repo.js'),before=JSON.stringify(await repo.presetState(w.work.id));await a.evaluatePresets([row.id,b.id],'写一段场景');const req=await(await fetch('http://127.0.0.1:18700/__requests')).json();return req.length===6&&a.evaluation.results.length===6&&a.evaluation.results[0].text!==a.evaluation.results[3].text&&JSON.stringify(a.chat)===chat&&JSON.stringify(await repo.presetState(w.work.id))===before;
`)
await test('tool-enabled preview and first request share schema-inclusive budget',`
 const {a,row,w}=window.__experience;const tool=JSON.parse(JSON.stringify(row));tool.id='experience-tool';tool.revision=(await window.__ns.db.aipresets.get(tool.id))?.revision||0;tool.payload.function_calling=true;const saved=await a.savePreset(tool,{activateWorkId:w.work.id});const pre=await a.previewPreset(saved,'普通对话');await fetch('http://127.0.0.1:18700/__reset');await a.send('普通对话');const req=(await(await fetch('http://127.0.0.1:18700/__requests')).json())[0];const m=a.chat.at(-1);await a.selectPreset(row.id);return pre.tokens.toolReserve>0&&JSON.stringify(req.body.messages)===JSON.stringify(pre.messages)&&m.rounds[0].used===pre.tokens.used&&m.rounds[0].inputCap===pre.tokens.inputCap;
`)
await c.evalx(`window.native.panelOpen({type:'ai-presets',workId:'preset-work',entityId:'p-ch0'})`);await c.sleep(2000);const p=await connect('panel=ai-presets',process.env.CDP_PORT||'9333')
await test('Prompt Manager separates library/order and edits via modal',`
 const root=document.querySelector('.preset-window');if(!root)return false;let vm=root.__vueParentComponent;while(vm&&!vm.type.__file?.endsWith('PresetWindow.vue'))vm=vm.parent;window.__pv=vm.setupState;
 const v=window.__pv;if(!document.body.innerText.includes('提示库')||!document.body.innerText.includes('发送顺序'))return false;v.addPrompt();v.entry.name='UI custom';v.entry.content='UI CUSTOM';const id=v.entry.identifier;v.commitEntry();v.libraryId=id;v.append();v.edit(id);await new Promise(r=>setTimeout(r,250));return document.body.innerText.includes('编辑提示条目')&&v.order.some(o=>o.identifier===id);
`,p)
await test('remove from order retains library and save activates associated work',`
 const v=window.__pv;v.entry=null;const id=v.libraryId;v.removeOrder(v.order.findIndex(o=>o.identifier===id));if(v.order.some(o=>o.identifier===id)||!v.editing.payload.prompts.some(p=>p.identifier===id))return false;await v.save();return !v.dirty;
`,p)
await c.sleep(500)
await test('main receives activation on save',`return window.__experience.a.selectedPresetId==='experience-text'&&window.__experience.a.presets.find(p=>p.id==='experience-text').payload.prompts.some(p=>p.name==='UI custom');`)
await test('independent preview reads real history and main model configuration',`
 const {useAiStore}=await import('/src/stores/ai.js'),a=useAiStore();const pre=await a.previewPreset(window.__pv.editing,'PREVIEW-CONTEXT');return pre.messages.some(m=>m.content.includes('PROMPT_PERSON'))&&pre.opts.model==='preset-text'&&pre.tokens.budget===10000;
`,p)
await test('editor regex sample test uses variable copies',`
 const v=window.__pv;v.tab='regex';v.regexSample='林昭';await v.testRegex();return v.regexResult.text==='旅人'&&document.body.innerText.includes('样本测试');
`,p)
await test('save conflict keeps staged text instead of overwriting',`
 const v=window.__pv,ai=(await import('/src/stores/ai.js')).useAiStore();const stale=JSON.parse(JSON.stringify(v.editing));await ai.savePreset(v.editing);v.editing=stale;v.editing.name='UNSAVED CONFLICT';v.changed();await v.save();return v.dirty&&v.editing.name==='UNSAVED CONFLICT'&&v.error.includes('另一窗口');
`,p)
await test('closed-main-work preview reports missing associated work',`
 const {requestMainPreview}=await import('/src/services/ai/prepare-dialogue.js');try{await requestMainPreview(window.__pv.editing,'Q',{workId:'NOT_OPEN'});return false}catch(e){return e.message.includes('未在主窗口打开')}
`,p)
await p.evalx(`window.native.panelCloseSelf()`)
console.log(JSON.stringify({passed:results.filter(r=>r.ok).length,total:results.length,results},null,2));process.exit(results.every(r=>r.ok)?0:1)
