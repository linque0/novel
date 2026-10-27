/* 大纲容器拖动回归：拖动容器时，容器本体与内部迷你卡必须按同一屏幕位移实时移动。
   连接 CDP（默认 9333）到 docs/outline-calibration-validation/ 内存页，不打开用户作品。 */
import { mkdir, writeFile } from 'node:fs/promises'
import { connect } from './_cdp-lib.mjs'

const PORT = process.env.CDP_PORT || '9333'
const BASE = process.env.BASE_URL || 'http://127.0.0.1:5173'
const PAGE = `${BASE}/docs/outline-calibration-validation/?skin=gravity&t=${Date.now()}`
const OUT = new URL('../docs/outline-workbench-integration/screenshots/', import.meta.url)
const JSON_OUT = new URL('../docs/outline-workbench-integration/drag-checks.json', import.meta.url)
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

const checks = []
const failures = []
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

const stateExpr = `(() => {
  const n = [...document.querySelectorAll('.oc-node.oc-container')]
    .find(x => x.querySelector('.oc-inline-toggle')?.textContent.includes('收起'))
  const m = document.querySelector('.oc-mini-scroll .oc-mini')
  if (!n || !m) return null
  const nr = n.getBoundingClientRect()
  const mr = m.getBoundingClientRect()
  return {
    n: { l: Math.round(nr.left), t: Math.round(nr.top), w: Math.round(nr.width), h: Math.round(nr.height) },
    m: { l: Math.round(mr.left), t: Math.round(mr.top) },
    rel: { x: Math.round(mr.left - nr.left), y: Math.round(mr.top - nr.top) },
    minis: document.querySelectorAll('.oc-mini-scroll .oc-mini').length
  }
})()`

const near = (a, b, tol = 2) => Math.abs(a - b) <= tol
let pressed = false
let before = null
try {
  await c.send('Page.navigate', { url: PAGE })
  await wait(`location.search.includes('skin=gravity') && document.body.dataset.skin === 'gravity' && !!document.querySelector('.oc-node.oc-container')`, 20000)
  await c.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
  await ev(`(async () => { const { useUiStore } = await import('/src/stores/ui.js'); useUiStore().topbarAutoHide = false; return true })()`)
  await ev(`(() => { const n = document.querySelector('.oc-node.oc-container'); const b = n?.querySelector('.oc-inline-toggle'); if (b && b.textContent.includes('就地展开')) b.click(); return !!b })()`)
  await wait('!!document.querySelector(".oc-mini-scroll .oc-mini")')
  await sleep(900)

  before = await ev(stateExpr)
  check(!!before, '容器已就地展开并显示迷你卡')
  if (before) {
    check(before.minis > 0, `容器内有 ${before.minis} 张迷你卡`)

    const cx = before.n.l + 20
    const cy = before.n.t + 20
    await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: cx, y: cy, buttons: 0 })
    await c.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: cx, y: cy, button: 'left', buttons: 1, clickCount: 1 })
    pressed = true
    await sleep(100)
    for (const [dx, dy] of [[30, 20], [60, 40], [90, 60]]) {
      await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: cx + dx, y: cy + dy, button: 'left', buttons: 1 })
      await sleep(140)
    }
    await sleep(250)
    const during = await ev(stateExpr)
    check(!!during, '拖动过程中容器与迷你卡仍在 DOM 中')
    if (during) {
      const cd = { x: during.n.l - before.n.l, y: during.n.t - before.n.t }
      const md = { x: during.m.l - before.m.l, y: during.m.t - before.m.t }
      check(near(cd.x, 90) && near(cd.y, 60), `容器随鼠标实时移动（${cd.x},${cd.y}）`)
      check(near(md.x, cd.x) && near(md.y, cd.y), `迷你卡与容器同步位移（${md.x},${md.y}）`)
      check(near(during.rel.x, before.rel.x, 1) && near(during.rel.y, before.rel.y, 1), `拖动中相对位置不变（${during.rel.x},${during.rel.y}）`)
      const frame = await Promise.race([
        c.send('Page.captureScreenshot', { format: 'png' }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Screenshot timeout')), 10000))
      ])
      await writeFile(new URL('drag-container-live.png', OUT), Buffer.from(frame.data, 'base64'))
    }

    await c.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: cx + 90, y: cy + 60, button: 'left', buttons: 0, clickCount: 1 })
    pressed = false
    await sleep(400)
    const after = await ev(stateExpr)
    check(!!after, '松手后容器与迷你卡仍在 DOM 中')
    if (after) {
      check(near(after.rel.x, before.rel.x, 1) && near(after.rel.y, before.rel.y, 1), `松手后相对位置保持（${after.rel.x},${after.rel.y}）`)
      check(near(after.n.l, before.n.l + 90) && near(after.n.t, before.n.t + 60), `松手后容器停留在落点（${after.n.l},${after.n.t}）`)
    }
  }

  const errs = await ev('window.__errs || []')
  check(errs.length === 0, `拖动检查无控制台 error（${errs.length}）`)
} catch (e) {
  failures.push(e.message)
  console.error('FAIL ' + e.message)
} finally {
  if (pressed) {
    try { await c.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 0, y: 0, button: 'left', buttons: 0, clickCount: 1 }) } catch {}
  }
}

const now = new Date()
const report = {
  date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
  page: PAGE,
  checks: checks.length,
  passed: checks.filter((x) => x.ok).length,
  failed: checks.filter((x) => !x.ok).length,
  errors: failures,
  results: checks
}
await writeFile(JSON_OUT, JSON.stringify(report, null, 2) + '\n')
console.log(`\n${report.passed}/${report.checks} checks passed`)
if (failures.length) {
  console.error('Failures:\n' + failures.map((x) => ' - ' + x).join('\n'))
  process.exit(1)
}
