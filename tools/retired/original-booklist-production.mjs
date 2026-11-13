/* 【已停用 · 2026-11-12】依赖仓库外的本机绝对路径，换机器不可运行。
   依赖：C:/Users/linque/.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs
   对应的 3D 书架方案（original-shelf-scene 等）已于 2026-11-12 移除。
   仓库内替代：tools/_cdp-lib.mjs（CDP 公共库）。
   复跑方法：把首行 import 改为 import { connect } from '../_cdp-lib.mjs'
            并按 _cdp-lib 的 connect() 接口调整调用。 */

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
