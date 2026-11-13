<script setup>
import { ref } from 'vue'
import { useUiStore } from '../../../../stores/ui'
import { desktopAppIcon } from '../../../../services/desktop-brand.js'
import { APP_VERSION } from './settings-version.js'
import SettingsHelpDialog from './dialogs/SettingsHelpDialog.vue'
import SettingsStatsDialog from './dialogs/SettingsStatsDialog.vue'

const nsPlugin = __NS_PLUGIN__
const ui = useUiStore()
const active = ref(null)

const SHORTCUTS = nsPlugin ? [
  { label: '在控件间移动', keys: 'Tab' },
  { label: '返回上一个控件', keys: 'Shift + Tab' },
  { label: '关闭弹窗或分类', keys: 'Esc' },
  { label: '微调选中的字号滑块', keys: '← / →' },
  { label: '立即保存当前偏好', keys: 'Ctrl / ⌘ + S' }
] : [
  { label: '作品内搜索正文与资料', keys: 'Ctrl + Shift + F' },
  { label: '大纲画布搜索节点', keys: 'Ctrl + K' },
  { label: '设置页立即保存偏好', keys: 'Ctrl + S' },
  { label: '设置页切换控件', keys: 'Tab / Shift + Tab' },
  { label: '关闭手册、弹窗或设置', keys: 'Esc' }
]

function openHelp() {
  if (nsPlugin) active.value = 'help'
  else ui.helpOpen = true
}
</script>

<template>
  <div class="about-layout">
    <div>
      <section data-setting="version">
        <div class="about-brand">
          <span v-if="nsPlugin" class="about-mark" aria-hidden="true">工</span>
          <img v-else class="about-app-icon" :src="desktopAppIcon" width="72" height="72" alt="" />
          <div>
            <h2>{{ nsPlugin ? '小说工坊' : '小说工坊桌面版' }}</h2>
            <p>{{ nsPlugin ? 'DSH 插件版 · ' : '' }}v{{ APP_VERSION }}</p>
          </div>
        </div>
        <p class="about-intro">面向长篇创作的本地写作空间。<br />让正文、大纲、设定与人物在同一部作品中相连。</p>
      </section>

      <section class="action-group">
        <div class="action-row" data-setting="help">
          <svg class="icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 4h6a4 4 0 0 1 3 2 4 4 0 0 1 3-2h6v16h-6a4 4 0 0 0-3 2 4 4 0 0 0-3-2H3zM12 6v16" /></svg>
          <div>
            <strong>帮助与快捷键</strong>
            <p>{{ nsPlugin ? '从常用操作开始，让工坊更顺手' : '查看桌面版功能、数据备份和完整键位说明' }}</p>
          </div>
          <button type="button" class="btn" data-act="help" aria-label="打开手册" @click="openHelp"><span>打开手册</span></button>
        </div>
        <div class="action-row" data-setting="stats">
          <svg class="icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="3" /><path d="M8 8h8M8 12h8M8 16h5" /></svg>
          <div>
            <strong>写作概览</strong>
            <p>查看当前作品、章节与正文规模</p>
          </div>
          <button type="button" class="btn" data-act="stats" aria-label="写作概览" @click="active = 'stats'"><span>查看</span></button>
        </div>
      </section>

      <p class="about-summary">更换设备前，可在「备份与数据」中生成一份完整快照。</p>
    </div>

    <aside class="keyboard-panel">
      <h3>手边的快捷键</h3>
      <div v-for="item in SHORTCUTS" :key="item.keys" class="shortcut">
        <span>{{ item.label }}</span>
        <kbd>{{ item.keys }}</kbd>
      </div>
      <p class="section-note">设置改动会自动保存；遇到保存失败时，也可手动重试。</p>
    </aside>

    <SettingsHelpDialog v-if="active === 'help'" @close="active = null" />
    <SettingsStatsDialog v-if="active === 'stats'" @close="active = null" />
  </div>
</template>

<style scoped>
.about-app-icon { width: 72px; height: 72px; flex: none; object-fit: contain; }
@media (max-width: 600px) {
  .about-app-icon { width: 54px; height: 54px; }
}
</style>
