import {createRequire} from 'node:module'
import {homedir} from 'node:os'
import {join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {mkdirSync} from 'node:fs'
import {spawnSync} from 'node:child_process'
const require=createRequire(import.meta.url)
const {chromium}=require(require.resolve('playwright',{paths:[join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node')]}))
const out=new URL('../docs/前端美化/琉光画架长廊-20261028/',import.meta.url);mkdirSync(out,{recursive:true})
const browser=await chromium.launch({channel:'msedge',headless:true})
const context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:fileURLToPath(new URL('video/',out)),size:{width:1440,height:900}}})
const opened=Date.now(),page=await context.newPage()
let start,duration,raw
const settle=()=>page.evaluate(()=>Promise.all(document.getAnimations().filter(a=>a.effect?.getComputedTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{}))))
try{
  await page.goto('http://127.0.0.1:5173/',{waitUntil:'networkidle'})
  await page.waitForFunction(()=>window.__ns&&document.querySelector('#app').__vue_app__?.config.globalProperties.$pinia._s.get('shelf')?.works.length>=6)
  await page.evaluate(async()=>{
    const stores=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s,shelf=stores.get('shelf')
    const titles=['星尘旅人','白昼','山海拾遗录','雾都来信','一部名字很长的中文与 English 混排小说','无名之书']
    shelf.works=shelf.works.slice(0,6).map((book,i)=>({...book,title:titles[i],author:i===3?'':'林间',kind:['novel','note','cedar','violet','claret','ink'][i],intro:['一枚铜星的熄灭，唤醒了一张被遗忘的星图。','他在白昼收集月光，等待一场迟来的告别。','越过群山的人，带回了海的名字。','旧信笺藏着一座城市未曾说出的往事。','当真实和虚构交汇，故事开始寻找自己的作者。','每个尚未命名的世界，都值得第一行文字。'][i],totalWords:18526+i*937,chapterCount:12+i,genre:'奇幻',status:'连载'}))
    shelf.openStats=Object.fromEntries(shelf.works.map((book,i)=>[book.id,{lastOpenedAt:Date.now()-i*86400000,openCount:1}]))
    await stores.get('ui').setSkin('glaze');await document.fonts.ready
  })
  await page.waitForSelector('.gg-viewport')
  await page.waitForFunction(()=>[...document.querySelectorAll('.gg-slot:not(.is-buffer) .theme-book')].every(e=>e.dataset.poster==='ready'),null,{timeout:60000})
  await settle();start=(Date.now()-opened)/1000
  await page.waitForTimeout(600)
  for(let i=0;i<2;i++){await page.getByRole('button',{name:'下一部作品',exact:true}).click();await settle();await page.waitForTimeout(550)}
  await page.locator('.gg-index-item').first().click();await settle();await page.waitForTimeout(450)
  await page.getByRole('button',{name:'上一部作品',exact:true}).click();await settle();await page.waitForTimeout(650)
  const box=await page.locator('.gg-viewport').boundingBox(),x=box.x+box.width/2,y=box.y+box.height/2
  await page.mouse.move(x,y);await page.mouse.down()
  for(let i=1;i<=18;i++){await page.mouse.move(x-i*12,y);await page.waitForTimeout(16)}
  await page.mouse.up();await settle();await page.waitForTimeout(600)
  await page.locator('.gg-index-item').nth(4).click();await settle();await page.waitForTimeout(900)
  await page.locator('.gg-index-item').first().click();await settle();await page.waitForTimeout(700)
  duration=(Date.now()-opened)/1000-start
}finally{await context.close();raw=await page.video().path();await browser.close()}
const result=spawnSync('ffmpeg',['-y','-loglevel','error','-ss',String(start),'-i',raw,'-t',String(duration),'-an','-c:v','libx264','-preset','fast','-crf','23','-pix_fmt','yuv420p',fileURLToPath(new URL('gallery-demo.mp4',out))],{encoding:'utf8'})
if(result.status!==0)throw new Error(result.stderr||result.error?.message)
console.log('PASS recorded '+duration.toFixed(1)+'s gallery navigation, wrapping, dragging and directory selection')
