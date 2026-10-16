<script setup>
import { computed } from 'vue'
import ribbon from '../assets/skins/glaze-ribbon.png'
const props = defineProps({ book: { type:Object, required:true } })
const palette = { novel:'#173cc0',note:'#9a8462',cedar:'#486755',violet:'#77668c',claret:'#842d43',ink:'#303d44' }
const color = computed(() => palette[props.book.kind] || palette.novel)
</script>

<template>
  <span class="glaze-cover" :class="'k-' + (book.kind || 'novel')" :style="{ '--cover-color':color }">
    <img :src="ribbon" alt="" draggable="false" />
    <span class="glaze-cover-kicker">{{ book.genre || '作品' }} · {{ book.status || '构思' }}</span>
    <strong :title="book.title">{{ book.title || '未命名作品' }}</strong>
    <span v-if="book.author" class="glaze-cover-author">{{ book.author }} 著</span>
  </span>
</template>
