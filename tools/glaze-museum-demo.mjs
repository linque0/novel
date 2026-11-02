import {createRequire} from 'node:module'
import {homedir} from 'node:os'
import {join} from 'node:path'
import {mkdirSync} from 'node:fs'
import {spawnSync} from 'node:child_process'
const require=createRequire(import.meta.url)
const {chromium}=require(require.resolve('playwright',{paths:[join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node')]}))
const out=join(process.cwd(),'docs','前端美化','琉光美术馆-20261029');mkdirSync(join(out,'video'),{recursive:true})
const browser=await chromium.launch({channel:'msedge',headless:true})
const context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:join(out,'video'),size:{width:1440,height:900}}})
const page=await context.newPage(),start=Date.now()
await page.goto(process.env.MUSEUM_TEST_URL||'http://127.0.0.1:5177/',{waitUntil:'networkidle'})
await page.waitForFunction(()=>window.__ns&&document.querySelector('#app').__vue_app__?.config.globalProperties.$pinia._s.get('shelf')?.works.length)
await page.evaluate(async()=>{const stores=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s;const ui=stores.get('ui'),shelf=stores.get('shelf');window.__demo={ui,shelf,work:__ns.getWork()};await __ns.db.works.clear();const titles=['星尘旅人','白昼','山海拾遗录','雾都来信','远山与长夜','无名之书'];for(const title of titles)await shelf.createWork({title,author:'林间',kind:'novel',genre:'奇幻',status:'连载',intro:'一枚铜星的熄灭，唤醒了一张被遗忘的星图。他沿着光的裂隙，重新寻找归途。',withVolume:true});await ui.setSkin('glaze');const b=shelf.works.find(w=>w.title==='星尘旅人');await __demo.work.open(b.id);const w=__demo.work;const ch=await w.addChapter(w.volumes[0]?.id,'第一章 · 雾都启程');w.setChapterContent(ch.id,'<p>雾从港口漫过来时，钟楼刚敲过六下。</p><p>林昭背起行囊离开雾都，铜镜里的星图缺了一角。他没有回头，只把那封尚未拆开的信，压进大衣内侧。</p><p>街角的面包店亮着灯。玻璃窗上浮起一层薄薄的水汽，掌柜正弯腰将新烤的面包摆上木架。</p>','html');await window.__flushNow();await w.closeWork();await document.fonts.ready;await Promise.all([...document.querySelectorAll('.glaze-artwork-image')].map(i=>i.decode()))})
await page.locator('.gg-index-item').filter({hasText:'星尘旅人'}).click()
const cut=(Date.now()-start)/1000
await page.waitForTimeout(900)
await page.getByRole('button',{name:'下一部作品',exact:true}).click();await page.waitForTimeout(700)
await page.getByRole('button',{name:'上一部作品',exact:true}).click();await page.waitForTimeout(700)
await page.locator('.gm-lighting button').last().click();await page.waitForTimeout(700)
await page.locator('.gg-picker-trigger').click();await page.waitForTimeout(500)
await page.locator('.gg-picker-item').filter({hasText:'星月夜'}).click();await page.waitForTimeout(900)
await page.locator('.gg-actions .n-button--primary-type').click();await page.waitForSelector('.workbench-shell .tiptap');await page.waitForTimeout(1100)
await page.setViewportSize({width:800,height:680});await page.locator('.glaze-directory-toggle').click();await page.waitForTimeout(900)
await page.keyboard.press('Escape');await page.locator('.glaze-notes-toggle').click();await page.waitForTimeout(700)
await page.keyboard.press('Escape');await page.waitForTimeout(500)
const video=page.video();await context.close();const raw=await video.path();await browser.close()
const encoded=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-ss',String(cut),'-i',raw,'-vf','fps=24','-c:v','libx264','-crf','22','-pix_fmt','yuv420p','-movflags','+faststart',join(out,'museum-demo.mp4')],{stdio:'pipe'})
if(encoded.status!==0)throw Error(encoded.stderr.toString())
console.log('Recorded actual product interactions:',join(out,'museum-demo.mp4'))
