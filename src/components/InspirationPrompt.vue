<script setup>
import { inject, ref } from 'vue'
import { NButton, NModal } from 'naive-ui'
import { useWorkStore } from '../stores/work'
import { useAiStore } from '../stores/ai'
import { useUiStore } from '../stores/ui'
import { isPopped } from '../services/panelwindows'
import AiAssistantPanel from './ai/AiAssistantPanel.vue'
const work = useWorkStore()
const ai = useAiStore()
const ui = useUiStore()
const showDialogue = ref(false)
const prompt = inject('inspirationPrompt', ref('把这条灵感扩展成一个场景，保留悬念。'))
function discuss() {
  const needsDialogue = new URLSearchParams(location.search).has('panel') || isPopped(work, 'ai', '')
  const drawerWasOpen = ui.aiDrawerOpen
  ai.prepare(prompt.value.trim() || '请讨论这条灵感。', { snippetId: work.selSnippetId })
  if (needsDialogue) {
    ui.aiDrawerOpen = drawerWasOpen
    showDialogue.value = true
  }
}
</script>
<template>
  <aside class="gravity-inspiration-assistant">
    <span class="gravity-assistant-star" aria-hidden="true">✦</span><h2>恍然梦</h2><p>从一个念头开始。</p>
    <label for="gravity-inspiration-prompt">创作指令</label><textarea id="gravity-inspiration-prompt" v-model="prompt" class="rp-textarea"></textarea>
    <NButton type="primary" :disabled="!work.activeSnippet" @click="discuss">带入恍然梦 →</NButton><small>继续讨论与生成，由你确认后采用。</small>
  </aside>
  <NModal v-model:show="showDialogue" preset="card" title="恍然梦 · 灵感讨论" style="width:620px;max-width:94vw;height:78vh" class="glaze-inspiration-dialogue">
    <AiAssistantPanel v-if="showDialogue" />
  </NModal>
</template>
