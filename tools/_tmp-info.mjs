import { connect } from './_cdp-lib.mjs'
const c = await connect('http://127.0.0.1:5173', '9222')
const ev = async (code) => { const r = await c.evalx(code); if (r?.PAGE_ERR) throw new Error(r.PAGE_ERR); return r }
console.log('loc:', JSON.stringify(await ev('native.getDataLocation()')))
console.log('state:', JSON.stringify(await ev(`({app:!!document.querySelector('#app'),skin:document.body.dataset.skin||null,books:(document.querySelectorAll('.gravity-shelf .shelf-book')||[]).length,url:location.href})`)))
setTimeout(()=>process.exit(0),100)
