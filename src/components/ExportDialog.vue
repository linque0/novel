<!-- 正文导出对话框（v1.0.4）：按章节勾选导出 + 三种格式（txt / md / docx）。
     章节树按卷分组、支持全选/单选；docx 为 JSZip 手组 OOXML（零新依赖）。 -->
<script setup>
import { useGlazeMuseum } from '../composables/useGlazeMuseum'
const { museumPopoverClass, museumLight } = useGlazeMuseum()
import { useOriginalAppearance } from '../composables/useOriginalAppearance.js'
const { originalOverlayClass } = useOriginalAppearance()
import { computed, ref, watch } from 'vue'
import { NModal, NButton, NCheckbox, NInputNumber } from 'naive-ui'
import { useWorkStore } from '../stores/work'
import { useUiStore } from '../stores/ui'
import { exportBookWithFilter, exportChapterRowsSequential, exportRowsAsZip, exportSingleChapter } from '../services/exporter'
import { useMessage } from 'naive-ui'

const work = useWorkStore()
const ui = useUiStore()
const msg = useMessage()

const fmt = ref('txt')
const picked = ref([]) // 章节 id 集合
const busy = ref(false)
const batchMode = ref(null) // null 未进入批量选择 | 'merge' 合并单文件 | 'zip' 按章 zip
const threshold = ref(30) // 大批量阈值（用户可改，存 appconfig）

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

/* 选中行（按卷序+章序排列） */
const pickedRows = computed(() => {
  const set = new Set(picked.value)
  const rows = []
  for (const g of groups.value) for (const c of g.chapters) if (set.has(c.id)) rows.push({ vol: g.id === '__loose__' ? null : g, ch: c })
  return rows
})
/* 大批量：仅按选中章节数是否超过阈值判定（整卷/全选本身不强制，
   例如全书只有 8 章时全选仍走逐章分批导出） */
const isBulk = computed(() => pickedRows.value.length > threshold.value)

watch(
  () => ui.exportOpen,
  (open) => {
    if (open) {
      picked.value = [...allIds.value]
      fmt.value = 'txt'
      batchMode.value = null
      loadThreshold()
    }
  }
)
async function loadThreshold() {
  try {
    const { db } = window.__ns
    const row = await db.appconfig.get('exportBatchThreshold')
    if (row?.value) threshold.value = Number(row.value) || 30
  } catch {}
}
async function saveThreshold(v) {
  threshold.value = v || 30
  try {
    const { db } = window.__ns
    await db.appconfig.put({ key: 'exportBatchThreshold', value: threshold.value })
  } catch {}
}

function toggleAll() {
  picked.value = allOn.value ? [] : [...allIds.value]
  batchMode.value = null
}
function groupOn(g) {
  return g.chapters.length > 0 && g.chapters.every((c) => picked.value.includes(c.id))
}
function toggleGroup(g) {
  const ids = g.chapters.map((c) => c.id)
  if (groupOn(g)) picked.value = picked.value.filter((id) => !ids.includes(id))
  else picked.value = [...new Set([...picked.value, ...ids])]
  batchMode.value = null
}
function toggleCh(id, on) {
  picked.value = on ? [...new Set([...picked.value, id])] : picked.value.filter((x) => x !== id)
  batchMode.value = null
}

async function doExport() {
  if (!picked.value.length) {
    msg.warning('请至少选择一个章节')
    return
  }
  const rows = pickedRows.value
  if (isBulk.value && !batchMode.value) {
    msg.warning(`选中章节数超过阈值（${threshold.value} 章），请先选择批量导出方式（合并单文件 或 按章打包 zip）`)
    return
  }
  busy.value = true
  let completed = false
  try {
    if (rows.length === 1 && !isBulk.value) {
      /* 单章：以章节名导出 */
      const r = await exportSingleChapter(work.work, work.volumes, rows[0].ch, fmt.value)
      completed = !r?.canceled
      if (!r?.canceled) msg.success(`已导出「${rows[0].ch.title || '未命名章节'}」`)
    } else if (!isBulk.value) {
      /* 多章（小批量）：按选中顺序逐章分批导出 */
      const r = await exportChapterRowsSequential(work.work, work.volumes, work.chapters, rows, fmt.value)
      completed = r.exported === rows.length && !r.canceledAt
      if (!completed) msg.warning(`已导出 ${r.exported} 章，在「${r.canceledAt || '未命名章节'}」处取消`)
      else msg.success(`已导出 ${r.exported} 章至 ${r.dir || '所选目录'}（${fmt.value.toUpperCase()}）`)
    } else if (batchMode.value === 'merge') {
      /* 大批量合并单文件（书名命名） */
      const r = await exportBookWithFilter(work.work, work.volumes, work.chapters, fmt.value, new Set(picked.value))
      completed = !r?.canceled
      if (!r?.canceled) msg.success(`已合并导出 ${rows.length} 章（${fmt.value.toUpperCase()}）`)
    } else {
      /* 按章逐一 + zip */
      const r = await exportRowsAsZip(work.work, rows, fmt.value)
      completed = !r?.canceled
      if (!r?.canceled) msg.success(`已导出 zip 压缩包（${rows.length} 章 · ${fmt.value.toUpperCase()}）`)
    }
  } catch (e) {
    msg.error('导出失败：' + (e.message || e))
  } finally {
    busy.value = false
    if (completed) ui.exportOpen = false
  }
}
</script>

<template>
  <NModal :class="[museumPopoverClass, originalOverlayClass]" :data-glaze-light="museumLight" :show="ui.exportOpen" :mask-closable="!busy" :close-on-esc="!busy" :closable="!busy" preset="card" title="导出正文" style="width: 520px" @update:show="(v) => (ui.exportOpen = v)">
    <p v-if="originalOverlayClass" class="original-dialog-note">选择需要导出的章节，按卷序与章序生成文件。已选 {{ pickedRows.length }} / {{ allIds.length }} 章。</p>
    <fieldset class="original-export-options" :disabled="busy" style="border: 0; padding: 0; margin: 0; min-width: 0">
    <div class="exp-tree">
      <label class="exp-all">
        <NCheckbox :checked="allOn" :disabled="busy" :indeterminate="picked.length > 0 && !allOn" @update:checked="toggleAll">全选章节（{{ allIds.length }}）</NCheckbox>
      </label>
      <div v-for="g in groups" :key="g.id" class="exp-group">
        <label class="exp-vol">
          <NCheckbox :checked="groupOn(g)" :disabled="busy" :indeterminate="!groupOn(g) && g.chapters.some(c => picked.includes(c.id))" @update:checked="toggleGroup(g)" /> {{ g.label }}（{{ g.chapters.length }}）
        </label>
        <div class="exp-chs">
          <label v-for="c in g.chapters" :key="c.id" class="exp-ch">
            <NCheckbox
              :checked="picked.includes(c.id)"
              :disabled="busy"
              :checked-value="true"
              :unchecked-value="false"
              @update:checked="(v) => toggleCh(c.id, v)"
            />{{ c.title || '未命名章节' }}
          </label>
        </div>
      </div>
    </div>
    <div class="exp-fmt">
      <span class="exp-fmt-label">格式</span>
      <button type="button" v-for="f in [
        { k: 'txt', label: 'TXT 纯文本' },
        { k: 'md', label: 'Markdown' },
        { k: 'docx', label: 'Word (docx)' }
      ]" :key="f.k" class="om-chip" :class="{ on: fmt === f.k }" :aria-pressed="fmt === f.k" @click="fmt = f.k">{{ f.label }}</button>
    </div>
    <!-- 大批量导出方式（选中章节数超过阈值时出现） -->
    <div v-if="isBulk" class="exp-bulk">
      <div class="exp-bulk-tip">
        已选 {{ pickedRows.length }} 章，超过大批量阈值 {{ threshold }} 章——请选择导出方式：
      </div>
      <div class="exp-bulk-opts">
        <button type="button" class="exp-bulk-opt" :class="{ on: batchMode === 'merge' }" :aria-pressed="batchMode === 'merge'" @click="batchMode = 'merge'">
          <div class="exp-bulk-name">合并为单个文件</div>
          <div class="exp-bulk-desc">全部选中章节按顺序合并为一个 {{ fmt.toUpperCase() }} 文件（书名命名）</div>
        </button>
        <button type="button" class="exp-bulk-opt" :class="{ on: batchMode === 'zip' }" :aria-pressed="batchMode === 'zip'" @click="batchMode = 'zip'">
          <div class="exp-bulk-name">按章打包 zip</div>
          <div class="exp-bulk-desc">每章一个 {{ fmt.toUpperCase() }} 文件（序号-章节名，按卷分目录），压缩为一个 zip</div>
        </button>
      </div>
      <div class="exp-bulk-th">
        <span>大批量判定阈值</span>
        <NInputNumber v-model:value="threshold" :disabled="busy" size="tiny" :min="2" :max="500" :step="1" style="width: 90px" @update:value="saveThreshold" />
        <span>章（超过即提示选择导出方式，改动即保存）</span>
      </div>
    </div>
    </fieldset>
    <p v-if="!allIds.length" class="original-dialog-note" role="status">当前作品没有可导出的正文，请先打开作品并创建章节。</p>
    <template #footer>
      <div class="original-dialog-actions" style="display: flex; justify-content: flex-end; gap: 8px">
        <span v-if="busy" class="original-dialog-note" role="status" aria-live="polite">正在准备并导出 {{ pickedRows.length }} 章，请完成文件保存…</span>
        <NButton size="small" :disabled="busy" @click="ui.exportOpen = false">取消</NButton>
        <NButton size="small" type="primary" :loading="busy" :disabled="!picked.length" @click="doExport">
          {{ isBulk ? (batchMode === 'zip' ? `打包 ${pickedRows.length} 章 (zip)` : batchMode === 'merge' ? `合并导出 ${pickedRows.length} 章` : `选择导出方式…`) : pickedRows.length === 1 ? `导出「${(pickedRows[0].ch.title || '未命名章节').slice(0, 10)}」` : `逐章导出 ${pickedRows.length} 章` }}
        </NButton>
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
.exp-fmt .om-chip { background: transparent; font-family: inherit; }
</style>

<style scoped>
.exp-bulk {
  margin-top: var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: var(--space-2);
}
.exp-bulk-tip {
  font-size: var(--fs-sm);
  color: var(--warning);
  margin-bottom: var(--space-2);
}
.exp-bulk-opts {
  display: flex;
  gap: var(--space-2);
}
.exp-bulk-opt {
  background: transparent;
  color: inherit;
  text-align: left;
  font: inherit;
  flex: 1;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: var(--space-2);
  cursor: pointer;
  transition: border-color var(--dur-fast, 120ms) ease, background 120ms ease;
}
.exp-bulk-opt:hover {
  border-color: var(--border-strong);
}
.exp-bulk-opt.on {
  border-color: var(--accent);
  background: var(--accent-soft);
}
.exp-bulk-name {
  font-weight: 600;
  font-size: var(--fs-sm);
  margin-bottom: 2px;
}
.exp-bulk-desc {
  font-size: var(--fs-xs);
  color: var(--text-dim);
  line-height: 1.5;
}
.exp-bulk-th {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--fs-xs);
  color: var(--text-dim);
  margin-top: var(--space-2);
}
</style>
