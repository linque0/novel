/* rp-fold-verify.mjs —— 正文右侧批注栏折叠/展开验收
 * 覆盖：面板顶条（含折叠按钮）、点击收起后右缘细轨出现、
 *       点击细轨恢复、appconfig 持久记忆（收起重载仍收起 / 展开重载仍展开）、
 *       内容滚动时顶条钉在顶端不消失。
 * 运行前提：npm run dev（CDP 9222）或 electron . --profile=dev --remote-debugging-port=9222
 */
import { connect } from './_cdp-lib.mjs'
import { writeFileSync } from 'node:fs'

const results = []
const check = (name, ok, extra = '') => {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  [' + extra + ']' : ''}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const c = await connect('app://')
await c.send('Page.enable')
await c.sleep(1800)
const shot = async (path) => {
  const r = await c.send('Page.captureScreenshot', { format: 'png' }).catch(() => null)
  if (r?.data) writeFileSync(path, Buffer.from(r.data, 'base64'))
}

/* 页内工具：重载后回到验证书正文页（应用启动落书架，需重新进入） */
const REOPEN = `(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const app = document.querySelector('#app').__vue_app__
  const work = app.config.globalProperties.$pinia._s.get('work')
  const ui = app.config.globalProperties.$pinia._s.get('ui')
  ui.focusMode = false
  if (!work.work || work.work.title !== '批注栏验证书') {
    const shelf = app.config.globalProperties.$pinia._s.get('shelf')
    await shelf.refresh()
    const w = shelf.works.find((x) => x.title === '批注栏验证书')
    await work.open(w.id)
    await sleep(900)
  }
  work.tab = 'chapters'
  await sleep(300)
  return { ok: true, wid: work.work.id }
})()`

/* 种子：建验证书 → 正文页（默认选首章），确保展开态起步 */
const seed = await c.evalx(`(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const app = document.querySelector('#app').__vue_app__
  const work = app.config.globalProperties.$pinia._s.get('work')
  const shelf = app.config.globalProperties.$pinia._s.get('shelf')
  const ui = app.config.globalProperties.$pinia._s.get('ui')
  await shelf.refresh()
  const exist = shelf.works.find((w) => w.title === '批注栏验证书')
  const wid = exist ? exist.id : (await shelf.createWork({ title: '批注栏验证书' })).id
  if (!work.work || work.work.id !== wid) { await work.open(wid); await sleep(900) }
  work.tab = 'chapters'
  if (!work.activeChapter) { await work.addChapter(work.volumes[0]?.id || null, '折叠验收章'); await sleep(500) }
  ui.focusMode = false
  ui.rightPanelOpen = true
  await sleep(300)
  return { ok: true, wid }
})()`)
if (!seed?.ok) {
  console.log('seed failed', JSON.stringify(seed))
  process.exit(1)
}

/* 1. 默认展开：面板存在且顶条（rp-head）带折叠按钮 */
const st1 = await c.evalx(`(() => {
  const p = document.querySelector('.right-panel')
  const head = p?.querySelector('.rp-head')
  return {
    panel: !!p,
    head: !!head,
    cap: head?.querySelector('.rp-cap')?.textContent.trim() || '',
    fold: !!p?.querySelector('.rp-fold')
  }
})()`)
check('1 默认展开且顶条含折叠按钮', st1.panel && st1.head && st1.fold && st1.cap === '批注栏', `cap=${st1.cap}`)

/* 2. 收起：面板消失、右缘细轨出现（竖排文字「批注栏」、贴屏幕右缘） */
await c.evalx(`document.querySelector('.rp-fold').click()`)
await sleep(400)
const st2 = await c.evalx(`(() => {
  const rail = document.querySelector('.rp-rail')
  const r = rail?.getBoundingClientRect()
  return {
    panel: !!document.querySelector('.right-panel'),
    rail: !!rail,
    text: rail?.querySelector('.rp-rail-text')?.textContent.trim() || '',
    right: r ? Math.abs(r.right - innerWidth) < 2 : false,
    h: r ? Math.round(r.height) : 0
  }
})()`)
check('2 收起后面板消失且右缘细轨出现', !st2.panel && st2.rail && st2.text === '批注栏', `贴右缘=${st2.right} 高=${st2.h}px`)
await shot('tools/_shot-rp-collapsed.png')

/* 3. 持久化记忆（收起态）：重载后仍收起 */
await c.evalx(`location.reload()`)
await sleep(2600)
await c.evalx(REOPEN)
const st3 = await c.evalx(`(() => ({
  open: !!document.querySelector('.right-panel'),
  rail: !!document.querySelector('.rp-rail')
}))()`)
check('3 重载后记忆收起态', !st3.open && st3.rail, `panel=${st3.open} rail=${st3.rail}`)

/* 4. 点击细轨展开恢复 */
await c.evalx(`document.querySelector('.rp-rail').click()`)
await sleep(400)
const st4 = await c.evalx(`(() => ({
  panel: !!document.querySelector('.right-panel'),
  rail: !!document.querySelector('.rp-rail')
}))()`)
check('4 点细轨恢复面板且细轨消失', st4.panel && !st4.rail)

/* 5. 持久化记忆（展开态）：重载后仍展开 */
await c.evalx(`location.reload()`)
await sleep(2600)
await c.evalx(REOPEN)
const st5 = await c.evalx(`(() => ({ open: !!document.querySelector('.right-panel') }))()`)
check('5 重载后记忆展开态', !!st5.open)

/* 6. 吸附顶条：面板压缩滚动到底，顶条仍钉在可视区顶端 */
const st6 = await c.evalx(`(() => {
  const p = document.querySelector('.right-panel')
  const old = p.getAttribute('style')
  p.setAttribute('style', 'height:240px;flex:none;overflow:auto')
  p.scrollTop = p.scrollHeight
  const head = p.querySelector('.rp-head').getBoundingClientRect()
  const pr = p.getBoundingClientRect()
  const ok = head.top >= pr.top - 0.5 && head.top < pr.top + 1
  p.setAttribute('style', old || '')
  p.scrollTop = 0
  return { headTop: Math.round(head.top - pr.top), ok }
})()`)
check('6 滚动到底顶条仍吸附顶端', st6.ok, `顶条距面板顶 ${st6.headTop}px`)

await shot('tools/_shot-rp-expanded.png')

const fails = results.filter((r) => !r.ok).length
console.log(`\n${results.length - fails}/${results.length} 通过`)
process.exit(fails ? 1 : 0)
