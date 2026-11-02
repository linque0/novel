<script setup>
import { computed, ref } from 'vue'
import { NPopover } from 'naive-ui'
import OIcon from './OIcon.vue'
import { useUiStore } from '../stores/ui'
import { PAINTING_GROUPS, paintingById } from '../services/gallery-art'

const ui = useUiStore()
const show = ref(false)
const painting = computed(() => paintingById(ui.glazePainting))
const total = computed(() => PAINTING_GROUPS.reduce((count, group) => count + group.items.length, 0))
const pending = ref(null)
const error = ref('')
let request = 0
async function choose(item) {
  const revision = ++request
  pending.value = item.id
  error.value = ''
  try {
    const chosen = await ui.setGlazePainting(item.id)
    if (revision === request && chosen) show.value = false
  } catch {
    if (revision === request) error.value = '画作加载或保存失败，已保留当前画作。请重试。'
  } finally {
    if (revision === request) pending.value = null
  }
}
</script>

<template>
  <NPopover v-model:show="show" class="glaze-museum-popover" trigger="click" placement="bottom-end" :show-arrow="false" raw :width="428">
    <template #trigger>
      <button type="button" class="gg-picker-trigger" title="切换馆藏画作背景" :aria-label="'切换馆藏画作背景，当前：' + painting.title" :aria-expanded="show">
        <span class="gg-picker-thumb"><img :src="painting.thumb" alt="" draggable="false" /></span>
        <span class="gg-picker-copy"><small>馆藏画作</small><strong>{{ painting.title }}</strong></span>
        <OIcon name="caret-down" :size="12" />
      </button>
    </template>
    <div class="gg-picker-pop">
      <header class="gg-picker-head">
        <div><strong>馆藏画作</strong><small>在书架与写作空间中欣赏</small></div>
        <span>{{ total }} 幅</span>
      </header>
      <section v-for="group in PAINTING_GROUPS" :key="group.id" class="gg-picker-group">
        <header><span>{{ group.label }}</span><small>{{ group.note }}</small></header>
        <div class="gg-picker-grid">
          <button v-for="item in group.items" :key="item.id" type="button" class="gg-picker-item" :class="{ 'is-active': item.id === painting.id, 'is-pending': item.id === pending }" :aria-pressed="item.id === painting.id" :aria-busy="item.id === pending" @click="choose(item)">
            <span class="gg-picker-art">
              <img :src="item.thumb" alt="" loading="lazy" draggable="false" />
              <span v-if="item.id === painting.id" class="gg-picker-check"><OIcon name="check" :size="11" /></span>
            </span>
            <span class="gg-picker-meta"><strong>{{ item.title }}</strong><small>{{ item.artist }} · {{ item.year }}</small></span>
          </button>
        </div>
      </section>
      <p v-if="pending" class="gg-picker-status" role="status">正在载入并保存画作…</p>
      <p v-if="error" class="gg-picker-error" role="alert">{{ error }}</p>
      <footer class="gg-picker-foot">世界名画为公版作品 · 来源 Wikimedia Commons</footer>
    </div>
  </NPopover>
</template>
