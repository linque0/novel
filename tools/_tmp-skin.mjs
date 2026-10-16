import { connect } from './_cdp-lib.mjs'
const c = await connect('http://127.0.0.1:5173', '9223')
const ev = async (code) => { const r = await c.evalx(code); if (r?.PAGE_ERR) throw new Error(r.PAGE_ERR); return r }
await ev(`(async()=>{const {useUiStore}=await import('/src/stores/ui.js');await useUiStore().setSkin('gravity');return true})()`)
await c.sleep(300)
console.log('skin now:', await ev('document.body.dataset.skin'))
setTimeout(()=>process.exit(0),100)
