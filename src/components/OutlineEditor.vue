<script setup>
import { ref, reactive, computed, watch, nextTick, onMounted, onUpdated, onBeforeUnmount } from 'vue'
import { NPopover } from 'naive-ui'
import { uid } from '../db/database'

const props = defineProps({ lore: { type: Object, required: true } })
const emit = defineEmits(['change'])

const tree = ref([])
const rootEl = ref(null)
const pending = reactive({ id: null, offset: 'end' })
const drag = reactive({ id: null, hintId: null, zone: null })
const focusedId = ref(null)
const ctx = reactive({ open: false, x: 0, y: 0, rowId: null })
const clip = ref(null) // 节点剪贴板（子树）

const node = (text = '', html = null) => ({ id: uid(), text, fold: false, children: [], ...(html ? { html } : {}) })

/* ---------- 构建 / 迁移 ---------- */
function fromText(text = '') {
  const roots = []
  const stack = [{ depth: -1, list: roots }]
  for (const line of String(text || '').split('\n')) {
    if (!line.trim()) continue
    const indent = (line.match(/^[\t ]*/)?.[0] ?? '').replace(/\t/g, '  ').length
    const depth = Math.floor(indent / 2)
    const n = node(line.trim())
    while (stack.length && stack[stack.length - 1].depth >= depth) stack.pop()
    stack[stack.length - 1].list.push(n)
    stack.push({ depth, list: n.children })
  }
  return roots.length ? roots : [node()]
}
function buildFromLore() {
  const l = props.lore
  if (l && l.fmt === 'outline') {
    try {
      tree.value = JSON.parse(l.content || '[]')
    } catch {
      tree.value = [node()]
    }
  } else {
    tree.value = fromText(l ? l.content : '')
  }
  if (!tree.value.length) tree.value = [node()]
  nextTick(syncAll)
}
watch(() => props.lore && props.lore.id, buildFromLore)
onMounted(buildFromLore)

function changed() {
  if (tree.value.length) emit('change', tree.value)
}

/* ---------- 撤销 / 重做（快照式，输入合并） ---------- */
const undoStack = ref([])
const redoStack = ref([])
let lastSnap = 0
function pushUndo() {
  undoStack.value.push(JSON.stringify(tree.value))
  if (undoStack.value.length > 60) undoStack.value.shift()
  redoStack.value = []
  lastSnap = Date.now()
}
function undo() {
  if (!undoStack.value.length) return
  redoStack.value.push(JSON.stringify(tree.value))
  tree.value = JSON.parse(undoStack.value.pop())
  changed()
  nextTick(syncAll)
}
function redo() {
  if (!redoStack.value.length) return
  undoStack.value.push(JSON.stringify(tree.value))
  tree.value = JSON.parse(redoStack.value.pop())
  changed()
  nextTick(syncAll)
}

/* ---------- 树定位 ---------- */
function locate(id, list = tree.value, parent = null, parentList = null) {
  for (let i = 0; i < list.length; i++) {
    const n = list[i]
    if (n.id === id) return { node: n, list, index: i, parent, parentList }
    const found = locate(id, n.children, n, list)
    if (found) return found
  }
  return null
}
function contains(node, id) {
  if (node.id === id) return true
  return node.children.some((c) => contains(c, id))
}

const visible = computed(() => {
  const rows = []
  const walk = (list, depth) => {
    for (const n of list) {
      rows.push({ node: n, depth })
      if (!n.fold) walk(n.children, depth + 1)
    }
  }
  walk(tree.value, 0)
  return rows
})
const nodeCount = computed(() => {
  let c = 0
  const walk = (list) => list.forEach((n) => (c++, walk(n.children)))
  walk(tree.value)
  return c
})

/* ---------- 焦点 ---------- */
function focusNode(id, offset = 'end') {
  pending.id = id
  pending.offset = offset
  nextTick(applyFocus)
}
function applyFocus() {
  if (!pending.id || !rootEl.value) return
  const el = rootEl.value.querySelector(`[data-node="${pending.id}"] .ob-text`)
  if (!el) {
    pending.id = null
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
  pending.id = null
}

/* 非聚焦行的内容同步（聚焦行以用户输入为准，避免光标跳动；html 行恢复富文本） */
function syncAll() {
  rootEl.value?.querySelectorAll('.ob-text').forEach((el) => {
    if (document.activeElement === el) return
    const id = el.closest('[data-node]')?.dataset.node
    const f = id && locate(id)
    if (!f) return
    if (f.node.html != null) {
      if (el.innerHTML !== f.node.html) el.innerHTML = f.node.html
    } else if (el.textContent !== f.node.text) {
      el.textContent = f.node.text
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
  row.node.text = el.textContent || ''
  row.node.html = el.innerHTML
  changed()
}
function onPaste(e) {
  e.preventDefault()
  const t = e.clipboardData?.getData('text/plain') || ''
  if (t) document.execCommand('insertText', false, t)
}

function syncFocusedRow() {
  const el = document.activeElement
  if (!el || !el.classList?.contains('ob-text')) return
  const id = el.closest('[data-node]')?.dataset.node
  const f = id && locate(id)
  if (f) {
    f.node.text = el.textContent || ''
    f.node.html = el.innerHTML
    changed()
  }
}

/* 内联格式（作用于节点内选中文字；无选区时为后续输入设置格式） */
function fmt(cmd, val = null) {
  pushUndo()
  document.execCommand(cmd, false, val)
  syncFocusedRow()
  try {
    rootEl.value?.querySelector('.ob-text:focus')?.blur?.()
  } catch {
    /* ignore */
  }
}

function onEnter(row) {
  const f = locate(row.node.id)
  if (!f) return
  if (!f.node.text.trim() && !f.node.children.length && f.parent) {
    outdent(row.node.id)
    return
  }
  const fresh = node()
  if (f.node.children.length && !f.node.fold) f.node.children.unshift(fresh)
  else f.list.splice(f.index + 1, 0, fresh)
  changed()
  focusNode(fresh.id, 'start')
}
function indent(id) {
  const f = locate(id)
  if (!f || f.index === 0) return
  pushUndo()
  const prev = f.list[f.index - 1]
  f.list.splice(f.index, 1)
  prev.children.push(f.node)
  prev.fold = false
  changed()
  focusNode(id, 'end')
}
function outdent(id) {
  const f = locate(id)
  if (!f || !f.parent) return
  pushUndo()
  const pIdx = f.parentList.indexOf(f.parent)
  f.list.splice(f.index, 1)
  f.parentList.splice(pIdx + 1, 0, f.node)
  changed()
  focusNode(id, 'end')
}
function moveRow(id, dir) {
  const f = locate(id)
  if (!f) return
  const ni = f.index + dir
  if (ni < 0 || ni >= f.list.length) return
  pushUndo()
  ;[f.list[f.index], f.list[ni]] = [f.list[ni], f.list[f.index]]
  changed()
  focusNode(id, 'end')
}
function onBackspace(row) {
  const f = locate(row.node.id)
  if (!f) return
  pushUndo()
  if (f.index > 0) {
    const prev = f.list[f.index - 1]
    prev.text += row.node.text
    prev.html = (prev.html || '') + (row.node.html || '')
    prev.children.push(...row.node.children)
    f.list.splice(f.index, 1)
    changed()
    focusNode(prev.id, 'end')
  } else if (f.parent) {
    const pIdx = f.parentList.indexOf(f.parent)
    f.parent.text += row.node.text
    f.parent.html = (f.parent.html || '') + (row.node.html || '')
    f.parentList.splice(pIdx + 1, 0, ...row.node.children)
    f.list.splice(f.index, 1)
    changed()
    focusNode(f.parent.id, 'end')
  }
}
function addSibling(row) {
  const f = locate(row.node.id)
  if (!f) return
  pushUndo()
  const fresh = node()
  f.list.splice(f.index + 1, 0, fresh)
  changed()
  focusNode(fresh.id, 'start')
}
function addChild(row) {
  const f = locate(row.node.id)
  if (!f) return
  pushUndo()
  const fresh = node()
  f.node.children.push(fresh)
  f.node.fold = false
  changed()
  focusNode(fresh.id, 'start')
}
function deleteRow(row) {
  const f = locate(row.node.id)
  if (!f) return
  pushUndo()
  const rows = visible.value
  const i = rows.findIndex((r) => r.node.id === row.node.id)
  const prev = rows[i - 1] || rows[i + 1]
  f.list.splice(f.index, 1)
  if (!f.list.length && !f.parent) f.list.push(node())
  changed()
  focusNode(prev ? prev.node.id : visible.value[0]?.node.id, 'end')
}
function toggleFold(row) {
  if (!row.node.children.length) return
  row.node.fold = !row.node.fold
  changed()
}
function foldAll(v) {
  pushUndo()
  const walk = (list) => list.forEach((n) => (n.children.length && ((n.fold = v), walk(n.children))))
  walk(tree.value)
  changed()
}

/* ---------- 节点复制 / 剪切 / 粘贴（子树） ---------- */
function regenIds(list) {
  const walk = (n) => {
    n.id = uid()
    n.children.forEach(walk)
  }
  list.forEach(walk)
  return list
}
function copyNode(row, cut = false) {
  const f = locate(row.node.id)
  if (!f) return
  clip.value = JSON.parse(JSON.stringify([f.node]))
  window.native?.clipboardWriteText?.(row.node.text)
  if (cut) {
    pushUndo()
    f.list.splice(f.index, 1)
    if (!f.list.length && !f.parent) f.list.push(node())
    changed()
    focusNode(visible.value[0]?.node.id, 'end')
  }
}
function pasteNode(row, asChild) {
  if (!clip.value) return
  const f = locate(row.node.id)
  if (!f) return
  pushUndo()
  const clone = regenIds(JSON.parse(JSON.stringify(clip.value)))
  if (asChild) {
    f.node.children.push(...clone)
    f.node.fold = false
  } else {
    f.list.splice(f.index + 1, 0, ...clone)
  }
  changed()
  focusNode(clone[0].id, 'start')
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
    moveRow(row.node.id, e.key === 'ArrowUp' ? -1 : 1)
    return
  }
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    onEnter(row)
    return
  }
  if (e.key === 'Tab') {
    e.preventDefault()
    e.shiftKey ? outdent(row.node.id) : indent(row.node.id)
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
    const rows = visible.value
    const i = rows.findIndex((r) => r.node.id === row.node.id)
    if (i > 0) {
      e.preventDefault()
      focusNode(rows[i - 1].node.id, 'end')
    }
    return
  }
  if (e.key === 'ArrowDown' && (off === len || off === -1)) {
    const rows = visible.value
    const i = rows.findIndex((r) => r.node.id === row.node.id)
    if (i >= 0 && i < rows.length - 1) {
      e.preventDefault()
      focusNode(rows[i + 1].node.id, 'start')
    }
  }
}

/* ---------- 拖拽 ---------- */
function onDragStart(row, e) {
  drag.id = row.node.id
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', row.node.id)
}
function onDragOver(row, e) {
  if (!drag.id || drag.id === row.node.id) return
  const d = locate(drag.id)
  if (!d || contains(d.node, row.node.id)) return
  const r = e.currentTarget.getBoundingClientRect()
  const y = (e.clientY - r.top) / Math.max(1, r.height)
  drag.hintId = row.node.id
  drag.zone = y < 0.3 ? 'before' : y > 0.7 ? 'after' : 'inside'
}
function onDrop(row) {
  if (!drag.id || !drag.hintId) return clearDrag()
  const d = locate(drag.id)
  const t = locate(row.node.id)
  if (!d || !t) return clearDrag()
  pushUndo()
  d.list.splice(d.index, 1)
  if (drag.zone === 'inside') {
    t.node.children.push(d.node)
    t.node.fold = false
  } else {
    let i = t.list.indexOf(t.node)
    if (drag.zone === 'after') i += 1
    t.list.splice(i, 0, d.node)
  }
  changed()
  focusNode(d.node.id, 'end')
  clearDrag()
}
function clearDrag() {
  drag.id = null
  drag.hintId = null
  drag.zone = null
}

/* ---------- 右键菜单 ---------- */
const COLORS = ['#3c3427', '#8c6f4e', '#c0392b', '#d35400', '#27ae60', '#2980b9', '#8e44ad', '#7f8c8d']
const HIGHLIGHTS = ['#fff3a3', '#ffd6a5', '#ffa8a8', '#b8f2c9', '#a8d8ff', '#e0c3fc']

function onRowCtx(row, e) {
  e.preventDefault()
  // 光标定位到右键处（若不在当前选区内）
  try {
    const range = document.caretRangeFromPoint(e.clientX, e.clientY)
    if (range && rootEl.value?.contains(range.startContainer)) {
      const sel = window.getSelection()
      const cur = sel.isCollapsed ? null : sel.getRangeAt(0)
      if (!cur || !cur.intersectsNode(range.startContainer) || !sel.containsNode(range.startContainer, true)) {
        sel.removeAllRanges()
        const r = document.createRange()
        r.setStart(range.startContainer, range.startOffset)
        r.collapse(true)
        sel.addRange(r)
      }
    }
  } catch {
    /* ignore */
  }
  ctx.open = true
  ctx.x = e.clientX
  ctx.y = e.clientY
  ctx.rowId = row.node.id
}
function closeCtx() {
  ctx.open = false
}
function runCtx(fn) {
  fn()
  closeCtx()
}
const curRow = computed(() => visible.value.find((r) => r.node.id === ctx.rowId) || null)

function onWinMouseDown(e) {
  if (ctx.open && rootEl.value && !rootEl.value.contains(e.target)) closeCtx()
  if (ctx.open && rootEl.value?.contains(e.target) && !e.target.closest('.ob-ctx')) closeCtx()
}
onMounted(() => window.addEventListener('mousedown', onWinMouseDown, true))
onBeforeUnmount(() => window.removeEventListener('mousedown', onWinMouseDown, true))
</script>

<template>
  <div ref="rootEl" class="ob-wrap">
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
      <button class="tb" title="新建同级节点" @click="focusedId && addSibling(visible.find((r) => r.node.id === focusedId) || visible[0])">＋同级</button>
      <button class="tb" title="新建子节点" @click="focusedId && addChild(visible.find((r) => r.node.id === focusedId) || visible[0])">＋子级</button>
      <button class="tb" title="升级 (Shift+Tab)" @click="focusedId && outdent(focusedId)">⇤</button>
      <button class="tb" title="降级 (Tab)" @click="focusedId && indent(focusedId)">⇥</button>
      <button class="tb" title="上移 (Alt+↑)" @click="focusedId && moveRow(focusedId, -1)">↑</button>
      <button class="tb" title="下移 (Alt+↓)" @click="focusedId && moveRow(focusedId, 1)">↓</button>
      <span class="tb-sep" />
      <button class="tb" title="全部折叠" @click="foldAll(true)">折叠</button>
      <button class="tb" title="全部展开" @click="foldAll(false)">展开</button>
      <span class="ob-count">{{ nodeCount }} 节点</span>
    </div>

    <div class="ob-editor">
      <div
        v-for="row in visible"
        :key="row.node.id"
        class="ob-row"
        :data-node="row.node.id"
        :class="{
          'drop-before': drag.hintId === row.node.id && drag.zone === 'before',
          'drop-after': drag.hintId === row.node.id && drag.zone === 'after',
          'drop-inside': drag.hintId === row.node.id && drag.zone === 'inside'
        }"
        @dragover.prevent="onDragOver(row, $event)"
        @drop.prevent="onDrop(row)"
        @dragend="clearDrag"
        @contextmenu="onRowCtx(row, $event)"
      >
        <span v-for="d in row.depth" :key="d" class="ob-guide" />
        <button
          class="ob-bullet"
          :class="{ 'has-children': row.node.children.length, folded: row.node.fold }"
          :draggable="true"
          :title="row.node.children.length ? (row.node.fold ? '展开子节点' : '折叠子节点') : '拖拽移动节点'"
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
      <div class="ob-tip">回车 新建节点 · Tab / Shift+Tab 降级升级 · Alt+↑↓ 移动 · 点圆点 折叠 · 拖圆点 移动 · 选中文字后用上方工具栏或右键设置格式</div>

      <div v-if="ctx.open" class="ob-ctx" :style="{ left: ctx.x + 'px', top: ctx.y + 'px' }" @contextmenu.prevent>
        <div class="ctx-item" @mousedown.prevent @click="runCtx(() => copyNode(curRow || visible[0]))"><span>复制节点</span></div>
        <div class="ctx-item" @mousedown.prevent @click="runCtx(() => copyNode(curRow || visible[0], true))"><span>剪切节点</span></div>
        <div class="ctx-item" :class="{ disabled: !clip }" @mousedown.prevent @click="!clip && runCtx(() => pasteNode(curRow || visible[0], false))"><span>粘贴为同级</span></div>
        <div class="ctx-item" :class="{ disabled: !clip }" @mousedown.prevent @click="!clip && runCtx(() => pasteNode(curRow || visible[0], true))"><span>粘贴为子节点</span></div>
        <div class="ctx-sep" />
        <div class="ctx-item" @mousedown.prevent @click="runCtx(() => fmt('bold'))"><span>加粗</span><span class="hint">Ctrl+B</span></div>
        <div class="ctx-item" @mousedown.prevent @click="runCtx(() => fmt('italic'))"><span>斜体</span></div>
        <div class="ctx-item" @mousedown.prevent @click="runCtx(() => fmt('underline'))"><span>下划线</span></div>
        <div class="ctx-item" @mousedown.prevent @click="runCtx(() => fmt('strikeThrough'))"><span>删除线</span></div>
        <div class="ctx-item" @mousedown.prevent @click="runCtx(() => fmt('removeFormat'))"><span>清除格式</span></div>
        <div class="ob-ctx-colors" @mousedown.prevent>
          <span style="font-size: 11px; color: var(--text-dim)">颜色</span>
          <button v-for="c in COLORS" :key="c" class="swatch" :style="{ background: c }" :title="c" @mousedown.prevent @click="runCtx(() => fmt('foreColor', c))" />
        </div>
        <div class="ob-ctx-colors" @mousedown.prevent>
          <span style="font-size: 11px; color: var(--text-dim)">底色</span>
          <button v-for="c in HIGHLIGHTS" :key="c" class="swatch" :style="{ background: c }" :title="c" @mousedown.prevent @click="runCtx(() => fmt('hiliteColor', c))" />
        </div>
        <div class="ctx-sep" />
        <div class="ctx-item" @mousedown.prevent @click="runCtx(() => indent(ctx.rowId))"><span>降级</span><span class="hint">Tab</span></div>
        <div class="ctx-item" @mousedown.prevent @click="runCtx(() => outdent(ctx.rowId))"><span>升级</span><span class="hint">Shift+Tab</span></div>
        <div class="ctx-item" @mousedown.prevent @click="runCtx(() => moveRow(ctx.rowId, -1))"><span>上移</span></div>
        <div class="ctx-item" @mousedown.prevent @click="runCtx(() => moveRow(ctx.rowId, 1))"><span>下移</span></div>
        <div class="ctx-sep" />
        <div class="ctx-item" @mousedown.prevent @click="runCtx(() => addSibling(curRow || visible[0]))"><span>新建同级节点</span></div>
        <div class="ctx-item" @mousedown.prevent @click="runCtx(() => addChild(curRow || visible[0]))"><span>新建子节点</span></div>
        <div class="ctx-item" @mousedown.prevent @click="runCtx(() => deleteRow(curRow || visible[0]))"><span>删除节点</span></div>
        <div class="ctx-sep" />
        <div class="ctx-item" @mousedown.prevent @click="runCtx(undo)"><span>撤销</span><span class="hint">Ctrl+Z</span></div>
        <div class="ctx-item" @mousedown.prevent @click="runCtx(redo)"><span>重做</span><span class="hint">Ctrl+Y</span></div>
      </div>
    </div>
  </div>
</template>
