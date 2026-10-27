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
const out = new URL('docs/前端美化/双皮肤专属书籍-20261027/', root)
mkdirSync(out, { recursive: true })
const baseline = process.argv.includes('--baseline')
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 },deviceScaleFactor:2,timezoneId:'Asia/Shanghai' })
const page = await context.newPage()
const errors = []
page.on('pageerror', error => errors.push(error.message))
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
    window.__depthCheck = { shelf,ui,fixtures,originals:fixtures.map(w=>({...w})),work:__ns.getWork() }
  })

  await page.evaluate(async()=>{const source=await(await fetch('/src/components/ThemeBook.vue')).text(),path=source.match(/import\(["']([^"']*book3d\/renderer[^"']*)/)[1];window.__artApi=await import(path)})
  async function ready(){
    await settled()
    await page.waitForFunction(()=>[...document.querySelectorAll('.theme-book')].filter(e=>{const r=e.getBoundingClientRect();return r.top<innerHeight&&r.bottom>0&&r.left<innerWidth&&r.right>0}).every(e=>e.dataset.poster==='ready'),null,{timeout:60000})
  }
  const diag=()=>page.evaluate(()=>__artApi.getBook3DDiagnostics())
  async function restore(){await page.evaluate(async()=>{await __depthCheck.work.closeWork();__depthCheck.shelf.works=__depthCheck.fixtures});await ready()}
  async function contact(skin,faces=false){
    await page.evaluate(async({skin,faces})=>{
      const books=faces?['front','back','spine','paper','top','lying'].map(pose=>({book:__depthCheck.fixtures[0],pose})):__depthCheck.fixtures.map(book=>({book,pose:'front'}))
      const results=[]
      for(const entry of books)results.push({...entry,url:await __artApi.getBookPoster(entry.book,{theme:skin,size:entry.pose==='lying'?'landscape':'hero',pose:entry.pose})})
      const overlay=document.createElement('div');overlay.id='art-contact';Object.assign(overlay.style,{position:'fixed',inset:'0',zIndex:2147483000,background:skin==='gravity'?'#0b131d':'#e9efed',display:'grid',gridTemplateColumns:'repeat(6,minmax(0,1fr))',gap:'12px',padding:'45px 20px',color:skin==='gravity'?'#dbe5e8':'#34505a'})
      for(const result of results){const item=document.createElement('div'),img=document.createElement('img'),caption=document.createElement('p');img.src=result.url;Object.assign(img.style,{display:'block',width:'100%',height:'500px',objectFit:'contain'});caption.textContent=faces?result.pose:result.book.title;Object.assign(caption.style,{font:'16px/1.6 sans-serif',margin:'20px 8px'});item.append(img,caption);overlay.append(item)}
      document.body.append(overlay);await Promise.all([...overlay.querySelectorAll('img')].map(i=>i.decode()))
    },{skin,faces})
    await page.screenshot({path:fileURLToPath(new URL(skin+(faces?'-faces':'-six-covers')+'.png',out))});await page.locator('#art-contact').evaluate(e=>e.remove())
  }
  for(const skin of ['gravity','glaze']){
    await page.setViewportSize({width:1440,height:900});await page.evaluate(async skin=>{const d=__depthCheck;d.fixtures.forEach((w,i)=>Object.assign(w,d.originals[i]));d.shelf.works=[...d.fixtures];d.shelf.openStats=Object.fromEntries(d.fixtures.map((w,i)=>[w.id,{lastOpenedAt:Date.now()-i*86400000,openCount:1}]));await d.ui.setSkin(skin)},skin);await page.waitForSelector('.'+skin+'-shelf');await ready()
    check(await page.locator('[data-book-theme="'+skin+'"][data-poster="ready"]').count()>=6,skin+': main, companions and library use the same rendered book family')
    check((await diag()).posterRenderers===1&&(await diag()).viewers===0&&(await diag()).models===1,skin+': one transient renderer for all book artwork')
    const frame=(await diag()).frames;await page.waitForTimeout(150);check((await diag()).frames===frame,skin+': static artwork does not run a render loop')
    for(const [width,height] of [[1440,900],[1024,768],[800,680]]){
      await page.setViewportSize({width,height});await ready();await page.screenshot({path:fileURLToPath(new URL('after-'+skin+'-'+width+'.png',out))})
      check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),skin+' '+width+': no horizontal page overflow')
      check(await page.locator('.theme-book.is-mini').evaluateAll((els,skin)=>els.every(e=>{const r=e.getBoundingClientRect();return r.width<=(skin==='gravity'?65:59)&&r.height<96}),skin),skin+' '+width+': thumbnails retain compact dimensions')
      check(await page.evaluate(skin=>{
        const a=document.querySelector(skin==='gravity'?'.gravity-feature-actions':'.glaze-feature-actions').getBoundingClientRect(),book=document.querySelector(skin==='gravity'?'.gravity-slot--center .gravity-book-open':'.glaze-stage-book.pose-0').getBoundingClientRect()
        return book.left>=a.right-1
      },skin),skin+' '+width+': main book does not overlap writing controls')
      if(skin==='glaze')check(await page.evaluate(()=>{const main=document.querySelector('.glaze-feature-stack').getBoundingClientRect(),note=document.querySelector('.glaze-chapter-note').getBoundingClientRect(),collection=document.querySelector('.glaze-collection').getBoundingClientRect(),lying=document.querySelector('.glaze-stage-book.pose-2').getBoundingClientRect();return note.top>=main.bottom-4&&note.bottom<collection.top+1&&lying.right<=innerWidth-20}),skin+' '+width+': chapter note and lying book fit the exhibition area')
    }
    await page.setViewportSize({width:1440,height:900});await ready();await contact(skin);await contact(skin,true)
    const bounds=await page.evaluate(async skin=>{
      const result=[]
      for(const pose of ['front','back','spine','paper','top','lying']){
        const url=await __artApi.getBookPoster(__depthCheck.fixtures[0],{theme:skin,size:pose==='lying'?'landscape':'hero',pose}),img=new Image();img.src=url;await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);const p=ctx.getImageData(0,0,c.width,c.height).data;let clipped=false,solid=0
        for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(p[(y*c.width+x)*4+3]>240){solid++;if(x<1||y<1||x>=c.width-1||y>=c.height-1)clipped=true}
        result.push({pose,solid,clipped})
      }return result
    },skin)
    report[skin+'Bounds']=bounds;check(bounds.every(x=>!x.clipped&&x.solid>1000),skin+': all six model views contain a complete book')
    if(skin==='gravity'){
      const target=(await page.locator('.gravity-library-copy strong').first().textContent()).trim();await page.locator('.gravity-library-open').first().click();await page.waitForFunction(target=>document.querySelector('.gravity-feature-copy h2')?.textContent===target,target);check(await page.evaluate(()=>__depthCheck.ui.view==='shelf'),'gravity: library selection moves book to center without opening')
      await page.locator('.gravity-orbit-stage').focus();await page.keyboard.press('ArrowRight');await settled();check((await page.locator('.gravity-feature-copy h2').textContent()).trim()!==target,'gravity: outer arrow keys still switch selected work')
      await page.getByPlaceholder(/搜索作品/).fill('不存在的作品');await page.waitForSelector('.gravity-empty');await page.getByPlaceholder(/搜索作品/).fill('');await ready()
    }
    const mainMenu=page.locator(skin==='gravity'?'.gravity-slot--center .gravity-book-menu button':'.glaze-stage-book.pose-0 .glaze-work-menu button')
    await mainMenu.click();check(await page.getByText('编辑信息',{exact:true}).count()>0,skin+': main menu stays accessible');await page.locator(skin==='gravity'?'.gravity-heading h1':'.glaze-shelf-tools h1').click();await page.waitForSelector('.n-dropdown',{state:'hidden'})
    const mini=page.locator('.theme-book.is-mini img').first(),before=await mini.getAttribute('src')
    const editedTitle=await page.locator('.'+skin+'-library-open strong[title]').first().getAttribute('title')
    await page.evaluate(({skin,title})=>{const book=__depthCheck.shelf.works.find(w=>w.title===title);book.author=skin==='gravity'?'新作家甲':'新作家乙';book.intro='修订后的真实作品简介。'+skin},{skin,title:editedTitle})
    await page.waitForFunction(({skin,old})=>document.querySelector('.'+skin+'-shelf .theme-book.is-mini img')?.src!==old,{skin,old:before});await ready();check(before!==await mini.getAttribute('src'),skin+': metadata edits invalidate book artwork')
    await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'))})
    const hidden=(await diag()).frames
    await page.evaluate(async skin=>{__depthCheck.shelf.works[0].intro='后台资料更新 '+skin;await __artApi.getBookPoster({...__depthCheck.shelf.works[0]},{theme:skin,size:'hero'})},skin)
    check((await diag()).frames===hidden,skin+': background metadata does not render')
    await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'))});await ready()
    const search=page.getByPlaceholder(/搜索作品/)
    for(const book of await page.evaluate(()=>__depthCheck.fixtures.map(w=>({title:w.title,kind:w.kind})))){
      await search.fill(book.title);await ready();check(await page.locator('[data-book-theme="'+skin+'"][data-poster="ready"]').count()>0,skin+': six-style search and full title '+book.kind)
    }
    await search.fill('不存在的作品');await page.waitForSelector('.'+skin+'-empty');check(await page.locator('.theme-book').count()===0,skin+': no-results clears model artwork');await search.fill('');await ready()
    const main=page.locator(skin==='gravity'?'.gravity-slot--center .gravity-book-open':'.glaze-stage-book.pose-0 .glaze-stage-open')
    await page.evaluate(()=>{__depthCheck.shelf.loading=true});await settled();check(await main.evaluate(e=>e.disabled||!e.contains(document.elementFromPoint(e.getBoundingClientRect().x+20,e.getBoundingClientRect().y+20))),skin+': loading blocks opening');await page.evaluate(()=>{__depthCheck.shelf.loading=false});await ready()
    const label=await main.getAttribute('aria-label'),title=skin==='gravity'?label.replace('打开作品：',''):label.slice(3,-1)
    await main.focus();await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');check(await main.evaluate(e=>e.matches(':focus-visible')),skin+': keyboard focus remains visible')
    await page.keyboard.press('Enter');await page.waitForFunction(title=>__depthCheck.ui.view==='work'&&__depthCheck.work.work?.title===title,title);check(true,skin+': main Enter opens original work');await restore()
    if(skin==='glaze'){await page.locator('.glaze-stage-book.pose-2 .glaze-stage-open').click();await page.waitForFunction(()=>__depthCheck.ui.view==='work');check(true,'glaze: lying companion opens directly');await restore();await page.locator('.glaze-library-open').first().click();await page.waitForFunction(()=>__depthCheck.ui.view==='work');check(true,'glaze: library opens directly');await restore()}
    await page.emulateMedia({reducedMotion:'reduce'});check(await main.evaluate(e=>getComputedStyle(e).transitionDuration.split(',').every(x=>parseFloat(x)===0)),skin+': reduced motion removes book movement');await page.emulateMedia({reducedMotion:'no-preference'})
    await page.evaluate(()=>{__depthCheck.shelf.works=[]});await page.waitForSelector('.'+skin+'-empty');check(await page.getByText(skin==='gravity'?'为你的第一个世界，落笔。':'写下你的第一个故事',{exact:true}).isVisible(),skin+': empty library remains intact');await page.evaluate(()=>{__depthCheck.shelf.works=__depthCheck.fixtures});await ready()
    await page.evaluate(()=>__depthCheck.ui.setSkin('original'));await page.waitForFunction(()=>__artApi.getBook3DDiagnostics().models===0&&__artApi.getBook3DDiagnostics().posterRenderers===0&&__artApi.getBook3DDiagnostics().cachedPosters===0);check(true,skin+': leaving shelf releases model, renderer and cache')
  }
  const fallback=await browser.newContext({viewport:{width:1024,height:768},hasTouch:true})
  try{
    await fallback.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(kind,...args){return /^webgl/.test(kind)?null:get.call(this,kind,...args)}})
    const p=await fallback.newPage();await p.goto('http://127.0.0.1:5173/',{waitUntil:'networkidle'});await p.waitForFunction(()=>window.__ns&&document.querySelector('#app').__vue_app__?.config.globalProperties.$pinia._s.has('shelf'))
    await p.evaluate(async()=>{const s=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s;window.__fallbackStores=s;const w=await s.get('shelf').createWork({title:'触屏典藏',kind:'cedar',author:'测试作者',intro:'',withVolume:true});s.get('shelf').works=[w]})
    for(const skin of ['gravity','glaze']){
      await p.evaluate(skin=>__fallbackStores.get('ui').setSkin(skin),skin);await p.waitForSelector('.theme-book[data-poster="fallback"]');check(await p.locator('.theme-fallback-title').first().textContent()==='触屏典藏',skin+': WebGL unavailable retains complete title and themed static binding');await p.screenshot({path:fileURLToPath(new URL('fallback-'+skin+'.png',out))})
      await p.locator(skin==='gravity'?'.gravity-slot--center .gravity-book-open':'.glaze-stage-book.pose-0 .glaze-stage-open').tap();await p.waitForFunction(()=>__fallbackStores.get('ui').view==='work');check(true,skin+': fallback touch still opens work');await p.evaluate(()=>__ns.getWork().closeWork())
    }
  }finally{await fallback.close()}
  check(errors.length===0,'no browser runtime errors')
  writeFileSync(new URL('report.json',out),JSON.stringify(report,null,2));console.log(report.checks.length+' checks passed')
}catch(error){await page.screenshot({path:fileURLToPath(new URL('error.png',out))});throw error}
finally{await context.close();await browser.close()}
