<script setup>
import { computed, h, ref } from 'vue'
import { NButton, NInput, NModal, NPopconfirm, NTree, NDropdown, useMessage } from 'naive-ui'
import { useWorkStore } from '../stores/work'
import { pickFiles } from '../services/fileio'
import { decodeText, parseLoreOutlineMd } from '../services/importers'

const work = useWorkStore()
const msg = useMessage()

const treeData = computed(() => work.categoryTreeData())
const selectedKey = computed(() => {
  if (work.selLoreId) return 'l:' + work.selLoreId
  if (work.selFolderId) return 'c:' + work.selFolderId
  return []
})

function onSelect(keys) {
  const key = keys[keys.length - 1]
  if (!key) return
  const [kind, id] = [key.slice(0, 1), key.slice(2)]
  if (kind === 'l') {
    work.selLoreId = id
    work.tab = 'lore'
  } else {
    work.selFolderId = id === 'none' ? 'none' : id
    work.selLoreId = null
  }
}

function nodeProps({ option }) {
  return {
    onContextmenu: (e) => openCtx(e, option)
  }
}

const renderPrefix = ({ option }) =>
  h('span', { style: 'font-size:12px' }, option.type === 'folder' ? '📁' : '📄')

/* ---------- 拖拽：条目入文件夹 / 文件夹嵌套（防循环） ---------- */
function allowDrop({ dragNode, node, dropPosition }) {
  if (dragNode.type === 'entry') {
    return node.type === 'folder' ? true : dropPosition === 'before' || dropPosition === 'after'
  }
  // 文件夹：不能放入自己子树（cycle 由 store 校验），before/after 仅限同层级概念简化为 inside/前后皆可
  return node.type === 'folder' ? true : dropPosition !== 'inside'
}
function onDrop({ node, dragNode, dropPosition }) {
  const targetFolderId = node.type === 'folder' ? node.key.slice(2) : node.key === 'l:none' ? null : null
  if (dragNode.type === 'entry') {
    const entryId = dragNode.key.slice(2)
    if (node.type === 'folder' && dropPosition === 'inside') work.moveLoreTo(entryId, targetFolderId === 'none' ? null : targetFolderId)
    else if (node.type === 'entry') {
      // 放到条目前后 = 移入该条目所在文件夹
      const l = work.lore.find((x) => x.id === node.key.slice(2))
      work.moveLoreTo(entryId, l?.categoryId || null)
    }
    return
  }
  const catId = dragNode.key.slice(2)
  if (node.type === 'folder') {
    const pid = node.key.slice(2)
    work.moveCategoryTo(catId, pid === 'none' ? null : pid)
  } else {
    const l = work.lore.find((x) => x.id === node.key.slice(2))
    const siblingCat = l ? l.categoryId : null
    work.moveCategoryTo(catId, siblingCat)
  }
}

/* ---------- 右键 / 操作 ---------- */
const ctx = ref({ show: false, x: 0, y: 0, type: null, id: null })
const rename = ref({ show: false, value: '', id: null })
const newFolder = ref({ show: false, value: '', parentId: null })

function openCtx(e, option) {
  ctx.value = { show: true, x: e.clientX, y: e.clientY, type: option.type, id: option.key.slice(2), pseudo: !!option.pseudo || option.key === 'c:none' }
  e.preventDefault()
}
function closeCtx() {
  ctx.value.show = false
}
const folderOptions = (ctxV) =>
  ctxV.pseudo
    ? [{ label: '新建条目', key: 'add' }]
    : [
        { label: '新建子文件夹', key: 'sub' },
        { label: '新建条目', key: 'add' },
        { label: '重命名', key: 'rename' },
        { label: '删除（子项上提）', key: 'del', props: { style: { color: '#c2564a' } } }
      ]
const entryOptions = [
  { label: '重命名', key: 'rename' },
  { label: '删除（进回收站）', key: 'del', props: { style: { color: '#c2564a' } } }
]
function onCtxSelect(key) {
  const c = ctx.value
  closeCtx()
  if (c.type === 'folder') {
    if (key === 'sub') newFolder.value = { show: true, value: '', parentId: c.id === 'none' ? null : c.id }
    if (key === 'add') {
      work.tab = 'lore'
      work.addLore(c.id === 'none' ? null : c.id)
    }
    if (key === 'rename') {
      const cat = work.lorecats.find((x) => x.id === c.id)
      rename.value = { show: true, value: cat?.name || '', id: c.id }
    }
    if (key === 'del') work.deleteCategory(c.id)
  } else {
    if (key === 'rename') {
      const l = work.lore.find((x) => x.id === c.id)
      rename.value = { show: true, value: l?.title || '', id: c.id, isEntry: true }
    }
    if (key === 'del') work.deleteLore(c.id)
  }
}
function submitRename() {
  const r = rename.value
  if (!r.value.trim()) return
  if (r.isEntry) work.updateLore(r.id, { title: r.value.trim() })
  else work.updateLorecat(r.id, r.value.trim())
  rename.value.show = false
}
function submitNewFolder() {
  const f = newFolder.value
  if (!f.value.trim()) return
  work.addCategory(f.value.trim(), f.parentId)
  f.show = false
}

function addRootFolder() {
  newFolder.value = { show: true, value: '', parentId: null }
}
function addRootEntry() {
  const folderId = work.selFolderId && work.selFolderId !== 'none' ? work.selFolderId : null
  work.addLore(folderId)
}

/* ---------- MD 导入（按标题级别自动建层级） ---------- */
async function importMd() {
  const files = await pickFiles(['md', 'markdown', 'txt'])
  if (!files.length) return
  let folders = 0
  let entries = 0
  for (const f of files) {
    const { text } = decodeText(f.data)
    const structure = parseLoreOutlineMd(text)
    const baseName = f.name.replace(/\.[^.]+$/, '')
    if (structure.length === 0) {
      // 空结构：整个文件作为单条目
      structure.push({ name: baseName, children: [], entries: [{ title: baseName, lines: text.split(/\r?\n/).filter((x) => x.trim()) }] })
    } else if (files.length === 1 && structure.length === 1 && structure[0].entries.length === 0) {
      // 单文件且首个 H1 可作为根文件夹名：沿用解析结果
    }
    const r = work.importLoreTree(structure, null)
    folders += r.foldersCreated
    entries += r.entriesCreated
  }
  msg.success(`导入完成：${folders} 个文件夹、${entries} 个条目`)
}
</script>

<template>
  <div style="display: flex; flex-direction: column; height: 100%">
    <div class="side-head">
      <NButton size="tiny" type="primary" @click="addRootEntry">＋条目</NButton>
      <NButton size="tiny" @click="addRootFolder">＋文件夹</NButton>
      <NButton size="tiny" @click="importMd">⬆ 导入</NButton>
      <NButton
        size="tiny"
        :type="work.loreView === 'overview' ? 'primary' : 'default'"
        @click="work.loreView = work.loreView === 'overview' ? 'detail' : 'overview'"
      >
        {{ work.loreView === 'overview' ? '退出总览' : '总览视图' }}
      </NButton>
    </div>
    <div class="side-list" @click="closeCtx" @contextmenu.prevent>
      <NTree
        :data="treeData"
        block-line
        default-expand-all
        draggable
        :selected-keys="Array.isArray(selectedKey) ? selectedKey : [selectedKey]"
        :allow-drop="allowDrop"
        :render-prefix="renderPrefix"
        :node-props="nodeProps"
        @update:selected-keys="onSelect"
        @drop="onDrop"
      />
      <p v-if="!treeData.length" style="font-size: 12px; color: var(--text-dim); padding: 10px">
        设定库为空。点击「＋文件夹」建立地点 / 势力等文件夹，或「＋条目」直接新建设定。
      </p>
    </div>

    <NDropdown
      trigger="manual"
      :show="ctx.show"
      :x="ctx.x"
      :y="ctx.y"
      :options="ctx.type === 'folder' ? folderOptions(ctx) : entryOptions"
      placement="bottom-start"
      @select="onCtxSelect"
      @clickoutside="closeCtx"
    />

    <NModal v-model:show="rename.show" preset="dialog" :title="rename.isEntry ? '重命名条目' : '重命名文件夹'">
      <NInput v-model:value="rename.value" placeholder="名称" @keyup.enter="submitRename" />
      <template #action>
        <NButton @click="rename.show = false">取消</NButton>
        <NButton type="primary" @click="submitRename">确定</NButton>
      </template>
    </NModal>

    <NModal v-model:show="newFolder.show" preset="dialog" title="新建文件夹">
      <NInput v-model:value="newFolder.value" placeholder="文件夹名称" @keyup.enter="submitNewFolder" />
      <template #action>
        <NButton @click="newFolder.show = false">取消</NButton>
        <NButton type="primary" @click="submitNewFolder">创建</NButton>
      </template>
    </NModal>
  </div>
</template>
