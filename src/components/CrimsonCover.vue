<script setup>
import { computed } from 'vue'
/* 生成式书封（应用不引入设计稿的参考封面）：纸色 + 款式色 + 旧金细框，
   短题竖排、中长题两行、超长横排截断——与书架大标题同一套题名规则。 */
const props = defineProps({
  book: { type: Object, required: true },
  variant: { type: String, default: 'book' } // book | mini
})
const title = computed(() => props.book?.title || '未命名作品')
const mode = computed(() => {
  const n = [...title.value].length
  return n <= 4 ? 'vertical' : n <= 8 ? 'two' : 'clamp'
})
const lines = computed(() => {
  const t = title.value
  /* 剧目行的小书封只放前两字，避免 12px 竖排挤成三列 */
  if (props.variant === 'mini') return [[...t].slice(0, 2).join('')]
  if (mode.value === 'vertical') return [...t]
  if (mode.value === 'two') {
    const mid = Math.ceil([...t].length / 2)
    return [[...t].slice(0, mid).join(''), [...t].slice(mid).join('')].filter(Boolean)
  }
  return [t]
})
</script>

<template>
  <span class="crimson-cover" :class="['k-' + (book.kind || 'novel'), 'is-' + variant, 'title-' + mode]">
    <span class="crimson-cover-moon" aria-hidden="true"></span>
    <span class="crimson-cover-hills" aria-hidden="true"></span>
    <span class="crimson-cover-rule" aria-hidden="true"></span>
    <strong class="crimson-cover-title" :title="title">
      <template v-if="mode === 'vertical'">{{ title }}</template>
      <span v-else v-for="(line, i) in lines" :key="i" class="crimson-cover-line">{{ line }}</span>
    </strong>
    <span v-if="variant === 'book'" class="crimson-cover-author">
      <span v-if="book.author">{{ book.author }}　著</span>
    </span>
    <span v-if="variant === 'book'" class="crimson-cover-seal" aria-hidden="true">赤月</span>
  </span>
</template>
