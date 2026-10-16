import { connect } from './_cdp-lib.mjs'
const c = await connect('http://127.0.0.1:5173', '9222')
const raw = async (code) => { try { return await c.evalx(code) } catch (e) { return { THREW: e.message } } }
console.log('visibility:', JSON.stringify(await raw('({v:document.visibilityState,hidden:document.hidden})')))
console.log('dom:', JSON.stringify(await raw(`({ready:document.readyState,bodyLen:document.body.innerHTML.length,text:document.body.innerText.slice(0,200),dialogs:document.querySelectorAll('.n-dialog,.n-modal').length,shelf:!!document.querySelector('.gravity-shelf'),rootChildren:[...document.querySelector('#app').children].map(n=>n.className||n.tagName)})`)))
console.log('errors:', JSON.stringify(await raw(`({hasDexie:typeof Dexie!==\"undefined\",perf:performance.now()|0})`)))
setTimeout(()=>process.exit(0),100)
