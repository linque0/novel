<!-- 正文导出对话框（v1.0.4）：按章节勾选导出 + 三种格式（txt / md / docx）。
     章节树按卷分组、支持全选/单选；docx 为 JSZip 手组 OOXML（零新依赖）。 -->
<script setup>
import { computed, ref, watch } from 'vue'
import { NModal, NButton, NCheckbox } from 'naive-ui'
import { useWorkStore } from '../stores/work'
import { useUiStore } from '../stores/ui'
import { exportBookWithFilter } from '../services/exporter'
import { useMessage } from 'naive-ui'

const work = useWorkStore()
const ui = useUiStore()
const msg = useMessage()

const fmt = ref('txt')
const picked = ref([]) // 章节 id 集合
const busy = ref(false)

const live = computed(() => work.chapters.filter((c) => !c.deletedAt))
const groups = computed(() => {
  const vols = work.volumes.filter((v) => !v.deletedAt).sort((a, b) => a.sortOrder - b.sortOrder)
  const out = []
  const used = new Set()
  for (const v of vols) {
    const chs = live.value.filter((c) => c.volumeId === v.id).sort((a, b) => a.sortOrder - b.sortOrder)
    if (chs.length || vols.length > 1) out.push({ id: v.id, label: v.title || '未命名卷', chapters: chs })
    for (const c of chs) used.add(c.id)
  }
  const loose = live.value.filter((c) => !used.has(c.id) && !vols.some((v) => v.id === c.volumeId))
  if (loose.length) out.push({ id: '__loose__', label: '未分卷章节', chapters: loose.sort((a, b) => a.sortOrder - b.sortOrder) })
  return out
})
const allIds = computed(() => groups.value.flatMap((g) => g.chapters.map((c) => c.id)))
const allOn = computed(() => allIds.value.length > 0 && allIds.value.every((id) => picked.value.includes(id)))

watch(
  () => ui.exportOpen,
  (open) => {
    if (open) {
      picked.value = [...allIds.value] // 默认全选（等价旧的整书导出）
      fmt.value = 'txt'
    }
  }
)

function toggleAll() {
  picked.value = allOn.value ? [] : [...allIds.value]
}
function groupOn(g) {
  return g.chapters.length > 0 && g.chapters.every((c) => picked.value.includes(c.id))
}
function toggleGroup(g) {
  const ids = g.chapters.map((c) => c.id)
  if (groupOn(g)) picked.value = picked.value.filter((id) => !ids.includes(id))
  else picked.value = [...new Set([...picked.value, ...ids])]
}

async function doExport() {
  if (!picked.value.length) {
    msg.warning('请至少选择一个章节')
    return
  }
  busy.value = true
  try {
    const r = await exportBookWithFilter(work.work, work.volumes, work.chapters, fmt.value, new Set(picked.value))
    if (!r?.canceled) msg.success(`已导出 ${picked.value.length} 章（${fmt.value.toUpperCase()}）`)
  } catch (e) {
    msg.error('导出失败：' + (e.message || e))
  } finally {
    busy.value = false
    ui.exportOpen = false
  }
}
</script>

<template>
  <NModal :show="ui.exportOpen" preset="card" title="导出正文" style="width: 520px" @update:show="(v) => (ui.exportOpen = v)">
    <div class="exp-tree">
      <label class="exp-all">
        <NCheckbox :checked="allOn" @update:checked="toggleAll">全选章节（{{ allIds.length }}）</NCheckbox>
      </label>
      <div v-for="g in groups" :key="g.id" class="exp-group">
        <label class="exp-vol" @click.prevent="toggleGroup(g)">
          <NCheckbox :checked="groupOn(g)" /> {{ g.label }}（{{ g.chapters.length }}）
        </label>
        <div class="exp-chs">
          <label v-for="c in g.chapters" :key="c.id" class="exp-ch">
            <NCheckbox
              :checked="picked.includes(c.id)"
              :checked-value="true"
              :unchecked-value="false"
              @update:checked="(v) => (v ? (picked = [...new Set([...picked, c.id])]) : (picked = picked.filter((x) => x !== c.id)))"
            />{{ c.title || '未命名章节' }}
          </label>
        </div>
      </div>
    </div>
    <div class="exp-fmt">
      <span class="exp-fmt-label">格式</span>
      <span v-for="f in [
        { k: 'txt', label: 'TXT 纯文本' },
        { k: 'md', label: 'Markdown' },
        { k: 'docx', label: 'Word (docx)' }
      ]" :key="f.k" class="om-chip" :class="{ on: fmt === f.k }" @click="fmt = f.k">{{ f.label }}</span>
    </div>
    <template #footer>
      <div style="display: flex; justify-content: flex-end; gap: 8px">
        <NButton size="small" @click="ui.exportOpen = false">取消</NButton>
        <NButton size="small" type="primary" :loading="busy" :disabled="!picked.length" @click="doExport">导出 {{ picked.length }} 章</NButton>
      </div>
    </template>
  </NModal>
</template>

<style scoped>
.exp-tree {
  max-height: 320px;
  overflow: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: var(--space-2);
}
.exp-all {
  display: block;
  padding-bottom: var(--space-2);
  border-bottom: 1px solid var(--border);
  margin-bottom: var(--space-2);
}
.exp-vol {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  font-size: var(--fs-sm);
  cursor: pointer;
  padding: 3px 0;
}
.exp-chs {
  padding-left: 18px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2px 10px;
}
.exp-ch {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--fs-sm);
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.exp-fmt {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-3);
}
.exp-fmt-label {
  font-size: var(--fs-sm);
  color: var(--text-dim);
}
</style>
