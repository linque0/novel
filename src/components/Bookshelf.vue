<script setup>
import { ref, computed, watch } from 'vue'
import { liveQuery } from 'dexie'
import { NButton, NModal, NInput, NSelect, NDropdown, NSpin, NCheckbox, useMessage } from 'naive-ui'
import OIcon from './OIcon.vue'
import SkinPicker from './SkinPicker.vue'
import AppTopbar from './AppTopbar.vue'
import { WORK_NAVIGATION } from './app-navigation'
import GravityShelf from './GravityShelf.vue'
import GlazeShelf from './GlazeShelf.vue'
import CrimsonShelf from './CrimsonShelf.vue'
import { useShelfStore } from '../stores/shelf'
import { useWorkStore } from '../stores/work'
import { useUiStore } from '../stores/ui'
import { resumeChapterOf } from '../db/repo'
import { sortShelfWorks, formatShelfOpenTime } from '../services/shelf-sort'

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
const opening = ref(false)

/* 书架本地检索：书名 / 作者 / 类型；结果固定按最近打开时间重排 */
const filtered = computed(() => {
  const k = q.value.trim().toLowerCase()
  const base = k
    ? shelf.works.filter((w) =>
      (w.title || '').toLowerCase().includes(k) ||
      (w.author || '').toLowerCase().includes(k) ||
      (w.genre || '').toLowerCase().includes(k))
    : shelf.works
  return sortShelfWorks(base, shelf.openStats)
})
const openText = (w) => formatShelfOpenTime(shelf.openStats[w.id]?.lastOpenedAt)

/* 接续卡与开书使用同一位置解析；没有位置记录时回退首章。 */
const firstChapter = ref(null)
watch([() => filtered.value[0]?.id, () => ui.skin], ([id, skin], _previous, onCleanup) => {
  firstChapter.value = null
  if (!id || !['glaze', 'crimson'].includes(skin)) return
  const subscription = liveQuery(() => resumeChapterOf(id)).subscribe({
    next(chapter) { if (filtered.value[0]?.id === id && ui.skin === skin) firstChapter.value = chapter },
    error() { if (filtered.value[0]?.id === id && ui.skin === skin) firstChapter.value = null }
  })
  onCleanup(() => subscription.unsubscribe())
}, { immediate: true })

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
  await openWorkAt(w)
}
async function openWorkAt(w, tab = 'chapters') {
  if (opening.value) return
  opening.value = true
  try {
    await work.open(w.id)
    if (WORK_NAVIGATION.some(item => item.key === tab)) work.tab = tab
  } catch {
    msg.error('作品未能打开，请重试')
  } finally { opening.value = false }
}

/* ---------- 设置窗口（面板窗口 settings 类型）：外观 / 恍然梦 / 数据 / 关于 ---------- */
function openSettings() {
  if (!window.native?.panelOpen) {
    msg.info('设置窗口仅桌面版可用，网页版暂不支持')
    return
  }
  window.native.panelOpen({ type: 'settings', workId: 'app', entityId: '', title: '设置' })
}

/* 作者名圆印：2 字竖排 / 3-4 字两行 / 1 字单行；无作者则不盖印 */
function sealLines(author) {
  const a = (author || '').trim()
  if (!a) return []
  if (a.length <= 2) return a.split('')
  if (a.length === 3) return [a.slice(0, 2), a.slice(2)]
  return [a.slice(0, 2), a.slice(2, 4)]
}
/* 书名排版分级（畅销书封面惯例：短名竖排显书卷气，长名横排保识别）：
   ≤4 字大字竖排 / ≤8 字常规竖排 / 其余横排居中 */
function ttCls(title) {
  const n = (title || '').trim().length
  if (n <= 4) return 'tt-v1'
  if (n <= 8) return 'tt-v2'
  return 'tt-h'
}
function fmtWords(n) {
  const v = Number(n) || 0
  return v >= 10000 ? (v / 10000).toFixed(1) + ' 万字' : v + ' 字'
}

const cardMenu = (w) => [
  { label: '打开', key: 'open' },
  { label: '编辑信息', key: 'edit' },
  { label: '删除（可回收站恢复，一期先软删除）', key: 'del', props: { style: { color: ui.skin === 'gravity' ? '#f18f86' : '#c2564a' } } }
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
    <GravityShelf v-if="ui.skin === 'gravity'" :works="filtered" :total="shelf.works.length" :loading="shelf.loading" :busy="opening" v-model:query="q" :open-stats="shelf.openStats" :menu-options="cardMenu" @open="onWorkClick" @menu="onCardMenu" @create="openCreate" @settings="openSettings" @navigate="(tab, book) => openWorkAt(book, tab)" />
    <GlazeShelf v-else-if="ui.skin === 'glaze'" :works="filtered" :total="shelf.works.length" :first-chapter="firstChapter" :loading="shelf.loading" :busy="opening" v-model:query="q" :open-stats="shelf.openStats" :menu-options="cardMenu" @open="onWorkClick" @menu="onCardMenu" @create="openCreate" @settings="openSettings" @navigate="(tab, book) => openWorkAt(book, tab)" />
    <CrimsonShelf v-else-if="ui.skin === 'crimson'" :works="filtered" :total="shelf.works.length" :first-chapter="firstChapter" :loading="shelf.loading" :busy="opening" v-model:query="q" :open-stats="shelf.openStats" :menu-options="cardMenu" @open="onWorkClick" @menu="onCardMenu" @create="openCreate" @settings="openSettings" @navigate="(tab, book) => openWorkAt(book, tab)" />
    <template v-else>
    <AppTopbar active="shelf" :busy="opening || shelf.loading" :has-work="!!filtered[0]" :target-title="filtered[0]?.title" @navigate="key => key === 'settings' ? openSettings() : key !== 'shelf' && filtered[0] ? openWorkAt(filtered[0], key) : undefined">
      <template #actions><SkinPicker /></template>
    </AppTopbar>
    <div class="shelf-toolbar">
      <h1>我的作品 <small>{{ shelf.works.length }}</small></h1>
      <div class="shelf-search">
        <NInput v-model:value="q" size="small" placeholder="搜索作品、作者、类型…" clearable>
          <template #prefix><OIcon name="search" :size="13" /></template>
        </NInput>
      </div>
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
            <div class="book-cover" :class="['k-' + (w.kind || 'novel'), ttCls(w.title)]">
              <span class="cover-tt">{{ w.title }}</span>
              <span class="cover-sub">{{ w.status || '连载中' }}</span>
              <span v-if="sealLines(w.author).length" class="cover-seal"><template v-for="(ln, i) in sealLines(w.author)" :key="i">{{ ln }}<br v-if="i < sealLines(w.author).length - 1" /></template></span>
              <div class="cover-menu" @click.stop @keydown.stop>
                <NDropdown :options="cardMenu(w)" @select="(k) => onCardMenu(k, w)" trigger="click">
                  <NButton size="tiny" quaternary>⋯</NButton>
                </NDropdown>
              </div>
            </div>
            <div class="book-info">
              <span class="book-title">{{ w.title }}</span>
              <span class="book-meta">{{ fmtWords(w.totalWords) }} · {{ w.chapterCount }} 章</span>
            </div>
            <div class="book-openat">上次打开 {{ openText(w) }}</div>
          </div>
        </div>
        <div v-else class="empty-shelf">
          <div class="big">开卷有益</div>
          <p v-if="shelf.works.length">没有匹配「{{ q }}」的作品 —— 换个关键词试试。</p>
          <p v-else>书架还是空的 —— 点击右上角「新建作品」开始写作，<br />或在工作台里导入 TXT / Word / PDF / EPUB 旧稿。</p>
        </div>
      </NSpin>
    </div>

    </template>
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

<style scoped>
.shelf-toolbar { display:flex; align-items:center; gap:16px; padding:24px 40px 0; flex:none; }
.shelf-toolbar h1 { margin:0 auto 0 0; font:600 22px var(--editor-font); white-space:nowrap; }
.shelf-toolbar h1 small { margin-left:8px; color:var(--text-dim); font-size:13px; }
.shelf-toolbar .shelf-search { margin:0; }
@media(max-width:850px) { .shelf-toolbar { flex-wrap:wrap; padding:24px 16px 0; gap:12px; } .shelf-toolbar h1 { width:100%; } .shelf-toolbar .shelf-search { flex:1; min-width:120px; max-width:none; } }
</style>
