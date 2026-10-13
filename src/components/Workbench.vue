<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { NButton, NSelect, NDropdown, NModal, useMessage } from 'naive-ui'
import { useWorkStore } from '../stores/work'
import { useUiStore } from '../stores/ui'
import OIcon from './OIcon.vue'
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
import AiAssistantPanel from './ai/AiAssistantPanel.vue'
import DLinkPopover from './DLinkPopover.vue'
import { popOut, isPopped, focusPopped } from '../services/panelwindows'

const work = useWorkStore()
const ui = useUiStore()
const msg = useMessage()

/* ---------- 书签（章节快捷收藏） ---------- */
const bookmarkOptions = computed(() => {
  const list = work.liveBookmarks
  return list.length
    ? list.map((b) => ({ label: b.title || '（空）', key: b.id }))
    : [{ label: '暂无书签（编辑器工具栏或章节右键添加）', key: 'none', disabled: true }]
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

/* ---------- 设置窗口（面板窗口 settings 类型）：外观 / 恍然梦 / 数据 / 关于 ---------- */
function openSettings() {
  if (!window.native?.panelOpen) {
    msg.info('设置窗口仅桌面版可用，网页版暂不支持')
    return
  }
  window.native.panelOpen({ type: 'settings', workId: 'app', entityId: '', title: '设置' })
}

function onKeydown(e) {
  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'f') {
    e.preventDefault()
    ui.searchOpen = true
  }
}

/* ---------- 功能面板拆窗（9.2-W5：面板 = 完整模块界面，预选中当前实体） ---------- */
const splitOptions = computed(() => [
  { label: '⧉ 正文', key: 'chapter', disabled: false },
  { label: '⧉ 大纲', key: 'outline', disabled: false },
  { label: '⧉ 人物', key: 'characters', disabled: false },
  { label: '⧉ 设定', key: 'lore', disabled: false },
  { label: '⧉ 灵感', key: 'snippets', disabled: false },
  { label: '⧉ 恍然梦', key: 'ai', disabled: false }
])
async function onSplit(key) {
  const titles = {
    chapter: () => `${work.work?.title || ''} · 正文`,
    outline: () => `${work.work?.title || ''} · 大纲`,
    characters: () => `${work.work?.title || ''} · 人物`,
    lore: () => `${work.work?.title || ''} · 设定`,
    snippets: () => `${work.work?.title || ''} · 灵感`,
    ai: () => `${work.work?.title || ''} · 恍然梦`
  }
  const entityMap = {
    chapter: () => work.selChapterId,
    outline: () => '',
    characters: () => work.selCharacterId,
    lore: () => '',
    snippets: () => work.selSnippetId,
    ai: () => ''
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
/* 恍然梦已拆出为独立窗口：主窗口停靠列隐藏，避免两处同时展示（锁随面板，关窗自动恢复） */
const aiPopped = computed(() => (work.work ? isPopped(work, 'ai', '') : false))
const curTabLabel = computed(() => tabs.find((t) => t.key === work.tab)?.label || '')
const poppedEntityName = computed(() => {
  if (work.tab === 'characters') return work.activeCharacter?.name || ''
  if (work.tab === 'snippets') return work.activeSnippet?.title || ''
  return ''
})

/* ---------- 侧栏宽度拖拽（180–480，松手后写入 appconfig 记忆） ---------- */
function startSideResize(e) {
  e.preventDefault()
  const startX = e.clientX
  const startW = ui.sideWidth
  document.body.style.userSelect = 'none'
  const move = (ev) => {
    ui.sideWidth = Math.min(480, Math.max(180, startW + ev.clientX - startX))
  }
  const up = () => {
    window.removeEventListener('mousemove', move)
    window.removeEventListener('mouseup', up)
    document.body.style.userSelect = ''
    ui.setPref('sideWidth', ui.sideWidth)
  }
  window.addEventListener('mousemove', move)
  window.addEventListener('mouseup', up)
}
function resetSideWidth() {
  ui.setPref('sideWidth', 252)
}
/* ---------- 恍然梦停靠列宽度拖拽（300–640，appconfig 记忆，双击恢复默认） ---------- */
function startAiResize(e) {
  e.preventDefault()
  const startX = e.clientX
  const startW = ui.aiDrawerWidth
  document.body.style.userSelect = 'none'
  const move = (ev) => {
    ui.aiDrawerWidth = Math.min(640, Math.max(300, startW - (ev.clientX - startX)))
  }
  const up = () => {
    window.removeEventListener('mousemove', move)
    window.removeEventListener('mouseup', up)
    document.body.style.userSelect = ''
    ui.setPref('aiDrawerWidth', ui.aiDrawerWidth)
  }
  window.addEventListener('mousemove', move)
  window.addEventListener('mouseup', up)
}
function resetAiWidth() {
  ui.setPref('aiDrawerWidth', 400)
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div style="display: flex; flex-direction: column; height: 100%">
    <div class="topbar">
      <NButton size="small" quaternary @click="work.closeWork()"><OIcon name="back" :size="14" /> 书架</NButton>
      <span class="brand" style="font-size: 15px">{{ work.work?.title }}</span>
      <span class="save-badge">
        <span class="save-dot" :class="badgeClass"></span>
        {{ badgeText }}
      </span>
      <div style="flex: 1"></div>
      <NButton size="small" @click="ui.searchOpen = true"><OIcon name="search" :size="14" /> 搜索</NButton>
      <NDropdown trigger="click" :options="splitOptions" @select="onSplit">
        <NButton size="small" title="把模块拆出为独立窗口，可边看大纲边写正文"><OIcon name="split" :size="14" /> 拆窗 <OIcon name="caret-down" :size="11" /></NButton>
      </NDropdown>
      <NDropdown trigger="click" :options="bookmarkOptions" @select="onBookmarkSelect">
        <NButton size="small" title="章节书签快捷跳转（编辑器工具栏或章节右键添加）"><OIcon name="bookmark" :size="14" /> 书签 <OIcon name="caret-down" :size="11" /></NButton>
      </NDropdown>
      <NButton size="small" title="设置：外观 / 恍然梦 / 数据 / 关于（独立窗口）" @click="openSettings"><OIcon name="gear" :size="14" /> 设置</NButton>
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
            <div class="rail-label">{{ t.label }}</div>
          </div>
        </div>
        <!-- 恍然梦：独立功能入口，点击开合右侧 AI 界面（不切换中央模块） -->
        <div
          class="rail-item rail-item-ai"
          :class="{ active: ui.aiDrawerOpen }"
          role="button"
          tabindex="0"
          title="恍然梦：AI 写作助手（在右侧弹出，不挤压原界面）"
          @click="ui.aiDrawerOpen = !ui.aiDrawerOpen"
          @keydown.enter="ui.aiDrawerOpen = !ui.aiDrawerOpen"
        >
          <div style="text-align: center">
            <div class="ico">梦</div>
            <div class="rail-label">恍然梦</div>
          </div>
        </div>
      </div>

      <div v-if="!ui.focusMode && !modulePopped" class="side-panel" :style="{ width: ui.sideWidth + 'px' }">
        <ChapterTree v-if="work.tab === 'chapters'" />
        <OutlineSidebar v-else-if="work.tab === 'outline'" />
        <CharacterList v-else-if="work.tab === 'characters'" />
        <MubuTree v-else-if="work.tab === 'lore'" />
        <SnippetList v-else-if="work.tab === 'snippets'" />
      </div>
      <div
        v-if="!ui.focusMode && !modulePopped"
        class="side-resizer"
        title="拖拽调整侧栏宽度（双击恢复默认）"
        @mousedown="startSideResize"
        @dblclick="resetSideWidth"
      ></div>

      <!-- 模块已被拆出为面板窗口：主窗口占位，避免双窗口同写 -->
      <div v-if="modulePopped" class="center-pane paper-texture pop-lock-pane">
        <div class="pop-lock-note">
          <div class="big serif">{{ poppedEntityName ? `${curTabLabel}「${poppedEntityName}」已在独立窗口编辑` : `${curTabLabel}已在独立窗口编辑` }}</div>
          <p>主窗口此条目暂时只读——两侧同时写入会互相覆盖。关闭独立面板（或在面板中切换到其他条目）后此处自动恢复编辑。</p>
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

      <!-- 批注栏收起后的右缘细轨：点击重新展开（仅正文页显示，与批注栏同条件） -->
      <button
        v-if="!ui.focusMode && !modulePopped && work.tab === 'chapters' && !ui.rightPanelOpen"
        class="rp-rail"
        title="展开批注栏"
        @click="ui.setPref('rightPanelOpen', true)"
      >
        <OIcon name="caret-right" :size="12" class="rp-rail-caret" />
        <span class="rp-rail-text">批注栏</span>
      </button>

      <RightPanel v-if="!ui.focusMode && !modulePopped && work.tab === 'chapters' && ui.rightPanelOpen" />

      <!-- 恍然梦停靠列：参与 flex 布局，与原界面并排显示（不遮挡）；左缘可拖宽，拆出独立窗口后此列隐藏 -->
      <div
        v-if="ui.aiDrawerOpen && !ui.focusMode && !aiPopped"
        class="ai-dock-resizer"
        title="拖拽调整恍然梦宽度（双击恢复默认）"
        @mousedown="startAiResize"
        @dblclick="resetAiWidth"
      ></div>
      <aside v-if="ui.aiDrawerOpen && !ui.focusMode && !aiPopped" class="ai-dock" :style="{ width: ui.aiDrawerWidth + 'px' }">
        <div class="ai-drawer-head">
          <span class="ai-drawer-name serif">恍然梦</span>
          <span class="ai-drawer-sub">AI WRITING ASSISTANT</span>
          <div style="flex: 1"></div>
          <NButton size="tiny" quaternary title="拆出为独立窗口（可与其他模块并排对照）" @click="onSplit('ai')"><OIcon name="split" :size="13" /></NButton>
          <NButton size="tiny" quaternary title="收起恍然梦" @click="ui.aiDrawerOpen = false"><OIcon name="close" :size="13" /></NButton>
        </div>
        <div class="ai-drawer-body">
          <AiAssistantPanel />
        </div>
      </aside>
    </div>

    <!-- 双链悬浮预览窗（全局唯一，悬停双链标签 / 纯文本令牌时展示目标内容） -->
    <DLinkPopover />
  </div>
</template>

<style scoped>
/* 恍然梦停靠列：正常参与 wb-body 的 flex 布局，与原界面并排（同 VS Code 副侧栏）；
   左缘拖拽手柄调宽（300–640，appconfig 记忆），拆出独立窗口后此列隐藏 */
.ai-dock {
  flex: none;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: var(--bg, var(--bg-panel));
  border-left: 1px solid var(--border-strong, var(--border));
  box-shadow: -8px 0 22px rgba(20, 16, 8, 0.06);
}
.ai-dock-resizer {
  flex: none;
  width: 5px;
  margin-left: -5px;
  cursor: col-resize;
  z-index: 5;
}
.ai-dock-resizer:hover {
  background: color-mix(in srgb, var(--accent) 35%, transparent);
}
.ai-drawer-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 9px 12px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-panel);
  flex: none;
}
.ai-drawer-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--ikb);
}
.ai-drawer-sub {
  font-family: var(--g-disp, serif);
  font-size: 8px;
  letter-spacing: 0.24em;
  color: var(--text-dim);
  text-transform: uppercase;
  font-weight: 600;
}
.ai-drawer-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 8px 10px;
}
/* 左栏恍然梦入口：与模块项同形，图标用品牌色弱区分 */
.rail-item-ai .ico {
  color: var(--accent);
}

/* 批注栏收起后的右缘细轨：竖排文字，悬停亮起，点击重新展开 */
.rp-rail {
  flex: none;
  align-self: stretch;
  width: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 7px;
  padding: 12px 0 10px;
  border: none;
  border-left: 1px solid var(--border);
  background: var(--bg-panel);
  color: var(--text-dim);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.rp-rail:hover {
  background: color-mix(in srgb, var(--accent, #8c6f4e) 10%, var(--bg-panel));
  color: var(--text);
}
.rp-rail-caret {
  transform: rotate(180deg);
}
.rp-rail-text {
  writing-mode: vertical-lr;
  font-size: 11px;
  letter-spacing: 4px;
  user-select: none;
}
</style>
