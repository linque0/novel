<!-- 大纲思维导图（8.8 M1/M2/M3）：SVG 贝塞尔连线 + DOM 节点，横向树布局；
     双链令牌渲染为卫星节点（悬停出 DLinkPopover 预览、点击跳转）；故事线着色与脉络聚焦；双击章/卷节点跳正文 -->
<script setup>
import { computed, ref, nextTick } from 'vue'
import { useWorkStore } from '../stores/work'
import { parseTokens, findByTitle, jumpTo, KIND_LABEL } from '../services/doublelinks'

const work = useWorkStore()

const NODE_W = 168
const NODE_H = 40
const SAT_W = 128
const SAT_H = 24
const GAP_X = 46
const GAP_Y = 10
const LINE_COLORS = ['#c0392b', '#2980b9', '#27ae60', '#8e44ad', '#d35400', '#16a085', '#b8860b']

const canvasEl = ref(null)
const zoom = ref(1)
const tx = ref(70)
const ty = ref(40)
const focusLineId = ref(null)

const STATUS_LABEL = { draft: '草稿', done: '完成', revise: '待修改' }

const chapterOf = (n) => (n.kind === 'chapter' ? work.chapters.find((c) => c.id === n.refId && !c.deletedAt) : null)
const volumeOf = (n) => (n.kind === 'volume' ? work.volumes.find((v) => v.id === n.refId && !v.deletedAt) : null)

function firstLine(s, len = 30) {
  return (String(s || '').split('\n').find((x) => x.trim()) || '').trim().slice(0, len)
}

/* 节点显示元数据 */
function meta(n) {
  const ch = chapterOf(n)
  const vol = volumeOf(n)
  if (n.kind === 'chapter') {
    return {
      label: ch?.title || '（已删章节）',
      sub: ch ? `${ch.wordCount || 0}字 · ${STATUS_LABEL[ch.status]}` : '',
      status: ch?.status || 'draft',
      w: NODE_W,
      h: NODE_H
    }
  }
  if (n.kind === 'volume') {
    const chs = work.liveChapters.filter((c) => c.volumeId === n.refId)
    return {
      label: vol?.title || '（已删卷）',
      sub: chs.length ? `${chs.length}章 · ${chs.reduce((s, c) => s + (c.wordCount || 0), 0)}字` : '',
      w: NODE_W,
      h: NODE_H
    }
  }
  if (n.kind === 'master') return { label: n.title || '总纲', sub: firstLine(n.text), w: NODE_W, h: NODE_H }
  const label = n.title || firstLine(n.text) || '（空条目）'
  return { label, sub: n.title ? firstLine(n.text) : '', w: NODE_W, h: NODE_H }
}

/* 构建可视树（fold / 脉络聚焦） */
const tree = computed(() => {
  let roots = work.olnodeChildren(null)
  if (focusLineId.value) {
    roots = roots
      .filter((n) => n.kind === 'lines')
      .map((g) => ({ ...g, fold: false, children: work.olnodeChildren(g.id).filter((l) => l.id === focusLineId.value) }))
  }
  let lineIdx = 0
  const build = (n, depth, lineColor) => {
    const children = []
    if (!n.fold) {
      for (const ch of work.olnodeChildren(n.id)) {
        children.push(build(ch, depth + 1, n.kind === 'line' ? lineColor : lineIdx && lineColor))
      }
    }
    const sats = []
    if (!n.fold) {
      for (const tok of parseTokens(n.text || '')) {
        sats.push({ sat: true, key: tok.start + ':' + tok.title, depth: depth + 1, display: tok.display || tok.title, resolved: findByTitle(tok.title), title: tok.title })
      }
    }
    let color = lineColor
    if (n.kind === 'line') color = LINE_COLORS[lineIdx++ % LINE_COLORS.length]
    return { n, depth, children, sats, color }
  }
  return roots.map((r) => build(r, 0, null))
})

/* 布局：节点纵向居中于其子树块 */
const layout = computed(() => {
  const nodes = []
  const edges = []
  const nodeH = (it) => (it.sat ? SAT_H : NODE_H)
  const nodeW = (it) => (it.sat ? SAT_W : NODE_W)

  const place = (it, depth, top) => {
    it.depth = depth
    const w = nodeW(it)
    const h0 = nodeH(it)
    nodes.push(it)
    const items = [...(it.children || []), ...(it.sats || [])]
    let blockH = h0
    if (items.length) {
      const total = items.reduce((s, c) => s + c.h, 0) + GAP_Y * (items.length - 1)
      blockH = Math.max(h0, total)
      let cy = top + (blockH - total) / 2
      for (const c of items) {
        place(c, depth + 1, cy)
        cy += c.h + GAP_Y
      }
    }
    it.x = depth * (NODE_W + GAP_X)
    it.w = w
    it.y = top + (blockH - h0) / 2
    it.cy = it.y + h0 / 2
    it.h = blockH
    // 连线：父节点右缘中点 → 子节点左缘中点
    const pcx = it.x + w
    for (const c of [...(it.children || []), ...(it.sats || [])]) {
      edges.push({ d: `M ${pcx} ${it.cy} C ${pcx + GAP_X / 2} ${it.cy}, ${c.x - GAP_X / 2} ${c.cy}, ${c.x} ${c.cy}` })
    }
  }

  let top = 20
  for (const r of tree.value) {
    const h = placeRoot(r, top)
    top += h + 28
  }
  function placeRoot(r, top) {
    // 根节点块与其子树块组合
    place(r, 0, top)
    return r.h
  }
  return { nodes, edges }
})

/* 展平渲染列表：只从 depth=0 的根开始遍历（layout.nodes 含全部层级，直接遍历会重复计数）；卫星与普通节点分开渲染 */
const nodesReal = computed(() => {
  const out = []
  const walk = (it) => {
    if (!it.sat) out.push(it)
    for (const c of it.children || []) walk(c)
  }
  for (const r of layout.value.nodes) if (r.depth === 0) walk(r)
  return out
})
const satsFlat = computed(() => {
  const out = []
  const walk = (it) => {
    for (const s of it.sats || []) out.push(s)
    for (const c of it.children || []) walk(c)
  }
  for (const r of layout.value.nodes) if (r.depth === 0) walk(r)
  return out
})
const edges = computed(() => layout.value.edges)

const bounds = computed(() => {
  let w = 600
  let h = 400
  for (const nd of nodesReal.value) {
    w = Math.max(w, nd.x + nd.w + 60)
    h = Math.max(h, nd.y + NODE_H + 60)
  }
  for (const st of satsFlat.value) {
    w = Math.max(w, st.x + st.w + 60)
    h = Math.max(h, st.y + SAT_H + 60)
  }
  return { w, h }
})

const lineNodes = computed(() => {
  const g = work.olnodeByKind('lines')
  return g ? work.olnodeChildren(g.id) : []
})
const lineColorOf = (id) => {
  const i = lineNodes.value.findIndex((l) => l.id === id)
  return LINE_COLORS[(i < 0 ? 0 : i) % LINE_COLORS.length]
}

function select(it) {
  work.selOlnodeId = it.n.id
}
function dbl(it) {
  if (it.n.kind === 'chapter' && it.n.refId) work.navTo('chapters', it.n.refId)
  else if (it.n.kind === 'volume' && it.n.refId) {
    const first = work.liveChapters.find((c) => c.volumeId === it.n.refId)
    if (first) work.navTo('chapters', first.id)
  }
}
function satJump(st) {
  jumpTo(st.resolved || findByTitle(st.title))
}
function focusLine(l) {
  focusLineId.value = focusLineId.value === l.id ? null : l.id
  nextTick(fit)
}

/* 缩放 / 平移 / 适应 */
const innerStyle = computed(() => ({ transform: `translate(${tx.value}px, ${ty.value}px) scale(${zoom.value})`, transformOrigin: '0 0' }))
function onWheel(e) {
  const delta = e.deltaY < 0 ? 0.12 : -0.12
  zoom.value = Math.min(2, Math.max(0.35, zoom.value + delta))
}
let pan = null
function onPanStart(e) {
  if (e.target.closest('.om-node') || e.target.closest('.om-sat')) return
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
function fit() {
  const el = canvasEl.value
  if (!el) return
  const vw = el.clientWidth
  const vh = el.clientHeight
  zoom.value = Math.min(1.2, Math.max(0.35, Math.min(vw / bounds.value.w, vh / bounds.value.h)))
  tx.value = Math.max(10, (vw - bounds.value.w * zoom.value) / 2)
  ty.value = Math.max(10, (vh - bounds.value.h * zoom.value) / 2)
}
</script>

<template>
  <div class="om-wrap">
    <div class="om-toolbar">
      <span class="om-chip" :class="{ on: !focusLineId }" @click="focusLineId = null">全部脉络</span>
      <span
        v-for="l in lineNodes"
        :key="l.id"
        class="om-chip"
        :class="{ on: focusLineId === l.id }"
        :style="focusLineId === l.id ? { borderColor: lineColorOf(l.id), color: lineColorOf(l.id) } : {}"
        @click="focusLine(l)"
      >{{ l.title || '故事线' }}</span>
      <span style="flex: 1"></span>
      <span style="font-size: 11px; color: var(--text-dim)">双击章/卷节点跳正文 · 悬停卫星节点预览</span>
      <button class="om-btn" title="放大" @click="zoom = Math.min(2, zoom + 0.15)">＋</button>
      <button class="om-btn" title="缩小" @click="zoom = Math.max(0.35, zoom - 0.15)">－</button>
      <button class="om-btn" title="适应视图" @click="fit">适应</button>
    </div>
    <div ref="canvasEl" class="om-canvas" @mousedown="onPanStart" @wheel.prevent="onWheel">
      <div class="om-inner" :style="innerStyle">
        <svg class="om-edges" :width="bounds.w" :height="bounds.h">
          <path v-for="(e, i) in edges" :key="i" :d="e.d" />
        </svg>
        <div
          v-for="nd in nodesReal"
          :key="nd.n.id"
          class="om-node"
          :class="['om-' + nd.n.kind, { sel: work.selOlnodeId === nd.n.id }]"
          :style="{ left: nd.x + 'px', top: nd.y + 'px', width: nd.w + 'px', borderColor: nd.n.kind === 'line' ? nd.color : null }"
          :title="nd.n.kind === 'chapter' ? '双击跳转本章正文' : nd.n.kind === 'volume' ? '双击打开该卷第一章' : ''"
          @click.stop="select(nd)"
          @dblclick.stop="dbl(nd)"
        >
          <button v-if="(nd.children || []).length" class="om-caret" :class="{ folded: nd.n.fold }" title="折叠 / 展开" @click.stop="work.olnodeToggleFold(nd.n.id)">
            {{ nd.n.fold ? '▸' : '▾' }}
          </button>
          <span v-if="chapterOf(nd.n)" class="ol-dot" :data-s="chapterOf(nd.n).status" :title="STATUS_LABEL[chapterOf(nd.n).status]" />
          <div style="min-width: 0">
            <div class="om-label">{{ nd.n.kind === 'master' ? '总纲' : meta(nd.n).label }}</div>
            <div v-if="meta(nd.n).sub" class="om-sub">{{ meta(nd.n).sub }}</div>
          </div>
        </div>
        <a
          v-for="st in satsFlat"
          :key="'s:' + st.key"
          class="om-sat dl-link"
          href="javascript:;"
          :style="{ left: st.x + 'px', top: st.y + 'px', width: st.w + 'px' }"
          :data-dl-target="st.resolved ? st.resolved.kind + ':' + st.resolved.id : ''"
          :data-dl-title="st.title"
          :title="st.resolved ? '点击跳转 · 悬停预览' : '未找到目标内容'"
          @click.stop.prevent="satJump(st)"
        >
          <span class="dl-kind">{{ st.resolved ? KIND_LABEL[st.resolved.kind] : '?' }}</span>
          <span class="om-sat-text">{{ st.display }}</span>
        </a>
      </div>
    </div>
  </div>
</template>
