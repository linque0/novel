<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { NButton, NSelect, NDropdown, NModal, useMessage } from 'naive-ui'
import { useWorkStore } from '../stores/work'
import { useUiStore } from '../stores/ui'
import { useShelfStore } from '../stores/shelf'
import { exportBook, backupAll, restoreBackup } from '../services/exporter'
import { pickFiles } from '../services/fileio'
import ChapterTree from './ChapterTree.vue'
import OutlineSidebar from './OutlineSidebar.vue'
import CharacterList from './CharacterList.vue'
import SnippetList from './SnippetList.vue'
import EditorPane from './EditorPane.vue'
import OutlineCenter from './OutlineCenter.vue'
import CharacterCenter from './CharacterCenter.vue'
import MubuView from './MubuView.vue'
import MubuTree from './MubuTree.vue'
import SnippetCenter from './SnippetCenter.vue'
import RightPanel from './RightPanel.vue'
import DLinkPopover from './DLinkPopover.vue'
import { popOut, isPopped, focusPopped } from '../services/panelwindows'

const work = useWorkStore()
const ui = useUiStore()
const shelf = useShelfStore()
const msg = useMessage()

/* ---------- 书签（章节快捷收藏） ---------- */
const bookmarkOptions = computed(() => {
  const list = work.liveBookmarks
  return list.length
    ? list.map((b) => ({ label: '📄 ' + (b.title || '（空）'), key: b.id }))
    : [{ label: '暂无书签（章节右键或工具栏 ☆ 添加）', key: 'none', disabled: true }]
})
function onBookmarkSelect(key) {
  const b = work.bookmarks.find((x) => x.id === key)
  if (!b) return
  work.tab = 'chapters'
  work.selChapterId = b.targetId
  const c = work.chapters.find((x) => x.id === b.targetId)
  if (c) work.selVolumeId = c.volumeId
}

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

/* ---------- 功能面板拆窗（9.2-W5） ---------- */
const splitOptions = computed(() => [
  { label: '⧉ 正文（当前章节）', key: 'chapter', disabled: !work.activeChapter },
  { label: '⧉ 大纲（画布）', key: 'outline', disabled: false },
  { label: '⧉ 人物', key: 'characters', disabled: !work.activeCharacter },
  { label: '⧉ 设定（幕布）', key: 'lore', disabled: false },
  { label: '⧉ 灵感', key: 'snippets', disabled: !work.activeSnippet }
])
async function onSplit(key) {
  const titles = {
    chapter: () => work.activeChapter?.title || '正文',
    outline: () => '大纲画布',
    characters: () => work.activeCharacter?.name || '人物',
    lore: () => '设定幕布',
    snippets: () => work.activeSnippet?.title || '灵感'
  }
  const entityMap = {
    chapter: () => work.selChapterId,
    outline: () => '',
    characters: () => work.selCharacterId,
    lore: () => '',
    snippets: () => work.selSnippetId
  }
  const ok = await popOut(work, key, entityMap[key]?.() || '', titles[key]?.())
  if (ok) msg.success('已在独立窗口打开')
}

/* 模块级锁：大纲/设定拆出为整模块锁；人物/灵感按选中实体锁（9.2-W5） */
function curEntityForTab(tab) {
  if (tab === 'characters') return work.selCharacterId || ''
  if (tab === 'snippets') return work.selSnippetId || ''
  return ''
}
const modulePopped = computed(() => {
  if (!work.work || work.tab === 'chapters') return false
  return isPopped(work, work.tab, curEntityForTab(work.tab))
})
const curTabLabel = computed(() => tabs.find((t) => t.key === work.tab)?.label || '')
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
      <NDropdown trigger="click" :options="splitOptions" @select="onSplit">
        <NButton size="small" title="把模块拆出为独立窗口，可边看大纲边写正文">⧉ 拆窗 ▾</NButton>
      </NDropdown>
      <NButton size="small" @click="ui.importOpen = true">⬇ 导入</NButton>
      <NDropdown :options="exportOptions" trigger="click" @select="onExport">
        <NButton size="small">导出 ▾</NButton>
      </NDropdown>
      <NButton size="small" @click="ui.statsOpen = true">统计</NButton>
      <NButton size="small" @click="ui.trashOpen = true">回收站</NButton>
      <NDropdown trigger="click" :options="bookmarkOptions" @select="onBookmarkSelect">
        <NButton size="small">🔖 书签</NButton>
      </NDropdown>
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

      <div v-if="!ui.focusMode && !modulePopped" class="side-panel">
        <ChapterTree v-if="work.tab === 'chapters'" />
        <OutlineSidebar v-else-if="work.tab === 'outline'" />
        <CharacterList v-else-if="work.tab === 'characters'" />
        <MubuTree v-else-if="work.tab === 'lore'" />
        <SnippetList v-else-if="work.tab === 'snippets'" />
      </div>

      <!-- 模块已被拆出为面板窗口：主窗口占位，避免双窗口同写 -->
      <div v-if="modulePopped" class="center-pane paper-texture pop-lock-pane">
        <div class="pop-lock-note">
          <div class="big serif">{{ curTabLabel }}已在独立窗口编辑</div>
          <p>主窗口此模块暂时只读——两侧同时写入会互相覆盖。关闭独立面板后此处自动恢复编辑。</p>
          <NButton type="primary" @click="focusPopped(work, work.tab, curEntityForTab(work.tab))">前往窗口</NButton>
        </div>
      </div>
      <div v-else class="center-pane paper-texture">
        <EditorPane v-if="work.tab === 'chapters'" />
        <OutlineCenter v-else-if="work.tab === 'outline'" />
        <CharacterCenter v-else-if="work.tab === 'characters'" />
        <template v-else-if="work.tab === 'lore'">
          <MubuView />
        </template>
        <SnippetCenter v-else-if="work.tab === 'snippets'" />
      </div>

      <RightPanel v-if="!ui.focusMode && !modulePopped && work.tab === 'chapters'" />
    </div>

    <!-- 双链悬浮预览窗（全局唯一，悬停双链标签 / 纯文本令牌时展示目标内容） -->
    <DLinkPopover />
  </div>
</template>
