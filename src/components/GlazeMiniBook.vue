<script setup>
import { computed } from 'vue'
import { clothOf, isVerticalTitle, sealChar } from '../services/book3d/glaze-cloth'
const props = defineProps({ book: { type: Object, required: true } })
const cloth = computed(() => clothOf(props.book.kind))
const vertical = computed(() => isVerticalTitle(props.book.title))
const seal = computed(() => sealChar(props.book))
const style = computed(() => ({ '--cloth': cloth.value.board, '--ink': cloth.value.title, '--foil': cloth.value.rule, '--seal': cloth.value.seal }))
</script>

<template>
  <span class="gg-mini-book" :class="{ 'is-vertical': vertical }" :style="style" aria-hidden="true">
    <span class="gg-mini-frame"></span>
    <span class="gg-mini-title">{{ book.title || '未命名作品' }}</span>
    <span class="gg-mini-seal">{{ seal }}</span>
  </span>
</template>
