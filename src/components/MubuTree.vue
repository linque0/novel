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
      out.push({ node: n, depth })
      if (!n.fold) walk(byParent.get(n.id) || [], depth + 1)
    }
  }
  walk(byParent.get(null) || [], 0)
  return out
})

function select(n) {
  ui.loreFocusId = n.id
}
function isActive(n) {
  return ui.mubuSelectedId === n.id || ui.loreFocusId === n.id
}
</script>

<template>
  <div style="display: flex; flex-direction: column; height: 100%">
    <div class="side-head">
      <span style="font-size: 12px; color: var(--text-dim)">节点层级 · 点击定位</span>
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
        <span class="ob-dot" :class="{ folded: r.node.fold }" />
        <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap">{{ r.node.text || '（空）' }}</span>
      </div>
      <p v-if="!visible.length" style="font-size: 12px; color: var(--text-dim); padding: 10px">
        设定库为空。在右侧输入内容，回车新建节点。
      </p>
    </div>
  </div>
</template>
