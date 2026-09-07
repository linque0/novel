<script setup>
import { computed, onMounted } from 'vue'
import { NConfigProvider, NMessageProvider, NDialogProvider, NButton, zhCN, dateZhCN, darkTheme } from 'naive-ui'
import { useUiStore } from './stores/ui'
import { startAutosave } from './services/autosave'
import { openDbWithRetry } from './db/database'
import Bookshelf from './components/Bookshelf.vue'
import Workbench from './components/Workbench.vue'
import GlobalSearch from './components/GlobalSearch.vue'
import ImportDialog from './components/ImportDialog.vue'
import ExportDialog from './components/ExportDialog.vue'
import HelpManual from './components/HelpManual.vue'
import RevisionsModal from './components/RevisionsModal.vue'
import TrashModal from './components/TrashModal.vue'
import StatsModal from './components/StatsModal.vue'
import PrefBridge from './components/PrefBridge.vue'
import PanelHost from './components/PanelHost.vue'
import { useShelfStore } from './stores/shelf'

const ui = useUiStore()
const shelf = useShelfStore()

/* 功能面板窗口（9.2-W5）：URL 带 ?panel=<type>:<workId>:<entityId> 时渲染精简面板布局 */
const panelMode = new URLSearchParams(location.search).has('panel')

const naiveTheme = computed(() => (ui.theme === 'night' ? darkTheme : null))
const overrides = computed(() => {
  const accent = { xuan: '#8c6f4e', parchment: '#a0642f', night: '#d4a95c' }[ui.theme] || '#8c6f4e'
  return { common: { primaryColor: accent, primaryColorHover: accent, primaryColorPressed: accent, primaryColorSuppl: accent } }
})

async function boot() {
  ui.dbError = false
  const ok = await openDbWithRetry()
  if (!ok) {
    ui.dbError = true
    return
  }
  startAutosave()
  await ui.loadPrefs()
  if (panelMode) return
  await shelf.refresh()
}
onMounted(boot)
</script>

<template>
  <NConfigProvider :theme="naiveTheme" :theme-overrides="overrides" :locale="zhCN" :date-locale="dateZhCN">
    <NMessageProvider>
      <NDialogProvider>
        <PrefBridge />
        <PanelHost v-if="panelMode" />
        <div v-else class="app-root" :class="'theme-' + ui.theme" :style="ui.rootStyle">
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
            <Workbench v-else />
            <GlobalSearch />
            <ImportDialog />
            <ExportDialog />
            <HelpManual />
            <RevisionsModal />
            <TrashModal />
            <StatsModal />
          </template>
        </div>
      </NDialogProvider>
    </NMessageProvider>
  </NConfigProvider>
</template>
