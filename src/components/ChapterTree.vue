<script setup>
import { computed, h, ref } from 'vue'
import { NTree, NButton, NModal, NInput, NPopconfirm, NDropdown } from 'naive-ui'
import OIcon from './OIcon.vue'
import { useWorkStore } from '../stores/work'
import { useUiStore } from '../stores/ui'
import { autosave } from '../services/autosave'

const work = useWorkStore()
const ui = useUiStore()
const totalWords = computed(() => work.liveChapters.reduce((sum, c) => sum + (c.wordCount || 0), 0))

/* 树数据：书签章节加 ★ 前缀 */
const treeData = computed(() => {
  const marked = (key) => {
    if (!key || key.slice(0, 2) !== 'c:') return false
    return work.isChapterBookmarked(key.slice(2))
  }
  return work.treeData.map((v) => ({
    ...v,
    children: (v.children || []).map((c) => ({
      ...c,
      label: (marked(c.key) ? '★ ' : '') + c.label
    }))
  }))
})

const selectedKeys = computed(() => {
  const keys = []
  if (work.selChapterId) keys.push('c:' + work.selChapterId)
  return keys
})
const selNode = ref(null)

function onSelect(keys) {
  const key = keys[keys.length - 1]
  if (!key) return
  const [kind, id] = [key.slice(0, 1), key.slice(2)]
  if (kind === 'c') {
    work.selChapterId = id
    const c = work.chapters.find((x) => x.id === id)
    if (c) work.selVolumeId = c.volumeId
    selNode.value = { type: 'chapter', id, key }
  } else {
    work.selVolumeId = id === 'orphans' ? null : id
    selNode.value = { type: 'volume', id, key }
  }
}

const allowDrop = ({ dragNode, node, dropPosition }) => {
  if (dragNode.type === 'volume') return node.type === 'volume' && dropPosition !== 'inside' && !!node.id /* 「未分卷」伪节点无 id，不参与卷排序 */
  return dropPosition === 'inside' ? node.type === 'volume' : true
}

function onDrop({ node, dragNode, dropPosition }) {
  if (!dragNode) return
  if (dragNode.type === 'volume') {
    if (node.type !== 'volume' || dropPosition === 'inside' || !node.id) return
    const ids = work.liveVolumes.map((v) => v.id)
    const from = ids.indexOf(dragNode.id)
    if (from < 0) return
    ids.splice(from, 1)
    let to = ids.indexOf(node.id)
    if (dropPosition === 'after') to += 1
    ids.splice(to, 0, dragNode.id)
    ids.forEach((id, i) => {
      const v = work.volumes.find((x) => x.id === id)
      if (v && v.sortOrder !== i * 1000) {
        v.sortOrder = i * 1000
        autosave.mark('volumes', v)
      }
    })
    return
  }
  const cid = dragNode.id
  if (dropPosition === 'inside') {
    /* 「未分卷」伪节点无 id → 按 orphans 语义移入未分卷 */
    work.moveChapterTo(cid, node.id ?? 'orphans', 'inside')
  } else if (node.type === 'chapter') {
    const target = work.chapters.find((c) => c.id === node.id)
    work.moveChapterTo(cid, target?.volumeId ?? null, dropPosition, node.id)
  } else {
    work.moveChapterTo(cid, node.id, 'inside')
  }
}

const renderSuffix = ({ option }) =>
  h('span', { class: 'chapter-count', style: { color:'var(--text-dim)', fontSize:'11px', marginLeft:'6px', display:ui.isStudioSkin ? 'none' : undefined } }, option.suffix || '')
function renderLabel({ option }) {
  if (!ui.isStudioSkin || option.type !== 'chapter') return h('span', option.label)
  const index = work.chapterOrdinal(option.key.slice(2)) || 0
  return h('span', { class: 'gravity-chapter-row' }, [
    h('span', { class: 'gravity-chapter-number' }, String(index).padStart(2, '0')),
    h('span', { class: 'gravity-chapter-copy' }, [h('span', { title: option.label }, option.label), h('small', option.suffix || '0 字')])
  ])
}

function addVol() {
  work.addVolume(`第${work.liveVolumes.length + 1}卷`)
}
function addCh() {
  work.addChapter()
}
function moveSel(dir) {
  if (selNode.value?.type === 'chapter') work.moveChapter(selNode.value.id, dir)
}
function openRenameById(s) {
  if (!s) return
  if (s.type === 'volume') {
    const v = work.volumes.find((x) => x.id === s.id)
    rename.value = { show: true, kind: 'volume', id: s.id, value: v?.title || '' }
  } else {
    const c = work.chapters.find((x) => x.id === s.id)
    rename.value = { show: true, kind: 'chapter', id: s.id, value: c?.title || '' }
  }
}
function openRename() {
  openRenameById(selNode.value)
}
function confirmRename() {
  const r = rename.value
  if (!r.value.trim()) return
  if (r.kind === 'volume') work.renameVolume(r.id, r.value.trim())
  else work.renameChapter(r.id, r.value.trim())
  rename.value.show = false
}
async function delById(s) {
  if (!s) return
  if (s.type === 'volume') await work.deleteVolume(s.id)
  else await work.deleteChapter(s.id)
  if (selNode.value?.id === s.id) selNode.value = null
}
async function delSel() {
  await delById(selNode.value)
}

/* ---------- 右键快捷栏 ---------- */
const ctx = ref({ show: false, x: 0, y: 0, kind: null, id: null, bookmarked: false })

function nodeProps({ option }) {
  return {
    onContextmenu: (e) => {
      e.preventDefault()
      const id = option.key.slice(2)
      onSelect([option.key], option)
      ctx.value = {
        show: true,
        x: e.clientX,
        y: e.clientY,
        kind: option.type,
        id,
        bookmarked: option.type === 'chapter' ? work.isChapterBookmarked(id) : false
      }
    }
  }
}
function closeCtx() {
  ctx.value.show = false
}
const ctxOptions = computed(() => {
  if (ctx.value.kind === 'chapter') {
    return [
      { label: ctx.value.bookmarked ? '移除书签' : '收藏书签', key: 'bm' },
      { label: '重命名', key: 'rename' },
      { label: '删除（进回收站）', key: 'del' }
    ]
  }
  return [
    { label: '重命名卷', key: 'rename' },
    { label: '删除卷（章目上提）', key: 'del' }
  ]
})
function onCtxSelect(key) {
  const c = ctx.value
  closeCtx()
  if (key === 'bm') {
    const added = work.toggleChapterBookmark(c.id)
    window.$msg?.success(added ? '已加入书签' : '已移除书签')
    return
  }
  if (key === 'rename') return openRenameById({ type: c.kind, id: c.id })
  if (key === 'del') return delById({ type: c.kind, id: c.id })
}

const rename = ref({ show: false, kind: 'chapter', id: null, value: '' })
</script>

<template>
  <div style="display: flex; flex-direction: column; height: 100%">
    <h2 v-if="ui.isStudioSkin" class="gravity-sidebar-title">章节</h2>
    <div class="side-head">
      <NButton size="tiny" @click="addVol">＋卷</NButton>
      <NButton size="tiny" type="primary" @click="addCh">＋章</NButton>
      <NButton size="tiny" :disabled="!selNode" @click="moveSel(-1)">↑</NButton>
      <NButton size="tiny" :disabled="!selNode" @click="moveSel(1)">↓</NButton>
      <NButton size="tiny" :disabled="!selNode" @click="openRename">改名</NButton>
      <NPopconfirm @positive-click="delSel">
        <template #trigger>
          <NButton size="tiny" :disabled="!selNode" quaternary style="color: #c2564a">删除</NButton>
        </template>
        删除后可在回收站恢复
      </NPopconfirm>
    </div>
    <div class="side-list">
      <NTree
        :data="treeData"
        block-line
        draggable
        default-expand-all
        :selected-keys="selectedKeys"
        :allow-drop="allowDrop"
        :render-suffix="renderSuffix"
        :render-label="renderLabel"
        :node-props="nodeProps"
        @update:selected-keys="onSelect"
        @drop="onDrop"
      />
    </div>

    <div v-if="ui.isStudioSkin" class="gravity-catalog-footer"><b>{{ work.liveChapters.length }}</b> 章 / {{ totalWords.toLocaleString() }} 字</div>

    <NDropdown
      trigger="manual"
      :show="ctx.show"
      :x="ctx.x"
      :y="ctx.y"
      :options="ctxOptions"
      placement="bottom-start"
      @select="onCtxSelect"
      @clickoutside="closeCtx"
    />

    <NModal v-model:show="rename.show" preset="dialog" :title="rename.kind === 'volume' ? '重命名卷' : '重命名章节'">
      <NInput v-model:value="rename.value" placeholder="名称" @keyup.enter="confirmRename" />
      <template #action>
        <NButton @click="rename.show = false">取消</NButton>
        <NButton type="primary" @click="confirmRename">确定</NButton>
      </template>
    </NModal>
  </div>
</template>
