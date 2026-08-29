<script setup>
import { computed } from 'vue'
import { useWorkStore } from '../stores/work'

const work = useWorkStore()

const current = computed(() => {
  if (!work.work || !work.selOutlineId) return null
  const o = work.ensureOutline(work.selOutlineId)
  let label = '总纲'
  let hint = '整本书的核心脉络、主线冲突与结局构想'
  if (o.level === 'volume') {
    label = '卷纲 · ' + (work.volumes.find((v) => v.id === o.refId)?.title || '')
    hint = '这一卷的起承转合、主要事件与收尾'
  } else if (o.level === 'chapter') {
    label = '章纲 · ' + (work.chapters.find((c) => c.id === o.refId)?.title || '')
    hint = '本章要点：出场人物、关键情节、伏笔与钩子'
  }
  return { o, label, hint }
})

function onInput(e) {
  if (current.value) work.updateOutline(current.value.o.id, e.target.value)
}
</script>

<template>
  <div v-if="current" style="flex: 1; display: flex; flex-direction: column; padding: 22px 34px; min-height: 0; overflow: auto">
    <h2 class="serif" style="margin: 0 0 4px">{{ current.label }}</h2>
    <p style="margin: 0 0 12px; font-size: 12px; color: var(--text-dim)">{{ current.hint }}（自动保存）</p>
    <textarea
      class="rp-textarea"
      style="flex: 1; min-height: 380px; font-size: 15px; line-height: 2"
      :value="current.o.content"
      @input="onInput"
    ></textarea>
  </div>
  <div v-else class="empty-shelf" style="padding-top: 140px">
    <div class="big">谋定而后动</div>
    <p>从左侧选择「总纲 / 卷纲 / 章纲」开始规划故事。</p>
  </div>
</template>
