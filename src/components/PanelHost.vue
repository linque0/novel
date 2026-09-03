<script setup>
/* 功能面板窗口宿主（9.2-W5）：面板窗口加载同一应用，按 ?panel=<type>:<workId>:<entityId>
 * 打开对应作品并选中实体，复用既有功能组件（零改动），顶部迷你工具条 + 锁事件监听。
 * 写互斥由主进程锁表保证：同作品同实体全应用仅一个可写面板。 */
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { NButton } from 'naive-ui'
import { useWorkStore } from '../stores/work'
import { useUiStore } from '../stores/ui'
import { autosave, startAutosave } from '../services/autosave'
import EditorPane from './EditorPane.vue'
import OutlineCanvas from './OutlineCanvas.vue'
import CharacterCenter from './CharacterCenter.vue'
import MubuView from './MubuView.vue'
import SnippetCenter from './SnippetCenter.vue'

const work = useWorkStore()
const ui = useUiStore()

const spec = ref(null) // { type, workId, entityId }
const status = ref('loading') // loading | ready | error
const errMsg = ref('')
const lockHeldElsewhere = ref(false)

const PANEL_TITLES = { chapter: '正文', outline: '大纲', characters: '人物', lore: '设定', snippets: '灵感' }
const panelTitle = computed(() => {
  const t = spec.value?.type
  let name = ''
  if (t === 'chapter') name = work.activeChapter?.title || ''
  else if (t === 'characters') name = work.activeCharacter?.name || ''
  else if (t === 'snippets') name = work.activeSnippet?.title || ''
  return `${PANEL_TITLES[t] || '面板'}${name ? ' · ' + name : ''}`
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

function parseSpec() {
  const raw = new URLSearchParams(location.search).get('panel')
  if (!raw) return null
  const [type = '', workId = '', entityId = ''] = raw.split(':')
  if (!type || !workId) return null
  return { type, workId, entityId }
}

async function boot() {
  const s = parseSpec()
  if (!s) {
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
  // 选中面板对应的实体（复用既有选中链路）
  if (s.type === 'chapter') {
    work.tab = 'chapters'
    work.selChapterId = s.entityId || work.liveChapters[0]?.id || null
  } else if (s.type === 'outline') {
    work.tab = 'outline'
    work.outlineView = 'canvas'
    if (s.entityId) work.selOlnodeId = s.entityId
  } else if (s.type === 'characters') {
    work.tab = 'characters'
    work.charView = 'list'
    work.selCharacterId = s.entityId || work.liveCharacters[0]?.id || null
  } else if (s.type === 'lore') {
    work.tab = 'lore'
    if (s.entityId) ui.mubuSelectedId = s.entityId
  } else if (s.type === 'snippets') {
    work.tab = 'snippets'
    work.selSnippetId = s.entityId || work.liveSnippets[0]?.id || null
  }
  status.value = 'ready'
  document.title = `小说工坊 · ${panelTitle.value}`
}

let offLockEvent = null
function onLockEvent(ev) {
  if (!spec.value) return
  const myKey = `${spec.value.workId}:${spec.value.type}:${spec.value.entityId || ''}`
  if (ev.key !== myKey) return
  if (ev.kind === 'opened') lockHeldElsewhere.value = false
  if (ev.kind === 'closed') lockHeldElsewhere.value = true
}

onMounted(() => {
  startAutosave()
  boot()
  if (window.native?.panelOnEvent) offLockEvent = window.native.panelOnEvent(onLockEvent)
})
onBeforeUnmount(() => offLockEvent?.())
</script>

<template>
  <div class="app-root theme-xuan" style="height: 100vh; display: flex; flex-direction: column">
    <div v-if="status === 'error'" class="empty-shelf" style="padding-top: 18vh">
      <div class="big">面板无法打开</div>
      <p>{{ errMsg }}</p>
      <NButton type="primary" @click="closePanel">关闭面板</NButton>
    </div>
    <template v-else-if="status === 'ready'">
      <div class="panel-topbar">
        <span class="serif" style="font-weight: 700">{{ panelTitle }}</span>
        <span class="save-badge">
          <span class="save-dot" :class="badgeClass"></span>
          {{ badgeText }}
        </span>
        <div style="flex: 1"></div>
        <NButton size="small" @click="flushAndClose">保存并关闭</NButton>
        <NButton size="small" quaternary @click="closePanel">✕</NButton>
      </div>
      <div class="panel-body paper-texture">
        <EditorPane v-if="spec.type === 'chapter'" />
        <OutlineCanvas v-else-if="spec.type === 'outline'" style="flex: 1; min-height: 0" />
        <CharacterCenter v-else-if="spec.type === 'characters'" />
        <MubuView v-else-if="spec.type === 'lore'" />
        <SnippetCenter v-else-if="spec.type === 'snippets'" />
      </div>
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
  flex-direction: column;
}
</style>
