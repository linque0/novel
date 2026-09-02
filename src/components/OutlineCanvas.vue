<!-- 大纲自由模块画布（8.8.2 v0.4.1）：流程图式白板——事件/便签/引用卡/容器/章节锚点自由摆位，
     四向锚点拖线（因果/伏笔/冲突/关联 + 箭头 + 标签）、贝塞尔/正交折线、网格吸附、双密度、断线检测、
     双链卫星与悬停预览（复用全局 DLinkPopover）、骨架模板快速开始；布局数学在 outline/canvas-model.js -->
<script setup>
import { computed, ref, reactive, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useWorkStore } from '../stores/work'
import { usePanZoom, pickAnchors, edgeGeom, arrowHeadDir, anchorsOf } from '../services/graphview'
import { parseTokens, findByTitle, targetById, parseTarget, jumpTo, KIND_LABEL } from '../services/doublelinks'
import {
  relayoutAll, containerRect, effSize, freeSpotFor,
  relColor, relDashed, cycleArrow, nextShape, SHAPE_LABEL,
  REL_KINDS, KIND_META, tplThreeAct, tplChapterList, dashOf, EDGE_STYLES
} from './outline/canvas-model'
import { uid } from '../db/database'
import { NPopover, NSlider } from 'naive-ui'
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
      const A = rectOf(n)
      const B = rectOf(m)
      // 对齐接口：连线锚定在建立时拖出的接口（fromSide）；目标换侧后自动回退到就近接口
      const from = sideFaces(r.fromSide, A, B) ? anchorsOf(A)[r.fromSide] : pickAnchors(A, B)[0]
      const pb = pickAnchors(A, B)[1]
      const g = edgeGeom(from, pb, work.canvasPrefs.edgeStyle)
      out.push({ key: r.id, ownerId: n.id, rel: r, ...g, a: from, b: pb, color: relColor(r.kind), dashed: relDashed(r.kind) })
    }
  }
  return out
})
/* fromSide 是否仍朝向目标（避免节点挪位后连线绕背） */
function sideFaces(side, A, B) {
  if (!side) return false
  const dx = B.x + B.w / 2 - (A.x + A.w / 2)
  const dy = B.y + B.h / 2 - (A.y + A.h / 2)
  if (side === 'right') return dx >= 0
  if (side === 'left') return dx <= 0
  if (side === 'bottom') return dy >= 0
  if (side === 'top') return dy <= 0
  return false
}
/* 箭头三角形：按 rel.arrows 在两端生成 */
const edgeDecor = computed(() => {
  const heads = []
  const fills = []
  for (const e of edges.value) {
    const a = e.rel.arrows || '->'
    if (a === '->' || a === '<->') {
      heads.push(arrowHeadDir(e.b.x, e.b.y, e.endDir))
      fills.push(e.color)
    }
    if (a === '<->') {
      heads.push(arrowHeadDir(e.a.x, e.a.y, e.startDir))
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
function startResize(e, n, dir) {
  if (e.button !== 0) return
  e.stopPropagation()
  e.preventDefault()
  resizing.value = n.id
  const base = { ...(dragSize.get(n.id) || effSize(n, work.canvasPrefs.density)) }
  const p0 = { x: n.canvasX ?? 0, y: n.canvasY ?? 0 }
  const mx = e.clientX
  const my = e.clientY
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
    if (pos) work.olnodeSetCanvas(n.id, pos.x, pos.y)
    if (p) work.olnodeSetSize(n.id, p.w, p.h)
  }
  window.addEventListener('mousemove', move)
  window.addEventListener('mouseup', up)
}

/* ---------- 容器右键色彩快捷栏（v0.4.2） ---------- */
const ctxMenu = ref(null) // { x, y, nodeId }
function onNodeCtx(e, n) {
  if (n.kind !== 'container') return
  e.preventDefault()
  ctxMenu.value = { x: e.clientX, y: e.clientY, nodeId: n.id }
}
function applyColor(c) {
  if (ctxMenu.value) work.olnodeSetColor(ctxMenu.value.nodeId, c)
  ctxMenu.value = null
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
    const target = hitConnTarget(canvasPt(ev), new Set([n.id]))
    if (!target) return
    const rel = work.olnodeRelAdd(n.id, target.id, { fromSide: side })
    if (!rel) return
    const g = edgeGeom(...pickAnchors(rectOf(n), rectOf(target)), work.canvasPrefs.edgeStyle)
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
function openEdgeEdit(ownerId, relId, mid) {
  edgeEdit.value = { ownerId, relId, mx: mid.x, my: mid.y }
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
    // 编辑态必须有确定高度（否则 absolute 编辑器撑不开节点，内容不可见），并给足最小编辑区
    height: n.kind === 'container' ? r.h + 'px' : editing ? Math.max(r.h, 96) + 'px' : 'auto',
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
function onKey(e) {
  const t = e.target
  if (t && (t.matches?.('input, textarea, [contenteditable="true"]') || t.isContentEditable)) return
  if (!(e.ctrlKey || e.metaKey)) return
  const k = e.key.toLowerCase()
  if (k === 'z' && !e.shiftKey) {
    e.preventDefault()
    work.olnodeUndo()
  } else if (k === 'y' || (k === 'z' && e.shiftKey)) {
    e.preventDefault()
    work.olnodeRedo()
  }
}
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
          <span class="oc-chip" title="画布设置：连线粗细等">⚙ 设置</span>
        </template>
        <div class="oc-settings">
          <div class="oc-settings-row">
            <span class="oc-settings-label">连线粗细</span>
            <NSlider v-model:value="edgeWidthModel" :min="0.8" :max="5" :step="0.2" style="width: 150px" />
            <span class="oc-settings-val">{{ (work.canvasPrefs.edgeWidth || 1.8).toFixed(1) }}px</span>
          </div>
          <div class="oc-settings-tip">调整画布全部连线的显示粗细；线型（实线/虚线/点线）在连线编辑浮层中按条设置。</div>
        </div>
      </NPopover>
      <span style="flex: 1"></span>
      <span class="oc-count">{{ visNodes.length }} 模块 · {{ edges.length }} 连线</span>
      <button class="om-btn" title="撤销 (Ctrl+Z)" @click="work.olnodeUndo()">↶</button>
      <button class="om-btn" title="重做 (Ctrl+Y)" @click="work.olnodeRedo()">↷</button>
      <button class="om-btn oc-tidy" title="整理布局（固定模块除外）" @click="tidyAll">整理</button>
      <button class="om-btn" title="缩小" @click="zoom = Math.max(0.3, zoom - 0.15)">－</button>
      <span class="oc-zoom">{{ Math.round(zoom * 100) }}%</span>
      <button class="om-btn" title="放大" @click="zoom = Math.min(2.2, zoom + 0.15)">＋</button>
      <button class="om-btn" title="适应视图" @click="fitView">适应</button>
    </div>

    <div ref="canvasEl" class="om-canvas oc-canvas" @mousedown="onPanStart" @wheel.prevent="onWheel" @dblclick.self="addNode('event')">
      <div class="om-inner" :style="innerStyle">
        <svg class="om-edges oc-edges" :width="Math.max(2400, bounds.x + bounds.w + 500)" :height="Math.max(1600, bounds.y + bounds.h + 500)">
          <path v-for="e in edges" :key="'h' + e.key" class="oc-edge-hit" :d="e.d" @mousedown.stop="openEdgeEdit(e.ownerId, e.rel.id, e.mid)" />
          <path
            v-for="e in edges"
            :key="'v' + e.key"
            :d="e.d"
            fill="none"
            :stroke="e.color"
            :stroke-width="work.canvasPrefs.edgeWidth || 1.8"
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
          :class="['oc-' + n.kind, 'sh-' + (n.shape || 'process'), { sel: work.selOlnodeId === n.id, flash: flashIds.has(n.id), pinned: n.pin, resizing: resizing === n.id, editing: editText && editText.id === n.id, 'dl-link': n.kind === 'cite' && n.refId }]"
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
              <button class="oc-caret" :title="n.fold ? '展开子模块' : '折叠子模块'" @click.stop="work.olnodeToggleFold(n.id)">{{ n.fold ? '▸' : '▾' }}</button>
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
            <button v-else-if="n.kind === 'cite' && !n.refId" class="oc-cite-add" title="选择引用目标" @click.stop="citePick = { nodeId: n.id, x: posOf(n).x, y: posOf(n).y }">＋ 选择目标</button>
            <div v-else class="oc-body" :class="{ 'oc-textbody': n.kind === 'textbox' }">
              <div class="oc-label">{{ labelOf(n) }}</div>
              <div v-if="showFullText(n)" class="oc-fulltext">{{ plainText(n) }}</div>
              <div v-else class="om-sub">{{ plainText(n).split('\n')[0].slice(0, 40) || subOf(n) || '&nbsp;' }}</div>
              <span v-if="!showFullText(n) && n.mtype && work.canvasPrefs.density === 'detail'" class="om-mtype" :style="{ color: mtypeColorOf(n.mtype), borderColor: mtypeColorOf(n.mtype) }">{{ n.mtype }}</span>
            </div>
          </template>

          <div v-if="work.selOlnodeId === n.id" class="oc-mini" @mousedown.stop>
            <button v-if="n.kind === 'event'" :title="'形状：' + SHAPE_LABEL[n.shape || 'process'] + '（点击切换）'" @click.stop="work.olnodeSetShape(n.id, nextShape(n.shape))">◇</button>
            <button v-if="n.kind !== 'container'" title="编辑内容（也可双击模块）" @click.stop="startInlineEdit(n)">✎</button>
            <span v-if="n.kind === 'textbox'" class="oc-mini-op" title="文本框透明度">
              <input type="range" min="0.15" max="1" step="0.05" :value="n.opacity != null ? n.opacity : 1" @input="work.olnodeSetOpacity(n.id, $event.target.value)" />
              透
            </span>
            <button v-if="work.olTypes.length" :title="'自定义类型：' + (n.mtype || '无') + '（点击切换）'" @click.stop="cycleMtype(n)">🏷</button>
            <button :title="n.pin ? '取消固定' : '固定位置（「整理」时不动）'" @click.stop="work.olnodeSetPin(n.id, !n.pin)">{{ n.pin ? '📌' : '📍' }}</button>
            <button class="oc-mini-x" title="删除模块" @click.stop="onRemove(n)">✕</button>
          </div>
          <span v-for="sd in ['top', 'right', 'bottom', 'left']" :key="sd" class="oc-apt" :data-side="sd" :title="'拖到目标模块建立连线'" @mousedown="startConnect($event, n)" />
          <span class="oc-rs" data-dir="e" title="拖拽调整宽度" @mousedown="startResize($event, n, 'e')" />
          <span class="oc-rs" data-dir="w" title="拖拽调整宽度" @mousedown="startResize($event, n, 'w')" />
          <span class="oc-rs" data-dir="s" title="拖拽调整高度" @mousedown="startResize($event, n, 's')" />
          <span class="oc-rs" data-dir="n" title="拖拽调整高度" @mousedown="startResize($event, n, 'n')" />
          <span class="oc-rs oc-rs-corner" data-dir="se" title="拖拽调整大小" @mousedown="startResize($event, n, 'se')" />
          <span class="oc-rs oc-rs-corner" data-dir="sw" title="拖拽调整大小" @mousedown="startResize($event, n, 'sw')" />
          <span class="oc-rs oc-rs-corner" data-dir="ne" title="拖拽调整大小" @mousedown="startResize($event, n, 'ne')" />
          <span class="oc-rs oc-rs-corner" data-dir="nw" title="拖拽调整大小" @mousedown="startResize($event, n, 'nw')" />
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
        >{{ e.rel.label }}</div>

        <!-- 边编辑浮层 -->
        <div v-if="edgeEdit" class="oc-eedit" :style="{ left: edgeEdit.mx + 'px', top: edgeEdit.my + 'px' }" @mousedown.stop>
          <div class="oc-eedit-row">
            <input ref="edgeLabelInput" class="rp-input" :value="curRel()?.label || ''" placeholder="连线标签…" @input="patchRel({ label: $event.target.value })" @keydown.enter="edgeEdit = null" @keydown.esc="edgeEdit = null" />
            <button class="om-btn" :title="edgeEdit && curRel() ? '箭头：' + { '->': '单向', '<->': '双向', '--': '无向' }[curRel().arrows || '->'] : '箭头'" @click="patchRel({ arrows: cycleArrow(curRel()?.arrows || '->') })">{{ arrowsGlyph(curRel()?.arrows) }}</button>
            <button class="om-btn oc-mini-x" title="删除连线" @click="removeRel">✕</button>
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
        </div>

        <!-- 引用卡目标选择浮层 -->
        <div v-if="citePick" class="oc-pick" :style="{ left: citePick.x + 'px', top: citePick.y + 40 + 'px' }" @mousedown.stop>
          <DLinkPicker @pick="onCitePick" />
        </div>
      </div>
    </div>

    <!-- 容器右键色彩快捷栏（fixed 定位须在 transform 层外） -->
    <div v-if="ctxMenu" class="oc-ctx" :style="{ left: ctxMenu.x + 'px', top: ctxMenu.y + 'px' }" @mousedown.stop>
      <div class="oc-ctx-title">容器颜色</div>
      <div class="oc-ctx-swatches">
        <span v-for="c in PALETTE" :key="c" class="oc-ctx-sw" :style="{ background: c }" :title="c" @click="applyColor(c)" />
      </div>
      <div class="oc-ctx-actions">
        <span class="oc-ctx-reset" title="恢复自动配色（按容器顺序）" @click="applyColor('')">↺ 自动配色</span>
      </div>
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
