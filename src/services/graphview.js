/* 画布共用引擎（8.8.2 大纲画布 / 8.8.3 人物关系图共用）：
 * 平移缩放状态机、连线几何（贝塞尔 / 正交折线）、锚点选择与节点命中测试。零依赖。 */
import { ref, computed } from 'vue'

export function usePanZoom(canvasEl, initial = {}) {
  const zoom = ref(initial.zoom ?? 1)
  const tx = ref(initial.tx ?? 60)
  const ty = ref(initial.ty ?? 40)
  const innerStyle = computed(() => ({
    transform: `translate(${tx.value}px, ${ty.value}px) scale(${zoom.value})`,
    transformOrigin: '0 0'
  }))

  function onWheel(e) {
    if (e.ctrlKey) {
      // 以鼠标为锚点缩放
      const rect = canvasEl.value?.getBoundingClientRect()
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12
      const nz = Math.min(2.2, Math.max(0.3, zoom.value * factor))
      if (rect) {
        const mx = e.clientX - rect.left
        const my = e.clientY - rect.top
        tx.value = mx - ((mx - tx.value) * nz) / zoom.value
        ty.value = my - ((my - ty.value) * nz) / zoom.value
      }
      zoom.value = nz
    } else {
      tx.value -= e.deltaX
      ty.value -= e.deltaY
    }
  }

  let pan = null
  function onPanStart(e) {
    if (e.target.closest?.('.oc-node, .rg-node, .om-sat, .oc-elabel, .rg-elabel, button, input, textarea, select')) return
    pan = { x: e.clientX, y: e.clientY, tx: tx.value, ty: ty.value }
    const move = (ev) => {
      if (!pan) return
      tx.value = pan.tx + (ev.clientX - pan.x)
      ty.value = pan.ty + (ev.clientY - pan.y)
    }
    const up = () => {
      pan = null
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  /** 适应内容包围盒 {x,y,w,h} 到画布（x/y 缺省按 0 处理） */
  function fit(bounds) {
    const el = canvasEl.value
    if (!el || !bounds.w || !bounds.h) return
    const vw = el.clientWidth
    const vh = el.clientHeight
    const z = Math.min(1.2, Math.max(0.3, Math.min(vw / (bounds.w + 80), vh / (bounds.h + 80))))
    zoom.value = z
    const bx = bounds.x || 0
    const by = bounds.y || 0
    tx.value = vw / 2 - (bx + bounds.w / 2) * z
    ty.value = vh / 2 - (by + bounds.h / 2) * z
  }

  /** 将内容点（画布坐标）居中到视口 */
  function centerOn(x, y) {
    const el = canvasEl.value
    if (!el) return
    tx.value = el.clientWidth / 2 - x * zoom.value
    ty.value = el.clientHeight / 2 - y * zoom.value
  }

  return { zoom, tx, ty, innerStyle, onWheel, onPanStart, fit, centerOn }
}

/** 节点四向锚点坐标（rect = {x,y,w,h}） */
export function anchorsOf(rect) {
  return {
    right: { x: rect.x + rect.w, y: rect.y + rect.h / 2 },
    left: { x: rect.x, y: rect.y + rect.h / 2 },
    top: { x: rect.x + rect.w / 2, y: rect.y },
    bottom: { x: rect.x + rect.w / 2, y: rect.y + rect.h }
  }
}

/** 依据两矩形相对位置选择连接锚点：返回 [源锚点, 目标锚点] */
export function pickAnchors(src, dst) {
  const sa = anchorsOf(src)
  const da = anchorsOf(dst)
  const dx = dst.x + dst.w / 2 - (src.x + src.w / 2)
  const dy = dst.y + dst.h / 2 - (src.y + src.h / 2)
  let sSide, dSide
  if (Math.abs(dx) >= Math.abs(dy)) {
    sSide = dx >= 0 ? 'right' : 'left'
    dSide = dx >= 0 ? 'left' : 'right'
  } else {
    sSide = dy >= 0 ? 'bottom' : 'top'
    dSide = dy >= 0 ? 'top' : 'bottom'
  }
  return [sa[sSide], da[dSide]]
}

/** 连线路径：bezier 曲线 / ortho 正交折线 */
export function edgePath(a, b, style = 'bezier') {
  if (style === 'ortho') {
    const mx = a.x + (b.x - a.x) / 2
    return `M ${a.x} ${a.y} L ${mx} ${a.y} L ${mx} ${b.y} L ${b.x} ${b.y}`
  }
  const dx = Math.max(36, Math.abs(b.x - a.x) / 2)
  return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`
}

/**
 * 边几何一体计算：路径 / 中点（标签位）/ 两端切线方向（箭头用）。
 * style 为空时按 bezier 处理。
 */
export function edgeGeom(a, b, style = 'bezier') {
  if (style === 'ortho') {
    const mx = a.x + (b.x - a.x) / 2
    const d = `M ${a.x} ${a.y} L ${mx} ${a.y} L ${mx} ${b.y} L ${b.x} ${b.y}`
    const mid = { x: mx, y: (a.y + b.y) / 2 }
    let ex = b.x - mx
    let sx = mx - a.x
    if (Math.abs(ex) < 0.01) ex = b.x - a.x || 1
    if (Math.abs(sx) < 0.01) sx = b.x - a.x || -1
    return { d, mid, endDir: { x: ex, y: 0 }, startDir: { x: sx, y: 0 } }
  }
  /* 控制点方向跟随连线走向：向左的边（b.x < a.x）控制点必须向左弯，
   * 否则初段反向内折——容器淡色内底会让这段弯折暴露在内部 */
  const dx = Math.max(36, Math.abs(b.x - a.x) / 2)
  const dirx = b.x >= a.x ? 1 : -1
  const c1 = { x: a.x + dx * dirx, y: a.y }
  const c2 = { x: b.x - dx * dirx, y: b.y }
  const d = `M ${a.x} ${a.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${b.x} ${b.y}`
  // 三次贝塞尔 t=0.5：M = (P0 + 3C1 + 3C2 + P3) / 8
  const mid = {
    x: (a.x + 3 * c1.x + 3 * c2.x + b.x) / 8,
    y: (a.y + 3 * c1.y + 3 * c2.y + b.y) / 8
  }
  return {
    d,
    mid,
    endDir: { x: b.x - c2.x, y: b.y - c2.y },
    startDir: { x: c1.x - a.x, y: c1.y - a.y }
  }
}

/** 由方向矢量计算箭头三角形三点（size 默认 7） */
export function arrowHeadDir(x, y, dir, size = 7) {
  const ang = Math.atan2(dir.y, dir.x)
  const a1 = ang + Math.PI - 0.42
  const a2 = ang + Math.PI + 0.42
  return `${x},${y} ${x + size * Math.cos(a1)},${y + size * Math.sin(a1)} ${x + size * Math.cos(a2)},${y + size * Math.sin(a2)}`
}

/** 由路径末段方向计算箭头三角形三点（size 默认 7） */
export function arrowHead(x1, y1, x2, y2, size = 7) {
  return arrowHeadDir(x2, y2, { x: x2 - x1, y: y2 - y1 }, size)
}

/** 点是否落在任一矩形内（命中测试用） */
export function hitRect(rects, x, y, pad = 4) {
  for (const r of rects) {
    if (x >= r.x - pad && x <= r.x + r.w + pad && y >= r.y - pad && y <= r.y + r.h + pad) return r
  }
  return null
}


