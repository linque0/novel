import assert from 'node:assert/strict'
import {connect} from './_cdp-lib.mjs'
import {assertAiTestProfile} from './_ai-test-profile.mjs'
import {buildSeedExpr} from './verify-seeds.mjs'
process.env.AI_TEST_PROFILE='booksource-verify'
const c=await connect('app://',9333)
assertAiTestProfile(await c.evalx('window.native.getDataLocation()'))
const seed=await c.evalx(buildSeedExpr('AI 验证书',{reset:true}));assert(seed?.ok)
await c.evalx(`window.__windowCheck=(async()=>{const w=window.__ns.getWork(),ui=(await import('/src/stores/ui.js')).useUiStore();await w.open(${JSON.stringify(seed.books[0].workId)});await ui.setSkin('original');ui.aiDrawerOpen=true;return true})();window.__windowCheck`)
await c.sleep(120)
const opened=await c.evalx(`window.native.panelOpen({type:'ai',workId:${JSON.stringify(seed.books[0].workId)},entityId:''})`);assert(opened?.ok,JSON.stringify(opened))
const p=await connect('panel=ai%3A',9333)
assert.equal(await p.evalx("new URLSearchParams(location.search).get('panel')?.startsWith('ai:')"),true,'Expected the AI panel target; never close the main window from this test')
for(let i=0;i<80&&!await p.evalx("!!document.querySelector('.agent-composer')");i++)await p.sleep(100)
try{
  assert.equal(await p.evalx("!!document.querySelector('.agent-conversation')&&!document.querySelector('.module-agent')&&document.querySelectorAll('.agent-composer').length===1"),true)
  console.log('PASS 独立 AI 窗口共用对话容器且没有重复模块工具栏')
  assert.equal(await c.evalx("getComputedStyle(document.querySelector('.ai-dock')).display==='none'"),true)
  console.log('PASS AI 拆窗时主窗口隐藏覆盖浮层')
  assert.equal(await p.evalx("(()=>{document.querySelector('[aria-label=\"功能调整\"]').click();return true})()"),true)
  await p.sleep(120)
  assert.equal(await p.evalx("document.querySelector('.agent-function-content').textContent.includes('作品知识')"),true)
  console.log('PASS 独立窗口输入框功能入口可用')
}finally{await p.evalx('window.native.panelCloseSelf()')}
for(let i=0;i<60&&!await c.evalx("getComputedStyle(document.querySelector('.ai-dock')).display!=='none'");i++)await c.sleep(100)
assert.equal(await c.evalx("!!document.querySelector('.agent-composer')&&getComputedStyle(document.querySelector('.ai-dock')).display!=='none'"),true)
console.log('PASS AI 独立窗口关闭后恢复原浮层界面')
process.exit(0)
