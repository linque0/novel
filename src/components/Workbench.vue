<script setup>
import { computed, onMounted, onBeforeUnmount } from 'vue'
import { NButton, NSelect, NDropdown, useMessage } from 'naive-ui'
import { useWorkStore } from '../stores/work'
import { useUiStore } from '../stores/ui'
import { useShelfStore } from '../stores/shelf'
import { exportBook, backupAll, restoreBackup } from '../services/exporter'
import { pickFiles } from '../services/fileio'
import ChapterTree from './ChapterTree.vue'
import OutlineList from './OutlineList.vue'
import CharacterList from './CharacterList.vue'
import SnippetList from './SnippetList.vue'
import EditorPane from './EditorPane.vue'
import OutlineCenter from './OutlineCenter.vue'
import CharacterCenter from './CharacterCenter.vue'
import MubuView from './MubuView.vue'
import SnippetCenter from './SnippetCenter.vue'
import RightPanel from './RightPanel.vue'

const work = useWorkStore()
const ui = useUiStore()
const shelf = useShelfStore()
const msg = useMessage()

const tabs = [
  { key: 'chapters', icon: '文', label: '正文' },
  { key: 'outline', icon: '纲', label: '大纲' },
  { key: 'characters', icon: '人', label: '人物' },
  { key: 'lore', icon: '设', label: '设定' },
  { key: 'snippets', icon: '灵', label: '灵感' }
]

const fmtTime = (t) => {
  const d = new Date(t)
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}
const badgeClass = computed(() => (ui.autosave.saving ? 'saving' : ui.autosave.pending ? 'dirty' : ''))
const badgeText = computed(() => {
  if (ui.autosave.saving) return '保存中…'
  if (ui.autosave.pending) return `${ui.autosave.pending} 处待保存`
  return ui.autosave.lastSavedAt ? `已保存 ${fmtTime(ui.autosave.lastSavedAt)}` : '自动保存就绪'
})

const THEME_OPTS = [
  { label: '宣纸', value: 'xuan' },
  { label: '羊皮纸', value: 'parchment' },
  { label: '暗夜书房', value: 'night' }
]

const exportOptions = [
  { label: '导出本书 TXT', key: 'txt' },
  { label: '导出本书 Markdown', key: 'md' },
  { type: 'divider', key: 'd1' },
  { label: '备份全部数据 (JSON)', key: 'backup' },
  { label: '恢复备份 (JSON)', key: 'restore' }
]
async function onExport(key) {
  if (key === 'txt' || key === 'md') {
    await exportBook(work.work, work.volumes, work.chapters, key === 'md')
    msg.success('已导出')
  } else if (key === 'backup') {
    const r = await backupAll()
    if (!r?.canceled) msg.success('备份已保存')
  } else if (key === 'restore') {
    const files = await pickFiles(['json'])
    if (!files.length) return
    try {
      await restoreBackup(files[0].data)
      msg.success('备份已恢复，即将重新载入')
      const id = work.work?.id
      await work.closeWork()
      await shelf.refresh()
      if (id) await work.open(id)
    } catch (e) {
      msg.error('恢复失败：' + e.message)
    }
  }
}

function onKeydown(e) {
  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'f') {
    e.preventDefault()
    ui.searchOpen = true
  }
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div style="display: flex; flex-direction: column; height: 100%">
    <div class="topbar">
      <NButton size="small" quaternary @click="work.closeWork()">← 书架</NButton>
      <span class="brand" style="font-size: 15px">{{ work.work?.title }}</span>
      <span class="save-badge">
        <span class="save-dot" :class="badgeClass"></span>
        {{ badgeText }}
      </span>
      <div style="flex: 1"></div>
      <NButton size="small" @click="ui.searchOpen = true">🔍 搜索</NButton>
      <NButton size="small" @click="ui.importOpen = true">⬇ 导入</NButton>
      <NDropdown :options="exportOptions" trigger="click" @select="onExport">
        <NButton size="small">导出 ▾</NButton>
      </NDropdown>
      <NButton size="small" @click="ui.statsOpen = true">统计</NButton>
      <NButton size="small" @click="ui.trashOpen = true">回收站</NButton>
      <NSelect
        size="small"
        :value="ui.theme"
        :options="THEME_OPTS"
        style="width: 110px"
        @update:value="(v) => ui.setPref('theme', v)"
      />
      <NButton size="small" :type="ui.focusMode ? 'primary' : 'default'" @click="ui.focusMode = !ui.focusMode">沉浸</NButton>
    </div>

    <div class="wb-body">
      <div v-if="!ui.focusMode" class="nav-rail">
        <div
          v-for="t in tabs"
          :key="t.key"
          class="rail-item"
          :class="{ active: work.tab === t.key }"
          role="button"
          tabindex="0"
          @click="work.tab = t.key"
          @keydown.enter="work.tab = t.key"
        >
          <div style="text-align: center">
            <div class="ico">{{ t.icon }}</div>
            <div style="font-size: 10px; margin-top: 1px">{{ t.label }}</div>
          </div>
        </div>
      </div>

      <div v-if="!ui.focusMode && work.tab !== 'lore'" class="side-panel">
        <ChapterTree v-if="work.tab === 'chapters'" />
        <OutlineList v-else-if="work.tab === 'outline'" />
        <CharacterList v-else-if="work.tab === 'characters'" />
        <SnippetList v-else-if="work.tab === 'snippets'" />
      </div>

      <div class="center-pane paper-texture">
        <EditorPane v-if="work.tab === 'chapters'" />
        <OutlineCenter v-else-if="work.tab === 'outline'" />
        <CharacterCenter v-else-if="work.tab === 'characters'" />
        <template v-else-if="work.tab === 'lore'">
          <MubuView />
        </template>
        <SnippetCenter v-else-if="work.tab === 'snippets'" />
      </div>

      <RightPanel v-if="!ui.focusMode && work.tab === 'chapters'" />
    </div>
  </div>
</template>
