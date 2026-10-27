/* Targeted shelf verification in a fresh, disposable browser context.
 * --baseline captures the current layout before the depth change.
 * Does not connect to Electron or read/write the user's profile. */
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'

const require = createRequire(import.meta.url)
const { chromium } = require(require.resolve('playwright', {
  paths: [join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node')]
}))
const root = new URL('..', import.meta.url)
const refined = process.argv.includes('--refined')
const out = new URL('docs/前端美化/赤月戏-360典藏-20261026/', root)
mkdirSync(out, { recursive: true })
const baseline = process.argv.includes('--baseline')
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor:2, recordVideo:{dir:fileURLToPath(new URL('video/',out)),size:{width:1440,height:900}} })
const videoStarted=Date.now()
const page = await context.newPage()
const errors = []
page.on('pageerror', error => {errors.push(error.message);console.log('PAGEERROR',error.message)})
page.on('console',m=>{if(m.type()==='error')console.log('CONSOLE',m.text())})
const report = { checks: [], layouts: {} }
function check(ok, name) { report.checks.push({ name, ok: !!ok }); assert.ok(ok, name); console.log('PASS ' + name) }
async function settled() {
  await page.evaluate(async () => {
    await document.fonts.ready
    await Promise.all(document.getAnimations().filter(a => a.effect?.getComputedTiming().iterations !== Infinity).map(a => a.finished.catch(() => {})))
  })
}
async function layout() {
  return page.evaluate(() => {
    const selectors = ['.app-topbar', '.crimson-toolbar', '.crimson-stage', '.crimson-story', '.crimson-chapter-card', '.crimson-program', '.crimson-book-object', '.crimson-work-row']
    return Object.fromEntries(selectors.map(sel => {
      const el = document.querySelector(sel), r = el?.getBoundingClientRect()
      return [sel, r ? { x:r.x, y:r.y, w:r.width, h:r.height } : null]
    }).concat([['background', getComputedStyle(document.querySelector('.crimson-stage-art')).backgroundImage]]))
  })
}
async function shot(name) { await settled(); await page.screenshot({ path: fileURLToPath(new URL(name + '.png', out)) }) }
try {
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' })
  await page.waitForFunction(() => window.__ns && document.querySelector('#app').__vue_app__?.config.globalProperties.$pinia._s.has('shelf'))
  await page.evaluate(async () => {
    const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
    const shelf = pinia._s.get('shelf'), ui = pinia._s.get('ui')
    await ui.setSkin('crimson')
    const inputs = [
      ['novel','星尘旅人','林间'], ['note','白昼','陆川'], ['cedar','山海拾遗录','青山'],
      ['violet','雾都来信',''], ['claret','一部名字很长很长的中文与 English 混排小说','秋白'], ['ink','无名之书','黑石']
    ]
    const fixtures = []
    for (const [kind, title, author] of inputs) fixtures.push(await shelf.createWork({ title,author,kind,genre:'奇幻',status:'连载',intro:kind==='violet'?'':'一枚铜星的熄灭，唤醒了一张被遗忘的星图。',withVolume:true }))
    const { uid, now } = window.__ns
    await __ns.db.chapters.add({id:uid(),workId:fixtures[0].id,volumeId:null,title:'第一章 · 雾港',content:'<p>穹顶的钟声越过海湾，最后一艘星船驶入黎明。</p>',sortOrder:0,createdAt:now(),updatedAt:now(),deletedAt:null})
    shelf.works = fixtures
    shelf.openStats = Object.fromEntries(fixtures.map((w,i) => [w.id, {lastOpenedAt:Date.now()-i*86400000,openCount:1}]))
    window.__depthCheck = { shelf,ui,fixtures,work:__ns.getWork() }
  })
  await page.waitForSelector('.crimson-chapter-card')
  const viewer=page.locator('.crimson-book-display')
  async function ready(){await page.waitForSelector('.crimson-book-display[data-state="ready"]',{timeout:60000});await settled()}
  async function diag(){return page.evaluate(async()=> window.__bookRendererApi.getBook3DDiagnostics())}
  async function idle(){
    await page.evaluate(()=>new Promise(requestAnimationFrame))
    await page.waitForFunction(()=>{
      const frames=window.__bookRendererApi.getBook3DDiagnostics().frames,now=performance.now(),old=window.__stableFrames
      if(!old||old.frames!==frames){window.__stableFrames={frames,at:now};return false}
      return now-old.at>130
    });return diag()
  }
  async function reset(){await page.getByRole('button',{name:'复位视角',exact:true}).click();await idle()}
  async function restore(){await page.evaluate(async()=>{await __depthCheck.work.closeWork();__depthCheck.shelf.works=__depthCheck.fixtures});await ready();await page.waitForFunction(()=>document.querySelectorAll('.crimson-book-thumbnail[data-poster="ready"]').length===5)}
  await ready()
  await page.evaluate(async()=>{const source=await (await fetch('/src/components/CrimsonBookViewer.vue')).text();const path=source.match(/import\(["']([^"']*book3d\/renderer[^"']*)/)[1];window.__bookRendererApi=await import(path)})
  await page.waitForFunction(()=>document.querySelectorAll('.crimson-book-thumbnail[data-poster="ready"]').length===5,null,{timeout:60000})
  check((await diag()).viewers===1&&(await diag()).posterRenderers===1&&(await diag()).models===2,'one live viewer and one shared directory renderer')
  check(await viewer.locator('canvas').evaluate(c=>c.width/c.clientWidth===2),'renderer uses capped device pixel ratio at high density')
  const defaultPose=await viewer.getAttribute('data-rotation')
  for(const [width,height] of [[1440,900],[1024,768],[800,680]]){
    await page.setViewportSize({width,height});await idle();await shot('front-'+width);report.layouts[width]=await layout()
    check(await page.evaluate(()=>{
      const r=document.querySelector('.crimson-book-display').getBoundingClientRect(),s=document.querySelector('.crimson-stage').getBoundingClientRect(),c=document.querySelector('.crimson-chapter-card').getBoundingClientRect(),a=document.querySelector('.crimson-story-actions').getBoundingClientRect()
      return r.left>=a.right&&r.right<=s.right&&r.bottom<c.top&&r.top>s.top&&document.documentElement.scrollWidth<=innerWidth
    }),width+': rotation area stays clear of writing controls, directory and chapter card')
    check(await page.locator('.crimson-work-row').evaluateAll(rows=>rows.every(row=>row.querySelector('.crimson-work-copy').getBoundingClientRect().right<=row.querySelector('.crimson-work-menu').getBoundingClientRect().left)),width+': directory title never overlaps menu')
    await viewer.focus();await page.keyboard.press('ArrowDown');await page.keyboard.press('ArrowRight');await page.mouse.move((await viewer.boundingBox()).x+10,(await viewer.boundingBox()).y+10);await page.mouse.wheel(0,-2000);await idle()
    check(await viewer.getAttribute('data-zoom')==='1.350',width+': maximum zoom is constrained')
    await shot('rotated-max-'+width);await reset()
  }
  await page.setViewportSize({width:1440,height:900});await idle()
  await viewer.focus();for(let i=0;i<6;i++)await page.keyboard.press('ArrowLeft');await idle();await shot('paper-edge')
  for(let i=0;i<6;i++)await page.keyboard.press('ArrowLeft');await idle();await shot('back')
  await reset();await viewer.focus();for(let i=0;i<6;i++)await page.keyboard.press('ArrowRight');await idle();await shot('spine')
  await reset();await viewer.focus();for(let i=0;i<5;i++)await page.keyboard.press('ArrowDown');await idle();await shot('top')
  await reset()
  const clip=await viewer.boundingBox(),cdp=await context.newCDPSession(page)
  const detail=await cdp.send('Page.captureScreenshot',{format:'png',clip:{...clip,scale:2}})
  writeFileSync(new URL('book-detail@2x.png',out),Buffer.from(detail.data,'base64'))
  const alpha=await page.evaluate(async()=>{
    const {createBookRenderer}=window.__bookRendererApi,{Quaternion,Euler}=await import('/node_modules/.vite/deps/three.js')
    const canvas=document.createElement('canvas'),r=createBookRenderer(canvas),book=__depthCheck.fixtures[0],results=[]
    try{r.setBook(book);for(const [w,h] of [[500,456],[360,350],[260,268]]){
      r.resize(w,h)
      for(const angles of [[0,0,0],[0,Math.PI/2,0],[0,Math.PI,0],[Math.PI/2,0,0],[.8,1.2,.7],[1.1,2.5,2]]){
        const q=new Quaternion().setFromEuler(new Euler(...angles)).toArray();r.render(q,1.35)
        const img=new Image();img.src=r.capture();await img.decode();const target=document.createElement('canvas');target.width=w;target.height=h;const ctx=target.getContext('2d');ctx.drawImage(img,0,0);const p=ctx.getImageData(0,0,w,h).data
        let edge=false,solid=0;for(let y=0;y<h;y++)for(let x=0;x<w;x++){if(p[(y*w+x)*4+3]>240){solid++;if(x<2||y<2||x>w-3||y>h-3)edge=true}}
        results.push({w,h,angles,solid,edge})
      }
    }}finally{r.dispose()}return results
  })
  check(alpha.every(x=>x.solid>100&&!x.edge),'18 rendered angle/viewport combinations remain complete at maximum zoom')
  report.renderBounds=alpha
  const before=await viewer.getAttribute('data-rotation'),box=await viewer.boundingBox()
  report.dragVideo={start:(Date.now()-videoStarted)/1000}
  await page.mouse.move(box.x+box.width*.48,box.y+box.height*.5);await page.mouse.down()
  for(let i=1;i<=28;i++){await page.mouse.move(box.x+box.width*.48+i*5,box.y+box.height*.5+Math.sin(i/9)*38);await page.waitForTimeout(16)}
  await page.mouse.up();await idle()
  report.dragVideo.end=(Date.now()-videoStarted)/1000
  check(before!==await viewer.getAttribute('data-rotation')&&await page.evaluate(()=>__depthCheck.ui.view==='shelf'),'normal-speed drag rotates and does not open work')
  await reset();check(await viewer.getAttribute('data-rotation')===defaultPose,'reset restores original quaternion')
  await viewer.hover();await page.mouse.wheel(0,20000);await idle();check(await viewer.getAttribute('data-zoom')==='0.800','minimum zoom is constrained');await reset()
  await viewer.focus();await page.keyboard.press('ArrowRight');await idle();check(await viewer.getAttribute('data-rotation')!==defaultPose,'keyboard arrow rotates by controller step');await page.keyboard.press('Home');await idle();check(await viewer.getAttribute('data-rotation')===defaultPose,'Home resets view')
  const calm=await idle();await page.waitForTimeout(150);check((await diag()).frames===calm.frames,'static scene stops drawing')
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'))})
  const hiddenFrames=(await diag()).frames;await viewer.focus();await page.keyboard.press('ArrowRight');await page.waitForTimeout(150);check((await diag()).frames===hiddenFrames,'background visibility hook suspends requested drawing')
  await page.evaluate(async()=>{
    __depthCheck.shelf.works[0].intro='后台更新的真实简介'
    __depthCheck.shelf.works[1].intro='后台更新的目录简介'
    await window.__bookRendererApi.getBookPoster({...__depthCheck.shelf.works[1]})
    await document.fonts.ready
  })
  check((await diag()).frames===hiddenFrames,'background metadata updates defer main and directory rendering')
  await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'))});await idle()
  await page.emulateMedia({reducedMotion:'reduce'});await reset()
  await page.mouse.move(box.x+220,box.y+220);await page.mouse.down();await page.mouse.move(box.x+290,box.y+255,{steps:8});await page.mouse.up();await idle()
  const reducedPose=await viewer.getAttribute('data-rotation');await page.waitForTimeout(150);check(reducedPose===await viewer.getAttribute('data-rotation')&&reducedPose!==defaultPose,'reduced motion keeps manual rotation and removes inertia')
  await page.getByRole('button',{name:'重播演出',exact:true}).click();check(await page.evaluate(()=>!document.body.dataset.stagePlay),'reduced motion removes decorative performance')
  await page.emulateMedia({reducedMotion:'no-preference'});await page.getByRole('button',{name:'重播演出',exact:true}).click();await settled();check(await viewer.isVisible(),'performance replay finishes without overwriting viewer pose');await reset()
  await page.locator('.crimson-work-row .crimson-work-menu button').first().click();check(await page.getByText('编辑信息',{exact:true}).count()>0,'directory menu opens');await page.locator('.crimson-toolbar h2').click();await page.waitForSelector('.n-dropdown',{state:'hidden'})
  await page.locator('.crimson-book-stage .crimson-work-menu button').click();check(await page.getByText('编辑信息',{exact:true}).count()>0,'main menu remains separate from gesture target');await page.locator('.crimson-toolbar h2').click();await page.waitForSelector('.n-dropdown',{state:'hidden'})
  // Real store mutations only occur in this browser context's disposable IndexedDB.
  const oldPoster=await page.locator('.crimson-book-thumbnail img').first().getAttribute('src')
  await page.evaluate(()=>{__depthCheck.shelf.works[1].title='修订后的白昼';__depthCheck.shelf.works[1].intro='修订后的真实简介'})
  await page.waitForFunction(old=>document.querySelector('.crimson-book-thumbnail img')?.src!==old,oldPoster)
  check(oldPoster!==await page.locator('.crimson-book-thumbnail img').first().getAttribute('src'),'editing directory metadata invalidates poster cache')
  const coverBefore=await viewer.locator('canvas').screenshot()
  await page.evaluate(()=>{__depthCheck.shelf.works[0].title='星尘旅人 · 修订版';__depthCheck.shelf.works[0].intro='从真实作品资料更新的封底简介。'})
  await page.waitForFunction(()=>document.querySelector('.crimson-book-display').getAttribute('aria-label').includes('修订版'));await idle()
  check(!coverBefore.equals(await viewer.locator('canvas').screenshot()),'editing featured metadata regenerates its rendered texture')
  await page.evaluate(()=>{__depthCheck.shelf.works[0].title='星尘旅人';__depthCheck.shelf.works[0].intro='一枚铜星的熄灭，唤醒了一张被遗忘的星图。'});await idle()
  const search=page.getByRole('searchbox',{name:'搜索作品'})
  for(const book of await page.evaluate(()=>__depthCheck.fixtures.map(w=>({title:w.title,kind:w.kind})))){
    await search.fill(book.title);await ready();await idle();check((await viewer.getAttribute('aria-label')).includes(book.title),'full accessible title and material: '+book.kind);await shot('cover-'+book.kind)
    if(book.kind==='violet'){await viewer.focus();for(let i=0;i<12;i++)await page.keyboard.press('ArrowRight');await idle();await shot('back-no-author-or-intro');await reset()}
  }
  await search.fill('不存在的作品');await page.waitForSelector('.crimson-empty');check(await viewer.count()===0,'search no-results removes stale WebGL view')
  await search.fill('');await ready();await page.waitForFunction(()=>document.querySelectorAll('.crimson-book-thumbnail[data-poster="ready"]').length===5)
  await page.locator('.crimson-story-actions .crimson-quiet').focus();await page.keyboard.press('Tab');check(await viewer.evaluate(el=>el.matches(':focus-visible')),'viewer has visible keyboard focus')
  await page.evaluate(()=>{const open=__depthCheck.work.open;__depthCheck.work.open=async function(...args){await new Promise(resolve=>{__depthCheck.releaseOpen=resolve});__depthCheck.work.open=open;return open.apply(this,args)}})
  await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelector('.crimson-book-display')?.getAttribute('aria-disabled')==='true')
  check(await page.locator('.crimson-work-open').evaluateAll(els=>els.every(el=>el.disabled)),'busy opening disables viewer and directory')
  const disabledPose=await viewer.getAttribute('data-rotation');await page.keyboard.press('ArrowRight');await page.mouse.move(box.x+250,box.y+200);await page.mouse.wheel(0,-200);check(disabledPose===await viewer.getAttribute('data-rotation'),'busy viewer ignores controls')
  await page.evaluate(()=>__depthCheck.releaseOpen());await page.waitForFunction(()=>__depthCheck.ui.view==='work'&&__depthCheck.work.work?.title==='星尘旅人');check(true,'Enter opens original featured work');await restore()
  await viewer.click();await page.waitForFunction(()=>__depthCheck.ui.view==='work'&&__depthCheck.work.work?.title==='星尘旅人');check(true,'stationary click opens work');await restore()
  const directoryTitle=(await page.locator('.crimson-work-open h3').first().innerText()).trim();await page.locator('.crimson-work-open').first().click();await page.waitForFunction(title=>__depthCheck.ui.view==='work'&&__depthCheck.work.work?.title===title,directoryTitle);check(true,'directory click opens work directly');await restore()
  await page.evaluate(()=>{__depthCheck.shelf.loading=true});await settled();check(await viewer.getAttribute('aria-disabled')==='true','loading disables rotation and opening');await page.evaluate(()=>{__depthCheck.shelf.loading=false});await settled()
  for(let i=0;i<3;i++){
    await page.evaluate(()=>__depthCheck.ui.setSkin('original'));await page.waitForSelector('.crimson-book-viewer',{state:'detached'});await page.waitForFunction(async()=>{const d=window.__bookRendererApi.getBook3DDiagnostics();return d.viewers===0&&d.posterRenderers===0&&d.models===0&&d.cachedPosters===0});
    await page.evaluate(()=>__depthCheck.ui.setSkin('crimson'));await ready();await page.waitForFunction(()=>document.querySelectorAll('.crimson-book-thumbnail[data-poster="ready"]').length===5)
  }
  check((await diag()).models===2,'three skin exit/reentry cycles release and recreate exactly two models')
  await viewer.evaluate(el=>el.querySelector('canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());await page.waitForSelector('.crimson-book-display[data-state="fallback"]')
  check(await page.locator('.crimson-viewer-fallback img').count()===1,'context loss falls back to last same-style render');await shot('context-loss-fallback')
  await viewer.click();await page.waitForFunction(()=>__depthCheck.ui.view==='work');check(true,'fallback click still opens work');await restore()
  await page.evaluate(()=>{__depthCheck.shelf.works=[]});await page.waitForSelector('.crimson-empty');check(await page.getByText('写下你的第一个故事',{exact:true}).isVisible(),'empty bookshelf unchanged')
  // A separate emulated touchscreen and a forced-WebGL-failure context.
  for(const fail of [false,true]){
    const other=await browser.newContext({hasTouch:true,viewport:{width:1024,height:768}})
    if(fail)await other.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(kind,...args){return /^webgl/.test(kind)?null:get.call(this,kind,...args)}})
    try{
      const p=await other.newPage();await p.goto('http://127.0.0.1:5173/',{waitUntil:'networkidle'});await p.waitForFunction(()=>window.__ns&&document.querySelector('#app').__vue_app__?.config.globalProperties.$pinia._s.has('shelf'))
      await p.evaluate(async()=>{const stores=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s;await stores.get('ui').setSkin('crimson');const s=stores.get('shelf'),w=await s.createWork({title:'触屏典藏',kind:'claret',author:'',intro:'',withVolume:true});s.works=[w]})
      await p.waitForSelector('.crimson-book-display[data-state="'+(fail?'fallback':'ready')+'"]');await p.evaluate(async()=>{await document.fonts.ready;await Promise.all(document.getAnimations().map(a=>a.finished.catch(()=>{})))})
      const v=p.locator('.crimson-book-display'),b=await v.boundingBox()
      if(!fail){
        const touch=await other.newCDPSession(p),point=(id,x,y)=>({id,x,y,radiusX:2,radiusY:2})
        await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point(1,b.x+b.width/2-25,b.y+b.height/2),point(2,b.x+b.width/2+25,b.y+b.height/2)]})
        await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[point(1,b.x+b.width/2-60,b.y+b.height/2),point(2,b.x+b.width/2+60,b.y+b.height/2)]})
        await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForFunction(()=>document.querySelector('.crimson-book-display').dataset.zoom==='1.350');check(true,'real touch pinch scales without opening')
        const pose=await v.getAttribute('data-rotation');await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point(1,b.x+b.width/2,b.y+b.height/2)]});await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[point(1,b.x+b.width/2+70,b.y+b.height/2+40)]});await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForFunction(old=>document.querySelector('.crimson-book-display').dataset.rotation!==old,pose);check(true,'single-finger drag rotates without opening')
      }else{check(await v.isVisible(),'WebGL unavailable shows static leather binding');await p.screenshot({path:fileURLToPath(new URL('webgl-unavailable.png',out))});await v.tap();await p.waitForSelector('.crimson-book-display',{state:'detached'});check(true,'WebGL unavailable still permits opening')}
    }finally{await other.close()}
  }
  check(errors.length===0,'no browser runtime errors')
  writeFileSync(new URL('report.json',out),JSON.stringify(report,null,2));console.log(report.checks.length+' checks passed')
}catch(error){await page.screenshot({path:fileURLToPath(new URL('error.png',out))});console.log('STATE',await page.locator('.crimson-book-display').getAttribute('data-state').catch(()=>null));throw error}
finally{await context.close();await page.video().saveAs(fileURLToPath(new URL('verification.webm',out)));await browser.close()}
