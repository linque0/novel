<script setup>
/* 功能面板窗口宿主（9.2-W5）：面板窗口 = 完整功能界面（侧栏 + 正文区，章节含右栏），
 * 与主窗口同一套组件零改动复用，可在面板内自由切换条目。
 * 按 ?panel=<type>:<workId>:<entityId> 打开作品并预选中实体；
 * 章节/人物/灵感的实体锁随面板当前选中迁移（panelSetEntity），主窗口占位实时跟随。 */
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { NButton } from 'naive-ui'
import OIcon from './OIcon.vue'
import { useWorkStore } from '../stores/work'
import { useUiStore } from '../stores/ui'
import { autosave, startAutosave } from '../services/autosave'
import { panelSetEntity } from '../services/panelwindows'
import ChapterTree from './ChapterTree.vue'
import OutlineSidebar from './OutlineSidebar.vue'
import CharacterList from './CharacterList.vue'
import MubuTree from './MubuTree.vue'
import SnippetList from './SnippetList.vue'
import EditorPane from './EditorPane.vue'
import OutlineCenter from './OutlineCenter.vue'
import CharacterCenter from './CharacterCenter.vue'
import MubuView from './MubuView.vue'
import SnippetCenter from './SnippetCenter.vue'
import RightPanel from './RightPanel.vue'
import DLinkPopover from './DLinkPopover.vue'
import RevisionsModal from './RevisionsModal.vue'

const work = useWorkStore()
const ui = useUiStore()

const spec = ref(null) // { type, workId, entityId }
const status = ref('loading') // loading | ready | error
const errMsg = ref('')

const PANEL_TITLES = { chapter: '正文', outline: '大纲', characters: '人物', lore: '设定', snippets: '灵感' }
const ENTITY_SEL = {
  chapter: () => work.activeChapter?.title,
  characters: () => work.activeCharacter?.name,
  snippets: () => work.activeSnippet?.title
}
const panelTitle = computed(() => {
  const label = PANEL_TITLES[spec.value?.type] || '面板'
  const ent = ENTITY_SEL[spec.value?.type]?.()
  return ent ? `${label} · ${ent}` : label
})

const badgeClass = computed(() => (ui.autosave.saving ? 'saving' : ui.autosave.pending ? 'dirty' : ''))
const badgeText = computed(() => {
  if (ui.autosave.saving) return '保存中…'
  if (ui.autosave.pending) return `${ui.autosave.pending} 处待保存`
  return ui.autosave.lastSavedAt ? '已保存' : '自动保存就绪'
})

function closePanel() {
  window.native?.panelCloseSelf()
}
async function flushAndClose() {
  try {
    await autosave.flushAll()
  } finally {
    closePanel()
  }
}

/* 侧栏宽度拖拽（与主窗口同一 appconfig 记忆） */
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

function parseSpec() {
  const raw = new URLSearchParams(location.search).get('panel')
  if (!raw) return null
  const [type = '', workId = '', entityId = ''] = raw.split(':')
  if (!type || !workId) return null
  return { type, workId, entityId }
}

async function boot() {
  const s = parseSpec()
  if (!s || !PANEL_TITLES[s.type]) {
    status.value = 'error'
    errMsg.value = '面板参数缺失或无效'
    return
  }
  spec.value = s
  try {
    await work.open(s.workId)
  } catch (e) {
    status.value = 'error'
    errMsg.value = '作品打开失败：' + (e?.message || e)
    return
  }
  // 完整界面：切到对应页签并预选中拆窗时的实体
  const tabOf = { chapter: 'chapters', outline: 'outline', characters: 'characters', lore: 'lore', snippets: 'snippets' }
  work.tab = tabOf[s.type]
  if (s.type === 'chapter') work.selChapterId = s.entityId || work.liveChapters[0]?.id || null
  if (s.type === 'outline') {
    work.outlineView = 'canvas'
    if (s.entityId) work.selOlnodeId = s.entityId
  }
  if (s.type === 'characters') work.selCharacterId = s.entityId || work.liveCharacters[0]?.id || null
  if (s.type === 'lore' && s.entityId) ui.mubuSelectedId = s.entityId
  if (s.type === 'snippets') work.selSnippetId = s.entityId || work.liveSnippets[0]?.id || null
  status.value = 'ready'
  document.title = `小说工坊 · ${work.work?.title || ''} · ${panelTitle.value}`
}

/* 实体锁跟随面板当前选中（章节/人物/灵感；大纲/设定为整模块锁无需迁移） */
const SEL_OF = {
  chapter: () => work.selChapterId,
  characters: () => work.selCharacterId,
  snippets: () => work.selSnippetId
}
watch(
  () => (spec.value && SEL_OF[spec.value.type] ? SEL_OF[spec.value.type]() : null),
  (id) => {
    if (id && spec.value) panelSetEntity(work, spec.value.type, id)
  }
)

onMounted(() => {
  startAutosave()
  boot()
})
onBeforeUnmount(() => autosave.flushAll())
</script>

<template>
  <div class="app-root" :class="'theme-' + ui.theme" :style="ui.rootStyle" style="height: 100vh; display: flex; flex-direction: column">
    <div v-if="status === 'error'" class="empty-shelf" style="padding-top: 18vh">
      <div class="big">面板无法打开</div>
      <p>{{ errMsg }}</p>
      <NButton type="primary" @click="closePanel">关闭面板</NButton>
    </div>
    <template v-else-if="status === 'ready'">
      <div class="panel-topbar">
        <span class="serif" style="font-weight: 700">{{ work.work?.title }} · {{ panelTitle }}</span>
        <span class="save-badge">
          <span class="save-dot" :class="badgeClass"></span>
          {{ badgeText }}
        </span>
        <div style="flex: 1"></div>
        <NButton size="small" @click="flushAndClose">保存并关闭</NButton>
        <NButton size="small" quaternary @click="closePanel"><OIcon name="close" :size="13" /></NButton>
      </div>
      <div class="panel-body">
        <div class="side-panel" :style="{ width: ui.sideWidth + 'px' }">
          <ChapterTree v-if="spec.type === 'chapter'" />
          <OutlineSidebar v-else-if="spec.type === 'outline'" />
          <CharacterList v-else-if="spec.type === 'characters'" />
          <MubuTree v-else-if="spec.type === 'lore'" />
          <SnippetList v-else-if="spec.type === 'snippets'" />
        </div>
        <div class="side-resizer" title="拖拽调整侧栏宽度（双击恢复默认）" @mousedown="startSideResize" @dblclick="ui.setPref('sideWidth', 252)"></div>
        <div class="center-pane paper-texture">
          <EditorPane v-if="spec.type === 'chapter'" />
          <OutlineCenter v-else-if="spec.type === 'outline'" style="flex: 1; min-height: 0" />
          <CharacterCenter v-else-if="spec.type === 'characters'" />
          <MubuView v-else-if="spec.type === 'lore'" />
          <SnippetCenter v-else-if="spec.type === 'snippets'" />
        </div>
        <RightPanel v-if="spec.type === 'chapter'" />
      </div>
      <DLinkPopover />
      <RevisionsModal />
    </template>
    <div v-else class="empty-shelf" style="padding-top: 20vh">
      <div class="big">正在打开面板…</div>
    </div>
  </div>
</template>

<style scoped>
.panel-topbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-panel);
  flex: none;
}
.panel-body {
  flex: 1;
  min-height: 0;
  display: flex;
}
</style>
