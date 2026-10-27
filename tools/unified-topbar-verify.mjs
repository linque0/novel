/* Real app regression checks. Run only in the isolated --profile=topbar-unification-verify instance. */
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { connect } from './_cdp-lib.mjs'

const c = await connect('http://127.0.0.1:5173', '9333')
const out = new URL('../docs/topbar-unification/', import.meta.url)
await mkdir(out, { recursive: true })
let passed = 0
async function ev(code) {
  const r = await c.evalx(code)
  if (r?.PAGE_ERR) throw new Error(r.PAGE_ERR)
  return r
}
async function stores(code) {
  return ev(`(async()=>{const {useUiStore}=await import('/src/stores/ui.js');const {useWorkStore}=await import('/src/stores/work.js');const {useShelfStore}=await import('/src/stores/shelf.js');const ui=useUiStore(),work=useWorkStore(),shelf=useShelfStore();${code}})()`)
}
async function wait(code) {
  const end = Date.now() + 15000
  while (Date.now() < end) { if (await ev(code)) return; await c.sleep(80) }
  throw new Error('Timed out: ' + code)
}
function check(ok, message) { assert.ok(ok, message); passed++; console.log('PASS ' + message) }
async function click(key) { return ev(`(()=>{const b=document.querySelector('.app-topnav [data-nav="${key}"]');b?.click();return !!b})()`) }
async function shot(name) {
  await c.send('Page.bringToFront')
  await ev('window.$msg?.destroyAll()')
  await wait(`!document.querySelector('.n-message')`)
  await ev('document.fonts.ready.then(()=>true)')
  await wait(`!document.body.dataset.stagePlay && document.getAnimations().every(a=>a.effect?.getComputedTiming().iterations===Infinity || a.playState!=='running')`)
  const { data } = await c.send('Page.captureScreenshot', { format: 'png' })
  await writeFile(new URL(name + '.png', out), Buffer.from(data, 'base64'))
}
const labels = ['书架', '正文', '大纲', '设定', '人物', '灵感', '设置']
const modules = ['chapters', 'outline', 'lore', 'characters', 'snippets']
async function more(label) {
  await ev(`document.querySelector('.app-topbar [title="拆窗、书签、沉浸、阅读与皮肤"]').click()`)
  await wait(`!![...document.querySelectorAll('.n-dropdown-option-body')].find(b=>b.textContent.trim()===${JSON.stringify(label)})`)
  await ev(`[...document.querySelectorAll('.n-dropdown-option-body')].find(b=>b.textContent.trim()===${JSON.stringify(label)}).click()`)
}
async function submenu(parent, label) {
  await ev(`document.querySelector('.app-topbar [title="拆窗、书签、沉浸、阅读与皮肤"]').click()`)
  await wait(`!![...document.querySelectorAll('.n-dropdown-option-body')].find(b=>b.textContent.trim()===${JSON.stringify(parent)})`)
  const at = await ev(`(()=>{const r=[...document.querySelectorAll('.n-dropdown-option-body')].find(b=>b.textContent.trim()===${JSON.stringify(parent)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`)
  await c.send('Input.dispatchMouseEvent', { type:'mouseMoved', ...at })
  await wait(`!![...document.querySelectorAll('.n-dropdown-option-body')].find(b=>b.textContent.trim()===${JSON.stringify(label)})`)
  await ev(`[...document.querySelectorAll('.n-dropdown-option-body')].find(b=>b.textContent.trim()===${JSON.stringify(label)}).click()`)
  await c.send('Input.dispatchMouseEvent', { type:'mouseMoved', x:700, y:800 })
}
async function input(selector, value) {
  await ev(`(()=>{const i=document.querySelector(${JSON.stringify(selector)});i.value=${JSON.stringify(value)};i.dispatchEvent(new Event('input',{bubbles:true}))})()`)
}
async function panelTarget(type) {
  const end = Date.now() + 15000
  while (Date.now() < end) {
    const pages = await (await fetch('http://127.0.0.1:9333/json/list')).json()
    const page = pages.find(p => p.type === 'page' && new URL(p.url).searchParams.get('panel')?.startsWith(type + ':'))
    if (page) return page
    await c.sleep(80)
  }
  throw new Error('Panel did not open: ' + type)
}
try {
  await c.send('Emulation.setFocusEmulationEnabled', { enabled:true })
  await c.send('Page.navigate', { url:'http://127.0.0.1:5173/' })
  await wait('!!window.__ns && !!document.querySelector(".app-root")')
  const fixture = await stores(`if(ui.view!=='shelf')await work.closeWork();await shelf.refresh();if(shelf.works.length<2){await shelf.createWork({title:'导航验收甲',genre:'科幻',status:'构思'});await shelf.createWork({title:'导航验收乙',genre:'悬疑',status:'构思'})}return shelf.works.slice(0,2).map(w=>({id:w.id,title:w.title}));`)
  await ev(`window.__topbarErrors=[];addEventListener('error',e=>window.__topbarErrors.push(e.message));addEventListener('unhandledrejection',e=>window.__topbarErrors.push(String(e.reason)));`)
  for (const skin of ['original', 'gravity', 'glaze', 'crimson']) {
    await stores(`if(ui.view!=='shelf')await work.closeWork();await ui.setSkin('${skin}');await ui.setPref('topbarAutoHide',false);ui.aiDrawerOpen=false;ui.focusMode=false;ui.readMode=false;`)
    await wait('!!document.querySelector(".app-topbar")')
    await c.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
    const nav = await ev(`[...document.querySelectorAll('.app-topnav button')].map(b=>b.textContent.trim())`)
    check(JSON.stringify(nav) === JSON.stringify(labels), `${skin} 书架七项导航顺序一致`)
    check(await ev(`document.querySelectorAll('.app-topbar').length===1&&!document.querySelector('.gravity-dock,.glaze-top-nav,.crimson-shelf-nav,.nav-rail')`), `${skin} 只有一套导航`)
    for (const width of [1440, 1080, 390, 780]) {
      await c.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false })
      check(await ev(`document.documentElement.scrollWidth<=innerWidth+1&&document.querySelector('.app-topnav').clientWidth>100`), `${skin} 书架 ${width}px 顶栏无页面溢出`)
      check(await ev(`(()=>{const host=document.querySelector('.app-topbar-shell'),next=host.nextElementSibling;return next.getBoundingClientRect().top>=host.getBoundingClientRect().bottom-1})()`), `${skin} 书架 ${width}px 顶栏不覆盖内容`)
    }
    await shot(`${skin}-shelf`)
    await click('settings')
    const settings = await panelTarget('settings')
    check(!!settings, `${skin} 顶栏设置打开独立窗口`)
    await c.send('Target.closeTarget', { targetId:settings.id })
    await c.send('Page.bringToFront')
    if (skin === 'gravity') {
      const selected = await ev(`(()=>{const b=document.querySelector('.gravity-slot--left .gravity-book-open,.gravity-slot--right .gravity-book-open');const title=b.getAttribute('aria-label').match(/将《(.*)》/)[1];b.click();return title})()`)
      await wait(`document.querySelector('.gravity-feature-copy h2')?.textContent===${JSON.stringify(selected)}`)
      await click('characters')
      await wait(`!!document.querySelector('.workbench-shell')`)
      check(await stores(`return work.work.title===${JSON.stringify(selected)}&&work.tab==='characters'`), '引力书舱导航跟随用户翻到中央的作品')
      await click('shelf')
      await wait(`!!document.querySelector('.gravity-shelf')&&!document.querySelector('[data-nav="characters"]').disabled`)
    }
    // Filtering changes the displayed work; the navigation must open that work, not an old recent one.
    const inputSelector = skin === 'original' ? '.shelf-search input' : skin === 'gravity' ? '.gravity-tools input' : skin === 'glaze' ? '.glaze-shelf-tools input' : '.crimson-search input'
    await input(inputSelector, '__topbar_no_matching_work__')
    await wait(`[...document.querySelectorAll('.app-topnav button')].filter(b=>b.disabled).length===5`)
    await click('chapters')
    check(await ev(`!document.querySelector('.workbench-shell')`), `${skin} 搜索无结果不打开其他作品`)
    await input(inputSelector, fixture[1].title)
    await wait(`!document.querySelector('[data-nav="outline"]').disabled`)
    // Delay/reject the real opening boundary: verify the UI handles busy and failure states.
    await stores(`work.__verifyOpen=work.open;work.open=()=>new Promise((resolve,reject)=>{window.__rejectOpen=reject});`)
    await click('outline')
    await wait(`[...document.querySelectorAll('.app-topnav button')].every(b=>b.disabled)`)
    await click('characters')
    check(await ev(`!document.querySelector('.workbench-shell')`), `${skin} 打开期间禁用导航并阻止重复跳转`)
    await ev(`window.__rejectOpen(new Error('topbar verification: opening rejected'))`)
    await wait(`!document.querySelector('[data-nav="outline"]').disabled`)
    check(await ev(`!document.querySelector('.workbench-shell')&&document.querySelector(${JSON.stringify(inputSelector)}).value===${JSON.stringify(fixture[1].title)}`), `${skin} 打开失败保留书架与搜索内容`)
    await stores(`work.open=work.__verifyOpen;delete work.__verifyOpen;`)
    await click('outline')
    await wait('!!document.querySelector(".workbench-shell")')
    check(await stores(`return work.work.id===${JSON.stringify(fixture[1].id)}&&work.tab==='outline'`), `${skin} 书架导航打开当前展示作品`)
    for (const mod of modules) {
      await click(mod)
      await wait(`document.querySelector('.workbench-shell')?.dataset.module==='${mod}'`)
      check(await ev(`document.querySelector('.app-topnav [aria-current="page"]')?.dataset.nav==='${mod}'&&document.querySelectorAll('.app-topbar').length===1&&!document.querySelector('.nav-rail')`), `${skin} ${mod} 切换与选中正确`)
    }
    if (skin === 'original') {
      const chapterId = await stores(`let ch=work.liveChapters.find(c=>c.title==='顶栏书签验证');if(!ch)ch=await work.addChapter(work.liveVolumes[0]?.id,'顶栏书签验证');if(!work.isChapterBookmarked(ch.id))work.toggleChapterBookmark(ch.id);return ch.id;`)
      await click('outline')
      await submenu('章节书签', '顶栏书签验证')
      check(await stores(`return work.tab==='chapters'&&work.selChapterId===${JSON.stringify(chapterId)}`), '更多菜单书签跳转到目标章节')
      await click('outline')
      await submenu('拆出独立窗口', '⧉ 大纲')
      const panel = await panelTarget('outline')
      await wait(`!!document.querySelector('.pop-lock-pane')`)
      check(true, '更多菜单可拆出大纲并显示主窗口编辑锁')
      await c.send('Target.closeTarget', { targetId:panel.id })
      await c.send('Page.bringToFront')
      await wait(`!document.querySelector('.pop-lock-pane')`)
      check(true, '关闭拆窗后主窗口恢复模块')
      await click('snippets')
    }
    for (const width of [1440, 1080, 780]) {
      await c.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false })
      check(await ev(`document.documentElement.scrollWidth<=innerWidth+1&&document.querySelector('.app-topnav').clientWidth>100`), `${skin} 书内 ${width}px 无页面溢出`)
      if (width < 1200) check(await ev(`getComputedStyle(document.querySelector('#studio-task-actions')).display==='none'`), `${skin} 窄窗收纳任务工具`)
    }
    await shot(`${skin}-work`)
    await c.send('Emulation.setDeviceMetricsOverride', { width:390, height:450, deviceScaleFactor:2, mobile:false })
    check(await ev(`document.documentElement.scrollWidth<=innerWidth+1&&document.querySelector('.app-topbar').getBoundingClientRect().height===100&&[...document.querySelectorAll('.app-topnav button')].every(b=>parseFloat(getComputedStyle(b).fontSize)>=14)`), `${skin} 200% 等效缩放重排顶栏且保留字号`)
    await shot(`${skin}-zoom200`)
    await c.send('Emulation.setDeviceMetricsOverride', { width:780, height:900, deviceScaleFactor:1, mobile:false })
    await ev(`document.querySelector('.app-topbar [title="展开或收起恍然梦对话"]').click()`)
    await wait(`!!document.querySelector('.ai-dock')`)
    await ev(`document.querySelector('.app-topbar [title="展开或收起恍然梦对话"]').click()`)
    check(await ev(`!document.querySelector('.ai-dock')`), `${skin} 恍然梦可从顶栏开合`)
    await more('沉浸写作')
    await wait(`document.querySelector('.workbench-shell.is-focus')`)
    await more('退出沉浸')
    await wait(`document.querySelector('.workbench-shell:not(.is-focus)')`)
    check(true, `${skin} 更多菜单可进入和退出沉浸`)
    await click('chapters')
    await more('阅读模式')
    await wait(`document.querySelector('.workbench-shell.is-reading')`)
    await more('退出阅读')
    await wait(`document.querySelector('.workbench-shell:not(.is-reading)')`)
    check(true, `${skin} 更多菜单可进入和退出阅读`)
    if (skin !== 'original') {
      await more('本模块恍然梦助手')
      await wait(`!!document.querySelector('.task-form')`)
      check(await ev(`document.querySelectorAll('#studio-task-actions').length===1&&document.querySelectorAll('#studio-task-actions .module-agent').length===1`), `${skin} 窄窗可打开唯一任务助手`)
      await ev(`[...document.querySelectorAll('.task-form button')].find(b=>b.textContent.trim()==='关闭').click()`)
      await wait(`!document.querySelector('.task-form')`)
    }
    await click('outline')
    await wait(`![...document.querySelectorAll('.n-dropdown-menu,.n-modal')].some(el=>el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden')`)
    await stores(`await ui.setPref('topbarAutoHide',true)`)
    await wait(`document.querySelector('.wb-topbar-host.is-auto:not(.is-expanded)')`)
    check(await ev(`document.querySelector('.wb-topbar-content').inert`), `${skin} 收起后内容不能获取焦点`)
    await ev(`document.querySelector('.wb-topbar-edge').click()`)
    await wait(`document.querySelector('.wb-topbar-host.is-expanded')`)
    check(await ev(`(()=>{const h=document.querySelector('.app-topbar').getBoundingClientRect();const b=document.querySelector('.wb-body').getBoundingClientRect();return b.top>=h.bottom-1})()`), `${skin} 展开后下推工作区`)
    await ev(`document.querySelector('.wb-topbar-host').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`)
    await wait(`document.querySelector('.wb-topbar-host:not(.is-expanded)')`)
    await ev(`document.querySelector('.wb-topbar-edge').click()`)
    await click('shelf')
    await wait('!document.querySelector(".workbench-shell")')
    check(await ev(`!!document.querySelector('.wb-topbar-host.is-auto:not(.is-expanded)')`), `${skin} 书架沿用收起偏好`)
    check(await ev(`(()=>{const host=document.querySelector('.app-topbar-shell'),next=host.nextElementSibling;return Math.abs(next.getBoundingClientRect().top-host.getBoundingClientRect().bottom)<=1})()`), `${skin} 书架收起后不留空白占位`)
    await wait(`(async()=>{const {useShelfStore}=await import('/src/stores/shelf.js');return !useShelfStore().loading})()`)
    await stores(`await ui.setPref('topbarAutoHide',false);shelf.__verifyWorks=shelf.works;shelf.works=[];`)
    await wait(`!document.querySelector('[data-nav="settings"]').disabled`)
    check(await ev(`[...document.querySelectorAll('.app-topnav button')].filter(b=>b.disabled).length===5`), `${skin} 空书架禁用五项作品导航`)
    check(await ev(`!document.querySelector('[data-nav="settings"]').disabled`), `${skin} 空书架仍可设置`)
    await stores(`shelf.works=shelf.__verifyWorks;delete shelf.__verifyWorks;`)
    await c.send('Emulation.setDeviceMetricsOverride', { width:1440, height:900, deviceScaleFactor:1, mobile:false })
    await shot(`${skin}-shelf-desktop`)
  }
  const errors = await ev('window.__topbarErrors||[]')
  check(errors.length === 0, `导航切换无运行时错误：${errors.join(';')}`)
  await stores(`await ui.setPref('topbarAutoHide',true)`)
  await c.send('Page.reload')
  await wait(`!!document.querySelector('.wb-topbar-host.is-auto')`)
  check(await ev(`!!document.querySelector('.wb-topbar-host.is-auto')`), '刷新后恢复顶栏收起偏好')
  await stores(`await ui.setPref('topbarAutoHide',false)`)
  await writeFile(new URL('checks.json', out), JSON.stringify({ passed, fixture }, null, 2))
  console.log(`${passed} checks passed`)
  process.exit(0)
} catch (error) { console.error(error); process.exit(1) }
