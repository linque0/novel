import { assertAiTestProfile } from './_ai-test-profile.mjs'
import { connect } from './_cdp-lib.mjs'
const c = await connect('app://', process.env.CDP_PORT || '9222'),
  loc = await c.evalx('window.native.getDataLocation()')
assertAiTestProfile(loc)
await c.sleep(1500) // Allow development hot reload to settle before mutating fixtures.
const results = []
async function check(name, expression, page = c) {
  try {
    const value = await page.evalx(expression)
    if (value !== true) throw new Error(JSON.stringify(value))
    results.push(true)
    console.log('PASS ' + name)
  } catch (e) {
    results.push(false)
    console.log('FAIL ' + name + ' ' + e.message)
  }
}
await c.evalx(
  `(async()=>{const w=window.__ns.getWork();await w.open('preset-work');w.tab='chapters';w.selChapterId='p-ch0';const {useAiStore}=await import('/src/stores/ai.js');window.__win={w,a:useAiStore()};await __win.a.saveSettings({model:'preset-native',privacy:false});const {useUiStore}=await import('/src/stores/ui.js');useUiStore().aiDrawerOpen=true;await window.native.panelOpen({type:'ai-presets',workId:w.work.id,entityId:'p-ch0'})})()`,
)
await c.sleep(1500)
const p = await connect('panel=ai-presets', process.env.CDP_PORT || '9222')
await check(
  'independent editor renders source adapters and prompt compiler',
  `document.querySelectorAll('.prompt-row').length>=8 && document.body.innerText.includes('上下文适配') && !document.body.innerText.includes('专业角色模型')`,
  p,
)
await check(
  'one global preset editor across works',
  `(async()=>{const r=await window.native.panelOpen({type:'ai-presets',workId:'v2-work',entityId:'v2-ch0'});return r.focused===true})()`,
)
await check(
  'preview renders actual material without network calls',
  `(async()=>{const before=(await(await fetch('http://127.0.0.1:18700/__requests')).json()).length;[...document.querySelectorAll('button')].find(b=>b.textContent.includes('检查发送')).click();for(let i=0;i<20&&!document.body.textContent.includes('实际发送检查器');i++)await new Promise(r=>setTimeout(r,150));const after=(await(await fetch('http://127.0.0.1:18700/__requests')).json()).length;return before===after && document.body.innerText.includes('实际发送检查器') && document.body.textContent.includes('握住铜符')})()`,
  p,
)
await check(
  'preset save broadcast updates main selector',
  `(async()=>{const {useAiStore}=await import('/src/stores/ai.js'),{defaultPreset}=await import('/src/services/ai/presets.js');const a=useAiStore(),row=defaultPreset();row.id='window-preset';row.revision=(await window.__ns.db.aipresets.get(row.id))?.revision || 0;row.name='窗口同步预设';await a.savePreset(row);return true})()`,
  p,
)
await c.sleep(250)
await check('main receives changed preset asset', `__win.a.presets.some(p=>p.id==='window-preset')`)
await check(
  'main assistant exposes conversation and feature entry only',
  `document.querySelector('.ai-panel')?.innerText.includes('预设编辑') && !document.querySelector('.ai-studio') && !document.querySelector('.ai-panel')?.innerText.includes('文风档案')`,
)
/* 面板不再重复上边栏的设置入口（重复窗口隐患一并消除） */
await check(
  'assistant header keeps preset/knowledge entries without duplicated settings',
  `(()=>{const t=document.querySelector('.ai-panel .ai-top')?.innerText||'';return t.includes('预设编辑') && t.includes('作品知识') && !t.includes('设置')})()`,
)
await p.evalx(`window.native.panelCloseSelf()`)
await c.sleep(250)
await c.evalx(`window.native.panelOpen({type:'chapter',workId:'preset-work',entityId:'p-ch0'})`)
await c.sleep(1200)
const chapter = await connect('panel=chapter', process.env.CDP_PORT || '9222')
await check(
  'real chapter window lock blocks draft application',
  `(async()=>{await __win.a.send('生成草稿',{contextRefs:{chapterId:'p-ch0'}});try{await __win.w.applyAiProposal(__win.a.chat.at(-1).cards[0],{action:'append'});return false}catch(e){return e.message.includes('锁定')}})()`,
)
await chapter.evalx(`window.native.panelCloseSelf()`)
await c.sleep(250)
await check(
  'switching works cancels old conversation and isolates messages',
  `(async()=>{const a=__win.a;await a.saveSettings({model:'preset-slow'});const pending=a.send('普通对话',{contextRefs:{chapterId:'p-ch0'}});await new Promise(r=>setTimeout(r,500));a.switchWork('other-work');await pending;if(a.chat.length || a.busy)return false;a.switchWork('preset-work');await a.saveSettings({model:'preset-native'});return a.chat.every(m=>m.workId==='preset-work')})()`,
)
console.log(`${results.filter(Boolean).length}/${results.length} preset window checks passed`)
process.exit(results.every(Boolean) ? 0 : 1)
