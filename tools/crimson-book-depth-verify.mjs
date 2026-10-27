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
const out = new URL(refined ? 'docs/前端美化/赤月戏-藏书精装-20261026/' : 'docs/前端美化/赤月戏-书籍立体化-20261026/', root)
mkdirSync(out, { recursive: true })
const baseline = process.argv.includes('--baseline')
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
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
    for (const [kind, title, author] of inputs) fixtures.push(await shelf.createWork({ title,author,kind,genre:'奇幻',status:'连载',intro:'一枚铜星的熄灭，唤醒了一张被遗忘的星图。',withVolume:true }))
    const { uid, now } = window.__ns
    await __ns.db.chapters.add({id:uid(),workId:fixtures[0].id,volumeId:null,title:'第一章 · 雾港',content:'<p>穹顶的钟声越过海湾，最后一艘星船驶入黎明。</p>',sortOrder:0,createdAt:now(),updatedAt:now(),deletedAt:null})
    shelf.works = fixtures
    shelf.openStats = Object.fromEntries(fixtures.map((w,i) => [w.id, {lastOpenedAt:Date.now()-i*86400000,openCount:1}]))
    window.__depthCheck = { shelf,ui,fixtures,work:__ns.getWork() }
  })
  await page.waitForSelector('.crimson-chapter-card')
  await settled()
  for (const [w,h] of [[1440,900],[1024,768],[800,680]]) {
    await page.setViewportSize({width:w,height:h})
    await shot((baseline?'before':'after')+'-'+w)
    report.layouts[w] = await layout()
  }
  if (baseline) {
    writeFileSync(new URL('baseline.json',out),JSON.stringify(report,null,2))
    console.log('Baseline captured; no product changes made.')
  } else {
    await page.setViewportSize({width:1440,height:900})
    check(await page.locator('.crimson-book-shell').count() === 6,'all six displayed works use a coherent book shell')
    check(await page.locator('.crimson-book-spine').count() === 0,'independent pasted-on paper strip removed')
    if (refined) {
      check(await page.locator('.crimson-book-object .crimson-cover').evaluate(el=>getComputedStyle(el).backgroundImage==='none'),'cover uses a flat matte color')
      check(await page.locator('.crimson-cover-seal,.crimson-cover-hills,.crimson-cover-rule').count()===0,'duplicate stamps, hills and frame decorations removed')
      check(await page.locator('.crimson-book-shell.is-mini .crimson-cover-title').count()===0,'thumbnails do not truncate titles to two characters')
      check(await page.locator('.crimson-book-shell.is-mini .crimson-cover-moon').evaluateAll(els=>els.length===5&&els.every(el=>getComputedStyle(el).display!=='none')),'all thumbnails carry the same embossed moon motif')
      check(await page.locator('.crimson-book-shell.is-book').evaluate(el=>getComputedStyle(el).getPropertyValue('--book-depth').trim()==='18px'),'main book uses restrained 18px depth')
    }
    const beforeFile = new URL('baseline.json',out)
    if (existsSync(beforeFile)) {
      const before = JSON.parse(readFileSync(beforeFile,'utf8')).layouts
      for (const width of Object.keys(before)) {
        const current = report.layouts[width]
        check(before[width].background === current.background,width+': background unchanged')
        for (const [sel,rect] of Object.entries(before[width])) {
          if (!rect || sel === 'background' || sel === '.crimson-book-object' || sel === '.crimson-work-row') continue
          // The refined directory grows naturally with two-line work titles.
          const keys=Object.keys(rect).filter(key=>!(sel==='.crimson-program'&&key==='h'))
          check(keys.every(key=>Math.abs(rect[key]-current[sel]?.[key])<=1),width+': unchanged layout '+sel)
        }
      }
    }
    for (const width of [1440,1024,800]) {
      await page.setViewportSize({width,height:width===1440?900:width===1024?768:680});await settled()
      check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),width+': no horizontal overflow')
      if (refined) {
        check(await page.locator('.crimson-book-shell.is-mini').first().evaluate((el,width)=>{
          const s=getComputedStyle(el)
          return parseFloat(s.width)===(width>1200?56:44)&&parseFloat(s.height)===(width>1200?80:64)
        },width),width+': thumbnails use the planned book proportions')
        check(await page.locator('.crimson-work-row').evaluateAll(rows=>rows.every(row=>{
          const text=row.querySelector('.crimson-work-copy').getBoundingClientRect(),menu=row.querySelector('.crimson-work-menu').getBoundingClientRect()
          return text.right<=menu.left+1
        })),width+': titles and menus have separate space')
      }
      check(await page.evaluate(()=>{
        const book=document.querySelector('.crimson-book-shell.is-book').getBoundingClientRect(),stage=document.querySelector('.crimson-stage').getBoundingClientRect(),chapter=document.querySelector('.crimson-chapter-card').getBoundingClientRect()
        return book.left>stage.left && book.right<stage.right && book.top>stage.top && book.bottom<chapter.top
      }),width+': book remains inside stage and above chapter card')
    }
    await page.setViewportSize({width:1440,height:900})
    if (refined) {
      const cdp=await context.newCDPSession(page)
      await settled()
      for (const [name,rect] of [
        ['after-1440@2x',{x:0,y:0,width:1440,height:900}],
        ['book-detail@2x',{x:470,y:290,width:300,height:340}],
        ['directory-detail@2x',{x:1125,y:165,width:315,height:640}]
      ]) {
        const capture=await cdp.send('Page.captureScreenshot',{format:'png',clip:{...rect,scale:2}})
        writeFileSync(new URL(name+'.png',out),Buffer.from(capture.data,'base64'))
      }
      await cdp.detach()
    }
    const search = page.getByRole('searchbox',{name:'搜索作品'})
    for (const book of await page.evaluate(()=>__depthCheck.fixtures.map(w=>({title:w.title,kind:w.kind,author:w.author})))) {
      await search.fill(book.title);await settled()
      check(await page.locator('.crimson-book-object .crimson-cover-title').getAttribute('title') === book.title,'search preserves full title: '+book.kind)
      if (refined) {
        check(await page.locator('.crimson-book-object .crimson-cover-title').evaluate(el=>getComputedStyle(el).textShadow==='none'),'clean, unshadowed cover typography: '+book.kind)
        check(await page.locator('.crimson-book-shell.is-book').evaluate(el=>{
          const cover=el.querySelector('.crimson-cover')
          return getComputedStyle(cover).getPropertyValue('--cc').trim()===getComputedStyle(el).getPropertyValue('--cc').trim()
        }),'front and binding share the original palette: '+book.kind)
      }
      check(await page.locator('.crimson-book-shell.is-book').evaluate(el=>{
        const volume=el.querySelector('.crimson-book-volume')
        return getComputedStyle(volume).transformStyle==='preserve-3d' && getComputedStyle(volume).overflow==='visible' && el.querySelector('.crimson-book-pages') && el.querySelector('.crimson-book-back')
      }),'unclipped depth: '+book.kind)
      if(!book.author) check((await page.locator('.crimson-cover-author').innerText()).trim()==='','missing author stays empty')
      await shot('cover-'+book.kind)
    }
    await search.fill('不存在的作品');await page.waitForSelector('.crimson-empty')
    check(await page.locator('.crimson-book-shell').count()===0,'no-results state has no stale book')
    await search.fill('');await page.waitForSelector('.crimson-book-object')
    if (refined) {
      await page.locator('.crimson-toolbar h2').hover();await settled()
      const beforeHover=await page.locator('.crimson-work-open').first().boundingBox()
      await page.locator('.crimson-work-row').first().hover();await settled()
      const afterHover=await page.locator('.crimson-work-open').first().boundingBox()
      check(Math.abs(beforeHover.x-afterHover.x)<.1&&Math.abs(beforeHover.y-afterHover.y)<.1,'directory highlight does not move the row')
      check(await page.locator('.crimson-work-copy h3').evaluateAll(els=>els.every(el=>getComputedStyle(el).webkitLineClamp==='2'&&el.getAttribute('title')===el.textContent.trim())),'directory titles retain complete accessible text with two-line display')
    }
    await page.locator('.crimson-work-row').first().hover()
    await page.locator('.crimson-work-row .crimson-work-menu button').first().click()
    check(await page.getByText('编辑信息',{exact:true}).count()>0,'directory work menu remains accessible')
    await page.locator('.crimson-toolbar h2').click()
    await page.waitForSelector('.n-dropdown',{state:'hidden'})
    await page.locator('.crimson-book-stage .crimson-work-menu button').click()
    check(await page.getByText('编辑信息',{exact:true}).count()>0,'featured work menu remains accessible')
    // This existing click-triggered dropdown closes on outside click, not Escape.
    await page.locator('.crimson-toolbar h2').click()
    await page.waitForSelector('.n-dropdown',{state:'hidden'})
    await page.evaluate(()=>{__depthCheck.shelf.loading=true})
    await settled()
    check(await page.locator('.crimson-book-object').evaluate(el=>{
      const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)
      return !el.contains(hit)
    }),'loading overlay blocks book activation')
    await page.evaluate(()=>{__depthCheck.shelf.loading=false})
    await settled()
    const original = await page.locator('.crimson-book-volume').first().evaluate(el=>getComputedStyle(el).transform)
    await page.locator('.crimson-book-object').hover();await settled()
    check(original!==await page.locator('.crimson-book-volume').first().evaluate(el=>getComputedStyle(el).transform),'hover raises and turns the book')
    await shot('hover')
    await page.emulateMedia({reducedMotion:'reduce'});await settled()
    check(await page.locator('.crimson-book-volume').first().evaluate(el=>parseFloat(getComputedStyle(el).transitionDuration)<.01),'reduced motion suppresses transitions')
    await page.getByRole('button',{name:'重播演出',exact:true}).click()
    check(await page.evaluate(()=>!document.body.dataset.stagePlay),'replay respects reduced motion')
    await page.emulateMedia({reducedMotion:'no-preference'})
    await page.getByRole('button',{name:'重播演出',exact:true}).click();await settled()
    check(await page.locator('.crimson-book-shell').first().isVisible(),'replay finishes with the book visible')
    await page.locator('.crimson-story-actions .crimson-quiet').focus()
    await page.keyboard.press('Tab')
    check(await page.locator('.crimson-book-object').evaluate(el=>el.matches(':focus-visible')),'keyboard focus remains on the open-work button')
    await page.evaluate(()=>{
      const open=__depthCheck.work.open
      __depthCheck.work.open=async function(...args){
        await new Promise(resolve=>{__depthCheck.releaseOpen=resolve})
        __depthCheck.work.open=open
        return open.apply(this,args)
      }
    })
    await page.keyboard.press('Enter')
    await page.waitForFunction(()=>document.querySelector('.crimson-book-object')?.disabled)
    check(await page.locator('.crimson-work-open').evaluateAll(els=>els.every(el=>el.disabled)),'opening disables featured and directory buttons')
    await page.evaluate(()=>__depthCheck.releaseOpen())
    await page.waitForFunction(()=>__depthCheck.ui.view==='work' && __depthCheck.work.work?.title==='星尘旅人')
    check(true,'keyboard confirmation opens the featured work')
    await page.evaluate(async()=>{await __depthCheck.work.closeWork();__depthCheck.shelf.works=__depthCheck.fixtures})
    await page.waitForSelector('.crimson-work-open');await settled()
    const directoryTitle = (await page.locator('.crimson-work-open h3').first().innerText()).trim()
    await page.locator('.crimson-work-open').first().click()
    await page.waitForFunction(title=>__depthCheck.ui.view==='work' && __depthCheck.work.work?.title===title,directoryTitle)
    check(true,'directory click opens its original work')
    await page.evaluate(async()=>{await __depthCheck.work.closeWork();__depthCheck.shelf.works=__depthCheck.fixtures})
    await page.waitForSelector('.crimson-work-open')
    await page.evaluate(()=>{__depthCheck.shelf.works=[]})
    await page.waitForSelector('.crimson-empty')
    check(await page.getByText('写下你的第一个故事',{exact:true}).isVisible(),'empty library remains intact')
    const touchContext=await browser.newContext({hasTouch:true,viewport:{width:1024,height:768}})
    try {
      const touchPage=await touchContext.newPage()
      await touchPage.goto('http://127.0.0.1:5173/',{waitUntil:'networkidle'})
      await touchPage.waitForFunction(()=>window.__ns&&document.querySelector('#app').__vue_app__?.config.globalProperties.$pinia._s.has('shelf'))
      await touchPage.evaluate(async()=>{
        const p=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
        await p._s.get('ui').setSkin('crimson')
        const s=p._s.get('shelf'),w=await s.createWork({title:'触屏书封',kind:'note',genre:'其他',status:'构思',withVolume:true})
        s.works=[w]
        await document.fonts.ready
      })
      await touchPage.waitForSelector('.crimson-book-volume')
      check(await touchPage.evaluate(()=>!matchMedia('(hover: hover) and (pointer: fine)').matches),'touch context uses static presentation')
      const pose=await touchPage.locator('.crimson-book-volume').evaluate(el=>getComputedStyle(el).transform)
      await touchPage.locator('.crimson-book-object').focus()
      check(pose===await touchPage.locator('.crimson-book-volume').evaluate(el=>getComputedStyle(el).transform),'touch focus does not tilt or raise the book')
    } finally {await touchContext.close()}
    check(errors.length===0,'no browser runtime errors')
    writeFileSync(new URL('report.json',out),JSON.stringify(report,null,2))
    console.log(report.checks.length+' checks passed')
  }
} finally { await context.close();await browser.close() }
