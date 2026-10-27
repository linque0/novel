<script setup>
import CrimsonCover from './CrimsonCover.vue'

// Presentation only: the shelf owns focus, menus, disabled state and opening.
defineProps({
  book: { type: Object, required: true },
  variant: { type: String, default: 'book' }
})
</script>

<template>
  <span class="crimson-book-shell" :class="['k-' + (book.kind || 'novel'), 'is-' + variant]">
    <span class="crimson-book-volume">
      <span class="crimson-book-face crimson-book-back" aria-hidden="true"></span>
      <span class="crimson-book-face crimson-book-binding" aria-hidden="true">
        <span v-if="variant === 'book'">{{ book.title }}</span>
      </span>
      <span class="crimson-book-face crimson-book-pages" aria-hidden="true"></span>
      <span class="crimson-book-face crimson-book-top" aria-hidden="true"></span>
      <span class="crimson-book-face crimson-book-bottom" aria-hidden="true"></span>
      <span class="crimson-book-face crimson-book-front">
        <CrimsonCover :book="book" :variant="variant" />
      </span>
    </span>
  </span>
</template>

<style src="../styles/skins/crimson-book.css"></style>
