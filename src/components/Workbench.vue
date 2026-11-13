<script setup>
import { computed, ref, provide, onMounted, onBeforeUnmount, watch } from 'vue'
import { NButton, NDropdown, useMessage } from 'naive-ui'
import { useWorkStore } from '../stores/work'
import { useUiStore } from '../stores/ui'
import { useAiStore } from '../stores/ai'
import OIcon from './OIcon.vue'
import AppTopbar from './AppTopbar.vue'
import OriginalSaveStatus from './OriginalSaveStatus.vue'
import { useOriginalAppearance } from '../composables/useOriginalAppearance'
import { useOriginalPanes } from '../composables/useOriginalPanes'
import { originalSaveState } from '../services/original-workspace.mjs'
import DreamModeEntries from './agent/DreamModeEntries.vue'
import {enterDreamMode,enterLightSleepMode} from '../services/ai/entry-modes.js'
import { WORK_NAVIGATION } from './app-navigation'
import ChapterTree from './ChapterTree.vue'
import OutlineSidebar from './OutlineSidebar.vue'
import CharacterList from './CharacterList.vue'
import SnippetList from './SnippetList.vue'
import CandidateEditor from './agent/CandidateEditor.vue'
import {useStoryStore} from '../stores/story.js'
const story=useStoryStore()
import { autosave } from '../services/autosave.js'
import OutlineCenter from './OutlineCenter.vue'
import CharacterCenter from './CharacterCenter.vue'
import MubuView from './MubuView.vue'
import MubuTree from './MubuTree.vue'
import SnippetCenter from './SnippetCenter.vue'
/* 隐现（dsh）皮肤专用的完整工作区：自带面板矩阵 / 画布 / 详情，
 * 仅在 isLatentSkin 为真时渲染，四套旧皮肤仍走上面的 Center 组件。 */
import LatentOutlineCenter from './skins/latent/outline/OutlineCenter.vue'
import CharactersWorkspace from './skins/latent/characters/CharactersWorkspace.vue'
import LoreWorkspace from './skins/latent/lore/LoreWorkspace.vue'
import SnippetsWorkspace from './skins/latent/snippets/SnippetsWorkspace.vue'
import { isLatentSkin } from '../skins/registry'
/* 隐现皮肤的流动背板（正文/大纲/设定/人物/灵感共用同一个 flow 引擎） */
import { mountFlowBackdrop } from '../services/latent/flow.js'
import { flowPaletteKey, resolveFlowPalette } from '../services/latent/flow-palette.js'
import RightPanel from './RightPanel.vue'
import AiAssistantPanel from './ai/AiAssistantPanel.vue'
const nsPlugin = __NS_PLUGIN__
import DLinkPopover from './DLinkPopover.vue'
import InspirationPrompt from './InspirationPrompt.vue'
import TaskLauncher from './ai/TaskLauncher.vue'
import { popOut, isPopped, focusPopped } from '../services/panelwindows'
import { playStage } from '../services/stage-play'
import artEditor from '../assets/skins/crimson/editor.webp'
import artOutline from '../assets/skins/crimson/outline.webp'
import artCharacters from '../assets/skins/crimson/characters.webp'
import artInspiration from '../assets/skins/crimson/inspiration.webp'
import GlazeArtwork from './GlazeArtwork.vue'
import GlazeLightingToggle from './GlazeLightingToggle.vue'
import { useGlazeMuseum } from '../composables/useGlazeMuseum'
import { useGlazeDrawers } from '../composables/useGlazeDrawers'

const work = useWorkStore()
const ui = useUiStore()
const { museumActive, museumPopoverClass } = useGlazeMuseum()
const museum = computed(() => ui.skin === 'glaze')
const shell = ref(null)
const { originalActive: original } = useOriginalAppearance()
const { mode:owMode,drawer:owDrawer,modal:owModal,close:closeOriginalPane,toggle:toggleOriginalPane }=useOriginalPanes(original,shell,computed(()=>ui.sideWidth))
watch(()=>[work.tab,ui.focusMode,ui.readMode],()=>closeOriginalPane(false))
const { narrow, drawer, modalDrawer, closeDrawer, toggleDrawer } = useGlazeDrawers(museumActive, shell)
/* 隐现皮肤下，设定/人物/灵感三个工作区自带左侧矩阵列（nav/roster/列表），
   外置目录栏必须让位，否则会出现双层目录。旧皮肤保持原有判断。 */
const latentSkin = computed(() => isLatentSkin(ui.skin))
const latentSidebarOwned = computed(() => latentSkin.value && ['lore', 'characters', 'snippets'].includes(work.tab))
const showDirectory = computed(() => !latentSidebarOwned.value && !ui.focusMode && !ui.readMode && !modulePopped.value && !(crimson.value && ['chapters','outline','lore','characters','snippets'].includes(work.tab)) && !(latentSkin.value && work.tab === 'outline'))
/* 隐现大纲以画布进入：store 的 outlineView 默认 'text' 被旧皮肤组件共用，不能改；
   这里只在隐现大纲首次出现时补种一次，之后用户自己切 画布/文本 不再被覆盖。 */
let outlineCanvasSeeded = false
watch(() => latentSkin.value && work.tab === 'outline', (on) => {
  if (!on || outlineCanvasSeeded) return
  outlineCanvasSeeded = true
  if (work.outlineView === 'text') work.outlineView = 'canvas'
}, { immediate: true })
const showNotes = computed(() => !!work.activeChapter && !crimson.value && !ui.focusMode && !ui.readMode && !modulePopped.value && work.tab === 'chapters')
/* 目录栏（正文页即章节栏）开合：大纲模块沿用自有开合，其余模块共用 sidePanelOpen */
const dirVisible = computed(() => (work.tab === 'outline' ? ui.outlineSideOpen : ui.sidePanelOpen))
function toggleDirectory() {
  return work.tab === 'outline' ? ui.setPref('outlineSideOpen', !ui.outlineSideOpen) : ui.setPref('sidePanelOpen', !ui.sidePanelOpen)
}
function closeDirectory() {
  if(original.value&&owMode.value.directory)return closeOriginalPane()
  return ui.setPref(work.tab === 'outline' ? 'outlineSideOpen' : 'sidePanelOpen', false)
}
function openDirectoryDrawer(event) {
  ui.setPref(work.tab === 'outline' ? 'outlineSideOpen' : 'sidePanelOpen', true)
  toggleDrawer('directory', event)
}
watch(() => [work.tab, ui.focusMode, ui.readMode], () => closeDrawer(false))
watch(() => work.activeChapter?.id, id => { if (!id && drawer.value === 'notes') closeDrawer() })
const ai = useAiStore()
async function returnToShelf(){
  if(new URLSearchParams(location.search).get('panel')?.startsWith('agent:'))return window.native?.panelCloseSelf()
  if(original.value){await autosave.flushAll();if(ui.autosave.pending||ui.autosave.error){msg.error('仍有内容未保存，请重试保存后再返回书单');return}}
  return work.closeWork()
}
const inspirationPrompt = ref('把这条灵感扩展成一个场景，保留悬念。')
provide('inspirationPrompt', inspirationPrompt)
const msg = useMessage()
const entryBusy=ref(false)
async function enterAiMode(mode){
  if(entryBusy.value)return
  entryBusy.value=true
  try{
    const context={ui,work,flush:()=>autosave.flushAll(),toggle:true,isDetached:()=>isPopped(work,'ai',''),focusDetached:()=>focusPopped(work,'ai','')}
    await (mode==='dream'?enterDreamMode(context):enterLightSleepMode(context))
  }catch(e){msg.error(e.message)}finally{entryBusy.value=false}
}
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
  { label: dirVisible.value ? '收起目录栏' : '展开目录栏', key: 'dir' },
  { label: ui.focusMode ? '退出沉浸' : '沉浸写作', key: 'focus' },
  ...(ui.skin === 'crimson' ? [{ label: '重播开场', key: 'replay' }] : []),
  ...(work.tab === 'chapters' ? [{ label: ui.readMode ? '退出阅读' : '阅读模式', key: 'read' }] : []),
  ...(ui.skin !== 'original' ? [{ label: '切回原版皮肤', key: 'original' }] : [])
])
function onMore(key) {
  if (key === 'assistant') return taskLauncher.value?.open()
  if (key.startsWith('split:')) return onSplit(key.slice(6))
  if (key.startsWith('bookmark:')) return onBookmarkSelect(key.slice(9))
  if (key === 'dir') return toggleDirectory()
  if (key === 'focus') ui.focusMode = !ui.focusMode
  if (key === 'replay') return playStage()
  if (key === 'read') ui.readMode = !ui.readMode
  if (key === 'original') ui.setSkin('original')
  if (key === 'settings') openSettings()
}

const narrowActions = computed(() => latentSkin.value ? [] : [
  ...(original.value&&ui.autosave.error?[{label:'重试保存',key:'retry-save'}]:[]),
  { label: '搜索', key: 'search' },
  { label: '章节历史', key: 'history', disabled: !(work.tab === 'chapters' && work.activeChapter) },
  { label: chapterNotes.value.length ? `批注 (${chapterNotes.value.length})` : '批注', key: 'notes', disabled: !chapterNotes.value.length },
  { label: '更多', key: 'more', children: moreOptions.value }
])
function onTopbarAction(key) {
  if(key==='retry-save')return autosave.flushAll()
  if (key === 'search') return (ui.searchOpen = true)
  if (key === 'history') {
    if (work.tab !== 'chapters' || !work.activeChapter) return
    return (ui.revisionsCtx = { id: work.activeChapter.id, title: work.activeChapter.title })
  }
  if (key === 'notes') return openNotesDrawer()
  onMore(key)
}

/* 窄栏批注抽屉：<560 时右批注栏改由 ⋯「动作 → 批注」打开，覆盖式从右滑出；
 * ≥560 由 dsh 皮肤恢复常驻三栏，这里的开关不落盘、不写 ui.rightPanelOpen。 */
const narrowNotesOpen = ref(false)
let narrowMq = null
const chapterNotes = computed(() => (work.activeChapter ? work.annotationsForChapter(work.activeChapter.id) : []))
function openNotesDrawer() {
  if (!chapterNotes.value.length) return
  /* 宽屏没有抽屉：同一入口退回「展开常驻批注栏」，不让这个菜单项在桌面版变成死键 */
  if (!window.matchMedia('(max-width: 559px)').matches) return ui.setPref('rightPanelOpen', true)
  narrowNotesOpen.value = true
}
function syncNarrowView(event) {
  if (!event.matches) narrowNotesOpen.value = false
}
watch(() => work.tab, () => { narrowNotesOpen.value = false })
watch(() => work.activeChapter?.id, () => { if (!chapterNotes.value.length) narrowNotesOpen.value = false })

const fmtTime = (t) => {
  const d = new Date(t)
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}
const badgeClass = computed(() => (ui.autosave.saving ? 'saving' : ui.autosave.pending ? 'dirty' : ''))
/* 窄栏顶栏保存点（<560 顶栏动作整条隐藏后仍需可见）：saving > dirty > saved；
 * autosave 目前只报 saving/pending，error 留给后续接线。 */
const saveState = computed(() => original.value ? originalSaveState(ui.autosave) : (ui.autosave.saving ? 'saving' : ui.autosave.pending ? 'dirty' : 'saved'))
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
  if (e.key === 'Escape' && narrowNotesOpen.value) {
    narrowNotesOpen.value = false
    e.preventDefault()
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

/* ---------- 隐现皮肤的主窗口流动背板：只做挂载与销毁，不含业务逻辑 ---------- */
const flowCanvas = ref(null)
let flowApi = null
let flowRippleAt = 0
const reduceMotionQuery = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
  ? window.matchMedia('(prefers-reduced-motion: reduce)') : null

function applyFlowPalette() {
  flowApi?.setPalette(resolveFlowPalette(ui.flowBackground, work.work), { duration: 600 })
}

function onFlowMotionChange(event) {
  flowApi?.setReducedMotion(event.matches)
}

function destroyFlow() {
  try { flowApi?.dispose?.() } catch { /* 已销毁 */ }
  flowApi = null
}

function mountFlow() {
  destroyFlow()
  /* 非隐现皮肤不挂背板：四套旧皮肤各有自己的背景，不能多跑一套引擎 */
  if (!isLatentSkin(ui.skin)) return
  /* 恍然梦模式下 StudioWorkspace 用 v-show 藏起 Workbench：画布还在 DOM 里，
     rAF 不会自己停，不销毁就是两套背板同时跑。 */
  if (ui.workbenchMode !== 'writing') return
  const canvas = flowCanvas.value
  if (!canvas) return
  const width = window.innerWidth
  flowApi = mountFlowBackdrop(canvas, {
    palette: resolveFlowPalette(ui.flowBackground, work.work),
    reducedMotion: Boolean(reduceMotionQuery?.matches),
    simWidth: width < 560 ? 320 : width < 900 ? 480 : 640,
    maxEdge: width < 900 ? 1280 : 1600
  })
}

/* 打字涟漪：编辑器（ProseMirror 根 .tiptap）输入时 80ms 节流推一次 */
function onStudioInput(event) {
  if (!isLatentSkin(ui.skin) || work.tab !== 'chapters') return
  const target = event.target
  if (!target || typeof target.closest !== 'function' || !target.closest('#tiptap, .tiptap')) return
  const now = performance.now()
  if (now - flowRippleAt < 80) return
  flowRippleAt = now
  try { flowApi?.pulse?.(0.05) } catch { /* 背板已销毁 */ }
}

function mountStudioBackdrop() {
  shell.value?.addEventListener('input', onStudioInput, true)
  reduceMotionQuery?.addEventListener?.('change', onFlowMotionChange)
  mountFlow()
}

function unmountStudioBackdrop() {
  shell.value?.removeEventListener('input', onStudioInput, true)
  reduceMotionQuery?.removeEventListener?.('change', onFlowMotionChange)
  destroyFlow()
}

/* 切页、切模式、切皮肤即重建：WebGL 上下文必须跟着放掉，重挂时换一张干净画布 */
watch(() => work.tab, () => { mountFlow() }, { flush: 'post' })
watch(() => ui.workbenchMode, () => { mountFlow() }, { flush: 'post' })
watch(() => ui.skin, () => { mountFlow() }, { flush: 'post' })
watch(() => flowPaletteKey(ui.flowBackground, work.work), applyFlowPalette)

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  narrowMq = window.matchMedia('(max-width: 559px)')
  narrowMq.addEventListener('change', syncNarrowView)
  mountStudioBackdrop()
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  narrowMq?.removeEventListener('change', syncNarrowView)
  unmountStudioBackdrop()
})
</script>

<template>
  <div ref="shell" class="workbench-shell" :data-ow-directory-overlay="original && owMode.directory || undefined" :data-ow-notes-overlay="original && owMode.notes || undefined" :data-ow-open="original ? owDrawer : undefined" :class="{ 'original-workspace':original, 'is-focus': ui.focusMode, 'is-reading': ui.readMode, 'is-crimson': crimson, 'glaze-museum': museum, 'glaze-drawer-open': modalDrawer, 'latent-studio': latentSkin && work.tab === 'chapters', 'outline-strict': latentSkin && work.tab === 'outline' }" :data-glaze-light="museum ? ui.glazeLighting : undefined" :data-module="work.tab" :data-flow="latentSkin ? 'on' : undefined" style="display: flex; flex-direction: column; height: 100%">
    <!-- 隐现皮肤的主窗口流动背板：dots / vignette / grain 三层叠在 canvas 上 -->
    <div v-if="latentSkin" class="st-backdrop-wrap" aria-hidden="true"><canvas class="st-backdrop" ref="flowCanvas"></canvas><div class="st-layer dots"></div><div class="st-layer vignette"></div><div class="st-layer grain"></div></div>
    <div v-if="museum" class="gm-cornice" aria-hidden="true"><span></span><i></i><span></span></div>
    <!-- 赤月戏：布景层（按模块换图）+ 顶部压暗渐变，内容始终在布景之上 -->
    <template v-if="crimson">
      <img v-if="crimsonArt" class="crimson-backdrop" :src="crimsonArt" alt="" aria-hidden="true" />
      <div class="crimson-shade" aria-hidden="true"></div>
    </template>

    <!-- 编辑皮肤：任务入口只挂一次，经 Teleport 进页头。原先每个模块各挂一份，
         切模块时组件与 Teleport 同时移动会触发 Vue 的 patch/unmount 异常。 -->
    <TaskLauncher v-if="studio && !nsPlugin" ref="taskLauncher" :module="work.tab" />

    <AppTopbar :inert="modalDrawer || owModal || undefined" :active="work.tab" :has-work="!!work.work" :target-title="work.work?.title" :save-state="saveState" @navigate="key => key === 'shelf' ? returnToShelf() : key === 'settings' ? openSettings() : selectTab(key)" :actions="narrowActions" @action="onTopbarAction">
      <template #actions>
        <button v-if="latentSkin && ui.focusMode" type="button" class="app-topbar-round app-topbar-exit-focus" aria-label="退出沉浸" title="退出沉浸" @click="ui.focusMode = false">×</button>
        <!-- 隐现（dsh）皮肤：顶栏右簇已由 AppTopbar 的圆钮组承担（已保存 / 搜索 / 统计 / 设置 / 锁定），
             这里只保留用户要求保留的恍然梦入口，避免一套顶栏出现两套搜索、两套保存态、两套更多。
             四套旧皮肤保持原有这一整条不动。 -->
        <template v-if="latentSkin">
          <div id="studio-task-actions"></div>
          <DreamModeEntries :disabled="entryBusy" :active="ui.aiDrawerOpen?'light':''" @dream="enterAiMode('dream')" @light="enterAiMode('light')" />
        </template>
        <template v-else>
          <GlazeLightingToggle v-if="museum" />
          <OriginalSaveStatus v-if="original"/><span v-else class="save-badge"><span class="save-dot" :class="badgeClass"></span>{{ badgeText }}</span>
          <NButton size="small" quaternary aria-label="搜索" @click="ui.searchOpen = true"><OIcon name="search" :size="16" /> 搜索</NButton>
          <div id="studio-task-actions"></div>
          <DreamModeEntries v-if="!nsPlugin" :disabled="entryBusy" :active="ui.aiDrawerOpen?'light':''" @dream="enterAiMode('dream')" @light="enterAiMode('light')" />
          <NDropdown :class="museumPopoverClass" trigger="click" :options="moreOptions" @select="onMore"><NButton size="small" quaternary title="拆窗、书签、沉浸、阅读与皮肤">更多 <OIcon name="caret-down" :size="11" /></NButton></NDropdown>
        </template>
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

    <div v-if="museum && narrow && (showDirectory || showNotes)" class="glaze-pane-toggles" :inert="modalDrawer || owModal || undefined">
      <button v-if="showDirectory" type="button" class="glaze-directory-toggle" aria-controls="glaze-writing-directory" :aria-expanded="drawer === 'directory'" @click="openDirectoryDrawer($event)">目录与资料</button>
      <span>{{ work.work?.title }}</span>
      <GlazeLightingToggle />
      <button v-if="showNotes" type="button" class="glaze-notes-toggle" aria-controls="glaze-writing-notes" :aria-expanded="drawer === 'notes'" @click="ui.rightPanelOpen=true;toggleDrawer('notes',$event)">批注与资料</button>
    </div>
    <div v-if="original && !ui.focusMode && !ui.readMode" class="ow-modulebar" :inert="owModal || undefined">
      <button v-if="owMode.directory && showDirectory" type="button" aria-controls="glaze-writing-directory" :aria-expanded="owDrawer==='directory'" @click="toggleOriginalPane('directory',$event)">目录与资料</button>
      <div class="ow-module-heading"><h1>{{curTabLabel}}</h1><span>{{work.work?.title}}</span></div>
      <button v-if="owMode.notes && showNotes" type="button" aria-controls="glaze-writing-notes" :aria-expanded="owDrawer==='notes'" @click="toggleOriginalPane('notes',$event)">批注与资料</button>
      <OriginalSaveStatus class="ow-module-save"/>
    </div>
    <div class="wb-body">
      <button v-if="owModal" type="button" class="ow-scrim" aria-label="关闭资料面板" tabindex="-1" @click="closeOriginalPane()"></button>
      <button v-if="modalDrawer" type="button" class="glaze-drawer-scrim" aria-label="关闭侧栏" tabindex="-1" @click="closeDrawer()"></button>
      <div v-if="showDirectory && (dirVisible || original && owMode.directory)" id="glaze-writing-directory" v-show="original && owMode.directory || museum && narrow || work.tab !== 'outline' || ui.outlineSideOpen" class="side-panel" :data-ow-pane="original ? 'directory' : undefined" :class="{ 'glaze-drawer-visible': drawer === 'directory' }" data-glaze-drawer="directory" :role="original && owMode.directory || museum && narrow ? 'dialog' : undefined" :aria-modal="owModal && owDrawer==='directory' || museum && narrow && drawer === 'directory' ? true : undefined" aria-label="目录与资料" :inert="original && owMode.directory && owDrawer!=='directory' || museum && narrow && drawer !== 'directory' || undefined" :style="{ width: ((nsPlugin && narrow) ? Math.min(ui.sideWidth, 168) : ui.sideWidth) + 'px', '--glaze-side-width': ((nsPlugin && narrow) ? Math.min(ui.sideWidth, 168) : ui.sideWidth) + 'px' }">
        <button v-if="original && owMode.directory" type="button" class="ow-pane-close" @click="closeOriginalPane()">关闭目录 ×</button>
        <button v-if="museum" type="button" class="glaze-drawer-close" aria-label="关闭目录与资料" @click="closeDrawer()">关闭 ×</button>
        <GlazeArtwork v-if="museum" compact />
        <ChapterTree v-if="work.tab === 'chapters'" @read="onMore('read')" @window="onSplit('chapter')" @collapse="closeDirectory()" />
        <OutlineSidebar v-else-if="work.tab === 'outline'" />
        <CharacterList v-else-if="work.tab === 'characters'" />
        <MubuTree v-else-if="work.tab === 'lore'" />
        <SnippetList v-else-if="work.tab === 'snippets'" />
      </div>
      <div
        v-if="!ui.focusMode && !ui.readMode && !modulePopped && dirVisible && !(crimson && ['chapters', 'outline', 'lore', 'characters', 'snippets'].includes(work.tab))"
        v-show="work.tab !== 'outline' || ui.outlineSideOpen"
        class="side-resizer"
        title="拖拽调整侧栏宽度（双击恢复默认）"
        @mousedown="startSideResize"
        @dblclick="resetSideWidth"
      ></div>

      <button
        v-if="showDirectory && !dirVisible && work.tab !== 'outline' && !(museum && narrow) && !ui.focusMode && !ui.readMode"
        class="ol-side-rail"
        type="button"
        title="展开目录栏"
        aria-label="展开目录栏"
        aria-controls="glaze-writing-directory"
        :aria-expanded="false"
        @click="toggleDirectory()"
      >
        <OIcon v-if="!latentSkin" name="caret-right" :size="12" />
        <span class="rail-text">{{ work.tab === 'chapters' ? '章节' : '目录' }}</span>
        <!-- 隐现：设计稿细轨只留竖排字 + 章节总数，没有箭头；旧皮肤保持原样 -->
        <span v-if="latentSkin && work.tab === 'chapters'" class="rail-count">{{ work.liveChapters.length }}</span>
      </button>
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
      <div v-show="modulePopped" class="center-pane paper-texture pop-lock-pane">
        <div class="pop-lock-note">
          <div class="big serif">{{ poppedEntityName ? `${curTabLabel}「${poppedEntityName}」已在独立窗口编辑` : `${curTabLabel}已在独立窗口编辑` }}</div>
          <p>主窗口此条目暂时只读——两侧同时写入会互相覆盖。关闭独立面板（或在面板中切换到其他条目）后此处自动恢复编辑。</p>
          <NButton type="primary" @click="focusPopped(work, work.tab, curEntityForTab(work.tab))">前往窗口</NButton>
        </div>
      </div>
      <!-- 正文容器：隐现皮肤下只在正文页出现（四个模块工作区是并列的兄弟，
           同屏显示会让两者争宽度）；旧皮肤保持原样始终渲染。 -->
      <div v-show="!modulePopped && (!latentSkin || work.tab === 'chapters')" class="center-pane paper-texture" :inert="modalDrawer || owModal || undefined">
        <div v-if="work.tab==='chapters'&&story.active&&!ui.agentCandidateId&&!nsPlugin" class="story-workshop-bar"><span>{{story.formalView?'正式正文':'与恍然梦共用的工作稿'}} · {{story.active.status==='confirmed'?'本章已确认':'尚未确认入正文'}}</span><button @click="story.formalView=!story.formalView">{{story.formalView?'回到共同工作稿':'对照正式正文'}}</button><button @click="ui.workbenchMode='agent'">回到故事现场</button></div>
        <div id="writing-story-editor-host" v-show="work.tab==='chapters'&&!ui.agentCandidateId&&story.active&&!story.formalView" class="shared-editor-host story-workshop-editor"></div>
        <div id="writing-editor-host" v-show="work.tab==='chapters'&&!ui.agentCandidateId&&(!story.active||story.formalView)" class="shared-editor-host"></div>
        <CandidateEditor v-if="work.tab==='chapters'&&ui.agentCandidateId" :candidate-id="ui.agentCandidateId" handoff @close="ui.agentCandidateId=null" />
        <!-- 旧皮肤的模块视图留在正文容器内，保持原有布局与行为一字不变 -->
        <template v-if="!latentSkin">
          <OutlineCenter v-if="work.tab === 'outline'" />
          <CharacterCenter v-else-if="work.tab === 'characters'" />
          <template v-else-if="work.tab === 'lore'">
            <MubuView />
          </template>
          <SnippetCenter v-else-if="work.tab === 'snippets'" />
        </template>
      </div>

      <!-- 隐现（dsh）皮肤的四个模块工作区：必须是 .wb-body 的**直接子元素**。
           它们靠 flex:1 + min-height:0 撑满，而 .center-pane 虽是 flex 项却不是
           display:flex 容器——放进里面会塌成 0 高，界面就“存在但看不见”。
           结构与插件版 Workbench 一致：占位 / 工作区 / 正文容器并列。 -->
      <template v-if="latentSkin">
        <LatentOutlineCenter v-if="work.tab === 'outline'" v-show="!modulePopped" class="outline-shell-host" />
        <CharactersWorkspace v-else-if="work.tab === 'characters'" v-show="!modulePopped" class="char-shell-host" />
        <LoreWorkspace v-else-if="work.tab === 'lore'" v-show="!modulePopped" class="lore-shell-host" />
        <SnippetsWorkspace v-else-if="work.tab === 'snippets'" v-show="!modulePopped" class="snippets-shell-host" />
      </template>

      <!-- 批注栏收起后的右缘细轨：点击重新展开（仅正文页显示，与批注栏同条件） -->
      <button
        v-if="!ui.focusMode && !ui.readMode && !modulePopped && work.tab === 'chapters' && !ui.rightPanelOpen && !(original && owMode.notes)"
        class="rp-rail"
        title="展开批注栏"
        @click="ui.setPref('rightPanelOpen', true)"
      >
        <OIcon v-if="!latentSkin" name="caret-right" :size="12" class="rp-rail-caret" />
        <span class="rp-rail-text">{{ latentSkin ? '批注' : '批注栏' }}</span>
      </button>

      <button v-if="narrowNotesOpen" type="button" class="ns-notes-scrim" aria-label="关闭批注栏" tabindex="-1" @click="narrowNotesOpen = false"></button>
      <RightPanel v-if="showNotes && (ui.rightPanelOpen || museum || narrowNotesOpen || original && owMode.notes)" v-show="ui.rightPanelOpen || museum && narrow || narrowNotesOpen || original && owMode.notes" id="glaze-writing-notes" :data-ow-pane="original ? 'notes' : undefined" :original-drawer="original && owMode.notes" @original-close="closeOriginalPane()" :class="{ 'glaze-drawer-visible': drawer === 'notes', 'ns-notes-drawer': narrowNotesOpen }" data-glaze-drawer="notes" :role="original && owMode.notes || museum && narrow ? 'dialog' : undefined" :aria-modal="owModal && owDrawer==='notes' || museum && narrow && drawer === 'notes' ? true : undefined" aria-label="批注与资料" :inert="original && owMode.notes && owDrawer!=='notes' || museum && narrow && drawer !== 'notes' || undefined" @glaze-close="closeDrawer()" />

      <!-- 窄栏批注抽屉的关闭键：不能进 RightPanel（那里只加条件类名不改结构），锚在抽屉右上角 -->
      <button v-if="narrowNotesOpen" type="button" class="ns-notes-close" aria-label="关闭批注栏" title="关闭批注栏" @click="narrowNotesOpen = false">×</button>

      <InspirationPrompt v-if="ui.skin === 'gravity' && work.tab === 'snippets' && (!ui.aiDrawerOpen || aiPopped) && !modulePopped && !ui.focusMode && !ui.readMode" />

      <!-- 非模态覆盖层：开合与拖宽不参与正文排版；隐藏时保留输入与生成状态。 -->
      <aside v-if="aiMounted && !nsPlugin" v-show="aiVisible" class="ai-dock" :data-agent-skin="ui.skin" aria-label="恍然梦-浅眠" :style="{ width: 'min(' + ui.aiDrawerWidth + 'px, 100%)' }">
        <div class="ai-dock-resizer" title="拖拽调整恍然梦宽度（双击恢复默认）" @mousedown="startAiResize" @dblclick="resetAiWidth"></div>
        <div class="ai-drawer-head">
          <span class="ai-drawer-name serif">恍然梦-浅眠</span>
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
.shared-editor-host{display:flex;flex:1;min-height:0;min-width:0;flex-direction:column}
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

<!-- 隐现皮肤的正文样式（伏案静水）：挂在组件上而不是全局 index.js，
     组件级样式构建后排在全局样式之后，才压得住 themes.css 的实底与边框。
     全部规则以 .latent-studio 或 body[data-skin='dsh'] 为作用域，旧皮肤不受影响。 -->
<style src="../styles/skins/latent/latent-studio.css"></style>
