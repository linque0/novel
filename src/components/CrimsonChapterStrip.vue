<script setup>
import { computed } from 'vue'
import { useWorkStore } from '../stores/work'
/* 赤月戏的底部章条：全书章序（按卷序 → 章序），点一下切章。数据全部来自 store，不新造状态。 */
const work = useWorkStore()
const list = computed(() => work.liveChapters.slice().sort((a, b) =>
  (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || String(a.createdAt || '').localeCompare(String(b.createdAt || ''))))
const fmt = (n) => Number(n || 0).toLocaleString('zh-CN')
function pick(c) {
  work.selChapterId = c.id
  if (c.volumeId) work.selVolumeId = c.volumeId
}
</script>

<template>
  <nav v-if="list.length" class="crimson-chapter-strip" aria-label="章节目录">
    <button
      v-for="(c, i) in list"
      :key="c.id"
      type="button"
      class="crimson-chapter-tab"
      :class="{ active: c.id === work.selChapterId }"
      :aria-current="c.id === work.selChapterId ? 'page' : undefined"
      :title="c.title"
      @click="pick(c)"
    >
      <span class="num">{{ String(i + 1).padStart(2, '0') }}</span>
      <span class="title">{{ c.title }}</span>
      <small>{{ fmt(c.wordCount) }} 字</small>
    </button>
  </nav>
</template>
