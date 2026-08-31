<script setup>
import { computed } from 'vue'
import { useWorkStore } from '../stores/work'
import { beatProgress } from '../services/outlineBeats'

const work = useWorkStore()

const STATUS_ORDER = ['plan', 'writing', 'done']
const STATUS_LABEL = { plan: '计划', writing: '写作中', done: '已完成' }

const items = computed(() => {
  const list = [{ label: '📘 总纲', refId: work.work?.id, kind: 'master' }]
  for (const v of work.liveVolumes) list.push({ label: '📖 ' + v.title, refId: v.id, kind: 'volume' })
  for (const c of work.liveChapters) {
    const o = work.outlines.find((x) => x.refId === c.id && x.level === 'chapter' && !x.deletedAt)
    const beats = o ? beatProgress(o.content) : { done: 0, total: 0 }
    list.push({
      label: '📄 ' + c.title,
      refId: c.id,
      kind: 'chapter',
      dim: c.wordCount + '字',
      oid: o?.id || null,
      status: o?.status || 'plan',
      beats: beats.total > 0 ? beats : null
    })
  }
  return list
})

function select(it) {
  work.selOutlineId = it.refId
}
const isActive = (it) => work.selOutlineId === it.refId

/** 状态循环切换：计划 → 写作中 → 已完成 */
function cycleStatus(it) {
  if (!it.oid) return
  const next = STATUS_ORDER[(STATUS_ORDER.indexOf(it.status || 'plan') + 1) % STATUS_ORDER.length]
  work.setOutlineStatus(it.oid, next)
}
</script>

<template>
  <div style="display: flex; flex-direction: column; height: 100%">
    <div class="side-head">
      <span style="font-size: 12px; color: var(--text-dim)">总纲 → 卷纲 → 章纲，点击编辑</span>
    </div>
    <div class="side-list">
      <div
        v-for="it in items"
        :key="it.kind + ':' + it.refId"
        class="side-item"
        :class="{ active: isActive(it) }"
        role="button"
        tabindex="0"
        @click="select(it)"
        @keydown.enter="select(it)"
        @contextmenu.prevent="it.kind === 'chapter' && cycleStatus(it)"
      >
        <template v-if="it.kind === 'chapter'">
          <button class="ol-dot" :data-s="it.status" :title="STATUS_LABEL[it.status] + ' · 点击切换状态'" @click.stop="cycleStatus(it)" />
          <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1">{{ it.label }}</span>
          <span v-if="it.beats" class="dim" title="节拍完成数">✓{{ it.beats.done }}/{{ it.beats.total }}</span>
          <span v-else class="dim">{{ it.dim }}</span>
          <button class="ol-jump" title="跳转到本章正文" @click.stop="work.navTo('chapters', it.refId)">→</button>
        </template>
        <template v-else>
          <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap">{{ it.label }}</span>
        </template>
      </div>
    </div>
  </div>
</template>
