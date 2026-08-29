<script setup>
import { computed } from 'vue'
import { useWorkStore } from '../stores/work'

const work = useWorkStore()
const items = computed(() => {
  const list = [{ label: '📘 总纲', refId: work.work?.id, kind: 'master' }]
  for (const v of work.liveVolumes) list.push({ label: '📖 ' + v.title, refId: v.id, kind: 'volume' })
  for (const c of work.liveChapters) list.push({ label: '📄 ' + c.title, refId: c.id, kind: 'chapter', dim: c.wordCount + '字' })
  return list
})

function select(it) {
  work.selOutlineId = it.refId
}
const isActive = (it) => work.selOutlineId === it.refId
</script>

<template>
  <div style="display: flex; flex-direction: column; height: 100%">
    <div class="side-head">
      <span style="font-size: 12px; color: var(--text-dim)">总纲 → 卷纲 → 章纲，点击编辑</span>
    </div>
    <div class="side-list">
      <div
        v-for="it in items"
        :key="it.refId"
        class="side-item"
        :class="{ active: isActive(it) }"
        role="button"
        tabindex="0"
        @click="select(it)"
        @keydown.enter="select(it)"
      >
        <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap">{{ it.label }}</span>
        <span v-if="it.dim" class="dim">{{ it.dim }}</span>
      </div>
    </div>
  </div>
</template>
