import assert from 'node:assert/strict'
import {writeFileSync,mkdirSync} from 'node:fs'
import {connect} from './_cdp-lib.mjs'
import {connectInspector,evalMain,captureWindow} from './_capture-main.mjs'
import {assertAiTestProfile} from './_ai-test-profile.mjs'
process.env.AI_TEST_PROFILE='booksource-verify'
const c=await connect('app://',9333)
assertAiTestProfile(await c.evalx('window.native.getDataLocation()'))
const ins=await connectInspector()
if(process.argv.includes('--close')){
  await evalMain(ins,"(()=>{const {BrowserWindow}=require('electron');setTimeout(()=>BrowserWindow.getAllWindows().forEach(w=>w.close()),200);return 'closing'})()");ins.ws.close();await new Promise(r=>setTimeout(r,500));process.exit(0)
}
mkdirSync('docs/writing-workflow-20261024',{recursive:true})
await c.evalx(`(async()=>{const p=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;window.__visual={ui:p._s.get('ui'),writing:(await import('/src/stores/writing.js')).useWritingStore()};window.__visual.ui.aiDrawerWidth=400;window.__visual.writing.visible=true;return true})()`)
const geometry=()=>c.evalx(`(()=>{const host=document.querySelector('.crimson-page .rich-inner')||document.querySelector('.rich-host'),t=document.querySelector('.editor-toolbar');return {width:host.getBoundingClientRect().width,toolbar:t.getBoundingClientRect().height,scroll:host.scrollTop}})()`)
const results=[]
for(const skin of ['original','gravity','glaze','crimson']){
  await c.evalx('window.__skinEditor=window.__ns.editor;window.__skinDocument=JSON.stringify(window.__ns.editor.getJSON())')
  await c.evalx(`window.__visual.ui.setSkin(${JSON.stringify(skin)})`)
  await c.sleep(450)
  assert(await c.evalx('window.__ns.editor===window.__skinEditor&&window.__ns.editor.view.dom.isConnected&&JSON.stringify(window.__ns.editor.getJSON())===window.__skinDocument'),'Skin change must keep the live editor connected: '+skin)
  for(const [width,height] of [[1280,720],[1440,900],[1920,1080]]){
    await c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false})
    await c.evalx('window.__visual.ui.aiDrawerOpen=false');await c.sleep(90)
    const before=await geometry()
    if(width===1440)await captureWindow(ins,'127.0.0.1:5173/',`docs/writing-workflow-20261024/${skin}-closed.png`,{exclude:'panel='})
    await c.evalx('window.__visual.ui.aiDrawerOpen=true');await c.sleep(120)
    const after=await geometry()
    assert(Math.abs(before.width-after.width)<=1&&Math.abs(before.toolbar-after.toolbar)<=1&&Math.abs(before.scroll-after.scroll)<=1,JSON.stringify({skin,width,before,after}))
    results.push({skin,width,height,before,after});console.log('PASS '+skin+' '+width+' geometry')
    if(width===1440){
      await c.evalx("document.querySelector('.writing-scroll').scrollTop=0")
      await captureWindow(ins,'127.0.0.1:5173/',`docs/writing-workflow-20261024/${skin}-directions.png`,{exclude:'panel='})
    }
  }
}
for(const reading of [true,false]){
  await c.evalx(`window.__visual.ui.readMode=${reading}`);await c.sleep(350)
  assert(await c.evalx(`window.__ns.editor===window.__skinEditor&&window.__ns.editor.view.dom.isConnected&&window.__ns.editor.isEditable===${!reading}&&JSON.stringify(window.__ns.editor.getJSON())===window.__skinDocument`),'Crimson reading transition must retain editor')
}
console.log('PASS crimson reading/editor transitions retain the connected instance')
await c.send('Emulation.clearDeviceMetricsOverride',{})
writeFileSync('docs/writing-workflow-20261024/geometry-results.json',JSON.stringify(results,null,2))
ins.ws.close();console.log('12/12 geometry, four skins captured');process.exit(0)
