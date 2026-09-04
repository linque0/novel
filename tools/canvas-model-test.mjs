/* canvas-model 纯逻辑自测（计划书 9.4.1-S3）：布局无重叠 / pin 豁免 / 补位模式 / 容器派生盒 / 模板完整性 */
import { relayoutAll, containerRect, canvasNodeSize, effSize, tplThreeAct, tplChapterList, gridCols, nextShape, cycleArrow, relColor, KIND_META, EDGE_STYLES, dashOf, routeEdge, routeOrthogonal, segHitsRect, sideBetween, pathFromPoints } from '../src/components/outline/canvas-model.js'

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
check('KIND_META 覆盖七类（含文本框）', Object.keys(KIND_META).length === 7 && !!KIND_META.textbox)

/* 7) 自定义尺寸与线型（v0.4.1 界面优化） */
const cs = mk('cs', 'event', { canvasX: 0, canvasY: 0, w: 240, h: 90 })
check('effSize 自定义尺寸优先', effSize(cs).w === 240 && effSize(cs).h === 90)
const csMin = mk('csm', 'event', { canvasX: 0, canvasY: 0, w: 40, h: 10 })
check('effSize 自定义尺寸下限钳制', effSize(csMin).w === 96 && effSize(csMin).h === 36)
check('effSize 无自定义回退基准', effSize(mk('cd', 'event', { canvasX: 0, canvasY: 0 })).w === 178)
const cont2 = mk('cc', 'container', { canvasX: 0, canvasY: 0, w: 500, h: 400 })
const cr2 = containerRect(cont2, [], (n) => ({ x: n.canvasX, y: n.canvasY }), (n) => effSize(n))
check('容器自定义尺寸生效', cr2.w === 500 && cr2.h === 400, JSON.stringify(cr2))
check('线型：显式优先', dashOf('dotted', '因果') === '2 3' && dashOf('solid', '伏笔') === null)
check('线型：未设置时伏笔默认虚线', dashOf('', '伏笔') === '5 4' && dashOf('', '因果') === null)
check('EDGE_STYLES 三种', EDGE_STYLES.length === 3 && EDGE_STYLES.map((s) => s.key).join(',') === 'solid,dashed,dotted')

/* 8) 严格端口连线 + 避障路由（v0.4.14） */
const A = { x: 0, y: 0, w: 100, h: 60 }
const B = { x: 300, y: 0, w: 100, h: 60 }
const fa = { x: 100, y: 30 }
const ta = { x: 300, y: 30 }
const g1 = routeEdge(fa, 'right', ta, 'left', [], 'bezier')
check('端口：bezier 起点即指定端口', g1.d.startsWith('M 100 30') && g1.d.endsWith('300 30'))
check('端口：bezier 不绕行标记', g1.avoided === false)
const g2 = routeEdge(fa, 'right', ta, 'left', [], 'ortho')
check('端口：ortho 起终点即端口', g2.d.startsWith('M 100 30') && g2.d.endsWith('300 30'))
const M = { x: 150, y: 10, w: 100, h: 40 } // 横挡在两节点之间
const g3 = routeEdge(fa, 'right', ta, 'left', [M], 'bezier')
check('避障：途经模块改走折线', g3.avoided === true && g3.d.split('L').length >= 2, g3.d.slice(0, 80))
/* 折线全部线段不得穿过障碍矩形 */
const pts3 = []
const re3 = /([-\d.]+) ([-\d.]+)/g
let mm3
while ((mm3 = re3.exec(g3.d))) pts3.push({ x: +mm3[1], y: +mm3[2] })
let clear3 = true
for (let i = 0; i < pts3.length - 1; i++) {
  if (segHitsRect(pts3[i].x, pts3[i].y, pts3[i + 1].x, pts3[i + 1].y, M)) {
    clear3 = false
    break
  }
}
check('避障：折线逐段不穿模块', clear3, JSON.stringify(pts3))
const g4 = routeEdge(fa, 'right', ta, 'left', [], 'bezier')
check('无障碍时保持贝塞尔', g4.avoided === false && g4.d.includes('C'))
const fa2 = { x: 50, y: 60 }
const ta2 = { x: 350, y: -0 }
const g5 = routeEdge(fa2, 'bottom', { x: 350, y: 0 }, 'top', [], 'ortho')
check('端口：南北向 ortho 起终点正确', g5.d.startsWith('M 50 60') && g5.d.endsWith('350 0'))
check('sideBetween 横向', sideBetween(A, B).from === 'right' && sideBetween(A, B).to === 'left')
check('sideBetween 纵向', sideBetween(A, { x: 0, y: 200, w: 100, h: 60 }).from === 'bottom')
const g6 = routeEdge(fa, 'right', ta, 'left', [], 'ortho')
check('polyMid 在路径范围内', g6.mid.x >= 100 && g6.mid.x <= 300)
check('pathFromPoints 拐圆角 Q 指令', pathFromPoints([{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 50 }]).includes('Q'))

/* 9) 两端节点本体也纳入障碍（v0.4.15）：端口严格后连线不得从节点身上穿过 */
const NA = { x: 0, y: 0, w: 100, h: 60 }
const NB = { x: 0, y: -140, w: 100, h: 60 } // 目标在源正上方
const ptsAB = routeOrthogonal({ x: 100, y: 30 }, 'right', { x: 0, y: -80 }, 'left', [NA, NB])
let clearAB = true
for (let i = 0; i < ptsAB.length - 1; i++) {
  if (segHitsRect(ptsAB[i].x, ptsAB[i].y, ptsAB[i + 1].x, ptsAB[i + 1].y, NA) || segHitsRect(ptsAB[i].x, ptsAB[i].y, ptsAB[i + 1].x, ptsAB[i + 1].y, NB)) {
    clearAB = false
    break
  }
}
check('避障：两端节点本体不被连线穿过', clearAB, JSON.stringify(ptsAB))
check('避障：起止点仍在记录端口上', ptsAB[0].x === 100 && ptsAB[0].y === 30 && ptsAB[ptsAB.length - 1].x === 0 && ptsAB[ptsAB.length - 1].y === -80)
/* 桩长延伸：源节点很宽时桩必须出得了矩形 */
const NW = { x: 0, y: 0, w: 300, h: 60 }
const ptsWide = routeOrthogonal({ x: 300, y: 30 }, 'right', { x: 700, y: 30 }, 'left', [NW], 18, 16)
let clearWide = !segHitsRect(ptsWide[0].x, ptsWide[0].y, ptsWide[1].x, ptsWide[1].y, NW)
check('避障：桩长自动越过宽源节点', clearWide, JSON.stringify(ptsWide.slice(0, 2)))
/* 同一障碍多段命中时外扩不互穿 */
const M2 = { x: 140, y: -40, w: 120, h: 140 } // 高障碍，横竖段都会撞
const ptsM2 = routeOrthogonal({ x: 100, y: 30 }, 'right', { x: 400, y: 30 }, 'left', [M2])
let clearM2 = true
for (let i = 0; i < ptsM2.length - 1; i++) {
  if (segHitsRect(ptsM2[i].x, ptsM2[i].y, ptsM2[i + 1].x, ptsM2[i + 1].y, M2)) {
    clearM2 = false
    break
  }
}
check('避障：高障碍多段绕行不穿越', clearM2, JSON.stringify(ptsM2.map((p) => [p.x, p.y])))

const fail = results.filter((x) => !x).length
console.log('==== ' + (results.length - fail) + '/' + results.length + ' 通过 ====')
process.exit(fail ? 1 : 0)
