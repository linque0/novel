/* 自由模块画布纯逻辑（8.8.2 / 计划书 9.4.2）：元数据、尺寸、容器派生盒、布局算法、骨架模板。
 * 零依赖（不 import Vue），可被 node 直跑自测（tools/canvas-model-test.mjs）。 */

/* ---------- 节点尺寸与落点 ---------- */

/** 画布节点尺寸（kind × 密度），container 为空态基准尺寸 */
export function canvasNodeSize(n, density = 'detail') {
  const c = density === 'compact'
  switch (n.kind) {
    case 'event':
      return c ? { w: 138, h: 40 } : { w: 178, h: 54 }
    case 'note':
      return c ? { w: 130, h: 58 } : { w: 158, h: 76 }
    case 'cite':
      return { w: 154, h: 34 }
    case 'anchor':
    case 'volume':
      return c ? { w: 142, h: 38 } : { w: 180, h: 48 }
    default:
      return { w: 280, h: 120 } // container
  }
}

/** 形状尺寸加幅：菱形需更大面积容纳文字；节点自定义 w/h 优先（显式拖拽结果，容器作为派生盒下限） */
export function effSize(n, density = 'detail') {
  if (n.w != null || n.h != null) {
    const s = canvasNodeSize(n, density)
    return {
      w: Math.max(96, n.w != null ? n.w : s.w),
      h: Math.max(36, n.h != null ? n.h : s.h)
    }
  }
  const s = canvasNodeSize(n, density)
  if (n.kind === 'event' && n.shape === 'diamond') return { w: s.w + 46, h: s.h + 42 }
  return s
}

/* ---------- 连线样式（v0.4.1 界面优化）：实线 / 虚线 / 点线 ---------- */
export const EDGE_STYLES = [
  { key: 'solid', label: '实线' },
  { key: 'dashed', label: '虚线' },
  { key: 'dotted', label: '点线' }
]
/** 渲染 dasharray：显式线型优先，未设置时伏笔类默认虚线 */
export function dashOf(style, kind) {
  if (style === 'dashed') return '5 4'
  if (style === 'dotted') return '2 3'
  if (style === 'solid') return null
  return relDashed(kind) ? '5 4' : null
}

/* 连线自定义色板（v0.4.12）：首项=主题色（空值，跟随关系类型配色），其余为常用色 */
export const EDGE_COLORS = ['#2980b9', '#c0392b', '#8e44ad', '#d35400', '#27ae60', '#7f8c8d']
/** 边渲染色：自定义 color 优先，否则按关系类型配色 */
export function edgeColor(rel) {
  return rel.color || relColor(rel.kind)
}

/* ---------- 连线端口严格化 + 避障路由（v0.4.14） ----------
 * 端口在建立时记录（fromSide/toSide），渲染严格使用，不随节点挪位回退就近侧；
 * 连线途经其他模块矩形时自动绕行（正交折线绕障）。 */

/** 接口外法线方向 */
export function sideDir(side) {
  if (side === 'right') return { x: 1, y: 0 }
  if (side === 'left') return { x: -1, y: 0 }
  if (side === 'bottom') return { x: 0, y: 1 }
  if (side === 'top') return { x: 0, y: -1 }
  return { x: 1, y: 0 }
}

/** 依据两矩形相对位置给出默认端口组合（建边未记录侧 / 旧数据回退用） */
export function sideBetween(A, B) {
  const dx = B.x + B.w / 2 - (A.x + A.w / 2)
  const dy = B.y + B.h / 2 - (A.y + A.h / 2)
  if (Math.abs(dx) >= Math.abs(dy)) {
    return { from: dx >= 0 ? 'right' : 'left', to: dx >= 0 ? 'left' : 'right' }
  }
  return { from: dy >= 0 ? 'bottom' : 'top', to: dy >= 0 ? 'top' : 'bottom' }
}

/** 轴对齐线段是否穿过矩形（严格重叠：仅贴合边缘不算穿过） */
export function segHitsRect(ax, ay, bx, by, r) {
  const minx = Math.min(ax, bx)
  const maxx = Math.max(ax, bx)
  const miny = Math.min(ay, by)
  const maxy = Math.max(ay, by)
  return maxx > r.x && minx < r.x + r.w && maxy > r.y && miny < r.y + r.h
}

/** 折点去重（合并重复点与共线中点） */
function dedupePoints(pts) {
  const out = []
  for (const p of pts) {
    const last = out[out.length - 1]
    if (last && Math.abs(last.x - p.x) < 0.5 && Math.abs(last.y - p.y) < 0.5) continue
    out.push({ x: p.x, y: p.y })
  }
  for (let i = out.length - 2; i >= 1; i--) {
    const a = out[i - 1]
    const m = out[i]
    const b = out[i + 1]
    if ((Math.abs(a.x - m.x) < 0.5 && Math.abs(m.x - b.x) < 0.5) || (Math.abs(a.y - m.y) < 0.5 && Math.abs(m.y - b.y) < 0.5)) out.splice(i, 1)
  }
  return out
}

/** 单段绕障：横向段从矩形上/下缘绕，纵向段从左/右缘绕（取近侧） */
function detourAround(a, b, r, margin) {
  if (Math.abs(a.y - b.y) < 0.5) {
    const xa = Math.max(Math.min(a.x, b.x), r.x)
    const xb = Math.min(Math.max(a.x, b.x), r.x + r.w)
    const ny = a.y <= r.y + r.h / 2 ? r.y - margin : r.y + r.h + margin
    return [{ x: xa, y: a.y }, { x: xa, y: ny }, { x: xb, y: ny }, { x: xb, y: a.y }]
  }
  const ya = Math.max(Math.min(a.y, b.y), r.y)
  const yb = Math.min(Math.max(a.y, b.y), r.y + r.h)
  const nx = a.x <= r.x + r.w / 2 ? r.x - margin : r.x + r.w + margin
  return [{ x: a.x, y: ya }, { x: nx, y: ya }, { x: nx, y: yb }, { x: a.x, y: yb }]
}

/**
 * 正交绕障路由：两端沿各自端口外法线出桩，中途逐段检查障碍并绕行。
 * 返回折点数组（含起终点）。
 */
export function routeOrthogonal(from, fromSide, to, toSide, obstacles, stub = 18, margin = 16) {
  const ds = sideDir(fromSide)
  const de = sideDir(toSide)
  const p1 = { x: from.x + ds.x * stub, y: from.y + ds.y * stub }
  const p2 = { x: to.x + de.x * stub, y: to.y + de.y * stub }
  let pts = [from, p1]
  if (ds.x !== 0 && de.x !== 0) {
    const mx = (p1.x + p2.x) / 2
    pts.push({ x: mx, y: p1.y }, { x: mx, y: p2.y }, p2)
  } else if (ds.y !== 0 && de.y !== 0) {
    const my = (p1.y + p2.y) / 2
    pts.push({ x: p1.x, y: my }, { x: p2.x, y: my }, p2)
  } else if (ds.x !== 0) {
    pts.push({ x: p2.x, y: p1.y }, p2)
  } else {
    pts.push({ x: p1.x, y: p2.y }, p2)
  }
  pts.push(to)
  pts = dedupePoints(pts)
  /* 逐段绕障：每次处理最先遇到的一个交叉后重扫（最多 5 轮防抖） */
  for (let round = 0; round < 5; round++) {
    let hit = null
    outer: for (let i = 0; i < pts.length - 1; i++) {
      for (const ob of obstacles) {
        if (segHitsRect(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, ob)) {
          hit = { i, ob }
          break outer
        }
      }
    }
    if (!hit) break
    pts.splice(hit.i + 1, 0, ...detourAround(pts[hit.i], pts[hit.i + 1], hit.ob, margin))
    pts = dedupePoints(pts)
  }
  return pts
}

/** 折线路径（拐圆角），返回 SVG d 字符串 */
export function pathFromPoints(pts, r = 10) {
  if (!pts || pts.length < 2) return ''
  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i]
    const prev = pts[i - 1]
    const next = pts[i + 1]
    const l1 = Math.hypot(p.x - prev.x, p.y - prev.y) || 1
    const l2 = Math.hypot(next.x - p.x, next.y - p.y) || 1
    const rr = Math.min(r, l1 / 2, l2 / 2)
    const u = { x: (p.x - prev.x) / l1, y: (p.y - prev.y) / l1 }
    const v = { x: (next.x - p.x) / l2, y: (next.y - p.y) / l2 }
    d += ` L ${p.x - u.x * rr} ${p.y - u.y * rr} Q ${p.x} ${p.y}, ${p.x + v.x * rr} ${p.y + v.y * rr}`
  }
  const last = pts[pts.length - 1]
  d += ` L ${last.x} ${last.y}`
  return d
}

/** 折线中点（按长度一半处）——标签/浮层定位 */
export function polyMid(pts) {
  if (!pts || pts.length < 2) return { x: 0, y: 0 }
  let total = 0
  for (let i = 0; i < pts.length - 1; i++) total += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y)
  let acc = 0
  for (let i = 0; i < pts.length - 1; i++) {
    const l = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y)
    if (acc + l >= total / 2) {
      const t = (total / 2 - acc) / (l || 1)
      return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * t, y: pts[i].y + (pts[i + 1].y - pts[i].y) * t }
    }
    acc += l
  }
  return pts[pts.length - 1]
}

/**
 * 严格端口连线统一入口：返回 { d, mid, startDir, endDir, a, b, avoided }。
 * bezier 风格且不穿障碍时用贝塞尔（控制点沿端口外法线）；
 * 正交风格或贝塞尔途经障碍时改走正交绕障折线。
 */
export function routeEdge(a, fromSide, b, toSide, obstacles = [], style = 'bezier', stub = 18, margin = 16) {
  const ds = sideDir(fromSide)
  const de = sideDir(toSide)
  let needOrtho = style === 'ortho'
  if (!needOrtho && obstacles.length) {
    const dx = Math.max(36, Math.hypot(b.x - a.x, b.y - a.y) / 2)
    const c1 = { x: a.x + ds.x * dx, y: a.y + ds.y * dx }
    const c2 = { x: b.x + de.x * dx, y: b.y + de.y * dx }
    for (let i = 1; i <= 11 && !needOrtho; i++) {
      const t = i / 12
      const u = 1 - t
      const x = u * u * u * a.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * b.x
      const y = u * u * u * a.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * b.y
      for (const o of obstacles) {
        if (x > o.x && x < o.x + o.w && y > o.y && y < o.y + o.h) {
          needOrtho = true
          break
        }
      }
    }
  }
  if (!needOrtho) {
    const dx = Math.max(36, Math.hypot(b.x - a.x, b.y - a.y) / 2)
    const c1 = { x: a.x + ds.x * dx, y: a.y + ds.y * dx }
    const c2 = { x: b.x + de.x * dx, y: b.y + de.y * dx }
    const d = `M ${a.x} ${a.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${b.x} ${b.y}`
    const mid = { x: (a.x + 3 * c1.x + 3 * c2.x + b.x) / 8, y: (a.y + 3 * c1.y + 3 * c2.y + b.y) / 8 }
    return { d, mid, startDir: { x: c1.x - a.x, y: c1.y - a.y }, endDir: { x: b.x - c2.x, y: b.y - c2.y }, a, b, avoided: false }
  }
  const pts = routeOrthogonal(a, fromSide, b, toSide, obstacles, stub, margin)
  const p1 = pts[1] || a
  const p0 = pts[pts.length - 2] || b
  const last = pts[pts.length - 1]
  return {
    d: pathFromPoints(pts),
    mid: polyMid(pts),
    startDir: { x: p1.x - a.x, y: p1.y - a.y },
    endDir: { x: last.x - p0.x, y: last.y - p0.y },
    a,
    b,
    avoided: true
  }
}

/**
 * 为新节点找一个不与现有矩形重叠的落点：从起点逐格右移扫描，超过行宽换行。
 * occupied 为已有节点矩形数组。
 */
export function freeSpotFor(occupied, size, startX = 40, startY = 40, stepX = 40, rowWidth = 2800) {
  let x = startX
  let y = startY
  let tries = 0
  while (tries < 400) {
    const clash = occupied.some((r) => x < r.x + r.w + 24 && x + size.w + 24 > r.x && y < r.y + r.h + 24 && y + size.h + 24 > r.y)
    if (!clash) return { x, y }
    x += stepX
    if (x > rowWidth) {
      x = startX
      y += size.h + 56
    }
    tries++
  }
  return { x, y }
}

/* ---------- 容器网格常量 ---------- */
export const CELL_W = 216
export const CELL_H = 100
export const C_PAD = 18
export const C_TITLE = 34
export const C_PADB = 16

export const gridCols = (cnt) => Math.max(1, Math.min(3, Math.ceil(Math.sqrt(Math.max(1, cnt)))))

/**
 * 容器派生盒：由子模块包围盒撑开（锚点 canvasX/Y 为标题栏左上）；
 * 无可见子项（空 / 折叠）时用基准尺寸。
 */
export function containerRect(n, kids, posOf, sizeOf) {
  const base = effSize(n) // 容器自定义尺寸优先，空态用基准尺寸
  const p = posOf(n)
  let x = p.x
  let y = p.y
  let w = base.w
  let h = base.h
  if (kids.length) {
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const k of kids) {
      const kp = posOf(k)
      const ks = sizeOf(k)
      if (!kp || !ks) continue
      minX = Math.min(minX, kp.x)
      minY = Math.min(minY, kp.y)
      maxX = Math.max(maxX, kp.x + ks.w)
      maxY = Math.max(maxY, kp.y + ks.h)
    }
    if (minX !== Infinity) {
      const x0 = Math.min(x, minX - C_PAD)
      const y0 = Math.min(y, minY - C_TITLE)
      w = Math.max(w, maxX + C_PAD - x0)
      h = Math.max(h, maxY + C_PADB - y0)
      x = x0
      y = y0
    }
  }
  return { x, y, w, h }
}

/* ---------- 连线类型 / 箭头 / 形状 ---------- */

export const REL_KINDS = [
  { key: '关联', color: '#2980b9' },
  { key: '因果', color: '#c0392b' },
  { key: '伏笔', color: '#8e44ad', dashed: true },
  { key: '冲突', color: '#d35400' }
]
export const relColor = (k) => (REL_KINDS.find((r) => r.key === k) || REL_KINDS[0]).color
export const relDashed = (k) => !!(REL_KINDS.find((r) => r.key === k) || {}).dashed
export const ARROWS = ['->', '<->', '--']
export const cycleArrow = (a) => ARROWS[(ARROWS.indexOf(a) + 1) % ARROWS.length]
export const arrowLabel = (a) => ({ '->': '单向 →', '<->': '双向 ↔', '--': '无向 —' }[a] || '单向 →')

export const SHAPES = ['process', 'para', 'diamond', 'ellipse']
export const nextShape = (s) => SHAPES[(SHAPES.indexOf(s) + 1) % SHAPES.length]
export const SHAPE_LABEL = { process: '矩形', para: '平行四边形', diamond: '菱形', ellipse: '椭圆' }

/** 模块类型元数据（侧边栏图标 / 徽标 / 筛选） */
export const KIND_META = {
  event: { icon: '◆', label: '事件' },
  note: { icon: '🗒', label: '便签' },
  cite: { icon: '🔗', label: '引用' },
  textbox: { icon: '▭', label: '文本框' },
  container: { icon: '▢', label: '容器' },
  anchor: { icon: '⚑', label: '锚点' },
  volume: { icon: '▤', label: '卷' }
}

/* ---------- 布局算法 ---------- */

/**
 * 画布重排：返回 Map(id → {x,y})，只含需要落位的节点。
 * - force=false（进入画布补位）：仅处理无坐标节点；已定位节点为锚。
 * - force=true（「整理」）：全部重排，pin 节点豁免；根节点水平带 3000px 换行，
 *   容器子项按网格（CELL 216×100，最多 3 列）排布。
 */
export function relayoutAll({ nodes, density = 'detail', force = false }) {
  const kidsOf = new Map()
  for (const n of nodes) {
    const p = n.parentId || null
    if (!kidsOf.has(p)) kidsOf.set(p, [])
    kidsOf.get(p).push(n)
  }
  for (const list of kidsOf.values()) list.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))

  const out = new Map()
  const SIZE = (n) => effSize(n, density)
  const willPlace = (n) => (force ? !(n.pin && n.canvasX != null) : n.canvasX == null)

  function placeTree(n, defX, defY) {
    const place = willPlace(n)
    const px = place ? Math.round(defX) : n.canvasX
    const py = place ? Math.round(defY) : n.canvasY
    if (place) out.set(n.id, { x: px, y: py })
    const kids = kidsOf.get(n.id) || []
    if (n.kind === 'container') {
      const movable = kids.filter((k) => willPlace(k))
      if (movable.length) {
        const cols = gridCols(movable.length)
        movable.forEach((k, i) => {
          placeTree(k, px + C_PAD + (i % cols) * CELL_W, py + C_TITLE + 10 + Math.floor(i / cols) * CELL_H)
        })
      }
      for (const k of kids) if (!willPlace(k) && (kidsOf.get(k.id) || []).length) placeTree(k, k.canvasX, k.canvasY)
    } else if (kids.length) {
      let ky = py
      for (const k of kids) {
        if (willPlace(k)) {
          placeTree(k, px + SIZE(n).w + 70, ky)
          ky += SIZE(k).h + 24
        } else {
          placeTree(k, k.canvasX, k.canvasY)
        }
      }
    }
  }

  function measureTree(n) {
    const kids = kidsOf.get(n.id) || []
    const base = SIZE(n)
    if (n.kind === 'container') {
      if (!kids.length) return base
      const cols = gridCols(kids.length)
      const rows = Math.ceil(kids.length / cols)
      return { w: Math.max(base.w, C_PAD * 2 + cols * CELL_W - 14), h: C_TITLE + 10 + rows * CELL_H + C_PADB }
    }
    if (kids.length) {
      const sub = kids.map(measureTree)
      return {
        w: base.w + 70 + Math.max(...sub.map((m) => m.w)),
        h: Math.max(base.h, sub.reduce((s, m) => s + m.h + 24, -24))
      }
    }
    return base
  }

  const roots = (kidsOf.get(null) || []).slice()
  roots.sort((a, b) => (a.kind === 'container' ? 0 : 1) - (b.kind === 'container' ? 0 : 1) || (a.sortOrder || 0) - (b.sortOrder || 0))

  if (force) {
    let bx = 60
    let by = 60
    let bandH = 0
    for (const r of roots) {
      if (!willPlace(r)) {
        placeTree(r, r.canvasX, r.canvasY)
        continue
      }
      const m = measureTree(r)
      if (bx + m.w > 3000 && bx > 60) {
        bx = 60
        by += bandH + 70
        bandH = 0
      }
      placeTree(r, bx, by)
      bx += m.w + 60
      bandH = Math.max(bandH, m.h)
    }
  } else {
    const occupied = nodes
      .filter((n) => n.canvasX != null)
      .map((n) => ({ x: n.canvasX, y: n.canvasY, w: SIZE(n).w, h: SIZE(n).h }))
    for (const r of roots) {
      if (willPlace(r)) {
        const m = measureTree(r)
        const spot = freeSpotFor(occupied, { w: Math.max(m.w, 200), h: Math.max(m.h, 120) })
        placeTree(r, spot.x, spot.y)
        occupied.push({ x: spot.x, y: spot.y, w: Math.max(m.w, 200), h: Math.max(m.h, 120) })
      } else {
        placeTree(r, r.canvasX, r.canvasY)
      }
    }
  }
  return out
}

/* ---------- 骨架模板（快速开始） ---------- */

/**
 * 返回 { rows, edges }：rows 直接喂 olnodeBulkAdd（顺序敏感），
 * edges 为 [fromIndex, toIndex] 引用 + kind/label，落库后按 created 序转真实 id。
 */
export function tplThreeAct() {
  const rows = []
  const mkContainer = (title, x, y) => rows.push({ kind: 'container', title, text: '', canvasX: x, canvasY: y }) - 1
  const mkEvent = (parent, title, text, x, y) => rows.push({ kind: 'event', title, text, canvasX: x, canvasY: y, _parent: parent }) - 1
  const ex = (base, col) => base + C_PAD + col * CELL_W
  const ey = (base, row) => base + C_TITLE + 10 + row * CELL_H
  const a1 = mkContainer('第一幕 · 建置', 40, 40)
  mkEvent(a1, '日常与世界', '', ex(40, 0), ey(40, 0))
  const b = mkEvent(a1, '激励事件', '打破平静的事件', ex(40, 1), ey(40, 0))
  const a2 = mkContainer('第二幕 · 对抗', 560, 40)
  const c = mkEvent(a2, '试炼与升级', '', ex(560, 0), ey(40, 0))
  const d = mkEvent(a2, '中点反转', '', ex(560, 1), ey(40, 0))
  const e = mkEvent(a2, '一切崩塌', '', ex(560, 0), ey(40, 1))
  const a3 = mkContainer('第三幕 · 解决', 1080, 40)
  const f = mkEvent(a3, '终局对决', '', ex(1080, 0), ey(40, 0))
  mkEvent(a3, '新的平衡', '', ex(1080, 1), ey(40, 0))
  rows.push({ kind: 'note', title: '用法', text: '拖节点四向锚点拉连线；拖入容器即归组；双击节点行内编辑内容。', canvasX: 40, canvasY: 320 })
  return {
    rows,
    edges: [
      { from: b, to: c, kind: '因果', label: '推动' },
      { from: d, to: e, kind: '因果', label: '' },
      { from: e, to: f, kind: '因果', label: '' }
    ]
  }
}

export function tplChapterList(chapters) {
  const rows = []
  const edges = []
  const bx = 40
  const by = 40
  rows.push({ kind: 'container', title: '章节清单', text: '', canvasX: bx, canvasY: by })
  const head = 0
  const list = chapters || []
  if (list.length) {
    const cols = gridCols(list.length)
    list.forEach((ch, i) => {
      rows.push({
        kind: 'anchor',
        refId: ch.id,
        title: ch.title || '',
        text: '',
        canvasX: bx + C_PAD + (i % cols) * CELL_W,
        canvasY: by + C_TITLE + 10 + Math.floor(i / cols) * CELL_H,
        _parent: head
      })
    })
  } else {
    const cols = 3
    for (let i = 0; i < 6; i++) {
      rows.push({
        kind: 'event',
        title: '第' + '一二三四五六'[i] + '章',
        text: '',
        canvasX: bx + C_PAD + (i % cols) * CELL_W,
        canvasY: by + C_TITLE + 10 + Math.floor(i / cols) * CELL_H,
        _parent: head
      })
    }
  }
  rows.push({ kind: 'note', title: '节奏提示', text: '每章推进一件事。', canvasX: bx + 720, canvasY: by })
  return { rows, edges }
}
