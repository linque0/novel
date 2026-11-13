<script setup>
import { computed, nextTick, ref, useSlots, watch } from 'vue'
import { NDropdown } from 'naive-ui'
import AutoHideTopbar from './AutoHideTopbar.vue'
import { useUiStore } from '../stores/ui'
import { useWorkStore } from '../stores/work'
import { popOut } from '../services/panelwindows'
import { SKINS, isLatentSkin } from '../skins/registry'
import { APP_NAVIGATION, WORK_NAVIGATION } from './app-navigation'
import { desktopSmallIcon } from '../services/desktop-brand.js'
import DreamModeEntries from './agent/DreamModeEntries.vue'
/* 隐现皮肤顶栏右簇的统计圆钮（与插件版同一个组件） */
import WritingStatsEntry from './skins/latent/stats/WritingStatsEntry.vue'

const props = defineProps({
  active: { type: String, default: 'shelf' },
  busy: Boolean,
  hasWork: Boolean,
  targetTitle: { type: String, default: '' },
  targetWorkId: { type: String, default: '' },
  actions: { type: Array, default: () => [] },
  /* 窄栏保存态（<560）：顶栏动作整条隐藏后，只剩这个非交互状态点告诉作者存没存 */
  saveState: { type: String, default: 'saved' }
})
const emit = defineEmits(['navigate', 'create', 'action'])
const ui = useUiStore()
const work = useWorkStore()
const nsPlugin = __NS_PLUGIN__
const skinLabel = computed(() => SKINS.find(skin => skin.id === ui.skin)?.label || '原版工坊')
const latent = computed(() => isLatentSkin(ui.skin))
/* 品牌小字：隐现照插件版显示固定字标 LATENT（皮肤名退场），四套旧皮肤仍显示皮肤名 */
const brandSuffix = computed(() => (isLatentSkin(ui.skin) ? 'LATENT' : skinLabel.value))
const navItems = computed(() => (latent.value
  ? APP_NAVIGATION.filter(item => item.key !== 'settings')
  : APP_NAVIGATION))
/* 顶栏锁定键：锁定＝常驻；解锁＝自动隐藏，鼠标移到顶部再展开 */
const pinLabel = computed(() => (ui.topbarAutoHide ? '锁定顶栏（始终显示）' : '解除顶栏锁定（自动隐藏）'))
function togglePin() { ui.setPref('topbarAutoHide', !ui.topbarAutoHide) }
/* 搜索圆钮：有搜索槽位（书架）时展开槽位输入框，没有槽位时打开全局搜索浮层 */
const searchOpen = ref(false)
const slots = useSlots()
function toggleSearch() {
  if (!slots.search) { ui.searchOpen = true; return }
  searchOpen.value = !searchOpen.value
  if (searchOpen.value) nextTick(() => searchPanel.value?.querySelector('input')?.focus())
}
function closeSearch(event) {
  searchOpen.value = false
  event.target.blur()
}
const searchPanel = ref(null)
const currentLabel = computed(() => APP_NAVIGATION.find(item => item.key === props.active)?.label || '')
const narrowTitle = computed(() => (props.hasWork && props.targetTitle) ? props.targetTitle : '小说工坊')
const SAVE_LABEL = { saved: '已保存', saving: '保存中', dirty: '未保存', error: '保存失败' }
const saveLabel = computed(() => SAVE_LABEL[props.saveState] || SAVE_LABEL.saved)
/* ⋯ 菜单分两区：「动作」由工作台注入（窄栏把顶栏按钮收进来），「模块」才是 APP_NAVIGATION。
 * 两区都带前缀键，select 时按前缀分发，路由与动作互不污染。 */
const moreOptions = computed(() => [
  ...(latent.value ? [{
    type: 'group', label: '顶栏', key: 'group-topbar', children: [
      { label: pinLabel.value, key: 'pin:toggle' },
      ...(props.active === 'shelf' ? [
        { label: '搜索作品', key: 'search:shelf' },
        ...(!nsPlugin ? [{ label: '恍然梦-入梦', key: 'dream:shelf', disabled: props.busy }] : [])
      ] : [])
    ]
  }] : []),
  ...(props.actions.length ? [{ type: 'group', label: '动作', key: 'group-actions', children: props.actions }] : []),
  {
    type: 'group',
    label: '模块',
    key: 'group-nav',
    children: APP_NAVIGATION
      .filter(item => item.key !== props.active)
      .map(item => ({ label: item.label, key: 'nav:' + item.key, disabled: disabled(item.key) }))
  }
])
function onSelect(key) {
  if (key === 'pin:toggle') return togglePin()
  if (key === 'search:shelf') return toggleSearch()
  if (key === 'dream:shelf') return (ui.dreamLauncherOpen = true)
  if (typeof key === 'string' && key.startsWith('nav:')) return navigate(key.slice(4))
  emit('action', key)
}
const nav = ref(null)
const disabled = key => props.busy || (!props.hasWork && !['shelf', 'settings'].includes(key))
function navigate(key) {
  if (!disabled(key)) emit('navigate', key)
}
const splitMenu = ref(null)
const mainWindow = !new URLSearchParams(location.search).has('panel')
function canSplit(key) {
  return latent.value && mainWindow && !!window.native?.panelOpen && !disabled(key)
    && !!(props.active === 'shelf' ? props.targetWorkId : work.work?.id)
    && WORK_NAVIGATION.some(item => item.key === key)
}
function showSplitMenu(event, item) {
  if (!canSplit(item.key)) return
  event.preventDefault()
  const button = event.currentTarget
  const keyboard = event.type === 'keydown' || (!event.clientX && !event.clientY)
  const bounds = button.getBoundingClientRect()
  splitMenu.value = { item, x: keyboard ? bounds.left : event.clientX, y: keyboard ? bounds.bottom : event.clientY }
}
async function confirmSplit() {
  const item = splitMenu.value?.item
  splitMenu.value = null
  if (!item || !canSplit(item.key)) return
  const type = item.key === 'chapters' ? 'chapter' : item.key
  const fromShelf = props.active === 'shelf'
  const source = fromShelf ? { work: { id: props.targetWorkId, title: props.targetTitle } } : work
  const entity = fromShelf ? '' : {
    chapter: work.selChapterId,
    characters: work.selCharacterId,
    snippets: work.selSnippetId
  }[type]
  const opened = await popOut(source, type, entity, `${source.work.title} · ${item.label}`)
  if (opened) window.$msg?.success('已在独立窗口打开')
}
watch(() => [props.active, props.targetWorkId], () => { splitMenu.value = null })

function title(item) {
  if (props.active !== 'shelf' || ['shelf', 'settings'].includes(item.key)) return item.label
  return props.hasWork ? `打开《${props.targetTitle}》的${item.label}` : '请先创建或选择作品'
}
watch(() => [props.active, ui.skin], async () => {
  await nextTick()
  nav.value?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
})
</script>

<template>
  <AutoHideTopbar class="app-topbar-shell" :auto-hide="ui.topbarAutoHide" @update:auto-hide="value => ui.setPref('topbarAutoHide', value)">
    <header class="app-topbar" :data-topbar-page="active">
      <button type="button" class="app-topbar-brand" title="返回书架" aria-label="小说工坊，返回书架" :disabled="busy" @click="navigate('shelf')">
        <span v-if="!latent" class="app-topbar-mark" :class="{ 'desktop-brand-mark': !nsPlugin && ui.skin !== 'crimson' }" aria-hidden="true">
          <svg v-if="ui.skin === 'crimson'" viewBox="0 0 44 44"><path d="M22 2 42 22 22 42 2 22zM22 7 37 22 22 37 7 22z" /><path d="M27 11a13 13 0 1 0 6 19 12 12 0 0 1-6-19Z" /></svg>
          <img v-else-if="!nsPlugin" :src="desktopSmallIcon" width="36" height="36" alt="" />
          <template v-else>坊</template>
        </span>
        <span class="app-topbar-brand-text">小说工坊<small>{{ brandSuffix }}</small></span>
        <span class="app-topbar-narrow-title" :title="narrowTitle">{{ narrowTitle }}</span>
      </button>
      <nav ref="nav" class="app-topnav" aria-label="功能模块">
        <button v-for="item in navItems" :key="item.key" type="button" class="app-topnav-item" :data-nav="item.key" :class="{ active: active === item.key }" :aria-current="active === item.key ? 'page' : undefined" :aria-haspopup="canSplit(item.key) ? 'menu' : undefined" :disabled="disabled(item.key)" :title="title(item) + (canSplit(item.key) ? '（右键拆窗）' : '')" @click="navigate(item.key)" @contextmenu="showSplitMenu($event, item)" @keydown.shift.f10="showSplitMenu($event, item)">{{ item.label }}</button>
      </nav>
      <NDropdown v-if="latent && mainWindow" trigger="manual" placement="bottom-start"
        :show="!!splitMenu" :x="splitMenu?.x ?? 0" :y="splitMenu?.y ?? 0"
        :options="splitMenu ? [{ key: 'split', label: '在独立窗口打开' + splitMenu.item.label }] : []"
        @select="confirmSplit" @clickoutside="splitMenu = null" @update:show="value => { if (!value) splitMenu = null }" />
      <span class="app-topbar-current" aria-hidden="true">{{ currentLabel }}</span>
      <button v-if="nsPlugin && active === 'shelf'" type="button" class="app-topbar-create" aria-label="新书上架" @click="emit('create')">＋新书上架</button>
      <div class="app-topbar-controls">
      <!-- 隐现（dsh）：右簇圆钮组，与插件版一致（已保存 + 搜索 + 统计 + 设置 + 锁定） -->
      <div v-if="latent" class="app-topbar-cluster">
        <span class="app-topbar-save" :data-save-state="saveState" role="img" :aria-label="saveLabel" :title="saveLabel">
          <svg class="app-topbar-save-icon" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>
          <span class="app-topbar-save-text">{{ saveLabel }}</span>
        </span>
        <div class="app-topbar-search-wrap" :class="{ 'is-open': searchOpen }">
          <button type="button" class="app-topbar-round app-topbar-search-toggle" aria-label="搜索" title="搜索" :aria-expanded="slots.search ? (searchOpen ? 'true' : 'false') : undefined" @click="toggleSearch">
            <svg class="app-topbar-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>
          </button>
        </div>
        <WritingStatsEntry class="app-topbar-round" :library="active==='shelf'" :disabled="busy" />
        <button type="button" class="app-topbar-round app-topbar-settings" aria-label="设置" title="设置" @click="navigate('settings')">
          <svg class="app-topbar-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="3" /><path d="m10 3 4 0 .6 3 2 .9 2.8-1 2 3.4-2.2 2v2.4l2.2 2-2 3.4-2.8-1-2 .9-.6 3h-4l-.6-3-2-.9-2.8 1-2-3.4 2.2-2v-2.4L2.6 9.3l2-3.4 2.8 1 2-.9z" /></svg>
        </button>
        <button type="button" class="app-topbar-round app-topbar-pin" :aria-pressed="!ui.topbarAutoHide" :aria-label="pinLabel" :title="pinLabel" @click="togglePin">
          <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            <rect x="3.6" y="7.4" width="8.8" height="6.2" rx="1.7" />
            <path v-if="!ui.topbarAutoHide" d="M5.8 7.4V5.6a2.2 2.2 0 0 1 4.4 0v1.8" />
            <path v-else d="M5.8 7.4V5.6a2.2 2.2 0 0 1 4.4 0" />
          </svg>
        </button>
      </div>
      <span v-else class="app-topbar-save" :data-save-state="saveState" role="img" :aria-label="saveLabel" :title="saveLabel" aria-disabled="true"><span class="app-topbar-save-dot"></span></span>
      <span v-if="!latent" class="app-topbar-more-wrap"><NDropdown trigger="click" placement="bottom-end" :scrollable="latent" :style="latent ? { maxHeight: 'calc(100dvh - 90px)' } : undefined" :options="moreOptions" @select="onSelect"><button type="button" class="app-topbar-more" aria-label="更多" :title="'更多（当前：' + currentLabel + '）'">⋯</button></NDropdown></span>
      <div class="app-topbar-actions"><DreamModeEntries v-if="!nsPlugin && active==='shelf'" shelf :disabled="busy" @dream="ui.dreamLauncherOpen=true" /><slot name="actions" /></div>
      </div>
      <div v-if="slots.search" ref="searchPanel" class="app-topbar-search app-topbar-search-panel" :class="{ 'is-open': searchOpen }" data-topbar-search @keydown.esc.stop="closeSearch"><slot name="search" /></div>
    </header>
  </AutoHideTopbar>
</template>

<style>
.app-topbar-controls { display: contents; }
.app-topbar-shell {
  --topbar-bg: var(--bg-panel);
  --topbar-text: var(--text);
  --topbar-muted: var(--text-dim);
  --topbar-accent: var(--accent);
  --topbar-line: var(--border);
  --topbar-font: var(--editor-font, 'Microsoft YaHei', sans-serif);
  min-width: 0;
  grid-column: 1 / -1;
}
body[data-skin='gravity'] .app-topbar-shell { --topbar-bg:#101c27; --topbar-text:#e3eceb; --topbar-muted:#a5b7c2; --topbar-accent:#f29c62; --topbar-line:#30424e; --topbar-font:var(--g-gravity-serif); }
body[data-skin='glaze'] .app-topbar-shell { --topbar-bg:#eef6f5; --topbar-text:#234752; --topbar-muted:#4f7079; --topbar-accent:#146878; --topbar-line:#b6d0d3; --topbar-font:var(--glaze-title); }
body[data-skin='crimson'] .app-topbar-shell { --topbar-bg:#151918; --topbar-text:#f0e7d5; --topbar-muted:#c4b085; --topbar-accent:#cfb06b; --topbar-line:#b99f6640; --topbar-font:var(--crimson-serif); }
.app-topbar {
  box-sizing: border-box; display: flex; align-items: center; gap: 24px;
  height: 76px; padding: 0 32px; min-width: 0;
  background: var(--topbar-bg); color: var(--topbar-text); border-bottom: 1px solid var(--topbar-line);
}
body[data-skin] .app-topbar .app-topbar-brand {
  display:flex; align-items:center; gap:10px; flex:none; padding:0; border:0; background:none;
  color:var(--topbar-text); cursor:pointer; font:20px/1.1 var(--topbar-font); white-space:nowrap;
}
.app-topbar-mark { display:grid; place-items:center; width:38px; height:38px; border:1px solid var(--topbar-line); border-radius:10px; color:var(--topbar-accent); font:24px var(--topbar-font); }
.app-topbar-mark svg { width:38px; height:38px; fill:none; stroke:currentColor; stroke-width:1.1; }
.app-topbar-mark img { display:block; width:100%; height:100%; object-fit:contain; }
body[data-skin='crimson'] .app-topbar-mark { border:0; }
.app-topbar-brand-text { letter-spacing:2px; }
body[data-skin] .app-topbar-brand-text small { display:block; margin-top:5px; color:var(--topbar-muted); font:11px/1 var(--topbar-font); letter-spacing:2px; }
.app-topnav { display:flex; align-items:stretch; flex:1 1 auto; gap:24px; min-width:0; height:100%; overflow-x:auto; scrollbar-width:thin; scrollbar-color:var(--topbar-line) transparent; }
body[data-skin] .app-topbar .app-topnav-item {
  position:relative; display:flex; align-items:center; justify-content:center; flex:none; min-width:36px;
  padding:0 3px; border:0; border-radius:0; background:none; color:var(--topbar-muted);
  font:15px/1.5 var(--topbar-font); letter-spacing:1px; white-space:nowrap; cursor:pointer; transition:color .18s;
}
body[data-skin] .app-topbar .app-topnav-item:is(:hover,.active) { color:var(--topbar-accent); }
.app-topnav-item.active::after { content:''; position:absolute; left:50%; bottom:10px; transform:translateX(-50%); width:8px; height:5px; background:var(--topbar-accent); clip-path:polygon(0 0,100% 0,50% 100%); }
body[data-skin] .app-topbar button:disabled { opacity:.4; cursor:default; }
.app-topbar :is(button,[role='combobox']):focus-visible { outline:2px solid var(--topbar-accent); outline-offset:-3px; }
.app-topbar-actions { display:flex; align-items:center; gap:6px; flex:none; min-width:0; white-space:nowrap; }
/* 窄栏三件套默认不出现，只由 dsh 皮肤在 <560 打开（桌面版皮肤维持原有多行顶栏）。 */
.app-topbar-narrow-title, .app-topbar-current, .app-topbar-more-wrap, .app-topbar-save { display:none; }
.app-topbar-actions .save-badge { margin:0; color:var(--topbar-muted); }
.app-topbar-actions .skin-picker { width:138px; }
.app-topbar #studio-task-actions .module-agent { border:0; padding:0; }
.app-topbar-shell .wb-topbar-content { background:var(--topbar-bg); }
.app-root[data-skin] .app-topbar-shell .wb-topbar-pin { background:var(--topbar-bg); color:var(--topbar-muted); border-color:var(--topbar-line); }
.app-topbar-shell .wb-topbar-edge::after { background:var(--topbar-accent); }
.app-root[data-skin='gravity'] .workbench-shell { --workbench-inset:32px; padding-inline:var(--workbench-inset); }
.app-root[data-skin='glaze'] .workbench-shell { --workbench-inset:26px; padding-inline:var(--workbench-inset); }
.workbench-shell > .app-topbar-shell { margin-inline:calc(-1 * var(--workbench-inset, 0px)); }
/* More specific than the historical skin grid: collapsed headers must reclaim their row. */
.app-root[data-skin='crimson'] .crimson-shelf { grid-template-rows:auto minmax(0,1fr) 40px; }
@media(max-width:1200px) {
  .app-topbar { height:72px; padding-inline:24px; gap:16px; }
  .app-topnav { gap:18px; }
  .app-topbar-actions .save-badge, body[data-skin] .app-topbar #studio-task-actions { display:none; }
  .app-root[data-skin='gravity'] .workbench-shell, .app-root[data-skin='glaze'] .workbench-shell { --workbench-inset:24px; }
}
@media(max-width:1000px) { .app-topbar-brand-text { display:none; } }
@media(max-width:850px) {
  .app-topbar { height:64px; padding-inline:16px; gap:12px; }
  .app-topnav { gap:16px; }
}
@media(max-width:600px) {
  .app-topbar { display:grid; grid-template-columns:auto minmax(0,1fr); grid-template-rows:52px 48px; height:100px; gap:0 12px; padding-inline:12px; }
  .app-topnav { grid-column:1/-1; grid-row:2; width:100%; }
  .app-topbar-actions { grid-column:2; grid-row:1; justify-self:end; }
  .app-topbar-mark { width:32px; height:32px; }
  .app-topnav-item.active::after { bottom:3px; }
}
@media(prefers-reduced-motion:reduce) { .app-topbar .app-topnav-item { transition:none; } }
</style>
