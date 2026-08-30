<script setup>
import { computed } from 'vue'
import { useWorkStore } from '../stores/work'
import { useUiStore } from '../stores/ui'

const work = useWorkStore()
const ui = useUiStore()

const visible = computed(() => {
  const live = work.liveMubu()
  const byParent = new Map()
  for (const n of live) {
    const p = n.parentId || null
    if (!byParent.has(p)) byParent.set(p, [])
    byParent.get(p).push(n)
  }
  const out = []
  const walk = (list, depth) => {
    for (const n of list) {
      const hasChildren = (byParent.get(n.id) || []).length > 0
      out.push({ node: n, depth, hasChildren })
      if (!n.fold) walk(byParent.get(n.id) || [], depth + 1)
    }
  }
  walk(byParent.get(null) || [], 0)
  return out
})

function select(n) {
  ui.loreFocusId = n.id
  ui.mubuSelectedId = n.id
}
function isActive(n) {
  return ui.mubuSelectedId === n.id || ui.loreFocusId === n.id
}
function toggleFold(n, e) {
  e.stopPropagation()
  work.mubuToggleFold(n.id)
  ui.mubuSyncTick++
}
function foldAll(v) {
  work.mubuFoldAll(v)
  ui.mubuSyncTick++
}
</script>

<template>
  <div style="display: flex; flex-direction: column; height: 100%">
    <div class="side-head">
      <span style="font-size: 12px; color: var(--text-dim)">节点层级 · 点击定位</span>
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
        :style="{ paddingLeft: 6 + r.depth * 16 + 'px' }"
        role="button"
        tabindex="0"
        @click="select(r.node)"
        @keydown.enter="select(r.node)"
      >
        <button
          v-if="r.hasChildren"
          class="ob-arrow"
          :class="{ folded: r.node.fold }"
          :title="r.node.fold ? '展开子节点' : '折叠子节点'"
          @click.stop="toggleFold(r.node, $event)"
        >
          {{ r.node.fold ? '▸' : '▾' }}
        </button>
        <span v-else class="ob-arrow ob-arrow-leaf">·</span>
        <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap">{{ r.node.text || '（空）' }}</span>
      </div>
      <p v-if="!visible.length" style="font-size: 12px; color: var(--text-dim); padding: 10px">
        设定库为空。在右侧输入内容，回车新建节点。
      </p>
    </div>
  </div>
</template>
