import assert from 'node:assert/strict'
import {writeFileSync,mkdirSync} from 'node:fs'
import {connect} from './_cdp-lib.mjs'
import {assertAiTestProfile} from './_ai-test-profile.mjs'
import {buildSeedExpr} from './verify-seeds.mjs'
process.env.AI_TEST_PROFILE='booksource-verify'
const c=await connect('app://',9333)
for(let i=0;i<60&&!await c.evalx('!!window.__ns?.getWork');i++)await c.sleep(100)
assertAiTestProfile(await c.evalx('window.native.getDataLocation()'))
const seed=await c.evalx(buildSeedExpr('AI 验证书',{reset:true}));assert(seed?.ok)
await c.evalx(`window.__paperSetup=(async()=>{const w=window.__ns.getWork(),ui=(await import('/src/stores/ui.js')).useUiStore();await w.open(${JSON.stringify(seed.books[0].workId)});await ui.setSkin('crimson');ui.aiDrawerOpen=false;window.__paper={w,ui};return true})();window.__paperSetup`)
await c.sleep(300)
const results=[]
async function test(name,body){const r=await c.evalx(`window.__paperCheck=(async()=>{const {w,ui}=window.__paper;const wait=()=>new Promise(r=>setTimeout(r,120));${body}})();window.__paperCheck`);results.push({name,ok:r===true,...(r===true?{}:{detail:r})});console.log((r===true?'PASS ':'FAIL ')+name+(r===true?'':' '+JSON.stringify(r)))}
await test('正文有纸面菜单并绑定持久化偏好',`let button=[...document.querySelectorAll('.editor-toolbar [aria-label="纸面"]')].find(e=>e.getBoundingClientRect().width);if(!button){[...document.querySelectorAll('.editor-toolbar button')].find(b=>b.title.startsWith('更多格式'))?.click();await wait();button=document.querySelector('.tb-paper-in-more [aria-label="纸面"]')}if(!button)return false;button.click();await wait();const option=[...document.querySelectorAll('[data-paper-choice="manuscript"]')].find(e=>e.getBoundingClientRect().width);option?.click();await wait();const row=await window.__ns.db.appconfig.get('writingPaperStyle');return !!option&&row?.value==='manuscript'&&document.querySelector('.editor-wrap').dataset.writingPaper==='manuscript';`)
await test('切换装帧不改正文、撤销栈、选区或滚动',`const e=window.__ns.editor,host=e.view.dom.closest('.crimson-page')?.querySelector('.rich-inner')||e.view.dom.closest('.rich-host');e.commands.setTextSelection({from:2,to:8});host.scrollTop=0;const before={html:e.getHTML(),from:e.state.selection.from,to:e.state.selection.to,scroll:host.scrollTop,history:e.state.plugins.find(p=>p.key.startsWith('history$'))?.getState(e.state)?.done.eventCount};for(const style of ['booklet','manuscript','hardcover'])await ui.setWritingPaperStyle(style);await wait();return e===window.__ns.editor&&e.getHTML()===before.html&&e.state.selection.from===before.from&&e.state.selection.to===before.to&&host.scrollTop===before.scroll&&e.state.plugins.find(p=>p.key.startsWith('history$'))?.getState(e.state)?.done.eventCount===before.history;`)
await test('赤月戏折角已移除，正文与札记共享纸面',`const page=document.querySelector('.crimson-page'),note=document.querySelector('.crimson-margin');return ['none','normal'].includes(getComputedStyle(page,'::after').content)&&page.classList.contains('writing-paper-surface')&&note.classList.contains('writing-paper-surface');`)
await test('保存失败保留旧纸面并解除忙碌状态',`const table=window.__ns.db.appconfig,old=ui.writingPaperStyle;const reject=function(_changes,key){if(key==='writingPaperStyle')throw new Error('paper fixture failure')};table.hook('updating',reject);let failed=false;try{await ui.setWritingPaperStyle(old==='booklet'?'hardcover':'booklet')}catch{failed=true}finally{table.hook('updating').unsubscribe(reject)}return failed&&ui.writingPaperStyle===old&&!ui.writingPaperSaving;`)
await test('非法或缺失偏好回退默认，读取不写正文',`const db=window.__ns.db,html=window.__ns.editor.getHTML();await db.appconfig.put({key:'writingPaperStyle',value:'unsupported'});await ui.loadPrefs();const invalid=ui.writingPaperStyle==='booklet';await db.appconfig.delete('writingPaperStyle');await ui.loadPrefs();return invalid&&ui.writingPaperStyle==='booklet'&&window.__ns.editor.getHTML()===html;`)
await c.evalx("(()=>{const e=window.__ns.editor;window.__paperInputBefore=e.getHTML();e.commands.setTextSelection(e.state.doc.content.size-1);e.view.focus();return true})()")
await c.send('Input.insertText',{text:'纸面输入验证。'});await c.sleep(100)
await test('真实正文输入和撤销正常，材质不阻挡编辑',`const e=window.__ns.editor,typed=e.getText().endsWith('纸面输入验证。');e.commands.undo();return typed&&e.getHTML()===window.__paperInputBefore;`)
mkdirSync('docs/writing-paper-20261025',{recursive:true});writeFileSync('docs/writing-paper-20261025/ui-results.json',JSON.stringify(results,null,2));console.log(`${results.filter(r=>r.ok).length}/${results.length} passed`);process.exit(results.every(r=>r.ok)?0:1)
