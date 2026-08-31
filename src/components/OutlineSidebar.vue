<!-- 大纲侧边栏（8.8）：固定四组（总纲/卷纲/章纲/故事线）+ 自定义条目增删改、排序、折叠；章节点带状态点与跳转 -->
<script setup>
import { computed } from 'vue'
import { useWorkStore } from '../stores/work'

const work = useWorkStore()

const FIXED = ['master', 'volumes', 'chapters', 'lines']
const STATUS_LABEL = { draft: '草稿', done: '完成', revise: '待修改' }

const visible = computed(() => {
  const byParent = new Map()
  for (const n of work.liveOlnodes()) {
    const p = n.parentId || null
    if (!byParent.has(p)) byParent.set(p, [])
    byParent.get(p).push(n)
  }
  const out = []
  const walk = (list, depth) => {
    for (const n of list) {
      out.push({ node: n, depth, hasChildren: (byParent.get(n.id) || []).length > 0 })
      if (!n.fold) walk(byParent.get(n.id) || [], depth + 1)
    }
  }
  walk(byParent.get(null) || [], 0)
  return out
})

const canEditTitle = (n) => !['master', 'volumes', 'chapters', 'lines', 'volume', 'chapter'].includes(n.kind)
const deletable = (n) => ['note', 'line'].includes(n.kind)
const movable = (n) => n.kind !== 'master'

function label(n) {
  if (n.kind === 'chapter') return work.chapters.find((c) => c.id === n.refId && !c.deletedAt)?.title || '（已删章节）'
  if (n.kind === 'volume') return work.volumes.find((v) => v.id === n.refId && !v.deletedAt)?.title || '（已删卷）'
  const first = (n.title || (n.text || '').split('\n').find((x) => x.trim()) || '').trim()
  return first || '（空条目）'
}
function chapterOf(n) {
  return n.kind === 'chapter' ? work.chapters.find((c) => c.id === n.refId && !c.deletedAt) : null
}

function select(n) {
  work.selOlnodeId = n.id
}
const isActive = (n) => work.selOlnodeId === n.id
function toggleFold(n) {
  work.olnodeToggleFold(n.id)
}
function foldAll(v) {
  for (const n of work.liveOlnodes()) {
    if (work.olnodeChildren(n.id).length && !!n.fold !== v) work.olnodeToggleFold(n.id)
  }
}

/* 自定义条目增删改（本轮新增需求） */
function addChild(n) {
  const kind = n.kind === 'lines' ? 'line' : 'note'
  const row = work.olnodeAdd(n.id, { kind, title: '' })
  work.selOlnodeId = row.id
  work.outlineView = 'text'
}
function addLine() {
  const g = work.olnodeByKind('lines')
  if (!g) return
  const row = work.olnodeAdd(g.id, { kind: 'line', title: '新故事线' })
  work.selOlnodeId = row.id
  work.outlineView = 'text'
}
function move(n, dir) {
  work.olnodeMoveOrder(n.id, dir)
}
function remove(n) {
  if (!window.confirm(`删除「${label(n)}」及其全部子条目？此操作不可恢复。`)) return
  if (work.selOlnodeId === n.id || work.olnodeDescendants(n.id).some((d) => d.id === work.selOlnodeId)) {
    work.selOlnodeId = null
  }
  work.olnodeRemove(n.id)
}
function jumpChapter(n) {
  if (n.refId) work.navTo('chapters', n.refId)
}
</script>

<template>
  <div style="display: flex; flex-direction: column; height: 100%">
    <div class="side-head">
      <span style="font-size: 12px; color: var(--text-dim)">大纲结构 · 点击编辑</span>
      <div style="flex: 1"></div>
      <button class="btn-ghost" style="font-size: 11px; padding: 1px 6px" title="全部折叠" @click="foldAll(true)">▾</button>
      <button class="btn-ghost" style="font-size: 11px; padding: 1px 6px" title="全部展开" @click="foldAll(false)">▸</button>
    </div>
    <div class="side-list">
      <div
        v-for="r in visible"
        :key="r.node.id"
        class="side-item"
        :class="{ active: isActive(r.node) }"
        :style="{ paddingLeft: 6 + r.depth * 14 + 'px' }"
        role="button"
        tabindex="0"
        @click="select(r.node)"
        @keydown.enter="select(r.node)"
      >
        <button
          v-if="r.hasChildren"
          class="ob-arrow"
          :class="{ folded: r.node.fold }"
          :title="r.node.fold ? '展开子条目' : '折叠子条目'"
          @click.stop="toggleFold(r.node)"
        >
          {{ r.node.fold ? '▸' : '▾' }}
        </button>
        <span v-else class="ob-arrow ob-arrow-leaf">·</span>

        <span
          class="ol-side-label"
          :class="{ fixed: FIXED.includes(r.node.kind) }"
          style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1"
          :title="label(r.node)"
        >{{ label(r.node) }}</span>

        <span v-if="chapterOf(r.node)" class="dim" :title="'状态：' + STATUS_LABEL[chapterOf(r.node).status] + ' · ' + (chapterOf(r.node).wordCount || 0) + '字'">
          {{ chapterOf(r.node).wordCount || 0 }}字
        </span>

        <span class="ol-ops">
          <button v-if="chapterOf(r.node)" class="ol-op" title="跳转到本章正文" @click.stop="jumpChapter(r.node)">→</button>
          <button v-if="movable(r.node)" class="ol-op" title="上移" @click.stop="move(r.node, -1)">↑</button>
          <button v-if="movable(r.node)" class="ol-op" title="下移" @click.stop="move(r.node, 1)">↓</button>
          <button class="ol-op" title="添加子条目" @click.stop="addChild(r.node)">＋</button>
          <button v-if="deletable(r.node)" class="ol-op ol-op-danger" title="删除条目" @click.stop="remove(r.node)">✕</button>
        </span>
      </div>
      <p v-if="!visible.length" style="font-size: 12px; color: var(--text-dim); padding: 10px">大纲为空——打开一本书后将自动生成总纲 / 卷纲 / 章纲 / 故事线结构。</p>
    </div>
    <div class="ol-side-foot">
      <button class="btn-ghost" style="font-size: 11px" title="在「故事线」组下新增一条故事线" @click="addLine">＋ 故事线</button>
      <span style="flex: 1"></span>
      <span style="font-size: 11px; color: var(--text-dim)">选中条目后「＋」可加子条目</span>
    </div>
  </div>
</template>
