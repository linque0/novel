<script setup>
import { computed } from 'vue'
/* 同一套精装书系：大封面负责题名，缩略封面保留布面与月纹，
 * 完整作品名由旁侧目录展示，不把书名截成两个字。 */
const props = defineProps({
  book: { type: Object, required: true },
  variant: { type: String, default: 'book' } // book | mini
})
const title = computed(() => props.book?.title || '未命名作品')
const mode = computed(() => {
  const n = [...title.value].length
  return n <= 4 ? 'vertical' : n <= 8 ? 'two' : 'clamp'
})
const density = computed(() => {
  const n = [...title.value].length
  return n > 24 ? 'dense' : n > 14 ? 'compact' : 'regular'
})
const lines = computed(() => {
  const t = title.value
  if (mode.value === 'vertical') return [...t]
  if (mode.value === 'two') {
    const mid = Math.ceil([...t].length / 2)
    return [[...t].slice(0, mid).join(''), [...t].slice(mid).join('')].filter(Boolean)
  }
  return [t]
})
</script>

<template>
  <span class="crimson-cover" :class="['k-' + (book.kind || 'novel'), 'is-' + variant, 'title-' + mode, 'density-' + density]" :aria-hidden="variant === 'mini' ? true : undefined">
    <span class="crimson-cover-moon" aria-hidden="true"></span>
    <strong v-if="variant === 'book'" class="crimson-cover-title" :title="title" :aria-label="title">
      <template v-if="mode === 'vertical'">{{ title }}</template>
      <span v-else v-for="(line, i) in lines" :key="i" class="crimson-cover-line">{{ line }}</span>
    </strong>
    <span v-if="variant === 'book'" class="crimson-cover-author">
      <span v-if="book.author">{{ book.author }}　著</span>
    </span>
  </span>
</template>
