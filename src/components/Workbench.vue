<script setup>
import { computed, ref, provide, onMounted, onBeforeUnmount, watch } from 'vue'
import { NButton, NDropdown, useMessage } from 'naive-ui'
import { useWorkStore } from '../stores/work'
import { useUiStore } from '../stores/ui'
import { useAiStore } from '../stores/ai'
import OIcon from './OIcon.vue'
import AppTopbar from './AppTopbar.vue'
import { WORK_NAVIGATION } from './app-navigation'
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
import InspirationPrompt from './InspirationPrompt.vue'
import TaskLauncher from './ai/TaskLauncher.vue'
import { popOut, isPopped, focusPopped } from '../services/panelwindows'
import { playStage } from '../services/stage-play'
import artEditor from '../assets/skins/crimson/editor.webp'
import artOutline from '../assets/skins/crimson/outline.webp'
import artCharacters from '../assets/skins/crimson/characters.webp'
import artInspiration from '../assets/skins/crimson/inspiration.webp'

const work = useWorkStore()
const ui = useUiStore()
const ai = useAiStore()
const inspirationPrompt = ref('把这条灵感扩展成一个场景，保留悬念。')
provide('inspirationPrompt', inspirationPrompt)
const msg = useMessage()
const studio = computed(() => ui.isStudioSkin)
const taskLauncher = ref(null)

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
  selectTab('chapters')
  work.selChapterId = b.targetId
  const c = work.chapters.find((x) => x.id === b.targetId)
  if (c) work.selVolumeId = c.volumeId
}

const tabs = WORK_NAVIGATION
function selectTab(key) {
  ui.loreDetailId = null
  work.tab = key
}

/* ── 赤月戏：顶部横向导航 + 86px 模块条 + 40px 底栏 + 按模块切换的布景（排布照设计稿） ── */
const crimson = computed(() => ui.skin === 'crimson')
const CRIMSON_ART = { chapters: artEditor, outline: artOutline, characters: artCharacters, snippets: artInspiration }
const crimsonArt = computed(() => CRIMSON_ART[work.tab] || null)
const CRIMSON_TITLE = { chapters: '写作', outline: '故事大纲', lore: '世界设定', characters: '人物档案', snippets: '灵感采集' }
const crimsonTitle = computed(() => CRIMSON_TITLE[work.tab] || curTabLabel.value)
const crimsonSubtitle = computed(() => {
  if (work.tab === 'chapters') return work.activeChapter?.title || '从左侧选一章开始'
  if (work.tab === 'outline') return work.liveVolumes.find(v => v.id === work.selVolumeId)?.title || work.liveVolumes[0]?.title || '世界与线索'
  if (work.tab === 'lore') {
    const sets = work.mubuRoots()
    return (sets.find((n) => n.id === work.mubuSetId) || sets[0])?.text || `${work.mubu.length} 个条目`
  }
  if (work.tab === 'characters') return work.activeCharacter?.name || `${work.liveCharacters.length} 位人物`
  if (work.tab === 'snippets') return `${work.liveSnippets.length} 条灵感`
  return ''
})
/* 进入作品 / 切模块 / 切到赤月戏，都放一次入场（CSS 动画，标记由 stage-play 清理） */
watch(() => work.work?.id, (id) => { if (id && crimson.value) playStage() })
watch(() => work.tab, () => { if (crimson.value) playStage() })
watch(() => ui.skin, (skin) => { if (skin === 'crimson') playStage() })
const moreOptions = computed(() => [
  ...(studio.value ? [{ label: '本模块恍然梦助手', key: 'assistant' }] : []),
  { label: '拆出独立窗口', key: 'split', children: splitOptions.value.map(o => ({ ...o, key: 'split:' + o.key })) },
  { label: '章节书签', key: 'bookmarks', children: bookmarkOptions.value.map(o => ({ ...o, key: 'bookmark:' + o.key })) },
  { label: ui.focusMode ? '退出沉浸' : '沉浸写作', key: 'focus' },
  ...(ui.skin === 'crimson' ? [{ label: '重播开场', key: 'replay' }] : []),
  ...(work.tab === 'chapters' ? [{ label: ui.readMode ? '退出阅读' : '阅读模式', key: 'read' }] : []),
  ...(ui.skin !== 'original' ? [{ label: '切回原版皮肤', key: 'original' }] : [])
])
function onMore(key) {
  if (key === 'assistant') return taskLauncher.value?.open()
  if (key.startsWith('split:')) return onSplit(key.slice(6))
  if (key.startsWith('bookmark:')) return onBookmarkSelect(key.slice(9))
  if (key === 'focus') ui.focusMode = !ui.focusMode
  if (key === 'replay') return playStage()
  if (key === 'read') ui.readMode = !ui.readMode
  if (key === 'original') ui.setSkin('original')
  if (key === 'settings') openSettings()
}

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
const aiMounted = ref(ui.aiDrawerOpen)
watch(() => ui.aiDrawerOpen, open => { if (open) aiMounted.value = true })
const aiVisible = computed(() => ui.aiDrawerOpen && !ui.focusMode && !ui.readMode && !aiPopped.value)
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
  <div class="workbench-shell" :class="{ 'is-focus': ui.focusMode, 'is-reading': ui.readMode, 'is-crimson': crimson }" :data-module="work.tab" style="display: flex; flex-direction: column; height: 100%">
    <!-- 赤月戏：布景层（按模块换图）+ 顶部压暗渐变，内容始终在布景之上 -->
    <template v-if="crimson">
      <img v-if="crimsonArt" class="crimson-backdrop" :src="crimsonArt" alt="" aria-hidden="true" />
      <div class="crimson-shade" aria-hidden="true"></div>
    </template>

    <!-- 编辑皮肤：任务入口只挂一次，经 Teleport 进页头。原先每个模块各挂一份，
         切模块时组件与 Teleport 同时移动会触发 Vue 的 patch/unmount 异常。 -->
    <TaskLauncher v-if="studio" ref="taskLauncher" :module="work.tab" />

    <AppTopbar :active="work.tab" :has-work="!!work.work" :target-title="work.work?.title" @navigate="key => key === 'shelf' ? work.closeWork() : key === 'settings' ? openSettings() : selectTab(key)">
      <template #actions>
        <span class="save-badge"><span class="save-dot" :class="badgeClass"></span>{{ badgeText }}</span>
        <NButton size="small" quaternary aria-label="搜索" @click="ui.searchOpen = true"><OIcon name="search" :size="16" /> 搜索</NButton>
        <div id="studio-task-actions"></div>
        <NButton size="small" :type="ui.aiDrawerOpen ? 'primary' : 'default'" :aria-pressed="ui.aiDrawerOpen" title="展开或收起恍然梦对话" @click="ui.aiDrawerOpen = !ui.aiDrawerOpen"><OIcon name="star" :size="14" /> 恍然梦</NButton>
        <NDropdown trigger="click" :options="moreOptions" @select="onMore"><NButton size="small" quaternary title="拆窗、书签、沉浸、阅读与皮肤">更多 <OIcon name="caret-down" :size="11" /></NButton></NDropdown>
      </template>
    </AppTopbar>

    <!-- 赤月戏：86px 模块工具条（标题 + 真实上下文；动作由各模块 Teleport 进来）。
         它不属于“顶栏”自动隐藏范围：收起顶栏时只隐藏应用级导航，模块工具条保持可见。
         正文页只隐藏、不卸载：Teleport 目标必须始终存在，否则切页时目标与内容同时消失会触发 Vue patch 异常。 -->
    <div v-show="crimson && work.tab !== 'chapters'" class="crimson-modulebar">
      <div class="crimson-module-title">
        <h1>{{ crimsonTitle }}</h1>
        <span v-if="crimsonSubtitle">{{ crimsonSubtitle }}</span>
      </div>
      <div id="crimson-bar-tools" class="crimson-bar-tools"></div>
    </div>

    <div class="wb-body">
      <div v-if="!ui.focusMode && !ui.readMode && !modulePopped && !(crimson && ['chapters', 'outline', 'lore', 'characters', 'snippets'].includes(work.tab))" v-show="work.tab !== 'outline' || ui.outlineSideOpen" class="side-panel" :style="{ width: ui.sideWidth + 'px' }">
        <ChapterTree v-if="work.tab === 'chapters'" @read="onMore('read')" @window="onSplit('chapter')" />
        <OutlineSidebar v-else-if="work.tab === 'outline'" />
        <CharacterList v-else-if="work.tab === 'characters'" />
        <MubuTree v-else-if="work.tab === 'lore'" />
        <SnippetList v-else-if="work.tab === 'snippets'" />
      </div>
      <div
        v-if="!ui.focusMode && !ui.readMode && !modulePopped && !(crimson && ['chapters', 'outline', 'lore', 'characters', 'snippets'].includes(work.tab))"
        v-show="work.tab !== 'outline' || ui.outlineSideOpen"
        class="side-resizer"
        title="拖拽调整侧栏宽度（双击恢复默认）"
        @mousedown="startSideResize"
        @dblclick="resetSideWidth"
      ></div>

      <button
        v-if="!crimson && work.tab === 'outline' && !ui.outlineSideOpen && !ui.focusMode && !ui.readMode && !modulePopped"
        class="ol-side-rail"
        type="button"
        title="展开故事结构"
        aria-label="展开故事结构"
        @click="ui.setPref('outlineSideOpen', true)"
      >
        <OIcon name="caret-right" :size="12" />
        <span class="rail-text">故事结构</span>
      </button>

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
        v-if="!ui.focusMode && !ui.readMode && !modulePopped && work.tab === 'chapters' && !ui.rightPanelOpen"
        class="rp-rail"
        title="展开批注栏"
        @click="ui.setPref('rightPanelOpen', true)"
      >
        <OIcon name="caret-right" :size="12" class="rp-rail-caret" />
        <span class="rp-rail-text">批注栏</span>
      </button>

      <RightPanel v-if="!crimson && !ui.focusMode && !ui.readMode && !modulePopped && work.tab === 'chapters' && ui.rightPanelOpen" />

      <InspirationPrompt v-if="ui.skin === 'gravity' && work.tab === 'snippets' && (!ui.aiDrawerOpen || aiPopped) && !modulePopped && !ui.focusMode && !ui.readMode" />

      <!-- 非模态覆盖层：开合与拖宽不参与正文排版；隐藏时保留输入与生成状态。 -->
      <aside v-if="aiMounted" v-show="aiVisible" class="ai-dock" :data-agent-skin="ui.skin" aria-label="恍然梦助手" :style="{ width: 'min(' + ui.aiDrawerWidth + 'px, 100%)' }">
        <div class="ai-dock-resizer" title="拖拽调整恍然梦宽度（双击恢复默认）" @mousedown="startAiResize" @dblclick="resetAiWidth"></div>
        <div class="ai-drawer-head">
          <span class="ai-drawer-name serif">恍然梦</span>
          <div style="flex: 1"></div>
          <NButton size="tiny" quaternary title="拆出为独立窗口（可与其他模块并排对照）" @click="onSplit('ai')"><OIcon name="split" :size="13" /></NButton>
          <NButton size="tiny" quaternary title="收起恍然梦" @click="ui.aiDrawerOpen = false"><OIcon name="close" :size="13" /></NButton>
        </div>
        <div class="ai-drawer-body" style="padding:0;overflow:hidden">
          <AiAssistantPanel />
        </div>
      </aside>
    </div>

    <!-- 赤月戏：40px 底栏（作品 · 模块 + 保存状态 + 重播开场） -->
    <footer v-if="crimson" class="crimson-statusbar">
      <span>{{ work.work?.title }}<template v-if="curTabLabel"> · {{ curTabLabel }}</template></span>
      <span class="crimson-status-mark">赤月戏</span>
      <div>
        <span class="crimson-status-save"><span class="save-dot" :class="badgeClass"></span>{{ badgeText }}</span>
        <button type="button" class="crimson-replay" @click="playStage()">重播开场</button>
      </div>
    </footer>

    <!-- 关系链接悬浮预览窗（全局唯一，悬停关系链接标签 / 纯文本令牌时展示目标内容） -->
    <DLinkPopover />
  </div>
</template>

<style scoped>
.wb-body { position: relative; min-width: 0; }
.ai-dock {
  --agent-header-color: #896e4e;
  position: absolute;
  top: 0;
  bottom: 0;
  right: 0;
  z-index: 20;
  max-width: 100%;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: var(--bg, var(--bg-panel));
  border-left: 1px solid var(--border-strong, var(--border));
  box-shadow: -8px 0 22px rgba(20, 16, 8, 0.06);
}
.ai-dock[data-agent-skin='gravity'] { --agent-header-color: #f3a163; }
.ai-dock[data-agent-skin='glaze'] { --agent-header-color: #196b78; }
.ai-dock[data-agent-skin='crimson'] { --agent-header-color: #d2b16c; }
.ai-dock .ai-drawer-name { color: var(--agent-header-color); font-size: 16px; }
.ai-dock-resizer {
  position: absolute;
  left: -4px;
  top: 0;
  bottom: 0;
  width: 8px;
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
