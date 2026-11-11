import { Browser } from 'file:///C:/Users/linque/.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs'
import assert from 'node:assert/strict'
import {mkdirSync,writeFileSync} from 'node:fs'
const out='tools/_original-shelf-v2';mkdirSync(out,{recursive:true})
const b=await Browser.launch({extraArgs:['--enable-unsafe-swiftshader']});const p=await b.newPage()
try{
 await p.goto('http://127.0.0.1:5189')
 await p.eval(`(async()=>{const {useShelfStore}=await import('/src/stores/shelf.js');const {useUiStore}=await import('/src/stores/ui.js');window.s=useShelfStore();window.u=useUiStore();await u.setSkin('original');window.fixtures=['长街晚风','山海之间','写给明天的信','远山来客','一部名字很长的中文与 English 混排作品','月亮与潮汐'].map((title,i)=>({id:'v2-'+i,title,author:i===4?'':'林间',genre:['都市','玄幻','文集'][i%3],status:['连载','连载','完结','完结','构思','搁置'][i],kind:['novel','cedar','note','claret','violet','ink'][i],intro:'穿过旧街尽头的书店，她终于找到那封迟到了许多年的信。',chapterCount:i+1,totalWords:(i+1)*43000}));s.works=fixtures;return true})()`)
 const wait=async expression=>{for(let i=0;i<150;i++){if(await p.eval(expression))return;await new Promise(r=>setTimeout(r,100))}throw new Error('Timeout '+expression)}
 await wait('document.querySelectorAll(".scene-label").length===6');await new Promise(r=>setTimeout(r,1500))
 assert.equal(await p.eval(()=>document.querySelectorAll('.scene-label').length),6)
 const metrics=await p.eval(()=>({...document.querySelector('.shelf-scene canvas').dataset}))
 console.log('metrics',metrics)
 for(const width of [1440,1080,800,390]){await p.setViewport({width,height:900});await new Promise(r=>setTimeout(r,500));assert.ok(await p.eval(()=>document.documentElement.scrollWidth<=innerWidth),'no page overflow '+width);await p.screenshot({path:out+'/'+width+'.png',format:'png'})}
 await p.eval(()=>document.querySelectorAll('.os-detail')[1].click());assert.ok(await p.eval(()=>document.querySelectorAll('.os-inline-detail').length===1),'mobile inline details')
 await p.setViewport({width:1440,height:900});await wait('document.querySelectorAll(".scene-label").length===6')
 await p.eval(()=>document.querySelectorAll('.os-detail')[1].click());assert.equal(await p.eval(()=>document.querySelector('.os-reading h2').textContent),'山海之间')
 await p.eval(()=>[...document.querySelectorAll('.os-filters button')].find(b=>b.textContent==='完结').click());await wait('document.querySelectorAll(".scene-label").length===2');assert.equal(await p.eval(()=>document.querySelector('.os-reading h2').textContent),'写给明天的信')
 await p.eval(()=>document.querySelector('.os-filters button').click())
 const search=async text=>{await p.eval(value=>{const el=document.querySelector('.os-search input');el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}))},text)}
 await search('月亮');await wait('document.querySelectorAll(".scene-label").length===1');assert.equal(await p.eval(()=>document.querySelector('.os-reading h2').textContent),'月亮与潮汐')
 await search('找不到');await wait('document.querySelectorAll(".scene-label").length===0');assert.ok(await p.eval(()=>!document.querySelector('.os-reading')))
 await search('')
 for(const count of [0,1,2,100]){await p.eval(n=>{s.works=Array.from({length:n},(_,i)=>({...fixtures[i%6],id:'count-'+i}));},count);await wait('document.querySelectorAll(".scene-label").length==='+Math.min(count,8));await p.screenshot({path:out+'/count-'+count+'.png',format:'png'})}
 await p.eval(()=>document.querySelector('[aria-label="下一架"]').click());assert.ok(await p.eval(()=>document.querySelector('.os-pagination').textContent.includes('9–16 / 100')))
 await p.eval(()=>document.querySelector('.os-view button').click());assert.equal(await p.eval(()=>document.querySelectorAll('.os-list li').length),100)
 await p.eval(()=>document.querySelector('.os-view button').click());await wait('!!document.querySelector(".shelf-scene canvas")')
 await p.eval(()=>document.querySelector('.shelf-scene canvas').dispatchEvent(new Event('webglcontextlost',{cancelable:true})));await wait('document.querySelectorAll(".os-list li").length===100');assert.ok(await p.eval(()=>!document.querySelector('.shelf-scene')))
 await p.eval(()=>{s.loading=true});assert.ok(await p.eval(()=>document.body.textContent.includes('正在整理书架')));await p.eval(()=>s.loading=false)
 await p.eval(()=>document.querySelector('.os-new').click());await wait(()=>!!document.querySelector('input[placeholder="书名 *"]'))
 await p.eval(()=>{const el=document.querySelector('input[placeholder="书名 *"]');el.value='V2真实验收作品';el.dispatchEvent(new Event('input',{bubbles:true}))})
 await p.eval(()=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='创建').click());await wait('s.works.some(w=>w.title==="V2真实验收作品")')
 await search('V2真实验收作品');await wait('document.querySelectorAll(".os-book-open").length===1')
 await p.send('Emulation.setFocusEmulationEnabled',{enabled:true});await p.send('Page.bringToFront');await p.eval(()=>document.querySelector('.os-book-open').focus())
 await p.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',text:'\r',unmodifiedText:'\r',windowsVirtualKeyCode:13});await p.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await wait('u.view==="work"')
 await p.eval(()=>__ns.getWork().closeWork());await wait('!!document.querySelector(".original-shelf")')
 await search('V2真实验收作品');await wait('document.querySelectorAll(".scene-label").length===1')
 await p.eval(()=>document.querySelector('.os-reading .os-more').click());await wait('[...document.querySelectorAll(".n-dropdown-option-body")].some(e=>e.textContent.includes("编辑信息"))')
 await p.eval(()=>[...document.querySelectorAll('.n-dropdown-option-body')].find(e=>e.textContent.includes('编辑信息')).click());await new Promise(r=>setTimeout(r,350))
 await p.eval(()=>{const el=document.querySelector('input[placeholder="书名 *"]');el.value='V2已编辑作品';el.dispatchEvent(new Event('input',{bubbles:true}))});await p.eval(()=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='保存').click());await wait('s.works.some(w=>w.title==="V2已编辑作品")')
 await search('V2已编辑作品');await wait('document.querySelectorAll(".scene-label").length===1')
 await p.eval(()=>document.querySelector('.os-reading .os-more').click());await wait('[...document.querySelectorAll(".n-dropdown-option-body")].some(e=>e.textContent.includes("删除"))');await p.eval(()=>[...document.querySelectorAll('.n-dropdown-option-body')].find(e=>e.textContent.includes('删除')).click());await wait('!s.works.some(w=>w.title==="V2已编辑作品")');await new Promise(r=>setTimeout(r,100));assert.ok(await p.eval(()=>document.activeElement.classList.contains('os-new')))
 await search('');await p.eval(()=>s.works=fixtures);await wait('document.querySelectorAll(".scene-label").length===6')
 await p.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});assert.equal(await p.eval(()=>getComputedStyle(document.querySelector('.os-dust')).display),'none')
 await p.setViewport({width:720,height:450,dsf:2});await p.screenshot({path:out+'/zoom-equivalent.png',format:'png'});assert.ok(await p.eval(()=>document.documentElement.scrollWidth<=innerWidth))
 console.log('PASS responsive, selection, status filters, search, 0/1/2/100, pagination, list, context-loss fallback, loading, persisted create/open/edit/delete, focus, reduced motion')
 console.log({metrics,errors:p.consoleErrors});writeFileSync(out+'/result.json',JSON.stringify({passed:true,metrics,errors:p.consoleErrors},null,2))
}finally{await b.close()}
