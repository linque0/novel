<script setup>
import { computed, ref } from 'vue'
import { NButton, NInput } from 'naive-ui'
import { useWorkStore } from '../stores/work'

const work = useWorkStore()
const quick = ref('')
const list = computed(() => work.liveSnippets)

function addQuick() {
  const v = quick.value.trim()
  if (!v) return
  work.addSnippet(v)
  quick.value = ''
}
const fmt = (t) => {
  const d = new Date(t)
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
</script>

<template>
  <div style="display: flex; flex-direction: column; height: 100%">
    <div class="side-head" style="flex-direction: column; align-items: stretch">
      <NInput
        v-model:value="quick"
        type="textarea"
        size="small"
        :rows="2"
        placeholder="随手记一条灵感…（Ctrl+Enter 添加）"
        @keydown="(e) => e.ctrlKey && e.key === 'Enter' && addQuick()"
      />
      <div style="display: flex; gap: 6px; margin-top: 6px; align-items: center">
        <NButton size="tiny" type="primary" @click="addQuick">＋记录</NButton>
        <span style="font-size: 12px; color: var(--text-dim)">{{ list.length }} 条</span>
      </div>
    </div>
    <div class="side-list">
      <div
        v-for="s in list"
        :key="s.id"
        class="side-item"
        :class="{ active: work.selSnippetId === s.id }"
        role="button"
        tabindex="0"
        @click="work.selSnippetId = s.id"
        @keydown.enter="work.selSnippetId = s.id"
      >
        <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap">{{ (s.content || '（空白）').slice(0, 24) }}</span>
        <span class="dim">{{ fmt(s.createdAt) }}</span>
      </div>
      <p v-if="!list.length" style="font-size: 12px; color: var(--text-dim); padding: 10px">灵感库为空。想到什么记什么，之后可一键转为章节或设定。</p>
    </div>
  </div>
</template>
