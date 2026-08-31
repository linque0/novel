<script setup>
import { computed, ref } from 'vue'
import { NButton, NInput, NPopconfirm, useMessage } from 'naive-ui'
import { useWorkStore } from '../stores/work'
import { useUiStore } from '../stores/ui'
import DLinkTextMenu from './DLinkTextMenu.vue'

const work = useWorkStore()
const ui = useUiStore()
const msg = useMessage()
const s = computed(() => work.activeSnippet)
const dlMenu = ref(null)

/* 灵感内容右键快捷栏：剪切/复制/粘贴 + 添加双链 */
function onCtx(e) {
  if (!s.value) return
  const sn = s.value
  dlMenu.value?.open(e, { get: () => sn.content || '', set: (v) => work.updateSnippet(sn.id, { content: v }) })
}

function toChapter() {
  if (!s.value) return
  const lines = (s.value.content || '').split('\n').filter((x) => x.trim())
  const title = (lines[0] || '灵感章节').slice(0, 30)
  work.addChapter(null, title).then((ch) => {
    work.setChapterContent(ch.id, s.value.content || '')
    msg.success('已转为新章节')
  })
}
function toLore() {
  if (!s.value) return
  // 设定库已幕布化（v0.3.0）：旧 lore 表为死表，改写幕布节点——首行作标题、余行作子节点内容
  const lines = (s.value.content || '').split('\n').filter((x) => x.trim())
  const node = work.mubuAdd(null, null, (lines[0] || '新设定').slice(0, 30))
  const body = lines.slice(1).join('\n').trim()
  if (body) work.mubuAdd(node.id, null, body)
  work.tab = 'lore'
  ui.loreFocusId = node.id
  msg.success('已转为设定节点')
}
</script>

<template>
  <div v-if="s" style="flex: 1; display: flex; flex-direction: column; padding: 22px 34px; min-height: 0">
    <div style="display: flex; gap: 8px; margin-bottom: 12px; align-items: center">
      <span style="font-size: 12px; color: var(--text-dim)">灵感记录 · 自动保存</span>
      <div style="flex: 1"></div>
      <NButton size="small" @click="toChapter">转为章节</NButton>
      <NButton size="small" @click="toLore">转为设定</NButton>
      <NPopconfirm @positive-click="work.deleteSnippet(s.id)">
        <template #trigger>
          <NButton size="small" quaternary type="error">删除</NButton>
        </template>
        删除后可在回收站恢复
      </NPopconfirm>
    </div>
    <NInput
      :value="s.content"
      type="textarea"
      style="flex: 1"
      :autosize="{ minRows: 18, maxRows: 40 }"
      placeholder="记录灵感、桥段、对话片段……"
      data-dl-token
      @update:value="(v) => work.updateSnippet(s.id, { content: v })"
      @contextmenu="onCtx"
    />
  </div>
  <div v-else class="empty-shelf" style="padding-top: 140px">
    <div class="big">灵光一现</div>
    <p>从左侧选择一条灵感，或直接在左侧输入框随手记。</p>
  </div>
  <DLinkTextMenu ref="dlMenu" />
</template>
