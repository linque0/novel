/* 大纲皮肤接入验收：引力书舱 / 琉光画境的正式样式是否在真实组件上生效，
   同时用原版与赤月戏做隔离对照。连接 CDP（默认 9333），访问 Vite 下的
   docs/outline-calibration-validation/?skin=... 内存页，不打开用户作品。 */
import { mkdir, writeFile } from 'node:fs/promises'
import { connect } from './_cdp-lib.mjs'

const PORT = process.env.CDP_PORT || '9333'
const BASE = process.env.BASE_URL || 'http://127.0.0.1:5173'
const PAGE = `${BASE}/docs/outline-calibration-validation/`
const OUT = new URL('../docs/outline-skin-integration/screenshots/', import.meta.url)
const JSON_OUT = new URL('../docs/outline-skin-integration/ui-checks.json', import.meta.url)
await mkdir(OUT, { recursive: true })

const c = await connect('outline-calibration-validation', PORT)
await c.send('Page.enable')
await c.send('Runtime.enable')
await c.send('Page.addScriptToEvaluateOnNewDocument', {
  source: `(() => {
    if (window.__errsInstalled) return;
    window.__errsInstalled = true;
    window.__errs = [];
    addEventListener('error', e => window.__errs.push('error: ' + (e.message || e.error)));
    addEventListener('unhandledrejection', e => window.__errs.push('rejection: ' + (e.reason && e.reason.message ? e.reason.message : e.reason)));
    const ce = console.error;
    console.error = (...a) => { window.__errs.push('console: ' + a.map(x => { try { return typeof x === 'string' ? x : JSON.stringify(x) } catch { return String(x) } }).join(' ')); ce.apply(console, a) };
  })();`
})

const ONLY = process.env.ONLY || ''
const checks = []
const failures = []
const pageErrors = []
const check = (ok, message) => {
  checks.push({ ok: !!ok, message })
  if (!ok) failures.push(message)
  console.log((ok ? 'PASS ' : 'FAIL ') + message)
}
const sleep = c.sleep
async function ev(expr) {
  const r = await c.evalx(expr)
  if (r && r.PAGE_ERR) throw new Error(r.PAGE_ERR)
  return r
}
async function wait(expr, timeout = 15000) {
  const end = Date.now() + timeout
  while (Date.now() < end) {
    if (await ev(expr)) return true
    await sleep(80)
  }
  throw new Error('Timed out: ' + expr)
}
async function nav(skin, width = 1440, height = 900) {
  /* 每次导航带唯一参数，避免 bfcache 恢复上一次 skin 的文档。 */
  const result = await c.send('Page.navigate', { url: `${PAGE}?skin=${skin}&t=${Date.now()}` })
  if (result && result.errorText) throw new Error(`navigate ${skin}: ${result.errorText}`)
  /* 等新文档真正提交：旧页面的 URL 仍是上一个 skin，可避免在卸载前误判为已加载。 */
  await wait(
    `location.search.includes('skin=${skin}') && document.body.dataset.skin === '${skin}' && document.querySelector('.app-root')?.dataset.skin === '${skin}' && document.readyState !== 'loading' && !!document.querySelector('.om-wrap') && !!document.querySelector('.oc-canvas-surface')`,
    20000
  )
  await c.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
  await ev('document.fonts.ready.then(() => true)')
  await wait('!!document.querySelector(".oc-node.oc-container")')
  await sleep(350)
}
async function shot(name) {
  await c.send('Page.bringToFront')
  const frame = await c.send('Page.captureScreenshot', { format: 'png' })
  await writeFile(new URL(name + '.png', OUT), Buffer.from(frame.data, 'base64'))
}
function parts(value) {
  const text = String(value || '')
  const rgb = text.match(/rgba?\(([^)]+)\)/)
  if (rgb) {
    const [r, g, b, a] = rgb[1].split(',').map((x) => Number(x.trim()))
    return { r, g, b, a: a == null ? 1 : a }
  }
  const srgb = text.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)/)
  if (srgb) {
    return {
      r: Math.round(Number(srgb[1]) * 255),
      g: Math.round(Number(srgb[2]) * 255),
      b: Math.round(Number(srgb[3]) * 255),
      a: srgb[4] == null ? 1 : Number(srgb[4])
    }
  }
  return null
}
function near(value, [r, g, b], tol = 3) {
  const p = parts(value)
  return !!p && Math.abs(p.r - r) <= tol && Math.abs(p.g - g) <= tol && Math.abs(p.b - b) <= tol
}
function lum(value) {
  const p = parts(value)
  return p ? (p.r + p.g + p.b) / 3 : -1
}
const css = (selector, prop) =>
  ev(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});return el?getComputedStyle(el)[${JSON.stringify(prop)}]:null})()`)

async function closeSettings() {
  await ev(`(()=>{const b=[...document.querySelectorAll('.oc-toolbar .oc-chip')].find(x=>x.textContent.trim()==='设置');if(b)b.click();return true})()`)
  await sleep(250)
}
async function openSettings() {
  await ev(`(()=>{const b=[...document.querySelectorAll('.oc-toolbar .oc-chip')].find(x=>x.textContent.trim()==='设置');if(b)b.click();return !!b})()`)
  await wait('!!document.querySelector(".n-popover .oc-settings")')
  await sleep(200)
}

async function skinCheck(skin, expect) {
  const label = skin === 'gravity' ? '引力书舱' : '琉光画境'
  await nav(skin)
  await wait(`getComputedStyle(document.querySelector('.om-wrap')).getPropertyValue('--oc-serif').includes('${expect.serif}')`, 8000)
  const canvas = await css('.oc-canvas-surface', 'backgroundColor')
  check(near(canvas, expect.canvas), `${label} 画布底色 ${expect.canvasName}（${canvas}）`)
  const serif = await ev(`getComputedStyle(document.querySelector('.om-wrap')).getPropertyValue('--oc-serif')`)
  check(String(serif).includes(expect.serif), `${label} 标题字体 ${expect.serif}（${serif}）`)
  const toolbar = await css('.oc-toolbar', 'backgroundColor')
  check(expect.toolbar(toolbar), `${label} 工具条配色（${toolbar}）`)
  const sidebar = await css('.ol-paper-sidebar', 'backgroundImage')
  check(String(sidebar).includes('linear-gradient'), `${label} 侧栏为渐变玻璃/舱体`)
  const container = await css('.oc-node.oc-container', 'backgroundColor')
  check(expect.container(container), `${label} 容器底色符合${expect.containerName}（${container}）`)
  const removed = await ev(`!document.querySelector('.oc-materials-btn') && !document.querySelector('.oc-textures-toggle') && !document.querySelector('.ol-side-add') && ![...document.querySelectorAll('button')].some(b=>b.textContent.includes('＋模块'))`)
  check(removed, `${label} 已移除素材/纹理/侧栏工具箱/＋模块入口`)
  const tools = await ev(`document.querySelectorAll('.oc-module-tools button').length`)
  check(tools >= 7, `${label} 工具条保留 7 类添加入口（${tools}）`)
  const handles = await ev(`document.querySelectorAll('.oc-node.oc-container .oc-rs').length`)
  check(handles >= 8, `${label} 容器保留八向缩放柄（${handles}）`)
  await ev(`(()=>{const b=[...document.querySelectorAll('.oc-zoom-controls button')].find(x=>x.textContent.trim()==='适应');if(b)b.click();return !!b})()`)
  await sleep(450)
  await shot(`${skin}-root`)

  // 就地展开与内容区滚动（用双列容器，贴近设计稿的就地展开状态）
  await ev(`(()=>{const b=[...document.querySelectorAll('.oc-head-actions button')].find(x=>x.textContent.includes('整理布局'));if(b)b.click();return true})()`)
  await sleep(450)
  const inlineNode = `[...document.querySelectorAll('.oc-node.oc-container')].find(c=>c.querySelector('.oc-ctitle')?.textContent.trim()==='灯塔疑云') || document.querySelector('.oc-node.oc-container')`
  const collapsedH = await ev(`(${inlineNode}).getBoundingClientRect().height`)
  await ev(`(${inlineNode})?.querySelector('.oc-inline-toggle')?.click()`)
  await wait('!!document.querySelector(".oc-mini-scroll")')
  await sleep(650)
  const expandedH = await ev(`(${inlineNode}).getBoundingClientRect().height`)
  check(expandedH > collapsedH + 80, `${label} 就地展开后容器增高（${Math.round(collapsedH)}→${Math.round(expandedH)}）`)
  const fit = await ev(`(()=>{const c=(${inlineNode}).getBoundingClientRect();const s=document.querySelector('.oc-mini-scroll').getBoundingClientRect();return {cb:c.bottom,sb:s.bottom}})()`)
  check(fit.sb <= fit.cb + 2, `${label} 迷你内容区不溢出容器（${Math.round(fit.sb)}≤${Math.round(fit.cb)}）`)
  check(await css('.oc-mini-scroll', 'overflowY') !== 'hidden', `${label} 就地展开内容区可滚动`)
  const mini = await css('.oc-mini', 'backgroundColor')
  check(near(mini, expect.mini), `${label} 迷你卡纸色（${mini}）`)
  await shot(`${skin}-inline`)
  await ev(`(${inlineNode})?.querySelector('.oc-inline-toggle')?.click()`)
  await sleep(350)

  // 抽屉
  await ev(`(()=>{const b=document.querySelector('.oc-node.oc-container .oc-cfoot .inspect');if(b)b.click();return !!b})()`)
  await wait('!!document.querySelector(".oc-drawer")')
  const drawer = await css('.oc-drawer', 'backgroundColor')
  check(expect.drawer(drawer), `${label} 抽屉${expect.drawerName}（${drawer}）`)
  const input = await css('.oc-drawer .oc-field input', 'backgroundColor')
  check(near(input, expect.input), `${label} 抽屉输入框配色（${input}）`)
  await shot(`${skin}-drawer`)
  await ev(`document.querySelector('.oc-drawer-x')?.click()`)
  await sleep(250)

  // 设置浮层（Teleport）
  await openSettings()
  const pop = await ev(`(()=>{const p=[...document.querySelectorAll('.n-popover')].find(el=>el.querySelector('.oc-settings'));return p?getComputedStyle(p).backgroundColor:null})()`)
  check(near(pop, expect.popover), `${label} 设置浮层${expect.popoverName}（${pop}）`)
  const popText = await css('.n-popover .oc-settings-label', 'color')
  check(near(popText, expect.popoverText), `${label} 设置浮层文字对比（${popText}）`)
  await shot(`${skin}-settings`)
  await closeSettings()

  // 搜索
  await ev(`(()=>{const i=document.querySelector('.oc-search input');i.value='灯塔';i.dispatchEvent(new Event('input',{bubbles:true}));return true})()`)
  await wait('!!document.querySelector(".oc-search-results .oc-search-item")')
  const searchBg = await css('.oc-search-results', 'backgroundColor')
  check(near(searchBg, expect.search), `${label} 搜索结果面板配色（${searchBg}）`)
  await shot(`${skin}-search`)
  await ev(`(()=>{const i=document.querySelector('.oc-search input');i.value='';i.dispatchEvent(new Event('input',{bubbles:true}));i.blur();document.body.click();return true})()`)
  await sleep(250)

  // 多选
  await ev(`(()=>{const b=[...document.querySelectorAll('.oc-toolbar .oc-chip')].find(x=>x.textContent.trim()==='多选');if(b)b.click();return !!b})()`)
  await wait('!!document.querySelector(".oc-pick-toggle")')
  check(await ev('document.querySelectorAll(".oc-pick-toggle").length > 0'), `${label} 多选模式可进入`)
  await shot(`${skin}-multi`)
  await ev(`(()=>{const b=[...document.querySelectorAll('.oc-toolbar .oc-chip')].find(x=>x.textContent.trim()==='多选');if(b)b.click();return true})()`)
  await sleep(250)

  // 进入容器与返回
  await ev(`(()=>{const b=document.querySelector('.oc-node.oc-container .oc-cfoot .enter');if(b)b.click();return !!b})()`)
  await wait('!!document.querySelector(".oc-crumbs button[aria-current=\'page\']") && !document.querySelector(".om-wrap.oc-root-scope")')
  check(true, `${label} 进入容器后显示面包屑`)
  await shot(`${skin}-inside`)
  await ev(`document.querySelector('.oc-back')?.click()`)
  await wait('!!document.querySelector(".om-wrap.oc-root-scope")')
  check(true, `${label} 可返回全书根层`)

  // 文本视图仍可用
  await ev(`(()=>{const b=[...document.querySelectorAll('.oc-head-actions button')].find(x=>x.textContent.trim()==='文本视图');if(b)b.click();return !!b})()`)
  await wait('!!document.querySelector(".outline-text-body")')
  await sleep(350)
  const editorText = await css('.outline-text-body', 'color')
  check(!!editorText, `${label} 文本视图仍可用（${editorText}）`)
  await shot(`${skin}-text`)
  await ev(`(()=>{const b=[...document.querySelectorAll('.ol-viewtoggle button')].find(x=>x.textContent.trim()==='画布');if(b)b.click();return !!b})()`)
  await wait('!!document.querySelector(".om-wrap") && !document.querySelector(".outline-text-body")')
  await sleep(350)

  // 画布透明度只影响背景层
  await ev(`(async()=>{const {useWorkStore}=await import('/src/stores/work.js');const w=useWorkStore();w.canvasPrefs.canvasOpacity=65;return true})()`)
  await sleep(250)
  check(Number(await css('.oc-canvas-surface', 'opacity')) === 0.65, `${label} 画布透明度 65% 只作用于背景层`)
  await shot(`${skin}-opacity`)
  await ev(`(async()=>{const {useWorkStore}=await import('/src/stores/work.js');const w=useWorkStore();w.canvasPrefs.canvasOpacity=100;return true})()`)
  await sleep(250)

  // 窄窗与侧栏 rail
  await c.send('Emulation.setDeviceMetricsOverride', { width: 780, height: 900, deviceScaleFactor: 1, mobile: false })
  await sleep(250)
  await ev(`(async()=>{const {useUiStore}=await import('/src/stores/ui.js');const u=useUiStore();u.outlineSideOpen=false;return true})()`)
  await wait(`(()=>{const r=document.querySelector('.ol-side-rail');return !!r && getComputedStyle(r).display!=='none' && r.getBoundingClientRect().width>0})()`)
  const overflow = await ev('({w:innerWidth,sw:document.documentElement.scrollWidth,bw:document.body.scrollWidth})')
  check(overflow.sw <= overflow.w + 1 && overflow.bw <= overflow.w + 1, `${label} 780px 窄窗无横向溢出`)
  const zoom = await ev(`(()=>{const r=document.querySelector('.oc-zoom-controls')?.getBoundingClientRect();return r?{l:r.left,t:r.top,r:r.right,b:r.bottom}:null})()`)
  check(!!zoom && zoom.l >= 0 && zoom.t >= 0 && zoom.r <= 780 && zoom.b <= 900, `${label} 窄窗缩放控件仍在画布内`)
  if (skin === 'glaze') {
    const pad = await css('.outline-surface', 'padding')
    check(/^8px/.test(String(pad)), `琉光画境 窄窗玻璃内衬收窄（${pad}）`)
  }
  await shot(`${skin}-narrow`)
  await ev(`(async()=>{const {useUiStore}=await import('/src/stores/ui.js');const u=useUiStore();u.outlineSideOpen=true;return true})()`)
  await c.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
  await sleep(300)

  const errs = await ev('window.__errs || []')
  if (errs.length) pageErrors.push({ skin, errors: errs })
  check(errs.length === 0, `${label} 控制台无 error（${errs.length}）`)
}

async function controlCheck(skin, expect) {
  await nav(skin)
  const canvas = await css('.oc-canvas-surface', 'backgroundColor')
  check(near(canvas, expect.canvas), `${expect.label} 画布底色保持不变`)
  const serif = await ev(`getComputedStyle(document.querySelector('.om-wrap')).getPropertyValue('--oc-serif')`)
  check(String(serif).includes('KingHwa OldSong'), `${expect.label} 仍使用共享/赤月标题字体`)
  const container = await css('.oc-node.oc-container', 'backgroundColor')
  check(lum(container) > 180, `${expect.label} 容器仍为浅纸分组（${container}）`)
  if (skin === 'crimson') {
    const paper = await ev(`getComputedStyle(document.querySelector('.om-wrap')).getPropertyValue('--oc-paper')`)
    check(String(paper).includes('#f2ead8'), '赤月戏专用大纲样式已加载')
    const sidebar = await css('.ol-paper-sidebar', 'backgroundImage')
    check(String(sidebar).includes('linear-gradient'), '赤月戏侧栏仍为深色书脊')
  }
  await shot(`${skin}-root`)
  const errs = await ev('window.__errs || []')
  if (errs.length) pageErrors.push({ skin, errors: errs })
  check(errs.length === 0, `${expect.label} 控制台无 error（${errs.length}）`)
}

try {
  if (!ONLY || ONLY === 'gravity') await skinCheck('gravity', {
    canvas: [14, 26, 35], canvasName: '#0e1a23', serif: 'Noto Serif SC',
    toolbar: (v) => near(v, [13, 24, 35]), container: (v) => lum(v) < 100,
    containerName: '深色分组底', mini: [247, 248, 243], drawer: (v) => near(v, [16, 28, 39], 3) && parts(v).a > 0.9,
    drawerName: '深色纸面', input: [11, 20, 29], popover: [18, 32, 44], popoverName: '深色',
    popoverText: [227, 236, 235], search: [18, 32, 44]
  })
  if (!ONLY || ONLY === 'glaze') await skinCheck('glaze', {
    canvas: [226, 238, 240], canvasName: '#e2eef0', serif: 'LXGW WenKai',
    toolbar: (v) => { const p = parts(v); return !!p && p.r === 255 && p.g === 255 && p.b === 255 && p.a > 0.5 && p.a < 0.9 },
    container: (v) => lum(v) > 200, containerName: '冰白纸分组', mini: [251, 254, 254],
    drawer: (v) => near(v, [251, 254, 254], 3) && parts(v).a > 0.8, drawerName: '冰白玻璃',
    input: [255, 255, 255], popover: [248, 252, 252], popoverName: '冰白',
    popoverText: [35, 71, 82], search: [248, 252, 252]
  })
  if (!ONLY || ONLY === 'original') await controlCheck('original', { label: '原版', canvas: [240, 243, 233] })
  if (!ONLY || ONLY === 'crimson') await controlCheck('crimson', { label: '赤月戏', canvas: [233, 223, 197] })
} catch (e) {
  failures.push(e.message)
  console.error('FAIL ' + e.message)
}

const report = {
  date: new Date().toISOString().slice(0, 10),
  page: PAGE,
  checks: checks.length,
  passed: checks.filter((x) => x.ok).length,
  failed: checks.filter((x) => !x.ok).length,
  errors: pageErrors,
  results: checks
}
await writeFile(JSON_OUT, JSON.stringify(report, null, 2) + '\n')
console.log(`\n${report.passed}/${report.checks} checks passed; errors: ${pageErrors.length}`)
if (failures.length) {
  console.error('Failures:\n' + failures.map((x) => ' - ' + x).join('\n'))
  process.exit(1)
}
