import { Browser } from 'file:///C:/Users/linque/.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs'
import { mkdirSync, writeFileSync } from 'node:fs'
import assert from 'node:assert/strict'
const out='tools/_original-shelf';mkdirSync(out,{recursive:true})
const b=await Browser.launch();const p=await b.newPage()
try{
 await p.goto('http://127.0.0.1:5187')
 console.log(await p.eval(`(async()=>{const {useShelfStore}=await import('/src/stores/shelf.js');const {useUiStore}=await import('/src/stores/ui.js');window.s=useShelfStore();window.u=useUiStore();await u.setSkin('original');window.fixtures=['长街晚风','山海之间','写给明天的信','远山来客','一部名字很长的中文与 English 混排作品','月亮与潮汐'].map((title,i)=>({id:'preview-'+i,title,author:i===4?'':'林间',genre:['都市','玄幻','文集'][i%3],status:['连载','连载','完结','完结','构思','搁置'][i],kind:['novel','cedar','note','claret','violet','ink'][i],intro:'穿过旧街尽头的书店，她终于找到那封迟到了许多年的信。故事从一个寻常的午后开始。',chapterCount:i+1,totalWords:i*43000}));s.works=fixtures;return true})()`))
 await new Promise(r=>setTimeout(r,700))
 for(const width of [1440,1080,800,768,390]){await p.setViewport({width,height:900});await p.screenshot({path:`${out}/${width}.png`,format:'png'});assert.ok(await p.eval(()=>document.documentElement.scrollWidth<=innerWidth),'no page overflow '+width)}
 await p.setViewport({width:1440,height:900})
 await p.eval(()=>document.querySelectorAll('.os-detail')[1].click())
 assert.equal(await p.eval(()=>document.querySelector('.os-paper h2').textContent),'山海之间')
 await p.eval(()=>{const el=document.querySelector('.os-search input');el.value='月亮';el.dispatchEvent(new Event('input',{bubbles:true}))})
 assert.equal(await p.eval(()=>document.querySelectorAll('.os-book-open').length),1)
 assert.equal(await p.eval(()=>document.querySelector('.os-paper h2').textContent),'月亮与潮汐')
 await p.eval(()=>{const el=document.querySelector('.os-search input');el.value='找不到';el.dispatchEvent(new Event('input',{bubbles:true}))})
 assert.equal(await p.eval(()=>document.querySelectorAll('.os-book-open').length),0)
 await p.eval(()=>{document.querySelector('.os-search button').click()})
 for(const count of [0,1,2,100]){await p.eval(n=>{s.works=Array.from({length:n},(_,i)=>({...fixtures[i%6],id:'size-'+i}));},count);assert.equal(await p.eval(()=>document.querySelectorAll('.os-book-open').length),count);await p.screenshot({path:`${out}/count-${count}.png`,format:'png'})}
 await p.eval(()=>{s.works=fixtures;s.loading=true});assert.ok(await p.eval(()=>document.querySelector('.os-notice').textContent.includes('正在整理')))
 await p.eval(()=>{s.loading=false;document.querySelector('.os-new').click()});assert.ok(await p.eval(()=>document.body.textContent.includes('新建作品')))
 await p.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});assert.equal(await p.eval(()=>getComputedStyle(document.querySelector('.os-dust')).display),'none')
 await p.eval(()=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='取消').click())
 await new Promise(r=>setTimeout(r,500))
 await p.eval(`(async()=>{await s.createWork({title:'验收持久化作品',author:'验收',genre:'都市',status:'连载',kind:'cedar',withVolume:true});return true})()`)
 await p.eval(()=>{const el=document.querySelector('.os-search input');el.value='验收持久化作品';el.dispatchEvent(new Event('input',{bubbles:true}))})
 await p.send('Emulation.setFocusEmulationEnabled',{enabled:true});await p.send('Page.bringToFront');await p.eval(()=>document.querySelector('.os-book-open').focus())
 await p.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',text:'\r',unmodifiedText:'\r',windowsVirtualKeyCode:13});await p.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13})
 for(let i=0;i<80;i++){if(await p.eval(()=>!document.querySelector('.original-shelf')))break;await new Promise(r=>setTimeout(r,100))}
 assert.ok(await p.eval(()=>!document.querySelector('.original-shelf')),'Enter opens real persisted work')
 await p.eval(`(async()=>{const {useWorkStore}=await import('/src/stores/work.js');await useWorkStore().closeWork();return true})()`)
 await new Promise(r=>setTimeout(r,300))
 await p.eval(()=>{const el=document.querySelector('.os-search input');el.value='验收持久化作品';el.dispatchEvent(new Event('input',{bubbles:true}))});await p.eval(()=>document.querySelector('.os-more').click());await new Promise(r=>setTimeout(r,150))
 await p.eval(()=>[...document.querySelectorAll('.n-dropdown-option-body')].find(e=>e.textContent.includes('编辑信息')).click())
 await new Promise(r=>setTimeout(r,400))
 await p.eval(()=>{const el=document.querySelector('input[placeholder="书名 *"]');el.value='修改后的书名';el.dispatchEvent(new Event('input',{bubbles:true}));})
 await p.eval(()=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='保存').click())
 for(let i=0;i<60;i++){if(await p.eval(()=>s.works.some(w=>w.title==='修改后的书名')))break;await new Promise(r=>setTimeout(r,100))}
 assert.ok(await p.eval(()=>s.works.some(w=>w.title==='修改后的书名')))
 await p.eval(()=>{const el=document.querySelector('.os-search input');el.value='修改后的书名';el.dispatchEvent(new Event('input',{bubbles:true}))})
 await p.eval(()=>document.querySelector('.os-more').click());await new Promise(r=>setTimeout(r,150))
 await p.eval(()=>[...document.querySelectorAll('.n-dropdown-option-body')].find(e=>e.textContent.includes('删除')).click())
 for(let i=0;i<60;i++){if(await p.eval(()=>!s.works.some(w=>w.title==='修改后的书名')))break;await new Promise(r=>setTimeout(r,100))}
 assert.ok(await p.eval(()=>!s.works.some(w=>w.title==='修改后的书名')))
 assert.ok(await p.eval(()=>document.activeElement?.classList.contains('os-new')),'delete restores focus')
 await p.setViewport({width:720,height:450,dsf:2});await p.screenshot({path:`${out}/zoom-200-equivalent.png`,format:'png'});assert.ok(await p.eval(()=>document.documentElement.scrollWidth<=innerWidth))
 console.log('PASS real persisted work: keyboard open, edit, delete, focus recovery')
 console.log('PASS responsive, selection, search, empty, 1/2/100 books, loading, create dialog, reduced motion');console.log('Errors',p.consoleErrors)
 writeFileSync(`${out}/result.json`,JSON.stringify({passed:true,errors:p.consoleErrors},null,2))
}finally{await b.close()}


