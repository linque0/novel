<!--
  FlowTransitionOverlay.vue — 挂载于 body 的全屏流体转场画布覆盖层。
  按设置页所选模式切换底层引擎：
  - 'mist'（默认）：零 snapdom 的原生 GPU 合成三层视差「流雾粒子」；
  - 'ink'：按需动态懒加载 11-21 原版「原版融墨」，默认模式下零额外开销。
-->
<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { flowTransition } from '../../../services/latent/flow-transition.js'
import { createLiquidTransition } from '../../../services/latent/liquid-transition.js'

const props = defineProps({
  scene: { type: Object, default: null },
  mode: { type: String, default: 'mist' }
})
const canvas = ref(null)
let animation = null
let detach = null
let mountSeq = 0

function teardown() {
  detach?.()
  detach = null
  animation?.dispose()
  animation = null
}

async function mountMode(mode) {
  const seq = ++mountSeq
  teardown()
  await nextTick()
  if (seq !== mountSeq || !canvas.value) return
  if (mode === 'ink') {
    const { createInkTransition } = await import('../../../services/latent/ink-transition.js')
    if (seq !== mountSeq || !canvas.value) return
    animation = createInkTransition(canvas.value, () => props.scene)
  } else {
    animation = createLiquidTransition(canvas.value, () => props.scene)
  }
  detach = flowTransition.attach(animation.prepare)
}

onMounted(() => {
  void mountMode(props.mode)
})

watch(() => props.mode, (nextMode, prevMode) => {
  if (nextMode !== prevMode) void mountMode(nextMode)
})

onBeforeUnmount(() => {
  mountSeq += 1
  teardown()
})
</script>

<template>
  <Teleport to="body">
    <canvas :key="mode" ref="canvas" class="flow-liquid-overlay" aria-hidden="true" hidden />
  </Teleport>
</template>

<style scoped>
.flow-liquid-overlay {
  position: fixed;
  box-sizing: content-box;
  border: 0;
  z-index: 9999;
  pointer-events: none;
}
</style>
