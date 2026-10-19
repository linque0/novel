<script setup>
import { computed, ref, nextTick } from 'vue'
import { NButton, NInput, NPopover } from 'naive-ui'
import { useWorkStore } from '../stores/work'
import { useUiStore } from '../stores/ui'
import OIcon from './OIcon.vue'

const props = defineProps({ bare: { type: Boolean, default: false } })
const work = useWorkStore()
const ui = useUiStore()
const quick = ref('')
const quickOpen = ref(false)
const quickInput = ref(null)
const quickTrigger = ref(null)
function showQuick(show) {
  quickOpen.value = show
  if (show) nextTick(() => quickInput.value?.focus())
}
function closeQuick() {
  quickOpen.value = false
  nextTick(() => quickTrigger.value?.$el?.focus())
}
function onQuickKey(e) {
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeQuick() }
  else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); addQuick() }
}
const list = computed(() => {
  const q = String(ui.snippetQuery || '').trim().toLowerCase()
  return work.liveSnippets.filter((s) => !q || String(s.content || '').toLowerCase().includes(q))
})

function addQuick() {
  const v = quick.value.trim()
  if (!v) return
  work.addSnippet(v)
  quick.value = ''
  closeQuick()
}
const fmt = (t) => {
  const d = new Date(t)
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
</script>

<template>
  <div class="snippet-catalog" style="display: flex; flex-direction: column; height: 100%">
    <header v-if="ui.isStudioSkin && !bare" class="gravity-inspiration-heading"><h1>灵感画布</h1><p>{{ list.length }} 条灵感</p></header>
    <div v-if="!bare" class="side-head" style="flex-direction: column; align-items: stretch">
      <NPopover v-if="ui.skin === 'gravity'" :show="quickOpen" trigger="click" placement="bottom-start" :show-arrow="false" class="gravity-quick-popover" style="width:350px;max-width:calc(100vw - 64px)" @update:show="showQuick">
        <template #trigger><NButton ref="quickTrigger" class="gravity-quick-trigger" type="primary"><OIcon name="plus" :size="14" /> 记录灵感</NButton></template>
        <NInput ref="quickInput" v-model:value="quick" type="textarea" :rows="4" placeholder="随手记一条灵感…（Ctrl+Enter 添加）" @keydown="onQuickKey" />
        <div style="display:flex;justify-content:flex-end;margin-top:12px;gap:8px"><NButton @click="closeQuick">收起</NButton><NButton type="primary" :disabled="!quick.trim()" @click="addQuick">记录</NButton></div>
      </NPopover>
      <template v-else>
      <NInput
        v-model:value="quick"
        type="textarea"
        size="small"
        :rows="2"
        placeholder="随手记一条灵感…（Ctrl+Enter 添加）"
        @keydown="(e) => e.ctrlKey && e.key === 'Enter' && addQuick()"
      />
      <div style="display: flex; gap: 6px; margin-top: 6px; align-items: center">
        <NButton size="tiny" type="primary" @click="addQuick"><OIcon name="plus" :size="11" /> 记录</NButton>
        <span style="font-size: 12px; color: var(--text-dim)">{{ list.length }} 条</span>
      </div>
      </template>
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
        <template v-if="ui.isStudioSkin"><span class="gravity-snippet-date">{{ fmt(s.createdAt) }}</span><h3>{{ (s.content || '（空白）').split('\n')[0] }}</h3><p>{{ (s.content || '').split('\n').slice(1).join('\n') }}</p><span class="gravity-snippet-open">打开记录 ↗</span></template>
        <template v-else><span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap">{{ (s.content || '（空白）').slice(0, 24) }}</span><span class="dim">{{ fmt(s.createdAt) }}</span></template>
      </div>
      <p v-if="!list.length" style="font-size: 12px; color: var(--text-dim); padding: 10px">灵感库为空。想到什么记什么，之后可一键转为章节或设定。</p>
    </div>
  </div>
</template>
