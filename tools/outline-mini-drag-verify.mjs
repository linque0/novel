/* 大纲画布修复验收：容器内拖动、连线换色、容器不透明、容器摘要 */
import { connect } from './_cdp-lib.mjs'

const PORT = process.env.CDP_PORT || '9333'
const BASE = process.env.BASE_URL || 'http://127.0.0.1:5173'
const c = await connect('outline-calibration-validation', PORT)
await c.send('Page.enable')
await c.send('Runtime.enable')
await c.send('Page.addScriptToEvaluateOnNewDocument', {
  source: `(() => {
    if (window.__errsInstalled) return;
    window.__errsInstalled = true;
    window.__errs = [];
    addEventListener('error', (e) => window.__errs.push('error: ' + (e.message || e.error)));
    addEventListener('unhandledrejection', (e) => window.__errs.push('rejection: ' + (e.reason && e.reason.message ? e.reason.message : e.reason)));
    const ce = console.error;
    console.error = (...a) => { window.__errs.push('console: ' + a.map((x) => { try { return typeof x === 'string' ? x : JSON.stringify(x) } catch { return String(x) } }).join(' ')); ce.apply(console, a) };
  })();`
})
const sleep = c.sleep
const checks = []
const fails = []
const check = (ok, msg) => {
  checks.push({ ok: !!ok, msg })
  if (!ok) fails.push(msg)
  console.log((ok ? 'PASS ' : 'FAIL ') + msg)
}
async function ev(expr) {
  const r = await c.evalx(expr)
  if (r && r.PAGE_ERR) throw new Error(r.PAGE_ERR)
  return r
}
async function wait(expr, timeout = 20000) {
  const end = Date.now() + timeout
  while (Date.now() < end) {
    if (await ev(expr)) return true
    await sleep(100)
  }
  throw new Error('Timed out: ' + expr)
}
const store = `document.querySelector('#app').__vue_app__.config.globalProperties.$pinia.state.value.work`
async function mouse(type, x, y, extra = {}) {
  await c.send('Input.dispatchMouseEvent', { type, x, y, ...extra })
}
async function drag(x0, y0, x1, y1, steps = 6) {
  await mouse('mouseMoved', x0, y0, { buttons: 0 })
  await mouse('mousePressed', x0, y0, { button: 'left', buttons: 1, clickCount: 1 })
  await sleep(90)
  for (let i = 1; i <= steps; i++) {
    await mouse('mouseMoved', x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps, { button: 'left', buttons: 1 })
    await sleep(90)
  }
  await sleep(160)
  await mouse('mouseReleased', x1, y1, { button: 'left', buttons: 0, clickCount: 1 })
  await sleep(450)
}
const rectExpr = (sel) => `(() => { const el=document.querySelector(${JSON.stringify(sel)}); if(!el) return null; const r=el.getBoundingClientRect(); return {x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height),cx:Math.round(r.x+r.width/2),cy:Math.round(r.y+r.height/2)} })()`
const nodeInfo = (id) => `(() => { const n=${store}.olnodes.find(x=>x.id===${JSON.stringify(id)}); return n?{parentId:n.parentId||null,x:n.canvasX,y:n.canvasY,sortOrder:n.sortOrder,title:n.title}:null })()`

await c.send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false })
await c.send('Page.navigate', { url: `${BASE}/docs/outline-calibration-validation/?skin=crimson&r=${Date.now()}` })
await wait(`!!document.querySelector('.oc-node')`)
await sleep(2200)

/* 展开 act1 */
const toggled = await ev(`(() => { const n=document.querySelector('.oc-node[data-node-id="act1"]'); const b=n?.querySelector('.oc-inline-toggle'); if(!b) return false; if(!b.textContent.includes('收起')) b.click(); return true })()`)
check(toggled, '展开容器 act1')
await wait(`document.querySelectorAll('.oc-mini').length >= 4`)
await sleep(500)
const miniCount = await ev(`document.querySelectorAll('.oc-mini').length`)
check(miniCount === 4, `act1 展开后显示 4 张迷你卡（${miniCount}）`)

/* 1a) 迷你卡原有交互不回归：双击行内编辑 +「编辑」按钮打开设置抽屉 */
{
  const p = await ev(`(() => { const m=document.querySelector('.oc-mini[data-mini-id="m-keeper"]'); const r=m.getBoundingClientRect(); return {x:Math.round(r.x+40), y:Math.round(r.y+30)} })()`)
  await mouse('mouseMoved', p.x, p.y, { buttons: 0 })
  await mouse('mousePressed', p.x, p.y, { button: 'left', buttons: 1, clickCount: 1 })
  await mouse('mouseReleased', p.x, p.y, { button: 'left', buttons: 0, clickCount: 1 })
  await mouse('mousePressed', p.x, p.y, { button: 'left', buttons: 1, clickCount: 2 })
  await mouse('mouseReleased', p.x, p.y, { button: 'left', buttons: 0, clickCount: 2 })
  await sleep(450)
  const inline = await ev(`!!document.querySelector('.oc-mini[data-mini-id="m-keeper"] textarea.oc-mini-inline')`)
  check(inline, '双击迷你卡进入行内编辑')
  await c.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
  await c.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
  await sleep(250)
  const clicked = await ev(`(() => { const b=document.querySelector('.oc-mini[data-mini-id="m-keeper"] .oc-mini-actions button'); if(!b) return false; b.click(); return true })()`)
  await sleep(450)
  const drawer = await ev(`!!document.querySelector('.oc-drawer')`)
  check(clicked && drawer, '迷你卡「编辑」按钮打开设置抽屉')
  await ev(`document.querySelector('.oc-drawer-x')?.click()`)
  await sleep(300)
}

/* 1) 拖出容器 → 回到当前层，落点附近生成顶层模块 */
{
  const before = await ev(rectExpr('.oc-mini[data-mini-id="m-ticket"]'))
  const card = await ev(rectExpr('.oc-node[data-node-id="act1"]'))
  const dropX = Math.round(card.x + 40)
  const dropY = Math.round(card.y + card.h + 90)
  await drag(before.cx, before.cy, dropX, dropY)
  const info = await ev(nodeInfo('m-ticket'))
  check(info && info.parentId === null, `迷你卡拖出后父级为根（parentId=${info?.parentId}）`)
  const top = await ev(rectExpr('.oc-node[data-node-id="m-ticket"]'))
  check(!!top, '拖出后以顶层模块渲染')
  if (top) {
    const near = Math.abs(top.cx - dropX) <= 90 && Math.abs(top.cy - dropY) <= 90
    check(near, `落点与鼠标位置接近（${top.cx},${top.cy} vs ${dropX},${dropY}）`)
  }
}

/* 2) 拖到另一个容器卡片 → 归入该容器 */
{
  const before = await ev(rectExpr('.oc-mini[data-mini-id="m-return"]'))
  const target = await ev(rectExpr('.oc-node[data-node-id="act3"]'))
  await drag(before.cx, before.cy, target.cx, target.y + 30)
  const info = await ev(nodeInfo('m-return'))
  check(info && info.parentId === 'act3', `拖到 act3 容器后归入（parentId=${info?.parentId}）`)
}

/* 3) 容器内拖动排序：把 m-seal 拖到第一张卡之前 */
{
  const seal = await ev(rectExpr('.oc-mini[data-mini-id="m-seal"]'))
  const keeper = await ev(rectExpr('.oc-mini[data-mini-id="m-keeper"]'))
  await drag(seal.cx, seal.cy, keeper.cx, keeper.y - 6)
  const order = await ev(`JSON.stringify([...document.querySelectorAll('.oc-mini')].map(m=>m.dataset.miniId))`)
  const parsed = JSON.parse(order)
  check(parsed.indexOf('m-seal') === 0, `容器内拖动后 m-seal 排到首位（${parsed.join(',')}）`)
}

/* 3b) 嵌套迷你容器：展开 act2 → ter，把内层卡拖到 act2 卡面 → 归入 act2；
 *     再拖到画布空白 → 回到当前层根。 */
{
  await ev(`(() => { const n=document.querySelector('.oc-node[data-node-id="act2"]'); const b=n?.querySelector('.oc-inline-toggle'); if(b&&!b.textContent.includes('收起')) b.click(); return true })()`)
  await wait(`!!document.querySelector('.oc-mini[data-mini-id="ter"]')`)
  await sleep(400)
  const openTer = await ev(`(() => { const m=document.querySelector('.oc-mini[data-mini-id="ter"]'); const b=[...m.querySelectorAll('button')].find(x=>x.textContent.trim()==='展开'); if(!b) return false; b.click(); return true })()`)
  check(openTer, '展开嵌套迷你容器 ter')
  await wait(`!!document.querySelector('.oc-mini[data-mini-id="t-interview"]')`)
  await sleep(400)
  {
    const kid = await ev(rectExpr('.oc-mini[data-mini-id="t-interview"]'))
    const act2 = await ev(rectExpr('.oc-node[data-node-id="act2"]'))
    await drag(kid.cx, kid.cy, act2.cx, act2.y + 20)
    const info = await ev(nodeInfo('t-interview'))
    check(info && info.parentId === 'act2', `嵌套卡拖到外层容器卡面后归入 act2（parentId=${info?.parentId}）`)
  }
  {
    const kid = await ev(rectExpr('.oc-mini[data-mini-id="t-interview"]'))
    const card = await ev(rectExpr('.oc-node[data-node-id="act2"]'))
    await drag(kid.cx, kid.cy, card.x + card.w + 50, card.y + 60)
    const info = await ev(nodeInfo('t-interview'))
    check(info && info.parentId === null, `嵌套卡拖出整块容器后回到当前层（parentId=${info?.parentId}）`)
  }
}

/* 4) 连线换色：选中 → 编辑 → 点色板 → 计算色生效 */
{
  const edge = await ev(`(() => { const g=[...document.querySelectorAll('.oc-edge')].find(e=>e.querySelector('.oc-edge-hit')?.dataset.owner); if(!g) return null; const hit=g.querySelector('.oc-edge-hit'); const r=hit.getBoundingClientRect(); return {key:g.dataset.edgeKey, x:Math.round(r.x+r.width/2), y:Math.round(r.y+r.height/2)} })()`)
  check(!!edge, '找到可编辑的独立连线')
  if (edge) {
    await mouse('mouseMoved', edge.x, edge.y, { buttons: 0 })
    await mouse('mousePressed', edge.x, edge.y, { button: 'left', buttons: 1, clickCount: 1 })
    await mouse('mouseReleased', edge.x, edge.y, { button: 'left', buttons: 0, clickCount: 1 })
    await sleep(300)
    const editBtn = await ev(`(() => { const b=[...document.querySelectorAll('.oc-edge-tools button')].find(x=>x.textContent.trim()==='编辑'); if(!b) return null; const r=b.getBoundingClientRect(); return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)} })()`)
    check(!!editBtn, '选中连线后出现编辑入口')
    if (editBtn) {
      await mouse('mousePressed', editBtn.x, editBtn.y, { button: 'left', buttons: 1, clickCount: 1 })
      await mouse('mouseReleased', editBtn.x, editBtn.y, { button: 'left', buttons: 0, clickCount: 1 })
      await sleep(420)
      const sw = await ev(`(() => { const p=document.querySelector('.oc-eedit'); if(!p) return null; const list=[...p.querySelectorAll('.oc-ctx-sw')]; const target=list.find(x=>x.title==='#8971a2'); if(!target) return null; const r=target.getBoundingClientRect(); return {x:Math.round(r.x+r.width/2), y:Math.round(r.y+r.height/2)} })()`)
      check(!!sw, '连线编辑浮层出现色板')
      if (sw) {
        await mouse('mousePressed', sw.x, sw.y, { button: 'left', buttons: 1, clickCount: 1 })
        await mouse('mouseReleased', sw.x, sw.y, { button: 'left', buttons: 0, clickCount: 1 })
        await sleep(450)
        const color = await ev(`(() => { const p=document.querySelector('.oc-edge[data-edge-key="${edge.key}"] .oc-edge-visible'); return p?{attr:p.getAttribute('stroke'), computed:getComputedStyle(p).stroke, on:[...document.querySelectorAll('.oc-eedit .oc-ctx-sw.on')].map(x=>x.title)}:null })()`)
        check(!!color && color.computed === 'rgb(137, 113, 162)', `连线计算色变为自定义色（${color?.computed}）`)
        // 主题色复位
        const themeSw = await ev(`(() => { const t=[...document.querySelectorAll('.oc-eedit .oc-ctx-sw')].find(x=>x.title==='主题色'); if(!t) return null; const r=t.getBoundingClientRect(); return {x:Math.round(r.x+r.width/2), y:Math.round(r.y+r.height/2)} })()`)
        if (themeSw) {
          await mouse('mousePressed', themeSw.x, themeSw.y, { button: 'left', buttons: 1, clickCount: 1 })
          await mouse('mouseReleased', themeSw.x, themeSw.y, { button: 'left', buttons: 0, clickCount: 1 })
          await sleep(400)
          const reset = await ev(`(() => { const p=document.querySelector('.oc-edge[data-edge-key="${edge.key}"] .oc-edge-visible'); return p?getComputedStyle(p).stroke:null })()`)
          check(reset === 'rgb(89, 135, 126)', `主题色复位为关系类型色（${reset}）`)
        }
      }
    }
  }
}

/* 5) 绯色皮肤容器不透明（连线/点阵不透出） */
{
  const bg = await ev(`(() => {
    const n=document.querySelector('.oc-node.oc-container'); if(!n) return null
    const s=getComputedStyle(n); const raw=s.backgroundColor
    let alpha=1
    const rgba=raw.match(/rgba?\\(([^)]+)\\)/)
    if(rgba){ const p=rgba[1].split(/[, ]+/).filter(Boolean); if(p.length>=4) alpha=Number(p[3]) }
    else { const slash=raw.match(/\\/\\s*([\\d.]+)(%?)\\s*\\)/); if(slash) alpha=slash[2]==='%'?Number(slash[1])/100:Number(slash[1]) }
    return { raw, alpha, opacity:Number(s.opacity) }
  })()`)
  check(!!bg && bg.alpha >= 0.98, `容器底色不透明（${bg?.raw}, alpha=${bg?.alpha}）`)
}

/* 6) 只有便签的容器摘要不再说“还没有内容” */
{
  const created = await ev(`(async () => {
    const { useWorkStore } = await import('/src/stores/work.js')
    const w = useWorkStore()
    const c = w.olnodeAdd(null, { kind:'container', title:'纯便签容器', canvasX:1200, canvasY:760 })
    w.olnodeAdd(c.id, { kind:'note', title:'一张便签', text:'仅便签内容' })
    return { id:c.id, kids:w.olnodeChildren(c.id).length }
  })()`)
  await sleep(600)
  check(created && created.kids === 1, '建立仅含便签的测试容器')
  const summary = await ev(`(() => { const n=document.querySelector('.oc-node[data-node-id="${created?.id}"] .oc-csummary'); return n?n.textContent.trim():null })()`)
  check(!!summary && summary.includes('已收纳') && !summary.includes('还没有内容'), `容器摘要显示已收纳模块（${summary}）`)
}

/* 7) 工具条与画布之间无空隙（赤月戏 margin 露出底层花纹） */
{
  const gap = await ev(`(() => { const t=document.querySelector('.oc-toolbar').getBoundingClientRect(); const cv=document.querySelector('.oc-canvas').getBoundingClientRect(); return {tb:Math.round(t.bottom), ct:Math.round(cv.top)} })()`)
  check(gap.ct - gap.tb <= 1, `工具条与画布之间无空隙（${gap.tb} → ${gap.ct}）`)
}

/* 8) 连线删除：Delete 键 + 工具条「删除」按钮（relId 必须用真实 rel.id 而非分组键） */
{
  const pick = async () => ev(`(() => {
    const g=[...document.querySelectorAll('.oc-edge')].find(e=>e.querySelector('.oc-edge-hit')?.dataset.owner)
    if(!g) return null
    const hit=g.querySelector('.oc-edge-hit')
    /* 沿路径采样找一个真正可点热区（容器卡内部被滚动层遮住，属不可点区域） */
    for (const t of [0.5, 0.65, 0.35, 0.8, 0.2, 0.9, 0.1]) {
      const L=hit.getTotalLength(), pt=hit.getPointAtLength(L*t), m=hit.getScreenCTM()
      const x=Math.round(m.a*pt.x+m.c*pt.y+m.e), y=Math.round(m.b*pt.x+m.d*pt.y+m.f)
      const under=document.elementFromPoint(x,y)
      if(under===hit) return {owner:hit.dataset.owner, rel:hit.dataset.rel, x, y}
    }
    return null
  })()`)
  const gone = (info) => ev(`(() => { const w=${store}; return !w.olnodes.find(n=>n.id===${JSON.stringify(info.owner)})?.rels?.some(r=>r.id===${JSON.stringify(info.rel)}) })()`)
  const e0 = await pick()
  if (e0) {
    await mouse('mouseMoved', e0.x, e0.y, { buttons: 0 })
    await mouse('mousePressed', e0.x, e0.y, { button: 'left', buttons: 1, clickCount: 1 })
    await mouse('mouseReleased', e0.x, e0.y, { button: 'left', buttons: 0, clickCount: 1 })
    await sleep(300)
    await c.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Delete', code: 'Delete', windowsVirtualKeyCode: 46 })
    await c.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Delete', code: 'Delete', windowsVirtualKeyCode: 46 })
    await sleep(500)
    check(await gone(e0), `Delete 键删除连线（rel=${e0.rel}）`)
  }
  const e1 = await pick()
  if (e1) {
    await mouse('mousePressed', e1.x, e1.y, { button: 'left', buttons: 1, clickCount: 1 })
    await mouse('mouseReleased', e1.x, e1.y, { button: 'left', buttons: 0, clickCount: 1 })
    await sleep(300)
    const btn = await ev(`(() => { const b=[...document.querySelectorAll('.oc-edge-tools button')].find(x=>x.textContent.trim()==='删除'); if(!b) return null; const r=b.getBoundingClientRect(); return {x:Math.round(r.x+r.width/2), y:Math.round(r.y+r.height/2)} })()`)
    if (btn) {
      await mouse('mousePressed', btn.x, btn.y, { button: 'left', buttons: 1, clickCount: 1 })
      await mouse('mouseReleased', btn.x, btn.y, { button: 'left', buttons: 0, clickCount: 1 })
      await sleep(500)
    }
    check(await gone(e1), `工具条「删除」按钮删除连线（rel=${e1?.rel}）`)
  }
}

/* 9) 容器内外互连（迷你卡锚点整颗可点 + 受阻路由也放行建线） */
{
  const aptHit = await ev(`(() => {
    const apt=document.querySelector('.oc-mini[data-mini-id="m-keeper"] .oc-apt[data-side="right"]')
    const r=apt.getBoundingClientRect()
    const el=document.elementFromPoint(r.left+r.width/2, r.top+r.height/2)
    return {x:Math.round(r.left+r.width/2), y:Math.round(r.top+r.height/2), hit:el?el.className.toString().slice(0,30):null}
  })()`)
  check(aptHit.hit === 'oc-apt', `迷你卡锚点整颗可点（命中 ${aptHit.hit}）`)
  const before = await ev(`${store}.olnodes.reduce((s,n)=>s+(n.rels?.length||0),0)`)
  const target = await ev(`(() => { const a=document.querySelector('.oc-node[data-node-id="volume"] .oc-apt[data-side="top"]'); const r=a.getBoundingClientRect(); return {x:Math.round(r.left+r.width/2), y:Math.round(r.top+r.height/2)} })()`)
  await mouse('mouseMoved', aptHit.x, aptHit.y, { buttons: 0 })
  await mouse('mousePressed', aptHit.x, aptHit.y, { button: 'left', buttons: 1, clickCount: 1 })
  await sleep(100)
  for (let i = 1; i <= 6; i++) {
    await mouse('mouseMoved', aptHit.x + ((target.x - aptHit.x) * i) / 6, aptHit.y + ((target.y - aptHit.y) * i) / 6, { button: 'left', buttons: 1 })
    await sleep(100)
  }
  await mouse('mouseReleased', target.x, target.y, { button: 'left', buttons: 0, clickCount: 1 })
  await sleep(600)
  const after = await ev(`(() => { const w=${store}; const n=w.olnodes.find(x=>x.id==='m-keeper'); return {total:w.olnodes.reduce((s,n)=>s+(n.rels?.length||0),0), toIds:n?.rels?.map(r=>r.toId)} })()`)
  check(after.total > before && after.toIds?.includes('volume'), `容器内迷你卡 → 外部模块连线建立（${before} → ${after.total}）`)
  const before2 = after.total
  const p2 = await ev(`(() => {
    const a=document.querySelector('.oc-node[data-node-id="volume"] .oc-apt[data-side="right"]')
    const r=a.getBoundingClientRect()
    const t=[...document.querySelectorAll('.oc-mini[data-mini-id="m-seal"] .oc-apt')].find(x=>x.dataset.side==='top')
    const tr=t.getBoundingClientRect()
    return {from:{x:Math.round(r.left+r.width/2), y:Math.round(r.top+r.height/2)}, to:{x:Math.round(tr.left+tr.width/2), y:Math.round(tr.top+tr.height/2)}}
  })()`)
  await mouse('mouseMoved', p2.from.x, p2.from.y, { buttons: 0 })
  await mouse('mousePressed', p2.from.x, p2.from.y, { button: 'left', buttons: 1, clickCount: 1 })
  await sleep(100)
  for (let i = 1; i <= 6; i++) {
    await mouse('mouseMoved', p2.from.x + ((p2.to.x - p2.from.x) * i) / 6, p2.from.y + ((p2.to.y - p2.from.y) * i) / 6, { button: 'left', buttons: 1 })
    await sleep(100)
  }
  await mouse('mouseReleased', p2.to.x, p2.to.y, { button: 'left', buttons: 0, clickCount: 1 })
  await sleep(600)
  const after2 = await ev(`(() => { const w=${store}; const n=w.olnodes.find(x=>x.id==='volume'); return {total:w.olnodes.reduce((s,n)=>s+(n.rels?.length||0),0), toIds:n?.rels?.map(r=>r.toId)} })()`)
  check(after2.total > before2 && after2.toIds?.includes('m-seal'), `外部模块 → 容器内迷你卡连线建立（${before2} → ${after2.total}）`)
}

const errs = await ev('window.__errs || []')
check(!errs.length, `无页面 error（${errs.length}）`)

console.log(`\nRESULT ${checks.filter((x) => x.ok).length}/${checks.length}`)
if (fails.length) console.log('FAILED:\n' + fails.join('\n'))
process.exit(fails.length ? 1 : 0)
