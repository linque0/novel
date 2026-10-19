<script setup>
/* 赤月戏 v3 的左侧章节目录：只读 work store 的真实章节/卷数据，切章与新建走现有 action。 */
import { computed, ref } from 'vue'
import { useWorkStore } from '../stores/work'

const props = defineProps({
  collapsed: { type: Boolean, default: false }
})
const emit = defineEmits(['update:collapsed'])

const work = useWorkStore()
const query = ref('')
const fmt = (n) => Number(n || 0).toLocaleString('zh-CN')

const chapters = computed(() => work.liveChapters.slice().sort((a, b) =>
  (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || String(a.createdAt || '').localeCompare(String(b.createdAt || ''))))
const volumes = computed(() => work.liveVolumes.slice().sort((a, b) =>
  (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || String(a.createdAt || '').localeCompare(String(b.createdAt || ''))))

/* 章按卷分组；无卷或卷已删的章落到“未分卷”。 */
const groups = computed(() => {
  const out = []
  for (const v of volumes.value) {
    const list = chapters.value.filter((c) => c.volumeId === v.id)
    if (list.length) out.push({ id: v.id, title: v.title || '未命名卷', list })
  }
  const orphans = chapters.value.filter((c) => !c.volumeId || !volumes.value.some((v) => v.id === c.volumeId))
  if (orphans.length) out.push({ id: 'orphan', title: '未分卷', list: orphans })
  return out
})

const visibleGroups = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return groups.value
  return groups.value
    .map((g) => ({ ...g, list: g.list.filter((c) => String(c.title || '').toLowerCase().includes(q)) }))
    .filter((g) => g.list.length)
})

const visibleChapters = computed(() => visibleGroups.value.flatMap((g) => g.list))
const current = computed(() => chapters.value.find((c) => c.id === work.selChapterId) || null)
const currentNo = computed(() => {
  const i = chapters.value.findIndex((c) => c.id === work.selChapterId)
  return i < 0 ? '—' : String(i + 1).padStart(2, '0')
})
const progress = computed(() => {
  const i = chapters.value.findIndex((c) => c.id === work.selChapterId)
  return chapters.value.length && i >= 0 ? (i + 1) / chapters.value.length : 0
})
const totalWords = computed(() => chapters.value.reduce((n, c) => n + (c.wordCount || 0), 0))
const totalChapters = computed(() => chapters.value.length)
const currentVolume = computed(() => {
  if (!current.value) return volumes.value[0]?.title || '未分卷'
  return volumes.value.find((v) => v.id === current.value.volumeId)?.title || '未分卷'
})

function pick(c) {
  work.selChapterId = c.id
  if (c.volumeId) work.selVolumeId = c.volumeId
}
function step(dir) {
  const list = visibleChapters.value
  if (!list.length) return
  let i = list.findIndex((c) => c.id === work.selChapterId)
  if (i < 0) i = dir > 0 ? -1 : list.length
  const target = list[i + dir]
  if (target) pick(target)
}
async function addChapter() {
  const row = await work.addChapter(work.selVolumeId)
  if (row?.id) pick(row)
}
function toggle() {
  emit('update:collapsed', !props.collapsed)
}
</script>

<template>
  <aside class="crimson-chapter-rail" :style="{ '--chapter-progress': progress }" aria-label="章节目录">
    <button class="crimson-rail-toggle" type="button" :aria-label="collapsed ? '展开章节目录' : '收起章节目录'" @click="toggle">{{ collapsed ? '›' : '‹' }}</button>

    <div class="crimson-rail-head">
      <small>赤月戏</small>
      <h2 :title="work.work?.title">{{ work.work?.title || '未命名作品' }}</h2>
      <span class="crimson-rail-seal">{{ currentVolume }}</span>
    </div>

    <div class="crimson-rail-volume">
      <span>{{ currentVolume }}</span>
      <span>{{ totalChapters }} 章</span>
    </div>

    <label class="crimson-rail-search">
      <svg viewBox="0 0 26 26" aria-hidden="true"><path d="M17 17l6 6M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0" /></svg>
      <input v-model="query" type="search" placeholder="搜索章节" aria-label="搜索章节" />
    </label>

    <nav class="crimson-rail-chapters" aria-label="章节列表">
      <template v-for="group in visibleGroups" :key="group.id">
        <div v-if="visibleGroups.length > 1" class="crimson-rail-volume-row">{{ group.title }}</div>
        <button
          v-for="c in group.list"
          :key="c.id"
          type="button"
          class="crimson-rail-chapter"
          :class="{ current: c.id === work.selChapterId }"
          :aria-current="c.id === work.selChapterId ? 'page' : undefined"
          :title="c.title"
          @click="pick(c)"
        >
          <span class="num">{{ String(chapters.findIndex((x) => x.id === c.id) + 1).padStart(2, '0') }}</span>
          <span><b>{{ c.title || '未命名章节' }}</b><small>{{ fmt(c.wordCount) }} 字</small></span>
          <i>{{ c.id === work.selChapterId ? '●' : '·' }}</i>
        </button>
      </template>
      <p v-if="!visibleChapters.length" class="crimson-rail-empty">没有匹配的章节</p>
    </nav>

    <div class="crimson-rail-foot">
      <span>共 {{ totalChapters }} 章 · {{ fmt(totalWords) }} 字</span>
      <button class="crimson-rail-new" type="button" aria-label="新建章节" title="新建章节" @click="addChapter">＋</button>
    </div>

    <div class="crimson-rail-mini" aria-label="章节快捷导航">
      <span class="crimson-mini-current">{{ currentNo }}<small>章</small></span>
      <button class="crimson-mini-nav" type="button" aria-label="上一章" title="上一章" @click="step(-1)">↑</button>
      <button class="crimson-mini-nav" type="button" aria-label="下一章" title="下一章" @click="step(1)">↓</button>
    </div>
  </aside>
</template>
