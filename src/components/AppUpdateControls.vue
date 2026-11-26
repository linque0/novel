<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { NButton, NModal, NProgress } from 'naive-ui'
import { DESKTOP_REPOSITORY, openUpdateLink, updateAction, useDesktopUpdates } from '../services/desktop-updates.js'

const props = defineProps({ startup: Boolean })
const state = useDesktopUpdates()
const showResult = ref(false)
const release = computed(() => state.value?.release)
const status = computed(() => state.value?.status)
const labels = {
  idle: '可手动检查正式版本',
  unavailable: '可在 GitHub 发布页查看桌面版更新',
  checking: '正在检查更新…',
  current: '当前已是最新版本',
  available: '发现新版本',
  downloading: '正在下载更新…',
  ready: '更新已下载',
  installing: '正在保存并准备重启…',
  'check-error': '检查更新失败',
  'download-error': '下载更新失败'
}
const busy = computed(() => ['checking', 'downloading', 'installing'].includes(status.value))
const show = computed(() => props.startup && (state.value?.prompt || showResult.value && status.value !== 'installing'))

onMounted(() => { if (props.startup) updateAction('check', true) })
watch(status, value => {
  if (props.startup && value === 'ready') showResult.value = true
})

function dismiss() {
  showResult.value = false
  updateAction('dismiss')
}
function startDownload() {
  showResult.value = true
  updateAction('download')
}
</script>

<template>
  <NModal v-if="startup && release" :show="show" preset="card" :title="status === 'ready' ? '更新已下载' : '空想书典有新版本'"
    class="app-update-modal" :mask-closable="false" @update:show="value => { if (!value) dismiss() }">
    <p class="app-update-versions">v{{ state.current }} → <strong>v{{ release.version }}</strong></p>
    <p v-if="state.error" class="app-update-error" role="alert">{{ state.error }}</p>
    <NProgress v-if="status === 'downloading'" type="line" :percentage="state.progress" aria-label="下载进度" />
    <div v-if="release.notes" class="app-update-notes" tabindex="0" aria-label="更新内容概要">{{ release.notes }}</div>
    <p v-else>此版本的说明可在 GitHub 发布页查看。</p>
    <a :href="release.url" target="_blank" rel="noopener noreferrer" @click="openUpdateLink($event, 'release')">查看完整说明</a>
    <template #footer>
      <div class="app-update-actions">
        <NButton @click="dismiss">稍后</NButton>
        <NButton v-if="status === 'ready'" type="primary" @click="updateAction('install')">重启并安装</NButton>
        <NButton v-else-if="release.installable" type="primary" :disabled="busy" @click="startDownload">
          {{ status === 'download-error' ? '重新下载' : status === 'downloading' ? '下载中…' : '更新' }}
        </NButton>
        <NButton v-else type="primary" @click="updateAction('open', 'release')">前往发布页</NButton>
      </div>
    </template>
  </NModal>
  <section v-else-if="!startup" class="app-update-about" aria-label="项目与软件更新">
    <a class="project-repository" :href="DESKTOP_REPOSITORY" target="_blank" rel="noopener noreferrer" @click="openUpdateLink($event, 'repository')">
      <span><strong>项目仓库</strong><small>github.com/linque0/novel</small></span>
      <span class="repo-mark" aria-hidden="true">↗</span>
    </a>
    <template v-if="state">
      <div class="update-heading">
        <span class="update-symbol" aria-hidden="true">↻</span>
        <div><strong>软件更新</strong><p role="status">{{ labels[status] }}<template v-if="release"> v{{ release.version }}</template></p></div>
      </div>
      <NProgress v-if="status === 'downloading'" type="line" :percentage="state.progress" />
      <p v-if="state.error" class="app-update-error" role="alert">{{ state.error }}</p>
      <details v-if="release?.notes" class="app-update-details">
        <summary>更新内容概要</summary>
        <div class="app-update-notes" tabindex="0">{{ release.notes }}</div>
      </details>
      <div class="app-update-actions">
        <NButton v-if="status !== 'unavailable' && status !== 'ready'" size="small" :disabled="busy" @click="updateAction('check')">
          {{ status === 'check-error' ? '重新检查' : '检查更新' }}
        </NButton>
        <NButton v-if="release?.installable && ['available', 'download-error'].includes(status)" size="small" type="primary" @click="updateAction('download')">
          {{ status === 'download-error' ? '重新下载' : '更新' }}
        </NButton>
        <NButton v-if="status === 'ready'" size="small" type="primary" @click="updateAction('install')">重启并安装</NButton>
        <NButton v-if="release || status === 'unavailable'" size="small" @click="updateAction('open', 'release')">查看发布页</NButton>
      </div>
    </template>
  </section>
</template>

<style scoped>
.app-update-modal { width: min(560px, calc(100vw - 32px)); }
.app-update-about { display: grid; gap: 8px; padding: 14px 0; overflow-wrap: anywhere; }
.app-update-about > p, .app-update-versions { margin: 0; }
.app-update-modal a { color: #a9d9ff; text-underline-offset: .22em; }
.app-update-about .project-repository { display: flex; align-items: center; gap: 10px; padding: 11px 13px; border: 1px solid #a0cfff35; border-radius: 10px; background: rgb(13 25 44 / .40); color: #a9d9ff; text-decoration: none; overflow-wrap: anywhere; }
.app-update-about .project-repository:hover { border-color: #a9d9ff90; background: rgb(13 25 44 / .62); }
.app-update-about .project-repository strong, .project-repository small { display: block; }
.app-update-about .project-repository small { font-size: 11px; line-height: 1.4; }
.app-update-about .project-repository .repo-mark { margin-left: auto; flex: none; }
.update-heading { display: flex; align-items: center; gap: 10px; padding-top: 6px; }
.update-heading p { margin: 1px 0 0; font-size: 12px; color: var(--set-muted, currentColor); }
.update-symbol { display: grid; place-items: center; width: 32px; height: 32px; flex: none; border: 1px solid var(--set-line, #ffffff30); border-radius: 8px; color: #a9d9ff; font-size: 17px; }
.app-update-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.app-update-modal .app-update-actions { justify-content: flex-end; }
.app-update-notes {
  max-height: min(32vh, 260px);
  padding: 10px 12px;
  margin: 12px 0;
  overflow: auto;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  border: 1px solid var(--border, rgb(128 128 128 / .3));
  border-radius: 8px;
}
.app-update-details summary { cursor: pointer; }
.app-update-error { color: var(--ns-danger, var(--text, currentColor)); }
</style>
