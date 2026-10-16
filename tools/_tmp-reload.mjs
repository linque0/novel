import { connect } from './_cdp-lib.mjs'
const c = await connect('http://127.0.0.1:5173', '9223')
const ev = async (code) => { const r = await c.evalx(code); if (r?.PAGE_ERR) throw new Error(r.PAGE_ERR); return r }
await c.send('Page.reload', { ignoreCache: true })
const end = Date.now() + 30000
while (Date.now() < end) { if (await ev('!!window.__ns && !!document.querySelector("#app")').catch(()=>false)) break; await c.sleep(150) }
await ev(`(async()=>{const {useUiStore}=await import('/src/stores/ui.js');await useUiStore().setSkin('gravity');return true})()`)
await c.sleep(300)
console.log('ready:', await ev(`({app:!!document.querySelector('#app'),skin:document.body.dataset.skin,url:location.href})`))
setTimeout(()=>process.exit(0),100)
