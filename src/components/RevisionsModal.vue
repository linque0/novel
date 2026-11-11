<script setup>
import { useGlazeMuseum } from '../composables/useGlazeMuseum'
const { museumPopoverClass, museumLight } = useGlazeMuseum()
import { useOriginalAppearance } from '../composables/useOriginalAppearance.js'
const { originalOverlayClass } = useOriginalAppearance()
import { ref, watch } from 'vue'
import { NModal, NButton, NEmpty, NPopconfirm, NAlert } from 'naive-ui'
import { useWorkStore } from '../stores/work'
import { useUiStore } from '../stores/ui'

const work = useWorkStore()
const ui = useUiStore()
const revs = ref([])
const busy = ref(false)
const loading = ref(false)
const error = ref('')

watch(
  () => ui.revisionsCtx,
  async (ctx) => {
    revs.value = []
    error.value = ''
    if (!ctx) return
    loading.value = true
    try {
      const rows = await work.revisionsFor(ctx.id)
      if (ui.revisionsCtx?.id === ctx.id) revs.value = rows
    } catch (e) {
      error.value = '版本读取失败：' + (e?.message || e)
    } finally {
      loading.value = false
    }
  }
)

function fmt(t) {
  return new Date(t).toLocaleString('zh-CN')
}
const preview = (c) => {
  const t = (c || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')
  return t.slice(0, 60)
}

async function rollback(rev) {
  if (busy.value || !ui.revisionsCtx) return false
  busy.value = true
  try {
    await work.rollbackChapter(ui.revisionsCtx.id, rev.id)
    window.$msg?.success('已恢复所选版本，等待自动保存')
    ui.revisionsCtx = null
  } catch (e) {
    error.value = '恢复失败：' + (e?.message || e)
    return false
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <NModal :class="[museumPopoverClass, originalOverlayClass]" :data-glaze-light="museumLight"
    :mask-closable="!busy" :close-on-esc="!busy" :closable="!busy"
    :show="!!ui.revisionsCtx"
    preset="card"
    :title="`版本历史 · ${ui.revisionsCtx?.title || ''}`"
    style="width: 600px"
    @update:show="(v) => !v && (ui.revisionsCtx = null)"
  >
    <p v-if="originalOverlayClass" class="original-dialog-note">按保存时间选择快照。恢复会替换当前章节内容，请先确认版本。</p>
    <NAlert v-if="error" type="error" style="margin-bottom: 12px">{{ error }}</NAlert>
    <p v-if="loading" role="status" class="original-dialog-note">正在读取版本…</p>
    <div style="max-height: 420px; overflow: auto">
      <div
        v-for="r in revs"
        :key="r.id"
        style="display: flex; align-items: center; gap: 10px; padding: 8px 6px; border-bottom: 1px solid var(--border)"
      >
        <div style="flex: 1; min-width: 0">
          <div style="font-size: 12px; color: var(--text-dim)">{{ fmt(r.createdAt) }}</div>
          <div style="font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap">
            {{ preview(r.content) || '（空白）' }}
          </div>
        </div>
        <NPopconfirm :class="[museumPopoverClass, originalOverlayClass]" :data-glaze-light="museumLight" positive-text="恢复此版本" negative-text="取消" @positive-click="rollback(r)">
          <template #trigger><NButton size="tiny" :disabled="busy">恢复此版本</NButton></template>
          确认恢复 {{ fmt(r.createdAt) }} 的版本？当前章节内容将被替换。
        </NPopconfirm>
      </div>
      <NEmpty v-if="!loading && !error && !revs.length" description="暂无快照 —— 编辑内容并等待自动保存后，会按策略生成版本快照" style="margin: 26px 0" />
    </div>
  </NModal>
</template>
