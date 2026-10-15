<script setup>
import { computed, ref, watch } from 'vue'
import { NButton, NInput, NSpin, NDropdown } from 'naive-ui'
import OIcon from './OIcon.vue'
import SkinPicker from './SkinPicker.vue'
import GravityBook from './GravityBook.vue'
import GravityCover from './GravityCover.vue'

const props = defineProps({
  works: { type: Array, required: true }, total: { type: Number, required: true },
  loading: Boolean, query: { type: String, default: '' }, busy: Boolean,
  menuOptions: { type: Function, required: true }
})
const emit = defineEmits(['update:query', 'open', 'menu', 'create', 'settings', 'navigate'])

/* ── 中央书（翻动） ────────────────────────────────────────────────
   activeId 存 id 而不是下标：列表刷新、搜索过滤之后都不会指错书。
   数据一变（刷新 / 搜索 / 新建 / 编辑 / 删除）就回到 works[0]，
   与改造前「中央 = 最近更新那本」的语义一致。 */
const activeId = ref(null)
const activeIndex = computed(() => {
  const i = props.works.findIndex((w) => w.id === activeId.value)
  return i < 0 ? 0 : i
})
const activeBook = computed(() => props.works[activeIndex.value] || null)
watch(() => props.works.map((w) => w.id).join('|'), () => { activeId.value = props.works[0]?.id ?? null }, { immediate: true })

/* 舞台上的位次：中央 + 两侧（离中央最近的两本，小下标在左、大下标在右）
   + 再外一层的缓冲位。缓冲位不可见也不可交互，只为下一步换位留出「来处」，
   这样滑动窗口推进时新进侧位的书是淡入，而不是凭空出现。
   端点处某一侧没有更近的书时，用次近的一本补位 —— 沿用改造前的摆法，
   于是左右两侧永远都有书可点，默认视图也与改造前完全一致。 */
const OUTER = 2
const slots = computed(() => {
  const works = props.works
  const n = works.length
  if (!n) return []
  const base = activeIndex.value
  const ranked = []
  for (let d = 1; d <= OUTER + 2; d++) {
    if (base - d >= 0) ranked.push(base - d)
    if (base + d < n) ranked.push(base + d)
  }
  const poses = new Map([[base, 'center']])
  const [a, b] = ranked
  if (a !== undefined) poses.set(a, b === undefined || a < b ? 'left' : 'right')
  if (b !== undefined) poses.set(b, a < b ? 'right' : 'left')
  const tier = { left: 0, right: 0 }
  for (const index of ranked.slice(2, 2 + OUTER)) {
    const side = index < base ? 'left' : 'right'
    poses.set(index, 'outer-' + side + (tier[side]++ ? '-2' : ''))
  }
  /* 必须按书架下标稳定排序：换个顺序 Vue 会移动 DOM 节点，而节点一被搬动，
     它身上的 CSS 过渡就被取消——姿态会「跳」而不是滑过去。 */
  return [...poses]
    .sort((x, y) => x[0] - y[0])
    .map(([index, pose]) => ({ index, pose, book: works[index] }))
})
const isOuter = (pose) => pose.startsWith('outer-')
const others = computed(() => props.works.filter((w) => w.id !== activeId.value))

/* 两种翻动手势：
   方案1「翻转亮相」（舞台点击 / 方向键）—— 纯姿态过渡：被点的书一路转正到中央，
        原中央书反向转身、缩小变暗退到对面书位；
   方案2「抽书让位」（列表点击）—— 入场的书从下方抽出上浮，离场的那本下沉让位。 */
const risingId = ref(null)
const sinkingId = ref(null)
const landingId = ref(null)

function focusBook(book) {
  if (!book || book.id === activeId.value) return
  const leaving = activeBook.value
  risingId.value = null
  sinkingId.value = null
  landingId.value = leaving ? leaving.id : null
  activeId.value = book.id
}
function extractBook(book) {
  if (!book || book.id === activeId.value) return
  const leaving = activeBook.value
  activeId.value = book.id
  risingId.value = book.id
  sinkingId.value = leaving ? leaving.id : null
  landingId.value = leaving ? leaving.id : null
}
/* 关键帧都收在恒等姿态上，播完摘掉类即可无缝交棒给姿态过渡 */
function onLiftEnd(id, event) {
  if (event.animationName === 'gravity-rise' && risingId.value === id) risingId.value = null
  if (event.animationName === 'gravity-sink' && sinkingId.value === id) sinkingId.value = null
}
function step(delta) {
  const next = props.works[activeIndex.value + delta]
  if (next) focusBook(next)
}
function onStageKeydown(event) {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
  if (event.target?.closest?.('input, textarea, [contenteditable="true"]')) return
  event.preventDefault()
  step(event.key === 'ArrowRight' ? 1 : -1)
}

const nav = [
  { key: 'shelf', label: '书架', icon: 'books' },
  { key: 'chapters', label: '正文', icon: 'note' },
  { key: 'outline', label: '大纲', icon: 'container' },
  { key: 'lore', label: '设定', icon: 'landmark' },
  { key: 'characters', label: '人物', icon: 'user' },
  { key: 'snippets', label: '灵感', icon: 'star' },
  { key: 'settings', label: '设置', icon: 'gear' }
]
function navigate(key) {
  if (key === 'shelf') return
  if (key === 'settings') emit('settings')
  else if (activeBook.value) emit('navigate', key, activeBook.value)
}
function words(n) { return (Number(n) || 0).toLocaleString('zh-CN') }
function date(n) {
  const value = new Date(n)
  return Number.isFinite(value.getTime()) ? value.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' }) : '尚未记录'
}
</script>

<template>
  <section class="gravity-shelf" aria-label="引力书舱">
    <header class="gravity-header">
      <div class="gravity-brand"><span class="gravity-mark">坊</span><strong>小说工坊</strong><span class="gravity-brand-sub">故事，自有引力。</span></div>
      <div class="gravity-header-actions"><SkinPicker /><button type="button" class="gravity-icon-button" aria-label="设置" @click="emit('settings')"><OIcon name="gear" :size="19" /></button></div>
    </header>

    <main class="gravity-scroll">
      <div class="gravity-toolbar">
        <div class="gravity-heading"><h1>我的作品</h1><span class="gravity-count">{{ query.trim() ? works.length + ' / ' + total : total }}</span></div>
        <div class="gravity-tools">
          <NInput :value="query" aria-label="搜索作品、作者、类型" placeholder="搜索作品、作者、类型…" clearable @update:value="emit('update:query', $event)"><template #prefix><OIcon name="search" :size="16" /></template></NInput>
          <NButton type="primary" class="gravity-create" @click="emit('create')"><OIcon name="plus" :size="16" /> 新建作品</NButton>
        </div>
      </div>

      <NSpin :show="loading || busy">
        <div v-if="activeBook" class="gravity-stage">
          <div :key="'copy-' + activeBook.id" class="gravity-feature-copy">
            <p class="gravity-eyebrow"><span></span>{{ query.trim() ? '搜索结果' : '最近更新' }} · {{ date(activeBook.updatedAt) }}</p>
            <h2 :class="{ 'gravity-title-long': activeBook.title.length > 10 }">{{ activeBook.title }}</h2>
            <p class="gravity-intro">{{ activeBook.intro || '故事的下一页，正等你落笔。' }}</p>
            <div class="gravity-feature-actions"><NButton type="primary" size="large" @click="emit('open', activeBook)">打开作品 <OIcon name="external" :size="15" /></NButton><button type="button" class="gravity-text-button" @click="emit('navigate', 'outline', activeBook)">故事大纲 <span>↗</span></button></div>
            <dl class="gravity-stats"><div><dt>字数</dt><dd>{{ words(activeBook.totalWords) }}<small>字</small></dd></div><div><dt>章节</dt><dd>{{ activeBook.chapterCount || 0 }}<small>章</small></dd></div><div class="gravity-genre"><dt>类型</dt><dd>{{ activeBook.genre || '其他' }}</dd></div></dl>
          </div>

          <div class="gravity-orbit-stage" tabindex="0" role="group" aria-label="作品封面：点击两侧的书翻到中央，或按左右方向键切换" @keydown="onStageKeydown">
            <div class="gravity-atmosphere" aria-hidden="true"></div>
            <div class="gravity-orbit gravity-orbit--one" aria-hidden="true"></div><div class="gravity-orbit gravity-orbit--two" aria-hidden="true"></div>
            <div v-for="slot in slots" :key="slot.book.id" class="gravity-slot" :class="'gravity-slot--' + slot.pose" :inert="isOuter(slot.pose) ? true : null">
              <div class="gravity-pose">
                <div class="gravity-lift" :class="{ 'is-rising': risingId === slot.book.id, 'is-sinking': sinkingId === slot.book.id }" @animationend="onLiftEnd(slot.book.id, $event)">
                  <GravityBook :book="slot.book" :active="slot.pose === 'center'" :class="{ 'gravity-main-book': slot.pose === 'center' }" :options="slot.pose === 'center' ? menuOptions(slot.book) : undefined" @open="emit('open', $event)" @center="focusBook($event)" @menu="(key, book) => emit('menu', key, book)" />
                </div>
              </div>
            </div>
          </div>

          <aside :key="'detail-' + activeBook.id" class="gravity-detail">
            <svg viewBox="0 0 64 56" fill="none" aria-hidden="true"><ellipse cx="32" cy="28" rx="26" ry="10" transform="rotate(-30 32 28)" /><ellipse cx="32" cy="28" rx="15" ry="24" transform="rotate(30 32 28)" /><circle cx="32" cy="28" r="3" /></svg>
            <p class="gravity-eyebrow">关于这部作品</p><h3>{{ activeBook.author || '未署名' }}</h3>
            <p class="gravity-detail-status"><span></span>{{ activeBook.status || '构思' }}<span class="gravity-detail-separator">/</span>{{ activeBook.genre || '其他' }}</p>
            <p class="gravity-detail-note">把未曾存在的世界，<br />写成触手可及的故事。</p>
            <button type="button" class="gravity-text-button" @click="emit('menu', 'edit', activeBook)">编辑作品信息 <span>↗</span></button>
          </aside>
        </div>

        <div v-else class="gravity-empty">
          <div class="gravity-empty-orbit" aria-hidden="true"><span>坊</span></div>
          <h2>{{ total ? '暂未找到这个世界' : '为你的第一个世界，落笔。' }}</h2>
          <p>{{ total ? '没有匹配的作品，试试其他书名、作者或类型。' : '一个名字，一段故事，一整个宇宙。' }}</p>
          <NButton v-if="total" @click="emit('update:query', '')">清除搜索</NButton><NButton v-else type="primary" @click="emit('create')">新建作品</NButton>
        </div>

        <section v-if="others.length" class="gravity-library" aria-label="其他作品">
          <div class="gravity-library-head"><h2>其余的宇宙<span>{{ others.length }}</span></h2><span>按最近更新排序</span></div>
          <div class="gravity-library-grid">
            <article v-for="book in others" :key="book.id" class="gravity-library-item" :class="{ 'is-landing': landingId === book.id }">
              <button type="button" class="gravity-library-open" :aria-label="'将《' + book.title + '》送到中央'" @click="extractBook(book)">
                <GravityCover :book="book" /><span class="gravity-library-copy"><strong>{{ book.title }}</strong><span>{{ words(book.totalWords) }} 字 <i>/</i> {{ book.chapterCount || 0 }} 章</span><small>{{ book.author || '未署名' }} · {{ book.status || '构思' }}</small></span>
              </button>
              <NDropdown :options="menuOptions(book)" trigger="click" @select="key => emit('menu', key, book)"><NButton class="gravity-list-menu" size="tiny" quaternary :aria-label="'作品菜单：' + book.title">⋯</NButton></NDropdown>
            </article>
          </div>
        </section>
      </NSpin>
    </main>

    <footer class="gravity-dock-wrap"><nav class="gravity-dock" aria-label="工坊导航"><button v-for="item in nav" :key="item.key" type="button" :class="{ active: item.key === 'shelf' }" :aria-current="item.key === 'shelf' ? 'page' : undefined" :disabled="busy || (!activeBook && !['shelf', 'settings'].includes(item.key))" :title="!['shelf', 'settings'].includes(item.key) ? '打开当前展示作品的' + item.label : item.label" @click="navigate(item.key)"><OIcon :name="item.icon" :size="19" /><span>{{ item.label }}</span></button></nav></footer>
  </section>
</template>
