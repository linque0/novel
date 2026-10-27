import assert from 'node:assert/strict'
import {mkdirSync,writeFileSync} from 'node:fs'
import {connect} from './_cdp-lib.mjs'
import {connectInspector,evalMain,captureWindow} from './_capture-main.mjs'
import {assertAiTestProfile} from './_ai-test-profile.mjs'
import {buildSeedExpr} from './verify-seeds.mjs'
process.env.AI_TEST_PROFILE='booksource-verify'
const c=await connect('app://',9333),ins=await connectInspector(),dir=process.argv.find(a=>a.startsWith('--out='))?.slice(6)||'docs/writing-paper-20261025'
assertAiTestProfile(await c.evalx('window.native.getDataLocation()'));mkdirSync(dir,{recursive:true})
const seed=await c.evalx(buildSeedExpr('AI 验证书',{reset:true}));assert(seed?.ok)
await c.evalx(`window.__paperVisualSetup=(async()=>{const w=window.__ns.getWork(),ui=(await import('/src/stores/ui.js')).useUiStore();await w.open(${JSON.stringify(seed.books[0].workId)});ui.aiDrawerOpen=false;await ui.setPref('theme','xuan');window.__paperVisual={w,ui};return true})();window.__paperVisualSetup`)
await c.sleep(250)
await c.evalx(`window.__paperVisualText=(async()=>{const e=window.__ns.editor;e.commands.setContent('<p>'+Array.from({length:25},(_,i)=>['钟声从雾里传来时，林昭正站在渡口。水面上最后一盏灯还没有熄灭。','他把铜镜收回衣袖，沿着码头边缘缓缓向前。旧木板在脚下轻响，像有人隔着很远的地方回应。','“天亮之前，我们还有时间。”沈青梧没有回头，只把那封没有署名的信递给他。'][i%3]).join('</p><p>')+'</p>');window.__paperVisual.w.renameChapter(window.__paperVisual.w.selChapterId,'第一章 · 雾都启程与钟楼深处尚未说出口的约定');await (await import('/src/services/autosave.js')).autosave.flushAll();return true})();window.__paperVisualText`)
// Native capture restores a hidden/minimized verification window before rAF checks.
await captureWindow(ins,'127.0.0.1:5173/',`${dir}/overview-start.png`,{exclude:'panel='})
const rows=[]
for(const [width,height] of [[1280,720],[1440,900],[1920,1080]]){
  await evalMain(ins,`(()=>{const {BrowserWindow}=require('electron');BrowserWindow.getAllWindows().find(w=>!w.webContents.getURL().includes('panel=')).setContentSize(${width},${height});return true})()`)
  for(const skin of ['original','gravity','glaze','crimson']){
    await c.evalx(`window.__paperVisual.ui.setSkin('${skin}')`);await c.sleep(1400)
    await c.evalx(`document.fonts.ready.then(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))`)
    let baseline
    for(const paper of ['booklet','manuscript','hardcover']){
      await c.evalx(`window.__paperVisual.ui.setWritingPaperStyle('${paper}')`);await c.sleep(160)
      const r=await c.evalx(`(()=>{const e=window.__ns.editor,host=e.view.dom.closest('.crimson-page')?.querySelector('.rich-inner')||e.view.dom.closest('.rich-host'),surface=document.querySelector('.editor-wrap .writing-paper-surface'),bar=[...document.querySelectorAll('.editor-toolbar')].find(b=>b.getBoundingClientRect().height),doc=e.view.dom,rect=doc.getBoundingClientRect(),style=getComputedStyle(doc);if(!window.__paperVisual.editor)window.__paperVisual.editor=e;return {font:style.fontFamily,fontSize:style.fontSize,lineHeight:style.lineHeight,width:rect.width,height:rect.height,padding:style.padding,toolbarHeight:bar.getBoundingClientRect().height,toolbarWidth:bar.clientWidth,toolbarOverflow:bar.scrollWidth-bar.clientWidth,hostOverflow:host.scrollWidth-host.clientWidth,scroll:host.scrollTop,from:e.state.selection.from,to:e.state.selection.to,html:e.getHTML(),same:e===window.__paperVisual.editor&&doc.isConnected,paper:document.querySelector('.editor-wrap').dataset.writingPaper,color:getComputedStyle(surface).backgroundColor,grain:getComputedStyle(surface).backgroundImage,fold:document.querySelector('.crimson-page')?getComputedStyle(document.querySelector('.crimson-page'),'::after').content:'none'}})()`)
      assert(r.same&&r.paper===paper&&r.hostOverflow<=1&&r.toolbarOverflow<=1,JSON.stringify({skin,paper,width,r}))
      assert(['none','normal'].includes(r.fold))
      if(baseline){for(const key of ['font','fontSize','lineHeight','padding','html','from','to','scroll'])assert.equal(r[key],baseline[key],`${skin} ${paper} ${key}`);for(const key of ['width','height','toolbarHeight'])assert(Math.abs(r[key]-baseline[key])<=1,`${skin} ${paper} ${key}`)}else baseline=r
      rows.push({skin,paper,viewport:[width,height],...Object.fromEntries(Object.entries(r).filter(([k])=>k!=='html'))})
      if(width===1440)await captureWindow(ins,'127.0.0.1:5173/',`${dir}/${skin}-${paper}.png`,{exclude:'panel='})
      console.log(`PASS ${skin} ${paper} ${width}x${height}`)
    }
  }
}
await c.evalx("window.__paperVisual.ui.setSkin('original')");await c.evalx("window.__paperVisual.ui.setPref('theme','night')");await c.evalx("window.__paperVisual.ui.setWritingPaperStyle('hardcover')");await c.sleep(200)
const dark=await c.evalx("getComputedStyle(document.querySelector('.writing-paper-surface')).backgroundColor");assert.equal(dark,'rgb(35, 33, 28)');await captureWindow(ins,'127.0.0.1:5173/',`${dir}/original-night-hardcover.png`,{exclude:'panel='})
writeFileSync(`${dir}/layout-results.json`,JSON.stringify(rows,null,2));ins.ws.close();console.log('36/36 layout and editor-state cases; original night remains dark');process.exit(0)
