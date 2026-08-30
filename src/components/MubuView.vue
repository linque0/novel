<script setup>
import { ref, reactive, computed, watch, nextTick, onMounted, onUpdated, onBeforeUnmount } from 'vue'
import { NButton, NPopover } from 'naive-ui'
import { useWorkStore } from '../stores/work'
import { useUiStore } from '../stores/ui'
import { pickFiles } from '../services/fileio'
import { decodeText, parseMubuMd } from '../services/importers'

const work = useWorkStore()
const ui = useUiStore()
const rootEl = ref(null)
const ver = ref(0)
const rows = ref([])
const pending = reactive({ key: null, offset: 'end' })
const drag = reactive({ key: null, hintKey: null, zone: null })
const focusedId = ref(null)
const ctx = reactive({ open: false, x: 0, y: 0, rowId: null, folded: false, hasChildren: false })
const clip = ref(null)
const undoStack = ref([])
const redoStack = ref([])
let lastSnap = 0
let expandTimer = null
let expandTarget = null

const COLORS = ['#3c3427', '#8c6f4e', '#c0392b', '#d35400', '#27ae60', '#2980b9', '#8e44ad', '#7f8c8d']
const HIGHLIGHTS = ['#fff3a3', '#ffd6a5', '#ffa8a8', '#b8f2c9', '#a8d8ff', '#e0c3fc']

/* ---------- 组合树（由 store 节点组装） ---------- */
function build() {
  const live = work.liveMubu()
  const byParent = new Map()
  for (const n of live) {
    const p = n.parentId || null
    if (!byParent.has(p)) byParent.set(p, [])
    byParent.get(p).push(n)
  }
  const make = (n) => ({
    key: 'm:' + n.id,
    id: n.id,
    text: n.text || '',
    html: n.html ?? null,
    fold: !!n.fold,
    hasChildren: (byParent.get(n.id) || []).length > 0,
    parentId: n.parentId || null,
    children: (byParent.get(n.id) || []).map(make)
  })
  rows.value = (byParent.get(null) || []).map(make)
  nextTick(() => {
    syncAll()
    checkFocusFlash()
  })
}
watch(ver, build)
watch(
  () => work.mubu.length,
  () => ver.value++
)
watch(
  () => ui.loreFocusId,
  (id) => {
    if (!id) return
    ver.value++
    nextTick(() => {
      const el = rootEl.value?.querySelector(`[data-node="m:${id}"]`)
      if (!el) {
        work.mubuFoldAll(false)
        ver.value++
        nextTick(() => flashNode(id))
      } else flashNode(id)
    })
    ui.loreFocusId = null
  }
)
function flashNode(id) {
  const el = rootEl.value?.querySelector(`[data-node="m:${id}"]`)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  el.classList.add('ob-flash')
  setTimeout(() => el.classList.remove('ob-flash'), 1600)
}
function checkFocusFlash() {
  if (ui.loreFocusId) flashNode(ui.loreFocusId)
}
onMounted(build)

const visible = computed(() => {
  const out = []
  const walk = (list, depth) => {
    for (const n of list) {
      out.push({ node: n, depth })
      if (!n.fold) walk(n.children, depth + 1)
    }
  }
  walk(rows.value, 0)
  return out
})
const nodeCount = computed(() => work.mubu.filter((n) => !n.deletedAt).length)

/* ---------- 撤销 / 重做（快照 + 差异落库） ---------- */
function snapshotFlat() {
  return work.mubu.map((n) => ({
    id: n.id, parentId: n.parentId, sortOrder: n.sortOrder,
    text: n.text, html: n.html, fold: !!n.fold, deletedAt: n.deletedAt ?? null
  }))
}
function pushUndo() {
  undoStack.value.push(JSON.stringify(snapshotFlat()))
  if (undoStack.value.length > 60) undoStack.value.shift()
  redoStack.value = []
  lastSnap = Date.now()
}
async function undo() {
  if (!undoStack.value.length) return
  redoStack.value.push(JSON.stringify(snapshotFlat()))
  await work.mubuSyncTree(JSON.parse(undoStack.value.pop()))
  ver.value++
}
async function redo() {
  if (!redoStack.value.length) return
  undoStack.value.push(JSON.stringify(snapshotFlat()))
  await work.mubuSyncTree(JSON.parse(redoStack.value.pop()))
  ver.value++
}

/* ---------- 提交封装：FLIP 动画 + 重建 ---------- */
function captureRects() {
  const map = new Map()
  rootEl.value?.querySelectorAll('.ob-row').forEach((el) => map.set(el.dataset.node, el.getBoundingClientRect().top))
  return map
}
function playFlip(before) {
  rootEl.value?.querySelectorAll('.ob-row').forEach((el) => {
    const b = before.get(el.dataset.node)
    if (b == null) {
      el.classList.add('ob-appear')
      setTimeout(() => el.classList.remove('ob-appear'), 280)
      return
    }
    const d = b - el.getBoundingClientRect().top
    if (Math.abs(d) > 2) {
      el.style.transition = 'none'
      el.style.transform = `translateY(${d}px)`
      requestAnimationFrame(() => {
        el.style.transition = 'transform 0.22s cubic-bezier(0.2, 0.7, 0.3, 1)'
        el.style.transform = ''
        setTimeout(() => {
          el.style.transition = ''
        }, 240)
      })
    }
  })
}
function commit(mutate, focusKey = null, offset = 'end') {
  const before = captureRects()
  mutate()
  ver.value++
  nextTick(() => {
    playFlip(before)
    syncAll()
    if (focusKey) focusKeyFn(focusKey, offset)
  })
}

/* ---------- 焦点 ---------- */
function focusKeyFn(key, offset = 'end') {
  pending.key = key
  pending.offset = offset
  nextTick(applyFocus)
}
function applyFocus() {
  if (!pending.key || !rootEl.value) return
  const el = rootEl.value.querySelector(`[data-node="${pending.key}"] .ob-text`)
  if (!el) {
    pending.key = null
    return
  }
  el.focus()
  const range = document.createRange()
  const sel = window.getSelection()
  if (pending.offset === 'end' || pending.offset === 'start') {
    range.selectNodeContents(el)
    range.collapse(pending.offset === 'end' ? false : true)
  } else {
    const tn = el.firstChild
    if (tn && tn.nodeType === 3) {
      range.setStart(tn, Math.min(pending.offset, tn.textContent.length))
      range.collapse(true)
    } else {
      range.selectNodeContents(el)
      range.collapse(false)
    }
  }
  sel.removeAllRanges()
  sel.addRange(range)
  pending.key = null
}
function syncAll() {
  rootEl.value?.querySelectorAll('.ob-text').forEach((el) => {
    if (document.activeElement === el) return
    const key = el.closest('[data-node]')?.dataset.node
    const row = visible.value.find((r) => r.node.key === key)
    if (!row) return
    if (row.node.html != null) {
      if (el.innerHTML !== row.node.html) el.innerHTML = row.node.html
    } else if (el.textContent !== row.node.text) {
      el.textContent = row.node.text
    }
  })
}
onUpdated(syncAll)
function onTextFocus(e) {
  const row = e.currentTarget.closest('[data-node]')
  focusedId.value = row?.dataset.node || null
}

/* ---------- 编辑操作 ---------- */
function onInput(row, e) {
  const now = Date.now()
  if (now - lastSnap > 1200) pushUndo()
  const el = e.currentTarget
  work.mubuSetText(row.node.id, el.textContent || '', el.innerHTML)
}
function onPaste(e) {
  e.preventDefault()
  const t = e.clipboardData?.getData('text/plain') || ''
  if (t) document.execCommand('insertText', false, t)
}
function syncFocusedRow() {
  const el = document.activeElement
  if (!el || !el.classList?.contains('ob-text')) return
  const id = el.closest('[data-node]')?.dataset.node?.slice(2)
  if (id) work.mubuSetText(id, el.textContent || '', el.innerHTML)
}
function fmt(cmd, val = null) {
  pushUndo()
  document.execCommand(cmd, false, val)
  syncFocusedRow()
}

function addSibling(row) {
  pushUndo()
  const r = work.mubuAdd(row.node.parentId, row.node.id, '')
  commit(() => {}, 'm:' + r.id, 'start')
}
function addChild(row) {
  pushUndo()
  const r = work.mubuAdd(row.node.id, null, '')
  commit(() => {}, 'm:' + r.id, 'start')
}
function deleteRow(row) {
  pushUndo()
  work.mubuRemove(row.node.id)
  commit(() => {})
}
function onEnter(row) {
  const n = row.node
  if (!n.text && !hasChildren(n) && n.parentId) {
    pushUndo()
    work.mubuMove(n.id, 'm:' + n.parentId, 'after')
    commit(() => {}, n.key, 'end')
    return
  }
  pushUndo()
  const asChild = hasChildren(n) && !n.fold
  const r = work.mubuAdd(asChild ? n.id : n.parentId, asChild ? null : n.id, '')
  commit(() => {}, 'm:' + r.id, 'start')
}
function indent(row) {
  const sib = siblingsOf(row)
  const i = sib.findIndex((r) => r.node.key === row.node.key)
  if (i <= 0) return
  pushUndo()
  work.mubuMove(row.node.id, sib[i - 1].node.id, 'inside')
  commit(() => {}, row.node.key, 'end')
}
function outdent(row) {
  const n = row.node
  if (!n.parentId) return
  pushUndo()
  work.mubuMove(n.id, 'm:' + n.parentId, 'after')
  commit(() => {}, n.key, 'end')
}
function moveRow(row, dir) {
  pushUndo()
  work.mubuMoveOrder(row.node.id, dir)
  commit(() => {}, row.node.key, 'end')
}
function siblingsOf(row) {
  return visible.value.filter((r) => (r.node.parentId || null) === (row.node.parentId || null))
}
function hasChildren(n) {
  return work.mubuChildren(n.id).length > 0
}
function toggleFold(row) {
  if (!row.node.hasChildren) return
  work.mubuToggleFold(row.node.id)
  ver.value++
}
function foldAll(v) {
  work.mubuFoldAll(v)
  ver.value++
}

/* ---------- 节点复制 / 剪切 / 粘贴（子树） ---------- */
function collectTree(n) {
  const item = { text: n.text || '', html: n.html ?? null, fold: !!n.fold, children: [] }
  for (const c of work.mubuChildren(n.id)) item.children.push(collectTree(c))
  return item
}
function regenIds(list) {
  for (const n of list) {
    n.id = uid()
    regenIds(n.children || [])
  }
  return list
}
function copyNode(row, cut = false) {
  if (!row) return
  clip.value = [collectTree(row.node)]
  window.native?.clipboardWriteText?.(row.node.text)
  if (cut) {
    pushUndo()
    work.mubuRemove(row.node.id)
    commit(() => {})
  }
}
function pasteClip(asChild) {
  if (!clip.value) return
  pushUndo()
  const anchor = visible.value.find((r) => r.node.id === ctx.rowId) || visible.value[0]
  const clone = regenIds(JSON.parse(JSON.stringify(clip.value)))
  if (asChild) work.mubuAddTree(anchor.node.id, null, clone)
  else work.mubuAddTree(anchor.node.parentId, anchor.node.id, clone)
  commit(() => {}, 'm:' + (clone[0]?.id || ''), 'start')
}

/* ---------- 键盘 ---------- */
function caretOffsetFromStart(el) {
  const sel = window.getSelection()
  if (!sel.rangeCount) return -1
  const r = sel.getRangeAt(0).cloneRange()
  const probe = document.createRange()
  probe.selectNodeContents(el)
  probe.setEnd(r.startContainer, r.startOffset)
  return probe.toString().length
}
function onKey(row, e) {
  if (e.isComposing) return
  const el = e.currentTarget
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault()
    e.shiftKey ? redo() : undo()
    return
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
    e.preventDefault()
    redo()
    return
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
    e.preventDefault()
    fmt('bold')
    return
  }
  if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
    e.preventDefault()
    moveRow(row, e.key === 'ArrowUp' ? -1 : 1)
    return
  }
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    onEnter(row)
    return
  }
  if (e.key === 'Tab') {
    e.preventDefault()
    e.shiftKey ? outdent(row) : indent(row)
    return
  }
  if (e.key === 'Backspace' && caretOffsetFromStart(el) === 0) {
    e.preventDefault()
    onBackspace(row)
    return
  }
  const off = caretOffsetFromStart(el)
  const len = el.textContent.length
  if (e.key === 'ArrowUp' && (off === 0 || off === -1)) {
    const list = visible.value
    const i = list.findIndex((r) => r.node.key === row.node.key)
    if (i > 0) {
      e.preventDefault()
      focusKeyFn(list[i - 1].node.key, 'end')
    }
    return
  }
  if (e.key === 'ArrowDown' && (off === len || off === -1)) {
    const list = visible.value
    const i = list.findIndex((r) => r.node.key === row.node.key)
    if (i >= 0 && i < list.length - 1) {
      e.preventDefault()
      focusKeyFn(list[i + 1].node.key, 'start')
    }
  }
}
function onBackspace(row) {
  const sib = siblingsOf(row)
  const i = sib.findIndex((r) => r.node.key === row.node.key)
  const prev = i > 0 ? sib[i - 1] : null
  pushUndo()
  if (prev) {
    // 合并到上一节点
    work.mubuSetText(prev.node.id, prev.node.text + row.node.text)
    const r = document.querySelector(`[data-node="${prev.node.key}"] .ob-text`)
    const mergedHtml = (r ? r.innerHTML : '') + (row.node.html || '')
    work.mubuSetText(prev.node.id, prev.node.text, mergedHtml)
    if (row.node.children.length) {
      // 子节点上提到本层
      for (const c of [...row.node.children].reverse()) work.mubuMove(c.id, row.node.key, 'after')
    }
    work.mubuRemove(row.node.id)
    commit(() => {}, prev.node.key, 'end')
  } else if (row.node.parentId) {
    work.mubuMove(row.node.id, 'm:' + row.node.parentId, 'after')
    commit(() => {}, row.node.key, 'start')
  }
}

/* ---------- 拖拽（三区指示 + 悬停自动展开 + FLIP） ---------- */
function onDragStart(row, e) {
  drag.key = row.node.key
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', row.node.id)
}
function containsKey(node, key) {
  if (node.key === key) return true
  return node.children.some((c) => containsKey(c, key))
}
function onDragOver(row, e) {
  if (!drag.key || drag.key === row.node.key) return
  const src = visible.value.find((r) => r.node.key === drag.key)
  if (!src || containsKey(src.node, row.node.key)) return
  const r = e.currentTarget.getBoundingClientRect()
  const y = (e.clientY - r.top) / Math.max(1, r.height)
  drag.hintKey = row.node.key
  drag.zone = y < 0.28 ? 'before' : y > 0.72 ? 'after' : 'inside'
  if (row.node.fold && row.node.hasChildren) {
    if (expandTarget !== row.node.key) {
      clearTimeout(expandTimer)
      expandTarget = row.node.key
      expandTimer = setTimeout(() => {
        if (drag.key && drag.hintKey === row.node.key) {
          work.mubuToggleFold(row.node.id)
          ver.value++
        }
      }, 600)
    }
  } else if (expandTarget) {
    clearTimeout(expandTimer)
    expandTarget = null
  }
}
function onDrop(row) {
  clearTimeout(expandTimer)
  if (!drag.key || !drag.hintKey) return clearDrag()
  const src = visible.value.find((r) => r.node.key === drag.key)
  if (!src) return clearDrag()
  pushUndo()
  commit(() => work.mubuMove(src.node.id, row.node.id, drag.zone), src.node.key, 'end')
  clearDrag()
}
function onDropRoot() {
  clearTimeout(expandTimer)
  if (!drag.key) return clearDrag()
  const n = work.mubu.find((x) => x.id === drag.key.slice(2))
  if (!n) return clearDrag()
  pushUndo()
  const oldParent = n.parentId
  const roots = work.mubuChildren(null).filter((x) => x.id !== n.id)
  n.parentId = null
  n.sortOrder = roots.reduce((m, s) => Math.max(m, s.sortOrder || 0), -1000) + 1000
  work.mubuSetText(n.id, n.text, n.html ?? undefined)
  if (oldParent) work.mubuNormalize(oldParent)
  ver.value++
  nextTick(() => flashNode(n.id))
  clearDrag()
}
function clearDrag() {
  drag.key = null
  drag.hintKey = null
  drag.zone = null
}

/* ---------- 导入 MD / TXT ---------- */
async function importMd() {
  const files = await pickFiles(['md', 'markdown', 'txt'])
  if (!files.length) return
  pushUndo()
  let nodesAdded = 0
  const anchor = focusedId.value
  for (const f of files) {
    const { text } = decodeText(f.data)
    const tree = parseMubuMd(text)
    if (!tree.length) continue
    work.mubuAddTree(anchor || null, null, tree)
    nodesAdded += countTree(tree)
  }
  ver.value++
  nextTick(() => anchor && flashNode(anchor))
  window.$msg?.success(`导入完成：新增 ${nodesAdded} 个节点`)
}
function countTree(list) {
  let c = 0
  const walk = (l) => l.forEach((n) => (c++, walk(n.children || [])))
  walk(list)
  return c
}

/* ---------- 右键菜单 ---------- */
function onRowCtx(row, e) {
  e.preventDefault()
  try {
    const range = document.caretRangeFromPoint(e.clientX, e.clientY)
    if (range && rootEl.value?.contains(range.startContainer)) {
      const sel = window.getSelection()
      sel.removeAllRanges()
      const r = document.createRange()
      r.setStart(range.startContainer, range.startOffset)
      r.collapse(true)
      sel.addRange(r)
    }
  } catch {
    /* ignore */
  }
  ctx.open = true
  ctx.x = e.clientX
  ctx.y = e.clientY
  ctx.rowId = row.node.id
  ctx.folded = !!row.node.fold
  ctx.hasChildren = hasChildren(row.node)
}
function closeCtx() {
  ctx.open = false
}
function runCtx(fn) {
  fn()
  closeCtx()
  ver.value++
}
function ctxRow() {
  return visible.value.find((r) => r.node.id === ctx.rowId) || visible.value[0]
}
function toggleCtxFold() {
  if (ctx.hasChildren) work.mubuToggleFold(ctx.rowId)
}

/* ---------- 全局事件 ---------- */
function onWinMouseDown(e) {
  if (ctx.open && rootEl.value && !rootEl.value.contains(e.target)) closeCtx()
}
onMounted(() => {
  window.addEventListener('mousedown', onWinMouseDown, true)
  window.addEventListener('resize', closeCtx)
})
onBeforeUnmount(() => {
  window.removeEventListener('mousedown', onWinMouseDown, true)
  window.removeEventListener('resize', closeCtx)
  clearTimeout(expandTimer)
})
</script>

<template>
  <div ref="rootEl" style="flex: 1; display: flex; flex-direction: column; min-height: 0; padding: 16px 26px">
    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px">
      <span class="serif" style="font-size: 18px; font-weight: 700">设定</span>
      <span style="font-size: 12px; color: var(--text-dim)">幕布式自由大纲 · 所有内容皆节点</span>
      <div style="flex: 1"></div>
      <NButton size="tiny" @click="work.mubuFoldAll(true); ver++">全部折叠</NButton>
      <NButton size="tiny" @click="work.mubuFoldAll(false); ver++">全部展开</NButton>
    </div>

    <div class="ob-toolbar">
      <button class="tb" title="撤销 (Ctrl+Z)" :disabled="!undoStack.length" @click="undo()">↶</button>
      <button class="tb" title="重做 (Ctrl+Y)" :disabled="!redoStack.length" @click="redo()">↷</button>
      <span class="tb-sep" />
      <button class="tb" title="加粗" @mousedown.prevent @click="fmt('bold')"><b>B</b></button>
      <button class="tb" title="斜体" @mousedown.prevent @click="fmt('italic')"><i>I</i></button>
      <button class="tb" title="下划线" @mousedown.prevent @click="fmt('underline')"><u>U</u></button>
      <button class="tb" title="删除线" @mousedown.prevent @click="fmt('strikeThrough')"><s>S</s></button>
      <NPopover trigger="click" :show-arrow="false">
        <template #trigger>
          <button class="tb" title="字体颜色" @mousedown.prevent><span style="border-bottom: 3px solid var(--accent)">A</span></button>
        </template>
        <div class="ob-swatches">
          <button v-for="c in COLORS" :key="c" class="swatch" :style="{ background: c }" :title="c" @mousedown.prevent @click="fmt('foreColor', c)" />
        </div>
      </NPopover>
      <NPopover trigger="click" :show-arrow="false">
        <template #trigger>
          <button class="tb" title="底色" @mousedown.prevent>底</button>
        </template>
        <div class="ob-swatches">
          <button v-for="c in HIGHLIGHTS" :key="c" class="swatch" :style="{ background: c }" :title="c" @mousedown.prevent @click="fmt('hiliteColor', c)" />
        </div>
      </NPopover>
      <button class="tb" title="清除格式" @mousedown.prevent @click="fmt('removeFormat')">清除</button>
      <span class="tb-sep" />
      <button class="tb" title="导入 MD / TXT（标题层级自动转为节点层级）" @click="importMd">⬆ 导入</button>
      <span class="ob-count">{{ nodeCount }} 节点</span>
    </div>

    <div class="ob-editor" @dragover.prevent @drop.prevent="onDropRoot">
      <div
        v-for="row in visible"
        :key="row.node.key"
        class="ob-row"
        :data-node="row.node.key"
        :class="{
          'drop-before': drag.hintKey === row.node.key && drag.zone === 'before',
          'drop-after': drag.hintKey === row.node.key && drag.zone === 'after',
          'drop-inside': drag.hintKey === row.node.key && drag.zone === 'inside'
        }"
        @dragover.prevent="onDragOver(row, $event)"
        @drop.prevent.stop="onDrop(row)"
        @dragend="clearDrag"
        @contextmenu="onRowCtx(row, $event)"
      >
        <span v-for="d in row.depth" :key="d" class="ob-guide" />
        <button
          class="ob-bullet"
          :class="{ 'has-children': row.node.hasChildren, folded: row.node.fold }"
          :draggable="true"
          :title="row.node.hasChildren ? (row.node.fold ? '展开子节点' : '折叠子节点') : '拖拽移动节点'"
          @click="toggleFold(row)"
          @dragstart="onDragStart(row, $event)"
        />
        <div
          class="ob-text"
          contenteditable="true"
          spellcheck="false"
          :data-ph="row.node.text ? '' : '输入内容，回车新建节点…'"
          @input="onInput(row, $event)"
          @keydown="onKey(row, $event)"
          @paste="onPaste"
          @focus="onTextFocus"
        />
        <span class="ob-ops">
          <button class="ob-op" title="添加子节点" @click.stop="addChild(row)">＋</button>
          <button class="ob-op" title="删除节点" @click.stop="deleteRow(row)">✕</button>
        </span>
      </div>
      <div class="ob-tip">回车 新建节点 · Tab / Shift+Tab 降级升级 · Alt+↑↓ 排序 · 点圆点 折叠 · 拖圆点 移动（拖到空白处移到顶层） · 选中文字后可用工具栏或右键设置格式</div>

      <div v-if="ctx.open" class="ob-ctx" :style="{ left: ctx.x + 'px', top: ctx.y + 'px' }" @contextmenu.prevent>
        <div class="ctx-item" @mousedown.prevent @click="runCtx(() => copyNode(visible.find((r) => r.node.id === ctx.rowId)))"><span>复制节点</span></div>
        <div class="ctx-item" @mousedown.prevent @click="runCtx(() => copyNode(visible.find((r) => r.node.id === ctx.rowId), true))"><span>剪切节点</span></div>
        <div class="ctx-item" :class="{ disabled: !clip }" @mousedown.prevent @click="!clip && runCtx(() => pasteClip(false))"><span>粘贴为同级</span></div>
        <div class="ctx-item" :class="{ disabled: !clip }" @mousedown.prevent @click="!clip && runCtx(() => pasteClip(true))"><span>粘贴为子节点</span></div>
        <div class="ctx-sep" />
        <div class="ctx-item" @mousedown.prevent @click="runCtx(() => fmt('bold'))"><span>加粗</span><span class="hint">Ctrl+B</span></div>
        <div class="ctx-item" @mousedown.prevent @click="runCtx(() => fmt('italic'))"><span>斜体</span></div>
        <div class="ctx-item" @mousedown.prevent @click="runCtx(() => fmt('underline'))"><span>下划线</span></div>
        <div class="ctx-item" @mousedown.prevent @click="runCtx(() => fmt('strikeThrough'))"><span>删除线</span></div>
        <div class="ob-ctx-colors" @mousedown.prevent>
          <span style="font-size: 11px; color: var(--text-dim)">颜色</span>
          <button v-for="c in COLORS" :key="c" class="swatch" :style="{ background: c }" :title="c" @mousedown.prevent @click="runCtx(() => fmt('foreColor', c))" />
        </div>
        <div class="ob-ctx-colors" @mousedown.prevent>
          <span style="font-size: 11px; color: var(--text-dim)">底色</span>
          <button v-for="c in HIGHLIGHTS" :key="c" class="swatch" :style="{ background: c }" :title="c" @mousedown.prevent @click="runCtx(() => fmt('hiliteColor', c))" />
        </div>
        <div class="ctx-item" @mousedown.prevent @click="runCtx(() => fmt('removeFormat'))"><span>清除格式</span></div>
        <div class="ctx-sep" />
        <div class="ctx-item" @mousedown.prevent @click="runCtx(() => indent(visible.find((r) => r.node.id === ctx.rowId)))"><span>降级</span><span class="hint">Tab</span></div>
        <div class="ctx-item" @mousedown.prevent @click="runCtx(() => outdent(visible.find((r) => r.node.id === ctx.rowId)))"><span>升级</span><span class="hint">Shift+Tab</span></div>
        <div class="ctx-item" @mousedown.prevent @click="runCtx(() => moveRow(visible.find((r) => r.node.id === ctx.rowId), -1))"><span>上移</span></div>
        <div class="ctx-item" @mousedown.prevent @click="runCtx(() => moveRow(visible.find((r) => r.node.id === ctx.rowId), 1))"><span>下移</span></div>
        <div class="ctx-sep" />
        <div class="ctx-item" @mousedown.prevent @click="runCtx(() => addSibling(visible.find((r) => r.node.id === ctx.rowId)))"><span>新建同级节点</span></div>
        <div class="ctx-item" @mousedown.prevent @click="runCtx(() => addChild(visible.find((r) => r.node.id === ctx.rowId)))"><span>新建子节点</span></div>
        <div v-if="ctx.hasChildren" class="ctx-item" @mousedown.prevent @click="runCtx(toggleCtxFold)"><span>{{ ctx.folded ? '展开子节点' : '折叠子节点' }}</span></div>
        <div class="ctx-item" @mousedown.prevent @click="runCtx(() => deleteRow(visible.find((r) => r.node.id === ctx.rowId)))"><span>删除节点</span></div>
        <div class="ctx-sep" />
        <div class="ctx-item" @mousedown.prevent @click="runCtx(undo)"><span>撤销</span><span class="hint">Ctrl+Z</span></div>
        <div class="ctx-item" @mousedown.prevent @click="runCtx(redo)"><span>重做</span><span class="hint">Ctrl+Y</span></div>
      </div>
    </div>
  </div>
</template>
