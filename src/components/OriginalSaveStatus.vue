<script setup>
import { computed, ref } from 'vue'
import { useUiStore } from '../stores/ui'
import { autosave } from '../services/autosave'
import { originalSaveState } from '../services/original-workspace.mjs'
const ui=useUiStore(),retrying=ref(false)
const state=computed(()=>originalSaveState(ui.autosave))
const text=computed(()=>({saving:'保存中…',error:'保存失败',dirty:`${ui.autosave.pending} 处待保存`,saved:ui.autosave.lastSavedAt?'已保存':'自动保存就绪'}[state.value]))
async function retry(){if(retrying.value)return;retrying.value=true;try{await autosave.flushAll()}catch(error){ui.autosave.error=String(error?.message||'保存失败，请重试')}finally{retrying.value=false}}
</script>
<template><span class="ow-save-state" :data-state="state" role="status"><span aria-hidden="true">●</span>{{text}}<button v-if="state==='error'" :disabled="retrying" @click="retry">重试保存</button></span></template>
<style scoped>.ow-save-state{display:inline-flex;align-items:center;gap:7px;font:12px/1.5 'Microsoft YaHei',sans-serif;color:var(--ow-muted);white-space:nowrap}.ow-save-state>span{font-size:7px;color:var(--ow-accent)}.ow-save-state[data-state=error]{color:var(--ow-danger,#b0473b)}.ow-save-state[data-state=error]>span{color:inherit}.ow-save-state button{border:1px solid currentColor;background:transparent;color:inherit;padding:4px 8px;cursor:pointer;font:inherit}.ow-save-state button:focus-visible{outline:2px solid var(--ow-accent);outline-offset:3px}</style>
