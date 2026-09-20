<script setup>
import { ref, computed } from 'vue'
import { NButton, NModal, NInput, NSelect, NDropdown, NEmpty, NSpin, NCheckbox, useMessage } from 'naive-ui'
import OIcon from './OIcon.vue'
import SettingsPanel from './SettingsPanel.vue'
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
/* 封面六款式（G 同构造）：平涂单色 + 衬线书名 + 作者圆印，仅换色 */
const KINDS = [
  { label: '虚构 · 克莱因蓝', value: 'novel' },
  { label: '非虚构 · 象牙白', value: 'note' },
  { label: '文集 · 松绿', value: 'cedar' },
  { label: '诗辑 · 藤紫', value: 'violet' },
  { label: '别藏 · 绛红', value: 'claret' },
  { label: '特殊 · 墨黑', value: 'ink' }
]

const showCreate = ref(false)
const form = ref({ title: '', author: '', genre: '其他', status: '构思', intro: '', withVolume: true, kind: 'novel' })
const editing = ref(null)
const q = ref('')

/* 书架本地检索：书名 / 作者 / 类型 */
const filtered = computed(() => {
  const k = q.value.trim().toLowerCase()
  if (!k) return shelf.works
  return shelf.works.filter((w) =>
    (w.title || '').toLowerCase().includes(k) ||
    (w.author || '').toLowerCase().includes(k) ||
    (w.genre || '').toLowerCase().includes(k))
})

function openCreate() {
  editing.value = null
  form.value = { title: '', author: '', genre: '其他', status: '构思', intro: '', withVolume: true, kind: 'novel' }
  showCreate.value = true
}
function openEdit(w) {
  editing.value = w
  form.value = { title: w.title, author: w.author, genre: w.genre, status: w.status, intro: w.intro, withVolume: false, kind: w.kind || 'novel' }
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
      intro: form.value.intro,
      kind: form.value.kind
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

/* 作者名圆印：2 字竖排 / 3-4 字两行 / 1 字单行；无作者则不盖印 */
function sealLines(author) {
  const a = (author || '').trim()
  if (!a) return []
  if (a.length <= 2) return a.split('')
  if (a.length === 3) return [a.slice(0, 2), a.slice(2)]
  return [a.slice(0, 2), a.slice(2, 4)]
}
function fmtWords(n) {
  const v = Number(n) || 0
  return v >= 10000 ? (v / 10000).toFixed(1) + ' 万字' : v + ' 字'
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
      <div class="shelf-brand">
        <span class="logo">坊</span>
        <span class="cn brand">小说工坊</span>
        <span class="en">Novel&nbsp;Studio</span>
      </div>
      <div class="shelf-search">
        <NInput v-model:value="q" size="small" placeholder="搜索作品、作者、类型…" clearable>
          <template #prefix><OIcon name="search" :size="13" /></template>
        </NInput>
      </div>
      <SettingsPanel @backup="doBackup" @restore="doRestore" />
      <NButton size="small" type="primary" @click="openCreate">＋ 新建作品</NButton>
    </div>

    <div class="shelf-body">
      <NSpin :show="shelf.loading">
        <div v-if="filtered.length" class="shelf-grid">
          <div
            v-for="w in filtered"
            :key="w.id"
            class="book-card"
            role="button"
            tabindex="0"
            @click="onWorkClick(w)"
            @keydown.enter="onWorkClick(w)"
          >
            <div class="book-cover" :class="'k-' + (w.kind || 'novel')">
              <span class="cover-tt">{{ w.title }}</span>
              <span class="cover-sub">Novel · {{ w.status || '连载中' }}</span>
              <span v-if="sealLines(w.author).length" class="cover-seal"><template v-for="(ln, i) in sealLines(w.author)" :key="i">{{ ln }}<br v-if="i < sealLines(w.author).length - 1" /></template></span>
              <div class="cover-menu" @click.stop>
                <NDropdown :options="cardMenu(w)" @select="(k) => onCardMenu(k, w)" trigger="click">
                  <NButton size="tiny" quaternary>⋯</NButton>
                </NDropdown>
              </div>
            </div>
            <div class="book-info">
              <span class="book-title">{{ w.title }}</span>
              <span class="book-meta">{{ fmtWords(w.totalWords) }} · {{ w.chapterCount }} 章</span>
            </div>
          </div>
        </div>
        <div v-else class="empty-shelf">
          <div class="big">开卷有益</div>
          <p v-if="shelf.works.length">没有匹配「{{ q }}」的作品 —— 换个关键词试试。</p>
          <p v-else>书架还是空的 —— 点击右上角「新建作品」开始写作，<br />或在工作台里导入 TXT / Word / PDF / EPUB 旧稿。</p>
        </div>
      </NSpin>
    </div>

    <NModal v-model:show="showCreate" preset="card" :title="editing ? '编辑作品信息' : '新建作品'" style="width: 460px">
      <div style="display: flex; flex-direction: column; gap: 12px">
        <NInput v-model:value="form.title" placeholder="书名 *" />
        <div style="display: flex; gap: 10px">
          <NInput v-model:value="form.author" placeholder="作者（盖于封面圆印）" style="flex: 1" />
          <NSelect v-model:value="form.genre" :options="GENRES.map((g) => ({ label: g, value: g }))" style="width: 120px" />
        </div>
        <div style="display: flex; gap: 10px">
          <NSelect v-model:value="form.status" :options="STATUS.map((s) => ({ label: s, value: s }))" style="width: 130px" />
          <NSelect v-model:value="form.kind" :options="KINDS" style="flex: 1" />
        </div>
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
