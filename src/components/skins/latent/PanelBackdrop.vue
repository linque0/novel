<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useUiStore } from '../../../stores/ui'
import { useWorkStore } from '../../../stores/work'
import { mountFlowBackdrop } from '../../../services/latent/flow.js'
import { flowPaletteKey, resolveFlowPalette } from '../../../services/latent/flow-palette.js'

const canvas = ref(null)
const ui = useUiStore()
const work = useWorkStore()
let flow
let motion
const palette = () => resolveFlowPalette(ui.flowBackground, work.work)
const updateMotion = event => flow?.setReducedMotion(event.matches)

onMounted(() => {
  motion = window.matchMedia('(prefers-reduced-motion: reduce)')
  const width = canvas.value.clientWidth
  flow = mountFlowBackdrop(canvas.value, {
    palette: palette(),
    reducedMotion: motion.matches,
    simWidth: width < 560 ? 320 : width < 900 ? 480 : 640,
    maxEdge: width < 900 ? 1280 : 1600
  })
  motion.addEventListener('change', updateMotion)
})
watch(() => flowPaletteKey(ui.flowBackground, work.work), () => flow?.setPalette(palette(), { duration: 600 }))
onBeforeUnmount(() => {
  motion?.removeEventListener('change', updateMotion)
  flow?.dispose()
})
</script>

<template>
  <div class="st-backdrop-wrap" aria-hidden="true">
    <canvas ref="canvas" class="st-backdrop"></canvas>
    <div class="st-layer dots"></div>
    <div class="st-layer vignette"></div>
    <div class="st-layer grain"></div>
  </div>
</template>
