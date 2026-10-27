<script setup>
import { NButton, NDropdown } from 'naive-ui'
import GravityCover from './GravityCover.vue'
defineProps({
  book: { type: Object, required: true }, options: { type: Array, default: () => [] },
  /* active = 这本书正占据中央：点击是「打开作品」，并带 ⋯ 菜单；
     侧位时点击是「把它翻到中央」（emit center），不带菜单。 */
  active: Boolean, disabled: Boolean
})
const emit = defineEmits(['open', 'menu', 'center'])
</script>

<template>
  <article class="gravity-book">
    <button type="button" class="gravity-book-open" :disabled="disabled" :aria-label="active ? '打开作品：' + book.title : '将《' + book.title + '》移到中央'" @click="emit(active ? 'open' : 'center', book)">
      <GravityCover :book="book" />
    </button>
    <div v-if="active" class="gravity-book-menu">
      <NDropdown :options="options" trigger="click" @select="key => emit('menu', key, book)">
        <NButton size="small" quaternary :disabled="disabled" :aria-label="'作品菜单：' + book.title">⋯</NButton>
      </NDropdown>
    </div>
  </article>
</template>
