import { Browser } from 'file:///C:/Users/linque/.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs'
import {writeFileSync} from 'node:fs'
import assert from 'node:assert/strict'
const browser=await Browser.launch({extraArgs:['--enable-unsafe-swiftshader']});const p=await browser.newPage();let failed=[]
try{
 await p.send('Network.enable');browser.on(p.sessionId,'Network.responseReceived',r=>{if(r.response.status>=400)failed.push({url:r.response.url,status:r.response.status})})
 await p.goto('http://127.0.0.1:5190')
 for(let i=0;i<150;i++){if(await p.eval(()=>document.querySelector('.shelf-scene canvas')&&!document.querySelector('.os-scene-loading')))break;await new Promise(r=>setTimeout(r,100))}
 assert.ok(await p.eval(()=>!!document.querySelector('.shelf-scene canvas')),'production WebGL scene')
 await new Promise(r=>setTimeout(r,1600));let before=await p.eval(()=>document.querySelector('.shelf-scene canvas').dataset.frames);await new Promise(r=>setTimeout(r,600));let after=await p.eval(()=>document.querySelector('.shelf-scene canvas').dataset.frames)
 assert.equal(before,after,'idle Three scene stops rendering')
 const ignoredResources=failed.filter(r=>r.url.endsWith('/favicon.ico'));failed=failed.filter(r=>!r.url.endsWith('/favicon.ico'));assert.deepEqual(failed,[]);assert.deepEqual(p.consoleErrors,[])
 await p.screenshot({path:'tools/_original-shelf-v2/production-empty.png',format:'png'})
 const result={passed:true,productionWebGL:true,failedResources:failed,ignoredResources,errors:p.consoleErrors,idleFrames:[before,after]};console.log(result);writeFileSync('tools/_original-shelf-v2/production.json',JSON.stringify(result,null,2))
}finally{await browser.close()}
