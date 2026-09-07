<!-- 帮助 · 使用手册（v1.0.7 内置）：docs/使用手册.md 以 ?raw 导入 + marked 渲染，
     顶栏「帮助」按钮打开，可滚动阅读，随构建更新（手册即源码，永不失同步） -->
<script setup>
import { computed } from 'vue'
import { NModal, NButton } from 'naive-ui'
import { useUiStore } from '../stores/ui'
import { marked } from 'marked'
import manual from '../../docs/使用手册.md?raw'

const ui = useUiStore()
const html = computed(() => marked.parse(manual, { async: false }))
</script>

<template>
  <NModal :show="ui.helpOpen" preset="card" title="帮助 · 使用手册" style="width: 780px; max-width: 92vw" @update:show="(v) => (ui.helpOpen = v)">
    <div class="help-body" v-html="html"></div>
    <template #footer>
      <div style="display: flex; justify-content: flex-end">
        <NButton size="small" @click="ui.helpOpen = false">关闭</NButton>
      </div>
    </template>
  </NModal>
</template>

<style scoped>
.help-body {
  max-height: 68vh;
  overflow: auto;
  padding: 0 8px;
  font-size: var(--fs-md);
  line-height: 1.8;
  color: var(--text);
}
.help-body :deep(h1) {
  font-size: 19px;
  margin: 4px 0 12px;
  color: var(--accent);
}
.help-body :deep(h2) {
  font-size: 16px;
  margin: 20px 0 8px;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--border);
}
.help-body :deep(h3) {
  font-size: 14px;
  margin: 14px 0 6px;
}
.help-body :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 8px 0;
  font-size: var(--fs-sm);
}
.help-body :deep(th),
.help-body :deep(td) {
  border: 1px solid var(--border);
  padding: 5px 10px;
  text-align: left;
}
.help-body :deep(th) {
  background: var(--bg-hover);
}
.help-body :deep(code) {
  background: var(--bg-hover);
  border-radius: 4px;
  padding: 1px 5px;
  font-size: 12px;
  font-family: Consolas, monospace;
}
.help-body :deep(blockquote) {
  border-left: 3px solid var(--accent);
  margin: 8px 0;
  padding: 2px 12px;
  color: var(--text-dim);
  background: var(--accent-soft);
  border-radius: 0 6px 6px 0;
}
.help-body :deep(hr) {
  border: none;
  border-top: 1px solid var(--border);
  margin: 14px 0;
}
</style>
