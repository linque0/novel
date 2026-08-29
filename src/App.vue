<script setup>
import { computed, onMounted } from 'vue'
import { NConfigProvider, NMessageProvider, NDialogProvider, zhCN, dateZhCN, darkTheme } from 'naive-ui'
import { useUiStore } from './stores/ui'
import { startAutosave } from './services/autosave'
import Bookshelf from './components/Bookshelf.vue'
import Workbench from './components/Workbench.vue'
import GlobalSearch from './components/GlobalSearch.vue'
import ImportDialog from './components/ImportDialog.vue'
import RevisionsModal from './components/RevisionsModal.vue'
import TrashModal from './components/TrashModal.vue'
import StatsModal from './components/StatsModal.vue'
import PrefBridge from './components/PrefBridge.vue'
import { useShelfStore } from './stores/shelf'

const ui = useUiStore()
const shelf = useShelfStore()

const naiveTheme = computed(() => (ui.theme === 'night' ? darkTheme : null))
const overrides = computed(() => {
  const accent = { xuan: '#8c6f4e', parchment: '#a0642f', night: '#d4a95c' }[ui.theme] || '#8c6f4e'
  return { common: { primaryColor: accent, primaryColorHover: accent, primaryColorPressed: accent, primaryColorSuppl: accent } }
})

onMounted(async () => {
  startAutosave()
  await ui.loadPrefs()
  await shelf.refresh()
})
</script>

<template>
  <NConfigProvider :theme="naiveTheme" :theme-overrides="overrides" :locale="zhCN" :date-locale="dateZhCN">
    <NMessageProvider>
      <NDialogProvider>
        <PrefBridge />
        <div class="app-root" :class="'theme-' + ui.theme" :style="ui.rootStyle">
          <Bookshelf v-if="ui.view === 'shelf'" />
          <Workbench v-else />
          <GlobalSearch />
          <ImportDialog />
          <RevisionsModal />
          <TrashModal />
          <StatsModal />
        </div>
      </NDialogProvider>
    </NMessageProvider>
  </NConfigProvider>
</template>
