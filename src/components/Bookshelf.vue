<script setup>
import { ref } from 'vue'
import { NButton, NModal, NInput, NSelect, NTag, NDropdown, NEmpty, NCheckbox, NPopconfirm, NSpin, useMessage } from 'naive-ui'
import { useShelfStore } from '../stores/shelf'
import { useWorkStore } from '../stores/work'
import { useUiStore } from '../stores/ui'
import { backupAll, restoreBackup } from '../services/exporter'
import { pickFiles } from '../services/fileio'

const shelf = useShelfStore()
const work = useWorkStore()
const ui = useUiStore()
const msg = useMessage()

const GENRES = ['玄幻', '仙侠', '都市', '科幻', '历史', '悬疑', '言情', '游戏', '其他']
const STATUS = ['构思', '连载', '完结', '搁置']
const THEME_OPTS = [
  { label: '宣纸', value: 'xuan' },
  { label: '羊皮纸', value: 'parchment' },
  { label: '暗夜书房', value: 'night' }
]

const showCreate = ref(false)
const form = ref({ title: '', author: '', genre: '其他', status: '构思', intro: '', withVolume: true })
const editing = ref(null)

const palettes = [
  ['#8c6f4e', '#4c3f2d'],
  ['#3f5f6f', '#23343d'],
  ['#6f4e5c', '#3d2a33'],
  ['#4e6f52', '#2a3d2c'],
  ['#5c5480', '#332e4a'],
  ['#80553a', '#472f20']
]
function grad(w) {
  let h = 0
  for (const ch of w.id || '') h = (h * 31 + ch.charCodeAt(0)) % 997
  const [a, b] = palettes[h % palettes.length]
  return `linear-gradient(135deg, ${a}, ${b})`
}

function openCreate() {
  editing.value = null
  form.value = { title: '', author: '', genre: '其他', status: '构思', intro: '', withVolume: true }
  showCreate.value = true
}
function openEdit(w) {
  editing.value = w
  form.value = { title: w.title, author: w.author, genre: w.genre, status: w.status, intro: w.intro, withVolume: false }
  showCreate.value = true
}
async function submitCreate() {
  if (!form.value.title.trim()) {
    msg.warning('请填写书名')
    return
  }
  if (editing.value) {
    await shelf.updateWork(editing.value, {
      title: form.value.title.trim(),
      author: form.value.author.trim(),
      genre: form.value.genre,
      status: form.value.status,
      intro: form.value.intro
    })
    msg.success('已保存')
  } else {
    await shelf.createWork({ ...form.value, title: form.value.title.trim() })
    msg.success('作品已创建')
  }
  showCreate.value = false
}

async function onWorkClick(w) {
  await work.open(w.id)
}

async function doBackup() {
  const r = await backupAll()
  if (!r?.canceled) msg.success('备份文件已保存')
}
async function doRestore() {
  const files = await pickFiles(['json'])
  if (!files.length) return
  try {
    await restoreBackup(files[0].data)
    await shelf.refresh()
    msg.success('备份已恢复')
  } catch (e) {
    msg.error('恢复失败：' + e.message)
  }
}

const cardMenu = (w) => [
  { label: '打开', key: 'open' },
  { label: '编辑信息', key: 'edit' },
  { label: '删除（可回收站恢复，一期先软删除）', key: 'del', props: { style: { color: '#c2564a' } } }
]
async function onCardMenu(key, w) {
  if (key === 'open') await onWorkClick(w)
  if (key === 'edit') openEdit(w)
  if (key === 'del') {
    await shelf.deleteWork(w)
    msg.success('已删除')
  }
}
</script>

<template>
  <div style="display: flex; flex-direction: column; height: 100%">
    <div class="topbar">
      <span class="brand">📚 小说工坊</span>
      <span style="font-size: 12px; color: var(--text-dim)">本地优先 · 自动保存</span>
      <div style="flex: 1"></div>
      <NSelect
        size="small"
        :value="ui.theme"
        :options="THEME_OPTS"
        style="width: 110px"
        @update:value="(v) => ui.setPref('theme', v)"
      />
      <NButton size="small" @click="doBackup">备份</NButton>
      <NButton size="small" @click="doRestore">恢复</NButton>
      <NButton size="small" @click="ui.statsOpen = true">统计</NButton>
      <NButton size="small" type="primary" @click="openCreate">＋ 新建作品</NButton>
    </div>

    <div class="shelf-body">
      <NSpin :show="shelf.loading">
        <div v-if="shelf.works.length" class="shelf-grid">
          <div
            v-for="w in shelf.works"
            :key="w.id"
            class="book-card"
            role="button"
            tabindex="0"
            @click="onWorkClick(w)"
            @keydown.enter="onWorkClick(w)"
          >
            <div class="book-cover" :style="{ background: grad(w) }">
              <span class="cover-char">{{ (w.title || '书')[0] }}</span>
              <div style="position: absolute; right: 8px; top: 8px" @click.stop>
                <NDropdown :options="cardMenu(w)" @select="(k) => onCardMenu(k, w)" trigger="click">
                  <NButton size="tiny" quaternary color="#fff" style="color: #fff">⋯</NButton>
                </NDropdown>
              </div>
            </div>
            <div class="book-info">
              <div class="book-title serif">{{ w.title }}</div>
              <div class="book-meta">
                <span>{{ w.totalWords }} 字</span>
                <span>{{ w.chapterCount }} 章</span>
                <NTag size="tiny" :bordered="false">{{ w.status }}</NTag>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="empty-shelf">
          <div class="big">开卷有益</div>
          <p>书架还是空的 —— 点击右上角「新建作品」开始写作，<br />或在工作台里导入 TXT / Word / PDF / EPUB 旧稿。</p>
        </div>
      </NSpin>
    </div>

    <NModal v-model:show="showCreate" preset="card" :title="editing ? '编辑作品信息' : '新建作品'" style="width: 460px">
      <div style="display: flex; flex-direction: column; gap: 12px">
        <NInput v-model:value="form.title" placeholder="书名 *" />
        <div style="display: flex; gap: 10px">
          <NInput v-model:value="form.author" placeholder="作者" style="flex: 1" />
          <NSelect v-model:value="form.genre" :options="GENRES.map((g) => ({ label: g, value: g }))" style="width: 120px" />
        </div>
        <NSelect v-model:value="form.status" :options="STATUS.map((s) => ({ label: s, value: s }))" style="width: 130px" />
        <NInput v-model:value="form.intro" type="textarea" placeholder="简介" :rows="3" />
        <NCheckbox v-if="!editing" v-model:checked="form.withVolume">默认创建「第一卷」</NCheckbox>
        <div style="display: flex; justify-content: flex-end; gap: 8px">
          <NButton @click="showCreate = false">取消</NButton>
          <NButton type="primary" @click="submitCreate">{{ editing ? '保存' : '创建' }}</NButton>
        </div>
      </div>
    </NModal>
  </div>
</template>
