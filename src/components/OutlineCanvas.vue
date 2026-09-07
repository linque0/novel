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
  sideBetween, routeEdge
} from './outline/canvas-model'
import { uid } from '../db/database'
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
      const m = nodeById(r.toId)
      if (!m || !posOf(m) || hiddenIds.value.has(m.id)) continue
      const g = edgeGeomFor(n, r)
      if (!g) continue
      out.push({ key: r.id, ownerId: n.id, rel: r, ...g, color: edgeColor(r), dashed: relDashed(r.kind) })
    }
  }
  return out
})
/* v0.4.15 严格端口：从哪个接口来就从哪个接口出，接入侧同样在建立时记录（toSide）；
 * 旧连线缺端口记录时按首次渲染位置**一次性补记**（此后不再随挪位重算）；
 * 连线途经任何模块（含两端节点本体）时正交绕行 */
const migratedSides = new Set()
function edgeGeomFor(n, r) {
  const m = nodeById(r.toId)
  if (!m || !posOf(m)) return null
  const A = rectOf(n)
  const B = rectOf(m)
  const sb = sideBetween(A, B)
  const fromSide = r.fromSide || sb.from
  const toSide = r.toSide || sb.to
  if ((!r.fromSide || !r.toSide) && !migratedSides.has(r.id)) {
    migratedSides.add(r.id)
    work.olnodeRelUpdate(n.id, r.id, { fromSide, toSide })
  }
  const from = anchorsOf(A)[fromSide]
  const to = anchorsOf(B)[toSide]
  if (!from || !to) return null
  /* 两端节点本体也是障碍：端口严格后，连线中段不得从节点身上穿过 */
  const obstacles = [
    { x: A.x, y: A.y, w: A.w, h: A.h },
    { x: B.x, y: B.y, w: B.w, h: B.h },
    ...edgeObstacles(n.id, m.id)
  ]
  /* 连接点（arrow）两端不出桩（stub=0）：线直接从点中心出发，
   * 与连接点所吸附的既有连线无缝衔接 */
  const isJunc = n.kind === 'arrow' || m.kind === 'arrow'
  return isJunc
    ? routeEdge(from, fromSide, to, toSide, obstacles, work.canvasPrefs.edgeStyle, 0)
    : routeEdge(from, fromSide, to, toSide, obstacles, work.canvasPrefs.edgeStyle)
}
/* 障碍集合：除两端节点外的可见模块矩形；容器仅当两端都在其外时才算障碍（子模块边必然穿越所在容器）；
 * 连接点（arrow）是接线柱不是遮挡物——线从它身上过才是常态，不作障碍 */
function edgeObstacles(fromId, toId) {
  const out = []
  for (const n of visNodes.value) {
    if (n.id === fromId || n.id === toId) continue
    if (n.kind === 'arrow') continue
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
    if (a === '->' || a === '<->') {
      heads.push(arrowHeadDir(e.b.x, e.b.y, e.endDir, 7 * relArrowScale(e.rel)))
      fills.push(e.color)
    }
    if (a === '<->') {
      heads.push(arrowHeadDir(e.a.x, e.a.y, e.startDir, 7 * relArrowScale(e.rel)))
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
/* 连线右键（v1.0.11）：弹「创建连接点」菜单——在右键落点（吸附到连线上最近点）建接线柱 */
const edgeCtx = ref(null) // { x, y, ownerId, relId, px, py }  屏幕坐标 + 画布落点
/* 连线命中路径自身的 contextmenu（.stop 阻止冒泡，画布层收不到）——直接在此建菜单态。
 * 不做 elementFromPoint 反查也能命中：事件目标就是连线命中路径 */
function openEdgeCtxFromEvent(e, edge) {
  const pt = canvasPt(e)
  edgeCtx.value = { x: e.clientX, y: e.clientY, ownerId: edge.ownerId, relId: edge.rel.id, px: pt.x, py: pt.y }
}
const CREATE_KINDS = Object.fromEntries(Object.entries(KIND_META).filter(([k]) => k !== 'anchor' && k !== 'volume'))
function onCanvasCtx(e) {
  /* Chromium 对 SVG pointer-events:stroke 路径的 contextmenu 命中可能与 mousedown 不一致
     （mousedown 命中路径，contextmenu 却派发给画布）——用 elementFromPoint 反查真实落点 */
  const t = document.elementFromPoint(e.clientX, e.clientY)
  const hitEl = t && (t.classList?.contains('oc-edge-hit') ? t : t.closest?.('.oc-edge-hit'))
  if (hitEl && hitEl.dataset.owner && hitEl.dataset.rel) {
    const pt = canvasPt(e)
    edgeCtx.value = { x: e.clientX, y: e.clientY, ownerId: hitEl.dataset.owner, relId: hitEl.dataset.rel, px: pt.x, py: pt.y }
    return
  }
  if (e.target.closest?.('.oc-node, .oc-elabel, .oc-edge-hit, .oc-eedit, .rg-eedit, .oc-ctx')) return // 节点/连线/标签/浮层/菜单上不弹创建菜单（容器右键走调色板，连线右键走连接点菜单）
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
/* 点到折线/贝塞尔路径的最近距离（采样法）：连线落点检测用 */
function distToEdge(pt, e) {
  // e.a/e.b 为两端锚点；正交折线采样 pathFromPoints 的拐点不可得，用均匀采样近似
  const N = 24
  let best = Infinity
  let prev = null
  for (let i = 0; i <= N; i++) {
    const t = i / N
    let p
    if (e.d.startsWith('M') && e.d.includes('C ') && !e.d.includes(' L ')) {
      // 贝塞尔：控制点未知，按两端点连线近似中段采样（贝塞尔落点检测退化处理）
      p = { x: e.a.x + (e.b.x - e.a.x) * t, y: e.a.y + (e.b.y - e.a.y) * t }
    } else {
      p = { x: e.a.x + (e.b.x - e.a.x) * t, y: e.a.y + (e.b.y - e.a.y) * t }
    }
    if (prev) {
      // 线段 prev→p 上最近点
      const dx = p.x - prev.x
      const dy = p.y - prev.y
      const l2 = dx * dx + dy * dy || 1
      let s = ((pt.x - prev.x) * dx + (pt.y - prev.y) * dy) / l2
      s = Math.max(0, Math.min(1, s))
      const qx = prev.x + dx * s
      const qy = prev.y + dy * s
      best = Math.min(best, Math.hypot(pt.x - qx, pt.y - qy))
    }
    prev = p
  }
  return best
}
/* 落点命中既有连线：返回被命中的边（距路径 < 12px），供拖线释放时建连接点 */
function hitEdgeAt(pt, excludeOwnerId) {
  for (const e of edges.value) {
    if (excludeOwnerId && e.ownerId === excludeOwnerId) continue
    if (distToEdge(pt, e) < 12) return e
  }
  return null
}
/* 点到连线上的最近点（采样法）：连接点吸附到被右键的连线上 */
function snapPtOnEdge(pt, e) {
  const N = 48
  let best = null
  let prev = null
  for (let i = 0; i <= N; i++) {
    const t = i / N
    const p = { x: e.a.x + (e.b.x - e.a.x) * t, y: e.a.y + (e.b.y - e.a.y) * t }
    if (prev) {
      const dx = p.x - prev.x
      const dy = p.y - prev.y
      const l2 = dx * dx + dy * dy || 1
      let s = ((pt.x - prev.x) * dx + (pt.y - prev.y) * dy) / l2
      s = Math.max(0, Math.min(1, s))
      const q = { x: prev.x + dx * s, y: prev.y + dy * s }
      if (!best || Math.hypot(pt.x - q.x, pt.y - q.y) < Math.hypot(pt.x - best.x, pt.y - best.y)) best = q
    }
    prev = p
  }
  return best || pt
}
/* 在连线落点处生成连接点节点（kind:'arrow'，接线柱），返回该节点 */
function junctionAt(pt) {
  const row = work.olnodeAdd(null, { kind: 'arrow', title: '', canvasX: snap(pt.x - 10), canvasY: snap(pt.y - 10), w: 20, h: 20 })
  return row
}
/* 连线右键菜单动作：在右键落点（吸附到被右键连线路径最近点）直接创建连接点 */
function edgeCtxCreate() {
  const st = edgeCtx.value
  edgeCtx.value = null
  if (!st) return
  const e = edges.value.find((x) => x.ownerId === st.ownerId && x.rel.id === st.relId)
  const pt = e ? snapPtOnEdge({ x: st.px, y: st.py }, e) : { x: st.px, y: st.py }
  const row = junctionAt(pt)
  work.selOlnodeId = row.id
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
    const target = hitConnTarget(pt, new Set([n.id]))
    let finalTarget = target
    let createdJunction = null
    /* 线连线（v1.0.10）：落点不在任何模块上、但贴近某条既有连线 → 在该处自动生成连接点，接到连接点上 */
    if (!target) {
      const hitEdge = hitEdgeAt(pt, n.id)
      if (hitEdge) {
        createdJunction = junctionAt(pt)
        finalTarget = createdJunction
      }
    }
    if (!finalTarget) return
    /* 记录两侧端口：从拖出的接口（fromSide）来，接入侧取面向源节点一侧（toSide） */
    const tb = rectOf(finalTarget)
    const toSide = sideBetween(rectOf(n), tb).to
    const rel = work.olnodeRelAdd(n.id, finalTarget.id, { fromSide: side, toSide })
    if (!rel) {
      if (createdJunction) work.olnodeRemove(createdJunction.id) // 建边失败回滚连接点
      return
    }
    const g = edgeGeomFor(n, rel) || { mid: pt }
    openEdgeEdit(n.id, rel.id, g.mid)
  }
  window.addEventListener('mousemove', move)
  window.addEventListener('mouseup', up)
}
const connPath = computed(() => {
  const c = connecting.value
  if (!c) return ''
  const from = nodeById(c.fromId)
  const anchor = from && rectOf(from) ? anchorsOf(rectOf(from))[c.side] : null
  const start = anchor || c
  return `M ${start.x} ${start.y} L ${c.x} ${c.y}`
})

/* ---------- 边编辑浮层 ---------- */
const edgeLabelInput = ref(null)
/* 浮层弹出方向：中点上方空间不足时翻转向下（否则被画布 overflow 裁掉），横向夹在可视区内 */
function popPlacement(mid) {
  const el = canvasEl.value
  if (!el) return { mx: mid.x, flip: false }
  const r = el.getBoundingClientRect()
  const sx = r.left + tx.value + mid.x * zoom.value
  const sy = r.top + ty.value + mid.y * zoom.value
  const halfW = 120 * zoom.value
  const cx = Math.min(Math.max(sx, r.left + 6 + halfW), r.right - 6 - halfW)
  const roomUp = sy - r.top
  return { mx: (cx - r.left - tx.value) / zoom.value, flip: roomUp < 170 * zoom.value && r.bottom - sy > roomUp }
}
function openEdgeEdit(ownerId, relId, mid) {
  const p = popPlacement(mid)
  edgeEdit.value = { ownerId, relId, mx: p.mx, my: mid.y, flip: p.flip }
  nextTick(() => edgeLabelInput.value?.focus())
}
function curRel() {
  const st = edgeEdit.value
  if (!st) return null
  const n = nodeById(st.ownerId)
  return (n && Array.isArray(n.rels) ? n.rels.find((r) => r.id === st.relId) : null) || null
}
function patchRel(patch) {
  const st = edgeEdit.value
  if (st) work.olnodeRelUpdate(st.ownerId, st.relId, patch)
}
function removeRel() {
  const st = edgeEdit.value
  if (st) work.olnodeRelRemove(st.ownerId, st.relId)
  edgeEdit.value = null
}
function closeFloaters() {
  edgeEdit.value = null
  citePick.value = null
  editTitle.value = null
}
function onWinDown(e) {
  if (edgeEdit.value && !e.target.closest?.('.oc-eedit, .oc-edge-hit, .oc-elabel')) edgeEdit.value = null
  if (citePick.value && !e.target.closest?.('.oc-pick')) citePick.value = null
  if (editTitle.value && !e.target.closest?.('.oc-title-edit')) commitTitle()
  if (ctxMenu.value && !e.target.closest?.('.oc-ctx')) ctxMenu.value = null
  if (blankCtx.value && !e.target.closest?.('.oc-ctx')) blankCtx.value = null
  if (edgeCtx.value && !e.target.closest?.('.oc-ctx, .oc-edge-hit')) edgeCtx.value = null
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
  if (n.kind === 'arrow') return // 箭头无文字内容，双击不进编辑
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
    height: n.kind === 'container' ? r.h + 'px' : editing ? Math.max(r.h, 96) + 'px' : n.kind === 'arrow' ? r.h + 'px' : Math.max(r.h, 36) + 'px',
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
  if (live.value.length) nextTick(fitView)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('mousedown', onWinDown, true)
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
          <path v-for="e in edges" :key="'h' + e.key" class="oc-edge-hit" :d="e.d" :data-owner="e.ownerId" :data-rel="e.rel.id" @mousedown.stop="openEdgeEdit(e.ownerId, e.rel.id, e.mid)" @contextmenu.prevent.stop="openEdgeCtxFromEvent($event, e)">
            <title>点击编辑连线 · 右键创建连接点</title>
          </path>
          <path
            v-for="e in edges"
            :key="'v' + e.key"
            :d="e.d"
            fill="none"
            :stroke="e.color"
            :stroke-width="relEdgeWidth(e.rel)"
            :stroke-dasharray="dashOf(e.rel.style, e.rel.kind)"
            :opacity="edgeEdit && edgeEdit.relId === e.key ? 1 : 0.85"
          />
          <polygon v-for="(h, i) in edgeDecor.heads" :key="'a' + i" :points="h" :fill="edgeDecor.fills[i]" />
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
            <!-- 连接点模块（v1.0.10）：线与线之间的接线柱——小圆点本体，四向锚点可拖线；
                 拖线落到既有连线上时自动在该处生成连接点，实现连线↔连线互连 -->
            <template v-if="n.kind === 'arrow'">
              <span class="oc-junction" :title="'连接点' + (n.title ? ' · ' + n.title : '') + '——拖四向锚点接线'"></span>
            </template>
            <!-- 菱形/平行四边形：SVG 描边代替 clip-path（clip 会裁掉边框、锚点与手柄） -->
            <svg v-else-if="n.kind === 'event' && (n.shape === 'diamond' || n.shape === 'para')" class="oc-shape" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
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

          <span v-for="sd in ['top', 'right', 'bottom', 'left']" :key="sd" class="oc-apt" :data-side="sd" :title="'拖到目标模块/连线/连接点建立连线'" @mousedown="startConnect($event, n)" />
          <template v-if="n.kind !== 'arrow'">
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

        <!-- 连线标签 -->
        <div
          v-for="e in edges.filter((x) => x.rel.label)"
          :key="'l' + e.key"
          class="oc-elabel"
          :style="{ left: e.mid.x + 'px', top: e.mid.y + 'px', borderColor: e.color, color: e.color }"
          @mousedown.stop="openEdgeEdit(e.ownerId, e.rel.id, e.mid)"
          @contextmenu.prevent.stop="openEdgeEdit(e.ownerId, e.rel.id, e.mid)"
        >{{ e.rel.label }}</div>

        <!-- 边编辑浮层 -->
        <div v-if="edgeEdit" class="oc-eedit" :class="{ flip: edgeEdit.flip }" :style="{ left: edgeEdit.mx + 'px', top: edgeEdit.my + 'px' }" @mousedown.stop @contextmenu.prevent.stop>
          <div class="oc-eedit-row">
            <input ref="edgeLabelInput" class="rp-input" :value="curRel()?.label || ''" placeholder="连线标签…" @input="patchRel({ label: $event.target.value })" @keydown.enter="edgeEdit = null" @keydown.esc="edgeEdit = null" />
            <button class="om-btn" :title="edgeEdit && curRel() ? '箭头：' + { '->': '单向', '<->': '双向', '--': '无向' }[curRel().arrows || '->'] : '箭头'" @click="patchRel({ arrows: cycleArrow(curRel()?.arrows || '->') })">{{ arrowsGlyph(curRel()?.arrows) }}</button>
            <button class="om-btn oc-mini-x" title="删除连线" @click="removeRel"><OIcon name="close" :size="12" /></button>
          </div>
          <div class="oc-eedit-row oc-kindrow">
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
          <div class="oc-eedit-row oc-eedit-swatches">
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
        <button v-if="ctxNode && ctxNode.kind !== 'container' && ctxNode.kind !== 'arrow'" class="oc-ctx-item" title="编辑内容（也可双击模块）" @click="ctxAct('edit')"><OIcon name="edit" :size="13" /> 编辑内容</button>
        <button v-if="ctxNode && ctxNode.kind === 'textbox'" class="oc-ctx-item oc-ctx-oprow" title="文本框透明度" @click.stop>
          <OIcon name="textbox" :size="13" /> 透明度
          <input type="range" min="0.15" max="1" step="0.05" :value="ctxNode.opacity != null ? ctxNode.opacity : 1" @input="work.olnodeSetOpacity(ctxNode.id, $event.target.value)" />
        </button>
        <button v-if="ctxNode && work.olTypes.length" class="oc-ctx-item" :title="'自定义类型：' + (ctxNode.mtype || '无') + '（点击切换）'" @click="ctxAct('mtype')"><OIcon name="tag" :size="13" /> {{ ctxNode.mtype || '自定义类型' }} ▸</button>
        <button v-if="ctxNode" class="oc-ctx-item" :title="ctxNode.pin ? '取消固定（「整理」时将参与重排）' : '固定位置（「整理」时不动）'" @click="ctxAct('pin')"><OIcon name="pin" :size="13" /> {{ ctxNode.pin ? '取消固定' : '固定位置' }}</button>
        <button v-if="ctxNode" class="oc-ctx-item oc-ctx-danger" title="删除模块（容器会连同子模块）" @click="ctxAct('remove')"><OIcon name="close" :size="13" /> 删除</button>
      </div>
    </div>

    <!-- 画布空白右键：选建模块（v0.4.9） -->
    <div v-if="blankCtx" class="oc-ctx oc-blankctx" :style="{ left: blankCtx.x + 'px', top: blankCtx.y + 'px' }" @mousedown.stop>
      <div class="oc-ctx-title">在此处新建模块</div>
      <button v-for="(m, k) in CREATE_KINDS" :key="k" class="oc-ctx-item" @click="createAt(k)">
        <OIcon :name="m.icon" :size="13" /> {{ m.label }}
      </button>
    </div>

    <!-- 连线右键（v1.0.12）：仅创建连接点（吸附在连线路径上） -->
    <div v-if="edgeCtx" class="oc-ctx oc-blankctx" :style="{ left: edgeCtx.x + 'px', top: edgeCtx.y + 'px' }" @mousedown.stop @contextmenu.prevent.stop>
      <button class="oc-ctx-item" title="在右键位置创建连接点（吸附在连线上，从它拖出新连线与原线无缝衔接）" @click="edgeCtxCreate">
        <OIcon name="link" :size="13" /> 创建连接点
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
