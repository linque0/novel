import { connect } from './_cdp-lib.mjs'
const c = await connect('http://127.0.0.1:5173', '9223')
const ev = async (code) => { try { return await c.evalx(code) } catch (e) { return { THREW: e.message } } }
console.log('app#:', await ev(`({app:!!document.querySelector('#app'),skin:document.body.dataset.skin,tab:document.querySelector('.nav-rail .rail-item.active')?.textContent.trim()||null,nodes:document.querySelectorAll('.oc-node').length,sat:document.querySelectorAll('.oc-sat').length,canvas:!!document.querySelector('.oc-canvas')})`))
console.log('store:', await ev(`(()=>{const s=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('work');return {tab:s.tab,work:!!s.work,live:s.liveOlnodes().length}})()`))
console.log('sattext:', await ev(`(()=>{const s=document.querySelector('.oc-sat');return {exists:!!s,txt:s?s.textContent.slice(0,20):null}})()`))
setTimeout(()=>process.exit(0),100)
