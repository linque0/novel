<!-- 纸面素材库：展示四类事件形态与四类内容卡的实际纹理；素材只用于界面，不提供下载。 -->
<script setup>
import { computed } from 'vue'
import { NModal } from 'naive-ui'
import { EVENT_SHAPES, PAPER_KINDS, paperStyle } from './outline-paper'

const props = defineProps({ show: { type: Boolean, default: false } })
const emit = defineEmits(['update:show'])
const visible = computed({
  get: () => props.show,
  set: (v) => emit('update:show', v)
})
const eventCards = Object.entries(EVENT_SHAPES)
const contentCards = Object.entries(PAPER_KINDS)
</script>

<template>
  <NModal v-model:show="visible" preset="card" class="oc-materials-modal" title="纸面素材" :bordered="false">
    <div class="oc-materials">
      <header class="oc-materials-head">
        <div>
          <div class="oc-materials-eyebrow">MATERIAL LIBRARY</div>
          <p>纸面随形，故事成章。纹理只用于画布与素材预览，不随应用提供原图下载。</p>
        </div>
      </header>

      <h3>事件形状</h3>
      <div class="oc-material-grid shapes">
        <article v-for="[key, item] in eventCards" :key="key" class="oc-material-card">
          <div
            class="oc-material-swatch shape"
            :class="'shape-' + key"
            :style="paperStyle(key)"
            aria-hidden="true"
          >
            <span>{{ item.label }}</span>
          </div>
          <h4>{{ item.label }}</h4>
          <p>{{ item.material }}</p>
        </article>
      </div>

      <h3>内容卡</h3>
      <div class="oc-material-grid">
        <article v-for="[key, item] in contentCards" :key="key" class="oc-material-card">
          <div class="oc-material-swatch" :class="'kind-' + key" :style="{ '--paper-image': `url(${item.image})` }" aria-hidden="true">
            <span>{{ item.label }}</span>
          </div>
          <h4>{{ item.label }}</h4>
          <p>{{ item.material }}</p>
        </article>
      </div>

      <footer class="oc-materials-foot">
        <span>容器与文本框按设计稿保持纯色框 / 透明文字层，不使用纸面纹理。</span>
        <span>纹理来源：设计稿 outline-canvas-preview/assets</span>
      </footer>
    </div>
  </NModal>
</template>
