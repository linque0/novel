/* 四款皮肤共享应用顶栏：七项导航、选中、模块切换与窄窗布局回归。 */
import { mkdir, writeFile } from 'node:fs/promises'
import { connect } from './_cdp-lib.mjs'

const PORT = process.env.CDP_PORT || '9333'
const BASE = process.env.BASE_URL || 'http://127.0.0.1:5173'
const PAGE = `${BASE}/docs/outline-calibration-validation/`
const OUT = new URL('../docs/outline-skin-integration/screenshots/', import.meta.url)
const JSON_OUT = new URL('../docs/outline-skin-integration/topbar-nav-checks.json', import.meta.url)
await mkdir(OUT, { recursive: true })

const c = await connect('outline-calibration-validation', PORT)
await c.send('Emulation.setFocusEmulationEnabled', { enabled: true })
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

const checks = []
const failures = []
const errors = []
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
async function nav(skin) {
  const result = await c.send('Page.navigate', { url: `${PAGE}?skin=${skin}&t=${Date.now()}` })
  if (result && result.errorText) throw new Error(`navigate ${skin}: ${result.errorText}`)
  await wait(
    `location.search.includes('skin=${skin}') && document.body?.dataset.skin === '${skin}' && document.querySelector('.app-root')?.dataset.skin === '${skin}' && !!document.querySelector('.workbench-shell')`,
    20000
  )
  await c.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
  await ev(`(async () => { const { useUiStore } = await import('/src/stores/ui.js'); useUiStore().topbarAutoHide = false; return true })()`)
  await ev('document.fonts.ready.then(() => true)')
  await sleep(450)
}
async function shot(name) {
  await c.send('Page.bringToFront')
  const frame = await c.send('Page.captureScreenshot', { format: 'png' })
  await writeFile(new URL(name + '.png', OUT), Buffer.from(frame.data, 'base64'))
}
const LABELS = ['书架', '正文', '大纲', '设定', '人物', '灵感', '设置']

async function studioCase(skin, label, navClass, itemClass, brandExpected) {
  await nav(skin)
  const top = await ev(`(() => { const el = document.querySelector('.${navClass}'); const r = el?.closest('header')?.getBoundingClientRect(); return { items: [...document.querySelectorAll('.${itemClass}')].map(x => ({ text: x.textContent.trim(), active: x.classList.contains('active') })), topbar: r ? { top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height) } : null, rail: !!document.querySelector('.nav-rail'), brand: document.querySelector('.app-topbar-brand-text')?.textContent, h1: (() => { const h = document.querySelector('.oc-workspace-head h1')?.getBoundingClientRect(); return h ? Math.round(h.top) : null })() } })()`)
  check(top.items.length === 7 && LABELS.every((x, i) => top.items[i]?.text === x), `${label} 顶栏提供七项模块导航（${top.items.map(x => x.text).join('/')}）`)
  check(top.items.find(x => x.active)?.text === '大纲', `${label} 当前模块「大纲」高亮`)
  check(!top.rail, `${label} 底部胶囊导航已移除`)
  check(String(top.brand).includes(brandExpected), `${label} 品牌显示皮肤副标（${top.brand}）`)
  check(top.topbar && top.topbar.height >= 60 && top.topbar.height <= 80, `${label} 顶栏高度 ${top.topbar?.height}px`)
  check(top.h1 != null && top.h1 >= top.topbar.bottom - 1, `${label} 顶栏不覆盖大纲标题（${top.h1}≥${top.topbar.bottom}）`)
  await shot(`topbar-${skin}-nav`)

  await ev(`(() => { const b = [...document.querySelectorAll('.${itemClass}')].find(x => x.textContent.trim() === '人物'); b?.click(); return !!b })()`)
  await wait(`(async () => { const { useWorkStore } = await import('/src/stores/work.js'); return useWorkStore().tab === 'characters' })()`)
  const active = await ev(`document.querySelector('.${itemClass}.active')?.textContent.trim()`)
  check(active === '人物', `${label} 顶栏「人物」可切换模块`)
  await ev(`(() => { const b = [...document.querySelectorAll('.${itemClass}')].find(x => x.textContent.trim() === '大纲'); b?.click(); return !!b })()`)
  await wait(`(async () => { const { useWorkStore } = await import('/src/stores/work.js'); return useWorkStore().tab === 'outline' })()`)
  check(true, `${label} 可切回「大纲」`)

  await c.send('Emulation.setDeviceMetricsOverride', { width: 780, height: 900, deviceScaleFactor: 1, mobile: false })
  await sleep(350)
  const narrow = await ev(`(() => { const t = document.querySelector('.app-topbar'); const n = t?.querySelector('nav'); return { doc: document.documentElement.scrollWidth, win: innerWidth, items: document.querySelectorAll('.${itemClass}').length, navScroll: n?.scrollWidth || 0, navClient: n?.clientWidth || 0 } })()`)
  check(narrow.doc <= narrow.win + 1, `${label} 780px 顶栏无横向溢出`)
  check(narrow.items === 7, `${label} 780px 仍保留七项导航`)
  await shot(`topbar-${skin}-narrow`)
  await c.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
  await sleep(250)

  const errs = await ev('window.__errs || []')
  if (errs.length) errors.push({ skin, errors: errs })
  check(errs.length === 0, `${label} 顶栏检查无控制台 error（${errs.length}）`)
}

try {
  for (const [skin, label] of [['original', '原版工坊'], ['gravity', '引力书舱'], ['glaze', '琉光画境'], ['crimson', '赤月戏']]) {
    await studioCase(skin, label, 'app-topnav', 'app-topnav-item', label)
  }

} catch (e) {
  failures.push(e.message)
  console.error('FAIL ' + e.message)
}

const now = new Date()
const report = {
  date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
  page: PAGE,
  checks: checks.length,
  passed: checks.filter((x) => x.ok).length,
  failed: checks.filter((x) => !x.ok).length,
  errors,
  results: checks
}
await writeFile(JSON_OUT, JSON.stringify(report, null, 2) + '\n')
console.log(`\n${report.passed}/${report.checks} checks passed; errors: ${errors.length}`)
if (failures.length) {
  console.error('Failures:\n' + failures.map((x) => ' - ' + x).join('\n'))
  process.exit(1)
}

process.exit(0)
