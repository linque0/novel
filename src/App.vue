<!-- 应用根壳层：按运行模式分发主工作台（书架/创作区）与独立面板窗口（PanelHost / 写作分析），
     统一装配 Naive UI 主题覆盖、全局弹窗、自动更新安装屏障（__updateSaveBarrier）及液态转场层。 -->
<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { NConfigProvider, NMessageProvider, NDialogProvider, NButton, zhCN, dateZhCN, darkTheme } from 'naive-ui'
import AppUpdateControls from './components/AppUpdateControls.vue'
import { useDshOverrides } from '../plugin/dsh/theme.js'
import { useUiStore } from './stores/ui'
import { startAutosave } from './services/autosave'
import { installLibrarySync } from './services/library-sync'
import { openDbWithRetry } from './db/database'
import Bookshelf from './components/Bookshelf.vue'
import StudioWorkspace from './components/StudioWorkspace.vue'
import GlobalSearch from './components/GlobalSearch.vue'
import ImportDialog from './components/ImportDialog.vue'
import ExportDialog from './components/ExportDialog.vue'
import HelpManual from './components/HelpManual.vue'
import RevisionsModal from './components/RevisionsModal.vue'
import TrashModal from './components/TrashModal.vue'
import StatsModal from './components/StatsModal.vue'
/* 隐现皮肤专用写作统计对话框（速览 + 完整分析），与 StatsModal 二选一挂载 */
import WritingStatsDialog from './components/skins/latent/stats/WritingStatsDialog.vue'
import MubuTagPanel from './components/MubuTagPanel.vue'
import LoreRelationPanel from './components/LoreRelationPanel.vue'
import LoreDetail from './components/LoreDetail.vue'
import PrefBridge from './components/PrefBridge.vue'
import PanelHost from './components/PanelHost.vue'
import FlowTransitionOverlay from './components/skins/latent/FlowTransitionOverlay.vue'
import { flowTransition } from './services/latent/flow-transition.js'
import { cancelMemoryJobs } from './services/ai/memory-queue.js'
import { installAppBus } from './services/appbus'
import { useShelfStore } from './stores/shelf'
import { installAiRuntime } from './services/ai/runtime'
import { useAiStore } from './stores/ai'
import { resolveSkin, isLatentSkin } from './skins/registry'
import { useLatentTheme } from './skins/theme-latent.js'
import { useGlazeMuseum } from './composables/useGlazeMuseum'
import './styles/skins/gravity.css'
import './styles/skins/gravity-workbench.css'
import './styles/skins/glaze.css'
import './styles/skins/crimson.css'
import './styles/skins/crimson-workbench.css'
import './styles/skins/crimson-v3.css'
import './styles/skins/glaze-museum.css'
import './styles/skins/glaze-museum-workbench.css'
import './styles/original-workspace.css'
import './styles/original-records.css'
import './styles/original-dialogs.css'

const ui = useUiStore()
const flowScene = ref(null)
const { museumActive } = useGlazeMuseum()
const shelf = useShelfStore()

/* 跨窗口事件（偏好同步 / 书架刷新 / 恢复备份协议）：主窗口与面板窗口都在根组件装一次 */
installAppBus()

/* 功能面板窗口（9.2-W5）：URL 带 ?panel=<type>:<workId>:<entityId> 时渲染精简面板布局 */
const panelSpec = new URLSearchParams(location.search).get('panel')?.split(':')
const panelMode = !!panelSpec
const analysisPanel = panelSpec?.[0] === 'writing-analysis'
const waitsForPanel = analysisPanel || panelSpec?.[0] === 'settings'
const prefsReady = ref(false)

/* 设置页在主窗里是 ui.view='settings'，但注册表只认 shelf/work/panel 三种 surface；
 * 直接传 'settings' 会回落 original，导致设置窗丢掉当前皮肤的样式。
 * 设置是主窗内的一屏，按 work surface 处理（与插件版同样的映射）。 */
const surfaceOf = (view) => (view === 'settings' ? 'work' : view)
const activeSkin = computed(() => resolveSkin(ui.skin, panelMode ? 'panel' : surfaceOf(ui.view)))
/* 隐现（dsh）皮肤：主题与覆盖色统一由 theme-latent.js 提供，明暗跟着 ui.theme 走 */
const latentTheme = useLatentTheme(ui)
const latent = computed(() => isLatentSkin(ui.skin))
const naiveTheme = computed(() => {
  if (latent.value) return latentTheme.value.dark ? darkTheme : null
  return activeSkin.value.id === 'glaze' ? null : (activeSkin.value.id === 'gravity' || activeSkin.value.id === 'crimson' || ui.theme === 'night' ? darkTheme : null)
})
const overrides = computed(() => {
  /* 隐现皮肤优先：它的覆盖表与自身的 CSS 令牌同源 */
  if (latent.value) return latentTheme.value.overrides
  if (museumActive.value) return {
    common: { primaryColor:'#536b4d', primaryColorHover:'#657c5b', primaryColorPressed:'#3d5339', primaryColorSuppl:'#536b4d', textColor1:'#344f42', textColor2:'#4b604b', textColor3:'#69745e', bodyColor:'#dce4d2', cardColor:'#faf7ed', modalColor:'#faf7ed', popoverColor:'#faf7ed', inputColor:'#f7f4e8', borderColor:'#b7b99c', borderRadius:'2px' },
    Tree: { nodeColorActive:'#e8ebda', nodeColorHover:'#eef0e2', nodeColorPressed:'#dce4d2' }
  }
  if (activeSkin.value.id === 'glaze') return {
    common: { primaryColor:'#146878', primaryColorHover:'#247b89', primaryColorPressed:'#0e5361', primaryColorSuppl:'#146878', textColor1:'#234752', textColor2:'#315763', textColor3:'#4f7079', bodyColor:'#e7eff1', cardColor:'#f8fcfc', modalColor:'#f8fcfc', popoverColor:'#f4fafb', inputColor:'#f5fafb', borderColor:'#adcbd0', borderRadius:'8px' },
    Tree: { nodeColorActive:'#cde3e6',nodeColorHover:'#e3eff1',nodeColorPressed:'#d2e6e9' }
  }
  if (activeSkin.value.id === 'crimson') return {
    common: {
      primaryColor:'#cfb06b', primaryColorHover:'#e0c684', primaryColorPressed:'#b5924f', primaryColorSuppl:'#cfb06b',
      textColor1:'#f0e7d5', textColor2:'#e4dcc6', textColor3:'#bfb59c',
      bodyColor:'#171c1b', cardColor:'#1f2724', modalColor:'#1f2724', popoverColor:'#232b27',
      borderColor:'#4a5348', inputColor:'#1a211e', borderRadius:'4px'
    },
    Tree: { nodeColorActive:'#33413a', nodeColorHover:'#2a352f', nodeColorPressed:'#33413a' }
  }
  if (activeSkin.value.id === 'gravity') {
    return { common: {
      primaryColor: '#f29c62', primaryColorHover: '#ffb784', primaryColorPressed: '#dc874f', primaryColorSuppl: '#f29c62',
      textColor1: '#e3eceb', textColor2: '#d7e0e5', textColor3: '#9aadb9',
      bodyColor: '#0b131d', cardColor: '#14212c', modalColor: '#14212c', popoverColor: '#1a2b37',
      borderColor: '#344654', inputColor: '#101c27'
    }, Tree: { nodeColorActive: '#243340', nodeColorHover: '#1b2b37', nodeColorPressed: '#243340' } }
  }
  const accent = { xuan: '#8c6f4e', parchment: '#a0642f', night: '#d4a95c' }[ui.theme] || '#8c6f4e'
  return { common: { primaryColor: accent, primaryColorHover: accent, primaryColorPressed: accent, primaryColorSuppl: accent } }
})
/* M1-C2：插件构建下 naive 主题跟 iframe 根上的 data-ns-dark 走（预览窗口与宿主同亮暗）；
 * 桌面版 __NS_PLUGIN__ 为 false，两个表达式原样落回 naiveTheme / overrides。 */
const nsPlugin = __NS_PLUGIN__
const dshThemeState = nsPlugin ? useDshOverrides() : null
const dshNaiveTheme = computed(() => (dshThemeState && dshThemeState.value.dark ? darkTheme : null))
const dshOverrides = computed(() => (dshThemeState ? dshThemeState.value.overrides : {}))

watch(activeSkin, skin => { document.body.dataset.skin = skin.id }, { immediate: true })

/* Body also supplies the effective appearance to teleported dialogs. */
watch([latent, () => ui.theme, dshNaiveTheme], ([enabled, theme, hostDark]) => {
  if (!enabled) {
    delete document.body.dataset.nsPanelTheme
    delete document.body.dataset.nsPanelSource
    return
  }
  document.body.dataset.nsPanelTheme = (nsPlugin ? Boolean(hostDark) : theme === 'night') ? 'dark' : 'light'
  document.body.dataset.nsPanelSource = nsPlugin ? 'host' : 'local'
}, { immediate: true })

watch(() => ui.pageTransitions, (enabled) => {
  flowTransition.setEnabled(enabled !== false)
}, { immediate: true })

/* 实验性功能关闭时实时收口：退回写作视图、收起浅眠侧栏、取消流式请求与后台记忆/知识库任务，本地配置完整保留。 */
watch(() => ui.experimentalAiEnabled, (enabled) => {
  if (enabled) return
  if (ui.workbenchMode === 'agent') ui.workbenchMode = 'writing'
  ui.aiDrawerOpen = false
  ui.dreamLauncherOpen = false
  ui.agentCandidateId = null
  cancelMemoryJobs()
  const ai = useAiStore()
  ai.cancel()
  ai.pauseKnowledge()
})

/* 主题类镜像到 body：naive 的 popover/modal 等浮层 teleport 到 body 下，
   继承不到 .app-root 上的主题变量——var(--bg-panel) 等会整条声明失效
   （设置面板变全透明、帮助手册回落默认白板的根因）。body 挂同类即可继承。 */
watch(
  () => ui.theme,
  (t) => {
    document.body.classList.remove('theme-xuan', 'theme-parchment', 'theme-night')
    document.body.classList.add('theme-' + t)
  },
  { immediate: true }
)

async function revealPanel() {
  if (!waitsForPanel) return
  // Let the themed layout commit before showing the native window.
  await nextTick()
  requestAnimationFrame(() => requestAnimationFrame(() => window.native?.panelReady?.()))
}

let restoreEditing
if (window.native?.updates) {
  window.__updateSaveBarrier = async action => {
    if (action === 'resume') {
      restoreEditing?.()
      restoreEditing = undefined
      return true
    }
    if (action !== 'prepare' || !prefsReady.value || !window.__flushNow) return false
    if (!restoreEditing) {
      const previous = document.body.inert
      document.body.inert = true
      restoreEditing = () => { document.body.inert = previous }
    }
    await window.__flushNow()
    const preferencesSaved = await ui.retryPrefs()
    return preferencesSaved && !ui.autosave.pending && !ui.autosave.saving && !ui.autosave.error
  }
}

async function boot() {
  ui.dbError = false
  const ok = await openDbWithRetry()
  if (!ok) {
    ui.dbError = true
    revealPanel()
    return
  }
  // Appearance is required for the first panel frame; AI configuration is not.
  await ui.loadPrefs()
  prefsReady.value = true
  revealPanel()
  startAutosave()
  /* 作品库同步（M3）：主进程有通道才启用；hydrate 失败不影响本地可用 */
  try {
    await installLibrarySync()
  } catch (error) {
    console.warn('[library] 同步层未启用', error)
  }
  installAiRuntime()
  await useAiStore().loadSettings()
  if (panelMode) return
  await seedDevVerifyBooks()
  await shelf.refresh()
}
onMounted(boot)

/* 开发调试版专属：npm run dev 启动时把全部验证书种入书架（tools/verify-seeds.mjs 注册表）。
 * 仅 DEV 生效且只补种缺失的；正式版（app://，DEV=false）不会加载，绝不写入测试数据。 */
async function seedDevVerifyBooks() {
  if (!import.meta.env.DEV) return
  try {
    const { seedVerifyBooks } = await import('./dev/verifyBooks.js')
    const r = await seedVerifyBooks()
    const made = (r.books || []).filter((b) => b.created)
    if (made.length) console.info('[dev] 已种入验证书 ' + made.length + ' 本：' + made.map((b) => b.title).join('、'))
  } catch (e) {
    console.warn('[dev] 验证书种入失败（不影响正常使用，可执行 node tools/seed-verify.mjs 重试）', e)
  }
}
</script>

<template>
  <NConfigProvider :theme="nsPlugin ? dshNaiveTheme : naiveTheme" :theme-overrides="nsPlugin ? dshOverrides : overrides" :locale="zhCN" :date-locale="dateZhCN">
    <NMessageProvider>
      <NDialogProvider>
        <PrefBridge />
        <AppUpdateControls v-if="!nsPlugin && !panelMode && prefsReady" startup />
        <PanelHost v-if="panelMode && !analysisPanel && prefsReady" />
        <div v-else-if="!panelMode || ui.dbError" ref="flowScene" class="app-root" :class="'theme-' + ui.theme" :data-skin="activeSkin.id" :style="ui.rootStyle" :inert="ui.statsAnalysisOpen">
          <div v-if="ui.dbError" class="empty-shelf" style="padding-top: 16vh">
            <div class="big">数据的另一扇门被占用了</div>
            <p>
              本地数据库暂时无法打开——很可能是另一个「小说工坊」窗口正在运行。<br />
              你的全部数据都安全地保存在本地，不会被覆盖。关闭其他窗口后重试即可。
            </p>
            <NButton type="primary" @click="boot">重试</NButton>
          </div>
          <template v-else>
            <Bookshelf v-if="ui.view === 'shelf'" />
            <StudioWorkspace v-else />
            <GlobalSearch />
            <ImportDialog />
            <ExportDialog />
            <HelpManual />
            <RevisionsModal />
            <TrashModal />
            <StatsModal v-if="!latent" />
            <MubuTagPanel />
            <LoreRelationPanel />
            <LoreDetail />
          </template>
        </div>
        <WritingStatsDialog
          v-if="analysisPanel ? prefsReady : latent && !panelMode"
          :panel-entry="analysisPanel ? panelSpec[2] || '' : null"
        />
        <FlowTransitionOverlay v-if="latent && !panelMode && ui.pageTransitions" :scene="flowScene" />
      </NDialogProvider>
    </NMessageProvider>
  </NConfigProvider>
</template>
