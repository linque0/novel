<!-- 人物关系图（8.8.3 v0.4.1）：复用 graphview 画布引擎——人物节点=头像+姓名+角色徽标，
     边=relations（标签渲染于中点，点选编辑/删除，与关系列表双向同步）；
     从人物节点边缘拖线到另一人物即建关系；悬停高亮一度关系网（其余淡出）；
     圆形/网格一键排布；角色·标签筛选；孤岛人物提示；拖摆位置存 appconfig charGraph:<workId> -->
<script setup>
import { computed, ref, reactive, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useWorkStore } from '../stores/work'
import { usePanZoom, pickAnchors, edgeGeom } from '../services/graphview'
import { freeSpotFor } from './outline/canvas-model'

const work = useWorkStore()
const canvasEl = ref(null)
const { zoom, tx, ty, innerStyle, onWheel, onPanStart, fit: fitTo, centerOn } = usePanZoom(canvasEl)

const NODE_W = 132
const NODE_H = 56
const ROLE_COLOR = { 主角: '#c0392b', 反派: '#d35400', 配角: '#2980b9', 龙套: '#7f8c8d' }

const layout = ref({}) // { [charId]: {x,y} }
const dragPos = reactive(new Map())
const hoverId = ref(null)
const flashIds = reactive(new Set())
const relEdit = ref(null) // { relId, mx, my } 边标签编辑
const relInput = ref(null) // { fromId, toId, x, y, value } 拖线建关系输入
const connecting = ref(null) // { fromId, x, y }
const roleFilter = ref('全部')
const tagFilter = ref([])
let saveTimer = null
const relInputEl = ref(null)

const chars = computed(() => {
  let list = work.liveCharacters
  if (roleFilter.value !== '全部') list = list.filter((c) => c.role === roleFilter.value)
  if (tagFilter.value.length) list = list.filter((c) => (c.tags || []).some((t) => tagFilter.value.includes(t)))
  return list
})
const allTags = computed(() => [...new Set(work.liveCharacters.flatMap((c) => c.tags || []))])
const posOf = (c) => dragPos.get(c.id) || layout.value[c.id] || null
const avatarOf = (c) => (c.avatarAssetId ? work.assetUrl(c.avatarAssetId) : '')

/* ---------- 排布与布局持久化 ---------- */
function circleAll() {
  const list = chars.value
  const R = Math.max(170, list.length * 32)
  const next = {}
  list.forEach((c, i) => {
    const a = (i / list.length) * Math.PI * 2 - Math.PI / 2
    next[c.id] = { x: Math.round(460 + R * Math.cos(a)), y: Math.round(340 + R * Math.sin(a)) }
  })
  layout.value = next
  scheduleSave()
}
function gridAll() {
  const list = chars.value
  const cols = Math.max(2, Math.ceil(Math.sqrt(list.length)))
  const next = {}
  list.forEach((c, i) => {
    next[c.id] = { x: 80 + (i % cols) * (NODE_W + 60), y: 80 + Math.floor(i / cols) * (NODE_H + 60) }
  })
  layout.value = next
  scheduleSave()
}
function ensureLayout() {
  if (!chars.value.length) return
  if (!Object.keys(layout.value).length) {
    circleAll()
    return
  }
  const missing = chars.value.filter((c) => !layout.value[c.id])
  if (!missing.length) return
  const occupied = chars.value.filter((c) => layout.value[c.id]).map((c) => ({ ...layout.value[c.id], w: NODE_W, h: NODE_H }))
  const next = { ...layout.value }
  for (const c of missing) {
    const spot = freeSpotFor(occupied, { w: NODE_W, h: NODE_H })
    next[c.id] = { x: spot.x, y: spot.y }
    occupied.push({ x: spot.x, y: spot.y, w: NODE_W, h: NODE_H })
  }
  layout.value = next
  scheduleSave()
}
async function loadLayout() {
  layout.value = (await work.loadCharGraph()) || {}
  ensureLayout()
  nextTick(fitView)
}
function scheduleSave() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => work.saveCharGraph(layout.value), 350)
}
function flushSave() {
  clearTimeout(saveTimer)
  if (work.work && Object.keys(layout.value).length) work.saveCharGraph(layout.value)
}

/* ---------- 边集合与一度网高亮 ---------- */
const edges = computed(() => {
  const out = []
  const ids = new Set(chars.value.map((c) => c.id))
  for (const r of work.relations) {
    if (!ids.has(r.fromId) || !ids.has(r.toId)) continue
    const a = chars.value.find((c) => c.id === r.fromId)
    const b = chars.value.find((c) => c.id === r.toId)
    if (!posOf(a) || !posOf(b)) continue
    const g = edgeGeom(...pickAnchors({ ...posOf(a), w: NODE_W, h: NODE_H }, { ...posOf(b), w: NODE_W, h: NODE_H }), 'bezier')
    out.push({ rel: r, ...g })
  }
  return out
})
const dimIds = computed(() => {
  if (!hoverId.value) return new Set()
  const keep = new Set([hoverId.value])
  for (const r of work.relations) {
    if (r.fromId === hoverId.value) keep.add(r.toId)
    if (r.toId === hoverId.value) keep.add(r.fromId)
  }
  return new Set(chars.value.filter((c) => !keep.has(c.id)).map((c) => c.id))
})
const dimEdgeIds = computed(() => {
  if (!hoverId.value) return new Set()
  return new Set(work.relations.filter((r) => r.fromId !== hoverId.value && r.toId !== hoverId.value).map((r) => r.id))
})
const isolated = computed(() => {
  const linked = new Set()
  for (const r of work.relations) {
    linked.add(r.fromId)
    linked.add(r.toId)
  }
  return work.liveCharacters.filter((c) => !linked.has(c.id))
})
const bounds = computed(() => {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const c of chars.value) {
    const p = posOf(c)
    if (!p) continue
    x0 = Math.min(x0, p.x)
    y0 = Math.min(y0, p.y)
    x1 = Math.max(x1, p.x + NODE_W)
    y1 = Math.max(y1, p.y + NODE_H)
  }
  if (x0 === Infinity) return { x: 0, y: 0, w: 600, h: 400 }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
})
/* 连线层视口：人物可拖到原点左侧/上方（负坐标），包围盒向左/上收缩时
 * 若视口仍从 (0,0) 起算会裁掉连线——改为覆盖负象限并四周留余量 */
const svgBox = computed(() => {
  const b = bounds.value
  const x0 = Math.min(0, b.x - 400)
  const y0 = Math.min(0, b.y - 400)
  const x1 = Math.max(2400, b.x + b.w + 400)
  const y1 = Math.max(1600, b.y + b.h + 400)
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
})
function fitView() {
  fitTo(bounds.value)
}

/* ---------- 交互 ---------- */
function canvasPt(e) {
  const r = canvasEl.value.getBoundingClientRect()
  return { x: (e.clientX - r.left - tx.value) / zoom.value, y: (e.clientY - r.top - ty.value) / zoom.value }
}
function hitCharAt(pt, excludeId) {
  for (const c of [...chars.value].reverse()) {
    if (c.id === excludeId) continue
    const p = posOf(c)
    if (p && pt.x >= p.x && pt.x <= p.x + NODE_W && pt.y >= p.y && pt.y <= p.y + NODE_H) return c
  }
  return null
}
function onNodeDown(e, c) {
  if (e.button !== 0) return
  if (e.target.closest('button, input, a, .rg-apt')) return
  e.stopPropagation()
  work.selCharacterId = c.id
  relEdit.value = null
  const orig = { ...(layout.value[c.id] || { x: 0, y: 0 }) }
  const mx = e.clientX
  const my = e.clientY
  const move = (ev) => {
    dragPos.set(c.id, { x: Math.round(orig.x + (ev.clientX - mx) / zoom.value), y: Math.round(orig.y + (ev.clientY - my) / zoom.value) })
  }
  const up = () => {
    window.removeEventListener('mousemove', move)
    window.removeEventListener('mouseup', up)
    const p = dragPos.get(c.id)
    if (p) {
      layout.value = { ...layout.value, [c.id]: p }
      dragPos.delete(c.id)
      scheduleSave()
    }
  }
  window.addEventListener('mousemove', move)
  window.addEventListener('mouseup', up)
}
/* 从节点边缘拖线到另一人物 → 弹关系标签输入 */
function startConnect(e, c) {
  e.stopPropagation()
  e.preventDefault()
  const a = canvasPt(e)
  connecting.value = { fromId: c.id, x: a.x, y: a.y }
  const move = (ev) => {
    const p = canvasPt(ev)
    connecting.value = { fromId: c.id, x: p.x, y: p.y }
  }
  const up = (ev) => {
    window.removeEventListener('mousemove', move)
    window.removeEventListener('mouseup', up)
    const st = connecting.value
    connecting.value = null
    if (!st) return
    const target = hitCharAt(canvasPt(ev), c.id)
    if (!target) return
    const dup = work.relations.some((r) => (r.fromId === c.id && r.toId === target.id) || (r.fromId === target.id && r.toId === c.id))
    if (dup) return
    const p = canvasPt(ev)
    relInput.value = { fromId: c.id, toId: target.id, x: p.x, y: p.y, value: '' }
    nextTick(() => relInputEl.value?.focus())
  }
  window.addEventListener('mousemove', move)
  window.addEventListener('mouseup', up)
}
const connPath = computed(() => {
  const c = connecting.value
  if (!c) return ''
  const from = work.liveCharacters.find((x) => x.id === c.fromId)
  const p = from && posOf(from)
  const start = p ? { x: p.x + NODE_W / 2, y: p.y + NODE_H / 2 } : c
  return `M ${start.x} ${start.y} L ${c.x} ${c.y}`
})
function saveRelInput() {
  const st = relInput.value
  relInput.value = null
  if (st && st.value.trim()) work.addRelation(st.fromId, st.toId, st.value.trim())
}
function openRelEdit(rel, mid) {
  relEdit.value = { relId: rel.id, mx: mid.x, my: mid.y }
  nextTick(() => relInputEl.value?.focus())
}
function patchRelLabel(e) {
  if (relEdit.value) work.updateRelation(relEdit.value.relId, { label: e.target.value })
}
function removeRel() {
  if (relEdit.value) work.removeRelation(relEdit.value.relId)
  relEdit.value = null
}
function onWinDown(e) {
  if (relEdit.value && !e.target.closest?.('.rg-eedit, .rg-elabel, .rg-edge-hit')) relEdit.value = null
  if (relInput.value && !e.target.closest?.('.rg-relinput')) saveRelInput()
  if (ctxMenu.value && !e.target.closest?.('.rg-ctx')) ctxMenu.value = null
}
/* 人物节点右键菜单（v0.4.3）：替代旧「选中即显示」的常驻小工具条——不遮挡节点内容，随点随开随点随关 */
const ctxMenu = ref(null) // { charId, x, y }
function openCtx(e, c) {
  const p = canvasPt(e)
  work.selCharacterId = c.id
  ctxMenu.value = { charId: c.id, x: p.x, y: p.y }
}
const ctxChar = computed(() => work.liveCharacters.find((c) => c.id === ctxMenu.value?.charId) || null)
function ctxSendOutline() {
  if (ctxChar.value) work.sendCharToOutline(ctxChar.value.id)
  ctxMenu.value = null
}
function ctxOpenDetail() {
  if (ctxChar.value) openDetail(ctxChar.value)
  ctxMenu.value = null
}
function onWheelC(ev) {
  ctxMenu.value = null
  onWheel(ev)
}
function nodeStyle(c) {
  const p = posOf(c)
  if (!p) return { display: 'none' }
  return {
    left: p.x + 'px',
    top: p.y + 'px',
    width: NODE_W + 'px',
    height: NODE_H + 'px',
    opacity: dimIds.value.has(c.id) ? 0.15 : 1,
    zIndex: work.selCharacterId === c.id ? 6 : 3
  }
}
function openDetail(c) {
  work.selCharacterId = c.id
  work.charView = 'list'
}
function locateIsolated(c) {
  work.selCharacterId = c.id
  work.charFocusId = c.id
  work.charFocusTick++
}
/* 定位请求可能先于组件挂载（跨模块跳转）——以 handled 戳补处理，不丢闪 */
function focusCharById(id) {
  const c = chars.value.find((x) => x.id === id) || work.liveCharacters.find((x) => x.id === id)
  if (!c) return
  roleFilter.value = '全部'
  tagFilter.value = []
  nextTick(() => {
    const p = posOf(c)
    if (p) centerOn(p.x + NODE_W / 2, p.y + NODE_H / 2)
    flashIds.add(c.id)
    setTimeout(() => flashIds.delete(c.id), 1600)
  })
}
function maybeFocus() {
  if (work.charFocusHandled !== work.charFocusTick && work.charFocusId) {
    work.charFocusHandled = work.charFocusTick
    focusCharById(work.charFocusId)
  }
}
watch(() => work.charFocusTick, maybeFocus)

onMounted(async () => {
  await loadLayout()
  window.addEventListener('mousedown', onWinDown, true)
  const ids = work.liveCharacters.filter((ch) => ch.avatarAssetId).map((ch) => ch.avatarAssetId)
  if (ids.length) await work.warmUrls(ids)
  maybeFocus()
})
onBeforeUnmount(() => {
  window.removeEventListener('mousedown', onWinDown, true)
  flushSave()
})
</script>

<template>
  <div class="om-wrap">
    <div class="om-toolbar rg-toolbar">
      <span v-for="r in ['全部', '主角', '配角', '反派', '龙套']" :key="r" class="oc-chip" :class="{ on: roleFilter === r }" @click="roleFilter = r">{{ r }}</span>
      <select v-model="tagFilter" class="rg-tagselect" multiple title="按标签筛选（Ctrl+点击多选）">
        <option v-for="t in allTags" :key="t" :value="t">{{ t }}</option>
      </select>
      <span style="flex: 1"></span>
      <span v-if="isolated.length" class="oc-chip oc-warn" :title="'暂无任何关系：' + isolated.map((c) => c.name).join('、')" @click="locateIsolated(isolated[0])">孤岛 {{ isolated.length }}</span>
      <span class="oc-count">{{ chars.length }} 人 · {{ edges.length }} 条关系</span>
      <button class="om-btn" title="圆形排布" @click="circleAll">◯</button>
      <button class="om-btn" title="网格排布" @click="gridAll">▦</button>
      <button class="om-btn" title="缩小" @click="zoom = Math.max(0.3, zoom - 0.15)">－</button>
      <button class="om-btn" title="放大" @click="zoom = Math.min(2.2, zoom + 0.15)">＋</button>
      <button class="om-btn" title="适应视图" @click="fitView">适应</button>
    </div>

    <div ref="canvasEl" class="om-canvas rg-canvas" @mousedown="onPanStart" @wheel="onWheelC">
      <div class="om-inner" :style="innerStyle">
        <svg
          class="om-edges rg-edges"
          :style="{ left: svgBox.x + 'px', top: svgBox.y + 'px' }"
          :width="svgBox.w"
          :height="svgBox.h"
          :viewBox="svgBox.x + ' ' + svgBox.y + ' ' + svgBox.w + ' ' + svgBox.h"
        >
          <path
            v-for="e in edges"
            :key="'h' + e.rel.id"
            class="rg-edge-hit"
            :d="e.d"
            :opacity="dimEdgeIds.has(e.rel.id) ? 0.1 : 1"
            @mousedown.stop="openRelEdit(e.rel, e.mid)"
          />
          <path
            v-for="e in edges"
            :key="'v' + e.rel.id"
            :d="e.d"
            fill="none"
            stroke="var(--accent)"
            stroke-width="1.7"
            :opacity="dimEdgeIds.has(e.rel.id) ? 0.1 : 0.8"
          />
          <path v-if="connecting" :d="connPath" fill="none" stroke="var(--accent)" stroke-width="1.6" stroke-dasharray="6 4" />
        </svg>

        <!-- 关系标签（点击编辑） -->
        <div
          v-for="e in edges.filter((x) => x.rel.label)"
          :key="'l' + e.rel.id"
          class="rg-elabel"
          :style="{ left: e.mid.x + 'px', top: e.mid.y + 'px', opacity: dimEdgeIds.has(e.rel.id) ? 0.12 : 1 }"
          @mousedown.stop="openRelEdit(e.rel, e.mid)"
        >{{ e.rel.label }}</div>

        <!-- 人物节点 -->
        <div
          v-for="c in chars"
          :key="c.id"
          class="rg-node"
          :class="{ sel: work.selCharacterId === c.id, flash: flashIds.has(c.id) }"
          :style="nodeStyle(c)"
          @mousedown="onNodeDown($event, c)"
          @contextmenu.prevent="openCtx($event, c)"
          @mouseenter="hoverId = c.id"
          @mouseleave="hoverId = null"
          @dblclick.stop="openDetail(c)"
        >
          <img v-if="avatarOf(c)" :src="avatarOf(c)" class="rg-avatar" />
          <div v-else class="rg-avatar rg-avatar-empty">人</div>
          <div class="rg-meta">
            <div class="rg-name">{{ c.name || '未命名' }}</div>
            <span class="rg-role" :style="{ color: ROLE_COLOR[c.role] || 'var(--text-dim)', borderColor: ROLE_COLOR[c.role] || 'var(--border)' }">{{ c.role }}</span>
          </div>
          <span v-for="sd in ['right', 'left']" :key="sd" class="oc-apt rg-apt" :data-side="sd" title="拖到另一人物建立关系" @mousedown="startConnect($event, c)" />
        </div>

        <!-- 拖线建关系输入 -->
        <div v-if="relInput" class="rg-relinput" :style="{ left: relInput.x + 'px', top: relInput.y + 'px' }" @mousedown.stop>
          <input ref="relInputEl" v-model="relInput.value" class="rp-input" placeholder="关系（如：师徒 / 宿敌）…" @keydown.enter="saveRelInput" @keydown.esc="relInput = null" />
          <button class="om-btn" title="保存" @click="saveRelInput">✓</button>
        </div>

        <!-- 边标签编辑 -->
        <div v-if="relEdit" class="rg-eedit" :style="{ left: relEdit.mx + 'px', top: relEdit.my + 'px' }" @mousedown.stop>
          <input class="rp-input" :value="work.relations.find((r) => r.id === relEdit.relId)?.label || ''" placeholder="关系标签…" @input="patchRelLabel" @keydown.enter="relEdit = null" @keydown.esc="relEdit = null" />
          <button class="om-btn oc-mini-x" title="删除关系" @click="removeRel">✕</button>
        </div>

        <!-- 人物节点右键菜单（替代旧常驻小工具条，不再遮挡节点内容） -->
        <div v-if="ctxMenu" class="rg-ctx" :style="{ left: ctxMenu.x + 'px', top: ctxMenu.y + 'px' }" @mousedown.stop>
          <button title="发送为大纲画布引用卡" @click="ctxSendOutline">发送为大纲引用卡</button>
          <button title="打开人物详情（也可双击节点）" @click="ctxOpenDetail">打开详情</button>
        </div>
      </div>
    </div>

    <div v-if="!work.liveCharacters.length" class="oc-quick">
      <div class="big">众生有相</div>
      <p>先在列表视图创建人物，再回到关系图连线成网。</p>
      <div class="oc-quick-btns">
        <button @click="work.charView = 'list'">去创建人物</button>
      </div>
    </div>
  </div>
</template>
