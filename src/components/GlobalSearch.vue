<script setup>
import { useGlazeMuseum } from '../composables/useGlazeMuseum'
const { museumPopoverClass, museumLight } = useGlazeMuseum()
import { useOriginalAppearance } from '../composables/useOriginalAppearance.js'
const { originalOverlayClass } = useOriginalAppearance()
import { ref, reactive } from 'vue'
import { NModal, NInput, NCheckbox, NButton, NEmpty } from 'naive-ui'
import { useWorkStore } from '../stores/work'
import { useUiStore } from '../stores/ui'

const work = useWorkStore()
const ui = useUiStore()

const q = ref('')
const results = ref([])
const ran = ref(false)
const searchedQuery = ref('')
const scopes = reactive({ chapters: true, outlines: true, characters: true, lore: true, snippets: true })

const TYPE_LABEL = {
  chapters: '正文',
  outlines: '大纲',
  characters: '人物',
  lore: '设定',
  snippets: '灵感'
}

function run() {
  searchedQuery.value = q.value.trim()
  ran.value = true
  results.value = work.search(q.value, scopes)
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}
function hl(text) {
  const t = text || ''
  if (!searchedQuery.value) return esc(t)
  const i = t.toLowerCase().indexOf(searchedQuery.value.toLowerCase())
  if (i < 0) return esc(t)
  return (
    esc(t.slice(0, i)) +
    '<span class="hl">' +
    esc(t.slice(i, i + searchedQuery.value.length)) +
    '</span>' +
    esc(t.slice(i + searchedQuery.value.length))
  )
}

function go(r) {
  work.navTo(r.type, r.id)
}
</script>

<template>
  <NModal :class="[museumPopoverClass, originalOverlayClass]" :data-glaze-light="museumLight" :show="ui.searchOpen" preset="card" title="全局搜索" style="width: 640px" @update:show="(v) => (ui.searchOpen = v)">
    <div class="original-search-controls" style="display: flex; gap: 8px; margin-bottom: 10px">
      <NInput v-model:value="q" placeholder="搜索关键词…" autofocus @keyup.enter="run" @input="ran = false" />
      <NButton type="primary" @click="run">搜索</NButton>
    </div>
    <div class="original-search-scopes" style="display: flex; gap: 14px; margin-bottom: 12px; font-size: 12px" aria-label="搜索范围">
      <NCheckbox v-model:checked="scopes.chapters" size="small">正文</NCheckbox>
      <NCheckbox v-model:checked="scopes.outlines" size="small">大纲</NCheckbox>
      <NCheckbox v-model:checked="scopes.characters" size="small">人物</NCheckbox>
      <NCheckbox v-model:checked="scopes.lore" size="small">设定</NCheckbox>
      <NCheckbox v-model:checked="scopes.snippets" size="small">灵感</NCheckbox>
    </div>
    <p v-if="originalOverlayClass" class="original-dialog-note" role="status">{{ ran ? `“${searchedQuery}” · ${results.length} 条结果${results.length === 200 ? '（最多显示 200 条）' : ''}` : '搜索当前作品的正文、大纲、人物、设定与灵感。输入关键词后按 Enter 搜索。' }}</p>
    <div class="original-search-results" style="max-height: 420px; overflow: auto">
      <div v-for="r in results" :key="r.type + r.id" class="search-hit" role="button" tabindex="0" :aria-label="`打开${TYPE_LABEL[r.type]}：${r.title || '未命名'}`" @click="go(r)" @keydown.enter.prevent="go(r)" @keydown.space.prevent="go(r)">
        <div style="font-weight: 600; margin-bottom: 2px">【{{ TYPE_LABEL[r.type] }}】{{ r.title || '未命名' }}</div>
        <div v-for="(h, i) in r.hits" :key="i" class="search-hit-line" v-html="hl(h)"></div>
      </div>
      <NEmpty v-if="ran && !results.length" description="没有找到匹配内容" style="margin: 30px 0" />
    </div>
  </NModal>
</template>

<style scoped>
.search-hit-line {
  font-size: 12px;
  color: var(--text-dim);
  line-height: 1.7;
}
</style>
