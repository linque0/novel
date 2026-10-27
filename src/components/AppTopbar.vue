<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import AutoHideTopbar from './AutoHideTopbar.vue'
import { useUiStore } from '../stores/ui'
import { SKINS } from '../skins/registry'
import { APP_NAVIGATION } from './app-navigation'

const props = defineProps({
  active: { type: String, default: 'shelf' },
  busy: Boolean,
  hasWork: Boolean,
  targetTitle: { type: String, default: '' }
})
const emit = defineEmits(['navigate'])
const ui = useUiStore()
const skinLabel = computed(() => SKINS.find(skin => skin.id === ui.skin)?.label || '原版工坊')
const nav = ref(null)
const disabled = key => props.busy || (!props.hasWork && !['shelf', 'settings'].includes(key))
function navigate(key) {
  if (!disabled(key)) emit('navigate', key)
}
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
    <header class="app-topbar">
      <button type="button" class="app-topbar-brand" title="返回书架" aria-label="小说工坊，返回书架" :disabled="busy" @click="navigate('shelf')">
        <span class="app-topbar-mark" aria-hidden="true">
          <svg v-if="ui.skin === 'crimson'" viewBox="0 0 44 44"><path d="M22 2 42 22 22 42 2 22zM22 7 37 22 22 37 7 22z" /><path d="M27 11a13 13 0 1 0 6 19 12 12 0 0 1-6-19Z" /></svg>
          <template v-else>坊</template>
        </span>
        <span class="app-topbar-brand-text">小说工坊<small>{{ skinLabel }}</small></span>
      </button>
      <nav ref="nav" class="app-topnav" aria-label="功能模块">
        <button v-for="item in APP_NAVIGATION" :key="item.key" type="button" class="app-topnav-item" :data-nav="item.key" :class="{ active: active === item.key }" :aria-current="active === item.key ? 'page' : undefined" :disabled="disabled(item.key)" :title="title(item)" @click="navigate(item.key)">{{ item.label }}</button>
      </nav>
      <div class="app-topbar-actions"><slot name="actions" /></div>
    </header>
  </AutoHideTopbar>
</template>

<style>
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
