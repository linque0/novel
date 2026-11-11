import { Browser } from 'file:///C:/Users/linque/.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs'
import assert from 'node:assert/strict'
import {mkdirSync,writeFileSync} from 'node:fs'
const out='tools/_original-booklist';mkdirSync(out,{recursive:true})
const b=await Browser.launch();const p=await b.newPage()
const wait=async expression=>{for(let i=0;i<120;i++){if(await p.eval(expression))return;await new Promise(r=>setTimeout(r,80))}throw new Error('Timeout '+expression)}
try{
 await p.goto('http://127.0.0.1:5191')
 await p.eval(`(async()=>{const {useShelfStore}=await import('/src/stores/shelf.js');const {useUiStore}=await import('/src/stores/ui.js');window.s=useShelfStore();window.u=useUiStore();await u.setSkin('original');window.fixtures=['长街晚风','山海之间','写给明天的信','远山来客','一部名字很长的中文与 English 混排作品','月亮与潮汐'].map((title,i)=>({id:'list-'+i,title,author:i===4?'':'林间',genre:['都市','玄幻','文集'][i%3],status:['连载','连载','完结','完结','构思','搁置'][i],kind:['novel','cedar','note','claret','violet','ink'][i],intro:'穿过旧街尽头的书店，她终于找到那封迟到了许多年的信。',chapterCount:i+1,totalWords:(i+1)*43000}));s.works=fixtures;return true})()`)
 await wait('document.querySelectorAll(".os-list-item").length===6');await p.eval(()=>document.fonts.ready.then(()=>true))
 assert.equal(await p.eval(()=>document.querySelectorAll('canvas').length),0)
 console.log('cover metrics',await p.eval(()=>[...document.querySelectorAll('.ob-title')].map(t=>({text:t.textContent,scroll:t.scrollHeight,height:t.clientHeight,bottom:t.getBoundingClientRect().bottom,author:t.closest('.ob-cover').querySelector('.ob-colophon').getBoundingClientRect().top}))))
 assert.ok(await p.eval(()=>[...document.querySelectorAll('.ob-title.vertical')].every(t=>t.scrollHeight<=t.clientHeight+1)),'short cover titles are not clipped')
 for(const width of [1440,1080,800,390]){await p.setViewport({width,height:900});await new Promise(r=>setTimeout(r,150));await p.screenshot({path:out+'/'+width+'.png',format:'png'});assert.ok(await p.eval(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow '+width);assert.ok(await p.eval(()=>{const r=document.querySelector('.os-pagination').getBoundingClientRect(),a=document.querySelector('.os-reading').getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&a.bottom<=innerHeight}),'pagination and actions visible '+width)}
 for(const width of [390,320]){await p.setViewport({width,height:450});await p.screenshot({path:out+'/'+width+'-short.png',format:'png'});assert.ok(await p.eval(()=>document.querySelector('.os-list-region').getBoundingClientRect().height>=100),'short viewport list remains usable');assert.ok(await p.eval(()=>document.documentElement.scrollWidth<=innerWidth),'short viewport no overflow')}
 await p.setViewport({width:1440,height:900})
 await p.eval(()=>document.querySelectorAll('.os-detail')[1].click());await wait('!!document.querySelector(".os-detail-content")');assert.ok(await p.eval(()=>document.querySelector('.os-reading h2').textContent==='山海之间'))
 await p.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await p.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await new Promise(r=>setTimeout(r,250))
 await p.eval(()=>[...document.querySelectorAll('.os-filters button')].find(b=>b.textContent==='完结').click());assert.equal(await p.eval(()=>document.querySelectorAll('.os-list-item').length),2)
 await p.eval(()=>document.querySelector('.os-filters button').click())
 const search=async value=>p.eval(text=>{const el=document.querySelector('.os-search input');el.value=text;el.dispatchEvent(new Event('input',{bubbles:true}))},value)
 await search('月亮');assert.equal(await p.eval(()=>document.querySelectorAll('.os-list-item').length),1);await search('找不到');assert.equal(await p.eval(()=>document.querySelectorAll('.os-list-item').length),0);await search('')
 for(const count of [0,1,2,100]){await p.eval(n=>{s.works=Array.from({length:n},(_,i)=>({...fixtures[i%6],id:'count-'+i}));},count);await wait('document.querySelectorAll(".os-list-item").length==='+Math.min(count,6));await p.screenshot({path:out+'/count-'+count+'.png',format:'png'})}
 await p.eval(()=>document.querySelector('[aria-label="最后一页"]').click());assert.equal(await p.eval(()=>document.querySelectorAll('.os-list-item').length),4);assert.ok(await p.eval(()=>document.querySelector('.os-result-count').textContent.includes('97–100')))
 await p.eval(()=>{const e=document.querySelector('[aria-label="每页作品数"]');e.value='24';e.dispatchEvent(new Event('change',{bubbles:true}))});assert.equal(await p.eval(()=>document.querySelectorAll('.os-list-item').length),24)
 await p.eval(()=>document.querySelector('.os-list-region').scrollTop=99999)
 assert.ok(await p.eval(()=>{const p=document.querySelector('.os-pagination').getBoundingClientRect(),r=document.querySelector('.os-reading').getBoundingClientRect(),h=document.querySelector('.os-heading').getBoundingClientRect();return p.bottom<=innerHeight&&r.bottom<=innerHeight&&h.top>=0}),'fixed controls with long list')
 await p.screenshot({path:out+'/100-scrolled.png',format:'png'})
 await p.eval(()=>document.querySelector('[aria-label="下一页"]').click());assert.equal(await p.eval(()=>document.querySelector('.os-list-region').scrollTop),0)
 await p.eval(()=>{const e=document.querySelector('[aria-label="每页作品数"]');e.value='6';e.dispatchEvent(new Event('change',{bubbles:true}))})
 await p.eval(()=>document.querySelector('[aria-label="最后一页"]').click())
 await p.eval(()=>s.works=s.works.slice(0,96));assert.ok(await p.eval(()=>document.querySelector('.os-result-count').textContent.includes('91–96')))
 await search('月亮');assert.ok(await p.eval(()=>document.querySelector('[aria-label="跳转到页"]').value==='0'))
 await search('');await p.eval(()=>{s.loading=true});assert.ok(await p.eval(()=>document.body.textContent.includes('正在整理书单')));await p.eval(()=>s.loading=false)
 await p.eval(()=>document.querySelector('.os-new').click());await wait(()=>!!document.querySelector('input[placeholder="书名 *"]'))
 await p.eval(()=>{const el=document.querySelector('input[placeholder="书名 *"]');el.value='书单验收作品';el.dispatchEvent(new Event('input',{bubbles:true}))});await p.eval(()=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='创建').click());await wait('s.works.some(w=>w.title==="书单验收作品")');await wait(()=>!document.querySelector('.n-modal-mask'))
 await search('书单验收作品');await p.send('Emulation.setFocusEmulationEnabled',{enabled:true});await p.send('Page.bringToFront');await p.eval(()=>document.querySelector('.os-book-open').focus())
 await p.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',text:'\r',unmodifiedText:'\r',windowsVirtualKeyCode:13});await p.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await wait('u.view==="work"')
 await p.eval(()=>__ns.getWork().closeWork());await wait('!!document.querySelector(".original-shelf")');await search('书单验收作品')
 await p.eval(()=>document.querySelector('.os-list-actions .os-more').click());await wait('[...document.querySelectorAll(".n-dropdown-option-body")].some(e=>e.textContent.includes("编辑信息"))');await p.eval(()=>[...document.querySelectorAll('.n-dropdown-option-body')].find(e=>e.textContent.includes('编辑信息')).click());await new Promise(r=>setTimeout(r,350))
 await p.eval(()=>{const el=document.querySelector('input[placeholder="书名 *"]');el.value='书单已编辑作品';el.dispatchEvent(new Event('input',{bubbles:true}))});await p.eval(()=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='保存').click());await wait('s.works.some(w=>w.title==="书单已编辑作品")');await wait(()=>!document.querySelector('.n-modal-mask'));await search('书单已编辑作品')
 await p.eval(()=>document.querySelector('.os-list-actions .os-more').click());await wait('[...document.querySelectorAll(".n-dropdown-option-body")].some(e=>e.textContent.includes("删除"))');await p.eval(()=>[...document.querySelectorAll('.n-dropdown-option-body')].find(e=>e.textContent.includes('删除')).click());await wait('!s.works.some(w=>w.title==="书单已编辑作品")');await new Promise(r=>setTimeout(r,100));assert.ok(await p.eval(()=>document.activeElement.classList.contains('os-new')))
 await search('');await p.eval(()=>s.works=fixtures)
 await p.eval(()=>{s.works=fixtures.map((book,i)=>({...book,title:['长街晚风','这是一部标题非常非常长并且需要合理换行的中文作品','A Very Long English Novel Title About the Sea','ISBN20261103','山海之间','中文 English 2026 混排标题'][i],author:'一个名字比较长的作者'}))})
 await p.screenshot({path:out+'/cover-stress.png',format:'png'});assert.ok(await p.eval(()=>[...document.querySelectorAll('.ob-cover')].every(c=>c.querySelector('.ob-title').getBoundingClientRect().bottom<=c.querySelector('.ob-colophon').getBoundingClientRect().top+1)),'cover titles do not overlap colophon')
 await p.setViewport({width:720,height:450,dsf:2});await p.screenshot({path:out+'/zoom-equivalent.png',format:'png'});assert.ok(await p.eval(()=>document.documentElement.scrollWidth<=innerWidth));assert.ok(await p.eval(()=>document.querySelector('.os-pagination').getBoundingClientRect().bottom<=innerHeight))
 console.log('PASS list-only, responsive, fixed controls, title variants, status/search, 0/1/2/100, page size/jump/clamp, scroll reset, details, persisted create/open/delete/focus')
 console.log(p.consoleErrors);assert.deepEqual(p.consoleErrors,[]);writeFileSync(out+'/result.json',JSON.stringify({passed:true,errors:p.consoleErrors},null,2))
}catch(error){writeFileSync(out+'/result.json',JSON.stringify({passed:false,error:error.message},null,2));throw error}finally{await b.close()}
