import {
  SCOPE_METRICS,
  buildLayerLayout,
  containerCardSize,
  layerNodes,
  packLayer,
  projectRelations,
  scopeConnections,
  scopeCrumbs,
  scopeStats
} from '../src/components/outline/outline-scope.js'

let pass = 0
const ok = (cond, label) => {
  if (!cond) throw new Error('FAIL: ' + label)
  pass++
}
const near = (a, b, label) => ok(Math.abs(a - b) < 0.01, `${label} (${a} != ${b})`)

function node(id, parentId, kind, extra = {}) {
  return { id, parentId, kind, title: id, sortOrder: 0, canvasX: 0, canvasY: 0, text: '', rels: [], ...extra }
}

const rows = [
  node('root-event', null, 'event', { canvasX: 900, status: 'planned' }),
  node('A', null, 'container', { w: 460, canvasX: 40 }),
  node('B', null, 'container', { w: 460, canvasX: 560 }),
  node('a1', 'A', 'event', { canvasX: 60, canvasY: 60, w: 224, h: 154, status: 'done' }),
  node('a2', 'A', 'container', { canvasX: 320, canvasY: 60, w: 460 }),
  node('a2e', 'a2', 'event', { canvasX: 360, canvasY: 120, w: 224, h: 154, status: 'writing' }),
  node('b1', 'B', 'event', { canvasX: 620, canvasY: 60, w: 224, h: 154, status: 'done' })
]
const byId = new Map(rows.map((n) => [n.id, n]))
const entries = [
  { owner: byId.get('a1'), rel: { id: 'r1', toId: 'a2e', kind: '因果', arrows: '->', label: '推进' } },
  { owner: byId.get('a1'), rel: { id: 'r2', toId: 'b1', kind: '伏笔', arrows: '<->', label: '线索' } },
  { owner: byId.get('b1'), rel: { id: 'r3', toId: 'root-event', kind: '关联', arrows: '--' } }
]

/* 层级与面包屑 */
ok(scopeCrumbs(rows, 'a2').map((c) => c.id).join('/') === '/A/a2', 'crumbs root/A/a2')
ok(scopeCrumbs(rows, null).length === 1 && scopeCrumbs(rows, null)[0].title === '全书', 'root crumb')
ok(layerNodes(rows, null).map((n) => n.id).sort().join(',') === 'A,B,root-event', 'root layer')
ok(layerNodes(rows, 'A').map((n) => n.id).join(',') === 'a1,a2', 'A layer')

/* 统计只算事件 */
const rootStats = scopeStats(rows, null)
ok(rootStats.total === 4 && rootStats.done === 2, 'root stats events/done')
ok(rootStats.blocks === 3, 'root nested container count')
const aStats = scopeStats(rows, 'A')
ok(aStats.total === 2 && aStats.done === 1, 'A stats')
ok(!aStats.complete, 'A not complete')

/* 容器卡尺寸：折叠固定，展开按迷你网格增高 */
const collapsed = containerCardSize(rows, byId.get('A'), new Set())
ok(collapsed.w === 460 && collapsed.h === SCOPE_METRICS.collapsedH, 'collapsed container size')
const openA = containerCardSize(rows, byId.get('A'), new Set(['A']))
ok(openA.h === SCOPE_METRICS.collapsedH + 8 + SCOPE_METRICS.miniContainerH, 'A expanded one row')
const openA2 = containerCardSize(rows, byId.get('A'), new Set(['A', 'a2']))
ok(openA2.h > openA.h, 'nested expansion grows parent')

/* 迷你卡布局：两列、容器整行、递归子卡 */
const layout = buildLayerLayout(rows, null, new Set(['A']))
ok(layout.visibleIds.has('A') && layout.visibleIds.has('a1') && layout.visibleIds.has('a2'), 'visible includes mini cards')
ok(!layout.visibleIds.has('a2e'), 'collapsed mini container hides grandchild')
const a1Rect = layout.mini.byId.get('a1').rect
const a2Rect = layout.mini.byId.get('a2').rect
ok(a1Rect.x < a2Rect.x && a1Rect.y === a2Rect.y, 'two-column mini row')
near(a1Rect.w, (460 - SCOPE_METRICS.miniPad * 2 - SCOPE_METRICS.miniGap) / 2, 'mini card width')
const nested = buildLayerLayout(rows, null, new Set(['A', 'a2']))
const nestedA2 = nested.mini.byId.get('a2').rect
const nestedA2e = nested.mini.byId.get('a2e').rect
ok(nestedA2.w === 460 - SCOPE_METRICS.miniPad * 2, 'expanded mini container full width')
ok(nestedA2e.y > nestedA2.y + SCOPE_METRICS.miniContainerH, 'grandchild below mini container header')
ok(nestedA2e.x >= nestedA2.x + SCOPE_METRICS.miniPad, 'grandchild inside mini container')

/* 关系投影：收起时投影到最近祖先；同容器两端收拢为同一点时隐藏 */
const rootCollapsed = buildLayerLayout(rows, null, new Set())
const projected = projectRelations(entries, rows, null, rootCollapsed)
ok(!projected.groups.some((g) => g.relations.some((r) => r.rel.id === 'r1')), 'same-container internal relation hidden')
const g2 = projected.groups.find((g) => g.relations.some((r) => r.rel.id === 'r2'))
ok(g2.from === 'A' && g2.to === 'B', 'cross-container relation projected to A/B')
ok(projected.external.in.size === 0 && projected.external.out.size === 0, 'root has no external endpoints')

const rootOpen = buildLayerLayout(rows, null, new Set(['A']))
const projectedOpen = projectRelations(entries, rows, null, rootOpen)
const g1open = projectedOpen.groups.find((g) => g.relations.some((r) => r.rel.id === 'r1'))
ok(g1open.from === 'a1' && g1open.to === 'a2', 'expanded A exposes a1/a2')
ok(g1open.projectedTo === true, 'a2e projected to a2')

const insideA = buildLayerLayout(rows, 'A', new Set())
const projectedA = projectRelations(entries, rows, 'A', insideA)
const inA = projectedA.groups.find((g) => g.relations.some((r) => r.rel.id === 'r1'))
ok(inA.from === 'a1' && inA.to === 'a2', 'inside A relation visible')
const crossing = projectRelations(entries, rows, 'A', insideA)
ok(crossing.external.out.has('b1'), 'b1 becomes outgoing external')
ok(scopeConnections(entries, rows, 'A').some((c) => c.otherId === 'b1' && c.direction === 'out'), 'scope connections crossing out')

/* 分组与箭头合并 */
const merged = projectRelations([
  { owner: byId.get('a1'), rel: { id: 'm1', toId: 'a2e', kind: '因果', arrows: '--', label: '甲' } },
  { owner: byId.get('a1'), rel: { id: 'm2', toId: 'a2e', kind: '因果', arrows: '<->', label: '' } }
], rows, 'A', insideA)
const group = merged.groups.find((g) => g.from === 'a1' && g.to === 'a2' && g.kind === '因果')
ok(group.relations.length === 2 && group.arrow === '<->' && group.label === '甲', 'grouped relations merge arrow/label')

/* 整理：pin 豁免、换行不越界 */
const packRows = [
  node('p1', null, 'event', { canvasX: 0, canvasY: 0, w: 200, h: 100 }),
  node('p2', null, 'event', { canvasX: 0, canvasY: 200, w: 200, h: 100 }),
  node('p3', null, 'event', { canvasX: 0, canvasY: 400, w: 200, h: 100, pin: true })
]
const packed = packLayer(packRows, null, (n) => ({ w: n.w, h: n.h }), { maxWidth: 400, gapX: 40, gapY: 40 })
ok(packed.positions.has('p1') && packed.positions.has('p2') && !packed.positions.has('p3'), 'pack skips pinned')
ok(packed.positions.get('p1').y !== packed.positions.get('p2').y, 'pack wraps when row is full')

console.log(`outline-scope: ${pass} checks passed`)
