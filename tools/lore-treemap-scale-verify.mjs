/* 层级导图（LoreTreeMap）大规模节点可读性与缩放定位双样本真机验收（Node 侧分段驱动，避免后台窗口节流） */
import assert from 'node:assert/strict'
import { connect } from './_cdp-lib.mjs'

const c = await connect('127.0.0.1:5173')
await c.sleep(300)

const env = await c.evalx(`(() => ({
  href: location.href,
  visibility: document.visibilityState,
  w: window.innerWidth,
  h: window.innerHeight,
  hasNs: typeof window.__ns === 'object'
}))()`)
assert.ok(env?.href?.includes('127.0.0.1:5173'), '须连接 dev 实例 127.0.0.1:5173')
console.log('已连接 dev 实例:', JSON.stringify(env))

await c.evalx(`(() => {
  window.__tmErrors = [];
  window.addEventListener('error', (e) => window.__tmErrors.push('error: ' + (e.message || e.error)));
  window.addEventListener('unhandledrejection', (e) => window.__tmErrors.push('rejection: ' + (e.reason?.message || e.reason)));
  return true;
})()`)

// ========== 样本 1：dev《压力测试》（1,009 节点 / 10 层） ==========
// 1. 先切到「条目编写」再进入「层级导图」模拟首次切入
const openBig = await c.evalx(`(async () => {
  const { db } = window.__ns;
  const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;
  const work = window.__ns.getWork();
  const ui = pinia._s.get('ui');
  const target = (await db.works.toArray()).find((w) => !w.deletedAt && w.title === '压力测试');
  if (!target) return { err: '找不到《压力测试》' };
  await work.open(target.id);
  ui.view = 'work';
  work.tab = 'lore';
  ui.navigateLore({ view: 'write', rootId: null, rootPath: [], scope: 'all', activeId: null, selectedId: null, query: '' });
  return { workId: target.id, liveCount: work.liveMubu().length };
})()`)
assert.ok(!openBig.err, openBig.err)
await c.sleep(300)

await c.evalx(`(() => {
  const ui = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('ui');
  ui.setLoreMapMode('hierarchy');
  ui.setLoreView('map', { scroll: 0 });
  return true;
})()`)
await c.sleep(450)

const step1 = await c.evalx(`(() => ({
  initNodes: document.querySelectorAll('.lore-tm-content-node').length,
  initZoom: Number(document.querySelector('.lore-tm-inner')?.style.getPropertyValue('--tm-zoom') || 0),
  initFoldLabel: document.querySelector('.lore-fold-level-trigger')?.textContent?.trim() || '',
  wrapW: document.querySelector('.lore-tm-wrap')?.clientWidth || 0,
  wrapH: document.querySelector('.lore-tm-wrap')?.clientHeight || 0
}))()`)
console.log('1) 首次切入层级导图:', JSON.stringify(step1))
assert.ok(step1.initNodes >= 15 && step1.initNodes <= 30, `首次切入应自动折叠至 2 级（~19 节点），实际 ${step1.initNodes}`)
assert.equal(step1.initFoldLabel, '2级⌄', `首次折叠层级标签应为 2级⌄，实际 ${step1.initFoldLabel}`)
assert.ok(step1.initZoom >= 0.6, `首次进入 zoom 应 >= 0.6，实际 ${step1.initZoom}`)

// 2. 点击底部「展开（全部）」
await c.evalx(`(document.querySelector('.lore-map-foot button[title="全部展开"]')?.click(), true)`)
await c.sleep(700)
const step2 = await c.evalx(`(() => ({
  fullNodes: document.querySelectorAll('.lore-tm-content-node').length,
  fullZoom: Number(document.querySelector('.lore-tm-inner')?.style.getPropertyValue('--tm-zoom') || 0),
  svgH: Number(document.querySelector('.lore-tm-edges')?.getAttribute('height') || 0)
}))()`)
console.log('2) 点击全部展开:', JSON.stringify(step2))
assert.equal(step2.fullNodes, 1009, '全部展开应渲染 1009 节点')
assert.ok(step2.fullZoom >= 0.6, `全部展开后 zoom 仍应 >= 0.6，实际 ${step2.fullZoom}`)

// 3. 点击底部「适应」
await c.evalx(`(document.querySelector('.lore-map-foot button[title="适应当前内容"]')?.click(), true)`)
await c.sleep(350)
const step3 = await c.evalx(`(() => ({
  fitZoom: Number(document.querySelector('.lore-tm-inner')?.style.getPropertyValue('--tm-zoom') || 0)
}))()`)
console.log('3) 点击适应:', JSON.stringify(step3))
assert.ok(step3.fitZoom >= 0.08, `点击适应后 zoom 应 >= 0.08，实际 ${step3.fitZoom}`)

// 4. 低倍率点击「放大」加速步进 + 「100% 复位」
await c.evalx(`(document.querySelector('.lore-map-foot button[title="放大"]')?.click(), true)`)
await c.sleep(200)
const afterZoomIn = await c.evalx(`Number(document.querySelector('.lore-tm-inner')?.style.getPropertyValue('--tm-zoom') || 0)`)
await c.evalx(`(document.querySelector('.lore-map-foot button[title="恢复 100%"]')?.click(), true)`)
await c.sleep(250)
const resetZoom = await c.evalx(`Number(document.querySelector('.lore-tm-inner')?.style.getPropertyValue('--tm-zoom') || 0)`)
console.log('4) 低倍率放大与 100% 复位:', JSON.stringify({ fitZoom: step3.fitZoom, afterZoomIn, resetZoom }))
assert.ok(afterZoomIn > step3.fitZoom * 1.35, `低倍率放大应走 1.45x 步进: ${step3.fitZoom} → ${afterZoomIn}`)
assert.equal(resetZoom, 1, '100% 复位后 zoom 应为 1')

// 5. 全部折叠 → 等待自动适应 → 再缩小到 < 0.75 → 选中 7 层深节点「第一阶段：脱离」点「聚焦」
await c.evalx(`(document.querySelector('.lore-map-foot button[title="全部折叠"]')?.click(), true)`)
await c.sleep(300)
await c.evalx(`(() => {
  for (let i = 0; i < 6; i++) document.querySelector('.lore-map-foot button[title="缩小"]')?.click();
  return true;
})()`)
await c.sleep(200)
const focusSetup = await c.evalx(`(() => {
  const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;
  const work = window.__ns.getWork();
  const ui = pinia._s.get('ui');
  const deepNode = work.liveMubu().find((n) => n.text.includes('第一阶段：脱离'));
  ui.loreActiveId = deepNode.id;
  ui.mubuSelectedId = deepNode.id;
  return {
    deepId: deepNode.id,
    beforeFocusZoom: Number(document.querySelector('.lore-tm-inner')?.style.getPropertyValue('--tm-zoom') || 0)
  };
})()`)
await c.sleep(200)
await c.evalx(`(document.querySelector('.lore-map-foot button[title="聚焦当前条目"]')?.click(), true)`)
await c.sleep(400)
const step5 = await c.evalx(`(() => {
  const el = document.querySelector('[data-lore-tree-id="${focusSetup.deepId}"]');
  const wrap = document.querySelector('.lore-tm-wrap')?.getBoundingClientRect();
  const r = el?.getBoundingClientRect();
  const inView = Boolean(wrap && r && (r.left + r.width / 2) >= wrap.left && (r.left + r.width / 2) <= wrap.right && (r.top + r.height / 2) >= wrap.top && (r.top + r.height / 2) <= wrap.bottom);
  return {
    beforeFocusZoom: ${focusSetup.beforeFocusZoom},
    focusZoom: Number(document.querySelector('.lore-tm-inner')?.style.getPropertyValue('--tm-zoom') || 0),
    deepVisible: Boolean(el),
    deepInView: inView
  };
})()`)
console.log('5) 深层节点聚焦:', JSON.stringify(step5))
assert.ok(step5.beforeFocusZoom < 0.75 && step5.focusZoom >= 0.85, `聚焦应拉回 >= 0.85: ${JSON.stringify(step5)}`)
assert.ok(step5.deepVisible && step5.deepInView, '聚焦 7 层深节点应自动展开祖先并居中视口')

// 6. 长文节点：选中解除限行 vs 未选中 3 行限行 + 双击行内编辑
const longId = await c.evalx(`(() => {
  const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;
  const work = window.__ns.getWork();
  const ui = pinia._s.get('ui');
  const longNode = work.liveMubu().find((n) => n.text.includes('今天的奥瑞格是帝国的政治中枢'));
  ui.loreActiveId = longNode.id;
  ui.mubuSelectedId = longNode.id;
  return longNode.id;
})()`)
await c.sleep(200)
await c.evalx(`(document.querySelector('.lore-map-foot button[title="聚焦当前条目"]')?.click(), true)`)
await c.sleep(350)
const longSelectedH = await c.evalx(`document.querySelector('[data-lore-tree-id="${longId}"]')?.offsetHeight || 0`)

await c.evalx(`(() => {
  const ui = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('ui');
  ui.loreActiveId = ${JSON.stringify(focusSetup.deepId)};
  ui.mubuSelectedId = ${JSON.stringify(focusSetup.deepId)};
  return true;
})()`)
await c.sleep(300)
const step6Clamp = await c.evalx(`(() => {
  const el = document.querySelector('[data-lore-tree-id="${longId}"]');
  return {
    longSelectedH: ${longSelectedH},
    longClampedH: el?.offsetHeight || 0,
    clampedStyle: el ? getComputedStyle(el.querySelector('.lore-tm-content')).webkitLineClamp : ''
  };
})()`)
await c.evalx(`(document.querySelector('[data-lore-tree-id="${longId}"]')?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true, detail: 2 })), true)`)
await c.sleep(250)
const editorMounted = await c.evalx(`Boolean(document.querySelector('.lore-tm-entry-input'))`)
await c.evalx(`(document.querySelector('.lore-map-foot')?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })), true)`)
await c.sleep(200)
console.log('6) 长文卡片限行与编辑:', JSON.stringify({ ...step6Clamp, editorMounted }))
assert.equal(step6Clamp.clampedStyle, '3', '非选中长文节点应应用 3 行限行')
assert.ok(step6Clamp.longSelectedH > step6Clamp.longClampedH + 40, `选中应解除限行: clamped=${step6Clamp.longClampedH} → selected=${step6Clamp.longSelectedH}`)
assert.ok(editorMounted, '双击长文节点应打开 LoreMapEditor')

// 7. 含徽章图节点：图片正常渲染、不被限行裁切
const badgeId = await c.evalx(`(() => {
  const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;
  const work = window.__ns.getWork();
  const ui = pinia._s.get('ui');
  const badgeNode = work.liveMubu().find((n) => n.text.includes('局徽：监察之眼'));
  ui.loreActiveId = badgeNode.id;
  ui.mubuSelectedId = badgeNode.id;
  return badgeNode.id;
})()`)
await c.sleep(200)
await c.evalx(`(document.querySelector('.lore-map-foot button[title="聚焦当前条目"]')?.click(), true)`)
await c.sleep(350)
const step7 = await c.evalx(`(() => {
  const el = document.querySelector('[data-lore-tree-id="${badgeId}"]');
  const img = el?.querySelector('img.lore-image');
  const content = el?.querySelector('.lore-tm-content');
  return {
    hasImg: Boolean(img),
    clampOnImgNode: content ? getComputedStyle(content).webkitLineClamp : ''
  };
})()`)
console.log('7) 徽章图片节点:', JSON.stringify(step7))
assert.ok(step7.hasImg, '徽章节点应渲染 img.lore-image')
assert.notEqual(step7.clampOnImgNode, '3', '含图片节点不应被 3 行截断')

// ========== 样本 2：dev《天穹钟摆》（35 节点小树回归） ==========
await c.evalx(`(async () => {
  const { db } = window.__ns;
  const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;
  const work = window.__ns.getWork();
  const ui = pinia._s.get('ui');
  const target = (await db.works.toArray()).find((w) => !w.deletedAt && w.title === '天穹钟摆');
  ui.loreView = 'write';
  await work.open(target.id);
  ui.view = 'work';
  work.tab = 'lore';
  ui.navigateLore({ view: 'map', mapMode: 'hierarchy', rootId: null, rootPath: [], scope: 'all', activeId: null, selectedId: null, query: '' });
  return true;
})()`)
await c.sleep(500)

const smallRes = await c.evalx(`(() => {
  const work = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('work');
  return {
    totalLive: work.liveMubu().length,
    visibleNodes: document.querySelectorAll('.lore-tm-content-node').length,
    foldLabel: document.querySelector('.lore-fold-level-trigger')?.textContent?.trim() || '',
    zoom: Number(document.querySelector('.lore-tm-inner')?.style.getPropertyValue('--tm-zoom') || 0),
    errors: window.__tmErrors || []
  };
})()`)
console.log('样本 2（《天穹钟摆》小树回归）:', JSON.stringify(smallRes))
assert.equal(smallRes.visibleNodes, smallRes.totalLive, '小树（35 节点）首次进入应全展开')
assert.equal(smallRes.foldLabel, '全部⌄', '小树首次折叠标签应为 全部⌄')
assert.ok(smallRes.zoom >= 0.4, `小树适应倍率应清晰可读，实际 ${smallRes.zoom}`)
assert.equal(smallRes.errors.length, 0, '全流程不应有运行时异常: ' + JSON.stringify(smallRes.errors))

// 恢复用户原先打开的《压力测试》→ 设定 → 层级导图（默认清晰的 2 级骨架）
await c.evalx(`(async () => {
  const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;
  const work = window.__ns.getWork();
  const ui = pinia._s.get('ui');
  await work.open(${JSON.stringify(openBig.workId)});
  ui.view = 'work';
  work.tab = 'lore';
  ui.navigateLore({ view: 'map', mapMode: 'hierarchy', rootId: null, rootPath: [], scope: 'all', activeId: null, selectedId: null, query: '' });
  return true;
})()`)

console.log('\nPASS：层级导图大规模节点可读性与双样本回归验收全部通过！')
process.exit(0)
