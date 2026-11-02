<script setup>
import { computed, ref, watch } from 'vue'
import { NModal } from 'naive-ui'
import { useUiStore } from '../stores/ui'
import { paintingById, paintingDimensions } from '../services/gallery-art'

const props = defineProps({ compact: Boolean })
const ui = useUiStore()
const painting = computed(() => paintingById(ui.glazePainting))
const dimensions = computed(() => paintingDimensions(painting.value.id))
const displaySource = computed(() => props.compact ? painting.value.thumb : painting.value.displaySrc)
const loaded = ref(false)
const failed = ref(false)
const retry = ref(0)
const preview = ref(false)
watch(() => painting.value.id, () => { loaded.value = false; failed.value = false; preview.value = false })
function reload() { failed.value = false; loaded.value = false; retry.value++ }
</script>

<template>
  <figure class="glaze-artwork" :class="{ 'is-compact': compact }" :data-painting-id="painting.id">
    <div class="gm-gilt-frame">
      <span v-for="corner in ['tl', 'tr', 'bl', 'br']" :key="corner" class="gm-frame-corner" :class="corner" aria-hidden="true"></span>
      <div class="gm-mat" :class="{ 'is-loading': !loaded && !failed }" :aria-busy="!loaded && !failed">
        <button v-if="!failed" class="gm-art-button" type="button" :disabled="!loaded" :aria-label="`完整欣赏《${painting.title}》`" @click="preview = true">
          <img :key="`${painting.id}-${retry}`" class="glaze-artwork-image" :class="{ 'is-ready': loaded }" :src="displaySource" :width="dimensions.width" :height="dimensions.height" :alt="`${painting.artist}《${painting.title}》完整画作`" decoding="async" draggable="false" @load="loaded = true" @error="failed = true" />
        </button>
        <p v-if="!loaded && !failed" class="gm-art-status" role="status">画作载入中…</p>
        <div v-if="failed" class="gm-art-failure" role="alert"><span>画作暂时无法载入</span><button type="button" @click="reload">重新加载</button></div>
      </div>
    </div>
    <figcaption class="gm-art-caption" :class="{ 'gm-art-plaque': !compact }">
      <strong>{{ painting.title }}</strong>
      <span>{{ painting.artist }} · {{ painting.year }}</span>
      <small v-if="!compact">{{ painting.museum || painting.note }}</small>
      <small v-if="!compact" class="gm-art-source">{{ painting.group === 'world' ? '公版作品 · 来源 Wikimedia Commons' : '琉光工坊原创馆藏' }}</small>
    </figcaption>
  </figure>
  <NModal v-model:show="preview" preset="card" class="glaze-museum-popover gm-art-preview" :title="painting.title" :aria-label="`《${painting.title}》完整画作预览`" :style="{ width: 'min(1080px, 94vw)' }" :bordered="false" :mask-closable="true" :close-on-esc="true" :auto-focus="true" :trap-focus="true">
    <img class="gm-art-preview-image" :src="painting.src" :alt="`${painting.artist}《${painting.title}》完整画作`" />
    <p class="gm-art-preview-caption">{{ painting.artist }} · {{ painting.year }}<span v-if="painting.museum"> · {{ painting.museum }}</span></p>
  </NModal>
</template>
