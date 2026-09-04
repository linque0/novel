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
