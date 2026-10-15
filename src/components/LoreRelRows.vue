<!-- 关联关系行（图二样式）：[类型 pill（图标 + 同色胶囊）] [方向 →/←] [目标名] [描述]。
     共用四处：幕布行尾悬停浮层 / 设定详情页 / 关联关系设置面板 / 人物详情「关联关系」区。
     pick = 点击行（跳转/切换详情）；remove = 行尾 × 删除（仅设置面板）；hover = 悬停联动（图谱↔列表互相高亮） -->
<script setup>
import OIcon from './OIcon.vue'
import { relIconFor, relColor } from '../services/relation-kinds'

defineProps({
  entries: { type: Array, default: () => [] },
  compact: { type: Boolean, default: false }, // 紧凑：不出「跳转」图标（悬停浮层用）
  removable: { type: Boolean, default: false }, // 可删除：行尾 ×
  clickable: { type: Boolean, default: true }, // 行可点（跳转/切换）；设置面板等管理场景传 false
  hoverLink: { type: String, default: '' } // 外部高亮的关系 id（图谱悬停联动）
})
defineEmits(['pick', 'remove', 'hover'])

function kindStyle(e) {
  const c = e.color || relColor(e.label)
  return {
    color: c,
    borderColor: `color-mix(in srgb, ${c} 42%, transparent)`,
    background: `color-mix(in srgb, ${c} 9%, transparent)`
  }
}
</script>

<template>
  <div class="rel-rows" :class="{ compact }">
    <div
      v-for="e in entries"
      :key="e.linkId + ':' + e.dir"
      class="rel-row"
      :class="{ on: hoverLink === e.linkId, static: !clickable }"
      :data-link="e.linkId"
      :title="e.description || ''"
      @click="clickable && $emit('pick', e)"
      @mouseenter="$emit('hover', e)"
      @mouseleave="$emit('hover', null)"
    >
      <span class="rel-kind" :style="kindStyle(e)"><OIcon :name="relIconFor(e.label)" :size="11" />{{ e.label }}</span>
      <span class="rel-dir" aria-hidden="true">{{ e.dir === 'out' ? '→' : '←' }}</span>
      <span class="rel-other">{{ e.otherTitle }}</span>
      <span v-if="e.description" class="rel-desc">{{ e.description }}</span>
      <span class="rel-fill" aria-hidden="true" />
      <button v-if="removable" class="rel-x" type="button" title="删除该关系" @click.stop="$emit('remove', e.linkId)">×</button>
      <OIcon v-else-if="!compact" class="rel-go" name="external" :size="11" />
    </div>
  </div>
</template>
