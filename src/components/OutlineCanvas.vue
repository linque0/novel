<!-- 大纲自由模块画布（8.8.2 v0.4.1）：流程图式白板——事件/便签/引用卡/容器/章节锚点自由摆位，
     四向锚点拖线（因果/伏笔/冲突/关联 + 箭头 + 标签）、贝塞尔/正交折线、网格吸附、双密度、断线检测、
     双链卫星与悬停预览（复用全局 DLinkPopover）、骨架模板快速开始；布局数学在 outline/canvas-model.js -->
<script setup>
import { computed, ref, reactive, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useWorkStore } from '../stores/work'
import { usePanZoom, arrowHeadDir, anchorsOf } from '../services/graphview'
import { parseTokens, findByTitle, targetById, parseTarget, jumpTo, KIND_LABEL } from '../services/doublelinks'
import {
  relayoutAll, containerRect, effSize, freeSpotFor,
  relColor, relDashed, cycleArrow, nextShape, SHAPE_LABEL,
  REL_KINDS, KIND_META, tplThreeAct, tplChapterList, dashOf, EDGE_STYLES, EDGE_COLORS, edgeColor,
  sideBetween, routeEdge, pointAtT, trimEdgeD, customEdgeGeom
} from './outline/canvas-model'
import { uid } from '../db/database'
import { autosave } from '../services/autosave'
import { NPopover, NSlider } from 'naive-ui'
import OIcon from './OIcon.vue'
import DLinkPicker from './DLinkPicker.vue'

const work = useWorkStore()
const canvasEl = ref(null)
const { zoom, tx, ty, innerStyle, onWheel, onPanStart, fit: fitTo, centerOn } = usePanZoom(canvasEl)

const dragPos = reactive(new Map()) // 拖动中的临时坐标（mouseup 统一落库）
const dragSize = reactive(new Map()) // 拖拽调整大小时的临时尺寸
const editText = ref(null) // { id, value } 模块内行内文本编辑
const inlineEl = ref(null)
const connecting = ref(null) // { fromId, x, y } 锚点拖线临时态
const edgeEdit = ref(null) // { ownerId, relId, mx, my } 边编辑浮层
const citePick = ref(null) // { nodeId } 引用卡目标选择浮层
const editTitle = ref(null) // { id, value } 容器标题原位编辑
const flashIds = reactive(new Set())
const STATUS_LABEL = { draft: '草稿', done: '完成', revise: '待修改' }
const PALETTE = ['#c0392b', '#2980b9', '#27ae60', '#8e44ad', '#d35400', '#16a085', '#b8860b']

/* ---------- 基础几何 ---------- */
const live = computed(() => work.liveOlnodes())
const nodeById = (id) => live.value.find((n) => n.id === id)
const posOf = (n) => dragPos.get(n.id) || (n.canvasX != null ? { x: n.canvasX, y: n.canvasY } : null)
const sizeOf = (n) => dragSize.get(n.id) || effSize(n, work.canvasPrefs.density)
const kidsOf = (n) => live.value.filter((k) => k.parentId === n.id)

/* 被折叠容器隐藏的后代（渲染与连线一律跳过） */
const hiddenIds = computed(() => {
  const hide = new Set()
  for (const n of live.value) {
    let p = n.parentId
    const seen = new Set()
    while (p && !seen.has(p)) {
      const pn = nodeById(p)
      if (!pn) break
      if (pn.fold) {
        hide.add(n.id)
        break
      }
      seen.add(p)
      p = pn.parentId
    }
  }
  return hide
})

const visNodes = computed(() => live.value.filter((n) => n.canvasX != null && !hiddenIds.value.has(n.id)))
/* 拖拽中的子树：容器的派生盒计算将其排除，否则盒子跟着子模块扩张，永远拖不出容器；
 * 拖的是容器本身时不排除（否则容器拖动时会被自己的子孙撑空塌陷） */
const draggingId = ref(null)
const draggingSubtree = computed(() => {
  const n = draggingId.value ? nodeById(draggingId.value) : null
  if (!n || n.kind === 'container') return new Set()
  return new Set([n.id, ...work.olnodeDescendants(n.id).map((d) => d.id)])
})
const containerBoxes = computed(() => {
  const m = new Map()
  const sub = draggingSubtree.value
  for (const n of visNodes.value) {
    if (n.kind !== 'container') continue
    m.set(n.id, containerRect(n, visNodes.value.filter((k) => k.parentId === n.id && !sub.has(k.id)), posOf, sizeOf))
  }
  return m
})
const rectOf = (n) => (n.kind === 'container' ? containerBoxes.value.get(n.id) : { ...posOf(n), ...sizeOf(n) })

/* ---------- 连线集合与双链卫星 ---------- */
const edges = computed(() => {
  const out = []
  for (const n of visNodes.value) {
    for (const r of work.olnodeRelsOf(n.id)) {
      /* 接连接点的连线 toId 为空，跳过目标节点守卫（几何由 edgeGeomFor 从宿主连线派生） */
      if (!r.toJunction) {
        const m = nodeById(r.toId)
        if (!m || !posOf(m) || hiddenIds.value.has(m.id)) continue
      }
      const g = edgeGeomFor(n, r)
      if (!g) continue
      /* 箭头端回缩：线画到箭头三角形底边为止（dTrim），箭头尖顶在真实端点——既不穿进三角内部、也不留缝。
       * 回缩量 = 三角底边深度 size·cos(0.42)（arrowHeadDir 的翼张角）+ 半个线宽（粗线线端面藏进三角内部，不露头） */
      const arrows = r.arrows || '->'
      const arrowTrim = (rel) => 7 * relArrowScale(rel) * Math.cos(0.42) + (relEdgeWidth(rel) / 2) * 0.8
      const dTrim = r.toJunction
        ? trimEdgeD(g, arrows === '<->' ? arrowTrim(r) : 0, arrows !== '--' ? arrowTrim(r) : 0)
        : trimEdgeD(g, arrows !== '--' ? arrowTrim(r) : 0, arrows === '<->' ? arrowTrim(r) : 0)
      out.push({ key: r.id, ownerId: n.id, rel: r, ...g, dTrim, color: edgeColor(r), dashed: relDashed(r.kind) })
      /* 从连接点引出的连线（宿主 rel._out）：连接点作起点，终点为普通模块或另一连接点（v1.0.15 线连到线） */
      for (const r2 of r._out || []) {
        if (!r2.toJunction) {
          const m2 = nodeById(r2.toId)
          if (!m2 || !posOf(m2) || hiddenIds.value.has(m2.id)) continue
        }
        const g2 = edgeGeomFromJunction(n, r, r2)
        if (!g2) continue
        const a2 = r2.arrows || '->'
        const dTrim2 = trimEdgeD(g2, a2 !== '--' ? 7 * relArrowScale(r2) * Math.cos(0.42) + (relEdgeWidth(r2) / 2) * 0.8 : 0, 0)
        out.push({ key: r2.id, ownerId: n.id, rel: { ...r2, kind: r2.kind || r.kind }, ...g2, dTrim: dTrim2, color: edgeColor(r2), dashed: relDashed(r2.kind) })
      }
    }
  }
  return out
})
/* v0.4.15 严格端口：从哪个接口来就从哪个接口出，接入侧同样在建立时记录（toSide）；
 * 旧连线缺端口记录时按首次渲染位置**一次性补记**（此后不再随挪位重算）；
 * 连线途经任何模块（含两端节点本体）时正交绕行。
 * v1.0.13：连线可接到「连接点」（挂在另一条连线 rel.junctions 上）——端点取
 * 宿主连线路径参数 t 处的点，由 pointAtT 实时派生，宿主怎么挪点都钉在线上。 */
const migratedSides = new Set()
function edgeGeomFor(n, r) {
  let to = null
  let toSide = r.toSide
  let toNode = null
  if (r.toJunction) {
    const g = hostJunctionGeom(r.toJunction)
    if (!g) return null
    to = g.point
    toSide = g.side
  } else {
    toNode = nodeById(r.toId)
    if (!toNode || !posOf(toNode)) return null
  }
  const A = rectOf(n)
  const B = toNode ? rectOf(toNode) : { x: to.x - 1, y: to.y - 1, w: 2, h: 2 }
  const sb = sideBetween(A, B)
  const fromSide = r.fromSide || sb.from
  /* 缺端口记录的旧连线/模板连线按当前几何回退（toSide 留空表示未补记，连接点连线不落库） */
  if (!toSide) toSide = sb.to
  if (toNode) to = anchorsOf(B)[toSide]
  if ((!r.fromSide || !r.toSide) && toNode && !migratedSides.has(r.id)) {
    migratedSides.add(r.id)
    work.olnodeRelUpdate(n.id, r.id, { fromSide, toSide })
  }
  const from = anchorsOf(A)[fromSide]
  if (!from || !to || !toSide) return null
  /* v1.0.16 左键拖拽塑形：有 custom 控制点时走自定义弯曲（垂距过近 = 拉直回退自动路由） */
  if (r.custom) {
    const g = customEdgeGeom(from, to, r.custom)
    if (g) return g
  }
  const obstacles = [
    { x: A.x, y: A.y, w: A.w, h: A.h },
    ...(toNode ? [{ x: B.x, y: B.y, w: B.w, h: B.h }] : []),
    ...edgeObstacles(n.id, toNode?.id)
  ]
  /* 接连接点的连线零桩直出：从连接点中心（即宿主连线上）出发，视觉无缝衔接 */
  return r.toJunction
    ? routeEdge(to, toSide, from, fromSide, obstacles, work.canvasPrefs.edgeStyle, 0)
    : routeEdge(from, fromSide, to, toSide, obstacles, work.canvasPrefs.edgeStyle)
}
/* 宿主连线上的连接点几何：位置 = pointAtT(host, t)；端口朝向取连接点附近路径切线方向，
 * 保证新线沿宿主连线走向出发，衔接处不拐直角弯。
 * 宿主几何直接重算（edgeGeomFor），禁止读 edges.value——computed 内自引用会死循环 */
function hostJunctionGeom(ref) {
  const hostNode = nodeById(ref.ownerId)
  if (!hostNode) return null
  const hostRel = (hostNode.rels || []).find((r0) => r0.id === ref.relId)
  if (!hostRel) return null
  const j = (hostRel.junctions || []).find((x) => x.id === ref.junctionId)
  if (!j) return null
  const host = edgeGeomFor(hostNode, hostRel)
  if (!host) return null
  const p0 = pointAtT(host, Math.max(0, j.t - 0.02))
  const p1 = pointAtT(host, Math.min(1, j.t + 0.02))
  if (!p0 || !p1) return null
  const dx = p1.x - p0.x
  const dy = p1.y - p0.y
  const side = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'right' : 'left') : dy >= 0 ? 'bottom' : 'top'
  return { point: pointAtT(host, j.t), side }
}
/* 从连接点引出的连线（v1.0.13）：起点 = 宿主连线路径上的连接点，终点 = 目标节点端口。
 * v1.0.15：终点也可以是另一条连线上的连接点（r.toJunction，线连到线）——两端都钉在各自宿主上。
 * 起点零桩直出、方向沿宿主连线切线，与所在连线无缝衔接。
 * 注意：宿主几何直接用 edgeGeomFor 重算，禁止回读 edges.value（computed 自引用会死循环卡死画布） */
function edgeGeomFromJunction(hostNode, hostRel, r) {
  const j = (hostRel.junctions || []).find((x) => x.id === r.fromJunction.junctionId)
  if (!j) return null
  const hostG = edgeGeomFor(hostNode, hostRel)
  if (!hostG) return null
  const p0 = pointAtT(hostG, Math.max(0, j.t - 0.02))
  const p1 = pointAtT(hostG, Math.min(1, j.t + 0.02))
  if (!p0 || !p1) return null
  const dx = p1.x - p0.x
  const dy = p1.y - p0.y
  const side = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'right' : 'left') : dy >= 0 ? 'bottom' : 'top'
  const start = pointAtT(hostG, j.t)
  /* 终点为连接点：位置/朝向由目标宿主连线路径派生 */
  if (r.toJunction) {
    const g2 = hostJunctionGeom(r.toJunction)
    if (!g2) return null
    if (r.custom) {
      const g3 = customEdgeGeom(start, g2.point, r.custom)
      if (g3) return g3
    }
    return routeEdge(start, side, g2.point, g2.side, edgeObstacles(hostNode.id, null), work.canvasPrefs.edgeStyle, 0)
  }
  const m = nodeById(r.toId)
  if (!m || !posOf(m)) return null
  const B = rectOf(m)
  const toSide = r.toSide || sideBetween({ x: start.x - 1, y: start.y - 1, w: 2, h: 2 }, B).to
  const to = anchorsOf(B)[toSide]
  if (r.custom) {
    const g3 = customEdgeGeom(start, to, r.custom)
    if (g3) return g3
  }
  const obstacles = [
    { x: B.x, y: B.y, w: B.w, h: B.h },
    ...edgeObstacles(hostNode.id, m.id)
  ]
  return routeEdge(start, side, to, toSide, obstacles, work.canvasPrefs.edgeStyle, 0)
}
/* 障碍集合：除两端节点外的可见模块矩形；容器仅当两端都在其外时才算障碍（子模块边必然穿越所在容器） */
function edgeObstacles(fromId, toId) {
  const out = []
  for (const n of visNodes.value) {
    if (n.id === fromId || n.id === toId) continue
    if (n.kind === 'container' && (insideContainer(fromId, n.id) || insideContainer(toId, n.id))) continue
    const r = rectOf(n)
    if (r) out.push({ x: r.x, y: r.y, w: r.w, h: r.h })
  }
  return out
}
function insideContainer(nodeId, cid) {
  let cur = nodeById(nodeId)
  while (cur) {
    if (cur.id === cid) return true
    cur = cur.parentId ? nodeById(cur.parentId) : null
  }
  return false
}
/* 箭头三角形：按 rel.arrows 在两端生成；单条连线可经 rel.edgeWidth / rel.arrowScale 覆盖画布全局设置 */
const relEdgeWidth = (rel) => rel?.edgeWidth || work.canvasPrefs.edgeWidth || 1.8
const relArrowScale = (rel) => rel?.arrowScale || work.canvasPrefs.arrowSize || 1
const edgeDecor = computed(() => {
  const heads = []
  const fills = []
  for (const e of edges.value) {
    const a = e.rel.arrows || '->'
    /* 几何方向判别（v1.0.16 修正倒错）：
     * - 普通连线 / 从连接点引出的 _out 连线（fromJunction，起点=连接点）：正常方向，箭头在 e.b（接入端）
     * - 模块→连接点的连线（仅 toJunction 无 fromJunction）：路由时 to 在前，几何反转，箭头在 e.a */
    const reversed = !!e.rel.toJunction && !e.rel.fromJunction
    const tip = reversed ? e.a : e.b
    const dir = reversed ? e.startDir : e.endDir
    const tail = reversed ? e.b : e.a
    const tdir = reversed ? e.endDir : e.startDir
    if (a === '->' || a === '<->') {
      heads.push(arrowHeadDir(tip.x, tip.y, dir, 7 * relArrowScale(e.rel)))
      fills.push(e.color)
    }
    if (a === '<->') {
      heads.push(arrowHeadDir(tail.x, tail.y, tdir, 7 * relArrowScale(e.rel)))
      fills.push(e.color)
    }
  }
  return { heads, fills }
})
const sats = computed(() => {
  const out = []
  for (const n of visNodes.value) {
    if (!['event', 'note', 'anchor', 'container', 'textbox'].includes(n.kind)) continue
    const p = posOf(n)
    const s = sizeOf(n)
    parseTokens(n.text || '').forEach((t, i) => {
      out.push({
        key: n.id + ':' + t.start,
        x: p.x + 2,
        y: p.y + s.h + 6 + i * 26,
        display: t.display || t.title,
        title: t.title,
        resolved: findByTitle(t.title)
      })
    })
  }
  return out
})
const bounds = computed(() => {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  const eat = (r) => {
    if (!r) return
    x0 = Math.min(x0, r.x)
    y0 = Math.min(y0, r.y)
    x1 = Math.max(x1, r.x + r.w)
    y1 = Math.max(y1, r.y + r.h)
  }
  for (const n of visNodes.value) eat(rectOf(n))
  for (const s of sats.value) eat({ x: s.x, y: s.y, w: 150, h: 22 })
  if (x0 === Infinity) return { x: 0, y: 0, w: 600, h: 400 }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
})
/* 连线层视口：模块可拖到原点左侧/上方（负坐标），包围盒向左/上收缩时
 * 若视口仍从 (0,0) 起算会裁掉连线——改为覆盖负象限并四周留余量 */
const svgBox = computed(() => {
  const b = bounds.value
  const x0 = Math.min(0, b.x - 400)
  const y0 = Math.min(0, b.y - 400)
  const x1 = Math.max(2400, b.x + b.w + 400)
  const y1 = Math.max(1600, b.y + b.h + 400)
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
})

/* ---------- 落位 / 视图 ---------- */
function applyPositions(map) {
  for (const [id, p] of map) work.olnodeSetCanvas(id, p.x, p.y)
}
function ensurePlaced() {
  applyPositions(relayoutAll({ nodes: live.value, density: work.canvasPrefs.density, force: false }))
}
function tidyAll() {
  applyPositions(relayoutAll({ nodes: live.value, density: work.canvasPrefs.density, force: true }))
  dragPos.clear()
  nextTick(fitView)
}
function fitView() {
  fitTo(bounds.value)
}
function setPref(k, v) {
  work.canvasPrefs[k] = v
  work.saveCanvasPrefs()
}
const edgeWidthModel = computed({
  get: () => work.canvasPrefs.edgeWidth || 1.8,
  set: (v) => setPref('edgeWidth', v)
})
const arrowSizeModel = computed({
  get: () => work.canvasPrefs.arrowSize || 1,
  set: (v) => setPref('arrowSize', v)
})
function snap(v) {
  return work.canvasPrefs.snap ? Math.round(v / 16) * 16 : Math.round(v)
}
function canvasPt(e) {
  const r = canvasEl.value.getBoundingClientRect()
  return { x: (e.clientX - r.left - tx.value) / zoom.value, y: (e.clientY - r.top - ty.value) / zoom.value }
}
function hitNodeAt(pt, exclude = new Set()) {
  // 命中优先子模块：容器有子模块时，只有落在空白区（非正文区）才轮到容器，避免拖线误锚容器
  for (const n of [...visNodes.value].reverse()) {
    if (exclude.has(n.id)) continue
    const r = rectOf(n)
    if (r && pt.x >= r.x && pt.x <= r.x + r.w && pt.y >= r.y && pt.y <= r.y + r.h) return n
  }
  return null
}
function hitConnTarget(pt, exclude = new Set()) {
  // 拖线目标优先命中子模块（事件/便签/引用卡/锚点/卷），其次无子模块的容器
  const nodes = [...visNodes.value].reverse()
  for (const n of nodes) {
    if (exclude.has(n.id) || n.kind === 'container') continue
    const r = rectOf(n)
    if (r && pt.x >= r.x && pt.x <= r.x + r.w && pt.y >= r.y && pt.y <= r.y + r.h) return n
  }
  for (const n of nodes) {
    if (exclude.has(n.id)) continue
    const r = rectOf(n)
    if (r && pt.x >= r.x && pt.x <= r.x + r.w && pt.y >= r.y && pt.y <= r.y + r.h) return n
  }
  return null
}

/* ---------- 节点拖动（容器连带后代；落点几何归组） ---------- */
function onNodeDown(e, n) {
  if (e.button !== 0) return
  if (e.target.closest('button, input, textarea, a, .oc-apt, .oc-mini, .oc-rs')) return
  e.stopPropagation()
  work.selOlnodeId = n.id
  closeFloaters()
  const group = n.kind === 'container' ? [n, ...work.olnodeDescendants(n.id)] : [n]
  draggingId.value = n.id
  const start = { mx: e.clientX, my: e.clientY, origins: group.map((g) => ({ id: g.id, x: g.canvasX ?? 0, y: g.canvasY ?? 0 })) }
  let moved = false
  const move = (ev) => {
    const dx = (ev.clientX - start.mx) / zoom.value
    const dy = (ev.clientY - start.my) / zoom.value
    if (Math.abs(dx) + Math.abs(dy) > 2) moved = true
    for (const o of start.origins) dragPos.set(o.id, { x: snap(o.x + dx), y: snap(o.y + dy) })
  }
  const up = (ev) => {
    window.removeEventListener('mousemove', move)
    window.removeEventListener('mouseup', up)
    draggingId.value = null
    const dropPt = canvasPt(ev)
    for (const o of start.origins) {
      const p = dragPos.get(o.id)
      if (p) work.olnodeSetCanvas(o.id, p.x, p.y)
    }
    dragPos.clear()
    if (moved && n.kind !== 'container') reparentAfterDrop(n, dropPt)
  }
  window.addEventListener('mousemove', move)
  window.addEventListener('mouseup', up)
}
/* 拖入即归组：落点中心命中容器 → 改父；拖出容器外 → 回到根。
 * 判定用「排除被拖子树」的容器盒：否则盒子随节点一起扩张，永远判定在容器内 */
function reparentAfterDrop(n, pt) {
  const p = posOf(n)
  if (!p) return
  const cx = p.x + sizeOf(n).w / 2
  const cy = p.y + sizeOf(n).h / 2
  const desc = new Set(work.olnodeDescendants(n.id).map((d) => d.id))
  const curParent = n.parentId || null
  const boxOf = (c) =>
    containerRect(
      c,
      visNodes.value.filter((k) => k.parentId === c.id && k.id !== n.id && !desc.has(k.id)),
      posOf,
      sizeOf
    )
  const inBox = (box) => box && cx >= box.x && cx <= box.x + box.w && cy >= box.y && cy <= box.y + box.h
  let landed = null
  for (const c of [...visNodes.value].reverse()) {
    if (c.kind !== 'container' || c.id === n.id || desc.has(c.id)) continue
    if (inBox(boxOf(c))) {
      landed = c
      break
    }
  }
  if (landed && landed.id !== curParent) {
    work.olnodeMoveTo(n.id, landed.id)
    return
  }
  if (!landed && curParent) {
    const own = nodeById(curParent)
    const box = own && own.kind === 'container' ? boxOf(own) : null
    if (!inBox(box)) work.olnodeMoveTo(n.id, null)
  }
}

/* ---------- 模块八向边缘拖拽调整大小（n/w 方向同步移动原点；拖拽中短过渡实时跟手，落库取整） ---------- */
const resizing = ref(false)
const resizeSmooth = ref(false) // 容器大盒子：调整过程用过渡动画平滑跟随鼠标
function startResize(e, n, dir) {
  if (e.button !== 0) return
  e.stopPropagation()
  e.preventDefault()
  resizing.value = n.id
  resizeSmooth.value = n.kind === 'container'
  const base = { ...(dragSize.get(n.id) || effSize(n, work.canvasPrefs.density)) }
  const p0 = { x: n.canvasX ?? 0, y: n.canvasY ?? 0 }
  const mx = e.clientX
  const my = e.clientY
  /* 拖拽方向决定可变轴：未拖的轴保持原值不落库（否则横拖会把高度钉死在当前值） */
  const canW = dir.includes('e') || dir.includes('w')
  const canH = dir.includes('n') || dir.includes('s')
  const apply = (ev) => {
    const dx = (ev.clientX - mx) / zoom.value
    const dy = (ev.clientY - my) / zoom.value
    let w = base.w
    let h = base.h
    let x = p0.x
    let y = p0.y
    if (dir.includes('e')) w = Math.max(96, base.w + dx)
    if (dir.includes('s')) h = Math.max(36, base.h + dy)
    if (dir.includes('w')) {
      w = Math.max(96, base.w - dx)
      x = p0.x + (base.w - w)
    }
    if (dir.includes('n')) {
      h = Math.max(36, base.h - dy)
      y = p0.y + (base.h - h)
    }
    dragSize.set(n.id, { w, h })
    if (dir.includes('w') || dir.includes('n')) dragPos.set(n.id, { x: Math.round(x), y: Math.round(y) })
  }
  apply(e)
  const move = (ev) => apply(ev)
  const up = () => {
    window.removeEventListener('mousemove', move)
    window.removeEventListener('mouseup', up)
    const p = dragSize.get(n.id)
    const pos = dragPos.get(n.id)
    dragSize.delete(n.id)
    dragPos.delete(n.id)
    resizing.value = false
    resizeSmooth.value = false
    if (pos) work.olnodeSetCanvas(n.id, pos.x, pos.y)
    if (p) work.olnodeSetSize(n.id, canW ? p.w : n.w, canH ? p.h : n.h)
  }
  window.addEventListener('mousemove', move)
  window.addEventListener('mouseup', up)
}

/* ---------- 容器右键色彩快捷栏（v0.4.2） ---------- */
const ctxMenu = ref(null) // { x, y, nodeId }
/* 空白右键（v0.4.9）：在右键落点选建各模块（锚点/卷需选章节/卷参数，不在菜单内） */
const blankCtx = ref(null) // { x, y, px, py }  px/py = 画布坐标落点
/* 连线右键（v1.0.17）：直接打开编辑浮层（含「在此处创建连接点」）——右键落点记录用于连接点定位 */
const edgeCtx = ref(null) // { x, y, ownerId, relId, px, py }  屏幕坐标 + 画布落点
function openEdgeCtxFromEvent(e, edge) {
  const pt = canvasPt(e)
  /* 浮层锚定连线中点，但保留右键落点供「创建连接点」精确定位 */
  edgeCtx.value = { x: e.clientX, y: e.clientY, ownerId: edge.ownerId, relId: edge.rel.id, px: pt.x, py: pt.y }
  openEdgeEdit(edge.ownerId, edge.rel.id, edge)
}
const CREATE_KINDS = Object.fromEntries(Object.entries(KIND_META).filter(([k]) => k !== 'anchor' && k !== 'volume'))
function onCanvasCtx(e) {
  /* Chromium 对 SVG pointer-events:stroke 路径的 contextmenu 命中可能与 mousedown 不一致
     （mousedown 命中路径，contextmenu 却派发给画布）——用 elementFromPoint 反查真实落点 */
  const t = document.elementFromPoint(e.clientX, e.clientY)
  const hitEl = t && (t.classList?.contains('oc-edge-hit') ? t : t.closest?.('.oc-edge-hit'))
  if (hitEl && hitEl.dataset.owner && hitEl.dataset.rel) {
    const edge = edges.value.find((x) => x.ownerId === hitEl.dataset.owner && x.rel.id === hitEl.dataset.rel)
    if (edge) openEdgeCtxFromEvent(e, edge)
    return
  }
  if (e.target.closest?.('.oc-node, .oc-elabel, .oc-edge-hit, .oc-eedit, .rg-eedit, .oc-ctx')) return // 节点/连线/标签/浮层/菜单上不弹创建菜单（容器右键走调色板，连线右键开编辑浮层）
  const pt = canvasPt(e)
  blankCtx.value = { x: e.clientX, y: e.clientY, px: pt.x, py: pt.y }
}
function onWheelC(e) {
  blankCtx.value = null
  onWheel(e)
}
function createAt(kind) {
  const st = blankCtx.value
  blankCtx.value = null
  if (!st) return
  addNodeAt(kind, { x: st.px, y: st.py }, kind === 'note' ? { title: '新便签' } : {})
}
/* Delete 键删除选中模块（输入态不劫持） */
function onKey(e) {
  if (e.key === 'Escape') {
    ctxMenu.value = null
    blankCtx.value = null
    edgeCtx.value = null
    juncCtx.value = null
    edgeEdit.value = null
    return
  }
  const t = e.target
  if (t && (t.matches?.('input, textarea, [contenteditable="true"]') || t.isContentEditable)) return
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (editTitle.value || editText.value || edgeEdit.value || connecting.value || citePick.value) return
    if (work.selOlnodeId && visNodes.value.some((n) => n.id === work.selOlnodeId)) {
      e.preventDefault()
      work.olnodeRemove(work.selOlnodeId)
      work.selOlnodeId = null
    }
    return
  }
  if (!(e.ctrlKey || e.metaKey)) return
  const k = e.key.toLowerCase()
  if (k === 'z' && !e.shiftKey) {
    e.preventDefault()
    work.olnodeUndo()
  } else if (k === 'y' || (k === 'z' && e.shiftKey)) {
    e.preventDefault()
    work.olnodeRedo()
  }
}function onNodeCtx(e, n) {
  e.preventDefault()
  work.selOlnodeId = n.id
  ctxMenu.value = { x: e.clientX, y: e.clientY, nodeId: n.id }
}
function applyColor(c) {
  if (ctxMenu.value) work.olnodeSetColor(ctxMenu.value.nodeId, c)
}
const ctxNode = computed(() => (ctxMenu.value ? visNodes.value.find((n) => n.id === ctxMenu.value.nodeId) : null))
function ctxAct(kind) {
  const n = ctxNode.value
  if (!n) return
  if (kind === 'shape') work.olnodeSetShape(n.id, nextShape(n.shape))
  else if (kind === 'mtype') cycleMtype(n)
  else if (kind === 'pin') work.olnodeSetPin(n.id, !n.pin)
  else if (kind === 'edit') {
    ctxMenu.value = null
    startInlineEdit(n)
    return
  } else if (kind === 'remove') {
    ctxMenu.value = null
    onRemove(n)
    return
  }
  /* 形状/类型/固定保持菜单开启，便于连续调整 */
}
function startInlineEdit(n) {
  editText.value = { id: n.id, value: n.text || '' }
  nextTick(() => {
    const el = inlineEl.value
    if (el) {
      el.focus()
      el.setSelectionRange(el.value.length, el.value.length)
    }
  })
}
function commitInline() {
  const st = editText.value
  editText.value = null
  if (st) work.olnodeSetRich(st.id, st.value, null)
}

/* ---------- 锚点拖线建边（从拖出的接口出发，fromSide 随边存储） ---------- */
/* ---------- 连接点：右键投影 + 创建（v1.0.13 推倒重建） ---------- */
/* 画布点到连线路径的最近点：先沿真实几何（折线 pts / 贝塞尔 c1c2）采样，再逐段投影。
 * 返回 { point, t }——t 为路径参数，连接点按 t 钉在宿主连线上。 */
function projectOnEdge(pt, e) {
  const points = []
  const N = 64
  if (e.pts && e.pts.length > 1) {
    for (const p of e.pts) points.push(p)
  } else if (e.c1 && e.c2) {
    for (let i = 0; i <= N; i++) points.push(pointAtT(e, i / N))
  } else {
    for (let i = 0; i <= N; i++) points.push({ x: e.a.x + (e.b.x - e.a.x) * (i / N), y: e.a.y + (e.b.y - e.a.y) * (i / N) })
  }
  let best = null
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const l2 = dx * dx + dy * dy || 1
    let s = ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / l2
    s = Math.max(0, Math.min(1, s))
    const q = { x: a.x + dx * s, y: a.y + dy * s }
    const dist = Math.hypot(pt.x - q.x, pt.y - q.y)
    if (!best || dist < best.dist) best = { point: q, dist, seg: i, segT: s }
  }
  if (!best) return { point: pt, t: 0.5, dist: Infinity }
  const t = (best.seg + best.segT) / (points.length - 1)
  return { point: best.point, t: Math.max(0, Math.min(1, t)), dist: best.dist }
}
/* 编辑浮层内「在此处创建连接点」：在右键落点对应的路径参数处直接建（浮层保持开启） */
function edgeCtxCreate() {
  const st = edgeCtx.value
  if (!st) return
  const e = edges.value.find((x) => x.ownerId === st.ownerId && x.rel.id === st.relId)
  if (!e) return
  const { t } = projectOnEdge({ x: st.px, y: st.py }, e)
  work.olnodeJunctionAdd(st.ownerId, st.relId, t)
}
/* 连接点右键：仅删除（创建只来自连线右键） */
const juncCtx = ref(null) // { x, y, ownerId, relId, junctionId }
function openJunctionCtx(e, j) {
  juncCtx.value = { x: e.clientX, y: e.clientY, ownerId: j.ownerId, relId: j.relId, junctionId: j.junctionId }
}
function juncCtxRemove() {
  const st = juncCtx.value
  juncCtx.value = null
  if (st) work.olnodeJunctionRemove(st.ownerId, st.relId, st.junctionId)
}
/* 连接点渲染集合：宿主连线 × junctions → SVG 层小圆点 + 命中热区；
 * bornAt（创建 1.6s 内）驱动 flash 高亮态——加深显形方便确认位置，随后淡出隐藏 */
const juncFlashTick = ref(0)
let juncFlashTimer = null // 驱动 bornAt 高亮过期重算（挂载期轮询，卸载即停）
const junctionItems = computed(() => {
  void juncFlashTick.value
  const now = Date.now()
  const out = []
  for (const e of edges.value) {
    for (const j of e.rel.junctions || []) {
      const p = pointAtT(e, j.t)
      if (p) out.push({ key: j.id, ownerId: e.ownerId, relId: e.rel.id, junctionId: j.id, x: p.x, y: p.y, flash: now - (j.bornAt || 0) < 1600 })
    }
  }
  return out
})
/* 拖线落点命中连接点（热区 12px）：返回 { ownerId, relId, junctionId } */
function hitJunctionAt(pt, excludeFromId) {
  for (const j of junctionItems.value) {
    const owner = nodeById(j.ownerId)
    if (owner && owner.id === excludeFromId) continue
    if (Math.hypot(pt.x - j.x, pt.y - j.y) <= 12) return j
  }
  return null
}
/* 拖线落点命中连线本体（12px 容差）：返回被命中的边（供落线自动建连接点接线，v1.0.15）。
 * 排除拖线起点所在的宿主连线（不能把线接回自己）。 */
function hitEdgeAt(pt, excludeEdgeKey) {
  for (const e of edges.value) {
    if (excludeEdgeKey && e.key === excludeEdgeKey) continue
    if (projectOnEdge(pt, e).dist < 12) return e
  }
  return null
}
/* 连接点作为起点引出连线：mousedown 拖线 → 落点为模块/连接点/连线本体皆可接（v1.0.15 线连到线） */
function startConnectFromJunction(e, j) {
  e.stopPropagation()
  e.preventDefault()
  const host = { ownerId: j.ownerId, relId: j.relId, junctionId: j.junctionId }
  const g = hostJunctionGeom(host)
  const origin = { x: g?.point.x ?? j.x, y: g?.point.y ?? j.y }
  connecting.value = { fromId: null, fromJunction: host, side: g?.side || 'right', x: origin.x, y: origin.y, x0: origin.x, y0: origin.y }
  const move = (ev) => {
    const p = canvasPt(ev)
    connecting.value = { ...connecting.value, x: p.x, y: p.y }
  }
  const up = (ev) => {
    window.removeEventListener('mousemove', move)
    window.removeEventListener('mouseup', up)
    const st = connecting.value
    connecting.value = null
    if (!st) return
    const pt = canvasPt(ev)
    /* 1. 落到既有连接点：直接接（含连接点→连接点） */
    const junc = hitJunctionAt(pt, null)
    if (junc && junc.junctionId !== j.junctionId) {
      const rel = work.olnodeRelAddJunctionToJunction(host, { ownerId: junc.ownerId, relId: junc.relId, junctionId: junc.junctionId })
      if (rel) {
        const g = edgeGeomFromJunction(nodeById(host.ownerId), nodeById(host.ownerId)?.rels?.find((x) => x.id === j.relId), rel) || { mid: { x: (origin.x + junc.x) / 2, y: (origin.y + junc.y) / 2 } }
        openEdgeEdit(host.ownerId, rel.id, g)
      }
      return
    }
    /* 2. 落到另一条连线本体：在落点自动创建新连接点并接上（线→线） */
    const hitEdge = hitEdgeAt(pt, j.relId)
    if (hitEdge) {
      const { t, point } = projectOnEdge(pt, hitEdge)
      const nj = work.olnodeJunctionAdd(hitEdge.ownerId, hitEdge.rel.id, t)
      if (nj) {
        const rel = work.olnodeRelAddJunctionToJunction(host, { ownerId: hitEdge.ownerId, relId: hitEdge.rel.id, junctionId: nj.id })
        if (rel) {
          const g = edgeGeomFromJunction(nodeById(host.ownerId), nodeById(host.ownerId)?.rels?.find((x) => x.id === j.relId), rel) || { mid: { x: (origin.x + point.x) / 2, y: (origin.y + point.y) / 2 } }
          openEdgeEdit(host.ownerId, rel.id, g)
        }
      }
      return
    }
    /* 3. 落到模块：常规建边 */
    const target = hitConnTarget(pt, new Set())
    if (!target) return
    const tb = rectOf(target)
    const toSide = sideBetween({ x: origin.x - 1, y: origin.y - 1, w: 2, h: 2 }, tb).to
    const rel = work.olnodeRelAddFromJunction(host, target.id, { toSide })
    if (rel) {
      const g = edgeGeomFromJunction(nodeById(host.ownerId), nodeById(host.ownerId)?.rels?.find((x) => x.id === j.relId), rel)
      openEdgeEdit(host.ownerId, rel.id, g || { mid: { x: (origin.x + (tb.x + tb.w / 2)) / 2, y: (origin.y + (tb.y + tb.h / 2)) / 2 } })
    }
  }
  window.addEventListener('mousemove', move)
  window.addEventListener('mouseup', up)
}
function startConnect(e, n) {
  e.stopPropagation()
  e.preventDefault()
  const side = e.currentTarget?.dataset?.side || 'right'
  const a0 = anchorsOf(rectOf(n))[side] || canvasPt(e)
  connecting.value = { fromId: n.id, side, x: a0.x, y: a0.y }
  const move = (ev) => {
    const p = canvasPt(ev)
    connecting.value = { fromId: n.id, side, x: p.x, y: p.y }
  }
  const up = (ev) => {
    window.removeEventListener('mousemove', move)
    window.removeEventListener('mouseup', up)
    const st = connecting.value
    connecting.value = null
    if (!st) return
    const pt = canvasPt(ev)
    /* 优先接连接点（线→线互连）；否则按模块建立 */
    const junc = hitJunctionAt(pt, n.id)
    if (junc) {
      work.olnodeRelAddToJunction(n.id, { ownerId: junc.ownerId, relId: junc.relId, junctionId: junc.junctionId }, { fromSide: side })
      return
    }
    const finalTarget = hitConnTarget(pt, new Set([n.id]))
    if (!finalTarget) return
    /* 记录两侧端口：从拖出的接口（fromSide）来，接入侧取面向源节点一侧（toSide） */
    const tb = rectOf(finalTarget)
    const toSide = sideBetween(rectOf(n), tb).to
    const rel = work.olnodeRelAdd(n.id, finalTarget.id, { fromSide: side, toSide })
    if (!rel) return
    const g = edgeGeomFor(n, rel) || { mid: pt }
    openEdgeEdit(n.id, rel.id, g)
  }
  window.addEventListener('mousemove', move)
  window.addEventListener('mouseup', up)
}
const connPath = computed(() => {
  const c = connecting.value
  if (!c) return ''
  /* 从连接点引出的拖线：起点固定为连接点中心（钉在宿主连线上） */
  if (c.fromJunction) return `M ${c.x0 ?? c.x} ${c.y0 ?? c.y} L ${c.x} ${c.y}`.replace('NaN', '')
  const from = nodeById(c.fromId)
  const anchor = from && rectOf(from) ? anchorsOf(rectOf(from))[c.side] : null
  const start = anchor || c
  return `M ${start.x} ${start.y} L ${c.x} ${c.y}`
})

/* ---------- 左键拖拽塑形（v1.0.16）：替换「点击连线开编辑浮层」 ----------
 * 按住连线拖动 → 弯曲（custom 控制点跟随鼠标，实时预览）；拖回近直线（垂距 < 6px）→ 自动拉直；
 * 点击不动 → 无操作；编辑浮层入口只剩：拖线建边完成后自动弹出。 */
let shaping = null // { ownerId, relId, moved }
function startEdgeShape(e, edge) {
  if (e.button !== 0) return
  e.stopPropagation()
  /* 双击拉直：preventDefault 会抑制原生 dblclick 派发，改在 mousedown 里按 e.detail 判定 */
  if (e.detail >= 2) {
    e.preventDefault()
    work.olnodeRelPatchAny(edge.ownerId, edge.rel.id, { custom: null })
    return
  }
  e.preventDefault()
  shaping = { ownerId: edge.ownerId, relId: edge.rel.id, moved: false }
  const move = (ev) => {
    if (!shaping) return
    const p = canvasPt(ev)
    if (!shaping.moved) {
      work.olnodePushUndo(true)
      shaping.moved = true
    }
    /* 拖回近直线（与 a-b 端点连线垂距 < 6px）→ 清除 custom 恢复自动路由（拉直） */
    const a = edge.a
    const b = edge.b
    const abx = b.x - a.x
    const aby = b.y - a.y
    const l2 = abx * abx + aby * aby || 1
    const dist = Math.abs((p.x - a.x) * aby - (p.y - a.y) * abx) / Math.sqrt(l2)
    work.olnodeRelPatchAny(shaping.ownerId, shaping.relId, dist < 6 ? { custom: null } : { custom: { x: p.x, y: p.y } })
  }
  const up = () => {
    window.removeEventListener('mousemove', move)
    window.removeEventListener('mouseup', up)
    /* 未移动的点击不再打开编辑浮层（v1.0.16 取消该入口） */
    shaping = null
  }
  window.addEventListener('mousemove', move)
  window.addEventListener('mouseup', up)
}
/* 连线中点手柄：已有 custom 弯曲的连线显示微型手柄，拖它 = 继续调整弯曲；双击连线 = 拉直恢复自动路由 */
function onEdgeDbl(edge) {
  work.olnodeRelPatchAny(edge.ownerId, edge.rel.id, { custom: null })
}

/* ---------- 边编辑浮层（与容器右键菜单同模式：fixed + 屏幕坐标 + 不随画布缩放重定位） ---------- */
const edgeLabelInput = ref(null)
/* 避线放置（v1.0.18）：以锚点为基准沿 上/下/左/右 四方位生成候选框（与 .oc-eedit.dir-* transform 变体一一对应），
 * 统计连线路径采样点落入框内的数量（遮挡少者优先），越出画布可视区的面积占比高者罚分，
 * 同分按 上>下>右>左 偏好——浮层弹在不压住连线本体的一侧。size 缺省用估值，挂载后可按真实尺寸复检 */
function popPlacement(mid, geom, size) {
  const el = canvasEl.value
  if (!el) return { mx: mid?.x ?? 0, my: mid?.y ?? 0, dir: 'up' }
  const r = el.getBoundingClientRect()
  const sx = r.left + tx.value + (mid?.x ?? 0) * zoom.value
  const sy = r.top + ty.value + (mid?.y ?? 0) * zoom.value
  const gap = 14
  const w = size?.w || 238
  const h = size?.h || (edgeCtx.value ? 206 : 172)
  /* 几何缺失时回退旧逻辑：默认上方弹出，顶部空间不足且下方更宽敞则向下（v0.4.12 行为） */
  if (!geom || (!geom.pts && !geom.c1)) {
    const roomUp = sy - r.top
    return { mx: sx, my: sy, dir: roomUp < h + gap && r.bottom - sy > roomUp ? 'down' : 'up' }
  }
  const N = 32
  const samples = []
  for (let i = 0; i <= N; i++) {
    const p = pointAtT(geom, i / N)
    if (p) samples.push({ x: r.left + tx.value + p.x * zoom.value, y: r.top + ty.value + p.y * zoom.value })
  }
  const pref = { up: 0, down: 1, right: 2, left: 3 }
  const cands = [
    { dir: 'up', x: sx - w / 2, y: sy - gap - h },
    { dir: 'down', x: sx - w / 2, y: sy + gap },
    { dir: 'left', x: sx - gap - w, y: sy - h / 2 },
    { dir: 'right', x: sx + gap, y: sy - h / 2 }
  ]
  let best = null
  for (const rc of cands) {
    let inside = 0
    for (const p of samples) {
      if (p.x > rc.x && p.x < rc.x + w && p.y > rc.y && p.y < rc.y + h) inside++
    }
    const ix = Math.max(0, Math.min(rc.x + w, r.right) - Math.max(rc.x, r.left))
    const iy = Math.max(0, Math.min(rc.y + h, r.bottom) - Math.max(rc.y, r.top))
    const clipped = 1 - (ix * iy) / (w * h)
    const score = inside * 2 + clipped * 64 + pref[rc.dir]
    if (best === null || score < best.score) best = { score, dir: rc.dir }
  }
  return { mx: sx, my: sy, dir: best.dir }
}
function openEdgeEdit(ownerId, relId, geom) {
  const p = popPlacement(geom?.mid, geom)
  edgeEdit.value = { ownerId, relId, mx: p.mx, my: p.my, dir: p.dir }
  nextTick(() => {
    edgeLabelInput.value?.focus()
    /* 挂载后按真实尺寸复检方位（估值有偏差时纠正：锚点不变，仅切换 transform 变体） */
    const el = document.querySelector('.oc-eedit')
    if (!el || !edgeEdit.value) return
    edgeEdit.value.dir = popPlacement(geom?.mid, geom, { w: el.offsetWidth, h: el.offsetHeight }).dir
  })
}
function curRel() {
  const st = edgeEdit.value
  if (!st) return null
  const n = nodeById(st.ownerId)
  if (!n || !Array.isArray(n.rels)) return null
  /* 编辑对象可能是宿主 rel 本身，也可能是它某个连接点引出的 _out 连线 */
  for (const r of n.rels) {
    if (r.id === st.relId) return r
    const o = (r._out || []).find((x) => x.id === st.relId)
    if (o) return o
  }
  return null
}
function patchRel(patch) {
  const st = edgeEdit.value
  if (!st) return
  const n = nodeById(st.ownerId)
  if (!n || !Array.isArray(n.rels)) return
  for (const r of n.rels) {
    if (r.id === st.relId) {
      work.olnodeRelUpdate(st.ownerId, st.relId, patch)
      return
    }
    const i = (r._out || []).findIndex((x) => x.id === st.relId)
    if (i >= 0) {
      r._out = r._out.map((x, k) => (k === i ? { ...x, ...patch } : x))
      autosave.mark('olnodes', n)
      return
    }
  }
}
function removeRel() {
  const st = edgeEdit.value
  if (!st) return
  const n = nodeById(st.ownerId)
  if (n && Array.isArray(n.rels)) {
    for (const r of n.rels) {
      if (r.id === st.relId) {
        work.olnodeRelRemove(st.ownerId, st.relId)
        break
      }
      if ((r._out || []).some((x) => x.id === st.relId)) {
        r._out = r._out.filter((x) => x.id !== st.relId)
        autosave.mark('olnodes', n)
        break
      }
    }
  }
  edgeEdit.value = null
  edgeCtx.value = null
}
function closeFloaters() {
  edgeEdit.value = null
  edgeCtx.value = null
  citePick.value = null
  editTitle.value = null
}
function onWinDown(e) {
  /* 浮层与其落点数据（edgeCtx）同生共死：点浮层/连线外即一并关闭 */
  if (edgeEdit.value && !e.target.closest?.('.oc-eedit, .oc-edge-hit, .oc-elabel')) {
    edgeEdit.value = null
    edgeCtx.value = null
  }
  if (citePick.value && !e.target.closest?.('.oc-pick')) citePick.value = null
  if (editTitle.value && !e.target.closest?.('.oc-title-edit')) commitTitle()
  if (ctxMenu.value && !e.target.closest?.('.oc-ctx')) ctxMenu.value = null
  if (blankCtx.value && !e.target.closest?.('.oc-ctx')) blankCtx.value = null
  if (juncCtx.value && !e.target.closest?.('.oc-ctx, .oc-junc-hit')) juncCtx.value = null
}

/* ---------- 节点操作 ---------- */
function onRemove(n) {
  const kids = work.olnodeChildren(n.id).length
  const label = n.title || KIND_META[n.kind]?.label || '模块'
  if (kids && !window.confirm(`删除「${label}」及其全部 ${kids} 个子模块？`)) return
  if (work.selOlnodeId === n.id || work.olnodeDescendants(n.id).some((d) => d.id === work.selOlnodeId)) work.selOlnodeId = null
  work.olnodeRemove(n.id)
}
function onDblNode(n) {
  if (n.kind === 'anchor' && n.refId) {
    work.navTo('chapters', n.refId)
    return
  }
  if (n.kind === 'volume' && n.refId) {
    const first = work.liveChapters.find((c) => c.volumeId === n.refId)
    if (first) work.navTo('chapters', first.id)
    return
  }
  if (n.kind === 'container') {
    editTitle.value = { id: n.id, value: n.title || '' }
    return
  }
  startInlineEdit(n)
}
const chapterOf = (n) => (n.kind === 'anchor' ? work.chapters.find((c) => c.id === n.refId && !c.deletedAt) : null)
function labelOf(n) {
  if (n.kind === 'anchor') return chapterOf(n)?.title || n.title || '（已删章节）'
  if (n.kind === 'volume') return work.volumes.find((v) => v.id === n.refId && !v.deletedAt)?.title || n.title || '（已删卷）'
  if (n.kind === 'cite') {
    const parsed = parseTarget(n.refId)
    const t = parsed ? targetById(parsed.kind, parsed.id) : null
    return t?.title || n.title || '引用卡'
  }
  const first = (n.text || '').split('\n').find((x) => x.trim())
  return n.title || (first || '').trim().slice(0, 40) || '（空模块）'
}
function subOf(n) {
  if (n.kind === 'anchor') {
    const c = chapterOf(n)
    return c ? `${c.wordCount || 0}字 · ${STATUS_LABEL[c.status]}` : ''
  }
  if (n.kind === 'volume') {
    const chs = work.liveChapters.filter((c) => c.volumeId === n.refId)
    return chs.length ? `${chs.length}章 · ${chs.reduce((s, c) => s + (c.wordCount || 0), 0)}字` : ''
  }
  if (n.kind === 'cite') {
    const parsed = parseTarget(n.refId)
    return parsed ? KIND_LABEL[parsed.kind] || '' : '未选择目标'
  }
  return n.title ? (n.text || '').split('\n').find((x) => x.trim())?.trim().slice(0, 30) || '' : ''
}
function citeJump(n) {
  const parsed = parseTarget(n.refId)
  const t = parsed ? targetById(parsed.kind, parsed.id) : null
  if (!t) return
  if (parsed.kind === 'character') work.jumpToCharGraph(t.id)
  else jumpTo(t)
}
/* 放大模块（自定义高度超出默认 30px+）显示正文全文；文本框模块始终全文 */
function showFullText(n) {
  if (n.kind === 'textbox') return true
  if (n.h == null) return false
  const base = effSize({ kind: n.kind, shape: n.shape }, work.canvasPrefs.density).h
  return n.h >= base + 30 && (n.text || '').trim().length > 0
}
function plainText(n) {
  return String(n.text || '').replace(/\[\[([^\[\]\n]+?)\|?([^\[\]\n]*?)\]\]/g, (m, t, d) => d || t).slice(0, 600)
}
function commitTitle() {
  const st = editTitle.value
  editTitle.value = null
  if (st && st.value.trim()) work.olnodeSetTitle(st.id, st.value.trim())
}
function branchColor(n) {
  if (n.color) return n.color // 右键快捷栏手动指定色优先
  const cs = live.value.filter((x) => x.kind === 'container')
  const i = cs.findIndex((x) => x.id === n.id)
  return PALETTE[(i < 0 ? 0 : i) % PALETTE.length]
}
function nodeStyle(n) {
  const r = rectOf(n)
  if (!r) return { display: 'none' }
  const editing = editText.value && editText.value.id === n.id
  return {
    left: r.x + 'px',
    top: r.y + 'px',
    width: r.w + 'px',
    // 非容器一律显式高度：与 rectOf（连线锚点/容器派生盒）一致，高度拖拽才能生效；
    // 编辑态给足最小编辑区（否则 absolute 编辑器撑不开节点，内容不可见）
    height: n.kind === 'container' ? r.h + 'px' : editing ? Math.max(r.h, 96) + 'px' : Math.max(r.h, 36) + 'px',
    zIndex: editing ? 8 : n.kind === 'container' ? 1 : work.selOlnodeId === n.id ? 6 : 3,
    ...(n.kind === 'container' ? { '--bc': branchColor(n) } : {})
  }
}

/* 形状描边多边形（viewBox 0 0 100 100，preserveAspectRatio=none 拉伸铺满节点）：
 * 菱形/平行四边形顶点恰好落在连线锚点（边界中点）上，边框与连线端点贴合 */
const SW = 1.6
function shapePoly(n) {
  if (n.shape === 'diamond') {
    return [
      [50, SW],
      [100 - SW, 50],
      [50, 100 - SW],
      [SW, 50]
    ]
      .map((p) => p.join(','))
      .join(' ')
  }
  const sk = 12
  return [
    [sk, SW],
    [100 - SW, SW],
    [100 - sk, 100 - SW],
    [SW, 100 - SW]
  ]
    .map((p) => p.join(','))
    .join(' ')
}

/* ---------- 新建与骨架模板 ---------- */
function addNodeAt(kind, pt, fields = {}) {
  const s = effSize({ kind }, work.canvasPrefs.density)
  const spot = freeSpotFor(
    visNodes.value.map((n) => rectOf(n)).filter(Boolean),
    s,
    pt.x - s.w / 2,
    pt.y - s.h / 2
  )
  const row = work.olnodeAdd(null, { kind, canvasX: spot.x, canvasY: spot.y, ...fields })
  work.selOlnodeId = row.id
  return row
}
function addNode(kind) {
  const el = canvasEl.value
  const pt = el ? { x: (el.clientWidth / 2 - tx.value) / zoom.value, y: (el.clientHeight / 2 - ty.value) / zoom.value } : { x: 120, y: 120 }
  const row = addNodeAt(kind, pt, kind === 'note' ? { title: '新便签' } : kind === 'cite' ? { title: '' } : {})
  if (kind === 'cite') {
    const p = posOf(row)
    if (p) citePick.value = { nodeId: row.id, x: p.x, y: p.y }
  }
}
function onCitePick(t) {
  const st = citePick.value
  citePick.value = null
  if (st) work.olnodeSetCite(st.nodeId, t)
}
function applyTemplate(t) {
  work.olnodePushUndo(true)
  const created = work.olnodeBulkAdd(t.rows)
  for (const e of t.edges) {
    const src = created[e.from]
    const dst = created[e.to]
    if (!src || !dst) continue
    work.olnodeSetRels(src.id, [
      ...work.olnodeRelsOf(src.id),
      { id: uid(), toId: dst.id, label: e.label || '', kind: e.kind || '关联', arrows: '->', style: '' }
    ])
  }
  nextTick(fitView)
}

/* ---------- 断线定位 / 闪烁 ---------- */
const brokenCycle = ref(0)
const arrowsGlyph = (a) => ({ '->': '→', '<->': '↔', '--': '—' }[a] || '→')
const edgeStyleLabel = computed(() => (work.canvasPrefs.edgeStyle === 'ortho' ? '折线' : '曲线'))
/* 自定义模块类型（8.8.2-G2）：mtype 循环赋值（无 → 类型1 → … → 无） */
const mtypeColorOf = (name) => work.olTypes.find((t) => t.name === name)?.color || 'var(--text-dim)'
function cycleMtype(n) {
  const names = work.olTypes.map((t) => t.name)
  const i = names.indexOf(n.mtype || '')
  work.olnodeSetMtype(n.id, names[(i + 1) % (names.length + 1)] || '')
}
function locateBroken(list) {
  if (!list.length) return
  const n = list[brokenCycle.value % list.length]
  brokenCycle.value++
  work.selOlnodeId = n.id
  focusNode(n.id)
}
function focusNode(id) {
  const n = nodeById(id)
  const p = n && posOf(n)
  if (p) centerOn(p.x + sizeOf(n).w / 2, p.y + sizeOf(n).h / 2)
  flashIds.add(id)
  setTimeout(() => flashIds.delete(id), 1600)
}
watch(
  () => work.canvasFocusTick,
  () => {
    if (work.selOlnodeId) focusNode(work.selOlnodeId)
  }
)

/* ---------- 键盘 / 生命周期 ---------- */
onMounted(() => {
  ensurePlaced()
  // v0.4.2：容器内嵌 textboxes（上一实现）迁移为独立文本框子节点（可拖拽/连线/缩放）
  const legacy = live.value.filter((x) => x.kind === 'container' && (Array.isArray(x.textboxes) && x.textboxes.length))
  if (legacy.length) {
    work.olnodePushUndo(true)
    for (const c of legacy) {
      const box = rectOf(c) || { x: c.canvasX ?? 0, y: c.canvasY ?? 0, w: 280 }
      const rows = (c.textboxes || []).map((t, i) => ({
        kind: 'textbox',
        parentId: c.id,
        title: '',
        text: t.text || '',
        opacity: t.opacity != null ? t.opacity : 1,
        w: t.w || 180,
        h: t.h || 64,
        canvasX: (box.x ?? 0) + 10 + (i % 2) * (t.w || 180),
        canvasY: (box.y ?? 0) + 44 + Math.floor(i / 2) * (t.h || 64) + i * 8
      }))
      for (const r of rows) work.olnodeAdd(null, r)
      work.olnodeTextboxesSet(c.id, [])
    }
  }
  window.addEventListener('keydown', onKey)
  window.addEventListener('mousedown', onWinDown, true)
  juncFlashTimer = setInterval(() => juncFlashTick.value++, 400)
  if (live.value.length) nextTick(fitView)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('mousedown', onWinDown, true)
  clearInterval(juncFlashTimer)
})
</script>

<template>
  <div class="om-wrap">
    <div class="om-toolbar oc-toolbar">
      <span v-if="work.olBroken.tails.length" class="oc-chip oc-warn" title="无出边的事件节点——情节烂尾" @click="locateBroken(work.olBroken.tails)">烂尾 {{ work.olBroken.tails.length }}</span>
      <span v-if="work.olBroken.missing.length" class="oc-chip oc-warn2" title="无入边的事件节点——缺少铺垫" @click="locateBroken(work.olBroken.missing)">缺铺垫 {{ work.olBroken.missing.length }}</span>
      <span class="oc-chip" :class="{ on: work.canvasPrefs.snap }" title="拖动时吸附 16px 网格" @click="setPref('snap', !work.canvasPrefs.snap)">吸附</span>
      <span class="oc-chip" :class="{ on: work.canvasPrefs.density === 'compact' }" title="卡片密度" @click="setPref('density', work.canvasPrefs.density === 'compact' ? 'detail' : 'compact')">{{ work.canvasPrefs.density === 'compact' ? '紧凑' : '详细' }}</span>
      <span class="oc-chip" :class="{ on: work.canvasPrefs.edgeStyle === 'ortho' }" title="连线样式" @click="setPref('edgeStyle', work.canvasPrefs.edgeStyle === 'ortho' ? 'bezier' : 'ortho')">{{ edgeStyleLabel }}</span>
      <NPopover trigger="click" :show-arrow="false">
        <template #trigger>
          <span class="oc-chip" title="画布设置：连线粗细等"><OIcon name="gear" :size="12" /> 设置</span>
        </template>
        <div class="oc-settings">
          <div class="oc-settings-row">
            <span class="oc-settings-label">连线粗细</span>
            <NSlider v-model:value="edgeWidthModel" :min="0.8" :max="5" :step="0.2" style="width: 150px" />
            <span class="oc-settings-val">{{ (work.canvasPrefs.edgeWidth || 1.8).toFixed(1) }}px</span>
          </div>
          <div class="oc-settings-row">
            <span class="oc-settings-label">箭头大小</span>
            <NSlider v-model:value="arrowSizeModel" :min="0.5" :max="3" :step="0.1" style="width: 150px" />
            <span class="oc-settings-val">{{ (work.canvasPrefs.arrowSize || 1).toFixed(1) }}×</span>
          </div>
          <div class="oc-settings-tip">调整画布全部连线与箭头的显示大小；线型（实线/虚线/点线）与箭头方向在连线编辑浮层中按条设置。</div>
        </div>
      </NPopover>
      <span style="flex: 1"></span>
      <span class="oc-count">{{ visNodes.length }} 模块 · {{ edges.length }} 连线</span>
      <button class="om-btn" title="撤销 (Ctrl+Z)" @click="work.olnodeUndo()">↶</button>
      <button class="om-btn" title="重做 (Ctrl+Y)" @click="work.olnodeRedo()">↷</button>
      <button class="om-btn text oc-tidy" title="整理布局（固定模块除外）" @click="tidyAll">整理</button>
      <button class="om-btn" title="缩小" @click="zoom = Math.max(0.3, zoom - 0.15)"><OIcon name="minus" :size="13" /></button>
      <span class="oc-zoom">{{ Math.round(zoom * 100) }}%</span>
      <button class="om-btn" title="放大" @click="zoom = Math.min(2.2, zoom + 0.15)"><OIcon name="plus" :size="13" /></button>
      <button class="om-btn text" title="适应视图" @click="fitView">适应</button>
    </div>

    <div ref="canvasEl" class="om-canvas oc-canvas" @mousedown="onPanStart" @wheel.prevent="onWheelC" @dblclick.self="addNode('event')" @contextmenu.prevent="onCanvasCtx">
      <div class="om-inner" :style="innerStyle">
        <svg
          class="om-edges oc-edges"
          :style="{ left: svgBox.x + 'px', top: svgBox.y + 'px' }"
          :width="svgBox.w"
          :height="svgBox.h"
          :viewBox="svgBox.x + ' ' + svgBox.y + ' ' + svgBox.w + ' ' + svgBox.h"
        >
          <path v-for="e in edges" :key="'h' + e.key" class="oc-edge-hit" :d="e.d" :data-owner="e.ownerId" :data-rel="e.rel.id" @mousedown.stop="startEdgeShape($event, e)" @dblclick.stop="onEdgeDbl(e)" @contextmenu.prevent.stop="openEdgeCtxFromEvent($event, e)">
            <title>按住拖动弯曲连线 · 双击拉直 · 右键编辑（含创建连接点）</title>
          </path>
          <path
            v-for="e in edges"
            :key="'v' + e.key"
            :d="e.dTrim || e.d"
            fill="none"
            :stroke="e.color"
            :stroke-width="relEdgeWidth(e.rel)"
            :stroke-dasharray="dashOf(e.rel.style, e.rel.kind)"
            :opacity="edgeEdit && edgeEdit.relId === e.key ? 1 : 0.85"
          />
          <polygon v-for="(h, i) in edgeDecor.heads" :key="'a' + i" :points="h" :fill="edgeDecor.fills[i]" />
          <!-- 连接点（v1.0.13）：钉在宿主连线路径上——默认微观透明小圆点；创建后 1.6s 内 flash 高亮（加深显形）便于确认位置，随后淡出隐藏。
               热区圆承担两类操作：mousedown 引出连线（连接点作起点）、被模块锚点拖线命中（作终点）、右键删除 -->
          <g v-for="j in junctionItems" :key="'j' + j.key" class="oc-junc" :class="{ flash: j.flash }">
            <circle class="oc-junc-hit" :cx="j.x" :cy="j.y" r="10" fill="transparent" :data-junc="j.key" @mousedown.stop.prevent="startConnectFromJunction($event, j)" @contextmenu.prevent.stop="openJunctionCtx($event, j)">
              <title>连接点——按住拖出连线 / 模块锚点拖到此接线 · 右键删除</title>
            </circle>
            <circle class="oc-junc-dot" :cx="j.x" :cy="j.y" r="2.5" />
          </g>
          <path v-if="connecting" :d="connPath" fill="none" stroke="var(--accent)" stroke-width="1.6" stroke-dasharray="6 4" />
        </svg>

        <!-- 容器 / 节点层 -->
        <div
          v-for="n in visNodes"
          :key="n.id"
          class="oc-node"
          :class="['oc-' + n.kind, 'sh-' + (n.shape || 'process'), { sel: work.selOlnodeId === n.id, flash: flashIds.has(n.id), pinned: n.pin, resizing: resizing === n.id, 'resize-smooth': resizeSmooth && resizing === n.id, editing: editText && editText.id === n.id, 'dl-link': n.kind === 'cite' && n.refId }]"
          :style="nodeStyle(n)"
          :data-dl-target="n.kind === 'cite' && n.refId ? n.refId : null"
          :data-dl-title="n.kind === 'cite' ? labelOf(n) : null"
          @mousedown="onNodeDown($event, n)"
          @dblclick.stop="onDblNode(n)"
          @click.stop="n.kind === 'cite' && n.refId && citeJump(n)"
          @contextmenu.prevent="onNodeCtx($event, n)"
        >
          <template v-if="n.kind === 'container'">
            <div class="oc-chead" @dblclick.stop="editTitle = { id: n.id, value: n.title || '' }">
              <button class="oc-caret" :title="n.fold ? '展开子模块' : '折叠子模块'" @click.stop="work.olnodeToggleFold(n.id)"><OIcon :name="n.fold ? 'caret-right' : 'caret-down'" :size="11" /></button>
              <input
                v-if="editTitle && editTitle.id === n.id"
                class="oc-title-edit"
                v-model="editTitle.value"
                @mousedown.stop
                @keydown.enter="commitTitle"
                @keydown.esc="editTitle = null"
              />
              <span v-else class="oc-ctitle">{{ n.title || '容器' }}</span>
              <span class="oc-ccount">{{ kidsOf(n).length }}</span>
            </div>
          </template>
          <template v-else>
            <!-- 菱形/平行四边形：SVG 描边代替 clip-path（clip 会裁掉边框、锚点与手柄） -->
            <svg v-if="n.kind === 'event' && (n.shape === 'diamond' || n.shape === 'para')" class="oc-shape" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <polygon :points="shapePoly(n)" />
            </svg>
            <div v-if="n.kind === 'textbox'" class="oc-tbbg" :style="{ opacity: n.opacity != null ? n.opacity : 1 }"></div>
            <span v-if="n.kind === 'anchor' && chapterOf(n)" class="ol-dot" :data-s="chapterOf(n).status" :title="STATUS_LABEL[chapterOf(n).status]" />
            <textarea
              v-if="editText && editText.id === n.id"
              ref="inlineEl"
              v-model="editText.value"
              class="oc-inline-edit"
              spellcheck="false"
              title="Ctrl+Enter 提交 · Esc 取消"
              @mousedown.stop
              @dblclick.stop
              @blur="commitInline"
              @keydown.esc.prevent="editText = null"
              @keydown.ctrl.enter.prevent="commitInline"
            ></textarea>
            <button v-else-if="n.kind === 'cite' && !n.refId" class="oc-cite-add" title="选择引用目标" @click.stop="citePick = { nodeId: n.id, x: posOf(n).x, y: posOf(n).y }"><OIcon name="plus" :size="12" /> 选择目标</button>
              <div v-else class="oc-body" :class="{ 'oc-textbody': n.kind === 'textbox' }">
              <div class="oc-label">{{ labelOf(n) }}</div>
              <div v-if="showFullText(n)" class="oc-fulltext">{{ plainText(n) }}</div>
              <div v-else class="om-sub">{{ plainText(n).split('\n')[0].slice(0, 40) || subOf(n) || '&nbsp;' }}</div>
              <span v-if="!showFullText(n) && n.mtype && work.canvasPrefs.density === 'detail'" class="om-mtype" :style="{ color: mtypeColorOf(n.mtype), borderColor: mtypeColorOf(n.mtype) }">{{ n.mtype }}</span>
            </div>
          </template>

          <span v-for="sd in ['top', 'right', 'bottom', 'left']" :key="sd" class="oc-apt" :data-side="sd" :title="'拖到目标模块或连接点建立连线'" @mousedown="startConnect($event, n)" />
          <template v-if="n.kind !== 'container'">
            <span class="oc-rs" data-dir="e" title="拖拽调整宽度" @mousedown="startResize($event, n, 'e')" />
            <span class="oc-rs" data-dir="w" title="拖拽调整宽度" @mousedown="startResize($event, n, 'w')" />
            <span class="oc-rs" data-dir="s" title="拖拽调整高度" @mousedown="startResize($event, n, 's')" />
            <span class="oc-rs" data-dir="n" title="拖拽调整高度" @mousedown="startResize($event, n, 'n')" />
            <span class="oc-rs oc-rs-corner" data-dir="se" title="拖拽调整大小" @mousedown="startResize($event, n, 'se')" />
            <span class="oc-rs oc-rs-corner" data-dir="sw" title="拖拽调整大小" @mousedown="startResize($event, n, 'sw')" />
            <span class="oc-rs oc-rs-corner" data-dir="ne" title="拖拽调整大小" @mousedown="startResize($event, n, 'ne')" />
            <span class="oc-rs oc-rs-corner" data-dir="nw" title="拖拽调整大小" @mousedown="startResize($event, n, 'nw')" />
          </template>
        </div>

        <!-- 双链令牌卫星 -->
        <a
          v-for="st in sats"
          :key="st.key"
          class="om-sat dl-link oc-sat"
          href="javascript:;"
          :style="{ left: st.x + 'px', top: st.y + 'px' }"
          :data-dl-target="st.resolved ? st.resolved.kind + ':' + st.resolved.id : ''"
          :data-dl-title="st.title"
          :title="st.resolved ? '点击跳转 · 悬停预览' : '未找到目标内容'"
          @click.stop.prevent="st.resolved && jumpTo(st.resolved)"
        >
          <span class="dl-kind">{{ st.resolved ? KIND_LABEL[st.resolved.kind] : '?' }}</span>
          <span class="om-sat-text">{{ st.display }}</span>
        </a>

        <!-- 连线标签（纯展示 + 双击拉直；左键编辑入口已随塑形改版取消） -->
        <div
          v-for="e in edges.filter((x) => x.rel.label)"
          :key="'l' + e.key"
          class="oc-elabel"
          :style="{ left: e.mid.x + 'px', top: e.mid.y + 'px', borderColor: e.color, color: e.color }"
          @dblclick.stop="onEdgeDbl(e)"
          @contextmenu.prevent.stop="openEdgeCtxFromEvent($event, e)"
        >{{ e.rel.label }}</div>

        <!-- 边编辑浮层：挂 .app-root（theme-* 的 CSS 变量在此元素上，Teleport 到 body 会丢失背景色变透明），
           fixed 定位不受画布缩放影响，尺寸恒定 -->
      <Teleport to=".app-root" v-if="edgeEdit">
      <div class="oc-eedit" :class="'dir-' + (edgeEdit.dir || 'up')" :style="{ position: 'fixed', left: edgeEdit.mx + 'px', top: edgeEdit.my + 'px' }" @mousedown.stop @contextmenu.prevent.stop>
          <div class="oc-eedit-title">编辑连线</div>
          <div class="oc-eedit-row">
            <input ref="edgeLabelInput" class="rp-input" :value="curRel()?.label || ''" placeholder="连线标签…" @input="patchRel({ label: $event.target.value })" @keydown.enter="edgeEdit = null" @keydown.esc="edgeEdit = null" />
            <button class="om-btn" :title="edgeEdit && curRel() ? '箭头：' + { '->': '单向', '<->': '双向', '--': '无向' }[curRel().arrows || '->'] : '箭头'" @click="patchRel({ arrows: cycleArrow(curRel()?.arrows || '->') })">{{ arrowsGlyph(curRel()?.arrows) }}</button>
            <button class="om-btn oc-mini-x" title="删除连线" @click="removeRel"><OIcon name="close" :size="12" /></button>
          </div>
          <!-- 右键打开时提供「在此处创建连接点」（落点 = 右键位置，投影到真实路径） -->
          <button v-if="edgeCtx" class="oc-ctx-item oc-eedit-juncbtn" title="在右键位置的连线上创建连接点（模块锚点拖线到连接点、或按住连接点拖出连线互连）" @click="edgeCtxCreate">
            <OIcon name="link" :size="13" /> 在此处创建连接点
          </button>
          <div class="oc-eedit-row oc-kindrow oc-eedit-sec">
            <span
              v-for="k in REL_KINDS"
              :key="k.key"
              class="oc-kind"
              :class="{ on: (curRel()?.kind || '关联') === k.key }"
              :style="{ '--kc': k.color }"
              @click="patchRel({ kind: k.key })"
            >{{ k.key }}</span>
          </div>
          <div class="oc-eedit-row oc-kindrow">
            <span
              v-for="s in EDGE_STYLES"
              :key="s.key"
              class="oc-kind"
              :class="{ on: (curRel()?.style || '') === (s.key === 'solid' ? '' : s.key) }"
              @click="patchRel({ style: s.key === 'solid' ? '' : s.key })"
            >{{ s.label }}</span>
          </div>
          <div class="oc-eedit-row oc-eedit-swatches oc-eedit-sec">
            <span
              class="oc-ctx-sw"
              :class="{ on: !(curRel()?.color || '') }"
              title="主题色"
              @click="patchRel({ color: '' })"
            ></span>
            <span
              v-for="col in EDGE_COLORS"
              :key="col"
              class="oc-ctx-sw"
              :class="{ on: (curRel()?.color || '') === col }"
              :style="{ background: col }"
              :title="col"
              @click="patchRel({ color: col })"
            />
          </div>
          <!-- 单条连线尺寸（v1.0.9）：覆盖画布全局设置，空值=跟随全局 -->
          <div class="oc-eedit-row oc-eedit-size">
            <span class="oc-eedit-szlabel">线宽</span>
            <input
              type="range"
              min="0.8"
              max="5"
              step="0.2"
              :value="curRel()?.edgeWidth || work.canvasPrefs.edgeWidth || 1.8"
              title="本条连线粗细（拖动即时生效）"
              @input="patchRel({ edgeWidth: Number($event.target.value) })"
            />
            <span class="oc-eedit-szval">{{ (curRel()?.edgeWidth || work.canvasPrefs.edgeWidth || 1.8).toFixed(1) }}</span>
            <button v-if="curRel()?.edgeWidth" class="oc-eedit-szreset" title="恢复跟随全局线宽" @click="patchRel({ edgeWidth: null })">↺</button>
          </div>
          <div class="oc-eedit-row oc-eedit-size">
            <span class="oc-eedit-szlabel">箭头</span>
            <input
              type="range"
              min="0.5"
              max="3"
              step="0.1"
              :value="curRel()?.arrowScale || work.canvasPrefs.arrowSize || 1"
              title="本条连线箭头大小（拖动即时生效）"
              @input="patchRel({ arrowScale: Number($event.target.value) })"
            />
            <span class="oc-eedit-szval">{{ (curRel()?.arrowScale || work.canvasPrefs.arrowSize || 1).toFixed(1) }}×</span>
            <button v-if="curRel()?.arrowScale" class="oc-eedit-szreset" title="恢复跟随全局箭头大小" @click="patchRel({ arrowScale: null })">↺</button>
          </div>
        </div>
      </Teleport>

        <!-- 引用卡目标选择浮层 -->
        <div v-if="citePick" class="oc-pick" :style="{ left: citePick.x + 'px', top: citePick.y + 40 + 'px' }" @mousedown.stop>
          <DLinkPicker @pick="onCitePick" />
        </div>
      </div>
    </div>

    <!-- 模块右键操作栏（v0.4.19：mini 工具栏改右键触发，可 Esc / 点空白关闭；fixed 定位须在 transform 层外） -->
    <div v-if="ctxMenu" class="oc-ctx" :style="{ left: ctxMenu.x + 'px', top: ctxMenu.y + 'px' }" @mousedown.stop @contextmenu.prevent.stop>
      <div class="oc-ctx-title">{{ ctxNode?.title || KIND_META[ctxNode?.kind]?.label || '模块' }}</div>
      <template v-if="ctxNode && ctxNode.kind === 'container'">
        <div class="oc-ctx-swatches">
          <span v-for="c in PALETTE" :key="c" class="oc-ctx-sw" :style="{ background: c }" :title="c" @click="applyColor(c)" />
        </div>
        <div class="oc-ctx-actions">
          <span class="oc-ctx-reset" title="恢复自动配色（按容器顺序）" @click="applyColor('')">↺ 自动配色</span>
        </div>
      </template>
      <div class="oc-ctx-actions oc-ctx-ops">
        <button v-if="ctxNode && ctxNode.kind === 'event'" class="oc-ctx-item" :title="'形状：' + SHAPE_LABEL[ctxNode.shape || 'process'] + '（点击切换）'" @click="ctxAct('shape')"><OIcon name="shape" :size="13" /> {{ SHAPE_LABEL[ctxNode.shape || 'process'] }} ▸</button>
        <button v-if="ctxNode && ctxNode.kind !== 'container'" class="oc-ctx-item" title="编辑内容（也可双击模块）" @click="ctxAct('edit')"><OIcon name="edit" :size="13" /> 编辑内容</button>
        <button v-if="ctxNode && ctxNode.kind === 'textbox'" class="oc-ctx-item oc-ctx-oprow" title="文本框透明度" @click.stop>
          <OIcon name="textbox" :size="13" /> 透明度
          <input type="range" min="0.15" max="1" step="0.05" :value="ctxNode.opacity != null ? ctxNode.opacity : 1" @input="work.olnodeSetOpacity(ctxNode.id, $event.target.value)" />
        </button>
        <button v-if="ctxNode && work.olTypes.length" class="oc-ctx-item" :title="'自定义类型：' + (ctxNode.mtype || '无') + '（点击切换）'" @click="ctxAct('mtype')"><OIcon name="tag" :size="13" /> {{ ctxNode.mtype || '自定义类型' }} ▸</button>
        <button v-if="ctxNode" class="oc-ctx-item" :title="ctxNode.pin ? '取消固定（「整理」时将参与重排）' : '固定位置（「整理」时不动）'" @click="ctxAct('pin')"><OIcon name="pin" :size="13" /> {{ ctxNode.pin ? '取消固定' : '固定位置' }}</button>
        <button v-if="ctxNode" class="oc-ctx-item oc-ctx-danger" title="删除模块（容器会连同子模块）" @click="ctxAct('remove')"><OIcon name="close" :size="13" /> 删除</button>
      </div>
    </div>

    <!-- 画布空白右键：选建模块（连接点必须在连线上右键创建） -->
    <div v-if="blankCtx" class="oc-ctx oc-blankctx" :style="{ left: blankCtx.x + 'px', top: blankCtx.y + 'px' }" @mousedown.stop>
      <div class="oc-ctx-title">在此处新建模块</div>
      <button v-for="(m, k) in CREATE_KINDS" :key="k" class="oc-ctx-item" @click="createAt(k)">
        <OIcon :name="m.icon" :size="13" /> {{ m.label }}
      </button>
    </div>

    <!-- 连接点右键：仅删除 -->
    <div v-if="juncCtx" class="oc-ctx oc-blankctx" :style="{ left: juncCtx.x + 'px', top: juncCtx.y + 'px' }" @mousedown.stop @contextmenu.prevent.stop>
      <button class="oc-ctx-item oc-ctx-danger" title="删除该连接点（接到它上面的连线一并删除）" @click="juncCtxRemove">
        <OIcon name="close" :size="13" /> 删除连接点
      </button>
    </div>

    <!-- 空画布快速开始 -->
    <div v-if="!live.length" class="oc-quick">
      <div class="big">谋篇布局 · 自由画布</div>
      <p>事件、便签、引用卡、容器是积木，连线是脉络——结构由你自由生长，没有固定框架。</p>
      <div class="oc-quick-btns">
        <button @click="applyTemplate(tplThreeAct())">三幕式模板</button>
        <button @click="applyTemplate(tplChapterList(work.liveChapters))">章级清单模板</button>
        <button class="ghost" @click="addNode('event')">空白开始</button>
      </div>
      <p class="oc-quick-tip">拖节点四向锚点拉出连线 · 拖入容器即归组 · 双击模块行内编辑内容 · 拖边缘调整大小 · 空白处双击新建事件</p>
    </div>
  </div>
</template>
