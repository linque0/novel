/* 将《浮世地域集.md》通过真实 parseMubuMd + work.mubuAddTree 链路导入 dev 库《压力测试》作品，
 * 并对设定界面（A 条目编写 / B 设定详情 / C 视觉导图与关系星系）执行千节点大文本压力验收。
 *
 * 用法：
 *   node tools/import-stress-lore.mjs --inspect   # 仅查看《压力测试》现有设定状态（不写入）
 *   node tools/import-stress-lore.mjs             # 导入并执行全套压力验收（若存在非预期自建设定则暂停）
 *   node tools/import-stress-lore.mjs --force     # 强制清空旧设定后重新导入并验收
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { connect } from './_cdp-lib.mjs'

const MD_PATH = 'e:/小小的说/浮世/浮世地域集.md'
const TARGET_TITLE = '压力测试'
const DEFAULT_SET_NAMES = new Set(['地点', '势力', '物品', '体系', '大事记', '地理与场所', '社会与势力', '规则与禁忌', '历史与纪年', '物件与线索', '民俗与信仰', '现实模版', '虚构国度', '设定'])

const args = process.argv.slice(2)
const inspectOnly = args.includes('--inspect')
const forceReplace = args.includes('--force')
const verifyOnly = args.includes('--verify-only')

if (!fs.existsSync(MD_PATH)) {
  console.error('找不到源文件：' + MD_PATH)
  process.exit(1)
}
const mdText = fs.readFileSync(MD_PATH, 'utf8')

const c = await connect('127.0.0.1:5173')
await c.sleep(1000)

// 确认目标确实是 dev 实例（5173）
const envInfo = await c.evalx(`(() => ({
  href: location.href,
  dev: typeof window.__ns === 'object',
  visibility: document.visibilityState
}))()`)
assert.ok(envInfo && envInfo.href && envInfo.href.includes('127.0.0.1:5173'), '当前 CDP 页面不是 dev 实例（127.0.0.1:5173）：' + JSON.stringify(envInfo))
assert.ok(envInfo.dev, '未找到 window.__ns 调试钩子')
console.log('已连接 dev 实例:', envInfo.href, 'visibility:', envInfo.visibility)

// 挂载控制台异常收集器
await c.evalx(`(() => {
  window.__stressErrors = [];
  window.addEventListener('error', (e) => window.__stressErrors.push('error: ' + (e.message || e.error)));
  window.addEventListener('unhandledrejection', (e) => window.__stressErrors.push('rejection: ' + (e.reason?.message || e.reason)));
  return true;
})()`)

// 1. 查找《压力测试》及其现有设定
const probe = await c.evalx(`(async () => {
  const { db } = window.__ns;
  const works = (await db.works.toArray()).filter((w) => !w.deletedAt);
  const target = works.find((w) => w.title === ${JSON.stringify(TARGET_TITLE)});
  if (!target) return { found: false, titles: works.map((w) => w.title) };
  const mubu = (await db.mubu.where('workId').equals(target.id).toArray()).filter((n) => !n.deletedAt);
  const roots = mubu.filter((n) => !n.parentId).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)).map((n) => n.text);
  const lorecats = await db.lorecats.where('workId').equals(target.id).toArray();
  const legacyLore = (await db.lore.where('workId').equals(target.id).toArray()).filter((n) => !n.deletedAt);
  return {
    found: true,
    workId: target.id,
    title: target.title,
    mubuCount: mubu.length,
    roots,
    lorecatCount: lorecats.length,
    legacyLoreCount: legacyLore.length
  };
})()`)

if (!probe || probe.PAGE_ERR || !probe.found) {
  console.error('未找到名为《' + TARGET_TITLE + '》的作品：', JSON.stringify(probe))
  process.exit(1)
}
console.log('目标作品状态:', JSON.stringify(probe, null, 2))
if (inspectOnly) process.exit(0)

if (!verifyOnly) {
  // 安全守卫：若存在非预期自建设定且未加 --force，先暂停确认
  const isExpectedExisting =
    probe.mubuCount === 0 ||
    (probe.roots.length > 0 && probe.roots.every((r) => DEFAULT_SET_NAMES.has(String(r || '').trim())))
  if (!isExpectedExisting && !forceReplace) {
    console.error('检测到《压力测试》已有非默认设定（节点数=' + probe.mubuCount + '，根节点=' + JSON.stringify(probe.roots) + '）。为防止误覆盖，已暂停；确认可覆盖请带 --force 参数运行。')
    process.exit(2)
  }

  // 2. 打开《压力测试》→ 切换到设定模块 → 清理旧 mubu（若有）→ 通过真实 parseMubuMd + mubuAddTree 导入
  const importRes = await c.evalx(`(async () => {
    const app = document.querySelector('#app').__vue_app__;
    const pinia = app.config.globalProperties.$pinia;
    const work = pinia._s.get('work');
    const ui = pinia._s.get('ui');
    const { db, parseMubuMd } = window.__ns;
    const workId = ${JSON.stringify(probe.workId)};

    await work.open(workId);
    ui.view = 'work';
    work.tab = 'lore';
    await new Promise((r) => setTimeout(r, 300));

    // 若已有旧 mubu，分批（每批 40 条）清理该作品下旧设定记录，避免触发 library-sync 的 200 条队列上限
    const lib = window.__ns.library;
    const hasLib = lib && typeof lib.libraryAvailable === 'function' && lib.libraryAvailable();
    const libMubuCount = async () => {
      if (!hasLib) return 0;
      const snap = await lib.librarySnapshot();
      return (snap?.data?.mubu || []).filter((r) => r && r.workId === workId && !r.deletedAt).length;
    };

    const oldRows = await db.mubu.where('workId').equals(workId).toArray();
    if (oldRows.length) {
      const ids = oldRows.map((r) => r.id);
      for (let i = 0; i < ids.length; i += 40) {
        await db.mubu.bulkDelete(ids.slice(i, i + 40));
        if (hasLib) await new Promise((r) => setTimeout(r, 380));
      }
      if (hasLib) {
        let g = 0;
        while ((await libMubuCount()) > 0 && g++ < 80) {
          await new Promise((r) => setTimeout(r, 400));
        }
        // 若仍有极少数因 EPERM 冲突滞留库中的旧记录，按库快照再补删一次
        let snap = await lib.librarySnapshot();
        const leftover = (snap?.data?.mubu || []).filter((r) => r && r.workId === workId).map((r) => r.id);
        for (let i = 0; i < leftover.length; i += 40) {
          await db.mubu.bulkDelete(leftover.slice(i, i + 40));
          await new Promise((r) => setTimeout(r, 450));
        }
        let g2 = 0;
        while ((await libMubuCount()) > 0 && g2++ < 60) {
          await new Promise((r) => setTimeout(r, 400));
        }
      }
      work.mubu = [];
    }
    // 同时清理可能存在的空旧表残留，防止再次触发旧迁移
    await db.appconfig.put({ key: 'mubu-mig:' + workId, value: true });

    const t0 = performance.now();
    const tree = parseMubuMd(${JSON.stringify(mdText)});
    const tParse = performance.now() - t0;

    const t1 = performance.now();
    work.mubuAddTree(null, null, tree);
    work.mubuRevision++;
    const tInsert = performance.now() - t1;

    // 选中「全部条目」方便完整渲染压测
    ui.navigateLore({ view: 'write', rootId: null, rootPath: [], scope: 'all', activeId: work.mubuRoots()[0]?.id || null, selectedId: work.mubuRoots()[0]?.id || null, query: '' });
    if (work.mubuRoots()[0]) work.setMubuSet(work.mubuRoots()[0].id);

    // 刷新落盘并等待自动保存与作品库同步全部完成
    const t2 = performance.now();
    await window.__flushNow?.();
    let guard = 0;
    while ((ui.autosave.saving || ui.autosave.pending > 0) && guard++ < 120) {
      await new Promise((r) => setTimeout(r, 150));
    }
    let libCount = -1;
    if (hasLib) {
      let lg = 0;
      while (lg++ < 90) {
        libCount = await libMubuCount();
        if (libCount === work.liveMubu().length) break;
        await new Promise((r) => setTimeout(r, 400));
      }
    }
    const tFlush = performance.now() - t2;

    const live = work.liveMubu();
    const roots = work.mubuRoots().map((n) => n.text);
    return {
      ok: true,
      count: live.length,
      libCount,
      roots,
      tParse: Math.round(tParse),
      tInsert: Math.round(tInsert),
      tFlush: Math.round(tFlush),
      autosavePending: ui.autosave.pending,
      autosaveError: ui.autosave.error
    };
  })()`)

  if (!importRes || importRes.PAGE_ERR || !importRes.ok) {
    console.error('导入失败：', JSON.stringify(importRes))
    process.exit(1)
  }
  console.log('导入完成:', JSON.stringify(importRes))
  assert.equal(importRes.count, 1009, '导入节点数应为 1009')
  if (importRes.libCount >= 0) assert.equal(importRes.libCount, 1009, '作品库同步落盘节点数应为 1009')
  assert.deepEqual(importRes.roots, ['现实模版', '虚构国度', '设定'], '顶层设定集应为 3 个')
  assert.equal(importRes.autosavePending, 0, 'autosave 应已全部落盘')
  assert.equal(importRes.autosaveError, null, 'autosave 不应报错')
} else {
  await c.evalx(`(async () => {
    const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;
    const work = pinia._s.get('work');
    const ui = pinia._s.get('ui');
    await work.open(${JSON.stringify(probe.workId)});
    ui.view = 'work';
    work.tab = 'lore';
    ui.navigateLore({ view: 'write', rootId: null, rootPath: [], scope: 'all', activeId: work.mubuRoots()[0]?.id || null, selectedId: work.mubuRoots()[0]?.id || null, query: '' });
    if (work.mubuRoots()[0]) work.setMubuSet(work.mubuRoots()[0].id);
    return true;
  })()`)
}

// 3. 设定界面全功能压力验收（A 条目编写 / B 设定详情 / C 视觉导图 & 关系星系）
await c.sleep(500)

// 3A. 条目编写（全部条目渲染 + 折叠 + 切换设定集 + 关键词搜索）
const viewARes = await c.evalx(`(async () => {
  const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;
  const work = pinia._s.get('work');
  const ui = pinia._s.get('ui');
  const waitFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 80)));

  await waitFrame();
  const allRows = document.querySelectorAll('.ob-row').length;
  const h3Dom = document.querySelectorAll('.ob-row.heading-3').length;
  const imgDom = document.querySelectorAll('.ob-text img.lore-image').length;

  // 通过真实工具栏按钮测试全部折叠 → 应只剩 3 行顶层节点
  const tFold0 = performance.now();
  document.querySelector('button[title="全部折叠"]')?.click();
  await waitFrame();
  const foldedRows = document.querySelectorAll('.ob-row').length;
  const tFold = Math.round(performance.now() - tFold0);

  // 通过真实工具栏按钮测试全部展开 → 恢复 1009 行
  const tUnfold0 = performance.now();
  document.querySelector('button[title="全部展开"]')?.click();
  await waitFrame();
  const unfoldedRows = document.querySelectorAll('.ob-row').length;
  const tUnfold = Math.round(performance.now() - tUnfold0);

  // 关键词搜索压测（侧栏检索框）
  const tSearch0 = performance.now();
  ui.mubuQuery = '叙事空洞';
  await waitFrame();
  const searchRows = document.querySelectorAll('.ob-row').length;
  const searchHits = document.querySelectorAll('.lore-search-result').length;
  const tSearch = Math.round(performance.now() - tSearch0);
  ui.mubuQuery = '';
  await waitFrame();

  // 切换至第 3 个设定集「设定」聚焦
  const settingRoot = work.mubuRoots().find((r) => r.text === '设定');
  ui.navigateLore({ rootId: settingRoot.id, rootPath: [settingRoot.id], scope: 'set', activeId: settingRoot.id, selectedId: settingRoot.id });
  await waitFrame();
  const settingScopeRows = document.querySelectorAll('.ob-row').length;

  // 切回全部条目
  ui.navigateLore({ rootId: null, rootPath: [], scope: 'all', activeId: work.mubuRoots()[0].id, selectedId: work.mubuRoots()[0].id });
  await waitFrame();

  return { allRows, h3Dom, imgDom, foldedRows, tFold, unfoldedRows, tUnfold, searchRows, searchHits, tSearch, settingScopeRows };
})()`)
console.log('A 视图（条目编写）压测结果:', JSON.stringify(viewARes))
assert.equal(viewARes.allRows, 1009, 'A 视图全部条目应渲染 1009 行')
assert.equal(viewARes.h3Dom, 8, 'A 视图应渲染 8 个 heading-3 行')
assert.equal(viewARes.imgDom, 9, 'A 视图应渲染 9 张 img.lore-image')
assert.equal(viewARes.foldedRows, 3, '全部折叠后应仅显示 3 个顶层设定集')
assert.equal(viewARes.unfoldedRows, 1009, '全部展开后应恢复 1009 行')
assert.ok(viewARes.searchHits > 0, '侧栏搜索应命中「叙事空洞」相关节点')
assert.ok(viewARes.settingScopeRows > 50 && viewARes.settingScopeRows < 300, '聚焦「设定」分支后应只显示该分支节点')

// 3B. 设定详情（深层节点面包屑 + 徽章图片详情 + 同级列）
const viewBRes = await c.evalx(`(async () => {
  const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;
  const work = pinia._s.get('work');
  const ui = pinia._s.get('ui');
  const waitFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 120)));

  const live = work.liveMubu();
  const deepNode = live.find((n) => n.text.includes('第一阶段：脱离'));
  const badgeNode = live.find((n) => n.text.includes('局徽：监察之眼'));

  const t0 = performance.now();
  ui.setLoreView('detail', { id: deepNode.id, scroll: 0 });
  await waitFrame();
  const deepTitle = document.querySelector('.lore-h1')?.textContent?.trim() || '';
  const deepPathLen = work.mubuPath(deepNode.id).length;
  const deepSiblings = document.querySelectorAll('.lore-detail-entry').length;
  const deepKids = document.querySelectorAll('.lore-detail-child').length;
  const tDetail = Math.round(performance.now() - t0);

  ui.navigateLore({ activeId: badgeNode.id, selectedId: badgeNode.id });
  await waitFrame();
  const badgeImgs = document.querySelectorAll('.lore-detail .lore-embedded-images img.lore-image').length;
  const badgeProse = document.querySelectorAll('.lore-detail-childprose').length;

  return { deepTitle, deepPathLen, deepSiblings, deepKids, tDetail, badgeImgs, badgeProse };
})()`)
console.log('B 视图（设定详情）压测结果:', JSON.stringify(viewBRes))
assert.ok(viewBRes.deepTitle.includes('第一阶段：脱离'), '详情页应显示深层节点标题')
assert.equal(viewBRes.deepPathLen, 7, '「第一阶段：脱离」应位于第 7 层')
assert.equal(viewBRes.deepSiblings, 3, '同级条目应为三阶段（3 项）')
assert.equal(viewBRes.deepKids, 3, '第一阶段应有 3 个子条目')
assert.equal(viewBRes.badgeImgs, 1, '局徽：监察之眼 详情页应展示 1 张嵌入图片')

// 3C. 视觉导图（层级导图 1009 节点布局 + 关系星系）
const viewCRes = await c.evalx(`(async () => {
  const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;
  const ui = pinia._s.get('ui');
  const waitFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 250)));

  const t0 = performance.now();
  ui.setLoreMapMode('hierarchy');
  ui.setLoreView('map', { scroll: 0 });
  await waitFrame();
  const mapNodes = document.querySelectorAll('.lore-tm-content-node').length;
  const mapEdges = document.querySelectorAll('.lore-tm-edges path').length;
  const tMap = Math.round(performance.now() - t0);

  // 切关系星系
  const t1 = performance.now();
  ui.setLoreMapMode('relations');
  await waitFrame();
  const galaxyCanvas = document.querySelectorAll('.lpn-stage canvas').length;
  const tGalaxy = Math.round(performance.now() - t1);

  // 切回条目编写，保持干净状态
  ui.setLoreView('write', { scroll: 0 });
  await waitFrame();

  return { mapNodes, mapEdges, tMap, galaxyCanvas, tGalaxy };
})()`)
console.log('C 视图（视觉导图 + 关系星系）压测结果:', JSON.stringify(viewCRes))
assert.equal(viewCRes.mapNodes, 1009, '层级导图全展开应渲染 1009 个节点')
assert.equal(viewCRes.mapEdges, 1009, '层级导图应渲染 1009 条连线')
assert.ok(viewCRes.galaxyCanvas >= 1, '关系星系画布应正常挂载')

// 4. 重载持久化核验 + 控制台无报错断言
const persistRes = await c.evalx(`(async () => {
  const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;
  const work = pinia._s.get('work');
  await window.__flushNow?.();
  await work.open(${JSON.stringify(probe.workId)});
  const live = work.liveMubu();
  const roots = work.mubuRoots().map((n) => n.text);
  const byId = new Map(live.map((n) => [n.id, n]));
  let maxDepth = 0;
  let imgs = 0;
  let h3 = 0;
  for (const n of live) {
    let d = 1, cur = n, g = 0;
    while (cur.parentId && g++ < 30) { cur = byId.get(cur.parentId); if (!cur) break; d++; }
    if (d > maxDepth) maxDepth = d;
    if (n.heading === 3) h3++;
    const m = (n.html || '').match(/<img\\b[^>]*class="lore-image"/g);
    if (m) imgs += m.length;
  }
  return { count: live.length, roots, maxDepth, imgs, h3, errors: window.__stressErrors || [] };
})()`)
console.log('重载持久化复核:', JSON.stringify(persistRes))
assert.equal(persistRes.count, 1009, '重开作品后节点数应仍为 1009')
assert.deepEqual(persistRes.roots, ['现实模版', '虚构国度', '设定'])
assert.equal(persistRes.maxDepth, 10, '最大深度应为 10 层')
assert.equal(persistRes.imgs, 9, '9 张徽章图片应持久化保留')
assert.equal(persistRes.h3, 8, '8 个 heading-3 节点应持久化保留')
assert.equal(persistRes.errors.length, 0, '运行期间不应出现未捕获异常：' + JSON.stringify(persistRes.errors))

console.log('\nPASS：《浮世地域集》已严格按层级导入 dev《压力测试》并完成全部设定界面压力验收！')
process.exit(0)
