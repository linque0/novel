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
    case 'arrow':
      return { w: 20, h: 20 } // 连接点（接线柱）：小热区，渲染为圆点
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

/* ---------- 连线端口严格化 + 避障路由（v0.4.14 / v0.4.16 重写） ----------
 * 端口在建立时记录（fromSide/toSide），渲染严格使用，不随节点挪位回退就近侧；
 * 避障路由 v0.4.16 起为全局最优：先试最简首形，被挡时在 Hanan 稀疏网格上跑
 * A*（长度 + 转向惩罚）求最短折线并拉直收敛，旧贪心逐段绕行仅作病态兜底。 */

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

/** 折线任一线段是否与障碍相交 */
function pathHits(pts, obstacles) {
  for (let i = 0; i < pts.length - 1; i++)
    for (const o of obstacles) if (segHitsRect(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, o)) return true
  return false
}

/** 带皮命中测试（A* 与拉直用）：贴边滑行（间距 < 2px）视为穿过，保证绕行段至少留出可视间隙 */
function segHitsSkin(ax, ay, bx, by, r, pad = 2) {
  return segHitsRect(ax, ay, bx, by, { x: r.x - pad, y: r.y - pad, w: r.w + pad * 2, h: r.h + pad * 2 })
}

/**
 * [v0.4.16 重写] 稀疏网格 A*：在由障碍膨胀边界（±margin）与两端桩端点张成的 Hanan 网格上
 * 求正交最短路，代价 = 段长 + 转向惩罚（少弯优先）；网格线天然与障碍保持 margin 间距，
 * 全局择优，不再产生包络大环绕与重复平行段。dir0 / dirGoal 为出/入桩行进方向
 * （端点处的转弯同样计价），返回 p1→p2 折点数组（含两端），不可达返回 null。
 */
function astarOrtho(p1, p2, obstacles, margin, dir0, dirGoal, turnPenalty) {
  const xs = [p1.x, p2.x]
  const ys = [p1.y, p2.y]
  for (const o of obstacles) {
    xs.push(o.x - margin, o.x + o.w + margin)
    ys.push(o.y - margin, o.y + o.h + margin)
  }
  xs.sort((a, b) => a - b)
  ys.sort((a, b) => a - b)
  const X = []
  const Y = []
  for (const v of xs) if (!X.length || v - X[X.length - 1] >= 0.5) X.push(v)
  for (const v of ys) if (!Y.length || v - Y[Y.length - 1] >= 0.5) Y.push(v)
  const NX = X.length
  const NY = Y.length
  if (!NX || !NY || NX * NY > 30000) return null
  const idxNear = (arr, v) => arr.findIndex((u) => Math.abs(u - v) < 0.5)
  const sxi = idxNear(X, p1.x)
  const syi = idxNear(Y, p1.y)
  const gxi = idxNear(X, p2.x)
  const gyi = idxNear(Y, p2.y)
  if (sxi < 0 || syi < 0 || gxi < 0 || gyi < 0) return null
  /* 网格边通行缓存：0 未知 / 1 通 / 2 堵（segHitsRect 为严格重叠，贴边不算穿过） */
  const H = new Uint8Array(NX * NY)
  const V = new Uint8Array(NX * NY)
  const hClear = (i, j) => {
    const k = j * NX + i
    if (!H[k]) {
      H[k] = 1
      for (const o of obstacles) if (segHitsSkin(X[i], Y[j], X[i + 1], Y[j], o)) { H[k] = 2; break }
    }
    return H[k] === 1
  }
  const vClear = (i, j) => {
    const k = j * NX + i
    if (!V[k]) {
      V[k] = 1
      for (const o of obstacles) if (segHitsSkin(X[i], Y[j], X[i], Y[j + 1], o)) { V[k] = 2; break }
    }
    return V[k] === 1
  }
  const stateOf = (i, j, d) => (j * NX + i) * 4 + d
  const NS = NX * NY * 4
  const gScore = new Float64Array(NS).fill(Infinity)
  const came = new Int32Array(NS).fill(-1)
  const heap = []
  const hpush = (f, s) => {
    heap.push([f, s])
    let c = heap.length - 1
    while (c > 0) {
      const p = (c - 1) >> 1
      if (heap[p][0] <= heap[c][0]) break
      const t = heap[p]
      heap[p] = heap[c]
      heap[c] = t
      c = p
    }
  }
  const hpop = () => {
    const top = heap[0]
    const last = heap.pop()
    if (heap.length) {
      heap[0] = last
      let c = 0
      for (;;) {
        const l = c * 2 + 1
        const r = l + 1
        let m = c
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r
        if (m === c) break
        const t = heap[m]
        heap[m] = heap[c]
        heap[c] = t
        c = m
      }
    }
    return top
  }
  const hDist = (i, j) => Math.abs(X[i] - X[gxi]) + Math.abs(Y[j] - Y[gyi])
  const start = stateOf(sxi, syi, dir0)
  gScore[start] = 0
  hpush(hDist(sxi, syi), start)
  let pops = 0
  while (heap.length) {
    const s = hpop()[1]
    if (++pops > 120000) return null
    const d = s & 3
    const cell = s >> 2
    const ci = cell % NX
    const cj = (cell - ci) / NX
    if (ci === gxi && cj === gyi) {
      const pts = []
      for (let t = s; t >= 0; t = came[t]) {
        const c = t >> 2
        const ti = c % NX
        pts.push({ x: X[ti], y: Y[(c - ti) / NX] })
      }
      return pts.reverse()
    }
    const g = gScore[s]
    for (let nd = 0; nd < 4; nd++) {
      if ((nd ^ 1) === d) continue // 不掉头
      let ni = ci
      let nj = cj
      if (nd === 0) {
        if (ci + 1 >= NX || !hClear(ci, cj)) continue
        ni = ci + 1
      } else if (nd === 1) {
        if (ci === 0 || !hClear(ci - 1, cj)) continue
        ni = ci - 1
      } else if (nd === 2) {
        if (cj + 1 >= NY || !vClear(ci, cj)) continue
        nj = cj + 1
      } else {
        if (cj === 0 || !vClear(ci, cj - 1)) continue
        nj = cj - 1
      }
      const goal = ni === gxi && nj === gyi
      const ng =
        g + Math.abs(X[ni] - X[ci]) + Math.abs(Y[nj] - Y[cj]) + (nd === d ? 0 : turnPenalty) + (goal && nd !== dirGoal ? turnPenalty : 0)
      const ns = stateOf(ni, nj, nd)
      if (ng < gScore[ns] - 1e-9) {
        gScore[ns] = ng
        came[ns] = s
        hpush(ng + hDist(ni, nj), ns)
      }
    }
  }
  return null
}

/**
 * 拉直收敛：子路径能以更短的直连或 L 形替代且不穿障碍时替换之，
 * 消除 A* 网格化残留的小折/绕步；首末段方向（端口出桩/入桩）保持不变。
 */
function simplifyOrtho(pts, obstacles) {
  const manh = (a, b) => Math.abs(b.x - a.x) + Math.abs(b.y - a.y)
  const clear = (a, b) => {
    for (const o of obstacles) if (segHitsSkin(a.x, a.y, b.x, b.y, o)) return false
    return true
  }
  const sgn = (v) => (v > 0.5 ? 1 : v < -0.5 ? -1 : 0)
  for (let guard = 0; guard < 12; guard++) {
    let changed = false
    for (let i = 1; i < pts.length - 2 && !changed; i++) {
      const ix = sgn(pts[i].x - pts[i - 1].x)
      const iy = sgn(pts[i].y - pts[i - 1].y)
      for (let j = i + 2; j < pts.length - 1; j++) {
        const ox = sgn(pts[j + 1].x - pts[j].x)
        const oy = sgn(pts[j + 1].y - pts[j].y)
        const a = pts[i]
        const b = pts[j]
        const dx = sgn(b.x - a.x)
        const dy = sgn(b.y - a.y)
        let base = 0
        for (let k = i; k < j; k++) base += manh(pts[k], pts[k + 1])
        /* 替换段不得与首/末段反向（避免折返出重叠段）：直连候选四向都查 */
        if (!(ix && dx === -ix) && !(iy && dy === -iy) && !(ox && dx === -ox) && !(oy && dy === -oy)) {
          if ((Math.abs(a.x - b.x) < 0.5 || Math.abs(a.y - b.y) < 0.5) && clear(a, b)) {
            pts.splice(i + 1, j - i - 1)
            changed = true
            break
          }
        }
        /* L 形候选按各自首/末段方向查折返：横先纵后查 ix/oy，纵先横后查 iy/ox */
        let best = null
        for (const [c, rvs] of [
          [{ x: b.x, y: a.y }, (ix && dx === -ix) || (oy && dy === -oy)],
          [{ x: a.x, y: b.y }, (iy && dy === -iy) || (ox && dx === -ox)]
        ]) {
          if (rvs) continue
          if ((Math.abs(c.x - a.x) < 0.5 && Math.abs(c.y - a.y) < 0.5) || (Math.abs(c.x - b.x) < 0.5 && Math.abs(c.y - b.y) < 0.5)) continue
          const l = manh(a, c) + manh(c, b)
          if (l < base - 0.5 && clear(a, c) && clear(c, b) && (!best || l < best.l)) best = { c, l }
        }
        if (best) {
          pts.splice(i + 1, j - i - 1, best.c)
          changed = true
          break
        }
      }
    }
    if (!changed) break
  }
  return dedupePoints(pts)
}

/** 单段绕障（旧贪心算法用）：横向段从矩形上/下缘绕，纵向段从左/右缘绕（取近侧）；
 * detours 为累计偏移——同一障碍被多段命中时逐步外扩，避免相邻绕行段贴边互穿 */
function detourAround(a, b, r, margin, detours) {
  const extra = detours * margin
  if (Math.abs(a.y - b.y) < 0.5) {
    const xa = Math.max(Math.min(a.x, b.x), r.x)
    const xb = Math.min(Math.max(a.x, b.x), r.x + r.w)
    const up = a.y <= r.y + r.h / 2
    const ny = up ? r.y - margin - extra : r.y + r.h + margin + extra
    return [{ x: xa, y: a.y }, { x: xa, y: ny }, { x: xb, y: ny }, { x: xb, y: a.y }]
  }
  const ya = Math.max(Math.min(a.y, b.y), r.y)
  const yb = Math.min(Math.max(a.y, b.y), r.y + r.h)
  const left = a.x <= r.x + r.w / 2
  const nx = left ? r.x - margin - extra : r.x + r.w + margin + extra
  return [{ x: a.x, y: ya }, { x: nx, y: ya }, { x: nx, y: yb }, { x: a.x, y: yb }]
}

/**
 * [v0.4.15 兜底] 旧贪心逐段绕行：初始包络拓扑 + 逐段检测命中并外扩绕行。
 * 仅在 A* 不可达的病态布局（节点重叠等）时由 routeOrthogonal 调用。
 */
function routeOrthogonalLegacy(from, fromSide, to, toSide, obstacles, stub = 18, margin = 16) {
  const ds = sideDir(fromSide)
  const de = sideDir(toSide)
  /* 桩长：源/目标矩形在障碍表时，桩必须延伸出矩形（锚点在边缘上，直线距离为 0 → 取矩形宽高 + margin） */
  const srcOb = obstacles.find((o) => from.x > o.x - 0.5 && from.x < o.x + o.w + 0.5 && from.y > o.y - 0.5 && from.y < o.y + o.h + 0.5)
  const dstOb = obstacles.find((o) => to.x > o.x - 0.5 && to.x < o.x + o.w + 0.5 && to.y > o.y - 0.5 && to.y < o.y + o.h + 0.5)
  const stubS = srcOb ? Math.max(stub, Math.max(srcOb.w, srcOb.h) + margin) : stub
  const stubE = dstOb ? Math.max(stub, Math.max(dstOb.w, dstOb.h) + margin) : stub
  const p1 = { x: from.x + ds.x * stubS, y: from.y + ds.y * stubS }
  const p2 = { x: to.x + de.x * stubE, y: to.y + de.y * stubE }
  let pts
  if (ds.x !== 0 && de.x !== 0) {
    const sameDir = ds.x === de.x && Math.sign(p2.x - p1.x) === ds.x
    if (sameDir && (p2.x - p1.x) * ds.x > 0) {
      const mx = (p1.x + p2.x) / 2
      pts = [from, p1, { x: mx, y: p1.y }, { x: mx, y: p2.y }, p2, to]
    } else {
      const ys = obstacles.map((o) => [o.y - margin, o.y + o.h + margin]).flat()
      const envTop = Math.min(...ys, p1.y, p2.y)
      const envBot = Math.max(...ys, p1.y, p2.y)
      const my = (from.y + to.y) / 2 <= (envTop + envBot) / 2 ? envTop : envBot
      pts = [from, p1, { x: p1.x, y: my }, { x: p2.x, y: my }, p2, to]
    }
  } else if (ds.y !== 0 && de.y !== 0) {
    const sameDir = ds.y === de.y && Math.sign(p2.y - p1.y) === ds.y
    if (sameDir && (p2.y - p1.y) * ds.y > 0) {
      const my = (p1.y + p2.y) / 2
      pts = [from, p1, { x: p1.x, y: my }, { x: p2.x, y: my }, p2, to]
    } else {
      const xs = obstacles.map((o) => [o.x - margin, o.x + o.w + margin]).flat()
      const envLeft = Math.min(...xs, p1.x, p2.x)
      const envRight = Math.max(...xs, p1.x, p2.x)
      const mx = (from.x + to.x) / 2 <= (envLeft + envRight) / 2 ? envLeft : envRight
      pts = [from, p1, { x: mx, y: p1.y }, { x: mx, y: p2.y }, p2, to]
    }
  } else if (ds.x !== 0) {
    pts = [from, p1, { x: p2.x, y: p1.y }, p2, to]
  } else {
    pts = [from, p1, { x: p1.x, y: p2.y }, p2, to]
  }
  pts = dedupePoints(pts)
  const detours = new Map()
  for (let round = 0; round < 24; round++) {
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
    const key = `${Math.round(hit.ob.x)},${Math.round(hit.ob.y)}`
    const d = (detours.get(key) || 0) + 1
    detours.set(key, d)
    pts.splice(hit.i + 1, 0, ...detourAround(pts[hit.i], pts[hit.i + 1], hit.ob, margin, d - 1))
    pts = dedupePoints(pts)
  }
  return pts
}

/**
 * 正交避障路由（v0.4.16 全局最优）：两端沿端口外法线出短桩，先试最简首形
 * （Z / L，无碰撞直接采用）；被挡或端口背对时在稀疏网格上跑 A* 求全局最短
 * 折线并拉直收敛——贴障碍 margin 通道择近路，无包络大环绕、无重复段；
 * 病态布局（节点重叠致不可达）退回旧贪心绕行。返回折点数组（含起终点）。
 */
export function routeOrthogonal(from, fromSide, to, toSide, obstacles = [], stub = 18, margin = 16) {
  const ds = sideDir(fromSide)
  const de = sideDir(toSide)
  const p1 = { x: from.x + ds.x * stub, y: from.y + ds.y * stub }
  const p2 = { x: to.x + de.x * stub, y: to.y + de.y * stub }
  /* 候选首形：目标在行进方向前方走 Z 形，垂直端口走 L 形；背对端口不设首形（A* 择优环绕） */
  let naive = null
  if (ds.x !== 0 && de.x !== 0) {
    if (Math.sign(p2.x - p1.x) === ds.x) {
      const mx = (p1.x + p2.x) / 2
      naive = [from, p1, { x: mx, y: p1.y }, { x: mx, y: p2.y }, p2, to]
    }
  } else if (ds.y !== 0 && de.y !== 0) {
    if (Math.sign(p2.y - p1.y) === ds.y) {
      const my = (p1.y + p2.y) / 2
      naive = [from, p1, { x: p1.x, y: my }, { x: p2.x, y: my }, p2, to]
    }
  } else if (ds.x !== 0) {
    naive = [from, p1, { x: p2.x, y: p1.y }, p2, to]
  } else {
    naive = [from, p1, { x: p1.x, y: p2.y }, p2, to]
  }
  if (naive && !pathHits(naive, obstacles)) return dedupePoints(naive)
  /* 桩端被压进某个矩形时放宽该矩形（出/入桩穿越已由端口决定，无法避免） */
  const inside = (p, o) => p.x > o.x && p.x < o.x + o.w && p.y > o.y && p.y < o.y + o.h
  const obs2 = obstacles.filter((o) => !inside(p1, o) && !inside(p2, o))
  const dir0 = ds.x !== 0 ? (ds.x > 0 ? 0 : 1) : ds.y > 0 ? 2 : 3
  const dirGoal = de.x !== 0 ? (de.x > 0 ? 1 : 0) : de.y > 0 ? 3 : 2
  const mid = astarOrtho(p1, p2, obs2, margin, dir0, dirGoal, margin * 2)
  if (mid) {
    const full = simplifyOrtho(dedupePoints([from, ...mid, to]), obs2)
    if (!pathHits(full, obs2)) return full
  }
  return routeOrthogonalLegacy(from, fromSide, to, toSide, obstacles, stub, margin)
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
  const base = sizeOf ? sizeOf(n) : effSize(n) // 容器自定义尺寸优先（拖拽调整时经 sizeOf 读 dragSize 实时尺寸，盒子才能跟随鼠标），空态用基准尺寸
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
  event: { icon: 'diamond', label: '事件' },
  note: { icon: 'note', label: '便签' },
  cite: { icon: 'link', label: '引用' },
  textbox: { icon: 'textbox', label: '文本框' },
  container: { icon: 'container', label: '容器' },
  anchor: { icon: 'flag', label: '锚点' },
  volume: { icon: 'rows', label: '卷' },
  arrow: { icon: 'link', label: '连接点' }
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
