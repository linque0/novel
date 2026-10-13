<script setup>
import { computed, ref } from 'vue'
import { NButton, NInput, NSelect } from 'naive-ui'
import { useWorkStore } from '../../stores/work'
const props = defineProps({ card: { type: Object, required: true } }),
  work = useWorkStore(),
  error = ref(''),
  title = ref(props.card.title || '新章节'),
  volumeId = ref(work.chapters.find((c) => c.id === props.card.anchorId)?.volumeId || work.liveVolumes[0]?.id || 'orphans'),
  afterId = ref(props.card.anchorId || ''),
  mode = ref('append'),
  confirm = ref(false)
const applied = computed(() => props.card.status === 'applied'),
  canApply = computed(() => props.card.complete && !applied.value)
const target = computed(() => work.chapters.find((c) => c.id === props.card.anchorId && !c.deletedAt))
async function apply() {
  error.value = ''
  try {
    await work.applyAiProposal(props.card, { action: mode.value, title: title.value, volumeId: volumeId.value, afterId: afterId.value })
    confirm.value = false
    window.$msg?.success('草稿已保存，可撤销')
  } catch (e) {
    error.value = e.message
  }
}
async function undo() {
  try {
    await work.undoAiApplication(props.card.auditId)
    props.card.status = 'undone'
    props.card.appliedActions = []
    props.card.auditId = null
  } catch (e) {
    error.value = e.message
  }
}
async function copyText() {
  try {
    await navigator.clipboard.writeText(props.card.text)
    window.$msg?.success('正文已复制')
  } catch (e) {
    error.value = e.message
  }
}
function open(action) {
  mode.value = action
  confirm.value = true
  error.value = ''
}
</script>
<template>
  <div class="draft-card">
    <p>{{ card.summary }}</p>
    <p class="target">
      生成时目标：{{ card.anchorLabel || '未关联章节' }} · {{ card.text.length }} 字 ·
      {{ card.complete ? '完整草稿' : '尚未完整，先继续生成' }}
    </p>
    <details>
      <summary>展开正文</summary>
      <pre>{{ card.text }}</pre>
    </details>
    <div class="actions">
      <NButton size="tiny" :disabled="!canApply || !target" @click="open('append')">追加到章节</NButton
      ><NButton size="tiny" :disabled="!canApply || !card.original" @click="open('replace')">替换选段</NButton
      ><NButton size="tiny" :disabled="!canApply" @click="open('newchapter')">保存为新章节</NButton
      ><NButton size="tiny" @click="copyText">复制</NButton
      ><NButton v-if="card.auditId && applied" size="tiny" @click="undo">撤销应用</NButton>
    </div>
    <div v-if="confirm" class="confirm">
      <template v-if="mode === 'newchapter'"
        ><NInput v-model:value="title" placeholder="新章节标题" /><NSelect
          v-model:value="volumeId"
          :options="[{ label: '未分卷', value: 'orphans' }, ...work.liveVolumes.map((v) => ({ label: v.title, value: v.id }))]" /><NSelect
          v-model:value="afterId"
          :options="[
            { label: '放在卷末', value: '' },
            ...work.liveChapters
              .filter((c) => (c.volumeId || 'orphans') === volumeId)
              .map((c) => ({ label: '在 ' + c.title + ' 之后', value: c.id })),
          ]" /></template
      ><template v-else
        ><p>{{ mode === 'append' ? '将追加到生成时关联章节末尾：' : '将替换生成时选段：' }}{{ card.anchorLabel }}</p>
        <pre v-if="mode === 'replace'">{{ card.original }}</pre>
        <p>保留原有其他内容。版本变化、其他窗口锁定或选段跨越双链／批注时停止应用。</p></template
      >
      <div class="actions">
        <NButton type="primary" size="small" @click="apply">确认保存</NButton><NButton size="small" @click="confirm = false">取消</NButton>
      </div>
    </div>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
  </div>
</template>
<style scoped>
.draft-card {
  padding: 10px;
  font-size: 12px;
}
.target {
  color: var(--text-dim);
}
.actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin: 10px 0;
}
.confirm {
  padding: 12px;
  border: 1px solid var(--border);
}
.confirm > * {
  margin-bottom: 10px;
}
pre {
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.8;
}
summary {
  cursor: pointer;
}
.error {
  color: #d55;
}
</style>
