/* Run only against the isolated Electron --profile=gravity-skin-verify --dev
 * instance on CDP 9223. Uses real Pinia/Dexie/native settings synchronization.
 * Screenshots: tools/_skin-*.png. Never targets the user's normal profile. */
import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { connect } from './_cdp-lib.mjs'

const c = await connect('http://127.0.0.1:5173', '9223')
const evaluate = async (code, client = c) => {
  const result = await client.evalx(code)
  if (result?.PAGE_ERR) throw new Error(result.PAGE_ERR)
  return result
}
const wait = async (code, client = c) => {
  const until = Date.now() + 15000
  while (Date.now() < until) {
    if (await evaluate(code, client)) return
    await c.sleep(80)
  }
  throw new Error('Timed out: ' + code)
}
const init = async (client = c) => {
  await client.send('Emulation.setFocusEmulationEnabled', { enabled: true })
  await wait('!!window.__ns && !!document.querySelector(".app-root")', client)
  await evaluate(`(async()=>{const {useUiStore}=await import('/src/stores/ui.js');const {useShelfStore}=await import('/src/stores/shelf.js');window.__skinCheck={ui:useUiStore(),shelf:useShelfStore(),work:window.__ns.getWork()};return true})()`, client)
}
const check = (value, message) => { assert.ok(value, message); console.log('PASS ' + message) }
async function shot(name, width = 1400, height = 880) {
  await c.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
  await evaluate('document.fonts.ready.then(()=>true)')
  await evaluate(`Promise.all(document.getAnimations().filter(a=>a.effect?.getComputedTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{}))).then(()=>true)`)
  await c.send('Page.bringToFront')
  const frame = await Promise.race([c.send('Page.captureScreenshot', { format: 'png' }), new Promise((_, reject)=>setTimeout(()=>reject(new Error('Screenshot timed out: launch Electron with --disable-backgrounding-occluded-windows')),10000))])
  await writeFile(new URL(`./_skin-${name}.png`, import.meta.url), Buffer.from(frame.data, 'base64'))
}

let originalPrefs, panel, fixtureIds = []
try {
  await c.send('Page.reload', { ignoreCache: true })
  await init()
  const loc = await evaluate('window.native.getDataLocation()')
  check(loc.defaultDir.endsWith('小说工坊-gravity-skin-verify'), 'isolated verification profile')
  check(loc.current === loc.defaultDir && !loc.isCustom, 'verification profile does not redirect to another data directory')
  originalPrefs = await evaluate('(async()=>{const rows=await __ns.db.appconfig.toArray();return rows.filter(r=>["skin","theme"].includes(r.key))})()')
  await evaluate(`(async()=>{await __skinCheck.ui.setSkin('original');await __skinCheck.shelf.refresh();return true})()`)
  await wait('!!document.querySelector(".shelf-grid,.empty-shelf")')
  await shot('original')

  fixtureIds = await evaluate(`(async()=>{
    window.__skinFixtures=[];
    for(const [i,kind] of ['novel','note','cedar','violet','claret','ink'].entries()) {
      const row=await __skinCheck.shelf.createWork({title:i===5?'星尘旅人':i===4?'一部名字很长很长的中文与 English 混排小说':'引力验收·'+kind,author:i===3?'':'林间',genre:'科幻',status:i===2?'构思':'连载',intro:i===5?'一枚铜星的熄灭，\\n唤醒了一张被遗忘的星图。':'',kind,withVolume:i!==0});
      __skinFixtures.push(row.id);
    }
    await __skinCheck.ui.setSkin('gravity');return __skinFixtures;
  })()`)
  await wait('!!document.querySelector(".gravity-shelf")')
  check(await evaluate('document.body.dataset.skin==="gravity"'), 'shelf uses gravity effective skin')
  check(await evaluate(`getComputedStyle(document.body).getPropertyValue('--bg-panel').trim()==='#14212c' && getComputedStyle(document.querySelector('.app-root')).getPropertyValue('--bg-panel').trim()==='#14212c'`), 'gravity tokens override original theme on root and teleported surfaces')
  check(await evaluate('document.querySelectorAll(".gravity-library-item").length===__skinCheck.shelf.works.length-1'), 'all remaining works are accessible')
  check(await evaluate(`(async()=>{const rows=await __ns.db.works.bulkGet(__skinFixtures);return rows.map(r=>r.kind).join(',')==='novel,note,cedar,violet,claret,ink' && (await __ns.db.volumes.where('workId').equals(__skinFixtures[0]).count())===0 && (await __ns.db.volumes.where('workId').equals(__skinFixtures[1]).count())===1})()`), 'six cover choices and default-volume choice are preserved')
  await shot('gravity-1400')
  await shot('gravity-1080', 1080, 680)
  check(await evaluate('document.documentElement.scrollWidth<=innerWidth && document.querySelector(".gravity-scroll").scrollWidth<=document.querySelector(".gravity-scroll").clientWidth'), 'minimum desktop width has no horizontal overflow')
  check(await evaluate(`document.querySelector('.gravity-scroll').getBoundingClientRect().bottom<=document.querySelector('.gravity-dock').getBoundingClientRect().top`), 'navigation never overlays the scrollable book area')
  await c.send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 880, deviceScaleFactor: 1, mobile: false })

  // Query through the actual input, including no-results recovery.
  const search = async value => {
    await evaluate(`(()=>{const el=document.querySelector('.gravity-tools input');el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('input',{bubbles:true}));return true})()`)
  }
  await search('不存在的作品');await wait('!!document.querySelector(".gravity-empty")')
  check(await evaluate('document.querySelectorAll(".gravity-dock button:disabled").length===5'), 'empty search disables only work navigation')
  await shot('no-results')
  await search('星尘旅人');await wait('document.querySelectorAll(".gravity-library-item").length===0 && !!document.querySelector(".gravity-main-book")')
  check(await evaluate('document.querySelector(".gravity-feature-copy h2").textContent==="星尘旅人"'), 'search changes the featured work')
  await shot('single')
  await search('');await wait('!!document.querySelector(".gravity-library-item")')

  // A normal click opens the displayed work, then every original module remains reachable.
  const expected = await evaluate('__skinCheck.shelf.works[0].id')
  await evaluate('document.querySelector(".gravity-main-book .gravity-book-open").click()')
  await wait('__skinCheck.ui.view==="work" && !!document.querySelector(".wb-body")')
  check(await evaluate('__skinCheck.work.work.id') === expected, 'single click opens the correct work')
  check(await evaluate('document.body.dataset.skin==="original" && __skinCheck.ui.skin==="gravity"'), 'workbench retains original appearance and selected preference')
  await evaluate('__skinCheck.work.closeWork().then(()=>true)')
  await wait('!!document.querySelector(".gravity-shelf")')
  await evaluate(`(()=>{window.__skinOpenCount=0;__skinCheck.work.$onAction(({name})=>{if(name==='open')__skinOpenCount++});document.querySelector('.gravity-main-book .gravity-book-open').focus();return true})()`)
  await c.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13, text: '\r' })
  await c.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
  await wait('__skinCheck.ui.view==="work"')
  check(await evaluate('__skinOpenCount===1'), 'keyboard Enter opens exactly once')
  await evaluate('__skinCheck.work.closeWork().then(()=>true)');await wait('!!document.querySelector(".gravity-shelf")')
  for (const key of ['outline','lore','characters','snippets','chapters']) {
    await evaluate(`(()=>{const labels={outline:'大纲',lore:'设定',characters:'人物',snippets:'灵感',chapters:'正文'};[...document.querySelectorAll('.gravity-dock button')].find(b=>b.textContent.includes(labels[${JSON.stringify(key)}])).click();return true})()`)
    await wait(`__skinCheck.ui.view==='work' && __skinCheck.work.tab===${JSON.stringify(key)}`)
    check(await evaluate('document.body.dataset.skin==="original"'), 'dock opens original ' + key)
    await evaluate('__skinCheck.work.closeWork().then(()=>true)');await wait('!!document.querySelector(".gravity-shelf")')
  }

  // Menu must not open a book; edit via the existing shared modal.
  await evaluate('document.querySelector(".gravity-main-book .gravity-book-menu button").click()')
  await wait('!!document.querySelector(".n-dropdown-menu")')
  check(await evaluate('__skinCheck.ui.view==="shelf"'), 'book menu does not trigger opening')
  await evaluate(`[...document.querySelectorAll('.n-dropdown-option-body')].find(n=>n.textContent.includes('编辑信息')).click()`)
  await wait('!!document.querySelector(".n-modal input")')
  await shot('edit')
  await evaluate(`(()=>{const fields=document.querySelectorAll('.n-modal input');for(const [el,value] of [[fields[0],'星尘旅人 · 修订'],[fields[1],'林间修订'],[document.querySelector('.n-modal textarea'),'修订后的作品简介']]){el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}))}[...document.querySelectorAll('.n-modal button')].find(b=>b.textContent.trim()==='保存').click();return true})()`)
  await wait('!document.querySelector(".n-modal") && document.querySelector(".gravity-feature-copy h2").textContent==="星尘旅人 · 修订"')
  check(await evaluate(`(async()=>{const row=await __ns.db.works.get(${JSON.stringify(expected)});return row.title==='星尘旅人 · 修订'&&row.author==='林间修订'&&row.intro==='修订后的作品简介'})()`), 'shared edit form persists title/author/introduction and refreshes shelf')

  // Use the original create form, then delete this newly created work via its menu.
  await evaluate('document.querySelector(".gravity-create").click()');await wait('!!document.querySelector(".n-modal input")')
  await evaluate(`(()=>{const el=document.querySelector('.n-modal input');el.value='引力验收·表单新建';el.dispatchEvent(new Event('input',{bubbles:true}));[...document.querySelectorAll('.n-modal button')].find(b=>b.textContent.trim()==='创建').click();return true})()`)
  await wait('!document.querySelector(".n-modal") && document.querySelector(".gravity-feature-copy h2").textContent==="引力验收·表单新建"')
  const createdId = await evaluate('__skinCheck.shelf.works[0].id');fixtureIds.push(createdId)
  check(await evaluate(`__ns.db.volumes.where('workId').equals(${JSON.stringify(createdId)}).count().then(n=>n===1)`), 'shared create form creates a work with its default volume')
  await evaluate('document.querySelector(".gravity-main-book .gravity-book-menu button").click()');await wait('!!document.querySelector(".n-dropdown-menu")')
  await evaluate(`[...document.querySelectorAll('.n-dropdown-option-body')].find(n=>n.textContent.includes('删除')).click()`)
  await wait(`!__skinCheck.shelf.works.some(w=>w.id===${JSON.stringify(createdId)})`)
  check(await evaluate(`__ns.db.works.get(${JSON.stringify(createdId)}).then(w=>!!w.deletedAt)`), 'delete remains recoverable soft deletion')

  // Exercise the visible skin picker, not only its backing store action.
  await evaluate('document.querySelector(".skin-picker .n-base-selection").click()')
  await wait('!!document.querySelector(".n-base-select-option")')
  await evaluate(`[...document.querySelectorAll('.n-base-select-option')].find(n=>n.textContent.includes('原版工坊')).click()`)
  await wait('__skinCheck.ui.skin==="original" && !document.querySelector(".gravity-shelf")')
  check(await evaluate('__ns.db.appconfig.get("skin").then(r=>r.value==="original")'), 'visible picker switches back and persists original skin')
  await evaluate('__skinCheck.ui.setSkin("gravity").then(()=>true)');await wait('!!document.querySelector(".gravity-shelf")')

  // DB failures cannot show an unsaved skin or disturb unrelated theme preferences.
  check(await evaluate(`(async()=>{const put=__ns.db.appconfig.put;const before=__skinCheck.ui.theme;__ns.db.appconfig.put=()=>Promise.reject(new Error('forced disk failure'));try{await __skinCheck.ui.setSkin('original');return false}catch{return __skinCheck.ui.skin==='gravity'&&__skinCheck.ui.theme===before}finally{__ns.db.appconfig.put=put}})()`), 'failed skin save retains current skin and theme')

  // Actual native settings window persists and broadcasts the change back to main.
  await evaluate('window.native.panelOpen({type:"settings",workId:"app",entityId:"",title:"设置"})')
  const panelDeadline = Date.now() + 10000
  while (!(await (await fetch('http://127.0.0.1:9223/json/list')).json()).some(row=>row.url.includes('panel='))) {
    assert.ok(Date.now() < panelDeadline, 'settings panel appears')
    await c.sleep(80)
  }
  panel = await connect('panel=', '9223');await init(panel)
  check(await evaluate('document.body.dataset.skin==="original" && !!document.querySelector(".skin-picker")', panel), 'settings window keeps original appearance with skin picker')
  await evaluate('__skinCheck.ui.setSkin("original").then(()=>true)', panel)
  await wait('__skinCheck.ui.skin==="original" && !document.querySelector(".gravity-shelf")')
  check(true, 'settings preference synchronizes to main')
  await evaluate('__skinCheck.ui.setSkin("gravity").then(()=>true)', panel)
  await wait('!!document.querySelector(".gravity-shelf")')

  await c.send('Page.reload', { ignoreCache: true });await init()
  await wait('!!document.querySelector(".gravity-shelf")')
  check(await evaluate('__skinCheck.ui.skin==="gravity"'), 'skin survives reload from IndexedDB')

  for (const theme of ['xuan','parchment','night']) {
    await evaluate(`__skinCheck.ui.setPref('theme',${JSON.stringify(theme)}).then(()=>true)`)
    await evaluate('__skinCheck.ui.setSkin("original").then(()=>true)')
    await wait('!document.querySelector(".gravity-shelf")')
    check(await evaluate(`document.body.classList.contains('theme-${theme}') && document.body.dataset.skin==='original'`), 'original theme ' + theme + ' retained')
    await evaluate('__skinCheck.ui.setSkin("gravity").then(()=>true)')
    await wait('!!document.querySelector(".gravity-shelf")')
  }

  await evaluate('(()=>{__skinCheck.shelf.works=[];return true})()')
  await wait('!!document.querySelector(".gravity-empty")');await shot('empty')
  check(await evaluate('document.querySelectorAll(".gravity-dock button:disabled").length===5'), 'empty library retains create/settings/skin controls')
  await evaluate('__skinCheck.shelf.refresh().then(()=>true)')
  await c.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  check(await evaluate('getComputedStyle(document.querySelector(".gravity-main-book")).animationName==="none"'), 'reduced motion disables floating animation')
  console.log('ALL SKIN INTEGRATION CHECKS PASSED')
} catch (error) {
  console.error(error);process.exitCode = 1
} finally {
  try {
    // Delete only this script's named fixtures in its dedicated profile.
    if (fixtureIds.length) await evaluate(`(async()=>{await __skinCheck.work.closeWork();for(const id of ${JSON.stringify(fixtureIds)}){const row=await __ns.db.works.get(id);if(row)await __skinCheck.shelf.deleteWork(row)}return true})()`)
    if (originalPrefs) await evaluate(`(async()=>{await __ns.db.appconfig.bulkDelete(['skin','theme']);await __ns.db.appconfig.bulkPut(${JSON.stringify(originalPrefs)});__skinCheck.ui.theme='xuan';await __skinCheck.ui.loadPrefs();await __skinCheck.shelf.refresh();return true})()`)
    if (panel) await evaluate('window.native.panelCloseSelf()', panel)
    await c.send('Emulation.clearDeviceMetricsOverride')
    await c.send('Emulation.setEmulatedMedia', { features: [] })
  } catch (error) { console.error('Cleanup:', error.message);process.exitCode = 1 }
  process.exit(process.exitCode || 0)
}
