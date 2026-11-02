<script setup>
import { useUiStore } from '../stores/ui'
const ui = useUiStore()
</script>

<template>
  <div class="gm-lighting" role="group" aria-label="展厅照明">
    <button type="button" :aria-pressed="ui.glazeLighting === 'day'" @click="ui.setGlazeLighting('day')">日光</button>
    <button type="button" :aria-pressed="ui.glazeLighting === 'gallery'" @click="ui.setGlazeLighting('gallery')">展厅</button>
  </div>
</template>
