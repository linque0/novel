<script setup>
import { ref, reactive, computed, watch, nextTick, onMounted, onUpdated } from 'vue'
import { NButton } from 'naive-ui'
import { useWorkStore } from '../stores/work'

const work = useWorkStore()
const rootEl = ref(null)
const ver = ref(0) // 结构版本：结构操作后 +1 触发重建
const rows = ref([])
const pending = reactive({ key: null, offset: 'end' })
const drag = reactive({ key: null, hintKey: null, zone: null })

/* ---------- 组合树构建（文件夹 → 条目 → 大纲文本） ---------- */
function build() {
  const fById = new Map(work.liveCategories.map((c) => [c.id, c]))
  const folderNode = (c) => {
    const children = [
      ...work.liveCategories.filter((x) => x.parentId === c.id).map(folderNode),
      ...work.liveLore.filter((l) => (l.categoryId || null) === c.id).map(entryNode)
    ]
    return { key: 'f:' + c.id, kind: 'folder', id: c.id, pid: c.parentId || null, text: c.name || '未命名文件夹', fold: false, children }
  }
  const entryNode = (l) => {
    let texts = []
    if (l.fmt === 'outline') {
      try {
        texts = JSON.parse(l.content || '[]')
      } catch {
        texts = []
      }
    } else if ((l.content || '').trim()) {
      texts = [{ id: 't-root-' + l.id, text: l.content }]
    }
    return {
      key: 'e:' + l.id,
      kind: 'entry',
      id: l.id,
      pid: (l.categoryId || null),
      text: l.title || '未命名条目',
      fold: false,
      children: texts.map((t) => ({ key: 't:' + t.id, kind: 'text', id: t.id, loreId: l.id, pid: l.id, text: t.text || '', fold: false, children: [] }))
    }
  }
  const roots = [
    ...work.liveCategories.filter((c) => !c.parentId || !fById.has(c.parentId)).map(folderNode),
    ...work.liveLore.filter((l) => !l.categoryId || !fById.has(l.categoryId)).map(entryNode)
  ]
  rows.value = roots
  nextTick(syncAll)
}
watch(ver, build)
watch(() => work.loreView, (v) => v === 'overview' && build())
onMounted(() => work.loreView === 'overview' && build())

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

/* ---------- 焦点 ---------- */
function focusKey(key, offset = 'end') {
  pending.key = key
  pending.offset = offset
  nextTick(applyFocus)
}
function applyFocus() {
  if (!pending.key || !rootEl.value) return
  const el = rootEl.value.querySelector(`[data-key="${pending.key}"] .ob-text`)
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
    const key = el.closest('[data-key]')?.dataset.key
    const row = visible.value.find((r) => r.node.key === key)
    if (row && el.textContent !== row.node.text) el.textContent = row.node.text
  })
}
onUpdated(syncAll)

/* ---------- 文本修改（直接写对应 store，不重建） ---------- */
function onInput(row, e) {
  const n = row.node
  n.text = e.currentTarget.textContent || ''
  if (n.kind === 'folder') work.updateLorecat(n.id, { name: n.text })
  else if (n.kind === 'entry') work.updateLore(n.id, { title: n.text })
  else work.updateOutlineNodeText(n.loreId, n.id, n.text)
}

/* ---------- 结构操作（操作 store 后重建） ---------- */
function rebuild(focusKeyAfter, offset = 'end') {
  ver.value++
  nextTick(() => focusKey(focusKeyAfter, offset))
}
function onEnter(row) {
  const n = row.node
  if (n.kind === 'folder') {
    const cat = work.addCategory('新文件夹', n.pid)
    rebuild('f:' + cat.id, 'start')
  } else if (n.kind === 'entry') {
    const l = work.addLore(n.pid)
    rebuild('e:' + l.id, 'start')
  } else {
    const nid = work.insertOutlineNodeAfter(n.loreId, n.id, '')
    if (nid) rebuild('t:' + nid, 'start')
  }
}
function indent(row) {
  const n = row.node
  const sib = siblingsOf(n)
  const i = sib.findIndex((s) => s.key === n.key)
  const prev = i > 0 ? sib[i - 1] : null
  if (!prev) return
  if (n.kind === 'folder') {
    if (prev.kind !== 'folder') return
    work.moveCategoryTo(n.id, prev.id)
  } else if (n.kind === 'entry') {
    if (prev.kind !== 'folder') return
    work.moveLoreTo(n.id, prev.id)
  } else return
  rebuild(n.key, 'end')
}
function outdent(row) {
  const n = row.node
  if (n.kind === 'text') return
  const parentFolderId = n.pid || null
  if (!parentFolderId) return
  const parent = rows.value.find((r) => r.key === 'f:' + parentFolderId)
  const gp = parent ? parent.pid || null : null
  if (n.kind === 'folder') work.moveCategoryTo(n.id, gp)
  else work.moveLoreTo(n.id, gp)
  rebuild(n.key, 'end')
}
function siblingsOf(n) {
  if (!n.pid) return rows.value.filter((r) => r.node.pid == null && r.node.kind === n.kind)
  const p = rows.value.find((r) => r.key === (n.kind === 'entry' ? 'f:' + n.pid : 'f:' + n.pid))
  const parentNode = p ? findNode(rows.value, p.key) : null
  const list = parentNode ? parentNode.children : rows.value.filter((r) => r.node.pid == null && r.node.kind === n.kind)
  return list.filter((r) => r.node.kind === n.kind)
}
function findNode(list, key) {
  for (const n of list) {
    if (n.key === key) return n
    const f = findNode(n.children, key)
    if (f) return f
  }
  return null
}
function moveRow(row, dir) {
  const n = row.node
  if (n.kind === 'folder') {
    const sibs = work.liveCategories.filter((c) => (c.parentId || null) === (n.pid || null))
    const i = sibs.findIndex((c) => c.id === n.id)
    const j = i + dir
    if (j < 0 || j >= sibs.length) return
    sibs.forEach((c, idx) => work.updateLorecat(c.id, { sortOrder: idx * 1000 }))
    work.updateLorecat(n.id, { sortOrder: sibs[j].sortOrder })
    work.updateLorecat(sibs[j].id, { sortOrder: sibs[i].sortOrder })
    ver.value++
  } else if (n.kind === 'entry') {
    work.reorderLore(n.id, dir)
    ver.value++
  } else {
    work.moveOutlineNode(n.loreId, n.id, dir)
  }
}
function deleteNode(row) {
  const n = row.node
  if (n.kind === 'folder') work.deleteCategory(n.id)
  else if (n.kind === 'entry') work.deleteLore(n.id)
  else work.removeOutlineNode(n.loreId, n.id)
  ver.value++
}
function confirmDelete(row) {
  window.$dlg?.warning({
    title: '删除',
    content: row.node.kind === 'folder' ? '删除该文件夹？其中子文件夹与条目会上提一级，不会丢失。' : row.node.kind === 'entry' ? '删除该条目？可在回收站恢复。' : '删除该内容节点？',
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: () => deleteNode(row)
  })
}
function toggleFold(row) {
  if (!row.node.children.length) return
  row.node.fold = !row.node.fold
}
function foldAll(v) {
  visible.value.forEach((r) => {
    if (r.node.children.length) r.node.fold = v
  })
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
    window.$msg?.info('总览视图暂不支持撤销，请在详情视图中操作')
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
    const n = row.node
    if (n.kind === 'text') {
      window.$msg?.info('文本节点请在详情视图或用删除按钮移除')
      return
    }
    window.$dlg?.warning({
      title: '删除',
      content: n.kind === 'folder' ? '删除该文件夹？其中子文件夹与条目会上提一级，不会丢失。' : '删除该条目？可在回收站恢复。',
      positiveText: '删除',
      negativeText: '取消',
      onPositiveClick: () => {
        deleteNode(row)
      }
    })
    return
  }
  const off = caretOffsetFromStart(el)
  const len = el.textContent.length
  if (e.key === 'ArrowUp' && (off === 0 || off === -1)) {
    const list = visible.value
    const i = list.findIndex((r) => r.node.key === row.node.key)
    if (i > 0) {
      e.preventDefault()
      focusKey(list[i - 1].node.key, 'end')
    }
    return
  }
  if (e.key === 'ArrowDown' && (off === len || off === -1)) {
    const list = visible.value
    const i = list.findIndex((r) => r.node.key === row.node.key)
    if (i >= 0 && i < list.length - 1) {
      e.preventDefault()
      focusKey(list[i + 1].node.key, 'start')
    }
  }
}

/* ---------- 拖拽（同类别重排 / 跨文件夹移动） ---------- */
function onDragStart(row, e) {
  drag.key = row.node.key
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', row.node.key)
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
  drag.zone = y < 0.3 ? 'before' : y > 0.7 ? 'after' : 'inside'
}
function onDrop(row) {
  if (!drag.key || !drag.hintKey) return clearDrag()
  const src = visible.value.find((r) => r.node.key === drag.key)
  const n = row.node
  if (!src) return clearDrag()
  if (n.kind === 'folder' && drag.zone === 'inside') {
    if (src.node.kind === 'folder') work.moveCategoryTo(src.node.id, n.id)
    else if (src.node.kind === 'entry') work.moveLoreTo(src.node.id, n.id)
  } else if (src.node.kind === 'entry' && n.kind === 'entry') {
    work.reorderLore(src.node.id, n.key === drag.key ? 0 : visible.value.findIndex((r) => r.node.key === n.key) > visible.value.findIndex((r) => r.node.key === src.node.key) ? 1 : -1)
  } else if (src.node.kind === 'folder' && n.kind === 'folder') {
    const sibs = work.liveCategories.filter((c) => (c.parentId || null) === (n.pid || null))
    const i = sibs.findIndex((c) => c.id === src.node.id)
    const j = sibs.findIndex((c) => c.id === n.id)
    if (i >= 0 && j >= 0 && i !== j) {
      work.updateLorecat(src.node.id, { sortOrder: sibs[j].sortOrder })
      work.updateLorecat(n.id, { sortOrder: sibs[i].sortOrder })
    }
  } else if (src.node.kind === 'text' && n.kind === 'text' && src.node.loreId === n.loreId) {
    work.moveOutlineNodeTo(src.node.loreId, src.node.id, n.id, drag.zone === 'after')
  }
  ver.value++
  clearDrag()
}
function clearDrag() {
  drag.key = null
  drag.hintKey = null
  drag.zone = null
}
</script>

<template>
  <div ref="rootEl" style="flex: 1; display: flex; flex-direction: column; min-height: 0; padding: 16px 26px">
    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px">
      <span class="serif" style="font-size: 18px; font-weight: 700">设定总览</span>
      <span style="font-size: 12px; color: var(--text-dim)">全部文件夹与条目 · 幕布式排列编辑</span>
      <div style="flex: 1"></div>
      <NButton size="tiny" @click="foldAll(true)">全部折叠</NButton>
      <NButton size="tiny" @click="foldAll(false)">全部展开</NButton>
      <NButton size="tiny" type="primary" @click="work.loreView = 'detail'">返回详情视图</NButton>
    </div>
    <div class="ob-editor" style="flex: 1; overflow: auto">
      <div
        v-for="(row, idx) in visible"
        :key="row.node.key"
        class="ob-row"
        :data-key="row.node.key"
        :class="{
          'drop-before': drag.hintKey === row.node.key && drag.zone === 'before',
          'drop-after': drag.hintKey === row.node.key && drag.zone === 'after',
          'drop-inside': drag.hintKey === row.node.key && drag.zone === 'inside'
        }"
        @dragover.prevent="onDragOver(row, $event)"
        @drop.prevent="onDrop(row)"
        @dragend="clearDrag"
        @contextmenu.prevent
      >
        <span v-for="d in row.depth" :key="d" class="ob-guide" />
        <button
          class="ob-bullet"
          :class="{ 'has-children': row.node.children.length, folded: row.node.fold }"
          :draggable="true"
          :title="row.node.kind === 'folder' ? '文件夹' : row.node.kind === 'entry' ? '条目（拖拽移动）' : '内容节点'"
          @click="toggleFold(row)"
          @dragstart="onDragStart(row, $event)"
        />
        <div
          class="ob-text"
          contenteditable="true"
          spellcheck="false"
          :data-ph="row.node.text ? '' : '输入内容…'"
          :style="row.node.kind !== 'text' ? 'font-weight:700' : ''"
          @input="onInput(row, $event)"
          @keydown="onKey(row, $event)"
          @paste.prevent
          @focus="() => {}"
        />
        <span class="ob-kind" :class="row.node.kind">{{ { folder: '文件夹', entry: '条目', text: '内容' }[row.node.kind] }}</span>
        <span class="ob-ops">
          <button class="ob-op" title="删除" @click.stop="confirmDelete(row)">✕</button>
        </span>
      </div>
      <div class="ob-tip">总览视图：回车 新建同级 · Tab/Shift+Tab 降级升级（条目与文件夹） · Alt+↑↓ 排序 · 拖拽 归档/排序 · 圆点 折叠</div>
    </div>
  </div>
</template>
