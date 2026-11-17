<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useUiStore } from '../../../../stores/ui'
import { mountFlowBackdrop } from '../../../../services/latent/flow.js'
import { flowPaletteKey, resolveFlowPalette } from '../../../../services/latent/flow-palette.js'

const props = defineProps({ workId: { type: String, required: true } })
const ui = useUiStore()
const canvas = ref(null)
const work = computed(() => props.workId === 'all' ? null : { id: props.workId })
const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
let flow = null

const palette = () => resolveFlowPalette(ui.flowBackground, work.value)
const updateMotion = event => flow?.setReducedMotion(event.matches)

watch(() => flowPaletteKey(ui.flowBackground, work.value), () => flow?.setPalette(palette(), { duration: 600 }))
watch(() => ui.effectiveFlowSpeed, speed => flow?.setSpeed(speed))

onMounted(() => {
  const width = canvas.value.parentElement.clientWidth || window.innerWidth
  flow = mountFlowBackdrop(canvas.value, {
    palette: palette(),
    speed: ui.effectiveFlowSpeed,
    reducedMotion: motion.matches,
    simWidth: width < 560 ? 320 : width < 900 ? 480 : 640
  })
  motion.addEventListener('change', updateMotion)
})

onBeforeUnmount(() => {
  motion.removeEventListener('change', updateMotion)
  flow?.dispose()
  flow = null
})
</script>

<template>
  <div class="st-backdrop-wrap" aria-hidden="true">
    <canvas ref="canvas" class="st-backdrop"></canvas>
    <div class="st-layer vignette"></div>
  </div>
</template>
