<script setup>
import { computed, h, ref } from 'vue'
import { NTree, NButton, NModal, NInput, NPopconfirm } from 'naive-ui'
import { useWorkStore } from '../stores/work'
import { autosave } from '../services/autosave'

const work = useWorkStore()

const selectedKeys = computed(() => {
  const keys = []
  if (work.selChapterId) keys.push('c:' + work.selChapterId)
  return keys
})
const selNode = ref(null)

function onSelect(keys, opt) {
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
  if (dragNode.type === 'volume') return node.type === 'volume' && dropPosition !== 'inside'
  return dropPosition === 'inside' ? node.type === 'volume' : true
}

function onDrop({ node, dragNode, dropPosition }) {
  if (!dragNode) return
  if (dragNode.type === 'volume') {
    if (node.type !== 'volume' || dropPosition === 'inside') return
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
    work.moveChapterTo(cid, node.id, 'inside')
  } else if (node.type === 'chapter') {
    const target = work.chapters.find((c) => c.id === node.id)
    work.moveChapterTo(cid, target?.volumeId ?? null, dropPosition, node.id)
  } else {
    work.moveChapterTo(cid, node.id, 'inside')
  }
}

const renderSuffix = ({ option }) =>
  option.suffix ? h('span', { style: 'color:var(--text-dim);font-size:11px;margin-left:6px' }, option.suffix) : null

function addVol() {
  work.addVolume(`第${work.liveVolumes.length + 1}卷`)
}
function addCh() {
  work.addChapter()
}
function moveSel(dir) {
  if (selNode.value?.type === 'chapter') work.moveChapter(selNode.value.id, dir)
}
function openRename() {
  const s = selNode.value
  if (!s) return
  if (s.type === 'volume') {
    const v = work.volumes.find((x) => x.id === s.id)
    rename.value = { show: true, kind: 'volume', id: s.id, value: v?.title || '' }
  } else {
    const c = work.chapters.find((x) => x.id === s.id)
    rename.value = { show: true, kind: 'chapter', id: s.id, value: c?.title || '' }
  }
}
function confirmRename() {
  const r = rename.value
  if (!r.value.trim()) return
  if (r.kind === 'volume') work.renameVolume(r.id, r.value.trim())
  else work.renameChapter(r.id, r.value.trim())
  rename.value.show = false
}
async function delSel() {
  const s = selNode.value
  if (!s) return
  if (s.type === 'volume') await work.deleteVolume(s.id)
  else await work.deleteChapter(s.id)
  selNode.value = null
}

const rename = ref({ show: false, kind: 'chapter', id: null, value: '' })
</script>

<template>
  <div style="display: flex; flex-direction: column; height: 100%">
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
        :data="work.treeData"
        block-line
        draggable
        default-expand-all
        :selected-keys="selectedKeys"
        :allow-drop="allowDrop"
        :render-suffix="renderSuffix"
        @update:selected-keys="onSelect"
        @drop="onDrop"
      />
    </div>

    <NModal v-model:show="rename.show" preset="dialog" :title="rename.kind === 'volume' ? '重命名卷' : '重命名章节'">
      <NInput v-model:value="rename.value" placeholder="名称" @keyup.enter="confirmRename" />
      <template #action>
        <NButton @click="rename.show = false">取消</NButton>
        <NButton type="primary" @click="confirmRename">确定</NButton>
      </template>
    </NModal>
  </div>
</template>
