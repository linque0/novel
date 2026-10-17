<script setup>
import { computed } from 'vue'
import ribbon from '../assets/skins/glaze-ribbon.png'
const props = defineProps({ book: { type:Object, required:true } })
const palette = { novel:'#173cc0',note:'#9a8462',cedar:'#486755',violet:'#77668c',claret:'#842d43',ink:'#303d44' }
const color = computed(() => palette[props.book.kind] || palette.novel)
/* 设计稿的封面书名一律拆两行（前 2 字 + 余下）；两个行元素拼回来的 textContent 与原书名完全相同 */
const titleLines = computed(() => {
  const t = props.book.title || '未命名作品'
  return [t.slice(0, 2), t.slice(2)].filter((line) => line.length > 0)
})
</script>

<template>
  <span class="glaze-cover" :class="'k-' + (book.kind || 'novel')" :style="{ '--cover-color':color }">
    <img :src="ribbon" alt="" draggable="false" />
    <span class="glaze-cover-kicker">{{ book.genre || '作品' }} · {{ book.status || '构思' }}</span>
    <strong :title="book.title"><span v-for="(line, i) in titleLines" :key="i" class="glaze-cover-line">{{ line }}</span></strong>
    <span v-if="book.author" class="glaze-cover-author">{{ book.author }} 著</span>
  </span>
</template>
