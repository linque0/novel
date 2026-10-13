import { assertAiTestProfile } from './_ai-test-profile.mjs'
/* 只在 dev 调试 profile 上跑（真实 Electron 窗口与共享 Dexie 租约）。 */
import { connect } from './_cdp-lib.mjs'
const c = await connect('app://', process.env.CDP_PORT || '9222')
const loc = await c.evalx('window.native.getDataLocation()')
assertAiTestProfile(loc)
const results = []
async function check(name, expression, page = c) {
  try { const value = await page.evalx(expression); if (value !== true) throw new Error(JSON.stringify(value)); results.push(true); console.log('PASS ' + name) }
  catch (e) { results.push(false); console.log('FAIL ' + name + ' ' + e.message) }
}
await c.evalx(`(async()=>{const w=window.__ns.getWork();await w.open('v2-work');const {useAiStore}=await import('/src/stores/ai.js');window.__win={w,a:useAiStore()};await __win.a.saveSettings({apiKey:'sk-mock-windows',privacy:false,options:{kb:{auto:false,usageCap:0},embeddings:{enabled:false,model:''},roles:{}}});w.tab='chapters';w.selChapterId='v2-ch0';await window.native.panelOpen({type:'ai',workId:'v2-work',entityId:''});})()`)
await c.sleep(2500)
let p = await connect('panel=ai', process.env.CDP_PORT || '9222')
await p.evalx(`(async()=>{const {useAiStore}=await import('/src/stores/ai.js');window.__a=useAiStore();await __a.loadSettings();})()`)
await check('AI settings broadcast updates main window', `(async()=>{await __a.saveSettings({privacy:true});return true})()`, p)
await c.sleep(300)
await check('main received privacy mode through event bus', `__win.a.privacy===true`)
await p.evalx('__a.saveSettings({privacy:false})')
await c.sleep(300)
const hold = `(async()=>{const a=__win.a;window.__realFetch=window.fetch;window.__release=null;window.fetch=(url,init)=>{if(String(url).includes('/chat/completions')&&!window.__release)return new Promise((resolve,reject)=>{window.__release=()=>window.__realFetch(url,init).then(resolve,reject);init.signal.addEventListener('abort',()=>reject(new DOMException('cancel','AbortError')),{once:true})});return window.__realFetch(url,init)};window.__building=a.buildKnowledge({rebuild:true}).finally(()=>{window.fetch=window.__realFetch});for(let i=0;i<100&&!window.__release;i++)await new Promise(r=>setTimeout(r,20));return !!window.__release})()`
await check('memory job is owned by main window', hold)
await p.evalx('__a.pauseKnowledge()')
await c.sleep(300)
await check('AI panel pause reaches main and persists checkpoint', `(async()=>{await window.__building;const r=await window.__ns.db.airuns.get('knowledge:v2-work');return r.status==='paused'&&!r.owner})()`)
await check('main can restart paused memory job', hold)
await p.evalx('window.native.panelCloseSelf()')
await c.sleep(300)
await check('closing assistant does not cancel background extraction', `(async()=>{const r=await window.__ns.db.airuns.get('knowledge:v2-work');const running=r.status==='running'&&!!r.owner;window.__release();await window.__building;await __win.a.refreshKnowledge();return running&&__win.a.kb.ready===4})()`)
await c.evalx(`window.native.panelOpen({type:'chapter',workId:'v2-work',entityId:'v2-ch0'})`)
await c.sleep(2000)
p=await connect('panel=chapter', process.env.CDP_PORT || '9222')
await check('proposal apply respects a real chapter window lock', `(async()=>{const r=await __win.a.startPlotBranch('v2-ch0');let refused=false;try{await __win.w.applyAiProposal(r.cards[0],{action:'draft'})}catch(e){refused=e.message.includes('锁定')};return refused})()`)
await check('panel edits persist and synchronize main source version', `(async()=>{const {useWorkStore}=await import('/src/stores/work.js');const {autosave}=await import('/src/services/autosave.js');const w=useWorkStore();window.__ns.editor.commands.setContent('<p>林昭埋下铜符。多窗口更新证据。'+Date.now()+'</p>',true);await autosave.flushAll();return true})()`,p)
await c.sleep(500)
await check('main receives saved chapter and invalidates its memory', `(async()=>{for(let i=0;i<50;i++){await __win.a.refreshKnowledge();if(__win.w.chapters.find(c=>c.id==='v2-ch0').content.includes('多窗口更新证据')&&__win.a.kb.stale>0)return true;await new Promise(r=>setTimeout(r,100))}return false})()`)
await p.evalx('window.native.panelCloseSelf()')
await c.sleep(2000)
await check('all test panel locks are released', `(async()=>{const r=await window.native.panelList();return r.panels.length===0&&r.locks.length===0})()`)
console.log(JSON.stringify({passed:results.filter(Boolean).length,failed:results.filter(x=>!x).length}))
process.exit(results.every(Boolean)?0:1)
