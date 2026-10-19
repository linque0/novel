/* 历史 v1 皮肤验收：v3 接入后书架已去 84px 竖栏、页头改 76px，几何不再适用。
   当前请运行 `node tools/crimson-v3-verify.mjs`。 */
/* 赤月戏（金屏夜梅）· 书架与外壳验收
   只允许在隔离的 Electron 配置上运行：
     electron . --dev --profile=crimson-skin-verify --remote-debugging-port=9225 --disable-backgrounding-occluded-windows
   绝不连接日常配置（--profile=dev 或默认配置直接拒绝）。
   断言以计算样式与几何数值为准（不看图猜），含设计稿四支入场关键帧的时长/缓动/错峰。 */
import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { connect } from './_cdp-lib.mjs'

const c = await connect('http://127.0.0.1:5173', '9225')
const ev = async (code, client = c) => {
  const r = await client.evalx(code)
  if (r?.PAGE_ERR) throw new Error(r.PAGE_ERR)
  return r
}
async function wait(code, client = c) {
  const end = Date.now() + 15000
  while (Date.now() < end) {
    if (await ev(code, client)) return
    await c.sleep(80)
  }
  throw new Error('Timed out: ' + code)
}
const check = (ok, msg) => {
  assert.ok(ok, msg)
  console.log('PASS ' + msg)
}
const num = (v) => Math.round(parseFloat(v) * 100) / 100
async function shot(name, width = 1440, height = 900, client = c) {
  await client.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
  await ev('document.fonts.ready.then(()=>true)', client)
  await ev('Promise.all(document.getAnimations().map(a=>a.finished.catch(()=>0))).then(()=>true)', client).catch(() => {})
  await c.sleep(250)
  await client.send('Page.bringToFront')
  const frame = await Promise.race([
    client.send('Page.captureScreenshot', { format: 'png' }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Screenshot timeout — launch Electron with --disable-backgrounding-occluded-windows')), 10000))
  ])
  await writeFile(new URL(`./_crimson-shelf-${name}.png`, import.meta.url), Buffer.from(frame.data, 'base64'))
}
async function init(client = c) {
  await wait('!!window.__ns && !!document.querySelector(".app-root")', client)
  await client.send('Emulation.setFocusEmulationEnabled', { enabled: true })
  await ev(`(async()=>{const {useUiStore}=await import('/src/stores/ui.js');const {useShelfStore}=await import('/src/stores/shelf.js');window.__skinCheck={ui:useUiStore(),shelf:useShelfStore(),work:__ns.getWork()};return true})()`, client)
}

let fixtures = []
let originalPrefs = null
try {
  await c.send('Page.reload', { ignoreCache: true })
  await init()
  const loc = await ev('native.getDataLocation()')
  console.log('# data dir: ' + loc.current)
  check(loc.defaultDir.endsWith('小说工坊-crimson-skin-verify'), 'isolated crimson verification profile')
  check(loc.current === loc.defaultDir && !loc.isCustom, 'verification profile does not redirect to another data directory')

  originalPrefs = await ev(`({skin:window.__skinCheck.ui.skin, theme:window.__skinCheck.ui.theme})`)

  /* 夹具：六种封面 + 一部四字题名（竖排规则）+ 首章正文（首章卡摘录）。
     书架按 updatedAt 倒序，所以「星尘旅人」最后创建，才会成为主展示。全部软删除收尾。 */
  fixtures = await ev(`(async()=>{
    const out=[]
    for(const kind of ['note','cedar','violet','claret','ink']){
      const row=await __skinCheck.shelf.createWork({title:'赤月验收·'+kind,author:kind==='violet'?'':'林间',genre:'科幻',status:kind==='cedar'?'构思':'连载',intro:'',kind,withVolume:true})
      out.push(row.id)
    }
    const star=await __skinCheck.shelf.createWork({title:'星尘旅人',author:'林间',genre:'科幻',status:'连载',intro:'一枚铜星的熄灭，\\n唤醒了一张被遗忘的星图。',kind:'novel',withVolume:true})
    out.push(star.id)
    const w=__skinCheck.work
    await w.open(star.id);const ch=await w.addChapter(w.volumes[0]?.id,'第一章 · 初雪')
    w.setChapterContent(ch.id,'<p>穹顶大厅的钟声在雾中回荡了十二下。</p><p>林远把掌心贴在观测台的铜面上。</p>')
    const {autosave}=await import('/src/services/autosave');await autosave.flushAll()
    await w.closeWork()
    await __skinCheck.ui.setSkin('crimson')
    await __skinCheck.shelf.refresh()
    return out
  })()`)
  await wait('!!document.querySelector(".crimson-shelf")')
  await c.sleep(600)

  /* 1) 皮肤与令牌 */
  check(await ev(`document.body.dataset.skin==='crimson' && document.querySelector('.app-root').dataset.skin==='crimson'`), 'shelf uses the crimson skin on body and root')
  check(await ev(`(()=>{const s=getComputedStyle(document.body);return s.getPropertyValue('--bg').trim()==='#171c1b'&&s.getPropertyValue('--gold').trim()==='#cfb06b'&&s.getPropertyValue('--paper').trim()==='#f1e8d5'&&s.getPropertyValue('--bg-panel').trim()==='#1c2926'})()`), 'crimson tokens reach body (including teleported surfaces)')
  check(await ev(`!!document.querySelector('.skin-picker')`), 'skin picker is present in the shelf header')

  /* 2) 书架结构（设计稿数值） */
  check(await ev(`(()=>{const h=document.querySelector('.crimson-header').getBoundingClientRect();const r=document.querySelector('.crimson-rail');return Math.round(h.height)===87&&!!r&&getComputedStyle(r).width==='84px'&&document.querySelectorAll('.crimson-nav-item').length===7})()`), '87px header, 84px vertical rail with seven modules')
  check(await ev(`(()=>{const h=document.querySelector('.crimson-header').getBoundingClientRect();const s=document.querySelector('.crimson-story').getBoundingClientRect();return Math.round(s.top-h.bottom)===135})()`), 'the story column starts 135px below the header')
  check(await ev(`(()=>{const s=document.querySelector('.crimson-stats');const last=s.querySelector(':scope > span:last-child');return s.querySelectorAll(':scope > span').length===3&&getComputedStyle(last).display==='none'})()`), 'the shelf stats show only words and chapters (genre/status live in the work menu)')
  check(await ev(`!!document.querySelector('.crimson-book-spine')`), 'the featured book has a visible spine')
  check(await ev(`(()=>{const l=document.querySelector('.crimson-program-list');return !l||getComputedStyle(l).overflowX==='hidden'})()`), 'the program column clips horizontal spill instead of showing a second scrollbar')
  check(await ev(`(()=>{const a=document.querySelector('.crimson-nav-item.active');return !!a&&a.textContent.trim()==='书架'})()`), 'the shelf module is the active rail item')
  check(await ev(`(()=>{const p=document.querySelector('.crimson-program').getBoundingClientRect();const s=document.querySelector('.crimson-story').getBoundingClientRect();return Math.round(p.width)===316&&Math.round(s.width)===305})()`), 'program aside is 316px and the story column is 305px')
  check(await ev(`(()=>{const t=document.querySelector('.crimson-main-title');const cs=getComputedStyle(t);const r=t.getBoundingClientRect();return cs.writingMode==='vertical-rl'&&parseFloat(cs.fontSize)===64&&Math.round(r.width)===77&&Math.round(r.height)===300})()`), 'a four-character title is set vertically: 64px, 77×300')
  check(await ev(`(()=>{const s=document.querySelector('.crimson-synopsis');return getComputedStyle(s).writingMode==='vertical-rl'})()`), 'the synopsis is vertical beside the vertical title')
  check(await ev(`(()=>{const b=document.querySelector('.crimson-book-object');const cs=getComputedStyle(b);return parseFloat(cs.width)===181&&parseFloat(cs.height)===255&&cs.transform!=='none'})()`), 'the featured book is a 181×255 object with a 3D pose')
  check(await ev(`(()=>{const c=document.querySelector('.crimson-book-stage .crimson-cover');return !!c&&/\\bk-novel\\b/.test(c.className)})()`), 'the featured cover keeps the generated kind palette')
  check(await ev(`(()=>{const c=document.querySelector('.crimson-chapter-card');const ch=window.__skinCheck.work.chapters||[];return !!c&&Math.round(c.getBoundingClientRect().width)===325&&/第一章 · 初雪/.test(c.textContent)&&/穹顶大厅的钟声/.test(c.textContent)})()`), 'the first-chapter card shows the real chapter title and a real excerpt')
  check(await ev(`(()=>{const rows=document.querySelectorAll('.crimson-work-row');return rows.length===Math.max(0,window.__skinCheck.shelf.works.length-1)&&rows.length>=5})()`), 'the program lists every other work as a row')
  check(await ev(`(()=>{const f=document.querySelector('.crimson-footer').getBoundingClientRect();return Math.round(f.height)===40})()`), 'a 40px status bar closes the shelf')

  await c.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
  await c.sleep(400)
  await shot('crimson-1440')
  await c.send('Emulation.setDeviceMetricsOverride', { width: 1080, height: 680, deviceScaleFactor: 1, mobile: false })
  await c.sleep(500)
  check(await ev(`document.documentElement.scrollWidth<=innerWidth && document.querySelector('.crimson-shelf').scrollWidth<=document.querySelector('.crimson-shelf').clientWidth`), 'minimum desktop size (1080×680) has no horizontal overflow')
  await shot('crimson-1080', 1080, 680)

  /* 3) 交互：搜索 / 无结果 / 打开 / 菜单隔离 */
  await ev(`(()=>{const i=document.querySelector('.crimson-search input');i.value='赤月验收·note';i.dispatchEvent(new Event('input',{bubbles:true}));return true})()`)
  await c.sleep(500)
  check(await ev(`/赤月验收/.test(document.querySelector('.crimson-main-title').textContent)`), 'search re-features the matching work')
  await ev(`(()=>{const i=document.querySelector('.crimson-search input');i.value='没有这本';i.dispatchEvent(new Event('input',{bubbles:true}));return true})()`)
  await c.sleep(400)
  check(await ev(`!!document.querySelector('.crimson-empty') && !document.querySelector('.crimson-work-row')`), 'an empty search keeps create/settings reachable and shows no rows')
  await ev(`(()=>{const i=document.querySelector('.crimson-search input');i.value='';i.dispatchEvent(new Event('input',{bubbles:true}));return true})()`)
  await c.sleep(500)
  await ev(`document.querySelector('.crimson-work-menu .n-button').click()`)
  await c.sleep(400)
  check(!(await ev(`!!document.querySelector('.workbench-shell')`)), 'opening the work menu does not open the work')
  await ev(`document.body.click()`)
  await c.sleep(300)
  await ev(`document.querySelector('.crimson-book-object').click()`)
  await wait(`!!document.querySelector('.workbench-shell')`)
  check(await ev(`window.__skinCheck.work.work?.title==='星尘旅人'`), 'single click opens the featured work')
  check(await ev(`document.querySelectorAll('.crimson-topnav-item').length===7 && !document.querySelector('.nav-rail')`), 'workbench keeps seven top navigation items and no side rail')

  /* 4) 入场动效（设计稿四支 + 书架五支） */
  await ev(`window.__skinCheck.work.closeWork()`)
  await wait('!!document.querySelector(".crimson-shelf")')
  await c.sleep(300)
  await ev(`(()=>{[...document.querySelectorAll('.crimson-footer-link')][0].click();return true})()`)
  await c.sleep(120)
  /* CSS 动画的 timing function 落在每个关键帧上（effect.getTiming().easing 恒为 linear），所以读 keyframes[0].easing */
  const anims = await ev(`document.getAnimations().map(a=>({name:a.animationName,dur:a.effect.getTiming().duration,delay:a.effect.getTiming().delay,ease:(a.effect.getKeyframes?.()[0]?.easing)||a.effect.getTiming().easing,target:(a.effect.target.className||'').toString().slice(0,32)}))`)
  const byName = (n) => anims.filter((a) => a.name === n)
  check(byName('paper-back').length === 1 && byName('paper-back')[0].dur === 1200 && /cubic-bezier\(0\.2, 0\.65, 0\.2, 1\)/.test(byName('paper-back')[0].ease), 'the stage backdrop plays paper-back for 1.2s with the design easing')
  check(byName('paper-front').length === 1 && byName('paper-front')[0].dur === 1200, 'the foreground paper layer plays paper-front')
  check(byName('title-mask').length === 1, 'the story column reveals through title-mask')
  check(byName('paper-book').length === 1 && byName('paper-book')[0].dur === 800, 'the book rises with paper-book (0.8s)')
  check(byName('crimson-enter').length >= 1 && byName('crimson-enter')[0].delay === 120, 'the program and chapter card enter after a 120ms beat')
  check(await ev(`document.body.dataset.stagePlay==='1'`), 'the stage play flag is set while the entrance runs')
  await c.sleep(1700)
  check(await ev(`!('stagePlay' in document.body.dataset)`), 'the stage play flag is cleared after the entrance')

  /* 降级：系统减少动画时直接终态、不播 */
  await c.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  await c.sleep(300)
  await ev(`(()=>{[...document.querySelectorAll('.crimson-footer-link')][0].click();return true})()`)
  await c.sleep(200)
  check(await ev(`document.getAnimations().length===0 && parseFloat(getComputedStyle(document.querySelector('.crimson-stage-art')).opacity)===1`), 'reduced motion shows the finished stage with no animation')

  /* 5) 皮肤隔离：切到另两套不出现任何 crimson 规则 */
  await ev(`window.__skinCheck.ui.setSkin('glaze').then(()=>true)`)
  await wait(`document.body.dataset.skin==='glaze'`)
  check(await ev(`!document.querySelector('.crimson-shelf')&&!document.querySelector('.crimson-rail')`), 'glaze does not inherit crimson shelf structure')
  check(await ev(`getComputedStyle(document.body).getPropertyValue('--bg').trim()==='#e7eff1'`), 'glaze keeps its own tokens')
  await ev(`window.__skinCheck.ui.setSkin('gravity').then(()=>true)`)
  await wait(`document.body.dataset.skin==='gravity'`)
  check(await ev(`!document.querySelector('.crimson-shelf')`), 'gravity does not inherit crimson shelf structure')
  await ev(`window.__skinCheck.ui.setSkin('original').then(()=>true)`)
  await wait(`document.body.dataset.skin==='original'`)
  check(await ev(`!!document.querySelector('.shelf-grid')||!!document.querySelector('.shelf-body')`), 'original shelf stays untouched')

  /* 6) 皮肤持久化 */
  await ev(`window.__skinCheck.ui.setSkin('crimson').then(()=>true)`)
  await wait(`document.body.dataset.skin==='crimson'`)
  await c.send('Page.reload', { ignoreCache: true })
  await init()
  await wait('!!document.querySelector(".crimson-shelf")')
  check(await ev(`window.__skinCheck.ui.skin==='crimson'`), 'crimson skin survives a reload from IndexedDB')

  console.log('PASS crimson shelf suite')
} catch (error) {
  process.exitCode = 1
  console.error(error)
  console.error(await ev(`({skin:document.body?.dataset?.skin,shelf:!!document.querySelector('.crimson-shelf'),workbench:!!document.querySelector('.workbench-shell'),tab:window.__skinCheck?.work?.tab})`).catch(() => '(state unavailable)'))
  await shot('failure').catch(() => {})
} finally {
  if (fixtures.length) await ev(`(async()=>{await window.__skinCheck.work.closeWork();for(const id of ${JSON.stringify(fixtures)}){const row=await __ns.db.works.get(id);if(row)await window.__skinCheck.shelf.deleteWork(row)}await window.__skinCheck.ui.setSkin(${JSON.stringify(originalPrefs?.skin || 'original')});return true})()`).catch(() => {})
  else if (originalPrefs) await ev(`window.__skinCheck.ui.setSkin(${JSON.stringify(originalPrefs.skin)})`).catch(() => {})
  await c.send('Emulation.clearDeviceMetricsOverride')
  await c.send('Emulation.setEmulatedMedia', { features: [] })
  setTimeout(() => process.exit(process.exitCode || 0), 150)
}
