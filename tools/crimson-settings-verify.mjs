/* 历史 v1 皮肤验收：v3 接入后设置窗口分类/预览宽度已变化。
   当前请运行 `node tools/crimson-v3-verify.mjs`。 */
/* 赤月戏 · 独立设置窗口（1000×700）：三栏纸面与外壳数值
   前置：electron . --dev --profile=crimson-skin-verify --remote-debugging-port=9225 */
import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { connect } from './_cdp-lib.mjs'

const main = await connect('http://127.0.0.1:5173', '9225')
const evMain = async (code) => {
  const r = await main.evalx(code)
  if (r?.PAGE_ERR) throw new Error(r.PAGE_ERR)
  return r
}
await evMain(`(async()=>{const {useUiStore}=await import('/src/stores/ui.js');window.__k={ui:useUiStore()};await window.__k.ui.setSkin('crimson');return true})()`)
await main.send('Page.bringToFront')
await evMain(`window.native.panelOpen({type:'settings',workId:'app',entityId:'',title:'设置'})`)
await main.sleep(1400)

const panel = await connect('panel=settings', '9225')
const ev = async (code) => {
  const r = await panel.evalx(code)
  if (r?.PAGE_ERR) throw new Error(r.PAGE_ERR)
  return r
}
const check = (ok, msg) => { assert.ok(ok, msg); console.log('PASS ' + msg) }
await panel.send('Emulation.setDeviceMetricsOverride', { width: 1000, height: 700, deviceScaleFactor: 1, mobile: false })
await panel.sleep(500)
const end = Date.now() + 15000
while (Date.now() < end && !(await ev(`!!document.querySelector('.sw-root.is-crimson')`))) await panel.sleep(100)

check(await ev(`document.body.dataset.skin==='crimson'&&!!document.querySelector('.sw-root.is-crimson')`), 'settings panel applies the crimson skin to body and root')
const shell = await ev(`(()=>{const b=s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return {w:Math.round(r.width),h:Math.round(r.height)}};return {head:b('.crimson-settings-head'),bar:b('.crimson-settings-bar'),foot:b('.crimson-settings-foot'),nav:b('.sw-nav'),preview:b('.crimson-preview-paper'),body:b('.sw-body')}})()`)
check(shell.head?.h === 76 && shell.bar?.h === 86 && shell.foot?.h === 40, 'settings shell is 76 + 86 + 40')
check(shell.nav?.w === 181 && shell.preview?.w === 250 && shell.preview?.h === 340, 'settings columns are 181px categories / paper / 250×340 preview')
check(await ev(`(()=>{const b=document.querySelector('.sw-body');return getComputedStyle(b).display==='grid'&&/^181px/.test(getComputedStyle(b).gridTemplateColumns)})()`), 'settings body is a category + paper grid')
check(await ev(`(()=>{const b=document.querySelector('.sw-appearance-controls');const c=getComputedStyle(b);return !!b&&/gradient/.test(c.backgroundImage)&&parseFloat(c.borderTopWidth)>0})()`), 'the appearance controls sit on a paper sheet')
check(await ev(`(()=>{const t=document.querySelector('.crimson-preview-paper');return /第一章 · 初雪/.test(t.textContent)&&!!t.querySelector('.paper-running')&&!!t.querySelector('.crimson-preview-folio')})()`), 'the preview paper keeps a running head, a real chapter sample and a folio')
check(await ev(`document.documentElement.scrollWidth<=innerWidth`), 'settings has no horizontal overflow at 1000×700')
await ev(`document.fonts.ready.then(()=>true)`)
await panel.sleep(200)
const frame = await panel.send('Page.captureScreenshot', { format: 'png' })
await writeFile(new URL('./_crimson-settings.png', import.meta.url), Buffer.from(frame.data, 'base64'))
await ev(`window.native?.panelCloseSelf?.()`).catch(() => {})
console.log('PASS crimson settings suite')
process.exit(0)
