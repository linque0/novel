import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { join } from 'node:path'
const require = createRequire(import.meta.url)
const { chromium } = require(require.resolve('playwright', { paths: [join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node')] }))
const browser = await chromium.launch({channel:'msedge',headless:true})
try {
  const context = await browser.newContext(), page = await context.newPage()
  await context.addInitScript(() => {
    const Native = Worker
    window.__probeWorkers = []
    window.Worker = class extends Native { constructor(...args) { super(...args); __probeWorkers.push(this) } }
    window.__workerProbe = (worker, loss = false) => new Promise(resolve => {
      const listener = ({data}) => { if(data.bookProbe) { worker.removeEventListener('message',listener); resolve(data) } }
      worker.addEventListener('message',listener); worker.postMessage({bookProbe:true,loss})
    })
  })
  await context.route('**/render.worker.js*', async route => {
    const response = await route.fetch()
    await route.fulfill({response,body:`
      let probeWrites=0;const probeContexts=new Set();
      for(const key of ['width','height']){const descriptor=Object.getOwnPropertyDescriptor(OffscreenCanvas.prototype,key);Object.defineProperty(OffscreenCanvas.prototype,key,{...descriptor,set(value){probeWrites++;descriptor.set.call(this,value)}})}
      const probeGet=OffscreenCanvas.prototype.getContext;OffscreenCanvas.prototype.getContext=function(type,...args){const result=probeGet.call(this,type,...args);if(result&&/^webgl/.test(type))probeContexts.add(result);return result};
      self.addEventListener('message',event=>{if(event.data.bookProbe){event.stopImmediatePropagation();self.postMessage({bookProbe:true,writes:probeWrites,contexts:probeContexts.size});if(event.data.loss)for(const gl of probeContexts)gl.getExtension('WEBGL_lose_context')?.loseContext()}});
      `+await response.text()})
  })
  await page.goto('http://127.0.0.1:5173/',{waitUntil:'networkidle'})
  await page.evaluate(async () => {
    const source=await(await fetch('/src/components/CrimsonBookViewer.vue')).text(),path=source.match(/import\(["']([^"']*book3d\/renderer[^"']*)/)[1]
    window.__life={api:await import(path),failed:0}
    const {BookInteraction}=await import('/src/services/book3d/interaction.js')
    __life.rotation=new BookInteraction().rotation
    __life.create=async()=>{
      const canvas=document.createElement('canvas');canvas.style.cssText='position:fixed;inset:0;width:350px;height:450px';document.body.append(canvas)
      return __life.api.createBookViewer(canvas,{book:{id:'lifecycle-only',title:'星尘旅人',author:'林间',kind:'novel'},width:350,height:450,pixelRatio:1,rotation:__life.rotation,onError:()=>__life.failed++})
    }
    __life.viewer=await __life.create()
  })
  await page.waitForTimeout(150)
  const solid = await page.evaluate(async () => {
    const url=await __life.viewer.capture(),img=new Image();img.src=url;await img.decode()
    const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height
    const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0)
    const data=ctx.getImageData(0,0,canvas.width,canvas.height).data
    let solid=0;for(let i=3;i<data.length;i+=4)if(data[i]>200)solid++
    return solid
  })
  assert.ok(solid>1000,'asynchronous fallback capture contains a visible book after compositing')
  const before=await page.evaluate(()=>__workerProbe(__probeWorkers.at(-1)))
  await page.evaluate(()=>{for(let i=0;i<40;i++)__life.viewer.render(__life.rotation,1+i/200)})
  await page.waitForTimeout(200)
  const after=await page.evaluate(()=>__workerProbe(__probeWorkers.at(-1)))
  assert.equal(after.writes,before.writes,'rotation does not reset GPU backing dimensions')
  await page.evaluate(()=>__workerProbe(__probeWorkers.at(-1),true))
  await page.waitForFunction(()=>__life.failed===1&&__life.api.getBook3DDiagnostics().workers===0)
  console.log('PASS visible asynchronous capture, stable GPU buffer during rotation and actual worker WebGL context loss')
  let releaseFont
  const requested = new Promise(resolve => {
    context.route('**/kinghwa-oldsong-400.woff2*', async route => {
      const response=await route.fetch()
      await new Promise(release=>{releaseFont=release;resolve()})
      await route.fulfill({response})
    })
  })
  const starting=page.evaluate(async()=>{__life.viewer=await __life.create()});starting.catch(()=>{})
  await Promise.race([requested,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Expected worker font request')),5000))])
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'))})
  releaseFont(); await page.waitForTimeout(300)
  const hidden = await page.evaluate(()=>__workerProbe(__probeWorkers.at(-1)))
  assert.equal(hidden.contexts,0,'font loading completion does not create a hidden GPU renderer')
  await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'))})
  await starting
  await page.evaluate(()=>__life.viewer.dispose())
  console.log('PASS hidden initialization waits for visibility and resumes without losing the request')
  await context.close()
} finally { await browser.close() }
