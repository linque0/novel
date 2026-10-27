/* 自动隐藏顶栏回归：展开时必须占位下推工作区，不能覆盖大纲标题/工具条；
   收起时只保留 8px 感应条。覆盖四套皮肤，截图与结果写入 docs/outline-skin-integration/。 */
import { mkdir, writeFile } from 'node:fs/promises'
import { connect } from './_cdp-lib.mjs'

const PORT = process.env.CDP_PORT || '9333'
const BASE = process.env.BASE_URL || 'http://127.0.0.1:5173'
const PAGE = `${BASE}/docs/outline-calibration-validation/`
const OUT = new URL('../docs/outline-skin-integration/screenshots/', import.meta.url)
const JSON_OUT = new URL('../docs/outline-skin-integration/topbar-checks.json', import.meta.url)
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
    `location.search.includes('skin=${skin}') && document.body?.dataset.skin === '${skin}' && document.querySelector('.app-root')?.dataset.skin === '${skin}' && !!document.querySelector('.oc-workspace-head h1')`,
    20000
  )
  await c.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
  await ev('document.fonts.ready.then(() => true)')
  await sleep(400)
}
async function shot(name) {
  await c.send('Page.bringToFront')
  const frame = await c.send('Page.captureScreenshot', { format: 'png' })
  await writeFile(new URL(name + '.png', OUT), Buffer.from(frame.data, 'base64'))
}
const measure = () => ev(`(() => {
  const host = document.querySelector('.wb-topbar-host')
  const content = document.querySelector('.wb-topbar-content')
  const h1 = document.querySelector('.oc-workspace-head h1')
  const body = document.querySelector('.wb-body')
  const r = el => { const b = el?.getBoundingClientRect(); return b ? { x: b.x, y: b.y, width: b.width, height: b.height, top: b.top, right: b.right, bottom: b.bottom, left: b.left } : null }
  return {
    host: r(host), content: r(content), h1: r(h1), body: r(body),
    cls: host?.className,
    visible: content ? getComputedStyle(content).visibility : null,
    position: content ? getComputedStyle(content).position : null
  }
})()`)

const SKINS = [
  ['original', '原版'],
  ['gravity', '引力书舱'],
  ['glaze', '琉光画境'],
  ['crimson', '赤月戏']
]
for (const [skin, label] of SKINS) {
  await nav(skin)
  await ev(`(async () => { const { useUiStore } = await import('/src/stores/ui.js'); useUiStore().topbarAutoHide = true; return true })()`)
  await sleep(250)

  const collapsed = await measure()
  check(Math.round(collapsed.host.height) === 8, `${label} 收起时只保留 8px 感应条`)
  check(collapsed.visible === 'hidden', `${label} 收起时顶栏内容隐藏`)

  await ev(`(() => { document.querySelector('.wb-topbar-host').dispatchEvent(new MouseEvent('mouseenter')); return true })()`)
  await wait(`document.querySelector('.wb-topbar-host').classList.contains('is-expanded')`)
  await sleep(350)
  const expanded = await measure()
  check(expanded.position === 'relative', `${label} 展开时顶栏回到文档流（position:relative）`)
  check(
    Math.abs(expanded.host.height - expanded.content.height) <= 1,
    `${label} 展开时顶栏占位高度与内容一致（${Math.round(expanded.host.height)}/${Math.round(expanded.content.height)}）`
  )
  check(
    expanded.h1.top >= expanded.content.bottom - 1,
    `${label} 展开时大纲标题位于顶栏下方（${Math.round(expanded.h1.top)}≥${Math.round(expanded.content.bottom)}）`
  )
  check(
    expanded.body.top >= expanded.content.bottom - 1,
    `${label} 展开时工作区未被顶栏覆盖（${Math.round(expanded.body.top)}≥${Math.round(expanded.content.bottom)}）`
  )
  await shot(`topbar-${skin}-expanded`)

  await ev(`(() => { document.querySelector('.wb-topbar-host').dispatchEvent(new MouseEvent('mouseleave')); return true })()`)
  await sleep(650)
  const hidden = await measure()
  check(Math.round(hidden.host.height) === 8 && hidden.visible === 'hidden', `${label} 移出后自动收起`)

  await ev(`document.querySelector('.wb-topbar-pin')?.click()`)
  await sleep(350)
  const pinned = await measure()
  check((await ev(`(async () => { const { useUiStore } = await import('/src/stores/ui.js'); return useUiStore().topbarAutoHide })()`)) === false, `${label} 「固定顶栏」可关闭自动隐藏`)
  check(
    Math.abs(pinned.host.height - pinned.content.height) <= 1 && pinned.h1.top >= pinned.content.bottom - 1,
    `${label} 固定后顶栏仍不会覆盖标题`
  )

  const errs = await ev('window.__errs || []')
  if (errs.length) errors.push({ skin, errors: errs })
  check(errs.length === 0, `${label} 顶栏检查无控制台 error（${errs.length}）`)
}

const report = {
  date: new Date().toISOString().slice(0, 10),
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
