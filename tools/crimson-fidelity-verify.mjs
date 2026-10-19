/* 历史 v1 皮肤验收：v3 接入后设定详情栏宽已变化。
   当前请运行 `node tools/crimson-v3-verify.mjs`。 */
/* 赤月戏 · 保真门禁：设定详情的全屏层与三栏数值（1440×900）
   前置：electron . --dev --profile=crimson-skin-verify --remote-debugging-port=9225 */
import assert from 'node:assert/strict'
import { connect } from './_cdp-lib.mjs'

const c = await connect('http://127.0.0.1:5173', '9225')
const ev = async (code) => {
  const r = await c.evalx(code)
  if (r?.PAGE_ERR) throw new Error(r.PAGE_ERR)
  return r
}
const wait = async (code, ms = 15000) => {
  const end = Date.now() + ms
  while (Date.now() < end) {
    if (await ev(code)) return
    await c.sleep(100)
  }
  throw new Error('Timed out: ' + code)
}
const check = (ok, msg) => { assert.ok(ok, msg); console.log('PASS ' + msg) }

await c.send('Emulation.setFocusEmulationEnabled', { enabled: true })
await c.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
await wait('!!window.__ns')
await ev(`(async()=>{const {useUiStore}=await import('/src/stores/ui.js');const {useShelfStore}=await import('/src/stores/shelf.js');window.__k={ui:useUiStore(),shelf:useShelfStore(),work:__ns.getWork()};await __k.ui.setSkin('crimson');if(!__k.work.work){const row=await __k.shelf.createWork({title:'赤月保真',author:'验收',genre:'奇幻',status:'连载',intro:'一枚铜星的熄灭，唤醒了一张被遗忘的星图。',kind:'novel',withVolume:true});await __k.work.open(row.id);window.__fixture=row.id;const w=__k.work;const ch=await w.addChapter(w.volumes[0]?.id,'第一章 · 初雪');w.setChapterContent(ch.id,'<p>穹顶大厅的钟声在雾中回荡了十二下。</p>');const root=await w.mubuAdd(null,null,'星图系统');await w.mubuAdd(root.id,null,'铜星是星图中最稳定的导航基准。');w.selChapterId=ch.id;w.tab='lore';w.selOlnodeId=null}return true})()`)
await c.sleep(800)
await ev(`__k.work.tab='lore';__k.ui.loreDetailId=(__k.work.mubu.find(n=>!n.deletedAt&&!n.parentId)||{}).id||null`)
await wait('!!document.querySelector(".ldt-crimson")')
await c.sleep(500)

const geo = await ev(`(()=>{const b=s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return {l:Math.round(r.left),r:Math.round(r.right),w:Math.round(r.width),t:Math.round(r.top),b:Math.round(r.bottom),h:Math.round(r.height)}};const page=b('.ldt-page');const layout=b('.ldt-crimson-layout');const art=b('.ldt-crimson-layout .crimson-art-pane');const paper=b('.crimson-detail-paper');const conn=b('.crimson-detail-connections');return {page,layout,art,paper,conn,bar:b('.crimson-detail-bar')}})()`)
check(geo.page.t === 76 && geo.page.b === 860, 'the detail layer starts under the 76px header and ends above the 40px footer')
check(geo.bar?.h === 86 && geo.layout.t === 162 && geo.layout.l === 32 && geo.layout.r === 1408, 'the detail keeps an 86px module bar and 32px side margins')
check(geo.art?.l === 32 && geo.art?.w === 210 && geo.paper?.l === 266 && geo.paper?.r === 1029 && geo.conn?.l === 1053 && geo.conn?.w === 355, 'detail columns are 210 / paper / 355 (266–1029 paper, 1053–1408 relations)')
check(await ev(`(()=>{const p=document.querySelector('.crimson-detail-paper');return !!p.querySelector('.paper-running')&&!!p.querySelector('h2')&&!!document.querySelector('.crimson-detail-connections .ldt-graph')})()`), 'the detail paper has a running head and title, and the relation column keeps the real graph')
check(await ev(`document.documentElement.scrollWidth<=innerWidth`), 'detail has no horizontal overflow at 1440×900')

await ev(`__k.ui.loreDetailId=null`)
await c.sleep(300)
await ev(`(async()=>{if(window.__fixture){await __k.work.closeWork();const row=await __ns.db.works.get(window.__fixture);if(row)await __k.shelf.deleteWork(row)}await __k.ui.setSkin('original');return true})()`).catch(() => {})
await c.send('Emulation.clearDeviceMetricsOverride')
console.log('PASS crimson fidelity suite')
process.exit(0)
