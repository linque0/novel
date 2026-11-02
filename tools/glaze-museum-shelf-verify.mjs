import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { mkdirSync, writeFileSync } from 'node:fs'
const require=createRequire(import.meta.url)
const {chromium}=require(require.resolve('playwright',{paths:[join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node')]}))
const out=join(process.cwd(),'tools','_writing-evidence','museum-shelf')
mkdirSync(out,{recursive:true})
const browser=await chromium.launch({channel:'msedge',headless:true})
const context=await browser.newContext({viewport:{width:1440,height:900}})
const page=await context.newPage(),errors=[],checks=[]
page.on('pageerror',e=>errors.push(e.message))
const check=(value,name)=>{assert.ok(value,name);checks.push(name);console.log('PASS '+name)}
const selected=()=>page.locator('.gg-plaque').getAttribute('data-work-id')
try {
  await page.goto(process.env.MUSEUM_TEST_URL||'http://127.0.0.1:5176/',{waitUntil:'networkidle'})
  await page.waitForFunction(()=>window.__ns&&document.querySelector('#app').__vue_app__?.config.globalProperties.$pinia._s.get('shelf'))
  await page.evaluate(async()=>{
    const stores=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s,shelf=stores.get('shelf'),ui=stores.get('ui')
    await __ns.db.works.clear()
    const titles=['星尘旅人','白昼','山海拾遗录','雾都来信','一部名字很长的中文与 English 混排小说','无名之书']
    for(const [i,title] of titles.entries()){
      const book=await shelf.createWork({title,author:i===3?'':'林间',intro:'一枚铜星的熄灭，唤醒了一张被遗忘的星图。',genre:'奇幻',status:'连载'})
      if(i<2)await __ns.db.chapters.put({id:'shelf-test-chapter-'+i,workId:book.id,volumeId:null,title:'接续章节 '+i,content:'<p>测试</p>',sortOrder:0,wordCount:2,createdAt:Date.now(),updatedAt:Date.now(),deletedAt:null})
    }
    await shelf.refresh();await ui.setSkin('glaze');window.__museumShelf={shelf,ui,fixtures:[...shelf.works]}
  })
  await page.waitForSelector('.glaze-artwork-image')
  await page.waitForFunction(()=>document.querySelector('.glaze-artwork-image')?.naturalWidth>0)
  await page.evaluate(()=>document.fonts.ready)
  check(await page.locator('.gg-index-item').count()===6,'six real works in the directory')
  check(await page.locator('.gg-easel,.gg-viewport,.gg-book').count()===0,'legacy easels and carousel are absent')
  const first=await selected()
  await page.locator('.gg-index-item').nth(1).click()
  const second=await selected()
  check(first!==second,'row click selects the work')
  check(await page.evaluate(()=>__museumShelf.ui.view==='shelf'),'row selection stays on shelf')
  await page.locator('.gg-index-item').nth(5).click()
  const last=await selected()
  await page.getByRole('button',{name:'下一部作品',exact:true}).click()
  check(await selected()===first,'next wraps from last to first')
  await page.getByRole('button',{name:'上一部作品',exact:true}).click()
  check(await selected()===last,'previous wraps from first to last')
  await page.locator('.gg-index-item').last().focus();await page.keyboard.press('ArrowDown')
  check(await selected()===first,'directory down arrow wraps')
  check(await page.locator('.gg-index-item').first().evaluate(e=>e===document.activeElement),'keyboard navigation transfers focus to selected row')
  await page.keyboard.press('ArrowUp')
  check(await selected()===last,'directory up arrow wraps')
  await page.locator('.gg-menu button').click();await page.waitForSelector('.n-dropdown-menu')
  await page.keyboard.press('ArrowDown');check(await selected()===last,'menu keyboard cannot change current work');await page.keyboard.press('Escape');await page.locator('.gg-catalog-head h1').click();await page.waitForTimeout(220)
  await page.locator('.gg-index-item',{hasText:'星尘旅人'}).click()
  await page.waitForSelector('.gg-chapter')
  check(await page.locator('.gg-chapter').getAttribute('data-work-id')===await selected(),'resume chapter belongs to the selected work')
  for(const title of ['白昼','星尘旅人','无名之书'])await page.locator('.gg-index-item',{hasText:title}).click()
  check(await page.locator('.gg-chapter').count()===0,'rapid selection to a work without chapters removes stale resume text')
  await page.getByPlaceholder('搜索作品',{exact:true}).fill('白昼')
  await page.waitForFunction(()=>document.querySelectorAll('.gg-index-item').length===1)
  check((await page.locator('.gg-plaque h2').textContent())==='白昼','search resets the current work to the first match')
  await page.getByPlaceholder('搜索作品',{exact:true}).fill('不存在的作品')
  await page.waitForSelector('.gg-empty')
  check((await page.locator('.gg-empty').textContent()).includes('没有匹配'),'empty search preserves the search control and message')
  await page.getByPlaceholder('搜索作品',{exact:true}).fill('')
  await page.waitForSelector('.gg-plaque')
  await page.locator('.gg-index-item',{hasText:'星尘旅人'}).click();await page.waitForSelector('.gg-chapter')
  for(const [width,height,rows] of [[1440,900,6],[1080,680,4],[800,680,0],[720,450,0]]) {
    await page.setViewportSize({width,height})
    const metrics=await page.evaluate(()=>{
      const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right}}
      const list=document.querySelector('.gg-index'),r=list.getBoundingClientRect(),scroller=document.querySelector('.gg-scroll').getBoundingClientRect()
      return {overflow:document.documentElement.scrollWidth>innerWidth,titleSize:parseFloat(getComputedStyle(document.querySelector('.gg-plaque h2')).fontSize),list:rect(list),visible:[...list.children].filter(e=>{const b=e.getBoundingClientRect();return b.top>=r.top-.5&&b.bottom<=Math.min(r.bottom,scroller.bottom)+.5}).length,art:rect(document.querySelector('.glaze-artwork-image')),layout:getComputedStyle(document.querySelector('.gg-layout')).gridTemplateColumns,viewport:{width:innerWidth,height:innerHeight}}
    })
    if(metrics.overflow)console.log('OVERFLOW '+JSON.stringify(await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).map(e=>({tag:e.tagName,cls:typeof e.className==='string'?e.className:'',right:e.getBoundingClientRect().right})).slice(0,12))))
    console.log('LAYOUT '+JSON.stringify(metrics))
    check(!metrics.overflow,'no horizontal page overflow at '+width)
    check(metrics.titleSize>=36,'work title remains readable at '+width)
    if(rows)check(metrics.visible>=rows,rows+' directory rows visible at '+width)
    await page.screenshot({path:join(out,'shelf-'+width+'.png')})
  }
  await page.setViewportSize({width:800,height:680})
  await page.locator('.gm-art-button').click()
  await page.waitForSelector('.gm-art-preview-image')
  check(await page.locator('.gm-art-preview-image').evaluate(e=>getComputedStyle(e).objectFit==='contain'),'narrow shelf offers a complete painting preview')
  await page.keyboard.press('Escape');await page.waitForSelector('.gm-art-preview-image',{state:'hidden'})
  await page.setViewportSize({width:1440,height:900})
  const openedId=await selected()
  await page.locator('.gg-index-item.is-current').focus();await page.keyboard.press('Enter')
  await page.waitForFunction(()=>__museumShelf.ui.view==='work')
  check(await page.evaluate(id=>__ns.getWork().work.id===id,openedId),'Enter opens selected work explicitly')
  await page.evaluate(()=>__ns.getWork().closeWork());await page.waitForSelector('.gg-plaque')
  for(const count of [0,1,2,100]) {
    await page.evaluate(count=>{__museumShelf.shelf.works=Array.from({length:count},(_,i)=>({...__museumShelf.fixtures[i%6],id:i<6?__museumShelf.fixtures[i].id:'extra-'+i}))},count)
    if(!count){await page.waitForSelector('.gg-empty');check(await page.locator('.gg-index-item').count()===0,'empty shelf keeps create/search state');continue}
    await page.waitForSelector('.gg-plaque')
    check(await page.locator('.gg-index-item').count()===count,'directory renders '+count+' works')
    if(count===1)check(await page.locator('.gg-controls').count()===0,'single work hides cycling controls')
  }
  check(errors.length===0,'no page errors')
  writeFileSync(join(out,'report.json'),JSON.stringify({checks,errors},null,2))
} catch(e) {await page.screenshot({path:join(out,'error.png')}).catch(()=>{});throw e}
finally {await context.close();await browser.close()}
