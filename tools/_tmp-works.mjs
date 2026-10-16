import { connect } from './_cdp-lib.mjs'
const c = await connect('http://127.0.0.1:5173', '9222')
const raw = async (code) => { try { return await c.evalx(code) } catch (e) { return { THREW: e.message } } }
console.log('ns:', JSON.stringify(await raw(`({hasNs:!!window.__ns,keys:window.__ns?Object.keys(window.__ns).slice(0,12):null})`)))
console.log('tables:', JSON.stringify(await raw(`window.__ns&&window.__ns.db?window.__ns.db.tables.map(t=>t.name):null`)))
console.log('works:', JSON.stringify(await raw(`window.__ns&&window.__ns.db.works?window.__ns.db.works.count():'no works table'`)))
setTimeout(()=>process.exit(0),100)
