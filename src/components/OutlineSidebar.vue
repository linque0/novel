<!-- 大纲侧边栏（8.8.2）：模块条目列表——搜索 / 类型筛选 / 新建（事件·便签·引用卡·分组）/ 定位画布 / 删除；
     断线检测列表；条目点击选中并让画布居中 -->
<script setup>
import { computed, ref } from 'vue'
import { NButton, NPopover } from 'naive-ui'
import { useWorkStore } from '../stores/work'
import { targetById } from '../services/doublelinks'
import DLinkPicker from './DLinkPicker.vue'

const work = useWorkStore()
const q = ref('')
const typeFilter = ref('全部')
const showBroken = ref(false)
const citePicker = ref(false)
const typeManage = ref(false)
const newTypeName = ref('')

const customTypes = computed(() => work.olTypes)
function addType() {
  const t = work.olTypeAdd(newTypeName.value)
  if (t) newTypeName.value = ''
}
function relsCount(n) {
  return (Array.isArray(n.rels) ? n.rels.length : 0) + work.liveOlnodes().filter((o) => (o.rels || []).some((r) => r.toId === n.id)).length
}

const TYPE_META = {
  event: { icon: '◆', label: '事件' },
  note: { icon: '✎', label: '便签' },
  cite: { icon: '🔗', label: '引用' },
  textbox: { icon: '▭', label: '文本框' },
  container: { icon: '📦', label: '容器' },
  volume: { icon: '▤', label: '卷' },
  anchor: { icon: '⚓', label: '章节' }
}
const TYPES = computed(() => ['全部', '事件', '便签', '引用', '文本框', '容器', '章节', ...customTypes.value.map((t) => t.name)])

function chapterOf(n) {
  return n.kind === 'anchor' ? work.chapters.find((c) => c.id === n.refId && !c.deletedAt) : null
}
function volumeOf(n) {
  return n.kind === 'volume' ? work.volumes.find((v) => v.id === n.refId && !v.deletedAt) : null
}
function labelOf(n) {
  if (n.kind === 'anchor') return chapterOf(n)?.title || '（已删章节）'
  if (n.kind === 'volume') return volumeOf(n)?.title || n.title || '（已删卷）'
  if (n.kind === 'cite') {
    const t = /^(\w+):(.+)$/.exec(n.refId || '')
    const target = t ? targetById(t[1], t[2]) : null
    return target?.title || n.title || '（未选择目标）'
  }
  return n.title || (n.text || '').split('\n').find((x) => x.trim())?.trim().slice(0, 20) || '（空模块）'
}
function typeLabel(n) {
  if (n.kind === 'anchor') return '章节'
  return TYPE_META[n.kind]?.label || '事件'
}
function typeIcon(n) {
  if (n.kind === 'anchor') return '⚓'
  return TYPE_META[n.kind]?.icon || '◆'
}

const metaOf = (n, depth) => {
  const ch = chapterOf(n)
  const broken = work.olBroken
  const isTail = broken.tails.some((t) => t.id === n.id)
  const isMissing = broken.missing.some((t) => t.id === n.id)
  const rels = relsCount(n)
  const mtype = n.mtype || ''
  const parent = n.parentId ? work.olnodes.find((x) => x.id === n.parentId && !x.deletedAt) : null
  return {
    n,
    depth,
    hasKids: n.kind === 'container' && work.olnodeChildren(n.id).length > 0,
    icon: typeIcon(n),
    type: typeLabel(n),
    label: labelOf(n),
    parentLabel: parent ? parent.title || '容器' : '',
    badge: [ch ? `${ch.wordCount || 0}字` : '', n.kind === 'container' ? `${work.olnodeChildren(n.id).length}项` : '', rels ? `↔${rels}` : ''].filter(Boolean).join(' '),
    mtype,
    mcolor: mtype ? work.olTypes.find((t) => t.name === mtype)?.color || 'var(--text-dim)' : '',
    broken: showBroken.value && (isTail || isMissing),
    brokenTip: isTail ? '烂尾情节（无后继）' : isMissing ? '缺铺垫（无来源）' : ''
  }
}

const modules = computed(() => {
  const kw = q.value.trim().toLowerCase()
  const nodes = work.liveOlnodes()
  const match = (m) =>
    (typeFilter.value === '全部' || m.type === typeFilter.value || m.mtype === typeFilter.value) &&
    (!kw || m.label.toLowerCase().includes(kw))
  const byParent = new Map()
  for (const n of nodes) {
    const p = n.parentId || null
    if (!byParent.has(p)) byParent.set(p, [])
    byParent.get(p).push(n)
  }
  for (const list of byParent.values()) list.sort((a, b) => (a.kind === 'container' ? 0 : 1) - (b.kind === 'container' ? 0 : 1) || (a.sortOrder || 0) - (b.sortOrder || 0))
  const out = []
  const walk = (pid, depth) => {
    for (const n of byParent.get(pid) || []) {
      const m = metaOf(n, depth)
      if (match(m)) out.push(m)
      if (n.kind === 'container' && !n.fold) walk(n.id, depth + 1)
    }
  }
  walk(null, 0)
  // 搜索 / 筛选时补充被折叠容器隐藏的匹配项（平铺呈现，带所属容器前缀）
  if (kw || typeFilter.value !== '全部') {
    const seen = new Set(out.map((m) => m.n.id))
    for (const n of nodes) {
      if (seen.has(n.id)) continue
      const m = metaOf(n, 0)
      if (match(m)) out.push(m)
    }
  }
  return out
})

const brokenCount = computed(() => work.olBroken.tails.length + work.olBroken.missing.length)

function pick(m) {
  work.selOlnodeId = m.n.id
  work.canvasFocusTick++
  work.outlineView = 'canvas'
}
function addModule(kind, fields = {}) {
  const n = work.liveOlnodes().length
  const row = work.olnodeAdd(null, { kind, title: '', canvasX: 60 + (n % 4) * 224, canvasY: 40 + Math.floor(n / 4) * 116, ...fields })
  work.selOlnodeId = row.id
  work.canvasFocusTick++
}
function onCitePick(t) {
  citePicker.value = false
  const n = work.liveOlnodes().length
  const row = work.olnodeAdd(null, { kind: 'cite', refId: t.kind + ':' + t.id, title: t.title || '', canvasX: 60 + (n % 4) * 224, canvasY: 40 + Math.floor(n / 4) * 116 })
  work.selOlnodeId = row.id
  work.canvasFocusTick++
}
function rename(m) {
  const v = window.prompt('重命名模块', m.label)
  if (v == null) return
  work.olnodeSetTitle(m.n.id, v.trim())
}
function remove(m) {
  const hasKids = work.olnodeChildren(m.n.id).length
  if (hasKids && !window.confirm(`删除「${m.label}」及其 ${hasKids} 个子条目？`)) return
  if (!hasKids && !window.confirm(`删除「${m.label}」？`)) return
  work.olnodeRemove(m.n.id)
}
</script>

<template>
  <div style="display: flex; flex-direction: column; height: 100%">
    <div class="side-head">
      <span style="font-size: 12px; color: var(--text-dim)">模块条目 · 点击定位画布</span>
    </div>
    <div class="ol-side-add">
      <button class="btn-ghost" title="添加事件模块" @click="addModule('event')">＋事件</button>
      <button class="btn-ghost" title="添加便签" @click="addModule('note')">＋便签</button>
      <NPopover trigger="click" :show-arrow="false" style="padding: 6px">
        <template #trigger>
          <button class="btn-ghost" title="添加引用卡（人物/设定/章节/灵感）">＋引用卡</button>
        </template>
        <DLinkPicker @pick="onCitePick" />
      </NPopover>
      <button class="btn-ghost" title="添加文本框（PPT 式自由文本）" @click="addModule('textbox', { w: 180, h: 64, opacity: 1 })">＋文本框</button>
      <button class="btn-ghost" title="添加容器（拖入模块即归组）" @click="addModule('container')">＋容器</button>
    </div>
    <div style="padding: 0 10px 6px">
      <input v-model="q" class="rp-input" placeholder="搜索模块…" style="width: 100%; font-size: 12px" />
      <div class="ol-typefilter">
        <span v-for="t in TYPES" :key="t" class="om-chip" :class="{ on: typeFilter === t }" @click="typeFilter = t">{{ t }}</span>
        <span class="om-chip" :class="{ on: typeManage }" title="管理自定义类型" @click="typeManage = !typeManage">⚙</span>
      </div>
      <div v-if="typeManage" class="ol-type-manage">
        <div v-for="t in customTypes" :key="t.name" class="ol-type-row">
          <span class="om-mtype" :style="{ color: t.color, borderColor: t.color }">{{ t.name }}</span>
          <span style="flex: 1"></span>
          <button class="ol-op ol-op-danger" title="删除该类型（节点保留，标签变灰）" @click="work.olTypeRemove(t.name)">✕</button>
        </div>
        <div class="ol-type-row">
          <input v-model="newTypeName" class="rp-input" placeholder="新类型名…" style="flex: 1; font-size: 12px" @keyup.enter="addType" />
          <button class="ol-op" title="添加类型" @click="addType">＋</button>
        </div>
      </div>
    </div>
    <div class="side-list">
      <div
        v-for="m in modules"
        :key="m.n.id"
        class="side-item"
        :class="{ active: work.selOlnodeId === m.n.id, 'ol-broken-item': m.broken }"
        :style="{ paddingLeft: 6 + m.depth * 14 + 'px' }"
        :title="m.brokenTip || (m.parentLabel && !m.hasKids ? m.parentLabel + ' · ' + m.label : m.label)"
        role="button"
        tabindex="0"
        @click="pick(m)"
        @keydown.enter="pick(m)"
      >
        <button
          v-if="m.hasKids"
          class="ob-arrow"
          :class="{ folded: m.n.fold }"
          :title="m.n.fold ? '展开子模块' : '折叠子模块（与画布同步）'"
          @click.stop="work.olnodeToggleFold(m.n.id)"
        >{{ m.n.fold ? '▸' : '▾' }}</button>
        <span v-else class="ob-arrow ob-arrow-leaf">·</span>
        <span class="ol-type-icon">{{ m.icon }}</span>
        <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1">
          <span v-if="m.parentLabel" class="ol-side-parent">{{ m.parentLabel }} / </span>{{ m.label }}
        </span>
        <span v-if="m.mtype" class="om-mtype" :style="{ color: m.mcolor, borderColor: m.mcolor }">{{ m.mtype }}</span>
        <span v-if="m.badge" class="dim">{{ m.badge }}</span>
        <span class="ol-ops">
          <button class="ol-op" title="重命名" @click.stop="rename(m)">✎</button>
          <button class="ol-op ol-op-danger" title="删除" @click.stop="remove(m)">✕</button>
        </span>
      </div>
      <p v-if="!modules.length" style="font-size: 12px; color: var(--text-dim); padding: 10px">
        {{ q || typeFilter !== '全部' ? '没有匹配的模块。' : '画布为空——用上方按钮添加模块，或到大纲画布从骨架模板开始。' }}
      </p>
    </div>
    <div class="ol-side-foot">
      <span class="om-chip" :class="{ on: showBroken }" title="断线检测：烂尾 / 缺铺垫" @click="showBroken = !showBroken">断线 {{ brokenCount }}</span>
      <span style="flex: 1"></span>
      <span style="font-size: 11px; color: var(--text-dim)">共 {{ modules.length }} 模块</span>
    </div>
  </div>
</template>
