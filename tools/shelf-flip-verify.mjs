/* 书架翻动验收（v1.1.0）：中央书翻动 —— 点两侧书 / 点列表书 / 方向键，
 * 加上「丝滑」的硬证据（页内 16ms 采样过渡中的位移与明暗）、reduced motion 静态降级与改造前的回归项。
 *
 * 运行前提：
 *   1) npm run dev（vite 5173）
 *   2) 隔离实例（绝不触碰用户自己的 profile；脚本会自检 profile 名）：
 *      .\node_modules\electron\dist\electron.exe . --dev --profile=gravity-skin-verify \
 *        --remote-debugging-port=9223 --disable-renderer-backgrounding --disable-backgrounding-occluded-windows
 * 用法：node tools/shelf-flip-verify.mjs     截图：tools/_shot-shelf-flip-*.png
 *
 * 环境说明（实测）：
 *  - CDP 真实鼠标点击在本实例可用（isTrusted=true）；窗口隐藏时 Chromium 会丢弃按压类输入
 *    （dlpop-verify 已记录），此时退回合成 click 并注明——被测对象是组件监听器与状态机本身。
 *  - 中途采样必须在页面内用 setInterval 做：逐帧值经过 CDP 往返会被拉平成端点值，
 *    会把「有过渡」误判成「瞬移」。窗口隐藏时过渡被冻结，该组检查降级为 SKIP 计数。
 *  - 位移读数取自计算样式的矩阵（matrix/matrix3d 的第 5 / 第 13 位），比 bbox 稳：
 *    bbox 会被倾斜角撑大，不能用来判断缩放。
 *  - 不截「过渡中途」的图：Page.captureScreenshot 自身有约 300ms 延迟，截出来通常已经落位。
 *    中途观感以页内采样曲线为准（失败时会打印 tx 序列），截图只留静止/落位/抽书/降级四态。
 * 种子统一走 tools/verify-seeds.mjs 注册表（与开发调试版书架同源），不内联建书。
 */
import { writeFile } from 'node:fs/promises'
import { connect } from './_cdp-lib.mjs'
import { buildSeedExpr } from './verify-seeds.mjs'

const c = await connect('http://127.0.0.1:5173', '9223')
const results = []
let skipped = 0
const check = (name, ok, detail = '') => {
  results.push(ok)
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : '  —— ' + String(detail).slice(0, 500)))
}
const skip = (name, reason) => { skipped++; console.log('SKIP ' + name + '  —— ' + reason) }
const evaluate = async (code) => {
  const r = await c.evalx(code)
  if (r?.PAGE_ERR) throw new Error(r.PAGE_ERR)
  return r
}
const wait = async (code, timeout = 15000) => {
  const until = Date.now() + timeout
  while (Date.now() < until) {
    if (await evaluate(code)) return true
    await c.sleep(80)
  }
  return false
}
const shot = async (name) => {
  try {
    await evaluate('document.fonts.ready.then(() => true)')
    await c.send('Page.bringToFront')
    const frame = await Promise.race([c.send('Page.captureScreenshot', { format: 'png' }), new Promise((_, reject) => setTimeout(() => reject(new Error('截图超时')), 10000))])
    await writeFile(new URL(`./_shot-shelf-flip-${name}.png`, import.meta.url), Buffer.from(frame.data, 'base64'))
  } catch (error) {
    skip('截图 ' + name, error.message)
  }
}

/* ---------- 输入 ---------- */
const clickAt = async (x, y) => {
  const at = { x: Math.round(x), y: Math.round(y) }
  await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...at })
  await c.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...at, button: 'left', clickCount: 1 })
  await c.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...at, button: 'left', clickCount: 1 })
}
const key = async (name, code, vk) => {
  await c.send('Input.dispatchKeyEvent', { type: 'keyDown', key: name, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk })
  await c.send('Input.dispatchKeyEvent', { type: 'keyUp', key: name, code, windowsVirtualKeyCode: vk })
}
let syntheticOnly = false
const heading = () => evaluate('document.querySelector(".gravity-feature-copy h2").textContent.trim()')
const boxOf = (selector) => evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } })()`)
/* 窗口被遮挡/最小化时：过渡被冻结、按压类输入被丢弃（docs/开发流程.md 5.3）。
   每个交互阶段前先抬起窗口，拿不到可见态就明确降级，不让环境伪装成功能失败。 */
const ensureVisible = async () => {
  if (!(await evaluate('document.hidden'))) return true
  await c.send('Page.bringToFront')
  await c.sleep(700)
  return !(await evaluate('document.hidden'))
}
/** 点选择器正中，直到中央书变成 expect */
const clickUntil = async (selector, expect) => {
  await ensureVisible()
  const at = await boxOf(selector)
  if (!at) return { ok: false, reason: '选择器不存在：' + selector }
  const landed = `document.querySelector('.gravity-feature-copy h2').textContent.trim() === ${JSON.stringify(expect)}`
  if (!syntheticOnly) {
    await clickAt(at.x, at.y)
    if (await wait(landed, 1500)) return { ok: true, synthetic: false }
  }
  syntheticOnly = true
  await evaluate(`(() => { document.querySelector(${JSON.stringify(selector)}).click(); return true })()`)
  return { ok: await wait(landed, 1500), synthetic: true }
}

/* ---------- 读数：位次与姿态 ---------- */
const readStage = () => evaluate(`(() => {
  const stage = document.querySelector('.gravity-orbit-stage')
  if (!stage) return null
  const sr = stage.getBoundingClientRect()
  const scaleOf = (el) => {
    const t = getComputedStyle(el).transform
    const n = t.slice(t.indexOf('(') + 1, -1).split(',').map(Number)
    return n.length === 6 ? Math.hypot(n[0], n[1]) : Math.hypot(n[0], n[1], n[2])
  }
  const slots = [...document.querySelectorAll('.gravity-slot')].map((slot) => {
    const book = slot.querySelector('.gravity-book')
    const pose = slot.querySelector('.gravity-pose')
    const r = book.getBoundingClientRect()
    return {
      pose: ([...slot.classList].find((x) => x.startsWith('gravity-slot--')) || '').replace('gravity-slot--', ''),
      title: (slot.querySelector('.gravity-cover-title')?.textContent || '').trim(),
      main: !!slot.querySelector('.gravity-main-book'),
      inert: slot.hasAttribute('inert'),
      hasMenu: !!slot.querySelector('.gravity-book-menu'),
      opacity: Number(getComputedStyle(pose).opacity),
      scale: Number(scaleOf(pose).toFixed(3)),
      pose3d: getComputedStyle(pose).transform.startsWith('matrix3d'),
      slotTransition: getComputedStyle(slot).transitionProperty + '|' + getComputedStyle(slot).transitionDuration,
      cx: Math.round(r.left + r.width / 2), w: Math.round(r.width)
    }
  })
  return {
    stageCx: Math.round(sr.left + sr.width / 2),
    heading: (document.querySelector('.gravity-feature-copy h2')?.textContent || '').trim(),
    library: [...document.querySelectorAll('.gravity-library-item')].map((i) => (i.querySelector('.gravity-library-copy strong')?.textContent || '').trim()),
    slots
  }
})()`)
const pose = (stage, name) => stage?.slots.find((s) => s.pose === name)

try {
  await wait('!!window.__ns && !!document.querySelector(".app-root")')
  const loc = await evaluate('window.native.getDataLocation()')
  check('只跑在隔离验收 profile 上', String(loc.defaultDir).endsWith('小说工坊-gravity-skin-verify'), `当前 profile：${loc.defaultDir}`)
  const originalPrefs = await evaluate('(async()=>{const rows=await __ns.db.appconfig.toArray();return rows.filter(r=>["skin","theme"].includes(r.key))})()')

  /* 种子：按已知顺序重置四本既有验证书 → 最近更新的前四本可预期
     （最后种下的排在书架首位，于是 works[0..3] = 画布验证书A / 关系图 / 批注 / 双链） */
  for (const title of ['双链验证书', '批注验证书', '关系图验证书', '画布验证书A']) {
    const r = await evaluate(buildSeedExpr(title, { reset: true }))
    if (!r?.ok) throw new Error('种子失败：' + title + ' ' + JSON.stringify(r?.err || r))
    await c.sleep(1100)
  }
  await evaluate('(async()=>{const {useUiStore}=await import("/src/stores/ui.js");const {useShelfStore}=await import("/src/stores/shelf.js");window.__flipCheck={ui:useUiStore(),shelf:useShelfStore(),work:window.__ns.getWork()};await __flipCheck.ui.setSkin("gravity");await __flipCheck.shelf.refresh();return true})()')
  if (!(await wait('!!document.querySelector(".gravity-shelf")'))) throw new Error('引力书舱未渲染')
  /* 动画要在可预测的介质里测：显式关掉 reduced motion，别受宿主系统设置影响 */
  await c.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] })
  await c.sleep(1400)
  await ensureVisible()

  const works = await evaluate('__flipCheck.shelf.works.map(w => w.title)')

  /* ── 1. 基线：静止外观与改造前一致 ─────────────────────────────── */
  let stage = await readStage()
  const center0 = pose(stage, 'center')
  const left0 = pose(stage, 'left')
  const right0 = pose(stage, 'right')
  const hit = await evaluate(`(() => { const b = document.querySelector('.gravity-slot--left .gravity-book-open'); if (!b) return 'no-left-book'; const r = b.getBoundingClientRect(); const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); if (b === el || b.contains(el)) return 'book'; return el ? 'OTHER:' + el.tagName + '.' + (typeof el.className === 'string' ? el.className : '(svg)') : 'NULL(视口外)' })()`)
  check('中央书唯一且带 .gravity-main-book', !!center0?.main && stage.slots.filter((s) => s.main).length === 1, JSON.stringify(stage.slots.map((s) => s.pose + '/' + s.main)))
  check('中央书即最近更新那本', center0?.title === works[0], `${center0?.title} vs ${works[0]}`)
  check('左侧书在中央左、右侧书在中央右', !!left0 && !!right0 && left0.cx < stage.stageCx - 100 && right0.cx > stage.stageCx + 100, JSON.stringify({ stageCx: stage.stageCx, left: left0?.cx, right: right0?.cx }))
  check('两侧书按比例缩小（矩阵尺度 ≈ 0.68）', Math.abs(left0.scale - 0.68) < 0.02 && Math.abs(right0.scale - 0.68) < 0.02 && Math.abs(center0.scale - 1) < 0.02, JSON.stringify({ center: center0.scale, left: left0.scale, right: right0.scale }))
  check('两侧书仍在透视里（rotateY 不是平面压扁）', left0.pose3d && right0.pose3d && center0.pose3d, JSON.stringify(stage.slots.map((s) => s.pose + ':' + s.pose3d)))
  check('两侧书可见但没有中央亮（0.3 < opacity < 0.45）', left0.opacity > 0.3 && left0.opacity < 0.45, String(left0.opacity))
  check('两侧书真的可点（命中测试落在书上，没被满尺寸 slot 挡住）', hit === 'book', hit)
  check('只有中央那本有 ⋯ 菜单', center0.hasMenu === true && left0.hasMenu === false && right0.hasMenu === false, JSON.stringify(stage.slots.map((s) => s.pose + '/' + s.hasMenu)))
  const outer0 = stage.slots.filter((s) => s.pose.startsWith('outer-'))
  check('缓冲位 inert 且不可见（不进 Tab、不接指针）', outer0.length > 0 && outer0.every((s) => s.inert && s.opacity === 0), JSON.stringify(outer0.map((s) => s.pose + '/' + s.inert + '/' + s.opacity)))
  check('姿态过渡已接线（transform / 520ms）', /transform/.test(center0.slotTransition) && /0\.52s/.test(center0.slotTransition), center0.slotTransition)
  console.log(`      静止位次：中央《${center0.title}》· 左《${left0.title}》· 右《${right0.title}》`)
  await shot('idle')

  /* ── 2. 方案1「翻转亮相」：点左侧书 → 转到中央，原中央书退到对面书位 ── */
  const clickLeft = await clickUntil('.gravity-slot--left .gravity-book-open', left0.title)
  check('点左侧书把它翻到中央', clickLeft.ok, clickLeft.reason || (clickLeft.synthetic ? '真实鼠标未生效，已退回合成 click' : ''))
  await c.sleep(800)
  stage = await readStage()
  const center1 = pose(stage, 'center')
  check('中央换成被点的那本，且它带着 .gravity-main-book', center1?.title === left0.title && center1.main, `${center1?.title} vs ${left0.title}`)
  check('左侧文案随之更新', stage.heading === left0.title, `${stage.heading} vs ${left0.title}`)
  check('原中央书退到侧位仍可见（缩小变暗，不是消失）', stage.slots.some((s) => s.title === center0.title && ['left', 'right'].includes(s.pose) && s.opacity > 0.3 && s.scale < 0.7), JSON.stringify(stage.slots.map((s) => s.pose + ':' + s.title + ':' + s.opacity)))
  check('落位与中央基准一致（真的走到了中央）', Math.abs(center1.cx - center0.cx) <= 4 && Math.abs(center1.w - center0.w) <= 4, JSON.stringify({ before: center0.cx + '/' + center0.w, after: center1.cx + '/' + center1.w }))
  check('列表仍为 N−1 且不含中央那本', stage.library.length === works.length - 1 && !stage.library.includes(left0.title), `${stage.library.length} vs ${works.length - 1}`)
  await shot('after-flip')

  /* ── 3. 丝滑的硬证据：页内 16ms 采样（CDP 往返会把曲线拉平） ── */
  const timingVisible = await ensureVisible()
  if (!timingVisible) {
    skip('过渡中途采样（丝滑证据）', '窗口不可见时 CSS 过渡被冻结，无法采样')
  } else {
    const target = await evaluate(`(() => {
      window.__flip = [...document.querySelectorAll('.gravity-slot')].find((s) => s.classList.contains('gravity-slot--right'))
      const r = window.__flip.querySelector('.gravity-book-open').getBoundingClientRect()
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, title: window.__flip.querySelector('.gravity-cover-title').textContent.trim() }
    })()`)
    await evaluate(`(() => {
      window.__series = []
      window.__perf = { frames: [], long: [] }
      const el = window.__flip, pose = el.querySelector('.gravity-pose')
      const t0 = performance.now()
      const id = setInterval(() => {
        const m = getComputedStyle(el).transform.match(/matrix3?d?\\(([^)]+)\\)/)
        const n = m ? m[1].split(',').map(Number) : null
        window.__series.push({
          t: Math.round(performance.now() - t0),
          tx: n ? (n.length === 16 ? n[12] : n[4]) : null,
          op: Number(getComputedStyle(pose).opacity),
          hidden: document.hidden
        })
        if (window.__series.length > 55) clearInterval(id)
      }, 16)
      /* 帧间隔与长任务：docs 要求看真实帧时间，不能以「只动 transform/opacity」代替实测 */
      try {
        new PerformanceObserver((list) => { for (const e of list.getEntries()) window.__perf.long.push(Math.round(e.duration)) }).observe({ entryTypes: ['longtask'] })
      } catch (e) { /* 不支持 longtask 就不测这项 */ }
      let last = performance.now()
      const tick = (t) => { window.__perf.frames.push(t - last); last = t; if (window.__perf.frames.length < 90) requestAnimationFrame(tick) }
      requestAnimationFrame(tick)
      return true
    })()`)
    await clickAt(target.x, target.y)
    await c.sleep(1000)
    const perf = await evaluate('({ frames: window.__perf.frames.map((f) => Math.round(f)), long: window.__perf.long })')
    const series = (await evaluate('window.__series')).filter((s) => s.tx !== null)
    const first = series[0]
    const last = series[series.length - 1]
    const lo = Math.min(first.tx, last.tx) + 2
    const hi = Math.max(first.tx, last.tx) - 2
    const midTx = series.filter((s) => s.tx > lo && s.tx < hi).length
    const midOp = series.filter((s) => s.op > 0.42 && s.op < 0.96).length
    const dir = Math.sign(last.tx - first.tx) || 1
    const monotonic = series.every((s, i) => i === 0 || (s.tx - series[i - 1].tx) * dir >= -0.6)
    const settleAt = (series.find((s) => Math.abs(s.tx - last.tx) < 1) || {}).t
    /* 窗口在采样途中被遮挡时 Chromium 会冻结过渡：这是环境问题，不是功能问题 */
    const frozen = series.some((s) => s.hidden) && midTx < 4
    const flipped = (await heading()) === target.title
    if (frozen) {
      skip('过渡中途采样（丝滑证据）', '采样期间窗口变为隐藏，过渡被冻结（请让验收实例保持可见）')
      check('（隐藏窗口下仍确认）点到位的书进入中央', flipped, `${await heading()} vs ${target.title}`)
    } else {
      check('过渡里真的在插值（不是瞬移）', midTx >= 4, `中途位移样本 ${midTx}/${series.length}；tx ${first.tx.toFixed(1)} → ${last.tx.toFixed(1)}`)
      check('位移沿一个方向推进（无回跳）', monotonic, series.map((s) => s.tx.toFixed(0)).join(' '))
      check('明暗与位移同步渐变', midOp >= 3, `中途明暗样本 ${midOp}；opacity ${first.op.toFixed(2)} → ${last.op.toFixed(2)}`)
      check('位移约 520ms 走完（既不瞬移也不拖沓）', settleAt >= 400 && settleAt <= 780, `到位于 ${settleAt}ms`)
      check('翻到中央的正是被点的那本', flipped, `${await heading()} vs ${target.title}`)
      const frames = perf.frames.filter((f, i) => i > 1 && i < perf.frames.length - 8)
      const sorted = [...frames].sort((a, b) => a - b)
      const median = sorted[Math.floor(sorted.length / 2)]
      const p95 = sorted[Math.floor(sorted.length * 0.95)]
      const maxGap = sorted[sorted.length - 1]
      check('过渡期间不丢帧（最大帧间隔 ≤ 60ms）', frames.length >= 20 && maxGap <= 60, `帧样本 ${frames.length}，中位 ${median}ms，p95 ${p95}ms，最大 ${maxGap}ms`)
      check('过渡期间没有卡顿长任务（无 ≥100ms）', perf.long.every((d) => d < 100), `longtask: ${JSON.stringify(perf.long.slice(0, 6))}`)
      console.log(`      帧时间：中位 ${median}ms / p95 ${p95}ms / 最大 ${maxGap}ms；longtask ${JSON.stringify(perf.long)}`)
    }
  }

  /* ── 4. 方案2「抽书让位」：点列表里的书 → 送到中央，且不打开作品 ── */
  stage = await readStage()
  const preCenter = stage.heading
  const fromList = stage.library[0]
  await ensureVisible()
  const at = await evaluate(`(() => { const item = [...document.querySelectorAll('.gravity-library-item')].find((i) => (i.querySelector('.gravity-library-copy strong')?.textContent || '').trim() === ${JSON.stringify(fromList)}); const el = item.querySelector('.gravity-library-open'); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } })()`)
  const landExpr = `document.querySelector('.gravity-feature-copy h2').textContent.trim() === ${JSON.stringify(fromList)}`
  const synthList = async () => {
    await evaluate(`(() => { [...document.querySelectorAll('.gravity-library-item')].find((i) => (i.querySelector('.gravity-library-copy strong')?.textContent || '').trim() === ${JSON.stringify(fromList)}).querySelector('.gravity-library-open').click(); return true })()`)
    return wait(landExpr, 1500)
  }
  if (syntheticOnly) { await synthList() } else {
    await clickAt(at.x, at.y)
    if (!(await wait(landExpr, 1400))) { syntheticOnly = true; await synthList() }
  }
  const viewAfterList = await evaluate('__flipCheck.ui.view')
  const rising = await evaluate(`!!document.querySelector('.gravity-slot--center .gravity-lift.is-rising')`)
  await c.sleep(800)
  stage = await readStage()
  check('点列表书把它送到中央', stage.heading === fromList, `${stage.heading} vs ${fromList}`)
  check('抽书手势在入场书上播过（is-rising）', rising, '未捕捉到 is-rising')
  check('列表点击不打开作品（仍停在书架）', viewAfterList === 'shelf', String(viewAfterList))
  check('让出中央的那本落回列表并淡入', stage.library.includes(preCenter) && (await evaluate(`!!document.querySelector('.gravity-library-item.is-landing')`)), `${preCenter} ∈ ${JSON.stringify(stage.library.slice(0, 4))}`)
  check('列表数量仍为 N−1', stage.library.length === works.length - 1, `${stage.library.length} vs ${works.length - 1}`)
  await shot('extract')

  /* ── 5. 方向键：焦点在舞台上才翻动，不抢输入框 ── */
  await ensureVisible()
  const beforeKey = await heading()
  const idx = works.indexOf(beforeKey)
  await evaluate('document.querySelector(".gravity-orbit-stage").focus()')
  await key('ArrowRight', 'ArrowRight', 39)
  await c.sleep(760)
  check('→ 翻到下一本', (await heading()) === works[idx + 1], `${await heading()} vs ${works[idx + 1]}`)
  await key('ArrowLeft', 'ArrowLeft', 37)
  await c.sleep(760)
  check('← 翻回上一本', (await heading()) === beforeKey, `${await heading()} vs ${beforeKey}`)
  await evaluate('document.querySelector(".gravity-tools input").focus()')
  await key('ArrowRight', 'ArrowRight', 39)
  await c.sleep(340)
  check('焦点在搜索框时方向键不改中央书', (await heading()) === beforeKey, `${await heading()} vs ${beforeKey}`)

  /* ── 6. 回归：中央点击仍打开作品、⋯ 菜单仍不打开 ── */
  await ensureVisible()
  const centerTitle = await heading()
  const centerId = await evaluate(`__flipCheck.shelf.works.find((w) => w.title === ${JSON.stringify(centerTitle)}).id`)
  await evaluate('document.querySelector(".gravity-main-book .gravity-book-open").click()')
  const opened = await wait('__flipCheck.ui.view === "work" && !!document.querySelector(".wb-body")')
  check('点中央书仍然打开作品，且开的是中央那本', opened && (await evaluate('__flipCheck.work.work.id')) === centerId, '')
  await evaluate('__flipCheck.work.closeWork().then(() => true)')
  await wait('!!document.querySelector(".gravity-shelf")')
  await c.sleep(500)
  await evaluate('document.querySelector(".gravity-main-book .gravity-book-menu button").click()')
  const menuOpen = await wait('!!document.querySelector(".n-dropdown-menu")')
  check('⋯ 菜单仍不触发打开', menuOpen && (await evaluate('__flipCheck.ui.view')) === 'shelf', '')
  await key('Escape', 'Escape', 27)
  await c.sleep(300)

  /* ── 7. reduced motion：静态降级，直接到位 ── */
  await c.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  await c.sleep(260)
  const rmTransition = await evaluate('getComputedStyle(document.querySelector(".gravity-slot")).transitionDuration')
  const rmFloat = await evaluate('getComputedStyle(document.querySelector(".gravity-main-book")).animationName')
  check('reduced motion 关断姿态过渡', rmTransition.split(',').every((v) => parseFloat(v) === 0), rmTransition)
  check('reduced motion 仍关掉浮动动画（旧断言未被架空）', rmFloat === 'none', rmFloat)
  stage = await readStage()
  const rmTarget = (stage.slots.find((s) => ['left', 'right'].includes(s.pose)) || {}).title
  await evaluate(`(() => { const s = [...document.querySelectorAll('.gravity-slot')].find((x) => x.classList.contains('gravity-slot--left') || x.classList.contains('gravity-slot--right')); s.querySelector('.gravity-book-open').click(); return true })()`)
  await c.sleep(160)
  check('reduced motion 下点击立即到位（没有过渡）', (await heading()) === rmTarget, `${await heading()} vs ${rmTarget}`)
  await shot('reduced-motion')

  await c.send('Emulation.setEmulatedMedia', { features: [] })
  await evaluate('(async()=>{await __ns.db.appconfig.bulkDelete(["skin","theme"]);await __ns.db.appconfig.bulkPut(' + JSON.stringify(originalPrefs) + ');await __flipCheck.ui.loadPrefs();return true})()')
} catch (error) {
  console.error(error)
  process.exitCode = 1
} finally {
  const passed = results.filter(Boolean).length
  console.log(`\n书架翻动验收：${passed}/${results.length} 通过${skipped ? `，${skipped} 项跳过` : ''}`)
  process.exit(process.exitCode || (results.length > 0 && passed === results.length ? 0 : 1))
}
