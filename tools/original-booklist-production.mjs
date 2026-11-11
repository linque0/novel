import { Browser } from 'file:///C:/Users/linque/.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs'
import {writeFileSync} from 'node:fs'
import assert from 'node:assert/strict'
const browser=await Browser.launch(),p=await browser.newPage();let failed=[]
try{
 await p.send('Network.enable');browser.on(p.sessionId,'Network.responseReceived',r=>{if(r.response.status>=400&&!r.response.url.endsWith('/favicon.ico'))failed.push(r.response.url)})
 await p.goto('http://127.0.0.1:5190');await new Promise(r=>setTimeout(r,500))
 assert.ok(await p.eval(()=>!!document.querySelector('.os-list-region')))
 assert.equal(await p.eval(()=>document.querySelectorAll('canvas').length),0)
 assert.ok(await p.eval(()=>document.querySelector('.os-pagination').getBoundingClientRect().bottom<=innerHeight))
 assert.ok(await p.eval(()=>!performance.getEntriesByType('resource').some(r=>r.name.includes('original-shelf-scene'))))
 assert.deepEqual(failed,[]);assert.deepEqual(p.consoleErrors,[])
 const result={passed:true,listOnly:true,failedResources:failed,errors:p.consoleErrors};writeFileSync('tools/_original-booklist/production.json',JSON.stringify(result,null,2));console.log(result)
}finally{await browser.close()}
