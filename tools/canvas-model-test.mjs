/* canvas-model 纯逻辑自测（计划书 9.4.1-S3）：布局无重叠 / pin 豁免 / 补位模式 / 容器派生盒 / 模板完整性 */
import { relayoutAll, containerRect, canvasNodeSize, effSize, tplThreeAct, tplChapterList, gridCols, nextShape, cycleArrow, relColor, KIND_META } from '../src/components/outline/canvas-model.js'

const results = []
const check = (name, ok, detail = '') => {
  results.push(ok)
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  —— ' + String(detail).slice(0, 240) : ''))
}
const mk = (id, kind, extra = {}) => ({ id, kind, parentId: null, canvasX: null, canvasY: null, shape: 'process', pin: false, sortOrder: 0, ...extra })

/* 1) force 重排：容器+子项+散点全部落位且互不重叠 */
const nodes = [
  mk('c1', 'container', { title: '容器一' }),
  mk('e1', 'event', { parentId: 'c1', sortOrder: 0 }),
  mk('e2', 'event', { parentId: 'c1', sortOrder: 1000 }),
  mk('e3', 'event', { parentId: 'c1', sortOrder: 2000 }),
  mk('c2', 'container', { title: '容器二' }),
  mk('a1', 'anchor', { parentId: 'c2', sortOrder: 0 }),
  mk('n1', 'note'),
  mk('n2', 'note')
]
const pos = relayoutAll({ nodes, force: true })
check('force 全部落位', pos.size === nodes.length, pos.size)
const rects = nodes.map((n) => ({ n, r: { ...pos.get(n.id), w: effSize(n).w, h: effSize(n).h } }))
const parentOf = new Map(nodes.map((n) => [n.id, n.parentId || null]))
const isAncestorOf = (a, b) => {
  let p = parentOf.get(b.id)
  const seen = new Set()
  while (p && !seen.has(p)) {
    if (p === a.id) return true
    seen.add(p)
    p = parentOf.get(p)
  }
  return false
}
let overlap = false
for (let i = 0; i < rects.length; i++)
  for (let j = i + 1; j < rects.length; j++) {
    if (isAncestorOf(rects[i].n, rects[j].n) || isAncestorOf(rects[j].n, rects[i].n)) continue // 容器包含子项属预期
    const A = rects[i].r
    const B = rects[j].r
    if (A.x < B.x + B.w && A.x + A.w > B.x && A.y < B.y + B.h && A.y + A.h > B.y) overlap = true
  }
check('force 布局无矩形重叠', !overlap, JSON.stringify(rects.map((x) => x.r)))
const kidsInGrid = ['e1', 'e2', 'e3'].every((id) => pos.get(id).x > pos.get('c1').x && pos.get(id).y > pos.get('c1').y)
check('容器子项落在容器锚点右下（网格内）', kidsInGrid, JSON.stringify([pos.get('e1'), pos.get('c1')]))

/* 2) pin 豁免：force 不移动 pinned 节点 */
const nodes2 = [mk('p1', 'event', { canvasX: 500, canvasY: 500, pin: true }), mk('p2', 'event', { canvasX: 900, canvasY: 500 })]
const pos2 = relayoutAll({ nodes: nodes2, force: true })
check('force 豁免 pin 节点、重排未 pin', !pos2.has('p1') && pos2.has('p2'), JSON.stringify([...pos2.keys()]))

/* 3) 补位模式：只补无坐标节点，且避让已定位矩形 */
const nodes3 = [
  mk('k1', 'event', { canvasX: 40, canvasY: 40 }),
  mk('k2', 'note'),
  mk('k3', 'container'),
  mk('k4', 'event', { parentId: 'k3' })
]
const pos3 = relayoutAll({ nodes: nodes3, force: false })
check('补位仅处理无坐标节点', pos3.size === 3 && !pos3.has('k1'), JSON.stringify([...pos3.keys()]))
const k2p = pos3.get('k2')
check('补位避让已定位矩形', !(k2p.x < 40 + canvasNodeSize(nodes3[0]).w + 24 && k2p.x + 158 > 40 - 24 && k2p.y < 40 + 54 + 24 && k2p.y + 76 > 40 - 24), JSON.stringify(k2p))
const k4p = pos3.get('k4')
check('补位子项相对容器锚点排布', k4p.x > pos3.get('k3').x && k4p.y > pos3.get('k3').y, JSON.stringify([pos3.get('k3'), k4p]))

/* 4) 容器派生盒：由子项撑开，含标题栏上边距 */
const cont = mk('c', 'container', { canvasX: 100, canvasY: 100 })
const kid = mk('k', 'event', { parentId: 'c', canvasX: 130, canvasY: 150 })
const cr = containerRect(cont, [kid], (n) => ({ x: n.canvasX, y: n.canvasY }), (n) => effSize(n))
check('容器盒覆盖锚点与子项', cr.x <= 100 && cr.y <= 100 && cr.x + cr.w >= 130 + effSize(kid).w && cr.y + cr.h >= 150 + effSize(kid).h, JSON.stringify(cr))
const crEmpty = containerRect(cont, [], (n) => ({ x: n.canvasX, y: n.canvasY }), (n) => effSize(n))
check('空容器用基准尺寸', crEmpty.w === 280 && crEmpty.h === 120, JSON.stringify(crEmpty))

/* 5) 模板完整性：三幕式 / 章级清单 */
const t1 = tplThreeAct()
check('三幕式模板行数与边', t1.rows.length === 11 && t1.edges.length === 3, `rows=${t1.rows.length} edges=${t1.edges.length}`)
check('三幕式边引用有效序号', t1.edges.every((e) => e.from >= 0 && e.from < t1.rows.length && e.to >= 0 && e.to < t1.rows.length && e.from !== e.to))
check('三幕式全部行有坐标', t1.rows.every((r) => r.canvasX != null && r.canvasY != null))
check('三幕式父级挂接（_parent 指向容器且容器在前）', t1.rows.every((r, i) => r._parent == null || (r._parent < i && t1.rows[r._parent].kind === 'container')) && t1.rows.filter((r) => r.kind === 'container').every((c) => t1.rows.filter((r) => r._parent === t1.rows.indexOf(c)).length >= 2))
const chapters = Array.from({ length: 5 }, (_, i) => ({ id: 'ch' + i, title: '第' + (i + 1) + '章' }))
const t2 = tplChapterList(chapters)
check('章级清单模板（有章）锚点数与挂接', t2.rows.filter((r) => r.kind === 'anchor').length === 5 && t2.rows[0].kind === 'container' && t2.rows.filter((r) => r.kind === 'anchor').every((r) => r._parent === 0))
const t3 = tplChapterList([])
check('章级清单模板（无章）占位事件', t3.rows.filter((r) => r.kind === 'event').length === 6 && t3.rows.filter((r) => r.kind === 'event').every((r) => r._parent === 0))

/* 6) 杂项 */
check('gridCols 边界', gridCols(0) === 1 && gridCols(1) === 1 && gridCols(3) === 2 && gridCols(9) === 3 && gridCols(20) === 3)
check('形状/箭头循环', nextShape('ellipse') === 'process' && cycleArrow('--') === '->' && relColor('伏笔') === '#8e44ad')
check('KIND_META 覆盖六类', Object.keys(KIND_META).length === 6)

const fail = results.filter((x) => !x).length
console.log('==== ' + (results.length - fail) + '/' + results.length + ' 通过 ====')
process.exit(fail ? 1 : 0)
