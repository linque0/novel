/* 设定模块左侧条目目录（MubuTree / LoreNavNode）双样本真机 CDP 验收 */
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

const savedState = await c.evalx(`(() => {
  window.__navErrors = [];
  window.addEventListener('error', (e) => window.__navErrors.push('error: ' + (e.message || e.error)));
  window.addEventListener('unhandledrejection', (e) => window.__navErrors.push('rejection: ' + (e.reason?.message || e.reason)));
  const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;
  const ui = pinia._s.get('ui');
  return { navWidth: ui.loreNavWidth, navClosed: ui.loreNavClosed };
})()`)

try {
  // ========== 样本 1：dev《压力测试》（1,009 节点 / 10 层） ==========
  const setupBig = await c.evalx(`(async () => {
    const { db } = window.__ns;
    const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;
    const work = window.__ns.getWork();
    const ui = pinia._s.get('ui');
    const target = (await db.works.toArray()).find((w) => !w.deletedAt && w.title === '压力测试');
    if (!target) return { err: '找不到《压力测试》' };
    ui.loreView = 'write';
    await work.open(target.id);
    ui.view = 'work';
    work.tab = 'lore';
    ui.loreNavClosed = false;
    ui.loreNavWidth = 220;
    ui.navigateLore({ view: 'write', rootId: null, rootPath: [], scope: 'all', activeId: null, selectedId: null, query: '' });

    const live = work.liveMubu();
    const depthOf = (id) => work.mubuPath(id).length - 1;
    let deepest = null;
    for (const n of live) {
      const d = depthOf(n.id);
      if (!deepest || d > deepest.depth) deepest = { id: n.id, text: n.text, depth: d };
    }
    const linjiang = live.find((n) => n.text.includes('临江市'));
    const hexin = live.find((n) => n.text.trim() === '核心区划');
    if (!linjiang || !hexin || !deepest) return { err: '未找到关键测试节点' };

    // 仅展开临江市与最深节点所在路径（保持页面干净）
    const openSet = new Set([
      ...work.mubuPath(linjiang.id).map((n) => n.id),
      ...work.mubuPath(deepest.id).map((n) => n.id),
    ]);
    ui.loreNavFold = live
      .filter((n) => work.mubuChildren(n.id).length > 0 && !openSet.has(n.id))
      .map((n) => n.id);

    return {
      liveCount: live.length,
      linjiang: { id: linjiang.id, text: linjiang.text, depth: depthOf(linjiang.id) },
      hexin: { id: hexin.id, text: hexin.text, depth: depthOf(hexin.id) },
      deepest,
    };
  })()`)
  assert.ok(!setupBig.err, setupBig.err)
  console.log('1) 《压力测试》准备完成:', JSON.stringify(setupBig))
  await c.sleep(350)

  // 1.1 检查 220px 侧栏下样式权重修复、占位释放、分段缩进封顶、深层徽标与参考线
  const metrics220 = await c.evalx(`((linjiangId, deepestId) => {
    const navPane = document.querySelector('.lore-pane[data-pane="nav"]');
    const navTree = document.querySelector('.lore-shell .nav-tree');
    const measureNode = (id) => {
      const btn = document.querySelector('.lore-nav-node[data-id="' + id + '"]');
      if (!btn) return null;
      const row = btn.closest('.lore-nav-row');
      const label = btn.querySelector('.lore-nav-label');
      const depthBadge = btn.querySelector('.lore-nav-depth');
      const more = row.querySelector('.lore-nav-more');
      const csRow = getComputedStyle(row);
      const csBtn = getComputedStyle(btn);
      const csMore = getComputedStyle(more);
      return {
        rowPadLeft: parseFloat(csRow.paddingLeft),
        rowHeight: Math.round(row.getBoundingClientRect().height),
        btnDisplay: csBtn.display,
        btnPadLeft: parseFloat(csBtn.paddingLeft),
        btnBg: csBtn.backgroundColor,
        labelWidth: Math.round(label.getBoundingClientRect().width),
        depthBadgeText: depthBadge ? depthBadge.textContent.trim() : null,
        moreDisplay: csMore.display,
        moreSvgHtml: more.querySelector('svg')?.innerHTML || '',
      };
    };

    const groups = [...document.querySelectorAll('.lore-nav-group')];
    const guidedGroups = groups.filter((g) => !g.classList.contains('no-guide'));
    const noGuideGroups = groups.filter((g) => g.classList.contains('no-guide'));
    const firstGuideBefore = guidedGroups[0] ? getComputedStyle(guidedGroups[0], '::before') : null;
    const cappedGuideBefore = noGuideGroups[0] ? getComputedStyle(noGuideGroups[0], '::before') : null;

    return {
      navPaneWidth: Math.round(navPane.getBoundingClientRect().width),
      navTreePadLeft: parseFloat(getComputedStyle(navTree).paddingLeft),
      linjiang: measureNode(linjiangId),
      deepest: measureNode(deepestId),
      guidedCount: guidedGroups.length,
      noGuideCount: noGuideGroups.length,
      firstGuideWidth: firstGuideBefore?.width || '',
      firstGuideContent: firstGuideBefore?.content || '',
      cappedGuideContent: cappedGuideBefore?.content || '',
    };
  })(${JSON.stringify(setupBig.linjiang.id)}, ${JSON.stringify(setupBig.deepest.id)})`)
  console.log('2) 220px 侧栏实测指标:', JSON.stringify(metrics220))

  assert.ok(metrics220.navPaneWidth >= 218 && metrics220.navPaneWidth <= 224, `侧栏宽应为 ~220px，实际 ${metrics220.navPaneWidth}`)
  assert.equal(metrics220.navTreePadLeft, 6, `nav-tree 左 padding 应为 6px，实际 ${metrics220.navTreePadLeft}`)
  assert.ok(metrics220.linjiang, '应渲染临江市节点')
  assert.equal(metrics220.linjiang.btnDisplay, 'flex', 'lore-nav-node 必须为 flex（不被 dsh.css display:block 覆盖）')
  assert.ok(metrics220.linjiang.btnPadLeft <= 3, `lore-nav-node 左 padding 应 <= 3px，实际 ${metrics220.linjiang.btnPadLeft}`)
  assert.equal(metrics220.linjiang.btnBg, 'rgba(0, 0, 0, 0)', 'lore-nav-node 自身背景应透明（无双层背景框）')
  assert.equal(metrics220.linjiang.moreDisplay, 'none', '桌面端 lore-nav-more 应隐藏（display:none），避免与右键重复')
  assert.ok(metrics220.linjiang.moreSvgHtml.includes('<circle'), 'dots 图标应正确渲染三点 SVG（供触屏/窄屏使用）')
  assert.equal(metrics220.linjiang.rowPadLeft, 42, `第 6 层（depth=5）缩进应为 42px，实际 ${metrics220.linjiang.rowPadLeft}`)
  assert.ok(metrics220.linjiang.labelWidth >= 130, `第 6 层正文区宽度应 >= 130px，实际 ${metrics220.linjiang.labelWidth}`)

  assert.ok(metrics220.deepest, '应渲染最深层节点')
  assert.equal(metrics220.deepest.rowPadLeft, 48, `第 ${setupBig.deepest.depth + 1} 层缩进应封顶在 48px，实际 ${metrics220.deepest.rowPadLeft}`)
  assert.equal(metrics220.deepest.depthBadgeText, `L${setupBig.deepest.depth + 1}`, '深层节点应显示 L7..L10 微标')
  assert.ok(metrics220.deepest.labelWidth >= 105, `最深层正文区宽度应 >= 105px，实际 ${metrics220.deepest.labelWidth}`)
  assert.ok(metrics220.guidedCount > 0 && metrics220.firstGuideWidth === '1px', '常规层应渲染 1px 纵向参考线')
  assert.ok(metrics220.noGuideCount > 0 && metrics220.cappedGuideContent === 'none', '封顶后子组不应渲染重叠参考线')

  // 1.2 验证宽侧栏档（>= 300px）自动放宽缩进上限
  await c.evalx(`(() => {
    const ui = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('ui');
    ui.loreNavWidth = 320;
    return true;
  })()`)
  await c.sleep(200)
  const wideIndent = await c.evalx(`((id) => {
    const row = document.querySelector('.lore-nav-node[data-id="' + id + '"]')?.closest('.lore-nav-row');
    return row ? parseFloat(getComputedStyle(row).paddingLeft) : -1;
  })(${JSON.stringify(setupBig.deepest.id)})`)
  console.log('3) 宽侧栏（320px）最深层缩进:', wideIndent)
  assert.equal(wideIndent, 72, `320px 宽侧栏最深层缩进应放宽至 72px，实际 ${wideIndent}`)

  // 恢复回 220px 继续验收交互
  await c.evalx(`(() => {
    const ui = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('ui');
    ui.loreNavWidth = 220;
    return true;
  })()`)
  await c.sleep(200)

  // 1.3 验证目录下钻（Hoist）流程：右键核心区划 -> 「在目录中下钻此分支」 -> 子级顶格 -> 退出恢复
  const hoistCheck = await c.evalx(`((hexinId) => {
    const row = document.querySelector('.lore-nav-node[data-id="' + hexinId + '"]')?.closest('.lore-nav-row');
    if (!row) return false;
    const r = row.getBoundingClientRect();
    row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.left + 20, clientY: r.top + 10 }));
    return true;
  })(${JSON.stringify(setupBig.hexin.id)})`)
  assert.ok(hoistCheck, '应能右键触发核心区划的菜单')
  await c.sleep(150)

  const clickedHoist = await c.evalx(`(() => {
    const btns = [...document.querySelectorAll('.lore-nav-context button')];
    const hoistBtn = btns.find((b) => b.textContent.trim() === '在目录中下钻此分支');
    if (!hoistBtn) return { err: '菜单中未找到「在目录中下钻此分支」', items: btns.map((b) => b.textContent.trim()) };
    hoistBtn.click();
    return { ok: true };
  })()`)
  assert.ok(clickedHoist.ok, JSON.stringify(clickedHoist))
  await c.sleep(200)

  const hoistedState = await c.evalx(`(() => {
    const hoistBar = document.querySelector('.lore-nav-hoist');
    const currentText = hoistBar?.querySelector('.lore-nav-hoist-current span')?.textContent?.trim() || '';
    const crumbs = [...document.querySelectorAll('.lore-nav-hoist-crumb')].map((b) => b.textContent.trim());
    const topBranches = [...document.querySelectorAll('[role="tree"] > .lore-nav-branch')];
    const firstRow = topBranches[0]?.querySelector(':scope > .lore-nav-row');
    return {
      hasBar: Boolean(hoistBar),
      currentText,
      crumbs,
      topCount: topBranches.length,
      firstText: firstRow?.querySelector('.lore-nav-label')?.textContent?.trim() || '',
      firstAriaLevel: topBranches[0]?.getAttribute('aria-level') || '',
      firstPadLeft: firstRow ? parseFloat(getComputedStyle(firstRow).paddingLeft) : -1,
    };
  })()`)
  console.log('4) 目录下钻「核心区划」后状态:', JSON.stringify(hoistedState))
  assert.ok(hoistedState.hasBar, '下钻后应显示顶部面包屑导航条')
  assert.equal(hoistedState.currentText, '核心区划')
  assert.ok(hoistedState.crumbs.includes('全部') && hoistedState.crumbs.includes('现实模版'), `面包屑应含祖先路径，实际 ${JSON.stringify(hoistedState.crumbs)}`)
  assert.equal(hoistedState.firstAriaLevel, '1', '下钻后直接子级应为 depth=0 (aria-level=1)')
  assert.equal(hoistedState.firstPadLeft, 0, `下钻后直接子级 padding-left 应为 0px，实际 ${hoistedState.firstPadLeft}`)

  // 退出下钻恢复完整目录
  await c.evalx(`(document.querySelector('.lore-nav-hoist-exit')?.click(), true)`)
  await c.sleep(200)
  const afterExitHoist = await c.evalx(`(() => ({
    hasBar: Boolean(document.querySelector('.lore-nav-hoist')),
    topRoots: [...document.querySelectorAll('[role="tree"] > .lore-nav-branch > .lore-nav-row .lore-nav-label')].map((el) => el.textContent.trim()),
  }))()`)
  console.log('5) 退出下钻后状态:', JSON.stringify(afterExitHoist))
  assert.equal(afterExitHoist.hasBar, false, '退出下钻后导航条应消失')
  assert.deepEqual(afterExitHoist.topRoots, ['现实模版', '虚构国度', '设定'])

  // 1.4 验证一键收起（第 1 次仅保留当前路径；第 2 次全部折叠至 3 个顶层设定集）
  await c.evalx(`((linjiangId) => {
    const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;
    const ui = pinia._s.get('ui');
    ui.loreActiveId = linjiangId;
    ui.mubuSelectedId = linjiangId;
    // 全部展开几个无关分支
    ui.loreNavFold = [];
    return true;
  })(${JSON.stringify(setupBig.linjiang.id)})`)
  await c.sleep(300)

  await c.evalx(`(document.querySelector('.nav-collapse-tree')?.click(), true)`)
  await c.sleep(250)
  const collapseStep1 = await c.evalx(`((linjiangId) => ({
    linjiangVisible: Boolean(document.querySelector('.lore-nav-node[data-id="' + linjiangId + '"]')),
    renderedRows: document.querySelectorAll('.lore-nav-row').length,
    topExpanded: [...document.querySelectorAll('[role="tree"] > .lore-nav-branch')].map((b) => ({
      name: b.querySelector(':scope > .lore-nav-row .lore-nav-label')?.textContent?.trim(),
      expanded: b.getAttribute('aria-expanded'),
    })),
  }))(${JSON.stringify(setupBig.linjiang.id)})`)
  console.log('6) 一键收起第 1 次（仅留当前路径）:', JSON.stringify(collapseStep1))
  assert.equal(collapseStep1.linjiangVisible, true, '第 1 次点击应保持当前节点临江市可见')
  assert.equal(collapseStep1.topExpanded.find((x) => x.name === '现实模版')?.expanded, 'true')
  assert.equal(collapseStep1.topExpanded.find((x) => x.name === '虚构国度')?.expanded, 'false')
  assert.equal(collapseStep1.topExpanded.find((x) => x.name === '设定')?.expanded, 'false')

  await c.evalx(`(document.querySelector('.nav-collapse-tree')?.click(), true)`)
  await c.sleep(200)
  const collapseStep2 = await c.evalx(`(() => ({
    renderedRows: document.querySelectorAll('.lore-nav-row').length,
    topExpanded: [...document.querySelectorAll('[role="tree"] > .lore-nav-branch')].map((b) => b.getAttribute('aria-expanded')),
  }))()`)
  console.log('7) 一键收起第 2 次（全部折叠）:', JSON.stringify(collapseStep2))
  assert.equal(collapseStep2.renderedRows, 3, `全部折叠后应仅渲染 3 个顶层设定集，实际 ${collapseStep2.renderedRows}`)
  assert.deepEqual(collapseStep2.topExpanded, ['false', 'false', 'false'])

  // 1.5 验证点击深层节点与层级导图联动
  await c.evalx(`((deepestId) => {
    const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;
    const work = window.__ns.getWork();
    const ui = pinia._s.get('ui');
    ui.setLoreMapMode('hierarchy');
    ui.setLoreView('map', { scroll: 0 });
    const path = new Set(work.mubuPath(deepestId).map((n) => n.id));
    ui.loreNavFold = ui.loreNavFold.filter((id) => !path.has(id));
    return true;
  })(${JSON.stringify(setupBig.deepest.id)})`)
  await c.sleep(450)

  await c.evalx(`((deepestId) => {
    document.querySelector('.lore-nav-node[data-id="' + deepestId + '"]')?.click();
    return true;
  })(${JSON.stringify(setupBig.deepest.id)})`)
  await c.sleep(350)

  const linkCheck = await c.evalx(`((deepestId) => {
    const ui = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('ui');
    return {
      activeId: ui.loreActiveId,
      matched: ui.loreActiveId === deepestId,
      mapZoom: Number(document.querySelector('.lore-tm-inner')?.style.getPropertyValue('--tm-zoom') || 0),
    };
  })(${JSON.stringify(setupBig.deepest.id)})`)
  console.log('8) 深层节点点击联动导图:', JSON.stringify(linkCheck))
  assert.equal(linkCheck.matched, true, '点击深层节点应更新 ui.loreActiveId')
  assert.ok(linkCheck.mapZoom >= 0.75, `点击深层节点后层级导图应自动可读聚焦，实际 zoom=${linkCheck.mapZoom}`)

  // ========== 样本 2：dev《天穹钟摆》（小树回归验证） ==========
  const smallCheck = await c.evalx(`(async () => {
    const { db } = window.__ns;
    const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;
    const work = window.__ns.getWork();
    const ui = pinia._s.get('ui');
    const target = (await db.works.toArray()).find((w) => !w.deletedAt && w.title === '天穹钟摆');
    if (!target) return { err: '找不到《天穹钟摆》' };
    ui.loreView = 'write';
    await work.open(target.id);
    ui.view = 'work';
    work.tab = 'lore';
    ui.navigateLore({ view: 'write', rootId: null, rootPath: [], scope: 'all', activeId: null, selectedId: null, query: '' });
    ui.loreNavFold = [];
    return { workId: target.id, count: work.liveMubu().length };
  })()`)
  assert.ok(!smallCheck.err, smallCheck.err)
  await c.sleep(350)

  const smallMetrics = await c.evalx(`(() => {
    const rows = [...document.querySelectorAll('.lore-nav-row')];
    const indentsByDepth = {};
    for (const r of rows) {
      const d = r.style.getPropertyValue('--nav-depth').trim();
      if (!(d in indentsByDepth)) indentsByDepth[d] = parseFloat(getComputedStyle(r).paddingLeft);
    }
    const rowHeights = rows.slice(0, 6).map((r) => Math.round(r.getBoundingClientRect().height));
    const weightIcons = document.querySelectorAll('.lore-nav-weight').length;
    const cappedBadges = document.querySelectorAll('.lore-nav-depth').length;
    return { totalRows: rows.length, indentsByDepth, rowHeights, weightIcons, cappedBadges };
  })()`)
  console.log('9) 《天穹钟摆》小树回归:', JSON.stringify(smallMetrics))
  assert.ok(smallMetrics.totalRows >= 25, `《天穹钟摆》应完整渲染条目，实际 ${smallMetrics.totalRows}`)
  assert.equal(smallMetrics.indentsByDepth['0'], 0)
  assert.equal(smallMetrics.indentsByDepth['1'], 10)
  if ('2' in smallMetrics.indentsByDepth) assert.equal(smallMetrics.indentsByDepth['2'], 20)
  assert.equal(smallMetrics.cappedBadges, 0, '小树浅层级不应出现 L7+ 深层微标')

  // 检索功能回归
  await c.evalx(`(() => {
    const ui = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('ui');
    ui.mubuQuery = '钟';
    return true;
  })()`)
  await c.sleep(150)
  const hitCount = await c.evalx(`document.querySelectorAll('.lore-search-result').length`)
  await c.evalx(`(() => {
    const ui = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('ui');
    ui.mubuQuery = '';
    return true;
  })()`)
  console.log('10) 《天穹钟摆》检索结果数:', hitCount)
  assert.ok(hitCount > 0, '检索功能应正常返回命中条目')

  const errors = await c.evalx(`window.__navErrors || []`)
  console.log('11) 运行期错误数:', errors.length, errors)
  assert.equal(errors.length, 0, `验收过程出现运行期错误: ${JSON.stringify(errors)}`)
  console.log('✅ 双样本 CDP 验收全部通过！')
} finally {
  // 恢复用户原始侧栏宽度并切回《压力测试》方便用户直观查看
  await c.evalx(`(async (saved) => {
    const { db } = window.__ns;
    const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;
    const work = window.__ns.getWork();
    const ui = pinia._s.get('ui');
    ui.loreNavWidth = saved.navWidth;
    ui.loreNavClosed = saved.navClosed;
    const target = (await db.works.toArray()).find((w) => !w.deletedAt && w.title === '压力测试');
    if (target) {
      ui.loreView = 'write';
      await work.open(target.id);
      ui.view = 'work';
      work.tab = 'lore';
      const live = work.liveMubu();
      const linjiang = live.find((n) => n.text.includes('临江市'));
      if (linjiang) {
        const openSet = new Set(work.mubuPath(linjiang.id).map((n) => n.id));
        ui.loreNavFold = live.filter((n) => work.mubuChildren(n.id).length > 0 && !openSet.has(n.id)).map((n) => n.id);
        ui.loreActiveId = linjiang.id;
        ui.mubuSelectedId = linjiang.id;
      }
    }
    return true;
  })(${JSON.stringify(savedState)})`).catch(() => {})
}
process.exit(0)
