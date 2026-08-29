import { useUiStore } from '../stores/ui'
import { putRow, addRevision, addWordLog } from '../db/repo'

/**
 * 自动保存服务：
 * - mark() 登记脏实体，防抖 1s 后落盘（只写脏数据）
 * - 30s 定时兜底 / 窗口失焦 / 页面隐藏时 flushAll
 * - 章节落盘时按策略写版本快照（内容有变化且距上次快照 > 5min，或强制）
 * - 落盘前通过 hooks.beforePut 处理码字统计（wordlog）
 */
const pending = new Map() // `${table}:${id}` -> { table, row, forceSnapshot }
let flushTimer = null
let started = false
const lastSnapshotAt = new Map()
const lastSnapshotContent = new Map()

const ui = () => useUiStore()

function schedule() {
  clearTimeout(flushTimer)
  flushTimer = setTimeout(() => doFlush(), 1000)
}

async function doFlush() {
  if (!pending.size) return
  ui().autosave.saving = true
  const items = [...pending.values()]
  pending.clear()
  ui().autosave.pending = 0
  try {
    for (const it of items) {
      const row = JSON.parse(JSON.stringify(it.row))
      await autosave.hooks.beforePut?.(it.table, row)
      row.updatedAt = Date.now()
      await putRow(it.table, row)
      if (it.table === 'chapters') maybeSnapshot(row, it.forceSnapshot)
    }
    ui().autosave.lastSavedAt = Date.now()
  } catch (err) {
    console.error('[autosave] 保存失败，已重新排队', err)
    for (const it of items) pending.set(`${it.table}:${it.row.id}`, it)
    ui().autosave.pending = pending.size
  } finally {
    ui().autosave.saving = false
  }
}

function maybeSnapshot(row, force) {
  const key = row.id
  const content = row.content || ''
  const changed = content !== (lastSnapshotContent.get(key) ?? null)
  const cooled = Date.now() - (lastSnapshotAt.get(key) || 0) > 5 * 60 * 1000
  if (!(force || (changed && cooled))) return
  lastSnapshotAt.set(key, Date.now())
  lastSnapshotContent.set(key, content)
  addRevision('chapter', row.id, content).catch((e) => console.error('[snapshot]', e))
}

export const autosave = {
  hooks: { beforePut: null },

  mark(table, row, opts = {}) {
    if (!row || !row.id) return
    pending.set(`${table}:${row.id}`, { table, row, forceSnapshot: !!opts.forceSnapshot })
    ui().autosave.pending = pending.size
    schedule()
  },

  async flushAll() {
    clearTimeout(flushTimer)
    await doFlush()
  }
}

export function startAutosave() {
  if (started) return
  started = true
  setInterval(() => {
    if (pending.size) doFlush()
  }, 30000)
  window.addEventListener('blur', () => doFlush())
  window.addEventListener('pagehide', () => doFlush())
  window.__flushNow = () => doFlush()
}

/** 工作打开时装配码字统计钩子（prevCounts: Map<chapterId, 字数>） */
export function installWordLogHook(prevCounts) {
  autosave.hooks.beforePut = async (table, row) => {
    if (table !== 'chapters') return
    const prev = prevCounts.get(row.id)
    if (prev == null) return
    const delta = (row.wordCount || 0) - prev
    if (delta !== 0) {
      await addWordLog(row.workId, row.id, delta)
      prevCounts.set(row.id, row.wordCount || 0)
    }
  }
}
