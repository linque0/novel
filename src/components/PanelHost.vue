<script setup>
/* 功能面板窗口宿主（9.2-W5）：面板窗口 = 完整功能界面（侧栏 + 正文区，章节含右栏），
 * 与主窗口同一套组件零改动复用，可在面板内自由切换条目。
 * 按 ?panel=<type>:<workId>:<entityId> 打开作品并预选中实体；
 * 章节/人物/灵感的实体锁随面板当前选中迁移（panelSetEntity），主窗口占位实时跟随。 */
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { NButton } from 'naive-ui'
import OIcon from './OIcon.vue'
import OriginalSaveStatus from './OriginalSaveStatus.vue'
import { useOriginalPanes } from '../composables/useOriginalPanes'
import { useWorkStore } from '../stores/work'
import { useUiStore } from '../stores/ui'
import { isLatentSkin, resolveSkin } from '../skins/registry'
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
/* 隐现（dsh）皮肤的内容窗：与主窗共用同一套完整工作区 */
import LatentOutlineCenter from './skins/latent/outline/OutlineCenter.vue'
import CharactersWorkspace from './skins/latent/characters/CharactersWorkspace.vue'
import LoreWorkspace from './skins/latent/lore/LoreWorkspace.vue'
import SnippetsWorkspace from './skins/latent/snippets/SnippetsWorkspace.vue'
import PanelBackdrop from './skins/latent/PanelBackdrop.vue'
import RightPanel from './RightPanel.vue'
import WritingSidePanels from './writing-layout/WritingSidePanels.vue'
import DLinkPopover from './DLinkPopover.vue'
import RevisionsModal from './RevisionsModal.vue'
/* 正文导入/导出：工具栏「更多功能」直接置 ui.importOpen / ui.exportOpen，
 * 拆出的章节独立窗口也必须挂这两个对话框，否则入口点了没反应。
 * 设置窗口分支自带一份（SettingsWindow 内），不要在这里重复挂。 */
import ImportDialog from './ImportDialog.vue'
import ExportDialog from './ExportDialog.vue'
import SettingsWindow from './SettingsWindow.vue'
import MubuTagPanel from './MubuTagPanel.vue'
import LoreRelationPanel from './LoreRelationPanel.vue'
import LoreDetail from './LoreDetail.vue'
import AiAssistantPanel from './ai/AiAssistantPanel.vue'
const nsPlugin = __NS_PLUGIN__
import PresetWindow from './ai/PresetWindow.vue'
import StudioWorkspace from './StudioWorkspace.vue'
import TaskLauncher from './ai/TaskLauncher.vue'
import GlazeArtwork from './GlazeArtwork.vue'
import GlazeLightingToggle from './GlazeLightingToggle.vue'
import { useGlazeMuseum } from '../composables/useGlazeMuseum'
import { useGlazeDrawers } from '../composables/useGlazeDrawers'

const work = useWorkStore()
const ui = useUiStore()
const { museumActive } = useGlazeMuseum()
const shell = ref(null)
const { narrow, drawer, modalDrawer, closeDrawer, toggleDrawer } = useGlazeDrawers(museumActive, shell)
watch(() => work.activeChapter?.id, id => { if (!id && drawer.value === 'notes') closeDrawer() })
/* 面板窗口也要把皮肤写到 body，皮肤样式统一以 body[data-skin] 为作用域 */
watch(
  () => resolveSkin(ui.skin, 'panel').id,
  (id) => { document.body.dataset.skin = id },
  { immediate: true }
)

const spec = ref(null) // { type, workId, entityId }
const latentContent = computed(() => isLatentSkin(ui.skin) && ['chapter', 'outline', 'lore', 'characters', 'snippets'].includes(spec.value?.type))
const latentOutline = computed(() => latentContent.value && spec.value.type === 'outline')
const ownsWorkspace = computed(() => latentContent.value && spec.value.type !== 'chapter')
const writingLayout = computed(() => isLatentSkin(ui.skin) && spec.value?.type === 'chapter')
const status = ref('loading') // loading | ready | error
const errMsg = ref('')
const original=computed(()=>ui.skin==='original'&&['chapter','outline','characters','lore','snippets'].includes(spec.value?.type))
const {mode:owMode,drawer:owDrawer,modal:owModal,close:closeOriginalPane,toggle:toggleOriginalPane}=useOriginalPanes(original,shell,computed(()=>ui.sideWidth))
watch(()=>[ui.focusMode,ui.readMode],()=>closeOriginalPane(false))

const PANEL_TITLES = { chapter: '正文', outline: '大纲', characters: '人物', lore: '设定', snippets: '灵感', settings: '设置', 'ai-presets': '恍然梦预设', ai: '恍然梦', agent: '恍然梦创作台' }
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
  if(original.value){try{await autosave.flushAll();if(ui.autosave.pending||ui.autosave.error)return;closePanel()}catch(error){ui.autosave.error=String(error?.message||'保存失败')}return}
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
  /* 设置窗口与全局预设窗口：无作品上下文，不打开作品 */
  if (s.type === 'settings' || s.type === 'ai-presets' && s.workId === '__global__') {
    status.value = 'ready'
    document.title = '小说工坊 · ' + (PANEL_TITLES[s.type] || '面板')
    return
  }
  try {
    await work.open(s.workId, { chapterId: s.type === 'chapter' ? s.entityId : null, restorePosition: false })
  } catch (e) {
    status.value = 'error'
    errMsg.value = '作品打开失败：' + (e?.message || e)
    return
  }
  // 完整界面：切到对应页签并预选中拆窗时的实体（恍然梦无页签，仅携带作品上下文）
  const tabOf = { chapter: 'chapters', outline: 'outline', characters: 'characters', lore: 'lore', snippets: 'snippets' }
  if (tabOf[s.type]) work.tab = tabOf[s.type]
  if(s.type==='agent')ui.workbenchMode='agent'
  if (s.type === 'ai-presets' && s.entityId) work.selChapterId = s.entityId
  if (s.type === 'chapter' && s.entityId && work.liveChapters.some(c=>c.id===s.entityId)) {
    work.selChapterId = s.entityId
    work.selVolumeId = work.activeChapter?.volumeId || work.selVolumeId
  }
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
  <div ref="shell" class="app-root panel-host" :class="['theme-' + ui.theme, { 'latent-studio': writingLayout, 'outline-strict': latentOutline, 'original-workspace':original, 'is-focus':(original || writingLayout) && ui.focusMode, 'is-reading':(original || writingLayout) && ui.readMode, 'glaze-museum': museumActive, 'glaze-drawer-open': modalDrawer }]" :data-glaze-light="museumActive ? ui.glazeLighting : undefined" :data-skin="resolveSkin(ui.skin, 'panel').id" :data-module="work.tab" :data-flow="latentContent ? 'on' : undefined" :data-ow-directory-overlay="original && owMode.directory || undefined" :data-ow-notes-overlay="original && owMode.notes || undefined" :data-ow-open="original ? owDrawer : undefined" :style="ui.rootStyle" style="height: 100vh; display: flex; flex-direction: column">
    <div v-if="museumActive" class="gm-cornice" aria-hidden="true"><span></span><i></i><span></span></div>
    <div v-if="status === 'error'" class="empty-shelf" style="padding-top: 18vh">
      <div class="big">面板无法打开</div>
      <p>{{ errMsg }}</p>
      <NButton type="primary" @click="closePanel">关闭面板</NButton>
    </div>
    <template v-else-if="status === 'ready'">
      <!-- 设置窗口：独立布局（左导航 + 右内容），无作品顶栏 -->
      <PresetWindow v-if="spec.type === 'ai-presets'" style="flex: 1; min-height: 0" />
      <SettingsWindow v-else-if="spec.type === 'settings'" style="flex: 1; min-height: 0" />
      <StudioWorkspace v-else-if="spec.type==='agent'" />
      <template v-else>
        <TaskLauncher v-if="ui.isStudioSkin && spec.type !== 'ai'" :module="work.tab" />
        <PanelBackdrop v-if="latentContent" />
        <div class="panel-topbar" :inert="modalDrawer || owModal || undefined">
          <GlazeLightingToggle v-if="museumActive" />
          <div v-show="ui.isStudioSkin" id="studio-task-actions"></div>
          <span class="serif" style="font-weight: 700">{{ work.work?.title }} · {{ panelTitle }}</span>
          <OriginalSaveStatus v-if="original"/><span v-else class="save-badge">
            <span class="save-dot" :class="badgeClass"></span>
            {{ badgeText }}
          </span>
          <div style="flex: 1"></div>
          <NButton size="small" @click="flushAndClose">保存并关闭</NButton>
          <NButton size="small" quaternary @click="closePanel"><OIcon name="close" :size="13" /></NButton>
        </div>
        <div v-if="ui.skin === 'crimson' && spec.type !== 'ai'" class="crimson-panel-bar">
          <div class="crimson-module-title"><h1>{{ panelTitle }}</h1></div>
          <div id="crimson-bar-tools" class="crimson-bar-tools"></div>
        </div>
        <!-- 恍然梦窗口：无侧栏与中央区，全高 AI 界面 -->
        <div v-if="spec.type === 'ai'" class="ai-win">
          <AiAssistantPanel v-if="!nsPlugin" />
        </div>
        <div v-if="museumActive && narrow && spec.type !== 'ai'" class="glaze-pane-toggles" :inert="modalDrawer || owModal || undefined">
          <button type="button" class="glaze-directory-toggle" aria-controls="glaze-panel-directory" :aria-expanded="drawer === 'directory'" @click="ui.outlineSideOpen=true;toggleDrawer('directory',$event)">目录与资料</button>
          <button v-if="spec.type === 'chapter' && work.activeChapter" type="button" class="glaze-notes-toggle" aria-controls="glaze-panel-notes" :aria-expanded="drawer === 'notes'" @click="toggleDrawer('notes',$event)">批注与资料</button>
        </div>
        <div v-if="original && !ui.readMode && !ui.focusMode" class="ow-modulebar" :inert="owModal || undefined"><button v-if="owMode.directory" aria-controls="glaze-panel-directory" :aria-expanded="owDrawer==='directory'" @click="toggleOriginalPane('directory',$event)">目录与资料</button><h1>{{panelTitle}}</h1><button v-if="owMode.notes && spec.type==='chapter'" aria-controls="glaze-panel-notes" :aria-expanded="owDrawer==='notes'" @click="toggleOriginalPane('notes',$event)">批注与资料</button></div>
        <div v-if="spec.type !== 'ai'" class="panel-body" :class="{ 'writing-layout-host': writingLayout }"><button v-if="owModal" type="button" class="ow-scrim" aria-label="关闭资料面板" tabindex="-1" @click="closeOriginalPane()"></button>
          <WritingSidePanels v-if="writingLayout && !ui.focusMode && !ui.readMode" directory :notes="!!work.activeChapter"
            directory-id="glaze-writing-directory" notes-id="glaze-panel-notes">
            <template #directory>
              <div class="side-panel" aria-label="章节栏">
                <ChapterTree in-panel collapsible-panel @read="ui.readMode=true" @collapse="ui.setPref('sidePanelOpen', false)" />
              </div>
            </template>
            <template #notes><RightPanel aria-label="批注与资料" /></template>
          </WritingSidePanels>
          <button v-if="modalDrawer" type="button" class="glaze-drawer-scrim" aria-label="关闭侧栏" tabindex="-1" @click="closeDrawer()"></button>
          <div v-if="!writingLayout && ui.skin !== 'crimson' && !ownsWorkspace" id="glaze-panel-directory" v-show="original && owMode.directory || museumActive && narrow || (spec.type !== 'outline' || ui.outlineSideOpen) && (spec.type !== 'chapter' || (!ui.readMode && !ui.focusMode))" class="side-panel" :data-ow-pane="original ? 'directory' : undefined" :class="{ 'glaze-drawer-visible': drawer === 'directory' }" data-glaze-drawer="directory" :role="original && owMode.directory || museumActive && narrow ? 'dialog' : undefined" :aria-modal="owModal && owDrawer==='directory' || museumActive && narrow && drawer === 'directory' ? true : undefined" aria-label="目录与资料" :inert="original && owMode.directory && owDrawer!=='directory' || museumActive && narrow && drawer !== 'directory' || undefined" :style="{ width: ui.sideWidth + 'px', '--glaze-side-width': ui.sideWidth + 'px' }">
            <button v-if="original && owMode.directory" type="button" class="ow-pane-close" @click="closeOriginalPane()">关闭目录 ×</button>
            <button v-if="museumActive" type="button" class="glaze-drawer-close" aria-label="关闭目录与资料" @click="closeDrawer()">关闭 ×</button>
            <GlazeArtwork v-if="museumActive" compact />
            <ChapterTree v-if="spec.type === 'chapter'" in-panel @read="ui.readMode=true" />
            <OutlineSidebar v-else-if="spec.type === 'outline'" />
            <CharacterList v-else-if="spec.type === 'characters'" />
            <MubuTree v-else-if="spec.type === 'lore'" />
            <SnippetList v-else-if="spec.type === 'snippets'" />
          </div>
          <div v-if="!writingLayout && ui.skin !== 'crimson' && !ownsWorkspace" v-show="(spec.type !== 'outline' || ui.outlineSideOpen) && (spec.type !== 'chapter' || (!ui.readMode && !ui.focusMode))" class="side-resizer" title="拖拽调整侧栏宽度（双击恢复默认）" @mousedown="startSideResize" @dblclick="ui.setPref('sideWidth', 252)"></div>
          <button
            v-if="ui.skin !== 'crimson' && !latentOutline && spec.type === 'outline' && !ui.outlineSideOpen"
            class="ol-side-rail"
            type="button"
            title="展开故事结构"
            aria-label="展开故事结构"
            @click="ui.setPref('outlineSideOpen', true)"
          >
            <OIcon name="caret-right" :size="12" />
            <span class="rail-text">故事结构</span>
          </button>
          <template v-if="ownsWorkspace">
            <div v-if="latentOutline" class="latent-outline-panel">
              <LatentOutlineCenter />
            </div>
            <CharactersWorkspace v-else-if="spec.type === 'characters'" class="char-shell-host" />
            <LoreWorkspace v-else-if="spec.type === 'lore'" class="lore-shell-host" />
            <SnippetsWorkspace v-else-if="spec.type === 'snippets'" class="snippets-shell-host" />
          </template>
          <div v-else class="center-pane paper-texture" :class="{ 'crimson-panel-center': ui.skin === 'crimson' }" :inert="modalDrawer || owModal || undefined">
            <EditorPane v-if="spec.type === 'chapter'" />
            <OutlineCenter v-else-if="spec.type === 'outline'" style="flex: 1; min-height: 0" />
            <CharacterCenter v-else-if="spec.type === 'characters'" />
            <MubuView v-else-if="spec.type === 'lore'" />
            <SnippetCenter v-else-if="spec.type === 'snippets'" />
          </div>
          <RightPanel v-if="!writingLayout && spec.type === 'chapter' && ui.skin !== 'crimson'" id="glaze-panel-notes" :data-ow-pane="original ? 'notes' : undefined" :original-drawer="original && owMode.notes" @original-close="closeOriginalPane()" :class="{ 'glaze-drawer-visible': drawer === 'notes' }" data-glaze-drawer="notes" :role="original && owMode.notes || museumActive && narrow ? 'dialog' : undefined" :aria-modal="owModal && owDrawer==='notes' || museumActive && narrow && drawer === 'notes' ? true : undefined" aria-label="批注与资料" :inert="original && owMode.notes && owDrawer!=='notes' || museumActive && narrow && drawer !== 'notes' || undefined" @glaze-close="closeDrawer()" />
        </div>
        <DLinkPopover />
        <RevisionsModal />
        <ImportDialog />
        <ExportDialog />
        <MubuTagPanel />
        <LoreRelationPanel />
        <LoreDetail />
      </template>
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
.ai-win {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding: 0;
}
</style>
