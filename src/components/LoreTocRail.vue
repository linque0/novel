<!-- 设定目录细条：平常只占一窄列（竖排标题 + 短横线），悬停或点击时浮出目录面板。
     列表页用当前设定集的条目树，详情页用当前条目的子条目树。 -->
<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  items: { type: Array, default: () => [] },
  title: { type: String, default: '设定目录' },
  activeId: { type: String, default: '' }
})
const emit = defineEmits(['pick'])

const pinned = ref(false)
/* 细条上的短横线：最多 28 条，宽度随层级递增，当前项加粗 */
const marks = computed(() => props.items.slice(0, 28))

function pick(id) {
  emit('pick', id)
  pinned.value = false
}
</script>

<template>
  <aside class="lore-toc-rail" :class="{ pinned }" aria-label="设定目录">
    <button
      type="button"
      class="lore-toc-handle"
      :aria-expanded="pinned"
      aria-label="展开设定目录"
      @click="pinned = !pinned"
    >
      <span class="lore-toc-label">{{ title }}</span>
      <span class="lore-toc-marks" aria-hidden="true">
        <i
          v-for="it in marks"
          :key="it.id"
          :class="{ active: it.id === activeId }"
          :style="{ width: 10 + Math.min(it.depth || 0, 3) * 4 + 'px' }"
        />
        <i v-if="!marks.length" style="width: 10px" />
      </span>
    </button>
    <div class="lore-toc-panel">
      <div class="lore-toc-head">
        <h3>{{ title }}</h3>
        <span>{{ items.length }}</span>
      </div>
      <div class="lore-toc-list">
        <button
          v-for="it in items"
          :key="it.id"
          type="button"
          class="lore-toc-item"
          :class="{ active: it.id === activeId }"
          :style="{ paddingLeft: 8 + (it.depth || 0) * 14 + 'px' }"
          :title="it.text"
          @click="pick(it.id)"
        >{{ it.text }}</button>
        <p v-if="!items.length" class="lore-toc-empty">暂无条目</p>
      </div>
    </div>
  </aside>
</template>
