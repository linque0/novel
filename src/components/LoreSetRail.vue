<!-- 设定集目录（赤月戏列表页 / 详情页共用）：每个顶层 mubu 节点 = 一个设定集。
     点击切换当前设定集；新建后自动切换并定位到纸面首行。 -->
<script setup>
import { computed } from 'vue'
import { useWorkStore } from '../stores/work'
import { useUiStore } from '../stores/ui'
import artWorld from '../assets/skins/crimson/world.webp'

const work = useWorkStore()
const ui = useUiStore()

const roots = computed(() => work.mubuRoots())
const countOf = (id) => work.mubuDescendants(id).length

function pick(id) {
  if (!id || id === work.mubuSetId) {
    ui.loreDetailId = null
    return
  }
  work.setMubuSet(id)
  ui.loreDetailId = null
  ui.loreFocusId = id
}

function createSet() {
  const row = work.createMubuSet()
  ui.loreDetailId = null
  ui.loreFocusId = row.id
}
</script>

<template>
  <aside class="lore-set-rail" aria-label="我的设定集">
    <img class="lore-set-bg" :src="artWorld" alt="" aria-hidden="true" />
    <div class="lore-set-shade" aria-hidden="true"></div>
    <div class="lore-set-head">
      <h2>我的设定集</h2>
      <span>{{ roots.length }}</span>
    </div>
    <div class="lore-set-list">
      <button
        v-for="r in roots"
        :key="r.id"
        type="button"
        class="lore-set-item"
        :class="{ active: r.id === work.mubuSetId }"
        :title="r.text || '未命名设定集'"
        @click="pick(r.id)"
      >
        <i class="lore-set-icon" aria-hidden="true">▤</i>
        <span class="lore-set-name">{{ r.text || '未命名设定集' }}</span>
        <b>{{ countOf(r.id) }}</b>
      </button>
      <p v-if="!roots.length" class="lore-set-empty">还没有设定集</p>
    </div>
    <button type="button" class="lore-set-add" @click="createSet">＋ 新建设定集</button>
  </aside>
</template>
