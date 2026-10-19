<script setup>
import { computed, onMounted } from 'vue'
import { NButton, NDropdown, NSpin } from 'naive-ui'
import OIcon from './OIcon.vue'
import SkinPicker from './SkinPicker.vue'
import CrimsonCover from './CrimsonCover.vue'
import { playStage } from '../services/stage-play'
import { formatShelfOpenTime } from '../services/shelf-sort'

const props = defineProps({
  works: { type: Array, required: true },
  total: { type: Number, required: true },
  firstChapter: { type: Object, default: null },
  loading: Boolean,
  busy: Boolean,
  query: { type: String, default: '' },
  openStats: { type: Object, default: () => ({}) },
  menuOptions: { type: Function, required: true }
})
const emit = defineEmits(['update:query', 'open', 'menu', 'create', 'settings', 'navigate'])

const featured = computed(() => props.works[0] || null)
const others = computed(() => props.works.slice(1))
const nav = [
  ['shelf', '书架', 'books'],
  ['chapters', '正文', 'manuscript'],
  ['outline', '大纲', 'network'],
  ['lore', '设定', 'layers'],
  ['characters', '人物', 'user'],
  ['snippets', '灵感', 'sparkle'],
  ['settings', '设置', 'gear']
]
const words = (n) => Number(n || 0).toLocaleString('zh-CN')

/* 竖排只给短题名；5–8 字均分两行；更长横排两行截断（与封面同一规则） */
const titleMode = computed(() => {
  const n = [...(featured.value?.title || '')].length
  return n <= 4 ? 'vertical' : n <= 8 ? 'two' : 'long'
})
const titleLines = computed(() => {
  const t = featured.value?.title || ''
  if (!t) return []
  if (titleMode.value === 'vertical') return [...t]
  if (titleMode.value === 'two') {
    const mid = Math.ceil([...t].length / 2)
    return [[...t].slice(0, mid).join(''), [...t].slice(mid).join('')].filter(Boolean)
  }
  return [t]
})

const featuredStat = computed(() => props.openStats[featured.value?.id] || null)
const featuredOpenText = computed(() => formatShelfOpenTime(featuredStat.value?.lastOpenedAt))
const openText = (book) => formatShelfOpenTime(props.openStats[book?.id]?.lastOpenedAt)
/* 首章卡摘录用真实正文：去标签、压空白，取第一句（最多 42 字） */
const excerpt = computed(() => {
  const raw = String(props.firstChapter?.content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  if (!raw) return ''
  const first = raw.split(/[。！？!?]/)[0] || raw
  return [...first].slice(0, 42).join('') + (first.length > 42 ? '…' : '')
})

function navigate(key) {
  if (key === 'settings') emit('settings')
  else if (key !== 'shelf' && featured.value && !props.busy) emit('navigate', key, featured.value)
}

onMounted(() => playStage())
</script>

<template>
  <section class="crimson-shelf" :class="{ 'is-empty': !featured }">
    <header class="crimson-header">
      <div class="crimson-brand">
        <span class="crimson-emblem" aria-hidden="true">坊</span>
        <span class="crimson-brand-text">小说工坊<small>赤月戏</small></span>
      </div>
      <nav class="crimson-shelf-nav" aria-label="功能模块">
        <button
          v-for="[key, label] in nav"
          :key="key"
          type="button"
          class="crimson-shelf-nav-item"
          :class="{ active: key === 'shelf' }"
          :aria-current="key === 'shelf' ? 'page' : undefined"
          :disabled="busy || (!featured && !['shelf', 'settings'].includes(key))"
          :title="['shelf', 'settings'].includes(key) ? label : '打开展示作品的' + label"
          @click="navigate(key)"
        >{{ label }}</button>
      </nav>
      <div class="crimson-header-actions">
        <SkinPicker />
        <NButton size="small" quaternary aria-label="外观与设置" title="外观与设置" @click="emit('settings')"><OIcon name="gear" :size="18" /></NButton>
      </div>
    </header>

    <main class="crimson-main">
      <div class="crimson-toolbar">
        <h2>我的作品<span>共 {{ total }} 部</span></h2>
        <div class="crimson-shelf-actions">
          <label class="crimson-search">
            <OIcon name="search" :size="15" />
            <input
              type="search"
              :value="query"
              placeholder="搜索作品"
              aria-label="搜索作品"
              @input="emit('update:query', $event.target.value)"
            />
          </label>
          <button type="button" class="crimson-button primary" @click="emit('create')">＋ 新建作品</button>
        </div>
      </div>

      <NSpin :show="loading">
        <template v-if="featured">
          <section class="crimson-stage" aria-label="主作品舞台">
            <div class="crimson-stage-art" aria-hidden="true"></div>
            <div class="crimson-front-art" aria-hidden="true"></div>
            <div class="crimson-stage-fade" aria-hidden="true"></div>

            <div class="crimson-story">
              <p class="crimson-eyebrow">{{ query ? '搜索结果' : '最近打开' }}<span>　·　上次打开 {{ featuredOpenText }}</span></p>
              <h1 class="crimson-main-title" :class="'title-' + titleMode" :title="featured.title">
                <template v-if="titleMode === 'vertical'">{{ featured.title }}</template>
                <span v-else v-for="(line, i) in titleLines" :key="i" class="crimson-title-line">{{ line }}</span>
              </h1>
              <p class="crimson-synopsis">{{ featured.intro || '故事从这里开始。' }}</p>
              <div class="crimson-story-actions">
                <button type="button" class="crimson-button primary" :disabled="busy" @click="emit('open', featured)">继续写作 <span class="arrow">→</span></button>
                <button type="button" class="crimson-quiet" :disabled="busy" @click="emit('navigate', 'outline', featured)">故事大纲 ↗</button>
              </div>
              <div class="crimson-stats">
                <span><b>{{ words(featured.totalWords) }}</b> 字</span>
                <span><b>{{ featured.chapterCount || 0 }}</b> 章</span>
                <span>{{ featured.genre }} · {{ featured.status }}</span>
              </div>
            </div>

            <div class="crimson-book-stage">
              <button
                type="button"
                class="crimson-book-object"
                :disabled="busy"
                :aria-label="'打开《' + featured.title + '》'"
                @click="emit('open', featured)"
              >
                <CrimsonCover :book="featured" />
              </button>
              <span class="crimson-book-spine" aria-hidden="true"></span>
              <div class="crimson-work-menu" @click.stop @keydown.stop>
                <NDropdown trigger="click" :options="menuOptions(featured)" @select="emit('menu', $event, featured)">
                  <NButton size="tiny" quaternary :aria-label="'作品菜单：' + featured.title">⋯</NButton>
                </NDropdown>
              </div>
            </div>

            <button v-if="firstChapter" type="button" class="crimson-chapter-card" :disabled="busy" @click="emit('open', featured)">
              <small>接续上次的故事</small>
              <h3>{{ firstChapter.title }} <span class="arrow">↗</span></h3>
              <p v-if="excerpt">{{ excerpt }}</p>
            </button>
          </section>

          <aside v-if="others.length" class="crimson-program">
            <div class="crimson-program-head">
              <h2>未完的剧目</h2>
              <span>{{ query ? '匹配的作品' : '最近打开 ↓' }}</span>
            </div>
            <div class="crimson-program-list">
              <div v-for="book in others" :key="book.id" class="crimson-work-row">
                <button type="button" class="crimson-work-open" :disabled="busy" @click="emit('open', book)">
                  <CrimsonCover :book="book" variant="mini" />
                  <span class="crimson-work-copy">
                    <h3 :title="book.title">{{ book.title }}</h3>
                    <p>{{ words(book.totalWords) }} 字 · {{ book.chapterCount || 0 }} 章</p>
                    <p class="crimson-work-openat">上次打开 {{ openText(book) }}</p>
                  </span>
                  <span class="arrow" aria-hidden="true">↗</span>
                </button>
                <div class="crimson-work-menu" @click.stop @keydown.stop>
                  <NDropdown trigger="click" :options="menuOptions(book)" @select="emit('menu', $event, book)">
                    <NButton size="tiny" quaternary :aria-label="'作品菜单：' + book.title">⋯</NButton>
                  </NDropdown>
                </div>
              </div>
            </div>
          </aside>
        </template>

        <div v-else class="crimson-empty">
          <h2>{{ total ? '没有匹配的作品' : '写下你的第一个故事' }}</h2>
          <p>{{ total ? '试试其他书名、作者或类型。' : '从一个念头开始，让它成为一本书。' }}</p>
          <button v-if="!total" type="button" class="crimson-button primary" @click="emit('create')">＋ 新建作品</button>
        </div>
      </NSpin>
    </main>

    <footer class="crimson-footer">
      <span>{{ total }} 部作品<template v-if="featured"> · 上次打开 {{ featuredOpenText }}</template></span>
      <div>
        <button type="button" class="crimson-footer-link" @click="playStage()">重播演出</button>
      </div>
    </footer>
  </section>
</template>
